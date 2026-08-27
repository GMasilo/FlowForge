<?php

declare(strict_types=1);

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
$body = Security::readJsonBody();

$inviteId = trim((string) ($body['invite_id'] ?? ''));
if ($inviteId === '' || !preg_match('/^[0-9a-f-]{36}$/i', $inviteId)) {
    Response::error('invite_id is required', 400);
}

$jwt = SupabaseRest::bearerFromRequest();
$config = $boot['config'];
$appUrl = PlatformMail::appUrl($config);
$redirectTo = $appUrl !== '' ? $appUrl . '/' : '';

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

$email = (string) $invite['email'];

$authInvite = InviteMail::sendAuthInvite(
    $config,
    $email,
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
        'email' => $email,
        'email_via' => 'supabase',
    ]);
}

$smtpSend = InviteMail::sendSignupInvite(
    $config,
    $jwt,
    $inviteId,
    $email,
    (string) $invite['token'],
    trim((string) ($invite['organisation_name'] ?? 'your organisation')) ?: 'your organisation',
    trim((string) ($invite['display_name'] ?? '')),
);

if ($smtpSend['ok']) {
    Response::json([
        'ok' => true,
        'message_id' => $smtpSend['message_id'] ?? null,
        'email' => $email,
        'email_via' => $smtpSend['via'] ?? 'smtp',
    ]);
}

Response::json([
    'ok' => false,
    'error' => $smtpSend['error'] ?? $authInvite['error'] ?? 'Failed to send invite email',
], 502);
