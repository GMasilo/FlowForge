<?php
declare(strict_types=1);

/**
 * Mock upstream for FlowForge API HTTP tests.
 *
 * Local:
 *   php -S 127.0.0.1:8099 -t . mock-upstream.php
 * from this directory (web/api/test).
 *
 * Hosted (Apache): deploy web/api/ under /flowforge/api/ so routes are:
 *   https://gkjtt.co.za/flowforge/api/test/auth/login
 *   https://gkjtt.co.za/flowforge/api/test/health
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
// Strip common deploy prefixes so route matching stays at /auth/login, /health, …
foreach (['/flowforge/api/test', '/api/test', '/test'] as $prefix) {
    if (strncmp($path, $prefix, strlen($prefix)) === 0) {
        $path = substr($path, strlen($prefix)) ?: '/';
        break;
    }
}
if (preg_match('#/mock-upstream\\.php(/.*)?$#', $path, $m) === 1) {
    $path = isset($m[1]) && $m[1] !== '' ? $m[1] : '/';
}
if ($path === '') {
    $path = '/';
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$raw = file_get_contents('php://input') ?: '';
$json = json_decode($raw, true);
$body = is_array($json) ? $json : [];

header('Content-Type: application/json; charset=utf-8');
header('X-Mock-Upstream: flowforge-test');

$respond = static function (int $status, array $payload) use ($method, $path): void {
    http_response_code($status);
    echo json_encode(
        array_merge(
            [
                '_mock' => true,
                '_request' => [
                    'method' => $method,
                    'path' => $path,
                ],
            ],
            $payload,
        ),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
    );
    exit;
};

if ($method === 'GET' && $path === '/health') {
    $respond(200, ['ok' => true, 'service' => 'mock-upstream']);
}

if ($method === 'GET' && $path === '/ok') {
    $respond(200, ['ok' => true, 'message' => 'hello']);
}

if ($method === 'GET' && $path === '/fail') {
    $respond(401, ['ok' => false, 'error' => 'unauthorized']);
}

if ($method === 'GET' && $path === '/not-found') {
    $respond(404, ['ok' => false, 'error' => 'missing']);
}

if ($method === 'POST' && $path === '/echo') {
    $respond(200, [
        'ok' => true,
        'received' => $body,
        'raw' => $raw,
        'headers' => [
            'authorization' => $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            'x-api-key' => $_SERVER['HTTP_X_API_KEY'] ?? null,
            'content-type' => $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? null),
        ],
    ]);
}

/**
 * Default Sign-in shape used by FlowForge when field names are left as email/password.
 * POST /auth/login  body: { "email": "...", "password": "..." }
 */
if ($method === 'POST' && $path === '/auth/login') {
    $email = (string) ($body['email'] ?? '');
    $password = (string) ($body['password'] ?? '');
    if ($email === '' || $password === '') {
        $respond(400, [
            'ok' => false,
            'error' => 'email and password are required',
            'received_keys' => array_keys($body),
        ]);
    }
    if ($email === 'fail@example.com' || $password === 'wrong') {
        $respond(401, ['ok' => false, 'error' => 'invalid_credentials']);
    }
    $respond(200, [
        'ok' => true,
        'token' => 'mock-token-' . substr(hash('sha256', $email . ':' . $password), 0, 16),
        'user' => [
            'id' => 'user_' . substr(md5($email), 0, 8),
            'email' => $email,
            'name' => 'Mock User',
        ],
    ]);
}

/**
 * Mapped Sign-in shape (email→username, password→pass).
 * POST /auth/login-mapped  body: { "username": "...", "pass": "..." }
 */
if ($method === 'POST' && $path === '/auth/login-mapped') {
    $username = (string) ($body['username'] ?? '');
    $pass = (string) ($body['pass'] ?? '');
    if ($username === '' || $pass === '') {
        $respond(400, [
            'ok' => false,
            'error' => 'username and pass are required',
            'received_keys' => array_keys($body),
            'hint' => 'Use Sign-in requestEmailKey=username and requestPasswordKey=pass, or a requestBody template.',
        ]);
    }
    if (isset($body['email']) || isset($body['password'])) {
        $respond(400, [
            'ok' => false,
            'error' => 'unexpected_default_fields',
            'hint' => 'This endpoint rejects email/password keys — map fields on the Sign-in step.',
            'received_keys' => array_keys($body),
        ]);
    }
    if ($pass === 'wrong') {
        $respond(401, ['ok' => false, 'error' => 'invalid_credentials']);
    }
    $respond(200, [
        'ok' => true,
        'token' => 'mapped-token-' . substr(hash('sha256', $username . ':' . $pass), 0, 16),
        'user' => [
            'id' => 'mapped_' . substr(md5($username), 0, 8),
            'email' => $username,
        ],
    ]);
}

/**
 * Custom JSON template shape: {"login":{"user":"...","secret":"..."}}
 */
if ($method === 'POST' && $path === '/auth/login-nested') {
    $login = $body['login'] ?? null;
    if (!is_array($login)) {
        $respond(400, ['ok' => false, 'error' => 'login object required', 'received_keys' => array_keys($body)]);
    }
    $user = (string) ($login['user'] ?? '');
    $secret = (string) ($login['secret'] ?? '');
    if ($user === '' || $secret === '') {
        $respond(400, ['ok' => false, 'error' => 'login.user and login.secret required']);
    }
    $respond(200, [
        'ok' => true,
        'token' => 'nested-token',
        'user' => ['id' => 'nested_1', 'email' => $user, 'profileImg' => 'https://example.com/profile.jpg'],
    ]);
}

if ($method === 'GET' && $path === '/headers-check') {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
    $respond(200, [
        'ok' => true,
        'authorization' => $auth !== '' ? $auth : null,
        'x_api_key' => $apiKey !== '' ? $apiKey : null,
    ]);
}

$respond(404, [
    'ok' => false,
    'error' => 'Unknown mock route',
    'path' => $path,
    'method' => $method,
    'routes' => [
        'GET /health',
        'GET /ok',
        'GET /fail',
        'GET /not-found',
        'GET /headers-check',
        'POST /echo',
        'POST /auth/login',
        'POST /auth/login-mapped',
        'POST /auth/login-nested',
    ],
]);
