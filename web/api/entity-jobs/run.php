<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/EntityJobExport.php';
require_once dirname(__DIR__) . '/lib/EntityJobDestination.php';
use FlowForge\Api\EntityJobDestination;
use FlowForge\Api\HttpClient;
use FlowForge\Api\Security;
use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;
use FlowForge\Api\EntityJobExport;

$config = flowforge_bootstrap_public(['POST'])['config'];
$expected = (string) ($config['entity_jobs_cron_secret'] ?? '');
$header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (strlen($expected) < 32 || !preg_match('/^Bearer\s+(\S+)$/i', $header, $match) || !hash_equals($expected, $match[1])) Response::error('Unauthorized or scheduler secret not configured', 401);
// One bounded job per invocation. Multiple scheduler workers are safe.
$claimed = SupabaseRest::rpcAsService($config, 'claim_entity_job');
if (!$claimed['ok']) Response::error('Unable to claim job; check database migration and service configuration', 502);
$work = $claimed['data'] ?? null;
if (!$work) Response::json(['ok' => true, 'message' => 'No jobs due']);
$job = $work['job']; $run = $work['run']; $runId = (string) $run['id'];
try {
    if ($job['action'] === 'cleanup') {
        $result = SupabaseRest::rpcAsService($config, 'execute_entity_cleanup', ['p_run_id' => $runId]);
        if (!$result['ok']) throw new RuntimeException('Cleanup failed; check the entity, job settings and database permissions');
        Response::json(['ok' => true, 'run_id' => $runId, 'rows' => $result['data']]);
    }
    $export = SupabaseRest::rpcAsService($config, 'entity_job_export', ['p_run_id' => $runId]);
    if (!$export['ok']) throw new RuntimeException('Export failed: check columns, entity access and the 10000-row / 20 MB limit');
    $data = $export['data'];
    $key = null;
    if (in_array($job['action'], ['http_api', 'database'], true)) {
        $resolved = SupabaseRest::rpcAsService($config, 'entity_job_connection', ['p_run_id' => $runId]);
        if (!$resolved['ok'] || !is_array($resolved['data'])) throw new RuntimeException('Destination connection is unavailable; check installation, organisation and credentials');
        $connection = $resolved['data'];
        if ($job['action'] === 'database') {
            EntityJobDestination::database($connection, (string) $job['target_table'], $data, ['sqlite_path_allowlist' => $config['sqlite_path_allowlist'] ?? []]);
        } else {
            $url = EntityJobDestination::apiUrl($connection, (string) $job['http_path']);
            Security::assertSafePublicUrl($url, SupabaseRest::resolveHttpHostAllowlist($config, $work['instance_id']), true);
            if (!extension_loaded('curl')) throw new RuntimeException('PHP cURL is required for API exports');
            $method = (string) $job['http_method'];
            if (!in_array($method, ['POST','PUT','PATCH'], true)) throw new RuntimeException('Unsupported API method');
            $headers = HttpClient::buildAuthHeaders($connection);
            foreach (array_keys($headers) as $name) {
                if (in_array(strtolower($name), ['content-type','content-length','host','idempotency-key'], true)) unset($headers[$name]);
            }
            $headers['Content-Type'] = 'application/json';
            $headers['Idempotency-Key'] = $runId;
            $payload = json_encode(['job_id' => $job['id'], 'run_id' => $runId, 'entity_id' => $job['entity_id'], 'columns' => $data['columns'], 'records' => $data['rows']], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            if (strlen($payload) > 20000000) throw new RuntimeException('API payload exceeds 20 MB');
            $response = HttpClient::request($method, $url, $headers, $payload, 60, 65536);
            if (!$response['ok'] || $response['status'] < 200 || $response['status'] >= 300) throw new RuntimeException('API export failed (HTTP ' . (int) $response['status'] . '); check endpoint and authentication');
        }
    } elseif ($job['action'] === 'csv_s3') {
    $destinations = $config['entity_job_s3_destinations'] ?? [];
    $destination = $destinations[$work['instance_id']][$job['destination']] ?? null;
    if (!is_array($destination)) throw new RuntimeException('S3 destination is not configured for this organisation');
    $csv = EntityJobExport::csv($data['columns'], $data['rows']);
    $prefix = trim((string) ($destination['prefix'] ?? 'flowforge'), '/');
    if (!preg_match('#^[A-Za-z0-9/_-]*$#D', $prefix)) throw new RuntimeException('Invalid S3 destination prefix');
    $key = ($prefix !== '' ? $prefix . '/' : '') . $work['instance_id'] . '/' . $job['entity_id'] . '/' . $runId . '.csv';
    EntityJobExport::upload($destination, $key, $csv);
    } else { throw new RuntimeException('Unsupported export destination'); }
    $finish = SupabaseRest::restPatchAsService($config, 'entity_job_runs', 'id=eq.' . rawurlencode($runId) . '&status=eq.running', ['status' => 'succeeded', 'finished_at' => gmdate('c'), 'row_count' => count($data['rows']), 'object_key' => $key]);
    if (!$finish['ok']) throw new RuntimeException('Export completed but recording success failed; inspect the destination before retrying');
    Response::json(['ok' => true, 'run_id' => $runId, 'rows' => count($data['rows']), 'object_key' => $key]);
} catch (Throwable $error) {
    // Only controlled error messages; never include credentials, payloads or upstream response bodies.
    $message = $error instanceof RuntimeException ? $error->getMessage() : 'Job failed unexpectedly; check server logs';
    SupabaseRest::restPatchAsService($config, 'entity_job_runs', 'id=eq.' . rawurlencode($runId) . '&status=eq.running', ['status' => 'failed', 'finished_at' => gmdate('c'), 'error' => $message]);
    Response::json(['ok' => false, 'run_id' => $runId, 'error' => $message], 502);
}
