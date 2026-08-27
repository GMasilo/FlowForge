-- Unified organisation users list: Active members + Pending invites/never-signed-in members.

create or replace function public.list_organisation_users(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.is_instance_member(p_instance_id)
    or public.is_superuser()
  ) then
    raise exception 'Not allowed';
  end if;

  select coalesce(jsonb_agg(row_data order by sort_name, created_at), '[]'::jsonb)
  into v_rows
  from (
    select
      jsonb_build_object(
        'kind', 'member',
        'status', case
          when u.last_sign_in_at is null then 'pending'
          else 'active'
        end,
        'id', m.user_id,
        'user_id', m.user_id,
        'invite_id', null,
        'email', p.email,
        'display_name', coalesce(nullif(trim(m.display_name), ''), nullif(trim(p.display_name), ''), p.email),
        'role', m.role,
        'job_title', m.job_title,
        'phone', m.phone,
        'department', m.department,
        'notes', m.notes,
        'is_superuser', coalesce(p.is_superuser, false),
        'email_sent_at', null,
        'email_last_error', null,
        'token', null,
        'last_sign_in_at', u.last_sign_in_at,
        'created_at', m.created_at
      ) as row_data,
      lower(coalesce(nullif(trim(m.display_name), ''), nullif(trim(p.display_name), ''), p.email, '')) as sort_name,
      m.created_at
    from public.instance_members m
    join public.profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.instance_id = p_instance_id
      and not (coalesce(p.is_superuser, false) and m.role = 'owner')

    union all

    select
      jsonb_build_object(
        'kind', 'invite',
        'status', 'pending',
        'id', i.id,
        'user_id', null,
        'invite_id', i.id,
        'email', i.email,
        'display_name', coalesce(nullif(trim(i.display_name), ''), i.email),
        'role', i.role,
        'job_title', i.job_title,
        'phone', i.phone,
        'department', i.department,
        'notes', i.notes,
        'is_superuser', false,
        'email_sent_at', i.email_sent_at,
        'email_last_error', i.email_last_error,
        'token', i.token,
        'last_sign_in_at', null,
        'created_at', i.created_at
      ) as row_data,
      lower(coalesce(nullif(trim(i.display_name), ''), i.email, '')) as sort_name,
      i.created_at
    from public.instance_invites i
    where i.instance_id = p_instance_id
      and public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[])
  ) q;

  return v_rows;
end;
$$;

revoke all on function public.list_organisation_users(uuid) from public;
grant execute on function public.list_organisation_users(uuid) to authenticated;
