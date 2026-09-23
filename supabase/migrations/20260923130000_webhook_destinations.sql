alter table public.instance_webhooks
  add column destination text not null default 'custom'
    check (destination in ('custom', 'slack', 'jira')),
  add column destination_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(destination_config) = 'object');

comment on column public.instance_webhooks.destination_config is
  'Admin-only configuration: message, body template, Jira token, custom headers. Never expose in public chatbot data.';
