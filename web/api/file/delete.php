<?php
declare(strict_types=1);

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
$name = trim((string) ($body['name'] ?? ($body['filename'] ?? '')));

if (!InstanceFiles::isKind($kind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $chatbotId === '' || $name === '') {
    Response::error('instance_id, chatbot_id, and name are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, true);
$deleted = InstanceFiles::deleteStored($config, $instanceId, $chatbotId, $kind, $name);

Response::json([
    'ok' => true,
    'deleted' => $deleted,
    'filename' => $name,
]);
