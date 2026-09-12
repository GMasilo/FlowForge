-- Platform-wide settings (landing page content, demo chatbot, contact).

create table if not exists public.platform_settings (
  id text primary key default 'default' check (id = 'default'),
  hero_tagline text,
  hero_description text,
  about_text text,
  contact_email text,
  contact_phone text,
  contact_url text,
  landing_public_slug text,
  landing_demo_instance_id uuid references public.instances (id) on delete set null,
  landing_demo_chatbot_id uuid references public.chatbots (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.platform_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_select_superuser" on public.platform_settings;
create policy "platform_settings_select_superuser"
on public.platform_settings for select to authenticated
using (public.is_superuser());

drop policy if exists "platform_settings_update_superuser" on public.platform_settings;
create policy "platform_settings_update_superuser"
on public.platform_settings for update to authenticated
using (public.is_superuser())
with check (public.is_superuser());

create or replace function public.get_platform_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'hero_tagline', s.hero_tagline,
    'hero_description', s.hero_description,
    'about_text', s.about_text,
    'contact_email', s.contact_email,
    'contact_phone', s.contact_phone,
    'contact_url', s.contact_url,
    'landing_public_slug', s.landing_public_slug
  )
  from public.platform_settings s
  where s.id = 'default';
$$;

revoke all on function public.get_platform_settings() from public;
grant execute on function public.get_platform_settings() to anon, authenticated;
