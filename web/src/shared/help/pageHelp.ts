/** Concise in-app help for page headers and important sections. */

export const PAGE_HELP = {
  chatbots:
    'Create and open chatbots for this organisation. Search by name/description, filter by publish status, and switch Grid, Details, or Compact. Lists load in batches as you scroll; admins can multi-select loaded bots and move them to the Recycle bin. Import/export flow JSON and use Open designer for flows.',
  adminOverview:
    'Organisation dashboard — counts for chatbots, users, usage, and webhooks. Recent activity links to the full Audit log. Use the Admin tabs for settings and ops.',
  adminChatbots:
    'Inventory view for soft-deleting chatbots. Design and publish stay on the Chatbots home. Move to recycle bin disables public chat until restored.',
  users:
    'Invite by email and assign roles: Admin, Editor, Agent (Inbox only), or Viewer. Pending invites until accepted. Agents land on Inbox after sign-in.',
  recycleBin:
    'Soft-deleted chatbots appear here. Restore to bring them back, or delete forever to remove flows and files permanently.',
  organisation:
    'Profile, contact, and billing details for this tenant. Contact email receives Alerts digests. Workspace branding can apply to public chat pages.',
  compliance:
    'Retention TTLs, legal hold, visitor export/delete, and consent policies. Run purge only when legal hold is off.',
  security:
    'Enterprise SSO (OIDC/SAML), SCIM provisioning, and long-lived Platform API tokens for service accounts.',
  usage:
    'Monthly quotas for conversations, emails, and HTTP calls. HTTP host allowlist restricts outbound hosts from flow steps.',
  webhooks:
    'Notify external HTTPS endpoints on flow.published and conversation completed/failed. Payloads include session variables.',
  audit:
    'Security and admin activity — publishes, marketplace actions, clones, and configuration changes.',
  alerts:
    'Weekly KPI digest and threshold rules (abandon rate, failures, completion, quota). Email uses organisation contact; Slack optional.',
  integrations:
    'Provider connectors (Slack, Drive, Sheets, …). Prefer Data → Integrations on a chatbot; org page still lists all accounts. Designer only shows installed ones. Slack also powers Alerts.',
  connections:
    'Organisation HTTP, email, and payment backends. ForgeHub lists global/shared definitions plus your private ones so you can install them onto other chatbots.',
  conversations:
    'Search and filter sessions by chatbot, status, environment (production/staging), and tags. Export CSV; open a row to replay and export JSON.',
  inbox:
    'Claim escalated chats, reply, transfer, and resolve. Filter by queue and assignee; save views for quick return. Go online to be auto-assigned.',
  agentConsole:
    'Configure queues (skills, SLAs, auto-assign) and agent profiles (max concurrent). Handoff steps target these queues.',
  analytics:
    'Session volume, completion, drop-off by step/version, shop products, transfers, and optional experiments.',
  marketplace:
    'Publish flow packs from a chatbot or install approved packs. Connection and integration IDs are stripped — rebind after install.',
  organisations:
    'Client accounts (tenants). App admins create organisations; members are invited per organisation.',
  profile: 'Your FlowForge account. Display name appears in collaboration and agent profiles. Service API tokens are created under Admin → Security.',
  conversationDetail:
    'Replay the transcript, inspect variables and publish version, export JSON, and (when escalated) claim, reply, transfer, or resolve.',
  platformSettings:
    'App-admin only. Configure the public landing page, contact details, landing demo, and industry use-case chatbots.',
} as const

