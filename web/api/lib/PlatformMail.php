<?php

declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Platform SMTP settings from Apache SetEnv / PHP environment.
 *
 * Expected Apache vars (GKJTT / shared hosting):
 *   SetEnv DEFAULT_SYSTEM_SMTP_SERVER ...
 *   SetEnv DEFAULT_SYSTEM_SMTP_PORT 465
 *   SetEnv DEFAULT_SYSTEM_SMTP_USERNAME ...
 *   SetEnv DEFAULT_SYSTEM_SMTP_PASSWORD ...
 *   SetEnv DEFAULT_SYSTEM_SMTP_NAME FlowForge
 *   SetEnv DEFAULT_SYSTEM_SMTP_SECURE ssl
 *   SetEnv DEFAULT_SYSTEM_APP_URL https://gkjtt.co.za/flowforge
 *   SetEnv SITE_URL https://gkjtt.co.za
 *
 * DEFAULT_SYSTEM_SMTP_SECURE accepts: ssl | tls | starttls | none
 * (PHPMailer-style: "tls" means STARTTLS; "ssl" means implicit TLS on connect.)
 */
final class PlatformMail
{
    /** @return array<string, mixed> */
    public static function smtpConfigFromEnv(): array
    {
        $port = (int) (self::env('DEFAULT_SYSTEM_SMTP_PORT') ?: '465');
        $username = self::env('DEFAULT_SYSTEM_SMTP_USERNAME');

        return [
            'smtpHost' => self::env('DEFAULT_SYSTEM_SMTP_SERVER'),
            'smtpPort' => $port,
            'username' => $username,
            'password' => self::env('DEFAULT_SYSTEM_SMTP_PASSWORD'),
            'fromEmail' => $username,
            'fromName' => self::env('DEFAULT_SYSTEM_SMTP_NAME') ?: 'FlowForge',
            'encryption' => self::normalizeEncryption(
                self::env('DEFAULT_SYSTEM_SMTP_SECURE'),
                $port
            ),
        ];
    }

    /**
     * Prefer Apache/env SMTP, then optional config.php `platform_smtp`.
     *
     * @param array<string, mixed>|null $config
     * @return array<string, mixed>
     */
    public static function smtpConfig(?array $config = null): array
    {
        $fromEnv = self::smtpConfigFromEnv();
        if (trim((string) ($fromEnv['smtpHost'] ?? '')) !== '' && trim((string) ($fromEnv['fromEmail'] ?? '')) !== '') {
            return $fromEnv;
        }

        $smtp = is_array($config['platform_smtp'] ?? null) ? $config['platform_smtp'] : [];
        $port = (int) ($smtp['smtpPort'] ?? $smtp['port'] ?? 465);
        $username = trim((string) ($smtp['username'] ?? $smtp['fromEmail'] ?? ''));
        $fromEmail = trim((string) ($smtp['fromEmail'] ?? $username));

        return [
            'smtpHost' => trim((string) ($smtp['smtpHost'] ?? $smtp['host'] ?? '')),
            'smtpPort' => $port,
            'username' => $username,
            'password' => (string) ($smtp['password'] ?? ''),
            'fromEmail' => $fromEmail,
            'fromName' => trim((string) ($smtp['fromName'] ?? $smtp['name'] ?? 'FlowForge')) ?: 'FlowForge',
            'encryption' => self::normalizeEncryption(
                (string) ($smtp['encryption'] ?? $smtp['secure'] ?? ''),
                $port
            ),
        ];
    }

    /** @param array<string, mixed>|null $config */
    public static function appUrl(?array $config = null): string
    {
        $app = self::env('DEFAULT_SYSTEM_APP_URL');
        if ($app !== '') {
            return rtrim($app, '/');
        }
        if (is_array($config) && trim((string) ($config['app_url'] ?? '')) !== '') {
            return rtrim((string) $config['app_url'], '/');
        }
        $site = self::env('SITE_URL');
        if ($site !== '') {
            return rtrim($site, '/') . '/flowforge';
        }
        return '';
    }

    /**
     * Map hosting-style SMTP secure flags to Mailer modes: ssl | starttls | none
     */
    public static function normalizeEncryption(string $secure, int $port): string
    {
        $s = strtolower(trim($secure));

        if ($s === '' || $s === 'auto') {
            return $port === 465 ? 'ssl' : 'starttls';
        }

        if (in_array($s, ['ssl', 'smtps'], true)) {
            return 'ssl';
        }

        // PHPMailer: "tls" = STARTTLS (usually port 587)
        if (in_array($s, ['tls', 'starttls', 'start_tls'], true)) {
            return 'starttls';
        }

        if (in_array($s, ['1', 'true', 'yes', 'on'], true)) {
            return $port === 465 ? 'ssl' : 'starttls';
        }

        if (in_array($s, ['none', 'off', 'false', '0', 'no', 'plain'], true)) {
            return 'none';
        }

        return $s;
    }

    private static function env(string $key): string
    {
        $v = getenv($key);
        if (is_string($v) && $v !== '') {
            return trim($v);
        }
        if (isset($_SERVER[$key]) && is_string($_SERVER[$key]) && $_SERVER[$key] !== '') {
            return trim($_SERVER[$key]);
        }
        if (isset($_ENV[$key]) && is_string($_ENV[$key]) && $_ENV[$key] !== '') {
            return trim($_ENV[$key]);
        }
        return '';
    }
}
