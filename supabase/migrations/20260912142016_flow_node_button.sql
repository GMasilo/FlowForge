-- Button step: show action buttons and optional host event listeners.

alter type public.flow_node_type add value if not exists 'button';

notify pgrst, 'reload schema';
