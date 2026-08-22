/**
 * Manual check: npx vite-node src/features/instances/conversationAnalytics.check.ts
 */
import { buildConversationAnalytics } from '@/features/instances/conversationAnalytics'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const sessions = [
  {
    id: 's1',
    chatbot_id: 'bot',
    instance_id: 'i',
    status: 'completed',
    visitor_key: null,
    publish_version: 1,
    variables: {
      cart: {
        items: [{ id: 'p1', name: 'Latte', qty: 2 }],
        total: 9,
        itemCount: 2,
      },
      payment: { status: 'paid', reference: 'REF1' },
    },
    error_summary: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    completed_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 's2',
    chatbot_id: 'bot',
    instance_id: 'i',
    status: 'failed',
    visitor_key: null,
    publish_version: 1,
    variables: {},
    error_summary: 'oops',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    completed_at: null,
  },
] as ConversationSession[]

const events = [
  { session_id: 's1', kind: 'step.run', node_key: 'shop', payload: { type: 'question' }, seq: 1 },
  { session_id: 's1', kind: 'step.run', node_key: 'pay', payload: { type: 'question', outputs: { status: 'paid' } }, seq: 2 },
  { session_id: 's2', kind: 'step.run', node_key: 'shop', payload: { type: 'question' }, seq: 1 },
] as Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key' | 'payload' | 'seq'>[]

const stats = buildConversationAnalytics({
  sessions,
  events,
  payments: [{ chatbot_id: 'bot', session_id: 's1', status: 'verified', amount: 9, currency: 'ZAR' }],
  chatbotId: 'bot',
  now: Date.parse('2026-08-02T00:00:00.000Z'),
})

assert(stats.sessionCount === 2, 'session count')
assert(stats.completedCount === 1, 'completed')
assert(stats.failedCount === 1, 'failed')
assert(stats.shopSessions === 1, 'shop sessions')
assert(stats.paidSessions === 1, 'paid')
assert(stats.dropOff[0]?.nodeKey === 'shop' && stats.dropOff[0].reached === 2, 'drop-off shop')
assert(stats.dropOff[0]?.dropped === 1, 'one session left after shop')
assert(stats.topProducts[0]?.qty === 2 && stats.topProducts[0]?.name === 'Latte', 'top product')
assert(stats.statusBreakdown.some((s) => s.status === 'completed' && s.count === 1), 'status mix')
assert(stats.daily.some((d) => d.sessions >= 1), 'daily series has volume')
assert(stats.byHour.reduce((n, h) => n + h.count, 0) === 2, 'hour buckets sum to sessions')
assert(stats.revenueByCurrency[0]?.currency === 'ZAR' && stats.revenueByCurrency[0]?.amount === 9, 'verified revenue')
assert(Math.round(stats.completionRate) === 50, 'completion rate')

const last7 = buildConversationAnalytics({
  sessions,
  events,
  payments: [{ chatbot_id: 'bot', session_id: 's1', status: 'verified', amount: 9, currency: 'ZAR' }],
  chatbotId: 'bot',
  sinceMs: Date.parse('2026-08-10T00:00:00.000Z'),
  now: Date.parse('2026-08-14T00:00:00.000Z'),
})
assert(last7.sessionCount === 0, 'range filter excludes older sessions')

console.log('conversationAnalytics.check.ts: all passed')
