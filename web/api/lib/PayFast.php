<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * PayFast checkout signing + ITN (Instant Transaction Notification) validation.
 * @see https://developers.payfast.co.za/docs#step_4_confirm_payment
 */
final class PayFast
{
    public static function processUrl(bool $sandbox): string
    {
        return $sandbox
            ? 'https://sandbox.payfast.co.za/eng/process'
            : 'https://www.payfast.co.za/eng/process';
    }

    public static function validateUrl(bool $sandbox): string
    {
        return $sandbox
            ? 'https://sandbox.payfast.co.za/eng/query/validate'
            : 'https://www.payfast.co.za/eng/query/validate';
    }

    /**
     * @param array<string, string> $fields
     */
    public static function signature(array $fields, string $passphrase): string
    {
        $parts = [];
        foreach ($fields as $key => $value) {
            if ($key === 'signature') {
                continue;
            }
            $trimmed = trim($value);
            if ($trimmed === '') {
                continue;
            }
            $parts[] = $key . '=' . urlencode($trimmed);
        }
        $getString = implode('&', $parts);
        if (trim($passphrase) !== '') {
            $getString .= '&passphrase=' . urlencode(trim($passphrase));
        }
        return md5($getString);
    }

    /**
     * @param array<string, string> $fields
     * @return array<string, string>
     */
    public static function withSignature(array $fields, string $passphrase): array
    {
        $clean = [];
        foreach ($fields as $key => $value) {
            $trimmed = trim($value);
            if ($trimmed === '') {
                continue;
            }
            $clean[$key] = $trimmed;
        }
        $clean['signature'] = self::signature($clean, $passphrase);
        return $clean;
    }

    public static function signaturesMatch(string $expected, string $received): bool
    {
        $a = strtolower(trim($expected));
        $b = strtolower(trim($received));
        if ($a === '' || $b === '' || strlen($a) !== strlen($b)) {
            return false;
        }
        return hash_equals($a, $b);
    }

    /**
     * @param array<string, string> $posted
     * @return array{ok: bool, error?: string}
     */
    public static function confirmItn(
        array $posted,
        string $merchantId,
        string $passphrase,
        bool $sandbox,
        string $expectedAmount,
    ): array {
        $receivedSig = (string) ($posted['signature'] ?? '');
        $expectedSig = self::signature($posted, $passphrase);
        if (!self::signaturesMatch($expectedSig, $receivedSig)) {
            return ['ok' => false, 'error' => 'Invalid PayFast signature'];
        }

        $postedMerchant = trim((string) ($posted['merchant_id'] ?? ''));
        if ($postedMerchant === '' || !hash_equals($merchantId, $postedMerchant)) {
            return ['ok' => false, 'error' => 'Merchant mismatch'];
        }

        $status = strtoupper(trim((string) ($posted['payment_status'] ?? '')));
        if ($status !== 'COMPLETE') {
            return ['ok' => false, 'error' => 'Payment status is ' . ($status !== '' ? $status : 'unknown')];
        }

        if ($expectedAmount !== '') {
            $postedAmount = trim((string) ($posted['amount_gross'] ?? $posted['amount'] ?? ''));
            if ($postedAmount !== '' && abs((float) $postedAmount - (float) $expectedAmount) > 0.05) {
                return ['ok' => false, 'error' => 'Amount mismatch'];
            }
        }

        $validate = HttpClient::request(
            'POST',
            self::validateUrl($sandbox),
            ['Content-Type' => 'application/x-www-form-urlencoded'],
            http_build_query($posted),
            20,
            8192,
        );
        $body = strtoupper(trim((string) ($validate['raw_body'] ?? '')));
        if (!$validate['ok'] || $body !== 'VALID') {
            return ['ok' => false, 'error' => 'PayFast did not confirm this ITN'];
        }

        return ['ok' => true];
    }
}
