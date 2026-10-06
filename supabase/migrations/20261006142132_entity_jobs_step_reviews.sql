-- Step reviews stay private to people who can access the chatbot.
alter table public.flow_comments add column mention_ids uuid[] not null default '{}';
drop policy if exists flow_comments_select on public.flow_comments;
create policy flow_comments_select on public.flow_comments for select to authenticated
using (public.can_access_flow(flow_id));
revoke insert, update, delete on public.flow_comments from authenticated, anon;
grant select on public.flow_comments to authenticated;

create or replace function public.step_review_members(p_flow_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(u.email,m.user_id::text))), '[]'::jsonb)
 from public.chatbot_flows f join public.chatbots b on b.id=f.chatbot_id
 join public.instance_members m on m.instance_id=b.instance_id join auth.users u on u.id=m.user_id
 where f.id=p_flow_id and auth.uid() is not null and public.can_access_flow(f.id)
 and (m.role in ('owner','admin') or b.created_by=m.user_id or exists(select 1 from public.chatbot_shares s where s.chatbot_id=b.id and s.user_id=m.user_id))
$$;

create or replace function public.add_step_review(p_flow_id uuid, p_body text, p_node_key text default null, p_parent_id uuid default null, p_mentions uuid[] default '{}')
returns public.flow_comments language plpgsql security definer set search_path=public as $$
declare b public.chatbots; c public.flow_comments; recipient uuid; members jsonb;
begin
 select cb.* into b from public.chatbot_flows f join public.chatbots cb on cb.id=f.chatbot_id where f.id=p_flow_id;
 if auth.uid() is null or not coalesce(public.can_access_flow(p_flow_id),false) then raise exception 'Not allowed'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Write a comment of 1–5000 characters'; end if;
 if cardinality(p_mentions)>20 then raise exception 'Mention up to 20 people'; end if;
 if p_node_key is not null and not exists(select 1 from public.flow_nodes where flow_id=p_flow_id and key=p_node_key) then raise exception 'Save this step before commenting'; end if;
 if p_parent_id is not null and not exists(select 1 from public.flow_comments where id=p_parent_id and flow_id=p_flow_id and node_key is not distinct from p_node_key and parent_id is null and resolved_at is null) then raise exception 'Reply to an open thread on this step'; end if;
 members:=public.step_review_members(p_flow_id);
 foreach recipient in array coalesce(p_mentions,'{}') loop
   if not exists(select 1 from jsonb_array_elements(members) m where m->>'id'=recipient::text) then raise exception 'Mentioned person does not have access to this chatbot'; end if;
 end loop;
 insert into public.flow_comments(flow_id,instance_id,node_key,parent_id,author_id,body,mention_ids)
 values(p_flow_id,b.instance_id,p_node_key,p_parent_id,auth.uid(),trim(p_body),coalesce(p_mentions,'{}')) returning * into c;
 insert into public.user_notifications(instance_id,user_id,kind,title,body,href,resource_type,resource_id,meta)
 select b.instance_id, r, 'flow.mention', 'You were mentioned in a step review', left(c.body,180),
 '/instances/'||b.instance_id||'/chatbots/'||b.id||'/design'||case when p_node_key is null then '' else '?step='||p_node_key end,
 'flow_comment',c.id::text,jsonb_build_object('flow_id',p_flow_id,'node_key',p_node_key)
 from (select distinct unnest(coalesce(p_mentions,'{}')) r) recipients where r<>auth.uid();
 perform public.write_audit_event(b.instance_id,'flow.comment_added','flow_comment',c.id::text,jsonb_build_object('flow_id',p_flow_id,'node_key',p_node_key));
 return c;
end $$;

-- Keep existing clients on the same permission and parent validation path.
create or replace function public.add_flow_comment(p_flow_id uuid,p_body text,p_node_key text default null,p_parent_id uuid default null)
returns public.flow_comments language sql security invoker set search_path=public as $$
 select public.add_step_review(p_flow_id,p_body,p_node_key,p_parent_id,'{}')
$$;
create or replace function public.set_step_review_resolved(p_comment_id uuid,p_resolved boolean) returns void
language plpgsql security definer set search_path=public as $$
declare c public.flow_comments;
begin
 select * into c from public.flow_comments where id=p_comment_id;
 if auth.uid() is null or not coalesce(public.can_access_flow(c.flow_id),false) or
 not (c.author_id=auth.uid() or public.has_instance_role(c.instance_id,array['owner','admin','editor']::public.instance_role[])) then raise exception 'Not allowed'; end if;
 update public.flow_comments set resolved_at=case when p_resolved then now() else null end,updated_at=now() where id=c.id or parent_id=c.id;
