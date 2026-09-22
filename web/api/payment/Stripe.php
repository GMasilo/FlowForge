<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Stripe Checkout Session creation + webhook signature verification.
 * @see https://stripe.com/docs/webhooks/signatures
 * @see https://stripe.com/docs/api/checkout/sessions/create
 */
final class Stripe
{
    private const API_BASE = 'https://api.stripe.com/v1';
    private const SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes

    /**
     * Verify the `Stripe-Signature` header against the raw request body.
     * MUST be called with the raw, unparsed body — Stripe signs the exact bytes sent,
     * so json_decode-then-re-encode will not reproduce a matching signature.
     *
     * @return array{ok: bool, error?: string}
     */
    public static function verifySignature(string $rawBody, string $signatureHeader, string $webhookSecret): array
    {
        if ($webhookSecret === '') {
            return ['ok' => false, 'error' => 'Stripe webhook secret is not configured'];
        }
        if ($signatureHeader === '') {
            return ['ok' => false, 'error' => 'Missing Stripe-Signature header'];
        }

        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $signatureHeader) as $part) {
            $pair = explode('=', trim($part), 2);
            if (count($pair) !== 2) {
                continue;
            }
            [$key, $value] = $pair;
            if ($key === 't') {
                $timestamp = $value;
            } elseif ($key === 'v1') {
                $signatures[] = $value;
            }
        }

        if ($timestamp === null || !$signatures) {
            return ['ok' => false, 'error' => 'Malformed Stripe-Signature header'];
        }

        if (abs(time() - (int) $timestamp) > self::SIGNATURE_TOLERANCE_SECONDS) {
            return ['ok' => false, 'error' => 'Stripe signature timestamp is outside tolerance'];
        }

        $expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $webhookSecret);
        foreach ($signatures as $sig) {
            if (hash_equals($expected, $sig)) {
                return ['ok' => true];
            }
        }

        return ['ok' => false, 'error' => 'Stripe signature mismatch'];
    }

    /**
     * Create a Checkout Session and return its id + hosted URL.
     * `client_reference_id` and `metadata.reference` both carry our payment_intents.reference
     * so the webhook can reconcile the event back to the right row.
     *
     * @return array{ok: bool, id?: string, url?: string, error?: string}
     */
    public static function createCheckoutSession(
        string $secretKey,
        string $reference,
        string $currency,
        string $amount, // decimal string, e.g. "199.00"
        string $itemName,
        string $successUrl,
        string $cancelUrl,
        string $buyerEmail = '',
    ): array {
        if ($secretKey === '') {
            return ['ok' => false, 'error' => 'Stripe secret key is not configured on this connection'];
        }

        $unitAmount = (int) round(((float) $amount) * 100); // Stripe wants the smallest currency unit (cents)
        if ($unitAmount <= 0) {
            return ['ok' => false, 'error' => 'A positive amount is required'];
        }

        $params = [
            'mode' => 'payment',
            'client_reference_id' => $reference,
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'metadata[reference]' => $reference,
            'line_items[0][quantity]' => '1',
            'line_items[0][price_data][currency]' => strtolower($currency),
            'line_items[0][price_data][unit_amount]' => (string) $unitAmount,
            'line_items[0][price_data][product_data][name]' => $itemName !== '' ? $itemName : 'Payment',
        ];
        if ($buyerEmail !== '') {
            $params['customer_email'] = $buyerEmail;
        }

        $response = HttpClient::request(
            'POST',
            self::API_BASE . '/checkout/sessions',
            [
                'Authorization' => 'Bearer ' . $secretKey,
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
            http_build_query($params),
            20,
            16384,
        );

        if (!$response['ok'] || !is_array($response['body'] ?? null)) {
            $message = is_array($response['body'] ?? null)
                ? (string) ($response['body']['error']['message'] ?? 'Stripe rejected the request')
                : 'Could not reach Stripe';
            return ['ok' => false, 'error' => $message];
        }

        $session = $response['body'];
        $id = (string) ($session['id'] ?? '');
        $url = (string) ($session['url'] ?? '');
        if ($id === '' || $url === '') {
            return ['ok' => false, 'error' => 'Stripe response was missing a session id/url'];
        }

        return ['ok' => true, 'id' => $id, 'url' => $url];
    }
}
