<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/SupabaseRest.php';
require_once dirname(__DIR__) . '/lib/PlatformMail.php';

use FlowForge\Api\Mailer;
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

$appUrl = PlatformMail::appUrl();
if ($appUrl === '') {
    Response::error('DEFAULT_SYSTEM_APP_URL is not configured on the server', 500);
}

$smtp = PlatformMail::smtpConfigFromEnv();
if (trim((string) ($smtp['smtpHost'] ?? '')) === '' || trim((string) ($smtp['fromEmail'] ?? '')) === '') {
    Response::error('SMTP env vars (DEFAULT_SYSTEM_*) are not configured on the server', 500);
}

$jwt = SupabaseRest::bearerFromRequest();
$rpc = SupabaseRest::rpcAsUser($boot['config'], $jwt, 'get_invite_for_sending', [
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
$token = (string) $invite['token'];
$orgName = trim((string) ($invite['organisation_name'] ?? 'your organisation'));
$displayName = trim((string) ($invite['display_name'] ?? ''));
$greeting = $displayName !== '' ? $displayName : 'there';
$signupUrl = $appUrl . '/signup?invite=' . rawurlencode($token);

$subject = 'You are invited to ' . $orgName . ' on FlowForge';
$message = implode("\n", [
    'Hi ' . $greeting . ',',
    '',
    'You have been invited to join "' . $orgName . '" on FlowForge.',
    '',
    'Create your account using this link (opens the sign-up page with your email filled in):',
    $signupUrl,
    '',
    'If you were not expecting this email, you can ignore it.',
    '',
    '— FlowForge',
]);

$result = Mailer::send($smtp, $email, $subject, $message);

if (!$result['ok']) {
    $err = (string) ($result['error'] ?? 'Failed to send invite email');
    SupabaseRest::rpcAsUser($boot['config'], $jwt, 'mark_invite_email_status', [
        'p_invite_id' => $inviteId,
        'p_ok' => false,
        'p_error' => $err,
    ]);
    Response::json([
        'ok' => false,
        'error' => $err,
    ], 502);
}

SupabaseRest::rpcAsUser($boot['config'], $jwt, 'mark_invite_email_status', [
    'p_invite_id' => $inviteId,
    'p_ok' => true,
    'p_error' => null,
]);

Response::json([
    'ok' => true,
    'message_id' => $result['message_id'] ?? null,
    'email' => $email,
]);
