<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Platform-level Microsoft Entra ID (Azure AD) OAuth for delegated Graph access.
 */
final class MicrosoftOAuth
{
    public const DEFAULT_SCOPES = [
        'openid',
        'profile',
        'offline_access',
        'User.Read',
        'Mail.Send',
        'Files.ReadWrite',
        'Sites.ReadWrite.All',
    ];

    /**
     * @return array{client_id: string, client_secret: string, tenant: string, redirect_uri: string, scopes: list<string>}
     */
    public static function platformConfig(array $config): array
    {
        $ms = isset($config['microsoft_oauth']) && is_array($config['microsoft_oauth'])
            ? $config['microsoft_oauth']
            : [];
        $clientId = trim((string) ($ms['client_id'] ?? $config['microsoft_client_id'] ?? ''));
        $clientSecret = trim((string) ($ms['client_secret'] ?? $config['microsoft_client_secret'] ?? ''));
        $tenant = trim((string) ($ms['tenant'] ?? $config['microsoft_tenant'] ?? 'common')) ?: 'common';
        $redirect = trim((string) ($ms['redirect_uri'] ?? $config['microsoft_redirect_uri'] ?? ''));
        if ($redirect === '') {
            $api = rtrim((string) ($config['public_api_url'] ?? ''), '/');
            if ($api !== '') {
                $redirect = $api . '/oauth/microsoft/callback';
            }
        }
        $scopes = $ms['scopes'] ?? null;
        if (!is_array($scopes) || $scopes === []) {
            $scopes = self::DEFAULT_SCOPES;
        }
        $scopes = array_values(array_filter(array_map(static fn ($s) => trim((string) $s), $scopes)));

        return [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'tenant' => $tenant,
            'redirect_uri' => $redirect,
            'scopes' => $scopes,
        ];
    }

    public static function isConfigured(array $config): bool
    {
        $c = self::platformConfig($config);

        return $c['client_id'] !== '' && $c['client_secret'] !== '' && $c['redirect_uri'] !== '';
    }

    public static function stateSecret(array $config): string
    {
        $ms = isset($config['microsoft_oauth']) && is_array($config['microsoft_oauth'])
            ? $config['microsoft_oauth']
            : [];
        $explicit = trim((string) ($ms['state_secret'] ?? $config['oauth_state_secret'] ?? ''));
        if ($explicit !== '') {
            return $explicit;
        }
        $c = self::platformConfig($config);

        return hash('sha256', $c['client_secret'] . '|flowforge-ms-oauth');
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function signState(array $config, array $payload): string
    {
        $payload['exp'] = time() + 600;
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new \RuntimeException('Failed to encode OAuth state');
        }
        $body = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
        $sig = hash_hmac('sha256', $body, self::stateSecret($config), true);
        $sigB = rtrim(strtr(base64_encode($sig), '+/', '-_'), '=');

        return $body . '.' . $sigB;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function verifyState(array $config, string $state): ?array
    {
        $parts = explode('.', $state, 2);
        if (count($parts) !== 2) {
            return null;
        }
        [$body, $sigB] = $parts;
        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, self::stateSecret($config), true)), '+/', '-_'), '=');
        if (!hash_equals($expected, $sigB)) {
            return null;
        }
        $pad = 4 - (strlen($body) % 4);
        if ($pad < 4) {
            $body .= str_repeat('=', $pad);
        }
        $raw = base64_decode(strtr($body, '-_', '+/'), true);
        if ($raw === false) {
            return null;
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return null;
        }
        $exp = (int) ($data['exp'] ?? 0);
        if ($exp < time()) {
            return null;
        }

        return $data;
    }

    public static function authorizeUrl(array $config, string $state): string
    {
        $c = self::platformConfig($config);
        $tenant = rawurlencode($c['tenant']);
        $params = [
            'client_id' => $c['client_id'],
            'response_type' => 'code',
            'redirect_uri' => $c['redirect_uri'],
            'response_mode' => 'query',
            'scope' => implode(' ', $c['scopes']),
            'state' => $state,
            'prompt' => 'select_account',
        ];

        return 'https://login.microsoftonline.com/' . $tenant . '/oauth2/v2.0/authorize?' . http_build_query($params);
    }

    /**
     * @return array{access_token: string, refresh_token: string, expires_in: int, scope: string, token_type: string}
     */
    public static function exchangeCode(array $config, string $code): array
    {
        $c = self::platformConfig($config);
        $tokenUrl = 'https://login.microsoftonline.com/' . rawurlencode($c['tenant']) . '/oauth2/v2.0/token';
        $payload = http_build_query([
            'client_id' => $c['client_id'],
            'client_secret' => $c['client_secret'],
            'code' => $code,
            'redirect_uri' => $c['redirect_uri'],
            'grant_type' => 'authorization_code',
            'scope' => implode(' ', $c['scopes']),
        ]);
        $http = HttpClient::request(
            'POST',
            $tokenUrl,
            ['Content-Type' => 'application/x-www-form-urlencoded'],
            $payload,
            25,
            1_048_576,
        );
        $data = $http['json'] ?? null;
        if (!is_array($data)) {
            $data = json_decode((string) ($http['body'] ?? ''), true);
        }
        if (!is_array($data) || empty($data['access_token'])) {
            $err = is_array($data)
                ? (string) ($data['error_description'] ?? $data['error'] ?? 'token_exchange_failed')
                : (string) ($http['error'] ?? 'token_exchange_failed');
            throw new \RuntimeException($err);
        }

        return [
            'access_token' => (string) $data['access_token'],
            'refresh_token' => (string) ($data['refresh_token'] ?? ''),
            'expires_in' => (int) ($data['expires_in'] ?? 3600),
            'scope' => (string) ($data['scope'] ?? ''),
            'token_type' => (string) ($data['token_type'] ?? 'Bearer'),
        ];
    }

    /**
     * @return array{id: string, mail: string, displayName: string, userPrincipalName: string}
     */
    public static function fetchMe(string $accessToken): array
    {
        $http = HttpClient::request(
            'GET',
            'https://graph.microsoft.com/v1.0/me',
            ['Authorization' => 'Bearer ' . $accessToken],
            null,
            15,
            65536,
        );
        $data = $http['json'] ?? null;
        if (!is_array($data)) {
            $data = json_decode((string) ($http['body'] ?? ''), true);
        }
        if (!is_array($data) || empty($data['id'])) {
            throw new \RuntimeException('Failed to load Microsoft profile (/me)');
        }

        return [
            'id' => (string) $data['id'],
            'mail' => (string) ($data['mail'] ?? $data['userPrincipalName'] ?? ''),
            'displayName' => (string) ($data['displayName'] ?? ''),
            'userPrincipalName' => (string) ($data['userPrincipalName'] ?? ''),
        ];
    }

    public static function isMicrosoftProvider(string $provider): bool
    {
        return in_array($provider, ['microsoft_onedrive', 'microsoft_teams', 'sharepoint'], true);
    }
}
