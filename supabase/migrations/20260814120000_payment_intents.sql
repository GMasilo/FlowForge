-- Payment connections + PayFast/custom notify verification.
-- Live DBs may store connections.kind as text (no enum). Only extend the enum when it exists.

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'connection_kind'
  ) and not exists (
    select 1
    from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'connection_kind'
      and e.enumlabel = 'payment'
  ) then
    execute 'alter type public.connection_kind add value ''payment''';
  end if;
end
$$;

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  instance_id uuid not null references public.instances (id) on delete cascade,
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  session_id uuid references public.conversation_sessions (id) on delete set null,
  connection_id uuid not null references public.connections (id) on delete cascade,
  node_key text not null default '',
  amount numeric(12, 2),
  currency text not null default 'ZAR',
  item_name text not null default 'Payment',
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'failed', 'cancelled')),
  provider text not null default 'payfast',
  provider_payment_id text,
  checkout_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists payment_intents_session_idx
  on public.payment_intents (session_id);

create index if not exists payment_intents_chatbot_idx
  on public.payment_intents (chatbot_id, created_at desc);

alter table public.payment_intents enable row level security;

drop policy if exists "payment_intents_select" on public.payment_intents;
create policy "payment_intents_select"
on public.payment_intents for select to authenticated
using (public.is_instance_member(instance_id));

create or replace function public.create_payment_intent(
  p_reference text,
  p_instance_id uuid,
  p_chatbot_id uuid,
  p_session_id uuid,
  p_connection_id uuid,
  p_node_key text,
  p_amount numeric,
  p_currency text,
  p_item_name text,
  p_provider text,
  p_checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_intents;
  v_bot public.chatbots;
begin
  if p_reference is null or length(trim(p_reference)) < 8 then
    raise exception 'invalid payment reference';
  end if;

  select * into v_bot from public.chatbots where id = p_chatbot_id and deleted_at is null;
  if v_bot.id is null or v_bot.instance_id <> p_instance_id then
    raise exception 'chatbot not found';
  end if;

  if p_session_id is not null then
    if not exists (
      select 1 from public.conversation_sessions s
      where s.id = p_session_id
        and s.chatbot_id = p_chatbot_id
        and s.status = 'active'
    ) then
      raise exception 'session not found';
    end if;
  end if;

  insert into public.payment_intents (
    reference, instance_id, chatbot_id, session_id, connection_id,
    node_key, amount, currency, item_name, provider, checkout_url
  ) values (
    trim(p_reference), p_instance_id, p_chatbot_id, p_session_id, p_connection_id,
    coalesce(p_node_key, ''), p_amount, coalesce(nullif(trim(p_currency), ''), 'ZAR'),
    coalesce(nullif(trim(p_item_name), ''), 'Payment'),
    coalesce(nullif(trim(p_provider), ''), 'payfast'),
    p_checkout_url
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_payment_intent(
  text, uuid, uuid, uuid, uuid, text, numeric, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_payment_intent(
  text, uuid, uuid, uuid, uuid, text, numeric, text, text, text, text
) to service_role;

create or replace function public.get_payment_intent(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.payment_intents;
begin
  select * into v_row from public.payment_intents where reference = trim(p_reference);
  if v_row.id is null then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.get_payment_intent(text) from public, anon, authenticated;
grant execute on function public.get_payment_intent(text) to service_role;

create or replace function public.update_payment_intent_status(
  p_reference text,
  p_status text,
  p_provider_payment_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_intents;
begin
  if p_status not in ('pending', 'verified', 'failed', 'cancelled') then
    raise exception 'invalid payment status';
  end if;

  update public.payment_intents
  set
    status = p_status,
    provider_payment_id = coalesce(nullif(trim(p_provider_payment_id), ''), provider_payment_id),
    payload = coalesce(p_payload, payload),
    updated_at = now(),
    verified_at = case when p_status = 'verified' then now() else verified_at end
  where reference = trim(p_reference)
  returning * into v_row;

  if v_row.id is null then
    return null;
  end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.update_payment_intent_status(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_payment_intent_status(text, text, text, jsonb) to service_role;

create or replace function public.connection_config_for_payment(
  p_connection_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_config jsonb;
begin
  select c.kind::text into v_kind
  from public.connections c
  where c.id = p_connection_id and c.deleted_at is null;

  if v_kind is null or v_kind <> 'payment' then
    return null;
  end if;

  select s.config into v_config
  from public.connection_secrets s
  where s.connection_id = p_connection_id;

  return coalesce(v_config, '{}'::jsonb);
end;
$$;

revoke all on function public.connection_config_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.connection_config_for_payment(uuid) to service_role;
