<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Platform data API (/v1): chatbots, published JSON, conversations, analytics, media.
 * Session JWTs read through PostgREST with RLS. Long-lived `ffpat_` tokens are
 * verified, then reads use service_role scoped to that organisation.
 */
final class PlatformV1
{
    private const CHATBOT_LIST_SELECT = 'id,instance_id,name,description,public_enabled,public_slug,environment,created_at,updated_at,deleted_at';
    private const CHATBOT_GET_SELECT = 'id,instance_id,name,description,public_enabled,public_slug,environment,settings,created_at,updated_at,deleted_at';
    private const SESSION_SELECT = 'id,instance_id,chatbot_id,status,environment,visitor_key,variables,publish_version,error_summary,created_at,updated_at,completed_at,escalated_at,chatbots(name)';

    private static bool $useService = false;
    private static ?string $scopedInstanceId = null;

    /**
     * @param array{sub: string, email?: string|null, role: string, claims: array, auth?: string, instance_id?: string} $user
     */
    public static function dispatch(array $config, array $user, string $path, string $method): void
    {
        if ($method !== 'GET') {
            Response::error('Method not allowed', 405);
        }

        self::$useService = ($user['auth'] ?? '') === 'api_token';
        $scoped = (string) ($user['instance_id'] ?? '');
        self::$scopedInstanceId = self::$useService && $scoped !== '' ? $scoped : null;

        $jwt = self::$useService ? '' : SupabaseRest::bearerFromRequest();
        $segments = array_values(array_filter(explode('/', trim($path, '/')), static fn ($s) => $s !== ''));
        // $segments[0] is "v1"
        array_shift($segments);

        if ($segments === []) {
            self::ok([
                'ok' => true,
                'service' => 'flowforge-platform-v1',
                'docs' => '/docs',
                'openapi' => '/openapi.json',
                'resources' => [
                    'GET /v1/me',
                    'GET /v1/organisations',
                    'GET /v1/organisations/{id}',
                    'GET /v1/organisations/{id}/chatbots',
                    'GET /v1/organisations/{id}/conversations',
                    'GET /v1/organisations/{id}/analytics',
                    'GET /v1/chatbots/{id}',
                    'GET /v1/chatbots/{id}/flow',
                    'GET /v1/chatbots/{id}/export',
                    'GET /v1/chatbots/{id}/media',
                    'GET /v1/chatbots/{id}/templates',
                    'GET /v1/chatbots/{id}/variables',
                    'GET /v1/chatbots/{id}/entities',
                    'GET /v1/chatbots/{id}/conversations',
                    'GET /v1/chatbots/{id}/analytics',
                    'GET /v1/conversations/{id}',
                    'GET /v1/conversations/{id}/events',
                    'GET /v1/conversations/{id}/files',
                ],
            ]);
        }

        $head = $segments[0] ?? '';
        if ($head === 'me' && count($segments) === 1) {
            self::me($config, $jwt, $user);
        }
        if ($head === 'organisations' || $head === 'organizations') {
            self::organisations($config, $jwt, $segments);
        }
        if ($head === 'chatbots') {
            self::chatbots($config, $jwt, $segments);
        }
        if ($head === 'conversations') {
            self::conversations($config, $jwt, $segments);
        }

        Response::error('Not found', 404);
    }

    /** @param array{sub: string, email?: string|null} $user */
    private static function me(array $config, string $jwt, array $user): void
    {
        $q = 'user_id=eq.' . $user['sub'] . '&select=instance_id,role,instances(id,name,slug)';
        if (self::$scopedInstanceId) {
            $q = 'instance_id=eq.' . self::$scopedInstanceId . '&' . $q;
        }
        $memberships = self::get(
            $config,
            $jwt,
            'instance_members',
            $q,
        );
        $orgs = [];
        foreach (self::rows($memberships) as $row) {
            $inst = is_array($row['instances'] ?? null) ? $row['instances'] : [];
            $orgs[] = [
                'id' => (string) ($inst['id'] ?? $row['instance_id'] ?? ''),
                'name' => (string) ($inst['name'] ?? ''),
                'slug' => $inst['slug'] ?? null,
                'role' => (string) ($row['role'] ?? ''),
            ];
        }
        self::ok([
            'ok' => true,
            'user' => [
                'id' => $user['sub'],
                'email' => $user['email'] ?? null,
                'auth' => $user['auth'] ?? 'session',
            ],
            'organisations' => $orgs,
        ]);
    }

