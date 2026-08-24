-- Allow integration steps on chatbot flows
alter type public.flow_node_type add value if not exists 'integration';
