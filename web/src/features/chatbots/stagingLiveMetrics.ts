import type { ConversationEvent, ConversationSession } from '@/shared/types/database'

export type ChartPoint = { label: string; value: number }

export type StepDurationBar = ChartPoint & { status?: string; type?: string }

export const CONNECTION_STEP_TYPES = new Set(['http', 'email', 'database', 'integration', 'entity', 'transfer'])

function isConnectionStepType(type: string | undefined): boolean {
  return CONNECTION_STEP_TYPES.has(type ?? '')
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function eventTime(event: Pick<ConversationEvent, 'created_at'>): number {
  const t = Date.parse(event.created_at)
  return Number.isFinite(t) ? t : 0
}

function readConnectionInvokeMs(payload: Record<string, unknown>): number | null {
  if (typeof payload.connectionInvokeMs === 'number' && Number.isFinite(payload.connectionInvokeMs)) {
    return Math.max(0, payload.connectionInvokeMs)
  }
  const processed = asRecord(payload.processed)
  if (typeof processed.invokeMs === 'number' && Number.isFinite(processed.invokeMs)) {
    return Math.max(0, processed.invokeMs)
  }
  return null
}

function readConnectionDuration(event: ConversationEvent): number | null {
  if (event.kind !== 'step.run') return null
  const payload = asRecord(event.payload)
  const type = typeof payload.type === 'string' ? payload.type : ''
  if (!isConnectionStepType(type)) return null
  return readConnectionInvokeMs(payload) ?? readStepDurationMs(payload)
}

function connectionRunLabel(event: ConversationEvent, payload: Record<string, unknown>): string {
  const type = typeof payload.type === 'string' ? payload.type : 'connection'
  const processed = asRecord(payload.processed)
  const nodeKey = event.node_key?.trim() || type

  if (type === 'http') {
    const method = String(processed.method ?? 'HTTP')
    const path = String(processed.path ?? nodeKey)
    const shortPath = path.length > 16 ? `${path.slice(0, 14)}…` : path
    return `${method} ${shortPath}`
  }
  if (type === 'email') return `Email · ${nodeKey.length > 14 ? `${nodeKey.slice(0, 12)}…` : nodeKey}`
  if (type === 'integration') {
    const action = String(processed.action ?? nodeKey)
    return action.length > 18 ? `${action.slice(0, 16)}…` : action
  }
  if (type === 'entity') {
    const key = String(processed.entityKey ?? nodeKey)
    return `Entity · ${key.length > 14 ? `${key.slice(0, 12)}…` : key}`
  }
  return nodeKey.length > 18 ? `${nodeKey.slice(0, 16)}…` : nodeKey
}

function connectionStepEvents(events: ConversationEvent[]): ConversationEvent[] {
  return sortedEvents(events).filter((event) => {
    if (event.kind !== 'step.run') return false
    const payload = asRecord(event.payload)
    return isConnectionStepType(typeof payload.type === 'string' ? payload.type : undefined)
  })
}

/** Per connection step.run invoke duration for one session. */
export function buildSessionConnectionRuns(events: ConversationEvent[]): StepDurationBar[] {
  return connectionStepEvents(events).map((event) => {
    const payload = asRecord(event.payload)
    const value = readConnectionDuration(event) ?? 0
    return {
      label: connectionRunLabel(event, payload),
      value,
      status: typeof payload.status === 'string' ? payload.status : undefined,
      type: typeof payload.type === 'string' ? payload.type : undefined,
    }
  })
}

/** Average connection invoke duration grouped by step type (http, email, …). */
export function buildConnectionTypeDurationBars(events: ConversationEvent[]): StepDurationBar[] {
  const byType = new Map<string, number[]>()

  for (const event of connectionStepEvents(events)) {
    const payload = asRecord(event.payload)
    const durationMs = readConnectionDuration(event)
    if (durationMs == null) continue
    const type = typeof payload.type === 'string' && payload.type.trim() ? payload.type.trim() : 'connection'
    const list = byType.get(type) ?? []
    list.push(durationMs)
    byType.set(type, list)
  }

  return [...byType.entries()]
    .map(([type, durations]) => ({
      label: type,
      value: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      type,
    }))
    .sort((a, b) => b.value - a.value)
}

/** Average connection invoke time per time bucket across staging sessions. */
export function buildConnectionInvokeTimeline(
  events: ConversationEvent[],
  args?: { bucketMinutes?: number; windowMinutes?: number; now?: Date },
): ChartPoint[] {
  const bucketMinutes = args?.bucketMinutes ?? 5
  const windowMinutes = args?.windowMinutes ?? 120
  const now = args?.now ?? new Date()
  const nowMs = now.getTime()
  const windowMs = windowMinutes * 60 * 1000
  const bucketMs = bucketMinutes * 60 * 1000
  const bucketCount = Math.ceil(windowMinutes / bucketMinutes)
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: nowMs - windowMs + i * bucketMs,
    durations: [] as number[],
  }))

  for (const event of connectionStepEvents(events)) {
    const finishedAt = eventTime(event)
    if (!finishedAt || finishedAt < nowMs - windowMs || finishedAt > nowMs) continue
    const durationMs = readConnectionDuration(event)
    if (durationMs == null) continue
    const idx = Math.min(bucketCount - 1, Math.floor((finishedAt - (nowMs - windowMs)) / bucketMs))
    if (idx >= 0) buckets[idx]!.durations.push(durationMs)
  }

  return buckets.map((bucket) => ({
    label: new Date(bucket.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    value: bucket.durations.length
      ? Math.round(bucket.durations.reduce((a, b) => a + b, 0) / bucket.durations.length)
      : 0,
  }))
}

