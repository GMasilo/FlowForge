<?php
declare(strict_types=1);

/**
 * Offline checks for the Platform OpenAPI spec and Postman collection.
 *
 * @param array{base:string,timeout:int} $ctx
 * @return array{passed:int,failed:int,failures:list<string>}
 */
return static function (array $ctx): array {
    unset($ctx);
    fwrite(STDOUT, "\n== OpenAPI / Postman spec ==\n");

    $root = dirname(__DIR__, 2);
    require_once $root . '/lib/OpenApiSpec.php';
    require_once $root . '/lib/PostmanCollection.php';

    $spec = \FlowForge\Api\OpenApiSpec::document();

    \FlowForge\Api\Test\Assert::same(
        '3.0.3',
        $spec['openapi'] ?? null,
        'openapi version is 3.0.3',
    );
    \FlowForge\Api\Test\Assert::same(
        'FlowForge Platform API',
        $spec['info']['title'] ?? null,
        'spec title',
    );

    $requiredPaths = [
        '/v1',
        '/v1/me',
        '/v1/organisations',
        '/v1/organisations/{organisationId}',
        '/v1/organisations/{organisationId}/chatbots',
        '/v1/organisations/{organisationId}/conversations',
        '/v1/organisations/{organisationId}/analytics',
        '/v1/chatbots/{chatbotId}',
        '/v1/chatbots/{chatbotId}/flow',
        '/v1/chatbots/{chatbotId}/export',
        '/v1/chatbots/{chatbotId}/media',
        '/v1/chatbots/{chatbotId}/templates',
        '/v1/chatbots/{chatbotId}/variables',
        '/v1/chatbots/{chatbotId}/entities',
        '/v1/chatbots/{chatbotId}/conversations',
        '/v1/chatbots/{chatbotId}/analytics',
        '/v1/conversations/{conversationId}',
        '/v1/conversations/{conversationId}/events',
        '/v1/conversations/{conversationId}/files',
        '/openapi.json',
        '/postman.json',
        '/docs',
    ];
    foreach ($requiredPaths as $path) {
        \FlowForge\Api\Test\Assert::same(
            true,
            isset($spec['paths'][$path]),
            "path {$path} is documented",
        );
    }

    $encoded = json_encode($spec);
    \FlowForge\Api\Test\Assert::same(
        true,
        is_string($encoded) && $encoded !== '',
        'spec JSON-encodes',
    );

    $decoded = json_decode((string) $encoded, true);
    \FlowForge\Api\Test\Assert::same(
        true,
        is_array($decoded) && ($decoded['openapi'] ?? null) === '3.0.3',
        'spec round-trips through JSON',
    );

    $collection = \FlowForge\Api\PostmanCollection::fromOpenApi($spec);
    \FlowForge\Api\Test\Assert::same(
        'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        $collection['info']['schema'] ?? null,
        'Postman collection schema v2.1',
    );

    $requests = 0;
    foreach ($collection['item'] as $folder) {
        $requests += is_array($folder['item'] ?? null) ? count($folder['item']) : 0;
    }
    \FlowForge\Api\Test\Assert::same(
        true,
        $requests >= 25,
        "Postman collection has requests (got {$requests})",
    );

    $env = \FlowForge\Api\PostmanCollection::environment();
    $keys = array_map(static fn ($row) => $row['key'] ?? '', $env['values'] ?? []);
    \FlowForge\Api\Test\Assert::same(
        true,
        in_array('baseUrl', $keys, true) && in_array('accessToken', $keys, true),
        'Postman environment includes baseUrl and accessToken',
    );

    $info = (string) ($spec['info']['description'] ?? '');
    \FlowForge\Api\Test\Assert::same(
        true,
        str_contains($info, '/docs/api') && str_contains($info, 'Bearer'),
        'spec explains where to copy the session token',
    );
    \FlowForge\Api\Test\Assert::same(
        true,
        str_contains($info, 'ffpat_'),
        'spec documents long-lived Platform API tokens',
    );

    require_once $root . '/lib/Auth.php';
    \FlowForge\Api\Test\Assert::same(
        true,
        \FlowForge\Api\Auth::looksLikePlatformApiToken('ffpat_' . str_repeat('ab', 16)),
        'ffpat_ prefix is recognized as a platform token',
    );
    \FlowForge\Api\Test\Assert::same(
        false,
        \FlowForge\Api\Auth::looksLikePlatformApiToken('eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.e30.sig'),
        'session JWT is not treated as a platform token',
    );

    return \FlowForge\Api\Test\Assert::summary();
};
