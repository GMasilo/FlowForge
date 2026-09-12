-- Tag staging test sessions with the link token used to start them (for live monitor filtering).

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
    end
  );
end;
$$;
