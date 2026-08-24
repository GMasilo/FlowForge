import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'
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
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

type SessionRow = ConversationSession & { chatbots: { name: string } | null }

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function ConversationsPage() {
  const { instance } = useRequiredInstance()
  const [chatbotId, setChatbotId] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')

  const sessions = useQuery({
    queryKey: ['conversation-sessions', instance.id],
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

  const chatbots = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of sessions.data ?? []) {
      if (!map.has(row.chatbot_id)) map.set(row.chatbot_id, row.chatbots?.name ?? row.chatbot_id)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [sessions.data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (sessions.data ?? []).filter((row) => {
      if (chatbotId && row.chatbot_id !== chatbotId) return false
      const shown = displaySessionStatus(row)
      if (status && shown !== status) return false
      if (q) {
        const hay = [
          row.id,
          row.visitor_key ?? '',
          row.chatbots?.name ?? '',
          row.error_summary ?? '',
          shown,
          row.publish_version != null ? `v${row.publish_version}` : '',
          JSON.stringify(row.variables ?? {}),
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [sessions.data, chatbotId, status, query])

  function exportCsv() {
    const header = ['id', 'started_at', 'chatbot', 'status', 'publish_version', 'visitor_key', 'error_summary']
    const lines = [header.join(',')]
    for (const s of rows) {
      const shown = displaySessionStatus(s)
      lines.push(
        [
          s.id,
          s.created_at,
          s.chatbots?.name ?? '',
          shown,
          s.publish_version != null ? String(s.publish_version) : '',
          s.visitor_key ?? '',
          s.error_summary ?? '',
        ]
          .map((c) => csvEscape(String(c)))
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversations-${instance.slug || instance.id}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversations"
        description={`Search, filter, and export sessions for ${instance.name}.`}
        actions={
          <Button type="button" variant="secondary" size="sm" disabled={!rows.length} onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search id, visitor, error, variables…"
            aria-label="Search conversations"
          />
        </div>
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
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Started</th>
                  <th className="px-4 py-2.5 font-semibold">Chatbot</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Version</th>
                  <th className="px-4 py-2.5 font-semibold">Visitor</th>
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
                      <td className="px-4 py-2.5 font-medium text-[var(--color-ink)]">
                        {s.chatbots?.name ?? '—'}
                      </td>
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
                      <td className="max-w-[8rem] truncate px-4 py-2.5 font-mono text-[11px] text-[var(--color-ink-muted)]">
                        {s.visitor_key || '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-rose-600">{s.error_summary || '—'}</td>
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
