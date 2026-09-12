<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Converts an OpenAPI 3.0 document into a Postman Collection v2.1.
 */
final class PostmanCollection
{
    /**
     * @param array<string, mixed> $spec
     * @return array<string, mixed>
     */
    public static function fromOpenApi(array $spec): array
    {
        $info = is_array($spec['info'] ?? null) ? $spec['info'] : [];
        $servers = is_array($spec['servers'] ?? null) ? $spec['servers'] : [];
        $baseUrl = 'https://gkjtt.co.za/flowforge/api';
        if (isset($servers[0]['url']) && is_string($servers[0]['url']) && !str_contains($servers[0]['url'], '{')) {
            $baseUrl = rtrim($servers[0]['url'], '/');
        }

        $folders = [];
        $tags = is_array($spec['tags'] ?? null) ? $spec['tags'] : [];
        foreach ($tags as $tag) {
            if (!is_array($tag) || !isset($tag['name'])) {
                continue;
            }
            $name = (string) $tag['name'];
            $folders[$name] = [
                'name' => $name,
                'description' => (string) ($tag['description'] ?? ''),
                'item' => [],
            ];
        }

        $paths = is_array($spec['paths'] ?? null) ? $spec['paths'] : [];
        foreach ($paths as $path => $methods) {
            if (!is_string($path) || !is_array($methods)) {
                continue;
            }
            foreach ($methods as $method => $op) {
                $http = strtoupper((string) $method);
                if (!in_array($http, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true) || !is_array($op)) {
                    continue;
                }
                $tag = (string) (($op['tags'][0] ?? null) ?: 'Other');
                if (!isset($folders[$tag])) {
                    $folders[$tag] = ['name' => $tag, 'item' => []];
                }
                $folders[$tag]['item'][] = self::requestItem($path, $http, $op, $spec);
            }
        }

        $items = [];
        foreach ($folders as $folder) {
            if ($folder['item'] === []) {
                continue;
            }
            $items[] = $folder;
        }

        return [
            'info' => [
                '_postman_id' => '8f0c1a2b-4d3e-4f5a-9b6c-7d8e9f0a1b2c',
                'name' => (string) ($info['title'] ?? 'FlowForge Platform API'),
                'description' => (string) ($info['description'] ?? ''),
                'schema' => 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
                'version' => (string) ($info['version'] ?? '1.0.0'),
            ],
            'auth' => [
                'type' => 'bearer',
                'bearer' => [
                    ['key' => 'token', 'value' => '{{accessToken}}', 'type' => 'string'],
                ],
            ],
            'variable' => [
                ['key' => 'baseUrl', 'value' => $baseUrl, 'type' => 'string'],
                ['key' => 'accessToken', 'value' => '', 'type' => 'string'],
                ['key' => 'organisationId', 'value' => '', 'type' => 'string'],
                ['key' => 'chatbotId', 'value' => '', 'type' => 'string'],
                ['key' => 'conversationId', 'value' => '', 'type' => 'string'],
                ['key' => 'entityId', 'value' => '', 'type' => 'string'],
            ],
            'item' => $items,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function environment(string $baseUrl = 'https://gkjtt.co.za/flowforge/api'): array
    {
        $keys = [
            'baseUrl' => ['value' => $baseUrl, 'description' => 'PHP API origin, no trailing slash'],
            'accessToken' => [
                'value' => '',
                'description' => 'Platform API token (ffpat_…) from Admin → Security, or a short-lived session JWT. Not anon/service_role.',
            ],
            'organisationId' => ['value' => '', 'description' => 'From GET /v1/me or /v1/organisations'],
            'chatbotId' => ['value' => '', 'description' => 'From GET /v1/organisations/{id}/chatbots'],
            'conversationId' => ['value' => '', 'description' => 'From a conversations list'],
            'entityId' => ['value' => '', 'description' => 'From GET /v1/chatbots/{id}/entities'],
        ];
        $values = [];
        foreach ($keys as $key => $meta) {
            $values[] = [
                'key' => $key,
                'value' => $meta['value'],
                'description' => $meta['description'],
                'enabled' => true,
                'type' => 'default',
            ];
        }

        return [
            'id' => 'c3d4e5f6-7a8b-4c9d-0e1f-2a3b4c5d6e7f',
            'name' => 'FlowForge Platform API',
            'values' => $values,
            '_postman_variable_scope' => 'environment',
        ];
    }

    /**
     * @param array<string, mixed> $op
     * @param array<string, mixed> $spec
     * @return array<string, mixed>
     */
    private static function requestItem(string $path, string $method, array $op, array $spec): array
    {
        $name = (string) ($op['summary'] ?? ($method . ' ' . $path));
        $url = self::postmanUrl($path, $op);
        $headers = [];
        $body = null;
        $auth = self::requestAuth($op);

        $requestBody = is_array($op['requestBody'] ?? null) ? $op['requestBody'] : null;
        if ($requestBody !== null) {
            $content = is_array($requestBody['content'] ?? null) ? $requestBody['content'] : [];
            if (isset($content['application/json'])) {
                $headers[] = ['key' => 'Content-Type', 'value' => 'application/json'];
                $media = is_array($content['application/json']) ? $content['application/json'] : [];
                $example = self::exampleFromMedia($media, $spec);
                $body = [
                    'mode' => 'raw',
                    'raw' => json_encode($example, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}',
                    'options' => ['raw' => ['language' => 'json']],
                ];
            } elseif (isset($content['multipart/form-data'])) {
                $media = is_array($content['multipart/form-data']) ? $content['multipart/form-data'] : [];
                $body = [
                    'mode' => 'formdata',
                    'formdata' => self::formDataFromSchema($media, $spec),
                ];
            } elseif (isset($content['application/x-www-form-urlencoded'])) {
                $media = is_array($content['application/x-www-form-urlencoded']) ? $content['application/x-www-form-urlencoded'] : [];
                $example = self::exampleFromMedia($media, $spec);
                $urlencoded = [];
                if (is_array($example)) {
                    foreach ($example as $key => $value) {
                        $urlencoded[] = [
                            'key' => (string) $key,
                            'value' => is_scalar($value) ? (string) $value : json_encode($value),
                            'type' => 'text',
                        ];
                    }
                }
                $body = ['mode' => 'urlencoded', 'urlencoded' => $urlencoded];
            }
        }

        $request = [
            'method' => $method,
            'header' => $headers,
            'url' => $url,
            'description' => (string) ($op['description'] ?? ''),
        ];
        if ($body !== null) {
            $request['body'] = $body;
        }
        if ($auth !== null) {
            $request['auth'] = $auth;
        }

        return [
            'name' => $name,
            'request' => $request,
            'response' => [],
        ];
    }

    /**
     * @param array<string, mixed> $op
     * @return array<string, mixed>|null
     */
    private static function requestAuth(array $op): ?array
    {
        if (array_key_exists('security', $op) && $op['security'] === []) {
            return ['type' => 'noauth'];
        }
        $schemes = is_array($op['security'] ?? null) ? $op['security'] : [];
        $hasJwt = false;
        $hasSessionOnly = false;
        foreach ($schemes as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            if (isset($entry['jwt'])) {
                $hasJwt = true;
            }
            if (isset($entry['session'])) {
                $hasSessionOnly = true;
            }
            if (isset($entry['alertsCron'])) {
                return [
                    'type' => 'bearer',
                    'bearer' => [
                        ['key' => 'token', 'value' => '{{alertsCronSecret}}', 'type' => 'string'],
                    ],
                ];
            }
            if (isset($entry['scimToken'])) {
                return [
                    'type' => 'bearer',
                    'bearer' => [
                        ['key' => 'token', 'value' => '{{scimToken}}', 'type' => 'string'],
                    ],
                ];
            }
        }
        if ($hasSessionOnly && !$hasJwt) {
            return ['type' => 'noauth'];
        }
        return null;
    }

    /**
     * @param array<string, mixed> $op
     * @return array<string, mixed>
     */
    private static function postmanUrl(string $path, array $op): array
    {
        $pathForJoin = $path === '/' ? '' : $path;
        $raw = '{{baseUrl}}' . $pathForJoin;
        $segments = $path === '/' ? [] : array_values(array_filter(explode('/', trim($path, '/')), static fn ($s) => $s !== ''));
        $variables = [];
        $query = [];
        $params = is_array($op['parameters'] ?? null) ? $op['parameters'] : [];
        foreach ($params as $param) {
            if (!is_array($param)) {
                continue;
            }
            $name = (string) ($param['name'] ?? '');
            $in = (string) ($param['in'] ?? '');
            if ($name === '') {
                continue;
            }
            if ($in === 'path') {
                $token = '{{' . $name . '}}';
                $raw = str_replace('{' . $name . '}', $token, $raw);
                $segments = array_map(
                    static fn ($s) => $s === '{' . $name . '}' ? $token : $s,
                    $segments,
                );
                $variables[] = [
                    'key' => $name,
                    'value' => $token,
                    'description' => (string) ($param['description'] ?? ''),
                ];
            }
            if ($in === 'query') {
                $example = $param['example'] ?? ($param['schema']['example'] ?? '');
                if ($name === 'instance_id') {
                    $example = '{{instanceId}}';
                } elseif ($name === 'chatbot_id') {
                    $example = '{{chatbotId}}';
                } elseif ($name === 'session_id') {
                    $example = '{{sessionId}}';
                } elseif ($name === 'slug') {
                    $example = '{{slug}}';
                } elseif ($name === 'secret') {
                    $example = '{{alertsCronSecret}}';
                }
                $query[] = [
                    'key' => $name,
                    'value' => is_scalar($example) ? (string) $example : '',
                    'description' => (string) ($param['description'] ?? ''),
                    'disabled' => empty($param['required']),
                ];
            }
        }

        $url = [
            'raw' => $raw,
            'host' => ['{{baseUrl}}'],
            'path' => $segments,
        ];
        if ($query) {
            $url['query'] = $query;
        }
        if ($variables) {
            $url['variable'] = $variables;
        }
        return $url;
    }

    /**
     * @param array<string, mixed> $media
     * @param array<string, mixed> $spec
     * @return mixed
     */
    private static function exampleFromMedia(array $media, array $spec): mixed
    {
        if (array_key_exists('example', $media)) {
            return $media['example'];
        }
        $examples = is_array($media['examples'] ?? null) ? $media['examples'] : [];
        foreach ($examples as $ex) {
            if (is_array($ex) && array_key_exists('value', $ex)) {
                return $ex['value'];
            }
        }
        $schema = is_array($media['schema'] ?? null) ? $media['schema'] : [];
        return self::exampleFromSchema($schema, $spec);
    }

    /**
     * @param array<string, mixed> $schema
     * @param array<string, mixed> $spec
     * @return mixed
     */
    private static function exampleFromSchema(array $schema, array $spec): mixed
    {
        if (isset($schema['$ref']) && is_string($schema['$ref'])) {
            $resolved = self::resolveRef($schema['$ref'], $spec);
            return self::exampleFromSchema($resolved, $spec);
        }
        if (array_key_exists('example', $schema)) {
            return $schema['example'];
        }
        $type = (string) ($schema['type'] ?? 'object');
        if ($type === 'array') {
            $items = is_array($schema['items'] ?? null) ? $schema['items'] : [];
            return [self::exampleFromSchema($items, $spec)];
        }
        if ($type !== 'object') {
            return $schema['default'] ?? match ($type) {
                'integer', 'number' => 0,
                'boolean' => false,
                default => '',
            };
        }
        $props = is_array($schema['properties'] ?? null) ? $schema['properties'] : [];
        $out = [];
        foreach ($props as $name => $prop) {
            if (!is_string($name) || !is_array($prop)) {
                continue;
            }
            $out[$name] = self::exampleFromSchema($prop, $spec);
        }
        return $out;
    }

    /**
     * @param array<string, mixed> $media
     * @param array<string, mixed> $spec
     * @return list<array<string, mixed>>
     */
    private static function formDataFromSchema(array $media, array $spec): array
    {
        $schema = is_array($media['schema'] ?? null) ? $media['schema'] : [];
        if (isset($schema['$ref']) && is_string($schema['$ref'])) {
            $schema = self::resolveRef($schema['$ref'], $spec);
        }
        $props = is_array($schema['properties'] ?? null) ? $schema['properties'] : [];
        $rows = [];
        foreach ($props as $name => $prop) {
            if (!is_string($name) || !is_array($prop)) {
                continue;
            }
            $format = (string) ($prop['format'] ?? '');
            $example = $prop['example'] ?? '';
            if ($name === 'instance_id') {
                $example = '{{instanceId}}';
            } elseif ($name === 'chatbot_id') {
                $example = '{{chatbotId}}';
            } elseif ($name === 'session_id') {
                $example = '{{sessionId}}';
            }
            $rows[] = [
                'key' => $name,
                'type' => $format === 'binary' ? 'file' : 'text',
                'src' => $format === 'binary' ? [] : null,
                'value' => $format === 'binary' ? '' : (is_scalar($example) ? (string) $example : ''),
                'description' => (string) ($prop['description'] ?? ''),
            ];
        }
        return $rows;
    }

    /**
     * @param array<string, mixed> $spec
     * @return array<string, mixed>
     */
    private static function resolveRef(string $ref, array $spec): array
    {
        if (!str_starts_with($ref, '#/')) {
            return [];
        }
        $parts = explode('/', substr($ref, 2));
        $node = $spec;
        foreach ($parts as $part) {
            $part = str_replace('~1', '/', str_replace('~0', '~', $part));
            if (!is_array($node) || !array_key_exists($part, $node) || !is_array($node[$part])) {
                return [];
            }
            $node = $node[$part];
        }
        return $node;
    }
}
