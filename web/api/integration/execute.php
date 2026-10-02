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
