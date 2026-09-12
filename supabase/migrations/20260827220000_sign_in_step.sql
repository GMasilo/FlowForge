-- Sign-in flow step type.

alter type public.flow_node_type add value if not exists 'sign_in';

notify pgrst, 'reload schema';
