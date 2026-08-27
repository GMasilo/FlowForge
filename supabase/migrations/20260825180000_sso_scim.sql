create extension if not exists "pgcrypto";

-- Phase 4: SSO (OIDC + SAML) configs + SCIM tokens / JIT membership helpers

create table if not exists public.instance_sso_configs (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  protocol text not null check (protocol in ('oidc', 'saml')),
  name text not null,
  domains text[] not null default '{}',
  enforce_sso boolean not null default false,
  enabled boolean not null default false,
  -- OIDC
  oidc_issuer text,
  oidc_client_id text,
  oidc_client_secret_ref text,
  oidc_jwks_url text,
  oidc_authorization_url text,
  oidc_token_url text,
  -- SAML
  saml_entity_id text,
  saml_sso_url text,
  saml_certificate text,
  saml_acs_url text,
  attribute_map jsonb not null default '{"email":"email","name":"name","groups":"groups"}'::jsonb,
  group_role_map jsonb not null default '{"editors":"editor","viewers":"viewer","admins":"admin"}'::jsonb,
  default_role public.instance_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, protocol, name)
);

create index if not exists instance_sso_domains_idx
  on public.instance_sso_configs using gin (domains);

alter table public.instance_sso_configs enable row level security;

drop policy if exists "sso_configs_select_admin" on public.instance_sso_configs;
create policy "sso_configs_select_admin"
on public.instance_sso_configs for select to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

drop policy if exists "sso_configs_write_admin" on public.instance_sso_configs;
create policy "sso_configs_write_admin"
on public.instance_sso_configs for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

-- Lookup SSO config by email domain (anon-safe for login redirect)
create or replace function public.lookup_sso_for_email(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_domain text;
  v_cfg public.instance_sso_configs;
  v_inst public.instances;
begin
  if p_email is null or position('@' in p_email) = 0 then
    return null;
  end if;
  v_domain := lower(split_part(trim(p_email), '@', 2));

  select c.* into v_cfg
  from public.instance_sso_configs c
  where c.enabled = true
    and v_domain = any (select lower(unnest(c.domains)))
  order by c.enforce_sso desc, c.updated_at desc
  limit 1;

  if v_cfg.id is null then
    return null;
  end if;

  select * into v_inst from public.instances where id = v_cfg.instance_id;

  return jsonb_build_object(
    'instance_id', v_cfg.instance_id,
    'instance_slug', v_inst.slug,
    'protocol', v_cfg.protocol,
    'config_id', v_cfg.id,
    'name', v_cfg.name,
    'enforce_sso', v_cfg.enforce_sso,
    'oidc_issuer', v_cfg.oidc_issuer,
    'oidc_client_id', v_cfg.oidc_client_id,
    'oidc_authorization_url', v_cfg.oidc_authorization_url,
    'saml_sso_url', v_cfg.saml_sso_url,
    'saml_entity_id', v_cfg.saml_entity_id
  );
end;
$$;

grant execute on function public.lookup_sso_for_email(text) to anon, authenticated;

-- JIT provision member after SSO login (called from trusted backend / trigger path)
create or replace function public.jit_provision_sso_member(
  p_instance_id uuid,
  p_user_id uuid,
  p_groups text[] default '{}',
  p_sso_config_id uuid default null
)
returns public.instance_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.instance_sso_configs;
  v_role public.instance_role := 'viewer';
  v_g text;
  v_mapped text;
  v_row public.instance_members;
begin
  if p_sso_config_id is not null then
    select * into v_cfg from public.instance_sso_configs where id = p_sso_config_id;
  else
    select * into v_cfg from public.instance_sso_configs
    where instance_id = p_instance_id and enabled
    order by updated_at desc limit 1;
  end if;

  if v_cfg.id is not null then
    v_role := v_cfg.default_role;
    if p_groups is not null then
      foreach v_g in array p_groups loop
        v_mapped := v_cfg.group_role_map ->> v_g;
        if v_mapped in ('owner', 'admin', 'editor', 'viewer') then
          -- never auto-grant owner via SSO groups unless explicitly mapped; allow admin max by default
          if v_mapped = 'owner' then
            v_mapped := 'admin';
          end if;
          v_role := v_mapped::public.instance_role;
        end if;
      end loop;
    end if;
  end if;

  insert into public.instance_members (instance_id, user_id, role)
  values (p_instance_id, p_user_id, v_role)
  on conflict (instance_id, user_id) do update
  set role = excluded.role
  where public.instance_members.role is distinct from excluded.role
    and public.instance_members.role <> 'owner'
  returning * into v_row;

  if v_row.user_id is null then
    select * into v_row from public.instance_members
    where instance_id = p_instance_id and user_id = p_user_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.jit_provision_sso_member(uuid, uuid, text[], uuid) to service_role;

-- SCIM bearer tokens (store hash only)
create table if not exists public.instance_scim_tokens (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null default 'default',
  token_hash text not null,
  token_prefix text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists instance_scim_tokens_hash_idx
  on public.instance_scim_tokens (token_hash)
  where revoked_at is null;

alter table public.instance_scim_tokens enable row level security;

drop policy if exists "scim_tokens_select_admin" on public.instance_scim_tokens;
create policy "scim_tokens_select_admin"
on public.instance_scim_tokens for select to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

drop policy if exists "scim_tokens_write_admin" on public.instance_scim_tokens;
create policy "scim_tokens_write_admin"
on public.instance_scim_tokens for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

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

  v_raw := encode(gen_random_bytes(32), 'hex');
  v_prefix := left(v_raw, 8);
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');

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

grant execute on function public.create_scim_token(uuid, text) to authenticated;

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
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
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

grant execute on function public.verify_scim_token(text) to service_role;

alter table public.instance_members
  add column if not exists disabled_at timestamptz;

-- Soft-disable membership for SCIM deprovision (column may already exist from alter above)
create or replace function public.scim_upsert_member(
  p_instance_id uuid,
  p_user_id uuid,
  p_role public.instance_role default 'viewer',
  p_active boolean default true
)
returns public.instance_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instance_members;
  v_role public.instance_role := p_role;
begin
  if v_role = 'owner' then
    v_role := 'admin';
  end if;

  insert into public.instance_members (instance_id, user_id, role, disabled_at)
  values (
    p_instance_id,
    p_user_id,
    v_role,
    case when p_active then null else now() end
  )
  on conflict (instance_id, user_id) do update
  set
    role = case when public.instance_members.role = 'owner' then 'owner' else excluded.role end,
    disabled_at = excluded.disabled_at
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.scim_upsert_member(uuid, uuid, public.instance_role, boolean)
  to service_role;

create or replace function public.save_sso_config_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_event_trusted(
    new.instance_id,
    auth.uid(),
    'sso.configured',
    'instance_sso_config',
    new.id::text,
    jsonb_build_object('protocol', new.protocol, 'enabled', new.enabled)
  );
  return new;
end;
$$;

drop trigger if exists trg_sso_config_audit on public.instance_sso_configs;
create trigger trg_sso_config_audit
after insert or update on public.instance_sso_configs
for each row execute function public.save_sso_config_audit();
