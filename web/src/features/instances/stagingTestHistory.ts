import { displaySessionStatus } from '@/features/instances/conversationStatus'
import type { ConversationEvent, ConversationSession } from '@/shared/types/database'

export type StagingTestSource = 'test_link' | 'public_staging'

export type StagingTestHistoryRow = {
  session: ConversationSession & { chatbots?: { name: string } | null }
  shownStatus: ConversationSession['status']
  stepCount: number
  durationMinutes: number | null
  source: StagingTestSource
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

export function stagingTestSource(
  session: Pick<ConversationSession, 'variables'>,
): StagingTestSource {
  const vars = asRecord(session.variables)
  return vars._staging_test === true ? 'test_link' : 'public_staging'
}

export function isStagingSession(session: Pick<ConversationSession, 'environment'>): boolean {
  return (session.environment ?? 'production') === 'staging'
}

export function buildStagingTestHistoryRows(args: {
  sessions: Array<ConversationSession & { chatbots?: { name: string } | null }>
  events: Array<Pick<ConversationEvent, 'session_id' | 'kind'>>
  chatbotId?: string | null
  rangeDays?: number | null
  sourceFilter?: StagingTestSource | ''
  now?: Date
}): StagingTestHistoryRow[] {
  const now = args.now ?? new Date()
  const rangeMs =
    args.rangeDays != null && args.rangeDays > 0 ? args.rangeDays * 24 * 60 * 60 * 1000 : null
  const cutoff = rangeMs != null ? now.getTime() - rangeMs : null

  const stepCounts = new Map<string, number>()
  for (const event of args.events) {
    if (event.kind !== 'step.run') continue
    stepCounts.set(event.session_id, (stepCounts.get(event.session_id) ?? 0) + 1)
  }

  let rows = args.sessions.filter(isStagingSession)

  if (args.chatbotId) {
    rows = rows.filter((s) => s.chatbot_id === args.chatbotId)
  }

  if (cutoff != null) {
    rows = rows.filter((s) => {
      const t = Date.parse(s.created_at)
      return Number.isFinite(t) && t >= cutoff
    })
  }

  if (args.sourceFilter) {
    rows = rows.filter((s) => stagingTestSource(s) === args.sourceFilter)
  }

  return rows
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((session) => {
      const start = Date.parse(session.created_at)
      const end = Date.parse(session.completed_at ?? session.updated_at)
      const durationMinutes =
        Number.isFinite(start) && Number.isFinite(end) && end >= start
          ? Math.round(((end - start) / 60_000) * 10) / 10
          : null

      return {
        session,
        shownStatus: displaySessionStatus(session),
        stepCount: stepCounts.get(session.id) ?? 0,
        durationMinutes,
        source: stagingTestSource(session),
      }
    })
}
