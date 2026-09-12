-- Agent console depth: queue-aware escalate, skill routing, concurrency limits.

-- ---------------------------------------------------------------------------
-- Open escalated assignments for an agent (used by claim/assign/auto-assign)
-- ---------------------------------------------------------------------------
create or replace function public.agent_open_assignment_count(
  p_instance_id uuid,
  p_user_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select count(*)::integer
  from public.conversation_sessions s
  where s.instance_id = p_instance_id
    and s.assigned_to = p_user_id
    and s.status = 'escalated';
$$;

grant execute on function public.agent_open_assignment_count(uuid, uuid)
  to authenticated, service_role;

create or replace function public.agent_max_concurrent(
  p_instance_id uuid,
  p_user_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (
      select p.max_concurrent
      from public.agent_profiles p
      where p.instance_id = p_instance_id and p.user_id = p_user_id
    ),
    5
  );
$$;

grant execute on function public.agent_max_concurrent(uuid, uuid)
  to authenticated, service_role;

-- Pick an online agent matching queue routing_rules.requiredSkills under capacity.
create or replace function public.pick_agent_for_queue(
  p_instance_id uuid,
  p_queue_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_rules jsonb;
  v_skills text[];
  v_match_any boolean;
  v_auto boolean;
  v_user uuid;
begin
  select routing_rules into v_rules
  from public.agent_queues
  where id = p_queue_id and instance_id = p_instance_id;
  if v_rules is null then
    return null;
  end if;

  v_auto := coalesce((v_rules->>'autoAssign')::boolean, true);
  if not v_auto then
    return null;
  end if;

  v_skills := coalesce(
    (
      select array_agg(trim(x))
      from jsonb_array_elements_text(coalesce(v_rules->'requiredSkills', '[]'::jsonb)) as t(x)
      where trim(x) <> ''
    ),
    '{}'::text[]
  );
  v_match_any := coalesce((v_rules->>'matchAny')::boolean, false);

  select m.user_id into v_user
  from public.instance_members m
  left join public.agent_presence pr
    on pr.instance_id = m.instance_id and pr.user_id = m.user_id
  left join public.agent_profiles ap
    on ap.instance_id = m.instance_id and ap.user_id = m.user_id
  where m.instance_id = p_instance_id
    and m.disabled_at is null
    and m.role in ('owner', 'admin', 'editor', 'agent')
    and coalesce(pr.status, 'offline') = 'online'
    and public.agent_open_assignment_count(p_instance_id, m.user_id)
        < public.agent_max_concurrent(p_instance_id, m.user_id)
    and (
      cardinality(v_skills) = 0
      or (
        v_match_any
        and coalesce(ap.skills, '{}'::text[]) && v_skills
      )
      or (
        not v_match_any
        and coalesce(ap.skills, '{}'::text[]) @> v_skills
      )
    )
  order by public.agent_open_assignment_count(p_instance_id, m.user_id) asc, m.user_id
  limit 1;

  return v_user;
end;
$$;

grant execute on function public.pick_agent_for_queue(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Escalate with optional queue + auto-assign
-- ---------------------------------------------------------------------------
drop function if exists public.escalate_conversation_session(uuid, text);

create or replace function public.escalate_conversation_session(
  p_session_id uuid,
  p_node_key text default null,
  p_queue_id uuid default null
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.conversation_sessions;
  v_queue public.agent_queues;
  v_bot_name text;
  v_href text;
  v_notified integer;
  v_assignee uuid;
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

  if p_queue_id is not null then
    select * into v_queue
    from public.agent_queues
    where id = p_queue_id and instance_id = v_row.instance_id;
    if v_queue.id is null then
      raise exception 'Queue not found in this organisation';
    end if;
  else
    v_queue := public.ensure_default_agent_queue(v_row.instance_id);
  end if;

  v_assignee := public.pick_agent_for_queue(v_row.instance_id, v_queue.id);

  update public.conversation_sessions
  set
    status = 'escalated',
    escalated_at = coalesce(escalated_at, now()),
    escalated_node_key = coalesce(p_node_key, escalated_node_key),
    queue_id = coalesce(queue_id, v_queue.id),
    assigned_to = coalesce(assigned_to, v_assignee),
    assigned_at = case
      when assigned_to is null and v_assignee is not null then now()
      else assigned_at
    end,
    sla_due_at = coalesce(
      sla_due_at,
      now() + make_interval(secs => v_queue.sla_first_response_seconds)
    ),
    updated_at = now()
  where id = p_session_id
  returning * into v_row;

  if v_assignee is not null then
    perform public.append_conversation_event(
      p_session_id,
      'agent.assigned',
      p_node_key,
      jsonb_build_object('agent_id', v_assignee, 'via', 'auto', 'queue_id', v_queue.id)
    );
  end if;

  select c.name into v_bot_name from public.chatbots c where c.id = v_row.chatbot_id;
  v_href := '/instances/' || v_row.instance_id::text || '/conversations/' || v_row.id::text;

  v_notified := public.notify_instance_roles(
    v_row.instance_id,
    array['agent']::public.instance_role[],
    'handoff.escalated',
    'New handoff',
    coalesce(v_bot_name, 'A chatbot') || ' needs an agent.',
    v_href,
    'conversation_session',
    v_row.id::text,
    jsonb_build_object(
      'chatbot_id', v_row.chatbot_id,
      'node_key', p_node_key,
      'queue_id', v_queue.id,
      'assigned_to', v_assignee
    ),
    null
  );

  if coalesce(v_notified, 0) = 0 then
    perform public.notify_instance_roles(
      v_row.instance_id,
      array['owner', 'admin']::public.instance_role[],
      'handoff.escalated',
      'New handoff (no agents)',
      coalesce(v_bot_name, 'A chatbot') || ' needs an agent. No Agent-role users are assigned to this instance.',
      v_href,
      'conversation_session',
      v_row.id::text,
      jsonb_build_object(
        'chatbot_id', v_row.chatbot_id,
        'node_key', p_node_key,
        'queue_id', v_queue.id
      ),
      null
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.escalate_conversation_session(uuid, text, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Claim / assign: enforce max_concurrent
-- ---------------------------------------------------------------------------
create or replace function public.claim_conversation(p_session_id uuid)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_row public.conversation_sessions;
  v_open integer;
  v_max integer;
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

  if v_row.assigned_to is distinct from auth.uid() then
    v_open := public.agent_open_assignment_count(v_row.instance_id, auth.uid());
    v_max := public.agent_max_concurrent(v_row.instance_id, auth.uid());
    if v_open >= v_max then
      raise exception 'At max concurrent conversations (% / %)', v_open, v_max;
    end if;
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
set row_security = off
as $$
declare
  v_row public.conversation_sessions;
  v_queue public.agent_queues;
  v_href text;
  v_open integer;
  v_max integer;
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

  if v_row.assigned_to is distinct from p_assignee then
    v_open := public.agent_open_assignment_count(v_row.instance_id, p_assignee);
    v_max := public.agent_max_concurrent(v_row.instance_id, p_assignee);
    if v_open >= v_max then
      raise exception 'Assignee is at max concurrent conversations (% / %)', v_open, v_max;
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
    jsonb_build_object('assignee', p_assignee)
  );

  v_href := '/instances/' || v_row.instance_id::text || '/conversations/' || v_row.id::text;
  perform public.create_user_notification(
    v_row.instance_id,
    p_assignee,
    'handoff.assigned',
    'Conversation assigned to you',
    'An escalated conversation was assigned to you.',
    v_href,
    'conversation_session',
    v_row.id::text,
    jsonb_build_object('by', auth.uid())
  );

  return v_row;
end;
$$;

grant execute on function public.assign_conversation(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
