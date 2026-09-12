<?php
declare(strict_types=1);

/**
 * Visitor SSO ACS / OIDC redirect callback.
 *
 * Azure SAML POSTs SAMLResponse here; OIDC returns ?code=&state=.
 * Responds with a tiny HTML bridge that postMessages the opener (popup)
 * or stores the result and redirects back to the chat (full-page fallback).
 */

require_once dirname(__DIR__) . '/lib/Response.php';
require_once dirname(__DIR__) . '/lib/Security.php';
require_once dirname(__DIR__) . '/lib/RateLimiter.php';
require_once dirname(__DIR__) . '/lib/SupabaseRest.php';
require_once dirname(__DIR__) . '/bootstrap.php';

use FlowForge\Api\RateLimiter;
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;

$configFile = dirname(__DIR__) . '/config.php';
if (!is_file($configFile)) {
    Response_html_error('API config.php missing', 500);
}
/** @var array $config */
$config = require $configFile;

header('X-Frame-Options: SAMEORIGIN');
header('Cache-Control: no-store');

Security::enforceHttps($config);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (!in_array($method, ['GET', 'POST'], true)) {
    Response_html_error('Method not allowed', 405);
}

RateLimiter::hit($config, 'anon:' . Security::clientIp());

$relayRaw = '';
if ($method === 'POST') {
    $relayRaw = trim((string) ($_POST['RelayState'] ?? $_POST['state'] ?? ''));
} else {
    $relayRaw = trim((string) ($_GET['state'] ?? $_GET['RelayState'] ?? ''));
}

$relay = decode_relay_state($relayRaw);
if ($relay === null) {
    Response_html_error('Invalid or missing SSO state', 400);
}

$chatbotId = (string) ($relay['c'] ?? '');
$templateKey = (string) ($relay['t'] ?? '');
$returnPath = (string) ($relay['r'] ?? '/');
$protocol = (string) ($relay['p'] ?? 'saml');
$nonce = (string) ($relay['n'] ?? $relayRaw);

if ($chatbotId === '' || $templateKey === '') {
    Response_html_error('SSO state is missing chatbot or template', 400);
}

$template = load_sso_template($config, $chatbotId, $templateKey);
if ($template === null) {
    Response_html_error('SSO template was not found', 404);
}

$content = is_array($template['content'] ?? null) ? $template['content'] : [];
$provider = trim((string) ($content['providerName'] ?? $template['name'] ?? 'SSO'));

try {
    if ($protocol === 'oidc' || (!empty($_GET['code']) && empty($_POST['SAMLResponse']))) {
        $claims = handle_oidc_callback($config, $content, $relayRaw);
    } else {
        $claims = handle_saml_callback($content);
    }
} catch (Throwable $e) {
    bridge_response([
        'source' => 'flowforge-sso',
        'ok' => false,
        'state' => $nonce,
        'error' => $e->getMessage(),
        'returnPath' => $returnPath,
    ]);
}

$claims['provider'] = $provider;
$claims['protocol'] = $protocol === 'oidc' ? 'oidc' : 'saml';

bridge_response([
    'source' => 'flowforge-sso',
    'ok' => true,
    'state' => $nonce,
    'claims' => $claims,
    'returnPath' => $returnPath,
]);

/**
 * @param array<string, mixed> $config
 * @return array{id:string,key:string,name:string,content:mixed}|null
 */
function load_sso_template(array $config, string $chatbotId, string $templateKey): ?array
{
    $query =
        'chatbot_id=eq.' . rawurlencode($chatbotId) .
        '&key=eq.' . rawurlencode($templateKey) .
        '&kind=eq.sso' .
        '&deleted_at=is.null' .
        '&select=id,key,name,content' .
        '&limit=1';
    $result = SupabaseRest::restSelectAsService($config, 'chatbot_templates', $query);
    if (!$result['ok'] || !is_array($result['data']) || !isset($result['data'][0]) || !is_array($result['data'][0])) {
        return null;
    }
    return $result['data'][0];
}

/**
 * @return array<string, mixed>|null
 */
