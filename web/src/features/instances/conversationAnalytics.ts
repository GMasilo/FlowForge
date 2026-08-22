import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import type { ConversationEvent, ConversationSession, Json } from '@/shared/types/database'
import { displaySessionStatus } from '@/features/instances/conversationStatus'

export type AnalyticsRangeKey = '7d' | '14d' | '30d' | '90d' | 'all'

export const ANALYTICS_RANGE_OPTIONS: Array<{ value: AnalyticsRangeKey; label: string }> = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export type AnalyticsPaymentRow = {
  chatbot_id: string
  session_id: string | null
  status: string
  amount?: number | string | null
  currency?: string | null
}

export type AnalyticsSessionRow = ConversationSession & {
  chatbots?: { name: string } | null
}

export type DailyPoint = {
  date: string
  label: string
  sessions: number
  completed: number
  failed: number
}

export type StatusSlice = {
  status: ConversationSession['status']
  count: number
}

export type FunnelStep = {
  nodeKey: string
  reached: number
  dropped: number
}

export type ChatbotSlice = {
  chatbotId: string
  name: string
  sessions: number
  completed: number
  paid: number
}

export type HourPoint = {
  hour: number
  count: number
}

export type ConversationAnalytics = {
  sessionCount: number
  completedCount: number
  failedCount: number
  activeCount: number
  abandonedCount: number
  completionRate: number
  uniqueVisitors: number
  returningVisitors: number
  anonymousSessions: number
  avgDurationMs: number | null
  medianDurationMs: number | null
  avgStepsPerSession: number
  userMessageCount: number
  shopSessions: number
  paidSessions: number
  daily: DailyPoint[]
  byHour: HourPoint[]
  statusBreakdown: StatusSlice[]
  dropOff: FunnelStep[]
  topProducts: Array<{ id: string; name: string; qty: number }>
  byChatbot: ChatbotSlice[]
  topErrors: Array<{ message: string; count: number }>
  paymentStatus: Array<{ status: string; count: number }>
  revenueByCurrency: Array<{ currency: string; amount: number }>
}

