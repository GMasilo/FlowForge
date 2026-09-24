# FlowForge Atlas

A fictional experience business built to demonstrate FlowForge through ten connected journeys. The main menu lets visitors explore in any order instead of forcing them through a long questionnaire.

**167 steps ? 183 connections between steps ? 19 step types ? 46 question response types ? 8 entities ? 31 template types.**

## Import and first run

1. Create a **new chatbot** for Atlas. Import `FlowForge-Atlas.json` using the chatbot's flow import action. Importing into an existing bot replaces its flow; use a separate bot for this showcase.
2. Use the updated local app: the accompanying importer fix preserves newer template kinds, including payment, map, QR, calendar and social share. Older builds silently drop these kinds. The local runtime also includes a fix allowing finite loops to process every row without being mistaken for an automatic cycle.
3. Confirm that the Templates page contains 31 Atlas templates and Data contains eight Atlas entities. Sample products, suppliers and FAQ rows are included; dynamic entities start empty.
4. Keep global **demoMode = true**. Start Preview and use a fictional name. Previewing a demo still creates ordinary session/run records. Booking, support and feedback journeys write fictional records to their imported dynamic entities.
5. For image-choice cards, upload the three files in `media/` to this chatbot's media library using their exact filenames. Other journeys do not need these images.
6. In Chat appearance, choose Aurora, Botanical or Ocean, then **Use theme colours**. Try the dots or grid background. Appearance settings are not part of the current flow import format and must be selected separately.
7. Explore every journey. The suggested presenter sequence below takes about 15-20 minutes, depending on how many playground controls you try.

## Journeys and what they demonstrate

| Journey | What to show |
|---|---|
| Commerce & checkout | Entity queries with selected columns; a 12-product full-width paginated table; maximise; a catalog/cart; demo checkout; payment-template blueprint; receipt |
| Bookings & documents | Autocomplete, date/time, guest stepper, multi-field form, confirmation, entity create, input-bound itinerary PDF and calendar text |
| Customer support | FAQ data, free-text capture, urgency condition, priority assignment, ticket creation and guarded agent handoff |
| Data & Excel tables | Supplier entity join, selected columns, per-row loop, Excel-shaped records, create/update/get/delete of a disposable record |
| Automation & integrations | Arithmetic operation, mocked outputs, switch routing, guarded HTTP/SQL/email/native integration/transfer, recovery from live failures, browser host event |
| Response playground | Five selectable families cover every response type; individual questions can be skipped |
| Rich content gallery | Reusable copy, opening hours, map, QR, WhatsApp card, social links, PDF certificate/agreement/checklist, FAQ and pricing |
| Identity & permissions | Clearly labelled fictional identity; guarded HTTP sign-in; optional SSO template blueprint |
| Feedback & analytics | NPS-based branching, feedback persistence and pointers to journey/runtime/operations intelligence |
| Finish the tour | Explicit restart or a personalised end message |

## Presenter sequence

1. Introduce yourself at the welcome step and open **Commerce & checkout**. Maximise the product table, move to its second page, add a cart item and complete the simulated checkout.
2. Open **Bookings & documents**. Enter fictional contact details, select a date and download the generated itinerary.
3. Open **Customer support** and choose Urgent. Show the high-priority record in the imported Tickets entity.
4. Open **Data & Excel tables**. Watch the supplier loop and maximise the regional table. Show that the scratch record is deleted after its update/read demonstration.
5. Open **Automation & integrations**, choose HTTP tracking, and inspect the run history. Repeat with a different connector blueprint. Demo mode does not call these external services.
6. Explore response families independently, then open the rich gallery and feedback journey.
7. In the designer, inspect Design Intelligence and try auto-layout on a copy. In Analytics, inspect generated runs, journeys and tables. Operations intelligence lives in the inbox and needs actual queue/agent activity to produce useful results.

## Demo versus live

`demoMode` gates **payment, handoff, identity, HTTP, database, email, native integration and chatbot transfer**. It does not disable normal FlowForge storage, media rendering, browser permission prompts or clicks on links. Maps can load an external provider. Browser events are local host-page events, not Slack/Jira webhooks.

