<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\DatabaseClient;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_deferred_auth(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();
$auth = flowforge_finalize_auth($config, $body);

if ($auth['anon'] && trim((string) ($body['connection_id'] ?? '')) === '') {
    Response::error('connection_id is required for public chat sessions', 400);
}

$resolved = SupabaseRest::resolveConnection($config, $body);
$connection = $resolved['connection'];
$instanceId = $resolved['instance_id'];
$usedService = $resolved['used_service_role'];

$provider = strtolower(trim((string) ($connection['provider'] ?? '')));
$host = trim((string) ($connection['host'] ?? ''));
$database = trim((string) ($connection['database'] ?? ''));
if ($provider === '') {
    Response::error('Selected connection is not a database connection', 400);
}
if ($provider === 'sqlite') {
    if ($database === '') {
        Response::error('SQLite database file path is required', 400);
    }
} elseif ($host === '') {
    Response::error('Selected connection is not a database connection', 400);
}

$sql = (string) ($body['sql'] ?? '');
$operation = (string) ($body['operation'] ?? 'query');
$params = [];
if (isset($body['params']) && is_array($body['params'])) {
    $params = $body['params'];
}

$allowlist = [];
if (isset($config['sqlite_path_allowlist']) && is_array($config['sqlite_path_allowlist'])) {
    foreach ($config['sqlite_path_allowlist'] as $entry) {
        if (is_string($entry) && trim($entry) !== '') {
            $allowlist[] = trim($entry);
        }
    }
}

$result = DatabaseClient::run($connection, $sql, $params, $operation, [
    'sqlite_path_allowlist' => $allowlist,
]);

if (!$result['ok']) {
    Response::json([
        'ok' => false,
        'error' => $result['error'] ?? 'Database query failed',
    ], 502);
}

$userJwt = $auth['anon'] ? null : SupabaseRest::bearerFromRequest();
if ($instanceId !== null) {
    SupabaseRest::incrementInstanceUsage(
        $config,
        $instanceId,
        ['p_http_calls' => 1],
        $usedService || $auth['anon'],
        $userJwt,
    );
}

Response::json([
    'ok' => true,
    'rows' => $result['rows'] ?? [],
    'rowCount' => $result['rowCount'] ?? 0,
]);
