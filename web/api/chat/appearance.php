<?php
declare(strict_types=1);

/**
 * Public chatbot appearance for embed launchers (no session created).
 * CORS is open so third-party sites hosting embed.js can fetch colours/logo.
 */

require_once dirname(__DIR__) . '/lib/Response.php';
require_once dirname(__DIR__) . '/lib/Security.php';
require_once dirname(__DIR__) . '/lib/RateLimiter.php';
require_once dirname(__DIR__) . '/lib/SupabaseRest.php';
require_once dirname(__DIR__) . '/lib/InstanceFiles.php';
require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\InstanceFiles;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$configFile = dirname(__DIR__) . '/config.php';
if (!is_file($configFile)) {
    Response::error('API config.php missing. Copy config.example.php to config.php.', 500);
}
/** @var array $config */
$config = require $configFile;

// Allow any embedding origin (public branding metadata only).
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Max-Age: 600');

Security::enforceHttps($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'GET') {
    Response::error('Method not allowed', 405);
}

RateLimiter::hit($config, 'anon:' . Security::clientIp());

$slug = trim((string) ($_GET['slug'] ?? ''));
if ($slug === '') {
    Response::error('slug is required', 400);
}

$org = trim((string) ($_GET['org'] ?? ''));

$rpcArgs = ['p_slug' => $slug];
if ($org !== '') {
    $rpcArgs['p_org_slug'] = $org;
}

$result = SupabaseRest::rpcAsService($config, 'get_public_chatbot_appearance', $rpcArgs);

if (!$result['ok']) {
    $status = (int) ($result['status'] ?? 502);
    $message = (string) ($result['error'] ?? 'Could not load appearance');
    if ($status >= 400 && $status < 500) {
        Response::error($message, $status);
    }
    Response::error($message, 502);
}

$data = $result['data'] ?? null;
if (!is_array($data)) {
    Response::error('Invalid appearance response', 502);
}

$chatbotId = (string) ($data['chatbot_id'] ?? '');
$instanceId = (string) ($data['instance_id'] ?? '');
$botBranding = is_array($data['chatbot_branding'] ?? null) ? $data['chatbot_branding'] : [];
$orgBranding = is_array($data['branding'] ?? null) ? $data['branding'] : null;

$header = trim((string) ($botBranding['headerColor'] ?? ''));
$accent = trim((string) ($botBranding['accentColor'] ?? ''));
$userBubble = trim((string) ($botBranding['bubbleUserColor'] ?? ''));
$orgAccent = is_array($orgBranding) ? trim((string) ($orgBranding['accent_color'] ?? '')) : '';

if ($header === '') {
    $header = $accent !== '' ? $accent : $orgAccent;
}
if ($accent === '') {
    $accent = $header !== '' ? $header : $orgAccent;
}
if ($userBubble === '') {
    $userBubble = $accent;
}

$logoUrl = trim((string) ($botBranding['logoUrl'] ?? ''));
$logoFilename = trim((string) ($botBranding['logoFilename'] ?? ''));
$logoIcon = trim((string) ($botBranding['logoIcon'] ?? ''));
if ($logoUrl === '' && $logoFilename !== '' && $instanceId !== '' && $chatbotId !== '') {
    $apiBase = flowforge_public_api_url($config);
    $logoUrl = $apiBase . InstanceFiles::getQuery(
        InstanceFiles::KIND_MEDIA,
        $instanceId,
        $chatbotId,
        $logoFilename,
    );
}
if ($logoUrl === '' && $logoIcon === '' && is_array($orgBranding)) {
    $logoUrl = trim((string) ($orgBranding['logo_url'] ?? ''));
}
if ($logoUrl !== '') {
    $logoIcon = '';
}

Response::json([
    'ok' => true,
    'name' => (string) ($data['name'] ?? 'Chat'),
    'chatbot_id' => $chatbotId,
    'instance_id' => $instanceId,
    'header_color' => $header !== '' ? $header : null,
    'accent_color' => $accent !== '' ? $accent : null,
    'bubble_user_color' => $userBubble !== '' ? $userBubble : null,
    'logo_url' => $logoUrl !== '' ? $logoUrl : null,
    'logo_icon' => $logoIcon !== '' ? $logoIcon : null,
    'chatbot_branding' => $botBranding,
    'branding' => $orgBranding,
]);
