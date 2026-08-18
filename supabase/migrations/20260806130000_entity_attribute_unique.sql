-- Unique option on entity attributes (enforced in app on create/update).

alter table public.entity_attributes
  add column if not exists is_unique boolean not null default false;
