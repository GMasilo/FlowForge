-- Database connections (Postgres / MySQL) + Database flow step.

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'connection_kind'
  ) and not exists (
    select 1
    from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'connection_kind'
      and e.enumlabel = 'database'
  ) then
    execute 'alter type public.connection_kind add value ''database''';
  end if;
end
$$;

alter type public.flow_node_type add value if not exists 'database';
