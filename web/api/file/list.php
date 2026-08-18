<?php
declare(strict_types=1);

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

if (!InstanceFiles::isKind($kind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $chatbotId === '') {
    Response::error('instance_id and chatbot_id are required', 400);
}

SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, false);

Response::json([
    'ok' => true,
    'kind' => $kind,
    'instance_id' => $instanceId,
    'chatbot_id' => $chatbotId,
    'files' => InstanceFiles::listKind($config, $instanceId, $chatbotId, $kind),
]);
