-- Keep schedules paused until an administrator enables them; no destination is contacted here.

alter table public.entity_jobs drop constraint entity_jobs_action_check;

alter table public.entity_jobs add constraint entity_jobs_action_check check(action in ('csv_s3','cleanup','http_api','database'));

alter table public.entity_jobs add column connection_id uuid references public.connections(id) on delete restrict,

 add column http_path text not null default '',

 add column http_method text not null default 'POST' check(http_method in ('POST','PUT','PATCH')),

 add column target_table text;

alter table public.entity_jobs add constraint entity_jobs_connection_required check(action not in ('http_api','database') or connection_id is not null);

create index entity_jobs_connection_idx on public.entity_jobs(connection_id) where connection_id is not null;

create or replace function public.validate_entity_job() returns trigger language plpgsql set search_path=public as $$

begin

 if TG_OP='DELETE' then

   if exists(select 1 from public.entity_job_runs where job_id=old.id and status='running') then raise exception 'This job is running. Wait before deleting it'; end if;

   return old;

 end if;

 if TG_OP='UPDATE' and (to_jsonb(new)-'next_run_at') is distinct from (to_jsonb(old)-'next_run_at') and exists(select 1 from public.entity_job_runs where job_id=old.id and status='running') then

   raise exception 'This job is running. Wait for it to finish before changing its settings';

 end if;

 if TG_OP='UPDATE' and (to_jsonb(new)-'next_run_at') is not distinct from (to_jsonb(old)-'next_run_at') then return new; end if;

 if TG_OP='UPDATE' and not new.enabled and (to_jsonb(new)-'enabled') is not distinct from (to_jsonb(old)-'enabled') then return new; end if;
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid timezone'; end if;

 if new.action='cleanup' and not exists(select 1 from public.chatbot_entities where id=new.entity_id and kind='dynamic') then raise exception 'Cleanup requires a dynamic entity'; end if;

 if new.action='cleanup' and not exists(select 1 from public.entity_attributes where entity_id=new.entity_id and key=new.filter_key and value_type<>'password') then raise exception 'Choose a valid cleanup field'; end if;

 if new.action in ('csv_s3','http_api','database') and (cardinality(new.columns)=0 or exists(select 1 from unnest(new.columns) c where not exists(select 1 from public.entity_attributes a where a.entity_id=new.entity_id and a.key=c and a.value_type<>'password'))) then raise exception 'Select export columns; password fields cannot be exported'; end if;

 if new.action in ('http_api','database') and not exists(

 select 1 from public.connections c join public.chatbot_entities e on e.id=new.entity_id

 join public.chatbots b on b.id=e.chatbot_id

 where c.id=new.connection_id and c.deleted_at is null and c.instance_id=b.instance_id

 and c.kind::text=case when new.action='http_api' then 'http' else 'database' end

 and (c.chatbot_id=e.chatbot_id or exists(select 1 from public.chatbot_connections cc where cc.chatbot_id=e.chatbot_id and cc.connection_id=c.id))

 ) then raise exception 'Choose an installed connection of the correct type in this organisation'; end if;

 if new.action='database' and (coalesce(new.target_table,'') !~ '^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$' or exists(select 1 from unnest(new.columns) c where c !~ '^[A-Za-z_][A-Za-z0-9_]*$')) then raise exception 'Use a table (or schema.table) and column keys containing letters, digits and underscores'; end if;

 if TG_OP='INSERT' then

   new.created_by:=auth.uid(); new.next_run_at:=public.entity_job_next_time(new.daily_time,new.timezone,now());

 elsif new.daily_time is distinct from old.daily_time or new.timezone is distinct from old.timezone or (new.enabled and not old.enabled) then

   new.next_run_at:=public.entity_job_next_time(new.daily_time,new.timezone,now());

 end if;

 return new;

end $$;

create or replace function public.entity_job_export(p_run_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$

declare j public.entity_jobs; rows jsonb; kind public.entity_kind;

begin

 select q.* into j from public.entity_jobs q join public.entity_job_runs r on r.job_id=q.id where r.id=p_run_id and r.status='running' for update of q;

 if j.id is null or not j.enabled or j.action not in ('csv_s3','http_api','database') then raise exception 'Export job not available'; end if;

 if exists(select 1 from unnest(j.columns) c where not exists(select 1 from public.entity_attributes a where a.entity_id=j.entity_id and a.key=c and a.value_type<>'password')) then raise exception 'Export schema changed; review selected columns'; end if;

 select e.kind into kind from public.chatbot_entities e where e.id=j.entity_id and e.deleted_at is null;

 if kind is null then raise exception 'Entity not available'; end if;

 if kind='dynamic' then

 select coalesce(jsonb_agg(v),'[]') into rows from (select (select jsonb_object_agg(k, d.values->k) from unnest(j.columns) k) v from public.entity_dynamic_records d where entity_id=j.entity_id order by id limit 10001) x;

 else

 select coalesce(jsonb_agg(v),'[]') into rows from (select (select jsonb_object_agg(k, d.values->k) from unnest(j.columns) k) v from public.entity_static_records d where entity_id=j.entity_id order by id limit 10001) x;

 end if;

 if jsonb_array_length(rows)>10000 or octet_length(rows::text)>20000000 then raise exception 'Export exceeds 10000 rows or 20 MB; narrow the entity'; end if;

 return jsonb_build_object('columns',j.columns,'rows',rows);

end $$;





-- Cron can resolve credentials only for an active job and its installed destination.

create function public.entity_job_connection(p_run_id uuid) returns jsonb

language plpgsql security invoker set search_path=public as $$

declare result jsonb;

begin

 select s.config into result from public.entity_job_runs r

 join public.entity_jobs j on j.id=r.job_id

 join public.chatbot_entities e on e.id=j.entity_id and e.deleted_at is null

 join public.chatbots b on b.id=e.chatbot_id and b.deleted_at is null

 join public.connections c on c.id=j.connection_id and c.instance_id=b.instance_id and c.deleted_at is null

 join public.connection_secrets s on s.connection_id=c.id

 where r.id=p_run_id and r.status='running' and j.enabled and j.action in ('http_api','database')

 and c.kind::text=case when j.action='http_api' then 'http' else 'database' end

 and (c.chatbot_id=e.chatbot_id or exists(select 1 from public.chatbot_connections cc where cc.chatbot_id=e.chatbot_id and cc.connection_id=c.id));

 if result is null then raise exception 'Destination connection is unavailable; check its installation and organisation'; end if;

 return result;

end $$;

revoke all on function public.entity_job_connection(uuid) from public,anon,authenticated;

grant execute on function public.entity_job_connection(uuid) to service_role;

notify pgrst,'reload schema';

