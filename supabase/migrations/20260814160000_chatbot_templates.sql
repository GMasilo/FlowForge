-- Reusable chatbot templates: HTML email, FAQ/help menus, shop carts, and related content.

do $$ begin
  create type public.template_kind as enum (
    'email',
    'faq',
    'cart',
    'menu',
    'message',
    'hours',
    'legal',
    'receipt'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.chatbot_templates (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  kind public.template_kind not null,
  content jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chatbot_templates_key_format check (key ~ '^[A-Za-z][A-Za-z0-9_]*$')
);

create index if not exists chatbot_templates_chatbot_idx
  on public.chatbot_templates (chatbot_id)
  where deleted_at is null;

create unique index if not exists chatbot_templates_chatbot_key_alive
  on public.chatbot_templates (chatbot_id, key)
  where deleted_at is null;

create trigger chatbot_templates_updated_at
before update on public.chatbot_templates
for each row execute function public.set_updated_at();

alter table public.chatbot_templates enable row level security;

create policy "templates_select_member"
on public.chatbot_templates for select to authenticated
using (public.is_instance_member(public.chatbot_instance_id(chatbot_id)));

create policy "templates_write_editor"
on public.chatbot_templates for all to authenticated
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
);

grant select, insert, update, delete on public.chatbot_templates to authenticated;
