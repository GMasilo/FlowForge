<?php
declare(strict_types=1);

/**
 * Cron entry: evaluate alert rules and send threshold notifications + weekly digests.
 *
 * Auth: Authorization: Bearer <alerts_cron_secret>  OR  ?secret=<alerts_cron_secret>
 * Schedule example (every 30 min):
 *   curl -s -X POST -H "Authorization: Bearer $SECRET" https://…/flowforge/api/alerts/run
 */
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/AlertEvaluator.php';
require_once dirname(__DIR__) . '/lib/AlertDelivery.php';

use FlowForge\Api\AlertDelivery;
use FlowForge\Api\AlertEvaluator;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_public(['POST', 'GET']);
$config = $boot['config'];
RateLimiter::hit($config, 'alerts-run:' . Security::clientIp());

$expected = trim((string) ($config['alerts_cron_secret'] ?? ''));
if ($expected === '' || $expected === 'REPLACE_WITH_ALERTS_CRON_SECRET') {
    Response::error('alerts_cron_secret is not configured', 500);
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
$ym = gmdate('Y-m', $now);
$utcWeekday = (int) gmdate('w', $now); // 0=Sun … 6=Sat

$instancesRes = SupabaseRest::restSelectAsService(
    $config,
    'instances',
    'select=id,name,contact_email,quota_max_conversations_month',
);
if (!$instancesRes['ok'] || !is_array($instancesRes['data'] ?? null)) {
    Response::json([
        'ok' => false,
        'error' => $instancesRes['error'] ?? 'Failed to list instances',
    ], 502);
}

$summary = [
    'instances' => 0,
    'rules_checked' => 0,
    'triggered' => 0,
    'notified' => 0,
    'digests' => 0,
    'errors' => [],
];

foreach ($instancesRes['data'] as $instance) {
    if (!is_array($instance)) {
        continue;
    }
    $instanceId = (string) ($instance['id'] ?? '');
    if ($instanceId === '' || !SupabaseRest::isUuid($instanceId)) {
        continue;
    }
    $summary['instances']++;
    $instanceName = (string) ($instance['name'] ?? 'Organisation');
    $contactEmail = trim((string) ($instance['contact_email'] ?? ''));
    $quotaMax = (float) ($instance['quota_max_conversations_month'] ?? 0);

    $usageRes = SupabaseRest::restSelectAsService(
        $config,
        'instance_usage_monthly',
        'instance_id=eq.' . rawurlencode($instanceId)
            . '&year_month=eq.' . rawurlencode($ym)
            . '&select=conversations',
    );
    $quotaUsed = 0.0;
    if ($usageRes['ok'] && is_array($usageRes['data'] ?? null) && count($usageRes['data'])) {
        $quotaUsed = (float) ($usageRes['data'][0]['conversations'] ?? 0);
    }
    $usage = ['max' => $quotaMax, 'used' => $quotaUsed];

    $sessionsRes = SupabaseRest::restSelectAsService(
        $config,
        'conversation_sessions',
        'instance_id=eq.' . rawurlencode($instanceId)
            . '&select=id,status,created_at,updated_at,completed_at'
            . '&order=created_at.desc&limit=2000',
    );
    $sessions = ($sessionsRes['ok'] && is_array($sessionsRes['data'] ?? null)) ? $sessionsRes['data'] : [];

    $rulesRes = SupabaseRest::restSelectAsService(
        $config,
        'instance_alert_rules',
        'instance_id=eq.' . rawurlencode($instanceId)
            . '&enabled=eq.true'
            . '&select=id,name,metric,threshold,window_hours,notify_email,notify_slack,slack_integration_id,last_notified_at',
    );
    $rules = ($rulesRes['ok'] && is_array($rulesRes['data'] ?? null)) ? $rulesRes['data'] : [];

    foreach ($rules as $rule) {
        if (!is_array($rule)) {
            continue;
        }
        $summary['rules_checked']++;
        $ruleId = (string) ($rule['id'] ?? '');
        $metric = (string) ($rule['metric'] ?? '');
        $threshold = (float) ($rule['threshold'] ?? 0);
        $windowHours = max(1, (int) ($rule['window_hours'] ?? 24));
        $eval = AlertEvaluator::metricValue($metric, $sessions, $windowHours, $usage, $now);
        if (!AlertEvaluator::isTriggered($metric, $eval['value'], $threshold)) {
            continue;
        }
        $summary['triggered']++;

        SupabaseRest::restPatchAsService(
            $config,
            'instance_alert_rules',
            'id=eq.' . rawurlencode($ruleId),
            ['last_triggered_at' => gmdate('c', $now)],
        );

        $lastNotified = (string) ($rule['last_notified_at'] ?? '');
        $lastTs = $lastNotified !== '' ? strtotime($lastNotified) : false;
        $cooldownSeconds = max(3600, $windowHours * 3600);
        if ($lastTs !== false && ($now - $lastTs) < $cooldownSeconds) {
            continue;
        }

        $valueLabel = $eval['unit'] === '%'
            ? round($eval['value'], 1) . '%'
            : (string) (int) $eval['value'];
        $subject = '[FlowForge] Alert: ' . (string) ($rule['name'] ?? $metric);
        $bodyLines = [
            'Organisation: ' . $instanceName,
            'Rule: ' . (string) ($rule['name'] ?? ''),
            'Metric: ' . $metric,
            'Value: ' . $valueLabel . ' (threshold ' . $threshold . ($eval['unit'] === '%' ? '%' : '') . ')',
            'Window: last ' . $windowHours . ' hour(s)',
            'Sample size: ' . $eval['sampleSize'] . ' session(s)',
            '',
            '— FlowForge alerts',
        ];
        $textBody = implode("\n", $bodyLines);
        $payloadBase = [
            'rule_name' => $rule['name'] ?? null,
            'metric' => $metric,
            'value' => $eval['value'],
            'threshold' => $threshold,
            'window_hours' => $windowHours,
            'sample_size' => $eval['sampleSize'],
        ];

        $anyOk = false;
        if (!empty($rule['notify_email'])) {
            $emailResult = AlertDelivery::sendEmail($contactEmail, $subject, $textBody);
            AlertDelivery::logDelivery(
                $config,
                $instanceId,
                $ruleId,
                'threshold',
                'email',
                $payloadBase,
                $emailResult['ok'],
                $emailResult['error'],
            );
            if ($emailResult['ok']) {
                $anyOk = true;
            } else {
                $summary['errors'][] = $instanceId . ':email:' . ($emailResult['error'] ?? 'failed');
            }
        }

        if (!empty($rule['notify_slack'])) {
            $slackId = (string) ($rule['slack_integration_id'] ?? '');
            $slackResult = AlertDelivery::sendSlack($config, $slackId, $subject . "\n" . $textBody);
            AlertDelivery::logDelivery(
                $config,
                $instanceId,
                $ruleId,
                'threshold',
                'slack',
                $payloadBase,
                $slackResult['ok'],
                $slackResult['error'],
            );
            if ($slackResult['ok']) {
                $anyOk = true;
            } else {
                $summary['errors'][] = $instanceId . ':slack:' . ($slackResult['error'] ?? 'failed');
            }
        }

        if ($anyOk) {
            $summary['notified']++;
            SupabaseRest::restPatchAsService(
                $config,
                'instance_alert_rules',
                'id=eq.' . rawurlencode($ruleId),
                ['last_notified_at' => gmdate('c', $now)],
            );
        }
    }

    // Weekly digest
    $settingsRes = SupabaseRest::restSelectAsService(
        $config,
        'instance_alert_settings',
        'instance_id=eq.' . rawurlencode($instanceId) . '&select=*',
    );
    $settings = ($settingsRes['ok'] && is_array($settingsRes['data'] ?? null) && count($settingsRes['data']))
        ? $settingsRes['data'][0]
        : null;

    if (is_array($settings) && !empty($settings['digest_enabled'])) {
        $digestWeekday = (int) ($settings['digest_weekday'] ?? 1);
        $lastDigest = (string) ($settings['last_digest_at'] ?? '');
        $lastDigestTs = $lastDigest !== '' ? strtotime($lastDigest) : false;
        $alreadyThisWeek = $lastDigestTs !== false && ($now - $lastDigestTs) < 6 * 86400;

        if ($utcWeekday === $digestWeekday && !$alreadyThisWeek) {
            $stats = AlertEvaluator::weeklyDigestStats($sessions, $usage, $now);
            $subject = '[FlowForge] Weekly digest — ' . $instanceName;
            $digestBody = implode("\n", [
                'Weekly KPI summary for ' . $instanceName . ' (last 7 days):',
                '',
                'Sessions: ' . $stats['sessions'],
                'Completed: ' . $stats['completed'],
                'Abandoned: ' . $stats['abandoned'],
                'Failed: ' . $stats['failed'],
                'Completion rate: ' . $stats['completion_pct'] . '%',
                'Conversation quota: ' . $stats['quota_used'] . ' / ' . $stats['quota_max'],
                '',
                '— FlowForge digests',
            ]);

            $digestOk = false;
            $emailResult = AlertDelivery::sendEmail($contactEmail, $subject, $digestBody);
            AlertDelivery::logDelivery(
                $config,
                $instanceId,
                null,
                'digest',
                'email',
                $stats,
                $emailResult['ok'],
                $emailResult['error'],
            );
            if ($emailResult['ok']) {
                $digestOk = true;
            } else {
                $summary['errors'][] = $instanceId . ':digest-email:' . ($emailResult['error'] ?? 'failed');
            }

            $slackId = (string) ($settings['digest_slack_integration_id'] ?? '');
            if ($slackId !== '') {
                $slackResult = AlertDelivery::sendSlack($config, $slackId, $subject . "\n" . $digestBody);
                AlertDelivery::logDelivery(
                    $config,
                    $instanceId,
                    null,
                    'digest',
                    'slack',
                    $stats,
                    $slackResult['ok'],
                    $slackResult['error'],
                );
                if ($slackResult['ok']) {
                    $digestOk = true;
                } else {
                    $summary['errors'][] = $instanceId . ':digest-slack:' . ($slackResult['error'] ?? 'failed');
                }
            }

            if ($digestOk) {
                $summary['digests']++;
                SupabaseRest::restPatchAsService(
                    $config,
                    'instance_alert_settings',
                    'instance_id=eq.' . rawurlencode($instanceId),
                    ['last_digest_at' => gmdate('c', $now), 'updated_at' => gmdate('c', $now)],
                );
            }
        }
    }
}

Response::json(['ok' => true, 'summary' => $summary]);
