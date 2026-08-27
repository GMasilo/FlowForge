-- Agent role operators: console RPCs + triage RLS.

create or replace function public.is_agent_operator(p_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_instance_role(
    p_instance_id,
    array['owner', 'admin', 'editor', 'agent']::public.instance_role[]
  );
$$;

grant execute on function public.is_agent_operator(uuid) to authenticated;

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
  if not public.is_agent_operator(v_session.instance_id) then
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
  if not public.is_agent_operator(v_row.instance_id) then
    raise exception 'Not allowed';
  end if;
  if v_row.status <> 'escalated' then
    raise exception 'Session is not escalated';
  end if;
  if not exists (
    select 1 from public.instance_members m
    where m.instance_id = v_row.instance_id
      and m.user_id = p_assignee
      and m.disabled_at is null
      and m.role in ('owner', 'admin', 'editor', 'agent')
  ) then
    raise exception 'Assignee is not an agent operator';
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
  if not public.is_agent_operator(v_row.instance_id) then
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
    where m.instance_id = v_row.instance_id
      and m.user_id = p_to_user
      and m.disabled_at is null
      and m.role in ('owner', 'admin', 'editor', 'agent')
  ) then
    raise exception 'Target user is not an agent operator';
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
  if not public.is_agent_operator(v_session.instance_id) then
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

drop policy if exists "conversation_tags_write_editor" on public.conversation_tags;
drop policy if exists "conversation_tags_write_operator" on public.conversation_tags;
create policy "conversation_tags_write_operator"
on public.conversation_tags for all to authenticated
using (public.is_agent_operator(instance_id))
with check (public.is_agent_operator(instance_id));

drop policy if exists "conversation_tag_assignments_write" on public.conversation_tag_assignments;
create policy "conversation_tag_assignments_write"
on public.conversation_tag_assignments for all to authenticated
using (
  exists (
    select 1 from public.conversation_sessions s
    where s.id = session_id and public.is_agent_operator(s.instance_id)
  )
)
with check (
  exists (
    select 1 from public.conversation_sessions s
    where s.id = session_id and public.is_agent_operator(s.instance_id)
  )
);

comment on function public.is_agent_operator(uuid) is
  'True for owner/admin/editor/agent — roles allowed to operate the live agent console.';
