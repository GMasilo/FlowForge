<?php

declare(strict_types=1);

/**
 * Resend an organisation invite email.
 *
 * Body (one of):
 *   invite_id — pending instance_invites row
 *   email + instance_id — pending invite or pending member by email
 *   user_id + instance_id — pending member who has not signed in yet
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/SupabaseRest.php';
require_once dirname(__DIR__) . '/lib/PlatformMail.php';
require_once dirname(__DIR__) . '/lib/InviteMail.php';

use FlowForge\Api\InviteMail;
use FlowForge\Api\PlatformMail;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();

$inviteId = trim((string) ($body['invite_id'] ?? ''));
$userId = trim((string) ($body['user_id'] ?? ''));
$instanceId = trim((string) ($body['instance_id'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? '')));

$jwt = SupabaseRest::bearerFromRequest();
$appUrl = PlatformMail::appUrl($config);
$redirectTo = $appUrl !== '' ? $appUrl . '/' : '';

function flowforge_send_invite_row(array $config, string $jwt, string $inviteId, string $redirectTo): void
{
    $rpc = SupabaseRest::rpcAsUser($config, $jwt, 'get_invite_for_sending', [
        'p_invite_id' => $inviteId,
    ]);
    if (!$rpc['ok']) {
        Response::json([
            'ok' => false,
            'error' => $rpc['error'] ?? 'Could not load invite',
        ], $rpc['status'] >= 400 ? $rpc['status'] : 502);
    }
    $invite = is_array($rpc['data'] ?? null) ? $rpc['data'] : null;
    if (!$invite || empty($invite['email']) || empty($invite['token'])) {
        Response::error('Invite not found or incomplete', 404);
    }

    $authInvite = InviteMail::sendAuthInvite(
        $config,
        (string) $invite['email'],
        $redirectTo,
        ['display_name' => (string) ($invite['display_name'] ?? '')],
    );
    if ($authInvite['ok']) {
        SupabaseRest::rpcAsUser($config, $jwt, 'mark_invite_email_status', [
            'p_invite_id' => $inviteId,
            'p_ok' => true,
            'p_error' => null,
        ]);
        Response::json([
            'ok' => true,
            'email' => (string) $invite['email'],
            'email_via' => 'supabase',
        ]);
    }

    $smtpSend = InviteMail::sendSignupInvite(
        $config,
        $jwt,
        $inviteId,
        (string) $invite['email'],
        (string) $invite['token'],
        trim((string) ($invite['organisation_name'] ?? 'your organisation')) ?: 'your organisation',
        trim((string) ($invite['display_name'] ?? '')),
    );
    if ($smtpSend['ok']) {
        Response::json([
            'ok' => true,
            'email' => (string) $invite['email'],
            'email_via' => $smtpSend['via'] ?? 'smtp',
            'message_id' => $smtpSend['message_id'] ?? null,
        ]);
    }

    Response::json([
        'ok' => false,
        'error' => $smtpSend['error'] ?? $authInvite['error'] ?? 'Failed to resend invite',
    ], 502);
}

if ($inviteId !== '' && preg_match('/^[0-9a-f-]{36}$/i', $inviteId)) {
    flowforge_send_invite_row($config, $jwt, $inviteId, $redirectTo);
}

if ($instanceId === '' || !preg_match('/^[0-9a-f-]{36}$/i', $instanceId)) {
    Response::error('instance_id is required when invite_id is not provided', 400);
}

// Ensure caller can manage this organisation.
$canAdmin = SupabaseRest::rpcAsUser($config, $jwt, 'has_instance_role', [
    'p_instance_id' => $instanceId,
    'p_roles' => ['owner', 'admin'],
]);
if (!$canAdmin['ok'] || $canAdmin['data'] !== true) {
    Response::error('Only owners and admins can resend invites', 403);
}

if ($email === '' && $userId !== '' && preg_match('/^[0-9a-f-]{36}$/i', $userId)) {
    $profile = SupabaseRest::restSelectAsService(
        $config,
        'profiles',
        'id=eq.' . rawurlencode($userId) . '&select=email&limit=1',
    );
    if ($profile['ok'] && is_array($profile['data'] ?? null) && isset($profile['data'][0]['email'])) {
        $email = strtolower(trim((string) $profile['data'][0]['email']));
    }
}

if ($email === '' || !str_contains($email, '@')) {
    Response::error('email or user_id is required', 400);
}

// If a pending invite row still exists, prefer that path.
$pending = SupabaseRest::restSelectAsService(
    $config,
    'instance_invites',
    'instance_id=eq.' . rawurlencode($instanceId)
        . '&email=eq.' . rawurlencode($email)
        . '&select=id&limit=1',
);
if ($pending['ok'] && is_array($pending['data'] ?? null) && isset($pending['data'][0]['id'])) {
    flowforge_send_invite_row($config, $jwt, (string) $pending['data'][0]['id'], $redirectTo);
}

$resend = InviteMail::resendAuthInvite($config, $email, $redirectTo);
if ($resend['ok']) {
    Response::json([
        'ok' => true,
        'email' => $email,
        'email_via' => $resend['via'] ?? 'supabase',
    ]);
}

Response::json([
    'ok' => false,
    'error' => $resend['error'] ?? 'Failed to resend invite',
], 502);
