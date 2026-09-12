# FlowForge PHP API

Base URL: `https://gkjtt.co.za/flowforge/api/`

## OpenAPI & Postman

The Platform API (`/v1`) is a **read API for chatbot-rich data**: organisations, chatbots, published flow JSON, export packs, media, templates, entities, conversations (transcripts), and analytics.

Runtime helpers (HTTP proxy, SMTP, payments, SCIM, file upload) stay on their existing paths and are not this contract.

| Resource | URL |
|----------|-----|
| Interactive docs (Redoc) | `GET /docs` |
| OpenAPI JSON | `GET /openapi.json` |
| Postman Collection v2.1 | `GET /postman.json` |
| Postman Environment | `GET /postman-environment.json` |

**Auth:** Organisation owners/admins create a long-lived Platform API token on Admin → Security (`ffpat_…`, shown once). Send `Authorization: Bearer <token>`. The PHP API verifies the token and reads the database with the configured service_role key. Never send anon/service_role from the client. Session JWTs from `/docs/api` still work but expire.

**Postman:** File → Import → `openapi.json`, **or** import `postman.json` plus the environment. Set `baseUrl` and paste a Platform API token (or a session JWT) into `accessToken`. Then `GET /v1/me`.

In-app guide: `/docs/api`. Regenerating committed copies for the SPA:

```bash
php web/api/tools/export-openapi.php
```

## Platform data API (`/v1`)

