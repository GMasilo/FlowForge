-- Entity visibility + install links with per-chatbot CRUD flags.
-- Mirrors connection visibility/shares; entities stay owned by one chatbot.

do $$ begin
  create type public.entity_visibility as enum ('private', 'global', 'shared');
exception when duplicate_object then null;
end $$;

alter table public.chatbot_entities
  add column if not exists visibility public.entity_visibility not null default 'private';

create index if not exists chatbot_entities_visibility_idx
  on public.chatbot_entities (chatbot_id, visibility);

-- Install links: which chatbots may use an entity, and with which CRUD ops.
create table if not exists public.chatbot_entity_links (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  entity_id uuid not null references public.chatbot_entities (id) on delete cascade,
  can_query boolean not null default true,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chatbot_id, entity_id)
);

create index if not exists chatbot_entity_links_entity_idx on public.chatbot_entity_links (entity_id);
create index if not exists chatbot_entity_links_chatbot_idx on public.chatbot_entity_links (chatbot_id);

-- Per-user discoverability when visibility = shared
create table if not exists public.entity_shares (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.chatbot_entities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entity_id, user_id)
);

create index if not exists entity_shares_user_idx on public.entity_shares (user_id);
create index if not exists entity_shares_entity_idx on public.entity_shares (entity_id);

-- Auto-link owning chatbot with full CRUD
create or replace function public.ensure_owner_entity_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chatbot_entity_links (
    chatbot_id, entity_id, can_query, can_create, can_update, can_delete, added_by
  )
  values (new.chatbot_id, new.id, true, true, true, true, auth.uid())
  on conflict (chatbot_id, entity_id) do update set
    can_query = true,
    can_create = true,
    can_update = true,
    can_delete = true;
  return new;
end;
$$;

drop trigger if exists on_entity_created_link on public.chatbot_entities;
create trigger on_entity_created_link
after insert on public.chatbot_entities
for each row execute function public.ensure_owner_entity_link();

-- Keep owner link full-CRUD if ownership chatbot_id changes (rare)
create or replace function public.ensure_owner_entity_link_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chatbot_id is distinct from old.chatbot_id then
    insert into public.chatbot_entity_links (
      chatbot_id, entity_id, can_query, can_create, can_update, can_delete, added_by
    )
    values (new.chatbot_id, new.id, true, true, true, true, auth.uid())
    on conflict (chatbot_id, entity_id) do update set
      can_query = true,
      can_create = true,
      can_update = true,
      can_delete = true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_entity_owner_changed_link on public.chatbot_entities;
create trigger on_entity_owner_changed_link
after update of chatbot_id on public.chatbot_entities
for each row execute function public.ensure_owner_entity_link_on_update();

-- Backfill owner links for existing entities
insert into public.chatbot_entity_links (
  chatbot_id, entity_id, can_query, can_create, can_update, can_delete
)
select e.chatbot_id, e.id, true, true, true, true
from public.chatbot_entities e
on conflict (chatbot_id, entity_id) do nothing;

