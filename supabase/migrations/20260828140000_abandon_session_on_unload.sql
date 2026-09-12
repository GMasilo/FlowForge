-- Record session.abandoned when visitors leave mid-conversation (tab close, etc.).

create or replace function public.complete_conversation_session(
  p_session_id uuid,
  p_status text default 'completed',
  p_error_summary text default null,
  p_variables jsonb default null
)
returns public.conversation_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.conversation_sessions;
  v_session public.conversation_sessions;
  v_status text := lower(coalesce(p_status, 'completed'));
begin
  if v_status not in ('completed', 'failed', 'abandoned') then
    v_status := 'completed';
  end if;

  select * into v_session from public.conversation_sessions where id = p_session_id;

  if v_status = 'abandoned' and v_session.status in ('active', 'escalated') then
    perform public.append_conversation_event(
      p_session_id,
      'session.abandoned',
      null,
      jsonb_build_object(
        'reason', coalesce(nullif(trim(p_error_summary), ''), 'visitor_left')
      )
    );
  end if;

  update public.conversation_sessions
  set
    status = v_status,
    error_summary = p_error_summary,
    variables = coalesce(p_variables, variables),
    completed_at = now(),
    updated_at = now()
  where id = p_session_id
    and status in ('active', 'escalated')
  returning * into v_row;

  if v_row.id is null then
    select * into v_row from public.conversation_sessions where id = p_session_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.complete_conversation_session(uuid, text, text, jsonb) to anon, authenticated, service_role;
