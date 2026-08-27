<?php

declare(strict_types=1);

/**
 * Create an organisation member/invite and send the invitation email.
 *
 * Body:
 *   instance_id, email, role?, display_name?, job_title?, phone?, department?, notes?, send_email?
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

$instanceId = trim((string) ($body['instance_id'] ?? ''));
$email = strtolower(trim((string) ($body['email'] ?? '')));
$role = trim((string) ($body['role'] ?? 'editor'));
$displayName = trim((string) ($body['display_name'] ?? ''));
$jobTitle = trim((string) ($body['job_title'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));
$department = trim((string) ($body['department'] ?? ''));
$notes = trim((string) ($body['notes'] ?? ''));
$sendEmail = !array_key_exists('send_email', $body) || (bool) $body['send_email'];

if ($instanceId === '' || !preg_match('/^[0-9a-f-]{36}$/i', $instanceId)) {
    Response::error('instance_id is required', 400);
}
if ($email === '' || !str_contains($email, '@')) {
    Response::error('A valid email is required', 400);
}

$jwt = SupabaseRest::bearerFromRequest();
$rpc = SupabaseRest::rpcAsUser($config, $jwt, 'add_organisation_member', [
    'p_instance_id' => $instanceId,
    'p_email' => $email,
    'p_role' => $role !== '' ? $role : 'editor',
    'p_display_name' => $displayName !== '' ? $displayName : null,
    'p_job_title' => $jobTitle !== '' ? $jobTitle : null,
    'p_phone' => $phone !== '' ? $phone : null,
    'p_department' => $department !== '' ? $department : null,
    'p_notes' => $notes !== '' ? $notes : null,
]);

if (!$rpc['ok']) {
    Response::json([
        'ok' => false,
        'error' => $rpc['error'] ?? 'Could not add user',
    ], $rpc['status'] >= 400 ? $rpc['status'] : 502);
}

$result = is_array($rpc['data'] ?? null) ? $rpc['data'] : null;
if (!$result || empty($result['status'])) {
    Response::error('Unexpected add_organisation_member response', 502);
}

$status = (string) $result['status'];
$inviteId = isset($result['invite_id']) ? (string) $result['invite_id'] : '';
$response = [
    'ok' => true,
    'status' => $status,
    'email' => $email,
    'invite_id' => $inviteId !== '' ? $inviteId : null,
    'user_id' => isset($result['user_id']) ? (string) $result['user_id'] : null,
    'email_sent' => false,
    'email_skipped' => false,
    'email_error' => null,
    'email_via' => null,
];

if ($status !== 'invited') {
    Response::json($response);
}

if (!$sendEmail) {
    $response['email_skipped'] = true;
    Response::json($response);
}

$appUrl = PlatformMail::appUrl($config);
$redirectTo = $appUrl !== '' ? $appUrl . '/' : '';

// Prefer Supabase Auth invite (uses project email settings). Claiming converts the
// pending invite into a membership; UI shows Pending until first sign-in.
$authInvite = InviteMail::sendAuthInvite($config, $email, $redirectTo, [
    'display_name' => $displayName,
    'invited_instance_id' => $instanceId,
]);

if ($authInvite['ok']) {
    if ($inviteId !== '') {
        SupabaseRest::rpcAsUser($config, $jwt, 'mark_invite_email_status', [
            'p_invite_id' => $inviteId,
            'p_ok' => true,
            'p_error' => null,
        ]);
    }
    $response['email_sent'] = true;
    $response['email_via'] = 'supabase';
    $response['user_id'] = $authInvite['user_id'] ?? $response['user_id'];
    // Invite row is claimed on auth user create — treat as pending member.
    $response['status'] = 'invited';
    Response::json($response);
}

// Fall back to custom SMTP signup-link email while the invite row still exists.
$inviteRpc = SupabaseRest::rpcAsUser($config, $jwt, 'get_invite_for_sending', [
    'p_invite_id' => $inviteId,
]);
$invite = is_array($inviteRpc['data'] ?? null) ? $inviteRpc['data'] : null;
if (!$inviteRpc['ok'] || !$invite || empty($invite['token'])) {
    $response['email_error'] = $authInvite['error']
        ?? 'Invite created, but email could not be sent (Auth invite failed and invite row unavailable)';
    Response::json($response);
}

$smtpSend = InviteMail::sendSignupInvite(
    $config,
    $jwt,
    $inviteId,
    (string) $invite['email'],
    (string) $invite['token'],
    trim((string) ($invite['organisation_name'] ?? 'your organisation')) ?: 'your organisation',
    trim((string) ($invite['display_name'] ?? $displayName)),
);

if ($smtpSend['ok']) {
    $response['email_sent'] = true;
    $response['email_via'] = $smtpSend['via'] ?? 'smtp';
    Response::json($response);
}

$response['email_error'] = $smtpSend['error']
    ?? $authInvite['error']
    ?? 'Failed to send invite email';
// Invite/user was created — return 200 so the UI can show Pending + resend.
Response::json($response);
