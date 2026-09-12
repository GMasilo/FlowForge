-- Canonical limits per plan (mirror web/src/features/billing/planCatalog.ts).
create or replace function public.organisation_plan_limits(p_plan public.organisation_plan)
returns jsonb
language sql
immutable
as $$
  select case p_plan
    when 'starter' then jsonb_build_object(
      'quota_max_conversations_month', 1000,
      'quota_max_emails_month', 500,
      'quota_max_http_calls_month', 5000,
      'quota_max_chatbots', 2,
      'quota_max_seats', 3,
      'features', jsonb_build_object(
        'staging', false,
        'collaborative_editing', false,
        'marketplace', false,
        'agent_console', false,
        'experiments', false,
        'analytics_v2', false,
        'compliance', false,
        'sso', false,
        'webhooks', false,
        'integrations', false,
        'platform_api', false,
        'advanced_connections', false,
        'alerts', false
      )
    )
    when 'pro' then jsonb_build_object(
      'quota_max_conversations_month', 10000,
      'quota_max_emails_month', 5000,
      'quota_max_http_calls_month', 50000,
      'quota_max_chatbots', -1,
      'quota_max_seats', 10,
      'features', jsonb_build_object(
        'staging', true,
        'collaborative_editing', true,
        'marketplace', true,
        'agent_console', false,
        'experiments', false,
        'analytics_v2', false,
        'compliance', false,
        'sso', false,
        'webhooks', false,
        'integrations', false,
        'platform_api', false,
        'advanced_connections', true,
        'alerts', false
      )
    )
    when 'business' then jsonb_build_object(
      'quota_max_conversations_month', 50000,
      'quota_max_emails_month', 25000,
      'quota_max_http_calls_month', 250000,
      'quota_max_chatbots', -1,
      'quota_max_seats', 40,
      'features', jsonb_build_object(
        'staging', true,
        'collaborative_editing', true,
        'marketplace', true,
        'agent_console', true,
        'experiments', true,
        'analytics_v2', true,
        'compliance', true,
        'sso', false,
        'webhooks', true,
        'integrations', true,
        'platform_api', true,
        'advanced_connections', true,
        'alerts', true
      )
    )
    else jsonb_build_object(
      'quota_max_conversations_month', 200000,
      'quota_max_emails_month', 100000,
      'quota_max_http_calls_month', 1000000,
      'quota_max_chatbots', -1,
      'quota_max_seats', -1,
      'features', jsonb_build_object(
        'staging', true,
        'collaborative_editing', true,
        'marketplace', true,
        'agent_console', true,
        'experiments', true,
        'analytics_v2', true,
        'compliance', true,
        'sso', true,
        'webhooks', true,
        'integrations', true,
        'platform_api', true,
        'advanced_connections', true,
        'alerts', true
      )
    )
  end;
$$;

create or replace function public.apply_organisation_plan_limits(p_instance_id uuid)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst public.instances;
  v_limits jsonb;
  v_features jsonb;
begin
  select * into v_inst from public.instances where id = p_instance_id for update;
  if not found then
    raise exception 'Organisation not found';
  end if;

  v_limits := public.organisation_plan_limits(v_inst.plan);
  v_features := coalesce(v_limits -> 'features', '{}'::jsonb);

  update public.instances
  set
    features = v_features,
    quota_max_conversations_month = greatest(0, coalesce((v_limits ->> 'quota_max_conversations_month')::int, quota_max_conversations_month)),
    quota_max_emails_month = greatest(0, coalesce((v_limits ->> 'quota_max_emails_month')::int, quota_max_emails_month)),
    quota_max_http_calls_month = greatest(0, coalesce((v_limits ->> 'quota_max_http_calls_month')::int, quota_max_http_calls_month)),
    quota_max_chatbots = coalesce((v_limits ->> 'quota_max_chatbots')::int, quota_max_chatbots),
    quota_max_seats = coalesce((v_limits ->> 'quota_max_seats')::int, quota_max_seats),
    updated_at = now()
  where id = p_instance_id
  returning * into v_inst;

  return v_inst;
end;
$$;

revoke all on function public.apply_organisation_plan_limits(uuid) from public;
grant execute on function public.apply_organisation_plan_limits(uuid) to authenticated;

