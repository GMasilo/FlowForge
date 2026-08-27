export type PeerStepLock = {
  userId: string
  name: string
  color: string
  /** ISO time when the holder first claimed this step */
  selectedAt: string
  /** Others who selected the same step later (earliest first), including self when waiting */
  queue: Array<{ userId: string; name: string; color: string; selectedAt: string }>
}

export type PresenceEntry = {
  name?: string
  color?: string
  selected_node_key?: string | null
  /** ISO timestamp of when this user first selected the current step */
  selected_at?: string | null
}

type Claim = {
  userId: string
  name: string
  color: string
  selectedAt: string
  atMs: number
}

function claimFromEntry(userId: string, entry: PresenceEntry | undefined): Claim | null {
  const nodeKey = entry?.selected_node_key?.trim()
  if (!nodeKey) return null
  const selectedAt = entry?.selected_at?.trim() || ''
  const parsed = selectedAt ? Date.parse(selectedAt) : NaN
  // Missing timestamp sorts last so timed first-click claims always win
  const atMs = Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
  return {
    userId,
    name: entry?.name?.trim() || userId.slice(0, 6),
    color: entry?.color?.trim() || '#0f766e',
    selectedAt: selectedAt || new Date(0).toISOString(),
    atMs,
  }
}

function sortClaims(a: Claim, b: Claim): number {
  if (a.atMs !== b.atMs) return a.atMs - b.atMs
  return a.userId.localeCompare(b.userId)
}

/**
 * Build nodeKey → lock held by the earliest claimer.
 * If self claimed first, that key is omitted (you hold the lock — peers are blocked, not you).
 */
export function locksFromPresence(
  presence: Record<string, PresenceEntry[]>,
  selfId: string,
): Map<string, PeerStepLock> {
  const claimsByKey = new Map<string, Claim[]>()

  for (const [userId, entries] of Object.entries(presence)) {
    const entry = entries[0]
    const nodeKey = entry?.selected_node_key?.trim()
    if (!nodeKey) continue
    const claim = claimFromEntry(userId, entry)
    if (!claim) continue
    const list = claimsByKey.get(nodeKey) ?? []
    list.push(claim)
    claimsByKey.set(nodeKey, list)
  }

  const locks = new Map<string, PeerStepLock>()
  for (const [nodeKey, claims] of claimsByKey) {
    claims.sort(sortClaims)
    const holder = claims[0]
    if (!holder) continue
    // First selector wins — only lock the step for others
    if (holder.userId === selfId) continue
    locks.set(nodeKey, {
      userId: holder.userId,
      name: holder.name,
      color: holder.color,
      selectedAt: holder.selectedAt,
      queue: claims.slice(1).map((c) => ({
        userId: c.userId,
        name: c.name,
        color: c.color,
        selectedAt: c.selectedAt,
      })),
    })
  }
  return locks
}

export function isStepLockedByOther(
  nodeKey: string | null | undefined,
  locks: Map<string, PeerStepLock> | Record<string, PeerStepLock>,
): boolean {
  if (!nodeKey) return false
  if (locks instanceof Map) return locks.has(nodeKey)
  return !!locks[nodeKey]
}

export function peerLockedKeys(locks: Map<string, PeerStepLock>): Set<string> {
  return new Set(locks.keys())
}

/** Position in queue for self (1 = next after holder). null if not waiting. */
export function queuePosition(
  lock: PeerStepLock | undefined,
  selfId: string,
): number | null {
  if (!lock) return null
  const idx = lock.queue.findIndex((c) => c.userId === selfId)
  return idx >= 0 ? idx + 1 : null
}
