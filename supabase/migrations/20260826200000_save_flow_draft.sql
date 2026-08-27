-- Transactional draft save with optimistic concurrency (merge-safe client write).

create or replace function public.save_flow_draft(
  p_flow_id uuid,
  p_nodes jsonb,
  p_edges jsonb,
  p_step_vars jsonb default '[]'::jsonb,
  p_expected_updated_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow public.chatbot_flows;
  v_instance uuid;
  v_chatbot uuid;
  v_now timestamptz := now();
  v_node jsonb;
  v_edge jsonb;
  v_var jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_flow from public.chatbot_flows where id = p_flow_id;
  if v_flow.id is null then
    raise exception 'Flow not found';
  end if;

  v_chatbot := v_flow.chatbot_id;
  v_instance := public.chatbot_instance_id(v_chatbot);
  if v_instance is null then
    raise exception 'Flow not found';
  end if;
  if not public.can_access_chatbot(v_chatbot) then
    raise exception 'Not allowed';
  end if;
  if not public.has_instance_role(
    v_instance,
    array['owner', 'admin', 'editor']::public.instance_role[]
  ) then
    raise exception 'Not allowed';
  end if;

  if p_expected_updated_at is not null
     and v_flow.updated_at is distinct from p_expected_updated_at then
    raise exception 'conflict'
      using errcode = 'P0001',
            hint = 'Flow was updated by another editor; retry merge';
  end if;

  if p_nodes is null or jsonb_typeof(p_nodes) <> 'array' then
    raise exception 'nodes required';
  end if;
  if p_edges is null or jsonb_typeof(p_edges) <> 'array' then
    raise exception 'edges required';
  end if;

  delete from public.flow_edges where flow_id = p_flow_id;
  delete from public.flow_nodes where flow_id = p_flow_id;

  for v_node in select * from jsonb_array_elements(p_nodes)
  loop
    insert into public.flow_nodes (
      id, flow_id, key, type, label, config, position_x, position_y
    )
    values (
      coalesce((v_node->>'id')::uuid, gen_random_uuid()),
      p_flow_id,
      trim(v_node->>'key'),
      trim(v_node->>'type')::public.flow_node_type,
      coalesce(nullif(trim(v_node->>'label'), ''), trim(v_node->>'key')),
      coalesce(v_node->'config', '{}'::jsonb),
      coalesce((v_node->>'position_x')::double precision, 0),
      coalesce((v_node->>'position_y')::double precision, 0)
    );
  end loop;

  for v_edge in select * from jsonb_array_elements(p_edges)
  loop
    insert into public.flow_edges (
      id, flow_id, source_node_id, target_node_id, source_handle, label
    )
    values (
      coalesce((v_edge->>'id')::uuid, gen_random_uuid()),
      p_flow_id,
      (v_edge->>'source_node_id')::uuid,
      (v_edge->>'target_node_id')::uuid,
      nullif(trim(coalesce(v_edge->>'source_handle', '')), ''),
      nullif(trim(coalesce(v_edge->>'label', '')), '')
    );
  end loop;

  delete from public.chatbot_variables
  where chatbot_id = v_chatbot and scope = 'step';

  if p_step_vars is not null and jsonb_typeof(p_step_vars) = 'array' then
    for v_var in select * from jsonb_array_elements(p_step_vars)
    loop
      insert into public.chatbot_variables (
        chatbot_id, key, value_type, scope, source_node_key
      )
      values (
        v_chatbot,
        trim(v_var->>'key'),
        coalesce(nullif(trim(v_var->>'value_type'), ''), 'string')::public.variable_type,
        'step',
        nullif(trim(coalesce(v_var->>'source_node_key', '')), '')
      );
    end loop;
  end if;

  update public.chatbot_flows
  set updated_at = v_now, has_draft_changes = true
  where id = p_flow_id;

  update public.chatbots
  set updated_at = v_now
  where id = v_chatbot;

  return v_now;
end;
$$;

revoke all on function public.save_flow_draft(uuid, jsonb, jsonb, jsonb, timestamptz) from public;
grant execute on function public.save_flow_draft(uuid, jsonb, jsonb, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