-- Superusers (or service) set plan; applies feature + quota catalog.
create or replace function public.set_organisation_plan(
  p_instance_id uuid,
  p_plan public.organisation_plan
)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst public.instances;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_superuser() then
    raise exception 'Only platform superusers can change organisation plans';
  end if;

  update public.instances
  set plan = p_plan, updated_at = now()
  where id = p_instance_id
  returning * into v_inst;

  if v_inst.id is null then
    raise exception 'Organisation not found';
  end if;

  v_inst := public.apply_organisation_plan_limits(p_instance_id);

  perform public.write_audit_event(
    p_instance_id,
    'instance.plan_updated',
    'instance',
    p_instance_id::text,
    jsonb_build_object('plan', p_plan::text)
  );

  return v_inst;
end;
$$;

revoke all on function public.set_organisation_plan(uuid, public.organisation_plan) from public;
grant execute on function public.set_organisation_plan(uuid, public.organisation_plan) to authenticated;

-- Admins may no longer freely unlock enterprise flags; merge is clamped to plan.
create or replace function public.update_instance_features(
  p_instance_id uuid,
  p_features jsonb
)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instances;
  v_allowed jsonb;
  v_next jsonb := '{}'::jsonb;
  v_key text;
  v_val boolean;
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[])
     and not public.is_superuser() then
    raise exception 'Not allowed';
  end if;

  select * into v_row from public.instances where id = p_instance_id for update;
  if v_row.id is null then
    raise exception 'Instance not found';
  end if;

  v_allowed := coalesce(public.organisation_plan_limits(v_row.plan) -> 'features', '{}'::jsonb);

  if p_features is not null and jsonb_typeof(p_features) = 'object' then
    for v_key, v_val in
      select key, (value = 'true'::jsonb)
      from jsonb_each(p_features)
    loop
      if coalesce((v_allowed ->> v_key)::boolean, false) then
        v_next := v_next || jsonb_build_object(v_key, v_val);
      end if;
    end loop;
  end if;

  -- Always keep plan-allowed features as the ceiling (enabled by default for the plan).
  update public.instances
  set
    features = v_allowed || v_next,
    updated_at = now()
  where id = p_instance_id
  returning * into v_row;

  perform public.write_audit_event(
    p_instance_id,
    'instance.features_updated',
    'instance',
    p_instance_id::text,
    jsonb_build_object('features', v_row.features)
  );

  return v_row;
end;
$$;

-- Seat helpers
create or replace function public.organisation_seat_count(p_instance_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    (select count(*)::int from public.instance_members m where m.instance_id = p_instance_id)
    + (select count(*)::int from public.instance_invites i where i.instance_id = p_instance_id)
  );
$$;

