import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Copy, ExternalLink, Radio, RefreshCw } from 'lucide-react'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { QualitativeAnalysisCard } from '@/features/chatbots/QualitativeAnalysisCard'
import {
  buildSessionQualitativeAnalysis,
  buildStagingQualitativeAnalysis,
} from '@/features/chatbots/stagingQualitativeAnalysis'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  buildConversationAnalytics,
  buildDropOffForVersion,
} from '@/features/instances/conversationAnalytics'
import { displaySessionStatus } from '@/features/instances/conversationStatus'
import { getStagingPublishStatus } from '@/features/designer/utils/flowPublish'
import {
  buildAggregateResponseTimeline,
  buildConnectionInvokeTimeline,
  buildConnectionTypeDurationBars,
  buildSessionConnectionRuns,
  buildSessionResponseDurations,
  buildSessionStepDurations,
  buildSessionsStartedTimeline,
  buildStepTypeDurationBars,
  connectionInvokeValues,
  formatDurationMs,
  median,
} from '@/features/chatbots/stagingLiveMetrics'
import { subscribeChatbotStagingSessions, subscribeSessionEvents } from '@/shared/lib/realtime'
import { stagingTestChatUrl } from '@/shared/lib/stagingTestUrl'
import { filterSessionsForTestToken } from '@/features/chatbots/stagingTestSession'
import { supabase } from '@/shared/lib/supabase'
import { canEdit, instanceFeatureEnabled, type ConversationEvent, type ConversationSession } from '@/shared/types/database'
import { Badge } from '@/shared/ui/badge'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { HelpTooltip, SectionHeading } from '@/shared/ui/help-tooltip'
import { Select } from '@/shared/ui/select'
import { LiveBarChart, LiveLineChart } from '@/shared/ui/live-charts'
import { SECTION_HELP } from '@/shared/help/pageHelp'
import { cn } from '@/shared/lib/utils'

type SessionRow = ConversationSession & { chatbots?: { name: string } | null }

function sessionLabel(s: SessionRow): string {
  const shown = displaySessionStatus(s)
  const ago = formatDistanceToNow(new Date(s.created_at), { addSuffix: true })
  return `${shown} · ${s.id.slice(0, 8)} · ${ago}`
}

function eventPreview(event: ConversationEvent): string {
  const payload = event.payload as Record<string, unknown> | null
  if (event.kind === 'message.user' || event.kind === 'message.bot' || event.kind === 'message.agent') {
    const text = typeof payload?.text === 'string' ? payload.text : typeof payload?.message === 'string' ? payload.message : ''
    return text.slice(0, 120) || event.kind
  }
  if (event.kind === 'step.run') {
    return `${event.node_key ?? 'step'} · ${String(payload?.type ?? '')} · ${String(payload?.status ?? '')}`
  }
  return event.kind
}

