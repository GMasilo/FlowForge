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

if ($integrationId === '' || $instanceId === '' || $action === '' || $chatbotId === '') {
    Response::error('integration_id, instance_id, chatbot_id, and action are required', 400);
}
if (
    !SupabaseRest::isUuid($integrationId)
    || !SupabaseRest::isUuid($instanceId)
    || !SupabaseRest::isUuid($chatbotId)
) {
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

/** Prefer decoded JSON body from HttpClient (legacy callers looked for a non-existent `json` key). */
function ff_http_data(array $http): mixed
{
    if (array_key_exists('json', $http) && $http['json'] !== null) {
        return $http['json'];
    }
    return $http['body'] ?? null;
}

/**
 * @return array{access_token: string, token_type?: string, grant?: string}
 */
function ff_b64url(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

/**
 * Google service-account JWT bearer token (app-only).
 *
 * @param list<string> $scopes
 * @return array{access_token: string, grant: string}
 */
function ff_google_service_account_token(array $cfg, array $secrets, array $scopes): array
{
    $rawJson = trim(ff_str($secrets, 'service_account_json') ?: ff_str($cfg, 'service_account_json'));
    $sa = [];
    if ($rawJson !== '') {
        $decoded = json_decode($rawJson, true);
        if (!is_array($decoded)) {
            Response::error('service_account_json must be valid JSON', 400);
        }
        $sa = $decoded;
    }

    $email = trim(
        ff_str($sa, 'client_email')
            ?: ff_str($secrets, 'client_email')
            ?: ff_str($cfg, 'client_email'),
    );
    $privateKey = trim(
        ff_str($sa, 'private_key')
            ?: ff_str($secrets, 'private_key')
            ?: ff_str($cfg, 'private_key'),
    );
    $privateKey = str_replace(['\\n', "\r\n"], ["\n", "\n"], $privateKey);
    $tokenUri = trim(ff_str($sa, 'token_uri')) ?: 'https://oauth2.googleapis.com/token';

    if ($email === '' || $privateKey === '') {
        Response::error(
            'Google service account requires client_email and private_key (or paste service_account_json)',
            400,
        );
    }
    if (!function_exists('openssl_sign')) {
        Response::error('OpenSSL extension is required for Google service accounts', 500);
    }

    $now = time();
    $header = ff_b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES) ?: '{}');
    $claims = ff_b64url(json_encode([
        'iss' => $email,
        'scope' => implode(' ', $scopes),
        'aud' => $tokenUri,
        'iat' => $now,
        'exp' => $now + 3600,
    ], JSON_UNESCAPED_SLASHES) ?: '{}');
    $unsigned = $header . '.' . $claims;
    $signature = '';
    $ok = openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256);
    if ($ok !== true || $signature === '') {
        Response::error('Failed to sign Google service account JWT (check private_key)', 400);
    }
    $jwt = $unsigned . '.' . ff_b64url($signature);
    $payload = http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]);
    $http = HttpClient::request(
        'POST',
        $tokenUri,
        ['Content-Type' => 'application/x-www-form-urlencoded'],
        $payload,
        20,
        1_048_576,
    );
    $data = ff_http_data($http);
    $token = is_array($data) ? (string) ($data['access_token'] ?? '') : '';
    if ($token === '') {
        $err = is_array($data)
            ? (string) ($data['error_description'] ?? $data['error'] ?? 'google_service_account_token_failed')
            : (string) ($http['error'] ?? 'google_service_account_token_failed');
        Response::json([
            'ok' => false,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $err,
        ], 422);
    }
    return ['access_token' => $token, 'grant' => 'service_account'];
}

/**
 * @param list<string>|null $scopes
 * @return array{access_token: string, token_type?: string, grant?: string}
 */
