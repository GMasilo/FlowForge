<?php
declare(strict_types=1);

/**
 * Emit webhooks for a completed/failed public conversation session.
 * Authenticated by session_id (must exist and not be active).
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/WebhookDelivery.php';

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

$hooksRpc = SupabaseRest::rpcAsService($config, 'list_scoped_webhooks_for_event', [
    'p_instance_id' => $instanceId,
    'p_event' => $event,
    'p_chatbot_id' => $session['chatbot_id'] ?? null,
]);
if (!$hooksRpc['ok']) {
    Response::json(['ok' => false, 'error' => $hooksRpc['error'] ?? 'Failed to list webhooks'], 502);
}

$hooks = $hooksRpc['data'] ?? [];
if (!is_array($hooks)) {
    $hooks = [];
}
if ($hooks !== [] && !(function_exists('array_is_list') ? \array_is_list($hooks) : array_keys($hooks) === range(0, count($hooks) - 1))) {
    $hooks = [$hooks];
}

$payload = [
    'event' => $event,
    'session' => $session,
    'emitted_at' => gmdate('c'),
];
$results = [];
foreach ($hooks as $hook) {
    if (!is_array($hook)) continue;
    $results[] = \FlowForge\Api\WebhookDelivery::send($config, $hook, $event, $payload);
}
Response::json(['ok' => true, 'event' => $event, 'deliveries' => $results]);
