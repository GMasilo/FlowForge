import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { PGlite } = await import(pathToFileURL(join(tmpdir(),'flowforge-operations-db/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
// Minimal existing schema, with real PostgreSQL roles/RLS and deterministic auth claims.
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key);
create type public.instance_role as enum('owner','admin','editor','viewer','agent');
create type public.connection_kind as enum('http','email','payment','database');
create table public.instances(id uuid primary key);
create table public.members(instance_id uuid,user_id uuid,role public.instance_role);
create function public.has_instance_role(p uuid,roles public.instance_role[]) returns boolean language sql security definer set search_path=public as $$ select exists(select 1 from public.members where instance_id=p and user_id=auth.uid() and role=any(roles)) $$;
create function public.is_instance_member(p uuid) returns boolean language sql security definer set search_path=public as $$ select exists(select 1 from public.members where instance_id=p and user_id=auth.uid()) $$;
create table public.chatbots(id uuid primary key,instance_id uuid references public.instances,deleted_at timestamptz,public_enabled boolean default true);
create table public.chatbot_flows(id uuid primary key,chatbot_id uuid references public.chatbots,published_graph jsonb);
create table public.conversation_sessions(id uuid primary key,chatbot_id uuid references public.chatbots,visitor_key text,status text default 'active',environment text default 'production');
create table public.connections(id uuid primary key,instance_id uuid,chatbot_id uuid,kind public.connection_kind,deleted_at timestamptz);
create table public.chatbot_connections(chatbot_id uuid,connection_id uuid);
create table public.connection_secrets(connection_id uuid primary key,config jsonb);
create table public.instance_webhooks(id uuid primary key,instance_id uuid,enabled boolean default true);
create table public.webhook_deliveries(id uuid primary key,webhook_id uuid references public.instance_webhooks,ok boolean,status_code integer,event text,payload jsonb);
create table public.chatbot_entities(id uuid primary key,chatbot_id uuid references public.chatbots);
create table public.entity_attributes(id uuid primary key,entity_id uuid references public.chatbot_entities,key text,is_unique boolean default false);
create table public.entity_static_records(id uuid primary key,entity_id uuid references public.chatbot_entities,values jsonb);
create table public.entity_dynamic_records(id uuid primary key,entity_id uuid references public.chatbot_entities,values jsonb);
create table public.test_audit(instance_id uuid,action text,meta jsonb);
create function public.write_audit_event(p_instance_id uuid,p_action text,p_resource_type text,p_resource_id text,p_meta jsonb) returns void language sql security definer set search_path=public as $$ insert into public.test_audit values(p_instance_id,p_action,p_meta) $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant select on public.chatbots,public.chatbot_flows to authenticated;
`)
await db.exec(await readFile(new URL('../../supabase/migrations/20260925105146_chatbot_operations.sql',import.meta.url),'utf8'))
const ids={org:'10000000-0000-4000-8000-000000000001',other:'10000000-0000-4000-8000-000000000002',admin:'20000000-0000-4000-8000-000000000001',reviewer:'20000000-0000-4000-8000-000000000002',viewer:'20000000-0000-4000-8000-000000000003',outsider:'20000000-0000-4000-8000-000000000004',bot:'30000000-0000-4000-8000-000000000001',flow:'40000000-0000-4000-8000-000000000001',session:'50000000-0000-4000-8000-000000000001',hook:'60000000-0000-4000-8000-000000000001',delivery:'70000000-0000-4000-8000-000000000001'}
await db.exec(`insert into public.instances values('${ids.org}'),('${ids.other}');insert into auth.users values('${ids.admin}'),('${ids.reviewer}'),('${ids.viewer}'),('${ids.outsider}');insert into public.members values('${ids.org}','${ids.admin}','admin'),('${ids.org}','${ids.reviewer}','admin'),('${ids.org}','${ids.viewer}','viewer'),('${ids.other}','${ids.outsider}','admin');insert into public.chatbots values('${ids.bot}','${ids.org}',null,true);insert into public.chatbot_flows values('${ids.flow}','${ids.bot}','{}');insert into public.conversation_sessions(id,chatbot_id,visitor_key) values('${ids.session}','${ids.bot}','test-visitor-key-123');insert into public.instance_webhooks values('${ids.hook}','${ids.org}',true);insert into public.webhook_deliveries values('${ids.delivery}','${ids.hook}',false,401,'test','{}');`)
async function role(user, name='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${user??''}',false);set role ${name};`)}
async function rejects(sql, pattern){await assert.rejects(db.exec(sql),pattern)}
let checks=0
await role(ids.admin)
await db.exec(`insert into public.chatbot_operations values('${ids.bot}','{"resumeHours":24,"requireApproval":true}',now())`);checks++
await role(ids.viewer)
await rejects(`update public.chatbot_operations set settings='{}' where chatbot_id='${ids.bot}'`, /row-level security|permission denied/).catch(async error=>{const result=await db.query(`select settings from public.chatbot_operations where chatbot_id='${ids.bot}'`);assert.equal(result.rows[0].settings.requireApproval,true)});checks++
await role(ids.outsider)
assert.equal((await db.query('select * from public.chatbot_operations')).rows.length,0);checks++
await rejects(`select public.request_release_review('${ids.flow}','{"kind":"flowforge.publishedGraph","nodes":[]}')`,/Not allowed/);checks++
await role(ids.admin)
const graph={kind:'flowforge.publishedGraph',nodes:[],edges:[],publishedAt:'first',publishVersion:1}
const {rows:[{id:review}]}=await db.query('select public.request_release_review($1,$2) as id',[ids.flow,graph]);
await rejects(`select public.decide_release_review('${review}',true)`,/Another administrator/);checks++
await role(ids.reviewer)
await db.exec(`select public.decide_release_review('${review}',true)`)
await db.exec('reset role')
await rejects(`update public.chatbot_flows set published_graph='{"kind":"flowforge.publishedGraph","nodes":[1]}' where id='${ids.flow}'`,/needs approval/);checks++
await db.query('update public.chatbot_flows set published_graph=$1 where id=$2',[{...graph,publishedAt:'second',publishVersion:2},ids.flow]);
assert.equal((await db.query('select status from public.flow_release_reviews where id=$1',[review])).rows[0].status,'used');checks++
await role(null,'anon')
await rejects(`select * from public.conversation_checkpoints`,/permission denied/);checks++
const wrong=await db.query('select public.create_conversation_checkpoint($1,$2) as result',[ids.session,'wrong']);assert.equal(wrong.rows[0].result,null);checks++
const ticket=(await db.query('select public.create_conversation_checkpoint($1,$2) as result',[ids.session,'test-visitor-key-123'])).rows[0].result;assert.ok(ticket.token);checks++
assert.equal((await db.query('select public.save_conversation_checkpoint($1,0,$2) as revision',[ticket.token,{state:'waiting'}])).rows[0].revision,1);checks++
await rejects(`select public.save_conversation_checkpoint('${ticket.token}',0,'{}')`,/updated in another tab/);checks++
assert.equal((await db.query('select public.claim_conversation_input($1,1) as revision',[ticket.token])).rows[0].revision,2);checks++
assert.equal((await db.query('select public.load_conversation_checkpoint($1) as result',[ticket.token])).rows[0].result.snapshot,null);checks++
await rejects(`select public.claim_conversation_input('${ticket.token}',1)`,/changed in another tab/);checks++
assert.equal((await db.query("select public.load_conversation_checkpoint('unknown') as result")).rows[0].result,null);checks++
await role(ids.admin)
await db.exec(`select public.claim_webhook_replay('${ids.delivery}')`);checks++
await rejects(`select public.claim_webhook_replay('${ids.delivery}')`,/already been claimed/);checks++
await db.exec('reset role')
await db.exec(`update public.webhook_deliveries set status_code=504 where id='${ids.delivery}'`)
await role(ids.admin)
await rejects(`select public.claim_webhook_replay('${ids.delivery}')`,/may already have been accepted/);checks++
await db.exec('reset role')
const parent='80000000-0000-4000-8000-000000000001',child='80000000-0000-4000-8000-000000000002'
await db.exec(`insert into public.chatbot_entities values('${parent}','${ids.bot}'),('${child}','${ids.bot}');insert into public.entity_attributes(id,entity_id,key,is_unique,validation_rules) values(gen_random_uuid(),'${parent}','id',true,'{}'),(gen_random_uuid(),'${child}','parent',false,'{"referenceEntityId":"${parent}","referenceAttribute":"id"}');insert into public.entity_static_records values(gen_random_uuid(),'${parent}','{"id":"parent-1"}');`)
await rejects(`insert into public.entity_dynamic_records values(gen_random_uuid(),'${child}','{"parent":"missing"}')`,/missing record/);checks++
await db.exec(`insert into public.entity_dynamic_records values(gen_random_uuid(),'${child}','{"parent":"parent-1"}')`);checks++
await rejects(`delete from public.entity_static_records where entity_id='${parent}'`,/referenced by another entity/);checks++