function ff_google_access_token(array $cfg, array $secrets, ?array $scopes = null): array
{
    $scopes = $scopes ?? [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
    ];
    $clientId = trim(ff_str($cfg, 'client_id') ?: ff_str($secrets, 'client_id'));
    $clientSecret = trim(ff_str($secrets, 'client_secret') ?: ff_str($cfg, 'client_secret'));
    $refresh = trim(ff_str($secrets, 'refresh_token') ?: ff_str($cfg, 'refresh_token'));
    $access = trim(ff_str($secrets, 'access_token') ?: ff_str($cfg, 'access_token'));
    $hasServiceAccount =
        trim(ff_str($secrets, 'service_account_json') ?: ff_str($cfg, 'service_account_json')) !== ''
        || trim(ff_str($secrets, 'private_key') ?: ff_str($cfg, 'private_key')) !== '';

    if ($access !== '' && $refresh === '' && !$hasServiceAccount) {
        return ['access_token' => $access, 'grant' => 'access_token'];
    }
    if ($refresh !== '') {
        if ($clientId === '' || $clientSecret === '') {
            Response::error('Google OAuth refresh requires client_id and client_secret', 400);
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
        $data = ff_http_data($http);
        $token = is_array($data) ? (string) ($data['access_token'] ?? '') : '';
        if ($token === '') {
            $err = is_array($data)
                ? (string) ($data['error_description'] ?? $data['error'] ?? 'google_token_refresh_failed')
                : (string) ($http['error'] ?? 'google_token_refresh_failed');
            Response::json([
                'ok' => false,
                'status' => (int) ($http['status'] ?? 0),
                'data' => $data,
                'error' => $err,
            ], 422);
        }
        return ['access_token' => $token, 'grant' => 'refresh_token'];
    }
    if ($hasServiceAccount) {
        return ff_google_service_account_token($cfg, $secrets, $scopes);
    }

    Response::error(
        'Google auth incomplete: add an OAuth refresh_token (user consent) or paste a service_account_json key. Client ID/secret alone are not enough.',
        400,
    );
}

/**
 * @return array{access_token: string, grant?: string}
 */
function ff_microsoft_access_token(array $cfg, array $secrets): array
{
    $tenant = trim(ff_str($cfg, 'tenant_id') ?: ff_str($secrets, 'tenant_id')) ?: 'common';
    $clientId = trim(ff_str($cfg, 'client_id') ?: ff_str($secrets, 'client_id'));
    $clientSecret = trim(ff_str($secrets, 'client_secret') ?: ff_str($cfg, 'client_secret'));
    $refresh = trim(ff_str($secrets, 'refresh_token') ?: ff_str($cfg, 'refresh_token'));
    $access = trim(ff_str($secrets, 'access_token') ?: ff_str($cfg, 'access_token'));

    if ($access !== '' && $refresh === '') {
        return ['access_token' => $access];
    }

    if ($clientId === '' || $clientSecret === '') {
        Response::error(
            'Microsoft OAuth requires client_id and client_secret (plus refresh_token for delegated auth, or leave refresh_token blank for app-only)',
            400,
        );
    }

    $url = 'https://login.microsoftonline.com/' . rawurlencode($tenant) . '/oauth2/v2.0/token';

    if ($refresh !== '') {
        $payload = http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'refresh_token' => $refresh,
            'grant_type' => 'refresh_token',
            'scope' => 'https://graph.microsoft.com/.default offline_access',
        ]);
    } else {
        $payload = http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'grant_type' => 'client_credentials',
            'scope' => 'https://graph.microsoft.com/.default',
        ]);
    }

    $http = HttpClient::request(
        'POST',
        $url,
        ['Content-Type' => 'application/x-www-form-urlencoded'],
        $payload,
        20,
        1_048_576,
    );
    $data = ff_http_data($http);
    $token = is_array($data) ? (string) ($data['access_token'] ?? '') : '';
    if ($token === '') {
        $msError = is_array($data)
            ? (string) ($data['error_description'] ?? $data['error'] ?? 'microsoft_token_failed')
            : (string) ($http['error'] ?? 'microsoft_token_failed');
        Response::json([
            'ok' => false,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $msError,
        ], 422);
    }
    return ['access_token' => $token, 'grant' => $refresh !== '' ? 'refresh_token' : 'client_credentials'];
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