    /** @param list<string> $segments */
    private static function organisations(array $config, string $jwt, array $segments): void
    {
        if (count($segments) === 1) {
            $page = self::page();
            $q = 'select=id,name,slug,created_at,updated_at&order=name.asc&limit=' . $page['limit'] . '&offset=' . $page['offset'];
            if (self::$scopedInstanceId) {
                $q = 'id=eq.' . self::$scopedInstanceId . '&' . $q;
            }
            $res = self::get($config, $jwt, 'instances', $q);
            self::listOk(array_map([self::class, 'orgRow'], self::rows($res)), $res['total'] ?? null, $page);
        }

        $orgId = $segments[1] ?? '';
        self::requireUuid($orgId);
        self::requireMember($config, $jwt, $orgId);

        if (count($segments) === 2) {
            $res = self::get($config, $jwt, 'instances', 'id=eq.' . $orgId . '&select=id,name,slug,created_at,updated_at');
            $row = self::rows($res)[0] ?? null;
            if (!is_array($row)) {
                Response::error('Organisation not found', 404);
            }
            self::ok(['ok' => true, 'organisation' => self::orgRow($row)]);
        }

        $sub = $segments[2] ?? '';
        if ($sub === 'chatbots') {
            self::listChatbots($config, $jwt, $orgId, null);
        }
        if ($sub === 'conversations') {
            self::listConversations($config, $jwt, $orgId, null);
        }
        if ($sub === 'analytics') {
            self::analytics($config, $jwt, $orgId, null);
        }
        Response::error('Not found', 404);
    }

    /** @param list<string> $segments */
    private static function chatbots(array $config, string $jwt, array $segments): void
    {
        $id = $segments[1] ?? '';
        self::requireUuid($id);
        $bot = self::loadChatbot($config, $jwt, $id);
        $rest = array_slice($segments, 2);

        if ($rest === []) {
            self::ok(['ok' => true, 'chatbot' => self::chatbotRow($bot, true)]);
        }

        $sub = $rest[0] ?? '';
        if ($sub === 'flow') {
            self::chatbotFlow($config, $jwt, $bot);
        }
        if ($sub === 'export') {
            self::chatbotExport($config, $jwt, $bot);
        }
        if ($sub === 'media') {
            self::chatbotMedia($config, $bot);
        }
        if ($sub === 'templates') {
            self::chatbotTemplates($config, $jwt, $id);
        }
        if ($sub === 'variables') {
            self::chatbotVariables($config, $jwt, $id);
        }
        if ($sub === 'entities') {
            self::chatbotEntities($config, $jwt, $id, $rest);
        }
        if ($sub === 'conversations') {
            self::listConversations($config, $jwt, (string) $bot['instance_id'], $id);
        }
        if ($sub === 'analytics') {
            self::analytics($config, $jwt, (string) $bot['instance_id'], $id);
        }
        Response::error('Not found', 404);
    }

    /** @param list<string> $segments */
    private static function conversations(array $config, string $jwt, array $segments): void
    {
        $id = $segments[1] ?? '';
        self::requireUuid($id);
        $session = self::loadSession($config, $jwt, $id);
        $rest = array_slice($segments, 2);
        if ($rest === []) {
            self::ok(['ok' => true, 'conversation' => self::sessionRow($session)]);
        }
        $sub = $rest[0] ?? '';
        if ($sub === 'events') {
            $page = self::page(500, 2000);
            $res = self::get(
                $config,
                $jwt,
                'conversation_events',
                'session_id=eq.' . $id . '&select=id,kind,node_key,payload,seq,created_at&order=seq.asc&limit=' . $page['limit'] . '&offset=' . $page['offset'],
            );
            self::listOk(self::rows($res), $res['total'] ?? null, $page, 'events');
        }
        if ($sub === 'files') {
        require_once __DIR__ . '/InstanceFiles.php';
            $files = InstanceFiles::listKind(
                $config,
                (string) $session['instance_id'],
                (string) $session['chatbot_id'],
                InstanceFiles::KIND_CONVERSATION,
            );
            $prefix = strtolower($id) . '_';
            $files = array_values(array_filter(
                $files,
                static fn (array $f) => str_starts_with(strtolower((string) ($f['filename'] ?? '')), $prefix),
            ));
            self::ok(['ok' => true, 'files' => $files]);
        }
        Response::error('Not found', 404);
    }