export function connectionInvokeValues(events: ConversationEvent[]): number[] {
  return connectionStepEvents(events)
    .map((event) => readConnectionDuration(event))
    .filter((value): value is number => value != null)
}

function readStepDurationMs(payload: Record<string, unknown>): number | null {
  if (typeof payload.durationMs === 'number' && Number.isFinite(payload.durationMs)) {
    return Math.max(0, payload.durationMs)
  }
  const startedAt = payload.startedAt
  const finishedAt = payload.finishedAt
  if (typeof startedAt === 'string' && typeof finishedAt === 'string') {
    const ms = Date.parse(finishedAt) - Date.parse(startedAt)
    if (Number.isFinite(ms) && ms >= 0) return ms
  }
  return null
}

function sortedEvents(events: ConversationEvent[]): ConversationEvent[] {
  return [...events].sort((a, b) => {
    const seqDiff = (a.seq ?? 0) - (b.seq ?? 0)
    if (seqDiff !== 0) return seqDiff
    return eventTime(a) - eventTime(b)
  })
}

/** User message → next bot reply gaps for one session (milliseconds). */
export function buildSessionResponseDurations(events: ConversationEvent[]): ChartPoint[] {
  const ordered = sortedEvents(events)
  const out: ChartPoint[] = []
  let turn = 0

  for (let i = 0; i < ordered.length; i++) {
    const event = ordered[i]!
    if (event.kind !== 'message.user') continue
    const userAt = eventTime(event)
    if (!userAt) continue

    for (let j = i + 1; j < ordered.length; j++) {
      const next = ordered[j]!
      if (next.kind === 'message.bot') {
        const botAt = eventTime(next)
        if (botAt > userAt) {
          turn += 1
          out.push({
            label: `Turn ${turn}`,
            value: botAt - userAt,
          })
        }
        break
      }
      if (next.kind === 'message.user') break
    }
  }

  return out
}

/** Per step.run duration for one session. */
export function buildSessionStepDurations(events: ConversationEvent[]): StepDurationBar[] {
  const ordered = sortedEvents(events).filter((e) => e.kind === 'step.run')
  return ordered.map((event, index) => {
    const payload = asRecord(event.payload)
    const durationMs =
      readStepDurationMs(payload) ??
      (index > 0
        ? Math.max(0, eventTime(event) - eventTime(ordered[index - 1]!))
        : 0)
    const key = event.node_key?.trim() || `step-${index + 1}`
    return {
      label: key.length > 18 ? `${key.slice(0, 16)}…` : key,
      value: durationMs,
      status: typeof payload.status === 'string' ? payload.status : undefined,
      type: typeof payload.type === 'string' ? payload.type : undefined,
    }
  })
}

