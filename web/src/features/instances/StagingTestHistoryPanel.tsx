import { TablePagination, useTablePagination } from '@/shared/ui/table-pagination'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ExternalLink, FlaskConical } from 'lucide-react'
import {
  buildStagingTestHistoryRows,
  type StagingTestSource,
} from '@/features/instances/stagingTestHistory'
import { sessionStatusTone } from '@/features/instances/conversationStatus'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'
import { instanceFeatureEnabled } from '@/shared/types/database'
import type { Instance } from '@/shared/types/database'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { SECTION_HELP } from '@/shared/help/pageHelp'
import { HelpTooltip } from '@/shared/ui/help-tooltip'
import { Select } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

type SessionRow = ConversationSession & { chatbots?: { name: string } | null }

export function StagingTestHistoryPanel({
  instance,
  sessions,
  events,
  chatbotId,
  rangeDays,
  loading,
}: {
  instance: Instance
  sessions: SessionRow[]
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind'>>
  chatbotId?: string | null
  rangeDays?: number | null
  loading?: boolean
}) {
  const [sourceFilter, setSourceFilter] = useState<StagingTestSource | ''>('')
  const stagingEnabled = instanceFeatureEnabled(instance, 'staging')

  const rows = useMemo(
    () =>
      buildStagingTestHistoryRows({
        sessions,
        events,
        chatbotId,
        rangeDays,
        sourceFilter,
      }),
    [sessions, events, chatbotId, rangeDays, sourceFilter],
  )

  const pagination = useTablePagination(rows, JSON.stringify([instance.id, chatbotId, rangeDays, sourceFilter]))
  const completedCount = rows.filter((r) => r.shownStatus === 'completed').length
  const completionRate = rows.length ? Math.round((completedCount / rows.length) * 100) : 0

  if (!stagingEnabled) {
    return (
      <Card className="p-4">
        <PanelHeader />
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
          Staging is not enabled for this organisation. Enable it under organisation features to run and track
          staging tests.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelHeader />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="min-w-[160px]"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as StagingTestSource | '')}
            aria-label="Staging test source"
          >
            <option value="">All staging sources</option>
            <option value="test_link">Test link only</option>
            <option value="public_staging">Public staging URL</option>
          </Select>
        </div>
      </div>

      {rows.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="bg-sky-100 text-sky-900">{rows.length} staging tests</Badge>
          <Badge className="bg-emerald-50 text-emerald-800">{completionRate}% completed</Badge>
          <Badge className="bg-slate-100 text-slate-700">
            {rows.filter((r) => r.source === 'test_link').length} via test link
          </Badge>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Loading staging test history…</p>
      ) : rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]/60 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <th className="px-2 pb-2 font-semibold">Started</th>
                <th className="px-2 pb-2 font-semibold">Chatbot</th>
                <th className="px-2 pb-2 font-semibold">Source</th>
                <th className="px-2 pb-2 font-semibold">Status</th>
                <th className="px-2 pb-2 font-semibold tabular-nums">Version</th>
                <th className="px-2 pb-2 font-semibold tabular-nums">Steps</th>
                <th className="px-2 pb-2 font-semibold tabular-nums">Duration</th>
                <th className="px-2 pb-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagination.rows.map((row) => (
                <tr key={row.session.id} className="border-b border-[var(--color-border)]/40 last:border-0">
                  <td className="px-2 py-2.5 whitespace-nowrap text-[var(--color-ink-muted)]">
                    {format(new Date(row.session.created_at), 'MMM d, HH:mm')}
                  </td>
                  <td className="px-2 py-2.5 text-[var(--color-ink)]">
                    {row.session.chatbots?.name ?? row.session.chatbot_id.slice(0, 8)}
                  </td>
                  <td className="px-2 py-2.5">
                    {row.source === 'test_link' ? (
                      <Badge className="bg-violet-100 text-violet-900">Test link</Badge>
                    ) : (
                      <Badge className="bg-sky-100 text-sky-900">Public staging</Badge>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                        sessionStatusTone(row.shownStatus),
                      )}
                    >
                      {row.shownStatus}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 tabular-nums text-[var(--color-ink-muted)]">
                    {row.session.publish_version != null ? `v${row.session.publish_version}` : '—'}
                  </td>
                  <td className="px-2 py-2.5 tabular-nums text-[var(--color-ink-muted)]">{row.stepCount}</td>
                  <td className="px-2 py-2.5 tabular-nums text-[var(--color-ink-muted)]">
                    {row.durationMinutes != null ? `${row.durationMinutes}m` : '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                        to={`/instances/${instance.id}/conversations/${row.session.id}`}
                      >
                        Replay
                      </Link>
                      <Link
                        className="inline-flex items-center gap-1 font-medium text-[var(--color-ink-muted)] underline-offset-2 hover:text-[var(--color-ink)] hover:underline"
                        to={`/instances/${instance.id}/chatbots/${row.session.chatbot_id}/test`}
                      >
                        Test
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination label="Staging history" {...pagination} />
    
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
          No staging tests in this range. Run a test from a chatbot&apos;s Test tab or open a public staging URL (
          <code className="text-[11px]">?env=staging</code>).
        </p>
      )}
    </Card>
  )
}

function PanelHeader() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Staging test history</h2>
        <HelpTooltip content={SECTION_HELP.stagingTestHistory} label="Help: Staging test history" />
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Staging sessions from test links and public staging URLs. Respects chatbot and date filters above.
      </p>
    </div>
  )
}