    /** @param array<string, mixed> $bot */
    private static function listChatbots(array $config, string $jwt, string $orgId, ?string $unused): void
    {
        unset($unused);
        $page = self::page();
        $includeDeleted = isset($_GET['include_deleted']) && (string) $_GET['include_deleted'] === '1';
        $q = 'instance_id=eq.' . $orgId
            . '&select=' . self::CHATBOT_LIST_SELECT
            . '&order=name.asc&limit=' . $page['limit'] . '&offset=' . $page['offset'];
        if (!$includeDeleted) {
            $q = 'deleted_at=is.null&' . $q;
        }
        $search = trim((string) ($_GET['q'] ?? ''));
        if ($search !== '') {
            $q .= '&name=ilike.*' . self::like($search) . '*';
        }
        $res = self::get($config, $jwt, 'chatbots', $q);
        $items = array_map(static fn (array $row) => self::chatbotRow($row, false), self::rows($res));
        self::listOk($items, $res['total'] ?? null, $page, 'chatbots');
    }

    /** @param array<string, mixed> $bot */
    private static function chatbotFlow(array $config, string $jwt, array $bot): void
    {
        $env = strtolower(trim((string) ($_GET['environment'] ?? 'production')));
        $res = self::get(
            $config,
            $jwt,
            'chatbot_flows',
            'chatbot_id=eq.' . $bot['id'] . '&select=id,name,version,published_at,published_graph,staging_version,staging_published_at,staging_published_graph,has_draft_changes,updated_at',
        );
        $flow = self::rows($res)[0] ?? null;
        if (!is_array($flow)) {
            Response::error('Flow not found', 404);
        }
        $useStaging = $env === 'staging';
        $graph = $useStaging ? ($flow['staging_published_graph'] ?? null) : ($flow['published_graph'] ?? null);
        self::ok([
            'ok' => true,
            'chatbot_id' => $bot['id'],
            'environment' => $useStaging ? 'staging' : 'production',
            'flow' => [
                'id' => $flow['id'] ?? null,
                'name' => $flow['name'] ?? null,
                'version' => $useStaging ? ($flow['staging_version'] ?? null) : ($flow['version'] ?? null),
                'published_at' => $useStaging ? ($flow['staging_published_at'] ?? null) : ($flow['published_at'] ?? null),
                'has_draft_changes' => (bool) ($flow['has_draft_changes'] ?? false),
            ],
            'graph' => $graph,
        ]);
    }