end $$;
create or replace function public.resolve_flow_comment(p_comment_id uuid) returns public.flow_comments
language plpgsql security invoker set search_path=public as $$
declare c public.flow_comments;
begin
 perform public.set_step_review_resolved(p_comment_id,true);
 select * into c from public.flow_comments where id=p_comment_id; return c;
end $$;
revoke all on function public.step_review_members(uuid),public.add_step_review(uuid,text,text,uuid,uuid[]),public.add_flow_comment(uuid,text,text,uuid),public.set_step_review_resolved(uuid,boolean),public.resolve_flow_comment(uuid) from public,anon;
grant execute on function public.step_review_members(uuid),public.add_step_review(uuid,text,text,uuid,uuid[]),public.add_flow_comment(uuid,text,text,uuid),public.set_step_review_resolved(uuid,boolean),public.resolve_flow_comment(uuid) to authenticated;

create table public.entity_jobs (
 id uuid primary key default gen_random_uuid(),
 entity_id uuid not null references public.chatbot_entities(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 action text not null check(action in ('csv_s3','cleanup')),
 enabled boolean not null default false,
 daily_time time not null default '01:00', timezone text not null default 'Africa/Johannesburg',
 destination text, columns text[] not null default '{}',
 stale_days integer not null default 90 check(stale_days between 1 and 3650),
 filter_key text, filter_value text,
 next_run_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 check(action<>'csv_s3' or (destination is not null and length(trim(destination)) between 1 and 80)),
 check(action<>'cleanup' or (filter_key is not null and filter_value is not null and length(trim(filter_key))>0 and length(trim(filter_value))>0))
);
create index entity_jobs_due_idx on public.entity_jobs(next_run_at) where enabled;
create index entity_jobs_entity_idx on public.entity_jobs(entity_id);
create index if not exists entity_dynamic_cleanup_idx on public.entity_dynamic_records(entity_id,updated_at,id);
create table public.entity_job_runs (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.entity_jobs(id) on delete cascade,
 scheduled_at timestamptz not null, started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null default 'running' check(status in ('running','succeeded','failed')),
 row_count integer, object_key text, error text, unique(job_id,scheduled_at)
);
alter table public.entity_jobs enable row level security;
alter table public.entity_job_runs enable row level security;
grant select,insert,update,delete on public.entity_jobs to authenticated;
grant select on public.entity_job_runs to authenticated;
grant all on public.entity_jobs,public.entity_job_runs to service_role;
create policy entity_jobs_read on public.entity_jobs for select to authenticated using(public.can_manage_entity(entity_id));
create policy entity_jobs_manage on public.entity_jobs for all to authenticated
using(public.can_manage_entity(entity_id) and public.has_instance_role((select b.instance_id from public.chatbot_entities e join public.chatbots b on b.id=e.chatbot_id where e.id=entity_id),array['owner','admin']::public.instance_role[]))
with check(public.can_manage_entity(entity_id) and public.has_instance_role((select b.instance_id from public.chatbot_entities e join public.chatbots b on b.id=e.chatbot_id where e.id=entity_id),array['owner','admin']::public.instance_role[]));
create policy entity_job_runs_read on public.entity_job_runs for select to authenticated using(exists(select 1 from public.entity_jobs j where j.id=job_id));

create function public.entity_job_next_time(p_time time,p_zone text,p_after timestamptz) returns timestamptz
language sql stable set search_path=public as $$
 select case when ((p_after at time zone p_zone)::date+p_time) at time zone p_zone > p_after
 then ((p_after at time zone p_zone)::date+p_time) at time zone p_zone
 else (((p_after at time zone p_zone)::date+1)+p_time) at time zone p_zone end
$$;
create function public.validate_entity_job() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='DELETE' then
   if exists(select 1 from public.entity_job_runs where job_id=old.id and status='running') then raise exception 'This job is running. Wait before deleting it'; end if;
   return old;
 end if;
 if TG_OP='UPDATE' and (to_jsonb(new)-'next_run_at') is distinct from (to_jsonb(old)-'next_run_at') and exists(select 1 from public.entity_job_runs where job_id=old.id and status='running') then
   raise exception 'This job is running. Wait for it to finish before changing its settings';
 end if;
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Choose a valid timezone'; end if;
 if new.action='cleanup' and not exists(select 1 from public.chatbot_entities where id=new.entity_id and kind='dynamic') then raise exception 'Cleanup requires a dynamic entity'; end if;
 if new.action='cleanup' and not exists(select 1 from public.entity_attributes where entity_id=new.entity_id and key=new.filter_key and value_type<>'password') then raise exception 'Choose a valid cleanup field'; end if;
 if new.action='csv_s3' and (cardinality(new.columns)=0 or exists(select 1 from unnest(new.columns) c where not exists(select 1 from public.entity_attributes a where a.entity_id=new.entity_id and a.key=c and a.value_type<>'password'))) then raise exception 'Select export columns; password fields cannot be exported'; end if;
 if TG_OP='INSERT' then
   new.created_by:=auth.uid(); new.next_run_at:=public.entity_job_next_time(new.daily_time,new.timezone,now());
 elsif new.daily_time is distinct from old.daily_time or new.timezone is distinct from old.timezone or (new.enabled and not old.enabled) then
   new.next_run_at:=public.entity_job_next_time(new.daily_time,new.timezone,now());
 end if;
 return new;
end $$;
create trigger validate_entity_job before insert or update or delete on public.entity_jobs for each row execute function public.validate_entity_job();

create function public.preview_entity_cleanup(p_job_id uuid) returns bigint language plpgsql security invoker set search_path=public as $$
declare j public.entity_jobs; n bigint;
begin
 select * into j from public.entity_jobs where id=p_job_id;
 if j.id is null or j.action<>'cleanup' then raise exception 'Cleanup job not found'; end if;
 select count(*) into n from public.entity_dynamic_records where entity_id=j.entity_id and updated_at<now()-make_interval(days=>j.stale_days) and values->>j.filter_key=j.filter_value;
 return n;
end $$;

-- Service-only queue functions. Atomic claims prevent concurrent scheduler duplication.
create function public.claim_entity_job() returns jsonb language plpgsql security invoker set search_path=public as $$
declare j public.entity_jobs; r public.entity_job_runs; e public.chatbot_entities; instance uuid;
begin
 update public.entity_job_runs set status='failed',finished_at=now(),error='Worker timed out; inspect the destination before retrying' where status='running' and started_at<now()-interval '15 minutes';
 select q.* into j from public.entity_jobs q join public.chatbot_entities ce on ce.id=q.entity_id join public.chatbots b on b.id=ce.chatbot_id
 where q.enabled and q.next_run_at<=now() and ce.deleted_at is null and b.deleted_at is null
 and not exists(select 1 from public.entity_job_runs active_run where active_run.job_id=q.id and active_run.status='running')
 order by q.next_run_at limit 1 for update of q skip locked;
 if j.id is null then return null; end if;
 select * into e from public.chatbot_entities where id=j.entity_id;
 select instance_id into instance from public.chatbots where id=e.chatbot_id;
 insert into public.entity_job_runs(job_id,scheduled_at) values(j.id,j.next_run_at) returning * into r;
 update public.entity_jobs set next_run_at=public.entity_job_next_time(j.daily_time,j.timezone,now()) where id=j.id;
 return jsonb_build_object('job',to_jsonb(j),'run',to_jsonb(r),'kind',e.kind,'instance_id',instance);
end $$;

create function public.entity_job_export(p_run_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare j public.entity_jobs; rows jsonb; kind public.entity_kind;
begin
 select q.* into j from public.entity_jobs q join public.entity_job_runs r on r.job_id=q.id where r.id=p_run_id and r.status='running' for update of q;
 if j.id is null or not j.enabled or j.action<>'csv_s3' then raise exception 'Export job not available'; end if;
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

create function public.execute_entity_cleanup(p_run_id uuid) returns integer language plpgsql security invoker set search_path=public as $$
declare j public.entity_jobs; n integer;
begin
 select q.* into j from public.entity_jobs q join public.entity_job_runs r on r.job_id=q.id where r.id=p_run_id and r.status='running' for update of q,r;
 if j.id is null or not j.enabled or j.action<>'cleanup' then raise exception 'Cleanup job not available'; end if;
 if not exists(select 1 from public.chatbot_entities e where e.id=j.entity_id and e.kind='dynamic' and e.deleted_at is null) then raise exception 'Entity not available'; end if;
 -- Lock candidates and cap each run. Rechecking in DELETE protects freshly updated rows.
 with candidates as (select id from public.entity_dynamic_records where entity_id=j.entity_id and updated_at<now()-make_interval(days=>j.stale_days) and values->>j.filter_key=j.filter_value order by updated_at,id limit 1000 for update skip locked)
 delete from public.entity_dynamic_records d using candidates c where d.id=c.id and d.entity_id=j.entity_id and d.updated_at<now()-make_interval(days=>j.stale_days) and d.values->>j.filter_key=j.filter_value;
 get diagnostics n = row_count;
 update public.entity_job_runs set status='succeeded',finished_at=now(),row_count=n where id=p_run_id;
 return n;
end $$;
revoke all on function public.claim_entity_job(),public.entity_job_export(uuid),public.execute_entity_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.claim_entity_job(),public.entity_job_export(uuid),public.execute_entity_cleanup(uuid) to service_role;
revoke all on function public.preview_entity_cleanup(uuid),public.validate_entity_job(),public.entity_job_next_time(time,text,timestamptz) from public,anon;
grant execute on function public.preview_entity_cleanup(uuid),public.entity_job_next_time(time,text,timestamptz) to authenticated,service_role;
notify pgrst,'reload schema';
