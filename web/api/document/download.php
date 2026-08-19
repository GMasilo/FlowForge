<?php
declare(strict_types=1);

/**
 * Download document with force-download header
 * GET /api/document/download?instance_id=<uuid>&chatbot_id=<uuid>&name=<filename>&kind=media
 * Forces browser download dialog instead of inline display
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/InstanceFiles.php';

use FlowForge\Api\InstanceFiles;
use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap(['GET']);
$config = $boot['config'];
$jwt = SupabaseRest::bearerFromRequest();

$kind = trim((string) ($_GET['kind'] ?? InstanceFiles::KIND_MEDIA));
$instanceId = trim((string) ($_GET['instance_id'] ?? ''));
$chatbotId = trim((string) ($_GET['chatbot_id'] ?? ''));
$name = trim((string) ($_GET['name'] ?? ''));

if (!InstanceFiles::isKind($kind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $chatbotId === '' || $name === '') {
    Response::error('instance_id, chatbot_id, and name are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, false);

$filename = InstanceFiles::assertSafeStoredName($name);
$dir = InstanceFiles::dirFor($config, $instanceId, $chatbotId, $kind, false);
$path = $dir . DIRECTORY_SEPARATOR . $filename;

Response::sendFile($path, $filename, InstanceFiles::mimeForFilename($filename), false);
