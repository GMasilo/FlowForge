import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Recycle, Settings2, Trash2, Workflow } from 'lucide-react'
import { instanceAdminPath } from '@/features/admin/adminPaths'
import { fetchDeletedChatbots, recycleBinQueryKey } from '@/features/chatbots/RecycleBinPage'
import { getPublishStatus } from '@/features/designer/utils/flowPublish'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'
import {
  BulkActionBar,
  matchesQuery,
  RowCheckbox,
  SearchField,
  setAllIds,
  toggleId,
} from '@/shared/ui/list-controls'

type BotRow = {
  id: string
  name: string
  description: string | null
  updated_at: string
  chatbot_flows:
    | {
        version: number | null
        published_at: string | null
        has_draft_changes: boolean | null
        published_graph: unknown
      }
    | {
        version: number | null
        published_at: string | null
        has_draft_changes: boolean | null
        published_graph: unknown
      }[]
    | null
}

function publishStatusOf(bot: BotRow) {
  const flowRaw = Array.isArray(bot.chatbot_flows) ? bot.chatbot_flows[0] : bot.chatbot_flows
  return getPublishStatus({
    version: flowRaw?.version ?? 1,
    published_at: flowRaw?.published_at ?? null,
    has_draft_changes: flowRaw?.has_draft_changes ?? true,
    published_graph: flowRaw?.published_graph ?? null,
  })
}

export function AdminChatbotsPage() {
  const { instance } = useRequiredInstance()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  const chatbots = useQuery({
    queryKey: ['chatbots', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name, description, updated_at, chatbot_flows(version, published_at, has_draft_changes, published_graph)')
        .eq('instance_id', instance.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      if (qError) throw qError
      return data as BotRow[]
    },
  })

  const recycleCount = useQuery({
    queryKey: recycleBinQueryKey(instance.id),
    queryFn: () => fetchDeletedChatbots(instance.id),
    select: (rows) => rows.length,
  })

  const filtered = useMemo(() => {
    return (chatbots.data ?? []).filter((bot) =>
      matchesQuery(search, [bot.name, bot.description, publishStatusOf(bot).label]),
    )
  }, [chatbots.data, search])

  const filteredIds = useMemo(() => filtered.map((b) => b.id), [filtered])
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))

  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set((chatbots.data ?? []).map((b) => b.id))
      const next = new Set<string>()
      for (const id of prev) if (valid.has(id)) next.add(id)
      return next
    })
  }, [chatbots.data])

  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const chatbotId of ids) {
        const { error: rpcError } = await supabase.rpc('soft_delete_chatbot', {
          p_chatbot_id: chatbotId,
        })
        if (rpcError) throw rpcError
      }
    },
    onSuccess: async () => {
      setSelected(new Set())
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['chatbots-recycle-bin', instance.id] })
      await qc.invalidateQueries({ queryKey: ['admin-overview', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function confirmDelete(ids: string[], label: string) {
    if (
      !window.confirm(
        `Move ${label} to the recycle bin? Public chat will turn off until you restore ${ids.length === 1 ? 'it' : 'them'}.`,
      )
    ) {
      return
    }
    softDelete.mutate(ids)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbots"
        description={`Inventory and delete chatbots for ${instance.name}. Design work stays on the Chatbots home.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={instanceAdminPath(instance.id, 'recycle-bin')}>
              <Button variant="secondary">
                <Recycle className="h-4 w-4" />
                Recycle bin
                {recycleCount.data ? (
                  <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)]">
                    {recycleCount.data}
                  </span>
                ) : null}
              </Button>
            </Link>
            <Link to={`/instances/${instance.id}`}>
              <Button>Open workspace</Button>
            </Link>
          </div>
        }
      />

      {error ? <FieldError>{error}</FieldError> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          id="admin-bot-search"
          value={search}
          onChange={setSearch}
          placeholder="Search chatbots…"
        />
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
          <RowCheckbox
            checked={allFilteredSelected}
            onChange={(on) => setSelected(setAllIds(filteredIds, on))}
            label="Select all visible chatbots"
            className="mt-0"
          />
          Select all
        </label>
      </div>

      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={softDelete.isPending}
          onClick={() =>
            confirmDelete([...selected], `${selected.size} chatbot${selected.size === 1 ? '' : 's'}`)
          }
        >
          <Trash2 className="h-4 w-4" />
          Move to recycle bin
        </Button>
      </BulkActionBar>

      <Card className="overflow-hidden p-0">
        {chatbots.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/80 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="w-10 px-4 py-2.5" />
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Updated</th>
                  <th className="px-4 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/60">
                {filtered.map((bot) => {
                  const status = publishStatusOf(bot)
                  return (
                    <tr key={bot.id}>
                      <td className="px-4 py-2.5">
                        <RowCheckbox
                          checked={selected.has(bot.id)}
                          onChange={() => setSelected((prev) => toggleId(prev, bot.id))}
                          label={`Select ${bot.name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          to={`/instances/${instance.id}/chatbots/${bot.id}`}
                          className="font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                        >
                          {bot.name}
                        </Link>
                        {bot.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-ink-muted)]">
                            {bot.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge>{status.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[var(--color-ink-muted)]">
                        {formatDistanceToNow(new Date(bot.updated_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <Link to={`/instances/${instance.id}/chatbots/${bot.id}`}>
                            <Button size="sm" variant="ghost">
                              <Settings2 className="h-3.5 w-3.5" />
                              Settings
                            </Button>
                          </Link>
                          <Link to={`/instances/${instance.id}/chatbots/${bot.id}/design`}>
                            <Button size="sm" variant="ghost">
                              <Workflow className="h-3.5 w-3.5" />
                              Design
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={softDelete.isPending}
                            onClick={() => confirmDelete([bot.id], `“${bot.name}”`)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">
            {chatbots.data?.length ? 'No chatbots match your search.' : 'No chatbots yet.'}
          </p>
        )}
      </Card>
    </div>
  )
}