export function ChatbotTestPage() {
  const { chatbotId = '' } = useParams()
  const { instance, role } = useRequiredInstance()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const stagingEnabled = instanceFeatureEnabled(instance, 'staging')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [followLiveSession, setFollowLiveSession] = useState(true)
  const [showAllStagingSessions, setShowAllStagingSessions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bot = useQuery({
    queryKey: ['chatbot', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('id', chatbotId)
        .single()
      if (qError) throw qError
      return data
    },
  })

  const testToken = useQuery({
    queryKey: ['chatbot-staging-test-token', chatbotId],
    enabled: !!chatbotId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('staging_test_token')
        .eq('id', chatbotId)
        .single()
      if (qError) throw qError
      return data.staging_test_token as string
    },
  })

  const regenerateToken = useMutation({
    mutationFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('regenerate_staging_test_token', {
        p_chatbot_id: chatbotId,
      })
      if (rpcError) throw rpcError
      if (typeof data !== 'string' || !data.trim()) {
        throw new Error('Could not rotate test link')
      }
      return data.trim()
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['chatbot-staging-test-token', chatbotId] })
    },
    onSuccess: (newToken) => {
      setError(null)
      setFollowLiveSession(true)
      setSelectedSessionId(null)
      setShowAllStagingSessions(false)
      qc.setQueryData(['chatbot-staging-test-token', chatbotId], newToken)
    },
    onError: (e: Error) => setError(e.message),
  })

  const flow = useQuery({
    queryKey: ['chatbot-flow-publish', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbot_flows')
        .select('staging_version, staging_published_at, staging_published_graph')
        .eq('chatbot_id', chatbotId)
        .maybeSingle()
      if (qError) throw qError
      return data
    },
  })

  const stagingStatus = flow.data ? getStagingPublishStatus(flow.data) : null
  /** Prefer RPC result from rotate — refetch must not overwrite with a stale token. */
  const activeTestToken = regenerateToken.data ?? testToken.data ?? null
  const testUrl = activeTestToken ? stagingTestChatUrl(activeTestToken) : null

  const sessions = useQuery({
    queryKey: ['staging-test-sessions', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('conversation_sessions')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .eq('environment', 'staging')
        .order('created_at', { ascending: false })
        .limit(200)
      if (qError) throw qError
      return (data ?? []) as SessionRow[]
    },
  })

  const sessionIds = (sessions.data ?? []).map((s) => s.id)
  const events = useQuery({
    queryKey: ['staging-test-events', chatbotId, sessionIds.slice(0, 50).join(',')],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const ids = sessionIds.slice(0, 100)
      const { data, error: qError } = await supabase
        .from('conversation_events')
        .select('*')
        .in('session_id', ids)
        .order('seq', { ascending: true })
      if (qError) throw qError
      return (data ?? []) as ConversationEvent[]
    },
  })

  const linkSessions = useMemo(
    () => filterSessionsForTestToken(sessions.data ?? [], activeTestToken),
    [sessions.data, activeTestToken],
  )

  const monitorSessions = showAllStagingSessions ? (sessions.data ?? []) : linkSessions

  const prevTestTokenRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (prevTestTokenRef.current === undefined) {
      prevTestTokenRef.current = activeTestToken
      return
    }
    if (prevTestTokenRef.current === activeTestToken) return
    prevTestTokenRef.current = activeTestToken
    setFollowLiveSession(true)
    setSelectedSessionId(null)
    setShowAllStagingSessions(false)
  }, [activeTestToken])

  useEffect(() => {
    if (!chatbotId) return
    const channel = subscribeChatbotStagingSessions(chatbotId, () => {
      void qc.invalidateQueries({ queryKey: ['staging-test-sessions', chatbotId] })
      void qc.invalidateQueries({ queryKey: ['staging-test-events', chatbotId] })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [chatbotId, qc])

  useEffect(() => {
    if (!followLiveSession || !chatbotId) return
    const interval = window.setInterval(() => {
      void qc.invalidateQueries({ queryKey: ['staging-test-sessions', chatbotId] })
    }, 2500)
    return () => window.clearInterval(interval)
  }, [followLiveSession, chatbotId, qc])

  useEffect(() => {
    const list = monitorSessions
    if (!list.length) {
      if (selectedSessionId) setSelectedSessionId(null)
      return
    }

    const newestId = list[0]!.id
    const selectedStillExists =
      !!selectedSessionId && list.some((session) => session.id === selectedSessionId)

    if (followLiveSession) {
      if (selectedSessionId !== newestId) setSelectedSessionId(newestId)
      return
    }

    if (selectedStillExists) return
    setSelectedSessionId(newestId)
  }, [monitorSessions, selectedSessionId, followLiveSession])

  const selectedEvents = useQuery({
    queryKey: ['staging-test-session-events', selectedSessionId],
    enabled: !!selectedSessionId,
    refetchOnMount: 'always',
    queryFn: async () => {
      const sessionId = selectedSessionId!
      const { data, error: qError } = await supabase
        .from('conversation_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('seq', { ascending: true })
      if (qError) throw qError
      return (data ?? []) as ConversationEvent[]
    },
  })

  /** Events for the selected session only — ignore mismatched cache while switching sessions. */
  const sessionEvents = useMemo((): ConversationEvent[] => {
    if (!selectedSessionId) return []
    const rows = selectedEvents.data ?? []
    if (rows.length && rows.some((event) => event.session_id !== selectedSessionId)) return []
    if (selectedEvents.isFetching && rows.length === 0) return []
    return rows.filter((event) => event.session_id === selectedSessionId)
  }, [selectedSessionId, selectedEvents.data, selectedEvents.isFetching])

  function pickSession(sessionId: string | null) {
    if (!sessionId) {
      setSelectedSessionId(null)
      return
    }
    const newestId = monitorSessions[0]?.id ?? null
    setFollowLiveSession(sessionId === newestId)
    setSelectedSessionId(sessionId)
  }

  useEffect(() => {
    if (!selectedSessionId) return
    const channel = subscribeSessionEvents(selectedSessionId, () => {
      void qc.invalidateQueries({ queryKey: ['staging-test-session-events', selectedSessionId] })
      void qc.invalidateQueries({ queryKey: ['staging-test-sessions', chatbotId] })
      void qc.invalidateQueries({ queryKey: ['staging-test-events', chatbotId] })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedSessionId, chatbotId, qc])

  const stats = useMemo(
    () =>
      buildConversationAnalytics({
        sessions: sessions.data ?? [],
        events: (events.data ?? []).map((e) => ({
          session_id: e.session_id,
          kind: e.kind,
          node_key: e.node_key,
          payload: e.payload,
          seq: e.seq,
        })),
        payments: [],
        chatbotId,
        environment: 'staging',
        rangeDays: 7,
      }),
    [sessions.data, events.data, chatbotId],
  )

  const dropOff = useMemo(
    () =>
      buildDropOffForVersion({
        sessions: sessions.data ?? [],
        events: (events.data ?? []).map((e) => ({
          session_id: e.session_id,
          kind: e.kind,
          node_key: e.node_key,
          payload: e.payload,
          seq: e.seq,
        })),
        version: stagingStatus?.kind === 'live' ? `v${stagingStatus.version}` : 'unpublished',
        chatbotId,
        environment: 'staging',
        rangeDays: 7,
      }),
    [sessions.data, events.data, chatbotId, stagingStatus],
  )

  const activeCount = (sessions.data ?? []).filter((s) => s.status === 'active' || s.status === 'escalated').length

  const sessionResponseChart = useMemo(
    () => buildSessionResponseDurations(sessionEvents),
    [sessionEvents],
  )

  const sessionStepChart = useMemo(
    () => buildSessionStepDurations(sessionEvents),
    [sessionEvents],
  )

  const sessionMedianResponse = useMemo(
    () => median(sessionResponseChart.map((p) => p.value)),
    [sessionResponseChart],
  )

  const sessionsTimeline = useMemo(
    () => buildSessionsStartedTimeline(sessions.data ?? []),
    [sessions.data],
  )

  const aggregateResponseChart = useMemo(
    () => buildAggregateResponseTimeline(events.data ?? []),
    [events.data],
  )

  const stepTypeChart = useMemo(
    () => buildStepTypeDurationBars(events.data ?? []),
    [events.data],
  )

  const connectionInvokeChart = useMemo(
    () => buildConnectionInvokeTimeline(events.data ?? []),
    [events.data],
  )

  const connectionTypeChart = useMemo(
    () => buildConnectionTypeDurationBars(events.data ?? []),
    [events.data],
  )

  const sessionConnectionChart = useMemo(
    () => buildSessionConnectionRuns(sessionEvents),
    [sessionEvents],
  )

  const aggregateConnectionMedian = useMemo(
    () => median(connectionInvokeValues(events.data ?? [])),
    [events.data],
  )

  const sessionConnectionMedian = useMemo(
    () => median(sessionConnectionChart.map((p) => p.value)),
    [sessionConnectionChart],
  )

  const selectedSession = useMemo(
    () => (sessions.data ?? []).find((s) => s.id === selectedSessionId) ?? null,
    [sessions.data, selectedSessionId],
  )

  const sessionAnalysis = useMemo(() => {
    if (!selectedSession) return null
    return buildSessionQualitativeAnalysis({
      session: selectedSession,
      events: sessionEvents,
    })
  }, [selectedSession, sessionEvents])

  const sessionChartsLoading =
    !!selectedSessionId && selectedEvents.isFetching && sessionEvents.length === 0

  const stagingAnalysis = useMemo(
    () =>
      buildStagingQualitativeAnalysis({
        sessions: sessions.data ?? [],
        events: events.data ?? [],
        completionRate: stats.completionRate,
        medianSteps: stats.medianSteps,
        dropOff: dropOff.dropOff,
        rangeDays: 7,
      }),
    [sessions.data, events.data, stats.completionRate, stats.medianSteps, dropOff.dropOff],
  )

  async function copyTestUrl() {
    if (!testUrl) return
    try {
      await navigator.clipboard.writeText(testUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy link')
    }
  }

  if (!stagingEnabled) {
    return (
      <div className="space-y-6">
        <ChatbotSubNav instanceId={instance.id} chatbotId={chatbotId} />
        <Card className="p-6">
          <p className="text-sm text-[var(--color-ink-muted)]">
            Staging is not enabled for this organisation. Ask an admin to enable it under organisation features.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{bot.data?.name ?? 'Chatbot'}</h1>
            <Badge className="bg-sky-100 text-sky-900">Test</Badge>
            <HelpTooltip content={SECTION_HELP.stagingTest} label="Help: Staging test" size="md" />
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Share a unique staging link, watch live sessions, and review staging analytics without touching production.
          </p>
        </div>
        <ChatbotSubNav instanceId={instance.id} chatbotId={chatbotId} />
      </div>

      {error ? <FieldError>{error}</FieldError> : null}

      <Card className="space-y-4 p-4">
        <SectionHeading title="Staging test link" help={SECTION_HELP.stagingTestUrl} />
        {stagingStatus?.kind !== 'live' ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-sm text-amber-950">
            Publish to staging from{' '}
            <Link className="font-medium underline" to={`/instances/${instance.id}/chatbots/${chatbotId}/design`}>
              Design
            </Link>{' '}
            before the test link will work.
          </div>
        ) : null}
        {testUrl ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800">
                {testUrl}
              </code>
              <Button type="button" size="sm" variant="secondary" onClick={() => void copyTestUrl()}>
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <a
                href={testUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
              {editable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={regenerateToken.isPending}
                  onClick={() => regenerateToken.mutate()}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', regenerateToken.isPending && 'animate-spin')} />
                  {regenerateToken.isPending ? 'Rotating…' : 'Rotate link'}
                </Button>
              ) : null}
            </div>
            {activeTestToken ? (
              <p className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                Active token · {activeTestToken.slice(0, 8)}…
                {regenerateToken.data && regenerateToken.data === activeTestToken ? (
                  <span className="ml-2 text-emerald-700">Updated — use this URL only (previous links stop working).</span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : testToken.isLoading ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Loading test link…</p>
        ) : null}
        <p className="text-xs text-[var(--color-ink-muted)]">
          This is the only staging test link for this chatbot. It runs the staging graph without production public
          access.{' '}
          <strong className="font-medium text-[var(--color-ink)]">
            Rotate link replaces this URL — the previous one stops working immediately.
          </strong>{' '}
          Past test runs stay in Live sessions below; select any session to replay its transcript and charts.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Live now</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold text-[var(--color-ink)]">
            <Radio className={cn('h-4 w-4', activeCount ? 'text-emerald-500' : 'text-slate-400')} />
            {activeCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Sessions (7d)</p>
          <p className="mt-1 text-2xl font-semibold">{stats.sessionCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Completion</p>
          <p className="mt-1 text-2xl font-semibold">{Math.round(stats.completionRate * 100)}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Median steps</p>
          <p className="mt-1 text-2xl font-semibold">{stats.medianSteps ?? '—'}</p>
        </Card>
      </div>

      <Card className="p-4">
        <SectionHeading title="Live metrics" help={SECTION_HELP.stagingLiveCharts} className="mb-4" />
        <p className="mb-4 text-xs text-[var(--color-ink-muted)]">
          Charts below the transcript follow the selected session. These overview charts aggregate{' '}
          <strong className="font-medium text-[var(--color-ink)]">all staging tests</strong> in the last 2 hours.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Sessions started (last 2 hours)
            </p>
            <LiveLineChart
              points={sessionsTimeline}
              valueLabel="Sessions per 5 min"
              ariaLabel="Staging sessions started over time"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Avg response time (last 2 hours)
            </p>
            <LiveLineChart
              points={aggregateResponseChart}
              valueLabel="User → bot reply"
              formatValue={(v) => formatDurationMs(v)}
              ariaLabel="Average response duration over time"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Connection invoke time (last 2 hours)
            </p>
            <p className="mb-1 text-[11px] text-[var(--color-ink-muted)]">
              HTTP / email / integration — invoke to result
              {aggregateConnectionMedian != null ? ` · median ${formatDurationMs(aggregateConnectionMedian)}` : ''}
            </p>
            <LiveLineChart
              points={connectionInvokeChart}
              valueLabel="Avg invoke duration"
              formatValue={(v) => formatDurationMs(v)}
              ariaLabel="Connection invoke duration over time"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Connection invoke by type
            </p>
            <LiveBarChart
              bars={connectionTypeChart}
              valueLabel="Avg invoke duration"
              formatValue={(v) => formatDurationMs(v)}
              ariaLabel="Average connection invoke duration by type"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Step duration by type (all sessions)
            </p>
            <LiveBarChart
              bars={stepTypeChart}
              valueLabel="Avg step.run duration"
              formatValue={(v) => formatDurationMs(v)}
              ariaLabel="Average step duration by step type"
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-4">
          <SectionHeading title="Live sessions" help={SECTION_HELP.stagingLive} className="mb-3" />
          <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
            {showAllStagingSessions
              ? 'Showing all staging sessions for this chatbot.'
              : 'Showing sessions started from the test link above only.'}
          </p>
          <label className="mb-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <input
              type="checkbox"
              checked={showAllStagingSessions}
              onChange={(e) => {
                setShowAllStagingSessions(e.target.checked)
                if (!e.target.checked) setFollowLiveSession(true)
              }}
            />
            Include older staging sessions (other links / public staging)
          </label>
          {sessions.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : !monitorSessions.length ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              {showAllStagingSessions
                ? 'No staging sessions yet.'
                : 'No conversation on this link yet. Open the test URL above in another tab — the transcript will follow automatically.'}
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {monitorSessions.map((s) => {
                const shown = displaySessionStatus(s)
                const selected = selectedSessionId === s.id
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pickSession(s.id)}
                      className={cn(
                        'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition',
                        selected ? 'bg-teal-50 ring-1 ring-teal-200' : 'hover:bg-slate-50',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize">{shown}</span>
                        <span className="text-[11px] text-[var(--color-ink-muted)]">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{s.id.slice(0, 8)}…</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeading title="Live transcript" help={SECTION_HELP.stagingLive} className="mb-3" />
          <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
            Tracks the active test link{activeTestToken ? ` (${activeTestToken.slice(0, 8)}…)` : ''}. Rotate the link
            above to start fresh — older link sessions are hidden unless you expand the session list.
          </p>
          {sessions.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading sessions…</p>
          ) : !monitorSessions.length ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              Open the test link above in another tab. When a conversation starts, it will appear here automatically.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Select
                  className="min-w-0 flex-1"
                  value={selectedSessionId ?? ''}
                  onChange={(e) => pickSession(e.target.value || null)}
                  aria-label="Session"
                >
                  <option value="">Select a session…</option>
                  {monitorSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sessionLabel(s)}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant={followLiveSession ? 'primary' : 'secondary'}
                  onClick={() => {
                    setFollowLiveSession(true)
                    const newestId = linkSessions[0]?.id ?? monitorSessions[0]?.id
                    if (newestId) setSelectedSessionId(newestId)
                  }}
                >
                  Follow this link
                </Button>
              </div>
              {!selectedSessionId ? (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Choose a session above to watch messages and steps update live.
                </p>
              ) : selectedEvents.isLoading && !sessionEvents.length ? (
                <p className="text-sm text-[var(--color-ink-muted)]">Loading transcript…</p>
              ) : (
                <>
                  <ul className="max-h-[320px] space-y-2 overflow-y-auto text-sm">
                    {sessionEvents.map((event) => (
                      <li key={event.id} className="rounded-lg border border-[var(--color-border)]/60 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-ink-muted)]">
                          <span className="font-mono uppercase">{event.kind}</span>
                          <span>{format(new Date(event.created_at), 'HH:mm:ss')}</span>
                        </div>
                        <p className="mt-1 text-[var(--color-ink)]">{eventPreview(event)}</p>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 space-y-4 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                        Session charts
                      </p>
                      {selectedSessionId ? (
                        <Badge className="bg-slate-100 text-slate-700 normal-case">
                          Median response {sessionMedianResponse != null ? formatDurationMs(sessionMedianResponse) : '—'}
                        </Badge>
                      ) : null}
                      {followLiveSession ? (
                        <Badge className="bg-emerald-50 text-emerald-800">Following this link</Badge>
                      ) : null}
                    </div>
                    {sessionChartsLoading ? (
                      <p className="text-sm text-[var(--color-ink-muted)]">Updating charts for this session…</p>
                    ) : (
                      <div key={selectedSessionId} className="space-y-4">
                        <div>
                          <p className="mb-1 text-[11px] text-[var(--color-ink-muted)]">Response duration by turn</p>
                          <LiveLineChart
                            points={sessionResponseChart}
                            valueLabel="User → bot reply"
                            formatValue={(v) => formatDurationMs(v)}
                            ariaLabel="Response duration by conversation turn"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] text-[var(--color-ink-muted)]">
                            Connection invoke duration
                            {sessionConnectionMedian != null
                              ? ` · median ${formatDurationMs(sessionConnectionMedian)}`
                              : ''}
                          </p>
                          <LiveBarChart
                            bars={sessionConnectionChart}
                            valueLabel="Invoke → result"
                            formatValue={(v) => formatDurationMs(v)}
                            ariaLabel="Connection invoke duration for selected session"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[11px] text-[var(--color-ink-muted)]">Step run duration</p>
                          <LiveBarChart
                            bars={sessionStepChart}
                            valueLabel="step.run duration"
                            formatValue={(v) => formatDurationMs(v)}
                            ariaLabel="Step run duration for selected session"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {sessionAnalysis ? (
                    <QualitativeAnalysisCard
                      className="mt-4"
                      title="Session analysis"
                      analysis={sessionAnalysis}
                    />
                  ) : null}
                </>
              )}
            </>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <SectionHeading title="Staging insights (7 days)" help={SECTION_HELP.stagingQualitative} className="mb-3" />
        <QualitativeAnalysisCard title="Overall staging quality" analysis={stagingAnalysis} />
      </Card>

      <Card className="p-4">
        <SectionHeading title="Staging drop-off (7 days)" help={SECTION_HELP.stagingAnalytics} className="mb-3" />
        {dropOff.dropOff.length ? (
          <ul className="space-y-1 text-sm">
            {dropOff.dropOff.slice(0, 10).map((row) => (
              <li key={row.nodeKey} className="flex justify-between gap-2 font-mono text-xs">
                <span className="truncate">{row.nodeKey}</span>
                <span>
                  {row.reached} ({Math.round(row.pct * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">Run a few test chats to see step reach here.</p>
        )}
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          For a full history of past test runs (including before a link was regenerated), open{' '}
          <Link className="font-medium underline" to={`/instances/${instance.id}/analytics`}>
            Analytics → Staging test history
          </Link>{' '}
          or filter Conversations by Staging.
        </p>
      </Card>
    </div>
  )
}
