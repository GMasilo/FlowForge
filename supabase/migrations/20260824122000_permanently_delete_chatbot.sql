-- Hard-delete soft-deleted chatbots (admin/owner). Cascades related rows via FKs.

create or replace function public.permanently_delete_chatbot(p_chatbot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot public.chatbots;
begin
  select * into v_bot from public.chatbots where id = p_chatbot_id and deleted_at is not null;
  if v_bot.id is null then
    raise exception 'Deleted chatbot not found';
  end if;
  if not public.has_instance_role(v_bot.instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  perform public.write_audit_event(
    v_bot.instance_id,
    'chatbot.permanently_delete',
    'chatbot',
    p_chatbot_id::text,
    jsonb_build_object('name', v_bot.name)
  );

  delete from public.chatbots where id = p_chatbot_id;
end;
$$;

grant execute on function public.permanently_delete_chatbot(uuid) to authenticated;
