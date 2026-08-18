-- Allow the same variable key to be written by multiple steps (overwrite semantics).
-- Globals remain unique per chatbot; step declarations are unique per source node.

alter table public.chatbot_variables
  drop constraint if exists chatbot_variables_chatbot_id_key_key;

create unique index if not exists chatbot_variables_global_key_uidx
  on public.chatbot_variables (chatbot_id, key)
  where scope = 'global';

create unique index if not exists chatbot_variables_step_source_uidx
  on public.chatbot_variables (chatbot_id, source_node_key)
  where scope = 'step' and source_node_key is not null;
