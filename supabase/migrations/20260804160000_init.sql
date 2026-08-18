-- FlowForge core schema + RLS
create extension if not exists "pgcrypto";

-- Enums
create type public.instance_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.variable_type as enum ('string', 'number', 'boolean', 'date', 'array', 'object');
create type public.variable_scope as enum ('global', 'step');
create type public.connection_kind as enum ('http', 'email');
create type public.flow_node_type as enum (
  'message',
  'question',
  'http',
  'email',
  'condition',
  'set_variable',
  'operation',
  'end'
);

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

-- Instances (tenants / workspaces)
create table public.instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instance_members (
  instance_id uuid not null references public.instances (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.instance_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (instance_id, user_id)
);

create index instance_members_user_idx on public.instance_members (user_id);

-- Chatbots
create table public.chatbots (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null,
  description text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chatbots_instance_idx on public.chatbots (instance_id);

-- Global / step variable definitions at chatbot level (globals primarily)
create table public.chatbot_variables (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  key text not null,
  value_type public.variable_type not null default 'string',
  default_value jsonb,
  scope public.variable_scope not null default 'global',
  source_node_key text,
  description text,
  created_at timestamptz not null default now(),
  unique (chatbot_id, key)
);

create index chatbot_variables_chatbot_idx on public.chatbot_variables (chatbot_id);

-- Connections (instance-scoped reusable HTTP / email)
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null,
  kind public.connection_kind not null,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connections_instance_idx on public.connections (instance_id);

-- Optional chatbot-linked connections (reuse instance connection or chatbot-private)
create table public.chatbot_connections (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete cascade,
  name text,
  kind public.connection_kind,
  config jsonb,
  created_at timestamptz not null default now(),
  check (
    connection_id is not null
    or (name is not null and kind is not null)
  )
);

create index chatbot_connections_chatbot_idx on public.chatbot_connections (chatbot_id);

-- Flows
create table public.chatbot_flows (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null unique references public.chatbots (id) on delete cascade,
  name text not null default 'Main',
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flow_nodes (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  key text not null,
  type public.flow_node_type not null,
  label text,
  config jsonb not null default '{}'::jsonb,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (flow_id, key)
);

create index flow_nodes_flow_idx on public.flow_nodes (flow_id);

create table public.flow_edges (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  source_node_id uuid not null references public.flow_nodes (id) on delete cascade,
  target_node_id uuid not null references public.flow_nodes (id) on delete cascade,
  source_handle text,
  label text,
  created_at timestamptz not null default now()
);

create index flow_edges_flow_idx on public.flow_edges (flow_id);

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger instances_updated_at
before update on public.instances
for each row execute function public.set_updated_at();

create trigger chatbots_updated_at
before update on public.chatbots
for each row execute function public.set_updated_at();

create trigger connections_updated_at
before update on public.connections
for each row execute function public.set_updated_at();

create trigger chatbot_flows_updated_at
before update on public.chatbot_flows
for each row execute function public.set_updated_at();

-- Profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Membership helpers (security definer to avoid RLS recursion)
create or replace function public.is_instance_member(p_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instance_members m
    where m.instance_id = p_instance_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_instance_role(p_instance_id uuid, p_roles public.instance_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.instance_members m
    where m.instance_id = p_instance_id
      and m.user_id = auth.uid()
      and m.role = any (p_roles)
  );
$$;

create or replace function public.chatbot_instance_id(p_chatbot_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.instance_id from public.chatbots c where c.id = p_chatbot_id;
$$;

create or replace function public.flow_instance_id(p_flow_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.instance_id
  from public.chatbot_flows f
  join public.chatbots c on c.id = f.chatbot_id
  where f.id = p_flow_id;
$$;

-- Auto-add creator as owner + default flow on chatbot create
create or replace function public.handle_new_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.instance_members (instance_id, user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_instance_created
after insert on public.instances
for each row execute function public.handle_new_instance();

create or replace function public.handle_new_chatbot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  flow_id uuid;
  start_id uuid;
  end_id uuid;
begin
  insert into public.chatbot_flows (chatbot_id, name)
  values (new.id, 'Main')
  returning id into flow_id;

  insert into public.flow_nodes (flow_id, key, type, label, config, position_x, position_y)
  values (
    flow_id,
    'welcome',
    'message',
    'Welcome',
    jsonb_build_object('text', 'Hello! How can I help you today?'),
    0,
    0
  )
  returning id into start_id;

  insert into public.flow_nodes (flow_id, key, type, label, config, position_x, position_y)
  values (
    flow_id,
    'end',
    'end',
    'End',
    '{}'::jsonb,
    0,
    160
  )
  returning id into end_id;

  insert into public.flow_edges (flow_id, source_node_id, target_node_id)
  values (flow_id, start_id, end_id);

  return new;
end;
$$;

create trigger on_chatbot_created
after insert on public.chatbots
for each row execute function public.handle_new_chatbot();

-- RLS
alter table public.profiles enable row level security;
alter table public.instances enable row level security;
alter table public.instance_members enable row level security;
alter table public.chatbots enable row level security;
alter table public.chatbot_variables enable row level security;
alter table public.connections enable row level security;
alter table public.chatbot_connections enable row level security;
alter table public.chatbot_flows enable row level security;
alter table public.flow_nodes enable row level security;
alter table public.flow_edges enable row level security;

-- Profiles
create policy "profiles_select_own_or_same_instance"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.instance_members mine
    join public.instance_members theirs
      on theirs.instance_id = mine.instance_id
    where mine.user_id = auth.uid()
      and theirs.user_id = profiles.id
  )
);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Instances
create policy "instances_select_member"
on public.instances for select to authenticated
using (public.is_instance_member(id));

create policy "instances_insert_authenticated"
on public.instances for insert to authenticated
with check (auth.uid() is not null);

create policy "instances_update_admin"
on public.instances for update to authenticated
using (public.has_instance_role(id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(id, array['owner', 'admin']::public.instance_role[]));

create policy "instances_delete_owner"
on public.instances for delete to authenticated
using (public.has_instance_role(id, array['owner']::public.instance_role[]));

-- Members
create policy "members_select_same_instance"
on public.instance_members for select to authenticated
using (public.is_instance_member(instance_id));

create policy "members_insert_admin"
on public.instance_members for insert to authenticated
with check (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
  or (
    -- allow trigger path: creator inserting self as owner on create is handled by security definer
    user_id = auth.uid()
    and role = 'owner'
    and not exists (
      select 1 from public.instance_members m where m.instance_id = instance_members.instance_id
    )
  )
);

create policy "members_update_admin"
on public.instance_members for update to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

create policy "members_delete_admin"
on public.instance_members for delete to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- Chatbots
create policy "chatbots_select_member"
on public.chatbots for select to authenticated
using (public.is_instance_member(instance_id));

create policy "chatbots_insert_editor"
on public.chatbots for insert to authenticated
with check (public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[]));

create policy "chatbots_update_editor"
on public.chatbots for update to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[]));

create policy "chatbots_delete_admin"
on public.chatbots for delete to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- Variables
create policy "variables_select_member"
on public.chatbot_variables for select to authenticated
using (public.is_instance_member(public.chatbot_instance_id(chatbot_id)));

create policy "variables_write_editor"
on public.chatbot_variables for all to authenticated
using (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]));

-- Connections (instance)
create policy "connections_select_member"
on public.connections for select to authenticated
using (public.is_instance_member(instance_id));

create policy "connections_write_admin"
on public.connections for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- Chatbot connections
create policy "chatbot_connections_select_member"
on public.chatbot_connections for select to authenticated
using (public.is_instance_member(public.chatbot_instance_id(chatbot_id)));

create policy "chatbot_connections_write_editor"
on public.chatbot_connections for all to authenticated
using (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]));

