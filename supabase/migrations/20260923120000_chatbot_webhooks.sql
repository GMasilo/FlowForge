-- Optional chatbot scope; existing subscriptions remain organisation-wide.
alter table public.instance_webhooks
  add column chatbot_id uuid references public.chatbots(id) on delete cascade;
create index instance_webhooks_chatbot_idx on public.instance_webhooks(chatbot_id);

create function public.validate_webhook_chatbot_scope()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.chatbot_id is not null and not exists (
    select 1 from public.chatbots c
    where c.id = new.chatbot_id and c.instance_id = new.instance_id and c.deleted_at is null
  ) then
    raise exception 'Webhook chatbot must belong to this organisation';
  end if;
  return new;
end;
$$;
create trigger webhook_chatbot_scope before insert or update on public.instance_webhooks
for each row execute function public.validate_webhook_chatbot_scope();

-- Keep older API versions from broadcasting chatbot-scoped subscriptions.
create or replace function public.list_webhooks_for_event(p_instance_id uuid, p_event text)
returns setof public.instance_webhooks language sql stable security definer set search_path = public as $$
  select * from public.instance_webhooks
  where instance_id = p_instance_id and chatbot_id is null
    and enabled and p_event = any(events);
$$;
revoke all on function public.list_webhooks_for_event(uuid, text) from public, anon, authenticated;
grant execute on function public.list_webhooks_for_event(uuid, text) to service_role;

create function public.list_scoped_webhooks_for_event(p_instance_id uuid, p_event text, p_chatbot_id uuid)
returns setof public.instance_webhooks language plpgsql stable security definer set search_path = public as $$
begin
  if p_chatbot_id is not null and not exists (
    select 1 from public.chatbots where id = p_chatbot_id
      and instance_id = p_instance_id and deleted_at is null
  ) then
    raise exception 'Chatbot not found in this organisation';
  end if;
  return query select w.* from public.instance_webhooks w
    where w.instance_id = p_instance_id and w.enabled and p_event = any(w.events)
      and (w.chatbot_id is null or w.chatbot_id = p_chatbot_id);
end;
$$;
revoke all on function public.list_scoped_webhooks_for_event(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.list_scoped_webhooks_for_event(uuid, text, uuid) to service_role;
