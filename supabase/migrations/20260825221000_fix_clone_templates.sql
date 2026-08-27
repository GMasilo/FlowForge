-- Clone must copy chatbot_templates.name (NOT NULL) and related fields.

create or replace function public.clone_chatbot_to_instance(
  p_source_chatbot_id uuid,
  p_target_instance_id uuid,
  p_new_name text default null,
  p_include_published boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.chatbots;
  v_src_instance uuid;
  v_super boolean;
  v_new public.chatbots;
  v_flow public.chatbot_flows;
  v_new_flow public.chatbot_flows;
  v_node record;
  v_edge record;
  v_id_map jsonb := '{}'::jsonb;
  v_new_node_id uuid;
  v_tmpl record;
  v_start uuid;
  v_end uuid;
begin
  select * into v_src from public.chatbots where id = p_source_chatbot_id and deleted_at is null;
  if v_src.id is null then
    raise exception 'Source chatbot not found';
  end if;
  v_src_instance := v_src.instance_id;

  select is_superuser into v_super from public.profiles where id = auth.uid();

  if not coalesce(v_super, false) then
    if not public.is_instance_member(v_src_instance) then
      raise exception 'Not a member of source organisation';
    end if;
    if not public.has_instance_role(
      p_target_instance_id,
      array['owner', 'admin', 'editor']::public.instance_role[]
    ) then
      raise exception 'Not allowed on target organisation';
    end if;
  end if;

  insert into public.chatbots (
    instance_id, name, description, settings, created_by, environment
  ) values (
    p_target_instance_id,
    coalesce(nullif(trim(p_new_name), ''), v_src.name || ' (clone)'),
    v_src.description,
    coalesce(v_src.settings, '{}'::jsonb),
    auth.uid(),
    'production'
  )
  returning * into v_new;

  select * into v_new_flow from public.chatbot_flows where chatbot_id = v_new.id;
  if v_new_flow.id is null then
    raise exception 'Clone target flow missing after chatbot create';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_src.id;

  delete from public.flow_edges where flow_id = v_new_flow.id;
  delete from public.flow_nodes where flow_id = v_new_flow.id;

  if v_flow.id is not null then
    update public.chatbot_flows
    set
      name = coalesce(v_flow.name, name),
      version = 1,
      published_graph = case when p_include_published then v_flow.published_graph else null end,
      published_at = case when p_include_published then v_flow.published_at else null end,
      has_draft_changes = true,
      updated_at = now()
    where id = v_new_flow.id
    returning * into v_new_flow;

    for v_node in
      select * from public.flow_nodes where flow_id = v_flow.id
    loop
      v_new_node_id := gen_random_uuid();
      v_id_map := v_id_map || jsonb_build_object(v_node.id::text, v_new_node_id::text);
      insert into public.flow_nodes (
        id, flow_id, key, type, label, config, position_x, position_y
      ) values (
        v_new_node_id, v_new_flow.id, v_node.key, v_node.type, v_node.label,
        (v_node.config - 'connectionId' - 'connection_id'),
        v_node.position_x, v_node.position_y
      );
    end loop;

    for v_edge in
      select * from public.flow_edges where flow_id = v_flow.id
    loop
      insert into public.flow_edges (
        flow_id, source_node_id, target_node_id, source_handle, label
      ) values (
        v_new_flow.id,
        (v_id_map ->> v_edge.source_node_id::text)::uuid,
        (v_id_map ->> v_edge.target_node_id::text)::uuid,
        v_edge.source_handle,
        v_edge.label
      );
    end loop;
  else
    insert into public.flow_nodes (flow_id, key, type, label, config, position_x, position_y)
    values (
      v_new_flow.id,
      'welcome',
      'message',
      'Welcome',
      jsonb_build_object('text', 'Hello! How can I help you today?'),
      0,
      0
    )
    returning id into v_start;

    insert into public.flow_nodes (flow_id, key, type, label, config, position_x, position_y)
    values (
      v_new_flow.id,
      'end',
      'end',
      'End',
      '{}'::jsonb,
      0,
      160
    )
    returning id into v_end;

    insert into public.flow_edges (flow_id, source_node_id, target_node_id)
    values (v_new_flow.id, v_start, v_end);
  end if;

  insert into public.chatbot_variables (
    chatbot_id, key, value_type, default_value, scope, source_node_key, description
  )
  select
    v_new.id, key, value_type, default_value, scope, source_node_key, description
  from public.chatbot_variables
  where chatbot_id = v_src.id;

  for v_tmpl in
    select * from public.chatbot_templates
    where chatbot_id = v_src.id and deleted_at is null
  loop
    insert into public.chatbot_templates (
      chatbot_id, key, name, description, kind, content, created_by
    ) values (
      v_new.id,
      v_tmpl.key,
      coalesce(nullif(trim(v_tmpl.name), ''), v_tmpl.key),
      v_tmpl.description,
      v_tmpl.kind,
      coalesce(v_tmpl.content, '{}'::jsonb),
      auth.uid()
    );
  end loop;

  insert into public.chatbot_entities (chatbot_id, key, name, kind, environment)
  select v_new.id, key, name, kind, 'production'
  from public.chatbot_entities
  where chatbot_id = v_src.id
    and deleted_at is null;

  perform public.write_audit_event(
    p_target_instance_id,
    'chatbot.cloned',
    'chatbot',
    v_new.id::text,
    jsonb_build_object(
      'source_chatbot_id', p_source_chatbot_id,
      'source_instance_id', v_src_instance
    )
  );

  return jsonb_build_object(
    'chatbot_id', v_new.id,
    'flow_id', v_new_flow.id,
    'name', v_new.name,
    'connections_need_rebind', true
  );
end;
$$;
