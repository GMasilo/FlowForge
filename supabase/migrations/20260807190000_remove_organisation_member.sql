-- Remove a non-owner organisation member (owners/admins / FlowForge superusers).

create or replace function public.remove_organisation_member(
  p_instance_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.instance_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_instance_role(
    p_instance_id,
    array['owner', 'admin']::public.instance_role[]
  ) then
    raise exception 'Only owners and admins can remove users';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot remove yourself from the organisation';
  end if;

  select * into v_current
  from public.instance_members
  where instance_id = p_instance_id and user_id = p_user_id;

  if v_current.user_id is null then
    raise exception 'User is not a member of this organisation';
  end if;
  if v_current.role = 'owner' then
    raise exception 'Cannot remove the organisation owner';
  end if;

  delete from public.instance_members
  where instance_id = p_instance_id and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_organisation_member(uuid, uuid) from public;
grant execute on function public.remove_organisation_member(uuid, uuid) to authenticated;
