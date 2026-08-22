import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import type { ConversationEvent } from '@/shared/types/database'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import {
  ANALYTICS_RANGE_OPTIONS,
  analyticsRangeStart,
  buildConversationAnalytics,
  formatDurationMs,
  formatMoney,
  type AnalyticsPaymentRow,
  type AnalyticsRangeKey,
  type AnalyticsSessionRow,
} from '@/features/instances/conversationAnalytics'
import { AreaChart, DonutChart, HorizontalBars, HourChart } from '@/features/instances/analyticsCharts'

export function AnalyticsPage() {
  const { instance } = useRequiredInstance()
  const [chatbotId, setChatbotId] = useState('')
  const [range, setRange] = useState<AnalyticsRangeKey>('30d')

  const sessions = useQuery({
    queryKey: ['conversation-sessions-analytics', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(800)
      if (error) throw error
      return data as AnalyticsSessionRow[]
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
        .select('chatbot_id, session_id, status, amount, currency')
        .eq('instance_id', instance.id)
        .limit(800)
      if (error) return [] as AnalyticsPaymentRow[]
      return (data ?? []) as AnalyticsPaymentRow[]
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
        sinceMs: analyticsRangeStart(range),
      }),
    [sessions.data, events.data, payments.data, chatbotId, range],
  )

  const loading = sessions.isLoading
  const revenueHint = stats.revenueByCurrency.length
    ? stats.revenueByCurrency.map((r) => formatMoney(r.amount, r.currency)).join(' · ')
    : 'No verified payments'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`How chats move through ${instance.name}: volume, completion, drop-off, and payments.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="min-w-[160px]"
              value={range}
              onChange={(e) => setRange(e.target.value as AnalyticsRangeKey)}
              aria-label="Date range"
            >
              {ANALYTICS_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
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
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sessions" value={stats.sessionCount} hint={`${stats.uniqueVisitors} known visitors`} />
        <StatCard
          label="Completed"
          value={stats.completedCount}
          hint={`${Math.round(stats.completionRate)}% completion`}
        />
        <StatCard
          label="Median duration"
          value={formatDurationMs(stats.medianDurationMs)}
          hint={
            stats.avgDurationMs != null
              ? `Average ${formatDurationMs(stats.avgDurationMs)} · ${stats.avgStepsPerSession.toFixed(1)} steps`
              : 'Completed sessions only'
          }
        />
        <StatCard
          label="Payment conversion"
          value={stats.shopSessions ? `${Math.round((stats.paidSessions / stats.shopSessions) * 100)}%` : '—'}
          hint={
            stats.shopSessions
              ? `${stats.paidSessions} paid of ${stats.shopSessions} with a cart`
              : revenueHint
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active" value={stats.activeCount} />
        <StatCard label="Abandoned" value={stats.abandonedCount} hint="Active with no update for 24h" />
        <StatCard label="Failed" value={stats.failedCount} />
        <StatCard
          label="Revenue"
          value={stats.revenueByCurrency[0] ? formatMoney(stats.revenueByCurrency[0].amount, stats.revenueByCurrency[0].currency) : '—'}
          hint={stats.revenueByCurrency.length > 1 ? revenueHint : 'Verified payment intents'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-ink)]">Sessions over time</h2>
              <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">Started conversations in the selected range.</p>
            </div>
            <ul className="flex gap-3 text-[11px] text-[var(--color-ink-muted)]">
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-[var(--color-accent)]" /> Sessions
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded border-b border-dashed border-cyan-600" /> Completed
              </li>
            </ul>
          </div>
          {stats.daily.some((p) => p.sessions) ? (
            <AreaChart points={stats.daily} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--color-ink-muted)]">No sessions in this range.</p>
          )}
        </Card>
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Status mix</h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">How sessions ended (stale active chats count as abandoned).</p>
          {stats.statusBreakdown.length ? (
            <div className="mt-4">
              <DonutChart slices={stats.statusBreakdown} />
            </div>
          ) : (
            <p className="mt-6 text-sm text-[var(--color-ink-muted)]">No sessions yet.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">When people chat</h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">Session starts by hour of day (local time).</p>
          {stats.sessionCount ? (
            <div className="mt-4">
              <HourChart points={stats.byHour} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No sessions yet.</p>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">By chatbot</h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">Volume and completion for each flow.</p>
          {stats.byChatbot.length ? (
            <div className="mt-3">
              <HorizontalBars
                items={stats.byChatbot.map((b) => ({
                  key: b.chatbotId,
                  label: b.name,
                  value: b.sessions,
                  hint: `${b.completed} done`,
                }))}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No chatbot traffic yet.</p>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Drop-off by step</h2>
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Sessions that reached each step.run. “Left” is how many did not continue to the next recorded step.
        </p>
        {stats.dropOff.length ? (
          <ul className="mt-3 space-y-2">
            {stats.dropOff.map((row) => {
              const pct = stats.sessionCount ? Math.round((row.reached / stats.sessionCount) * 100) : 0
              return (
                <li key={row.nodeKey}>
                  <div className="mb-0.5 flex justify-between text-sm">
                    <span className="font-mono text-[var(--color-ink)]">{row.nodeKey}</span>
                    <span className="text-[var(--color-ink-muted)]">
                      {row.reached} reached · {pct}%
                      {row.dropped ? ` · ${row.dropped} left` : ''}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)]"
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Top products</h2>
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">Quantities from completed session carts.</p>
          {stats.topProducts.length ? (
            <div className="mt-3">
              <HorizontalBars
                items={stats.topProducts.map((p) => ({
                  key: p.id,
                  label: p.name,
                  value: p.qty,
                }))}
                valueSuffix=" sold"
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No cart items in completed sessions.</p>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Payments</h2>
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">Payment intents in this organisation.</p>
          {stats.paymentStatus.length ? (
            <div className="mt-3">
              <HorizontalBars
                items={stats.paymentStatus.map((p) => ({
                  key: p.status,
                  label: p.status,
                  value: p.count,
                }))}
              />
              {stats.revenueByCurrency.length ? (
                <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
                  Verified total {stats.revenueByCurrency.map((r) => formatMoney(r.amount, r.currency)).join(' · ')}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No payment intents yet.</p>
          )}
        </Card>
      </div>

      {stats.topErrors.length ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Common errors</h2>
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">From failed session summaries.</p>
          <ol className="mt-3 space-y-1.5 text-sm">
            {stats.topErrors.map((row, i) => (
              <li key={row.message} className="flex justify-between gap-3">
                <span className="min-w-0 truncate text-[var(--color-ink)]">
                  {i + 1}. {row.message}
                </span>
                <span className="shrink-0 tabular-nums text-[var(--color-ink-muted)]">{row.count}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {stats.userMessageCount || stats.returningVisitors ? (
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          {stats.userMessageCount ? `${stats.userMessageCount} visitor replies in loaded transcripts. ` : ''}
          {stats.returningVisitors
            ? `${stats.returningVisitors} returning visitor${stats.returningVisitors === 1 ? '' : 's'} (same visitor key, more than one session).`
            : ''}
          {stats.anonymousSessions ? ` ${stats.anonymousSessions} sessions had no visitor key.` : ''}
        </p>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{hint}</p> : null}
    </Card>
  )
}
