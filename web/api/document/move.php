<?php
declare(strict_types=1);

/**
 * Move a document between kinds (media <-> conversation) or chatbots
 * POST /api/document/move
 * Body: { "instance_id": "uuid", "source_chatbot_id": "uuid", "target_chatbot_id": "uuid", 
 *         "name": "file.pdf", "source_kind": "media", "target_kind": "conversation" }
 * Returns the moved file info
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

$instanceId = trim((string) ($body['instance_id'] ?? ''));
$sourceChatbotId = trim((string) ($body['source_chatbot_id'] ?? ''));
$targetChatbotId = trim((string) ($body['target_chatbot_id'] ?? $sourceChatbotId));
$name = trim((string) ($body['name'] ?? ''));
$sourceKind = trim((string) ($body['source_kind'] ?? InstanceFiles::KIND_MEDIA));
$targetKind = trim((string) ($body['target_kind'] ?? $sourceKind));

if (!InstanceFiles::isKind($sourceKind) || !InstanceFiles::isKind($targetKind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $sourceChatbotId === '' || $targetChatbotId === '' || $name === '') {
    Response::error('instance_id, source_chatbot_id, target_chatbot_id, and name are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $sourceChatbotId, true);
if ($sourceChatbotId !== $targetChatbotId) {
    SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $targetChatbotId, true);
}

$filename = InstanceFiles::assertSafeStoredName($name);
$sourceDir = InstanceFiles::dirFor($config, $instanceId, $sourceChatbotId, $sourceKind, false);
$targetDir = InstanceFiles::dirFor($config, $instanceId, $targetChatbotId, $targetKind, true);

$sourcePath = $sourceDir . DIRECTORY_SEPARATOR . $filename;
$targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;

if (!is_file($sourcePath)) {
    Response::error('Source file not found', 404);
}

if (is_file($targetPath)) {
    Response::error('A file with this name already exists at the target', 409);
}

if (!@rename($sourcePath, $targetPath)) {
    Response::error('Failed to move file', 500);
}

Response::json([
    'ok' => true,
    'filename' => $filename,
    'from' => [
        'chatbot_id' => $sourceChatbotId,
        'kind' => $sourceKind,
    ],
    'to' => [
        'chatbot_id' => $targetChatbotId,
        'kind' => $targetKind,
    ],
    'url' => InstanceFiles::getQuery($targetKind, $instanceId, $targetChatbotId, $filename),
    'path' => InstanceFiles::relativePath($instanceId, $targetChatbotId, $targetKind, $filename),
]);
