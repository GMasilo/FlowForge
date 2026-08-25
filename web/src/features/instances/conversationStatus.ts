import type { ConversationSession } from '@/shared/types/database'

/** Active sessions with no update for this long are shown as abandoned (list UI only). */
export const STALE_ACTIVE_MS = 24 * 60 * 60 * 1000

export function displaySessionStatus(
  session: Pick<ConversationSession, 'status' | 'created_at' | 'updated_at' | 'completed_at'>,
  now = Date.now(),
): ConversationSession['status'] {
  if (session.status !== 'active') return session.status
  const last = Date.parse(session.updated_at || session.created_at)
  if (Number.isFinite(last) && now - last >= STALE_ACTIVE_MS) return 'abandoned'
  return 'active'
}

export function sessionStatusTone(status: ConversationSession['status']) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-800'
    case 'failed':
      return 'bg-rose-50 text-rose-800'
    case 'abandoned':
      return 'bg-amber-50 text-amber-800'
    case 'escalated':
      return 'bg-violet-50 text-violet-800'
    default:
      return 'bg-sky-50 text-sky-800'
  }
}
