<?php
declare(strict_types=1);

/**
 * Poll payment intent status. Auth: JWT or session_id (must match the intent).
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once __DIR__ . '/Stripe.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;
use FlowForge\Api\Stripe;

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

// A redirect is not proof of payment. Reconcile pending Stripe checkouts directly with
// Stripe after authenticating the caller, so delayed webhooks cannot strand the chat.
if (($intent['provider'] ?? '') === 'stripe' && ($intent['status'] ?? '') === 'pending') {
    $secretRpc = SupabaseRest::rpcAsService($config, 'connection_config_for_payment', [
        'p_connection_id' => (string) ($intent['connection_id'] ?? ''),
    ]);
    $connection = $secretRpc['data'] ?? null;
    if (!$secretRpc['ok'] || !is_array($connection) || ($connection['provider'] ?? '') !== 'stripe') {
        Response::error('Stripe payment connection is unavailable', 403);
    }
    $checked = Stripe::retrieveCheckoutSession((string) ($connection['secretKey'] ?? ''), Stripe::checkoutSessionId($intent));
    if (!$checked['ok']) Response::error($checked['error'], 502);
    $checkout = $checked['session'];
    if (!Stripe::sessionMatchesIntent($checkout, $intent)) {
        Response::error('Stripe checkout does not match this payment', 409);
    }
    if (($checkout['payment_status'] ?? '') === 'paid') {
        $updated = SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
            'p_reference' => $reference,
            'p_status' => 'verified',
            'p_provider_payment_id' => (string) ($checkout['payment_intent'] ?? $checkout['id']),
            'p_payload' => ['stripe_checkout_session_id' => $checkout['id'], 'source' => 'stripe_status_check'],
        ]);
        if (!$updated['ok'] || !is_array($updated['data'] ?? null)) {
            Response::error('Could not save payment confirmation. Please try again.', 502);
        }
        $intent = $updated['data'];
    }
}
if (($intent['status'] ?? '') === 'verified') {
    // This RPC is idempotent, including when the webhook and status check race.
    $stock = SupabaseRest::rpcAsService($config, 'decrement_store_stock_for_payment_reference', ['p_reference' => $reference]);
    if (!$stock['ok']) Response::error('Payment confirmed but order update is pending. Please try again.', 502);
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