JWT or a long-lived `ffpat_` organisation token required. API tokens only see that organisation.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/me` | User + organisation roles |
| GET | `/v1/organisations` | List organisations |
| GET | `/v1/organisations/{id}` | Organisation profile |
| GET | `/v1/organisations/{id}/chatbots` | List chatbots |
| GET | `/v1/organisations/{id}/conversations` | List sessions |
| GET | `/v1/organisations/{id}/analytics` | Volume, completion, drop-off |
| GET | `/v1/chatbots/{id}` | Chatbot + settings |
| GET | `/v1/chatbots/{id}/flow` | Published (or `?environment=staging`) graph JSON |
| GET | `/v1/chatbots/{id}/export` | Designer pack (`flowforge.chatbotFlow`) |
| GET | `/v1/chatbots/{id}/media` | Media library listing |
| GET | `/v1/chatbots/{id}/templates` | Templates |
| GET | `/v1/chatbots/{id}/variables` | Variables |
| GET | `/v1/chatbots/{id}/entities` | Entity schemas |
| GET | `/v1/chatbots/{id}/entities/{entityId}/records` | Entity records |
| GET | `/v1/chatbots/{id}/conversations` | Sessions for one bot |
| GET | `/v1/chatbots/{id}/analytics` | Chatbot analytics |
| GET | `/v1/conversations/{id}` | Session + variables |
| GET | `/v1/conversations/{id}/events` | Transcript |
| GET | `/v1/conversations/{id}/files` | Uploads for the session |

Query params on lists: `limit`, `offset`. Conversations also accept `status`, `environment`, `from`, `to`. Analytics: `days` (default 30), `environment`.

## Runtime endpoints

These are used internally by designer/public chat (not the Platform data contract):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | Liveness |
| GET/POST | `/auth/check` | optional Bearer | Diagnose JWT / JWKS config |
| POST | `/http/execute` | JWT or `session_id` | Proxy outbound HTTP using a connection |
| POST | `/database/execute` | JWT or `session_id` | Run parameterized SQL via a database connection (Postgres / MySQL / MSSQL) |
| POST | `/email/send` | JWT or `session_id` | Send email via SMTP connection |
| POST | `/email/test` | JWT | Verify SMTP host + auth (no message sent) |
| POST | `/email/invite` | JWT | Send organisation invite email |
| POST | `/email/invite-member` | JWT | Add member/invite and send email |
| POST | `/email/invite-resend` | JWT | Resend a pending invite |
| POST | `/url/preview` | JWT | Fetch public URL title/description for link previews |
| POST | `/file/upload` | JWT (media) or `session_id` (conversation) | Store instance files |
| GET | `/file/get` | none (media) / JWT or `session_id` (conversation) | Stream a stored instance file |
| GET | `/file/list` | JWT | List media or conversation files for a chatbot |
| POST | `/file/delete` | JWT (editor+) | Delete a stored instance file |
| POST | `/file/purge` | JWT (owner/admin) | Delete all files for a chatbot |
| POST | `/webhooks/dispatch` | JWT | Fan-out an event to organisation webhooks |
| POST | `/webhooks/emit_session` | `session_id` | Emit conversation completed/failed webhooks |
| POST | `/payment/start` | JWT or `session_id` | Create a payment intent / checkout |
| POST | `/payment/notify` | gateway signature | PayFast ITN / custom notify |
| POST | `/payment/status` | JWT or `session_id` | Poll payment intent status |
| GET | `/chat/appearance` | none | Public embed branding for a slug |
| POST | `/integration/execute` | JWT or `session_id` | Run a connected integration action |
| GET/POST | `/alerts/run` | `alerts_cron_secret` | Evaluate alert rules and digests (cron) |
| GET/POST | `/retention/purge` | `retention_cron_secret` | Purge expired conversation data (cron) |
| * | `/scim/v2/*` | SCIM token | SCIM 2.0 Users provisioning |

All authenticated JSON requests require:

```http
Authorization: Bearer <supabase_user_access_token>
Content-Type: application/json
```

File uploads use `multipart/form-data` (do not set `Content-Type` manually). Conversation uploads from public chat send `session_id` instead of a JWT.

Use the signed-in user's **access token** from the browser session — not the anon key or service_role key.

## Instance files

Uploads are stored on disk under `api/files/` (empty until the first upload):

```
files/{instanceId}/{chatbotId}/media/
files/{instanceId}/{chatbotId}/conversations/
```

- `media` — files uploaded by a chatbot designer (original name, sanitized; numeric suffix on collision).
- `conversations` — files uploaded by end users, renamed `{conversationId}_{nodeKey}{ext}` (optional `_{index}` for multiple files on the same response) so reporting can join them back to a session and question.

Missing `{instanceId}/{chatbotId}/media` and `conversations` folders are created during upload. Direct HTTP access to `files/` is denied; use `/file/get`.

List query: `GET /file/list?kind=media&instance_id=…&chatbot_id=…` (JWT). Delete body: `{ "kind": "media", "instance_id", "chatbot_id", "name" }` (editor+). `kind` may also be `conversation`.

## Security controls

- Supabase JWT verification:
  - **ES256** via JWKS (`{supabase_url}/auth/v1/.well-known/jwks.json`) — required for modern projects
  - **HS256** via JWT Secret — optional legacy support only
- CORS allowlist
- HTTPS enforcement (configurable)
- Per-user + IP rate limiting
- SSRF protections (blocks private/reserved IPs, no redirects, http/https only)
- Header sanitization / injection checks
- Email single-recipient limit (no blast/open-relay)
- Secrets never written to responses/logs by the handlers

## Cron jobs

FlowForge ops cron jobs are plain PHP endpoints authenticated with shared secrets (Bearer tokens). Schedule them via the server's crontab or a hosted cron service.

### Alerts cron (`/alerts/run`)

Evaluates alert rules and sends threshold notifications + weekly digests for all instances.

**Schedule**: Every 30 minutes (or as needed)
**Auth**: `alerts_cron_secret` (Bearer or `?secret=`)

```bash
# Example crontab entry
*/30 * * * * curl -s -X POST -H "Authorization: Bearer $ALERTS_SECRET" https://gkjtt.co.za/flowforge/api/alerts/run
```

**Summary**: Returns JSON with `instances`, `rules_checked`, `triggered`, `notified`, `digests`, `errors[]`. Each run is logged in `cron_runs` table for observability (visible in admin UI).

### Retention purge cron (`/retention/purge`)

Purges expired conversation data for instances with retention policies (skips legal hold).

**Schedule**: Nightly (e.g. 2am UTC)
**Auth**: `retention_cron_secret` (or reuse `alerts_cron_secret`)

```bash
# Example crontab entry
0 2 * * * curl -s -X POST -H "Authorization: Bearer $RETENTION_SECRET" https://gkjtt.co.za/flowforge/api/retention/purge
```

**Summary**: Returns JSON with `policies_checked`, `instances_purged`, `total_sessions_purged`, `skipped_legal_hold`, `errors[]`. Each run is logged in `cron_runs` table.

**Configuration**: Set `retention_cron_secret` in `config.php` (or reuse `alerts_cron_secret` as a shared ops secret). Instance admins configure retention policies under Compliance → Data Retention.

**Observability**: Last-run status and summary counts are visible in the admin UI (Alerts page → Cron jobs section). Runs persist in the `cron_runs` table for audit trails.

## Deploy

1. Upload the `web/api` folder to `https://gkjtt.co.za/flowforge/api/`
2. Copy `config.example.php` → `config.php`
3. Set `supabase_url` to your project URL (e.g. `https://rongygfkvezsgerljqno.supabase.co`)
4. Do **not** put the anon/service_role API key in `supabase_jwt_secret` — those are JWTs, not the signing secret. Leave the placeholder if you use ES256 (default on new projects).
5. Ensure `storage/` and `files/` are writable by PHP. On Amazon Linux Apache:
   `sudo chown -R apache:apache files storage && sudo chmod -R 775 files storage`
   If `files/` is not writable, uploads fall back to `storage/files`. If `storage/` is not writable, rate limiting falls back to the system temp dir.
