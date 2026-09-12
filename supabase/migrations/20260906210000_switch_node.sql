-- Switch / case flow step type.

alter type public.flow_node_type add value if not exists 'switch';

notify pgrst, 'reload schema';
