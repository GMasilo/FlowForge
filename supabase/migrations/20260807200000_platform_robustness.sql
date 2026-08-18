-- Platform robustness: soft-delete, publish history, audit, conversations,
-- webhooks, quotas, host allowlists, public chat, invite email status RPC.

-- ---------------------------------------------------------------------------
-- Soft delete + public chat on chatbots
-- ---------------------------------------------------------------------------
alter table public.chatbots
  add column if not exists deleted_at timestamptz,
  add column if not exists public_enabled boolean not null default false,
  add column if not exists public_slug text;

create unique index if not exists chatbots_public_slug_uidx
  on public.chatbots (public_slug)
  where public_slug is not null and deleted_at is null;

alter table public.connections
  add column if not exists deleted_at timestamptz;

alter table public.chatbot_entities
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Org quotas + HTTP host allowlist
-- ---------------------------------------------------------------------------
alter table public.instances
  add column if not exists http_host_allowlist text[] not null default '{}'::text[],
  add column if not exists quota_max_conversations_month integer not null default 10000,
  add column if not exists quota_max_emails_month integer not null default 5000,
  add column if not exists quota_max_http_calls_month integer not null default 50000;

create table if not exists public.instance_usage_monthly (
  instance_id uuid not null references public.instances (id) on delete cascade,
  year_month text not null,
  conversations integer not null default 0,
  emails integer not null default 0,
  http_calls integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (instance_id, year_month),
  constraint instance_usage_monthly_ym_check check (year_month ~ '^\d{4}-\d{2}$')
);

alter table public.instance_usage_monthly enable row level security;

drop policy if exists "instance_usage_select_member" on public.instance_usage_monthly;
create policy "instance_usage_select_member"
on public.instance_usage_monthly for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "instance_usage_admin_update" on public.instance_usage_monthly;
create policy "instance_usage_admin_update"
on public.instance_usage_monthly for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- ---------------------------------------------------------------------------
-- Publish history
-- ---------------------------------------------------------------------------
create table if not exists public.flow_publish_versions (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  version integer not null,
  published_graph jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  note text,
  unique (flow_id, version)
);

create index if not exists flow_publish_versions_chatbot_idx
  on public.flow_publish_versions (chatbot_id, published_at desc);

alter table public.flow_publish_versions enable row level security;

