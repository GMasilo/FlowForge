# FlowForge connection lab (gkjtt demo host)

Public base: `https://gkjtt.co.za/flowforge/demo`

Use this organisation’s **Connections** page with the values below when building chatbots that need live HTTP / email / database steps.

Industry use-case packs expect these connection **names** (bind them on the chatbot after import):

| Suggested name | Kind | Used for |
|----------------|------|----------|
| `Demo Lab HTTP` | HTTP | Lookups, quotes, submits, email sink |
| `Demo Lab SQLite` | Database | Optional SQL lookups (`customers` / `orders` / `crm_accounts`) |
| `Demo Lab Email` | Email (SMTP) **or** reuse HTTP → `/email/sink` | Confirmation emails |

## HTTP connection

| Field | Value |
|-------|--------|
| Kind | HTTP |
| Name | `Demo Lab HTTP` |
| Base URL | `https://gkjtt.co.za/flowforge/demo` |
| Auth | None (or API key if you add one later) |
| Default method | `GET` |
| Default path | `/customers` |

Useful paths:

- `GET /health`
- `GET /customers` → `{ ok, data: [...] }`
- `GET /customers/1`
- `GET /orders?customer_id=1`
- `POST /echo` with JSON body
- `POST /email/sink` · `GET /email/inbox`
- **Banking:** `GET /banking/products` · `GET /banking/balance?account=` · `POST /banking/loan-quote`
- **Health:** `GET /health/services` · `POST /health/appointments`
- **Education:** `GET /education/programmes`
- **Mining:** `GET /mining/sites`
- **Retail:** `GET /retail/orders/{ref}` (try `NL-45821`)
- **Government:** `GET /government/cases/{ref}` (try `CA-2026-1188`)
- **CRM:** `GET /crm/pipeline` · `GET /crm/accounts?email=` (try `rep@pulsecrm.example`) · `GET /crm/deals/{ref}` (try `DEAL-2026-0042`) · `GET /crm/products` · `POST /crm/leads` · `POST /crm/tickets` · `POST /crm/meetings`
- **Shared:** `POST /industry/submit` with `{ industry, service, ... }`
- Sign-in style mocks remain under `/flowforge/api/test/…` (existing mock-upstream)

## Database connection (SQLite on this API host)

| Field | Value |
|-------|--------|
| Kind | Database |
| Name | `Demo Lab SQLite` |
| Provider | **SQLite** |
| SQLite file path | `/var/www/html/gkjt/flowforge/demo/data/demo.sqlite` |

Example Database step SQL:

```sql
SELECT id, email, name, city, status FROM customers WHERE email = :email
```

Param: `email` = `{{vars.email}}`

CRM accounts (after seed):

```sql
SELECT account_code, company, contact_name, tier, owner, arr, status
FROM crm_accounts WHERE lower(email) = lower(:email)
```

API config must include:

```php
'sqlite_path_allowlist' => [
    __DIR__ . '/../demo/data',
],
```

## Email connection

Use the organisation SMTP already configured on this host (Apache `DEFAULT_SYSTEM_SMTP_*`), **or** for HTTP-only demos of mail payloads:

| Field | Value |
|-------|--------|
| Kind | HTTP |
| Name | `Demo Lab Email Sink` |
| Base URL | `https://gkjtt.co.za/flowforge/demo` |
| Default method | `POST` |
| Default path | `/email/sink` |

Body JSON: `{ "to": "...", "subject": "...", "body": "..." }`  
Inspect with `GET /email/inbox`.

For industry packs, the **email** step can stay unbound until you attach real SMTP; packs also call `POST /email/sink` via HTTP so demos work without SMTP.

## Seed / reset sample data

```bash
curl -X POST https://gkjtt.co.za/flowforge/demo/seed
```

Creates `customers` + `orders` (+ `industry_submissions`) sample rows in the SQLite file.
