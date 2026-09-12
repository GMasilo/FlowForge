<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/PlatformV1.php';

use FlowForge\Api\PlatformV1;
use FlowForge\Api\Response;

$boot = flowforge_bootstrap(['GET']);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^.*?/api#', '', (string) $path) ?: '/';
$path = '/' . trim($path, '/');

if (!str_starts_with($path, '/v1')) {
    Response::error('Not found', 404);
}

PlatformV1::dispatch($boot['config'], $boot['user'], $path, 'GET');