export const SECTION_HELP = {
  dataRetention:
    'TTL days before sessions, events, files, and payment PII are eligible for purge. Legal hold blocks all deletes until turned off.',
  visitorDsar:
    'Enter a visitor key from Conversations to export JSON or delete that visitor’s data across this organisation.',
  consentPolicies:
    'Versioned policy text for consent steps. Use a stable policy_key; increment version when copy changes.',
  ssoConfigs:
    'OIDC or SAML for staff login. Restrict by email domain; set default role for new SSO users. Enforce SSO to require IdP.',
  scim:
    'Directory sync token for /api/scim/v2/. Shown once when created — store securely.',
  platformApiTokens:
    'Long-lived Bearer tokens for /v1 (prefix ffpat_). Shown once. Scoped to this organisation. Revoke to cut off a service immediately.',
  workspaceBranding:
    'Override product name, accent, and logo in the app shell. Optionally apply the same branding on public chat pages.',
  weeklyDigest:
    'Email KPIs to the organisation contact on the chosen UTC weekday. Optional Slack integration.',
  alertRules:
    'Threshold rules over a rolling window. Email and/or Slack; also creates in-app notifications for admins.',
  httpAllowlist:
    'Comma-separated hosts allowed for HTTP request steps. Empty uses the platform default policy.',
  webhookEvents:
    'flow.published fires when a graph is published. Conversation events include session variables in the payload.',
  queues:
    'Handoff steps target a queue. Auto-assign picks an online agent whose skills match and who is under max concurrent.',
  agentProfiles:
    'Skills must match queue routing rules. Max concurrent limits how many escalated chats an agent can hold open.',
  inboxFilters:
    'Filter by queue and assignee. Saved views store the current filter set. Toggle online so auto-assign includes you.',
  forgeHub:
    'Browse global/shared definitions and your private connections. Install into a selected chatbot, then verify secrets and bindings.',
  publishPack:
    'Serializes flow, globals, templates, entities, and scenarios. Public listings need approval before others can install.',
  serverAnalytics:
    'Funnel by step, weekly cohorts, and revenue-by-node when step.run and payment events are available.',
  transfers:
    'Sessions that fired session.transferred, outcomes after transfer, and transfer_failed (e.g. missing variables).',
  testScenarios:
    'Fixture globals for Preview. After a run, the Run panel checks expected variables and step keys.',
  globalVariables:
    'Defined on Settings. Available everywhere as {{vars.key}}. Mark transfer variables on receiving bots.',
  staging:
    'When enabled, publish to staging first, test with the Test tab or ?env=staging, then promote to production.',
  stagingTest:
    'Run the staging graph via a unique test link without enabling production public chat. Sessions are tagged staging and appear here in real time.',
  stagingTestUrl:
    'Each chatbot has one active test link. Rotate link replaces it immediately — older URLs stop working. This is not the public staging URL on Settings (?env=staging).',
  stagingLive:
    'Live transcript follows sessions started from the current test link only. Older links and public staging URLs are hidden unless you expand the session list.',
  stagingAnalytics:
    'Staging-only stats for the last 7 days — sessions, completion, median steps, and drop-off by step. Use Analytics with environment Staging for longer ranges.',
  stagingLiveCharts:
    'Overview charts aggregate all staging tests in the last 2 hours. Session charts under Live transcript follow the selected session and clear while that session loads.',
  stagingQualitative:
    'On completion, FlowForge interprets staging stats — completion, latency, connections, failures, and drop-off — into findings and recommendations. No external AI required.',
  stagingTestHistory:
    'All staging-environment sessions in the selected range — from unique Test tab links and public staging URLs (?env=staging). Open Replay for the transcript or Test for live monitoring.',
  runHistory:
    'Preview run log — each step executed, timing, and variable snapshots. Download JSON for debugging or sharing with teammates.',
  problemsPanel:
    'Validation and config issues before publish — missing variables, broken references, and template binding gaps. Click a row to jump to the step.',
  publicChat:
    'Enable a shareable production URL (/o/{org}/c/{slug}) and embed. Slugs are unique per organisation. Staging tests use the unique link on the Test tab — not this page.',
  chatAppearance:
    'Header, bubbles, logo or icon, font, typing style, and 24-hour Stories for public chat, embed, and designer preview. Organisation branding fills in any blanks.',
} as const
