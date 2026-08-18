<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/Response.php';
require_once __DIR__ . '/lib/Auth.php';
require_once __DIR__ . '/lib/Security.php';
require_once __DIR__ . '/lib/RateLimiter.php';
require_once __DIR__ . '/lib/HttpClient.php';
require_once __DIR__ . '/lib/Mailer.php';
require_once __DIR__ . '/lib/SupabaseRest.php';
require_once __DIR__ . '/lib/PlatformMail.php';

use FlowForge\Api\Auth;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;

/**
 * @return array{config: array, user: array{sub: string, email?: string|null, role: string, claims: array}}
 */
function flowforge_bootstrap(array $methods = ['POST']): array
{
    $configFile = __DIR__ . '/config.php';
    if (!is_file($configFile)) {
        Response::error('API config.php missing. Copy config.example.php to config.php.', 500);
    }

    /** @var array $config */
    $config = require $configFile;

    Security::applyCors($config);
    Security::enforceHttps($config);
    Security::onlyMethods($methods);

    $user = Auth::requireUser($config);
    RateLimiter::hit($config, $user['sub']);

    return ['config' => $config, 'user' => $user];
}

/**
 * Health endpoint bootstrap — no auth.
 */
function flowforge_bootstrap_public(array $methods = ['GET']): array
{
    $configFile = __DIR__ . '/config.php';
    if (!is_file($configFile)) {
        Response::error('API config.php missing. Copy config.example.php to config.php.', 500);
    }

    /** @var array $config */
    $config = require $configFile;

    Security::applyCors($config);
    Security::enforceHttps($config);
    Security::onlyMethods($methods);

    return ['config' => $config];
}

/**
 * Bootstrap for endpoints that may run as an authenticated user OR as a public
 * chat session (session_id). Auth/rate-limit are applied after the body is read.
 *
 * @return array{config: array}
 */
function flowforge_bootstrap_deferred_auth(array $methods = ['POST']): array
{
    return flowforge_bootstrap_public($methods);
}

/**
 * Apply auth + rate limit after the JSON body is known.
 *
 * @param array<string, mixed> $body
 * @return array{user: ?array{sub: string, email?: string|null, role: string, claims: array}, anon: bool}
 */
function flowforge_finalize_auth(array $config, array $body): array
{
    $sessionId = trim((string) ($body['session_id'] ?? ''));
    if ($sessionId !== '') {
        RateLimiter::hit($config, 'anon:' . Security::clientIp());
        return ['user' => null, 'anon' => true];
    }

    $user = Auth::requireUser($config);
    RateLimiter::hit($config, $user['sub']);
    return ['user' => $user, 'anon' => false];
}

/** Public origin of this API, e.g. https://gkjtt.co.za/flowforge/api */
function flowforge_public_api_url(array $config): string
{
    $explicit = rtrim((string) ($config['public_api_url'] ?? ''), '/');
    if ($explicit !== '') {
        return $explicit;
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    $base = (string) preg_replace('#/payment(?:/.*)?$#', '', $path);
    $base = rtrim($base, '/');
    if ($host === '') {
        return $base;
    }
    return $scheme . '://' . $host . $base;
}
