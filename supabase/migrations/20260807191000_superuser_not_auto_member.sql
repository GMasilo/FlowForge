-- Platform superusers access orgs via is_superuser(), not membership.
-- Stop auto-adding them as owners on create, and remove those auto-memberships.

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

  -- Do not insert the creating superuser into instance_members.
  -- They already have full access via is_superuser() / has_instance_role().

  return v_row;
end;
$$;

-- Drop auto-created owner rows for platform superusers (access remains via is_superuser).
-- Keep any non-owner membership (explicit invite / add).
delete from public.instance_members m
using public.profiles p
where m.user_id = p.id
  and p.is_superuser = true
  and m.role = 'owner';
