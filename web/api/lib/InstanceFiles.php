<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * On-disk instance files:
 *   files/{instanceId}/{chatbotId}/media
 *   files/{instanceId}/{chatbotId}/conversations
 *
 * Directories are created on first upload. Conversation files are renamed
 * `{sessionId}_{nodeKey}{ext}` so reporting can join them back to a response.
 */
final class InstanceFiles
{
    public const KIND_MEDIA = 'media';
    public const KIND_CONVERSATION = 'conversation';

    private const KINDS = [self::KIND_MEDIA, self::KIND_CONVERSATION];

    private static ?string $resolvedRoot = null;

    /** @var array<string, string> */
    private const MIME_BY_EXT = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'mp3' => 'audio/mpeg',
        'wav' => 'audio/wav',
        'ogg' => 'audio/ogg',
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'pdf' => 'application/pdf',
        'txt' => 'text/plain',
        'csv' => 'text/csv',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'zip' => 'application/zip',
    ];

    public static function root(array $config): string
    {
        if (self::$resolvedRoot !== null) {
            return self::$resolvedRoot;
        }

        $candidates = [];
        $configured = trim((string) ($config['files_path'] ?? ''));
        if ($configured !== '') {
            $candidates[] = $configured;
        }
        $apiRoot = dirname(__DIR__);
        $candidates[] = $apiRoot . DIRECTORY_SEPARATOR . 'files';

        $storage = trim((string) ($config['storage_path'] ?? ''));
        if ($storage !== '') {
            $candidates[] = rtrim($storage, '/\\') . DIRECTORY_SEPARATOR . 'files';
        }
        $candidates[] = $apiRoot . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'files';

        foreach ($candidates as $dir) {
            $dir = rtrim((string) $dir, '/\\');
            if ($dir === '') {
                continue;
            }
            if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
                continue;
            }
            if (is_dir($dir) && is_writable($dir)) {
                $probe = $dir . DIRECTORY_SEPARATOR . '.write_test_' . getmypid();
                if (@file_put_contents($probe, 'ok') !== false) {
                    @unlink($probe);
                    self::$resolvedRoot = $dir;
                    return $dir;
                }
            }
        }

        Response::error(
            'Instance file storage is not writable. On the server, make api/files writable by the Apache user (chmod 775 files && chown apache:apache files).',
            500,
        );
    }

    public static function maxBytes(array $config): int
    {
        $n = (int) ($config['files_max_bytes'] ?? 10_485_760);
        return max(65_536, min($n, 52_428_800));
    }

    public static function isKind(string $kind): bool
    {
        return in_array($kind, self::KINDS, true);
    }

    public static function folderForKind(string $kind): string
    {
        return $kind === self::KIND_CONVERSATION ? 'conversations' : 'media';
    }

    /**
     * Ensure files/{instanceId}/{chatbotId}/{media|conversations} exists.
     * Also creates the sibling folder so the chatbot tree is complete.
     */
    public static function ensureChatbotDirs(array $config, string $instanceId, string $chatbotId): string
    {
        $base = self::chatbotBase($config, $instanceId, $chatbotId);

        foreach (['media', 'conversations'] as $folder) {
            $dir = $base . DIRECTORY_SEPARATOR . $folder;
            if (is_dir($dir)) {
                continue;
            }
            if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
                $detail = error_get_last()['message'] ?? 'mkdir failed';
                error_log('FlowForge InstanceFiles mkdir failed: ' . $detail);
                Response::error(
                    'Could not create instance file folders. The web server needs write access to api/files (chmod 775, owner apache).',
                    500,
                );
            }
            @chmod($dir, 0775);
        }

        return $base;
    }

    public static function dirFor(array $config, string $instanceId, string $chatbotId, string $kind, bool $create = false): string
    {
        if (!self::isKind($kind)) {
            Response::error('Invalid file kind', 400);
        }
        $base = $create
            ? self::ensureChatbotDirs($config, $instanceId, $chatbotId)
            : self::chatbotBase($config, $instanceId, $chatbotId);
        return $base . DIRECTORY_SEPARATOR . self::folderForKind($kind);
    }

    private static function chatbotBase(array $config, string $instanceId, string $chatbotId): string
    {
        self::assertUuid($instanceId, 'instance_id');
        self::assertUuid($chatbotId, 'chatbot_id');

        return self::root($config)
            . DIRECTORY_SEPARATOR . strtolower($instanceId)
            . DIRECTORY_SEPARATOR . strtolower($chatbotId);
    }

    /**
     * Conversation files: {sessionId}_{nodeKey}[_{index}]{ext}
     * Media files: sanitized original name, with a numeric suffix on collision.
     */
    public static function storedFilename(
        string $kind,
        string $originalName,
        string $ext,
        ?string $sessionId,
        ?string $nodeKey,
        ?int $fileIndex,
    ): string {
        $ext = strtolower($ext);
        if ($ext === '' || !isset(self::MIME_BY_EXT[$ext])) {
            Response::error('File type is not allowed', 400);
        }

        if ($kind === self::KIND_CONVERSATION) {
            if ($sessionId === null || !SupabaseRest::isUuid($sessionId)) {
                Response::error('session_id is required for conversation files', 400);
            }
            $response = self::sanitizeNodeKey((string) $nodeKey);
            if ($response === '') {
                Response::error('response / node_key is required for conversation files', 400);
            }
            $name = strtolower($sessionId) . '_' . $response;
            if ($fileIndex !== null && $fileIndex > 0) {
                $name .= '_' . $fileIndex;
            }
            return $name . '.' . $ext;
        }

        $stem = self::sanitizeOriginalStem($originalName);
        if ($stem === '') {
            $stem = 'media';
        }
        return $stem . '.' . $ext;
    }

    public static function uniqueMediaName(string $dir, string $filename): string
    {
        $target = $dir . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($target)) {
            return $filename;
        }
        $dot = strrpos($filename, '.');
        $stem = $dot === false ? $filename : substr($filename, 0, $dot);
        $ext = $dot === false ? '' : substr($filename, $dot);
        for ($i = 2; $i < 1000; $i++) {
            $candidate = $stem . '_' . $i . $ext;
            if (!is_file($dir . DIRECTORY_SEPARATOR . $candidate)) {
                return $candidate;
            }
        }
        Response::error('Could not allocate a unique filename', 500);
    }

    public static function isSafeStoredName(string $name): bool
    {
        $name = trim($name);
        if ($name === '' || strlen($name) > 200 || str_contains($name, '/') || str_contains($name, '\\')) {
            return false;
        }
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/', $name)) {
            return false;
        }
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        return isset(self::MIME_BY_EXT[$ext]);
    }

    public static function assertSafeStoredName(string $name): string
    {
        if (!self::isSafeStoredName($name)) {
            Response::error('Invalid file name', 400);
        }
        return trim($name);
    }

    public static function mimeForFilename(string $name): string
    {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        return self::MIME_BY_EXT[$ext] ?? 'application/octet-stream';
    }

    public static function extensionFromName(string $originalName): string
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        return $ext;
    }

    public static function relativePath(string $instanceId, string $chatbotId, string $kind, string $filename): string
    {
        return 'files/'
            . strtolower($instanceId) . '/'
            . strtolower($chatbotId) . '/'
            . self::folderForKind($kind) . '/'
            . $filename;
    }

    public static function getQuery(string $kind, string $instanceId, string $chatbotId, string $filename): string
    {
        return '/file/get?' . http_build_query([
            'kind' => $kind,
            'instance_id' => $instanceId,
            'chatbot_id' => $chatbotId,
            'name' => $filename,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    /** Expression-safe key: welcome.png → welcome_png */
    public static function mediaKey(string $filename): string
    {
        $filename = strtolower($filename);
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $stem = pathinfo($filename, PATHINFO_FILENAME);
        $stem = preg_replace('/[^a-z0-9]+/', '_', $stem) ?? '';
        $stem = trim($stem, '_');
        if ($stem === '') {
            $stem = 'file';
        }
        $ext = preg_replace('/[^a-z0-9]+/', '', $ext) ?? '';
        return $ext !== '' ? $stem . '_' . $ext : $stem;
    }

    /**
     * @return list<array{filename: string, key: string, size: int, mime: string, modified_at: string, url: string, path: string}>
     */
    public static function listKind(array $config, string $instanceId, string $chatbotId, string $kind): array
    {
        $dir = self::dirFor($config, $instanceId, $chatbotId, $kind, false);
        if (!is_dir($dir)) {
            return [];
        }

        $out = [];
        $entries = @scandir($dir);
        if (!is_array($entries)) {
            return [];
        }

        foreach ($entries as $name) {
            if ($name === '.' || $name === '..' || str_starts_with($name, '.')) {
                continue;
            }
            if (!self::isSafeStoredName($name)) {
                continue;
            }
            $safe = trim($name);
            $path = $dir . DIRECTORY_SEPARATOR . $safe;
            if (!is_file($path)) {
                continue;
            }
            $size = filesize($path);
            $mtime = filemtime($path);
            $out[] = [
                'filename' => $safe,
                'key' => self::mediaKey($safe),
                'size' => $size === false ? 0 : $size,
                'mime' => self::mimeForFilename($safe),
                'modified_at' => gmdate('c', $mtime === false ? time() : $mtime),
                'url' => self::getQuery($kind, $instanceId, $chatbotId, $safe),
                'path' => self::relativePath($instanceId, $chatbotId, $kind, $safe),
            ];
        }

        usort($out, static fn ($a, $b) => strcasecmp($a['filename'], $b['filename']));
        return $out;
    }

    public static function deleteStored(array $config, string $instanceId, string $chatbotId, string $kind, string $filename): bool
    {
        $safe = self::assertSafeStoredName($filename);
        $dir = self::dirFor($config, $instanceId, $chatbotId, $kind, false);
        $path = $dir . DIRECTORY_SEPARATOR . $safe;
        if (!is_file($path)) {
            return false;
        }
        if (!@unlink($path)) {
            Response::error('Could not delete file', 500);
        }
        return true;
    }

    /**
     * @return array{tmp: string, name: string, size: int, error: int}
     */
    public static function requireUploadedFile(array $config): array
    {
        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            Response::error('file is required', 400);
        }
        $error = (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            Response::error(self::uploadErrorMessage($error), $error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE ? 413 : 400);
        }

        $tmp = (string) ($_FILES['file']['tmp_name'] ?? '');
        $name = (string) ($_FILES['file']['name'] ?? 'upload');
        $size = (int) ($_FILES['file']['size'] ?? 0);
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            Response::error('Invalid upload', 400);
        }

        $max = self::maxBytes($config);
        if ($size <= 0 || $size > $max) {
            Response::error('File is empty or exceeds the maximum size of ' . $max . ' bytes', 413);
        }

        $ext = self::extensionFromName($name);
        if ($ext === '' || !isset(self::MIME_BY_EXT[$ext])) {
            Response::error('File type is not allowed', 400);
        }

        $detected = self::detectMime($tmp);
        $expected = self::MIME_BY_EXT[$ext];
        if ($detected !== null && !self::mimeCompatible($detected, $expected)) {
            Response::error('File contents do not match the file type', 400);
        }

        return ['tmp' => $tmp, 'name' => $name, 'size' => $size, 'error' => $error];
    }

    public static function saveUpload(string $dir, string $filename, string $tmpPath): string
    {
        if (!is_dir($dir) || !is_writable($dir)) {
            Response::error(
                'Could not store upload: instance file folder is not writable. chmod 775 api/files and chown it to the Apache user.',
                500,
            );
        }
        $target = $dir . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($tmpPath, $target)) {
            $detail = error_get_last()['message'] ?? 'move_uploaded_file failed';
            error_log('FlowForge InstanceFiles save failed: ' . $detail);
            Response::error('Failed to store uploaded file', 500);
        }
        @chmod($target, 0644);
        return $target;
    }

    public static function sanitizeNodeKey(?string $raw): string
    {
        $value = strtolower(trim((string) $raw));
        $value = preg_replace('/[^a-z0-9._-]+/', '_', $value) ?? '';
        $value = trim($value, '._-');
        if (strlen($value) > 80) {
            $value = substr($value, 0, 80);
        }
        return $value;
    }

    private static function sanitizeOriginalStem(string $originalName): string
    {
        $stem = pathinfo($originalName, PATHINFO_FILENAME);
        $stem = strtolower(trim($stem));
        $stem = preg_replace('/[^a-z0-9._-]+/', '_', $stem) ?? '';
        $stem = trim($stem, '._-');
        if (strlen($stem) > 80) {
            $stem = substr($stem, 0, 80);
        }
        return $stem;
    }

    private static function assertUuid(string $value, string $field): void
    {
        if (!SupabaseRest::isUuid($value)) {
            Response::error('Invalid ' . $field, 400);
        }
    }

    private static function detectMime(string $path): ?string
    {
        if (!function_exists('finfo_open')) {
            return null;
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return null;
        }
        $mime = finfo_file($finfo, $path);
        finfo_close($finfo);
        return is_string($mime) && $mime !== '' ? strtolower($mime) : null;
    }

    private static function mimeCompatible(string $detected, string $expected): bool
    {
        if ($detected === $expected) {
            return true;
        }
        // ZIP-based Office files often report as application/zip
        if ($detected === 'application/zip' && in_array($expected, [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
        ], true)) {
            return true;
        }
        if ($detected === 'application/octet-stream') {
            return true;
        }
        return false;
    }

    private static function uploadErrorMessage(int $error): string
    {
        return match ($error) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'File is too large',
            UPLOAD_ERR_PARTIAL => 'File upload was incomplete',
            UPLOAD_ERR_NO_FILE => 'file is required',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'Server could not store the upload',
            UPLOAD_ERR_EXTENSION => 'Upload blocked by a PHP extension',
            default => 'Upload failed',
        };
    }
}
