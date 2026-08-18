<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/Response.php';
require_once __DIR__ . '/lib/Security.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;

$configFile = __DIR__ . '/config.php';
$config = is_file($configFile) ? require $configFile : [];
Security::applyCors(is_array($config) ? $config : []);
Security::onlyMethods(['GET', 'OPTIONS']);

Response::json([
    'ok' => true,
    'service' => 'flowforge-api',
    'time' => gmdate('c'),
]);
