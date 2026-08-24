import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageSquare,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'
import { buildConversationAnalytics } from '@/features/instances/conversationAnalytics'

type SessionRow = ConversationSession & { chatbots: { name: string } | null }

type RangeKey = '7' | '30' | '90' | 'all'

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string; days: number | null }> = [
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
]

const STATUS_COLORS: Record<string, string> = {
  completed: 'var(--color-accent)',
  active: '#38bdf8',
  abandoned: '#f59e0b',
  failed: '#f43f5e',
}

export function AnalyticsPage() {
  const { instance } = useRequiredInstance()
  const [chatbotId, setChatbotId] = useState('')
  const [range, setRange] = useState<RangeKey>('30')

  const rangeDays = RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 30

  const sessions = useQuery({
    queryKey: ['conversation-sessions-analytics', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return data as SessionRow[]
    },
  })

  const sessionIds = (sessions.data ?? []).map((s) => s.id)
  const events = useQuery({
    queryKey: ['conversation-events-analytics', instance.id, sessionIds.slice(0, 100).join(',')],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const ids = sessionIds.slice(0, 800)
      const { data, error } = await supabase
        .from('conversation_events')
        .select('session_id, kind, node_key, payload, seq')
        .in('session_id', ids)
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
        .limit(1000)
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
        rangeDays,
      }),
    [sessions.data, events.data, payments.data, chatbotId, rangeDays],
  )

  const loading = sessions.isLoading || events.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Conversation volume, conversion, and funnel health for ${instance.name}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="min-w-[140px]"
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              aria-label="Date range"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Select
              className="min-w-[180px]"
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
        <p className="text-sm text-[var(--color-ink-muted)]">Loading analytics…</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Sessions"
          value={stats.sessionCount.toLocaleString()}
          hint={`${stats.uniqueVisitors.toLocaleString()} unique visitors`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completion rate"
          value={`${stats.completionRate}%`}
          hint={`${stats.completedCount.toLocaleString()} completed`}
        />
        <KpiCard
          icon={<CreditCard className="h-4 w-4" />}
          label="Payment conversion"
          value={stats.shopSessions ? `${stats.paymentConversionRate}%` : '—'}
          hint={
            stats.shopSessions
              ? `${stats.paidSessions} paid of ${stats.shopSessions} with cart`
              : 'No shop checkouts in range'
          }
        />
        <KpiCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Avg duration"
          value={stats.avgDurationMinutes != null ? `${stats.avgDurationMinutes}m` : '—'}
          hint={
            stats.medianSteps != null
              ? `Median ${stats.medianSteps} steps · ${stats.activeCount} active`
              : `${stats.activeCount} active now`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <SectionTitle
            icon={<TrendingUp className="h-4 w-4" />}
            title="Sessions over time"
            subtitle="Daily volume and completions"
          />
          <AreaLineChart
            points={stats.sessionsByDay.map((d) => ({
              label: d.label,
              primary: d.sessions,
              secondary: d.completed,
            }))}
            primaryLabel="Sessions"
            secondaryLabel="Completed"
          />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={<Activity className="h-4 w-4" />} title="Status mix" subtitle="Outcome of sessions in range" />
          <StatusDonut items={stats.statusBreakdown} />
          <ul className="mt-4 space-y-1.5">
            {stats.statusBreakdown.map((row) => (
              <li key={row.status} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize text-[var(--color-ink)]">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[row.status] ?? 'var(--color-ink-muted)' }}
                  />
                  {row.status}
                </span>
                <span className="tabular-nums text-[var(--color-ink-muted)]">
                  {row.count} · {row.pct}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="Drop-off by step" subtitle="Share of sessions that reached each step.run" />
          {stats.dropOff.length ? (
            <HorizontalBars
              items={stats.dropOff.slice(0, 14).map((r) => ({
                label: r.nodeKey,
                value: r.reached,
                pct: r.pct,
              }))}
              mono
            />
          ) : (
            <EmptyHint>No step events yet.</EmptyHint>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="Activity by hour" subtitle="When conversations start (local time)" />
          <HourBars items={stats.hourOfDay} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            icon={<Users className="h-4 w-4" />}
            title="By chatbot"
            subtitle="Volume and completion rate"
          />
          {stats.byChatbot.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]/60 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                    <th className="pb-2 pr-3 font-semibold">Chatbot</th>
                    <th className="pb-2 pr-3 font-semibold tabular-nums">Sessions</th>
                    <th className="pb-2 pr-3 font-semibold tabular-nums">Completed</th>
                    <th className="pb-2 font-semibold tabular-nums">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byChatbot.map((row) => (
                    <tr key={row.chatbotId} className="border-b border-[var(--color-border)]/40 last:border-0">
                      <td className="py-2 pr-3 font-medium text-[var(--color-ink)]">{row.name}</td>
                      <td className="py-2 pr-3 tabular-nums text-[var(--color-ink-muted)]">{row.sessions}</td>
                      <td className="py-2 pr-3 tabular-nums text-[var(--color-ink-muted)]">{row.completed}</td>
                      <td className="py-2 tabular-nums text-[var(--color-ink)]">{row.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyHint>No chatbot traffic in this range.</EmptyHint>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle title="Top products" subtitle="Quantities from completed session carts" />
          {stats.topProducts.length ? (
            <HorizontalBars
              items={stats.topProducts.map((p) => ({
                label: p.name,
                value: p.qty,
                pct: stats.topProducts[0]?.qty
                  ? Math.round((p.qty / stats.topProducts[0].qty) * 100)
                  : 0,
              }))}
              valueSuffix=" sold"
            />
          ) : (
            <EmptyHint>No cart items in completed sessions.</EmptyHint>
          )}
          {stats.paymentStatus.length ? (
            <div className="mt-5 border-t border-[var(--color-border)]/50 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                Payment intents
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {stats.paymentStatus.map((p) => (
                  <li
                    key={p.status}
                    className="rounded-full border border-[var(--color-border)]/70 bg-[var(--color-surface-2)] px-2.5 py-1 text-xs capitalize text-[var(--color-ink)]"
                  >
                    {p.status}: <span className="font-semibold tabular-nums">{p.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}

function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
        {icon}
        {title}
      </h2>
      {subtitle ? <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">{subtitle}</p> : null}
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{children}</p>
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</p>
        {icon ? (
          <span className="rounded-lg bg-[var(--color-accent-soft)] p-1.5 text-[var(--color-accent)]">{icon}</span>
        ) : null}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{hint}</p> : null}
    </Card>
  )
}

function HorizontalBars({
  items,
  mono,
  valueSuffix = '',
}: {
  items: Array<{ label: string; value: number; pct: number }>
  mono?: boolean
  valueSuffix?: string
}) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((row) => (
        <li key={row.label}>
          <div className="mb-0.5 flex justify-between gap-3 text-sm">
            <span
              className={cn(
                'min-w-0 truncate text-[var(--color-ink)]',
                mono && 'font-mono text-[13px]',
              )}
              title={row.label}
            >
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--color-ink-muted)]">
              {row.value.toLocaleString()}
              {valueSuffix} · {row.pct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)] transition-all"
              style={{ width: `${Math.max(2, Math.min(100, row.pct))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function HourBars({ items }: { items: Array<{ hour: number; label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="mt-4 flex h-36 items-end gap-0.5 sm:gap-1">
      {items.map((row) => {
        const h = Math.round((row.count / max) * 100)
        return (
          <div key={row.hour} className="group relative flex min-w-0 flex-1 flex-col items-center justify-end">
            <div
              className="w-full max-w-[14px] rounded-t-sm bg-gradient-to-t from-[var(--color-accent)] to-[var(--color-accent-2)] opacity-80 transition group-hover:opacity-100"
              style={{ height: `${Math.max(row.count ? 6 : 2, h)}%` }}
              title={`${row.label}: ${row.count}`}
            />
            {row.hour % 3 === 0 ? (
              <span className="mt-1 hidden text-[9px] text-[var(--color-ink-muted)] sm:inline">
                {String(row.hour).padStart(2, '0')}
              </span>
            ) : (
              <span className="mt-1 h-3" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatusDonut({ items }: { items: Array<{ status: string; count: number; pct: number }> }) {
  const total = items.reduce((a, b) => a + b.count, 0) || 1
  const size = 140
  const stroke = 18
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  if (!items.length || items.every((i) => i.count === 0)) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm text-[var(--color-ink-muted)]">
        No data
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        {items.map((row) => {
          const len = (row.count / total) * c
          const el = (
            <circle
              key={row.status}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={STATUS_COLORS[row.status] ?? 'var(--color-ink-muted)'}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          )
          offset += len
          return el
        })}
      </svg>
    </div>
  )
}

function AreaLineChart({
  points,
  primaryLabel,
  secondaryLabel,
}: {
  points: Array<{ label: string; primary: number; secondary: number }>
  primaryLabel: string
  secondaryLabel: string
}) {
  const w = 640
  const h = 200
  const pad = { t: 16, r: 12, b: 28, l: 36 }
  const max = Math.max(1, ...points.map((p) => Math.max(p.primary, p.secondary)))
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const n = Math.max(1, points.length - 1)

  const xAt = (i: number) => pad.l + (i / n) * innerW
  const yAt = (v: number) => pad.t + innerH - (v / max) * innerH

  const linePath = (key: 'primary' | 'secondary') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p[key]).toFixed(1)}`)
      .join(' ')

  const areaPath = (() => {
    if (!points.length) return ''
    const top = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.primary).toFixed(1)}`)
      .join(' ')
    const lastX = xAt(points.length - 1)
    const firstX = xAt(0)
    return `${top} L ${lastX.toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${firstX.toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`
  })()

  const labelEvery = Math.max(1, Math.ceil(points.length / 8))

  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent-2)] opacity-80" />
          {secondaryLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" role="img" aria-label="Sessions over time">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.t + innerH * (1 - t)
          const val = Math.round(max * t)
          return (
            <g key={t}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeOpacity={0.5}
                strokeDasharray="4 4"
              />
              <text
                x={pad.l - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--color-ink-muted)"
              >
                {val}
              </text>
            </g>
          )
        })}
        <path d={areaPath} fill="var(--color-accent)" fillOpacity={0.12} />
        <path
          d={linePath('primary')}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={linePath('secondary')}
          fill="none"
          stroke="var(--color-accent-2)"
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeOpacity={0.85}
        />
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={p.label + i}
              x={xAt(i)}
              y={h - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-muted)"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}
