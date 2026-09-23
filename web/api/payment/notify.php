<?php
declare(strict_types=1);

/**
 * Inbound payment notification (PayFast ITN, Stripe webhook, or custom HMAC/secret callback).
 * No JWT — authenticated by gateway signature / shared secret.
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/PayFast.php';
require_once __DIR__ . '/Stripe.php';

use FlowForge\Api\PayFast;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\Stripe;
use FlowForge\Api\SupabaseRest;

/**
 * Stripe sends deeply nested JSON and signs the exact raw bytes, so it can't go through
 * Security::readNotifyPayload() (which flattens to a string map and would already have
 * consumed/mangled the body). Handled as its own path, detected by the Stripe-Signature header.
 *
 * @param array<string, mixed> $config
 */
function flowforge_handle_stripe_notify(array $config, string $signatureHeader): void
{
    $rawBody = file_get_contents('php://input', false, null, 0, 262144) ?: '';
    if ($rawBody === '') {
        Response::error('Empty request body', 400);
    }

    $event = json_decode($rawBody, true);
    if (!is_array($event)) {
        Response::error('Invalid Stripe payload', 400);
    }

    $eventType = (string) ($event['type'] ?? '');
    $object = $event['data']['object'] ?? [];
    if (!is_array($object)) {
        $object = [];
    }

    // We put our reference in both places when creating the session — either is fine.
    $reference = trim((string) ($object['client_reference_id'] ?? $object['metadata']['reference'] ?? ''));
    if ($reference === '') {
        // Can't reconcile this event to anything of ours — ack so Stripe stops retrying.
        Response::json(['ok' => true, 'ignored' => true]);
    }

    $intentRpc = SupabaseRest::rpcAsService($config, 'get_payment_intent', [
        'p_reference' => $reference,
    ]);
    if (!$intentRpc['ok'] || !is_array($intentRpc['data'] ?? null) || $intentRpc['data'] === null) {
        Response::error('Unknown payment reference', 404);
    }
    $intent = $intentRpc['data'];

    $connectionId = (string) ($intent['connection_id'] ?? '');
    $secretRpc = SupabaseRest::rpcAsService($config, 'connection_config_for_payment', [
        'p_connection_id' => $connectionId,
    ]);
    if (!$secretRpc['ok'] || !is_array($secretRpc['data'] ?? null) || $secretRpc['data'] === null) {
        Response::error('Payment connection not found', 403);
    }
    $connection = $secretRpc['data'];
    if (($intent['provider'] ?? '') !== 'stripe' || ($connection['provider'] ?? '') !== 'stripe') {
        Response::error('Payment provider mismatch', 403);
    }
    $webhookSecret = trim((string) ($connection['webhookSecret'] ?? ''));

    // Verify AFTER loading the connection but BEFORE trusting anything in $event beyond the
    // reference lookup above (which only touched our own DB, not the event's claims).
    $check = Stripe::verifySignature($rawBody, $signatureHeader, $webhookSecret);
    if (!$check['ok']) {
        Response::error($check['error'] ?? 'Stripe signature verification failed', 403);
    }

    if ((string) ($intent['status'] ?? '') === 'verified') {
        // Idempotent success for retries — still attempt stock decrement (RPC is idempotent).
        SupabaseRest::rpcAsService($config, 'decrement_store_stock_for_payment_reference', [
            'p_reference' => $reference,
        ]);
        Response::json(['ok' => true, 'status' => 'verified', 'reference' => $reference]);
    }

    $providerPaymentId = (string) ($object['payment_intent'] ?? $object['id'] ?? '');

    $succeeded = in_array($eventType, ['checkout.session.completed', 'checkout.session.async_payment_succeeded'], true);
    if ($succeeded) {
        // Async payment methods (e.g. bank transfers) can complete the session before the
        // money has actually arrived — only treat it as paid once Stripe confirms that too.
        $succeeded = (string) ($object['payment_status'] ?? '') === 'paid';
    }

    if (!$succeeded) {
        if (in_array($eventType, ['checkout.session.async_payment_failed', 'checkout.session.expired'], true)) {
            SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
                'p_reference' => $reference,
                'p_status' => $eventType === 'checkout.session.expired' ? 'cancelled' : 'failed',
                'p_provider_payment_id' => $providerPaymentId,
                'p_payload' => $event,
            ]);
        }
        // Anything else (e.g. checkout.session.async_payment_processing) — ack and wait.
        Response::json(['ok' => true, 'ignored' => true, 'type' => $eventType]);
    }

    if ((int) ($object['amount_total'] ?? -1) !== (int) round((float) ($intent['amount'] ?? 0) * 100)
        || strtoupper((string) ($object['currency'] ?? '')) !== strtoupper((string) ($intent['currency'] ?? ''))) {
        Response::error('Payment amount or currency mismatch', 400);
    }

    SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
        'p_reference' => $reference,
        'p_status' => 'verified',
        'p_provider_payment_id' => $providerPaymentId,
        'p_payload' => $event,
    ]);

    SupabaseRest::rpcAsService($config, 'decrement_store_stock_for_payment_reference', [
        'p_reference' => $reference,
    ]);

    Response::json(['ok' => true, 'status' => 'verified', 'reference' => $reference]);
}

