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

$boot = flowforge_bootstrap_public(['POST']);
$config = $boot['config'];

try {
    $kind = trim((string) ($_POST['kind'] ?? ''));
    $instanceId = trim((string) ($_POST['instance_id'] ?? ''));
    $chatbotId = trim((string) ($_POST['chatbot_id'] ?? ''));
    $sessionId = trim((string) ($_POST['session_id'] ?? ''));
    $nodeKey = trim((string) ($_POST['node_key'] ?? ($_POST['response'] ?? '')));
    $fileIndexRaw = $_POST['file_index'] ?? null;
    $fileIndex = is_numeric($fileIndexRaw) ? (int) $fileIndexRaw : null;
    if ($fileIndex !== null && $fileIndex < 1) {
        $fileIndex = null;
    }

    if (!InstanceFiles::isKind($kind)) {
        Response::error('kind must be media or conversation', 400);
    }
    if ($instanceId === '' || $chatbotId === '') {
        Response::error('instance_id and chatbot_id are required', 400);
    }

    if ($kind === InstanceFiles::KIND_CONVERSATION) {
        if ($sessionId === '') {
            Response::error('session_id is required for conversation files', 400);
        }
        RateLimiter::hit($config, 'anon:' . Security::clientIp());
        $session = SupabaseRest::requireConversationSession($config, $sessionId);
        if ($session['status'] !== 'active') {
            Response::error('Session is no longer accepting uploads', 409);
        }
        if (strcasecmp($session['instance_id'], $instanceId) !== 0 || strcasecmp($session['chatbot_id'], $chatbotId) !== 0) {
            Response::error('Session does not match instance_id / chatbot_id', 403);
        }
        $sessionId = $session['id'];
        $instanceId = $session['instance_id'];
        $chatbotId = $session['chatbot_id'];
    } else {
        $user = Auth::requireUser($config);
        RateLimiter::hit($config, $user['sub']);
        $jwt = SupabaseRest::bearerFromRequest();
        SupabaseRest::requireChatbotAccess($config, $jwt, $instanceId, $chatbotId, true);
    }

    $upload = InstanceFiles::requireUploadedFile($config);
    $ext = InstanceFiles::extensionFromName($upload['name']);
    $filename = InstanceFiles::storedFilename(
        $kind,
        $upload['name'],
        $ext,
        $sessionId !== '' ? $sessionId : null,
        $nodeKey,
        $fileIndex,
    );

    $dir = InstanceFiles::dirFor($config, $instanceId, $chatbotId, $kind, true);
    if ($kind === InstanceFiles::KIND_MEDIA) {
        $filename = InstanceFiles::uniqueMediaName($dir, $filename);
    }

    InstanceFiles::saveUpload($dir, $filename, $upload['tmp']);

    Response::json([
        'ok' => true,
        'kind' => $kind,
        'instance_id' => $instanceId,
        'chatbot_id' => $chatbotId,
        'session_id' => $kind === InstanceFiles::KIND_CONVERSATION ? $sessionId : null,
        'node_key' => $kind === InstanceFiles::KIND_CONVERSATION ? InstanceFiles::sanitizeNodeKey($nodeKey) : null,
        'original_name' => $upload['name'],
        'filename' => $filename,
        'key' => InstanceFiles::mediaKey($filename),
        'size' => $upload['size'],
        'path' => InstanceFiles::relativePath($instanceId, $chatbotId, $kind, $filename),
        'url' => InstanceFiles::getQuery($kind, $instanceId, $chatbotId, $filename),
    ]);
} catch (\Throwable $e) {
    error_log('FlowForge file/upload: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    Response::error('Upload failed. Check that api/files is writable by the web server.', 500);
}
