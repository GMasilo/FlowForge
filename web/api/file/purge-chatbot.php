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

$instanceId = trim((string) ($body['instance_id'] ?? ''));
$chatbotId = trim((string) ($body['chatbot_id'] ?? ''));

if ($instanceId === '' || $chatbotId === '') {
    Response::error('instance_id and chatbot_id are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, true);

$admin = SupabaseRest::rpcAsUser($config, $jwt, 'has_instance_role', [
    'p_instance_id' => $instanceId,
    'p_roles' => ['owner', 'admin'],
]);
if (!$admin['ok'] || $admin['data'] !== true) {
    Response::error('Not allowed', 403);
}

$deleted = InstanceFiles::deleteChatbotTree($config, $instanceId, $chatbotId);

Response::json([
    'ok' => true,
    'deleted' => $deleted,
]);