// Credential routing is server-only, environment-specific and organisation-scoped.
const original='90000000-0000-4000-8000-000000000001',sandbox='90000000-0000-4000-8000-000000000002',foreign='90000000-0000-4000-8000-000000000003'
await db.exec(`insert into public.connections values('${original}','${ids.org}','${ids.bot}','http',null),('${sandbox}','${ids.org}','${ids.bot}','http',null),('${foreign}','${ids.other}',null,'http',null);insert into public.connection_secrets values('${original}','{"token":"production-secret"}'),('${sandbox}','{"token":"sandbox-secret"}'),('${foreign}','{"token":"foreign-secret"}');update public.chatbot_operations set settings=settings||'{"connectionBindings":{"${original}":{"production":"${original}","staging":"${sandbox}"}}}' where chatbot_id='${ids.bot}';`)
await role(null,'anon')
await rejects(`select public.connection_config_for_public_chat('${original}','${ids.bot}','${ids.session}')`,/permission denied/);checks++
await role(null,'service_role')
assert.equal((await db.query(`select public.connection_config_for_public_chat('${original}','${ids.bot}','${ids.session}') as result`)).rows[0].result.token,'production-secret');checks++
await db.exec('reset role')
await db.exec(`update public.conversation_sessions set environment='staging' where id='${ids.session}'`)
await role(null,'service_role')
assert.equal((await db.query(`select public.connection_config_for_public_chat('${original}','${ids.bot}','${ids.session}') as result`)).rows[0].result.token,'sandbox-secret');checks++
await db.exec('reset role')
await db.exec(`update public.chatbot_operations set settings=jsonb_set(settings,'{connectionBindings,${original},staging}','"${foreign}"') where chatbot_id='${ids.bot}'`)
await role(null,'service_role')
assert.equal((await db.query(`select public.connection_config_for_public_chat('${original}','${ids.bot}','${ids.session}') as result`)).rows[0].result,null);checks++
await db.exec('reset role')
assert.ok(!(await db.query('select meta from public.test_audit')).rows.some(r=>JSON.stringify(r.meta).includes('-secret')));checks++
await db.exec(`update public.chatbot_operations set settings=jsonb_set(settings,'{resumeHours}','0') where chatbot_id='${ids.bot}'`)
await role(null,'anon')
assert.equal((await db.query('select public.load_conversation_checkpoint($1) as result',[ticket.token])).rows[0].result,null);checks++
await rejects(`select public.save_conversation_checkpoint('${ticket.token}',2,'{}')`,/expired/);checks++
await rejects(`select public.claim_conversation_input('${ticket.token}',2)`,/expired/);checks++
await db.exec('reset role')
await db.exec(`update public.entity_attributes set validation_rules='{"maxLength":3}' where entity_id='${child}'`)
await rejects(`insert into public.entity_dynamic_records values(gen_random_uuid(),'${child}','{"parent":"long value"}')`,/length|characters|long/i);checks++

console.log(`${checks} PostgreSQL integration checks passed; isolated database only.`)
await db.close()