    /** @param array<string, mixed> $bot */
    private static function chatbotExport(array $config, string $jwt, array $bot): void
    {
        $flowRes = self::get($config, $jwt, 'chatbot_flows', 'chatbot_id=eq.' . $bot['id'] . '&select=id,name,version');
        $flow = self::rows($flowRes)[0] ?? null;
        if (!is_array($flow)) {
            Response::error('Flow not found', 404);
        }
        $flowId = (string) ($flow['id'] ?? '');
        $nodesRes = self::get($config, $jwt, 'flow_nodes', 'flow_id=eq.' . $flowId . '&select=id,key,type,label,config,position_x,position_y');
        $edgesRes = self::get($config, $jwt, 'flow_edges', 'flow_id=eq.' . $flowId . '&select=id,source_node_id,target_node_id,source_handle,label');
        $varsRes = self::get($config, $jwt, 'chatbot_variables', 'chatbot_id=eq.' . $bot['id'] . '&scope=eq.global&select=key,value_type,default_value,description');
        $tplRes = self::get($config, $jwt, 'chatbot_templates', 'chatbot_id=eq.' . $bot['id'] . '&deleted_at=is.null&select=key,name,description,kind,content');
        $entRes = self::get($config, $jwt, 'chatbot_entities', 'chatbot_id=eq.' . $bot['id'] . '&deleted_at=is.null&select=id,key,name,description,kind');
        $scenRes = self::get($config, $jwt, 'chatbot_test_scenarios', 'chatbot_id=eq.' . $bot['id'] . '&select=name,globals,expected');

        $nodes = [];
        foreach (self::rows($nodesRes) as $n) {
            $nodes[] = [
                'id' => $n['id'] ?? null,
                'key' => $n['key'] ?? null,
                'type' => $n['type'] ?? null,
                'label' => $n['label'] ?? $n['key'] ?? null,
                'config' => $n['config'] ?? new \stdClass(),
                'position' => ['x' => (float) ($n['position_x'] ?? 0), 'y' => (float) ($n['position_y'] ?? 0)],
            ];
        }
        $edges = [];
        foreach (self::rows($edgesRes) as $e) {
            $edges[] = [
                'id' => $e['id'] ?? null,
                'source' => $e['source_node_id'] ?? null,
                'target' => $e['target_node_id'] ?? null,
                'sourceHandle' => $e['source_handle'] ?? null,
                'label' => $e['label'] ?? null,
            ];
        }

        $entityIds = [];
        $entityDefs = [];
        foreach (self::rows($entRes) as $ent) {
            $eid = (string) ($ent['id'] ?? '');
            $entityIds[] = $eid;
            $entityDefs[] = $ent;
        }
        if ($entityIds) {
            $in = implode(',', $entityIds);
            $attrs = self::get($config, $jwt, 'entity_attributes', 'entity_id=in.(' . $in . ')&select=entity_id,key,label,value_type,required,is_identifier,is_unique,default_value,sort_order&order=sort_order.asc');
            $byEnt = [];
            foreach (self::rows($attrs) as $a) {
                $eid = (string) ($a['entity_id'] ?? '');
                unset($a['entity_id']);
                $byEnt[$eid][] = $a;
            }
            foreach ($entityDefs as &$def) {
                $def['attributes'] = $byEnt[(string) ($def['id'] ?? '')] ?? [];
            }
            unset($def);
        }

        self::ok([
            'ok' => true,
            'kind' => 'flowforge.chatbotFlow',
            'version' => 1,
            'exportedAt' => gmdate('c'),
            'chatbot' => [
                'id' => $bot['id'],
                'name' => $bot['name'] ?? null,
                'description' => $bot['description'] ?? null,
            ],
            'flow' => [
                'id' => $flow['id'] ?? null,
                'name' => $flow['name'] ?? null,
                'version' => $flow['version'] ?? null,
            ],
            'globals' => self::rows($varsRes),
            'nodes' => $nodes,
            'edges' => $edges,
            'templates' => self::rows($tplRes),
            'entityDefs' => $entityDefs,
            'testScenarios' => self::rows($scenRes),
        ]);
    }

    /** @param array<string, mixed> $bot */
    private static function chatbotMedia(array $config, array $bot): void
    {
            require_once __DIR__ . '/InstanceFiles.php';
        $files = InstanceFiles::listKind(
            $config,
            (string) $bot['instance_id'],
            (string) $bot['id'],
            InstanceFiles::KIND_MEDIA,
        );
        self::ok(['ok' => true, 'kind' => 'media', 'files' => $files]);
    }

    private static function chatbotTemplates(array $config, string $jwt, string $chatbotId): void
    {
        $res = self::get(
            $config,
            $jwt,
            'chatbot_templates',
            'chatbot_id=eq.' . $chatbotId . '&deleted_at=is.null&select=id,key,name,description,kind,content,created_at,updated_at&order=name.asc',
        );
        self::ok(['ok' => true, 'templates' => self::rows($res)]);
    }

    private static function chatbotVariables(array $config, string $jwt, string $chatbotId): void
    {
        $res = self::get(
            $config,
            $jwt,
            'chatbot_variables',
            'chatbot_id=eq.' . $chatbotId . '&select=id,key,scope,value_type,default_value,description,source_node_key,created_at&order=key.asc',
        );
        self::ok(['ok' => true, 'variables' => self::rows($res)]);
    }

