-- Fix chatbot_entities SELECT RLS so INSERT ... RETURNING works.
--
-- PostgREST inserts with `select=*`, which requires the SELECT policy to pass on
-- the new row. `can_see_entity_meta(id)` looks the row up by id inside a helper;
-- during INSERT RETURNING that lookup can fail even for the creator, producing
-- "new row violates row-level security policy for table chatbot_entities".
--
-- Allowing `can_access_chatbot(chatbot_id)` uses columns on the new row directly
-- (same pattern as chatbot_templates / flows) and covers owners, creators, and
-- share recipients. Keep `can_see_entity_meta` for global/shared/installed entities.

drop policy if exists "entities_select_visible" on public.chatbot_entities;

create policy "entities_select_visible"
on public.chatbot_entities for select to authenticated
using (
  public.can_access_chatbot(chatbot_id)
  or public.can_see_entity_meta(id)
);

notify pgrst, 'reload schema';
