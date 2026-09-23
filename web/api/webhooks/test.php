<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/WebhookDelivery.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;
use FlowForge\Api\WebhookDelivery;

$boot = flowforge_bootstrap(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();
$id = (string) ($body['webhook_id'] ?? '');
if (!SupabaseRest::isUuid($id)) Response::error('Valid webhook_id is required', 400);
// The caller's JWT and existing admin-only RLS decide access, before any outbound request.
$hookResult = SupabaseRest::restGet($config, SupabaseRest::bearerFromRequest(), 'instance_webhooks', 'id=eq.' . rawurlencode($id) . '&select=*&limit=1');
$hook = $hookResult['data'][0] ?? null;
if (!$hookResult['ok'] || !is_array($hook)) Response::error('Webhook not found or access denied', 403);
$event = (string) ($body['event'] ?? 'conversation.completed');
if (!in_array($event, $hook['events'] ?? [], true)) Response::error('Choose an event subscribed to by this webhook', 400);
$variables = $body['variables'] ?? [];
if (!is_array($variables)) Response::error('Sample variables must be an object', 400);
$envelope = $event === 'flow.published'
    ? ['event' => $event, 'instance_id' => $hook['instance_id'], 'payload' => ['chatbot_id' => $hook['chatbot_id'], 'version' => 1]]
    : ['event' => $event, 'session' => ['id' => 'test-session', 'instance_id' => $hook['instance_id'],
        'chatbot_id' => $hook['chatbot_id'], 'status' => $event === 'conversation.completed' ? 'completed' : 'failed',
        'variables' => $variables], 'emitted_at' => gmdate('c')];
$envelope['test'] = true;
Response::json(WebhookDelivery::send($config, $hook, $event, $envelope, true));
