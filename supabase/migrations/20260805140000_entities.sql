-- OutSystems-like entities: definitions, attributes, static catalog rows, dynamic user rows.
-- Also add Entity CRUD flow step type.

alter type public.flow_node_type add value if not exists 'entity';

do $$ begin
  create type public.entity_kind as enum ('static', 'dynamic');
exception when duplicate_object then null;
end $$;

create table if not exists public.chatbot_entities (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  kind public.entity_kind not null default 'dynamic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chatbot_id, key),
  constraint chatbot_entities_key_format check (key ~ '^[A-Za-z][A-Za-z0-9_]*$')
);

create index if not exists chatbot_entities_chatbot_idx on public.chatbot_entities (chatbot_id);

create table if not exists public.entity_attributes (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.chatbot_entities (id) on delete cascade,
  key text not null,
  label text,
  value_type public.variable_type not null default 'string',
  required boolean not null default false,
  is_identifier boolean not null default false,
  default_value jsonb,
  sort_order int not null default 0,
  unique (entity_id, key),
  constraint entity_attributes_key_format check (key ~ '^[A-Za-z][A-Za-z0-9_]*$')
);

create index if not exists entity_attributes_entity_idx on public.entity_attributes (entity_id);

-- Design-time catalog rows (Static entities)
create table if not exists public.entity_static_records (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.chatbot_entities (id) on delete cascade,
  sort_order int not null default 0,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entity_static_records_entity_idx on public.entity_static_records (entity_id);

-- Runtime / user data rows (Dynamic entities)
create table if not exists public.entity_dynamic_records (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.chatbot_entities (id) on delete cascade,
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entity_dynamic_records_entity_idx on public.entity_dynamic_records (entity_id);

create trigger chatbot_entities_updated_at
before update on public.chatbot_entities
for each row execute function public.set_updated_at();

create trigger entity_dynamic_records_updated_at
before update on public.entity_dynamic_records
for each row execute function public.set_updated_at();

-- RLS
alter table public.chatbot_entities enable row level security;
alter table public.entity_attributes enable row level security;
alter table public.entity_static_records enable row level security;
alter table public.entity_dynamic_records enable row level security;

create policy "entities_select_member"
on public.chatbot_entities for select to authenticated
using (public.is_instance_member(public.chatbot_instance_id(chatbot_id)));

create policy "entities_write_editor"
on public.chatbot_entities for all to authenticated
using (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]))
with check (public.has_instance_role(public.chatbot_instance_id(chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[]));

create policy "entity_attrs_select_member"
on public.entity_attributes for select to authenticated
using (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.is_instance_member(public.chatbot_instance_id(e.chatbot_id))
  )
);

create policy "entity_attrs_write_editor"
on public.entity_attributes for all to authenticated
using (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.has_instance_role(public.chatbot_instance_id(e.chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[])
  )
)
with check (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.has_instance_role(public.chatbot_instance_id(e.chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[])
  )
);

create policy "entity_static_select_member"
on public.entity_static_records for select to authenticated
using (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.is_instance_member(public.chatbot_instance_id(e.chatbot_id))
  )
);

create policy "entity_static_write_editor"
on public.entity_static_records for all to authenticated
using (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.has_instance_role(public.chatbot_instance_id(e.chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[])
  )
)
with check (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.has_instance_role(public.chatbot_instance_id(e.chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[])
  )
);

create policy "entity_dynamic_select_member"
on public.entity_dynamic_records for select to authenticated
using (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.is_instance_member(public.chatbot_instance_id(e.chatbot_id))
  )
);

create policy "entity_dynamic_write_editor"
on public.entity_dynamic_records for all to authenticated
using (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.has_instance_role(public.chatbot_instance_id(e.chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[])
  )
)
with check (
  exists (
    select 1 from public.chatbot_entities e
    where e.id = entity_id
      and public.has_instance_role(public.chatbot_instance_id(e.chatbot_id), array['owner', 'admin', 'editor']::public.instance_role[])
  )
);

grant select, insert, update, delete on public.chatbot_entities to authenticated;
grant select, insert, update, delete on public.entity_attributes to authenticated;
grant select, insert, update, delete on public.entity_static_records to authenticated;
grant select, insert, update, delete on public.entity_dynamic_records to authenticated;
