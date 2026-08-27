-- Isolate transfer entry variables: do not merge prior session vars into the target.

create or replace function public.transfer_public_conversation(
  p_session_id uuid,
  p_target_chatbot_id uuid,
  p_start_node_key text default null,
  p_variables jsonb default '{}'::jsonb,
  p_from_node_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_session public.conversation_sessions;
  v_from public.chatbots;
  v_to public.chatbots;
  v_flow public.chatbot_flows;
  v_graph jsonb;
  v_version integer;
  v_env text;
  v_required jsonb;
  v_key text;
  v_start text;
  v_node jsonb;
  v_found boolean := false;
  v_vars jsonb;
begin
  if p_session_id is null then
    raise exception 'Session required';
  end if;
  if p_target_chatbot_id is null then
    raise exception 'Target chatbot required';
  end if;

  select * into v_session from public.conversation_sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.status not in ('active', 'escalated') then
    raise exception 'Session cannot be transferred';
  end if;
  if v_session.status = 'escalated' then
    raise exception 'Resolve handoff before transferring to another chatbot';
  end if;

  select * into v_from from public.chatbots where id = v_session.chatbot_id and deleted_at is null;
  if v_from.id is null then
    raise exception 'Source chatbot not found';
  end if;

  select * into v_to
  from public.chatbots
  where id = p_target_chatbot_id
    and deleted_at is null
    and instance_id = v_session.instance_id;
  if v_to.id is null then
    raise exception 'Target chatbot not found in this organisation';
  end if;
  if v_to.id = v_from.id then
    raise exception 'Cannot transfer to the same chatbot';
  end if;

  v_env := lower(coalesce(nullif(trim(v_session.environment), ''), 'production'));
  select * into v_flow from public.chatbot_flows where chatbot_id = v_to.id;
  if v_flow.id is null then
    raise exception 'Target chatbot has no flow';
  end if;

  if v_env = 'staging' then
    if v_flow.staging_published_graph is null then
      raise exception 'Target chatbot has no staging publish';
    end if;
    v_graph := v_flow.staging_published_graph;
    v_version := v_flow.staging_version;
  else
    if v_flow.published_graph is null then
      raise exception 'Target chatbot is not published';
    end if;
    v_graph := v_flow.published_graph;
    v_version := v_flow.version;
  end if;

  v_required := coalesce(v_to.settings->'transferEntry'->'requiredVariables', '[]'::jsonb);
  if jsonb_typeof(v_required) = 'array' then
    for v_key in
      select jsonb_array_elements_text(v_required)
    loop
      if coalesce(trim(v_key), '') = '' then
        continue;
      end if;
      if p_variables is null
         or not (p_variables ? v_key)
         or p_variables->v_key is null
         or (
           jsonb_typeof(p_variables->v_key) = 'string'
           and nullif(trim(p_variables->>v_key), '') is null
         ) then
        raise exception 'Missing required transfer variable: %', v_key;
      end if;
    end loop;
  end if;

  v_start := nullif(trim(coalesce(p_start_node_key, '')), '');
  if v_start is not null then
    for v_node in
      select * from jsonb_array_elements(coalesce(v_graph->'nodes', '[]'::jsonb))
    loop
      if lower(trim(coalesce(v_node->>'key', ''))) = lower(v_start) then
        v_found := true;
        v_start := trim(v_node->>'key');
        exit;
      end if;
    end loop;
    if not v_found then
      raise exception 'Start step "%" not found on target chatbot', v_start;
    end if;
  end if;

  -- Fresh variable bag for the target entry step (no merge with source session vars).
  v_vars := coalesce(p_variables, '{}'::jsonb)
    || jsonb_build_object(
      '_environment', v_env,
      '_transferred_from', v_from.id::text,
      '_transferred_from_name', v_from.name,
      '_transfer_entry', true
    );

  update public.conversation_sessions
  set
    chatbot_id = v_to.id,
    publish_version = v_version,
    variables = v_vars,
    updated_at = now()
  where id = p_session_id
  returning * into v_session;

  perform public.append_conversation_event(
    p_session_id,
    'session.transferred',
    p_from_node_key,
    jsonb_build_object(
      'from_chatbot_id', v_from.id,
      'to_chatbot_id', v_to.id,
      'start_node_key', v_start,
      'variables', coalesce(p_variables, '{}'::jsonb)
    )
  );

  return jsonb_build_object(
    'session_id', v_session.id,
    'chatbot_id', v_to.id,
    'instance_id', v_session.instance_id,
    'publish_version', v_session.publish_version,
    'published_graph', v_graph,
    'name', v_to.name,
    'environment', v_env,
    'start_node_key', v_start,
    'variables', v_session.variables,
    'required_variables', v_required,
    'from_chatbot_id', v_from.id,
    'from_chatbot_name', v_from.name
  );
end;
$$;

grant execute on function public.transfer_public_conversation(uuid, uuid, text, jsonb, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
