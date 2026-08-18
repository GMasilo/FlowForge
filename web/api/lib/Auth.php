<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Verifies Supabase access tokens.
 *
 * Modern Supabase projects issue ES256 user tokens (JWKS).
 * Legacy HS256 tokens are still supported when supabase_jwt_secret is set
 * (never put the anon/service_role API key here — that is a JWT, not the secret).
 */
final class Auth
{
    /**
     * @return array{sub: string, email?: string|null, role?: string, claims: array}
     */
    public static function requireUser(array $config): array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';

        // Some Apache CGI setups only expose the header via getallheaders()
        if ($header === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                if (strcasecmp((string) $name, 'Authorization') === 0) {
                    $header = (string) $value;
                    break;
                }
            }
        }

        if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            Response::error('Missing or invalid Authorization bearer token', 401);
        }

        $token = $m[1];
        $diag = self::diagnoseToken($token, $config);
        if (($diag['ok'] ?? false) !== true || !is_array($diag['claims'] ?? null)) {
            Response::error((string) ($diag['error'] ?? 'Invalid or expired token'), (int) ($diag['status'] ?? 401));
        }
        $claims = $diag['claims'];

        $role = (string) ($claims['role'] ?? '');
        if ($role !== 'authenticated' && $role !== 'service_role') {
            Response::error('Authenticated session required', 403);
        }

        // Never accept service_role from browser callers
        if ($role === 'service_role') {
            Response::error('Forbidden', 403);
        }

        $sub = (string) ($claims['sub'] ?? '');
        if ($sub === '') {
            Response::error('Token missing subject', 401);
        }

        $exp = (int) ($claims['exp'] ?? 0);
        if ($exp > 0 && time() >= $exp) {
            Response::error('Token expired', 401);
        }

        return [
            'sub' => $sub,
            'email' => isset($claims['email']) ? (string) $claims['email'] : null,
            'role' => $role,
            'claims' => $claims,
        ];
    }

    /** Exposed for /auth/check diagnostics. */
    public static function debugB64UrlDecode(string $data): ?string
    {
        return self::b64UrlDecode($data);
    }

    /**
     * @return array{ok: bool, error?: string, status?: int, step?: string, claims?: array}
     */
    public static function diagnoseToken(string $jwt, array $config): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return ['ok' => false, 'error' => 'Token is not a JWT', 'step' => 'parse'];
        }

        [$h64, $p64, $s64] = $parts;
        $headerJson = self::b64UrlDecode($h64);
        if ($headerJson === null) {
            return ['ok' => false, 'error' => 'Invalid JWT header encoding', 'step' => 'parse'];
        }
        $header = json_decode($headerJson, true);
        if (!is_array($header)) {
            return ['ok' => false, 'error' => 'Invalid JWT header JSON', 'step' => 'parse'];
        }

        $alg = (string) ($header['alg'] ?? '');

        if ($alg === 'ES256') {
            $url = trim((string) ($config['supabase_url'] ?? ''));
            if ($url === '' || $url === 'https://YOUR_PROJECT.supabase.co') {
                return [
                    'ok' => false,
                    'status' => 500,
                    'step' => 'config',
                    'error' => 'ES256 token received but supabase_url is missing in config.php. Set it to https://YOUR_REF.supabase.co (not an API key).',
                ];
            }

            $payloadJson = self::b64UrlDecode($p64);
            $sig = self::b64UrlDecode($s64);
            if ($payloadJson === null || $sig === null) {
                return ['ok' => false, 'error' => 'Invalid JWT payload/signature encoding', 'step' => 'parse'];
            }
            $payload = json_decode($payloadJson, true);
            if (!is_array($payload)) {
                return ['ok' => false, 'error' => 'Invalid JWT payload JSON', 'step' => 'parse'];
            }

            $jwksUrl = rtrim($url, '/') . '/auth/v1/.well-known/jwks.json';
            $jwks = self::fetchJwks($jwksUrl, $config);
            if ($jwks === null) {
                return [
                    'ok' => false,
                    'status' => 500,
                    'step' => 'jwks',
                    'error' => 'Could not fetch Supabase JWKS from ' . $jwksUrl . '. Check outbound HTTPS/curl from the server and that storage/ is writable.',
                ];
            }

            $jwk = self::pickJwk($header, $jwks);
            if ($jwk === null) {
                return [
                    'ok' => false,
                    'step' => 'jwks',
                    'error' => 'No matching JWKS key for kid=' . (string) ($header['kid'] ?? ''),
                ];
            }

            $pem = self::ecJwkToPem($jwk);
            if ($pem === null) {
                return ['ok' => false, 'error' => 'Failed to build PEM from JWKS key', 'step' => 'pem'];
            }

            $der = self::ecdsaRawToDer($sig);
            if ($der === null) {
                return [
                    'ok' => false,
                    'error' => 'Unexpected ES256 signature length (expected 64 raw bytes)',
                    'step' => 'sig',
                ];
            }

            if (!extension_loaded('openssl')) {
                return ['ok' => false, 'status' => 500, 'error' => 'PHP openssl extension missing', 'step' => 'openssl'];
            }

            $pkey = openssl_pkey_get_public($pem);
            if ($pkey === false) {
                return ['ok' => false, 'error' => 'openssl_pkey_get_public failed for JWKS key', 'step' => 'openssl'];
            }

            $ok = openssl_verify($h64 . '.' . $p64, $der, $pkey, OPENSSL_ALGO_SHA256);
            if ($ok !== 1) {
                return [
                    'ok' => false,
                    'step' => 'verify',
                    'error' => 'ES256 signature verification failed (token from another project, corrupted token, or JWKS/key mismatch)',
                ];
            }

            return ['ok' => true, 'step' => 'es256', 'claims' => $payload];
        }

        if ($alg === 'HS256') {
            $secret = (string) ($config['supabase_jwt_secret'] ?? '');
            if ($secret === '' || $secret === 'REPLACE_WITH_SUPABASE_JWT_SECRET') {
                return [
                    'ok' => false,
                    'status' => 500,
                    'step' => 'config',
                    'error' => 'HS256 token received but supabase_jwt_secret is not set. Modern Supabase user sessions are usually ES256 — set supabase_url instead. Do not paste anon/service_role keys here.',
                ];
            }
            if (substr_count($secret, '.') === 2 && str_starts_with($secret, 'eyJ')) {
                return [
                    'ok' => false,
                    'status' => 500,
                    'step' => 'config',
                    'error' => 'supabase_jwt_secret is an API key JWT (anon/service_role). Replace with the JWT Secret, or set supabase_url for ES256 user tokens.',
                ];
            }

            $claims = self::verifyHs256($h64, $p64, $s64, $secret);
            if ($claims === null) {
                return [
                    'ok' => false,
                    'step' => 'verify',
                    'error' => 'HS256 signature mismatch — JWT Secret does not match this token',
                ];
            }
            return ['ok' => true, 'step' => 'hs256', 'claims' => $claims];
        }

        return [
            'ok' => false,
            'error' => 'Unsupported token algorithm: ' . ($alg !== '' ? $alg : '(missing)'),
            'step' => 'alg',
        ];
    }

    private static function pickJwk(array $header, array $jwks): ?array
    {
        $kid = isset($header['kid']) ? (string) $header['kid'] : '';
        $keys = $jwks['keys'] ?? [];
        if (!is_array($keys) || !$keys) {
            return null;
        }

        if ($kid !== '') {
            foreach ($keys as $key) {
                if (is_array($key) && (string) ($key['kid'] ?? '') === $kid) {
                    return $key;
                }
            }
            return null;
        }

        foreach ($keys as $key) {
            if (is_array($key) && ($key['alg'] ?? '') === 'ES256' && ($key['kty'] ?? '') === 'EC') {
                return $key;
            }
        }

        return is_array($keys[0] ?? null) ? $keys[0] : null;
    }

    /** @deprecated Internal path kept for clarity; prefer diagnoseToken. */
    private static function verifyToken(string $jwt, array $config): ?array
    {
        $diag = self::diagnoseToken($jwt, $config);
        return (($diag['ok'] ?? false) === true && is_array($diag['claims'] ?? null)) ? $diag['claims'] : null;
    }

    private static function verifyHs256(string $h64, string $p64, string $s64, string $secret): ?array
    {
        $payloadJson = self::b64UrlDecode($p64);
        $sig = self::b64UrlDecode($s64);
        if ($payloadJson === null || $sig === null) {
            return null;
        }

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        $expected = hash_hmac('sha256', $h64 . '.' . $p64, $secret, true);
        if (!hash_equals($expected, $sig)) {
            return null;
        }

        return $payload;
    }

    private static function resolveJwk(array $header, array $config): ?array
    {
        $url = trim((string) ($config['supabase_url'] ?? ''));
        if ($url === '' || $url === 'https://YOUR_PROJECT.supabase.co') {
            return null;
        }
        $jwks = self::fetchJwks(rtrim($url, '/') . '/auth/v1/.well-known/jwks.json', $config);
        if ($jwks === null) {
            return null;
        }
        return self::pickJwk($header, $jwks);
    }

    private static function fetchJwks(string $jwksUrl, array $config): ?array
    {
        $storage = self::writableStorage($config);
        $cacheFile = $storage !== null
            ? $storage . DIRECTORY_SEPARATOR . 'jwks_cache.json'
            : null;

        if ($cacheFile !== null && is_file($cacheFile)) {
            $raw = @file_get_contents($cacheFile);
            $cached = is_string($raw) ? json_decode($raw, true) : null;
            if (
                is_array($cached)
                && isset($cached['fetched_at'], $cached['jwks'])
                && is_array($cached['jwks'])
                && (time() - (int) $cached['fetched_at']) < 3600
            ) {
                return $cached['jwks'];
            }
        }

        $ch = curl_init($jwksUrl);
        if ($ch === false) {
            return null;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!is_string($body) || $status !== 200) {
            if ($cacheFile !== null && is_file($cacheFile)) {
                $raw = @file_get_contents($cacheFile);
                $cached = is_string($raw) ? json_decode($raw, true) : null;
                if (is_array($cached) && is_array($cached['jwks'] ?? null)) {
                    return $cached['jwks'];
                }
            }
            return null;
        }

        $jwks = json_decode($body, true);
        if (!is_array($jwks)) {
            return null;
        }

        if ($cacheFile !== null) {
            @file_put_contents($cacheFile, json_encode([
                'fetched_at' => time(),
                'jwks' => $jwks,
            ]));
        }

        return $jwks;
    }

    private static function writableStorage(array $config): ?string
    {
        $candidates = [];
        $configured = (string) ($config['storage_path'] ?? '');
        if ($configured !== '') {
            $candidates[] = $configured;
        }
        $candidates[] = __DIR__ . '/../storage';
        $candidates[] = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'flowforge-api';

        foreach ($candidates as $dir) {
            $dir = rtrim($dir, '/\\');
            if ($dir === '') {
                continue;
            }
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            if (!is_dir($dir)) {
                continue;
            }
            $probe = $dir . DIRECTORY_SEPARATOR . '.write_test_' . getmypid();
            if (@file_put_contents($probe, 'ok') !== false) {
                @unlink($probe);
                return $dir;
            }
        }
        return null;
    }

    /**
     * Convert an EC P-256 JWK to a PEM public key.
     */
    private static function ecJwkToPem(array $jwk): ?string
    {
        if (($jwk['kty'] ?? '') !== 'EC' || ($jwk['crv'] ?? '') !== 'P-256') {
            return null;
        }

        $x = self::b64UrlDecode((string) ($jwk['x'] ?? ''));
        $y = self::b64UrlDecode((string) ($jwk['y'] ?? ''));
        if ($x === null || $y === null || strlen($x) !== 32 || strlen($y) !== 32) {
            return null;
        }

        // Uncompressed EC point
        $point = "\x04" . $x . $y;

        // SubjectPublicKeyInfo for P-256 (RFC 5480)
        $algId = hex2bin('301306072a8648ce3d020106082a8648ce3d030107');
        if ($algId === false) {
            return null;
        }
        $bitString = "\x03" . self::asn1Length(strlen($point) + 1) . "\x00" . $point;
        $spki = "\x30" . self::asn1Length(strlen($algId) + strlen($bitString)) . $algId . $bitString;

        return "-----BEGIN PUBLIC KEY-----\n"
            . chunk_split(base64_encode($spki), 64, "\n")
            . "-----END PUBLIC KEY-----\n";
    }

    /**
     * JWT ES256 signatures are raw R||S (64 bytes). OpenSSL wants DER SEQUENCE.
     */
    private static function ecdsaRawToDer(string $raw): ?string
    {
        if (strlen($raw) !== 64) {
            return null;
        }

        $r = ltrim(substr($raw, 0, 32), "\x00");
        $s = ltrim(substr($raw, 32, 32), "\x00");
        if ($r === '') {
            $r = "\x00";
        }
        if ($s === '') {
            $s = "\x00";
        }
        if ((ord($r[0]) & 0x80) !== 0) {
            $r = "\x00" . $r;
        }
        if ((ord($s[0]) & 0x80) !== 0) {
            $s = "\x00" . $s;
        }

        $encodedR = "\x02" . self::asn1Length(strlen($r)) . $r;
        $encodedS = "\x02" . self::asn1Length(strlen($s)) . $s;
        return "\x30" . self::asn1Length(strlen($encodedR) + strlen($encodedS)) . $encodedR . $encodedS;
    }

    private static function asn1Length(int $length): string
    {
        if ($length < 0x80) {
            return chr($length);
        }
        $bytes = ltrim(pack('N', $length), "\x00");
        return chr(0x80 | strlen($bytes)) . $bytes;
    }

    private static function b64UrlDecode(string $data): ?string
    {
        if ($data === '') {
            return null;
        }
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        return $decoded === false ? null : $decoded;
    }
}
