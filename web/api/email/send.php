<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\Mailer;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_deferred_auth(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();
$auth = flowforge_finalize_auth($config, $body);

if ($auth['anon'] && trim((string) ($body['connection_id'] ?? '')) === '') {
    Response::error('connection_id is required for public chat sessions', 400);
}

$resolved = SupabaseRest::resolveConnection($config, $body);
$connection = $resolved['connection'];
$instanceId = $resolved['instance_id'];
$usedService = $resolved['used_service_role'];

$to = trim((string) ($body['to'] ?? ''));
$subject = (string) ($body['subject'] ?? '');
$message = (string) ($body['body'] ?? ($body['message'] ?? ''));
$replyTo = isset($body['replyTo']) ? trim((string) $body['replyTo']) : null;

if ($to === '' || $subject === '') {
    Response::error('Fields to and subject are required', 400);
}

// Soft cap recipients — single recipient for MVP safety (no open relay / blast)
if (str_contains($to, ',') || str_contains($to, ';')) {
    Response::error('Only one recipient is allowed per request', 400);
}

$result = Mailer::send($connection, $to, $subject, $message, $replyTo);

if (!$result['ok']) {
    Response::json([
        'ok' => false,
        'error' => $result['error'] ?? 'Failed to send email',
    ], 502);
}

$userJwt = $auth['anon'] ? null : SupabaseRest::bearerFromRequest();
if ($instanceId !== null) {
    SupabaseRest::incrementInstanceUsage(
        $config,
        $instanceId,
        ['p_emails' => 1],
        $usedService || $auth['anon'],
        $userJwt,
    );
}

Response::json([
    'ok' => true,
    'message_id' => $result['message_id'] ?? null,
]);
