<?php
declare(strict_types=1);

/**
 * View document metadata and preview
 * GET /api/document/view?instance_id=<uuid>&chatbot_id=<uuid>&name=<filename>&kind=media
 * Returns document info with metadata
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

if (!is_file($path)) {
    Response::error('Document not found', 404);
}

$size = filesize($path);
$mtime = filemtime($path);
$mime = InstanceFiles::mimeForFilename($filename);

$isImage = str_starts_with($mime, 'image/');
$isVideo = str_starts_with($mime, 'video/');
$isAudio = str_starts_with($mime, 'audio/');
$isPdf = $mime === 'application/pdf';
$isText = str_starts_with($mime, 'text/') || $mime === 'application/json';
$isOfficeDoc = in_array($mime, [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

$preview = null;
if ($isText && $size < 100000) {
    $content = file_get_contents($path);
    if ($content !== false) {
        $preview = mb_substr($content, 0, 500);
    }
}

$imageInfo = null;
if ($isImage) {
    $info = @getimagesize($path);
    if ($info !== false) {
        $imageInfo = [
            'width' => $info[0],
            'height' => $info[1],
            'type' => image_type_to_mime_type($info[2]),
        ];
    }
}

Response::json([
    'ok' => true,
    'filename' => $filename,
    'key' => InstanceFiles::mediaKey($filename),
    'kind' => $kind,
    'size' => $size === false ? 0 : $size,
    'mime' => $mime,
    'extension' => pathinfo($filename, PATHINFO_EXTENSION),
    'modified_at' => gmdate('c', $mtime === false ? time() : $mtime),
    'url' => InstanceFiles::getQuery($kind, $instanceId, $chatbotId, $filename),
    'path' => InstanceFiles::relativePath($instanceId, $chatbotId, $kind, $filename),
    'is_image' => $isImage,
    'is_video' => $isVideo,
    'is_audio' => $isAudio,
    'is_pdf' => $isPdf,
    'is_text' => $isText,
    'is_office_doc' => $isOfficeDoc,
    'preview' => $preview,
    'image_info' => $imageInfo,
    'readable' => is_readable($path),
]);