create or replace function public.organisation_chatbot_count(p_instance_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.chatbots c
  where c.instance_id = p_instance_id
    and c.deleted_at is null;
$$;

grant execute on function public.organisation_seat_count(uuid) to authenticated;
grant execute on function public.organisation_chatbot_count(uuid) to authenticated;

-- Enforce chatbot quota on insert
create or replace function public.enforce_chatbot_plan_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_count int;
begin
  select quota_max_chatbots into v_max from public.instances where id = new.instance_id;
  if coalesce(v_max, -1) < 0 then
    return new;
  end if;
  select public.organisation_chatbot_count(new.instance_id) into v_count;
  if v_count >= v_max then
    raise exception 'Chatbot limit reached for this organisation plan (% of %)', v_count, v_max
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists chatbots_enforce_plan_quota on public.chatbots;
create trigger chatbots_enforce_plan_quota
before insert on public.chatbots
for each row execute function public.enforce_chatbot_plan_quota();

-- Enforce seats + agent role in add_organisation_member
create or replace function public.add_organisation_member(
  p_instance_id uuid,
  p_email text,
  p_role public.instance_role default 'editor',
  p_display_name text default null,
  p_job_title text default null,
  p_phone text default null,
  p_department text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_uid uuid;
  v_role public.instance_role := coalesce(p_role, 'editor');
  v_invite public.instance_invites;
  v_max_seats int;
  v_seats int;
  v_already boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_instance_role(
    p_instance_id,
    array['owner', 'admin']::public.instance_role[]
  ) then
    raise exception 'Only owners and admins can add users';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if v_role = 'owner' then
    raise exception 'Cannot assign the owner role via invite';
  end if;
  if v_role = 'agent' and not public.instance_feature_enabled(p_instance_id, 'agent_console') then
    raise exception 'Agent seats require the Business or Enterprise plan';
  end if;

  select id into v_uid
  from public.profiles
  where lower(email) = v_email
  limit 1;

  if v_uid is not null then
    select exists (
      select 1 from public.instance_members
      where instance_id = p_instance_id and user_id = v_uid
    ) into v_already;
  else
    select exists (
      select 1 from public.instance_invites
      where instance_id = p_instance_id and lower(email) = v_email
    ) into v_already;
  end if;

  if not v_already then
    select quota_max_seats into v_max_seats from public.instances where id = p_instance_id;
    if coalesce(v_max_seats, -1) >= 0 then
      select public.organisation_seat_count(p_instance_id) into v_seats;
      if v_seats >= v_max_seats then
        raise exception 'Seat limit reached for this organisation plan (% of %)', v_seats, v_max_seats
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  if v_uid is not null then
    insert into public.instance_members (
      instance_id, user_id, role, display_name, job_title, phone, department, notes
    )
    values (
      p_instance_id, v_uid, v_role,
      nullif(trim(coalesce(p_display_name, '')), ''),
      nullif(trim(coalesce(p_job_title, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_department, '')), ''),
      nullif(trim(coalesce(p_notes, '')), '')
    )
    on conflict (instance_id, user_id) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      job_title = excluded.job_title,
      phone = excluded.phone,
      department = excluded.department,
      notes = excluded.notes;

    update public.profiles
    set display_name = nullif(trim(coalesce(p_display_name, '')), '')
    where id = v_uid
      and coalesce(nullif(trim(display_name), ''), '') = ''
      and nullif(trim(coalesce(p_display_name, '')), '') is not null;

    return jsonb_build_object('status', 'added', 'user_id', v_uid, 'email', v_email);
  end if;

  insert into public.instance_invites (
    instance_id, email, role, display_name, job_title, phone, department, notes, invited_by, token
  )
  values (
    p_instance_id, v_email, v_role,
    nullif(trim(coalesce(p_display_name, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_department, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid(),
    encode(extensions.gen_random_bytes(24), 'hex')
  )
  on conflict (instance_id, email) do update set
    role = excluded.role,
    display_name = excluded.display_name,
    job_title = excluded.job_title,
    phone = excluded.phone,
    department = excluded.department,
    notes = excluded.notes,
    invited_by = excluded.invited_by,
    token = coalesce(public.instance_invites.token, excluded.token)
  returning * into v_invite;

  return jsonb_build_object(
    'status', 'invited',
    'email', v_email,
    'invite_id', v_invite.id
  );
end;
$$;

-- New organisations inherit catalog limits for their plan (default starter).
create or replace function public.instances_apply_plan_on_insert()
returns trigger
language plpgsql
as $$
declare
  v_limits jsonb;
begin
  if new.plan is null then
    new.plan := 'starter';
  end if;
  v_limits := public.organisation_plan_limits(new.plan);
  new.features := coalesce(v_limits -> 'features', '{}'::jsonb);
  new.quota_max_conversations_month := greatest(0, coalesce((v_limits ->> 'quota_max_conversations_month')::int, 1000));
  new.quota_max_emails_month := greatest(0, coalesce((v_limits ->> 'quota_max_emails_month')::int, 500));
  new.quota_max_http_calls_month := greatest(0, coalesce((v_limits ->> 'quota_max_http_calls_month')::int, 5000));
  new.quota_max_chatbots := coalesce((v_limits ->> 'quota_max_chatbots')::int, 2);
  new.quota_max_seats := coalesce((v_limits ->> 'quota_max_seats')::int, 3);
  return new;
end;
$$;

drop trigger if exists instances_default_starter_plan on public.instances;
drop trigger if exists instances_apply_plan_on_insert on public.instances;
create trigger instances_apply_plan_on_insert
before insert on public.instances
for each row execute function public.instances_apply_plan_on_insert();

-- Existing organisations keep Business capacity (previous soft defaults).
update public.instances set plan = 'business';

do $$
declare
  r record;
begin
  for r in select id from public.instances loop
    perform public.apply_organisation_plan_limits(r.id);
  end loop;
end $$;
