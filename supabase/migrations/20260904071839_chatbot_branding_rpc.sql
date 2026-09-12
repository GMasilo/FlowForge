-- Include per-chatbot branding (settings.branding) in public/staging session boots.
-- Org branding remains the fallback when chatbot branding fields are empty (merged client-side).

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
    end,
    'chatbot_branding', coalesce(v_bot.settings->'branding', '{}'::jsonb)
  );
end;
$$;

grant execute on function public.start_public_conversation_env(text, text, text)
  to anon, authenticated;

create or replace function public.start_staging_test_conversation(
  p_token uuid,
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
  v_graph jsonb;
  v_version integer;
  v_visitor text;
begin
  if p_token is null then
    raise exception 'Test token is required';
  end if;

  v_visitor := nullif(trim(coalesce(p_visitor_key, '')), '');

  select * into v_bot
  from public.chatbots
  where staging_test_token = p_token
    and deleted_at is null;

  if v_bot.id is null then
    raise exception 'Invalid test link';
  end if;

  if not public.instance_feature_enabled(v_bot.instance_id, 'staging') then
    raise exception 'Staging is not enabled for this organisation';
  end if;

  if not public.check_instance_quota(v_bot.instance_id, 'conversations') then
    raise exception 'Monthly conversation quota exceeded';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_flow.id is null or v_flow.staging_published_graph is null then
    raise exception 'Publish to staging from Design before using the test link';
  end if;

  v_graph := v_flow.staging_published_graph;
  v_version := v_flow.staging_version;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version,
    experiment_id, variant_key, environment, variables
  ) values (
    v_bot.id, v_bot.instance_id, 'active', v_visitor, v_version,
    null, null, 'staging',
    jsonb_build_object(
      '_environment', 'staging',
      '_staging_test', true,
      '_staging_test_token', p_token::text
    )
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
    'environment', 'staging',
    'branding', case
      when v_inst.id is null or not coalesce(v_inst.brand_apply_to_public_chat, true) then null
      else jsonb_build_object(
        'display_name', coalesce(v_inst.brand_display_name, v_inst.name),
        'accent_color', v_inst.brand_accent_color,
        'logo_url', v_inst.brand_logo_url
      )
    end,
    'chatbot_branding', coalesce(v_bot.settings->'branding', '{}'::jsonb)
  );
end;
$$;

create or replace function public.get_public_chatbot_appearance(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_bot public.chatbots;
  v_inst public.instances;
begin
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'Public slug is required';
  end if;

  select * into v_bot
  from public.chatbots
  where deleted_at is null
    and public_slug is not null
    and lower(public_slug) = lower(trim(p_slug))
    and coalesce(public_enabled, false);

  if v_bot.id is null then
    raise exception 'Chatbot not found or not public';
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  return jsonb_build_object(
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'name', v_bot.name,
    'branding', case
      when v_inst.id is null or not coalesce(v_inst.brand_apply_to_public_chat, true) then null
      else jsonb_build_object(
        'display_name', coalesce(v_inst.brand_display_name, v_inst.name),
        'accent_color', v_inst.brand_accent_color,
        'logo_url', v_inst.brand_logo_url
      )
    end,
    'chatbot_branding', coalesce(v_bot.settings->'branding', '{}'::jsonb)
  );
end;
$$;

grant execute on function public.get_public_chatbot_appearance(text) to anon, authenticated;
