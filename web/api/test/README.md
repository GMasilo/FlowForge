# FlowForge API HTTP tests

Local harness for outbound HTTP behaviour used by Sign-in and HTTP steps. No PHPUnit or Composer required.

These tests call `HttpClient` against a **mock upstream**. The CLI runner talks to the mock directly. Live Sign-in / HTTP steps go through production `/http/execute` (Supabase JWT + SSRF checks), so use a **public** mock base URL — not `127.0.0.1`.

## Hosted mock (production)

Deploy `web/api/` so the mock is reachable at:

**Base URL:** `https://gkjtt.co.za/flowforge/api/test`

| Method | URL |
|--------|-----|
| GET | `https://gkjtt.co.za/flowforge/api/test/health` |
| POST | `https://gkjtt.co.za/flowforge/api/test/auth/login` |
| POST | `https://gkjtt.co.za/flowforge/api/test/auth/login-mapped` |
| POST | `https://gkjtt.co.za/flowforge/api/test/auth/login-nested` |

Connection `baseUrl` = `https://gkjtt.co.za/flowforge/api/test`, path = `/auth/login` (etc.).

`run.php`, `Assert.php`, `signInBody.php`, and `scenarios/` stay blocked by `.htaccess`; only the mock upstream is public.

## Local quick start

Terminal A — mock API:

```bash
php -S 127.0.0.1:8099 web/api/test/mock-upstream.php
```

Terminal B — run scenarios:

```bash
php web/api/test/run.php
php web/api/test/run.php --only=sign_in_http
php web/api/test/run.php --base=http://127.0.0.1:8099 --timeout=5
# Against hosted mock:
php web/api/test/run.php --base=https://gkjtt.co.za/flowforge/api/test
```

## Scenarios

| File | What it covers |
|------|----------------|
| `scenarios/sign_in_http.php` | Sign-in request body shapes: default `email`/`password`, remapped `username`/`pass`, nested `requestBody` template; success + 401 |
| `scenarios/http_client.php` | GET success/fail, POST echo, bearer / basic / API-key auth headers |
| `scenarios/security.php` | Header sanitization helpers |
| `scenarios/openapi.php` | OpenAPI 3.0 spec completeness and Postman collection export |

## Mock routes

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | Liveness for the runner |
| GET | `/ok` | 200 |
| GET | `/fail` | 401 |
| GET | `/headers-check` | Echoes Authorization / X-API-Key |
| POST | `/echo` | Echoes JSON body |
| POST | `/auth/login` | Expects `{ "email", "password" }` → `{ token, user }` |
| POST | `/auth/login-mapped` | Expects `{ "username", "pass" }` (rejects default keys) |
| POST | `/auth/login-nested` | Expects `{ "login": { "user", "secret" } }` |

Use password `wrong` on login routes to force 401.

## Relating this to the Sign-in step

The designer Sign-in step builds a JSON body (field keys or `requestBody` template), then the API proxies it with `HttpClient` to your connection `baseUrl` + `path`.

- Default → `POST /auth/login` body `{ "email", "password" }`
- Field names `username` / `pass` → `POST /auth/login-mapped`
- Template `{"login":{"user":"{{email}}","secret":"{{password}}"}}` → `POST /auth/login-nested`

`test/signInBody.php` mirrors the TypeScript builder so mismatches show up here first.

## Optional: live `/http/execute` smoke (manual)

Against a deployed API (JWT required; target host must be public / allowlisted — not `127.0.0.1`):

```bash
curl -sS -X POST "$VITE_FLOWFORGE_API_URL/http/execute" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connection": {
      "baseUrl": "https://httpbin.org",
      "authType": "none",
      "timeoutMs": 15000
    },
    "method": "POST",
    "path": "/post",
    "body": { "email": "alice@example.com", "password": "secret" }
  }'
```

## Layout

```
web/api/test/
  run.php              CLI runner
  mock-upstream.php    php -S router
  Assert.php
  signInBody.php       mirrors frontend Sign-in body builder
  scenarios/
    sign_in_http.php
    http_client.php
    security.php
  README.md
```

This folder is blocked from public HTTP by `web/api/.htaccess`.
