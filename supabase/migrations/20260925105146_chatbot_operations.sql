-- Opt-in operational controls. No existing chatbot is made public or republished.
create table public.chatbot_operations (
 chatbot_id uuid primary key references public.chatbots(id) on delete cascade,
 settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
 updated_at timestamptz not null default now()
);
alter table public.chatbot_operations enable row level security;
grant select,insert,update on public.chatbot_operations to authenticated;
create policy operations_read on public.chatbot_operations for select to authenticated using (exists(select 1 from public.chatbots b where b.id=chatbot_id and public.is_instance_member(b.instance_id)));
create policy operations_manage on public.chatbot_operations for all to authenticated using (exists(select 1 from public.chatbots b where b.id=chatbot_id and public.has_instance_role(b.instance_id,array['owner','admin']::public.instance_role[]))) with check (exists(select 1 from public.chatbots b where b.id=chatbot_id and public.has_instance_role(b.instance_id,array['owner','admin']::public.instance_role[])));

create table public.flow_modules (
 id uuid primary key default gen_random_uuid(), instance_id uuid not null references public.instances(id) on delete cascade,
 name text not null check(length(name) between 1 and 100), graph jsonb not null check(jsonb_typeof(graph)='object'),
 inputs jsonb not null default '[]'::jsonb check(jsonb_typeof(inputs)='array'), outputs jsonb not null default '[]'::jsonb check(jsonb_typeof(outputs)='array'),
 revision integer not null default 1, updated_at timestamptz not null default now(), created_by uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.flow_modules enable row level security;
grant select,insert,update,delete on public.flow_modules to authenticated;
create policy modules_read on public.flow_modules for select to authenticated using(public.is_instance_member(instance_id));
create policy modules_write on public.flow_modules for all to authenticated using(public.has_instance_role(instance_id,array['owner','admin','editor']::public.instance_role[])) with check(public.has_instance_role(instance_id,array['owner','admin','editor']::public.instance_role[]));

create table public.saved_replies (
 id uuid primary key default gen_random_uuid(), instance_id uuid not null references public.instances(id) on delete cascade,
 title text not null check(length(title) between 1 and 100), body text not null check(length(body) between 1 and 10000), created_at timestamptz not null default now()
);
alter table public.saved_replies enable row level security;
grant select,insert,update,delete on public.saved_replies to authenticated;
create policy replies_read on public.saved_replies for select to authenticated using(public.is_instance_member(instance_id));
create policy replies_write on public.saved_replies for all to authenticated using(public.has_instance_role(instance_id,array['owner','admin','editor']::public.instance_role[])) with check(public.has_instance_role(instance_id,array['owner','admin','editor']::public.instance_role[]));

create table public.flow_release_reviews (
 id uuid primary key default gen_random_uuid(), flow_id uuid not null references public.chatbot_flows(id) on delete cascade,
 graph jsonb not null, fingerprint text not null, requested_by uuid not null references auth.users(id), requested_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','approved','rejected','used')), reviewed_by uuid references auth.users(id), reviewed_at timestamptz, note text
);
alter table public.flow_release_reviews enable row level security;
grant select on public.flow_release_reviews to authenticated;
create policy reviews_read on public.flow_release_reviews for select to authenticated using(exists(select 1 from public.chatbot_flows f join public.chatbots b on b.id=f.chatbot_id where f.id=flow_id and public.is_instance_member(b.instance_id)));
create function public.release_fingerprint(p_graph jsonb) returns text language sql immutable set search_path=public as $$ select encode(sha256(convert_to((p_graph-'publishedAt'-'publishVersion')::text,'UTF8')),'hex') $$;
create function public.request_release_review(p_flow_id uuid,p_graph jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare v_instance uuid; v_id uuid;
begin
 select b.instance_id into v_instance from public.chatbot_flows f join public.chatbots b on b.id=f.chatbot_id where f.id=p_flow_id and b.deleted_at is null;
 if auth.uid() is null or v_instance is null or not public.has_instance_role(v_instance,array['owner','admin','editor']::public.instance_role[]) then raise exception 'Not allowed'; end if;
 if p_graph->>'kind'<>'flowforge.publishedGraph' or jsonb_typeof(p_graph->'nodes') is distinct from 'array' then raise exception 'Invalid release graph'; end if;
 insert into public.flow_release_reviews(flow_id,graph,fingerprint,requested_by) values(p_flow_id,p_graph,public.release_fingerprint(p_graph),auth.uid()) returning id into v_id;
 perform public.write_audit_event(v_instance,'release.review_requested','flow',p_flow_id::text,jsonb_build_object('review_id',v_id)); return v_id;
end $$;
create function public.decide_release_review(p_review_id uuid,p_approve boolean,p_note text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_review public.flow_release_reviews; v_instance uuid;
begin
 select * into v_review from public.flow_release_reviews where id=p_review_id for update;
 select b.instance_id into v_instance from public.chatbot_flows f join public.chatbots b on b.id=f.chatbot_id where f.id=v_review.flow_id;
 if auth.uid() is null or v_instance is null or not public.has_instance_role(v_instance,array['owner','admin']::public.instance_role[]) then raise exception 'Not allowed'; end if;
 if v_review.requested_by=auth.uid() then raise exception 'Another administrator must review this release'; end if;
 if v_review.status<>'pending' then raise exception 'Review already decided'; end if;
 update public.flow_release_reviews set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),note=left(p_note,2000) where id=p_review_id;
 perform public.write_audit_event(v_instance,'release.review_decided','flow',v_review.flow_id::text,jsonb_build_object('approved',p_approve,'review_id',p_review_id));
end $$;
create function public.enforce_release_review() returns trigger language plpgsql security definer set search_path=public as $$
declare v_review uuid;
begin
 if new.published_graph is not distinct from old.published_graph then return new; end if;
 if not exists(select 1 from public.chatbot_operations where chatbot_id=new.chatbot_id and settings->>'requireApproval'='true') then return new; end if;
 select id into v_review from public.flow_release_reviews where flow_id=new.id and status='approved' and fingerprint=public.release_fingerprint(new.published_graph) order by reviewed_at desc limit 1 for update;
 if v_review is null then raise exception 'This exact release needs approval from another administrator before publishing'; end if;
 update public.flow_release_reviews set status='used' where id=v_review;
 return new;
end $$;
create trigger require_release_review before update of published_graph on public.chatbot_flows for each row execute function public.enforce_release_review();
revoke all on function public.request_release_review(uuid,jsonb), public.decide_release_review(uuid,boolean,text), public.enforce_release_review() from public,anon;
grant execute on function public.request_release_review(uuid,jsonb), public.decide_release_review(uuid,boolean,text) to authenticated;

-- Checkpoints are only accessible through an unguessable, hashed capability. No table access for visitors or members.
create table public.conversation_checkpoints (
 session_id uuid primary key references public.conversation_sessions(id) on delete cascade, token_hash text not null unique,
 snapshot jsonb, revision integer not null default 0, expires_at timestamptz not null, updated_at timestamptz not null default now()
);
alter table public.conversation_checkpoints enable row level security;
revoke all on public.conversation_checkpoints from anon,authenticated;
create function public.public_chat_operations(p_session_id uuid) returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('resumeHours',coalesce(o.settings->'resumeHours','0'::jsonb),'sensitiveVariables',coalesce(o.settings->'sensitiveVariables','[]'::jsonb),'consentText',coalesce(o.settings->'consentText','""'::jsonb),'defaultLocale',coalesce(o.settings->'defaultLocale','"en"'::jsonb)) from public.conversation_sessions s left join public.chatbot_operations o on o.chatbot_id=s.chatbot_id where s.id=p_session_id and s.status='active'
$$;
create function public.create_conversation_checkpoint(p_session_id uuid,p_visitor_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_token text:=gen_random_uuid()::text||gen_random_uuid()::text; v_hours integer; v_expires timestamptz;
begin
 select least(168,greatest(0,coalesce((o.settings->>'resumeHours')::integer,0))) into v_hours from public.conversation_sessions s join public.chatbot_operations o on o.chatbot_id=s.chatbot_id where s.id=p_session_id and s.visitor_key=p_visitor_key and length(p_visitor_key)>10 and s.status='active';
 if coalesce(v_hours,0)=0 then return null; end if;
 v_expires:=now()+make_interval(hours=>v_hours);
 insert into public.conversation_checkpoints(session_id,token_hash,expires_at) values(p_session_id,encode(sha256(convert_to(v_token,'UTF8')),'hex'),v_expires) on conflict(session_id) do nothing;
 if not found then return null; end if;
 return jsonb_build_object('token',v_token,'revision',0,'expiresAt',v_expires);
end $$;
create function public.load_conversation_checkpoint(p_token text) returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('snapshot',c.snapshot,'revision',c.revision,'sessionId',c.session_id,'expiresAt',c.expires_at) from public.conversation_checkpoints c join public.conversation_sessions s on s.id=c.session_id join public.chatbots b on b.id=s.chatbot_id join public.chatbot_operations o on o.chatbot_id=b.id where c.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and c.expires_at>now() and s.status='active' and b.deleted_at is null and b.public_enabled and coalesce((o.settings->>'resumeHours')::integer,0)>0
$$;
create function public.save_conversation_checkpoint(p_token text,p_revision integer,p_snapshot jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare v_revision integer;
begin
 if octet_length(p_snapshot::text)>1048576 then raise exception 'Conversation too large to resume'; end if;
 update public.conversation_checkpoints c set snapshot=p_snapshot,revision=revision+1,updated_at=now() from public.conversation_sessions s where c.session_id=s.id and c.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and c.expires_at>now() and c.revision=p_revision and s.status='active' and exists(select 1 from public.chatbots b join public.chatbot_operations o on o.chatbot_id=b.id where b.id=s.chatbot_id and b.deleted_at is null and b.public_enabled and coalesce((o.settings->>'resumeHours')::integer,0)>0) returning c.revision into v_revision;
 if v_revision is null then raise exception 'Checkpoint expired or updated in another tab'; end if; return v_revision;
end $$;
revoke all on function public.public_chat_operations(uuid),public.create_conversation_checkpoint(uuid,text),public.load_conversation_checkpoint(text),public.save_conversation_checkpoint(text,integer,jsonb) from public;
grant execute on function public.public_chat_operations(uuid),public.create_conversation_checkpoint(uuid,text),public.load_conversation_checkpoint(text),public.save_conversation_checkpoint(text,integer,jsonb) to anon,authenticated;

-- One guarded replay per failed delivery. Uncertain network results are never automatically replayed.
create table public.webhook_replay_claims (
 delivery_id uuid primary key references public.webhook_deliveries(id) on delete cascade, claimed_by uuid not null references auth.users(id),
 claimed_at timestamptz not null default now(), result jsonb
);
alter table public.webhook_replay_claims enable row level security;
revoke all on public.webhook_replay_claims from anon,authenticated;
create function public.claim_webhook_replay(p_delivery_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_delivery public.webhook_deliveries; v_hook public.instance_webhooks;
begin
 select * into v_delivery from public.webhook_deliveries where id=p_delivery_id;
 select * into v_hook from public.instance_webhooks where id=v_delivery.webhook_id;
 if auth.uid() is null or v_hook.id is null or not public.has_instance_role(v_hook.instance_id,array['owner','admin']::public.instance_role[]) then raise exception 'Not allowed'; end if;
 if v_delivery.ok or v_delivery.status_code is null or v_delivery.status_code not in (401,403,404,422,429) then raise exception 'Delivery may already have been accepted; inspect the destination before replaying'; end if;
 if not v_hook.enabled then raise exception 'Enable the webhook before replaying'; end if;
 insert into public.webhook_replay_claims(delivery_id,claimed_by) values(p_delivery_id,auth.uid()) on conflict do nothing;
 if not found then raise exception 'This delivery has already been claimed for replay'; end if;
 perform public.write_audit_event(v_hook.instance_id,'webhook.replay_claimed','webhook_delivery',p_delivery_id::text,'{}');
 return jsonb_build_object('hook',to_jsonb(v_hook),'event',v_delivery.event,'payload',v_delivery.payload);
end $$;
revoke all on function public.claim_webhook_replay(uuid) from public,anon;
grant execute on function public.claim_webhook_replay(uuid) to authenticated;

-- Track operational edits and secret rotation without putting credentials into audit metadata.
create function public.audit_operations_change() returns trigger language plpgsql security definer set search_path=public as $$
declare v_instance uuid; v_id text;
begin
 if tg_table_name='connection_secrets' then select instance_id into v_instance from public.connections where id=new.connection_id; v_id:=new.connection_id::text;
 elsif tg_table_name='chatbot_operations' then select instance_id into v_instance from public.chatbots where id=new.chatbot_id; v_id:=new.chatbot_id::text;
 else v_instance:=new.instance_id; v_id:=new.id::text; end if;
 if tg_table_name='flow_modules' and tg_op='UPDATE' then new.revision:=old.revision+1; new.updated_at:=now(); end if;
 perform public.write_audit_event(v_instance,tg_table_name||'.'||lower(tg_op),tg_table_name,v_id,jsonb_build_object('changed_by',auth.uid())); return new;
end $$;
revoke all on function public.audit_operations_change() from public,anon,authenticated;
create trigger audit_operations before insert or update on public.chatbot_operations for each row execute function public.audit_operations_change();
create trigger audit_modules before insert or update on public.flow_modules for each row execute function public.audit_operations_change();
create trigger audit_secret_rotation after insert or update on public.connection_secrets for each row execute function public.audit_operations_change();
create trigger audit_saved_replies after insert or update on public.saved_replies for each row execute function public.audit_operations_change();
create or replace function public.connection_config_for_public_chat(p_connection_id uuid,p_chatbot_id uuid,p_session_id uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_session public.conversation_sessions; v_bot public.chatbots; v_target uuid:=p_connection_id; v_binding jsonb; v_kind public.connection_kind; v_config jsonb;
begin
 select * into v_session from public.conversation_sessions where id=p_session_id;
 if v_session.id is null or v_session.chatbot_id<>p_chatbot_id or v_session.status<>'active' then return null; end if;
 select * into v_bot from public.chatbots where id=p_chatbot_id and deleted_at is null;
 if v_bot.id is null or (v_session.environment<>'staging' and not v_bot.public_enabled) then return null; end if;
 select c.kind into v_kind from public.connections c where c.id=p_connection_id and c.instance_id=v_bot.instance_id and c.deleted_at is null and (c.chatbot_id=p_chatbot_id or exists(select 1 from public.chatbot_connections cc where cc.chatbot_id=p_chatbot_id and cc.connection_id=c.id));
 if v_kind is null then return null; end if;
 select settings->'connectionBindings'->p_connection_id::text into v_binding from public.chatbot_operations where chatbot_id=p_chatbot_id;
 if v_binding is not null then
  if coalesce(v_binding->>v_session.environment,'')='' then raise exception 'No connection binding for this environment'; end if;
  v_target:=(v_binding->>v_session.environment)::uuid;
 end if;
 if not exists(select 1 from public.connections c where c.id=v_target and c.instance_id=v_bot.instance_id and c.kind=v_kind and c.deleted_at is null and (c.chatbot_id=p_chatbot_id or exists(select 1 from public.chatbot_connections cc where cc.chatbot_id=p_chatbot_id and cc.connection_id=c.id))) then return null; end if;
 select config into v_config from public.connection_secrets where connection_id=v_target; return v_config;
end $$;
revoke all on function public.connection_config_for_public_chat(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.connection_config_for_public_chat(uuid,uuid,uuid) to service_role;
create function public.claim_conversation_input(p_token text,p_revision integer) returns integer language plpgsql security definer set search_path=public as $$
declare v_revision integer;
begin
 update public.conversation_checkpoints c set snapshot=null,revision=revision+1,updated_at=now() from public.conversation_sessions s where s.id=c.session_id and s.status='active' and c.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and c.expires_at>now() and c.revision=p_revision and exists(select 1 from public.chatbots b join public.chatbot_operations o on o.chatbot_id=b.id where b.id=s.chatbot_id and b.deleted_at is null and b.public_enabled and coalesce((o.settings->>'resumeHours')::integer,0)>0) returning c.revision into v_revision;
 if v_revision is null then raise exception 'This conversation changed in another tab or expired. Reload to continue.'; end if; return v_revision;
end $$;
revoke all on function public.claim_conversation_input(text,integer) from public;
grant execute on function public.claim_conversation_input(text,integer) to anon,authenticated;
alter table public.entity_attributes add column validation_rules jsonb not null default '{}'::jsonb check(jsonb_typeof(validation_rules)='object');
create function public.check_entity_rules() returns trigger language plpgsql security definer set search_path=public as $$
declare a record; v jsonb; r jsonb; target uuid; target_key text; v_instance uuid; match_found boolean; old_value jsonb;
begin
 select b.instance_id into v_instance from public.chatbot_entities e join public.chatbots b on b.id=e.chatbot_id where e.id=case when tg_op='DELETE' then old.entity_id else new.entity_id end;
 perform pg_advisory_xact_lock(hashtextextended('entity-rules:'||v_instance::text,0));
 if tg_op<>'DELETE' then
  for a in select key,validation_rules from public.entity_attributes where entity_id=new.entity_id loop
   r:=a.validation_rules; v:=new.values->a.key;
   if v is null or v='null'::jsonb or v='""'::jsonb then continue; end if;
   if r ? 'min' and (jsonb_typeof(v)<>'number' or (v::text)::numeric<(r->>'min')::numeric) then raise exception '% is below its minimum',a.key; end if;
   if r ? 'max' and (jsonb_typeof(v)<>'number' or (v::text)::numeric>(r->>'max')::numeric) then raise exception '% exceeds its maximum',a.key; end if;
   if r ? 'maxLength' and length(v#>>'{}')>(r->>'maxLength')::integer then raise exception '% exceeds its maximum length',a.key; end if;
   if coalesce(r->>'referenceEntityId','')<>'' then
    target:=(r->>'referenceEntityId')::uuid;target_key:=coalesce(nullif(r->>'referenceAttribute',''),'id');
    if not exists(select 1 from public.chatbot_entities e join public.chatbots b on b.id=e.chatbot_id join public.entity_attributes ea on ea.entity_id=e.id where e.id=target and b.instance_id=v_instance and ea.key=target_key and ea.is_unique) then raise exception 'Relationship must target a unique field in the same organisation'; end if;
    select exists(select 1 from public.entity_static_records where entity_id=target and values->target_key=v union all select 1 from public.entity_dynamic_records where entity_id=target and values->target_key=v) into match_found;
    if not match_found then raise exception '% refers to a missing record',a.key; end if;
   end if;
  end loop;
 end if;
 if tg_op in ('UPDATE','DELETE') then
  for a in select entity_id,key,validation_rules from public.entity_attributes where validation_rules->>'referenceEntityId'=old.entity_id::text loop
   target_key:=coalesce(nullif(a.validation_rules->>'referenceAttribute',''),'id');old_value:=old.values->target_key;
   if tg_op='UPDATE' and new.values->target_key is not distinct from old_value then continue; end if;
   if old_value is null then continue; end if;
   if exists(select 1 from public.entity_static_records where entity_id=a.entity_id and values->a.key=old_value union all select 1 from public.entity_dynamic_records where entity_id=a.entity_id and values->a.key=old_value) then raise exception 'Record is referenced by another entity; update those references first'; end if;
  end loop;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.check_entity_rules() from public,anon,authenticated;
create trigger enforce_entity_rules before insert or update or delete on public.entity_static_records for each row execute function public.check_entity_rules();
create trigger enforce_entity_rules before insert or update or delete on public.entity_dynamic_records for each row execute function public.check_entity_rules();

create index flow_modules_instance_idx on public.flow_modules(instance_id);
create index saved_replies_instance_idx on public.saved_replies(instance_id);
create index release_reviews_flow_idx on public.flow_release_reviews(flow_id,requested_at desc);
create index release_reviews_requester_idx on public.flow_release_reviews(requested_by);
create index release_reviews_reviewer_idx on public.flow_release_reviews(reviewed_by);
create index flow_modules_creator_idx on public.flow_modules(created_by);
create index checkpoint_expiry_idx on public.conversation_checkpoints(expires_at);
create index replay_claim_actor_idx on public.webhook_replay_claims(claimed_by);
create index entity_reference_rules_idx on public.entity_attributes((validation_rules->>'referenceEntityId')) where validation_rules ? 'referenceEntityId';
