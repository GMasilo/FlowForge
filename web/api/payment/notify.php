<?php
declare(strict_types=1);

/**
 * Inbound payment notification (PayFast ITN or custom HMAC/secret callback).
 * No JWT — authenticated by gateway signature / shared secret.
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/PayFast.php';

use FlowForge\Api\PayFast;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_public(['POST']);
$config = $boot['config'];
RateLimiter::hit($config, 'pay-notify:' . Security::clientIp());

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
    // Idempotent success for retries
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

Response::json(['ok' => true, 'status' => 'verified', 'reference' => $reference]);