    /** @param list<string> $rest */
    private static function chatbotEntities(array $config, string $jwt, string $chatbotId, array $rest): void
    {
        if (count($rest) === 1) {
            $res = self::get(
                $config,
                $jwt,
                'chatbot_entities',
                'chatbot_id=eq.' . $chatbotId . '&deleted_at=is.null&select=id,key,name,description,kind,visibility,created_at,updated_at&order=name.asc',
            );
            self::ok(['ok' => true, 'entities' => self::rows($res)]);
        }
        $entityId = $rest[1] ?? '';
        self::requireUuid($entityId);
        $entRes = self::get(
            $config,
            $jwt,
            'chatbot_entities',
            'id=eq.' . $entityId . '&chatbot_id=eq.' . $chatbotId . '&select=id,key,name,description,kind,visibility,created_at,updated_at',
        );
        $entity = self::rows($entRes)[0] ?? null;
        if (!is_array($entity)) {
            Response::error('Entity not found', 404);
        }
        if (($rest[2] ?? '') === 'records') {
            $kind = (string) ($entity['kind'] ?? 'static');
            $table = $kind === 'dynamic' ? 'entity_dynamic_records' : 'entity_static_records';
            $page = self::page(100, 500);
            $select = $kind === 'dynamic'
                ? 'id,values,created_at,updated_at'
                : 'id,values,sort_order,created_at,updated_at';
            $res = self::get(
                $config,
                $jwt,
                $table,
                'entity_id=eq.' . $entityId . '&select=' . $select . '&order=created_at.desc&limit=' . $page['limit'] . '&offset=' . $page['offset'],
            );
            self::listOk(self::rows($res), $res['total'] ?? null, $page, 'records');
        }
        $attrs = self::get(
            $config,
            $jwt,
            'entity_attributes',
            'entity_id=eq.' . $entityId . '&select=id,key,label,value_type,required,is_identifier,is_unique,default_value,sort_order&order=sort_order.asc',
        );
        $entity['attributes'] = self::rows($attrs);
        self::ok(['ok' => true, 'entity' => $entity]);
    }

    private static function listConversations(array $config, string $jwt, string $orgId, ?string $chatbotId): void
    {
        $page = self::page(50, 200);
        $q = 'instance_id=eq.' . $orgId . '&select=' . self::SESSION_SELECT . '&order=created_at.desc&limit=' . $page['limit'] . '&offset=' . $page['offset'];
        if ($chatbotId) {
            $q .= '&chatbot_id=eq.' . $chatbotId;
        }
        $status = trim((string) ($_GET['status'] ?? ''));
        if ($status !== '') {
            $q .= '&status=eq.' . rawurlencode($status);
        }
        $env = trim((string) ($_GET['environment'] ?? ''));
        if ($env !== '') {
            $q .= '&environment=eq.' . rawurlencode($env);
        }
        $from = self::isoParam('from');
        if ($from !== null) {
            $q .= '&created_at=gte.' . rawurlencode($from);
        }
        $to = self::isoParam('to');
        if ($to !== null) {
            $q .= '&created_at=lte.' . rawurlencode($to);
        }
        $res = self::get($config, $jwt, 'conversation_sessions', $q);
        $items = array_map([self::class, 'sessionRow'], self::rows($res));
        self::listOk($items, $res['total'] ?? null, $page, 'conversations');
    }

    private static function analytics(array $config, string $jwt, string $orgId, ?string $chatbotId): void
    {
        $days = (int) ($_GET['days'] ?? 30);
        if ($days < 1) {
            $days = 30;
        }
        $days = min(365, $days);
        $from = gmdate('c', time() - $days * 86400);
        $limit = 2000;
        $q = 'instance_id=eq.' . $orgId
            . '&created_at=gte.' . rawurlencode($from)
            . '&select=id,chatbot_id,status,environment,visitor_key,variables,created_at,completed_at,chatbots(name)'
            . '&order=created_at.desc&limit=' . $limit;
        if ($chatbotId) {
            $q .= '&chatbot_id=eq.' . $chatbotId;
        }
        $env = trim((string) ($_GET['environment'] ?? ''));
        if ($env !== '') {
            $q .= '&environment=eq.' . rawurlencode($env);
        }
        $res = self::get($config, $jwt, 'conversation_sessions', $q);
        $sessions = self::rows($res);
        $ids = [];
        foreach ($sessions as $s) {
            $ids[] = (string) ($s['id'] ?? '');
        }
        $ids = array_values(array_filter($ids, static fn ($id) => $id !== ''));
        $events = [];
        if ($ids) {
            $chunk = array_slice($ids, 0, 400);
            $in = implode(',', $chunk);
            $ev = self::get(
                $config,
                $jwt,
                'conversation_events',
                'session_id=in.(' . $in . ')&kind=eq.step.run&select=session_id,kind,node_key,seq',
            );
            $events = self::rows($ev);
        }
        self::ok([
            'ok' => true,
            'range_days' => $days,
            'from' => $from,
            'analytics' => self::summarize($sessions, $events),
        ]);
    }