function decode_relay_state(string $raw): ?array
{
    $raw = trim($raw);
    if ($raw === '') {
        return null;
    }
    if (!str_starts_with($raw, 'ff1.')) {
        // Legacy plain nonce — cannot load template server-side.
        return null;
    }
    $b64 = strtr(substr($raw, 4), '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) {
        $b64 .= str_repeat('=', 4 - $pad);
    }
    $json = base64_decode($b64, true);
    if ($json === false) {
        return null;
    }
    $data = json_decode($json, true);
    if (!is_array($data) || (int) ($data['v'] ?? 0) !== 1) {
        return null;
    }
    return $data;
}

/**
 * @param array<string, mixed> $content
 * @return array<string, mixed>
 */
function handle_saml_callback(array $content): array
{
    $encoded = trim((string) ($_POST['SAMLResponse'] ?? $_GET['SAMLResponse'] ?? ''));
    if ($encoded === '') {
        throw new RuntimeException('SAMLResponse is missing');
    }
    $xml = base64_decode($encoded, true);
    if ($xml === false || $xml === '') {
        throw new RuntimeException('SAMLResponse could not be decoded');
    }
    // Some IdPs send deflated responses on Redirect binding.
    if (!str_contains($xml, '<')) {
        $inflated = @gzinflate($xml);
        if (is_string($inflated) && str_contains($inflated, '<')) {
            $xml = $inflated;
        }
    }

    $prev = libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    $ok = $doc->loadXML($xml, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    if (!$ok) {
        throw new RuntimeException('SAMLResponse XML is invalid');
    }

    $claims = [];
    $xpath = new DOMXPath($doc);
    $xpath->registerNamespace('saml', 'urn:oasis:names:tc:SAML:2.0:assertion');
    $xpath->registerNamespace('samlp', 'urn:oasis:names:tc:SAML:2.0:protocol');

    foreach ($xpath->query('//saml:Attribute') ?: [] as $attr) {
        if (!$attr instanceof DOMElement) {
            continue;
        }
        $name = trim($attr->getAttribute('Name'));
        if ($name === '') {
            continue;
        }
        $values = [];
        foreach ($xpath->query('saml:AttributeValue', $attr) ?: [] as $valNode) {
            $text = trim((string) $valNode->textContent);
            if ($text !== '') {
                $values[] = $text;
            }
        }
        if (!$values) {
            continue;
        }
        $claims[$name] = count($values) === 1 ? $values[0] : $values;
        $short = short_claim_alias($name);
        if ($short !== null && !isset($claims[$short])) {
            $claims[$short] = $claims[$name];
        }
    }

    $nameId = $xpath->query('//saml:Subject/saml:NameID');
    if ($nameId && $nameId->length > 0) {
        $nid = trim((string) $nameId->item(0)?->textContent);
        if ($nid !== '') {
            $claims['nameID'] = $nid;
            if (!isset($claims['sub'])) {
                $claims['sub'] = $nid;
            }
            if (!isset($claims['email']) && filter_var($nid, FILTER_VALIDATE_EMAIL)) {
                $claims['email'] = $nid;
            }
        }
    }

    if (!$claims) {
        throw new RuntimeException('SAML assertion contained no attributes');
    }

    return $claims;
}

function short_claim_alias(string $name): ?string
{
    $map = [
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress' => 'email',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn' => 'upn',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name' => 'name',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname' => 'given_name',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname' => 'family_name',
        'http://schemas.microsoft.com/identity/claims/objectidentifier' => 'oid',
        'http://schemas.microsoft.com/identity/claims/displayname' => 'name',
        'http://schemas.microsoft.com/identity/claims/tenantid' => 'tid',
    ];
    return $map[$name] ?? null;
}

/**
 * @param array<string, mixed> $config
 * @param array<string, mixed> $content
 * @return array<string, mixed>
 */
function handle_oidc_callback(array $config, array $content, string $state): array
{
    $error = trim((string) ($_GET['error'] ?? ''));
    if ($error !== '') {
        $desc = trim((string) ($_GET['error_description'] ?? $error));
        throw new RuntimeException($desc !== '' ? $desc : 'OIDC provider returned an error');
    }
    $code = trim((string) ($_GET['code'] ?? ''));
    if ($code === '') {
        throw new RuntimeException('OIDC authorization code is missing');
    }
    $tokenUrl = trim((string) ($content['oidcTokenUrl'] ?? ''));
    $clientId = trim((string) ($content['oidcClientId'] ?? ''));
    $clientSecret = trim((string) ($content['oidcClientSecret'] ?? ''));
    if ($tokenUrl === '' || $clientId === '') {
        throw new RuntimeException('OIDC token URL / client ID missing on SSO template');
    }

    $redirectUri = flowforge_public_api_url($config) . '/chat/sso_callback';
    $body = http_build_query([
        'grant_type' => 'authorization_code',
        'code' => $code,
        'redirect_uri' => $redirectUri,
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
    ]);

    $ch = curl_init($tokenUrl);
    if ($ch === false) {
        throw new RuntimeException('Could not start token request');
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($raw) || $status < 200 || $status >= 300) {
        throw new RuntimeException('OIDC token exchange failed (' . $status . ')');
    }
    $token = json_decode($raw, true);
    if (!is_array($token)) {
        throw new RuntimeException('OIDC token response was invalid');
    }

    $claims = [];
    $idToken = trim((string) ($token['id_token'] ?? ''));
    if ($idToken !== '') {
        $claims = decode_jwt_payload($idToken);
        $claims['id_token'] = $idToken;
    }
    if (!empty($token['access_token'])) {
        $claims['access_token'] = (string) $token['access_token'];
    }
    if (!empty($token['refresh_token'])) {
        $claims['refresh_token'] = (string) $token['refresh_token'];
    }
    if (!$claims) {
        throw new RuntimeException('OIDC response had no id_token claims');
    }
    $claims['state'] = $state;
    return $claims;
}

/**
 * @return array<string, mixed>
 */
function decode_jwt_payload(string $jwt): array
{
    $parts = explode('.', $jwt);
    if (count($parts) < 2) {
        return [];
    }
    $b64 = strtr($parts[1], '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) {
        $b64 .= str_repeat('=', 4 - $pad);
    }
    $json = base64_decode($b64, true);
    if ($json === false) {
        return [];
    }
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

/**
 * @param array<string, mixed> $payload
 */
function bridge_response(array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS);
    if ($json === false) {
        $json = '{"source":"flowforge-sso","ok":false,"error":"encode failed","state":""}';
    }
    $returnPath = (string) ($payload['returnPath'] ?? '/');
    if ($returnPath === '' || !str_starts_with($returnPath, '/')) {
        $returnPath = '/';
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>SSO</title></head><body>';
    echo '<p>Finishing sign-in…</p>';
    echo '<script>(function(){';
    echo 'var payload=' . $json . ';';
    echo 'var ret=' . json_encode($returnPath, JSON_UNESCAPED_SLASHES) . ';';
    echo 'try{';
    echo 'if(window.opener&&!window.opener.closed){';
    echo 'window.opener.postMessage(payload,"*");';
    echo 'document.body.textContent=payload.ok?"Signed in — you can close this window.":(payload.error||"SSO failed");';
    echo 'setTimeout(function(){try{window.close()}catch(e){}},500);';
    echo 'return;}';
    echo 'sessionStorage.setItem("ff-chat-sso-result",JSON.stringify(payload));';
    echo 'var join=ret.indexOf("?")>=0?"&":"?";';
    echo 'location.replace(ret+join+"ff_sso=1");';
    echo '}catch(e){document.body.textContent=String(e&&e.message?e.message:e);}';
    echo '})();</script></body></html>';
    exit;
}

function Response_html_error(string $message, int $status = 400): void
{
    http_response_code($status);
    bridge_response([
        'source' => 'flowforge-sso',
        'ok' => false,
        'state' => '',
        'error' => $message,
        'returnPath' => '/',
    ]);
}
