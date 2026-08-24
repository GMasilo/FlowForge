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

$integrationId = trim((string) ($body['integration_id'] ?? ''));
$instanceId = trim((string) ($body['instance_id'] ?? ''));
$action = trim((string) ($body['action'] ?? ''));
$fields = isset($body['fields']) && is_array($body['fields']) ? $body['fields'] : [];

if ($integrationId === '' || $instanceId === '' || $action === '') {
    Response::error('integration_id, instance_id, and action are required', 400);
}
if (!SupabaseRest::isUuid($integrationId) || !SupabaseRest::isUuid($instanceId)) {
    Response::error('Invalid ids', 400);
}

$serviceKey = (string) ($config['supabase_service_role_key'] ?? '');
$base = rtrim((string) ($config['supabase_url'] ?? ''), '/');
$anon = (string) ($config['supabase_anon_key'] ?? '');
if ($base === '' || $anon === '') {
    Response::error('Supabase not configured', 500);
}

$bearer = $serviceKey !== '' && $serviceKey !== 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY'
    ? $serviceKey
    : SupabaseRest::bearerFromRequest();

function ff_rest_get(string $base, string $anon, string $bearer, string $table, string $query): ?array
{
    $url = $base . '/rest/v1/' . rawurlencode($table) . '?' . $query;
    $ch = curl_init($url);
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'apikey: ' . $anon,
            'Authorization: Bearer ' . $bearer,
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($raw) || $status < 200 || $status >= 300) {
        return null;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

$rows = ff_rest_get(
    $base,
    $anon,
    $bearer,
    'integrations',
    'id=eq.' . rawurlencode($integrationId)
        . '&instance_id=eq.' . rawurlencode($instanceId)
        . '&deleted_at=is.null&select=id,instance_id,provider,name,status,config',
);
if (!$rows || !count($rows)) {
    Response::error('Integration not found', 404);
}
$row = $rows[0];
if (($row['status'] ?? '') !== 'connected') {
    Response::json(['ok' => false, 'status' => 409, 'error' => 'Integration is not connected', 'data' => null], 409);
}

$secretRows = ff_rest_get(
    $base,
    $anon,
    $bearer,
    'integration_secrets',
    'integration_id=eq.' . rawurlencode($integrationId) . '&select=secrets',
);
$secrets = [];
if ($secretRows && isset($secretRows[0]['secrets']) && is_array($secretRows[0]['secrets'])) {
    $secrets = $secretRows[0]['secrets'];
}

$provider = (string) ($row['provider'] ?? '');
$cfg = isset($row['config']) && is_array($row['config']) ? $row['config'] : [];

$str = static function (array $arr, string $key): string {
    $v = $arr[$key] ?? '';
    return is_string($v) ? $v : (is_scalar($v) ? (string) $v : '');
};

try {
    if ($action === 'slack.post_message' && $provider === 'slack') {
        $token = $str($secrets, 'bot_token');
        $channel = $str($fields, 'channel') ?: $str($cfg, 'default_channel');
        $message = $str($fields, 'message');
        if ($token === '' || $channel === '' || $message === '') {
            Response::error('Slack requires bot_token, channel, and message', 400);
        }
        $payload = json_encode(['channel' => $channel, 'text' => $message], JSON_UNESCAPED_UNICODE);
        $http = HttpClient::request(
            'POST',
            'https://slack.com/api/chat.postMessage',
            [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json; charset=utf-8',
            ],
            $payload ?: '{}',
            20,
            1_048_576,
        );
        $data = $http['json'] ?? $http['body'] ?? null;
        $ok = !empty($http['ok']) && is_array($data) && !empty($data['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $ok ? null : (is_array($data) ? (string) ($data['error'] ?? 'slack_error') : 'slack_error'),
        ], $ok ? 200 : 422);
    }

    if ($action === 'custom.request' && $provider === 'custom') {
        $baseUrl = rtrim($str($cfg, 'base_url'), '/');
        $path = $str($fields, 'path') ?: '/';
        $content = $str($fields, 'content');
        if ($baseUrl === '') {
            Response::error('Custom integration requires base_url', 400);
        }
        if (str_contains($path, '..')) {
            Response::error('Invalid path', 400);
        }
        $url = $baseUrl . '/' . ltrim($path, '/');
        Security::assertSafePublicUrl($url, []);
        $token = $str($secrets, 'api_key');
        $headers = ['Content-Type' => 'application/json'];
        if ($token !== '') {
            $headers['Authorization'] = 'Bearer ' . $token;
        }
        $http = HttpClient::request('POST', $url, $headers, $content !== '' ? $content : '{}', 20, 1_048_576);
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $http['json'] ?? $http['body'] ?? null,
            'error' => $ok ? null : (string) ($http['error'] ?? 'request_failed'),
        ], $ok ? 200 : 422);
    }

    Response::json([
        'ok' => true,
        'status' => 202,
        'data' => [
            'accepted' => true,
            'provider' => $provider,
            'action' => $action,
            'fields' => $fields,
            'note' => 'Accepted — full provider adapter pending',
        ],
        'error' => null,
    ]);
} catch (Throwable $e) {
    Response::json(['ok' => false, 'status' => 500, 'data' => null, 'error' => $e->getMessage()], 500);
}