drop policy if exists "flow_publish_versions_select" on public.flow_publish_versions;
create policy "flow_publish_versions_select"
on public.flow_publish_versions for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "flow_publish_versions_insert" on public.flow_publish_versions;
create policy "flow_publish_versions_insert"
on public.flow_publish_versions for insert to authenticated
with check (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid references public.instances (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_instance_idx
  on public.audit_events (instance_id, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select_admin" on public.audit_events;
create policy "audit_events_select_admin"
on public.audit_events for select to authenticated
using (
  instance_id is not null
  and public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

drop policy if exists "audit_events_insert_member" on public.audit_events;
create policy "audit_events_insert_member"
on public.audit_events for insert to authenticated
with check (
  instance_id is not null
  and public.is_instance_member(instance_id)
);

-- ---------------------------------------------------------------------------
-- Conversation sessions + events (runtime transcripts / observability)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed', 'failed', 'abandoned')),
  visitor_key text,
  publish_version integer,
  variables jsonb not null default '{}'::jsonb,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists conversation_sessions_chatbot_idx
  on public.conversation_sessions (chatbot_id, created_at desc);
create index if not exists conversation_sessions_instance_idx
  on public.conversation_sessions (instance_id, created_at desc);

create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions (id) on delete cascade,
  seq integer not null,
  kind text not null,
  node_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

create index if not exists conversation_events_session_idx
  on public.conversation_events (session_id, seq);

alter table public.conversation_sessions enable row level security;
alter table public.conversation_events enable row level security;

drop policy if exists "conversation_sessions_select" on public.conversation_sessions;
create policy "conversation_sessions_select"
on public.conversation_sessions for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "conversation_sessions_write" on public.conversation_sessions;
create policy "conversation_sessions_write"
on public.conversation_sessions for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[]));

drop policy if exists "conversation_events_select" on public.conversation_events;
create policy "conversation_events_select"
on public.conversation_events for select to authenticated
using (
  exists (
    select 1 from public.conversation_sessions s
    where s.id = session_id and public.is_instance_member(s.instance_id)
  )
);

drop policy if exists "conversation_events_write" on public.conversation_events;
create policy "conversation_events_write"
on public.conversation_events for all to authenticated
using (
  exists (
    select 1 from public.conversation_sessions s
    where s.id = session_id
      and public.has_instance_role(s.instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  )
)
with check (
  exists (
    select 1 from public.conversation_sessions s
    where s.id = session_id
      and public.has_instance_role(s.instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  )
);

-- ---------------------------------------------------------------------------
-- Webhooks
-- ---------------------------------------------------------------------------
create table if not exists public.instance_webhooks (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null,
  url text not null,
  secret text not null default encode(gen_random_bytes(24), 'hex'),
  events text[] not null default '{}'::text[],
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instance_webhooks_instance_idx
  on public.instance_webhooks (instance_id);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.instance_webhooks (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status_code integer,
  ok boolean,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_webhook_idx
  on public.webhook_deliveries (webhook_id, created_at desc);

alter table public.instance_webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;

drop policy if exists "instance_webhooks_admin" on public.instance_webhooks;
create policy "instance_webhooks_admin"
on public.instance_webhooks for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

drop policy if exists "webhook_deliveries_admin" on public.webhook_deliveries;
create policy "webhook_deliveries_admin"
on public.webhook_deliveries for select to authenticated
using (
  exists (
    select 1 from public.instance_webhooks w
    where w.id = webhook_id
      and public.has_instance_role(w.instance_id, array['owner', 'admin']::public.instance_role[])
  )
);

drop policy if exists "webhook_deliveries_insert_admin" on public.webhook_deliveries;
create policy "webhook_deliveries_insert_admin"
on public.webhook_deliveries for insert to authenticated
with check (
  exists (
    select 1 from public.instance_webhooks w
    where w.id = webhook_id
      and public.has_instance_role(w.instance_id, array['owner', 'admin']::public.instance_role[])
  )
);

-- ---------------------------------------------------------------------------
-- Helpers: audit, usage, invite email status, public chat, publish/rollback
-- ---------------------------------------------------------------------------
create or replace function public.write_audit_event(
  p_instance_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_instance_id is null or not public.is_instance_member(p_instance_id) then
    raise exception 'Not allowed';
  end if;

  insert into public.audit_events (instance_id, actor_id, action, resource_type, resource_id, meta)
  values (p_instance_id, auth.uid(), p_action, p_resource_type, p_resource_id, coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.write_audit_event(uuid, text, text, text, jsonb) to authenticated;

create or replace function public.mark_invite_email_status(
  p_invite_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance_id uuid;
begin
  select instance_id into v_instance_id
  from public.instance_invites
  where id = p_invite_id;

  if v_instance_id is null then
    raise exception 'Invite not found';
  end if;

  if not public.has_instance_role(v_instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  if p_ok then
    update public.instance_invites
    set email_sent_at = now(), email_last_error = null
    where id = p_invite_id;
  else
    update public.instance_invites
    set email_last_error = left(coalesce(p_error, 'Failed to send invite email'), 500)
    where id = p_invite_id;
  end if;
end;
$$;

grant execute on function public.mark_invite_email_status(uuid, boolean, text) to authenticated;
-- Also callable via service role from PHP after send
grant execute on function public.mark_invite_email_status(uuid, boolean, text) to service_role;

create or replace function public.increment_instance_usage(
  p_instance_id uuid,
  p_conversations integer default 0,
  p_emails integer default 0,
  p_http_calls integer default 0
)
returns public.instance_usage_monthly
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ym text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_row public.instance_usage_monthly;
  v_inst public.instances;
begin
  select * into v_inst from public.instances where id = p_instance_id;
  if v_inst.id is null then
    raise exception 'Organisation not found';
  end if;

  insert into public.instance_usage_monthly as u (instance_id, year_month, conversations, emails, http_calls)
  values (p_instance_id, v_ym, greatest(p_conversations, 0), greatest(p_emails, 0), greatest(p_http_calls, 0))
  on conflict (instance_id, year_month) do update
  set
    conversations = u.conversations + greatest(excluded.conversations, 0),
    emails = u.emails + greatest(excluded.emails, 0),
    http_calls = u.http_calls + greatest(excluded.http_calls, 0),
    updated_at = now()
  returning * into v_row;

  if v_row.conversations > v_inst.quota_max_conversations_month then
    raise exception 'Monthly conversation quota exceeded';
  end if;
  if v_row.emails > v_inst.quota_max_emails_month then
    raise exception 'Monthly email quota exceeded';
  end if;
  if v_row.http_calls > v_inst.quota_max_http_calls_month then
    raise exception 'Monthly HTTP call quota exceeded';
  end if;

  return v_row;
end;
$$;

grant execute on function public.increment_instance_usage(uuid, integer, integer, integer) to authenticated;
grant execute on function public.increment_instance_usage(uuid, integer, integer, integer) to service_role;

create or replace function public.check_instance_quota(
  p_instance_id uuid,
  p_kind text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ym text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_inst public.instances;
  v_usage public.instance_usage_monthly;
begin
  select * into v_inst from public.instances where id = p_instance_id;
  if v_inst.id is null then
    return false;
  end if;

  select * into v_usage
  from public.instance_usage_monthly
  where instance_id = p_instance_id and year_month = v_ym;

  if p_kind = 'conversations' then
    return coalesce(v_usage.conversations, 0) < v_inst.quota_max_conversations_month;
  elsif p_kind = 'emails' then
    return coalesce(v_usage.emails, 0) < v_inst.quota_max_emails_month;
  elsif p_kind = 'http_calls' then
    return coalesce(v_usage.http_calls, 0) < v_inst.quota_max_http_calls_month;
  end if;

  return false;
end;
$$;

grant execute on function public.check_instance_quota(uuid, text) to authenticated;
grant execute on function public.check_instance_quota(uuid, text) to service_role;
grant execute on function public.check_instance_quota(uuid, text) to anon;

create or replace function public.get_public_chatbot(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bot public.chatbots;
  v_flow public.chatbot_flows;
begin
  if p_slug is null or trim(p_slug) = '' then
    return null;
  end if;

  select * into v_bot
  from public.chatbots
  where public_enabled = true
    and deleted_at is null
    and lower(public_slug) = lower(trim(p_slug));

  if v_bot.id is null then
    return null;
  end if;

  select * into v_flow
  from public.chatbot_flows
  where chatbot_id = v_bot.id;

  if v_flow.published_graph is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_bot.id,
    'name', v_bot.name,
    'description', v_bot.description,
    'instance_id', v_bot.instance_id,
    'public_slug', v_bot.public_slug,
    'publish_version', v_flow.version,
    'published_at', v_flow.published_at,
    'published_graph', v_flow.published_graph
  );
end;
$$;

grant execute on function public.get_public_chatbot(text) to anon, authenticated;

create or replace function public.start_public_conversation(
  p_slug text,
  p_visitor_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot public.chatbots;
  v_flow public.chatbot_flows;
  v_session public.conversation_sessions;
begin
  select * into v_bot
  from public.chatbots
  where public_enabled = true
    and deleted_at is null
    and lower(public_slug) = lower(trim(p_slug));

  if v_bot.id is null then
    raise exception 'Chatbot not found or not public';
  end if;

  if not public.check_instance_quota(v_bot.instance_id, 'conversations') then
    raise exception 'Monthly conversation quota exceeded';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_flow.published_graph is null then
    raise exception 'Chatbot is not published';
  end if;

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version
  ) values (
    v_bot.id, v_bot.instance_id, 'active', nullif(trim(coalesce(p_visitor_key, '')), ''), v_flow.version
  )
  returning * into v_session;

  perform public.increment_instance_usage(v_bot.instance_id, 1, 0, 0);

  return jsonb_build_object(
    'session_id', v_session.id,
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'publish_version', v_session.publish_version,
    'published_graph', v_flow.published_graph,
    'name', v_bot.name
  );
end;
$$;

grant execute on function public.start_public_conversation(text, text) to anon, authenticated;

create or replace function public.append_conversation_event(
  p_session_id uuid,
  p_kind text,
  p_node_key text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.conversation_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_seq integer;
  v_row public.conversation_events;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Session is not active';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
  from public.conversation_events
  where session_id = p_session_id;

  insert into public.conversation_events (session_id, seq, kind, node_key, payload)
  values (p_session_id, v_seq, p_kind, p_node_key, coalesce(p_payload, '{}'::jsonb))
  returning * into v_row;

  update public.conversation_sessions
  set updated_at = now()
  where id = p_session_id;

  return v_row;
end;
$$;

grant execute on function public.append_conversation_event(uuid, text, text, jsonb) to anon, authenticated, service_role;

create or replace function public.complete_conversation_session(
  p_session_id uuid,
  p_status text default 'completed',
  p_error_summary text default null,
  p_variables jsonb default null
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conversation_sessions;
  v_status text := lower(coalesce(p_status, 'completed'));
begin
  if v_status not in ('completed', 'failed', 'abandoned') then
    v_status := 'completed';
  end if;

  update public.conversation_sessions
  set
    status = v_status,
    error_summary = p_error_summary,
    variables = coalesce(p_variables, variables),
    completed_at = now(),
    updated_at = now()
  where id = p_session_id
    and status = 'active'
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.conversation_sessions where id = p_session_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.complete_conversation_session(uuid, text, text, jsonb) to anon, authenticated, service_role;

create or replace function public.connection_config_for_public_chat(
  p_connection_id uuid,
  p_chatbot_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_bot public.chatbots;
  v_config jsonb;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null or v_session.chatbot_id <> p_chatbot_id or v_session.status <> 'active' then
    return null;
  end if;

  select * into v_bot from public.chatbots where id = p_chatbot_id;
  if v_bot.id is null or v_bot.deleted_at is not null or not v_bot.public_enabled then
    return null;
  end if;

  if not exists (
    select 1 from public.connections c
    where c.id = p_connection_id
      and c.deleted_at is null
      and c.instance_id = v_bot.instance_id
      and (
        c.chatbot_id = p_chatbot_id
        or exists (
          select 1 from public.chatbot_connections cc
          where cc.connection_id = c.id and cc.chatbot_id = p_chatbot_id
        )
      )
  ) then
    return null;
  end if;

  select s.config into v_config
  from public.connection_secrets s
  where s.connection_id = p_connection_id;

  return coalesce(v_config, '{}'::jsonb);
end;
$$;

grant execute on function public.connection_config_for_public_chat(uuid, uuid, uuid) to service_role;

create or replace function public.instance_http_allowlist(p_instance_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(http_host_allowlist, '{}'::text[])
  from public.instances
  where id = p_instance_id;
$$;

grant execute on function public.instance_http_allowlist(uuid) to authenticated, service_role;

create or replace function public.publish_flow_version(
  p_flow_id uuid,
  p_published_graph jsonb,
  p_note text default null
)
returns public.flow_publish_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow public.chatbot_flows;
  v_bot public.chatbots;
  v_next integer;
  v_now timestamptz := now();
  v_row public.flow_publish_versions;
begin
  select * into v_flow from public.chatbot_flows where id = p_flow_id;
  if v_flow.id is null then
    raise exception 'Flow not found';
  end if;

  select * into v_bot from public.chatbots where id = v_flow.chatbot_id and deleted_at is null;
  if v_bot.id is null then
    raise exception 'Chatbot not found';
  end if;

  if not public.has_instance_role(v_bot.instance_id, array['owner', 'admin', 'editor']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  v_next := case when v_flow.published_at is null then 1 else coalesce(v_flow.version, 0) + 1 end;

  update public.chatbot_flows
  set
    published_graph = p_published_graph,
    published_at = v_now,
    version = v_next,
    has_draft_changes = false,
    updated_at = v_now
  where id = p_flow_id;

  update public.chatbots set updated_at = v_now where id = v_bot.id;

  insert into public.flow_publish_versions (
    flow_id, chatbot_id, instance_id, version, published_graph, published_at, published_by, note
  ) values (
    p_flow_id, v_bot.id, v_bot.instance_id, v_next, p_published_graph, v_now, auth.uid(), p_note
  )
  returning * into v_row;

  perform public.write_audit_event(
    v_bot.instance_id,
    'flow.published',
    'chatbot_flow',
    p_flow_id::text,
    jsonb_build_object('version', v_next, 'chatbot_id', v_bot.id)
  );

  return v_row;
end;
$$;

grant execute on function public.publish_flow_version(uuid, jsonb, text) to authenticated;

create or replace function public.rollback_flow_version(
  p_flow_id uuid,
  p_version integer
)
returns public.chatbot_flows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow public.chatbot_flows;
  v_bot public.chatbots;
  v_hist public.flow_publish_versions;
  v_now timestamptz := now();
  v_next integer;
begin
  select * into v_flow from public.chatbot_flows where id = p_flow_id;
  if v_flow.id is null then
    raise exception 'Flow not found';
  end if;

  select * into v_bot from public.chatbots where id = v_flow.chatbot_id and deleted_at is null;
  if v_bot.id is null then
    raise exception 'Chatbot not found';
  end if;

  if not public.has_instance_role(v_bot.instance_id, array['owner', 'admin', 'editor']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  select * into v_hist
  from public.flow_publish_versions
  where flow_id = p_flow_id and version = p_version;

  if v_hist.id is null then
    raise exception 'Publish version not found';
  end if;

  v_next := coalesce(v_flow.version, 0) + 1;

  update public.chatbot_flows
  set
    published_graph = v_hist.published_graph,
    published_at = v_now,
    version = v_next,
    has_draft_changes = true,
    updated_at = v_now
  where id = p_flow_id
  returning * into v_flow;

  insert into public.flow_publish_versions (
    flow_id, chatbot_id, instance_id, version, published_graph, published_at, published_by, note
  ) values (
    p_flow_id, v_bot.id, v_bot.instance_id, v_next, v_hist.published_graph, v_now, auth.uid(),
    'Rollback to version ' || p_version::text
  );

  perform public.write_audit_event(
    v_bot.instance_id,
    'flow.rollback',
    'chatbot_flow',
    p_flow_id::text,
    jsonb_build_object('from_version', p_version, 'new_version', v_next, 'chatbot_id', v_bot.id)
  );

  return v_flow;
end;
$$;

grant execute on function public.rollback_flow_version(uuid, integer) to authenticated;

create or replace function public.soft_delete_chatbot(p_chatbot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot public.chatbots;
begin
  select * into v_bot from public.chatbots where id = p_chatbot_id and deleted_at is null;
  if v_bot.id is null then
    raise exception 'Chatbot not found';
  end if;
  if not public.has_instance_role(v_bot.instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  update public.chatbots
  set deleted_at = now(), public_enabled = false, updated_at = now()
  where id = p_chatbot_id;

  perform public.write_audit_event(v_bot.instance_id, 'chatbot.soft_delete', 'chatbot', p_chatbot_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.restore_chatbot(p_chatbot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot public.chatbots;
begin
  select * into v_bot from public.chatbots where id = p_chatbot_id and deleted_at is not null;
  if v_bot.id is null then
    raise exception 'Deleted chatbot not found';
  end if;
  if not public.has_instance_role(v_bot.instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  update public.chatbots
  set deleted_at = null, updated_at = now()
  where id = p_chatbot_id;

  perform public.write_audit_event(v_bot.instance_id, 'chatbot.restore', 'chatbot', p_chatbot_id::text, '{}'::jsonb);
end;
$$;

grant execute on function public.soft_delete_chatbot(uuid) to authenticated;
grant execute on function public.restore_chatbot(uuid) to authenticated;

create or replace function public.list_webhooks_for_event(
  p_instance_id uuid,
  p_event text
)
returns setof public.instance_webhooks
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.instance_webhooks
  where instance_id = p_instance_id
    and enabled = true
    and p_event = any (events);
$$;

grant execute on function public.list_webhooks_for_event(uuid, text) to service_role;

-- Soft-delete select policies replace the original member select.
drop policy if exists "chatbots_select_member" on public.chatbots;
drop policy if exists "chatbots_select_active" on public.chatbots;
drop policy if exists "chatbots_select_deleted_admin" on public.chatbots;

create policy "chatbots_select_active"
on public.chatbots for select to authenticated
using (
  public.is_instance_member(instance_id)
  and deleted_at is null
);

create policy "chatbots_select_deleted_admin"
on public.chatbots for select to authenticated
using (
  deleted_at is not null
  and public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

-- Webhook helpers for public session emit
create or replace function public.get_conversation_session_for_webhook(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'chatbot_id', s.chatbot_id,
    'instance_id', s.instance_id,
    'status', s.status,
    'publish_version', s.publish_version,
    'error_summary', s.error_summary,
    'completed_at', s.completed_at,
    'created_at', s.created_at
  )
  from public.conversation_sessions s
  where s.id = p_session_id;
$$;

grant execute on function public.get_conversation_session_for_webhook(uuid) to service_role;

create or replace function public.record_webhook_delivery(
  p_webhook_id uuid,
  p_event text,
  p_payload jsonb,
  p_status_code integer default null,
  p_ok boolean default null,
  p_error text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.webhook_deliveries (webhook_id, event, payload, status_code, ok, error)
  values (
    p_webhook_id,
    p_event,
    coalesce(p_payload, '{}'::jsonb),
    p_status_code,
    p_ok,
    left(p_error, 500)
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.record_webhook_delivery(uuid, text, jsonb, integer, boolean, text) to service_role;

create or replace function public.soft_delete_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conn public.connections;
begin
  select * into v_conn from public.connections where id = p_connection_id and deleted_at is null;
  if v_conn.id is null then
    raise exception 'Connection not found';
  end if;
  if not public.has_instance_role(v_conn.instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  update public.connections set deleted_at = now(), updated_at = now() where id = p_connection_id;
  perform public.write_audit_event(v_conn.instance_id, 'connection.soft_delete', 'connection', p_connection_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.restore_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conn public.connections;
begin
  select * into v_conn from public.connections where id = p_connection_id and deleted_at is not null;
  if v_conn.id is null then
    raise exception 'Deleted connection not found';
  end if;
  if not public.has_instance_role(v_conn.instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  update public.connections set deleted_at = null, updated_at = now() where id = p_connection_id;
  perform public.write_audit_event(v_conn.instance_id, 'connection.restore', 'connection', p_connection_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.soft_delete_entity(p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity public.chatbot_entities;
  v_instance uuid;
begin
  select * into v_entity from public.chatbot_entities where id = p_entity_id and deleted_at is null;
  if v_entity.id is null then
    raise exception 'Entity not found';
  end if;
  v_instance := public.chatbot_instance_id(v_entity.chatbot_id);
  if not public.has_instance_role(v_instance, array['owner', 'admin', 'editor']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  update public.chatbot_entities set deleted_at = now(), updated_at = now() where id = p_entity_id;
  perform public.write_audit_event(v_instance, 'entity.soft_delete', 'entity', p_entity_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.restore_entity(p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity public.chatbot_entities;
  v_instance uuid;
begin
  select * into v_entity from public.chatbot_entities where id = p_entity_id and deleted_at is not null;
  if v_entity.id is null then
    raise exception 'Deleted entity not found';
  end if;
  v_instance := public.chatbot_instance_id(v_entity.chatbot_id);
  if not public.has_instance_role(v_instance, array['owner', 'admin', 'editor']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  update public.chatbot_entities set deleted_at = null, updated_at = now() where id = p_entity_id;
  perform public.write_audit_event(v_instance, 'entity.restore', 'entity', p_entity_id::text, '{}'::jsonb);
end;
$$;

grant execute on function public.soft_delete_connection(uuid) to authenticated;
grant execute on function public.restore_connection(uuid) to authenticated;
grant execute on function public.soft_delete_entity(uuid) to authenticated;
grant execute on function public.restore_entity(uuid) to authenticated;

-- Exclude soft-deleted connections from execution secret resolution
create or replace function public.connection_config_for_use(p_connection_id uuid, p_chatbot_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_ok boolean;
begin
  select exists (
    select 1
    from public.connections c
    where c.id = p_connection_id
      and c.deleted_at is null
      and public.is_instance_member(c.instance_id)
      and (
        c.chatbot_id = p_chatbot_id
        or (
          exists (
            select 1 from public.chatbot_connections cc
            where cc.connection_id = c.id and cc.chatbot_id = p_chatbot_id
          )
          and (
            public.can_manage_connection(c.id)
            or c.visibility = 'global'
            or (
              c.visibility = 'shared'
              and exists (
                select 1 from public.connection_shares s
                where s.connection_id = c.id and s.user_id = auth.uid()
              )
            )
          )
        )
      )
      and public.has_instance_role(
        public.chatbot_instance_id(p_chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  ) into v_ok;

  if not v_ok then
    return null;
  end if;

  select s.config into v_config
  from public.connection_secrets s
  where s.connection_id = p_connection_id;

  return coalesce(v_config, '{}'::jsonb);
end;
$$;
