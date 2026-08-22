<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/InstanceFiles.php';

use FlowForge\Api\Auth;
use FlowForge\Api\InstanceFiles;
use FlowForge\Api\RateLimiter;
use FlowForge\Api\Response;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$boot = flowforge_bootstrap_public(['GET']);
$config = $boot['config'];

$kind = trim((string) ($_GET['kind'] ?? ''));
$instanceId = trim((string) ($_GET['instance_id'] ?? ''));
$chatbotId = trim((string) ($_GET['chatbot_id'] ?? ''));
$name = trim((string) ($_GET['name'] ?? ''));
$sessionId = trim((string) ($_GET['session_id'] ?? ''));

if (!InstanceFiles::isKind($kind)) {
    Response::error('kind must be media or conversation', 400);
}
if ($instanceId === '' || $chatbotId === '' || $name === '') {
    Response::error('instance_id, chatbot_id, and name are required', 400);
}

$filename = InstanceFiles::assertSafeStoredName($name);

if ($kind === InstanceFiles::KIND_CONVERSATION) {
    if ($sessionId !== '') {
        RateLimiter::hit($config, 'anon:' . Security::clientIp());
        $session = SupabaseRest::requireConversationSession($config, $sessionId);
        if (strcasecmp($session['instance_id'], $instanceId) !== 0 || strcasecmp($session['chatbot_id'], $chatbotId) !== 0) {
            Response::error('Session does not match instance_id / chatbot_id', 403);
        }
        $prefix = strtolower($session['id']) . '_';
        if (!str_starts_with(strtolower($filename), $prefix)) {
            Response::error('File does not belong to this conversation', 403);
        }
    } else {
        $user = Auth::requireUser($config);
        RateLimiter::hit($config, $user['sub']);
        $jwt = SupabaseRest::bearerFromRequest();
        SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, false);
    }
}

$dir = InstanceFiles::dirFor($config, $instanceId, $chatbotId, $kind, false);
$path = $dir . DIRECTORY_SEPARATOR . $filename;
$forceDownload = isset($_GET['download']) && !in_array(strtolower((string) $_GET['download']), ['0', 'false', 'no', ''], true);
// Media defaults to inline (browser can preview PDFs); ?download=1 forces save dialog.
$inline = !$forceDownload && $kind === InstanceFiles::KIND_MEDIA;
Response::sendFile($path, $filename, InstanceFiles::mimeForFilename($filename), $inline);
