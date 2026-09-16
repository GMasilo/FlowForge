-- Restart chat step: clear the conversation and start again from the first step.

alter type public.flow_node_type add value if not exists 'restart';

notify pgrst, 'reload schema';
