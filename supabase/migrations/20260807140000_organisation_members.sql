-- Organisation user details + pending email invites.

alter table public.instance_members
  add column if not exists display_name text,
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists department text,
  add column if not exists notes text;

create table if not exists public.instance_invites (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  email text not null,
  role public.instance_role not null default 'viewer',
  display_name text,
  job_title text,
  phone text,
  department text,
  notes text,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (instance_id, email)
);

create index if not exists instance_invites_email_idx
  on public.instance_invites (lower(email));

alter table public.instance_invites enable row level security;

drop policy if exists "invites_select_member" on public.instance_invites;
create policy "invites_select_member"
on public.instance_invites for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "invites_insert_admin" on public.instance_invites;
create policy "invites_insert_admin"
on public.instance_invites for insert to authenticated
with check (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

drop policy if exists "invites_update_admin" on public.instance_invites;
create policy "invites_update_admin"
on public.instance_invites for update to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
)
with check (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

drop policy if exists "invites_delete_admin" on public.instance_invites;
create policy "invites_delete_admin"
on public.instance_invites for delete to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

grant select, insert, update, delete on public.instance_invites to authenticated;

-- Claim any pending invites for a newly created profile
create or replace function public.claim_instance_invites_for_user(
  p_user_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.instance_invites;
begin
  if p_user_id is null or coalesce(trim(p_email), '') = '' then
    return;
  end if;

  for v_inv in
    select *
    from public.instance_invites
    where lower(email) = lower(trim(p_email))
  loop
    insert into public.instance_members (
      instance_id,
      user_id,
      role,
      display_name,
      job_title,
      phone,
      department,
      notes
    )
    values (
      v_inv.instance_id,
      p_user_id,
      v_inv.role,
      v_inv.display_name,
      v_inv.job_title,
      v_inv.phone,
      v_inv.department,
      v_inv.notes
    )
    on conflict (instance_id, user_id) do update set
      role = excluded.role,
      display_name = coalesce(excluded.display_name, public.instance_members.display_name),
      job_title = coalesce(excluded.job_title, public.instance_members.job_title),
      phone = coalesce(excluded.phone, public.instance_members.phone),
      department = coalesce(excluded.department, public.instance_members.department),
      notes = coalesce(excluded.notes, public.instance_members.notes);

    delete from public.instance_invites where id = v_inv.id;
  end loop;
end;
$$;

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

  perform public.claim_instance_invites_for_user(new.id, new.email);
  return new;
end;
$$;

-- Add (or invite) a user with org-specific details
create or replace function public.add_organisation_member(
  p_instance_id uuid,
  p_email text,
  p_role public.instance_role default 'editor',
  p_display_name text default null,
  p_job_title text default null,
  p_phone text default null,
  p_department text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
  v_role public.instance_role := coalesce(p_role, 'editor');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_instance_role(
    p_instance_id,
    array['owner', 'admin']::public.instance_role[]
  ) then
    raise exception 'Only owners and admins can add users';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if v_role = 'owner' then
    raise exception 'Cannot assign the owner role via invite';
  end if;

  select id into v_uid
  from public.profiles
  where lower(email) = v_email
  limit 1;

  if v_uid is not null then
    insert into public.instance_members (
      instance_id,
      user_id,
      role,
      display_name,
      job_title,
      phone,
      department,
      notes
    )
    values (
      p_instance_id,
      v_uid,
      v_role,
      nullif(trim(coalesce(p_display_name, '')), ''),
      nullif(trim(coalesce(p_job_title, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_department, '')), ''),
      nullif(trim(coalesce(p_notes, '')), '')
    )
    on conflict (instance_id, user_id) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      job_title = excluded.job_title,
      phone = excluded.phone,
      department = excluded.department,
      notes = excluded.notes;

    -- Keep profile display name in sync when empty
    update public.profiles
    set display_name = nullif(trim(coalesce(p_display_name, '')), '')
    where id = v_uid
      and coalesce(nullif(trim(display_name), ''), '') = ''
      and nullif(trim(coalesce(p_display_name, '')), '') is not null;

    return jsonb_build_object('status', 'added', 'user_id', v_uid, 'email', v_email);
  end if;

  insert into public.instance_invites (
    instance_id,
    email,
    role,
    display_name,
    job_title,
    phone,
    department,
    notes,
    invited_by
  )
  values (
    p_instance_id,
    v_email,
    v_role,
    nullif(trim(coalesce(p_display_name, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_department, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  on conflict (instance_id, email) do update set
    role = excluded.role,
    display_name = excluded.display_name,
    job_title = excluded.job_title,
    phone = excluded.phone,
    department = excluded.department,
    notes = excluded.notes,
    invited_by = excluded.invited_by;

  return jsonb_build_object('status', 'invited', 'email', v_email);
end;
$$;

grant execute on function public.add_organisation_member(
  uuid, text, public.instance_role, text, text, text, text, text
) to authenticated;

create or replace function public.update_organisation_member(
  p_instance_id uuid,
  p_user_id uuid,
  p_role public.instance_role default null,
  p_display_name text default null,
  p_job_title text default null,
  p_phone text default null,
  p_department text default null,
  p_notes text default null
)
returns public.instance_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instance_members;
  v_current public.instance_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_instance_role(
    p_instance_id,
    array['owner', 'admin']::public.instance_role[]
  ) then
    raise exception 'Only owners and admins can update users';
  end if;

  select * into v_current
  from public.instance_members
  where instance_id = p_instance_id and user_id = p_user_id;

  if v_current.user_id is null then
    raise exception 'User is not a member of this organisation';
  end if;
  if v_current.role = 'owner' then
    raise exception 'Cannot change the owner via this form';
  end if;
  if p_role = 'owner' then
    raise exception 'Cannot assign the owner role via this form';
  end if;

  update public.instance_members
  set
    role = coalesce(p_role, role),
    display_name = case
      when p_display_name is null then display_name
      else nullif(trim(p_display_name), '')
    end,
    job_title = case
      when p_job_title is null then job_title
      else nullif(trim(p_job_title), '')
    end,
    phone = case
      when p_phone is null then phone
      else nullif(trim(p_phone), '')
    end,
    department = case
      when p_department is null then department
      else nullif(trim(p_department), '')
    end,
    notes = case
      when p_notes is null then notes
      else nullif(trim(p_notes), '')
    end
  where instance_id = p_instance_id and user_id = p_user_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.update_organisation_member(
  uuid, uuid, public.instance_role, text, text, text, text, text
) to authenticated;