    /**
     * @param list<array<string, mixed>> $sessions
     * @param list<array<string, mixed>> $events
     * @return array<string, mixed>
     */
    private static function summarize(array $sessions, array $events): array
    {
        $statusCounts = [];
        $byChatbot = [];
        $byDay = [];
        $visitors = [];
        $drop = [];
        foreach ($sessions as $s) {
            $status = (string) ($s['status'] ?? 'unknown');
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;
            $botId = (string) ($s['chatbot_id'] ?? '');
            $botName = is_array($s['chatbots'] ?? null) ? (string) ($s['chatbots']['name'] ?? $botId) : $botId;
            if (!isset($byChatbot[$botId])) {
                $byChatbot[$botId] = ['chatbot_id' => $botId, 'name' => $botName, 'sessions' => 0, 'completed' => 0];
            }
            $byChatbot[$botId]['sessions']++;
            if ($status === 'completed') {
                $byChatbot[$botId]['completed']++;
            }
            $day = substr((string) ($s['created_at'] ?? ''), 0, 10);
            if ($day !== '') {
                if (!isset($byDay[$day])) {
                    $byDay[$day] = ['date' => $day, 'sessions' => 0, 'completed' => 0];
                }
                $byDay[$day]['sessions']++;
                if ($status === 'completed') {
                    $byDay[$day]['completed']++;
                }
            }
            $vk = (string) ($s['visitor_key'] ?? '');
            if ($vk !== '') {
                $visitors[$vk] = true;
            }
        }
        foreach ($events as $e) {
            $key = (string) ($e['node_key'] ?? '');
            if ($key === '') {
                continue;
            }
            $drop[$key] = ($drop[$key] ?? 0) + 1;
        }
        arsort($drop);
        $dropOff = [];
        $total = max(1, count($sessions));
        foreach (array_slice($drop, 0, 40, true) as $node => $reached) {
            $dropOff[] = [
                'node_key' => $node,
                'reached' => $reached,
                'pct' => round(100 * $reached / $total, 1),
            ];
        }
        $completed = (int) ($statusCounts['completed'] ?? 0);
        $chatbotRows = array_values($byChatbot);
        foreach ($chatbotRows as &$row) {
            $row['completion_rate'] = $row['sessions'] > 0
                ? round(100 * $row['completed'] / $row['sessions'], 1)
                : 0;
        }
        unset($row);
        ksort($byDay);

        return [
            'session_count' => count($sessions),
            'completed_count' => $completed,
            'active_count' => (int) ($statusCounts['active'] ?? 0),
            'abandoned_count' => (int) ($statusCounts['abandoned'] ?? 0),
            'failed_count' => (int) ($statusCounts['failed'] ?? 0),
            'escalated_count' => (int) ($statusCounts['escalated'] ?? 0),
            'unique_visitors' => count($visitors),
            'completion_rate' => count($sessions) > 0 ? round(100 * $completed / count($sessions), 1) : 0,
            'status_breakdown' => $statusCounts,
            'by_chatbot' => $chatbotRows,
            'by_day' => array_values($byDay),
            'drop_off' => $dropOff,
        ];
    }

    /** @return array<string, mixed> */
    private static function loadChatbot(array $config, string $jwt, string $id): array
    {
        $res = self::get($config, $jwt, 'chatbots', 'id=eq.' . $id . '&select=' . self::CHATBOT_GET_SELECT);
        $bot = self::rows($res)[0] ?? null;
        if (!is_array($bot)) {
            Response::error('Chatbot not found', 404);
        }
        self::requireMember($config, $jwt, (string) $bot['instance_id']);
        return $bot;
    }

    /** @return array<string, mixed> */
    private static function loadSession(array $config, string $jwt, string $id): array
    {
        $res = self::get($config, $jwt, 'conversation_sessions', 'id=eq.' . $id . '&select=' . self::SESSION_SELECT);
        $row = self::rows($res)[0] ?? null;
        if (!is_array($row)) {
            Response::error('Conversation not found', 404);
        }
        self::requireMember($config, $jwt, (string) $row['instance_id']);
        return $row;
    }

    private static function requireMember(array $config, string $jwt, string $instanceId): void
    {
        if (self::$useService) {
            $allowed = self::$scopedInstanceId !== null
                && strtolower(self::$scopedInstanceId) === strtolower($instanceId);
            if (!$allowed) {
                Response::error('Organisation not found or not permitted', 403);
            }
            return;
        }
        $rpc = SupabaseRest::rpcAsUser($config, $jwt, 'is_instance_member', [
            'p_instance_id' => $instanceId,
        ]);
        if (!$rpc['ok'] || $rpc['data'] !== true) {
            Response::error('Organisation not found or not permitted', 403);
        }
    }

