-- Finish staging environments: proper publish RPC, session env column,
-- and staging-aware public start that does not require production to be live.

alter table public.conversation_sessions
  add column if not exists environment text not null default 'production'
    check (environment in ('production', 'staging'));

create index if not exists conversation_sessions_environment_idx
  on public.conversation_sessions (instance_id, environment, created_at desc);

comment on column public.conversation_sessions.environment is
  'Which published snapshot started this session: production or staging';

-- Drop old 1-arg staging publish (client used to pre-write graph separately).
drop function if exists public.publish_flow_staging(uuid);

create or replace function public.publish_flow_staging(
  p_flow_id uuid,
  p_published_graph jsonb,
  p_note text default null
)
returns public.chatbot_flows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow public.chatbot_flows;
  v_bot public.chatbots;
  v_next integer;
  v_now timestamptz := now();
begin
  if p_published_graph is null then
    raise exception 'Staging published graph is required';
  end if;

  select * into v_flow from public.chatbot_flows where id = p_flow_id;
  if v_flow.id is null then
    raise exception 'Flow not found';
  end if;

  select * into v_bot from public.chatbots where id = v_flow.chatbot_id and deleted_at is null;
  if v_bot.id is null then
    raise exception 'Chatbot not found';
  end if;

  if not public.has_instance_role(
    v_bot.instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  if not public.instance_feature_enabled(v_bot.instance_id, 'staging') then
    raise exception 'Staging is not enabled for this organisation';
  end if;

  v_next := coalesce(v_flow.staging_version, 0) + 1;

  update public.chatbot_flows
  set
    staging_published_graph = p_published_graph,
    staging_published_at = v_now,
    staging_version = v_next,
    updated_at = v_now
  where id = p_flow_id
  returning * into v_flow;

  update public.chatbots set updated_at = v_now where id = v_bot.id;

  perform public.write_audit_event(
    v_bot.instance_id,
    'staging.published',
    'chatbot_flow',
    p_flow_id::text,
    jsonb_build_object(
      'staging_version', v_next,
      'chatbot_id', v_bot.id,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  return v_flow;
end;
$$;

grant execute on function public.publish_flow_staging(uuid, jsonb, text) to authenticated;

-- Staging-aware public start. Staging does not require public_enabled so orgs can
-- test before going live; production still requires public_enabled.
create or replace function public.start_public_conversation_env(
  p_slug text,
  p_visitor_key text default null,
  p_environment text default 'production'
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
  v_env text := lower(coalesce(nullif(trim(p_environment), ''), 'production'));
  v_visitor text;
begin
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'Public slug is required';
  end if;

  if v_env not in ('production', 'staging') then
    raise exception 'Invalid environment';
  end if;

  v_visitor := nullif(trim(coalesce(p_visitor_key, '')), '');

  select * into v_bot
  from public.chatbots
  where deleted_at is null
    and public_slug is not null
    and lower(public_slug) = lower(trim(p_slug));

  if v_bot.id is null then
    raise exception 'Chatbot not found or not public';
  end if;

  if v_env = 'production' and not coalesce(v_bot.public_enabled, false) then
    raise exception 'Chatbot not found or not public';
  end if;

  if v_env = 'staging' and not public.instance_feature_enabled(v_bot.instance_id, 'staging') then
    raise exception 'Staging is not enabled for this organisation';
  end if;

  if not public.check_instance_quota(v_bot.instance_id, 'conversations') then
    raise exception 'Monthly conversation quota exceeded';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_flow.id is null then
    raise exception 'Chatbot is not published';
  end if;

  if v_env = 'staging' then
    if v_flow.staging_published_graph is null then
      raise exception 'Staging graph not published';
    end if;
    v_graph := v_flow.staging_published_graph;
    v_version := v_flow.staging_version;
  else
    if v_flow.published_graph is null then
      raise exception 'Chatbot is not published';
    end if;
    v_graph := v_flow.published_graph;
    v_version := v_flow.version;
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  -- Experiments only apply to production traffic.
  if v_env = 'production' then
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
  end if;

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version,
    experiment_id, variant_key, environment,
    variables
  ) values (
    v_bot.id, v_bot.instance_id, 'active', v_visitor, v_version,
    case when v_env = 'production' then v_exp.id else null end,
    case when v_env = 'production' then v_variant.variant_key else null end,
    v_env,
    jsonb_build_object('_environment', v_env)
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
    'environment', v_env,
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

grant execute on function public.start_public_conversation_env(text, text, text)
  to anon, authenticated;

-- Keep legacy 2-arg start as production wrapper.
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
begin
  return public.start_public_conversation_env(p_slug, p_visitor_key, 'production');
end;
$$;

grant execute on function public.start_public_conversation(text, text) to anon, authenticated;

-- Promote staging snapshot to production (creates a new production version).
create or replace function public.promote_staging_to_production(
  p_flow_id uuid,
  p_note text default null
)
returns public.flow_publish_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow public.chatbot_flows;
begin
  select * into v_flow from public.chatbot_flows where id = p_flow_id;
  if v_flow.id is null then
    raise exception 'Flow not found';
  end if;
  if v_flow.staging_published_graph is null then
    raise exception 'No staging graph to promote';
  end if;

  return public.publish_flow_version(
    p_flow_id,
    v_flow.staging_published_graph,
    coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Promoted from staging')
  );
end;
$$;

grant execute on function public.promote_staging_to_production(uuid, text) to authenticated;
