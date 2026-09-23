import { TablePagination, useTablePagination } from '@/shared/ui/table-pagination'
import { useMemo } from 'react'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'
import { Card } from '@/shared/ui/card'
import { analyzeObservations, type Observation } from './observations'

type Event = Pick<ConversationEvent, 'session_id' | 'kind' | 'node_key' | 'payload' | 'seq'>
export function AnalyticsIntelligencePanel({ sessions, events, chatbotId, environment, rangeDays, loading, error }: {
  sessions: ConversationSession[]; events: Event[]; chatbotId: string; environment: string; rangeDays: number | null; loading: boolean; error: boolean
}) {
  const report = useMemo(() => {
    const cutoff = rangeDays ? Date.now() - rangeDays * 86400000 : -Infinity
    const selected = new Map(sessions.filter(s => (!chatbotId || s.chatbot_id === chatbotId) && (!environment || s.environment === environment) && Date.parse(s.created_at) >= cutoff).map(s => [s.id, s]))
    const observations: Observation[] = []
    for (const e of events) {
      const session = selected.get(e.session_id)
      if (!session || e.kind !== 'step.run' || !e.node_key) continue
      const p = e.payload && typeof e.payload === 'object' && !Array.isArray(e.payload) ? e.payload : {}
      observations.push({ session: session.id, bot: session.chatbot_id, version: String(session.publish_version), environment: session.environment ?? 'production', node: e.node_key, seq: e.seq,
        duration: typeof p.durationMs === 'number' && Number.isFinite(p.durationMs) && p.durationMs >= 0 ? p.durationMs : null,
        failed: p.status === 'Failed' || p.status === 'TimedOut' })
    }
    return analyzeObservations(observations)
  }, [sessions, events, chatbotId, environment, rangeDays])
  const pagination = useTablePagination(report.steps, JSON.stringify([chatbotId, environment, rangeDays]))
  return <Card className="space-y-3">
    <h2 className="font-semibold">Runtime and journey intelligence</h2>
    {error ? <p>Intelligence unavailable: conversation data could not be loaded.</p> : loading ? <p>Analyzing recorded runs…</p> : <>
      <p className="text-xs text-[var(--color-ink-muted)]">Based on loaded step events from {report.sessions} conversations, within the current filters. Data is sampled by the analytics page; results are not organisation-wide totals. Durations include time waiting for user responses. Anomalies need 10 timings; version comparisons need 10 timings or 20 outcomes per version.</p>
      {!report.steps.length ? <p>No recorded step runs in this selection.</p> : <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Step / chatbot</th><th>Runs</th><th>Failures</th><th>Median / p95</th><th>Anomalies</th><th>Version regression</th></tr></thead><tbody>
        {pagination.rows.map(s => <tr key={`${s.bot}/${s.environment}/${s.node}`}><td className="py-2">{s.node}<small className="block">{s.bot.slice(0, 8)} · {s.environment}</small></td><td>{s.count}</td><td>{s.failures}</td><td>{s.median == null ? 'No timings' : `${Math.round(s.median)} / ${Math.round(s.p95!)} ms`}</td><td>{s.anomalies ?? 'Insufficient data'}</td><td>{s.regression ? `Review ${s.comparison}` : 'No signal'}</td></tr>)}
      </tbody></table><TablePagination label="Runtime intelligence" {...pagination} /></div>}
      <p>Recommendations: {report.steps.some(s => s.regression) ? 'Review flagged version changes and rerun staging scenarios. ' : ''}{report.steps[0] ? `Inspect ${report.steps[0].node} first: it accounts for the most recorded time in this selection. Separate user wait time from connection time before optimizing.` : 'Collect conversation runs to identify bottlenecks.'}</p>
      <details><summary className="cursor-pointer">Most observed journey transitions</summary>{report.transitions.slice(0, 10).map((t, i) => <p key={i}>{t.bot.slice(0, 8)}: {t.from} → {t.to}: {t.count}</p>)}{!report.transitions.length ? <p>No consecutive step events available.</p> : null}</details>
    </>}
  </Card>
}
