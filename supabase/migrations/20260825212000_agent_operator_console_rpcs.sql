-- Restrict live-console RPCs to agent operators (owner/admin/editor/agent), not viewers.

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
  if not public.is_agent_operator(v_row.instance_id) then
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
  if not public.is_agent_operator(v_session.instance_id) then
    raise exception 'Not allowed';
  end if;
  if v_session.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if p_text is null or trim(p_text) = '' then
    raise exception 'Reply text required';
  end if;

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
  if not public.is_agent_operator(p_instance_id) then
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
  if not public.is_agent_operator(v_session.instance_id) then
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
