<?php
declare(strict_types=1);

/**
 * Emit webhooks for a completed/failed public conversation session.
 * Authenticated by session_id (must exist and not be active).
 */
require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\HttpClient;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_deferred_auth(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();

$sessionId = trim((string) ($body['session_id'] ?? ''));
if ($sessionId === '' || !SupabaseRest::isUuid($sessionId)) {
    Response::error('session_id is required', 400);
}

RateLimiter::hit($config, 'anon:' . Security::clientIp());

$sessionRpc = SupabaseRest::rpcAsService($config, 'get_conversation_session_for_webhook', [
    'p_session_id' => $sessionId,
]);
if (!$sessionRpc['ok'] || !is_array($sessionRpc['data'] ?? null) || ($sessionRpc['data'] ?? null) === null) {
    Response::error($sessionRpc['error'] ?? 'Session not found', 404);
}

$session = $sessionRpc['data'];
$status = (string) ($session['status'] ?? '');
if ($status === 'active' || $status === '') {
    Response::error('Session is still active', 409);
}

$instanceId = (string) ($session['instance_id'] ?? '');
$event = $status === 'completed' ? 'conversation.completed' : 'conversation.failed';

$hooksRpc = SupabaseRest::rpcAsService($config, 'list_webhooks_for_event', [
    'p_instance_id' => $instanceId,
    'p_event' => $event,
]);
if (!$hooksRpc['ok']) {
    Response::json(['ok' => false, 'error' => $hooksRpc['error'] ?? 'Failed to list webhooks'], 502);
}

$hooks = $hooksRpc['data'] ?? [];
if (!is_array($hooks)) {
    $hooks = [];
}
if ($hooks !== [] && !array_is_list($hooks)) {
    $hooks = [$hooks];
}

$payload = [
    'event' => $event,
    'session' => $session,
    'emitted_at' => gmdate('c'),
];
$bodyJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($bodyJson === false) {
    Response::error('Failed to encode payload', 500);
}

$results = [];
foreach ($hooks as $hook) {
    if (!is_array($hook)) {
        continue;
    }
    $url = (string) ($hook['url'] ?? '');
    $secret = (string) ($hook['secret'] ?? '');
    $hookId = (string) ($hook['id'] ?? '');
    if ($url === '' || $hookId === '') {
        continue;
    }

    $sig = hash_hmac('sha256', $bodyJson, $secret);
    $resp = HttpClient::request(
        'POST',
        $url,
        [
            'Content-Type' => 'application/json',
            'X-FlowForge-Signature' => 'sha256=' . $sig,
            'X-FlowForge-Event' => $event,
        ],
        $bodyJson,
        15,
        65536,
    );

    SupabaseRest::rpcAsService($config, 'record_webhook_delivery', [
        'p_webhook_id' => $hookId,
        'p_event' => $event,
        'p_payload' => $payload,
        'p_status_code' => $resp['status'] ?? null,
        'p_ok' => (bool) ($resp['ok'] ?? false),
        'p_error' => $resp['error'] ?? null,
    ]);

    $results[] = [
        'webhook_id' => $hookId,
        'ok' => (bool) ($resp['ok'] ?? false),
        'status' => $resp['status'] ?? null,
    ];
}

Response::json(['ok' => true, 'event' => $event, 'deliveries' => $results]);
