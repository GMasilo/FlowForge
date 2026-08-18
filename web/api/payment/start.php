<?php
declare(strict_types=1);

/**
 * Create a payment intent and return a signed checkout URL / form fields.
 * Auth: JWT (designer preview) or session_id (public chat).
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/PayFast.php';

use FlowForge\Api\PayFast;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_deferred_auth(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();
$auth = flowforge_finalize_auth($config, $body);

$connectionId = trim((string) ($body['connection_id'] ?? ''));
$chatbotId = trim((string) ($body['chatbot_id'] ?? ''));
$instanceId = trim((string) ($body['instance_id'] ?? ''));
$sessionId = trim((string) ($body['session_id'] ?? ''));
$nodeKey = trim((string) ($body['node_key'] ?? ''));
$returnUrl = trim((string) ($body['return_url'] ?? ''));
$cancelUrl = trim((string) ($body['cancel_url'] ?? $returnUrl));
$itemName = trim((string) ($body['item_name'] ?? 'Payment'));
$buyerEmail = trim((string) ($body['buyer_email'] ?? ''));
$buyerName = trim((string) ($body['buyer_name'] ?? ''));
$payUrl = trim((string) ($body['pay_url'] ?? ''));
$currency = strtoupper(trim((string) ($body['currency'] ?? 'ZAR'))) ?: 'ZAR';
$amountRaw = $body['amount'] ?? '';
$amount = is_numeric($amountRaw) ? number_format((float) $amountRaw, 2, '.', '') : '';

if ($connectionId === '' || !SupabaseRest::isUuid($connectionId)) {
    Response::error('connection_id is required', 400);
}
if ($chatbotId === '' || !SupabaseRest::isUuid($chatbotId)) {
    Response::error('chatbot_id is required', 400);
}
if ($instanceId === '' || !SupabaseRest::isUuid($instanceId)) {
    Response::error('instance_id is required', 400);
}
if ($sessionId !== '' && !SupabaseRest::isUuid($sessionId)) {
    Response::error('Invalid session_id', 400);
}
if ($amount === '' || (float) $amount <= 0) {
    Response::error('A positive amount is required', 400);
}
if ($returnUrl !== '' && !preg_match('#^https?://#i', $returnUrl)) {
    Response::error('return_url must be http or https', 400);
}

$resolved = SupabaseRest::resolveConnection($config, $body);
$connection = $resolved['connection'];
$provider = strtolower(trim((string) ($connection['provider'] ?? 'payfast')));
if ($provider !== 'payfast' && $provider !== 'custom') {
    $provider = 'payfast';
}

$reference = bin2hex(random_bytes(16));
$apiBase = flowforge_public_api_url($config);
$notifyUrl = $apiBase . '/payment/notify';

$checkoutUrl = $payUrl;
$fields = [];

if ($provider === 'payfast') {
    $merchantId = trim((string) ($connection['merchantId'] ?? ''));
    $merchantKey = trim((string) ($connection['merchantKey'] ?? ''));
    $passphrase = (string) ($connection['passphrase'] ?? '');
    $sandbox = !empty($connection['sandbox']);
    if ($merchantId === '' || $merchantKey === '') {
        Response::error('PayFast merchant ID and key are required on the payment connection', 400);
    }

    $fields = [
        'merchant_id' => $merchantId,
        'merchant_key' => $merchantKey,
        'return_url' => $returnUrl !== '' ? $returnUrl : $apiBase,
        'cancel_url' => $cancelUrl !== '' ? $cancelUrl : ($returnUrl !== '' ? $returnUrl : $apiBase),
        'notify_url' => $notifyUrl,
        'name_first' => $buyerName,
        'email_address' => $buyerEmail,
        'm_payment_id' => $reference,
        'amount' => $amount,
        'item_name' => $itemName !== '' ? $itemName : 'Payment',
        'item_description' => $itemName,
        'custom_str1' => $sessionId,
        'custom_str2' => $chatbotId,
        'custom_str3' => $connectionId,
    ];
    $fields = PayFast::withSignature($fields, $passphrase);
    $checkoutUrl = PayFast::processUrl($sandbox);
}

if ($provider === 'custom' && $checkoutUrl === '') {
    Response::error('Pay URL is required for a custom payment connection', 400);
}

$created = SupabaseRest::rpcAsService($config, 'create_payment_intent', [
    'p_reference' => $reference,
    'p_instance_id' => $instanceId,
    'p_chatbot_id' => $chatbotId,
    'p_session_id' => $sessionId !== '' ? $sessionId : null,
    'p_connection_id' => $connectionId,
    'p_node_key' => $nodeKey,
    'p_amount' => (float) $amount,
    'p_currency' => $currency,
    'p_item_name' => $itemName !== '' ? $itemName : 'Payment',
    'p_provider' => $provider,
    'p_checkout_url' => $checkoutUrl,
]);

if (!$created['ok'] || !is_array($created['data'] ?? null)) {
    Response::error($created['error'] ?? 'Could not create payment intent', 502);
}

Response::json([
    'ok' => true,
    'reference' => $reference,
    'provider' => $provider,
    'status' => 'pending',
    'amount' => $amount,
    'currency' => $currency,
    'checkout_url' => $checkoutUrl,
    'notify_url' => $notifyUrl,
    'fields' => $fields,
]);
