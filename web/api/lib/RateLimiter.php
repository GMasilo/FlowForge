<?php
declare(strict_types=1);

namespace FlowForge\Api;

final class RateLimiter
{
    public static function hit(array $config, string $userId): void
    {
        $max = (int) ($config['rate_limit_max'] ?? 60);
        $window = (int) ($config['rate_limit_window_seconds'] ?? 60);
        $dir = self::resolveWritableDir($config);
        if ($dir === null) {
            Response::error('Rate limiter storage unavailable', 503);
        }

        $key = hash('sha256', $userId . '|' . Security::clientIp());
        $file = $dir . DIRECTORY_SEPARATOR . 'rl_' . $key . '.json';
        $now = time();
        $data = ['start' => $now, 'count' => 0];

        $fp = @fopen($file, 'c+');
        if ($fp === false) {
            Response::error('Rate limiter storage unavailable', 503);
        }

        try {
            if (!flock($fp, LOCK_EX)) {
                Response::error('Rate limiter storage unavailable', 503);
            }
            $raw = stream_get_contents($fp);
            if (is_string($raw) && $raw !== '') {
                $parsed = json_decode($raw, true);
                if (is_array($parsed)) {
                    $data = $parsed;
                }
            }
            if (($now - (int) ($data['start'] ?? $now)) >= $window) {
                $data = ['start' => $now, 'count' => 0];
            }
            $data['count'] = (int) ($data['count'] ?? 0) + 1;
            if ($data['count'] > $max) {
                Response::error('Rate limit exceeded. Try again shortly.', 429, [
                    'retry_after' => max(1, $window - ($now - (int) $data['start'])),
                ]);
            }
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data));
            fflush($fp);
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    private static function resolveWritableDir(array $config): ?string
    {
        $candidates = [];

        $configured = (string) ($config['storage_path'] ?? '');
        if ($configured !== '') {
            $candidates[] = $configured;
        }
        $candidates[] = __DIR__ . '/../storage';
        $candidates[] = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'flowforge-api';

        foreach ($candidates as $dir) {
            $dir = rtrim($dir, '/\\');
            if ($dir === '') {
                continue;
            }
            if (!is_dir($dir)) {
                @mkdir($dir, 0775, true);
            }
            if (!is_dir($dir)) {
                continue;
            }
            // Probe write access
            $probe = $dir . DIRECTORY_SEPARATOR . '.write_test_' . getmypid();
            if (@file_put_contents($probe, 'ok') !== false) {
                @unlink($probe);
                return $dir;
            }
        }

        return null;
    }
}