$boot = flowforge_bootstrap_public(['POST']);
$config = $boot['config'];
RateLimiter::hit($config, 'pay-notify:' . Security::clientIp());

$stripeSignature = trim((string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''));
if ($stripeSignature !== '') {
    flowforge_handle_stripe_notify($config, $stripeSignature);
    exit;
}

$posted = Security::readNotifyPayload();
$reference = trim((string) ($posted['m_payment_id'] ?? $posted['reference'] ?? $posted['payment_id'] ?? ''));
if ($reference === '') {
    Response::error('Missing payment reference', 400);
}

$intentRpc = SupabaseRest::rpcAsService($config, 'get_payment_intent', [
    'p_reference' => $reference,
]);
if (!$intentRpc['ok'] || !is_array($intentRpc['data'] ?? null) || $intentRpc['data'] === null) {
    Response::error('Unknown payment reference', 404);
}
$intent = $intentRpc['data'];
$currentStatus = (string) ($intent['status'] ?? '');
if ($currentStatus === 'verified') {
    // Idempotent success for retries — still attempt stock decrement (RPC is idempotent).
    SupabaseRest::rpcAsService($config, 'decrement_store_stock_for_payment_reference', [
        'p_reference' => $reference,
    ]);
    http_response_code(200);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'OK';
    exit;
}

$connectionId = (string) ($intent['connection_id'] ?? '');
$secretRpc = SupabaseRest::rpcAsService($config, 'connection_config_for_payment', [
    'p_connection_id' => $connectionId,
]);
if (!$secretRpc['ok'] || !is_array($secretRpc['data'] ?? null) || $secretRpc['data'] === null) {
    Response::error('Payment connection not found', 403);
}
$connection = $secretRpc['data'];
$provider = strtolower(trim((string) ($intent['provider'] ?? $connection['provider'] ?? 'payfast')));

$expectedAmount = isset($intent['amount']) ? number_format((float) $intent['amount'], 2, '.', '') : '';

if ($provider === 'payfast') {
    $merchantId = trim((string) ($connection['merchantId'] ?? ''));
    $passphrase = (string) ($connection['passphrase'] ?? '');
    $sandbox = !empty($connection['sandbox']);
    $check = PayFast::confirmItn($posted, $merchantId, $passphrase, $sandbox, $expectedAmount);
    if (!$check['ok']) {
        SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
            'p_reference' => $reference,
            'p_status' => 'failed',
            'p_provider_payment_id' => (string) ($posted['pf_payment_id'] ?? ''),
            'p_payload' => $posted,
        ]);
        Response::error($check['error'] ?? 'PayFast confirmation failed', 400);
    }

    SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
        'p_reference' => $reference,
        'p_status' => 'verified',
        'p_provider_payment_id' => (string) ($posted['pf_payment_id'] ?? ''),
        'p_payload' => $posted,
    ]);

    SupabaseRest::rpcAsService($config, 'decrement_store_stock_for_payment_reference', [
        'p_reference' => $reference,
    ]);

    http_response_code(200);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'OK';
    exit;
}

$sharedSecret = trim((string) ($connection['sharedSecret'] ?? ''));
if ($sharedSecret === '') {
    Response::error('Custom payment connection is missing a shared secret', 400);
}

$headerSecret = trim((string) ($_SERVER['HTTP_X_PAYMENT_SECRET'] ?? $posted['secret'] ?? ''));
$postedStatus = strtolower(trim((string) ($posted['status'] ?? $posted['payment_status'] ?? '')));
$complete = in_array($postedStatus, ['complete', 'completed', 'paid', 'verified', 'success'], true);

$hmacPayload = $reference . '|' . $postedStatus . '|' . trim((string) ($posted['amount'] ?? $expectedAmount));
$postedSig = trim((string) ($posted['signature'] ?? $_SERVER['HTTP_X_SIGNATURE'] ?? ''));
$validHmac = $postedSig !== '' && hash_equals(
    hash_hmac('sha256', $hmacPayload, $sharedSecret),
    strtolower($postedSig),
);
$validSecret = $headerSecret !== '' && hash_equals($sharedSecret, $headerSecret);

if (!$validHmac && !$validSecret) {
    Response::error('Invalid payment callback signature', 403);
}
if (!$complete) {
    SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
        'p_reference' => $reference,
        'p_status' => 'failed',
        'p_provider_payment_id' => (string) ($posted['provider_payment_id'] ?? ''),
        'p_payload' => $posted,
    ]);
    Response::error('Payment was not complete', 400);
}

SupabaseRest::rpcAsService($config, 'update_payment_intent_status', [
    'p_reference' => $reference,
    'p_status' => 'verified',
    'p_provider_payment_id' => (string) ($posted['provider_payment_id'] ?? ''),
    'p_payload' => $posted,
]);

SupabaseRest::rpcAsService($config, 'decrement_store_stock_for_payment_reference', [
    'p_reference' => $reference,
]);

Response::json(['ok' => true, 'status' => 'verified', 'reference' => $reference]);
