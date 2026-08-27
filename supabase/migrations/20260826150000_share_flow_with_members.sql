-- Share a flow with existing organisation members (in-app notification + deep link).

create or replace function public.share_flow_with_members(
  p_flow_id uuid,
  p_user_ids uuid[],
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance uuid;
  v_chatbot uuid;
  v_bot_name text;
  v_sharer text;
  v_href text;
  v_title text;
  v_body text;
  v_note text;
  v_uid uuid;
  v_count integer := 0;
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_flow_id is null then
    raise exception 'Flow required';
  end if;

  select public.chatbot_instance_id(f.chatbot_id), f.chatbot_id, b.name
  into v_instance, v_chatbot, v_bot_name
  from public.chatbot_flows f
  join public.chatbots b on b.id = f.chatbot_id and b.deleted_at is null
  where f.id = p_flow_id;

  if v_instance is null or v_chatbot is null then
    raise exception 'Flow not found';
  end if;
  if not public.is_instance_member(v_instance) then
    raise exception 'Not allowed';
  end if;

  select coalesce(
    nullif(trim(m.display_name), ''),
    nullif(trim(p.display_name), ''),
    nullif(trim(p.email), ''),
    'A teammate'
  )
  into v_sharer
  from public.profiles p
  left join public.instance_members m
    on m.user_id = p.id and m.instance_id = v_instance
  where p.id = auth.uid();
  v_sharer := coalesce(v_sharer, 'A teammate');

  select array_agg(distinct x order by x)
  into v_ids
  from unnest(coalesce(p_user_ids, array[]::uuid[])) as x
  where x is not null
    and x <> auth.uid();

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'Select at least one member';
  end if;
  if cardinality(v_ids) > 25 then
    raise exception 'Too many recipients (max 25)';
  end if;

  v_href := '/instances/' || v_instance::text || '/chatbots/' || v_chatbot::text || '/design';
  v_bot_name := coalesce(nullif(trim(v_bot_name), ''), 'Flow');
  v_title := left(v_sharer, 60) || ' invited you to collaborate';
  v_note := nullif(trim(coalesce(p_message, '')), '');
  v_body := coalesce(v_note, 'Open the designer to collaborate on ' || v_bot_name || '.');

  foreach v_uid in array v_ids
  loop
    if not exists (
      select 1
      from public.instance_members m
      where m.instance_id = v_instance
        and m.user_id = v_uid
        and m.disabled_at is null
    ) then
      continue;
    end if;

    perform public.create_user_notification(
      v_instance,
      v_uid,
      'flow.shared',
      v_title,
      left(v_body, 280),
      v_href,
      'flow',
      p_flow_id::text,
      jsonb_build_object(
        'flow_id', p_flow_id,
        'chatbot_id', v_chatbot,
        'shared_by', auth.uid()
      )
    );
    -- Count the recipient; do not test composite IS NOT NULL (UNKNOWN when read_at is null).
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'No eligible members to notify';
  end if;

  return jsonb_build_object(
    'notified', v_count,
    'href', v_href
  );
end;
$$;

revoke all on function public.share_flow_with_members(uuid, uuid[], text) from public;
grant execute on function public.share_flow_with_members(uuid, uuid[], text) to authenticated;

notify pgrst, 'reload schema';
