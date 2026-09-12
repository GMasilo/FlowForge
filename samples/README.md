# Samples

## Built-in starter templates

On **Chatbots → New chatbot**, pick a starter instead of importing JSON:

| Pack | What you get |
|------|----------------|
| **Blank** | Default welcome → end only |
| **Essentials** | Welcome flow + message, menu, hours, FAQ, legal, and follow-up email templates |
| **Customer support** | Topic branch, hours/FAQ, contact handoff |
| **Lead capture** | Lead questions + **Leads** entity |
| **Appointment booking** | Appointment question + **Appointments** entity |
| **Shop & checkout** | Store catalog, shop, payment, receipt |
| **Feedback survey** | NPS / stars / mood + **Feedback** entity |
| **Contact form** | Multi-field form + **Contacts** entity |

Common org templates (welcome, menu, hours, FAQ, legal, HTML email) are included on every non-blank pack.

---

Import JSON from the organisation **Chatbots** screen (**Import**). A full bundle (flow + templates + entities + test scenarios) is created in one step.

## FlowForge home page demo

Public landing-page showcase: **FlowForge Platform Demo**.

`flowforge-home-demo.json` is the bot to import for the home page embed (Admin → Platform → Import flow pack, or Chatbots → Import). It includes the full platform tour — every question type, all template kinds, entities, shop, logic, HTTP, and email — rebranded for FlowForge.

Regenerate after editing the builder:

```bash
node samples/home-demo/build.mjs
```

This runs the feature-tour builder first, then writes the home-branded copy. See **ForgeHub Feature Tour** below for step-by-step coverage details (same graph, different product name).

## ForgeHub Feature Tour

Showcase chatbot: **ForgeHub Feature Tour**.

`flowforge-feature-tour.json` walks a visitor through **every question / response type**, **every template kind**, **entity list + create**, variables, operations, a condition, a loop, HTTP, and email.

Regenerate the file after editing the builder:

```bash
node samples/feature-tour/build.mjs
```

### What you get on import

| Area | Contents |
|------|----------|
| **Templates** | Welcome message, menu, hours, FAQ, legal, HTML email, store catalog (with stock + shipping/VAT), receipt, downloadable PDF |
| **Data** | Global variables (`brand_name`, `featured_cities`, …). Static entity `catalog_programs` with sample rows. Dynamic entity `tour_visits` written at the end of the flow |
| **Test scenario** | **Happy path seeds** on the Data tab (Preview → scenario) |
| **Flow** | Captcha → confirm → identity → **formatting preview** → dates → **date expressions** → scales → choices → **list expressions** → files → shop → pay → **expression lab** → condition → loop → entities → HTTP/email → receipt + PDF → end |

### After import

1. Open **Design** → **Preview** and walk the conversation (it is long on purpose).
2. Optional: bind organisation **HTTP**, **email**, **Database**, and **Payment** connections on the matching steps if you want live calls instead of mocked/self-confirm behaviour.
3. On the **gkjtt** demo host, use the connection lab values in [`web/demo/CONNECTIONS.md`](../web/demo/CONNECTIONS.md) (`https://gkjtt.co.za/flowforge/demo`).
4. Optional: upload `look_studio.png` and `look_garden.png` to the Media library so the Image choice step has pictures.
5. **Publish** when you want the public chat widget to use this graph.

Entity IDs in the file are remapped to the new chatbot automatically.

## Connection lab (gkjtt demo backends)

Live sample backends on the FlowForge host for testing HTTP / email-shaped payloads / SQLite Database steps:

| Resource | URL |
|----------|-----|
| Lab root | https://gkjtt.co.za/flowforge/demo |
| Health | https://gkjtt.co.za/flowforge/demo/health |
| Customers | https://gkjtt.co.za/flowforge/demo/customers |
| Seed DB | `POST https://gkjtt.co.za/flowforge/demo/seed` |
| Setup guide | [`web/demo/CONNECTIONS.md`](../web/demo/CONNECTIONS.md) |

Create organisation connections named **Demo Lab HTTP** and **Demo Lab SQLite** using that guide, then bind them on new chatbots that need server steps.

## Industry use-case demos

Seven **menu → switch** service bots for `/use-cases`. Each industry has its own journey (banking: open account, check balance, loan quote, …) with **entities**, **Demo Lab HTTP**, shop/pay, OTP, signatures, conditions, and email sink — not a rebranded feature tour.

| File | Suggested public slug | Brand |
|------|----------------------|--------|
| `flowforge-usecase-health.json` | `usecase-health` | CareFlow Clinic |
| `flowforge-usecase-education.json` | `usecase-education` | Summit University |
| `flowforge-usecase-mining.json` | `usecase-mining` | OreGuard Mining |
| `flowforge-usecase-banking.json` | `usecase-banking` | LedgerBank |
| `flowforge-usecase-retail.json` | `usecase-retail` | Northline Market |
| `flowforge-usecase-government.json` | `usecase-government` | CivicAssist |
| `flowforge-usecase-crm.json` | `usecase-crm` | PulseCRM |

Regenerate:

```bash
node samples/industry-demos/build.mjs
```

### Deploy each pack

1. **Chatbots → Import** the JSON (re-import replaces an older tour-based pack).
2. Create **Demo Lab HTTP** (and optionally SQLite / email) using [`web/demo/CONNECTIONS.md`](../web/demo/CONNECTIONS.md), then bind on the chatbot HTTP steps.
3. **Publish**, enable public chat, set the public slug from the table.
   URL: `/o/{org-slug}/c/{public-slug}`.
4. Set **Platform settings → host organisation**, then `/use-cases` → **Try demo**.

Useful demo references: retail order `NL-45821`, government case `CA-2026-1188`, CRM account `rep@pulsecrm.example`, deal `DEAL-2026-0042`.

## University Student Admission

Created in CRM Team as chatbot **University Student Admission**.

### Entity (Data tab)

Dynamic entity `student_admissions` / **Student Admissions** with attributes:

| Key | Label | Type | Notes |
|-----|-------|------|-------|
| `first_name` | First name | string | required |
| `last_name` | Last name | string | required |
| `email` | Email | string | required, identifier |
| `phone` | Phone | string | optional |
| `date_of_birth` | Date of birth | date | required |
| `program` | Program of study | string | required |
| `high_school` | High school | string | optional |
| `gpa` | GPA | number | optional |
| `nationality` | Nationality | string | optional |

### Flow

Asks for each field, then **Entity → Create** into `student_admissions`, then confirms with `{{vars.application.id}}`.

Export a JSON copy anytime with **Export** on the chatbot Design/Data/Settings tabs.

`university-student-admission-flow.json` can be imported from the Chatbots screen. After import on another instance, recreate the entity first, then set the Entity step’s entity to the new `student_admissions` id (entity IDs are environment-specific). Newer exports that include `entityDefs` recreate the table for you.
