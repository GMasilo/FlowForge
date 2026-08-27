-- Phase 3: Compliance toolkit + staging environments

-- ---------------------------------------------------------------------------
-- Consent
-- ---------------------------------------------------------------------------
create table if not exists public.consent_policies (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  policy_key text not null,
  version integer not null default 1,
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (instance_id, policy_key, version)
);

alter table public.consent_policies enable row level security;

drop policy if exists "consent_policies_select" on public.consent_policies;
create policy "consent_policies_select"
on public.consent_policies for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "consent_policies_write" on public.consent_policies;
create policy "consent_policies_write"
on public.consent_policies for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  session_id uuid references public.conversation_sessions (id) on delete set null,
  visitor_key text,
  policy_key text not null,
  policy_version integer not null,
  accepted boolean not null default true,
  evidence jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now()
);

create index if not exists consent_events_visitor_idx
  on public.consent_events (instance_id, visitor_key);

alter table public.consent_events enable row level security;

drop policy if exists "consent_events_select_admin" on public.consent_events;
create policy "consent_events_select_admin"
on public.consent_events for select to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- Public record consent via RPC
create or replace function public.record_consent_event(
  p_session_id uuid,
  p_policy_key text,
  p_policy_version integer,
  p_accepted boolean default true,
  p_evidence jsonb default '{}'::jsonb
)
returns public.consent_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_row public.consent_events;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;

  insert into public.consent_events (
    instance_id, session_id, visitor_key, policy_key, policy_version, accepted, evidence
  ) values (
    v_session.instance_id,
    p_session_id,
    v_session.visitor_key,
    p_policy_key,
    p_policy_version,
    coalesce(p_accepted, true),
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.record_consent_event(uuid, text, integer, boolean, jsonb)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Retention policies
-- ---------------------------------------------------------------------------
create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null unique references public.instances (id) on delete cascade,
  sessions_ttl_days integer not null default 365 check (sessions_ttl_days >= 1),
  events_ttl_days integer not null default 365 check (events_ttl_days >= 1),
  files_ttl_days integer not null default 180 check (files_ttl_days >= 1),
  payment_pii_ttl_days integer not null default 90 check (payment_pii_ttl_days >= 1),
  legal_hold boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.data_retention_policies enable row level security;

drop policy if exists "retention_select_admin" on public.data_retention_policies;
create policy "retention_select_admin"
on public.data_retention_policies for select to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

drop policy if exists "retention_write_admin" on public.data_retention_policies;
create policy "retention_write_admin"
on public.data_retention_policies for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- ---------------------------------------------------------------------------
-- DSR: export / delete visitor data
-- ---------------------------------------------------------------------------
create or replace function public.export_visitor_data(
  p_instance_id uuid,
  p_visitor_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessions jsonb;
  v_events jsonb;
  v_consents jsonb;
  v_notes jsonb;
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  if p_visitor_key is null or trim(p_visitor_key) = '' then
    raise exception 'visitor_key required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_sessions
  from public.conversation_sessions s
  where s.instance_id = p_instance_id and s.visitor_key = p_visitor_key;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events
  from public.conversation_events e
  join public.conversation_sessions s on s.id = e.session_id
  where s.instance_id = p_instance_id and s.visitor_key = p_visitor_key;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_consents
  from public.consent_events c
  where c.instance_id = p_instance_id and c.visitor_key = p_visitor_key;

  select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) into v_notes
  from public.conversation_notes n
  join public.conversation_sessions s on s.id = n.session_id
  where s.instance_id = p_instance_id and s.visitor_key = p_visitor_key;

  perform public.write_audit_event(
    p_instance_id,
    'compliance.export',
    'visitor',
    p_visitor_key,
    jsonb_build_object('sessions', jsonb_array_length(v_sessions))
  );

  return jsonb_build_object(
    'visitor_key', p_visitor_key,
    'exported_at', now(),
    'sessions', v_sessions,
    'events', v_events,
    'consents', v_consents,
    'notes', v_notes
  );
end;
$$;

grant execute on function public.export_visitor_data(uuid, text) to authenticated;

create or replace function public.delete_visitor_data(
  p_instance_id uuid,
  p_visitor_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  if exists (
    select 1 from public.data_retention_policies
    where instance_id = p_instance_id and legal_hold
  ) then
    raise exception 'Legal hold is active';
  end if;

  delete from public.conversation_sessions
  where instance_id = p_instance_id and visitor_key = p_visitor_key;

  get diagnostics v_count = row_count;

  delete from public.consent_events
  where instance_id = p_instance_id and visitor_key = p_visitor_key;

  perform public.write_audit_event(
    p_instance_id,
    'compliance.delete',
    'visitor',
    p_visitor_key,
    jsonb_build_object('sessions_deleted', v_count)
  );

  return jsonb_build_object('deleted_sessions', v_count);
end;
$$;

grant execute on function public.delete_visitor_data(uuid, text) to authenticated;

create or replace function public.purge_expired_conversation_data(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pol public.data_retention_policies;
  v_sessions integer := 0;
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[])
     and auth.role() <> 'service_role' then
    raise exception 'Not allowed';
  end if;

  select * into v_pol from public.data_retention_policies where instance_id = p_instance_id;
  if v_pol.id is null then
    return jsonb_build_object('purged', 0, 'reason', 'no_policy');
  end if;
  if v_pol.legal_hold then
    return jsonb_build_object('purged', 0, 'reason', 'legal_hold');
  end if;

  delete from public.conversation_sessions
  where instance_id = p_instance_id
    and created_at < now() - make_interval(days => v_pol.sessions_ttl_days);

  get diagnostics v_sessions = row_count;

  perform public.write_audit_event_trusted(
    p_instance_id,
    auth.uid(),
    'retention.purged',
    'conversation_session',
    null,
    jsonb_build_object('sessions', v_sessions)
  );

  return jsonb_build_object('purged_sessions', v_sessions);
end;
$$;

grant execute on function public.purge_expired_conversation_data(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Staging environments
-- ---------------------------------------------------------------------------
alter table public.chatbots
  add column if not exists environment text not null default 'production'
    check (environment in ('production', 'staging'));

alter table public.connections
  add column if not exists environment text not null default 'production'
    check (environment in ('production', 'staging'));

alter table public.chatbot_flows
  add column if not exists staging_published_graph jsonb,
  add column if not exists staging_published_at timestamptz,
  add column if not exists staging_version integer not null default 0;

create table if not exists public.instance_environments (
  instance_id uuid not null references public.instances (id) on delete cascade,
  environment text not null check (environment in ('production', 'staging')),
  label text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (instance_id, environment)
);

alter table public.instance_environments enable row level security;

drop policy if exists "instance_environments_select" on public.instance_environments;
create policy "instance_environments_select"
on public.instance_environments for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "instance_environments_write" on public.instance_environments;
create policy "instance_environments_write"
on public.instance_environments for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- Seed production+staging rows helper
create or replace function public.ensure_instance_environments(p_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.instance_environments (instance_id, environment, label)
  values
    (p_instance_id, 'production', 'Production'),
    (p_instance_id, 'staging', 'Staging')
  on conflict do nothing;
end;
$$;

grant execute on function public.ensure_instance_environments(uuid) to authenticated;

create or replace function public.publish_flow_staging(p_flow_id uuid)
returns public.chatbot_flows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow public.chatbot_flows;
  v_instance uuid;
  v_graph jsonb;
begin
  select f.*, public.chatbot_instance_id(f.chatbot_id) as iid
  into v_flow
  from public.chatbot_flows f
  where f.id = p_flow_id;

  select public.chatbot_instance_id(chatbot_id) into v_instance
  from public.chatbot_flows where id = p_flow_id;

  if v_instance is null then
    raise exception 'Flow not found';
  end if;
  if not public.has_instance_role(
    v_instance,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  -- Build graph from current draft nodes/edges similarly to publish — client passes via published_graph copy
  -- For staging, copy current published_graph or require client to set staging graph via update.
  -- Prefer: promote draft by reading nodes — simplified: clone published_graph if staging empty and draft flag.
  select * into v_flow from public.chatbot_flows where id = p_flow_id;

  if v_flow.published_graph is null and v_flow.staging_published_graph is null then
    raise exception 'Nothing to publish to staging; publish a production version first or set staging graph';
  end if;

  v_graph := coalesce(v_flow.staging_published_graph, v_flow.published_graph);

  update public.chatbot_flows
  set
    staging_published_graph = v_graph,
    staging_published_at = now(),
    staging_version = staging_version + 1,
    updated_at = now()
  where id = p_flow_id
  returning * into v_flow;

  perform public.write_audit_event(
    v_instance,
    'staging.published',
    'chatbot_flow',
    p_flow_id::text,
    jsonb_build_object('staging_version', v_flow.staging_version)
  );

  return v_flow;
end;
$$;

grant execute on function public.publish_flow_staging(uuid) to authenticated;

-- Staging-aware public start (optional env via p_environment)
create or replace function public.start_public_conversation_env(
  p_slug text,
  p_visitor_key text default null,
  p_environment text default 'production'
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_bot public.chatbots;
  v_flow public.chatbot_flows;
  v_session public.conversation_sessions;
  v_inst public.instances;
  v_graph jsonb;
  v_version integer;
  v_env text := coalesce(nullif(trim(p_environment), ''), 'production');
  v_visitor text;
begin
  if v_env not in ('production', 'staging') then
    raise exception 'Invalid environment';
  end if;

  v_visitor := nullif(trim(coalesce(p_visitor_key, '')), '');

  select * into v_bot
  from public.chatbots
  where public_enabled = true
    and deleted_at is null
    and lower(public_slug) = lower(trim(p_slug))
    and environment = case when v_env = 'staging' then environment else 'production' end;

  -- Prefer exact env match when staging slug bots exist; else production bot
  if v_bot.id is null then
    select * into v_bot
    from public.chatbots
    where public_enabled = true
      and deleted_at is null
      and lower(public_slug) = lower(trim(p_slug));
  end if;

  if v_bot.id is null then
    raise exception 'Chatbot not found or not public';
  end if;

  if not public.check_instance_quota(v_bot.instance_id, 'conversations') then
    raise exception 'Monthly conversation quota exceeded';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_env = 'staging' then
    if v_flow.staging_published_graph is null then
      raise exception 'Staging graph not published';
    end if;
    v_graph := v_flow.staging_published_graph;
    v_version := v_flow.staging_version;
  else
    if v_flow.published_graph is null then
      raise exception 'Chatbot is not published';
    end if;
    v_graph := v_flow.published_graph;
    v_version := v_flow.version;
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version
  ) values (
    v_bot.id, v_bot.instance_id, 'active', v_visitor, v_version
  )
  returning * into v_session;

  -- Tag env in variables
  update public.conversation_sessions
  set variables = coalesce(variables, '{}'::jsonb) || jsonb_build_object('_environment', v_env)
  where id = v_session.id
  returning * into v_session;

  perform public.increment_instance_usage(v_bot.instance_id, 1, 0, 0);

  return jsonb_build_object(
    'session_id', v_session.id,
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'publish_version', v_session.publish_version,
    'published_graph', v_graph,
    'name', v_bot.name,
    'environment', v_env,
    'branding', case
      when v_inst.id is null or not coalesce(v_inst.brand_apply_to_public_chat, true) then null
      else jsonb_build_object(
        'display_name', coalesce(v_inst.brand_display_name, v_inst.name),
        'accent_color', v_inst.brand_accent_color,
        'logo_url', v_inst.brand_logo_url
      )
    end
  );
end;
$$;

grant execute on function public.start_public_conversation_env(text, text, text)
  to anon, authenticated;

-- Entity environment isolation column
alter table public.chatbot_entities
  add column if not exists environment text not null default 'production'
    check (environment in ('production', 'staging'));
