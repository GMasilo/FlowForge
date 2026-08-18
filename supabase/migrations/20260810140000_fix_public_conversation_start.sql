-- Harden public conversation start: bypass RLS explicitly and ensure grants.
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
begin
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'Public slug is required';
  end if;

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

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version
  ) values (
    v_bot.id, v_bot.instance_id, 'active', nullif(trim(coalesce(p_visitor_key, '')), ''), v_flow.version
  )
  returning * into v_session;

  perform public.increment_instance_usage(v_bot.instance_id, 1, 0, 0);

  return jsonb_build_object(
    'session_id', v_session.id,
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'publish_version', v_session.publish_version,
    'published_graph', v_flow.published_graph,
    'name', v_bot.name
  );
end;
$$;

grant execute on function public.start_public_conversation(text, text) to anon, authenticated;

-- Ensure usage increment can be invoked by the definer path reliably
grant execute on function public.increment_instance_usage(uuid, integer, integer, integer) to postgres;
grant execute on function public.check_instance_quota(uuid, text) to anon, authenticated, service_role;
