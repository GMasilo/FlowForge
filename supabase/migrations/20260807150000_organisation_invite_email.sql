-- Invite tokens + RPCs for email invites and public signup lookup.

alter table public.instance_invites
  add column if not exists token text;

update public.instance_invites
set token = encode(extensions.gen_random_bytes(24), 'hex')
where token is null or token = '';

alter table public.instance_invites
  alter column token set not null;

create unique index if not exists instance_invites_token_uidx
  on public.instance_invites (token);

-- Ensure new invites always get a token
create or replace function public.instance_invites_set_token()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.token is null or trim(new.token) = '' then
    new.token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists instance_invites_set_token on public.instance_invites;
create trigger instance_invites_set_token
before insert or update on public.instance_invites
for each row execute function public.instance_invites_set_token();

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
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
  v_role public.instance_role := coalesce(p_role, 'editor');
  v_invite public.instance_invites;
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
    invited_by,
    token
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
    auth.uid(),
    encode(extensions.gen_random_bytes(24), 'hex')
  )
  on conflict (instance_id, email) do update set
    role = excluded.role,
    display_name = excluded.display_name,
    job_title = excluded.job_title,
    phone = excluded.phone,
    department = excluded.department,
    notes = excluded.notes,
    invited_by = excluded.invited_by,
    token = coalesce(public.instance_invites.token, excluded.token)
  returning * into v_invite;

  return jsonb_build_object(
    'status', 'invited',
    'email', v_email,
    'invite_id', v_invite.id
  );
end;
$$;

-- For admins sending invite email via API
create or replace function public.get_invite_for_sending(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.instance_invites;
  v_org_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_inv
  from public.instance_invites
  where id = p_invite_id;

  if v_inv.id is null then
    raise exception 'Invite not found';
  end if;

  if not public.has_instance_role(
    v_inv.instance_id,
    array['owner', 'admin']::public.instance_role[]
  ) then
    raise exception 'Not allowed to send this invite';
  end if;

  select name into v_org_name
  from public.instances
  where id = v_inv.instance_id;

  return jsonb_build_object(
    'invite_id', v_inv.id,
    'email', v_inv.email,
    'token', v_inv.token,
    'display_name', v_inv.display_name,
    'role', v_inv.role,
    'organisation_name', v_org_name
  );
end;
$$;

grant execute on function public.get_invite_for_sending(uuid) to authenticated;

-- Public signup page lookup (token only; no auth)
create or replace function public.lookup_organisation_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := lower(trim(coalesce(p_token, '')));
  v_inv public.instance_invites;
  v_org_name text;
begin
  if v_token = '' then
    return null;
  end if;

  select * into v_inv
  from public.instance_invites
  where token = v_token
  limit 1;

  if v_inv.id is null then
    return null;
  end if;

  select name into v_org_name
  from public.instances
  where id = v_inv.instance_id;

  return jsonb_build_object(
    'email', v_inv.email,
    'display_name', v_inv.display_name,
    'organisation_name', v_org_name,
    'role', v_inv.role
  );
end;
$$;

revoke all on function public.lookup_organisation_invite(text) from public;
grant execute on function public.lookup_organisation_invite(text) to anon, authenticated;
