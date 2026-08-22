import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  displaySessionStatus,
  sessionStatusTone,
} from '@/features/instances/conversationStatus'
import { type ConversationSession } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { Badge } from '@/shared/ui/badge'
import { Select } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

type SessionRow = ConversationSession & { chatbots: { name: string } | null }

export function ConversationsPage() {
  const { instance } = useRequiredInstance()
  const [chatbotId, setChatbotId] = useState('')
  const [status, setStatus] = useState('')

  const sessions = useQuery({
    queryKey: ['conversation-sessions', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as SessionRow[]
    },
  })

  const chatbots = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of sessions.data ?? []) {
      if (!map.has(row.chatbot_id)) map.set(row.chatbot_id, row.chatbots?.name ?? row.chatbot_id)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions.data])

  const rows = useMemo(() => {
    return (sessions.data ?? []).filter((row) => {
      if (chatbotId && row.chatbot_id !== chatbotId) return false
      const shown = displaySessionStatus(row)
      if (status && shown !== status) return false
      return true
    })
  }, [sessions.data, chatbotId, status])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        description={`Open a session to replay the transcript for ${instance.name}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={chatbotId} onChange={(e) => setChatbotId(e.target.value)} aria-label="Filter by chatbot">
          <option value="">All chatbots</option>
          {chatbots.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        {sessions.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/80 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Started</th>
                  <th className="px-4 py-2.5 font-semibold">Chatbot</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Version</th>
                  <th className="px-4 py-2.5 font-semibold">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/60">
                {rows.map((s) => {
                  const shown = displaySessionStatus(s)
                  return (
                    <tr key={s.id} className="hover:bg-[var(--color-accent-soft)]/40">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <Link
                          to={`/instances/${instance.id}/conversations/${s.id}`}
                          className="font-medium text-[var(--color-accent)] hover:underline"
                        >
                          {format(new Date(s.created_at), 'yyyy-MM-dd HH:mm')}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[var(--color-ink)]">{s.chatbots?.name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                            sessionStatusTone(shown),
                          )}
                        >
                          {shown}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-ink-muted)]">
                        {s.publish_version != null ? `v${s.publish_version}` : '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-[var(--color-danger)]">{s.error_summary || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">
            {sessions.data?.length ? 'No conversations match these filters.' : 'No conversations yet.'}
          </p>
        )}
      </Card>
      {sessions.data?.length ? (
        <div className="flex gap-2">
          <Badge>
            Showing {rows.length} of latest {sessions.data.length}
          </Badge>
        </div>
      ) : null}
    </div>
  )
}
