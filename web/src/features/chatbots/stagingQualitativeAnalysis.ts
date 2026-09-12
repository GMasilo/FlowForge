import type { DropOffRow } from '@/features/instances/conversationAnalytics'
import { displaySessionStatus } from '@/features/instances/conversationStatus'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'
import {
  buildSessionConnectionRuns,
  buildSessionResponseDurations,
  connectionInvokeValues,
  formatDurationMs,
  median,
} from '@/features/chatbots/stagingLiveMetrics'

export type AnalysisVerdict = 'healthy' | 'attention' | 'failed' | 'in_progress'

export type QualitativeAnalysis = {
  verdict: AnalysisVerdict
  headline: string
  summary: string
  findings: string[]
  recommendations: string[]
}

const RESPONSE_SNAPPY_MS = 2_000
const RESPONSE_SLOW_MS = 5_000
const RESPONSE_VERY_SLOW_MS = 10_000
const CONNECTION_FAST_MS = 1_000
const CONNECTION_SLOW_MS = 3_000
const CONNECTION_VERY_SLOW_MS = 10_000

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function isTerminalStatus(status: ConversationSession['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'abandoned'
}

function sessionDurationMs(
  session: Pick<ConversationSession, 'created_at' | 'completed_at' | 'updated_at'>,
): number | null {
  const start = Date.parse(session.created_at)
  const end = Date.parse(session.completed_at ?? session.updated_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return end - start
}

function stepRunEvents(events: ConversationEvent[]): ConversationEvent[] {
  return events.filter((e) => e.kind === 'step.run')
}

function failedStepRuns(events: ConversationEvent[]): ConversationEvent[] {
  return stepRunEvents(events).filter((e) => {
    const status = String(asRecord(e.payload).status ?? '')
    return status === 'Failed' || status === 'TimedOut'
  })
}

function describeResponseSpeed(ms: number | null): string | null {
  if (ms == null) return null
  if (ms <= RESPONSE_SNAPPY_MS) return 'snappy'
  if (ms <= RESPONSE_SLOW_MS) return 'acceptable'
  if (ms <= RESPONSE_VERY_SLOW_MS) return 'slow'
  return 'very slow'
}

function describeConnectionSpeed(ms: number | null): string | null {
  if (ms == null) return null
  if (ms <= CONNECTION_FAST_MS) return 'fast'
  if (ms <= CONNECTION_SLOW_MS) return 'moderate'
  if (ms <= CONNECTION_VERY_SLOW_MS) return 'slow'
  return 'very slow'
}

function escalateVerdict(current: AnalysisVerdict, floor: 'attention' | 'failed'): AnalysisVerdict {
  if (floor === 'failed') return 'failed'
  return current === 'failed' ? 'failed' : 'attention'
}

function verdictLabel(verdict: AnalysisVerdict): string {
  switch (verdict) {
    case 'healthy':
      return 'Looks good'
    case 'attention':
      return 'Needs review'
    case 'failed':
      return 'Failed test'
    case 'in_progress':
      return 'In progress'
  }
}

export function buildSessionQualitativeAnalysis(args: {
  session: ConversationSession
  events: ConversationEvent[]
}): QualitativeAnalysis {
  const { session, events } = args
  const shown = displaySessionStatus(session)
  const terminal = isTerminalStatus(shown)
  const stepCount = stepRunEvents(events).length
  const userTurns = events.filter((e) => e.kind === 'message.user').length
  const failedSteps = failedStepRuns(events)
  const lastStep = stepRunEvents(events).at(-1)?.node_key ?? null
  const durationMs = sessionDurationMs(session)

  const responseDurations = buildSessionResponseDurations(events).map((p) => p.value)
  const medianResponse = median(responseDurations)
  const maxResponse = responseDurations.length ? Math.max(...responseDurations) : null

  const connectionRuns = buildSessionConnectionRuns(events)
  const connectionDurations = connectionInvokeValues(events)
  const medianConnection = median(connectionDurations)
  const maxConnection = connectionDurations.length ? Math.max(...connectionDurations) : null
  const slowestConnection = connectionRuns.reduce<typeof connectionRuns[0] | null>((best, run) => {
    if (!best || run.value > best.value) return run
    return best
  }, null)

  const findings: string[] = []
  const recommendations: string[] = []
  let verdict: AnalysisVerdict = terminal ? 'healthy' : 'in_progress'

  if (!terminal) {
    findings.push(
      stepCount
        ? `${stepCount} step${stepCount === 1 ? '' : 's'} recorded so far${userTurns ? ` across ${userTurns} user turn${userTurns === 1 ? '' : 's'}` : ''}.`
        : 'Session started — waiting for the first steps.',
    )
    if (medianResponse != null) {
      findings.push(
        `Median bot reply time so far is ${formatDurationMs(medianResponse)} (${describeResponseSpeed(medianResponse)}).`,
      )
    }
    if (medianConnection != null) {
      findings.push(
        `Connection calls are averaging ${formatDurationMs(medianConnection)} invoke-to-result (${describeConnectionSpeed(medianConnection)}).`,
      )
    }
    return {
      verdict: 'in_progress',
      headline: verdictLabel('in_progress'),
      summary: 'This staging test is still running. Analysis will update when the session completes.',
      findings,
      recommendations: ['Continue the conversation in the test link until it completes or fails.'],
    }
  }

  if (shown === 'failed' || failedSteps.length > 0) {
    verdict = 'failed'
  } else if (shown === 'abandoned') {
    verdict = 'attention'
  } else if (
    (medianResponse != null && medianResponse > RESPONSE_SLOW_MS) ||
    (maxConnection != null && maxConnection > CONNECTION_VERY_SLOW_MS) ||
    failedSteps.length > 0
  ) {
    verdict = 'attention'
  }

  if (shown === 'completed') {
    findings.push(
      `Conversation completed successfully${stepCount ? ` after ${stepCount} step${stepCount === 1 ? '' : 's'}` : ''}${
        durationMs != null ? ` in ${formatDurationMs(durationMs)}` : ''
      }.`,
    )
  } else if (shown === 'failed') {
    findings.push(
      `Session ended with status failed${stepCount ? ` after ${stepCount} step${stepCount === 1 ? '' : 's'}` : ''}${
        durationMs != null ? ` (${formatDurationMs(durationMs)} elapsed)` : ''
      }.`,
    )
  } else if (shown === 'abandoned') {
    findings.push(
      `Session appears abandoned${lastStep ? ` after reaching step “${lastStep}”` : ''}${
        durationMs != null ? ` (${formatDurationMs(durationMs)} elapsed)` : ''
      }.`,
    )
  }

  if (userTurns > 0) {
    const speed = describeResponseSpeed(medianResponse)
    if (medianResponse != null && speed) {
      findings.push(
        `Users waited a median of ${formatDurationMs(medianResponse)} for bot replies (${speed})${
          maxResponse != null && maxResponse > medianResponse * 1.5
            ? `; slowest turn was ${formatDurationMs(maxResponse)}`
            : ''
        }.`,
      )
      if (medianResponse > RESPONSE_SLOW_MS) {
        recommendations.push(
          'Review typing delays, heavy steps before bot messages, or long connection calls that block the next reply.',
        )
      }
    }
  }

  if (connectionRuns.length > 0) {
    const speed = describeConnectionSpeed(medianConnection)
    if (medianConnection != null && speed) {
      findings.push(
        `${connectionRuns.length} connection run${connectionRuns.length === 1 ? '' : 's'} (HTTP, email, etc.) with median invoke time ${formatDurationMs(medianConnection)} (${speed}).`,
      )
    }
    if (slowestConnection && slowestConnection.value > CONNECTION_SLOW_MS) {
      findings.push(
        `Slowest connection was “${slowestConnection.label}” at ${formatDurationMs(slowestConnection.value)}${
          slowestConnection.status ? ` (${slowestConnection.status})` : ''
        }.`,
      )
      if (slowestConnection.value > CONNECTION_VERY_SLOW_MS) {
        recommendations.push(
          `Inspect timeout and backend performance for “${slowestConnection.label}”; consider caching or async handoff if appropriate.`,
        )
      }
    }
  }

  for (const step of failedSteps) {
    const payload = asRecord(step.payload)
    const type = String(payload.type ?? 'step')
    findings.push(
      `Step “${step.node_key ?? 'unknown'}” (${type}) ${String(payload.status ?? 'failed').toLowerCase()}.`,
    )
    recommendations.push(`Open the designer, check step “${step.node_key ?? 'unknown'}”, and re-test that branch.`)
  }

  if (shown === 'abandoned' && lastStep) {
    recommendations.push(
      `Review copy and validation on “${lastStep}” — testers often drop off when a question is unclear or a connection fails silently.`,
    )
  }

  if (verdict === 'healthy' && recommendations.length === 0) {
    recommendations.push('No major issues detected. Run a few more varied paths before promoting to production.')
  }

  const summary =
    verdict === 'healthy'
      ? 'Staging metrics for this session look healthy — completion, response times, and connections are within normal ranges.'
      : verdict === 'attention'
        ? 'The session finished but staging metrics suggest areas to review before promoting.'
        : verdict === 'failed'
          ? 'This test run hit failures that should be fixed before promoting the staging graph.'
          : 'Analysis based on recorded staging events for this session.'

  return {
    verdict,
    headline: verdictLabel(verdict),
    summary,
    findings,
    recommendations: [...new Set(recommendations)],
  }
}

export function buildStagingQualitativeAnalysis(args: {
  sessions: ConversationSession[]
  events: ConversationEvent[]
  completionRate: number
  medianSteps: number | null
  dropOff: DropOffRow[]
  rangeDays?: number
}): QualitativeAnalysis {
  const rangeDays = args.rangeDays ?? 7
  const findings: string[] = []
  const recommendations: string[] = []
  const terminalSessions = args.sessions.filter((s) => isTerminalStatus(displaySessionStatus(s)))
  const completed = terminalSessions.filter((s) => displaySessionStatus(s) === 'completed').length
  const failed = terminalSessions.filter((s) => displaySessionStatus(s) === 'failed').length
  const abandoned = terminalSessions.filter((s) => displaySessionStatus(s) === 'abandoned').length
  const sessionCount = args.sessions.length

  let verdict: AnalysisVerdict = 'healthy'

  if (sessionCount === 0) {
    return {
      verdict: 'in_progress',
      headline: 'No staging data yet',
      summary: `Run test conversations via the staging link to build a ${rangeDays}-day qualitative report.`,
      findings: [],
      recommendations: ['Publish to staging, open the test link, and complete at least one full conversation path.'],
    }
  }

  if (sessionCount < 3) {
    verdict = 'attention'
    findings.push(`Only ${sessionCount} staging session${sessionCount === 1 ? '' : 's'} in the last ${rangeDays} days — trends are preliminary.`)
    recommendations.push('Run at least three varied test paths (happy path, edge case, connection failure) for reliable insights.')
  }

  const completionPct = Math.round(args.completionRate * 100)
  findings.push(
    `${sessionCount} session${sessionCount === 1 ? '' : 's'}: ${completed} completed, ${failed} failed, ${abandoned} abandoned (${completionPct}% completion rate).`,
  )

  if (sessionCount >= 3 && args.completionRate < 0.25 && failed > 0) {
    verdict = 'failed'
    recommendations.push('Completion is below 25% with failures — fix broken steps before promoting.')
  } else if (args.completionRate < 0.5 && sessionCount >= 3) {
    verdict = 'attention'
    recommendations.push('Completion is below 50% — prioritise fixing failed steps and abandoned paths before promoting.')
  } else if (failed > 0) {
    verdict = verdict === 'healthy' ? 'attention' : verdict
    recommendations.push('Review failed sessions in the transcript and fix connection or validation errors.')
  }

  if (args.medianSteps != null) {
    findings.push(`Median path length is ${args.medianSteps} step${args.medianSteps === 1 ? '' : 's'} per session.`)
  }

  const firstDrop = args.dropOff[0]
  let biggestDrop: { nodeKey: string; delta: number; pct: number } | null = null
  for (let i = 1; i < args.dropOff.length; i++) {
    const prev = args.dropOff[i - 1]!
    const row = args.dropOff[i]!
    const delta = prev.pct - row.pct
    if (delta > 15 && (!biggestDrop || delta > biggestDrop.delta)) {
      biggestDrop = { nodeKey: row.nodeKey, delta, pct: row.pct }
    }
  }
  if (biggestDrop && firstDrop) {
    verdict = escalateVerdict(verdict, 'attention')
    findings.push(
      `Largest funnel drop is before “${biggestDrop.nodeKey}” — ${biggestDrop.pct}% of sessions still reach it (down ${Math.round(biggestDrop.delta)} pts from the prior step).`,
    )
    recommendations.push(`Inspect the flow around “${biggestDrop.nodeKey}” for friction, errors, or slow connections.`)
  }

  const connectionDurations = connectionInvokeValues(args.events)
  const medianConnection = median(connectionDurations)
  if (connectionDurations.length >= 3 && medianConnection != null) {
    const speed = describeConnectionSpeed(medianConnection)
    findings.push(
      `Across sessions, connection invoke times median at ${formatDurationMs(medianConnection)} (${speed ?? 'unknown'}).`,
    )
    if (medianConnection > CONNECTION_SLOW_MS) {
      verdict = escalateVerdict(verdict, 'attention')
      recommendations.push('Connection latency is elevated — check HTTP/email backends and step timeouts in the designer.')
    }
  }

  const responseBySession = args.sessions
    .map((session) => {
      const sessionEvents = args.events.filter((e) => e.session_id === session.id)
      return median(buildSessionResponseDurations(sessionEvents).map((p) => p.value))
    })
    .filter((value): value is number => value != null)

  const overallMedianResponse = median(responseBySession)
  if (overallMedianResponse != null && responseBySession.length >= 2) {
    const speed = describeResponseSpeed(overallMedianResponse)
    findings.push(
      `Typical user → bot reply time is ${formatDurationMs(overallMedianResponse)} (${speed ?? 'unknown'}) across completed paths.`,
    )
    if (overallMedianResponse > RESPONSE_SLOW_MS) {
      verdict = escalateVerdict(verdict, 'attention')
      recommendations.push('Bot reply latency is high — reduce blocking connection steps before messages or add interim typing feedback.')
    }
  }

  if (verdict === 'healthy' && recommendations.length === 0) {
    recommendations.push('Staging quality looks solid. Promote to production when you are satisfied with coverage.')
  }

  const summary =
    verdict === 'healthy'
      ? `Overall staging health is good over the last ${rangeDays} days based on completion, drop-off, and latency metrics.`
      : verdict === 'attention'
        ? `Staging tests are running but metrics over the last ${rangeDays} days suggest follow-up before promotion.`
        : `Staging tests over the last ${rangeDays} days need attention before promotion.`

  return {
    verdict,
    headline: verdictLabel(verdict),
    summary,
    findings,
    recommendations: [...new Set(recommendations)],
  }
}

export function verdictBadgeClass(verdict: AnalysisVerdict): string {
  switch (verdict) {
    case 'healthy':
      return 'bg-emerald-100 text-emerald-900'
    case 'attention':
      return 'bg-amber-100 text-amber-950'
    case 'failed':
      return 'bg-rose-100 text-rose-900'
    case 'in_progress':
      return 'bg-sky-100 text-sky-900'
  }
}

export function verdictPanelClass(verdict: AnalysisVerdict): string {
  switch (verdict) {
    case 'healthy':
      return 'border-emerald-200/80 bg-emerald-50/40'
    case 'attention':
      return 'border-amber-200/80 bg-amber-50/40'
    case 'failed':
      return 'border-rose-200/80 bg-rose-50/40'
    case 'in_progress':
      return 'border-sky-200/80 bg-sky-50/40'
  }
}
