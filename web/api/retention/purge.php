<?php
declare(strict_types=1);

/**
 * Cron entry: purge expired conversation data per retention policies.
 *
 * Auth: Authorization: Bearer <retention_cron_secret>  OR  ?secret=<retention_cron_secret>
 * Schedule example (nightly at 2am UTC):
 *   0 2 * * * curl -s -X POST -H "Authorization: Bearer $SECRET" https://…/flowforge/api/retention/purge
 */
require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_public(['POST', 'GET']);
$config = $boot['config'];
RateLimiter::hit($config, 'retention-purge:' . Security::clientIp());

// Prefer dedicated retention_cron_secret; fall back to alerts_cron_secret (shared ops secret)
$expected = trim((string) ($config['retention_cron_secret'] ?? $config['alerts_cron_secret'] ?? ''));
if ($expected === '' || $expected === 'REPLACE_WITH_RETENTION_CRON_SECRET' || $expected === 'REPLACE_WITH_ALERTS_CRON_SECRET') {
    Response::error('retention_cron_secret (or alerts_cron_secret) is not configured', 500);
}

$header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
$bearer = '';
if (preg_match('/^Bearer\s+(\S+)$/i', (string) $header, $m)) {
    $bearer = $m[1];
}
$querySecret = trim((string) ($_GET['secret'] ?? ''));
$provided = $bearer !== '' ? $bearer : $querySecret;
if ($provided === '' || !hash_equals($expected, $provided)) {
    Response::error('Unauthorized', 401);
}

$now = time();

// Record cron run start
$runId = null;
$runInsert = SupabaseRest::restInsertAsService(
    $config,
    'cron_runs',
    [
        'job_name' => 'retention.purge',
        'instance_id' => null,
        'started_at' => gmdate('c', $now),
        'status' => 'running',
        'summary' => [],
    ],
);
if ($runInsert['ok'] && is_array($runInsert['data'] ?? null) && count($runInsert['data'])) {
    $runId = (string) ($runInsert['data'][0]['id'] ?? '');
}

$summary = [
    'policies_checked' => 0,
    'instances_purged' => 0,
    'total_sessions_purged' => 0,
    'skipped_legal_hold' => 0,
    'errors' => [],
];

// Fetch all retention policies
$policiesRes = SupabaseRest::restSelectAsService(
    $config,
    'data_retention_policies',
    'select=instance_id,sessions_ttl_days,legal_hold',
);
if (!$policiesRes['ok'] || !is_array($policiesRes['data'] ?? null)) {
    $error = $policiesRes['error'] ?? 'Failed to list retention policies';
    $summary['errors'][] = $error;
    if ($runId) {
        SupabaseRest::restPatchAsService(
            $config,
            'cron_runs',
            'id=eq.' . rawurlencode($runId),
            [
                'completed_at' => gmdate('c', time()),
                'status' => 'failed',
                'summary' => $summary,
                'error' => $error,
            ],
        );
    }
    Response::json([
        'ok' => false,
        'error' => $error,
        'summary' => $summary,
    ], 502);
}

foreach ($policiesRes['data'] as $policy) {
    if (!is_array($policy)) {
        continue;
    }
    $summary['policies_checked']++;
    
    $instanceId = (string) ($policy['instance_id'] ?? '');
    if ($instanceId === '' || !SupabaseRest::isUuid($instanceId)) {
        continue;
    }

    if (!empty($policy['legal_hold'])) {
        $summary['skipped_legal_hold']++;
        continue;
    }

    // Call the RPC as service_role (cron context)
    $purgeRes = SupabaseRest::restRpcAsService(
        $config,
        'purge_expired_conversation_data',
        ['p_instance_id' => $instanceId],
    );

    if (!$purgeRes['ok']) {
        $summary['errors'][] = $instanceId . ':' . ($purgeRes['error'] ?? 'purge failed');
        continue;
    }

    // RPC returns jsonb { "purged_sessions": N } or { "purged": 0, "reason": "..." }
    $result = $purgeRes['data'] ?? [];
    $purgedSessions = (int) ($result['purged_sessions'] ?? 0);
    if ($purgedSessions > 0) {
        $summary['instances_purged']++;
        $summary['total_sessions_purged'] += $purgedSessions;
    }
}

// Update cron run record
if ($runId) {
    SupabaseRest::restPatchAsService(
        $config,
        'cron_runs',
        'id=eq.' . rawurlencode($runId),
        [
            'completed_at' => gmdate('c', time()),
            'status' => count($summary['errors']) > 0 ? 'failed' : 'success',
            'summary' => $summary,
            'error' => count($summary['errors']) > 0 ? implode('; ', $summary['errors']) : null,
        ],
    );
}

Response::json(['ok' => true, 'summary' => $summary]);
