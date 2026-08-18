-- Add loop / for-each flow node type
alter type public.flow_node_type add value if not exists 'loop';
