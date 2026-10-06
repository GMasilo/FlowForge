<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/lib/MicrosoftOAuth.php';

use FlowForge\Api\MicrosoftOAuth;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$configFile = dirname(__DIR__, 2) . '/config.php';
if (!is_file($configFile)) {
    oauth_redirect_error(null, 'API config.php missing');
}
/** @var array $config */
$config = require $configFile;

Security::enforceHttps($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method !== 'GET') {
    oauth_redirect_error(null, 'Method not allowed');
}

$error = trim((string) ($_GET['error'] ?? ''));
$errorDesc = trim((string) ($_GET['error_description'] ?? ''));
$code = trim((string) ($_GET['code'] ?? ''));
$stateRaw = trim((string) ($_GET['state'] ?? ''));

$state = $stateRaw !== '' ? MicrosoftOAuth::verifyState($config, $stateRaw) : null;
$returnTo = is_array($state) ? (string) ($state['return_to'] ?? '') : '';

if ($error !== '') {
    oauth_redirect_error($returnTo, $errorDesc !== '' ? $errorDesc : $error);
}
if ($state === null) {
    oauth_redirect_error($returnTo, 'Invalid or expired OAuth state. Start Connect Microsoft again.');
}
if ($code === '') {
    oauth_redirect_error($returnTo, 'Missing authorization code');
}

$integrationId = (string) ($state['integration_id'] ?? '');
$instanceId = (string) ($state['instance_id'] ?? '');
if ($integrationId === '' || $instanceId === '' || !SupabaseRest::isUuid($integrationId)) {
    oauth_redirect_error($returnTo, 'Invalid OAuth state payload');
}

try {
    $tokens = MicrosoftOAuth::exchangeCode($config, $code);
    if ($tokens['refresh_token'] === '') {
        throw new RuntimeException(
            'Microsoft did not return a refresh token. Ensure offline_access is in scopes and the user consents.',
        );
    }
    $me = MicrosoftOAuth::fetchMe($tokens['access_token']);
} catch (Throwable $e) {
    oauth_redirect_error($returnTo, $e->getMessage());
}

$rows = SupabaseRest::restSelectAsService(
    $config,
    'integrations',
    'id=eq.' . rawurlencode($integrationId)
        . '&instance_id=eq.' . rawurlencode($instanceId)
        . '&deleted_at=is.null&select=id,config,provider',
);
if ($rows === [] || !isset($rows[0])) {
    oauth_redirect_error($returnTo, 'Integration not found');
}
$row = $rows[0];
$cfg = isset($row['config']) && is_array($row['config']) ? $row['config'] : [];
$cfg['auth_mode'] = 'oauth_delegated';
$cfg['ms_user_id'] = $me['id'];
$cfg['ms_email'] = $me['mail'];
$cfg['ms_display_name'] = $me['displayName'];
$cfg['ms_upn'] = $me['userPrincipalName'];
$cfg['granted_scopes'] = $tokens['scope'];
$cfg['connected_at'] = gmdate('c');
// Platform app — clear per-integration client fields so runtime uses config.php
$cfg['client_id'] = '';
$cfg['tenant_id'] = '';

$displayName = $me['displayName'] !== '' ? $me['displayName'] : $me['mail'];
$nameSuffix = $displayName !== '' ? ' (' . $displayName . ')' : '';

SupabaseRest::restPatchAsService(
    $config,
    'integrations',
    'id=eq.' . rawurlencode($integrationId),
    [
        'config' => $cfg,
        'status' => 'connected',
        'name' => trim((string) (($row['provider'] ?? 'Microsoft') . $nameSuffix)),
        'updated_at' => gmdate('c'),
    ],
);

$expiresAt = gmdate('c', time() + max(60, $tokens['expires_in'] - 60));
$secrets = [
    'refresh_token' => $tokens['refresh_token'],
    'access_token' => $tokens['access_token'],
    'access_token_expires_at' => $expiresAt,
    // client_secret left empty — platform credentials used at runtime
    'client_secret' => '',
];

SupabaseRest::restInsertAsService($config, 'integration_secrets', [
    'integration_id' => $integrationId,
    'secrets' => $secrets,
    'updated_at' => gmdate('c'),
]);
// Upsert: if insert fails on PK, patch
$existing = SupabaseRest::restSelectAsService(
    $config,
    'integration_secrets',
    'integration_id=eq.' . rawurlencode($integrationId) . '&select=integration_id',
);
if ($existing !== []) {
    SupabaseRest::restPatchAsService(
        $config,
        'integration_secrets',
        'integration_id=eq.' . rawurlencode($integrationId),
        ['secrets' => $secrets, 'updated_at' => gmdate('c')],
    );
}

oauth_redirect_ok($returnTo);

function oauth_app_base(?string $returnTo): string
{
    if (is_string($returnTo) && $returnTo !== '' && preg_match('#^https?://#i', $returnTo)) {
        return $returnTo;
    }
    global $config;
    $app = rtrim((string) (($config['app_url'] ?? '')), '/');
    if ($app !== '') {
        return $app . '/integrations';
    }

    return '/integrations';
}

function oauth_redirect_ok(?string $returnTo): void
{
    $url = oauth_app_base($returnTo);
    $sep = str_contains($url, '?') ? '&' : '?';
    header('Location: ' . $url . $sep . 'microsoft=connected', true, 302);
    exit;
}

function oauth_redirect_error(?string $returnTo, string $message): void
{
    $url = oauth_app_base($returnTo);
    $sep = str_contains($url, '?') ? '&' : '?';
    header(
        'Location: ' . $url . $sep . 'microsoft=error&message=' . rawurlencode(mb_substr($message, 0, 300)),
        true,
        302,
    );
    exit;
}
