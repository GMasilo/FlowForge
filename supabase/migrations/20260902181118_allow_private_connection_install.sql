-- Allow connection creators (and org owners/admins) to install their private
-- connections onto other chatbots via ForgeHub / chatbot_connections links.

drop policy if exists "chatbot_connections_write_editor" on public.chatbot_connections;

create policy "chatbot_connections_write_editor"
on public.chatbot_connections for all to authenticated
using (
  public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.has_instance_role(
    public.chatbot_instance_id(chatbot_id),
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
  and (
    -- Owning chatbot auto-link / same-bot link
    exists (
      select 1 from public.connections c
      where c.id = connection_id
        and c.chatbot_id = chatbot_id
    )
    -- Marketplace: global or shared
    or exists (
      select 1 from public.connections c
      where c.id = connection_id
        and c.visibility in ('global', 'shared')
    )
    -- Private: creator or org owner/admin may install onto other chatbots
    or exists (
      select 1 from public.connections c
      where c.id = connection_id
        and c.visibility = 'private'
        and (
          c.created_by = auth.uid()
          or public.has_instance_role(
            c.instance_id,
            array['owner', 'admin']::public.instance_role[]
          )
        )
    )
  )
);

comment on column public.connections.visibility is
  'private = not listed for others (creator/admins may still install onto other chatbots); global = instance ForgeHub; shared = listed for connection_shares users';
