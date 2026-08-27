<?php
declare(strict_types=1);

/**
 * SCIM 2.0 minimal Users endpoint for enterprise provisioning.
 * Auth: Bearer SCIM token (instance_scim_tokens).
 *
 * Routes (via index.php or rewrite):
 *   GET  /scim/v2/Users
 *   GET  /scim/v2/Users/{id}
 *   POST /scim/v2/Users
 *   PATCH /scim/v2/Users/{id}
 *   DELETE /scim/v2/Users/{id}
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;

$config = require dirname(__DIR__) . '/config.php';
if (!is_array($config)) {
    Response::error('Invalid config', 500);
}

$header = $_SERVER['HTTP_AUTHORIZATION']
    ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
    ?? '';
if ($header === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        if (strcasecmp((string) $name, 'Authorization') === 0) {
            $header = (string) $value;
            break;
        }
    }
}

if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
    Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'Unauthorized', 'status' => '401'], 401);
}

$token = $m[1];
$verify = SupabaseRest::rpcAsService($config, 'verify_scim_token', ['p_token' => $token]);
if (!($verify['ok'] ?? false) || empty($verify['data'])) {
    Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'Invalid token', 'status' => '401'], 401);
}

$instanceId = is_string($verify['data']) ? $verify['data'] : (string) ($verify['data'] ?? '');
if ($instanceId === '') {
    Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'Invalid token', 'status' => '401'], 401);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^.*?/api#', '', (string) $path) ?: '/';
$path = '/' . trim($path, '/');

$userId = null;
if (preg_match('#^/scim/v2/Users/([0-9a-fA-F-]{36})$#', $path, $mm)) {
    $userId = $mm[1];
    $path = '/scim/v2/Users/{id}';
}

$body = [];
$raw = file_get_contents('php://input') ?: '';
if ($raw !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

function scimUserResource(string $id, string $email, string $displayName, bool $active): array
{
    return [
        'schemas' => ['urn:ietf:params:scim:schemas:core:2.0:User'],
        'id' => $id,
        'userName' => $email,
        'displayName' => $displayName,
        'active' => $active,
        'emails' => [['value' => $email, 'primary' => true]],
        'meta' => ['resourceType' => 'User'],
    ];
}

if ($path === '/scim/v2/ServiceProviderConfig' && $method === 'GET') {
    Response::json([
        'schemas' => ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        'patch' => ['supported' => true],
        'bulk' => ['supported' => false],
        'filter' => ['supported' => true, 'maxResults' => 100],
        'changePassword' => ['supported' => false],
        'sort' => ['supported' => false],
        'etag' => ['supported' => false],
        'authenticationSchemes' => [[
            'type' => 'oauthbearertoken',
            'name' => 'OAuth Bearer Token',
            'description' => 'Authentication using a FlowForge SCIM bearer token',
            'primary' => true,
        ]],
    ]);
}

if ($path === '/scim/v2/Users' && $method === 'GET') {
    $members = SupabaseRest::restSelectAsService(
        $config,
        'instance_members',
        'instance_id=eq.' . rawurlencode($instanceId) . '&select=user_id,role,disabled_at,profiles(email,display_name)'
    );
    $resources = [];
    if (($members['ok'] ?? false) && is_array($members['data'] ?? null)) {
        foreach ($members['data'] as $row) {
            if (!is_array($row)) {
                continue;
            }
            $profiles = is_array($row['profiles'] ?? null) ? $row['profiles'] : [];
            $email = (string) ($profiles['email'] ?? $row['user_id']);
            $name = (string) ($profiles['display_name'] ?? $email);
            $active = empty($row['disabled_at']);
            $resources[] = scimUserResource((string) $row['user_id'], $email, $name, $active);
        }
    }
    Response::json([
        'schemas' => ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        'totalResults' => count($resources),
        'Resources' => $resources,
    ]);
}

if ($path === '/scim/v2/Users' && $method === 'POST') {
    $email = '';
    if (!empty($body['userName'])) {
        $email = (string) $body['userName'];
    } elseif (!empty($body['emails'][0]['value'])) {
        $email = (string) $body['emails'][0]['value'];
    }
    if ($email === '') {
        Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'userName required', 'status' => '400'], 400);
    }

    // Resolve or create auth user via admin API is out of scope for minimal SCIM;
    // require existing profile email match.
    $lookup = SupabaseRest::rpcAsService($config, 'lookup_profile_id_by_email', ['p_email' => $email]);
    $uid = is_string($lookup['data'] ?? null) ? $lookup['data'] : '';
    if ($uid === '') {
        Response::json([
            'schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'],
            'detail' => 'User must already exist in FlowForge (invite or sign up first)',
            'status' => '404',
        ], 404);
    }

    $active = array_key_exists('active', $body) ? (bool) $body['active'] : true;
    $role = 'viewer';
    $upsert = SupabaseRest::rpcAsService($config, 'scim_upsert_member', [
        'p_instance_id' => $instanceId,
        'p_user_id' => $uid,
        'p_role' => $role,
        'p_active' => $active,
    ]);
    if (!($upsert['ok'] ?? false)) {
        Response::json([
            'schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'],
            'detail' => (string) ($upsert['error'] ?? 'Upsert failed'),
            'status' => '500',
        ], 500);
    }

    $display = (string) ($body['displayName'] ?? $email);
    Response::json(scimUserResource($uid, $email, $display, $active), 201);
}

if ($path === '/scim/v2/Users/{id}' && $userId !== null) {
    if ($method === 'GET') {
        $row = SupabaseRest::restSelectAsService(
            $config,
            'instance_members',
            'instance_id=eq.' . rawurlencode($instanceId)
                . '&user_id=eq.' . rawurlencode($userId)
                . '&select=user_id,disabled_at,profiles(email,display_name)'
        );
        $data = is_array($row['data'] ?? null) ? ($row['data'][0] ?? null) : null;
        if (!is_array($data)) {
            Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'Not found', 'status' => '404'], 404);
        }
        $profiles = is_array($data['profiles'] ?? null) ? $data['profiles'] : [];
        $email = (string) ($profiles['email'] ?? $userId);
        Response::json(scimUserResource(
            $userId,
            $email,
            (string) ($profiles['display_name'] ?? $email),
            empty($data['disabled_at'])
        ));
    }

    if ($method === 'PATCH' || $method === 'PUT') {
        $active = true;
        if (isset($body['active'])) {
            $active = (bool) $body['active'];
        }
        if (!empty($body['Operations']) && is_array($body['Operations'])) {
            foreach ($body['Operations'] as $op) {
                if (!is_array($op)) {
                    continue;
                }
                if (($op['path'] ?? '') === 'active' || ($op['path'] ?? null) === null) {
                    if (array_key_exists('value', $op)) {
                        if (is_array($op['value']) && array_key_exists('active', $op['value'])) {
                            $active = (bool) $op['value']['active'];
                        } elseif (is_bool($op['value'])) {
                            $active = $op['value'];
                        }
                    }
                }
            }
        }
        $upsert = SupabaseRest::rpcAsService($config, 'scim_upsert_member', [
            'p_instance_id' => $instanceId,
            'p_user_id' => $userId,
            'p_role' => 'viewer',
            'p_active' => $active,
        ]);
        if (!($upsert['ok'] ?? false)) {
            Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'Update failed', 'status' => '500'], 500);
        }
        Response::json(scimUserResource($userId, $userId, $userId, $active));
    }

    if ($method === 'DELETE') {
        SupabaseRest::rpcAsService($config, 'scim_upsert_member', [
            'p_instance_id' => $instanceId,
            'p_user_id' => $userId,
            'p_role' => 'viewer',
            'p_active' => false,
        ]);
        http_response_code(204);
        exit;
    }
}

Response::json(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:Error'], 'detail' => 'Not found', 'status' => '404'], 404);
