-- Force a unique primary-key attribute `id` on every entity.
-- Backfill attribute metadata and copy the row UUID into values.id when missing.

insert into public.entity_attributes (
  entity_id,
  key,
  label,
  value_type,
  required,
  is_identifier,
  is_unique,
  sort_order
)
select
  e.id,
  'id',
  'Id',
  'string'::public.variable_type,
  true,
  true,
  true,
  -1
from public.chatbot_entities e
where not exists (
  select 1
  from public.entity_attributes a
  where a.entity_id = e.id
    and a.key = 'id'
);

update public.entity_attributes
set
  label = coalesce(nullif(trim(label), ''), 'Id'),
  value_type = 'string'::public.variable_type,
  required = true,
  is_identifier = true,
  is_unique = true,
  sort_order = -1
where key = 'id';

update public.entity_attributes
set is_identifier = false
where key <> 'id'
  and is_identifier = true;

update public.entity_static_records
set values = jsonb_set(coalesce(values, '{}'::jsonb), '{id}', to_jsonb(id::text), true)
where values->>'id' is null
   or btrim(values->>'id') = '';

update public.entity_dynamic_records
set values = jsonb_set(coalesce(values, '{}'::jsonb), '{id}', to_jsonb(id::text), true)
where values->>'id' is null
   or btrim(values->>'id') = '';
