-- Allow SQL editor / postgres (no JWT) to set is_superuser; block client self-escalation.
create or replace function public.profiles_block_superuser_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_superuser is distinct from old.is_superuser
     and auth.uid() is not null
     and not public.is_superuser() then
    raise exception 'Only a FlowForge superuser can change is_superuser';
  end if;
  return new;
end;
$$;

update public.profiles
set is_superuser = true
where email = 'luckygontsemasilo@gmail.com';

select id, email, is_superuser
from public.profiles
where email = 'luckygontsemasilo@gmail.com';
