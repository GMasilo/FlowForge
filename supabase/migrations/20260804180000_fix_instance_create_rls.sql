-- Allow creators to read the instance they just inserted (RETURNING / .select()).
drop policy if exists "instances_select_member" on public.instances;
create policy "instances_select_member"
on public.instances for select to authenticated
using (
  public.is_instance_member(id)
  or created_by = auth.uid()
);

-- Atomic create: insert instance + owner membership under security definer.
create or replace function public.create_instance(p_name text, p_slug text)
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

  insert into public.instances (name, slug, created_by)
  values (p_name, p_slug, v_uid)
  returning * into v_row;

  insert into public.instance_members (instance_id, user_id, role)
  values (v_row.id, v_uid, 'owner')
  on conflict do nothing;

  return v_row;
end;
$$;

grant execute on function public.create_instance(text, text) to authenticated;
