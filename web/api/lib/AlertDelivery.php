<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Deliver threshold alerts and weekly digests via PlatformMail and/or Slack.
 */
final class AlertDelivery
{
    /**
     * @param array<string, mixed> $payload
     * @return array{ok: bool, error: ?string}
     */
    public static function sendEmail(string $to, string $subject, string $body): array
    {
        $to = trim($to);
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'No valid contact_email on organisation'];
        }
        $smtp = PlatformMail::smtpConfig(null);
        if (trim((string) ($smtp['smtpHost'] ?? '')) === '' || trim((string) ($smtp['fromEmail'] ?? '')) === '') {
            return ['ok' => false, 'error' => 'Platform SMTP is not configured'];
        }
        $result = Mailer::send($smtp, $to, $subject, $body);
        return [
            'ok' => !empty($result['ok']),
            'error' => empty($result['ok']) ? (string) ($result['error'] ?? 'email_failed') : null,
        ];
    }

    /**
     * @param array<string, mixed> $config
     * @return array{ok: bool, error: ?string, data?: mixed}
     */
    public static function sendSlack(array $config, string $integrationId, string $message, ?string $channelOverride = null): array
    {
        if ($integrationId === '' || !SupabaseRest::isUuid($integrationId)) {
            return ['ok' => false, 'error' => 'Invalid Slack integration id'];
        }
        $rows = SupabaseRest::restSelectAsService(
            $config,
            'integrations',
            'id=eq.' . rawurlencode($integrationId)
                . '&deleted_at=is.null&status=eq.connected&provider=eq.slack&select=id,config',
        );
        if (!$rows['ok'] || !is_array($rows['data'] ?? null) || !count($rows['data'])) {
            return ['ok' => false, 'error' => 'Slack integration not found or not connected'];
        }
        $row = $rows['data'][0];
        $cfg = isset($row['config']) && is_array($row['config']) ? $row['config'] : [];
        $channel = $channelOverride !== null && $channelOverride !== ''
            ? $channelOverride
            : (string) ($cfg['default_channel'] ?? '');

        $secretRows = SupabaseRest::restSelectAsService(
            $config,
            'integration_secrets',
            'integration_id=eq.' . rawurlencode($integrationId) . '&select=secrets',
        );
        $secrets = [];
        if ($secretRows['ok'] && is_array($secretRows['data'] ?? null) && count($secretRows['data'])) {
            $raw = $secretRows['data'][0]['secrets'] ?? [];
            if (is_array($raw)) {
                $secrets = $raw;
            }
        }
        $token = (string) ($secrets['bot_token'] ?? '');
        if ($token === '' || $channel === '' || $message === '') {
            return ['ok' => false, 'error' => 'Slack requires bot_token, channel, and message'];
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
        return [
            'ok' => $ok,
            'error' => $ok ? null : (is_array($data) ? (string) ($data['error'] ?? 'slack_error') : 'slack_error'),
            'data' => $data,
        ];
    }

    /**
     * @param array<string, mixed> $config
     * @param array<string, mixed> $payload
     */
    public static function logDelivery(
        array $config,
        string $instanceId,
        ?string $ruleId,
        string $kind,
        string $channel,
        array $payload,
        bool $ok,
        ?string $error,
    ): void {
        SupabaseRest::restInsertAsService($config, 'alert_deliveries', [
            'instance_id' => $instanceId,
            'rule_id' => $ruleId,
            'kind' => $kind,
            'channel' => $channel,
            'payload' => $payload,
            'ok' => $ok,
            'error' => $error,
        ]);
    }

    /**
     * Create in-app notifications for organisation owners/admins.
     *
     * @param array<string, mixed> $config
     * @param array<string, mixed> $meta
     * @return array{ok: bool, error: ?string}
     */
    public static function notifyInApp(
        array $config,
        string $instanceId,
        string $kind,
        string $title,
        string $body,
        string $href,
        ?string $resourceType = null,
        ?string $resourceId = null,
        array $meta = [],
    ): array {
        $roles = ['owner', 'admin'];
        $rpc = SupabaseRest::rpcAsService($config, 'notify_instance_roles', [
            'p_instance_id' => $instanceId,
            'p_roles' => $roles,
            'p_kind' => $kind,
            'p_title' => $title,
            'p_body' => $body,
            'p_href' => $href,
            'p_resource_type' => $resourceType,
            'p_resource_id' => $resourceId,
            'p_meta' => (object) $meta,
            'p_exclude_user' => null,
        ]);
        if (empty($rpc['ok'])) {
            return ['ok' => false, 'error' => (string) ($rpc['error'] ?? 'notify_failed')];
        }
        return ['ok' => true, 'error' => null];
    }
}
