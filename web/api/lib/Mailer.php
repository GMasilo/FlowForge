<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Minimal SMTP client (AUTH LOGIN) for STARTTLS / SSL / plaintext.
 */
final class Mailer
{
    /**
     * @param array<string, mixed> $connectionConfig
     * @return array{ok: bool, message_id?: string, error?: string}
     */
    public static function send(array $connectionConfig, string $to, string $subject, string $body, ?string $replyTo = null): array
    {
        $host = trim((string) ($connectionConfig['smtpHost'] ?? ''));
        $port = (int) ($connectionConfig['smtpPort'] ?? 587);
        $encryption = strtolower((string) ($connectionConfig['encryption'] ?? 'starttls'));
        if (!in_array($encryption, ['ssl', 'starttls', 'none'], true)) {
            $encryption = $port === 465 ? 'ssl' : 'starttls';
        }
        $username = (string) ($connectionConfig['username'] ?? '');
        $password = (string) ($connectionConfig['password'] ?? '');
        $fromEmail = trim((string) ($connectionConfig['fromEmail'] ?? ''));
        $fromName = trim((string) ($connectionConfig['fromName'] ?? ''));
        $cfgReply = trim((string) ($connectionConfig['replyTo'] ?? ''));
        $replyTo = $replyTo ?: ($cfgReply !== '' ? $cfgReply : null);

        if ($host === '' || $fromEmail === '' || !Security::isValidEmail($fromEmail)) {
            Response::error('Invalid SMTP from configuration', 400);
        }
        if (!Security::isValidEmail($to)) {
            Response::error('Invalid recipient email', 400);
        }
        if ($replyTo !== null && $replyTo !== '' && !Security::isValidEmail($replyTo)) {
            Response::error('Invalid reply-to email', 400);
        }
        if (strlen($subject) > 998 || preg_match('/[\r\n]/', $subject)) {
            Response::error('Invalid subject', 400);
        }
        if (strlen($body) > 200_000) {
            Response::error('Email body too large', 413);
        }

        $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
        $errno = 0;
        $errstr = '';
        $context = stream_context_create([
            'ssl' => [
                'crypto_method' => STREAM_CRYPTO_METHOD_TLS_CLIENT,
                'verify_peer' => true,
                'verify_peer_name' => true,
                'SNI_enabled' => true,
                'peer_name' => $host,
            ],
        ]);
        $fp = @stream_socket_client(
            $remote,
            $errno,
            $errstr,
            20,
            STREAM_CLIENT_CONNECT,
            $context
        );
        if (!$fp) {
            $detail = trim($errstr) !== '' ? trim($errstr) : ('errno ' . $errno);
            return [
                'ok' => false,
                'error' => 'Unable to connect to SMTP server (' . $encryption . ' ' . $host . ':' . $port . '): ' . $detail,
            ];
        }
        stream_set_timeout($fp, 20);

        $ehloHost = self::ehloHostname($fromEmail, $host);

        try {
            self::expect($fp, [220], 'greeting');
            self::cmd($fp, 'EHLO ' . $ehloHost, [250], 'EHLO');

            if ($encryption === 'starttls') {
                self::cmd($fp, 'STARTTLS', [220], 'STARTTLS');
                $crypto = stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($crypto !== true) {
                    return ['ok' => false, 'error' => 'STARTTLS negotiation failed'];
                }
                self::cmd($fp, 'EHLO ' . $ehloHost, [250], 'EHLO after STARTTLS');
            }

            if ($username !== '') {
                self::cmd($fp, 'AUTH LOGIN', [334], 'AUTH LOGIN');
                self::cmd($fp, base64_encode($username), [334], 'AUTH user');
                self::cmd($fp, base64_encode($password), [235], 'AUTH pass');
            }

            self::cmd($fp, 'MAIL FROM:<' . $fromEmail . '>', [250], 'MAIL FROM');
            self::cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251], 'RCPT TO');
            self::cmd($fp, 'DATA', [354], 'DATA');

            $fromHeader = $fromName !== ''
                ? sprintf('"%s" <%s>', addcslashes($fromName, '"\\'), $fromEmail)
                : $fromEmail;

