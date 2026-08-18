-- Include session variables on conversation webhook payloads.

create or replace function public.get_conversation_session_for_webhook(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'chatbot_id', s.chatbot_id,
    'instance_id', s.instance_id,
    'status', s.status,
    'publish_version', s.publish_version,
    'error_summary', s.error_summary,
    'completed_at', s.completed_at,
    'created_at', s.created_at,
    'variables', s.variables
  )
  from public.conversation_sessions s
  where s.id = p_session_id;
$$;

grant execute on function public.get_conversation_session_for_webhook(uuid) to service_role;
