import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  displaySessionStatus,
  sessionStatusTone,
} from '@/features/instances/conversationStatus'
import { ChatMessageBody } from '@/features/chat/ChatMessageBody'
import { UserMessageBubble } from '@/features/chat/UserMessageBubble'
import { downloadJson } from '@/shared/lib/downloadJson'
import { safeDownloadBasename } from '@/features/designer/utils/flowTransfer'
import type { ConversationEvent, ConversationSession, Json } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { cn } from '@/shared/lib/utils'
import type { ChatMessage } from '@/features/designer/preview/previewRuntime'

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function eventText(payload: Json): string {
  const rec = asRecord(payload)
  return String(rec.text ?? rec.message ?? '')
}

export function ConversationDetailPage() {
  const { instance } = useRequiredInstance()
  const { sessionId } = useParams()
  const [openRuns, setOpenRuns] = useState<Record<string, boolean>>({})

  const sessionQuery = useQuery({
    queryKey: ['conversation-session', instance.id, sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('id', sessionId!)
        .eq('instance_id', instance.id)
        .single()
      if (error) throw error
      return data as ConversationSession & { chatbots: { name: string } | null }
    },
  })

  const eventsQuery = useQuery({
    queryKey: ['conversation-events', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_events')
        .select('*')
        .eq('session_id', sessionId!)
        .order('seq', { ascending: true })
      if (error) throw error
      return (data ?? []) as ConversationEvent[]
    },
  })

  const session = sessionQuery.data
  const events = eventsQuery.data ?? []
  const shownStatus = session ? displaySessionStatus(session) : 'active'
  const botName = session?.chatbots?.name ?? 'chatbot'

  const variablesPretty = useMemo(() => {
    if (!session) return '{}'
    try {
      return JSON.stringify(session.variables ?? {}, null, 2)
    } catch {
      return String(session.variables)
    }
  }, [session])

  function exportJson() {
    if (!session) return
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadJson(`${safeDownloadBasename(botName)}-session-${stamp}.json`, {
      session,
      events,
    })
  }

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading conversation…</p>
  }

  if (sessionQuery.error || !session) {
    return (
      <div className="space-y-3">
        <Link to={`/instances/${instance.id}/conversations`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          Back to conversations
        </Link>
        <p className="text-sm text-[var(--color-danger)]">This conversation was not found in this organisation.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={botName}
        description={`Session started ${format(new Date(session.created_at), 'yyyy-MM-dd HH:mm')}${
          session.publish_version != null ? ` · published v${session.publish_version}` : ''
        }`}
        actions={
          <>
            <Link
              to={`/instances/${instance.id}/conversations`}
              className="text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              All conversations
            </Link>
            <Button size="sm" variant="secondary" onClick={exportJson} disabled={!events.length && !session}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                sessionStatusTone(shownStatus),
              )}
            >
              {shownStatus}
              {shownStatus === 'abandoned' && session.status === 'active' ? ' (stale)' : ''}
            </span>
            {session.visitor_key ? (
              <span className="font-mono text-[11px] text-[var(--color-ink-muted)]">
                visitor {session.visitor_key.slice(0, 8)}…
              </span>
            ) : null}
          </div>
          {eventsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading transcript…</p>
          ) : !events.length ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No events recorded for this session.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                if (event.kind === 'message.bot' || event.kind === 'message.user') {
                  const text = eventText(event.payload)
                  const createdAt = event.created_at
                  if (event.kind === 'message.user') {
                    const message: ChatMessage = {
                      id: event.id,
                      role: 'user',
                      text,
                      createdAt,
                    }
                    return (
                      <div key={event.id} className="flex flex-col items-end gap-1">
                        <div className="max-w-[88%] rounded-[1.25rem] rounded-br-md bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] px-3.5 py-2.5 text-sm text-[var(--color-accent-fg)] shadow-sm">
                          <UserMessageBubble message={message} />
                        </div>
                        <p className="text-[10px] text-[var(--color-ink-muted)]">{format(new Date(createdAt), 'HH:mm:ss')}</p>
                      </div>
                    )
                  }
                  return (
                    <div key={event.id} className="flex flex-col items-start gap-1">
                      <div className="max-w-[88%] rounded-[1.25rem] rounded-bl-md border border-[var(--color-border)]/80 bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-ink)] shadow-sm">
                        <ChatMessageBody text={text} />
                      </div>
                      <p className="text-[10px] text-[var(--color-ink-muted)]">{format(new Date(createdAt), 'HH:mm:ss')}</p>
                    </div>
                  )
                }
                if (event.kind === 'step.run') {
                  const payload = asRecord(event.payload)
                  const open = openRuns[event.id] === true
                  return (
                    <div key={event.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/80">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-ink)]"
                        onClick={() => setOpenRuns((prev) => ({ ...prev, [event.id]: !open }))}
                      >
                        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <span className="font-mono">{event.node_key || 'step'}</span>
                        <span className="text-[var(--color-ink-muted)]">{String(payload.type ?? '')}</span>
                        <span className="ml-auto capitalize text-[var(--color-ink-muted)]">{String(payload.status ?? '')}</span>
                      </button>
                      {open ? (
                        <pre className="overflow-x-auto border-t border-[var(--color-border)] px-3 py-2 font-mono text-[11px] text-[var(--color-ink)]">
                          {JSON.stringify(payload.outputs ?? payload, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  )
                }
                return (
                  <p key={event.id} className="text-center text-[11px] text-[var(--color-ink-muted)]">
                    {event.kind}
                    {event.node_key ? ` · ${event.node_key}` : ''}
                  </p>
                )
              })}
            </div>
          )}
        </Card>

        <div className="space-y-3">
          {session.error_summary ? (
            <Card className="border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-danger)]">Error</p>
              <p className="mt-1 text-sm text-[var(--color-danger)]">{session.error_summary}</p>
            </Card>
          ) : null}
          <Card className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Variables</p>
            <pre className="mt-2 max-h-[28rem] overflow-auto font-mono text-[11px] leading-snug text-[var(--color-ink)]">
              {variablesPretty}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  )
}
