<?php
declare(strict_types=1);

/**
 * Copy a document file
 * POST /api/document/copy
 * Body: { "instance_id": "uuid", "chatbot_id": "uuid", "name": "file.pdf", "new_name": "copy.pdf", "kind": "media" }
 * Returns the new filename
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/InstanceFiles.php';

use FlowForge\Api\InstanceFiles;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap(['POST']);
$config = $boot['config'];
$body = Security::readJsonBody(4096);
$jwt = SupabaseRest::bearerFromRequest();

$kind = trim((string) ($body['kind'] ?? InstanceFiles::KIND_MEDIA));
$instanceId = trim((string) ($body['instance_id'] ?? ''));
$chatbotId = trim((string) ($body['chatbot_id'] ?? ''));
$name = trim((string) ($body['name'] ?? ''));
$newName = trim((string) ($body['new_name'] ?? ''));

if (!InstanceFiles::isKind($kind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $chatbotId === '' || $name === '') {
    Response::error('instance_id, chatbot_id, and name are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, true);

$sourceName = InstanceFiles::assertSafeStoredName($name);
$dir = InstanceFiles::dirFor($config, $instanceId, $chatbotId, $kind, false);
$sourcePath = $dir . DIRECTORY_SEPARATOR . $sourceName;

if (!is_file($sourcePath)) {
    Response::error('Source file not found', 404);
}

if ($newName === '') {
    $ext = pathinfo($sourceName, PATHINFO_EXTENSION);
    $stem = pathinfo($sourceName, PATHINFO_FILENAME);
    $newName = $stem . '_copy.' . $ext;
}

$destName = InstanceFiles::assertSafeStoredName($newName);
$destName = InstanceFiles::uniqueMediaName($dir, $destName);
$destPath = $dir . DIRECTORY_SEPARATOR . $destName;

if (!@copy($sourcePath, $destPath)) {
    Response::error('Failed to copy file', 500);
}

@chmod($destPath, 0644);

$size = filesize($destPath);

Response::json([
    'ok' => true,
    'source_name' => $sourceName,
    'new_name' => $destName,
    'size' => $size === false ? 0 : $size,
    'url' => InstanceFiles::getQuery($kind, $instanceId, $chatbotId, $destName),
    'path' => InstanceFiles::relativePath($instanceId, $chatbotId, $kind, $destName),
]);
