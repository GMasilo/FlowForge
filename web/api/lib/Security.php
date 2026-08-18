<?php
declare(strict_types=1);

namespace FlowForge\Api;

final class Security
{
    public static function applyCors(array $config): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $allowed = $config['allowed_origins'] ?? [];
        if ($origin !== '' && in_array($origin, $allowed, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Authorization, Content-Type');
            header('Access-Control-Allow-Methods: POST, OPTIONS, GET');
            header('Access-Control-Max-Age: 600');
        }
    }

    public static function enforceHttps(array $config): void
    {
        if (empty($config['force_https'])) {
            return;
        }
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
            || (($_SERVER['SERVER_PORT'] ?? '') === '443');
        if (!$https) {
            Response::error('HTTPS required', 403);
        }
    }

    public static function onlyMethods(array $methods): void
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
        if (!in_array($method, $methods, true)) {
            Response::error('Method not allowed', 405);
        }
    }

    public static function readJsonBody(int $maxBytes = 65536): array
    {
        $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
        if ($raw === false || $raw === '') {
            Response::error('Empty request body', 400);
        }
        if (strlen($raw) > $maxBytes) {
            Response::error('Request body too large', 413);
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            Response::error('Invalid JSON body', 400);
        }
        return $data;
    }

    /**
     * Gateway notify payloads are usually form-encoded, sometimes JSON.
     *
     * @return array<string, string>
     */
    public static function readNotifyPayload(int $maxBytes = 65536): array
    {
        $out = [];
        if (!empty($_POST) && is_array($_POST)) {
            foreach ($_POST as $key => $value) {
                if (!is_string($key)) {
                    continue;
                }
                if (is_string($value) || is_numeric($value)) {
                    $out[$key] = (string) $value;
                }
            }
            if ($out) {
                return $out;
            }
        }

        $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
        if ($raw === false || $raw === '') {
            return [];
        }
        if (strlen($raw) > $maxBytes) {
            Response::error('Request body too large', 413);
        }

        $json = json_decode($raw, true);
        if (is_array($json)) {
            foreach ($json as $key => $value) {
                if (!is_string($key)) {
                    continue;
                }
                if (is_string($value) || is_numeric($value) || is_bool($value)) {
                    $out[$key] = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;
                }
            }
            return $out;
        }

        parse_str($raw, $parsed);
        if (is_array($parsed)) {
            foreach ($parsed as $key => $value) {
                if (is_string($key) && (is_string($value) || is_numeric($value))) {
                    $out[$key] = (string) $value;
                }
            }
        }
        return $out;
    }

    public static function clientIp(): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
    }

    /** Block SSRF to private / link-local / metadata hosts. */
    public static function assertSafePublicUrl(string $url, array $hostAllowlist = []): string
    {
        $parts = parse_url($url);
        if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
            Response::error('Invalid URL', 400);
        }

        $scheme = strtolower((string) $parts['scheme']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            Response::error('Only http/https URLs are allowed', 400);
        }

        $host = strtolower((string) $parts['host']);
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
            Response::error('Host is not allowed', 400);
        }

        if ($hostAllowlist) {
            $ok = false;
            foreach ($hostAllowlist as $allowed) {
                $allowed = strtolower((string) $allowed);
                if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                    $ok = true;
                    break;
                }
            }
            if (!$ok) {
                Response::error('Host is not in the allowlist', 400);
            }
        }

        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $ips[] = $host;
        } else {
            $records = @dns_get_record($host, DNS_A + DNS_AAAA);
            if (is_array($records)) {
                foreach ($records as $rec) {
                    if (!empty($rec['ip'])) {
                        $ips[] = $rec['ip'];
                    }
                    if (!empty($rec['ipv6'])) {
                        $ips[] = $rec['ipv6'];
                    }
                }
            }
            if (!$ips) {
                $resolved = gethostbynamel($host);
                if (is_array($resolved)) {
                    $ips = $resolved;
                }
            }
        }

        if (!$ips) {
            Response::error('Unable to resolve host', 400);
        }

        foreach ($ips as $ip) {
            if (self::isPrivateOrReservedIp($ip)) {
                Response::error('URL resolves to a private or reserved address', 400);
            }
        }

        return $url;
    }

    public static function isPrivateOrReservedIp(string $ip): bool
    {
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            return true;
        }
        // FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE returns false for private/reserved
        $flags = FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE;
        return filter_var($ip, FILTER_VALIDATE_IP, $flags) === false;
    }

    public static function sanitizeHeaderName(string $name): ?string
    {
        $name = trim($name);
        if ($name === '' || !preg_match('/^[A-Za-z0-9!#$%&\'*+.^_`|~-]+$/', $name)) {
            return null;
        }
        // Prevent header injection / hop-by-hop abuse
        $blocked = ['host', 'content-length', 'transfer-encoding', 'connection', 'expect'];
        if (in_array(strtolower($name), $blocked, true)) {
            return null;
        }
        return $name;
    }

    public static function sanitizeHeaderValue(string $value): ?string
    {
        if (preg_match('/[\r\n]/', $value)) {
            return null;
        }
        return $value;
    }

    public static function isValidEmail(string $email): bool
    {
        return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
    }
}
