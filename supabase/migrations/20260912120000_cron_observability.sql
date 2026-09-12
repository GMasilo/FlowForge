-- Cron observability: track last-run status for ops cron jobs (alerts, retention, etc.)
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (char_length(trim(job_name)) > 0),
  instance_id uuid references public.instances (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists cron_runs_job_name_idx
  on public.cron_runs (job_name, completed_at desc nulls first);

create index if not exists cron_runs_instance_idx
  on public.cron_runs (instance_id, completed_at desc nulls first)
  where instance_id is not null;

alter table public.cron_runs enable row level security;

-- Service role (cron endpoints) can insert and update their own runs
grant insert, update on public.cron_runs to service_role;

-- Admins can view cron runs for their instances
drop policy if exists "cron_runs_select_admin" on public.cron_runs;
create policy "cron_runs_select_admin"
on public.cron_runs for select to authenticated
using (
  instance_id is null  -- platform-wide crons visible to any authenticated user
  or public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);

grant select on public.cron_runs to authenticated;

-- Helper view: latest run per job per instance (or platform-wide)
create or replace view public.cron_runs_latest as
select distinct on (job_name, instance_id)
  id, job_name, instance_id, started_at, completed_at, status, summary, error, created_at
from public.cron_runs
where status in ('success', 'failed')
order by job_name, instance_id, completed_at desc nulls last;

grant select on public.cron_runs_latest to authenticated, service_role;
