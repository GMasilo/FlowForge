<?php
declare(strict_types=1);

namespace FlowForge\Api;

final class WebhookDelivery
{
    public static function context(string $event, array $envelope): array
    {
        $session = (array) ($envelope['session'] ?? []);
        $payload = (array) ($envelope['payload'] ?? []);
        $variables = is_array($session['variables'] ?? null) ? $session['variables'] : [];
        return array_merge($variables, $envelope, [
            'event' => $event, 'variables' => $variables,
            'chatbot_id' => $session['chatbot_id'] ?? $payload['chatbot_id'] ?? null,
        ]);
    }

    private static function lookup(string $path, array $context): mixed
    {
        if (array_key_exists($path, $context)) return $context[$path];
        $value = $context;
        foreach (explode('.', $path) as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                throw new \InvalidArgumentException('Missing template variable: ' . $path);
            }
            $value = $value[$key];
        }
        return $value;
    }

    private static function text(mixed $value): string
    {
        return is_string($value) ? $value : json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }

    public static function render(mixed $value, array $context, bool $preserveType = true): mixed
    {
        if (is_object($value)) {
            $out = new \stdClass();
            foreach (get_object_vars($value) as $key => $item) $out->$key = self::render($item, $context);
            return $out;
        }
        if (is_array($value)) return array_map(fn($item) => self::render($item, $context), $value);
        if (!is_string($value)) return $value;
        if ($preserveType && preg_match('/^\{\{\s*([\w.-]+)\s*\}\}$/', $value, $m)) return self::lookup($m[1], $context);
        return preg_replace_callback('/\{\{\s*([\w.-]+)\s*\}\}/', fn($m) => self::text(self::lookup($m[1], $context)), $value);
    }

    public static function build(array $hook, string $event, array $envelope): array
    {
        $destination = $hook['destination'] ?? 'custom';
        $cfg = $hook['destination_config'] ?? [];
        if (!is_array($cfg)) throw new \InvalidArgumentException('Invalid destination settings.');
        $context = self::context($event, $envelope);
        $headers = ['Content-Type' => 'application/json', 'X-FlowForge-Event' => $event];
        $body = $envelope;
        $method = 'POST';
        if ($destination === 'slack') {
            $url = parse_url((string) ($hook['url'] ?? ''));
            $botMode = ($cfg['slackMode'] ?? 'webhook') === 'bot';
            if (!$botMode && (($url['scheme'] ?? '') !== 'https' || !in_array($url['host'] ?? '', ['hooks.slack.com', 'hooks.slack-gov.com'], true)
                || !str_starts_with($url['path'] ?? '', '/services/') || isset($url['user']) || isset($url['pass']))) {
                throw new \InvalidArgumentException('Use a Slack incoming webhook URL.');
            }
            $message = self::render($cfg['message'] ?? 'FlowForge: {{event}}', $context, false);
            if (!is_string($message) || trim($message) === '') throw new \InvalidArgumentException('Slack message is required.');
            $body = ['text' => $message];
            if ($botMode) {
                if (($hook['url'] ?? '') !== 'https://slack.com/api/chat.postMessage') throw new \InvalidArgumentException('Invalid Slack API endpoint.');
                $token = trim((string) ($cfg['token'] ?? ''));
                $channel = trim((string) ($cfg['channel'] ?? ''));
                if ($token === '' || preg_match('/\s/', $token)) throw new \InvalidArgumentException('Enter a Slack token without the Bearer prefix.');
                if ($channel === '') throw new \InvalidArgumentException('Slack channel ID is required.');
                $headers['Authorization'] = 'Bearer ' . $token;
                $body['channel'] = $channel;
            }
        } elseif (in_array($destination, ['custom', 'jira'], true)) {
            if (trim((string) ($cfg['bodyTemplate'] ?? '')) !== '') {
                $template = json_decode($cfg['bodyTemplate'], false, 64, JSON_THROW_ON_ERROR);
                if (!is_object($template)) throw new \InvalidArgumentException('Body template must be a JSON object.');
                $body = self::render($template, $context);
            }
            if ($destination === 'jira') {
                $token = (string) ($cfg['token'] ?? '');
                if (trim($token) === '' || preg_match('/[\r\n]/', $token)) throw new \InvalidArgumentException('A valid Jira token is required.');
                    $email = trim((string) ($cfg['email'] ?? ''));
                    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || str_contains($email, ':')) throw new \InvalidArgumentException('Jira REST API requires an Atlassian email and API token. Edit this destination and save the account email before testing.');
                    $parts = parse_url((string) $hook['url']);
                    $host = $parts['host'] ?? '';
                    $path = $parts['path'] ?? '';
                    if ($host === 'api.atlassian.com') $path = preg_replace('#^/ex/jira/[a-zA-Z0-9-]+#', '', $path);
                    $update = ($cfg['jiraAction'] ?? 'create') === 'update';
                    if (!(str_ends_with($host, '.atlassian.net') || ($host === 'api.atlassian.com' && $path !== ($parts['path'] ?? '')))
                        || isset($parts['user']) || isset($parts['pass']) || isset($parts['port']) || isset($parts['query']) || isset($parts['fragment'])
                        || !preg_match($update ? '#^/rest/api/3/issue/[A-Za-z0-9_-]+$#' : '#^/rest/api/3/issue$#', $path)) throw new \InvalidArgumentException('Invalid Jira Cloud issue endpoint for this action.');
                    if (empty($cfg['bodyTemplate']) || !is_object($body) || (!isset($body->fields) && !isset($body->update))) throw new \InvalidArgumentException('Jira API body must contain fields or update.');
                    $headers['Authorization'] = 'Basic ' . base64_encode($email . ':' . trim($token));
                    $headers['Accept'] = 'application/json';
                    $method = $update ? 'PUT' : 'POST';
            } else {
                if (isset($cfg['headers']) && !is_array($cfg['headers'])) throw new \InvalidArgumentException('Custom headers must be an object.');
                $seen = [];
                foreach (($cfg['headers'] ?? []) as $name => $value) {
                    if (isset($seen[strtolower((string) $name)]) || !preg_match('/^[A-Za-z0-9-]+$/', (string) $name) || !is_string($value) || preg_match('/[\r\n]/', $value)
                        || in_array(strtolower((string) $name), ['host', 'content-length', 'content-type', 'connection', 'transfer-encoding', 'x-flowforge-signature', 'x-flowforge-event'], true)) {
                        throw new \InvalidArgumentException('Invalid or reserved custom header.');
                    }
                    $seen[strtolower((string) $name)] = true;
                    $headers[$name] = $value;
                }
            }
        } else {
            throw new \InvalidArgumentException('Unknown webhook destination.');
        }
        if (($destination === 'jira' || !empty($cfg['headers'])) && parse_url((string) $hook['url'], PHP_URL_SCHEME) !== 'https') {
            throw new \InvalidArgumentException('Use HTTPS for authenticated webhooks.');
        }
        $json = json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers['X-FlowForge-Signature'] = 'sha256=' . hash_hmac('sha256', $json, (string) ($hook['secret'] ?? ''));
        return ['body' => $json, 'headers' => $headers, 'method' => $method];
    }

    public static function send(array $config, array $hook, string $event, array $envelope, bool $diagnostics = false): array
    {
        $started = microtime(true);
        $request = null;
        $response = null;
        $detail = null;
        try {
            $request = self::build($hook, $event, $envelope);
            $urlError = self::urlError((string) $hook['url']);
            if ($urlError !== null) throw new \InvalidArgumentException($urlError);
            $response = HttpClient::request($request['method'], $hook['url'], $request['headers'], $request['body'], 15, 65536);
            $status = (int) ($response['status'] ?? 0);
            $ok = $status >= 200 && $status < 300 && !empty($response['ok']);
            $slackRejected = $ok && self::slackRejected($hook, $response);
            if ($slackRejected) $ok = false;
            // Never log destination responses: they may echo credentials or submitted data.
            $error = $ok ? null : ($status > 0 ? 'Destination returned HTTP ' . $status : 'Could not reach destination');
            if ($slackRejected) $error = 'Slack rejected the message. Check the bot token, chat:write permission and channel access.';
        } catch (\Throwable $e) {
            $detail = $e->getMessage();
            $ok = false;
            $status = null;
            $error = $e instanceof \InvalidArgumentException ? $e->getMessage() : 'Invalid webhook configuration or JSON template';
        }
        $log = SupabaseRest::rpcAsService($config, 'record_webhook_delivery', [
            'p_webhook_id' => $hook['id'], 'p_event' => $event, 'p_payload' => $envelope,
            'p_status_code' => $status, 'p_ok' => $ok, 'p_error' => $error,
        ]);
        $result = ['webhook_id' => $hook['id'], 'ok' => $ok, 'status_code' => $status, 'error' => $error,
            'logged' => (bool) ($log['ok'] ?? false)];
        if ($diagnostics) {
            $result['diagnostics'] = self::redact([
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'request' => ['method' => $request['method'] ?? null, 'url' => $hook['url'], 'headers' => $request['headers'] ?? [], 'body' => $request['body'] ?? null],
                'response' => $response === null ? null : ['status' => $status, 'headers' => $response['headers'] ?? [],
                    'body' => $response['raw_body'] ?? $response['body'] ?? null,
                    'error' => $response['error'] ?? null, 'detail' => $response['detail'] ?? null,
                    'possibly_truncated' => strlen((string) ($response['raw_body'] ?? '')) >= 65536],
                'error' => $detail ?? $error,
                'logging_error' => $log['ok'] ? null : ($log['error'] ?? 'Could not save delivery history'),
            ], $hook);
        }
        return $result;
    }

    public static function slackRejected(array $hook, array $response): bool
    {
        return ($hook['destination'] ?? '') === 'slack'
            && ($hook['destination_config']['slackMode'] ?? '') === 'bot'
            && (!is_array($response['body'] ?? null) || ($response['body']['ok'] ?? false) !== true);
    }

    public static function redact(mixed $value, array $hook): mixed
    {
        $cfg = $hook['destination_config'] ?? [];
        $secrets = array_filter(array_merge([(string) ($hook['secret'] ?? ''), (string) ($cfg['token'] ?? '')], array_values($cfg['headers'] ?? [])), fn($v) => is_string($v) && $v !== '');
        foreach ($secrets as $secret) {
            if (preg_match('/^(?:Basic|Bearer) (.+)$/i', $secret, $match)) $secrets[] = $match[1];
        }
        if (!empty($cfg['email']) && !empty($cfg['token'])) $secrets[] = base64_encode(trim($cfg['email']) . ':' . trim($cfg['token']));
        $url = (string) ($hook['url'] ?? '');
        // Webhook URLs can contain credentials in the path or query.
        if ($url !== '') $secrets[] = $url;
        if (is_array($value)) {
            $out = [];
            foreach ($value as $key => $item) {
                if (strtolower((string) $key) === 'authorization' && is_string($item) && preg_match('/^(Basic|Bearer) /i', $item, $authMatch)) {
                    $out[$key] = $authMatch[1] . ' [REDACTED]';
                    continue;
                }
                $out[$key] = preg_match('/authorization|cookie|token|secret|signature|api[-_]?key/i', (string) $key)
                    ? '[REDACTED]' : self::redact($item, $hook);
            }
            return $out;
        }
        if (!is_string($value)) return $value;
        $decoded = json_decode($value, true);
        if (is_array($decoded)) return json_encode(self::redact($decoded, $hook), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        foreach ($secrets as $secret) {
            $variants = [$secret, rawurlencode($secret), substr(json_encode($secret), 1, -1)];
            $value = str_replace($variants, '[REDACTED]', $value);
        }
        return $value;
    }

    public static function urlError(string $url): ?string
    {
        $parts = parse_url($url);
        if (!$parts || empty($parts['host']) || !in_array($parts['scheme'] ?? '', ['https', 'http'], true)
            || isset($parts['user']) || isset($parts['pass'])) return 'Invalid webhook URL';
        $host = strtolower(trim($parts['host'], '[]'));
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) return 'Webhook host is not allowed';
        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) $ips[] = $host;
        else foreach ((@dns_get_record($host, DNS_A + DNS_AAAA) ?: []) as $record) {
            if (isset($record['ip'])) $ips[] = $record['ip'];
            if (isset($record['ipv6'])) $ips[] = $record['ipv6'];
        }
        if (!$ips) return 'Unable to resolve webhook host';
        foreach ($ips as $ip) if (Security::isPrivateOrReservedIp($ip)) return 'Webhook URL resolves to a private or reserved address';
        return null;
    }
}