export function analyticsRangeStart(range: AnalyticsRangeKey, now = Date.now()): number | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90
  return now - days * 24 * 60 * 60 * 1000
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours}h ${rem}m` : `${hours}h`
}

export function formatMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase() || 'ZAR'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
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

function sessionDurationMs(session: ConversationSession): number | null {
  if (!session.completed_at) return null
  const start = Date.parse(session.created_at)
  const end = Date.parse(session.completed_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return end - start
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function asAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function buildTimeBuckets(from: Date, to: Date): DailyPoint[] {
  const start = startOfDay(from)
  const end = startOfDay(to)
  const days = Math.max(0, differenceInCalendarDays(end, start))
  const weekly = days > 45
  const points: DailyPoint[] = []
  if (weekly) {
    let cursor = startOfWeek(start, { weekStartsOn: 1 })
    const last = startOfWeek(end, { weekStartsOn: 1 })
    while (cursor.getTime() <= last.getTime()) {
      points.push({
        date: format(cursor, 'yyyy-MM-dd'),
        label: format(cursor, 'd MMM'),
        sessions: 0,
        completed: 0,
        failed: 0,
      })
      cursor = addWeeks(cursor, 1)
    }
    return points
  }
  let cursor = start
  while (cursor.getTime() <= end.getTime()) {
    points.push({
      date: format(cursor, 'yyyy-MM-dd'),
      label: format(cursor, days > 10 ? 'd MMM' : 'EEE d'),
      sessions: 0,
      completed: 0,
      failed: 0,
    })
    cursor = addDays(cursor, 1)
  }
  return points
}

function bucketKey(createdAt: string, weekly: boolean): string | null {
  const at = Date.parse(createdAt)
  if (!Number.isFinite(at)) return null
  const date = new Date(at)
  return weekly
    ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    : format(startOfDay(date), 'yyyy-MM-dd')
}

export function buildConversationAnalytics(args: {
  sessions: AnalyticsSessionRow[]
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key' | 'payload' | 'seq'>>
  payments: AnalyticsPaymentRow[]
  chatbotId?: string | null
  sinceMs?: number | null
  now?: number
}): ConversationAnalytics {
  const now = args.now ?? Date.now()
  const sinceMs = args.sinceMs ?? null
  let sessions = args.chatbotId
    ? args.sessions.filter((s) => s.chatbot_id === args.chatbotId)
    : args.sessions
  if (sinceMs != null) {
    sessions = sessions.filter((s) => {
      const at = Date.parse(s.created_at)
      return Number.isFinite(at) && at >= sinceMs
    })
  }

  const sessionIds = new Set(sessions.map((s) => s.id))
  const events = args.events.filter((e) => sessionIds.has(e.session_id))
  const payments = (args.chatbotId
    ? args.payments.filter((p) => p.chatbot_id === args.chatbotId)
    : args.payments
  ).filter((p) => !p.session_id || sessionIds.has(p.session_id))

  const dropOrder: string[] = []
  const dropCounts = new Map<string, Set<string>>()
  const stepsBySession = new Map<string, Set<string>>()
  let userMessageCount = 0
  for (const event of events) {
    if (event.kind === 'message.user') userMessageCount += 1
    if (event.kind !== 'step.run' || !event.node_key) continue
    if (!dropCounts.has(event.node_key)) {
      dropCounts.set(event.node_key, new Set())
      dropOrder.push(event.node_key)
    }
    dropCounts.get(event.node_key)!.add(event.session_id)
    const steps = stepsBySession.get(event.session_id) ?? new Set()
    steps.add(event.node_key)
    stepsBySession.set(event.session_id, steps)
  }

  const eventsBySession = new Map<string, typeof events>()
  for (const event of events) {
    const list = eventsBySession.get(event.session_id) ?? []
    list.push(event)
    eventsBySession.set(event.session_id, list)
  }

  const statusCounts: Record<ConversationSession['status'], number> = {
    active: 0,
    completed: 0,
    failed: 0,
    abandoned: 0,
  }
  const visitorCounts = new Map<string, number>()
  let anonymousSessions = 0
  const durations: number[] = []
  let shopSessions = 0
  let paidSessions = 0
  const productQty = new Map<string, { name: string; qty: number }>()
  const chatbotMap = new Map<string, ChatbotSlice>()
  const errorCounts = new Map<string, number>()
  const hourCounts = Array.from({ length: 24 }, () => 0)
  let stepSum = 0

  const rangeStartDate = sinceMs != null ? new Date(sinceMs) : sessions.length
    ? new Date(Math.min(...sessions.map((s) => Date.parse(s.created_at)).filter(Number.isFinite)))
    : new Date(now)
  const rangeEndDate = new Date(now)
  const daily = buildTimeBuckets(
    Number.isFinite(rangeStartDate.getTime()) ? rangeStartDate : new Date(now),
    rangeEndDate,
  )
  const weekly = daily.length > 0 && differenceInCalendarDays(rangeEndDate, rangeStartDate) > 45
  const dailyIndex = new Map(daily.map((p, i) => [p.date, i]))

  for (const session of sessions) {
    const shown = displaySessionStatus(session, now)
    statusCounts[shown] += 1
    const duration = sessionDurationMs(session)
    if (duration != null && shown === 'completed') durations.push(duration)
    stepSum += stepsBySession.get(session.id)?.size ?? 0

    const created = Date.parse(session.created_at)
    if (Number.isFinite(created)) {
      const hour = new Date(created).getHours()
      hourCounts[hour] += 1
      const key = bucketKey(session.created_at, weekly)
      const idx = key != null ? dailyIndex.get(key) : undefined
      if (idx != null) {
        daily[idx]!.sessions += 1
        if (shown === 'completed') daily[idx]!.completed += 1
        if (shown === 'failed') daily[idx]!.failed += 1
      }
    }

    const visitor = session.visitor_key?.trim()
    if (visitor) visitorCounts.set(visitor, (visitorCounts.get(visitor) ?? 0) + 1)
    else anonymousSessions += 1

    const cart = cartFromVariables(session.variables)
    if (cart?.items?.length) shopSessions += 1
    const paid = sessionPaid(session, eventsBySession.get(session.id) ?? [], payments)
    if (paid) paidSessions += 1
    if (shown === 'completed' && cart?.items) {
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

    const bot = chatbotMap.get(session.chatbot_id) ?? {
      chatbotId: session.chatbot_id,
      name: session.chatbots?.name?.trim() || session.chatbot_id,
      sessions: 0,
      completed: 0,
      paid: 0,
    }
    bot.sessions += 1
    if (shown === 'completed') bot.completed += 1
    if (paid) bot.paid += 1
    chatbotMap.set(session.chatbot_id, bot)

    const err = session.error_summary?.trim()
    if (err) errorCounts.set(err, (errorCounts.get(err) ?? 0) + 1)
  }

  const dropOff: FunnelStep[] = dropOrder.map((nodeKey, index) => {
    const reached = dropCounts.get(nodeKey)?.size ?? 0
    const nextReached = dropOrder[index + 1] ? (dropCounts.get(dropOrder[index + 1]!)?.size ?? 0) : reached
    return {
      nodeKey,
      reached,
      dropped: Math.max(0, reached - nextReached),
    }
  })
  if (dropOff.length) dropOff[dropOff.length - 1]!.dropped = 0

  const paymentStatusMap = new Map<string, number>()
  const revenueMap = new Map<string, number>()
  for (const row of payments) {
    const status = row.status.trim() || 'pending'
    paymentStatusMap.set(status, (paymentStatusMap.get(status) ?? 0) + 1)
    if (status === 'verified') {
      const currency = (row.currency ?? 'ZAR').trim().toUpperCase() || 'ZAR'
      revenueMap.set(currency, (revenueMap.get(currency) ?? 0) + asAmount(row.amount))
    }
  }

  const uniqueVisitors = visitorCounts.size
  const returningVisitors = [...visitorCounts.values()].filter((n) => n > 1).length

  return {
    sessionCount: sessions.length,
    completedCount: statusCounts.completed,
    failedCount: statusCounts.failed,
    activeCount: statusCounts.active,
    abandonedCount: statusCounts.abandoned,
    completionRate: sessions.length ? (statusCounts.completed / sessions.length) * 100 : 0,
    uniqueVisitors,
    returningVisitors,
    anonymousSessions,
    avgDurationMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    medianDurationMs: median(durations),
    avgStepsPerSession: sessions.length ? stepSum / sessions.length : 0,
    userMessageCount,
    shopSessions,
    paidSessions,
    daily,
    byHour: hourCounts.map((count, hour) => ({ hour, count })),
    statusBreakdown: (['completed', 'active', 'abandoned', 'failed'] as const)
      .map((status) => ({ status, count: statusCounts[status] }))
      .filter((s) => s.count > 0),
    dropOff,
    topProducts: [...productQty.entries()]
      .map(([id, v]) => ({ id, name: v.name, qty: v.qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10),
    byChatbot: [...chatbotMap.values()].sort((a, b) => b.sessions - a.sessions),
    topErrors: [...errorCounts.entries()]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    paymentStatus: [...paymentStatusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    revenueByCurrency: [...revenueMap.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount),
  }
}