The full pack intentionally contains unconfigured LIVE nodes. Designer reference checks may report missing connections, queue, integration or target chatbot even while demoMode is true. Configure those references before publishing; do not bypass those checks. Draft Preview is the initial demonstration environment.

The demo payment is explicitly marked simulated and is never evidence of a real payment. The OTP playground is format-only, with no email delivery or identity verification. Identity demo data is not authentication.

The card, password and national-ID controls demonstrate UI only. Use synthetic values or Skip. Answers can appear in step history/session data even when no global output variable is set. For a real payment journey use the hosted payment provider flow.

## Configure live services later

`Connection-and-webhook-blueprints.json` is a **setup reference, not a FlowForge import file**. Connections, integration installations, queues, webhook subscriptions and target chatbots are not included in the flow import format.

Create the required connections through the app, install them on Atlas, then select their generated IDs:

| Step/template | Configure |
|---|---|
| `live_http` | Tracking HTTP connection and path; expected response mapping |
| `live_database` | Reporting database connection, actual SQL schema and named input parameter |
| `live_email` | SMTP connection; real collected recipient; `atlas_email` template |
| `atlas_payment` / `live_payment` | Stripe **or** PayFast sandbox connection, currency/amount/buyer mappings, and callback shown by the app |
| `identity_live` | Actual authentication HTTP endpoint, request keys and user/token/profile response paths |
| `live_integration` | Installed integration, provider action and field values |
| `live_handoff` | Queue and agent membership/availability |
| `live_transfer` | Existing specialist chatbot and correct variable mappings |
| `atlas_sso` | Optional identity-provider setup; separate from the default HTTP sign-in lane |

Store real credentials in connection/webhook settings, never in the imported flow. Replace `visitor.email`, provider placeholders and sample URLs before testing live actions. Turn demoMode off only after configuring every live branch you intend to exercise. Keep provider sandbox/test mode on until your own acceptance checks are complete.

Slack and Jira blueprints belong under **Chatbot Webhooks**. They are not automatically created, subscribed or sent by this pack. Choose events supported by the current UI and inspect each test's full result. Slack bot mode uses Bearer auth; Jira uses the email/API-token Basic auth fields. The host event button in the flow does not itself trigger these webhooks.

## Data and template notes

- Eight entities: products, suppliers and FAQs are seeded static catalogs; leads, bookings, tickets, feedback and scratch are dynamic. Leads is an optional extension schema included for your sales journey.
- Product supplier joins return nested supplier fields. The loop deliberately displays those fields individually; `tabulate` is used only for flat rows.
- `vars.excel.records` contains three fictional regional rows. This is an Excel-shaped fixture, **not an uploaded or parsed workbook**. Replace it with your real import step's records.
- The catalog template is a demo snapshot of the seeded product entity, not a live stock synchronisation service. Edit both or implement your own refresh logic.
- The image-choice SVGs are optional media assets. File/audio/location controls may need browser permissions and the configured FlowForge media API.
- Map locations, social/WhatsApp links, business terms and document text are examples. Replace them before public use. Calendar content uses a fixed future demo event.
- Generated documents are illustrative, not signed contracts or proof of identity/payment.
- All 31 current template kinds are included. Some are editable setup blueprints rather than actively used steps; they do not create connections or send messages by themselves.
- Analytics, A/B experiments, runtime protection, queue forecasts, routing suggestions, webhook delivery logs and design analysis are app-level capabilities. This pack supplies journeys/data to inspect; forecasts and regressions require enough real observations. It does not fabricate those results or enable experiments automatically.

## Validation

Automated checks use FlowForge's actual import parser and preview engine: all step/response/template types are retained, every node is reachable, every jump target exists, each main-menu route selects the intended journey, live calls are bypassed in demo mode, and gallery content resolves without raw expressions. The test harness does not contact live services or write database records.

## Files

- `FlowForge-Atlas.json` ? the file to import.
- `Connection-and-webhook-blueprints.json` ? manual setup reference.
- `media/` ? three optional image-choice illustrations.
- `README.md` ? setup and walkthrough.

The source generator is `build_atlas.py`; the repository helper `web/scripts/build-atlas.test.ts` fills current template defaults and validates the bundle. Rebuilding starts with the Python generator, then runs that helper with BUILD_ATLAS=1.
