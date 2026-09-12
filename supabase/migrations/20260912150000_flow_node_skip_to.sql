-- Skip to step: jump to another step by key (same as Button listener skip_to).

alter type public.flow_node_type add value if not exists 'skip_to';

notify pgrst, 'reload schema';
