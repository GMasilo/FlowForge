-- Limit analytics/conversation reads to chatbots the user can access.
-- Agents still see all instance sessions for the live inbox.

drop policy if exists "conversation_sessions_select" on public.conversation_sessions;
create policy "conversation_sessions_select"
on public.conversation_sessions for select to authenticated
using (
  public.can_access_chatbot(chatbot_id)
  or public.has_instance_role(instance_id, array['agent']::public.instance_role[])
);

drop policy if exists "conversation_events_select" on public.conversation_events;
create policy "conversation_events_select"
on public.conversation_events for select to authenticated
using (
  exists (
    select 1
    from public.conversation_sessions s
    where s.id = session_id
      and (
        public.can_access_chatbot(s.chatbot_id)
        or public.has_instance_role(s.instance_id, array['agent']::public.instance_role[])
      )
  )
);

drop policy if exists "payment_intents_select" on public.payment_intents;
create policy "payment_intents_select"
on public.payment_intents for select to authenticated
using (
  public.can_access_chatbot(chatbot_id)
  or public.has_instance_role(instance_id, array['agent']::public.instance_role[])
);

drop policy if exists "flow_experiments_select" on public.flow_experiments;
create policy "flow_experiments_select"
on public.flow_experiments for select to authenticated
using (public.can_access_chatbot(chatbot_id));

drop policy if exists "flow_experiments_write" on public.flow_experiments;
create policy "flow_experiments_write"
on public.flow_experiments for all to authenticated
using (
  public.can_access_chatbot(chatbot_id)
  and public.has_instance_role(
    instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
)
with check (
  public.can_access_chatbot(chatbot_id)
  and public.has_instance_role(
    instance_id,
    array['owner', 'admin', 'editor']::public.instance_role[]
  )
);

create or replace function public.get_experiment_stats(p_experiment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_exp public.flow_experiments;
  v_result jsonb;
begin
  select * into v_exp from public.flow_experiments where id = p_experiment_id;
  if v_exp.id is null then
    raise exception 'Experiment not found';
  end if;
  if not public.can_access_chatbot(v_exp.chatbot_id) then
    raise exception 'Not allowed';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) into v_result
  from (
    select
      s.variant_key,
      count(*)::int as sessions,
      count(*) filter (where s.status = 'completed')::int as completed,
      count(*) filter (where s.status in ('failed', 'abandoned'))::int as dropped,
      coalesce((
        select sum(p.amount)
        from public.payment_intents p
        join public.conversation_sessions s2 on s2.id = p.session_id
        where s2.experiment_id = p_experiment_id
          and s2.variant_key is not distinct from s.variant_key
          and p.status = 'verified'
      ), 0) as revenue
    from public.conversation_sessions s
    where s.experiment_id = p_experiment_id
    group by s.variant_key
  ) t;

  return jsonb_build_object('experiment_id', p_experiment_id, 'variants', v_result);
end;
$$;

grant execute on function public.get_experiment_stats(uuid) to authenticated;

notify pgrst, 'reload schema';
