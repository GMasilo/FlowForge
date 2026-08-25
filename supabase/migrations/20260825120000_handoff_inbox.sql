-- Human handoff: escalate flow node, escalated session status, agent reply/resolve RPCs.

alter type public.flow_node_type add value if not exists 'handoff';

alter table public.conversation_sessions
  drop constraint if exists conversation_sessions_status_check;

alter table public.conversation_sessions
  add constraint conversation_sessions_status_check
  check (status in ('active', 'escalated', 'completed', 'failed', 'abandoned'));

alter table public.conversation_sessions
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_node_key text;

create index if not exists conversation_sessions_escalated_idx
  on public.conversation_sessions (instance_id, status, updated_at desc)
  where status = 'escalated';

-- Allow events while escalated (agent + visitor messaging).
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
  if v_session.status not in ('active', 'escalated') then
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
begin
  update public.conversation_sessions
  set
    status = 'escalated',
    escalated_at = coalesce(escalated_at, now()),
    escalated_node_key = coalesce(p_node_key, escalated_node_key),
    updated_at = now()
  where id = p_session_id
    and status = 'active'
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.conversation_sessions where id = p_session_id;
    if v_row.id is null then
      raise exception 'Session not found';
    end if;
    if v_row.status <> 'escalated' then
      raise exception 'Session cannot be escalated';
    end if;
  end if;

  return v_row;
end;
$$;

grant execute on function public.escalate_conversation_session(uuid, text) to anon, authenticated, service_role;

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
  v_text text := trim(coalesce(p_text, ''));
  v_row public.conversation_events;
begin
  if v_text = '' then
    raise exception 'Reply text is required';
  end if;

  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if not public.is_instance_member(v_session.instance_id) then
    raise exception 'Not allowed';
  end if;

  return public.append_conversation_event(
    p_session_id,
    'message.agent',
    null,
    jsonb_build_object('text', v_text, 'agent_id', auth.uid())
  );
end;
$$;

grant execute on function public.agent_reply_to_conversation(uuid, text) to authenticated;

create or replace function public.resolve_conversation_handoff(
  p_session_id uuid
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_row public.conversation_sessions;
begin
  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if not public.has_instance_role(v_session.instance_id, array['owner', 'admin', 'editor']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  if v_session.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;

  perform public.append_conversation_event(
    p_session_id,
    'session.completed',
    null,
    jsonb_build_object('resolved_by', auth.uid(), 'from', 'handoff')
  );

  update public.conversation_sessions
  set
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  where id = p_session_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.resolve_conversation_handoff(uuid) to authenticated;

create or replace function public.list_conversation_events_after(
  p_session_id uuid,
  p_after_seq integer default 0
)
returns setof public.conversation_events
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

  return query
  select e.*
  from public.conversation_events e
  where e.session_id = p_session_id
    and e.seq > coalesce(p_after_seq, 0)
  order by e.seq asc;
end;
$$;

grant execute on function public.list_conversation_events_after(uuid, integer) to anon, authenticated, service_role;

-- Allow completing escalated sessions via complete RPC as well.
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
    and status in ('active', 'escalated')
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.conversation_sessions where id = p_session_id;
  end if;

  return v_row;
end;
$$;
