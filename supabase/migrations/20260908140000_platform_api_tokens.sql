-- Long-lived Platform API tokens for service accounts.
-- PHP /v1 verifies the bearer via verify_platform_api_token, then reads with service_role.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.instance_platform_api_tokens (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null default 'service',
  token_hash text not null,
  token_prefix text not null,
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint instance_platform_api_tokens_hash_unique unique (token_hash)
);

create index if not exists instance_platform_api_tokens_hash_idx
  on public.instance_platform_api_tokens (token_hash)
  where revoked_at is null;

create index if not exists instance_platform_api_tokens_instance_idx
  on public.instance_platform_api_tokens (instance_id)
  where revoked_at is null;

alter table public.instance_platform_api_tokens enable row level security;

drop policy if exists "platform_api_tokens_select_admin" on public.instance_platform_api_tokens;
create policy "platform_api_tokens_select_admin"
on public.instance_platform_api_tokens for select to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

drop policy if exists "platform_api_tokens_write_admin" on public.instance_platform_api_tokens;
create policy "platform_api_tokens_write_admin"
on public.instance_platform_api_tokens for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

create or replace function public.create_platform_api_token(
  p_instance_id uuid,
  p_name text default 'service',
  p_expires_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text;
  v_hash text;
  v_prefix text;
  v_id uuid;
  v_expires timestamptz;
  v_name text;
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), 'service');
  if p_expires_days is not null and p_expires_days > 0 then
    v_expires := now() + make_interval(days => least(p_expires_days, 3650));
  else
    v_expires := null;
  end if;

  v_raw := 'ffpat_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := left(v_raw, 14);
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  insert into public.instance_platform_api_tokens (
    instance_id, name, token_hash, token_prefix, expires_at, created_by
  )
  values (p_instance_id, v_name, v_hash, v_prefix, v_expires, auth.uid())
  returning id into v_id;

  perform public.write_audit_event(
    p_instance_id,
    'platform.api_token_created',
    'platform_api_token',
    v_id::text,
    jsonb_build_object('prefix', v_prefix, 'name', v_name)
  );

  return jsonb_build_object(
    'id', v_id,
    'token', v_raw,
    'prefix', v_prefix,
    'name', v_name,
    'expires_at', v_expires
  );
end;
$$;

grant execute on function public.create_platform_api_token(uuid, text, integer) to authenticated;
revoke all on function public.create_platform_api_token(uuid, text, integer) from public;
grant execute on function public.create_platform_api_token(uuid, text, integer) to authenticated;

create or replace function public.revoke_platform_api_token(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance uuid;
  v_prefix text;
begin
  select instance_id, token_prefix into v_instance, v_prefix
  from public.instance_platform_api_tokens
  where id = p_id
  limit 1;

  if v_instance is null then
    raise exception 'Not found';
  end if;
  if not public.has_instance_role(v_instance, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  update public.instance_platform_api_tokens
  set revoked_at = coalesce(revoked_at, now())
  where id = p_id and revoked_at is null;

  perform public.write_audit_event(
    v_instance,
    'platform.api_token_revoked',
    'platform_api_token',
    p_id::text,
    jsonb_build_object('prefix', v_prefix)
  );
end;
$$;

grant execute on function public.revoke_platform_api_token(uuid) to authenticated;
revoke all on function public.revoke_platform_api_token(uuid) from public;
grant execute on function public.revoke_platform_api_token(uuid) to authenticated;

create or replace function public.verify_platform_api_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_hash text;
  v_row public.instance_platform_api_tokens%rowtype;
  v_email text;
begin
  if p_token is null or length(p_token) < 20 or left(p_token, 6) <> 'ffpat_' then
    return null;
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_row
  from public.instance_platform_api_tokens
  where token_hash = v_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_row.id is null then
    return null;
  end if;

  update public.instance_platform_api_tokens
  set last_used_at = now()
  where id = v_row.id;

  select email into v_email
  from public.profiles
  where id = v_row.created_by
  limit 1;

  return jsonb_build_object(
    'id', v_row.id,
    'instance_id', v_row.instance_id,
    'user_id', v_row.created_by,
    'email', v_email
  );
end;
$$;

grant execute on function public.verify_platform_api_token(text) to service_role;
revoke all on function public.verify_platform_api_token(text) from public;
grant execute on function public.verify_platform_api_token(text) to service_role;
