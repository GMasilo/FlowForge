<?php
declare(strict_types=1);

/**
 * Rename a document file
 * POST /api/document/rename
 * Body: { "instance_id": "uuid", "chatbot_id": "uuid", "old_name": "file.pdf", "new_name": "renamed.pdf", "kind": "media" }
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
$oldName = trim((string) ($body['old_name'] ?? ''));
$newName = trim((string) ($body['new_name'] ?? ''));

if (!InstanceFiles::isKind($kind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $chatbotId === '' || $oldName === '' || $newName === '') {
    Response::error('instance_id, chatbot_id, old_name, and new_name are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, true);

$oldFilename = InstanceFiles::assertSafeStoredName($oldName);
$newFilename = InstanceFiles::assertSafeStoredName($newName);

$oldExt = strtolower(pathinfo($oldFilename, PATHINFO_EXTENSION));
$newExt = strtolower(pathinfo($newFilename, PATHINFO_EXTENSION));

if ($oldExt !== $newExt) {
    Response::error('Cannot change file extension', 400);
}

$dir = InstanceFiles::dirFor($config, $instanceId, $chatbotId, $kind, false);
$oldPath = $dir . DIRECTORY_SEPARATOR . $oldFilename;
$newPath = $dir . DIRECTORY_SEPARATOR . $newFilename;

if (!is_file($oldPath)) {
    Response::error('Original file not found', 404);
}

if (is_file($newPath)) {
    Response::error('A file with the new name already exists', 409);
}

if (!@rename($oldPath, $newPath)) {
    Response::error('Failed to rename file', 500);
}

Response::json([
    'ok' => true,
    'old_name' => $oldFilename,
    'new_name' => $newFilename,
    'url' => InstanceFiles::getQuery($kind, $instanceId, $chatbotId, $newFilename),
    'path' => InstanceFiles::relativePath($instanceId, $chatbotId, $kind, $newFilename),
]);
