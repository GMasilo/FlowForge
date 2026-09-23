<?php
declare(strict_types=1);

namespace FlowForge\Api;

require_once dirname(__DIR__) . '/payment/Stripe.php';

function check(bool $condition, string $message): void {
    if (!$condition) throw new \RuntimeException($message);
}

$intent = ['reference' => 'order-ref', 'amount' => '125.50', 'currency' => 'ZAR',
    'payload' => ['stripe_checkout_session_id' => 'cs_test_example']];
$session = ['id' => 'cs_test_example', 'client_reference_id' => 'order-ref',
    'amount_total' => 12550, 'currency' => 'zar', 'payment_status' => 'paid'];
check(Stripe::sessionMatchesIntent($session, $intent), 'Matching checkout should reconcile');
foreach (['id' => 'cs_test_other', 'client_reference_id' => 'another-order', 'amount_total' => 1, 'currency' => 'usd'] as $key => $value) {
    check(!Stripe::sessionMatchesIntent(array_replace($session, [$key => $value]), $intent), 'Must reject mismatched ' . $key);
}
check(Stripe::checkoutSessionId(['checkout_url' => 'https://checkout.stripe.com/c/pay/cs_test_old#fragment']) === 'cs_test_old', 'Older pending checkouts must be recoverable');
check(Stripe::checkoutSessionId(['checkout_url' => 'https://example.com/c/pay/cs_test_old']) === '', 'Untrusted host must not supply a session ID');
check(!Stripe::retrieveCheckoutSession('', 'cs_test_example')['ok'], 'Missing credentials must fail closed');
check(!Stripe::retrieveCheckoutSession('test-key', '../example')['ok'], 'Invalid ID must fail before network access');
$body = '{"type":"checkout.session.completed"}';
$timestamp = (string) time();
$signature = hash_hmac('sha256', $timestamp . '.' . $body, 'test-webhook-secret');
check(Stripe::verifySignature($body, 't=' . $timestamp . ',v1=' . $signature, 'test-webhook-secret')['ok'], 'Valid signature should pass');
check(!Stripe::verifySignature($body . ' ', 't=' . $timestamp . ',v1=' . $signature, 'test-webhook-secret')['ok'], 'Modified notification must fail');
echo "Stripe checkout verification checks passed\n";
