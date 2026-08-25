-- Alert delivery channels, cooldowns, weekly digest settings, and delivery log.

alter table public.instance_alert_rules
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_slack boolean not null default false,
  add column if not exists slack_integration_id uuid references public.integrations (id) on delete set null,
  add column if not exists last_triggered_at timestamptz,
  add column if not exists last_notified_at timestamptz;

create table if not exists public.instance_alert_settings (
  instance_id uuid primary key references public.instances (id) on delete cascade,
  digest_enabled boolean not null default false,
  digest_weekday smallint not null default 1 check (digest_weekday >= 0 and digest_weekday <= 6),
  digest_slack_integration_id uuid references public.integrations (id) on delete set null,
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  rule_id uuid references public.instance_alert_rules (id) on delete set null,
  kind text not null check (kind in ('threshold', 'digest')),
  channel text not null check (channel in ('email', 'slack')),
  payload jsonb not null default '{}'::jsonb,
  ok boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists alert_deliveries_instance_created_idx
  on public.alert_deliveries (instance_id, created_at desc);

create index if not exists alert_deliveries_rule_idx
  on public.alert_deliveries (rule_id, created_at desc);

alter table public.instance_alert_settings enable row level security;
alter table public.alert_deliveries enable row level security;

drop policy if exists "alert_settings_select_member" on public.instance_alert_settings;
create policy "alert_settings_select_member"
on public.instance_alert_settings for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "alert_settings_write_admin" on public.instance_alert_settings;
create policy "alert_settings_write_admin"
on public.instance_alert_settings for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

drop policy if exists "alert_deliveries_select_member" on public.alert_deliveries;
create policy "alert_deliveries_select_member"
on public.alert_deliveries for select to authenticated
using (public.is_instance_member(instance_id));

-- Inserts are performed by the service-role cron; members only read.
grant select, insert, update, delete on public.instance_alert_settings to authenticated;
grant select on public.alert_deliveries to authenticated;
grant insert on public.alert_deliveries to service_role;
grant update on public.instance_alert_rules to service_role;
grant select on public.instance_alert_rules to service_role;
grant select, insert, update on public.instance_alert_settings to service_role;
