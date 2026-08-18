<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\HttpClient;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_deferred_auth(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();
$auth = flowforge_finalize_auth($config, $body);

// Public chat may only resolve secrets via session_id + connection_id (never body-carried secrets).
if ($auth['anon'] && trim((string) ($body['connection_id'] ?? '')) === '') {
    Response::error('connection_id is required for public chat sessions', 400);
}

$resolved = SupabaseRest::resolveConnection($config, $body);
$connection = $resolved['connection'];
$instanceId = $resolved['instance_id'];
$usedService = $resolved['used_service_role'];

$method = strtoupper((string) ($body['method'] ?? 'GET'));
$path = (string) ($body['path'] ?? '/');
$requestBody = $body['body'] ?? null;

$baseUrl = rtrim((string) ($connection['baseUrl'] ?? ''), '/');
if ($baseUrl === '') {
    Response::error('Connection baseUrl is required', 400);
}

// Allow absolute path or relative path only
if (preg_match('#^https?://#i', $path)) {
    Response::error('Path must be relative to the connection base URL', 400);
}
$path = '/' . ltrim($path, '/');
// Block path traversal tricks in the relative portion
if (str_contains($path, '..')) {
    Response::error('Invalid path', 400);
}

$url = $baseUrl . $path;
if (isset($body['query']) && is_array($body['query']) && $body['query']) {
    $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($body['query']);
}

$userJwt = $auth['anon'] ? null : ($auth['user']['sub'] ?? null ? SupabaseRest::bearerFromRequest() : null);
if (!$auth['anon'] && $userJwt === null) {
    $userJwt = SupabaseRest::bearerFromRequest();
}
$allowlist = SupabaseRest::resolveHttpHostAllowlist($config, $instanceId, $userJwt);
Security::assertSafePublicUrl($url, $allowlist);

$headers = HttpClient::buildAuthHeaders($connection);
// Per-request headers (cannot override Authorization silently unless provided deliberately — still sanitized)
if (isset($body['headers']) && is_array($body['headers'])) {
    foreach ($body['headers'] as $name => $value) {
        if (is_int($name) && is_array($value)) {
            $n = Security::sanitizeHeaderName((string) ($value['key'] ?? ''));
            $v = Security::sanitizeHeaderValue((string) ($value['value'] ?? ''));
        } else {
            $n = Security::sanitizeHeaderName((string) $name);
            $v = Security::sanitizeHeaderValue((string) $value);
        }
        if ($n && $v !== null) {
            $headers[$n] = $v;
        }
    }
}

$payload = null;
if ($requestBody !== null && $requestBody !== '') {
    if (is_array($requestBody) || is_object($requestBody)) {
        $payload = json_encode($requestBody, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!isset($headers['Content-Type']) && !isset($headers['content-type'])) {
            $headers['Content-Type'] = 'application/json';
        }
    } else {
        $payload = (string) $requestBody;
    }
}

$timeout = (int) ($connection['timeoutMs'] ?? 30000);
$timeoutSec = max(1, min(60, (int) ceil($timeout / 1000)));
$maxBytes = (int) ($config['http_max_response_bytes'] ?? 1_048_576);
$configuredTimeout = (int) ($config['http_timeout_seconds'] ?? 30);
$timeoutSec = min($timeoutSec, $configuredTimeout);

$result = HttpClient::request($method, $url, $headers, $payload, $timeoutSec, $maxBytes);

if ($result['ok'] && $instanceId !== null) {
    SupabaseRest::incrementInstanceUsage(
        $config,
        $instanceId,
        ['p_http_calls' => 1],
        $usedService || $auth['anon'],
        $userJwt,
    );
}

Response::json([
    'ok' => $result['ok'],
    'status' => $result['status'],
    'headers' => $result['headers'],
    'data' => $result['body'],
    'error' => $result['error'] ?? null,
], $result['ok'] ? 200 : 502);
