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
$sessionId = trim((string) ($body['session_id'] ?? ''));
$chatbotId = trim((string) ($body['chatbot_id'] ?? ''));
$fields = isset($body['fields']) && is_array($body['fields']) ? $body['fields'] : [];

if ($integrationId === '' || $instanceId === '' || $action === '') {
    Response::error('integration_id, instance_id, and action are required', 400);
}
if (!SupabaseRest::isUuid($integrationId) || !SupabaseRest::isUuid($instanceId)) {
    Response::error('Invalid ids', 400);
}

// Public chat: verify the session belongs to this instance (and chatbot when provided).
if ($sessionId !== '') {
    $session = SupabaseRest::requireConversationSession($config, $sessionId);
    if (strcasecmp($session['instance_id'], $instanceId) !== 0) {
        Response::error('Session does not belong to this organisation', 403);
    }
    if ($chatbotId !== '' && strcasecmp($session['chatbot_id'], $chatbotId) !== 0) {
        Response::error('Session does not belong to this chatbot', 403);
    }
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

function ff_str(array $arr, string $key): string
{
    $v = $arr[$key] ?? '';
    return is_string($v) ? $v : (is_scalar($v) ? (string) $v : '');
}

/**
 * @return array{access_token: string, token_type?: string}
 */
function ff_google_access_token(array $cfg, array $secrets): array
{
    $clientId = ff_str($cfg, 'client_id') ?: ff_str($secrets, 'client_id');
    $clientSecret = ff_str($secrets, 'client_secret');
    $refresh = ff_str($secrets, 'refresh_token');
    $access = ff_str($secrets, 'access_token');
    if ($access !== '' && ($clientId === '' || $refresh === '')) {
        return ['access_token' => $access];
    }
    if ($clientId === '' || $clientSecret === '' || $refresh === '') {
        Response::error('Google OAuth requires client_id, client_secret, and refresh_token', 400);
    }
    $payload = http_build_query([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'refresh_token' => $refresh,
        'grant_type' => 'refresh_token',
    ]);
    $http = HttpClient::request(
        'POST',
        'https://oauth2.googleapis.com/token',
        ['Content-Type' => 'application/x-www-form-urlencoded'],
        $payload,
        20,
        1_048_576,
    );
    $data = is_array($http['json'] ?? null) ? $http['json'] : null;
    $token = is_array($data) ? (string) ($data['access_token'] ?? '') : '';
    if ($token === '') {
        Response::json([
            'ok' => false,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => 'google_token_refresh_failed',
        ], 422);
    }
    return ['access_token' => $token];
}

/**
 * @return array{access_token: string}
 */
function ff_microsoft_access_token(array $cfg, array $secrets): array
{
    $tenant = ff_str($cfg, 'tenant_id') ?: 'common';
    $clientId = ff_str($cfg, 'client_id');
    $clientSecret = ff_str($secrets, 'client_secret');
    $refresh = ff_str($secrets, 'refresh_token');
    $access = ff_str($secrets, 'access_token');
    if ($access !== '' && $refresh === '') {
        return ['access_token' => $access];
    }
    if ($clientId === '' || $clientSecret === '' || $refresh === '') {
        Response::error('Microsoft OAuth requires client_id, client_secret, and refresh_token', 400);
    }
    $payload = http_build_query([
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'refresh_token' => $refresh,
        'grant_type' => 'refresh_token',
        'scope' => 'https://graph.microsoft.com/.default offline_access Files.ReadWrite',
    ]);
    $url = 'https://login.microsoftonline.com/' . rawurlencode($tenant) . '/oauth2/v2.0/token';
    $http = HttpClient::request(
        'POST',
        $url,
        ['Content-Type' => 'application/x-www-form-urlencoded'],
        $payload,
        20,
        1_048_576,
    );
    $data = is_array($http['json'] ?? null) ? $http['json'] : null;
    $token = is_array($data) ? (string) ($data['access_token'] ?? '') : '';
    if ($token === '') {
        Response::json([
            'ok' => false,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => 'microsoft_token_refresh_failed',
        ], 422);
    }
    return ['access_token' => $token];
}

/**
 * @return list<string>
 */
function ff_parse_sheet_values(string $raw): array
{
    $trimmed = trim($raw);
    if ($trimmed === '') {
        return [];
    }
    if (str_starts_with($trimmed, '[')) {
        $decoded = json_decode($trimmed, true);
        if (is_array($decoded)) {
            $out = [];
            foreach ($decoded as $item) {
                if (is_scalar($item) || $item === null) {
                    $out[] = (string) ($item ?? '');
                } else {
                    $out[] = json_encode($item, JSON_UNESCAPED_UNICODE) ?: '';
                }
            }
            return $out;
        }
    }
    return array_map('trim', str_getcsv($trimmed));
}

function ff_safe_storage_path(string $path): string
{
    $path = str_replace('\\', '/', trim($path));
    $path = ltrim($path, '/');
    if ($path === '' || str_contains($path, '..')) {
        Response::error('Invalid storage path', 400);
    }
    return $path;
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

try {
    if ($action === 'slack.post_message' && $provider === 'slack') {
        $token = ff_str($secrets, 'bot_token');
        $channel = ff_str($fields, 'channel') ?: ff_str($cfg, 'default_channel');
        $message = ff_str($fields, 'message');
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
        $baseUrl = rtrim(ff_str($cfg, 'base_url'), '/');
        $path = ff_str($fields, 'path') ?: '/';
        $content = ff_str($fields, 'content');
        if ($baseUrl === '') {
            Response::error('Custom integration requires base_url', 400);
        }
        if (str_contains($path, '..')) {
            Response::error('Invalid path', 400);
        }
        $url = $baseUrl . '/' . ltrim($path, '/');
        Security::assertSafePublicUrl($url, []);
        $token = ff_str($secrets, 'api_key');
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

    if ($action === 'sheets.append_row' && $provider === 'google_sheets') {
        $token = ff_google_access_token($cfg, $secrets);
        $spreadsheetId = ff_str($fields, 'spreadsheetId') ?: ff_str($cfg, 'spreadsheet_id');
        $range = ff_str($fields, 'range') ?: 'Sheet1!A1';
        $values = ff_parse_sheet_values(ff_str($fields, 'values'));
        if ($spreadsheetId === '') {
            Response::error('spreadsheetId is required', 400);
        }
        $url = 'https://sheets.googleapis.com/v4/spreadsheets/'
            . rawurlencode($spreadsheetId)
            . '/values/'
            . rawurlencode($range)
            . ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
        $payload = json_encode(['values' => [$values]], JSON_UNESCAPED_UNICODE);
        $http = HttpClient::request(
            'POST',
            $url,
            [
                'Authorization' => 'Bearer ' . $token['access_token'],
                'Content-Type' => 'application/json',
            ],
            $payload ?: '{"values":[[]]}',
            30,
            2_097_152,
        );
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $http['json'] ?? $http['body'] ?? null,
            'error' => $ok ? null : (string) ($http['error'] ?? 'sheets_append_failed'),
        ], $ok ? 200 : 422);
    }

    if ($action === 'storage.upload_text' && $provider === 'google_drive') {
        $token = ff_google_access_token($cfg, $secrets);
        $path = ff_safe_storage_path(ff_str($fields, 'path') ?: 'flowforge-export.txt');
        $content = ff_str($fields, 'content');
        $name = basename($path);
        $folderId = ff_str($cfg, 'folder_id');
        $meta = ['name' => $name];
        if ($folderId !== '') {
            $meta['parents'] = [$folderId];
        }
        $boundary = 'ff_' . bin2hex(random_bytes(8));
        $bodyParts =
            "--{$boundary}\r\n"
            . "Content-Type: application/json; charset=UTF-8\r\n\r\n"
            . json_encode($meta, JSON_UNESCAPED_UNICODE) . "\r\n"
            . "--{$boundary}\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n\r\n"
            . $content . "\r\n"
            . "--{$boundary}--";
        $http = HttpClient::request(
            'POST',
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
            [
                'Authorization' => 'Bearer ' . $token['access_token'],
                'Content-Type' => 'multipart/related; boundary=' . $boundary,
            ],
            $bodyParts,
            40,
            4_194_304,
        );
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $http['json'] ?? $http['body'] ?? null,
            'error' => $ok ? null : (string) ($http['error'] ?? 'drive_upload_failed'),
        ], $ok ? 200 : 422);
    }

    if ($action === 'storage.upload_text' && $provider === 'microsoft_onedrive') {
        $token = ff_microsoft_access_token($cfg, $secrets);
        $path = ff_safe_storage_path(ff_str($fields, 'path') ?: 'flowforge-export.txt');
        $content = ff_str($fields, 'content');
        $driveId = ff_str($cfg, 'drive_id');
        $segments = array_map('rawurlencode', explode('/', $path));
        $encodedPath = implode('/', $segments);
        if ($driveId !== '') {
            $url = 'https://graph.microsoft.com/v1.0/drives/'
                . rawurlencode($driveId)
                . '/root:/'
                . $encodedPath
                . ':/content';
        } else {
            $url = 'https://graph.microsoft.com/v1.0/me/drive/root:/'
                . $encodedPath
                . ':/content';
        }
        $http = HttpClient::request(
            'PUT',
            $url,
            [
                'Authorization' => 'Bearer ' . $token['access_token'],
                'Content-Type' => 'text/plain; charset=utf-8',
            ],
            $content,
            40,
            4_194_304,
        );
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $http['json'] ?? $http['body'] ?? null,
            'error' => $ok ? null : (string) ($http['error'] ?? 'onedrive_upload_failed'),
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