/** Rolling session starts bucketed by time (default last 2 hours). */
export function buildSessionsStartedTimeline(
  sessions: Array<Pick<ConversationSession, 'created_at'>>,
  args?: { bucketMinutes?: number; windowMinutes?: number; now?: Date },
): ChartPoint[] {
  const bucketMinutes = args?.bucketMinutes ?? 5
  const windowMinutes = args?.windowMinutes ?? 120
  const now = args?.now ?? new Date()
  const nowMs = now.getTime()
  const windowMs = windowMinutes * 60 * 1000
  const bucketMs = bucketMinutes * 60 * 1000
  const bucketCount = Math.ceil(windowMinutes / bucketMinutes)
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start = nowMs - windowMs + i * bucketMs
    return { start, end: start + bucketMs, count: 0 }
  })

  for (const session of sessions) {
    const t = Date.parse(session.created_at)
    if (!Number.isFinite(t) || t < nowMs - windowMs || t > nowMs) continue
    const idx = Math.min(bucketCount - 1, Math.floor((t - (nowMs - windowMs)) / bucketMs))
    if (idx >= 0) buckets[idx]!.count += 1
  }

  return buckets.map((bucket) => ({
    label: new Date(bucket.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    value: bucket.count,
  }))
}

/** Average user→bot response time per time bucket across many sessions. */
export function buildAggregateResponseTimeline(
  events: ConversationEvent[],
  args?: { bucketMinutes?: number; windowMinutes?: number; now?: Date },
): ChartPoint[] {
  const bucketMinutes = args?.bucketMinutes ?? 5
  const windowMinutes = args?.windowMinutes ?? 120
  const now = args?.now ?? new Date()
  const nowMs = now.getTime()
  const windowMs = windowMinutes * 60 * 1000
  const bucketMs = bucketMinutes * 60 * 1000
  const bucketCount = Math.ceil(windowMinutes / bucketMinutes)
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    start: nowMs - windowMs + i * bucketMs,
    durations: [] as number[],
  }))

  const bySession = new Map<string, ConversationEvent[]>()
  for (const event of events) {
    const list = bySession.get(event.session_id) ?? []
    list.push(event)
    bySession.set(event.session_id, list)
  }

  for (const sessionEvents of bySession.values()) {
    const ordered = sortedEvents(sessionEvents)
    for (let i = 0; i < ordered.length; i++) {
      const event = ordered[i]!
      if (event.kind !== 'message.user') continue
      const userAt = eventTime(event)
      if (!userAt) continue

      for (let j = i + 1; j < ordered.length; j++) {
        const next = ordered[j]!
        if (next.kind === 'message.bot') {
          const botAt = eventTime(next)
          if (botAt > userAt && botAt >= nowMs - windowMs && botAt <= nowMs) {
            const idx = Math.min(bucketCount - 1, Math.floor((botAt - (nowMs - windowMs)) / bucketMs))
            if (idx >= 0) buckets[idx]!.durations.push(botAt - userAt)
          }
          break
        }
        if (next.kind === 'message.user') break
      }
    }
  }

  return buckets.map((bucket) => ({
    label: new Date(bucket.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    value: bucket.durations.length
      ? Math.round(bucket.durations.reduce((a, b) => a + b, 0) / bucket.durations.length)
      : 0,
  }))
}

/** Average step.run duration grouped by step type. */
export function buildStepTypeDurationBars(events: ConversationEvent[]): StepDurationBar[] {
  const ordered = sortedEvents(events).filter((e) => e.kind === 'step.run')
  const byType = new Map<string, number[]>()

  for (let i = 0; i < ordered.length; i++) {
    const event = ordered[i]!
    const payload = asRecord(event.payload)
    let durationMs = readStepDurationMs(payload)
    if (durationMs == null && i > 0) {
      durationMs = Math.max(0, eventTime(event) - eventTime(ordered[i - 1]!))
    }
    if (durationMs == null) continue
    const type = typeof payload.type === 'string' && payload.type.trim() ? payload.type.trim() : 'other'
    const list = byType.get(type) ?? []
    list.push(durationMs)
    byType.set(type, list)
  }

  return [...byType.entries()]
    .map(([type, durations]) => ({
      label: type,
      value: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      type,
    }))
    .sort((a, b) => b.value - a.value)
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
  return Math.round(sorted[mid]!)
}
