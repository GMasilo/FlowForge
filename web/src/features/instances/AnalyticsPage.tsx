import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { buildConversationAnalytics } from '@/features/instances/conversationAnalytics'

type SessionRow = ConversationSession & { chatbots: { name: string } | null }

export function AnalyticsPage() {
  const { instance } = useRequiredInstance()
  const [chatbotId, setChatbotId] = useState('')

  const sessions = useQuery({
    queryKey: ['conversation-sessions-analytics', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as SessionRow[]
    },
  })

  const sessionIds = (sessions.data ?? []).map((s) => s.id)
  const events = useQuery({
    queryKey: ['conversation-events-analytics', instance.id, sessionIds.slice(0, 80).join(',')],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_events')
        .select('session_id, kind, node_key, payload, seq')
        .in('session_id', sessionIds.slice(0, 400))
        .order('seq', { ascending: true })
      if (error) throw error
      return (data ?? []) as Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key' | 'payload' | 'seq'>[]
    },
  })

  const payments = useQuery({
    queryKey: ['payment-intents-analytics', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_intents' as never)
        .select('id, chatbot_id, session_id, status')
        .eq('instance_id', instance.id)
        .limit(500)
      if (error) return [] as Array<{ chatbot_id: string; session_id: string | null; status: string }>
      return (data ?? []) as Array<{ chatbot_id: string; session_id: string | null; status: string }>
    },
  })

  const chatbots = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of sessions.data ?? []) {
      if (!map.has(row.chatbot_id)) map.set(row.chatbot_id, row.chatbots?.name ?? row.chatbot_id)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions.data])

  const stats = useMemo(
    () =>
      buildConversationAnalytics({
        sessions: sessions.data ?? [],
        events: events.data ?? [],
        payments: payments.data ?? [],
        chatbotId: chatbotId || null,
      }),
    [sessions.data, events.data, payments.data, chatbotId],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Drop-off, payment conversion, and top products for ${instance.name}.`}
        actions={
          <Select
            className="min-w-[200px]"
            value={chatbotId}
            onChange={(e) => setChatbotId(e.target.value)}
            aria-label="Chatbot"
          >
            <option value="">All chatbots</option>
            {chatbots.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Sessions" value={stats.sessionCount} />
        <StatCard label="Completed" value={stats.completedCount} />
        <StatCard
          label="Payment conversion"
          value={stats.shopSessions ? `${Math.round((stats.paidSessions / stats.shopSessions) * 100)}%` : '—'}
          hint={
            stats.shopSessions
              ? `${stats.paidSessions} paid of ${stats.shopSessions} with a cart`
              : 'No shop checkouts in this set'
          }
        />
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800">Drop-off by step</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Sessions that reached each step.run. Ordered by first appearance in transcripts.
        </p>
        {stats.dropOff.length ? (
          <ul className="mt-3 space-y-2">
            {stats.dropOff.map((row) => {
              const pct = stats.sessionCount ? Math.round((row.reached / stats.sessionCount) * 100) : 0
              return (
                <li key={row.nodeKey}>
                  <div className="mb-0.5 flex justify-between text-sm">
                    <span className="font-mono text-slate-700">{row.nodeKey}</span>
                    <span className="text-slate-500">
                      {row.reached} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No step events yet.</p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-800">Top products</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Quantities from completed session variables (cart.items).
        </p>
        {stats.topProducts.length ? (
          <ol className="mt-3 space-y-1.5 text-sm">
            {stats.topProducts.map((p, i) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {i + 1}. {p.name}
                </span>
                <span className="tabular-nums text-slate-500">{p.qty} sold</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No cart items in completed sessions.</p>
        )}
      </Card>
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </Card>
  )
}
