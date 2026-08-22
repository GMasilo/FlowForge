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
      return 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
    case 'failed':
      return 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
    case 'abandoned':
      return 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
    default:
      return 'bg-[var(--color-accent-2)]/10 text-[var(--color-accent-2)]'
  }
}
