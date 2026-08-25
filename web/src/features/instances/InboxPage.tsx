import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Headphones } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { sessionStatusTone } from '@/features/instances/conversationStatus'
import { supabase } from '@/shared/lib/supabase'
import type { ConversationSession } from '@/shared/types/database'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { cn } from '@/shared/lib/utils'

type InboxRow = ConversationSession & { chatbots: { name: string } | null }

export function InboxPage() {
  const { instance } = useRequiredInstance()

  const inbox = useQuery({
    queryKey: ['conversation-inbox', instance.id],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_sessions')
        .select('*, chatbots(name)')
        .eq('instance_id', instance.id)
        .eq('status', 'escalated')
        .order('updated_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as InboxRow[]
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description={`Escalated conversations waiting for an agent on ${instance.name}.`}
      />

      <Card className="overflow-hidden p-0">
        {inbox.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading inbox…</p>
        ) : (inbox.data ?? []).length ? (
          <ul className="divide-y divide-[var(--color-border)]/60">
            {(inbox.data ?? []).map((row) => (
              <li key={row.id}>
                <Link
                  to={`/instances/${instance.id}/conversations/${row.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-[var(--color-surface-2)]/60"
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
                      {row.visitor_key ? ` · visitor ${row.visitor_key.slice(0, 8)}…` : ''}
                    </p>
                  </div>
                  <Badge className={cn(sessionStatusTone('escalated'))}>escalated</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">
            No escalated conversations. Add an “Escalate to agent” step in a flow to populate this inbox.
          </p>
        )}
      </Card>
    </div>
  )
}
