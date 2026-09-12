-- Scope integrations to chatbots (own + install links), mirroring connections/entities.

-- Owning chatbot (nullable briefly for backfill)
alter table public.integrations
  add column if not exists chatbot_id uuid references public.chatbots (id) on delete cascade;

create index if not exists integrations_chatbot_idx
  on public.integrations (chatbot_id)
  where deleted_at is null;

-- Install links: which chatbots may use an integration in flow steps
create table if not exists public.chatbot_integrations (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  integration_id uuid not null references public.integrations (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chatbot_id, integration_id)
);

create index if not exists chatbot_integrations_integration_idx
  on public.chatbot_integrations (integration_id);
create index if not exists chatbot_integrations_chatbot_idx
  on public.chatbot_integrations (chatbot_id);

alter table public.chatbot_integrations enable row level security;

-- Backfill owner: oldest chatbot in the same instance
update public.integrations i
set chatbot_id = (
  select c.id
  from public.chatbots c
  where c.instance_id = i.instance_id
    and c.deleted_at is null
  order by c.created_at asc nulls last, c.id asc
  limit 1
)
where i.chatbot_id is null
  and i.deleted_at is null;

-- Drop rows that still have no chatbot (orphaned instance with no bots)
delete from public.integrations
where chatbot_id is null;

alter table public.integrations
  alter column chatbot_id set not null;

-- Auto-link owning chatbot on create
create or replace function public.ensure_owner_integration_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chatbot_integrations (chatbot_id, integration_id, added_by)
  values (new.chatbot_id, new.id, auth.uid())
  on conflict (chatbot_id, integration_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_integration_created_link on public.integrations;
create trigger on_integration_created_link
after insert on public.integrations
for each row execute function public.ensure_owner_integration_link();

create or replace function public.ensure_owner_integration_link_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chatbot_id is distinct from old.chatbot_id then
    insert into public.chatbot_integrations (chatbot_id, integration_id, added_by)
    values (new.chatbot_id, new.id, auth.uid())
    on conflict (chatbot_id, integration_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_integration_owner_changed_link on public.integrations;
create trigger on_integration_owner_changed_link
after update of chatbot_id on public.integrations
for each row execute function public.ensure_owner_integration_link_on_update();

-- Owner links for existing rows
insert into public.chatbot_integrations (chatbot_id, integration_id)
select i.chatbot_id, i.id
from public.integrations i
where i.deleted_at is null
on conflict (chatbot_id, integration_id) do nothing;

-- Zero-breakage: install existing integrations on every chatbot in the instance
insert into public.chatbot_integrations (chatbot_id, integration_id)
select c.id, i.id
from public.integrations i
join public.chatbots c
  on c.instance_id = i.instance_id
 and c.deleted_at is null
where i.deleted_at is null
on conflict (chatbot_id, integration_id) do nothing;

-- Helper: chatbot may use this integration
create or replace function public.chatbot_has_integration(p_chatbot_id uuid, p_integration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chatbot_integrations ci
    join public.integrations i on i.id = ci.integration_id
    where ci.chatbot_id = p_chatbot_id
      and ci.integration_id = p_integration_id
      and i.deleted_at is null
  );
$$;

revoke all on function public.chatbot_has_integration(uuid, uuid) from public;
grant execute on function public.chatbot_has_integration(uuid, uuid) to authenticated, service_role;

-- RLS: chatbot_integrations
drop policy if exists "chatbot_integrations_select_member" on public.chatbot_integrations;
create policy "chatbot_integrations_select_member"
on public.chatbot_integrations for select to authenticated
using (
  public.is_instance_member(public.chatbot_instance_id(chatbot_id))
);

drop policy if exists "chatbot_integrations_write_editor" on public.chatbot_integrations;
create policy "chatbot_integrations_write_editor"
on public.chatbot_integrations for all to authenticated
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
  and exists (
    select 1
    from public.integrations i
    where i.id = integration_id
      and i.deleted_at is null
      and i.instance_id = public.chatbot_instance_id(chatbot_integrations.chatbot_id)
      and (
        i.chatbot_id = chatbot_integrations.chatbot_id
        or public.has_instance_role(
          i.instance_id,
          array['owner', 'admin', 'editor']::public.instance_role[]
        )
      )
  )
);

grant select, insert, update, delete on public.chatbot_integrations to authenticated;

-- Allow editors to create integrations owned by a chatbot they can edit
drop policy if exists "integrations_insert_admin" on public.integrations;
create policy "integrations_insert_editor"
on public.integrations for insert to authenticated
with check (
  public.has_instance_role(
    instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
  and chatbot_id is not null
  and public.chatbot_instance_id(chatbot_id) = instance_id
);

drop policy if exists "integrations_update_admin" on public.integrations;
create policy "integrations_update_editor"
on public.integrations for update to authenticated
using (
  public.has_instance_role(
    instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.has_instance_role(
    instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
  and public.chatbot_instance_id(chatbot_id) = instance_id
);

drop policy if exists "integrations_delete_admin" on public.integrations;
create policy "integrations_delete_editor"
on public.integrations for delete to authenticated
using (
  public.has_instance_role(
    instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

-- Secrets: owner/admin, or editor who can edit the owning chatbot's instance
drop policy if exists "integration_secrets_select_admin" on public.integration_secrets;
create policy "integration_secrets_select_editor"
on public.integration_secrets for select to authenticated
using (
  exists (
    select 1 from public.integrations i
    where i.id = integration_id
      and public.has_instance_role(
        i.instance_id,
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
);

drop policy if exists "integration_secrets_write_admin" on public.integration_secrets;
create policy "integration_secrets_write_editor"
on public.integration_secrets for all to authenticated
using (
  exists (
    select 1 from public.integrations i
    where i.id = integration_id
      and public.has_instance_role(
        i.instance_id,
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
)
with check (
  exists (
    select 1 from public.integrations i
    where i.id = integration_id
      and public.has_instance_role(
        i.instance_id,
        array['owner', 'admin', 'editor']::public.instance_role[]
      )
  )
);

comment on table public.chatbot_integrations is
  'Install links: which chatbots may use an organisation integration on flow steps.';
comment on column public.integrations.chatbot_id is
  'Owning chatbot for the integration definition (mirrors connections.chatbot_id).';
comment on function public.chatbot_has_integration(uuid, uuid) is
  'True when the chatbot has an install link to a non-deleted integration.';
