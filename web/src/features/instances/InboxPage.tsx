import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Headphones, Timer, UserCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { sessionStatusTone } from '@/features/instances/conversationStatus'
import { subscribeAgentPresence, subscribeInbox } from '@/shared/lib/realtime'
import { supabase } from '@/shared/lib/supabase'
import {
  canAgentOperate,
  isAgentRole,
  type AgentPresence,
  type AgentQueue,
  type ConversationSession,
  type SavedConversationView,
} from '@/shared/types/database'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

type InboxRow = ConversationSession & { chatbots: { name: string } | null }

/** Agents without a recent heartbeat are treated as offline. */
const PRESENCE_FRESH_MS = 90_000
const PRESENCE_HEARTBEAT_MS = 30_000

function slaLabel(dueAt: string | null | undefined): { text: string; breached: boolean } {
  if (!dueAt) return { text: 'No SLA', breached: false }
  const due = new Date(dueAt).getTime()
  const now = Date.now()
  if (due < now) return { text: 'SLA breached', breached: true }
  return { text: `SLA ${formatDistanceToNow(new Date(dueAt), { addSuffix: true })}`, breached: false }
}

function isFreshOnline(row: AgentPresence, nowMs = Date.now()): boolean {
  if (row.status !== 'online') return false
  const seen = Date.parse(row.last_seen_at)
  if (!Number.isFinite(seen)) return false
  return nowMs - seen <= PRESENCE_FRESH_MS
}

