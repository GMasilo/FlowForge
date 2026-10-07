// Isolated PostgreSQL tests. PGLITE_PATH may point to an installed PGlite module.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
process.on('uncaughtException', error => { console.error(error.message, error.where ?? '', error.query ?? ''); process.exit(1) })
const { PGlite } = await import(process.env.PGLITE_PATH || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to public;
create table auth.users(id uuid primary key,email text);
create type public.instance_role as enum('owner','admin','editor','viewer');
create type public.entity_kind as enum('static','dynamic');
create table public.instances(id uuid primary key);
create table public.instance_members(instance_id uuid,user_id uuid,role public.instance_role);
create table public.chatbots(id uuid primary key,instance_id uuid,created_by uuid,deleted_at timestamptz);
create table public.chatbot_shares(chatbot_id uuid,user_id uuid);
create table public.chatbot_flows(id uuid primary key,chatbot_id uuid);
create table public.flow_nodes(id uuid primary key default gen_random_uuid(),flow_id uuid,key text);
create table public.flow_comments(id uuid primary key default gen_random_uuid(),flow_id uuid,instance_id uuid,node_key text,parent_id uuid,author_id uuid,body text,resolved_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());
alter table public.flow_comments enable row level security;
create table public.user_notifications(id uuid default gen_random_uuid(),instance_id uuid,user_id uuid,kind text,title text,body text,href text,resource_type text,resource_id text,meta jsonb);
create table public.connections(id uuid primary key, instance_id uuid, chatbot_id uuid, kind text, deleted_at timestamptz);
create table public.chatbot_connections(chatbot_id uuid, connection_id uuid);
create table public.connection_secrets(connection_id uuid, config jsonb);
create table public.chatbot_entities(id uuid primary key,chatbot_id uuid,kind public.entity_kind,deleted_at timestamptz);
create table public.entity_attributes(entity_id uuid,key text,value_type text);
create table public.entity_dynamic_records(id uuid primary key default gen_random_uuid(),entity_id uuid,values jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.entity_static_records(id uuid primary key default gen_random_uuid(),entity_id uuid,values jsonb);
create function public.has_instance_role(i uuid,roles public.instance_role[]) returns boolean language sql stable security definer as $$select exists(select 1 from public.instance_members where instance_id=i and user_id=auth.uid() and role=any(roles))$$;
create function public.can_access_chatbot(bot uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.chatbots b join public.instance_members m on m.instance_id=b.instance_id where b.id=bot and m.user_id=auth.uid() and (m.role in ('owner','admin') or b.created_by=m.user_id or exists(select 1 from public.chatbot_shares where chatbot_id=b.id and user_id=m.user_id)))$$;
create function public.can_access_flow(f uuid) returns boolean language sql stable security definer as $$select public.can_access_chatbot(chatbot_id) from public.chatbot_flows where id=f$$;
create function public.can_manage_entity(e uuid) returns boolean language sql stable security definer as $$select public.can_access_chatbot(chatbot_id) from public.chatbot_entities where id=e and deleted_at is null$$;
create function public.write_audit_event(uuid,text,text,text,jsonb) returns void language sql as $$select$$;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
`)
await db.exec(await readFile(new URL('../../supabase/migrations/20261006142132_entity_jobs_step_reviews.sql', import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../../supabase/migrations/20261006144529_step_review_private_helpers.sql', import.meta.url),'utf8'))
await db.exec(await readFile(new URL('../../supabase/migrations/20261007082817_entity_job_destinations.sql', import.meta.url),'utf8'))
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const [admin, member, outsider, instance, bot, flow, entity] = [1,2,3,4,5,6,7].map(id)
await db.exec(`
insert into auth.users values('${admin}','admin@test.invalid'),('${member}','member@test.invalid'),('${outsider}','outsider@test.invalid');
insert into public.instances values('${instance}');
insert into public.instance_members values('${instance}','${admin}','admin'),('${instance}','${member}','editor');
insert into public.chatbots values('${bot}','${instance}','${admin}',null);
insert into public.chatbot_shares values('${bot}','${member}');
insert into public.chatbot_flows values('${flow}','${bot}');
insert into public.flow_nodes(flow_id,key) values('${flow}','ask_id');
insert into public.chatbot_entities values('${entity}','${bot}','dynamic',null);
insert into public.entity_attributes values('${entity}','status','string'),('${entity}','password','password');
insert into public.entity_dynamic_records(entity_id,values,updated_at) values('${entity}','{"status":"stale","password":"secret"}',now()-interval '100 days'),('${entity}','{"status":"active"}',now()-interval '100 days'),('${entity}','{"status":"stale"}',now());
`)
const as = async (user, role='authenticated') => { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role ${role}`) }
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
await as(admin)
const comment = await scalar(`select (public.add_step_review('${flow}','Please check @member@test.invalid','ask_id',null,array['${member}'::uuid])).id`)
assert.equal(await scalar(`select count(*)::int from public.flow_comments`),1)
await assert.rejects(db.query(`select public.add_step_review('${flow}','bad mention','ask_id',null,array['${outsider}'::uuid])`),/does not have access/)
await assert.rejects(db.query(`select public.add_step_review('${flow}','bad step','unsaved')`),/Save this step/)
await db.exec('reset role')
assert.equal(await scalar(`select count(*)::int from public.user_notifications where user_id='${member}' and href like '%?step=ask_id'`),1)
await as(outsider)
assert.equal(await scalar(`select count(*)::int from public.flow_comments`),0)
await assert.rejects(db.query(`select public.add_step_review('${flow}','intrusion','ask_id')`),/Not allowed/)
await assert.rejects(db.query(`select public.set_step_review_resolved('${comment}',true)`),/Not allowed/)
await as(member)
await db.query(`select public.set_step_review_resolved('${comment}',true)`)
assert.ok(await scalar(`select resolved_at from public.flow_comments where id='${comment}'`))
await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,filter_key,filter_value) values('${entity}','cleanup','cleanup','status','stale')`),/row-level security/)
await as(admin)
await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,destination,columns) values('${entity}','bad','csv_s3','test',array['password'])`),/password/)
await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,filter_key,filter_value,timezone) values('${entity}','bad','cleanup','status','stale','Not/AZone')`),/timezone/)
await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,filter_key,filter_value) values('${entity}','bad','cleanup','status',null)`),/check constraint/)
const job = await scalar(`insert into public.entity_jobs(entity_id,name,action,filter_key,filter_value) values('${entity}','cleanup','cleanup','status','stale') returning id`)
assert.equal(Number(await scalar(`select public.preview_entity_cleanup('${job}')`)),1)
await assert.rejects(db.query(`select public.claim_entity_job()`),/permission denied/)
await db.exec(`update public.entity_jobs set enabled=true where id='${job}'; update public.entity_jobs set next_run_at=now()-interval '1 minute' where id='${job}'`)
await as('', 'service_role')
const work = await scalar('select public.claim_entity_job()')
assert.equal(work.job.id,job)
assert.equal(await scalar('select public.claim_entity_job()'),null)
await as(admin)
await assert.rejects(db.query(`update public.entity_jobs set stale_days=1 where id='${job}'`),/job is running/)
await as('', 'service_role')
assert.equal(await scalar(`select public.execute_entity_cleanup('${work.run.id}')`),1)
await assert.rejects(db.query(`select public.execute_entity_cleanup('${work.run.id}')`),/not available/)
assert.equal(await scalar(`select count(*)::int from public.entity_dynamic_records`),2)
await as(admin)
const exp = await scalar(`insert into public.entity_jobs(entity_id,name,action,destination,columns) values('${entity}','export','csv_s3','test',array['status']) returning id`)
await db.exec(`update public.entity_jobs set enabled=true where id='${exp}'; update public.entity_jobs set next_run_at=now()-interval '1 minute' where id='${exp}'`)
await as('', 'service_role')
const expWork=await scalar('select public.claim_entity_job()')
const output=await scalar(`select public.entity_job_export('${expWork.run.id}')`)
assert.deepEqual(output.columns,['status']); assert.equal(output.rows.length,2); assert.ok(output.rows.every(row=>!('password' in row)))
await as(admin)
const next=await scalar(`select public.entity_job_next_time('01:00','Africa/Johannesburg','2026-10-06T00:00:00Z')`)
assert.equal(new Date(next).toISOString(),'2026-10-06T23:00:00.000Z')
await as(outsider)
assert.equal(await scalar('select count(*)::int from public.entity_jobs'),0)
assert.equal(await scalar('select count(*)::int from public.entity_job_runs'),0)
await db.exec('reset role')
const http = id(20), database = id(21), foreign = id(22), uninstalled = id(23)
await db.exec(`insert into public.connections values('${http}','${instance}','${bot}','http',null),('${database}','${instance}','${bot}','database',null),('${foreign}','${id(99)}','${bot}','http',null),('${uninstalled}','${instance}','${id(98)}','http',null);
insert into public.connection_secrets values('${http}','{"baseUrl":"https://example.test","bearerToken":"server-secret"}'),('${database}','{"provider":"postgres"}');`)
await as(admin)
for (const connection of [foreign, uninstalled, database]) {
 await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,connection_id,columns) values('${entity}','invalid API','http_api','${connection}',array['status'])`),/installed connection/)
}
await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,connection_id,columns) values('${entity}','password','http_api','${http}',array['password'])`),/password/)
await assert.rejects(db.query(`insert into public.entity_jobs(entity_id,name,action,connection_id,columns,target_table) values('${entity}','bad table','database','${database}',array['status'],'contacts; DROP TABLE contacts')`),/table/)
for (const [action, connection, table] of [['http_api', http, null],['database', database, 'public.contacts']]) {
 const exportJob = await scalar(`insert into public.entity_jobs(entity_id,name,action,connection_id,columns,target_table) values('${entity}','destination test','${action}','${connection}',array['status'],${table ? "'"+table+"'" : 'null'}) returning id`)
 await db.exec(`update public.entity_jobs set enabled=true where id='${exportJob}'; update public.entity_jobs set next_run_at=now()-interval '1 minute' where id='${exportJob}'`)
 await as('', 'service_role')
 const active = await scalar('select public.claim_entity_job()')
 assert.equal(active.job.id,exportJob)
 assert.equal((await scalar(`select public.entity_job_export('${active.run.id}')`)).rows.length,2)
 assert.ok(await scalar(`select public.entity_job_connection('${active.run.id}')`))
 await as(admin)
 await assert.rejects(db.query(`select public.entity_job_connection('${active.run.id}')`),/permission denied/)
 await db.exec('reset role')
 await db.exec(`update public.connections set deleted_at=now() where id='${connection}'`)
 await as('', 'service_role')
 await assert.rejects(db.query(`select public.entity_job_connection('${active.run.id}')`),/unavailable/)
 await db.exec(`update public.entity_job_runs set status='failed' where id='${active.run.id}'`)
 await as(admin)
}
await db.close()
console.log('Entity jobs and step review database checks passed (permissions, mentions, schedules, claims, cleanup and export).')