    private static function requireUuid(string $value): void
    {
        if (!SupabaseRest::isUuid($value)) {
            Response::error('Invalid id', 400);
        }
    }

    /** @return array{ok: bool, status: int, data?: mixed, error?: string, total?: int|null} */
    private static function get(array $config, string $jwt, string $table, string $query): array
    {
        $res = self::$useService
            ? SupabaseRest::restSelectAsService($config, $table, $query)
            : SupabaseRest::restGet($config, $jwt, $table, $query);
        if (!$res['ok']) {
            $status = (int) ($res['status'] ?? 502);
            Response::json([
                'ok' => false,
                'error' => $res['error'] ?? 'Query failed',
            ], $status >= 400 ? $status : 502);
        }
        return $res;
    }

    /**
     * @param array{ok: bool, data?: mixed} $res
     * @return list<array<string, mixed>>
     */
    private static function rows(array $res): array
    {
        $data = $res['data'] ?? [];
        if (!is_array($data)) {
            return [];
        }
        if ($data === []) {
            return [];
        }
        $isList = array_keys($data) === range(0, count($data) - 1);
        if (!$isList) {
            return [$data];
        }
        $out = [];
        foreach ($data as $row) {
            if (is_array($row)) {
                $out[] = $row;
            }
        }
        return $out;
    }

    /** @return array{limit: int, offset: int} */
    private static function page(int $default = 50, int $max = 200): array
    {
        $limit = (int) ($_GET['limit'] ?? $default);
        $offset = (int) ($_GET['offset'] ?? 0);
        $limit = max(1, min($max, $limit));
        $offset = max(0, $offset);
        return ['limit' => $limit, 'offset' => $offset];
    }

    private static function isoParam(string $name): ?string
    {
        $raw = trim((string) ($_GET[$name] ?? ''));
        if ($raw === '') {
            return null;
        }
        $t = strtotime($raw);
        if ($t === false) {
            Response::error($name . ' must be an ISO date/time', 400);
        }
        return gmdate('c', $t);
    }

    private static function like(string $value): string
    {
        $value = str_replace(['*', ',', '(', ')'], '', $value);
        return rawurlencode($value);
    }

    /** @param array<string, mixed> $row */
    private static function orgRow(array $row): array
    {
        return [
            'id' => $row['id'] ?? null,
            'name' => $row['name'] ?? null,
            'slug' => $row['slug'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    /** @param array<string, mixed> $row */
    private static function chatbotRow(array $row, bool $includeSettings): array
    {
        $out = [
            'id' => $row['id'] ?? null,
            'instance_id' => $row['instance_id'] ?? null,
            'name' => $row['name'] ?? null,
            'description' => $row['description'] ?? null,
            'public_enabled' => (bool) ($row['public_enabled'] ?? false),
            'public_slug' => $row['public_slug'] ?? null,
            'environment' => $row['environment'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'deleted_at' => $row['deleted_at'] ?? null,
        ];
        if ($includeSettings) {
            $out['settings'] = $row['settings'] ?? new \stdClass();
        }
        return $out;
    }

    /** @param array<string, mixed> $row */
    private static function sessionRow(array $row): array
    {
        $bot = is_array($row['chatbots'] ?? null) ? $row['chatbots'] : [];
        return [
            'id' => $row['id'] ?? null,
            'instance_id' => $row['instance_id'] ?? null,
            'chatbot_id' => $row['chatbot_id'] ?? null,
            'chatbot_name' => $bot['name'] ?? null,
            'status' => $row['status'] ?? null,
            'environment' => $row['environment'] ?? null,
            'visitor_key' => $row['visitor_key'] ?? null,
            'variables' => $row['variables'] ?? new \stdClass(),
            'publish_version' => $row['publish_version'] ?? null,
            'error_summary' => $row['error_summary'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'completed_at' => $row['completed_at'] ?? null,
            'escalated_at' => $row['escalated_at'] ?? null,
        ];
    }

    /**
     * @param list<mixed> $items
     * @param array{limit: int, offset: int} $page
     */
    private static function listOk(array $items, ?int $total, array $page, string $key = 'items'): never
    {
        self::ok([
            'ok' => true,
            $key => $items,
            'limit' => $page['limit'],
            'offset' => $page['offset'],
            'total' => $total,
        ]);
    }

    /** @param array<string, mixed> $payload */
    private static function ok(array $payload): never
    {
        Response::json($payload);
    }
}