$linkRows = ff_rest_get(
    $base,
    $anon,
    $bearer,
    'chatbot_integrations',
    'chatbot_id=eq.' . rawurlencode($chatbotId)
        . '&integration_id=eq.' . rawurlencode($integrationId)
        . '&select=id',
);
if (!$linkRows || !count($linkRows)) {
    Response::error('Integration is not installed on this chatbot', 403);
}

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
        $data = ff_http_data($http);
        $ok = !empty($http['ok']) && is_array($data) && !empty($data['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $ok ? null : (is_array($data) ? (string) ($data['error'] ?? 'slack_error') : 'slack_error'),
        ], $ok ? 200 : 422);
    }

    if ($action === 'ml.classify_intent' && ($provider === 'custom' || $provider === 'tensorflow')) {
        $intentService = '';
        if (isset($config) && is_array($config)) {
            $intentService = trim((string) ($config['intent_service_url'] ?? ''));
        }
        if ($intentService === '') {
            $intentService = trim((string) (getenv('FLOWFORGE_INTENT_URL') ?: ''));
        }
        $baseUrl = rtrim($intentService !== '' ? $intentService : ff_str($cfg, 'base_url'), '/');
        if ($baseUrl === '') {
            Response::error(
                'Configure the TensorFlow intent service: set intent_service_url in api/config.php (e.g. http://127.0.0.1:8091) or base_url on the Custom API integration.',
                400,
            );
        }
        $url = $baseUrl . '/classify';
        $isLoopback = (bool) preg_match('#^https?://(127\.0\.0\.1|localhost)(:\d+)?(/|$)#i', $baseUrl);
        if (!$isLoopback) {
            Security::assertSafePublicUrl($url, []);
        }
        $token = ff_str($secrets, 'api_key');
        if ($token === '' && $intentService !== '') {
            $token = trim((string) (getenv('INTENT_API_TOKEN') ?: ($config['intent_api_token'] ?? '')));
        }
        if ($token === '') Response::error('Configure the model service API token on the integration (api_key) or INTENT_API_TOKEN / intent_api_token.', 400);
        $categories = json_decode(ff_str($fields, 'categories'), true);
        if (!is_array($categories) || !array_is_list($categories) || count($categories) < 2 || count($categories) > 10) Response::error('Provide a JSON array with 2–10 intent categories.', 400);
        $text = ff_str($fields, 'text');
        if (trim($text) === '' || strlen($text) > 8000) Response::error('Visitor message is empty or too long.', 400);
        $thresholdRaw = trim(ff_str($fields, 'threshold'));
        $marginRaw = trim(ff_str($fields, 'margin'));
        if (($thresholdRaw !== '' && !is_numeric($thresholdRaw)) || ($marginRaw !== '' && !is_numeric($marginRaw))) Response::error('Similarity and margin must be numbers from 0 to 1.', 400);
        $threshold = $thresholdRaw === '' ? 0.65 : (float) $thresholdRaw;
        $margin = $marginRaw === '' ? 0.08 : (float) $marginRaw;
        if ($threshold < 0 || $threshold > 1 || $margin < 0 || $margin > 1) Response::error('Similarity and margin must be numbers from 0 to 1.', 400);
        $payload = json_encode(['text' => $text, 'categories' => $categories, 'threshold' => $threshold, 'margin' => $margin], JSON_THROW_ON_ERROR);
        $http = HttpClient::request('POST', $url, ['Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token], $payload, 20, 65536);
        $data = ff_http_data($http);
        $ok = !empty($http['ok']) && is_array($data) && isset($data['intent'], $data['matched'], $data['score'])
            && is_string($data['intent']) && is_bool($data['matched']) && is_numeric($data['score'])
            && is_finite((float) $data['score']) && (float) $data['score'] >= -1 && (float) $data['score'] <= 1;
        if ($ok) {
            $ok = $data['matched']
                ? $data['intent'] !== 'unknown' && in_array($data['intent'], array_column($categories, 'name'), true) && (float) $data['score'] >= $threshold
                : $data['intent'] === 'unknown';
        }
        Response::json(['ok' => $ok, 'status' => (int) ($http['status'] ?? 0), 'data' => $ok ? $data : null, 'error' => $ok ? null : 'Intent service failed or returned an invalid prediction. Check its health and configuration.'], $ok ? 200 : 422);
    }

    if ($action === 'ml.health_check' && ($provider === 'custom' || $provider === 'tensorflow')) {
        $intentService = '';
        if (isset($config) && is_array($config)) {
            $intentService = trim((string) ($config['intent_service_url'] ?? ''));
        }
        if ($intentService === '') {
            $intentService = trim((string) (getenv('FLOWFORGE_INTENT_URL') ?: ''));
        }
        $baseUrl = rtrim($intentService !== '' ? $intentService : ff_str($cfg, 'base_url'), '/');
        if ($baseUrl === '') {
            Response::error(
                'Configure the TensorFlow intent service: set intent_service_url in api/config.php (e.g. http://127.0.0.1:8091) or base_url on the Custom API integration.',
                400,
            );
        }
        $url = $baseUrl . '/health';
        $isLoopback = (bool) preg_match('#^https?://(127\.0\.0\.1|localhost)(:\d+)?(/|$)#i', $baseUrl);
        if (!$isLoopback) {
            Security::assertSafePublicUrl($url, []);
        }
        $token = ff_str($secrets, 'api_key');
        if ($token === '' && $intentService !== '') {
            $token = trim((string) (getenv('INTENT_API_TOKEN') ?: ($config['intent_api_token'] ?? '')));
        }
        if ($token === '') {
            Response::error('Configure the model service API token on the integration (api_key) or INTENT_API_TOKEN / intent_api_token.', 400);
        }
        $http = HttpClient::request('GET', $url, ['Authorization' => 'Bearer ' . $token], null, 10, 65536);
        $data = ff_http_data($http);
        $ok = !empty($http['ok']) && is_array($data) && array_key_exists('ready', $data);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $ok ? $data : null,
            'error' => $ok ? null : 'Intent health check failed. Ensure the Node service is running and the API token matches.',
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
        $data = ff_http_data($http);
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $ok ? null : (string) ($http['error'] ?? 'custom_request_failed'),
        ], $ok ? 200 : 422);
    }

    if ($action === 'sheets.create_spreadsheet' && $provider === 'google_sheets') {
        $token = ff_google_access_token($cfg, $secrets);
        $title = ff_str($fields, 'title') ?: 'FlowForge spreadsheet';
        $sheetTitle = ff_str($fields, 'sheetTitle') ?: 'Sheet1';
        $payload = json_encode([
            'properties' => ['title' => $title],
            'sheets' => [['properties' => ['title' => $sheetTitle]]],
        ], JSON_UNESCAPED_UNICODE);
        $http = HttpClient::request(
            'POST',
            'https://sheets.googleapis.com/v4/spreadsheets',
            [
                'Authorization' => 'Bearer ' . $token['access_token'],
                'Content-Type' => 'application/json',
            ],
            $payload ?: '{}',
            30,
            1_048_576,
        );
        $data = ff_http_data($http);
        $ok = !empty($http['ok']) && is_array($data) && !empty($data['spreadsheetId']);
        $valuesRaw = ff_str($fields, 'values');
        if ($ok && $valuesRaw !== '') {
            $values = ff_parse_sheet_values($valuesRaw);
            if ($values) {
                $spreadsheetId = (string) $data['spreadsheetId'];
                $range = $sheetTitle . '!A1';
                $body = json_encode(['values' => [$values]], JSON_UNESCAPED_UNICODE);
                $http2 = HttpClient::request(
                    'PUT',
                    'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($spreadsheetId) . '/values/' . rawurlencode($range) . '?valueInputOption=USER_ENTERED',
                    [
                        'Authorization' => 'Bearer ' . $token['access_token'],
                        'Content-Type' => 'application/json',
                    ],
                    $body ?: '{}',
                    20,
                    1_048_576,
                );
                if (empty($http2['ok'])) {
                    Response::json([
                        'ok' => false,
                        'status' => (int) ($http2['status'] ?? 0),
                        'data' => ['spreadsheet' => $data, 'write' => ff_http_data($http2)],
                        'error' => 'spreadsheet_created_but_initial_row_failed',
                    ], 422);
                }
            }
        }
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $ok ? null : 'sheets_create_failed',
        ], $ok ? 200 : 422);
    }

    if ($action === 'sheets.append_row' && $provider === 'google_sheets') {
        $token = ff_google_access_token($cfg, $secrets);
        $spreadsheetId = ff_str($fields, 'spreadsheetId') ?: ff_str($cfg, 'spreadsheet_id');
        $range = ff_str($fields, 'range') ?: 'Sheet1!A1';
        $values = ff_parse_sheet_values(ff_str($fields, 'values'));
        if ($spreadsheetId === '' || !$values) {
            Response::error('spreadsheetId and values are required', 400);
        }
        $body = json_encode(['values' => [$values]], JSON_UNESCAPED_UNICODE);
        $url = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($spreadsheetId)
            . '/values/' . rawurlencode($range) . ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
        $http = HttpClient::request(
            'POST',
            $url,
            [
                'Authorization' => 'Bearer ' . $token['access_token'],
                'Content-Type' => 'application/json',
            ],
            $body ?: '{}',
            20,
            1_048_576,
        );
        $data = ff_http_data($http);
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $ok ? null : 'sheets_append_failed',
        ], $ok ? 200 : 422);
    }

    if ($action === 'storage.upload_text' && $provider === 'google_drive') {
        $token = ff_google_access_token($cfg, $secrets, [
            'https://www.googleapis.com/auth/drive.file',
        ]);
        $path = ff_safe_storage_path(ff_str($fields, 'path') ?: 'upload.txt');
        $content = ff_str($fields, 'content');
        $name = basename($path);
        $folderId = ff_str($cfg, 'folder_id');
        $metadata = ['name' => $name];
        if ($folderId !== '') {
            $metadata['parents'] = [$folderId];
        }
        $boundary = 'flowforge_' . bin2hex(random_bytes(8));
        $body = '--' . $boundary . "\r\n"
            . 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
            . json_encode($metadata, JSON_UNESCAPED_UNICODE) . "\r\n"
            . '--' . $boundary . "\r\n"
            . 'Content-Type: text/plain; charset=UTF-8\r\n\r\n'
            . $content . "\r\n"
            . '--' . $boundary . '--';
        $http = HttpClient::request(
            'POST',
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            [
                'Authorization' => 'Bearer ' . $token['access_token'],
                'Content-Type' => 'multipart/related; boundary=' . $boundary,
            ],
            $body,
            40,
            4_194_304,
        );
        $data = ff_http_data($http);
        $ok = !empty($http['ok']);
        Response::json([
            'ok' => $ok,
            'status' => (int) ($http['status'] ?? 0),
            'data' => $data,
            'error' => $ok ? null : 'drive_upload_failed',
        ], $ok ? 200 : 422);
    }

    if ($action === 'storage.upload_text' && $provider === 'microsoft_onedrive') {
        $token = ff_microsoft_access_token($cfg, $secrets);
        $path = ff_safe_storage_path(ff_str($fields, 'path') ?: 'upload.txt');
        $content = ff_str($fields, 'content');
        $driveId = ff_str($cfg, 'drive_id');
        $userPrincipal = ff_str($cfg, 'user_principal');
        $segments = array_map('rawurlencode', explode('/', $path));
        $encodedPath = implode('/', $segments);
        $grant = (string) ($token['grant'] ?? '');
        if ($driveId !== '') {
            $url = 'https://graph.microsoft.com/v1.0/drives/'
                . rawurlencode($driveId)
                . '/root:/'
                . $encodedPath
                . ':/content';
        } elseif ($userPrincipal !== '') {
            $url = 'https://graph.microsoft.com/v1.0/users/'
                . rawurlencode($userPrincipal)
                . '/drive/root:/'
                . $encodedPath
                . ':/content';
        } elseif ($grant === 'client_credentials') {
            Response::error(
                'App-only OneDrive uploads require a Default drive ID or User UPN / ID ( /me/drive needs a user refresh token )',
                400,
            );
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
            'data' => ff_http_data($http),
            'error' => $ok ? null : (string) ($http['error'] ?? 'onedrive_upload_failed'),
        ], $ok ? 200 : 422);
    }

    $hint = 'This provider/action pair is not implemented on the API.';
    if ($action === 'ml.classify_intent' || $action === 'ml.health_check') {
        $hint = 'TensorFlow intent actions require a Custom API integration with the intent service. Deploy web/api/integration/execute.php, run web/api/intent (Node on 8091), set intent_service_url=http://127.0.0.1:8091 in config.php, and set the integration api_key to INTENT_API_TOKEN.';
    }
    Response::json([
        'ok' => false,
        'status' => 501,
        'data' => [
            'provider' => $provider,
            'action' => $action,
            'fields' => $fields,
        ],
        'error' => 'integration_action_not_implemented',
        'hint' => $hint,
    ], 501);
} catch (Throwable $e) {
    Response::json(['ok' => false, 'status' => 500, 'data' => null, 'error' => $e->getMessage()], 500);
}
