-- Phase 2: A/B experiments + stronger analytics aggregates

-- ---------------------------------------------------------------------------
-- Experiments
-- ---------------------------------------------------------------------------
create table if not exists public.flow_experiments (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.chatbot_flows (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'running', 'paused', 'completed')),
  traffic_split jsonb not null default '{}'::jsonb,
  primary_metric text not null default 'completion'
    check (primary_metric in ('completion', 'drop_off', 'revenue')),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flow_experiments_flow_idx
  on public.flow_experiments (flow_id, status);

alter table public.flow_experiments enable row level security;

drop policy if exists "flow_experiments_select" on public.flow_experiments;
create policy "flow_experiments_select"
on public.flow_experiments for select to authenticated
using (public.is_instance_member(instance_id));

drop policy if exists "flow_experiments_write" on public.flow_experiments;
create policy "flow_experiments_write"
on public.flow_experiments for all to authenticated
using (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
)
with check (
  public.has_instance_role(instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
);

create table if not exists public.flow_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.flow_experiments (id) on delete cascade,
  variant_key text not null,
  label text not null,
  publish_version_id uuid references public.flow_publish_versions (id) on delete set null,
  published_graph jsonb,
  weight integer not null default 50 check (weight >= 0 and weight <= 100),
  is_control boolean not null default false,
  created_at timestamptz not null default now(),
  unique (experiment_id, variant_key)
);

alter table public.flow_experiment_variants enable row level security;

drop policy if exists "flow_experiment_variants_select" on public.flow_experiment_variants;
create policy "flow_experiment_variants_select"
on public.flow_experiment_variants for select to authenticated
using (
  exists (
    select 1 from public.flow_experiments e
    where e.id = experiment_id and public.is_instance_member(e.instance_id)
  )
);