export function InboxPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canAgentOperate(role)
  const [queueFilter, setQueueFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'me' | 'unassigned'>('all')
  const [viewId, setViewId] = useState('')

  useEffect(() => {
    const channel = subscribeInbox(instance.id, () => {
      void qc.invalidateQueries({ queryKey: ['conversation-inbox', instance.id] })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [instance.id, qc])

  useEffect(() => {
    const channel = subscribeAgentPresence(instance.id, () => {
      void qc.invalidateQueries({ queryKey: ['agent-presence', instance.id] })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [instance.id, qc])

  useEffect(() => {
    if (!user || !editable) return
    void supabase.rpc('ensure_default_agent_queue', { p_instance_id: instance.id })
  }, [instance.id, user, editable])

  // Only users with the Agent role contribute to the online-agent presence count.
  useEffect(() => {
    if (!user || !isAgentRole(role)) return
    let cancelled = false

    async function markOnline() {
      const { error } = await supabase.rpc('set_agent_presence', {
        p_instance_id: instance.id,
        p_status: 'online',
      })
      if (cancelled) return
      if (error) {
        console.error('Failed to set agent presence', error)
        return
      }
      await qc.invalidateQueries({ queryKey: ['agent-presence', instance.id] })
    }

    void markOnline()
    const heartbeat = window.setInterval(() => void markOnline(), PRESENCE_HEARTBEAT_MS)

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void supabase.rpc('set_agent_presence', {
          p_instance_id: instance.id,
          p_status: 'away',
        })
      } else if (document.visibilityState === 'visible') {
        void markOnline()
      }
    }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelled = true
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onHide)
      void supabase
        .rpc('set_agent_presence', {
          p_instance_id: instance.id,
          p_status: 'offline',
        })
        .then(() => {
          void qc.invalidateQueries({ queryKey: ['agent-presence', instance.id] })
        })
    }
  }, [instance.id, user, role, qc])

  const queues = useQuery({
    queryKey: ['agent-queues', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_queues')
        .select('*')
        .eq('instance_id', instance.id)
        .order('name')
      if (error) throw error
      return (data ?? []) as AgentQueue[]
    },
  })

  const agentMembers = useQuery({
    queryKey: ['instance-agent-members', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_members')
        .select('user_id')
        .eq('instance_id', instance.id)
        .eq('role', 'agent')
        .is('disabled_at', null)
      if (error) throw error
      return (data ?? []).map((row) => row.user_id)
    },
  })

  const presence = useQuery({
    queryKey: ['agent-presence', instance.id],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_presence')
        .select('*')
        .eq('instance_id', instance.id)
      if (error) throw error
      return (data ?? []) as AgentPresence[]
    },
  })

  const views = useQuery({
    queryKey: ['saved-conversation-views', instance.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_conversation_views')
        .select('*')
        .eq('instance_id', instance.id)
        .order('name')
      if (error) throw error
      return (data ?? []) as SavedConversationView[]
    },
  })

  const inbox = useQuery({
    queryKey: ['conversation-inbox', instance.id],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('instance_id', instance.id)
        .eq('status', 'escalated')
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as InboxRow[]
    },
  })

  const activeView = useMemo(
    () => views.data?.find((v) => v.id === viewId) ?? null,
    [views.data, viewId],
  )

  const rows = useMemo(() => {
    let list = inbox.data ?? []
    const filters =
      activeView?.filters && typeof activeView.filters === 'object' && !Array.isArray(activeView.filters)
        ? (activeView.filters as Record<string, unknown>)
        : {}

    const qId = queueFilter || (typeof filters.queue_id === 'string' ? filters.queue_id : '')
    const assignee = assigneeFilter !== 'all' ? assigneeFilter : (filters.assignee as string | undefined)

    if (qId) list = list.filter((r) => r.queue_id === qId)
    if (assignee === 'me' && user) list = list.filter((r) => r.assigned_to === user.id)
    if (assignee === 'unassigned') list = list.filter((r) => !r.assigned_to)
    if (filters.sla_breached === true) {
      list = list.filter((r) => r.sla_due_at && new Date(r.sla_due_at).getTime() < Date.now())
    }
    return list
  }, [inbox.data, queueFilter, assigneeFilter, activeView, user])

  const claimMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('claim_conversation', { p_session_id: sessionId })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['conversation-inbox', instance.id] })
    },
  })

  const [saveName, setSaveName] = useState('')
  async function saveView(e: FormEvent) {
    e.preventDefault()
    if (!user || !saveName.trim()) return
    const { error } = await supabase.from('saved_conversation_views').insert({
      instance_id: instance.id,
      owner_id: user.id,
      name: saveName.trim(),
      filters: {
        queue_id: queueFilter || null,
        assignee: assigneeFilter,
      },
      is_shared: true,
    })
    if (error) throw error
    setSaveName('')
    await qc.invalidateQueries({ queryKey: ['saved-conversation-views', instance.id] })
  }

  const onlineCount = useMemo(() => {
    const agentIds = new Set(agentMembers.data ?? [])
    return (presence.data ?? []).filter((p) => agentIds.has(p.user_id) && isFreshOnline(p)).length
  }, [presence.data, presence.dataUpdatedAt, agentMembers.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent inbox"
        description={`Queues, assignment, and SLA for escalated chats on ${instance.name}.`}
        actions={
          <Badge className="bg-teal-100 text-teal-900">{onlineCount} agent{onlineCount === 1 ? '' : 's'} online</Badge>
        }
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1 text-xs">
          <span className="text-[var(--color-ink-muted)]">Queue</span>
          <Select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)} className="min-w-[10rem]">
            <option value="">All queues</option>
            {(queues.data ?? []).map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--color-ink-muted)]">Assignee</span>
          <Select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value as typeof assigneeFilter)}
            className="min-w-[10rem]"
          >
            <option value="all">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-[var(--color-ink-muted)]">Saved view</span>
          <Select value={viewId} onChange={(e) => setViewId(e.target.value)} className="min-w-[10rem]">
            <option value="">None</option>
            {(views.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </label>
        {editable ? (
          <form className="flex items-end gap-2" onSubmit={(e) => void saveView(e)}>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Save current filters…"
              className="min-w-[12rem]"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!saveName.trim()}>
              Save view
            </Button>
          </form>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        {inbox.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading inbox…</p>
        ) : rows.length ? (
          <ul className="divide-y divide-[var(--color-border)]/60">
            {rows.map((row) => {
              const sla = slaLabel(row.sla_due_at)
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Link
                    to={`/instances/${instance.id}/conversations/${row.id}`}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-3 transition hover:opacity-90"
                  >
                    <Headphones className="h-4 w-4 text-teal-700" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--color-ink)]">
                        {row.chatbots?.name ?? 'Chatbot'}
                        {row.escalated_node_key ? (
                          <span className="ml-2 font-mono text-xs text-[var(--color-ink-muted)]">
                            @{row.escalated_node_key}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        Updated {formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
                        {row.assigned_to
                          ? row.assigned_to === user?.id
                            ? ' · assigned to you'
                            : ' · assigned'
                          : ' · unassigned'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        sla.breached ? 'bg-rose-100 text-rose-800' : 'bg-amber-50 text-amber-900',
                      )}
                    >
                      <Timer className="h-3 w-3" />
                      {sla.text}
                    </span>
                    <Badge className={cn(sessionStatusTone('escalated'))}>escalated</Badge>
                  </Link>
                  {editable && !row.assigned_to ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={claimMutation.isPending}
                      onClick={() => claimMutation.mutate(row.id)}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Claim
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">
            No escalated conversations match these filters. Add an “Escalate to agent” step in a flow to populate
            this inbox.
          </p>
        )}
      </Card>
    </div>
  )
}
