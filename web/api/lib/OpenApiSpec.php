<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * OpenAPI 3.0.3 for the FlowForge Platform data API (/v1).
 * Chatbots, published flow JSON, conversations, analytics, media, templates, entities.
 */
final class OpenApiSpec
{
    public const VERSION = '1.0.0';

    /** @return array<string, mixed> */
    public static function document(): array
    {
        return [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'FlowForge Platform API',
                'version' => self::VERSION,
                'description' => <<<'MD'
Read chatbot-rich organisation data: chatbots, published/staging flow JSON, full flow export packs, media, templates, entities, conversations (with transcripts), and analytics.

**Import into Postman:** File → Import → `openapi.json` (or `postman.json` + environment). Set `baseUrl` and `accessToken`.

**Where to get a token:** Organisation owners/admins create a long-lived Platform API token on Admin → Security (`ffpat_…`, shown once). Send `Authorization: Bearer <token>`. The PHP API verifies it, then reads the database with the service_role key — never send anon/service_role yourself. Session JWTs from `/docs/api` still work for interactive Postman use but expire. Tokens are scoped to one organisation.

**Pagination:** `limit` (default 50, max 200) and `offset`. List responses include `total` when available.

**Errors:** `{ "ok": false, "error": "…" }`.
MD,
                'contact' => [
                    'name' => 'FlowForge',
                    'url' => 'https://gkjtt.co.za/flowforge/docs/api',
                ],
            ],
            'servers' => [
                [
                    'url' => 'https://gkjtt.co.za/flowforge/api',
                    'description' => 'Production',
                ],
                [
                    'url' => '{baseUrl}',
                    'description' => 'Custom',
                    'variables' => [
                        'baseUrl' => ['default' => 'https://gkjtt.co.za/flowforge/api'],
                    ],
                ],
            ],
            'tags' => [
                ['name' => 'Documentation', 'description' => 'OpenAPI and Postman artifacts'],
                ['name' => 'Account', 'description' => 'Current user and organisation memberships'],
                ['name' => 'Organisations', 'description' => 'Tenants the caller can access'],
                ['name' => 'Chatbots', 'description' => 'Chatbot records, flow JSON, export, media, templates, entities'],
                ['name' => 'Conversations', 'description' => 'Sessions, transcripts, conversation files'],
                ['name' => 'Analytics', 'description' => 'Volume, completion, drop-off'],
            ],
            'security' => [['jwt' => []]],
            'paths' => self::paths(),
            'components' => self::components(),
        ];
    }

    /** @return array<string, mixed> */
    private static function paths(): array
    {
        $err = [
            '400' => ['$ref' => '#/components/responses/BadRequest'],
            '401' => ['$ref' => '#/components/responses/Unauthorized'],
            '403' => ['$ref' => '#/components/responses/Forbidden'],
            '404' => ['$ref' => '#/components/responses/NotFound'],
            '429' => ['$ref' => '#/components/responses/RateLimited'],
        ];
        $page = [
            self::q('limit', 'Page size (default 50, max 200)', false, '50'),
            self::q('offset', 'Offset', false, '0'),
        ];

        return [
            '/openapi.json' => [
                'get' => self::op('getOpenApi', 'OpenAPI specification', 'Import this JSON into Postman (File → Import).', ['Documentation'], [
                    'security' => [],
                    'responses' => ['200' => ['description' => 'OpenAPI 3.0.3', 'content' => ['application/json' => ['schema' => ['type' => 'object']]]]],
                ]),
            ],
            '/postman.json' => [
                'get' => self::op('getPostmanCollection', 'Postman Collection v2.1', 'Ready-made collection generated from this spec.', ['Documentation'], [
                    'security' => [],
                    'responses' => ['200' => ['description' => 'Postman Collection']],
                ]),
            ],
            '/postman-environment.json' => [
                'get' => self::op('getPostmanEnvironment', 'Postman Environment', 'Variables: baseUrl, accessToken, organisationId, chatbotId, conversationId.', ['Documentation'], [
                    'security' => [],
                    'responses' => ['200' => ['description' => 'Postman Environment']],
                ]),
            ],
            '/docs' => [
                'get' => self::op('getApiDocs', 'Interactive docs (HTML)', 'Redoc HTML for this spec.', ['Documentation'], [
                    'security' => [],
                    'responses' => ['200' => ['description' => 'HTML']],
                ]),
            ],
            '/v1' => [
                'get' => self::op('v1Index', 'API catalog', 'Lists v1 resource paths.', ['Account'], [
                    'responses' => array_merge($err, ['200' => self::jsonOk(['ok' => true, 'service' => 'flowforge-platform-v1'])]),
                ]),
            ],
            '/v1/me' => [
                'get' => self::op('getMe', 'Current user', 'Caller identity plus organisations and roles.', ['Account'], [
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'User + memberships',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Me']]],
                    ]]),
                ]),
            ],
            '/v1/organisations' => [
                'get' => self::op('listOrganisations', 'List organisations', 'Organisations the caller belongs to.', ['Organisations'], [
                    'parameters' => $page,
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Organisation list',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/OrganisationList']]],
                    ]]),
                ]),
            ],
            '/v1/organisations/{organisationId}' => [
                'get' => self::op('getOrganisation', 'Get organisation', 'Profile for one organisation.', ['Organisations'], [
                    'parameters' => [self::pathId('organisationId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Organisation',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/OrganisationResponse']]],
                    ]]),
                ]),
            ],
            '/v1/organisations/{organisationId}/chatbots' => [
                'get' => self::op('listOrgChatbots', 'List chatbots', 'Chatbots in the organisation (excludes recycle-bin unless include_deleted=1).', ['Chatbots'], [
                    'parameters' => array_merge([self::pathId('organisationId')], $page, [
                        self::q('q', 'Name search', false, 'support'),
                        self::q('include_deleted', 'Set 1 to include recycle-bin bots', false, '0'),
                    ]),
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Chatbot list',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/ChatbotList']]],
                    ]]),
                ]),
            ],
            '/v1/organisations/{organisationId}/conversations' => [
                'get' => self::op('listOrgConversations', 'List conversations', 'Sessions across chatbots. Filter by status, environment, from, to.', ['Conversations'], [
                    'parameters' => array_merge([self::pathId('organisationId')], $page, self::conversationFilters()),
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Conversation list',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/ConversationList']]],
                    ]]),
                ]),
            ],
            '/v1/organisations/{organisationId}/analytics' => [
                'get' => self::op('orgAnalytics', 'Organisation analytics', 'Session volume, completion, drop-off, by chatbot and by day.', ['Analytics'], [
                    'parameters' => [
                        self::pathId('organisationId'),
                        self::q('days', 'Lookback days (default 30, max 365)', false, '30'),
                        self::q('environment', 'production or staging', false, 'production'),
                    ],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Analytics summary',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/AnalyticsResponse']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}' => [
                'get' => self::op('getChatbot', 'Get chatbot', 'Chatbot record including settings JSON (no staging test token).', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Chatbot',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/ChatbotResponse']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/flow' => [
                'get' => self::op('getChatbotFlow', 'Published flow JSON', 'Published (or staging) graph snapshot used by public chat. Query environment=staging for the staging graph.', ['Chatbots'], [
                    'parameters' => [
                        self::pathId('chatbotId'),
                        self::q('environment', 'production (default) or staging', false, 'production'),
                    ],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Graph JSON',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/FlowResponse']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/export' => [
                'get' => self::op('exportChatbot', 'Export chatbot pack', 'Designer pack: nodes, edges, globals, templates, entity schemas, test scenarios (`flowforge.chatbotFlow`).', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Flow export pack',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/FlowExport']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/media' => [
                'get' => self::op('listChatbotMedia', 'List media files', 'Media library files for the chatbot. Use runtime GET /file/get to download bytes.', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Media list',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/MediaList']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/templates' => [
                'get' => self::op('listTemplates', 'List templates', 'FAQ, email, store catalogs, hours, receipts, downloadable files, and other template kinds.', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Templates',
                        'content' => ['application/json' => ['schema' => ['type' => 'object']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/variables' => [
                'get' => self::op('listVariables', 'List variables', 'Global and step-output variable definitions.', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Variables',
                        'content' => ['application/json' => ['schema' => ['type' => 'object']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/entities' => [
                'get' => self::op('listEntities', 'List entities', 'Data tables owned by this chatbot (schema only).', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Entities',
                        'content' => ['application/json' => ['schema' => ['type' => 'object']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/entities/{entityId}' => [
                'get' => self::op('getEntity', 'Get entity schema', 'Entity plus attributes.', ['Chatbots'], [
                    'parameters' => [self::pathId('chatbotId'), self::pathId('entityId')],
                    'responses' => array_merge($err, ['200' => ['description' => 'Entity with attributes']]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/entities/{entityId}/records' => [
                'get' => self::op('listEntityRecords', 'List entity records', 'Static catalog or dynamic records for the entity.', ['Chatbots'], [
                    'parameters' => array_merge([self::pathId('chatbotId'), self::pathId('entityId')], $page),
                    'responses' => array_merge($err, ['200' => ['description' => 'Records']]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/conversations' => [
                'get' => self::op('listChatbotConversations', 'List chatbot conversations', 'Sessions for one chatbot.', ['Conversations'], [
                    'parameters' => array_merge([self::pathId('chatbotId')], $page, self::conversationFilters()),
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Conversation list',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/ConversationList']]],
                    ]]),
                ]),
            ],
            '/v1/chatbots/{chatbotId}/analytics' => [
                'get' => self::op('chatbotAnalytics', 'Chatbot analytics', 'Same analytics shape, scoped to one chatbot.', ['Analytics'], [
                    'parameters' => [
                        self::pathId('chatbotId'),
                        self::q('days', 'Lookback days', false, '30'),
                        self::q('environment', 'production or staging', false, 'production'),
                    ],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Analytics',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/AnalyticsResponse']]],
                    ]]),
                ]),
            ],
            '/v1/conversations/{conversationId}' => [
                'get' => self::op('getConversation', 'Get conversation', 'Session including saved variables.', ['Conversations'], [
                    'parameters' => [self::pathId('conversationId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Conversation',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/ConversationResponse']]],
                    ]]),
                ]),
            ],
            '/v1/conversations/{conversationId}/events' => [
                'get' => self::op('listConversationEvents', 'Conversation transcript', 'Ordered events (messages, step.run, etc.).', ['Conversations'], [
                    'parameters' => array_merge([self::pathId('conversationId')], [
                        self::q('limit', 'Max events (default 500, max 2000)', false, '500'),
                        self::q('offset', 'Offset', false, '0'),
                    ]),
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Events',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/EventList']]],
                    ]]),
                ]),
            ],
            '/v1/conversations/{conversationId}/files' => [
                'get' => self::op('listConversationFiles', 'Conversation uploads', 'Files uploaded during this session (receipts, signatures, …).', ['Conversations'], [
                    'parameters' => [self::pathId('conversationId')],
                    'responses' => array_merge($err, ['200' => [
                        'description' => 'Files',
                        'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/MediaList']]],
                    ]]),
                ]),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private static function components(): array
    {
        return [
            'securitySchemes' => [
                'jwt' => [
                    'type' => 'http',
                    'scheme' => 'bearer',
                    'bearerFormat' => 'JWT or ffpat',
                    'description' => 'Long-lived Platform API token (`ffpat_…`) from Admin → Security, or a signed-in session JWT. Never use anon or service_role.',
                ],
            ],
            'responses' => [
                'BadRequest' => self::errorResponse('Bad request'),
                'Unauthorized' => self::errorResponse('Missing or invalid Authorization bearer token'),
                'Forbidden' => self::errorResponse('Not permitted'),
                'NotFound' => self::errorResponse('Not found'),
                'RateLimited' => self::errorResponse('Rate limit exceeded. Try again shortly.'),
            ],
            'schemas' => [
                'Error' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean', 'example' => false],
                        'error' => ['type' => 'string'],
                    ],
                ],
                'Me' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'user' => [
                            'type' => 'object',
                            'properties' => [
                                'id' => ['type' => 'string', 'format' => 'uuid'],
                                'email' => ['type' => 'string', 'nullable' => true],
                            ],
                        ],
                        'organisations' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'id' => ['type' => 'string'],
                                    'name' => ['type' => 'string'],
                                    'slug' => ['type' => 'string', 'nullable' => true],
                                    'role' => ['type' => 'string', 'example' => 'editor'],
                                ],
                            ],
                        ],
                    ],
                    'example' => [
                        'ok' => true,
                        'user' => ['id' => '00000000-0000-4000-8000-000000000001', 'email' => 'ada@example.com'],
                        'organisations' => [['id' => '{{organisationId}}', 'name' => 'Acme', 'slug' => 'acme', 'role' => 'admin']],
                    ],
                ],
                'Organisation' => [
                    'type' => 'object',
                    'properties' => [
                        'id' => ['type' => 'string', 'format' => 'uuid'],
                        'name' => ['type' => 'string'],
                        'slug' => ['type' => 'string', 'nullable' => true],
                        'created_at' => ['type' => 'string'],
                        'updated_at' => ['type' => 'string'],
                    ],
                ],
                'OrganisationList' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'items' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/Organisation']],
                        'limit' => ['type' => 'integer'],
                        'offset' => ['type' => 'integer'],
                        'total' => ['type' => 'integer', 'nullable' => true],
                    ],
                ],
                'OrganisationResponse' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'organisation' => ['$ref' => '#/components/schemas/Organisation'],
                    ],
                ],
                'Chatbot' => [
                    'type' => 'object',
                    'properties' => [
                        'id' => ['type' => 'string', 'format' => 'uuid'],
                        'instance_id' => ['type' => 'string', 'format' => 'uuid'],
                        'name' => ['type' => 'string'],
                        'description' => ['type' => 'string', 'nullable' => true],
                        'public_enabled' => ['type' => 'boolean'],
                        'public_slug' => ['type' => 'string', 'nullable' => true],
                        'environment' => ['type' => 'string'],
                        'settings' => ['type' => 'object'],
                        'created_at' => ['type' => 'string'],
                        'updated_at' => ['type' => 'string'],
                        'deleted_at' => ['type' => 'string', 'nullable' => true],
                    ],
                ],
                'ChatbotList' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'chatbots' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/Chatbot']],
                        'limit' => ['type' => 'integer'],
                        'offset' => ['type' => 'integer'],
                        'total' => ['type' => 'integer', 'nullable' => true],
                    ],
                ],
                'ChatbotResponse' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'chatbot' => ['$ref' => '#/components/schemas/Chatbot'],
                    ],
                ],
                'FlowResponse' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'chatbot_id' => ['type' => 'string'],
                        'environment' => ['type' => 'string', 'example' => 'production'],
                        'flow' => ['type' => 'object'],
                        'graph' => ['description' => 'Published published_graph JSON (steps, edges, templates snapshot)', 'nullable' => true],
                    ],
                ],
                'FlowExport' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'kind' => ['type' => 'string', 'example' => 'flowforge.chatbotFlow'],
                        'version' => ['type' => 'integer', 'example' => 1],
                        'exportedAt' => ['type' => 'string'],
                        'chatbot' => ['type' => 'object'],
                        'flow' => ['type' => 'object'],
                        'globals' => ['type' => 'array', 'items' => ['type' => 'object']],
                        'nodes' => ['type' => 'array', 'items' => ['type' => 'object']],
                        'edges' => ['type' => 'array', 'items' => ['type' => 'object']],
                        'templates' => ['type' => 'array', 'items' => ['type' => 'object']],
                        'entityDefs' => ['type' => 'array', 'items' => ['type' => 'object']],
                        'testScenarios' => ['type' => 'array', 'items' => ['type' => 'object']],
                    ],
                ],
                'MediaList' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'kind' => ['type' => 'string'],
                        'files' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'filename' => ['type' => 'string'],
                                    'key' => ['type' => 'string'],
                                    'size' => ['type' => 'integer'],
                                    'mime' => ['type' => 'string'],
                                    'url' => ['type' => 'string'],
                                    'path' => ['type' => 'string'],
                                ],
                            ],
                        ],
                    ],
                ],
                'Conversation' => [
                    'type' => 'object',
                    'properties' => [
                        'id' => ['type' => 'string', 'format' => 'uuid'],
                        'instance_id' => ['type' => 'string'],
                        'chatbot_id' => ['type' => 'string'],
                        'chatbot_name' => ['type' => 'string', 'nullable' => true],
                        'status' => ['type' => 'string', 'example' => 'completed'],
                        'environment' => ['type' => 'string'],
                        'visitor_key' => ['type' => 'string', 'nullable' => true],
                        'variables' => ['type' => 'object'],
                        'publish_version' => ['type' => 'integer', 'nullable' => true],
                        'created_at' => ['type' => 'string'],
                        'completed_at' => ['type' => 'string', 'nullable' => true],
                    ],
                ],
                'ConversationList' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'conversations' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/Conversation']],
                        'limit' => ['type' => 'integer'],
                        'offset' => ['type' => 'integer'],
                        'total' => ['type' => 'integer', 'nullable' => true],
                    ],
                ],
                'ConversationResponse' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'conversation' => ['$ref' => '#/components/schemas/Conversation'],
                    ],
                ],
                'EventList' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'events' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'id' => ['type' => 'string'],
                                    'kind' => ['type' => 'string', 'example' => 'step.run'],
                                    'node_key' => ['type' => 'string', 'nullable' => true],
                                    'payload' => ['type' => 'object'],
                                    'seq' => ['type' => 'integer'],
                                    'created_at' => ['type' => 'string'],
                                ],
                            ],
                        ],
                    ],
                ],
                'AnalyticsResponse' => [
                    'type' => 'object',
                    'properties' => [
                        'ok' => ['type' => 'boolean'],
                        'range_days' => ['type' => 'integer'],
                        'from' => ['type' => 'string'],
                        'analytics' => [
                            'type' => 'object',
                            'properties' => [
                                'session_count' => ['type' => 'integer'],
                                'completed_count' => ['type' => 'integer'],
                                'abandoned_count' => ['type' => 'integer'],
                                'failed_count' => ['type' => 'integer'],
                                'unique_visitors' => ['type' => 'integer'],
                                'completion_rate' => ['type' => 'number'],
                                'status_breakdown' => ['type' => 'object'],
                                'by_chatbot' => ['type' => 'array', 'items' => ['type' => 'object']],
                                'by_day' => ['type' => 'array', 'items' => ['type' => 'object']],
                                'drop_off' => ['type' => 'array', 'items' => ['type' => 'object']],
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }

    /** @param list<string> $tags @param array<string, mixed> $extra @return array<string, mixed> */
    private static function op(string $id, string $summary, string $description, array $tags, array $extra = []): array
    {
        return array_merge([
            'operationId' => $id,
            'summary' => $summary,
            'description' => $description,
            'tags' => $tags,
        ], $extra);
    }

    /** @return array<string, mixed> */
    private static function pathId(string $name): array
    {
        $example = match ($name) {
            'organisationId' => '{{organisationId}}',
            'chatbotId' => '{{chatbotId}}',
            'conversationId' => '{{conversationId}}',
            'entityId' => '{{entityId}}',
            default => '{{id}}',
        };
        return [
            'name' => $name,
            'in' => 'path',
            'required' => true,
            'schema' => ['type' => 'string', 'format' => 'uuid'],
            'example' => $example,
        ];
    }

    /** @return array<string, mixed> */
    private static function q(string $name, string $description, bool $required, string $example): array
    {
        return [
            'name' => $name,
            'in' => 'query',
            'required' => $required,
            'description' => $description,
            'schema' => ['type' => 'string'],
            'example' => $example,
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function conversationFilters(): array
    {
        return [
            self::q('status', 'active, completed, failed, abandoned, escalated', false, 'completed'),
            self::q('environment', 'production or staging', false, 'production'),
            self::q('from', 'ISO start (created_at >=)', false, '2026-09-01'),
            self::q('to', 'ISO end (created_at <=)', false, '2026-09-08'),
        ];
    }

    /** @param array<string, mixed> $example @return array<string, mixed> */
    private static function jsonOk(array $example): array
    {
        return [
            'description' => 'Success',
            'content' => ['application/json' => ['schema' => ['type' => 'object'], 'example' => $example]],
        ];
    }

    /** @return array<string, mixed> */
    private static function errorResponse(string $message): array
    {
        return [
            'description' => $message,
            'content' => [
                'application/json' => [
                    'schema' => ['$ref' => '#/components/schemas/Error'],
                    'example' => ['ok' => false, 'error' => $message],
                ],
            ],
        ];
    }
}