6. Needs PHP 8.1+, `curl`, OpenSSL. PHP `upload_max_filesize` and `post_max_size` must be at least `files_max_bytes` (default 10 MiB).
7. Configure cron secrets (`alerts_cron_secret`, `retention_cron_secret`) and schedule the cron endpoints (see Cron jobs section above).

## HTTP mock / tests

Hosted mock upstream (for Sign-in / HTTP connections via `/http/execute`):

**`https://gkjtt.co.za/flowforge/api/test`** — e.g. `POST …/test/auth/login`

Harness sources (`run.php`, scenarios) stay blocked; only the mock router is public. Details: [`test/README.md`](test/README.md).

```bash
# Local mock + CLI
php -S 127.0.0.1:8099 web/api/test/mock-upstream.php
php web/api/test/run.php
php web/api/test/run.php --base=https://gkjtt.co.za/flowforge/api/test
```

## Frontend env


```env
VITE_FLOWFORGE_API_URL=https://gkjtt.co.za/flowforge/api
```

## Example: HTTP execute

```json
{
  "connection": {
    "baseUrl": "https://api.example.com",
    "authType": "bearer",
    "bearerToken": "...",
    "headers": [],
    "timeoutMs": 30000
  },
  "method": "GET",
  "path": "/v1/me"
}
```

## Example: Email send

```json
{
  "connection": {
    "smtpHost": "smtp.example.com",
    "smtpPort": 587,
    "encryption": "starttls",
    "username": "...",
    "password": "...",
    "fromEmail": "noreply@example.com",
    "fromName": "FlowForge"
  },
  "to": "user@example.com",
  "subject": "Hello",
  "body": "Message text"
}
```

## Example: URL preview

```json
{
  "url": "https://example.com"
}
```

Response includes `title`, `description`, `site_name`, and `icon` (favicon / apple-touch-icon URL when available, else `{origin}/favicon.ico`).

## Example: file upload

`multipart/form-data` fields:

Designer media:

- `kind=media`
- `instance_id`, `chatbot_id`
- `file`

Conversation (public chat):

- `kind=conversation`
- `instance_id`, `chatbot_id`, `session_id`
- `node_key` (or `response`) — question/step key used in reporting
- `file`
- optional `file_index` when the same response has multiple files

Stored conversation name: `{sessionId}_{nodeKey}.pdf` (example). Fetch with `GET /file/get?kind=conversation&instance_id=…&chatbot_id=…&name=…` (JWT) or add `session_id` for the same conversation.
