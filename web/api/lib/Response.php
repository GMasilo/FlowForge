<?php
declare(strict_types=1);

namespace FlowForge\Api;

final class Response
{
    public static function json(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function error(string $message, int $status = 400, array $extra = []): never
    {
        self::json(array_merge([
            'ok' => false,
            'error' => $message,
        ], $extra), $status);
    }

    public static function sendFile(string $absolutePath, string $downloadName, string $mime, bool $inline = true): never
    {
        if (!is_file($absolutePath) || !is_readable($absolutePath)) {
            self::error('File not found', 404);
        }

        $size = filesize($absolutePath);
        if ($size === false || $size < 0) {
            self::error('File not found', 404);
        }
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $downloadName) ?: 'file';

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        if (function_exists('ini_set')) {
            @ini_set('zlib.output_compression', '0');
        }

        $start = 0;
        $end = $size - 1;
        $status = 200;
        $rangeHeader = (string) ($_SERVER['HTTP_RANGE'] ?? '');
        if ($rangeHeader !== '' && preg_match('/bytes=(\d*)-(\d*)/', $rangeHeader, $m) === 1) {
            $from = $m[1] !== '' ? (int) $m[1] : 0;
            $to = $m[2] !== '' ? (int) $m[2] : $size - 1;
            if ($from > $to || $from >= $size) {
                http_response_code(416);
                header('Content-Range: bytes */' . $size);
                exit;
            }
            $start = $from;
            $end = min($to, $size - 1);
            $status = 206;
        }

        $length = $end - $start + 1;
        http_response_code($status);
        header('Content-Type: ' . $mime);
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=3600');
        header('Accept-Ranges: bytes');
        header('Content-Length: ' . (string) $length);
        header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $safeName . '"');
        if ($status === 206) {
            header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
        }

        $fp = fopen($absolutePath, 'rb');
        if ($fp === false) {
            self::error('File not found', 404);
        }
        if ($start > 0) {
            fseek($fp, $start);
        }
        $remaining = $length;
        while ($remaining > 0 && !feof($fp) && connection_status() === CONNECTION_NORMAL) {
            $chunk = fread($fp, min(8192, $remaining));
            if ($chunk === false || $chunk === '') {
                break;
            }
            echo $chunk;
            $remaining -= strlen($chunk);
        }
        fclose($fp);
        exit;
    }
}
