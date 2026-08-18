<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Minimal PostgREST helper using the caller's JWT or the service role key.
 */
final class SupabaseRest
{
    /**
     * @param array<string, mixed> $args
     * @return array{ok: bool, status: int, data?: mixed, error?: string}
     */
    public static function rpc(array $config, string $userJwt, string $fn, array $args = []): array
    {
        return self::rpcWithBearer($config, $userJwt, $fn, $args);
    }

    /**
     * Alias of rpc() — explicit user-JWT path.
     *
     * @param array<string, mixed> $args
     * @return array{ok: bool, status: int, data?: mixed, error?: string}
     */
    public static function rpcAsUser(array $config, string $userJwt, string $fn, array $args = []): array
    {
        return self::rpc($config, $userJwt, $fn, $args);
    }

    /**
     * Call an RPC with the configured service_role key.
     *
     * @param array<string, mixed> $args
     * @return array{ok: bool, status: int, data?: mixed, error?: string}
     */
    public static function rpcAsService(array $config, string $fn, array $args = []): array
    {
        $serviceKey = (string) ($config['supabase_service_role_key'] ?? '');
        if ($serviceKey === '' || $serviceKey === 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY') {
            return [
                'ok' => false,
                'status' => 500,
                'error' => 'supabase_service_role_key missing in config.php',
            ];
        }

        return self::rpcWithBearer($config, $serviceKey, $fn, $args);
    }

