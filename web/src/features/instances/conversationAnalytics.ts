import type { ConversationEvent, ConversationSession, Json } from '@/shared/types/database'

export type AnalyticsPaymentRow = {
  chatbot_id: string
  session_id: string | null
  status: string
}

export type ConversationAnalytics = {
  sessionCount: number
  completedCount: number
  shopSessions: number
  paidSessions: number
  dropOff: Array<{ nodeKey: string; reached: number }>
  topProducts: Array<{ id: string; name: string; qty: number }>
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

export function buildConversationAnalytics(args: {
  sessions: ConversationSession[]
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key' | 'payload' | 'seq'>>
  payments: AnalyticsPaymentRow[]
  chatbotId?: string | null
}): ConversationAnalytics {
  const sessions = args.chatbotId
    ? args.sessions.filter((s) => s.chatbot_id === args.chatbotId)
    : args.sessions
  const sessionIds = new Set(sessions.map((s) => s.id))
  const events = args.events.filter((e) => sessionIds.has(e.session_id))
  const payments = args.chatbotId
    ? args.payments.filter((p) => p.chatbot_id === args.chatbotId)
    : args.payments

  const dropOrder: string[] = []
  const dropCounts = new Map<string, Set<string>>()
  for (const event of events) {
    if (event.kind !== 'step.run' || !event.node_key) continue
    if (!dropCounts.has(event.node_key)) {
      dropCounts.set(event.node_key, new Set())
      dropOrder.push(event.node_key)
    }
    dropCounts.get(event.node_key)!.add(event.session_id)
  }

  const eventsBySession = new Map<string, typeof events>()
  for (const event of events) {
    const list = eventsBySession.get(event.session_id) ?? []
    list.push(event)
    eventsBySession.set(event.session_id, list)
  }

  let shopSessions = 0
  let paidSessions = 0
  const productQty = new Map<string, { name: string; qty: number }>()
  for (const session of sessions) {
    const cart = cartFromVariables(session.variables)
    if (cart?.items?.length) shopSessions += 1
    if (sessionPaid(session, eventsBySession.get(session.id) ?? [], payments)) paidSessions += 1
    if (session.status !== 'completed' || !cart?.items) continue
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

  return {
    sessionCount: sessions.length,
    completedCount: sessions.filter((s) => s.status === 'completed').length,
    shopSessions,
    paidSessions,
    dropOff: dropOrder.map((nodeKey) => ({
      nodeKey,
      reached: dropCounts.get(nodeKey)?.size ?? 0,
    })),
    topProducts: [...productQty.entries()]
      .map(([id, v]) => ({ id, name: v.name, qty: v.qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10),
  }
}
