-- Per-industry use-case demo chatbot settings for the public Use cases page.

alter table public.platform_settings
  add column if not exists usecase_demos jsonb not null default '{}'::jsonb;

comment on column public.platform_settings.usecase_demos is
  'Map of industry id → { chatbot_id, public_slug }. Hosted in landing_demo_instance_id.';

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
    'landing_public_slug', s.landing_public_slug,
    'landing_org_slug', i.slug,
    'usecase_slugs', coalesce(
      (
        select jsonb_object_agg(key, value ->> 'public_slug')
        from jsonb_each(coalesce(s.usecase_demos, '{}'::jsonb))
        where nullif(trim(value ->> 'public_slug'), '') is not null
      ),
      '{}'::jsonb
    )
  )
  from public.platform_settings s
  left join public.instances i on i.id = s.landing_demo_instance_id
  where s.id = 'default';
$$;

revoke all on function public.get_platform_settings() from public;
grant execute on function public.get_platform_settings() to anon, authenticated;
