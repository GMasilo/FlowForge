-- Chatbot-scoped connections with private / global / shared visibility + marketplace links.
-- Config (secrets) lives in connection_secrets; marketplace viewers never get secrets.

create type public.connection_visibility as enum ('private', 'global', 'shared');

alter table public.connections
  add column if not exists chatbot_id uuid references public.chatbots (id) on delete cascade,
  add column if not exists visibility public.connection_visibility not null default 'private';

create index if not exists connections_chatbot_idx on public.connections (chatbot_id);
create index if not exists connections_visibility_idx on public.connections (instance_id, visibility);

-- Attach legacy instance-only connections to the oldest chatbot in the instance (global so existing flows keep working).
update public.connections c
set
  chatbot_id = (
    select b.id
    from public.chatbots b
    where b.instance_id = c.instance_id
    order by b.created_at asc
    limit 1
  ),
  visibility = 'global'
where c.chatbot_id is null;

-- Drop orphans that somehow have no chatbot in the instance
delete from public.connections where chatbot_id is null;

alter table public.connections
  alter column chatbot_id set not null;

-- Secrets store (was connections.config)
create table if not exists public.connection_secrets (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.connection_secrets (connection_id, config)
select id, coalesce(config, '{}'::jsonb)
from public.connections
on conflict (connection_id) do nothing;

alter table public.connections drop column if exists config;

-- Per-user shares (visibility = shared)
create table if not exists public.connection_shares (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (connection_id, user_id)
);

create index if not exists connection_shares_user_idx on public.connection_shares (user_id);
create index if not exists connection_shares_connection_idx on public.connection_shares (connection_id);

-- Marketplace installs: link-only (drop optional inline private definition)
alter table public.chatbot_connections
  drop constraint if exists chatbot_connections_target_chk;

-- Remove orphan inline rows without a connection_id
delete from public.chatbot_connections where connection_id is null;

alter table public.chatbot_connections
  alter column connection_id set not null;

alter table public.chatbot_connections
  drop column if exists name,
  drop column if exists kind,
  drop column if exists config;

alter table public.chatbot_connections
  add column if not exists added_by uuid references auth.users (id) on delete set null;

create unique index if not exists chatbot_connections_unique_link
  on public.chatbot_connections (chatbot_id, connection_id);

-- Auto-link owning chatbot to its connection
create or replace function public.ensure_owner_connection_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chatbot_connections (chatbot_id, connection_id, added_by)
  values (new.chatbot_id, new.id, new.created_by)
  on conflict (chatbot_id, connection_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_connection_created_link on public.connections;
create trigger on_connection_created_link
after insert on public.connections
for each row execute function public.ensure_owner_connection_link();

-- Backfill owner links
insert into public.chatbot_connections (chatbot_id, connection_id, added_by)
select c.chatbot_id, c.id, c.created_by
from public.connections c
on conflict (chatbot_id, connection_id) do nothing;

-- Helpers
create or replace function public.can_manage_connection(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.id = p_connection_id
      and public.has_instance_role(
        c.instance_id,
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
      and (
        c.created_by = auth.uid()
        or public.has_instance_role(c.instance_id, array['owner', 'admin']::public.instance_role[])
        or exists (
          select 1 from public.chatbots b
          where b.id = c.chatbot_id
            and public.has_instance_role(b.instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
        )
      )
  );
$$;

create or replace function public.can_see_connection_meta(p_connection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connections c
    where c.id = p_connection_id
      and public.is_instance_member(c.instance_id)
      and (
        public.can_manage_connection(c.id)
        or c.visibility = 'global'
        or (
          c.visibility = 'shared'
          and exists (
            select 1 from public.connection_shares s
            where s.connection_id = c.id and s.user_id = auth.uid()
          )
        )
        or exists (
          select 1 from public.chatbot_connections cc
          join public.chatbots b on b.id = cc.chatbot_id
          where cc.connection_id = c.id
            and public.has_instance_role(b.instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
        )
      )
  );
$$;

-- User may load secrets only when managing the connection (create/edit), NOT merely because it's linked.
-- Execution for linked users goes through connection_config_for_use() or the PHP service role.
create or replace function public.connection_config_for_use(p_connection_id uuid, p_chatbot_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_ok boolean;
begin
  select exists (
    select 1
    from public.connections c
    where c.id = p_connection_id
      and public.is_instance_member(c.instance_id)
      and (
        -- owning chatbot always
        c.chatbot_id = p_chatbot_id
        -- or installed on this chatbot and visibility allows the caller
        or (
          exists (
            select 1 from public.chatbot_connections cc
            where cc.connection_id = c.id and cc.chatbot_id = p_chatbot_id
          )
          and (
            public.can_manage_connection(c.id)
            or c.visibility = 'global'
            or (
              c.visibility = 'shared'
              and exists (
                select 1 from public.connection_shares s
                where s.connection_id = c.id and s.user_id = auth.uid()
              )
            )
          )
        )
      )
      and public.has_instance_role(
        public.chatbot_instance_id(p_chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  ) into v_ok;

  if not v_ok then
    return null;
  end if;

  select s.config into v_config
  from public.connection_secrets s
  where s.connection_id = p_connection_id;

  return coalesce(v_config, '{}'::jsonb);
end;
$$;

grant execute on function public.can_manage_connection(uuid) to authenticated;
grant execute on function public.can_see_connection_meta(uuid) to authenticated;
grant execute on function public.connection_config_for_use(uuid, uuid) to authenticated;

-- RLS
alter table public.connection_secrets enable row level security;
alter table public.connection_shares enable row level security;

drop policy if exists "connections_select_member" on public.connections;
drop policy if exists "connections_write_admin" on public.connections;
drop policy if exists "chatbot_connections_select_member" on public.chatbot_connections;
drop policy if exists "chatbot_connections_write_editor" on public.chatbot_connections;

create policy "connections_select_visible"
on public.connections for select to authenticated
using (public.can_see_connection_meta(id));

create policy "connections_insert_editor"
on public.connections for insert to authenticated
with check (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  and chatbot_id is not null
  and public.chatbot_instance_id(chatbot_id) = instance_id
);

create policy "connections_update_manager"
on public.connections for update to authenticated
using (public.can_manage_connection(id))
with check (public.can_manage_connection(id));

create policy "connections_delete_manager"
on public.connections for delete to authenticated
using (public.can_manage_connection(id));

create policy "connection_secrets_select_manager"
on public.connection_secrets for select to authenticated
using (public.can_manage_connection(connection_id));

create policy "connection_secrets_write_manager"
on public.connection_secrets for all to authenticated
using (public.can_manage_connection(connection_id))
with check (public.can_manage_connection(connection_id));

create policy "connection_shares_select_visible"
on public.connection_shares for select to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_connection(connection_id)
);

create policy "connection_shares_write_manager"
on public.connection_shares for all to authenticated
using (public.can_manage_connection(connection_id))
with check (public.can_manage_connection(connection_id));

create policy "chatbot_connections_select_member"
on public.chatbot_connections for select to authenticated
using (
  public.is_instance_member(public.chatbot_instance_id(chatbot_id))
);

create policy "chatbot_connections_write_editor"
on public.chatbot_connections for all to authenticated
using (
  public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
  -- Private connections cannot be linked to other chatbots
  and (
    exists (
      select 1 from public.connections c
      where c.id = connection_id
        and c.chatbot_id = chatbot_id
    )
    or exists (
      select 1 from public.connections c
      where c.id = connection_id
        and c.visibility in ('global', 'shared')
    )
  )
);

grant select, insert, update, delete on public.connection_secrets to authenticated;
grant select, insert, update, delete on public.connection_shares to authenticated;

comment on column public.connections.visibility is
  'private = owning chatbot only; global = instance marketplace; shared = listed for connection_shares users';
comment on table public.connection_secrets is
  'Sensitive connection config. Only managers can SELECT; linked users execute via connection_config_for_use or the API.';
comment on table public.connection_shares is
  'When visibility=shared, these users may see the connection in the marketplace (metadata only) and link it.';
