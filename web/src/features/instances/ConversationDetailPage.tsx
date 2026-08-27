import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  displaySessionStatus,
  sessionStatusTone,
} from '@/features/instances/conversationStatus'
import { ChatMessageBody } from '@/features/chat/ChatMessageBody'
import { UserMessageBubble } from '@/features/chat/UserMessageBubble'
import { downloadJson } from '@/shared/lib/downloadJson'
import { subscribeSessionEvents } from '@/shared/lib/realtime'
import { safeDownloadBasename } from '@/features/designer/utils/flowTransfer'
import {
  canAgentOperate,
  type AgentQueue,
  type ConversationEvent,
  type ConversationNote,
  type ConversationSession,
  type ConversationTag,
  type Json,
} from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
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
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const { sessionId } = useParams()
  const qc = useQueryClient()
  const editable = canAgentOperate(role)
  const [openRuns, setOpenRuns] = useState<Record<string, boolean>>({})
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [transferUser, setTransferUser] = useState('')
  const [transferQueue, setTransferQueue] = useState('')
  const [typing, setTyping] = useState(false)

  const sessionQuery = useQuery({
    queryKey: ['conversation-session', instance.id, sessionId],
    enabled: !!sessionId,
    refetchInterval: (q) => (q.state.data?.status === 'escalated' ? 8000 : false),
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
    refetchInterval: () => (sessionQuery.data?.status === 'escalated' ? 8000 : false),
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

  const notesQuery = useQuery({
    queryKey: ['conversation-notes', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_notes')
        .select('*')
        .eq('session_id', sessionId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ConversationNote[]
    },
  })

  const tagsQuery = useQuery({
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

  const tagAssignments = useQuery({
    queryKey: ['conversation-tag-assignments', sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_tag_assignments')
        .select('tag_id')
        .eq('session_id', sessionId!)
      if (error) throw error
      return new Set((data ?? []).map((r) => r.tag_id as string))
    },
  })

  const queuesQuery = useQuery({
    queryKey: ['agent-queues', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('agent_queues').select('*').eq('instance_id', instance.id)
      if (error) throw error
      return (data ?? []) as AgentQueue[]
    },
  })

  const membersQuery = useQuery({
    queryKey: ['instance-members-agents', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_members')
        .select('user_id, role, display_name, profiles(email, display_name)')
        .eq('instance_id', instance.id)
        .in('role', ['owner', 'admin', 'editor', 'agent'])
      if (error) throw error
      return data ?? []
    },
  })

  useEffect(() => {
    if (!sessionId) return
    const channel = subscribeSessionEvents(sessionId, () => {
      void qc.invalidateQueries({ queryKey: ['conversation-events', sessionId] })
      void qc.invalidateQueries({ queryKey: ['conversation-session', instance.id, sessionId] })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sessionId, instance.id, qc])

  const session = sessionQuery.data
  const events = eventsQuery.data ?? []
  const shownStatus = session ? displaySessionStatus(session) : 'active'
  const botName = session?.chatbots?.name ?? 'chatbot'
  const isEscalated = session?.status === 'escalated'
  const slaBreached =
    !!session?.sla_due_at && isEscalated && new Date(session.sla_due_at).getTime() < Date.now()

  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['conversation-events', sessionId] }),
      qc.invalidateQueries({ queryKey: ['conversation-session', instance.id, sessionId] }),
      qc.invalidateQueries({ queryKey: ['conversation-inbox', instance.id] }),
      qc.invalidateQueries({ queryKey: ['conversation-notes', sessionId] }),
      qc.invalidateQueries({ queryKey: ['conversation-tag-assignments', sessionId] }),
    ])
  }

  const replyMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.rpc('agent_reply_to_conversation', {
        p_session_id: sessionId!,
        p_text: text,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setReply('')
      setReplyError(null)
      setTyping(false)
      await invalidateAll()
    },
    onError: (e: Error) => setReplyError(e.message),
  })

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resolve_conversation_handoff', {
        p_session_id: sessionId!,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await invalidateAll()
    },
    onError: (e: Error) => setReplyError(e.message),
  })

  const claimMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('claim_conversation', { p_session_id: sessionId! })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const transferMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('transfer_conversation', {
        p_session_id: sessionId!,
        p_to_user: transferUser || null,
        p_to_queue_id: transferQueue || null,
        p_note: null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setTransferUser('')
      setTransferQueue('')
      await invalidateAll()
    },
    onError: (e: Error) => setReplyError(e.message),
  })

  const noteMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.rpc('add_conversation_note', {
        p_session_id: sessionId!,
        p_body: body,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setNote('')
      await invalidateAll()
    },
  })

  const tagMutation = useMutation({
    mutationFn: async (tagIds: string[]) => {
      const { error } = await supabase.rpc('set_conversation_tags', {
        p_session_id: sessionId!,
        p_tag_ids: tagIds,
      })
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

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
      notes: notesQuery.data ?? [],
    })
  }

  function onReply(e: FormEvent) {
    e.preventDefault()
    const text = reply.trim()
    if (!text) return
    replyMutation.mutate(text)
  }

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading conversation…</p>
  }

  if (sessionQuery.error || !session) {
    return (
      <div className="space-y-3">
        <Link to={`/instances/${instance.id}/conversations`} className="text-sm font-medium text-teal-800 hover:underline">
          Back to conversations
        </Link>
        <p className="text-sm text-rose-600">This conversation was not found in this organisation.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={botName}
        description={`Session started ${format(new Date(session.created_at), 'yyyy-MM-dd HH:mm')}${
          session.publish_version != null ? ` · published v${session.publish_version}` : ''
        }${session.variant_key ? ` · variant ${session.variant_key}` : ''}`}
        actions={
          <>
            <Link
              to={`/instances/${instance.id}/inbox`}
              className="text-sm font-medium text-teal-800 hover:underline"
            >
              Inbox
            </Link>
            <Link
              to={`/instances/${instance.id}/conversations`}
              className="text-sm font-medium text-teal-800 hover:underline"
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
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
            {slaBreached ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                SLA breached
              </span>
            ) : session.sla_due_at && isEscalated ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                SLA due {format(new Date(session.sla_due_at), 'HH:mm')}
              </span>
            ) : null}
            {session.visitor_key ? (
              <span className="font-mono text-[11px] text-slate-500">
                visitor {session.visitor_key.slice(0, 8)}…
              </span>
            ) : null}
            {typing ? (
              <span className="text-[11px] text-violet-700">Agent is typing…</span>
            ) : null}
          </div>
          {eventsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading transcript…</p>
          ) : !events.length ? (
            <p className="text-sm text-[var(--color-ink-muted)]">No events recorded for this session.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                if (
                  event.kind === 'message.bot' ||
                  event.kind === 'message.user' ||
                  event.kind === 'message.agent'
                ) {
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
                        <div className="max-w-[88%] rounded-[1.25rem] rounded-br-md bg-gradient-to-br from-teal-600 to-cyan-600 px-3.5 py-2.5 text-sm text-white shadow-sm">
                          <UserMessageBubble message={message} />
                        </div>
                        <p className="text-[10px] text-slate-400">{format(new Date(createdAt), 'HH:mm:ss')}</p>
                      </div>
                    )
                  }
                  return (
                    <div key={event.id} className="flex flex-col items-start gap-1">
                      <div
                        className={cn(
                          'max-w-[88%] rounded-[1.25rem] rounded-bl-md border px-3.5 py-2.5 text-sm shadow-sm',
                          event.kind === 'message.agent'
                            ? 'border-violet-200 bg-violet-50 text-violet-950'
                            : 'border-slate-200/80 bg-white text-slate-800',
                        )}
                      >
                        {event.kind === 'message.agent' ? (
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                            Agent
                          </p>
                        ) : null}
                        <ChatMessageBody text={text} />
                      </div>
                      <p className="text-[10px] text-slate-400">{format(new Date(createdAt), 'HH:mm:ss')}</p>
                    </div>
                  )
                }
                if (event.kind === 'step.run') {
                  const payload = asRecord(event.payload)
                  const open = openRuns[event.id] === true
                  return (
                    <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50/80">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700"
                        onClick={() => setOpenRuns((prev) => ({ ...prev, [event.id]: !open }))}
                      >
                        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <span className="font-mono">{event.node_key || 'step'}</span>
                        <span className="text-slate-500">{String(payload.type ?? '')}</span>
                        <span className="ml-auto capitalize text-slate-500">{String(payload.status ?? '')}</span>
                      </button>
                      {open ? (
                        <pre className="overflow-x-auto border-t border-slate-200 px-3 py-2 font-mono text-[11px] text-slate-700">
                          {JSON.stringify(payload.outputs ?? payload, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  )
                }
                return (
                  <p key={event.id} className="text-center text-[11px] text-slate-500">
                    {event.kind}
                    {event.node_key ? ` · ${event.node_key}` : ''}
                  </p>
                )
              })}
            </div>
          )}

          {isEscalated && editable ? (
            <form className="space-y-2 border-t border-slate-200 pt-3" onSubmit={onReply}>
              <p className="text-xs font-semibold text-violet-800">Reply as agent</p>
              {replyError ? <FieldError>{replyError}</FieldError> : null}
              <Input
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                  setTyping(e.target.value.length > 0)
                }}
                placeholder="Type a reply for the visitor…"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={replyMutation.isPending || !reply.trim()}>
                  {replyMutation.isPending ? 'Sending…' : 'Send reply'}
                </Button>
                {!session.assigned_to || session.assigned_to !== user?.id ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={claimMutation.isPending}
                    onClick={() => claimMutation.mutate()}
                  >
                    Claim
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate()}
                >
                  {resolveMutation.isPending ? 'Resolving…' : 'Resolve handoff'}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <div className="space-y-3">
          {session.error_summary ? (
            <Card className="border-rose-200 bg-rose-50/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Error</p>
              <p className="mt-1 text-sm text-rose-800">{session.error_summary}</p>
            </Card>
          ) : null}

          {editable && isEscalated ? (
            <Card className="space-y-2 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Transfer</p>
              <Select value={transferUser} onChange={(e) => setTransferUser(e.target.value)}>
                <option value="">Agent…</option>
                {(membersQuery.data ?? []).map((m) => {
                  const profiles = m.profiles as { email?: string; display_name?: string } | null
                  const label = profiles?.display_name || profiles?.email || m.user_id
                  return (
                    <option key={m.user_id} value={m.user_id}>
                      {label}
                    </option>
                  )
                })}
              </Select>
              <Select value={transferQueue} onChange={(e) => setTransferQueue(e.target.value)}>
                <option value="">Queue…</option>
                {(queuesQuery.data ?? []).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="secondary"
                disabled={transferMutation.isPending || (!transferUser && !transferQueue)}
                onClick={() => transferMutation.mutate()}
              >
                Transfer
              </Button>
            </Card>
          ) : null}

          <Card className="space-y-2 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {(tagsQuery.data ?? []).map((tag) => {
                const on = tagAssignments.data?.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={!editable}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                      on ? 'text-white' : 'bg-white text-slate-600 ring-slate-200',
                    )}
                    style={on ? { backgroundColor: tag.color } : undefined}
                    onClick={() => {
                      if (!editable) return
                      const next = new Set(tagAssignments.data ?? [])
                      if (next.has(tag.id)) next.delete(tag.id)
                      else next.add(tag.id)
                      tagMutation.mutate([...next])
                    }}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {!tagsQuery.data?.length ? (
                <p className="text-xs text-slate-500">No tags yet — create them under Conversations.</p>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-2 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Internal notes</p>
            <ul className="max-h-40 space-y-2 overflow-auto">
              {(notesQuery.data ?? []).map((n) => (
                <li key={n.id} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                  {n.body}
                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    {format(new Date(n.created_at), 'yyyy-MM-dd HH:mm')}
                  </span>
                </li>
              ))}
            </ul>
            {editable ? (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!note.trim()) return
                  noteMutation.mutate(note.trim())
                }}
              >
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note…" />
                <Button type="submit" size="sm" variant="secondary" disabled={!note.trim() || noteMutation.isPending}>
                  Add note
                </Button>
              </form>
            ) : null}
          </Card>

          <Card className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Variables</p>
            <pre className="mt-2 max-h-[18rem] overflow-auto font-mono text-[11px] leading-snug text-slate-800">
              {variablesPretty}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  )
}
