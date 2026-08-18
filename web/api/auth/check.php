<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/Response.php';
require_once dirname(__DIR__) . '/lib/Security.php';
require_once dirname(__DIR__) . '/lib/Auth.php';

use FlowForge\Api\Auth;
use FlowForge\Api\Response;
use FlowForge\Api\Security;

$configFile = dirname(__DIR__) . '/config.php';
if (!is_file($configFile)) {
    Response::error('API config.php missing', 500);
}

/** @var array $config */
$config = require $configFile;
Security::applyCors($config);
Security::enforceHttps($config);
Security::onlyMethods(['GET', 'POST', 'OPTIONS']);

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

$hasBearer = (bool) preg_match('/^Bearer\s+(\S+)$/i', $header, $m);
$token = $hasBearer ? $m[1] : '';

$supabaseUrl = trim((string) ($config['supabase_url'] ?? ''));
$jwtSecret = (string) ($config['supabase_jwt_secret'] ?? '');
$jwtSecretLooksLikeApiKey = substr_count($jwtSecret, '.') === 2 && str_starts_with($jwtSecret, 'eyJ');

$report = [
    'ok' => false,
    'service' => 'flowforge-api-auth-check',
    'config' => [
        'supabase_url_set' => $supabaseUrl !== '' && $supabaseUrl !== 'https://YOUR_PROJECT.supabase.co',
        'supabase_url_host' => $supabaseUrl !== '' ? (parse_url($supabaseUrl, PHP_URL_HOST) ?: null) : null,
        'jwt_secret_set' => $jwtSecret !== '' && $jwtSecret !== 'REPLACE_WITH_SUPABASE_JWT_SECRET',
        'jwt_secret_looks_like_api_key' => $jwtSecretLooksLikeApiKey,
        'openssl' => extension_loaded('openssl'),
        'curl' => function_exists('curl_init'),
    ],
    'request' => [
        'authorization_header_present' => $header !== '',
        'bearer_parsed' => $hasBearer,
    ],
];

if (!$hasBearer) {
    $report['error'] = 'Send Authorization: Bearer <supabase_user_access_token>';
    Response::json($report, 200);
}

$parts = explode('.', $token);
if (count($parts) !== 3) {
    $report['error'] = 'Token is not a JWT';
    Response::json($report, 200);
}

$headerJson = Auth::debugB64UrlDecode($parts[0]);
$payloadJson = Auth::debugB64UrlDecode($parts[1]);
$headerArr = is_string($headerJson) ? json_decode($headerJson, true) : null;
$payloadArr = is_string($payloadJson) ? json_decode($payloadJson, true) : null;

$report['token'] = [
    'alg' => is_array($headerArr) ? ($headerArr['alg'] ?? null) : null,
    'kid' => is_array($headerArr) ? ($headerArr['kid'] ?? null) : null,
    'role' => is_array($payloadArr) ? ($payloadArr['role'] ?? null) : null,
    'exp' => is_array($payloadArr) ? ($payloadArr['exp'] ?? null) : null,
    'expired' => is_array($payloadArr) && isset($payloadArr['exp'])
        ? (time() >= (int) $payloadArr['exp'])
        : null,
    'iss' => is_array($payloadArr) ? ($payloadArr['iss'] ?? null) : null,
];

$detail = Auth::diagnoseToken($token, $config);
$report['verify'] = $detail;
$report['ok'] = ($detail['ok'] ?? false) === true;

Response::json($report, 200);
