-- Saved preview fixtures per chatbot (globals + expected vars / step keys).

create table if not exists public.chatbot_test_scenarios (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references public.chatbots (id) on delete cascade,
  name text not null,
  globals jsonb not null default '{}'::jsonb,
  expected jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatbot_test_scenarios_chatbot_idx
  on public.chatbot_test_scenarios (chatbot_id);

create trigger chatbot_test_scenarios_updated_at
before update on public.chatbot_test_scenarios
for each row execute function public.set_updated_at();

alter table public.chatbot_test_scenarios enable row level security;

create policy "test_scenarios_select_member"
on public.chatbot_test_scenarios for select to authenticated
using (public.is_instance_member(public.chatbot_instance_id(chatbot_id)));

create policy "test_scenarios_write_editor"
on public.chatbot_test_scenarios for all to authenticated
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

grant select, insert, update, delete on public.chatbot_test_scenarios to authenticated;
