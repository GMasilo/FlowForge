<?php
declare(strict_types=1);

/**
 * @param array{base:string,timeout:int} $ctx
 * @return array{passed:int,failed:int,failures:list<string>}
 */
return static function (array $ctx): array {
    $base = rtrim($ctx['base'], '/');
    $timeout = (int) $ctx['timeout'];

    fwrite(STDOUT, "\n== HttpClient scenarios ==\n");

    $ok = \FlowForge\Api\HttpClient::request('GET', $base . '/ok', [], null, $timeout, 1_048_576);
    \FlowForge\Api\Test\Assert::true($ok['ok'] && $ok['status'] === 200, 'GET /ok succeeds');
    \FlowForge\Api\Test\Assert::same('hello', $ok['body']['message'] ?? null, 'GET /ok message');

    $fail = \FlowForge\Api\HttpClient::request('GET', $base . '/fail', [], null, $timeout, 1_048_576);
    \FlowForge\Api\Test\Assert::true(!$fail['ok'] && $fail['status'] === 401, 'GET /fail is not ok');

    $echo = \FlowForge\Api\HttpClient::request(
        'POST',
        $base . '/echo',
        ['Content-Type' => 'application/json', 'X-Trace' => 'flowforge-test'],
        json_encode(['hello' => 'world'], JSON_UNESCAPED_UNICODE),
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true($echo['ok'], 'POST /echo succeeds');
    \FlowForge\Api\Test\Assert::same(['hello' => 'world'], $echo['body']['received'] ?? null, 'echo returns body');

    $bearerConn = [
        'authType' => 'bearer',
        'bearerToken' => 'test-bearer-token',
        'headers' => [['key' => 'X-Custom', 'value' => 'abc']],
    ];
    $headers = \FlowForge\Api\HttpClient::buildAuthHeaders($bearerConn);
    \FlowForge\Api\Test\Assert::same('Bearer test-bearer-token', $headers['Authorization'] ?? null, 'bearer auth header');
    \FlowForge\Api\Test\Assert::same('abc', $headers['X-Custom'] ?? null, 'extra connection header');

    $headerCheck = \FlowForge\Api\HttpClient::request(
        'GET',
        $base . '/headers-check',
        $headers,
        null,
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::true($headerCheck['ok'], 'GET /headers-check succeeds');
    \FlowForge\Api\Test\Assert::same(
        'Bearer test-bearer-token',
        $headerCheck['body']['authorization'] ?? null,
        'upstream receives Authorization',
    );

    $apiKeyConn = [
        'authType' => 'api_key',
        'apiKeyHeader' => 'X-API-Key',
        'apiKey' => 'key-123',
    ];
    $apiHeaders = \FlowForge\Api\HttpClient::buildAuthHeaders($apiKeyConn);
    $apiCheck = \FlowForge\Api\HttpClient::request(
        'GET',
        $base . '/headers-check',
        $apiHeaders,
        null,
        $timeout,
        1_048_576,
    );
    \FlowForge\Api\Test\Assert::same('key-123', $apiCheck['body']['x_api_key'] ?? null, 'upstream receives API key header');

    $basicConn = [
        'authType' => 'basic',
        'username' => 'user',
        'password' => 'pass',
    ];
    $basicHeaders = \FlowForge\Api\HttpClient::buildAuthHeaders($basicConn);
    \FlowForge\Api\Test\Assert::same(
        'Basic ' . base64_encode('user:pass'),
        $basicHeaders['Authorization'] ?? null,
        'basic auth header',
    );

    return \FlowForge\Api\Test\Assert::summary();
};
