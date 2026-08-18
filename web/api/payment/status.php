<?php
declare(strict_types=1);

/**
 * Poll payment intent status. Auth: JWT or session_id (must match the intent).
 */
require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_deferred_auth(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();
$auth = flowforge_finalize_auth($config, $body);

$reference = trim((string) ($body['reference'] ?? ''));
$sessionId = trim((string) ($body['session_id'] ?? ''));
$chatbotId = trim((string) ($body['chatbot_id'] ?? ''));

if ($reference === '') {
    Response::error('reference is required', 400);
}

$intentRpc = SupabaseRest::rpcAsService($config, 'get_payment_intent', [
    'p_reference' => $reference,
]);
if (!$intentRpc['ok'] || !is_array($intentRpc['data'] ?? null) || $intentRpc['data'] === null) {
    Response::error('Payment not found', 404);
}
$intent = $intentRpc['data'];

$intentSession = trim((string) ($intent['session_id'] ?? ''));
$intentChatbot = trim((string) ($intent['chatbot_id'] ?? ''));

if ($auth['anon']) {
    if ($sessionId === '' || $intentSession === '' || !hash_equals($intentSession, $sessionId)) {
        Response::error('Payment not found', 404);
    }
    if ($chatbotId !== '' && $intentChatbot !== '' && !hash_equals($intentChatbot, $chatbotId)) {
        Response::error('Payment not found', 404);
    }
} else {
    $jwt = SupabaseRest::bearerFromRequest();
    $instanceId = (string) ($intent['instance_id'] ?? '');
    if ($instanceId === '' || !SupabaseRest::isUuid($instanceId)) {
        Response::error('Payment not found', 404);
    }
    $member = SupabaseRest::rpcAsUser($config, $jwt, 'is_instance_member', [
        'p_instance_id' => $instanceId,
    ]);
    if (!$member['ok'] || $member['data'] !== true) {
        Response::error('Payment not found', 404);
    }
}

Response::json([
    'ok' => true,
    'reference' => $reference,
    'status' => (string) ($intent['status'] ?? 'pending'),
    'amount' => $intent['amount'] ?? null,
    'currency' => (string) ($intent['currency'] ?? ''),
    'item_name' => (string) ($intent['item_name'] ?? ''),
    'provider' => (string) ($intent['provider'] ?? ''),
    'provider_payment_id' => $intent['provider_payment_id'] ?? null,
    'verified_at' => $intent['verified_at'] ?? null,
]);
