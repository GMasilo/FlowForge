<?php
declare(strict_types=1);

/**
 * Optional front controller if rewrite rules point everything here.
 * Prefer direct /http/execute.php, /email/send.php, /url/preview.php, and /file/upload.php on shared hosting.
 */
require_once __DIR__ . '/lib/Response.php';

use FlowForge\Api\Response;

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^.*?/api#', '', $path) ?: '/';
$path = '/' . trim((string) $path, '/');

$map = [
    '/health' => __DIR__ . '/health.php',
    '/http/execute' => __DIR__ . '/http/execute.php',
    '/integration/execute' => __DIR__ . '/integration/execute.php',
    '/email/send' => __DIR__ . '/email/send.php',
    '/email/test' => __DIR__ . '/email/test.php',
    '/email/invite' => __DIR__ . '/email/invite.php',
    '/email/invite-member' => __DIR__ . '/email/invite-member.php',
    '/email/invite-resend' => __DIR__ . '/email/invite-resend.php',
    '/auth/check' => __DIR__ . '/auth/check.php',
    '/url/preview' => __DIR__ . '/url/preview.php',
    '/webhooks/dispatch' => __DIR__ . '/webhooks/dispatch.php',
    '/webhooks/emit_session' => __DIR__ . '/webhooks/emit_session.php',
    '/alerts/run' => __DIR__ . '/alerts/run.php',
    '/file/upload' => __DIR__ . '/file/upload.php',
    '/file/get' => __DIR__ . '/file/get.php',
    '/file/list' => __DIR__ . '/file/list.php',
    '/file/delete' => __DIR__ . '/file/delete.php',
    '/file/purge' => __DIR__ . '/file/purge.php',
    '/payment/start' => __DIR__ . '/payment/start.php',
    '/payment/notify' => __DIR__ . '/payment/notify.php',
    '/payment/status' => __DIR__ . '/payment/status.php',
    '/template/view' => __DIR__ . '/template/view.php',
    '/template/download' => __DIR__ . '/template/download.php',
    '/template/export' => __DIR__ . '/template/export.php',
    '/template/import' => __DIR__ . '/template/import.php',
    '/scim/v2/Users' => __DIR__ . '/scim/v2/Users.php',
    '/scim/v2/ServiceProviderConfig' => __DIR__ . '/scim/v2/Users.php',
];

if (isset($map[$path])) {
    require $map[$path];
    exit;
}

if (str_starts_with($path, '/scim/v2/')) {
    require __DIR__ . '/scim/v2/Users.php';
    exit;
}

Response::error('Not found', 404);