drop policy if exists "flow_experiment_variants_write" on public.flow_experiment_variants;
create policy "flow_experiment_variants_write"
on public.flow_experiment_variants for all to authenticated
using (
  exists (
    select 1 from public.flow_experiments e
    where e.id = experiment_id
      and public.has_instance_role(e.instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  )
)
with check (
  exists (
    select 1 from public.flow_experiments e
    where e.id = experiment_id
      and public.has_instance_role(e.instance_id, array['owner', 'admin', 'editor']::public.instance_role[])
  )
);

alter table public.conversation_sessions
  add column if not exists experiment_id uuid references public.flow_experiments (id) on delete set null,
  add column if not exists variant_key text;

create index if not exists conversation_sessions_experiment_idx
  on public.conversation_sessions (experiment_id, variant_key);

-- Sticky variant assignment from visitor_key hash
create or replace function public.pick_experiment_variant(
  p_experiment_id uuid,
  p_visitor_key text
)
returns public.flow_experiment_variants
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exp public.flow_experiments;
  v_variants public.flow_experiment_variants[];
  v_total int := 0;
  v_bucket int;
  v_acc int := 0;
  v_pick public.flow_experiment_variants;
  v_hash int;
  r record;
begin
  select * into v_exp from public.flow_experiments where id = p_experiment_id;
  if v_exp.id is null or v_exp.status <> 'running' then
    return null;
  end if;

  for r in
    select * from public.flow_experiment_variants
    where experiment_id = p_experiment_id and weight > 0
    order by variant_key
  loop
    v_total := v_total + r.weight;
  end loop;

  if v_total <= 0 then
    return null;
  end if;

  v_hash := ('x' || left(md5(coalesce(nullif(trim(p_visitor_key), ''), gen_random_uuid()::text)), 8))::bit(32)::int;
  v_bucket := abs(v_hash) % v_total;

  for r in
    select * from public.flow_experiment_variants
    where experiment_id = p_experiment_id and weight > 0
    order by variant_key
  loop
    v_acc := v_acc + r.weight;
    if v_bucket < v_acc then
      v_pick := r;
      exit;
    end if;
  end loop;

  return v_pick;
end;
$$;

grant execute on function public.pick_experiment_variant(uuid, text) to anon, authenticated, service_role;

-- Update public conversation start to support experiments + env (env added in phase 3; keep signature extensible)
create or replace function public.start_public_conversation(
  p_slug text,
  p_visitor_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_bot public.chatbots;
  v_flow public.chatbot_flows;
  v_session public.conversation_sessions;
  v_inst public.instances;
  v_exp public.flow_experiments;
  v_variant public.flow_experiment_variants;
  v_graph jsonb;
  v_version integer;
  v_visitor text;
begin
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'Public slug is required';
  end if;

  v_visitor := nullif(trim(coalesce(p_visitor_key, '')), '');

  select * into v_bot
  from public.chatbots
  where public_enabled = true
    and deleted_at is null
    and lower(public_slug) = lower(trim(p_slug));

  if v_bot.id is null then
    raise exception 'Chatbot not found or not public';
  end if;

  if not public.check_instance_quota(v_bot.instance_id, 'conversations') then
    raise exception 'Monthly conversation quota exceeded';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_flow.id is null or v_flow.published_graph is null then
    raise exception 'Chatbot is not published';
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  v_graph := v_flow.published_graph;
  v_version := v_flow.version;

  select * into v_exp
  from public.flow_experiments
  where flow_id = v_flow.id and status = 'running'
  order by started_at desc nulls last
  limit 1;

  if v_exp.id is not null then
    v_variant := public.pick_experiment_variant(v_exp.id, coalesce(v_visitor, gen_random_uuid()::text));
    if v_variant.id is not null then
      if v_variant.published_graph is not null then
        v_graph := v_variant.published_graph;
      elsif v_variant.publish_version_id is not null then
        select published_graph, version into v_graph, v_version
        from public.flow_publish_versions
        where id = v_variant.publish_version_id;
      end if;
    end if;
  end if;

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version,
    experiment_id, variant_key
  ) values (
    v_bot.id, v_bot.instance_id, 'active', v_visitor, v_version,
    v_exp.id, v_variant.variant_key
  )
  returning * into v_session;

  perform public.increment_instance_usage(v_bot.instance_id, 1, 0, 0);

  return jsonb_build_object(
    'session_id', v_session.id,
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'publish_version', v_session.publish_version,
    'published_graph', v_graph,
    'name', v_bot.name,
    'experiment_id', v_session.experiment_id,
    'variant_key', v_session.variant_key,
    'branding', case
      when v_inst.id is null or not coalesce(v_inst.brand_apply_to_public_chat, true) then null
      else jsonb_build_object(
        'display_name', coalesce(v_inst.brand_display_name, v_inst.name),
        'accent_color', v_inst.brand_accent_color,
        'logo_url', v_inst.brand_logo_url
      )
    end
  );
end;
$$;

grant execute on function public.start_public_conversation(text, text) to anon, authenticated;

create or replace function public.set_experiment_status(
  p_experiment_id uuid,
  p_status text
)
returns public.flow_experiments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.flow_experiments;
begin
  select * into v_row from public.flow_experiments where id = p_experiment_id;
  if v_row.id is null then
    raise exception 'Experiment not found';
  end if;
  if not public.has_instance_role(
    v_row.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;
  if p_status not in ('draft', 'running', 'paused', 'completed') then
    raise exception 'Invalid status';
  end if;

  -- Only one running experiment per flow
  if p_status = 'running' then
    update public.flow_experiments
    set status = 'paused', updated_at = now()
    where flow_id = v_row.flow_id and status = 'running' and id <> p_experiment_id;
  end if;

  update public.flow_experiments
  set
    status = p_status,
    started_at = case when p_status = 'running' then coalesce(started_at, now()) else started_at end,
    ended_at = case when p_status = 'completed' then now() else ended_at end,
    updated_at = now()
  where id = p_experiment_id
  returning * into v_row;

  perform public.write_audit_event(
    v_row.instance_id,
    case p_status
      when 'running' then 'experiment.started'
      when 'paused' then 'experiment.paused'
      else 'experiment.updated'
    end,
    'flow_experiment',
    p_experiment_id::text,
    jsonb_build_object('status', p_status)
  );

  return v_row;
end;
$$;

grant execute on function public.set_experiment_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Analytics views (security_invoker where supported; RLS via underlying tables)
-- ---------------------------------------------------------------------------
create or replace view public.analytics_step_funnel_daily
with (security_invoker = true)
as
select
  s.instance_id,
  s.chatbot_id,
  s.publish_version,
  s.experiment_id,
  s.variant_key,
  e.node_key,
  (e.created_at at time zone 'utc')::date as day,
  count(distinct s.id) as sessions_reached
from public.conversation_sessions s
join public.conversation_events e on e.session_id = s.id
where e.kind = 'step.run' and e.node_key is not null
group by 1, 2, 3, 4, 5, 6, 7;

create or replace view public.analytics_cohort_weekly
with (security_invoker = true)
as
select
  s.instance_id,
  s.chatbot_id,
  date_trunc('week', s.created_at)::date as cohort_week,
  count(*) as sessions_started,
  count(*) filter (where s.status = 'completed') as sessions_completed,
  count(*) filter (where s.status = 'abandoned' or (s.status = 'active' and s.updated_at < now() - interval '1 day')) as sessions_abandoned
from public.conversation_sessions s
group by 1, 2, 3;

create or replace view public.analytics_revenue_daily
with (security_invoker = true)
as
select
  p.instance_id,
  p.chatbot_id,
  p.node_key,
  s.publish_version,
  s.experiment_id,
  s.variant_key,
  (p.updated_at at time zone 'utc')::date as day,
  count(*) filter (where p.status = 'verified') as payments_verified,
  coalesce(sum(p.amount) filter (where p.status = 'verified'), 0) as revenue_amount,
  max(p.currency) as currency
from public.payment_intents p
left join public.conversation_sessions s on s.id = p.session_id
group by 1, 2, 3, 4, 5, 6, 7;

create or replace function public.get_experiment_stats(p_experiment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exp public.flow_experiments;
  v_result jsonb;
begin
  select * into v_exp from public.flow_experiments where id = p_experiment_id;
  if v_exp.id is null then
    raise exception 'Experiment not found';
  end if;
  if not public.is_instance_member(v_exp.instance_id) then
    raise exception 'Not allowed';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) into v_result
  from (
    select
      s.variant_key,
      count(*)::int as sessions,
      count(*) filter (where s.status = 'completed')::int as completed,
      count(*) filter (where s.status in ('failed', 'abandoned'))::int as dropped,
      coalesce((
        select sum(p.amount)
        from public.payment_intents p
        join public.conversation_sessions s2 on s2.id = p.session_id
        where s2.experiment_id = p_experiment_id
          and s2.variant_key is not distinct from s.variant_key
          and p.status = 'verified'
      ), 0) as revenue
    from public.conversation_sessions s
    where s.experiment_id = p_experiment_id
    group by s.variant_key
  ) t;

  return jsonb_build_object('experiment_id', p_experiment_id, 'variants', v_result);
end;
$$;

grant execute on function public.get_experiment_stats(uuid) to authenticated;
