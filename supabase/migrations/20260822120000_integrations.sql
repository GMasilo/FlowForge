-- Organisation-level third-party integrations (OneDrive, Google Drive, …)
-- for use from flow steps. Admin-managed; secrets only visible to owners/admins.

create type public.integration_provider as enum (
  'microsoft_onedrive',
  'google_drive',
  'dropbox',
  'box',
  'sharepoint',
  'slack',
  'microsoft_teams',
  'google_sheets',
  'notion',
  's3',
  'custom'
);

create type public.integration_status as enum (
  'disconnected',
  'connected',
  'error'
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  provider public.integration_provider not null,
  name text not null,
  status public.integration_status not null default 'disconnected',
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint integrations_name_not_blank check (char_length(trim(name)) > 0)
);

create index if not exists integrations_instance_idx
  on public.integrations (instance_id)
  where deleted_at is null;

create index if not exists integrations_provider_idx
  on public.integrations (instance_id, provider)
  where deleted_at is null;

-- Sensitive credentials (tokens, client secrets). Only admins may read/write.
create table if not exists public.integration_secrets (
  integration_id uuid primary key references public.integrations (id) on delete cascade,
  secrets jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.integrations enable row level security;
alter table public.integration_secrets enable row level security;

-- Members can list non-deleted integrations in their instance (metadata only).
create policy "integrations_select_member"
on public.integrations for select to authenticated
using (
  deleted_at is null
  and public.is_instance_member(instance_id)
);

create policy "integrations_insert_admin"
on public.integrations for insert to authenticated
with check (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

create policy "integrations_update_admin"
on public.integrations for update to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
)
with check (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

create policy "integrations_delete_admin"
on public.integrations for delete to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

create policy "integration_secrets_select_admin"
on public.integration_secrets for select to authenticated
using (
  exists (
    select 1 from public.integrations i
    where i.id = integration_id
      and public.has_instance_role(i.instance_id, array['owner', 'admin']::public.instance_role[])
  )
);

create policy "integration_secrets_write_admin"
on public.integration_secrets for all to authenticated
using (
  exists (
    select 1 from public.integrations i
    where i.id = integration_id
      and public.has_instance_role(i.instance_id, array['owner', 'admin']::public.instance_role[])
  )
)
with check (
  exists (
    select 1 from public.integrations i
    where i.id = integration_id
      and public.has_instance_role(i.instance_id, array['owner', 'admin']::public.instance_role[])
  )
);

grant select, insert, update, delete on public.integrations to authenticated;
grant select, insert, update, delete on public.integration_secrets to authenticated;

comment on table public.integrations is
  'Organisation-scoped third-party integrations (storage, chat, sheets) usable from flow steps.';
comment on table public.integration_secrets is
  'OAuth tokens and API secrets for integrations. Admin-only access via RLS.';
