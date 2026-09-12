-- A single step (e.g. Set Variable, Sign-in) may declare multiple flow variables.
-- Uniqueness is per (chatbot, source step, variable key), not one row per step.

drop index if exists public.chatbot_variables_step_source_uidx;

create unique index if not exists chatbot_variables_step_source_key_uidx
  on public.chatbot_variables (chatbot_id, source_node_key, key)
  where scope = 'step' and source_node_key is not null;
