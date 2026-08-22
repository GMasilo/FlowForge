-- Recycle bin: permanently delete a chatbot that was already soft-deleted.
-- Also restrict table DELETE so live chatbots cannot skip the recycle bin.

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
    raise exception 'Chatbot is not in the recycle bin';
  end if;
  if not public.has_instance_role(v_bot.instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  perform public.write_audit_event(
    v_bot.instance_id,
    'chatbot.permanent_delete',
    'chatbot',
    p_chatbot_id::text,
    jsonb_build_object('name', v_bot.name)
  );

  delete from public.chatbots where id = p_chatbot_id;
end;
$$;

revoke all on function public.permanently_delete_chatbot(uuid) from public;
grant execute on function public.permanently_delete_chatbot(uuid) to authenticated;

drop policy if exists "chatbots_delete_admin" on public.chatbots;
create policy "chatbots_delete_admin"
on public.chatbots for delete to authenticated
using (
  deleted_at is not null
  and public.has_instance_role(instance_id, array['owner', 'admin']::public.instance_role[])
);
