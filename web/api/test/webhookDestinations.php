<?php
declare(strict_types=1);
namespace FlowForge\Api {
    final class HttpClient {
        public static array $request = [];
        public static array $response = ['ok' => true, 'status' => 200];
        public static function request(...$args): array {
            self::$request = $args;
            return self::$response;
        }
    }
    final class SupabaseRest {
        public static array $log = [];
        public static function rpcAsService($config, $name, $args): array {
            self::$log = $args;
            return ['ok' => true];
        }
    }
}
namespace {
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/lib/WebhookDelivery.php';
require_once dirname(__DIR__) . '/lib/Security.php';
use FlowForge\Api\WebhookDelivery;

$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function rejects(callable $fn, string $message): void {
    try { $fn(); } catch (Throwable $e) { check(true, $message); return; }
    check(false, $message);
}
$envelope = ['event' => 'conversation.completed', 'session' => ['id' => 'session-1', 'chatbot_id' => 'bot-1',
    'variables' => ['name' => 'A "quoted" name', 'count' => 3, 'active' => false, 'profile' => ['email' => 'test@example.test']]]];
$hook = ['secret' => 'test-secret', 'url' => 'https://example.test/hook'];
$legacy = WebhookDelivery::build($hook, 'conversation.completed', $envelope);
check(json_decode($legacy['body'], true) === $envelope, 'Existing default payload must remain unchanged');
check($legacy['headers']['X-FlowForge-Signature'] === 'sha256=' . hash_hmac('sha256', $legacy['body'], 'test-secret'), 'Sign the actual body');
$slack = $hook + ['destination' => 'slack', 'destination_config' => ['message' => '{{event}}: {{name}} ({{count}})']];
$slack['url'] = 'https://hooks.slack.com/services/test/example';
$request = WebhookDelivery::build($slack, 'conversation.completed', $envelope);
check(json_decode($request['body'], true) === ['text' => 'conversation.completed: A "quoted" name (3)'], 'Slack message must serialize safely');
$custom = $hook + ['destination_config' => ['bodyTemplate' => '{"name":"{{name}}","count":"{{count}}","active":"{{active}}","email":"{{profile.email}}","empty":{}}', 'headers' => ['Authorization' => 'Bearer test']]];
$request = WebhookDelivery::build($custom, 'conversation.completed', $envelope);
$body = json_decode($request['body']);
check($body->count === 3 && $body->active === false && is_object($body->empty), 'Preserve scalar types and empty JSON objects');
check($body->email === 'test@example.test', 'Nested variable paths resolve');
check($request['headers']['Authorization'] === 'Bearer test', 'Custom authorization header included');
$jira = $hook + ['destination' => 'jira', 'destination_config' => ['token' => 'jira-test-token']];
rejects(fn() => WebhookDelivery::build($jira, 'conversation.completed', $envelope), 'Old Jira webhook configuration requires API credentials');
rejects(fn() => WebhookDelivery::build(array_replace($slack, ['url' => 'https://example.test']), 'test', $envelope), 'Reject wrong Slack host');
rejects(fn() => WebhookDelivery::build(array_replace($jira, ['url' => 'http://example.test']), 'test', $envelope), 'Jira token requires HTTPS');
rejects(fn() => WebhookDelivery::build($hook + ['destination_config' => ['bodyTemplate' => '{"x":"{{missing}}"}']], 'test', $envelope), 'Missing variables fail');
rejects(fn() => WebhookDelivery::build($hook + ['destination_config' => ['bodyTemplate' => '[]']], 'test', $envelope), 'Body must be an object');
rejects(fn() => WebhookDelivery::build($hook + ['destination_config' => ['headers' => ['Authorization' => "ok\r\nInjected: yes"]]], 'test', $envelope), 'Reject header injection');
rejects(fn() => WebhookDelivery::build($hook + ['destination_config' => ['headers' => ['Host' => 'other.test']]], 'test', $envelope), 'Reject reserved headers');
check(WebhookDelivery::urlError('http://127.0.0.1/hook') !== null, 'Block private network targets');
check(WebhookDelivery::urlError('http://user:password@example.test') !== null, 'Block URL credentials');
$published = ['event' => 'flow.published', 'payload' => ['chatbot_id' => 'bot-2', 'version' => 4]];
check(WebhookDelivery::context('flow.published', $published)['chatbot_id'] === 'bot-2', 'Publish context contains chatbot');
$delivery = WebhookDelivery::send([], $hook + ['id' => 'hook-1', 'destination' => 'custom', 'destination_config' => ['headers' => ['Authorization' => 'Bearer private-token']]], 'conversation.completed', $envelope);
check(!$delivery['ok'], 'Unresolvable target fails without sending');
$sendHook = array_replace($hook, ['id' => 'hook-1', 'url' => 'https://8.8.8.8/webhook', 'destination' => 'custom', 'destination_config' => ['headers' => ['Authorization' => 'Bearer private-token']]]);
$delivery = WebhookDelivery::send([], $sendHook, 'conversation.completed', $envelope);
check($delivery['ok'] && $delivery['logged'], 'Mock delivery and logging succeed');
check(\FlowForge\Api\HttpClient::$request[2]['Authorization'] === 'Bearer private-token', 'Transport receives auth token');
check(!str_contains(json_encode(\FlowForge\Api\SupabaseRest::$log), 'private-token') && !str_contains(json_encode($delivery), 'private-token'), 'Delivery logs and result exclude credentials');
$bot = ['id' => 'bot-hook', 'url' => 'https://slack.com/api/chat.postMessage', 'secret' => 'signing-secret', 'destination' => 'slack',
    'destination_config' => ['slackMode' => 'bot', 'token' => 'xoxb-test-token', 'channel' => 'C123', 'message' => 'Hi {{name}}']];
$built = WebhookDelivery::build($bot, 'conversation.completed', $envelope);
check($built['headers']['Authorization'] === 'Bearer xoxb-test-token', 'Slack bearer token added');
check(json_decode($built['body'], true)['channel'] === 'C123', 'Slack channel included');
rejects(fn() => WebhookDelivery::build(array_replace($bot, ['url' => 'https://evil.test/api/chat.postMessage']), 'test', $envelope), 'Slack token cannot go to another host');
$badBot = $bot; $badBot['destination_config']['token'] = "bad\r\nHeader: injected";
rejects(fn() => WebhookDelivery::build($badBot, 'test', $envelope), 'Slack header injection blocked');
check(!isset($delivery['diagnostics']), 'Ordinary events never return diagnostics');
\FlowForge\Api\HttpClient::$response = ['ok' => false, 'status' => 401, 'headers' => ['content-type' => 'application/json', 'authorization' => 'Bearer private-token'], 'raw_body' => '{"error":"invalid_auth","token":"unknown-secret","echo":"private-token"}'];
$debug = WebhookDelivery::send([], $sendHook, 'conversation.completed', $envelope, true);
check($debug['diagnostics']['response']['status'] === 401, 'Diagnostics include failed HTTP status');
check(str_contains($debug['diagnostics']['response']['body'], 'invalid_auth'), 'Diagnostics preserve service errors');
check(!str_contains(json_encode($debug), 'private-token') && !str_contains(json_encode($debug), 'unknown-secret'), 'Diagnostics redact known credentials and response token fields');
check(isset($debug['diagnostics']['request']['body']), 'Diagnostics include outgoing body');
check(WebhookDelivery::slackRejected($bot, ['status' => 200, 'body' => ['ok' => false, 'error' => 'invalid_auth']]), 'Slack HTTP 200 with ok false is rejected');
check(!WebhookDelivery::slackRejected($bot, ['status' => 200, 'body' => ['ok' => true]]), 'Slack success accepted');
check(!WebhookDelivery::slackRejected($slack, ['status' => 200, 'body' => 'ok']), 'Incoming webhook text response remains valid');
$jiraApi = ['url' => 'https://example.atlassian.net/rest/api/3/issue', 'destination' => 'jira', 'secret' => 'sign-secret',
    'destination_config' => ['jiraMode' => 'api', 'jiraAction' => 'create', 'email' => 'user@example.test', 'token' => 'api-secret', 'bodyTemplate' => '{"fields":{"summary":"From {{name}}","project":{"key":"PROJ"},"issuetype":{"name":"Task"}}}']];
$built = WebhookDelivery::build($jiraApi, 'conversation.completed', $envelope);
check($built['method'] === 'POST', 'Create issue uses POST');
check($built['headers']['Authorization'] === 'Basic ' . base64_encode('user@example.test:api-secret'), 'Jira API uses email and API token Basic auth');
check(!isset($built['headers']['X-Automation-Webhook-Token']), 'API mode has no automation token header');
$jiraApi['destination_config']['jiraAction'] = 'update'; $jiraApi['url'] .= '/PROJ-123';
check(WebhookDelivery::build($jiraApi, 'conversation.completed', $envelope)['method'] === 'PUT', 'Update issue uses PUT');
rejects(fn() => WebhookDelivery::build(array_replace($jiraApi, ['url' => 'https://evil.test/rest/api/3/issue/PROJ-123']), 'test', $envelope), 'Jira credentials cannot go to unrelated host');
$jiraApi['url'] = 'https://api.atlassian.com/ex/jira/cloud-id/rest/api/3/issue/PROJ-123';
check(WebhookDelivery::build($jiraApi, 'conversation.completed', $envelope)['method'] === 'PUT', 'Scoped API token endpoint accepted');
$masked = WebhookDelivery::redact('echo ' . base64_encode('user@example.test:api-secret'), $jiraApi);
check(!str_contains($masked, base64_encode('user@example.test:api-secret')), 'Encoded Jira credentials redacted from diagnostics');
$legacyJira = $jiraApi;
unset($legacyJira['destination_config']['jiraMode']);
check(isset(WebhookDelivery::build($legacyJira, 'conversation.completed', $envelope)['headers']['Authorization']), 'Legacy Jira REST URL selects Basic authentication');
$legacyJira['destination_config']['email'] = '';
rejects(fn() => WebhookDelivery::build($legacyJira, 'conversation.completed', $envelope), 'Legacy REST connection without email fails before sending');
$wrongMode = $jiraApi; $wrongMode['destination_config']['jiraMode'] = 'automation';
check(isset(WebhookDelivery::build($wrongMode, 'conversation.completed', $envelope)['headers']['Authorization']), 'Old mode flag cannot bypass Basic authentication');
check(WebhookDelivery::redact(['Authorization' => 'Basic abc123'], $jiraApi)['Authorization'] === 'Basic [REDACTED]', 'Diagnostics show authentication scheme without credentials');
echo "$checks webhook destination checks passed\n";

}
