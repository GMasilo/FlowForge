# FlowForge PHP API

Base URL: `https://gkjtt.co.za/flowforge/api/`

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | none | Liveness |
| POST | `/http/execute` | Supabase JWT | Proxy outbound HTTP using a connection config |
| POST | `/email/send` | Supabase JWT | Send email via SMTP connection config |
| POST | `/email/test` | Supabase JWT | Verify SMTP host + auth (no message sent) |
| POST | `/email/invite` | Supabase JWT | Send organisation invite email (platform SMTP) |
| POST | `/url/preview` | Supabase JWT | Fetch public URL title/description for link previews |
| POST | `/file/upload` | JWT (media) or `session_id` (conversation) | Store instance files; creates folders on demand |
| GET | `/file/get` | none (media) / JWT or `session_id` (conversation) | Stream a stored instance file |
| GET | `/file/list` | JWT | List media or conversation files for a chatbot |
| POST | `/file/delete` | JWT (editor+) | Delete a stored instance file |

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

## Deploy

1. Upload the `web/api` folder to `https://gkjtt.co.za/flowforge/api/`
2. Copy `config.example.php` → `config.php`
3. Set `supabase_url` to your project URL (e.g. `https://rongygfkvezsgerljqno.supabase.co`)
4. Do **not** put the anon/service_role API key in `supabase_jwt_secret` — those are JWTs, not the signing secret. Leave the placeholder if you use ES256 (default on new projects).
5. Ensure `storage/` and `files/` are writable by PHP. On Amazon Linux Apache:
   `sudo chown -R apache:apache files storage && sudo chmod -R 775 files storage`
   If `files/` is not writable, uploads fall back to `storage/files`. If `storage/` is not writable, rate limiting falls back to the system temp dir.
6. Needs PHP 8.1+, `curl`, OpenSSL. PHP `upload_max_filesize` and `post_max_size` must be at least `files_max_bytes` (default 10 MiB).

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
