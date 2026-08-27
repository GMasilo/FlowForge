-- Shared foundations for roadmap features: instance feature flags,
-- audit action vocabulary helper, Realtime publication for agent/collab tables.

-- ---------------------------------------------------------------------------
-- Feature flags on instances (roll out enterprise surfaces per org)
-- ---------------------------------------------------------------------------
alter table public.instances
  add column if not exists features jsonb not null default '{
    "agent_console": true,
    "experiments": true,
    "analytics_v2": true,
    "compliance": true,
    "staging": true,
    "sso": false,
    "marketplace": true,
    "collaborative_editing": true
  }'::jsonb;

comment on column public.instances.features is
  'Per-org feature flags: agent_console, experiments, analytics_v2, compliance, staging, sso, marketplace, collaborative_editing';

create or replace function public.instance_feature_enabled(
  p_instance_id uuid,
  p_feature text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (features ->> p_feature)::boolean
     from public.instances
     where id = p_instance_id),
    false
  );
$$;

grant execute on function public.instance_feature_enabled(uuid, text) to authenticated, anon, service_role;

create or replace function public.update_instance_features(
  p_instance_id uuid,
  p_features jsonb
)
returns public.instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.instances;
begin
  if not public.has_instance_role(p_instance_id, array['owner', 'admin']::public.instance_role[]) then
    raise exception 'Not allowed';
  end if;

  update public.instances
  set
    features = coalesce(features, '{}'::jsonb) || coalesce(p_features, '{}'::jsonb),
    updated_at = now()
  where id = p_instance_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Instance not found';
  end if;

  perform public.write_audit_event(
    p_instance_id,
    'instance.features_updated',
    'instance',
    p_instance_id::text,
    jsonb_build_object('features', p_features)
  );

  return v_row;
end;
$$;

grant execute on function public.update_instance_features(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Documented audit action vocabulary (comments for clients; no enum lock-in)
-- ---------------------------------------------------------------------------
comment on table public.audit_events is
  'Audit log. Stable actions include: conversation.claimed, conversation.assigned, '
  'conversation.transferred, conversation.note_added, conversation.tagged, '
  'conversation.exported, conversation.deleted, experiment.started, experiment.paused, '
  'compliance.export, compliance.delete, retention.purged, sso.configured, '
  'scim.token_rotated, marketplace.published, marketplace.installed, '
  'chatbot.cloned, flow.comment_added, flow.change_restored, instance.features_updated, '
  'staging.published, agent.presence_updated';

-- Security-definer audit write for RPCs that already checked auth (service paths).
create or replace function public.write_audit_event_trusted(
  p_instance_id uuid,
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_events (instance_id, actor_id, action, resource_type, resource_id, meta)
  values (
    p_instance_id,
    p_actor_id,
    p_action,
    p_resource_type,
    p_resource_id,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.write_audit_event_trusted(uuid, uuid, text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: enable postgres_changes on core conversation tables
-- Channel conventions (client): instance:{id}:inbox, session:{id}, flow:{id}:presence
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.conversation_sessions;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversation_events;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;
