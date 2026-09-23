<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/WebhookDelivery.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();

$instanceId = trim((string) ($body['instance_id'] ?? ''));
$event = trim((string) ($body['event'] ?? ''));
$payload = $body['payload'] ?? null;

if ($instanceId === '' || !SupabaseRest::isUuid($instanceId)) {
    Response::error('instance_id is required', 400);
}
if ($event === '' || strlen($event) > 128) {
    Response::error('event is required', 400);
}
if ($payload === null) {
    $payload = new stdClass();
}
if (!is_array($payload) && !is_object($payload)) {
    Response::error('payload must be a JSON object', 400);
}

$jwt = SupabaseRest::bearerFromRequest();

$chatbotId = is_array($payload) ? ($payload['chatbot_id'] ?? null) : ($payload->chatbot_id ?? null);
if ($chatbotId !== null && (!is_string($chatbotId) || !SupabaseRest::isUuid($chatbotId))) {
    Response::error('Invalid chatbot_id', 400);
}

$access = SupabaseRest::rpcAsUser($config, $jwt, 'is_instance_member', ['p_instance_id' => $instanceId]);
if (!$access['ok'] || ($access['data'] ?? false) !== true) {
    Response::error('Organisation access denied', 403);
}
$list = SupabaseRest::rpcAsService($config, 'list_scoped_webhooks_for_event', [
    'p_instance_id' => $instanceId,
    'p_event' => $event,
    'p_chatbot_id' => $chatbotId,
]);

if (!$list['ok']) {
    Response::json([
        'ok' => false,
        'error' => $list['error'] ?? 'Could not list webhooks',
    ], $list['status'] >= 400 ? $list['status'] : 502);
}

$webhooks = $list['data'] ?? [];
if (!is_array($webhooks)) {
    $webhooks = [];
}

$deliveries = [];
foreach ($webhooks as $hook) {
    if (!is_array($hook)) continue;
    $deliveries[] = \FlowForge\Api\WebhookDelivery::send($config, $hook, $event, [
        'event' => $event, 'instance_id' => $instanceId, 'payload' => $payload,
    ]);
}

Response::json([
    'ok' => true,
    'event' => $event,
    'instance_id' => $instanceId,
    'delivered' => count($deliveries),
    'results' => $deliveries,
]);

