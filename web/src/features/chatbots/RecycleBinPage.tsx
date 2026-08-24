import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bot, Recycle, RotateCcw, Trash2 } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { isFlowForgeApiConfigured, purgeChatbotFiles } from '@/shared/lib/flowforgeApi'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'

export type DeletedBot = {
  id: string
  name: string
  description: string | null
  deleted_at: string | null
  updated_at: string
}

export function recycleBinQueryKey(instanceId: string) {
  return ['chatbots-recycle-bin', instanceId, 'list'] as const
}

export async function fetchDeletedChatbots(instanceId: string): Promise<DeletedBot[]> {
  const { data, error } = await supabase
    .from('chatbots')
    .select('id, name, description, deleted_at, updated_at')
    .eq('instance_id', instanceId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return data as DeletedBot[]
}

async function purgeThenDelete(instanceId: string, chatbotId: string) {
  if (isFlowForgeApiConfigured()) {
    try {
      await purgeChatbotFiles({ instanceId, chatbotId })
    } catch {
      // Folders may already be gone; still remove the database row.
    }
  }
  const { error } = await supabase.rpc('permanently_delete_chatbot', { p_chatbot_id: chatbotId })
  if (error) throw error
}

export function RecycleBinPage() {
  const { instance, role } = useRequiredInstance()
  const qc = useQueryClient()
  const isAdmin = canAdmin(role)
  const [error, setError] = useState<string | null>(null)

  const bots = useQuery({
    queryKey: recycleBinQueryKey(instance.id),
    enabled: isAdmin,
    queryFn: () => fetchDeletedChatbots(instance.id),
    refetchOnMount: 'always',
  })

  const restore = useMutation({
    mutationFn: async (chatbotId: string) => {
      const { error: rpcError } = await supabase.rpc('restore_chatbot', { p_chatbot_id: chatbotId })
      if (rpcError) throw rpcError
    },
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['chatbots-recycle-bin', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const destroy = useMutation({
    mutationFn: (chatbotId: string) => purgeThenDelete(instance.id, chatbotId),
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['chatbots-recycle-bin', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const emptyBin = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await purgeThenDelete(instance.id, id)
      }
    },
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['chatbots-recycle-bin', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  const rows = Array.isArray(bots.data) ? bots.data : []
  const busy = restore.isPending || destroy.isPending || emptyBin.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recycle bin"
        description={`Deleted chatbots for ${instance.name}. Restore them, or delete them forever.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/instances/${instance.id}/admin/chatbots`}>
              <Button variant="secondary">Back to admin</Button>
            </Link>
            <Link to={`/instances/${instance.id}`}>
              <Button variant="secondary">Workspace</Button>
            </Link>
            {rows.length ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Permanently delete ${rows.length} chatbot${rows.length === 1 ? '' : 's'}? This cannot be undone.`,
                    )
                  ) {
                    return
                  }
                  emptyBin.mutate(rows.map((b) => b.id))
                }}
              >
                Empty recycle bin
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <FieldError>{error}</FieldError> : null}

      {bots.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : rows.length ? (
        <div className="ff-stagger grid gap-4 sm:grid-cols-2">
          {rows.map((bot) => (
            <Card key={bot.id} className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--color-surface-2)] p-2.5 text-[var(--color-ink-muted)] ring-1 ring-[var(--color-border)]">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold text-[var(--color-ink)]">{bot.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                    {bot.description || 'No description'}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-[var(--color-ink-muted)]">
                    Deleted{' '}
                    {bot.deleted_at
                      ? formatDistanceToNow(new Date(bot.deleted_at), { addSuffix: true })
                      : 'recently'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => restore.mutate(bot.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Permanently delete “${bot.name}”? Flows, conversations, and files for this chatbot will be removed. This cannot be undone.`,
                      )
                    ) {
                      return
                    }
                    destroy.mutate(bot.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete forever
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-[var(--color-border)]/70 bg-[var(--color-surface-2)]/50 text-center">
          <Recycle className="mx-auto h-8 w-8 text-[var(--color-ink-muted)]/50" />
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Recycle bin is empty.</p>
        </Card>
      )}
    </div>
  )
}
