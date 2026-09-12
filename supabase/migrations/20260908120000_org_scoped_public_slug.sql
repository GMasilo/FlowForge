-- Scope chatbot public slugs per organisation (instance).
-- Public URLs: /o/{instance.slug}/c/{public_slug} and /o/{instance.slug}/embed/{public_slug}
-- Legacy /c/{slug} still works when the slug is unique across all orgs.

drop index if exists public.chatbots_public_slug_uidx;

create unique index if not exists chatbots_instance_public_slug_uidx
  on public.chatbots (instance_id, (lower(public_slug)))
  where public_slug is not null and deleted_at is null;

-- Shared resolver: optional org slug; legacy slug-only requires exactly one match.
create or replace function public.resolve_public_chatbot(
  p_slug text,
  p_org_slug text default null
)
returns public.chatbots
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_bot public.chatbots;
  v_org text := nullif(trim(coalesce(p_org_slug, '')), '');
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_count integer;
begin
  if v_slug = '' then
    raise exception 'Public slug is required';
  end if;

  if v_org is not null then
    select c.* into v_bot
    from public.chatbots c
    join public.instances i on i.id = c.instance_id
    where c.deleted_at is null
      and c.public_slug is not null
      and lower(c.public_slug) = v_slug
      and lower(i.slug) = lower(v_org)
    limit 1;
    return v_bot;
  end if;

  select count(*)::integer into v_count
  from public.chatbots c
  where c.deleted_at is null
    and c.public_slug is not null
    and lower(c.public_slug) = v_slug;

  if v_count > 1 then
    raise exception 'Ambiguous public slug; include organisation slug in the URL';
  end if;

  select c.* into v_bot
  from public.chatbots c
  where c.deleted_at is null
    and c.public_slug is not null
    and lower(c.public_slug) = v_slug
  limit 1;

  return v_bot;
end;
$$;

revoke all on function public.resolve_public_chatbot(text, text) from public;
grant execute on function public.resolve_public_chatbot(text, text) to anon, authenticated, service_role;

drop function if exists public.get_public_chatbot(text);
drop function if exists public.get_public_chatbot_appearance(text);
drop function if exists public.start_public_conversation_env(text, text, text);
drop function if exists public.start_public_conversation(text, text);
drop function if exists public.get_platform_settings();

create or replace function public.get_public_chatbot(
  p_slug text,
  p_org_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_bot public.chatbots;
  v_flow public.chatbot_flows;
  v_inst public.instances;
begin
  v_bot := public.resolve_public_chatbot(p_slug, p_org_slug);

  if v_bot.id is null or not coalesce(v_bot.public_enabled, false) then
    return null;
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_flow.published_graph is null then
    return null;
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  return jsonb_build_object(
    'id', v_bot.id,
    'name', v_bot.name,
    'description', v_bot.description,
    'instance_id', v_bot.instance_id,
    'instance_slug', v_inst.slug,
    'public_slug', v_bot.public_slug,
    'publish_version', v_flow.version,
    'published_at', v_flow.published_at,
    'published_graph', v_flow.published_graph
  );
end;
$$;

grant execute on function public.get_public_chatbot(text, text) to anon, authenticated;

create or replace function public.get_public_chatbot_appearance(
  p_slug text,
  p_org_slug text default null
)
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
  v_bot := public.resolve_public_chatbot(p_slug, p_org_slug);

  if v_bot.id is null or not coalesce(v_bot.public_enabled, false) then
    raise exception 'Chatbot not found or not public';
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  return jsonb_build_object(
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'instance_slug', v_inst.slug,
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

grant execute on function public.get_public_chatbot_appearance(text, text) to anon, authenticated, service_role;

create or replace function public.start_public_conversation_env(
  p_slug text,
  p_visitor_key text default null,
  p_environment text default 'production',
  p_org_slug text default null
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
  if v_env not in ('production', 'staging') then
    raise exception 'Invalid environment';
  end if;

  v_visitor := nullif(trim(coalesce(p_visitor_key, '')), '');
  v_bot := public.resolve_public_chatbot(p_slug, p_org_slug);

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
    'instance_slug', v_inst.slug,
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

grant execute on function public.start_public_conversation_env(text, text, text, text)
  to anon, authenticated;

create or replace function public.start_public_conversation(
  p_slug text,
  p_visitor_key text default null,
  p_org_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  return public.start_public_conversation_env(p_slug, p_visitor_key, 'production', p_org_slug);
end;
$$;

grant execute on function public.start_public_conversation(text, text, text) to anon, authenticated;

create or replace function public.get_platform_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'hero_tagline', s.hero_tagline,
    'hero_description', s.hero_description,
    'about_text', s.about_text,
    'contact_email', s.contact_email,
    'contact_phone', s.contact_phone,
    'contact_url', s.contact_url,
    'landing_public_slug', s.landing_public_slug,
    'landing_org_slug', i.slug
  )
  from public.platform_settings s
  left join public.instances i on i.id = s.landing_demo_instance_id
  where s.id = 'default';
$$;

revoke all on function public.get_platform_settings() from public;
grant execute on function public.get_platform_settings() to anon, authenticated;
