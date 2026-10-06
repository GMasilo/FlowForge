-- Keep elevated review helpers outside PostgREST's exposed public schema.
create schema if not exists flowforge_private;
revoke all on schema flowforge_private from public,anon;
grant usage on schema flowforge_private to authenticated;
alter function public.step_review_members(uuid) set schema flowforge_private;
alter function public.add_step_review(uuid,text,text,uuid,uuid[]) set schema flowforge_private;
alter function public.set_step_review_resolved(uuid,boolean) set schema flowforge_private;

create function public.step_review_members(p_flow_id uuid) returns jsonb
language sql stable security invoker set search_path=public as $$
 select flowforge_private.step_review_members(p_flow_id)
$$;
create function public.add_step_review(p_flow_id uuid,p_body text,p_node_key text default null,p_parent_id uuid default null,p_mentions uuid[] default '{}')
returns public.flow_comments language sql security invoker set search_path=public as $$
 select flowforge_private.add_step_review(p_flow_id,p_body,p_node_key,p_parent_id,p_mentions)
$$;
create function public.set_step_review_resolved(p_comment_id uuid,p_resolved boolean) returns void
language sql security invoker set search_path=public as $$
 select flowforge_private.set_step_review_resolved(p_comment_id,p_resolved)
$$;
revoke all on function public.step_review_members(uuid),public.add_step_review(uuid,text,text,uuid,uuid[]),public.set_step_review_resolved(uuid,boolean) from public,anon;
grant execute on function public.step_review_members(uuid),public.add_step_review(uuid,text,text,uuid,uuid[]),public.set_step_review_resolved(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