    /**
     * Insert a row via PostgREST using the caller's JWT.
     *
     * @param array<string, mixed> $row
     * @return array{ok: bool, status: int, data?: mixed, error?: string}
     */
    public static function restInsert(array $config, string $userJwt, string $table, array $row): array
    {
        $base = rtrim((string) ($config['supabase_url'] ?? ''), '/');
        $anon = (string) ($config['supabase_anon_key'] ?? '');
        if ($base === '' || $anon === '' || $anon === 'REPLACE_WITH_SUPABASE_ANON_KEY') {
            return [
                'ok' => false,
                'status' => 500,
                'error' => 'supabase_url / supabase_anon_key missing in config.php',
            ];
        }

        if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $table)) {
            return ['ok' => false, 'status' => 500, 'error' => 'Invalid table name'];
        }

        $url = $base . '/rest/v1/' . rawurlencode($table);
        $ch = curl_init($url);
        if ($ch === false) {
            return ['ok' => false, 'status' => 500, 'error' => 'curl_init failed'];
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Prefer: return=representation',
                'apikey: ' . $anon,
                'Authorization: Bearer ' . $userJwt,
            ],
            CURLOPT_POSTFIELDS => json_encode($row, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cerr = curl_error($ch);
        curl_close($ch);

        if (!is_string($raw)) {
            return ['ok' => false, 'status' => 502, 'error' => $cerr !== '' ? $cerr : 'Empty Supabase response'];
        }

        $data = json_decode($raw, true);
        if ($status >= 200 && $status < 300) {
            return ['ok' => true, 'status' => $status, 'data' => $data];
        }

        $msg = is_array($data) ? (string) ($data['message'] ?? $data['error'] ?? $raw) : $raw;
        return ['ok' => false, 'status' => $status, 'error' => $msg !== '' ? $msg : 'Supabase insert failed'];
    }

    /**
     * Resolve connection secrets for execute/send.
     *
     * Preferred: connection_id + chatbot_id (+ optional session_id for public chat).
     * Legacy: full connection object in the body.
     *
     * @param array<string, mixed> $body
     * @return array{connection: array<string, mixed>, instance_id: ?string, used_service_role: bool}
     */
    public static function resolveConnection(array $config, array $body): array
    {
        $connectionId = trim((string) ($body['connection_id'] ?? ''));
        $chatbotId = trim((string) ($body['chatbot_id'] ?? ''));
        $sessionId = trim((string) ($body['session_id'] ?? ''));
        $instanceId = trim((string) ($body['instance_id'] ?? ''));
        $legacyConnection = $body['connection'] ?? null;
        $hasLegacy = is_array($legacyConnection);

        if ($connectionId !== '') {
            if (!self::isUuid($connectionId)) {
                Response::error('Invalid connection_id', 400);
            }
            if ($chatbotId === '' || !self::isUuid($chatbotId)) {
                Response::error('chatbot_id is required with connection_id', 400);
            }
            if ($instanceId !== '' && !self::isUuid($instanceId)) {
                Response::error('Invalid instance_id', 400);
            }
            if ($sessionId !== '' && !self::isUuid($sessionId)) {
                Response::error('Invalid session_id', 400);
            }

            if ($sessionId !== '') {
                // Public chat: secrets must come from the server — never trust body-carried config.
                $rpc = self::rpcAsService($config, 'connection_config_for_public_chat', [
                    'p_connection_id' => $connectionId,
                    'p_chatbot_id' => $chatbotId,
                    'p_session_id' => $sessionId,
                ]);
                if (!$rpc['ok']) {
                    Response::json([
                        'ok' => false,
                        'error' => $rpc['error'] ?? 'Could not load connection config',
                    ], $rpc['status'] >= 400 ? $rpc['status'] : 502);
                }
                if ($rpc['data'] === null || !is_array($rpc['data'])) {
                    Response::error('Connection not found or not permitted', 403);
                }
                return [
                    'connection' => $rpc['data'],
                    'instance_id' => $instanceId !== '' ? $instanceId : null,
                    'used_service_role' => true,
                ];
            }

            $jwt = self::bearerFromRequest();
            $rpc = self::rpcAsUser($config, $jwt, 'connection_config_for_use', [
                'p_connection_id' => $connectionId,
                'p_chatbot_id' => $chatbotId,
            ]);

            if ($rpc['ok'] && is_array($rpc['data'])) {
                return [
                    'connection' => $rpc['data'],
                    'instance_id' => $instanceId !== '' ? $instanceId : null,
                    'used_service_role' => false,
                ];
            }

            // Authenticated preview fallback: use client-provided config when RPC denies/empty.
            if ($hasLegacy) {
                return [
                    'connection' => $legacyConnection,
                    'instance_id' => $instanceId !== '' ? $instanceId : null,
                    'used_service_role' => false,
                ];
            }

            if (!$rpc['ok']) {
                Response::json([
                    'ok' => false,
                    'error' => $rpc['error'] ?? 'Could not load connection config',
                ], $rpc['status'] >= 400 ? $rpc['status'] : 502);
            }
            Response::error('Connection not found or not permitted', 403);
        }

        if (!$hasLegacy) {
            Response::error('Missing connection_id or connection config', 400);
        }

        return [
            'connection' => $legacyConnection,
            'instance_id' => ($instanceId !== '' && self::isUuid($instanceId)) ? $instanceId : null,
            'used_service_role' => false,
        ];
    }

    /**
     * Host allowlist for outbound HTTP: org list if non-empty, else global config list.
     *
     * @return list<string>
     */
    public static function resolveHttpHostAllowlist(array $config, ?string $instanceId, ?string $userJwt = null): array
    {
        $global = $config['http_host_allowlist'] ?? [];
        if (!is_array($global)) {
            $global = [];
        }
        $global = array_values(array_filter(array_map('strval', $global), static fn ($h) => $h !== ''));

        if ($instanceId === null || $instanceId === '') {
            return $global;
        }

        if ($userJwt !== null && $userJwt !== '') {
            $rpc = self::rpcAsUser($config, $userJwt, 'instance_http_allowlist', [
                'p_instance_id' => $instanceId,
            ]);
        } else {
            $rpc = self::rpcAsService($config, 'instance_http_allowlist', [
                'p_instance_id' => $instanceId,
            ]);
        }

        if ($rpc['ok']) {
            $org = $rpc['data'] ?? [];
            if (is_array($org)) {
                $org = array_values(array_filter(array_map('strval', $org), static fn ($h) => $h !== ''));
                if ($org !== []) {
                    return $org;
                }
            }
        }

        return $global;
    }

    /**
     * Increment usage counters; returns 429 when the RPC reports a quota error.
     *
     * @param array<string, mixed> $args keys: p_instance_id, p_conversations?, p_emails?, p_http_calls?
     */
    public static function incrementInstanceUsage(
        array $config,
        string $instanceId,
        array $counters,
        bool $useServiceRole,
        ?string $userJwt = null,
    ): void {
        if ($instanceId === '' || !self::isUuid($instanceId)) {
            return;
        }

        $args = array_merge([
            'p_instance_id' => $instanceId,
            'p_conversations' => 0,
            'p_emails' => 0,
            'p_http_calls' => 0,
        ], $counters);

        if ($useServiceRole) {
            $rpc = self::rpcAsService($config, 'increment_instance_usage', $args);
        } else {
            $jwt = $userJwt ?? self::bearerFromRequest();
            $rpc = self::rpcAsUser($config, $jwt, 'increment_instance_usage', $args);
        }

        if ($rpc['ok']) {
            return;
        }

        $msg = (string) ($rpc['error'] ?? 'Usage increment failed');
        if (stripos($msg, 'quota') !== false) {
            Response::error($msg, 429);
        }
        // Non-quota failures should not fail the primary operation.
    }

    /**
     * Confirm the chatbot belongs to the instance and the JWT user may access it.
     */
    public static function requireChatbotAccess(
        array $config,
        string $userJwt,
        string $instanceId,
        string $chatbotId,
        bool $write,
    ): void {
        if (!self::isUuid($instanceId) || !self::isUuid($chatbotId)) {
            Response::error('Invalid instance_id or chatbot_id', 400);
        }

        $owner = self::rpcAsUser($config, $userJwt, 'chatbot_instance_id', [
            'p_chatbot_id' => $chatbotId,
        ]);
        $ownerId = is_string($owner['data'] ?? null) ? (string) $owner['data'] : '';
        if (!$owner['ok'] || $ownerId === '' || strcasecmp($ownerId, $instanceId) !== 0) {
            Response::error('Chatbot not found or not permitted', 403);
        }

        if ($write) {
            $rpc = self::rpcAsUser($config, $userJwt, 'has_instance_role', [
                'p_instance_id' => $instanceId,
                'p_roles' => ['owner', 'admin', 'editor'],
            ]);
        } else {
            $rpc = self::rpcAsUser($config, $userJwt, 'is_instance_member', [
                'p_instance_id' => $instanceId,
            ]);
        }

        if (!$rpc['ok'] || $rpc['data'] !== true) {
            Response::error('Chatbot not found or not permitted', 403);
        }
    }

    /**
     * @return array{id: string, instance_id: string, chatbot_id: string, status: string}
     */
    public static function requireConversationSession(array $config, string $sessionId): array
    {
        if (!self::isUuid($sessionId)) {
            Response::error('Invalid session_id', 400);
        }

        $rpc = self::rpcAsService($config, 'get_conversation_session_for_webhook', [
            'p_session_id' => $sessionId,
        ]);
        if (!$rpc['ok'] || !is_array($rpc['data'] ?? null) || ($rpc['data'] ?? null) === null) {
            Response::error($rpc['error'] ?? 'Session not found', 404);
        }

        $session = $rpc['data'];
        $id = (string) ($session['id'] ?? '');
        $instanceId = (string) ($session['instance_id'] ?? '');
        $chatbotId = (string) ($session['chatbot_id'] ?? '');
        $status = (string) ($session['status'] ?? '');
        if ($id === '' || $instanceId === '' || $chatbotId === '') {
            Response::error('Session not found', 404);
        }

        return [
            'id' => $id,
            'instance_id' => $instanceId,
            'chatbot_id' => $chatbotId,
            'status' => $status,
        ];
    }

    public static function isUuid(string $value): bool
    {
        return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
    }

    public static function bearerFromRequest(): string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? '';

        if ($header === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                if (strcasecmp((string) $name, 'Authorization') === 0) {
                    $header = (string) $value;
                    break;
                }
            }
        }

        if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            Response::error('Missing or invalid Authorization bearer token', 401);
        }

        return $m[1];
    }

    /**
     * @param array<string, mixed> $args
     * @return array{ok: bool, status: int, data?: mixed, error?: string}
     */
    private static function rpcWithBearer(array $config, string $bearer, string $fn, array $args = []): array
    {
        $base = rtrim((string) ($config['supabase_url'] ?? ''), '/');
        $anon = (string) ($config['supabase_anon_key'] ?? '');
        if ($base === '' || $anon === '' || $anon === 'REPLACE_WITH_SUPABASE_ANON_KEY') {
            return [
                'ok' => false,
                'status' => 500,
                'error' => 'supabase_url / supabase_anon_key missing in config.php',
            ];
        }

        if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $fn)) {
            return ['ok' => false, 'status' => 500, 'error' => 'Invalid RPC name'];
        }

        $url = $base . '/rest/v1/rpc/' . rawurlencode($fn);
        $ch = curl_init($url);
        if ($ch === false) {
            return ['ok' => false, 'status' => 500, 'error' => 'curl_init failed'];
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'apikey: ' . $anon,
                'Authorization: Bearer ' . $bearer,
            ],
            CURLOPT_POSTFIELDS => json_encode($args, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $cerr = curl_error($ch);
        curl_close($ch);

        if (!is_string($raw)) {
            return ['ok' => false, 'status' => 502, 'error' => $cerr !== '' ? $cerr : 'Empty Supabase response'];
        }

        $data = json_decode($raw, true);
        if ($status >= 200 && $status < 300) {
            return ['ok' => true, 'status' => $status, 'data' => $data];
        }

        $msg = is_array($data) ? (string) ($data['message'] ?? $data['error'] ?? $raw) : $raw;
        return ['ok' => false, 'status' => $status, 'error' => $msg !== '' ? $msg : 'Supabase RPC failed'];
    }
}
