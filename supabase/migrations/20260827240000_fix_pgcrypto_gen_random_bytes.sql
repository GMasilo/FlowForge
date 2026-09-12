-- pgcrypto lives in the extensions schema on Supabase. Bare gen_random_bytes/digest
-- calls fail when search_path is public-only (functions) or at insert time (defaults).

create extension if not exists pgcrypto with schema extensions;

alter table public.instance_webhooks
  alter column secret set default encode(extensions.gen_random_bytes(24), 'hex');

create or replace function public.create_scim_token(
  p_instance_id uuid,
  p_name text default 'default'
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
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  v_prefix := left(v_raw, 8);
  v_hash := encode(extensions.digest(v_raw, 'sha256'), 'hex');

  insert into public.instance_scim_tokens (instance_id, name, token_hash, token_prefix, created_by)
  values (p_instance_id, coalesce(nullif(trim(p_name), ''), 'default'), v_hash, v_prefix, auth.uid())
  returning id into v_id;

  perform public.write_audit_event(
    p_instance_id,
    'scim.token_rotated',
    'scim_token',
    v_id::text,
    jsonb_build_object('prefix', v_prefix)
  );

  return jsonb_build_object(
    'id', v_id,
    'token', v_raw,
    'prefix', v_prefix,
    'name', coalesce(nullif(trim(p_name), ''), 'default')
  );
end;
$$;

create or replace function public.verify_scim_token(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_hash text;
  v_instance uuid;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select instance_id into v_instance
  from public.instance_scim_tokens
  where token_hash = v_hash and revoked_at is null
  limit 1;

  if v_instance is not null then
    update public.instance_scim_tokens
    set last_used_at = now()
    where token_hash = v_hash and revoked_at is null;
  end if;

  return v_instance;
end;
$$;
