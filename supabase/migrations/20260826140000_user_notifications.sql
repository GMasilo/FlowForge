-- In-app user notifications (handoff + general app events).

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  resource_type text,
  resource_id text,
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_kind_nonempty check (length(trim(kind)) > 0),
  constraint user_notifications_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_instance_idx
  on public.user_notifications (instance_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
on public.user_notifications for select to authenticated
using (
  user_id = auth.uid()
  and public.is_instance_member(instance_id)
);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
on public.user_notifications for update to authenticated
using (
  user_id = auth.uid()
  and public.is_instance_member(instance_id)
)
with check (
  user_id = auth.uid()
  and public.is_instance_member(instance_id)
);

grant select, update on public.user_notifications to authenticated;
revoke all on public.user_notifications from anon;

do $$
begin
  alter publication supabase_realtime add table public.user_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.create_user_notification(
  p_instance_id uuid,
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_href text default null,
  p_resource_type text default null,
  p_resource_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns public.user_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_notifications;
begin
  if p_user_id is null or p_instance_id is null then
    return null;
  end if;
  -- Never notify yourself for actions you just took.
  if auth.uid() is not null and p_user_id = auth.uid() then
    return null;
  end if;

  insert into public.user_notifications (
    instance_id, user_id, kind, title, body, href, resource_type, resource_id, meta
  )
  values (
    p_instance_id,
    p_user_id,
    trim(p_kind),
    trim(p_title),
    nullif(trim(coalesce(p_body, '')), ''),
    nullif(trim(coalesce(p_href, '')), ''),
    nullif(trim(coalesce(p_resource_type, '')), ''),
    nullif(trim(coalesce(p_resource_id, '')), ''),
    coalesce(p_meta, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_user_notification(
  uuid, uuid, text, text, text, text, text, text, jsonb
) to authenticated, service_role;

create or replace function public.notify_instance_roles(
  p_instance_id uuid,
  p_roles public.instance_role[],
  p_kind text,
  p_title text,
  p_body text default null,
  p_href text default null,
  p_resource_type text default null,
  p_resource_id text default null,
  p_meta jsonb default '{}'::jsonb,
  p_exclude_user uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_uid uuid;
begin
  for v_uid in
    select m.user_id
    from public.instance_members m
    where m.instance_id = p_instance_id
      and m.disabled_at is null
      and m.role = any (p_roles)
      and (p_exclude_user is null or m.user_id <> p_exclude_user)
      and (auth.uid() is null or m.user_id <> auth.uid())
  loop
    perform public.create_user_notification(
      p_instance_id,
      v_uid,
      p_kind,
      p_title,
      p_body,
      p_href,
      p_resource_type,
      p_resource_id,
      p_meta
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.notify_instance_roles(
  uuid, public.instance_role[], text, text, text, text, text, text, jsonb, uuid
) to authenticated, service_role;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.user_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_notifications;
begin
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Notification not found';
  end if;
  return v_row;
end;
$$;

grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read(p_instance_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.user_notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and (p_instance_id is null or instance_id = p_instance_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Escalate → notify agents (fallback: owners/admins)
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
  v_bot_name text;
  v_href text;
  v_notified integer;
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
    jsonb_build_object('chatbot_id', v_row.chatbot_id, 'node_key', p_node_key),
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
      jsonb_build_object('chatbot_id', v_row.chatbot_id, 'node_key', p_node_key),
      null
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.escalate_conversation_session(uuid, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Claim / assign / transfer notifications
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
  v_href text;
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
  v_href text;
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

  v_href := '/instances/' || v_row.instance_id::text || '/conversations/' || v_row.id::text;
  if p_to_user is not null then
    perform public.create_user_notification(
      v_row.instance_id,
      p_to_user,
      'handoff.transferred',
      'Conversation transferred to you',
      coalesce(nullif(trim(coalesce(p_note, '')), ''), 'An escalated conversation was transferred to you.'),
      v_href,
      'conversation_session',
      v_row.id::text,
      jsonb_build_object('from', v_from, 'by', auth.uid())
    );
  elsif p_to_queue_id is not null then
    perform public.notify_instance_roles(
      v_row.instance_id,
      array['agent']::public.instance_role[],
      'handoff.transferred',
      'Conversation transferred to queue',
      'An escalated conversation was moved to your queue.',
      v_href,
      'conversation_session',
      v_row.id::text,
      jsonb_build_object('to_queue', p_to_queue_id, 'by', auth.uid()),
      auth.uid()
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.transfer_conversation(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Visitor message during handoff → notify assignee (or agents)
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_escalated_visitor_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_href text;
  v_text text;
begin
  if new.kind <> 'message.user' then
    return new;
  end if;

  select * into v_session from public.conversation_sessions where id = new.session_id;
  if v_session.id is null or v_session.status <> 'escalated' then
    return new;
  end if;

  v_text := coalesce(new.payload->>'text', new.payload->>'message', 'New visitor message');
  v_href := '/instances/' || v_session.instance_id::text || '/conversations/' || v_session.id::text;

  if v_session.assigned_to is not null then
    perform public.create_user_notification(
      v_session.instance_id,
      v_session.assigned_to,
      'handoff.visitor_message',
      'Visitor message',
      left(v_text, 180),
      v_href,
      'conversation_session',
      v_session.id::text,
      jsonb_build_object('event_id', new.id)
    );
  else
    perform public.notify_instance_roles(
      v_session.instance_id,
      array['agent']::public.instance_role[],
      'handoff.visitor_message',
      'Visitor message (unassigned)',
      left(v_text, 180),
      v_href,
      'conversation_session',
      v_session.id::text,
      jsonb_build_object('event_id', new.id),
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists conversation_events_visitor_notify on public.conversation_events;
create trigger conversation_events_visitor_notify
after insert on public.conversation_events
for each row
execute function public.notify_on_escalated_visitor_message();

-- ---------------------------------------------------------------------------
-- Flow comments → notify editors
-- ---------------------------------------------------------------------------
create or replace function public.add_flow_comment(
  p_flow_id uuid,
  p_body text,
  p_node_key text default null,
  p_parent_id uuid default null
)
returns public.flow_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance uuid;
  v_row public.flow_comments;
  v_chatbot uuid;
  v_href text;
begin
  select public.chatbot_instance_id(chatbot_id), chatbot_id
  into v_instance, v_chatbot
  from public.chatbot_flows where id = p_flow_id;
  if v_instance is null then
    raise exception 'Flow not found';
  end if;
  if not public.is_instance_member(v_instance) then
    raise exception 'Not allowed';
  end if;
  if p_body is null or trim(p_body) = '' then
    raise exception 'Comment body required';
  end if;

  insert into public.flow_comments (flow_id, instance_id, node_key, parent_id, author_id, body)
  values (p_flow_id, v_instance, p_node_key, p_parent_id, auth.uid(), trim(p_body))
  returning * into v_row;

  perform public.write_audit_event(
    v_instance,
    'flow.comment_added',
    'flow_comment',
    v_row.id::text,
    jsonb_build_object('flow_id', p_flow_id, 'node_key', p_node_key)
  );

  v_href := '/instances/' || v_instance::text || '/chatbots/' || v_chatbot::text || '/design';
  perform public.notify_instance_roles(
    v_instance,
    array['owner', 'admin', 'editor']::public.instance_role[],
    'flow.comment',
    'New design comment',
    left(trim(p_body), 180),
    v_href,
    'flow_comment',
    v_row.id::text,
    jsonb_build_object('flow_id', p_flow_id, 'node_key', p_node_key),
    auth.uid()
  );

  return v_row;
end;
$$;

grant execute on function public.add_flow_comment(uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Member joined via invite → notify owners/admins
-- ---------------------------------------------------------------------------
create or replace function public.claim_instance_invites_for_user(
  p_user_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.instance_invites;
  v_name text;
  v_href text;
begin
  if p_user_id is null or coalesce(trim(p_email), '') = '' then
    return;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), trim(p_email))
  into v_name
  from public.profiles p
  where p.id = p_user_id;
  if v_name is null then
    v_name := trim(p_email);
  end if;

  for v_inv in
    select *
    from public.instance_invites
    where lower(email) = lower(trim(p_email))
  loop
    insert into public.instance_members (
      instance_id,
      user_id,
      role,
      display_name,
      job_title,
      phone,
      department,
      notes
    )
    values (
      v_inv.instance_id,
      p_user_id,
      v_inv.role,
      v_inv.display_name,
      v_inv.job_title,
      v_inv.phone,
      v_inv.department,
      v_inv.notes
    )
    on conflict (instance_id, user_id) do update set
      role = excluded.role,
      display_name = coalesce(excluded.display_name, public.instance_members.display_name),
      job_title = coalesce(excluded.job_title, public.instance_members.job_title),
      phone = coalesce(excluded.phone, public.instance_members.phone),
      department = coalesce(excluded.department, public.instance_members.department),
      notes = coalesce(excluded.notes, public.instance_members.notes);

    delete from public.instance_invites where id = v_inv.id;

    v_href := '/instances/' || v_inv.instance_id::text || '/members';
    perform public.notify_instance_roles(
      v_inv.instance_id,
      array['owner', 'admin']::public.instance_role[],
      'member.joined',
      'New member joined',
      v_name || ' joined as ' || v_inv.role::text || '.',
      v_href,
      'instance_member',
      p_user_id::text,
      jsonb_build_object('role', v_inv.role, 'email', lower(trim(p_email))),
      p_user_id
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Flow published → notify editors
-- ---------------------------------------------------------------------------
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
  v_href text;
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

  v_href := '/instances/' || v_bot.instance_id::text || '/chatbots/' || v_bot.id::text || '/design';
  perform public.notify_instance_roles(
    v_bot.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[],
    'flow.published',
    'Flow published',
    coalesce(v_bot.name, 'A chatbot') || ' published as v' || v_next::text || '.',
    v_href,
    'chatbot_flow',
    p_flow_id::text,
    jsonb_build_object('version', v_next, 'chatbot_id', v_bot.id),
    auth.uid()
  );

  return v_row;
end;
$$;

grant execute on function public.publish_flow_version(uuid, jsonb, text) to authenticated;
