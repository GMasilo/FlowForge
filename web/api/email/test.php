<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\Response;
use FlowForge\Api\Security;

$boot = flowforge_bootstrap(['POST']);
$body = Security::readJsonBody();

$connection = $body['connection'] ?? null;
if (!is_array($connection)) {
    Response::error('Missing connection config', 400);
}

$host = trim((string) ($connection['smtpHost'] ?? ''));
$port = (int) ($connection['smtpPort'] ?? 587);
$encryption = strtolower((string) ($connection['encryption'] ?? 'starttls'));
$username = (string) ($connection['username'] ?? '');
$password = (string) ($connection['password'] ?? '');

if ($host === '') {
    Response::error('SMTP host is required', 400);
}

$remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
$errno = 0;
$errstr = '';
$fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
if (!$fp) {
    Response::json(['ok' => false, 'error' => 'Unable to connect to SMTP server'], 502);
}

stream_set_timeout($fp, 15);

try {
    $read = static function () use ($fp): string {
        $response = '';
        while (($line = fgets($fp, 515)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $response;
    };
    $write = static function (string $cmd) use ($fp, $read): string {
        fwrite($fp, $cmd . "\r\n");
        return $read();
    };

    $greeting = $read();
    if ((int) substr($greeting, 0, 3) !== 220) {
        Response::json(['ok' => false, 'error' => 'Unexpected SMTP greeting'], 502);
    }

    $ehlo = $write('EHLO flowforge.local');
    if ((int) substr($ehlo, 0, 3) !== 250) {
        Response::json(['ok' => false, 'error' => 'EHLO failed'], 502);
    }

    if ($encryption === 'starttls') {
        $tls = $write('STARTTLS');
        if ((int) substr($tls, 0, 3) !== 220) {
            Response::json(['ok' => false, 'error' => 'STARTTLS not accepted'], 502);
        }
        if (stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT) !== true) {
            Response::json(['ok' => false, 'error' => 'TLS negotiation failed'], 502);
        }
        $write('EHLO flowforge.local');
    }

    if ($username !== '') {
        $auth = $write('AUTH LOGIN');
        if ((int) substr($auth, 0, 3) !== 334) {
            Response::json(['ok' => false, 'error' => 'AUTH LOGIN not accepted'], 502);
        }
        $u = $write(base64_encode($username));
        if ((int) substr($u, 0, 3) !== 334) {
            Response::json(['ok' => false, 'error' => 'SMTP username rejected'], 502);
        }
        $p = $write(base64_encode($password));
        if ((int) substr($p, 0, 3) !== 235) {
            Response::json(['ok' => false, 'error' => 'SMTP authentication failed'], 502);
        }
    }

    $write('QUIT');
    Response::json([
        'ok' => true,
        'message' => 'SMTP connection and authentication succeeded',
        'host' => $host,
        'port' => $port,
        'encryption' => $encryption,
    ]);
} catch (Throwable $e) {
    Response::json(['ok' => false, 'error' => 'SMTP test failed'], 502);
} finally {
    if (is_resource($fp)) {
        fclose($fp);
    }
}
