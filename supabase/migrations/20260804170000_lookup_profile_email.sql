-- Allow resolving a user id by email for invitations (returns id only).
create or replace function public.lookup_profile_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.lookup_profile_id_by_email(text) to authenticated;
