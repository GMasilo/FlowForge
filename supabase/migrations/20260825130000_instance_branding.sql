-- Per-organisation branding for workspace and public chat.

alter table public.instances
  add column if not exists brand_display_name text,
  add column if not exists brand_accent_color text,
  add column if not exists brand_logo_url text,
  add column if not exists brand_apply_to_public_chat boolean not null default true;

alter table public.instances
  drop constraint if exists instances_brand_accent_color_hex;

alter table public.instances
  add constraint instances_brand_accent_color_hex
  check (
    brand_accent_color is null
    or brand_accent_color ~* '^#[0-9a-f]{6}$'
  );

-- Recreate update_organisation with branding args (drop old signature first).
drop function if exists public.update_organisation(uuid, text, text, text, text, text, text, text, text);

create or replace function public.update_organisation(
  p_id uuid,
  p_name text,
  p_slug text,
  p_legal_name text default null,
  p_contact_email text default null,
  p_phone text default null,
  p_website text default null,
  p_billing_address text default null,
  p_notes text default null,
  p_brand_display_name text default null,
  p_brand_accent_color text default null,
  p_brand_logo_url text default null,
  p_brand_apply_to_public_chat boolean default null
)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instances;
  v_accent text := nullif(trim(coalesce(p_brand_accent_color, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    public.is_superuser()
    or public.has_instance_role(p_id, array['owner', 'admin']::public.instance_role[])
  ) then
    raise exception 'Not allowed to update this organisation';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Organisation name is required';
  end if;
  if trim(coalesce(p_slug, '')) = '' then
    raise exception 'Slug is required';
  end if;
  if v_accent is not null and v_accent !~* '^#[0-9a-f]{6}$' then
    raise exception 'Accent color must be a hex value like #0f766e';
  end if;

  update public.instances
  set
    name = trim(p_name),
    slug = trim(p_slug),
    legal_name = nullif(trim(coalesce(p_legal_name, '')), ''),
    contact_email = nullif(trim(coalesce(p_contact_email, '')), ''),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    website = nullif(trim(coalesce(p_website, '')), ''),
    billing_address = nullif(trim(coalesce(p_billing_address, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    brand_display_name = nullif(trim(coalesce(p_brand_display_name, '')), ''),
    brand_accent_color = v_accent,
    brand_logo_url = nullif(trim(coalesce(p_brand_logo_url, '')), ''),
    brand_apply_to_public_chat = coalesce(p_brand_apply_to_public_chat, brand_apply_to_public_chat),
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Organisation not found';
  end if;

  return v_row;
end;
$$;

grant execute on function public.update_organisation(
  uuid, text, text, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

-- Include branding on public chat start (anon-safe).
create or replace function public.start_public_conversation(
  p_slug text,
  p_visitor_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_bot public.chatbots;
  v_flow public.chatbot_flows;
  v_session public.conversation_sessions;
  v_inst public.instances;
begin
  if p_slug is null or trim(p_slug) = '' then
    raise exception 'Public slug is required';
  end if;

  select * into v_bot
  from public.chatbots
  where public_enabled = true
    and deleted_at is null
    and lower(public_slug) = lower(trim(p_slug));

  if v_bot.id is null then
    raise exception 'Chatbot not found or not public';
  end if;

  if not public.check_instance_quota(v_bot.instance_id, 'conversations') then
    raise exception 'Monthly conversation quota exceeded';
  end if;

  select * into v_flow from public.chatbot_flows where chatbot_id = v_bot.id;
  if v_flow.id is null or v_flow.published_graph is null then
    raise exception 'Chatbot is not published';
  end if;

  select * into v_inst from public.instances where id = v_bot.instance_id;

  insert into public.conversation_sessions (
    chatbot_id, instance_id, status, visitor_key, publish_version
  ) values (
    v_bot.id, v_bot.instance_id, 'active', nullif(trim(coalesce(p_visitor_key, '')), ''), v_flow.version
  )
  returning * into v_session;

  perform public.increment_instance_usage(v_bot.instance_id, 1, 0, 0);

  return jsonb_build_object(
    'session_id', v_session.id,
    'chatbot_id', v_bot.id,
    'instance_id', v_bot.instance_id,
    'publish_version', v_session.publish_version,
    'published_graph', v_flow.published_graph,
    'name', v_bot.name,
    'branding', case
      when v_inst.id is null or not coalesce(v_inst.brand_apply_to_public_chat, true) then null
      else jsonb_build_object(
        'display_name', coalesce(v_inst.brand_display_name, v_inst.name),
        'accent_color', v_inst.brand_accent_color,
        'logo_url', v_inst.brand_logo_url
      )
    end
  );
end;
$$;

grant execute on function public.start_public_conversation(text, text) to anon, authenticated;
