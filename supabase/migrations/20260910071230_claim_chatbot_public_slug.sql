-- Atomically claim a public_slug for a chatbot within its organisation.
-- Clears any other live chatbot in the same instance that holds the slug,
-- then assigns it. Runs as security definer so platform superusers (and
-- instance editors) are not blocked by RLS when freeing another bot's slug.

create or replace function public.claim_chatbot_public_slug(
  p_chatbot_id uuid,
  p_slug text,
  p_public_enabled boolean default null,
  p_name text default null
)
returns public.chatbots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bot public.chatbots;
  v_slug text := nullif(trim(coalesce(p_slug, '')), '');
  v_norm text;
begin
  if v_slug is null then
    raise exception 'Public slug is required';
  end if;
  v_norm := lower(v_slug);

  select * into v_bot
  from public.chatbots
  where id = p_chatbot_id
  for update;

  if not found then
    raise exception 'Chatbot not found';
  end if;

  if v_bot.deleted_at is not null then
    raise exception 'Chatbot is deleted';
  end if;

  if not (
    public.is_superuser()
    or public.has_instance_role(
      v_bot.instance_id,
      array['owner', 'admin', 'editor']::public.instance_role[]
    )
  ) then
    raise exception 'Not allowed to claim public slug for this chatbot';
  end if;

  -- Free the slug from any other live bot in this organisation.
  update public.chatbots c
  set public_slug = null,
      updated_at = now()
  where c.instance_id = v_bot.instance_id
    and c.id <> p_chatbot_id
    and c.deleted_at is null
    and c.public_slug is not null
    and lower(c.public_slug) = v_norm;

  update public.chatbots c
  set
    public_slug = v_slug,
    public_enabled = coalesce(p_public_enabled, c.public_enabled),
    name = coalesce(nullif(trim(coalesce(p_name, '')), ''), c.name),
    updated_at = now()
  where c.id = p_chatbot_id
  returning * into v_bot;

  return v_bot;
end;
$$;

revoke all on function public.claim_chatbot_public_slug(uuid, text, boolean, text) from public;
grant execute on function public.claim_chatbot_public_slug(uuid, text, boolean, text) to authenticated;
