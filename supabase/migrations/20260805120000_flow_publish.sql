-- Draft vs published: designers edit live graph; Publish snapshots to published_graph.
alter table public.chatbot_flows
  add column if not exists published_graph jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists has_draft_changes boolean not null default true;

comment on column public.chatbot_flows.published_graph is
  'Immutable snapshot of the last published flow (nodes, edges, globals). Live runtimes should read this, not draft nodes/edges.';
comment on column public.chatbot_flows.published_at is
  'When the current published_graph was last published.';
comment on column public.chatbot_flows.has_draft_changes is
  'True when draft graph differs from published (or never published). Cleared on Publish; set on draft save.';
