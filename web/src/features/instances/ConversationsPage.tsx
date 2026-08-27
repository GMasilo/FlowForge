import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Download, Search } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  displaySessionStatus,
  sessionStatusTone,
} from '@/features/instances/conversationStatus'
import { canAgentOperate, type ConversationSession, type ConversationTag } from '@/shared/types/database'
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
  const { instance, role } = useRequiredInstance()
  const qc = useQueryClient()
  const agentOps = canAgentOperate(role)
  const [chatbotId, setChatbotId] = useState('')
  const [status, setStatus] = useState(() => (role === 'agent' ? 'escalated' : ''))
  const [environment, setEnvironment] = useState('')
  const [query, setQuery] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagFilter, setTagFilter] = useState('')

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

  const tags = useQuery({
    queryKey: ['conversation-tags', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_tags')
        .select('*')
        .eq('instance_id', instance.id)
        .order('name')
      if (error) throw error
      return (data ?? []) as ConversationTag[]
    },
  })

  const assignments = useQuery({
    queryKey: ['conversation-tag-assignments-all', instance.id],
    enabled: !!tagFilter,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_tag_assignments')
        .select('session_id, tag_id')
        .eq('tag_id', tagFilter)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.session_id as string))
    },
  })

  const createTag = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('conversation_tags').insert({
        instance_id: instance.id,
        name,
        color: '#0f766e',
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setTagName('')
      await qc.invalidateQueries({ queryKey: ['conversation-tags', instance.id] })
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
      if (environment && (row.environment ?? 'production') !== environment) return false
      const shown = displaySessionStatus(row)
      if (status && shown !== status) return false
      if (tagFilter && assignments.data && !assignments.data.has(row.id)) return false
      if (q) {
        const hay = [
          row.id,
          row.visitor_key ?? '',
          row.chatbots?.name ?? '',
          row.error_summary ?? '',
          shown,
          row.environment ?? 'production',
          row.publish_version != null ? `v${row.publish_version}` : '',
          JSON.stringify(row.variables ?? {}),
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [sessions.data, chatbotId, status, environment, query, tagFilter, assignments.data])

  function exportCsv() {
    const header = ['id', 'started_at', 'chatbot', 'status', 'environment', 'publish_version', 'visitor_key', 'error_summary']
    const lines = [header.join(',')]
    for (const s of rows) {
      const shown = displaySessionStatus(s)
      lines.push(
        [
          s.id,
          s.created_at,
          s.chatbots?.name ?? '',
          shown,
          s.environment ?? 'production',
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
        description={
          role === 'agent'
            ? `Escalated and assigned sessions for agents on ${instance.name}.`
            : `Search, filter, and export sessions for ${instance.name}.`
        }
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
          <option value="escalated">Escalated</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
        </Select>
        <Select
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          aria-label="Filter by environment"
        >
          <option value="">All environments</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
        </Select>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-3">
        <label className="space-y-1 text-xs">
          <span className="text-[var(--color-ink-muted)]">Filter by tag</span>
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">All tags</option>
            {(tags.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
        {agentOps ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              if (!tagName.trim()) return
              createTag.mutate(tagName.trim())
            }}
          >
            <Input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="New tag name"
              className="min-w-[10rem]"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!tagName.trim()}>
              Add tag
            </Button>
          </form>
        ) : null}
      </Card>

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
                        <span className="inline-flex items-center gap-1.5">
                          {(s.environment ?? 'production') === 'staging' ? (
                            <Badge className="bg-sky-100 text-sky-900">Staging</Badge>
                          ) : null}
                          {s.publish_version != null ? `v${s.publish_version}` : '—'}
                        </span>
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
