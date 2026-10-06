<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/lib/MicrosoftOAuth.php';

use FlowForge\Api\Auth;
use FlowForge\Api\MicrosoftOAuth;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$configFile = dirname(__DIR__, 2) . '/config.php';
if (!is_file($configFile)) {
    Response::error('API config.php missing', 500);
}
/** @var array $config */
$config = require $configFile;

Security::applyCors($config);
Security::enforceHttps($config);
Security::onlyMethods(['GET']);

if (!MicrosoftOAuth::isConfigured($config)) {
    Response::error(
        'Microsoft OAuth is not configured. Set microsoft_oauth.client_id, client_secret, and redirect_uri (or public_api_url) in config.php.',
        503,
    );
}

// Browser redirects cannot send Authorization; accept access_token query as well as Bearer.
$header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($header === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        if (strcasecmp((string) $name, 'Authorization') === 0) {
            $header = (string) $value;
            break;
        }
    }
}
$queryToken = trim((string) ($_GET['access_token'] ?? ''));
if ($header === '' && $queryToken !== '') {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $queryToken;
}

$user = Auth::requireUser($config);

$integrationId = trim((string) ($_GET['integration_id'] ?? ''));
$instanceId = trim((string) ($_GET['instance_id'] ?? ''));
$returnTo = trim((string) ($_GET['return_to'] ?? ''));

if ($integrationId === '' || $instanceId === '') {
    Response::error('integration_id and instance_id are required', 400);
}
if (!SupabaseRest::isUuid($integrationId) || !SupabaseRest::isUuid($instanceId)) {
    Response::error('Invalid ids', 400);
}

$rows = SupabaseRest::restSelectAsService(
    $config,
    'integrations',
    'id=eq.' . rawurlencode($integrationId)
        . '&instance_id=eq.' . rawurlencode($instanceId)
        . '&deleted_at=is.null&select=id,instance_id,provider,name,status,config',
);
if ($rows === [] || !isset($rows[0])) {
    Response::error('Integration not found', 404);
}
$row = $rows[0];
$provider = (string) ($row['provider'] ?? '');
if (!MicrosoftOAuth::isMicrosoftProvider($provider)) {
    Response::error('OAuth connect is only available for Microsoft OneDrive, Teams, or SharePoint integrations', 400);
}

// Ensure the signed-in user can administer this organisation (member check).
$member = SupabaseRest::restSelectAsService(
    $config,
    'instance_members',
    'instance_id=eq.' . rawurlencode($instanceId)
        . '&user_id=eq.' . rawurlencode($user['sub'])
        . '&select=role',
);
if ($member === []) {
    Response::error('You are not a member of this organisation', 403);
}

$appUrl = rtrim((string) ($config['app_url'] ?? ''), '/');
if ($returnTo === '' && $appUrl !== '') {
    $returnTo = $appUrl . '/integrations';
}
if ($returnTo === '') {
    $returnTo = '/integrations';
}

try {
    $state = MicrosoftOAuth::signState($config, [
        'integration_id' => $integrationId,
        'instance_id' => $instanceId,
        'user_id' => $user['sub'],
        'provider' => $provider,
        'return_to' => $returnTo,
        'nonce' => bin2hex(random_bytes(8)),
    ]);
} catch (Throwable $e) {
    Response::error('Failed to create OAuth state', 500);
}

$url = MicrosoftOAuth::authorizeUrl($config, $state);
header('Location: ' . $url, true, 302);
exit;
