-- Fix Users page membership listing + invite claiming.

-- 0) Ensure every member row has a matching profile before retargeting the FK
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(coalesce(u.email, 'user'), '@', 1))
from auth.users u
where exists (
  select 1 from public.instance_members m where m.user_id = u.id
)
and not exists (
  select 1 from public.profiles p where p.id = u.id
)
on conflict (id) do nothing;

-- 1) PostgREST needs a FK from instance_members → profiles to embed profiles(...)
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'instance_members_user_id_fkey'
      and conrelid = 'public.instance_members'::regclass
  ) then
    alter table public.instance_members
      drop constraint instance_members_user_id_fkey;
  end if;
end $$;

alter table public.instance_members
  add constraint instance_members_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- 2) Superusers (and same-org members) can read profiles shown on Users page
drop policy if exists "profiles_select_own_or_same_instance" on public.profiles;
create policy "profiles_select_own_or_same_instance"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_superuser()
  or exists (
    select 1
    from public.instance_members mine
    join public.instance_members theirs
      on theirs.instance_id = mine.instance_id
    where mine.user_id = auth.uid()
      and theirs.user_id = profiles.id
  )
);

-- 3) Profile creation must be idempotent and always claim pending invites
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
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(
      nullif(trim(public.profiles.display_name), ''),
      excluded.display_name
    );

  perform public.claim_instance_invites_for_user(new.id, new.email);
  return new;
end;
$$;

-- 4) Let signed-in users claim any invites matching their email (covers login after invite)
create or replace function public.claim_my_organisation_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_before integer;
  v_after integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.email into v_email
  from public.profiles p
  where p.id = v_uid;

  if coalesce(trim(v_email), '') = '' then
    select u.email into v_email
    from auth.users u
    where u.id = v_uid;
  end if;

  if coalesce(trim(v_email), '') = '' then
    return 0;
  end if;

  select count(*)::integer into v_before
  from public.instance_invites
  where lower(email) = lower(trim(v_email));

  perform public.claim_instance_invites_for_user(v_uid, v_email);

  select count(*)::integer into v_after
  from public.instance_invites
  where lower(email) = lower(trim(v_email));

  return greatest(v_before - v_after, 0);
end;
$$;

revoke all on function public.claim_my_organisation_invites() from public;
grant execute on function public.claim_my_organisation_invites() to authenticated;

-- 5) Backfill: convert any pending invites for emails that already have accounts
do $$
declare
  r record;
begin
  for r in
    select p.id, p.email
    from public.profiles p
    where coalesce(trim(p.email), '') <> ''
      and exists (
        select 1
        from public.instance_invites i
        where lower(i.email) = lower(trim(p.email))
      )
  loop
    perform public.claim_instance_invites_for_user(r.id, r.email);
  end loop;
end $$;
