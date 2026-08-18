<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\HttpClient;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody();

$instanceId = trim((string) ($body['instance_id'] ?? ''));
$event = trim((string) ($body['event'] ?? ''));
$payload = $body['payload'] ?? null;

if ($instanceId === '' || !SupabaseRest::isUuid($instanceId)) {
    Response::error('instance_id is required', 400);
}
if ($event === '' || strlen($event) > 128) {
    Response::error('event is required', 400);
}
if ($payload === null) {
    $payload = new stdClass();
}
if (!is_array($payload) && !is_object($payload)) {
    Response::error('payload must be a JSON object', 400);
}

$jwt = SupabaseRest::bearerFromRequest();

$list = SupabaseRest::rpcAsService($config, 'list_webhooks_for_event', [
    'p_instance_id' => $instanceId,
    'p_event' => $event,
]);

if (!$list['ok']) {
    Response::json([
        'ok' => false,
        'error' => $list['error'] ?? 'Could not list webhooks',
    ], $list['status'] >= 400 ? $list['status'] : 502);
}

$webhooks = $list['data'] ?? [];
if (!is_array($webhooks)) {
    $webhooks = [];
}

$timeoutSec = min(15, (int) ($config['http_timeout_seconds'] ?? 30));
$maxBytes = (int) ($config['http_max_response_bytes'] ?? 1_048_576);
$deliveries = [];

foreach ($webhooks as $hook) {
    if (!is_array($hook)) {
        continue;
    }

    $webhookId = (string) ($hook['id'] ?? '');
    $url = trim((string) ($hook['url'] ?? ''));
    $secret = (string) ($hook['secret'] ?? '');

    if ($webhookId === '' || $url === '') {
        continue;
    }

    $jsonBody = json_encode(
        [
            'event' => $event,
            'instance_id' => $instanceId,
            'payload' => $payload,
        ],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    if ($jsonBody === false) {
        continue;
    }

    $ok = false;
    $statusCode = null;
    $error = null;

    $urlError = flowforge_webhook_url_error($url);
    if ($urlError !== null) {
        $error = $urlError;
    } else {
        $signature = 'sha256=' . hash_hmac('sha256', $jsonBody, $secret);
        $headers = [
            'Content-Type' => 'application/json',
            'X-FlowForge-Signature' => $signature,
        ];
        $result = HttpClient::request('POST', $url, $headers, $jsonBody, $timeoutSec, $maxBytes);
        $ok = $result['ok'];
        $statusCode = (int) ($result['status'] ?? 0);
        if (!$ok) {
            $error = (string) ($result['error'] ?? ('HTTP ' . $statusCode));
        }
    }

    $row = [
        'webhook_id' => $webhookId,
        'event' => $event,
        'payload' => $payload,
        'status_code' => $statusCode,
        'ok' => $ok,
        'error' => $error,
    ];

    SupabaseRest::restInsert($config, $jwt, 'webhook_deliveries', $row);

    $deliveries[] = [
        'webhook_id' => $webhookId,
        'ok' => $ok,
        'status_code' => $statusCode,
        'error' => $error,
    ];
}

Response::json([
    'ok' => true,
    'event' => $event,
    'instance_id' => $instanceId,
    'delivered' => count($deliveries),
    'results' => $deliveries,
]);

/** Soft SSRF check that does not abort the whole dispatch batch. */
function flowforge_webhook_url_error(string $url): ?string
{
    $parts = parse_url($url);
    if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
        return 'Invalid webhook URL';
    }

    $scheme = strtolower((string) $parts['scheme']);
    if (!in_array($scheme, ['http', 'https'], true)) {
        return 'Only http/https webhook URLs are allowed';
    }

    $host = strtolower((string) $parts['host']);
    if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
        return 'Webhook host is not allowed';
    }

    $ips = [];
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $ips[] = $host;
    } else {
        $records = @dns_get_record($host, DNS_A + DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $rec) {
                if (!empty($rec['ip'])) {
                    $ips[] = $rec['ip'];
                }
                if (!empty($rec['ipv6'])) {
                    $ips[] = $rec['ipv6'];
                }
            }
        }
        if (!$ips) {
            $resolved = gethostbynamel($host);
            if (is_array($resolved)) {
                $ips = $resolved;
            }
        }
    }

    if (!$ips) {
        return 'Unable to resolve webhook host';
    }

    foreach ($ips as $ip) {
        if (Security::isPrivateOrReservedIp((string) $ip)) {
            return 'Webhook URL resolves to a private or reserved address';
        }
    }

    return null;
}
