-- pgcrypto lives in the extensions schema on Supabase. Functions with
-- search_path = public alone cannot resolve gen_random_bytes at runtime.

create extension if not exists pgcrypto with schema extensions;

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