-- Helpers
create or replace function public.can_manage_entity(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chatbot_entities e
    where e.id = p_entity_id
      and e.deleted_at is null
      and public.has_instance_role(
        public.chatbot_instance_id(e.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
      and public.can_access_chatbot(e.chatbot_id)
  );
$$;

create or replace function public.can_see_entity_meta(p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chatbot_entities e
    where e.id = p_entity_id
      and e.deleted_at is null
      and public.is_instance_member(public.chatbot_instance_id(e.chatbot_id))
      and (
        public.can_manage_entity(e.id)
        or e.visibility = 'global'
        or (
          e.visibility = 'shared'
          and exists (
            select 1 from public.entity_shares s
            where s.entity_id = e.id and s.user_id = auth.uid()
          )
        )
        or exists (
          select 1
          from public.chatbot_entity_links l
          where l.entity_id = e.id
            and public.can_access_chatbot(l.chatbot_id)
        )
      )
  );
$$;

create or replace function public.entity_link_allows(
  p_entity_id uuid,
  p_chatbot_id uuid,
  p_op text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chatbot_entities e
    join public.chatbot_entity_links l
      on l.entity_id = e.id and l.chatbot_id = p_chatbot_id
    where e.id = p_entity_id
      and e.deleted_at is null
      and (
        (p_op = 'query' and l.can_query)
        or (p_op = 'create' and l.can_create)
        or (p_op = 'update' and l.can_update)
        or (p_op = 'delete' and l.can_delete)
      )
  );
$$;

-- Soft-delete / restore require can_manage_entity
create or replace function public.soft_delete_entity(p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity public.chatbot_entities;
  v_instance uuid;
begin
  select * into v_entity from public.chatbot_entities where id = p_entity_id and deleted_at is null;
  if v_entity.id is null then
    raise exception 'Entity not found';
  end if;
  if not public.can_manage_entity(p_entity_id) then
    raise exception 'Not allowed';
  end if;
  v_instance := public.chatbot_instance_id(v_entity.chatbot_id);
  update public.chatbot_entities set deleted_at = now(), updated_at = now() where id = p_entity_id;
  perform public.write_audit_event(v_instance, 'entity.soft_delete', 'entity', p_entity_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.restore_entity(p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity public.chatbot_entities;
  v_instance uuid;
begin
  select * into v_entity from public.chatbot_entities where id = p_entity_id and deleted_at is not null;
  if v_entity.id is null then
    raise exception 'Deleted entity not found';
  end if;
  v_instance := public.chatbot_instance_id(v_entity.chatbot_id);
  if not public.has_instance_role(v_instance, array['owner', 'admin', 'editor']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;
  if not public.can_access_chatbot(v_entity.chatbot_id) then
    raise exception 'Not allowed';
  end if;
  update public.chatbot_entities set deleted_at = null, updated_at = now() where id = p_entity_id;
  perform public.write_audit_event(v_instance, 'entity.restore', 'entity', p_entity_id::text, '{}'::jsonb);
end;
$$;

grant execute on function public.can_manage_entity(uuid) to authenticated;
grant execute on function public.can_see_entity_meta(uuid) to authenticated;
grant execute on function public.entity_link_allows(uuid, uuid, text) to authenticated;
grant execute on function public.soft_delete_entity(uuid) to authenticated;
grant execute on function public.restore_entity(uuid) to authenticated;

-- RLS: replace broad instance-member policies
alter table public.chatbot_entity_links enable row level security;
alter table public.entity_shares enable row level security;

drop policy if exists "entities_select_member" on public.chatbot_entities;
drop policy if exists "entities_write_editor" on public.chatbot_entities;
drop policy if exists "entity_attrs_select_member" on public.entity_attributes;
drop policy if exists "entity_attrs_write_editor" on public.entity_attributes;
drop policy if exists "entity_static_select_member" on public.entity_static_records;
drop policy if exists "entity_static_write_editor" on public.entity_static_records;
drop policy if exists "entity_dynamic_select_member" on public.entity_dynamic_records;
drop policy if exists "entity_dynamic_write_editor" on public.entity_dynamic_records;

create policy "entities_select_visible"
on public.chatbot_entities for select to authenticated
using (public.can_see_entity_meta(id) or (deleted_at is not null and public.can_access_chatbot(chatbot_id)));

create policy "entities_insert_editor"
on public.chatbot_entities for insert to authenticated
with check (
  public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
  and public.can_access_chatbot(chatbot_id)
);

create policy "entities_update_manager"
on public.chatbot_entities for update to authenticated
using (public.can_manage_entity(id) or (deleted_at is not null and public.can_access_chatbot(chatbot_id)))
with check (public.can_manage_entity(id) or public.can_access_chatbot(chatbot_id));

create policy "entities_delete_manager"
on public.chatbot_entities for delete to authenticated
using (public.can_manage_entity(id));

create policy "entity_attrs_select_visible"
on public.entity_attributes for select to authenticated
using (public.can_see_entity_meta(entity_id));

create policy "entity_attrs_write_manager"
on public.entity_attributes for all to authenticated
using (public.can_manage_entity(entity_id))
with check (public.can_manage_entity(entity_id));

-- Record SELECT: meta visibility
create policy "entity_static_select_visible"
on public.entity_static_records for select to authenticated
using (public.can_see_entity_meta(entity_id));

create policy "entity_dynamic_select_visible"
on public.entity_dynamic_records for select to authenticated
using (public.can_see_entity_meta(entity_id));

-- Record writes: editor+ with a matching CRUD flag on an accessible chatbot install
create policy "entity_static_write_linked"
on public.entity_static_records for all to authenticated
using (
  public.can_manage_entity(entity_id)
  or exists (
    select 1
    from public.chatbot_entity_links l
    where l.entity_id = entity_static_records.entity_id
      and public.can_access_chatbot(l.chatbot_id)
      and public.has_instance_role(
        public.chatbot_instance_id(l.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
      and (l.can_create or l.can_update or l.can_delete)
  )
)
with check (
  public.can_manage_entity(entity_id)
  or exists (
    select 1
    from public.chatbot_entity_links l
    where l.entity_id = entity_static_records.entity_id
      and public.can_access_chatbot(l.chatbot_id)
      and public.has_instance_role(
        public.chatbot_instance_id(l.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
      and (l.can_create or l.can_update or l.can_delete)
  )
);

create policy "entity_dynamic_insert_linked"
on public.entity_dynamic_records for insert to authenticated
with check (
  exists (
    select 1
    from public.chatbot_entity_links l
    where l.entity_id = entity_dynamic_records.entity_id
      and l.can_create
      and public.can_access_chatbot(l.chatbot_id)
      and public.has_instance_role(
        public.chatbot_instance_id(l.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
);

create policy "entity_dynamic_update_linked"
on public.entity_dynamic_records for update to authenticated
using (
  exists (
    select 1
    from public.chatbot_entity_links l
    where l.entity_id = entity_dynamic_records.entity_id
      and l.can_update
      and public.can_access_chatbot(l.chatbot_id)
      and public.has_instance_role(
        public.chatbot_instance_id(l.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
)
with check (
  exists (
    select 1
    from public.chatbot_entity_links l
    where l.entity_id = entity_dynamic_records.entity_id
      and l.can_update
      and public.can_access_chatbot(l.chatbot_id)
      and public.has_instance_role(
        public.chatbot_instance_id(l.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
);

create policy "entity_dynamic_delete_linked"
on public.entity_dynamic_records for delete to authenticated
using (
  exists (
    select 1
    from public.chatbot_entity_links l
    where l.entity_id = entity_dynamic_records.entity_id
      and l.can_delete
      and public.can_access_chatbot(l.chatbot_id)
      and public.has_instance_role(
        public.chatbot_instance_id(l.chatbot_id),
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
);

-- Link table RLS
create policy "entity_links_select"
on public.chatbot_entity_links for select to authenticated
using (
  public.can_see_entity_meta(entity_id)
  or public.can_access_chatbot(chatbot_id)
);

create policy "entity_links_insert"
on public.chatbot_entity_links for insert to authenticated
with check (
  public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
  and public.can_access_chatbot(chatbot_id)
  and (
    -- owner auto-link / manager installing elsewhere
    public.can_manage_entity(entity_id)
    or (
      -- installer may link if they can see the entity and visibility allows
      public.can_see_entity_meta(entity_id)
      and exists (
        select 1 from public.chatbot_entities e
        where e.id = entity_id
          and e.deleted_at is null
          and (
            e.chatbot_id = chatbot_entity_links.chatbot_id
            or e.visibility in ('global', 'shared')
          )
      )
    )
  )
);

create policy "entity_links_update"
on public.chatbot_entity_links for update to authenticated
using (
  public.can_manage_entity(entity_id)
  or (
    public.can_access_chatbot(chatbot_id)
    and public.has_instance_role(
      public.chatbot_instance_id(chatbot_id),
      array['owner', 'admin', 'editor']::public.instance_role[]
    )
  )
)
with check (
  public.can_manage_entity(entity_id)
  or (
    public.can_access_chatbot(chatbot_id)
    and public.has_instance_role(
      public.chatbot_instance_id(chatbot_id),
      array['owner', 'admin', 'editor']::public.instance_role[]
    )
  )
);

create policy "entity_links_delete"
on public.chatbot_entity_links for delete to authenticated
using (
  -- never remove the owning chatbot's link via this policy without manage
  (
    public.can_manage_entity(entity_id)
    and not exists (
      select 1 from public.chatbot_entities e
      where e.id = entity_id and e.chatbot_id = chatbot_entity_links.chatbot_id
    )
  )
  or (
    public.can_access_chatbot(chatbot_id)
    and public.has_instance_role(
      public.chatbot_instance_id(chatbot_id),
      array['owner', 'admin', 'editor']::public.instance_role[]
    )
    and not exists (
      select 1 from public.chatbot_entities e
      where e.id = entity_id and e.chatbot_id = chatbot_entity_links.chatbot_id
    )
  )
);

create policy "entity_shares_select"
on public.entity_shares for select to authenticated
using (
  user_id = auth.uid()
  or public.can_manage_entity(entity_id)
);

create policy "entity_shares_write"
on public.entity_shares for all to authenticated
using (public.can_manage_entity(entity_id))
with check (public.can_manage_entity(entity_id));

grant select, insert, update, delete on public.chatbot_entity_links to authenticated;
grant select, insert, update, delete on public.entity_shares to authenticated;

comment on column public.chatbot_entities.visibility is
  'private = owning chatbot + explicit installs; global = listed for instance install; shared = listed for entity_shares users';
comment on table public.chatbot_entity_links is
  'Installs an entity onto a chatbot with per-op CRUD flags. Owning chatbot is auto-linked with full CRUD.';
comment on table public.entity_shares is
  'When visibility=shared, these users may see the entity in the install catalog.';
