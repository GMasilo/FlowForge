-- FlowForge app superusers + richer organisation (client) profile fields.
-- Keep this migration light on AccessExclusiveLocks: do not drop/recreate
-- select/update/delete policies. Updating is_instance_member / has_instance_role
-- is enough for superuser access through those policies.

-- Fail fast instead of hanging if another session holds a conflicting lock
set lock_timeout = '5s';
set deadlock_timeout = '1s';

-- ---------------------------------------------------------------------------
-- 1. Schema columns (AccessExclusiveLock briefly per table)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_superuser boolean not null default false;

alter table public.instances
  add column if not exists legal_name text,
  add column if not exists contact_email text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists billing_address text,
  add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- 2. Helper functions (no table DDL locks)
-- ---------------------------------------------------------------------------
create or replace function public.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_superuser from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_superuser() from public;
grant execute on function public.is_superuser() to authenticated;

create or replace function public.profiles_block_superuser_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow when there is no JWT (SQL editor / postgres / migrations).
  -- Block only authenticated non-superusers from self-escalating.
  if tg_op = 'UPDATE'
     and new.is_superuser is distinct from old.is_superuser
     and auth.uid() is not null
     and not public.is_superuser() then
    raise exception 'Only a FlowForge superuser can change is_superuser';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_superuser_escalation on public.profiles;
create trigger profiles_block_superuser_escalation
before update on public.profiles
for each row execute function public.profiles_block_superuser_escalation();

-- Superusers count as members / have all roles for existing RLS policies
create or replace function public.is_instance_member(p_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superuser()
    or exists (
      select 1
      from public.instance_members m
      where m.instance_id = p_instance_id
        and m.user_id = auth.uid()
    );
$$;

create or replace function public.has_instance_role(
  p_instance_id uuid,
  p_roles public.instance_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superuser()
    or exists (
      select 1
      from public.instance_members m
      where m.instance_id = p_instance_id
        and m.user_id = auth.uid()
        and m.role = any (p_roles)
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Only insert policy must change (authenticated → superuser)
-- ---------------------------------------------------------------------------
drop policy if exists "instances_insert_authenticated" on public.instances;
drop policy if exists "instances_insert_superuser" on public.instances;
create policy "instances_insert_superuser"
on public.instances for insert to authenticated
with check (public.is_superuser());

-- ---------------------------------------------------------------------------
-- 4. Organisation RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_organisation(
  p_name text,
  p_slug text,
  p_legal_name text default null,
  p_contact_email text default null,
  p_phone text default null,
  p_website text default null,
  p_billing_address text default null,
  p_notes text default null
)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instances;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_superuser() then
    raise exception 'Only FlowForge superusers can create organisations';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Organisation name is required';
  end if;
  if trim(coalesce(p_slug, '')) = '' then
    raise exception 'Slug is required';
  end if;

  insert into public.instances (
    name,
    slug,
    created_by,
    legal_name,
    contact_email,
    phone,
    website,
    billing_address,
    notes
  )
  values (
    trim(p_name),
    trim(p_slug),
    v_uid,
    nullif(trim(coalesce(p_legal_name, '')), ''),
    nullif(trim(coalesce(p_contact_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_billing_address, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_row;

  insert into public.instance_members (instance_id, user_id, role)
  values (v_row.id, v_uid, 'owner')
  on conflict do nothing;

  return v_row;
end;
$$;

grant execute on function public.create_organisation(
  text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.create_instance(p_name text, p_slug text)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_organisation(p_name, p_slug);
end;
$$;

grant execute on function public.create_instance(text, text) to authenticated;

create or replace function public.update_organisation(
  p_id uuid,
  p_name text,
  p_slug text,
  p_legal_name text default null,
  p_contact_email text default null,
  p_phone text default null,
  p_website text default null,
  p_billing_address text default null,
  p_notes text default null
)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instances;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.is_superuser()
    or public.has_instance_role(p_id, array['owner', 'admin']::public.instance_role[])
  ) then
    raise exception 'Not allowed to update this organisation';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Organisation name is required';
  end if;
  if trim(coalesce(p_slug, '')) = '' then
    raise exception 'Slug is required';
  end if;

  update public.instances
  set
    name = trim(p_name),
    slug = trim(p_slug),
    legal_name = nullif(trim(coalesce(p_legal_name, '')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email, '')), ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    website = nullif(trim(coalesce(p_website, '')), ''),
    billing_address = nullif(trim(coalesce(p_billing_address, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Organisation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.update_organisation(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;
