<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/UrlPreview.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\UrlPreview;

$boot = flowforge_bootstrap(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody(4096);

$url = trim((string) ($body['url'] ?? ''));
if ($url === '') {
    Response::error('url is required', 400);
}

// Normalize scheme-relative / bare hosts a little for validation
if (!preg_match('#^https?://#i', $url)) {
    $url = 'https://' . ltrim($url, '/');
}

$safeUrl = Security::assertSafePublicUrl($url, $config['http_host_allowlist'] ?? []);

$timeout = (int) ($config['http_timeout_seconds'] ?? 12);
$timeout = max(3, min(20, $timeout));
$maxBytes = (int) ($config['http_max_response_bytes'] ?? 524_288);
$maxBytes = max(64_000, min($maxBytes, 1_048_576));

$result = UrlPreview::fetch($safeUrl, $timeout, $maxBytes);

Response::json([
    'ok' => $result['ok'],
    'url' => $result['url'],
    'title' => $result['title'],
    'description' => $result['description'],
    'site_name' => $result['site_name'],
    'icon' => $result['icon'] ?? null,
    'error' => $result['error'] ?? null,
], $result['ok'] ? 200 : 502);
