# FlowForge robustness features

## Delivery status

Implemented locally and built successfully. **The database migration has not been applied to the connected Supabase project.** Automatic approval review rejected the persistent schema/security changes; explicit approval is required before applying them. The updated PHP replay endpoint also needs deployment to the API host. Database-backed features are not live until deployment.

## What is available in the implementation

| Area | Entry point | Behaviour |
| --- | --- | --- |
| Automated conversation tests | Design → Check before publishing; Test scenarios | Ordered answers, expected variables, step coverage and connector fixtures; no external requests during automatic tests. |
| Release control | Design → Release comparison; chatbot Operations | Draft/production/staging graph differences, exact-snapshot approval by another administrator, requests for staging promotion and rollback. Existing version history remains in use. |
| Integration operations | Operations → Integration failures; Webhooks | Latest failed/timed-out steps and one guarded replay per rejected webhook delivery. Uncertain outcomes are blocked. |
| Reusable subflows | Design → Reusable subflows | Shared graphs with mapped inputs and outputs, isolated local variables, revisions, recursion checks and expansion at preview/test/publish time. Published consumers update only on republish. |
| Data contracts | Existing response schema editor | Finite numeric values, valid calendar dates and own-property required-field checks; integration mocks use the actual runtime. |
| Conversation continuity | Operations → Resume expiry | Optional same-tab reload recovery at input boundaries, expiring tokens and revision checks against duplicate accepted submissions. |
| Environment connections | Operations → Environment connections | Separate installed staging/production connections; same organisation and kind required; secrets retrieved only by the server. Secret changes create metadata-only audit events. |
| Approvals and audit | Operations; organisation Audit | Single-use, exact-content approvals with no self-approval; settings, subflow and saved-reply changes audited. |
| Entity rules | Data → entity → Field validation and relationships | Numeric bounds, text length and unique-field references; referenced keys cannot be updated/deleted while in use. Excel import preflights rows and duplicate supplied IDs before entity creation. Existing import preview and required/unique constraints remain. |
| Accessibility/localisation | Step settings → Translations; Release comparison | Locale/language fallback and placeholder/label checks. This is not a complete accessibility audit or full UI translation system. |
| Support tools | Conversation details | Deterministic event summary and shared saved replies inserted into the reply draft. Existing queues, assignment and notes remain. |
| Consent and privacy | Operations; organisation Compliance | Consent before new chat, sensitive-question/variable masking of newly logged answers, outputs and echoed text. Existing retention/export/deletion remains. |

## Deliberate limits

- Resume uses browser session storage and is not guaranteed after closing a tab. Staging and flows containing sensitive questions, sign-in, transfer, optional-answer timers, or configured sensitive variables do not checkpoint. A crash during a remote operation cannot guarantee recovery or exactly-once delivery; a claimed input clears the old checkpoint before continuation.
- Expiry blocks checkpoint access. Existing session retention/deletion determines physical removal. Historical logs are not retroactively masked; data explicitly sent to integrations is not automatically redacted.
- Subflows require one entry and a return path; custom on-run scripts, restart and transfer are unsupported. They are snapshot dependencies, not live edits to published bots.
- Replay is limited to rejected HTTP statuses 401, 403, 404, 422 and 429. It requires an administrator and explicit action. One claim is consumed even if replay later fails. Check the destination when a result is uncertain.
- Entity rules apply on future record writes. Review existing records before configuring a relationship. Import preflight does not make network writes transactional.
- Release comparison excludes layout and does not compare globals/templates. Content checks do not replace keyboard, screen-reader, mobile and theme testing. Conversation summaries count recorded events; they do not infer user intent.
- Designer preview uses its selected connection rather than public-session environment bindings. Automatic mocks are test fixtures, not production overrides.

## Deployment (pending approval)

1. Review `supabase/migrations/20260925105146_chatbot_operations.sql`. It adds operations settings, subflows, saved replies, release reviews, checkpoints and replay claims with RLS, RPCs, audit/approval/entity triggers and indexes. It adds `entity_attributes.validation_rules` and restricts credential retrieval to `service_role`.
2. After explicit approval, apply this migration to the intended Supabase environment using the normal migration process, then run security/performance advisors and regenerate database types. The local test harness is not a production migration substitute.
3. Deploy the updated `web/api` PHP files, including `webhooks/replay.php` and routing in `index.php`, with the existing server-side service-role configuration.
4. Deploy the frontend build. Public chat falls back to existing behaviour only when the new policy RPC is missing; other failures do not silently bypass consent. New controls remain disabled when their setup query fails.
5. Smoke-test with a non-production chatbot: request/approve/publish using two administrator accounts; select staging credentials; reload a resumable text-only chat; verify consent and masked logs; test a relationship violation; insert a saved reply; use a deliberately rejected webhook for replay. Never use real payments as test fixtures.
6. Keep approvals and resume disabled until configured and tested for each chatbot. No controls were enabled or real webhooks sent during implementation.

## Verification

- TypeScript project check: passed.
- Production frontend build: passed; existing bundle-size and mixed-import warnings remain.
- Focused Vitest suites: 25 passed, including actual-runtime subflow isolation, mocks, privacy, graph differences, contracts and checkpoint serialization/failure handling.
- Isolated PostgreSQL/PGlite harness: 31 checks passed, covering RLS, approval consumption, checkpoint conflicts/revocation, replay guards, entity references/limits, environment routing and secret audit masking. Connected production data was not changed.
- Browser check: Operations page renders, existing integration failures load, and uninstalled controls display a setup message and remain disabled. Database-backed interactions still need a post-migration smoke test.
- PHP syntax checks: replay endpoint and router passed.

To repeat focused tests from `web`, run `node node_modules/vitest/vitest.mjs run src/features/operations src/features/designer/preview/automatedScenarios.test.ts`. The isolated SQL harness is `web/scripts/test-operations-db.mjs`; install `@electric-sql/pglite@0.5.8` under the system temporary directory's `flowforge-operations-db` folder, then run the script. It creates an in-memory fixture database and applies the migration only there.
