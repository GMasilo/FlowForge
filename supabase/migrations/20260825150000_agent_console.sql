-- Phase 1: Live agent console + conversation tags & saved views

-- ---------------------------------------------------------------------------
-- Agent queues
-- ---------------------------------------------------------------------------
create table if not exists public.agent_queues (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null,
  description text,
  sla_first_response_seconds integer not null default 300
    check (sla_first_response_seconds > 0),
  sla_resolve_seconds integer not null default 3600
    check (sla_resolve_seconds > 0),
  routing_rules jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, name)
);

create index if not exists agent_queues_instance_idx
  on public.agent_queues (instance_id);

alter table public.agent_queues enable row level security;

drop policy if exists "agent_queues_select_member" on public.agent_queues;
create policy "agent_queues_select_member"
on public.agent_queues for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "agent_queues_write_admin" on public.agent_queues;
create policy "agent_queues_write_admin"
on public.agent_queues for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- ---------------------------------------------------------------------------
-- Agent presence / profiles
-- ---------------------------------------------------------------------------
create table if not exists public.agent_profiles (
  instance_id uuid not null references public.instances (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  skills text[] not null default '{}',
  max_concurrent integer not null default 5 check (max_concurrent > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (instance_id, user_id)
);

alter table public.agent_profiles enable row level security;

drop policy if exists "agent_profiles_select_member" on public.agent_profiles;
create policy "agent_profiles_select_member"
on public.agent_profiles for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "agent_profiles_write_self_or_admin" on public.agent_profiles;
create policy "agent_profiles_write_self_or_admin"
on public.agent_profiles for all to authenticated
using (
  public.is_instance_member(instance_id)
  and (
    user_id = auth.uid()
    or public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
  )
)
with check (
  public.is_instance_member(instance_id)
  and (
    user_id = auth.uid()
    or public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
  )
);

create table if not exists public.agent_presence (
  instance_id uuid not null references public.instances (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'offline'
    check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (instance_id, user_id)
);

alter table public.agent_presence enable row level security;

drop policy if exists "agent_presence_select_member" on public.agent_presence;
create policy "agent_presence_select_member"
on public.agent_presence for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "agent_presence_upsert_self" on public.agent_presence;
create policy "agent_presence_upsert_self"
on public.agent_presence for all to authenticated
using (public.is_instance_member(instance_id) and user_id = auth.uid())
with check (public.is_instance_member(instance_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Session agent columns
-- ---------------------------------------------------------------------------
alter table public.conversation_sessions
  add column if not exists assigned_to uuid references auth.users (id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists queue_id uuid references public.agent_queues (id) on delete set null,
  add column if not exists priority smallint not null default 0,
  add column if not exists sla_due_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists transfer_meta jsonb not null default '{}'::jsonb;

create index if not exists conversation_sessions_assigned_idx
  on public.conversation_sessions (instance_id, assigned_to, status)
  where status = 'escalated';

create index if not exists conversation_sessions_queue_idx
  on public.conversation_sessions (instance_id, queue_id, status)
  where status = 'escalated';

create index if not exists conversation_sessions_sla_idx
  on public.conversation_sessions (instance_id, sla_due_at)
  where status = 'escalated' and sla_due_at is not null;

-- ---------------------------------------------------------------------------
-- Internal notes (never via public chat RPCs)
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.conversation_sessions (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversation_notes_session_idx
  on public.conversation_notes (session_id, created_at desc);

alter table public.conversation_notes enable row level security;

drop policy if exists "conversation_notes_select_member" on public.conversation_notes;
create policy "conversation_notes_select_member"
on public.conversation_notes for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "conversation_notes_insert_member" on public.conversation_notes;
create policy "conversation_notes_insert_member"
on public.conversation_notes for insert to authenticated
with check (
  public.is_instance_member(instance_id)
  and author_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Tags + assignments
-- ---------------------------------------------------------------------------
create table if not exists public.conversation_tags (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null,
  color text not null default '#0f766e',
  created_at timestamptz not null default now(),
  unique (instance_id, name)
);

alter table public.conversation_tags enable row level security;

drop policy if exists "conversation_tags_select_member" on public.conversation_tags;
create policy "conversation_tags_select_member"
on public.conversation_tags for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "conversation_tags_write_editor" on public.conversation_tags;
create policy "conversation_tags_write_editor"
on public.conversation_tags for all to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
)
with check (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
);

create table if not exists public.conversation_tag_assignments (
  session_id uuid not null references public.conversation_sessions (id) on delete cascade,
  tag_id uuid not null references public.conversation_tags (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (session_id, tag_id)
);

create index if not exists conversation_tag_assignments_tag_idx
  on public.conversation_tag_assignments (tag_id);

alter table public.conversation_tag_assignments enable row level security;

drop policy if exists "conversation_tag_assignments_select" on public.conversation_tag_assignments;
create policy "conversation_tag_assignments_select"
on public.conversation_tag_assignments for select to authenticated
using (
  exists (
    select 1 from public.conversation_sessions s
    where s.id = session_id and public.is_instance_member(s.instance_id)
  )
);

drop policy if exists "conversation_tag_assignments_write" on public.conversation_tag_assignments;
create policy "conversation_tag_assignments_write"
on public.conversation_tag_assignments for all to authenticated
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
-- Saved conversation views
-- ---------------------------------------------------------------------------
create table if not exists public.saved_conversation_views (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_conversation_views_instance_idx
  on public.saved_conversation_views (instance_id);

alter table public.saved_conversation_views enable row level security;

drop policy if exists "saved_views_select" on public.saved_conversation_views;
create policy "saved_views_select"
on public.saved_conversation_views for select to authenticated
using (
  public.is_instance_member(instance_id)
  and (owner_id = auth.uid() or is_shared)
);

drop policy if exists "saved_views_insert" on public.saved_conversation_views;
create policy "saved_views_insert"
on public.saved_conversation_views for insert to authenticated
with check (
  public.is_instance_member(instance_id)
  and owner_id = auth.uid()
);

drop policy if exists "saved_views_update" on public.saved_conversation_views;
create policy "saved_views_update"
on public.saved_conversation_views for update to authenticated
using (owner_id = auth.uid() and public.is_instance_member(instance_id))
with check (owner_id = auth.uid() and public.is_instance_member(instance_id));

drop policy if exists "saved_views_delete" on public.saved_conversation_views;
create policy "saved_views_delete"
on public.saved_conversation_views for delete to authenticated
using (owner_id = auth.uid() and public.is_instance_member(instance_id));

-- ---------------------------------------------------------------------------
-- Ensure default queue helper
-- ---------------------------------------------------------------------------
create or replace function public.ensure_default_agent_queue(p_instance_id uuid)
returns public.agent_queues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_queues;
begin
  select * into v_row
  from public.agent_queues
  where instance_id = p_instance_id and is_default = true
  limit 1;

  if v_row.id is not null then
    return v_row;
  end if;

  insert into public.agent_queues (instance_id, name, description, is_default)
  values (p_instance_id, 'General', 'Default agent queue', true)
  on conflict (instance_id, name) do update set is_default = true
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ensure_default_agent_queue(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Escalate: attach default queue + SLA
-- ---------------------------------------------------------------------------
create or replace function public.escalate_conversation_session(
  p_session_id uuid,
  p_node_key text default null
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conversation_sessions;
  v_queue public.agent_queues;
  v_queue_from_config uuid;
begin
  select * into v_row from public.conversation_sessions where id = p_session_id;
  if v_row.id is null then
    raise exception 'Session not found';
  end if;

  if v_row.status = 'escalated' then
    return v_row;
  end if;

  if v_row.status <> 'active' then
    raise exception 'Session cannot be escalated';
  end if;

  -- Optional queue_id encoded in node_key payload is not used; handoff config
  -- may pass queue via transfer_meta later. Prefer default queue.
  v_queue := public.ensure_default_agent_queue(v_row.instance_id);

  update public.conversation_sessions
  set
    status = 'escalated',
    escalated_at = coalesce(escalated_at, now()),
    escalated_node_key = coalesce(p_node_key, escalated_node_key),
    queue_id = coalesce(queue_id, v_queue.id),
    sla_due_at = coalesce(
      sla_due_at,
      now() + make_interval(secs => v_queue.sla_first_response_seconds)
    ),
    updated_at = now()
  where id = p_session_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.escalate_conversation_session(uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Claim / assign / transfer
-- ---------------------------------------------------------------------------
create or replace function public.claim_conversation(p_session_id uuid)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conversation_sessions;
begin
  select * into v_row from public.conversation_sessions where id = p_session_id;
  if v_row.id is null then
    raise exception 'Session not found';
  end if;
  if not public.is_instance_member(v_row.instance_id) then
    raise exception 'Not allowed';
  end if;
  if v_row.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if v_row.assigned_to is not null and v_row.assigned_to <> auth.uid() then
    raise exception 'Already assigned';
  end if;

  update public.conversation_sessions
  set
    assigned_to = auth.uid(),
    assigned_at = coalesce(assigned_at, now()),
    updated_at = now()
  where id = p_session_id
  returning * into v_row;

  perform public.append_conversation_event(
    p_session_id,
    'agent.assigned',
    null,
    jsonb_build_object('agent_id', auth.uid(), 'via', 'claim')
  );

  perform public.write_audit_event(
    v_row.instance_id,
    'conversation.claimed',
    'conversation_session',
    p_session_id::text,
    '{}'::jsonb
  );

  return v_row;
end;
$$;

grant execute on function public.claim_conversation(uuid) to authenticated;

create or replace function public.assign_conversation(
  p_session_id uuid,
  p_assignee uuid,
  p_queue_id uuid default null
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conversation_sessions;
  v_queue public.agent_queues;
begin
  select * into v_row from public.conversation_sessions where id = p_session_id;
  if v_row.id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_instance_role(
    v_row.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;
  if v_row.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if not public.is_instance_member(v_row.instance_id) then
    raise exception 'Assignee org mismatch';
  end if;
  -- Ensure assignee is a member
  if not exists (
    select 1 from public.instance_members m
    where m.instance_id = v_row.instance_id and m.user_id = p_assignee
  ) then
    raise exception 'Assignee is not a member';
  end if;

  if p_queue_id is not null then
    select * into v_queue from public.agent_queues
    where id = p_queue_id and instance_id = v_row.instance_id;
    if v_queue.id is null then
      raise exception 'Queue not found';
    end if;
  end if;

  update public.conversation_sessions
  set
    assigned_to = p_assignee,
    assigned_at = now(),
    queue_id = coalesce(p_queue_id, queue_id),
    updated_at = now()
  where id = p_session_id
  returning * into v_row;

  perform public.append_conversation_event(
    p_session_id,
    'agent.assigned',
    null,
    jsonb_build_object('agent_id', p_assignee, 'via', 'assign', 'by', auth.uid())
  );

  perform public.write_audit_event(
    v_row.instance_id,
    'conversation.assigned',
    'conversation_session',
    p_session_id::text,
    jsonb_build_object('assignee', p_assignee, 'queue_id', p_queue_id)
  );

  return v_row;
end;
$$;

grant execute on function public.assign_conversation(uuid, uuid, uuid) to authenticated;

create or replace function public.transfer_conversation(
  p_session_id uuid,
  p_to_user uuid default null,
  p_to_queue_id uuid default null,
  p_note text default null
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conversation_sessions;
  v_from uuid;
  v_queue public.agent_queues;
begin
  select * into v_row from public.conversation_sessions where id = p_session_id;
  if v_row.id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_instance_role(
    v_row.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;
  if v_row.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if p_to_user is null and p_to_queue_id is null then
    raise exception 'Transfer target required';
  end if;

  v_from := v_row.assigned_to;

  if p_to_queue_id is not null then
    select * into v_queue from public.agent_queues
    where id = p_to_queue_id and instance_id = v_row.instance_id;
    if v_queue.id is null then
      raise exception 'Queue not found';
    end if;
  end if;

  if p_to_user is not null and not exists (
    select 1 from public.instance_members m
    where m.instance_id = v_row.instance_id and m.user_id = p_to_user
  ) then
    raise exception 'Target user is not a member';
  end if;

  update public.conversation_sessions
  set
    assigned_to = coalesce(p_to_user, assigned_to),
    assigned_at = case when p_to_user is not null then now() else assigned_at end,
    queue_id = coalesce(p_to_queue_id, queue_id),
    transfer_meta = jsonb_build_object(
      'from', v_from,
      'to_user', p_to_user,
      'to_queue', p_to_queue_id,
      'note', p_note,
      'at', now(),
      'by', auth.uid()
    ),
    updated_at = now()
  where id = p_session_id
  returning * into v_row;

  perform public.append_conversation_event(
    p_session_id,
    'agent.transferred',
    null,
    jsonb_build_object(
      'from', v_from,
      'to_user', p_to_user,
      'to_queue', p_to_queue_id,
      'note', p_note,
      'by', auth.uid()
    )
  );

  perform public.write_audit_event(
    v_row.instance_id,
    'conversation.transferred',
    'conversation_session',
    p_session_id::text,
    jsonb_build_object('to_user', p_to_user, 'to_queue', p_to_queue_id)
  );

  return v_row;
end;
$$;

grant execute on function public.transfer_conversation(uuid, uuid, uuid, text) to authenticated;

-- Mark first response on agent reply
create or replace function public.agent_reply_to_conversation(
  p_session_id uuid,
  p_text text
)
returns public.conversation_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_event public.conversation_events;
  v_queue public.agent_queues;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if not public.is_instance_member(v_session.instance_id) then
    raise exception 'Not allowed';
  end if;
  if v_session.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if p_text is null or trim(p_text) = '' then
    raise exception 'Reply text required';
  end if;

  -- Auto-claim if unassigned
  if v_session.assigned_to is null then
    update public.conversation_sessions
    set assigned_to = auth.uid(), assigned_at = now(), updated_at = now()
    where id = p_session_id;
  end if;

  if v_session.first_response_at is null then
    select * into v_queue from public.agent_queues where id = v_session.queue_id;
    update public.conversation_sessions
    set
      first_response_at = now(),
      sla_due_at = case
        when v_queue.id is not null then
          now() + make_interval(secs => v_queue.sla_resolve_seconds)
        else sla_due_at
      end,
      updated_at = now()
    where id = p_session_id;
  end if;

  select * into v_event from public.append_conversation_event(
    p_session_id,
    'message.agent',
    null,
    jsonb_build_object('text', trim(p_text), 'agent_id', auth.uid())
  );

  return v_event;
end;
$$;

grant execute on function public.agent_reply_to_conversation(uuid, text) to authenticated;

create or replace function public.set_agent_presence(
  p_instance_id uuid,
  p_status text
)
returns public.agent_presence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_presence;
begin
  if not public.is_instance_member(p_instance_id) then
    raise exception 'Not allowed';
  end if;
  if p_status not in ('online', 'away', 'offline') then
    raise exception 'Invalid status';
  end if;

  insert into public.agent_presence (instance_id, user_id, status, last_seen_at, updated_at)
  values (p_instance_id, auth.uid(), p_status, now(), now())
  on conflict (instance_id, user_id) do update
  set
    status = excluded.status,
    last_seen_at = now(),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.set_agent_presence(uuid, text) to authenticated;

create or replace function public.add_conversation_note(
  p_session_id uuid,
  p_body text
)
returns public.conversation_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_row public.conversation_notes;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if not public.is_instance_member(v_session.instance_id) then
    raise exception 'Not allowed';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'Note body required';
  end if;

  insert into public.conversation_notes (session_id, instance_id, author_id, body)
  values (p_session_id, v_session.instance_id, auth.uid(), trim(p_body))
  returning * into v_row;

  perform public.append_conversation_event(
    p_session_id,
    'note.added',
    null,
    jsonb_build_object('note_id', v_row.id, 'author_id', auth.uid())
  );

  perform public.write_audit_event(
    v_session.instance_id,
    'conversation.note_added',
    'conversation_session',
    p_session_id::text,
    jsonb_build_object('note_id', v_row.id)
  );

  return v_row;
end;
$$;

grant execute on function public.add_conversation_note(uuid, text) to authenticated;

create or replace function public.set_conversation_tags(
  p_session_id uuid,
  p_tag_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_instance_role(
    v_session.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  delete from public.conversation_tag_assignments where session_id = p_session_id;

  if p_tag_ids is not null then
    insert into public.conversation_tag_assignments (session_id, tag_id, assigned_by)
    select p_session_id, t.id, auth.uid()
    from public.conversation_tags t
    where t.instance_id = v_session.instance_id
      and t.id = any (p_tag_ids);
  end if;

  perform public.write_audit_event(
    v_session.instance_id,
    'conversation.tagged',
    'conversation_session',
    p_session_id::text,
    jsonb_build_object('tag_ids', to_jsonb(coalesce(p_tag_ids, '{}'::uuid[])))
  );
end;
$$;

grant execute on function public.set_conversation_tags(uuid, uuid[]) to authenticated;

-- SLA breach check helper (callable from cron / alerts)
create or replace function public.list_sla_breached_sessions(p_instance_id uuid)
returns setof public.conversation_sessions
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.conversation_sessions s
  where s.instance_id = p_instance_id
    and s.status = 'escalated'
    and s.sla_due_at is not null
    and s.sla_due_at < now()
    and public.is_instance_member(p_instance_id);
$$;

grant execute on function public.list_sla_breached_sessions(uuid) to authenticated;

-- Realtime for new agent tables
do $$
begin
  begin
    alter publication supabase_realtime add table public.agent_presence;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversation_notes;
  exception when others then null;
  end;
end;
$$;
