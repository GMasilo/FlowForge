-- Simple per-organisation alert rules (evaluated in the admin UI against recent sessions / quotas).
create table if not exists public.instance_alert_rules (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances (id) on delete cascade,
  name text not null,
  metric text not null check (metric in (
    'abandon_rate',
    'failed_sessions',
    'completion_rate_below',
    'quota_conversations_pct'
  )),
  threshold numeric not null default 50,
  window_hours int not null default 24 check (window_hours > 0 and window_hours <= 720),
  enabled boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instance_alert_rules_name_not_blank check (char_length(trim(name)) > 0)
);

create index if not exists instance_alert_rules_instance_idx
  on public.instance_alert_rules (instance_id);

alter table public.instance_alert_rules enable row level security;

create policy "alert_rules_select_member"
on public.instance_alert_rules for select to authenticated
using (public.is_instance_member(instance_id));

create policy "alert_rules_write_admin"
on public.instance_alert_rules for all to authenticated
using (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]))
with check (public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[]));

grant select, insert, update, delete on public.instance_alert_rules to authenticated;
