-- Phase 6: Public template/flow marketplace + cross-org bot clone

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  publisher_instance_id uuid not null references public.instances (id) on delete cascade,
  kind text not null check (kind in ('flow_pack', 'template_pack')),
  visibility text not null default 'private'
    check (visibility in ('private', 'org', 'public')),
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  slug text not null,
  title text not null,
  summary text,
  category text,
  screenshots jsonb not null default '[]'::jsonb,
  pack jsonb not null default '{}'::jsonb,
  source_chatbot_id uuid references public.chatbots (id) on delete set null,
  install_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publisher_instance_id, slug)
);

create index if not exists marketplace_listings_public_idx
  on public.marketplace_listings (status, visibility, category)
  where status = 'approved' and visibility = 'public';

alter table public.marketplace_listings enable row level security;

drop policy if exists "marketplace_select" on public.marketplace_listings;
create policy "marketplace_select"
on public.marketplace_listings for select to authenticated
using (
  (status = 'approved' and visibility = 'public')
  or public.is_instance_member(publisher_instance_id)
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_superuser)
);

drop policy if exists "marketplace_write_publisher" on public.marketplace_listings;
create policy "marketplace_write_publisher"
on public.marketplace_listings for all to authenticated
using (
  public.has_instance_role(
    publisher_instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.has_instance_role(
    publisher_instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

create table if not exists public.marketplace_installs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings (id) on delete cascade,
  target_instance_id uuid not null references public.instances (id) on delete cascade,
  target_chatbot_id uuid references public.chatbots (id) on delete set null,
  installed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.marketplace_installs enable row level security;

drop policy if exists "marketplace_installs_select" on public.marketplace_installs;
create policy "marketplace_installs_select"
on public.marketplace_installs for select to authenticated
using (public.is_instance_member(target_instance_id));

drop policy if exists "marketplace_installs_insert" on public.marketplace_installs;
create policy "marketplace_installs_insert"
on public.marketplace_installs for insert to authenticated
with check (
  public.has_instance_role(
    target_instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

create or replace function public.submit_marketplace_listing(p_listing_id uuid)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.marketplace_listings;
begin
  select * into v_row from public.marketplace_listings where id = p_listing_id;
  if v_row.id is null then
    raise exception 'Listing not found';
  end if;
  if not public.has_instance_role(
    v_row.publisher_instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  update public.marketplace_listings
  set
    status = case when visibility = 'public' then 'pending' else 'approved' end,
    updated_at = now()
  where id = p_listing_id
  returning * into v_row;

  perform public.write_audit_event(
    v_row.publisher_instance_id,
    'marketplace.published',
    'marketplace_listing',
    p_listing_id::text,
    jsonb_build_object('status', v_row.status, 'visibility', v_row.visibility)
  );

  return v_row;
end;
$$;

grant execute on function public.submit_marketplace_listing(uuid) to authenticated;

create or replace function public.review_marketplace_listing(
  p_listing_id uuid,
  p_approve boolean
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.marketplace_listings;
  v_super boolean;
begin
  select is_superuser into v_super from public.profiles where id = auth.uid();
  if not coalesce(v_super, false) then
    raise exception 'Superuser required';
  end if;

  update public.marketplace_listings
  set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_listing_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Listing not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.review_marketplace_listing(uuid, boolean) to authenticated;

create or replace function public.record_marketplace_install(
  p_listing_id uuid,
  p_target_instance_id uuid,
  p_target_chatbot_id uuid default null
)
returns public.marketplace_installs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.marketplace_listings;
  v_row public.marketplace_installs;
begin
  select * into v_listing from public.marketplace_listings where id = p_listing_id;
  if v_listing.id is null then
    raise exception 'Listing not found';
  end if;
  if v_listing.status <> 'approved'
     and not public.is_instance_member(v_listing.publisher_instance_id) then
    raise exception 'Listing not available';
  end if;
  if not public.has_instance_role(
    p_target_instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  insert into public.marketplace_installs (
    listing_id, target_instance_id, target_chatbot_id, installed_by
  ) values (
    p_listing_id, p_target_instance_id, p_target_chatbot_id, auth.uid()
  )
  returning * into v_row;

  update public.marketplace_listings
  set install_count = install_count + 1, updated_at = now()
  where id = p_listing_id;

  perform public.write_audit_event(
    p_target_instance_id,
    'marketplace.installed',
    'marketplace_listing',
    p_listing_id::text,
    jsonb_build_object('chatbot_id', p_target_chatbot_id)
  );

  return v_row;
end;
$$;

grant execute on function public.record_marketplace_install(uuid, uuid, uuid) to authenticated;

-- Cross-org clone: member of both instances or superuser
create or replace function public.clone_chatbot_to_instance(
  p_source_chatbot_id uuid,
  p_target_instance_id uuid,
  p_new_name text default null,
  p_include_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.chatbots;
  v_src_instance uuid;
  v_super boolean;
  v_new public.chatbots;
  v_flow public.chatbot_flows;
  v_new_flow public.chatbot_flows;
  v_node record;
  v_edge record;
  v_id_map jsonb := '{}'::jsonb;
  v_new_node_id uuid;
  v_tmpl record;
begin
  select * into v_src from public.chatbots where id = p_source_chatbot_id and deleted_at is null;
  if v_src.id is null then
    raise exception 'Source chatbot not found';
  end if;
  v_src_instance := v_src.instance_id;

  select is_superuser into v_super from public.profiles where id = auth.uid();

  if not coalesce(v_super, false) then
    if not public.is_instance_member(v_src_instance) then
      raise exception 'Not a member of source organisation';
    end if;
    if not public.has_instance_role(
      p_target_instance_id,
      array['owner', 'admin', 'editor']::public.instance_role[]
    ) then
      raise exception 'Not allowed on target organisation';
    end if;
  end if;

  insert into public.chatbots (
    instance_id, name, description, settings, created_by, environment
  ) values (
    p_target_instance_id,
    coalesce(nullif(trim(p_new_name), ''), v_src.name || ' (clone)'),
    v_src.description,
    coalesce(v_src.settings, '{}'::jsonb),
    auth.uid(),
    'production'
  )
  returning * into v_new;

  -- on_chatbot_created already inserted chatbot_flows (+ default nodes).
  select * into v_new_flow from public.chatbot_flows where chatbot_id = v_new.id;
  if v_new_flow.id is null then
    raise exception 'Clone target flow missing after chatbot create';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_src.id;

  delete from public.flow_edges where flow_id = v_new_flow.id;
  delete from public.flow_nodes where flow_id = v_new_flow.id;

  if v_flow.id is not null then
    update public.chatbot_flows
    set
      name = coalesce(v_flow.name, name),
      version = 1,
      published_graph = case when p_include_published then v_flow.published_graph else null end,
      published_at = case when p_include_published then v_flow.published_at else null end,
      has_draft_changes = true,
      updated_at = now()
    where id = v_new_flow.id
    returning * into v_new_flow;

    for v_node in
      select * from public.flow_nodes where flow_id = v_flow.id
    loop
      v_new_node_id := gen_random_uuid();
      v_id_map := v_id_map || jsonb_build_object(v_node.id::text, v_new_node_id::text);
      insert into public.flow_nodes (
        id, flow_id, key, type, label, config, position_x, position_y
      ) values (
        v_new_node_id, v_new_flow.id, v_node.key, v_node.type, v_node.label,
        -- Strip connection IDs from config (become stubs)
        (v_node.config - 'connectionId' - 'connection_id'),
        v_node.position_x, v_node.position_y
      );
    end loop;

    for v_edge in
      select * from public.flow_edges where flow_id = v_flow.id
    loop
      insert into public.flow_edges (
        flow_id, source_node_id, target_node_id, source_handle, label
      ) values (
        v_new_flow.id,
        (v_id_map ->> v_edge.source_node_id::text)::uuid,
        (v_id_map ->> v_edge.target_node_id::text)::uuid,
        v_edge.source_handle,
        v_edge.label
      );
    end loop;
  end if;

  -- Globals
  insert into public.chatbot_variables (
    chatbot_id, key, value_type, default_value, scope, source_node_key, description
  )
  select
    v_new.id, key, value_type, default_value, scope, source_node_key, description
  from public.chatbot_variables
  where chatbot_id = v_src.id;

  -- Templates (no secrets)
  for v_tmpl in
    select * from public.chatbot_templates
    where chatbot_id = v_src.id and deleted_at is null
  loop
    insert into public.chatbot_templates (
      chatbot_id, key, name, description, kind, content, created_by
    ) values (
      v_new.id,
      v_tmpl.key,
      coalesce(nullif(trim(v_tmpl.name), ''), v_tmpl.key),
      v_tmpl.description,
      v_tmpl.kind,
      coalesce(v_tmpl.content, '{}'::jsonb),
      auth.uid()
    );
  end loop;

  -- Entities by key (empty dynamic data — structure only)
  insert into public.chatbot_entities (chatbot_id, key, name, kind, environment)
  select v_new.id, key, name, kind, 'production'
  from public.chatbot_entities
  where chatbot_id = v_src.id
    and deleted_at is null;

  perform public.write_audit_event(
    p_target_instance_id,
    'chatbot.cloned',
    'chatbot',
    v_new.id::text,
    jsonb_build_object(
      'source_chatbot_id', p_source_chatbot_id,
      'source_instance_id', v_src_instance
    )
  );

  return jsonb_build_object(
    'chatbot_id', v_new.id,
    'flow_id', v_new_flow.id,
    'name', v_new.name,
    'connections_need_rebind', true
  );
end;
$$;

grant execute on function public.clone_chatbot_to_instance(uuid, uuid, text, boolean)
  to authenticated;
