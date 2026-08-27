import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'

/** Channel naming conventions from the roadmap foundations. */
export function inboxChannelName(instanceId: string) {
  return `instance:${instanceId}:inbox`
}

export function sessionChannelName(sessionId: string) {
  return `session:${sessionId}`
}

export function flowPresenceChannelName(flowId: string) {
  return `flow:${flowId}:presence`
}

export function subscribeSessionEvents(
  sessionId: string,
  onChange: () => void,
): RealtimeChannel {
  const channel = supabase
    .channel(sessionChannelName(sessionId))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversation_events', filter: `session_id=eq.${sessionId}` },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'conversation_sessions', filter: `id=eq.${sessionId}` },
      () => onChange(),
    )
    .subscribe()
  return channel
}

export function subscribeInbox(
  instanceId: string,
  onChange: () => void,
): RealtimeChannel {
  const channel = supabase
    .channel(inboxChannelName(instanceId))
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversation_sessions',
        filter: `instance_id=eq.${instanceId}`,
      },
      () => onChange(),
    )
    .subscribe()
  return channel
}

/** Live updates for agent online/away/offline presence on an instance. */
export function subscribeAgentPresence(
  instanceId: string,
  onChange: () => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`instance:${instanceId}:agent-presence`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agent_presence',
        filter: `instance_id=eq.${instanceId}`,
      },
      () => onChange(),
    )
    .subscribe()
  return channel
}

/** In-app notifications for the signed-in user. */
export function subscribeUserNotifications(
  userId: string,
  onChange: () => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`user:${userId}:notifications`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => onChange(),
    )
    .subscribe()
  return channel
}
