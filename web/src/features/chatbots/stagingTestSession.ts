import type { ConversationSession } from '@/shared/types/database'

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

/** Session started via the unique /test/{token} link (not public ?env=staging). */
export function isStagingTestLinkSession(session: Pick<ConversationSession, 'variables' | 'environment'>): boolean {
  if ((session.environment ?? 'production') !== 'staging') return false
  const vars = asRecord(session.variables)
  return vars._staging_test === true
}

/** Session belongs to the currently displayed test link token. */
export function sessionMatchesTestToken(
  session: Pick<ConversationSession, 'variables' | 'environment'>,
  token: string | null | undefined,
): boolean {
  if (!token?.trim()) return false
  if (!isStagingTestLinkSession(session)) return false
  const vars = asRecord(session.variables)
  const sessionToken = typeof vars._staging_test_token === 'string' ? vars._staging_test_token.trim() : ''
  if (sessionToken) return sessionToken === token.trim()
  // Legacy sessions before token was stored — do not attach to the current link monitor.
  return false
}

export function filterSessionsForTestToken<T extends ConversationSession>(
  sessions: T[],
  token: string | null | undefined,
): T[] {
  if (!token?.trim()) return []
  return sessions.filter((session) => sessionMatchesTestToken(session, token))
}
