import type { ConversationEvent, ConversationSession, Json } from '@/shared/types/database'
import { displaySessionStatus } from '@/features/instances/conversationStatus'

export type AnalyticsPaymentRow = {
  chatbot_id: string
  session_id: string | null
  status: string
}

export type ConversationAnalytics = {
  sessionCount: number
  completedCount: number
  activeCount: number
  abandonedCount: number
  failedCount: number
  shopSessions: number
  paidSessions: number
  uniqueVisitors: number
  completionRate: number
  paymentConversionRate: number
  avgDurationMinutes: number | null
  medianSteps: number | null
  dropOff: Array<{ nodeKey: string; reached: number; pct: number }>
  topProducts: Array<{ id: string; name: string; qty: number }>
  statusBreakdown: Array<{ status: string; count: number; pct: number }>
  sessionsByDay: Array<{ date: string; label: string; sessions: number; completed: number }>
  byChatbot: Array<{ chatbotId: string; name: string; sessions: number; completed: number; completionRate: number }>
  byVersion: Array<{ version: string; sessions: number; completed: number; completionRate: number }>
  hourOfDay: Array<{ hour: number; label: string; count: number }>
  paymentStatus: Array<{ status: string; count: number }>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function cartFromVariables(variables: Json): { items: Array<{ id?: string; name?: string; qty?: number }> } | null {
  const rec = asRecord(variables)
  const direct = rec.cart
  const fromDirect = asRecord(direct)
  if (Array.isArray(fromDirect.items)) return fromDirect as { items: Array<{ id?: string; name?: string; qty?: number }> }
  for (const value of Object.values(rec)) {
    const row = asRecord(value)
    if (Array.isArray(row.items) && ('total' in row || 'subtotal' in row || 'itemCount' in row)) {
      return row as { items: Array<{ id?: string; name?: string; qty?: number }> }
    }
  }
  return null
}

function sessionPaid(
  session: ConversationSession,
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind' | 'payload'>>,
  payments: AnalyticsPaymentRow[],
): boolean {
  if (payments.some((p) => p.session_id === session.id && p.status === 'verified')) return true
  for (const event of events) {
    if (event.session_id !== session.id || event.kind !== 'step.run') continue
    const payload = asRecord(event.payload)
    if (String(payload.type ?? '') !== 'question') continue
    const outputs = asRecord(payload.outputs)
    const response = asRecord(outputs.response ?? outputs)
    const status = String(response.status ?? '').toLowerCase()
    if (status === 'paid' || status === 'verified' || status === 'complete' || status === 'completed') return true
    if (response.reference && (status === 'ok' || status === 'success')) return true
  }
  const rec = asRecord(session.variables)
  for (const value of Object.values(rec)) {
    const row = asRecord(value)
    const status = String(row.status ?? '').toLowerCase()
    if (row.reference && (status === 'paid' || status === 'verified' || status === 'success')) return true
  }
  return false
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return 'unknown'
  return d.toISOString().slice(0, 10)
}

function formatDayLabel(key: string): string {
  if (key === 'unknown') return '—'
  const d = new Date(`${key}T12:00:00.000Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2
  return sorted[mid]!
}

function emptySeries(days: number, now = new Date()): Array<{ date: string; label: string; sessions: number; completed: number }> {
  const out: Array<{ date: string; label: string; sessions: number; completed: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCHours(12, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, label: formatDayLabel(key), sessions: 0, completed: 0 })
  }
  return out
}

export function buildConversationAnalytics(args: {
  sessions: Array<ConversationSession & { chatbots?: { name: string } | null }>
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key' | 'payload' | 'seq'>>
  payments: AnalyticsPaymentRow[]
  chatbotId?: string | null
  rangeDays?: number | null
  now?: Date
}): ConversationAnalytics {
  const now = args.now ?? new Date()
  const rangeMs =
    args.rangeDays && args.rangeDays > 0 ? args.rangeDays * 24 * 60 * 60 * 1000 : null
  const cutoff = rangeMs != null ? now.getTime() - rangeMs : null

  let sessions = args.chatbotId
    ? args.sessions.filter((s) => s.chatbot_id === args.chatbotId)
    : args.sessions
  if (cutoff != null) {
    sessions = sessions.filter((s) => {
      const t = Date.parse(s.created_at)
      return Number.isFinite(t) && t >= cutoff
    })
  }

  const sessionIds = new Set(sessions.map((s) => s.id))
  const events = args.events.filter((e) => sessionIds.has(e.session_id))
  const payments = args.chatbotId
    ? args.payments.filter((p) => p.chatbot_id === args.chatbotId)
    : args.payments

  const dropOrder: string[] = []
  const dropCounts = new Map<string, Set<string>>()
  const stepsBySession = new Map<string, number>()
  for (const event of events) {
    if (event.kind !== 'step.run' || !event.node_key) continue
    if (!dropCounts.has(event.node_key)) {
      dropCounts.set(event.node_key, new Set())
      dropOrder.push(event.node_key)
    }
    dropCounts.get(event.node_key)!.add(event.session_id)
    stepsBySession.set(event.session_id, (stepsBySession.get(event.session_id) ?? 0) + 1)
  }

  const eventsBySession = new Map<string, typeof events>()
  for (const event of events) {
    const list = eventsBySession.get(event.session_id) ?? []
    list.push(event)
    eventsBySession.set(event.session_id, list)
  }

  let shopSessions = 0
  let paidSessions = 0
  let completedCount = 0
  let activeCount = 0
  let abandonedCount = 0
  let failedCount = 0
  let escalatedCount = 0
  const productQty = new Map<string, { name: string; qty: number }>()
  const visitors = new Set<string>()
  const durations: number[] = []
  const chatbotMap = new Map<string, { name: string; sessions: number; completed: number }>()
  const versionMap = new Map<string, { sessions: number; completed: number }>()
  const dayMap = new Map<string, { sessions: number; completed: number }>()
  const hourCounts = Array.from({ length: 24 }, () => 0)

  for (const session of sessions) {
    const status = displaySessionStatus(session, now.getTime())
    if (status === 'completed') completedCount += 1
    else if (status === 'active') activeCount += 1
    else if (status === 'abandoned') abandonedCount += 1
    else if (status === 'failed') failedCount += 1
    else if (status === 'escalated') escalatedCount += 1

    if (session.visitor_key) visitors.add(session.visitor_key)

    const cart = cartFromVariables(session.variables)
    if (cart?.items?.length) shopSessions += 1
    if (sessionPaid(session, eventsBySession.get(session.id) ?? [], payments)) paidSessions += 1

    if (session.status === 'completed' && cart?.items) {
      for (const item of cart.items) {
        const id = String(item.id ?? item.name ?? '').trim()
        if (!id) continue
        const qty = Math.max(0, Math.floor(Number(item.qty) || 0))
        const prev = productQty.get(id) ?? { name: String(item.name ?? id), qty: 0 }
        prev.qty += qty
        if (item.name) prev.name = String(item.name)
        productQty.set(id, prev)
      }
    }

    const endIso = session.completed_at ?? session.updated_at
    const start = Date.parse(session.created_at)
    const end = Date.parse(endIso)
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      durations.push((end - start) / 60_000)
    }

    const bot = chatbotMap.get(session.chatbot_id) ?? {
      name: session.chatbots?.name ?? session.chatbot_id.slice(0, 8),
      sessions: 0,
      completed: 0,
    }
    bot.sessions += 1
    if (status === 'completed') bot.completed += 1
    if (session.chatbots?.name) bot.name = session.chatbots.name
    chatbotMap.set(session.chatbot_id, bot)

    const dk = dayKey(session.created_at)
    const day = dayMap.get(dk) ?? { sessions: 0, completed: 0 }
    day.sessions += 1
    if (status === 'completed') day.completed += 1
    dayMap.set(dk, day)

    const verLabel =
      session.publish_version != null && session.publish_version !== undefined
        ? `v${session.publish_version}`
        : 'unpublished'
    const ver = versionMap.get(verLabel) ?? { sessions: 0, completed: 0 }
    ver.sessions += 1
    if (status === 'completed') ver.completed += 1
    versionMap.set(verLabel, ver)

    const created = new Date(session.created_at)
    if (Number.isFinite(created.getTime())) {
      hourCounts[created.getHours()] = (hourCounts[created.getHours()] ?? 0) + 1
    }
  }

  const sessionCount = sessions.length
  const pct = (n: number) => (sessionCount ? Math.round((n / sessionCount) * 1000) / 10 : 0)

  const statusBreakdown = [
    { status: 'completed', count: completedCount },
    { status: 'active', count: activeCount },
    { status: 'escalated', count: escalatedCount },
    { status: 'abandoned', count: abandonedCount },
    { status: 'failed', count: failedCount },
  ]
    .filter((r) => r.count > 0 || sessionCount === 0)
    .map((r) => ({ ...r, pct: pct(r.count) }))

  const seriesDays = args.rangeDays && args.rangeDays > 0 ? Math.min(args.rangeDays, 90) : 30
  const sessionsByDay = emptySeries(seriesDays, now).map((row) => {
    const hit = dayMap.get(row.date)
    return hit ? { ...row, sessions: hit.sessions, completed: hit.completed } : row
  })

  const paymentStatusMap = new Map<string, number>()
  for (const p of payments) {
    if (args.chatbotId && p.chatbot_id !== args.chatbotId) continue
    const key = (p.status || 'unknown').toLowerCase()
    paymentStatusMap.set(key, (paymentStatusMap.get(key) ?? 0) + 1)
  }

  return {
    sessionCount,
    completedCount,
    activeCount,
    abandonedCount,
    failedCount,
    shopSessions,
    paidSessions,
    uniqueVisitors: visitors.size,
    completionRate: pct(completedCount),
    paymentConversionRate: shopSessions ? Math.round((paidSessions / shopSessions) * 1000) / 10 : 0,
    avgDurationMinutes:
      durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : null,
    medianSteps: median([...stepsBySession.values()].map((n) => n)),
    dropOff: dropOrder.map((nodeKey) => {
      const reached = dropCounts.get(nodeKey)?.size ?? 0
      return { nodeKey, reached, pct: pct(reached) }
    }),
    topProducts: [...productQty.entries()]
      .map(([id, v]) => ({ id, name: v.name, qty: v.qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12),
    statusBreakdown,
    sessionsByDay,
    byChatbot: [...chatbotMap.entries()]
      .map(([chatbotId, v]) => ({
        chatbotId,
        name: v.name,
        sessions: v.sessions,
        completed: v.completed,
        completionRate: v.sessions ? Math.round((v.completed / v.sessions) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions),
    byVersion: [...versionMap.entries()]
      .map(([version, v]) => ({
        version,
        sessions: v.sessions,
        completed: v.completed,
        completionRate: v.sessions ? Math.round((v.completed / v.sessions) * 1000) / 10 : 0,
      }))
      .sort((a, b) => {
        if (a.version === 'unpublished') return 1
        if (b.version === 'unpublished') return -1
        return b.sessions - a.sessions
      }),
    hourOfDay: hourCounts.map((count, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      count,
    })),
    paymentStatus: [...paymentStatusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export type DropOffRow = { nodeKey: string; reached: number; pct: number }

export function publishVersionLabel(publishVersion: number | null | undefined): string {
  return publishVersion != null && publishVersion !== undefined ? `v${publishVersion}` : 'unpublished'
}

function filterSessionsForAnalytics(args: {
  sessions: Array<
    Pick<ConversationSession, 'id' | 'publish_version' | 'created_at' | 'chatbot_id'> & {
      chatbots?: { name: string } | null
    }
  >
  chatbotId?: string | null
  rangeDays?: number | null
  now?: Date
}) {
  const now = args.now ?? new Date()
  const rangeMs =
    args.rangeDays != null && args.rangeDays > 0 ? args.rangeDays * 24 * 60 * 60 * 1000 : null
  const cutoff = rangeMs != null ? now.getTime() - rangeMs : null
  let sessions = args.chatbotId
    ? args.sessions.filter((s) => s.chatbot_id === args.chatbotId)
    : args.sessions
  if (cutoff != null) {
    sessions = sessions.filter((s) => {
      const t = Date.parse(s.created_at)
      return Number.isFinite(t) && t >= cutoff
    })
  }
  return sessions
}

function computeDropOff(
  sessionIds: Set<string>,
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key'>>,
  sessionCount: number,
): DropOffRow[] {
  const dropOrder: string[] = []
  const dropCounts = new Map<string, Set<string>>()
  for (const event of events) {
    if (event.kind !== 'step.run' || !event.node_key) continue
    if (!sessionIds.has(event.session_id)) continue
    if (!dropCounts.has(event.node_key)) {
      dropCounts.set(event.node_key, new Set())
      dropOrder.push(event.node_key)
    }
    dropCounts.get(event.node_key)!.add(event.session_id)
  }
  const pct = (n: number) => (sessionCount ? Math.round((n / sessionCount) * 1000) / 10 : 0)
  return dropOrder.map((nodeKey) => {
    const reached = dropCounts.get(nodeKey)?.size ?? 0
    return { nodeKey, reached, pct: pct(reached) }
  })
}

/** Drop-off for sessions matching one publish version label (after chatbot/range filters). */
export function buildDropOffForVersion(args: {
  sessions: Array<
    Pick<ConversationSession, 'id' | 'publish_version' | 'created_at' | 'chatbot_id'> & {
      chatbots?: { name: string } | null
    }
  >
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key'>>
  version: string
  chatbotId?: string | null
  rangeDays?: number | null
  now?: Date
}): { sessionCount: number; dropOff: DropOffRow[] } {
  const filtered = filterSessionsForAnalytics(args).filter(
    (s) => publishVersionLabel(s.publish_version) === args.version,
  )
  const sessionIds = new Set(filtered.map((s) => s.id))
  return {
    sessionCount: filtered.length,
    dropOff: computeDropOff(sessionIds, args.events, filtered.length),
  }
}

/** Align two funnels by nodeKey (union, left-then-right first-seen order). */
export function compareDropOff(
  left: DropOffRow[],
  right: DropOffRow[],
): Array<{
  nodeKey: string
  left: { reached: number; pct: number } | null
  right: { reached: number; pct: number } | null
  deltaPct: number | null
}> {
  const leftMap = new Map(left.map((r) => [r.nodeKey, r]))
  const rightMap = new Map(right.map((r) => [r.nodeKey, r]))
  const order: string[] = []
  for (const r of left) {
    if (!order.includes(r.nodeKey)) order.push(r.nodeKey)
  }
  for (const r of right) {
    if (!order.includes(r.nodeKey)) order.push(r.nodeKey)
  }
  return order.map((nodeKey) => {
    const l = leftMap.get(nodeKey) ?? null
    const r = rightMap.get(nodeKey) ?? null
    return {
      nodeKey,
      left: l ? { reached: l.reached, pct: l.pct } : null,
      right: r ? { reached: r.reached, pct: r.pct } : null,
      deltaPct: l && r ? Math.round((r.pct - l.pct) * 10) / 10 : null,
    }
  })
}
