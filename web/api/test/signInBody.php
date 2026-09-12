<?php
declare(strict_types=1);

namespace FlowForge\Api\Test;

/**
 * Mirrors the frontend Sign-in request body builder (web/src/features/designer/model/signInStep.ts).
 * Kept here so API tests can verify the JSON shapes the PHP proxy will forward.
 *
 * @param array{requestEmailKey?:string,requestPasswordKey?:string,requestBody?:string} $cfg
 * @return array<string, mixed>
 */
function build_sign_in_request_body(array $cfg, string $email, string $password, string $profileImg): array
{
    $emailKey = trim((string) ($cfg['requestEmailKey'] ?? 'email')) ?: 'email';
    $passwordKey = trim((string) ($cfg['requestPasswordKey'] ?? 'password')) ?: 'password';
    $template = trim((string) ($cfg['requestBody'] ?? ''));

    if ($template !== '') {
        $filled = preg_replace_callback(
            '/\{\{\s*(email|password)\s*\}\}/i',
            static function (array $m) use ($email, $password, $profileImg): string {
                $value = strtolower($m[1]) === 'password' ? $password : $email;
                if (strtolower($m[1]) === 'profileImg') {
                    return substr(json_encode($profileImg, JSON_UNESCAPED_UNICODE), 1, -1);
                }
                return substr(json_encode($value, JSON_UNESCAPED_UNICODE), 1, -1);
            },
            $template,
        );
        if (is_string($filled)) {
            $parsed = json_decode($filled, true);
            if (is_array($parsed)) {
                $isList = function_exists('array_is_list')
                    ? \array_is_list($parsed)
                    : array_keys($parsed) === range(0, count($parsed) - 1);
                if ($isList === false) {
                    return $parsed;
                }
            }
        }
    }

    return [
        $emailKey => $email,
        $passwordKey => $password,
        'profileImg' => 'https://example.com/profile.jpg',
    ];
}
