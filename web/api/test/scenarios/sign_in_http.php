<?php
declare(strict_types=1);

/**
 * @param array{base:string,timeout:int} $ctx
 * @return array{passed:int,failed:int,failures:list<string>}
 */
return static function (array $ctx): array {
    $base = rtrim($ctx['base'], '/');
    $timeout = (int) $ctx['timeout'];

    fwrite(STDOUT, "\n== Sign-in HTTP scenarios ==\n");

    // Default field names: email + password
    $defaultBody = \FlowForge\Api\Test\build_sign_in_request_body([], 'alice@example.com', 'secret');
    \FlowForge\Api\Test\Assert::same(
        ['email' => 'alice@example.com', 'password' => 'secret'],
        $defaultBody,
        'default body uses email/password keys',
    );

    $result = \FlowForge\Api\HttpClient::request(
        'POST',
        $base . '/auth/login',
        ['Content-Type' => 'application/json'],
        json_encode($defaultBody, JSON_UNESCAPED_UNICODE),
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true($result['ok'], 'POST /auth/login succeeds with default body');
    \FlowForge\Api\Test\Assert::same(200, $result['status'], 'login status 200');
    \FlowForge\Api\Test\Assert::true(is_array($result['body']), 'login returns JSON object');
    \FlowForge\Api\Test\Assert::notEmpty($result['body']['token'] ?? null, 'login returns token');
    \FlowForge\Api\Test\Assert::same(
        'alice@example.com',
        $result['body']['user']['email'] ?? null,
        'login returns user.email',
    );

    $bad = \FlowForge\Api\HttpClient::request(
        'POST',
        $base . '/auth/login',
        ['Content-Type' => 'application/json'],
        json_encode(['email' => 'alice@example.com', 'password' => 'wrong'], JSON_UNESCAPED_UNICODE),
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true(!$bad['ok'] && $bad['status'] === 401, 'wrong password yields 401');

    $mappedCfg = ['requestEmailKey' => 'username', 'requestPasswordKey' => 'pass'];
    $mappedBody = \FlowForge\Api\Test\build_sign_in_request_body($mappedCfg, 'bob@example.com', 'hunter2');
    \FlowForge\Api\Test\Assert::same(
        ['username' => 'bob@example.com', 'pass' => 'hunter2'],
        $mappedBody,
        'mapped body remaps email→username and password→pass',
    );

    $mapped = \FlowForge\Api\HttpClient::request(
        'POST',
        $base . '/auth/login-mapped',
        ['Content-Type' => 'application/json'],
        json_encode($mappedBody, JSON_UNESCAPED_UNICODE),
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true($mapped['ok'], 'POST /auth/login-mapped succeeds with mapped keys');
    \FlowForge\Api\Test\Assert::notEmpty($mapped['body']['token'] ?? null, 'mapped login returns token');

    $reject = \FlowForge\Api\HttpClient::request(
        'POST',
        $base . '/auth/login-mapped',
        ['Content-Type' => 'application/json'],
        json_encode(['email' => 'bob@example.com', 'password' => 'hunter2'], JSON_UNESCAPED_UNICODE),
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true(
        !$reject['ok'] && $reject['status'] === 400,
        'mapped endpoint rejects default email/password keys',
    );

    $nestedCfg = [
        'requestBody' => '{"login":{"user":"{{email}}","secret":"{{password}}"}}',
    ];
    $nestedBody = \FlowForge\Api\Test\build_sign_in_request_body($nestedCfg, 'cara@example.com', 's3cret', 'https://example.com/profile.jpg');
    \FlowForge\Api\Test\Assert::same(
        ['login' => ['user' => 'cara@example.com', 'secret' => 's3cret', 'profileImg' => 'https://example.com/profile.jpg']],
        $nestedBody,
        'requestBody template builds nested login object',
    );

    $nested = \FlowForge\Api\HttpClient::request(
        'POST',
        $base . '/auth/login-nested',
        ['Content-Type' => 'application/json'],
        json_encode($nestedBody, JSON_UNESCAPED_UNICODE),
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true($nested['ok'], 'POST /auth/login-nested succeeds with template body');
    \FlowForge\Api\Test\Assert::same('nested-token', $nested['body']['token'] ?? null, 'nested login returns token');

    return \FlowForge\Api\Test\Assert::summary();
};