            $messageId = sprintf('<%s@%s>', bin2hex(random_bytes(12)), preg_replace('/[^a-z0-9.-]/i', '', $host) ?: 'flowforge.local');
            $encoded = self::encodeMessageBody($body);
            $headers = [
                'Date: ' . date('r'),
                'From: ' . $fromHeader,
                'To: <' . $to . '>',
                'Subject: ' . $subject,
                'Message-ID: ' . $messageId,
                'MIME-Version: 1.0',
                ...$encoded['headers'],
                'X-Mailer: FlowForge-API/1.0',
            ];
            if ($replyTo) {
                $headers[] = 'Reply-To: <' . $replyTo . '>';
            }

            // Dot-stuff body lines
            $safeBody = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $encoded['body'])) ?? $encoded['body'];
            $payload = implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n", "\r\n", $safeBody) . "\r\n.";
            self::cmd($fp, $payload, [250], 'message body');
            self::cmd($fp, 'QUIT', [221, 250], 'QUIT');

            return ['ok' => true, 'message_id' => $messageId];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => 'SMTP transaction failed: ' . $e->getMessage()];
        } finally {
            fclose($fp);
        }
    }

    /**
     * HTML templates must be sent as text/html. Plain copy stays text/plain.
     *
     * @return array{headers: list<string>, body: string}
     */
    private static function encodeMessageBody(string $body): array
    {
        if (!self::looksLikeHtml($body)) {
            return [
                'headers' => [
                    'Content-Type: text/plain; charset=UTF-8',
                    'Content-Transfer-Encoding: 8bit',
                ],
                'body' => $body,
            ];
        }

        $boundary = 'FlowForge=_' . bin2hex(random_bytes(12));
        $plain = self::htmlToPlain($body);
        if ($plain === '') {
            $plain = 'This message is formatted in HTML.';
        }

        $parts = [
            'This is a multi-part message in MIME format.',
            '',
            '--' . $boundary,
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            $plain,
            '--' . $boundary,
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            $body,
            '--' . $boundary . '--',
            '',
        ];

        return [
            'headers' => [
                'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            ],
            'body' => implode("\n", $parts),
        ];
    }

    public static function looksLikeHtml(string $body): bool
    {
        $trim = ltrim($body);
        if ($trim === '') {
            return false;
        }
        if (preg_match('/^<!DOCTYPE\s+html\b/i', $trim) === 1) {
            return true;
        }
        if (preg_match('/^<html[\s>]/i', $trim) === 1) {
            return true;
        }
        return preg_match('/<(?:html|body|table|div|p|h[1-6]|br\s*\/?|span|td|tr|img|thead|tbody)\b/i', $trim) === 1;
    }

    private static function htmlToPlain(string $html): string
    {
        $text = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', '', $html) ?? $html;
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text) ?? $text;
        $text = preg_replace('/<\/p>/i', "\n\n", $text) ?? $text;
        $text = preg_replace('/<\/(div|h[1-6]|tr|li|table)>/i', "\n", $text) ?? $text;
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace("/[ \t]+/", ' ', $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;
        return trim($text);
    }

    private static function ehloHostname(string $fromEmail, string $smtpHost): string
    {
        $at = strrpos($fromEmail, '@');
        if ($at !== false) {
            $domain = strtolower(substr($fromEmail, $at + 1));
            if ($domain !== '' && preg_match('/^[a-z0-9.-]+$/i', $domain)) {
                return $domain;
            }
        }
        $host = strtolower($smtpHost);
        return preg_match('/^[a-z0-9.-]+$/i', $host) ? $host : 'localhost';
    }

    /** @param resource $fp @param list<int> $codes */
    private static function cmd($fp, string $command, array $codes, string $step = 'command'): void
    {
        fwrite($fp, $command . "\r\n");
        self::expect($fp, $codes, $step);
    }

    /** @param resource $fp @param list<int> $codes */
    private static function expect($fp, array $codes, string $step = 'response'): void
    {
        $response = '';
        while (($line = fgets($fp, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $codes, true)) {
            $snippet = trim(preg_replace('/\s+/', ' ', $response) ?? '');
            if (strlen($snippet) > 180) {
                $snippet = substr($snippet, 0, 177) . '...';
            }
            if ($snippet === '') {
                $snippet = '(empty response)';
            }
            throw new \RuntimeException($step . ' — unexpected SMTP response: ' . $snippet);
        }
    }
}
