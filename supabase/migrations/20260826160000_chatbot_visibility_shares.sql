-- Chatbot visibility: editors/viewers only see bots they created or were shared;
-- owners/admins see all. Share grants persist via chatbot_shares.

create table if not exists public.chatbot_shares (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  shared_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chatbot_id, user_id)
);

create index if not exists chatbot_shares_user_idx on public.chatbot_shares (user_id);
create index if not exists chatbot_shares_chatbot_idx on public.chatbot_shares (chatbot_id);

alter table public.chatbot_shares enable row level security;

create or replace function public.can_access_chatbot(p_chatbot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chatbots b
    where b.id = p_chatbot_id
      and public.is_instance_member(b.instance_id)
      and (
        public.has_instance_role(b.instance_id, array['owner', 'admin']::public.instance_role[])
        or b.created_by = auth.uid()
        or exists (
          select 1
          from public.chatbot_shares s
          where s.chatbot_id = b.id
            and s.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_access_chatbot(uuid) to authenticated, service_role;

create or replace function public.can_access_flow(p_flow_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_chatbot(f.chatbot_id)
  from public.chatbot_flows f
  where f.id = p_flow_id;
$$;

grant execute on function public.can_access_flow(uuid) to authenticated, service_role;

create or replace function public.can_share_chatbot(p_chatbot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chatbots b
    where b.id = p_chatbot_id
      and b.deleted_at is null
      and public.has_instance_role(
        b.instance_id,
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
      and (
        public.has_instance_role(b.instance_id, array['owner', 'admin']::public.instance_role[])
        or b.created_by = auth.uid()
        or exists (
          select 1
          from public.chatbot_shares s
          where s.chatbot_id = b.id
            and s.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_share_chatbot(uuid) to authenticated, service_role;

-- chatbot_shares policies
drop policy if exists "chatbot_shares_select" on public.chatbot_shares;
create policy "chatbot_shares_select"
on public.chatbot_shares for select to authenticated
using (public.can_access_chatbot(chatbot_id));

drop policy if exists "chatbot_shares_insert" on public.chatbot_shares;
create policy "chatbot_shares_insert"
on public.chatbot_shares for insert to authenticated
with check (public.can_share_chatbot(chatbot_id));

drop policy if exists "chatbot_shares_delete" on public.chatbot_shares;
create policy "chatbot_shares_delete"
on public.chatbot_shares for delete to authenticated
using (public.can_share_chatbot(chatbot_id));

grant select, insert, delete on public.chatbot_shares to authenticated;

-- Tighten chatbot SELECT: admins see all; others only owned or shared
drop policy if exists "chatbots_select_active" on public.chatbots;
create policy "chatbots_select_active"
on public.chatbots for select to authenticated
using (
  deleted_at is null
  and public.is_instance_member(instance_id)
  and (
    public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
    or created_by = auth.uid()
    or exists (
      select 1
      from public.chatbot_shares s
      where s.chatbot_id = chatbots.id
        and s.user_id = auth.uid()
    )
  )
);

-- Flows / nodes / edges / variables follow chatbot access
drop policy if exists "flows_select_member" on public.chatbot_flows;
create policy "flows_select_member"
on public.chatbot_flows for select to authenticated
using (public.can_access_chatbot(chatbot_id));

drop policy if exists "flows_write_editor" on public.chatbot_flows;
create policy "flows_write_editor"
on public.chatbot_flows for all to authenticated
using (
  public.can_access_chatbot(chatbot_id)
  and public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.can_access_chatbot(chatbot_id)
  and public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

drop policy if exists "nodes_select_member" on public.flow_nodes;
create policy "nodes_select_member"
on public.flow_nodes for select to authenticated
using (public.can_access_flow(flow_id));

drop policy if exists "nodes_write_editor" on public.flow_nodes;
create policy "nodes_write_editor"
on public.flow_nodes for all to authenticated
using (
  public.can_access_flow(flow_id)
  and public.has_instance_role(
    public.flow_instance_id(flow_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.can_access_flow(flow_id)
  and public.has_instance_role(
    public.flow_instance_id(flow_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

drop policy if exists "edges_select_member" on public.flow_edges;
create policy "edges_select_member"
on public.flow_edges for select to authenticated
using (public.can_access_flow(flow_id));

drop policy if exists "edges_write_editor" on public.flow_edges;
create policy "edges_write_editor"
on public.flow_edges for all to authenticated
using (
  public.can_access_flow(flow_id)
  and public.has_instance_role(
    public.flow_instance_id(flow_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.can_access_flow(flow_id)
  and public.has_instance_role(
    public.flow_instance_id(flow_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

drop policy if exists "variables_select_member" on public.chatbot_variables;
create policy "variables_select_member"
on public.chatbot_variables for select to authenticated
using (public.can_access_chatbot(chatbot_id));

drop policy if exists "variables_write_editor" on public.chatbot_variables;
create policy "variables_write_editor"
on public.chatbot_variables for all to authenticated
using (
  public.can_access_chatbot(chatbot_id)
  and public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.can_access_chatbot(chatbot_id)
  and public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

drop policy if exists "chatbots_update_editor" on public.chatbots;
create policy "chatbots_update_editor"
on public.chatbots for update to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  and (
    public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
    or created_by = auth.uid()
    or exists (
      select 1 from public.chatbot_shares s
      where s.chatbot_id = chatbots.id and s.user_id = auth.uid()
    )
  )
)
with check (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  and (
    public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
    or created_by = auth.uid()
    or exists (
      select 1 from public.chatbot_shares s
      where s.chatbot_id = chatbots.id and s.user_id = auth.uid()
    )
  )
);

-- Replace share RPC: grant chatbot_shares + notify
create or replace function public.share_flow_with_members(
  p_flow_id uuid,
  p_user_ids uuid[],
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance uuid;
  v_chatbot uuid;
  v_bot_name text;
  v_sharer text;
  v_href text;
  v_title text;
  v_body text;
  v_note text;
  v_uid uuid;
  v_count integer := 0;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_flow_id is null then
    raise exception 'Flow required';
  end if;

  select public.chatbot_instance_id(f.chatbot_id), f.chatbot_id, b.name
  into v_instance, v_chatbot, v_bot_name
  from public.chatbot_flows f
  join public.chatbots b on b.id = f.chatbot_id and b.deleted_at is null
  where f.id = p_flow_id;

  if v_instance is null or v_chatbot is null then
    raise exception 'Flow not found';
  end if;
  if not public.can_share_chatbot(v_chatbot) then
    raise exception 'Not allowed';
  end if;

  select coalesce(
    nullif(trim(m.display_name), ''),
    nullif(trim(p.display_name), ''),
    nullif(trim(p.email), ''),
    'A teammate'
  )
  into v_sharer
  from public.profiles p
  left join public.instance_members m
    on m.user_id = p.id and m.instance_id = v_instance
  where p.id = auth.uid();
  v_sharer := coalesce(v_sharer, 'A teammate');

  select array_agg(distinct x order by x)
  into v_ids
  from unnest(coalesce(p_user_ids, array[]::uuid[])) as x
  where x is not null
    and x <> auth.uid();

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Select at least one member';
  end if;
  if cardinality(v_ids) > 25 then
    raise exception 'Too many recipients (max 25)';
  end if;

  v_href := '/instances/' || v_instance::text || '/chatbots/' || v_chatbot::text || '/design';
  v_bot_name := coalesce(nullif(trim(v_bot_name), ''), 'Flow');
  v_title := left(v_sharer, 60) || ' invited you to collaborate';
  v_note := nullif(trim(coalesce(p_message, '')), '');
  v_body := coalesce(v_note, 'Open the designer to collaborate on ' || v_bot_name || '.');

  foreach v_uid in array v_ids
  loop
    if not exists (
      select 1
      from public.instance_members m
      where m.instance_id = v_instance
        and m.user_id = v_uid
        and m.disabled_at is null
    ) then
      continue;
    end if;

    -- Skip recipients who already have full org visibility (owners/admins)
    if exists (
      select 1
      from public.instance_members m
      where m.instance_id = v_instance
        and m.user_id = v_uid
        and m.role in ('owner', 'admin')
        and m.disabled_at is null
    ) then
      -- Still notify them; they already see the bot
      null;
    else
      insert into public.chatbot_shares (chatbot_id, user_id, shared_by)
      values (v_chatbot, v_uid, auth.uid())
      on conflict (chatbot_id, user_id) do nothing;
    end if;

    perform public.create_user_notification(
      v_instance,
      v_uid,
      'flow.shared',
      v_title,
      left(v_body, 280),
      v_href,
      'flow',
      p_flow_id::text,
      jsonb_build_object(
        'flow_id', p_flow_id,
        'chatbot_id', v_chatbot,
        'shared_by', auth.uid()
      )
    );
    -- Count the recipient; do not test composite IS NOT NULL (UNKNOWN when read_at is null).
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'No eligible members to notify';
  end if;

  return jsonb_build_object(
    'notified', v_count,
    'href', v_href,
    'chatbot_id', v_chatbot
  );
end;
$$;

revoke all on function public.share_flow_with_members(uuid, uuid[], text) from public;
grant execute on function public.share_flow_with_members(uuid, uuid[], text) to authenticated;

-- Flow comments must respect chatbot visibility
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
  if not public.can_access_chatbot(v_chatbot) then
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

notify pgrst, 'reload schema';
