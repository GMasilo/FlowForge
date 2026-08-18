<?php
declare(strict_types=1);

namespace FlowForge\Api;

final class HttpClient
{
    /**
     * @param array<string, string> $headers
     * @return array{ok: bool, status: int, headers: array<string, string>, body: mixed, raw_body: string, error?: string}
     */
    public static function request(
        string $method,
        string $url,
        array $headers,
        ?string $body,
        int $timeoutSeconds,
        int $maxBytes,
    ): array {
        $method = strtoupper($method);
        $allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
        if (!in_array($method, $allowed, true)) {
            Response::error('HTTP method not allowed', 400);
        }

        if (!function_exists('curl_init')) {
            Response::error('cURL extension is required', 500);
        }

        $ch = curl_init($url);
        if ($ch === false) {
            Response::error('Unable to initiate request', 500);
        }

        $responseHeaders = [];
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false, // avoid SSRF via redirects
            CURLOPT_MAXREDIRS => 0,
            CURLOPT_CONNECTTIMEOUT => min(10, $timeoutSeconds),
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT => 'FlowForge-API/1.0',
            CURLOPT_HEADERFUNCTION => static function ($curl, string $headerLine) use (&$responseHeaders): int {
                $len = strlen($headerLine);
                $parts = explode(':', $headerLine, 2);
                if (count($parts) === 2) {
                    $name = strtolower(trim($parts[0]));
                    $value = trim($parts[1]);
                    // Don't echo set-cookie upstream to clients
                    if ($name !== 'set-cookie') {
                        $responseHeaders[$name] = $value;
                    }
                }
                return $len;
            },
        ]);

        $curlHeaders = [];
        foreach ($headers as $name => $value) {
            $curlHeaders[] = $name . ': ' . $value;
        }
        if ($curlHeaders) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
        }

        if ($body !== null && !in_array($method, ['GET', 'HEAD'], true)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($errno !== 0 || !is_string($raw)) {
            return [
                'ok' => false,
                'status' => 0,
                'headers' => [],
                'body' => null,
                'raw_body' => '',
                'error' => 'Upstream request failed',
                // Do not expose raw curl error details to clients in production
                'detail' => $error !== '' ? 'transport_error' : 'empty_response',
            ];
        }

        if (strlen($raw) > $maxBytes) {
            $raw = substr($raw, 0, $maxBytes);
        }

        $decoded = json_decode($raw, true);
        $bodyOut = json_last_error() === JSON_ERROR_NONE ? $decoded : $raw;

        return [
            'ok' => $status >= 200 && $status < 300,
            'status' => $status,
            'headers' => $responseHeaders,
            'body' => $bodyOut,
            'raw_body' => is_string($bodyOut) ? $bodyOut : $raw,
        ];
    }

    /**
     * @param array<string, mixed> $connectionConfig
     * @return array<string, string>
     */
    public static function buildAuthHeaders(array $connectionConfig): array
    {
        $headers = [];
        $authType = (string) ($connectionConfig['authType'] ?? 'none');

        if ($authType === 'basic') {
            $user = (string) ($connectionConfig['username'] ?? '');
            $pass = (string) ($connectionConfig['password'] ?? '');
            $headers['Authorization'] = 'Basic ' . base64_encode($user . ':' . $pass);
        } elseif ($authType === 'bearer') {
            $token = (string) ($connectionConfig['bearerToken'] ?? '');
            if ($token !== '') {
                $headers['Authorization'] = 'Bearer ' . $token;
            }
        } elseif ($authType === 'api_key') {
            $name = Security::sanitizeHeaderName((string) ($connectionConfig['apiKeyHeader'] ?? 'X-API-Key'));
            $key = Security::sanitizeHeaderValue((string) ($connectionConfig['apiKey'] ?? ''));
            if ($name && $key !== null && $key !== '') {
                $headers[$name] = $key;
            }
        }

        $extra = $connectionConfig['headers'] ?? [];
        if (is_array($extra)) {
            // Support [{key,value}] or {name:value}
            $isList = array_is_list($extra);
            if ($isList) {
                foreach ($extra as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $n = Security::sanitizeHeaderName((string) ($row['key'] ?? ''));
                    $v = Security::sanitizeHeaderValue((string) ($row['value'] ?? ''));
                    if ($n && $v !== null) {
                        $headers[$n] = $v;
                    }
                }
            } else {
                foreach ($extra as $n => $v) {
                    $name = Security::sanitizeHeaderName((string) $n);
                    $value = Security::sanitizeHeaderValue((string) $v);
                    if ($name && $value !== null) {
                        $headers[$name] = $value;
                    }
                }
            }
        }

        return $headers;
    }
}
