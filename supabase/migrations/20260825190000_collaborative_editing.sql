-- Phase 5: Collaborative editing — presence metadata table, comments, change log

create table if not exists public.flow_comments (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  node_key text,
  parent_id uuid references public.flow_comments (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flow_comments_flow_idx
  on public.flow_comments (flow_id, created_at desc);

alter table public.flow_comments enable row level security;

drop policy if exists "flow_comments_select" on public.flow_comments;
create policy "flow_comments_select"
on public.flow_comments for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "flow_comments_insert" on public.flow_comments;
create policy "flow_comments_insert"
on public.flow_comments for insert to authenticated
with check (
  public.is_instance_member(instance_id)
  and author_id = auth.uid()
);

drop policy if exists "flow_comments_update" on public.flow_comments;
create policy "flow_comments_update"
on public.flow_comments for update to authenticated
using (
  public.is_instance_member(instance_id)
  and (
    author_id = auth.uid()
    or public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  )
)
with check (public.is_instance_member(instance_id));

create table if not exists public.flow_change_log (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  summary text not null,
  patch jsonb not null default '{}'::jsonb,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists flow_change_log_flow_idx
  on public.flow_change_log (flow_id, created_at desc);

alter table public.flow_change_log enable row level security;

drop policy if exists "flow_change_log_select" on public.flow_change_log;
create policy "flow_change_log_select"
on public.flow_change_log for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "flow_change_log_insert" on public.flow_change_log;
create policy "flow_change_log_insert"
on public.flow_change_log for insert to authenticated
with check (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
);

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
begin
  select public.chatbot_instance_id(chatbot_id) into v_instance
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

  return v_row;
end;
$$;

grant execute on function public.add_flow_comment(uuid, text, text, uuid) to authenticated;

create or replace function public.resolve_flow_comment(p_comment_id uuid)
returns public.flow_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.flow_comments;
begin
  select * into v_row from public.flow_comments where id = p_comment_id;
  if v_row.id is null then
    raise exception 'Comment not found';
  end if;
  if not public.has_instance_role(
    v_row.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  update public.flow_comments
  set resolved_at = now(), updated_at = now()
  where id = p_comment_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.resolve_flow_comment(uuid) to authenticated;

create or replace function public.append_flow_change_log(
  p_flow_id uuid,
  p_summary text,
  p_patch jsonb default '{}'::jsonb,
  p_snapshot jsonb default null
)
returns public.flow_change_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance uuid;
  v_row public.flow_change_log;
begin
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

  insert into public.flow_change_log (flow_id, instance_id, author_id, summary, patch, snapshot)
  values (
    p_flow_id,
    v_instance,
    auth.uid(),
    coalesce(nullif(trim(p_summary), ''), 'Autosave'),
    coalesce(p_patch, '{}'::jsonb),
    p_snapshot
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.append_flow_change_log(uuid, text, jsonb, jsonb) to authenticated;

create or replace function public.restore_flow_change_log(p_change_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.flow_change_log;
begin
  select * into v_log from public.flow_change_log where id = p_change_id;
  if v_log.id is null then
    raise exception 'Change log entry not found';
  end if;
  if not public.has_instance_role(
    v_log.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;
  if v_log.snapshot is null then
    raise exception 'No snapshot on this entry';
  end if;

  update public.chatbot_flows
  set has_draft_changes = true, updated_at = now()
  where id = v_log.flow_id;

  perform public.write_audit_event(
    v_log.instance_id,
    'flow.change_restored',
    'flow_change_log',
    p_change_id::text,
    jsonb_build_object('flow_id', v_log.flow_id)
  );

  return v_log.snapshot;
end;
$$;

grant execute on function public.restore_flow_change_log(uuid) to authenticated;

-- Presence is primarily Realtime Presence channels; optional durable heartbeat
create table if not exists public.flow_editor_presence (
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  selected_node_key text,
  cursor jsonb not null default '{}'::jsonb,
  color text not null default '#0f766e',
  updated_at timestamptz not null default now(),
  primary key (flow_id, user_id)
);

alter table public.flow_editor_presence enable row level security;

drop policy if exists "flow_editor_presence_select" on public.flow_editor_presence;
create policy "flow_editor_presence_select"
on public.flow_editor_presence for select to authenticated
using (
  exists (
    select 1 from public.chatbot_flows f
    where f.id = flow_id
      and public.is_instance_member(public.chatbot_instance_id(f.chatbot_id))
  )
);

drop policy if exists "flow_editor_presence_upsert" on public.flow_editor_presence;
create policy "flow_editor_presence_upsert"
on public.flow_editor_presence for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.flow_comments;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.flow_editor_presence;
  exception when others then null;
  end;
end;
$$;
