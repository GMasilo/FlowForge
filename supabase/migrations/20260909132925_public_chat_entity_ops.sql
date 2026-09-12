-- Allow public (anon) chat sessions to run entity steps via a security-definer RPC.
-- Direct table RLS is authenticated-only; anon callers were getting PostgREST
-- "Cannot coerce the result to a single JSON object" on insert...select.single().

create or replace function public.public_chat_entity_op(
  p_session_id uuid,
  p_chatbot_id uuid,
  p_entity_id uuid,
  p_operation text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.conversation_sessions;
  v_entity public.chatbot_entities;
  v_op text := lower(trim(coalesce(p_operation, '')));
  v_link_op text;
  v_values jsonb := coalesce(p_payload->'values', '{}'::jsonb);
  v_record_id uuid;
  v_record_id_text text;
  v_row public.entity_dynamic_records;
  v_static public.entity_static_records;
  v_out jsonb;
  v_list jsonb;
begin
  if p_session_id is null then
    raise exception 'Session is required';
  end if;
  if p_chatbot_id is null or p_entity_id is null then
    raise exception 'Chatbot and entity are required';
  end if;

  select * into v_session
  from public.conversation_sessions
  where id = p_session_id;

  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.status is distinct from 'active' then
    raise exception 'Session is not active';
  end if;
  -- Allow the live chatbot after a transfer (session.chatbot_id tracks the current bot).
  if v_session.chatbot_id is distinct from p_chatbot_id then
    raise exception 'Session does not belong to this chatbot';
  end if;

  select * into v_entity
  from public.chatbot_entities
  where id = p_entity_id
    and deleted_at is null;

  if v_entity.id is null then
    raise exception 'Entity not found';
  end if;

  if v_op in ('list', 'get') then
    v_link_op := 'query';
  elsif v_op = 'create' then
    v_link_op := 'create';
  elsif v_op = 'update' then
    v_link_op := 'update';
  elsif v_op = 'delete' then
    v_link_op := 'delete';
  else
    raise exception 'Unknown entity operation "%"', p_operation;
  end if;

  if not public.entity_link_allows(p_entity_id, p_chatbot_id, v_link_op) then
    raise exception 'This chatbot cannot % records on this entity', v_link_op;
  end if;

  if v_op in ('create', 'update', 'delete') and v_entity.kind is distinct from 'dynamic' then
    raise exception 'Static entities are read-only in flows (use List/Get)';
  end if;

  v_record_id_text := nullif(trim(coalesce(p_payload->>'recordId', '')), '');
  if v_record_id_text is not null then
    begin
      v_record_id := v_record_id_text::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid record id';
    end;
  end if;

  if v_op = 'list' then
    if v_entity.kind = 'static' then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'values', coalesce(r.values, '{}'::jsonb),
          'sort_order', r.sort_order,
          'created_at', r.created_at
        )
        order by r.sort_order
      ), '[]'::jsonb)
      into v_list
      from public.entity_static_records r
      where r.entity_id = p_entity_id;
    else
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'values', coalesce(r.values, '{}'::jsonb),
          'created_at', r.created_at,
          'updated_at', r.updated_at
        )
        order by r.created_at desc
      ), '[]'::jsonb)
      into v_list
      from public.entity_dynamic_records r
      where r.entity_id = p_entity_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
      'records', coalesce(v_list, '[]'::jsonb),
      'count', jsonb_array_length(coalesce(v_list, '[]'::jsonb))
    );
  end if;

  if v_op = 'get' then
    if v_entity.kind = 'static' then
      if v_record_id is not null then
        select * into v_static from public.entity_static_records where id = v_record_id and entity_id = p_entity_id;
      else
        select * into v_static from public.entity_static_records where entity_id = p_entity_id order by sort_order limit 1;
      end if;
      if v_static.id is null then
        return jsonb_build_object(
          'ok', true,
          'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
          'record', null,
          'found', false
        );
      end if;
      v_out := jsonb_build_object('id', v_static.id) || coalesce(v_static.values, '{}'::jsonb);
    else
      if v_record_id is not null then
        select * into v_row from public.entity_dynamic_records where id = v_record_id and entity_id = p_entity_id;
      else
        select * into v_row from public.entity_dynamic_records where entity_id = p_entity_id order by created_at desc limit 1;
      end if;
      if v_row.id is null then
        return jsonb_build_object(
          'ok', true,
          'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
          'record', null,
          'found', false
        );
      end if;
      v_out := jsonb_build_object('id', v_row.id) || coalesce(v_row.values, '{}'::jsonb);
    end if;

    return jsonb_build_object(
      'ok', true,
      'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
      'record', v_out,
      'found', true
    );
  end if;

  if v_op = 'create' then
    -- Prefer values.id when present; otherwise generate.
    v_record_id_text := nullif(trim(coalesce(v_values->>'id', '')), '');
    if v_record_id_text is null then
      v_record_id := gen_random_uuid();
      v_values := jsonb_set(v_values, '{id}', to_jsonb(v_record_id::text), true);
    else
      begin
        v_record_id := v_record_id_text::uuid;
      exception when invalid_text_representation then
        v_record_id := gen_random_uuid();
        v_values := jsonb_set(v_values, '{id}', to_jsonb(v_record_id::text), true);
      end;
      v_values := jsonb_set(v_values, '{id}', to_jsonb(v_record_id::text), true);
    end if;

    insert into public.entity_dynamic_records (id, entity_id, values)
    values (v_record_id, p_entity_id, v_values)
    returning * into v_row;

    v_out := jsonb_build_object('id', v_row.id) || coalesce(v_row.values, '{}'::jsonb);
    return jsonb_build_object(
      'ok', true,
      'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
      'record', v_out,
      'id', v_row.id
    );
  end if;

  if v_op = 'update' then
    if v_record_id is null then
      raise exception 'Record id is required for update';
    end if;
    select * into v_row from public.entity_dynamic_records where id = v_record_id and entity_id = p_entity_id;
    if v_row.id is null then
      raise exception 'Record not found';
    end if;
    -- Keep primary key stable
    v_values := jsonb_set(coalesce(v_row.values, '{}'::jsonb) || v_values, '{id}', to_jsonb(v_row.id::text), true);
    update public.entity_dynamic_records
    set values = v_values, updated_at = now()
    where id = v_row.id
    returning * into v_row;
    v_out := jsonb_build_object('id', v_row.id) || coalesce(v_row.values, '{}'::jsonb);
    return jsonb_build_object(
      'ok', true,
      'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
      'record', v_out,
      'id', v_row.id
    );
  end if;

  -- delete
  if v_record_id is null then
    raise exception 'Record id is required for delete';
  end if;
  delete from public.entity_dynamic_records
  where id = v_record_id
    and entity_id = p_entity_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Record not found';
  end if;
  return jsonb_build_object(
    'ok', true,
    'entity', jsonb_build_object('id', v_entity.id, 'key', v_entity.key, 'kind', v_entity.kind),
    'deleted', true,
    'id', v_row.id
  );
end;
$$;

revoke all on function public.public_chat_entity_op(uuid, uuid, uuid, text, jsonb) from public;
grant execute on function public.public_chat_entity_op(uuid, uuid, uuid, text, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