-- Flows
create policy "flows_select_member"
on public.chatbot_flows for select to authenticated
using (public.is_instance_member(public.chatbot_instance_id(chatbot_id)));

create policy "flows_write_editor"
on public.chatbot_flows for all to authenticated
using (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]));

-- Nodes
create policy "nodes_select_member"
on public.flow_nodes for select to authenticated
using (public.is_instance_member(public.flow_instance_id(flow_id)));

create policy "nodes_write_editor"
on public.flow_nodes for all to authenticated
using (public.has_instance_role(public.flow_instance_id(flow_id), array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(public.flow_instance_id(flow_id), array['owner', 'admin', 'editor']::public.instance_role[]));

-- Edges
create policy "edges_select_member"
on public.flow_edges for select to authenticated
using (public.is_instance_member(public.flow_instance_id(flow_id)));

create policy "edges_write_editor"
on public.flow_edges for all to authenticated
using (public.has_instance_role(public.flow_instance_id(flow_id), array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(public.flow_instance_id(flow_id), array['owner', 'admin', 'editor']::public.instance_role[]));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.instances to authenticated;
grant select, insert, update, delete on public.instance_members to authenticated;
grant select, insert, update, delete on public.chatbots to authenticated;
grant select, insert, update, delete on public.chatbot_variables to authenticated;
grant select, insert, update, delete on public.connections to authenticated;
grant select, insert, update, delete on public.chatbot_connections to authenticated;
grant select, insert, update, delete on public.chatbot_flows to authenticated;
grant select, insert, update, delete on public.flow_nodes to authenticated;
grant select, insert, update, delete on public.flow_edges to authenticated;
