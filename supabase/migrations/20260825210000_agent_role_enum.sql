-- Add dedicated agent instance role (enum only — must commit before use).

alter type public.instance_role add value if not exists 'agent';
