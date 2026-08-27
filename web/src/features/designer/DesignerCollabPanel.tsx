import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Check, Copy, Link2 } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/features/auth/AuthProvider'
import { canEdit, type FlowChangeLog, type FlowComment } from '@/shared/types/database'
import { flowPresenceChannelName } from '@/shared/lib/realtime'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'
import {
  locksFromPresence,
  queuePosition,
  type PeerStepLock,
  type PresenceEntry,
} from '@/features/designer/collab/stepLocks'

type OrgMemberOption = {
  kind: 'member' | 'invite'
  status: 'active' | 'pending'
  user_id: string | null
  email: string | null
  display_name: string | null
  role: string
}

type Props = {
  flowId: string
  instanceId: string
  chatbotId: string
  role: string | null | undefined
  selectedNodeKey?: string | null
  onRestoreSnapshot?: (snapshot: unknown) => void
  onPeerLocksChange?: (locks: Record<string, PeerStepLock>) => void
}

function designerUrl(instanceId: string, chatbotId: string): string {
  const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
  return `${window.location.origin}${basename}/instances/${instanceId}/chatbots/${chatbotId}/design`
}

export function DesignerCollabPanel({
  flowId,
  instanceId,
  chatbotId,
  role,
  selectedNodeKey,
  onRestoreSnapshot,
  onPeerLocksChange,
}: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role as 'owner' | 'admin' | 'editor' | 'viewer' | null)
  const [body, setBody] = useState('')
  const [peers, setPeers] = useState<{ key: string; name: string; color: string; stepKey?: string }[]>([])
  const [peerLocks, setPeerLocks] = useState<Record<string, PeerStepLock>>({})
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [shareNote, setShareNote] = useState('')
  const [shareInfo, setShareInfo] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null)
  const [copied, setCopied] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const claimRef = useRef<{ key: string | null; at: string | null }>({ key: null, at: null })
  const selectedNodeKeyRef = useRef(selectedNodeKey)
  selectedNodeKeyRef.current = selectedNodeKey
  const onPeerLocksChangeRef = useRef(onPeerLocksChange)
  onPeerLocksChangeRef.current = onPeerLocksChange

  function claimTimestampFor(key: string | null | undefined): string | null {
    const next = key?.trim() || null
    if (!next) {
      claimRef.current = { key: null, at: null }
      return null
    }
    if (claimRef.current.key === next && claimRef.current.at) {
      return claimRef.current.at
    }
    const at = new Date().toISOString()
    claimRef.current = { key: next, at }
    return at
  }

  function presencePayload() {
    const key = selectedNodeKeyRef.current ?? null
    return {
      name: user?.email ?? 'Editor',
      color: '#0f766e',
      selected_node_key: key,
      selected_at: claimTimestampFor(key),
    }
  }

  const members = useQuery({
    queryKey: ['organisation-users', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_organisation_users', {
        p_instance_id: instanceId,
      })
      if (error) throw error
      return (Array.isArray(data) ? data : []) as OrgMemberOption[]
    },
  })

  const access = useQuery({
    queryKey: ['chatbot-access', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const [{ data: bot, error: botError }, { data: shares, error: sharesError }] = await Promise.all([
        supabase.from('chatbots').select('created_by').eq('id', chatbotId).single(),
        supabase.from('chatbot_shares').select('user_id').eq('chatbot_id', chatbotId),
      ])
      if (botError) throw botError
      if (sharesError) throw sharesError
      return {
        createdBy: bot?.created_by as string | null,
        sharedUserIds: (shares ?? []).map((s) => s.user_id as string),
      }
    },
  })

  const alreadyHasAccess = useMemo(() => {
    const ids = new Set<string>()
    if (access.data?.createdBy) ids.add(access.data.createdBy)
    for (const id of access.data?.sharedUserIds ?? []) ids.add(id)
    // Owners/admins already see every chatbot
    for (const row of members.data ?? []) {
      if (row.kind === 'member' && row.user_id && (row.role === 'owner' || row.role === 'admin')) {
        ids.add(row.user_id)
      }
    }
    return ids
  }, [access.data, members.data])

  const shareCandidates = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    return (members.data ?? [])
      .filter(
        (row) =>
          row.kind === 'member' &&
          row.status === 'active' &&
          !!row.user_id &&
          row.user_id !== user?.id &&
          !alreadyHasAccess.has(row.user_id),
      )
      .filter((row) => {
        if (!q) return true
        return [row.display_name, row.email, row.role]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      })
  }, [members.data, memberQuery, user?.id, alreadyHasAccess])

  const sharedMembers = useMemo(() => {
    const shared = new Set(access.data?.sharedUserIds ?? [])
    const createdBy = access.data?.createdBy
    return (members.data ?? []).filter(
      (row) =>
        row.kind === 'member' &&
        !!row.user_id &&
        (shared.has(row.user_id) || row.user_id === createdBy),
    )
  }, [members.data, access.data])

  const comments = useQuery({
    queryKey: ['flow-comments', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_comments')
        .select('*')
        .eq('flow_id', flowId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as FlowComment[]
    },
  })

  const changes = useQuery({
    queryKey: ['flow-change-log', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_change_log')
        .select('*')
        .eq('flow_id', flowId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as FlowChangeLog[]
    },
  })

  // Stable presence channel — do not remount on selection changes (preserves claim order).
  useEffect(() => {
    if (!user || !flowId) return
    const channel = supabase.channel(flowPresenceChannelName(flowId), {
      config: { presence: { key: user.id } },
    })
    channelRef.current = channel
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, PresenceEntry[]>
        const list: { key: string; name: string; color: string; stepKey?: string }[] = []
        for (const [key, entries] of Object.entries(state)) {
          const entry = entries[0]
          if (!entry) continue
          list.push({
            key,
            name: entry.name ?? key.slice(0, 6),
            color: entry.color ?? '#0f766e',
            stepKey: entry.selected_node_key?.trim() || undefined,
          })
        }
        setPeers(list.filter((p) => p.key !== user.id))
        const locks = locksFromPresence(state, user.id)
        const asRecord: Record<string, PeerStepLock> = {}
        for (const [nodeKey, lock] of locks) asRecord[nodeKey] = lock
        setPeerLocks(asRecord)
        onPeerLocksChangeRef.current?.(asRecord)
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel.track(presencePayload())
      })

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
      onPeerLocksChangeRef.current?.({})
    }
  }, [flowId, user])

  // Publish selection + first-claim timestamp without tearing down the channel
  useEffect(() => {
    if (!user || !flowId) return
    const payload = presencePayload()
    const channel = channelRef.current
    if (channel) {
      void channel.track(payload)
    }
    void supabase.from('flow_editor_presence').upsert({
      flow_id: flowId,
      user_id: user.id,
      selected_node_key: payload.selected_node_key,
      color: '#0f766e',
      cursor: payload.selected_at ? { selected_at: payload.selected_at } : {},
      updated_at: new Date().toISOString(),
    })
  }, [flowId, user, selectedNodeKey])

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('add_flow_comment', {
        p_flow_id: flowId,
        p_body: body.trim(),
        p_node_key: selectedNodeKey ?? null,
        p_parent_id: null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setBody('')
      await qc.invalidateQueries({ queryKey: ['flow-comments', flowId] })
    },
  })

  async function onComment(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    addComment.mutate()
  }

  const share = useMutation({
    mutationFn: async () => {
      const ids = [...selectedIds]
      if (!ids.length) throw new Error('Select at least one member')
      const { data, error } = await supabase.rpc('share_flow_with_members', {
        p_flow_id: flowId,
        p_user_ids: ids,
        p_message: shareNote.trim() || null,
      })
      if (error) throw error
      return data as { notified?: number; href?: string }
    },
    onSuccess: async (result) => {
      const n = result?.notified ?? selectedIds.size
      setSelectedIds(new Set())
      setShareNote('')
      setShareInfo({
        message: `Shared with ${n} member${n === 1 ? '' : 's'}`,
        tone: 'ok',
      })
      await qc.invalidateQueries({ queryKey: ['chatbot-access', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbots', instanceId] })
    },
    onError: (err: Error) => {
      setShareInfo({ message: err.message || 'Could not notify members', tone: 'error' })
    },
  })

  const restore = useMutation({
    mutationFn: async (changeId: string) => {
      const { data, error } = await supabase.rpc('restore_flow_change_log', {
        p_change_id: changeId,
      })
      if (error) throw error
      return data
    },
    onSuccess: (snapshot) => {
      onRestoreSnapshot?.(snapshot)
    },
  })

  function toggleMember(userId: string) {
    setShareInfo(null)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function copyLink() {
    const url = designerUrl(instanceId, chatbotId)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setShareInfo({ message: 'Link copied', tone: 'ok' })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setShareInfo({ message: 'Could not copy link', tone: 'error' })
    }
  }

  return (
    <aside
      className={cn(
        'flex h-fit w-full flex-col gap-3 rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/80 p-3 lg:w-72',
        'lg:sticky lg:top-[var(--ff-designer-aside-top,5rem)] lg:max-h-[calc(100vh-var(--ff-designer-aside-top,7.5rem)-1.5rem)] lg:overflow-y-auto',
      )}
    >      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Collaborators
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {peers.length ? (
            peers.map((p) => (
              <span
                key={p.key}
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: p.color }}
                title={p.stepKey ? `Editing ${p.stepKey}` : undefined}
              >
                {p.name}
                {p.stepKey ? ` · ${p.stepKey}` : ''}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--color-ink-muted)]">Only you here</span>
          )}
        </div>
        {Object.keys(peerLocks).length ? (
          <ul className="mt-2 space-y-1">
            {Object.entries(peerLocks).map(([stepKey, lock]) => {
              const myPlace = user ? queuePosition(lock, user.id) : null
              return (
                <li key={stepKey} className="text-[10px] leading-snug text-[var(--color-ink-muted)]">
                  <span className="font-mono text-[var(--color-ink)]">{stepKey}</span>
                  {' · '}
                  locked by {lock.name}
                  {lock.queue.length ? (
                    <span className="block text-[10px]">
                      Next: {lock.queue.map((q) => q.name).join(' → ')}
                      {myPlace != null ? ` (you #${myPlace + 1})` : ''}
                    </span>
                  ) : myPlace != null ? (
                    <span className="block text-[10px]">You are waiting (#{myPlace + 1})</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {editable ? (
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Share
          </p>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => void copyLink()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-ink-muted)]">
          Invite organisation members who do not already have access.
        </p>
        {sharedMembers.length ? (
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Already has access
            </p>
            <ul className="mt-1 space-y-0.5">
              {sharedMembers.map((row) => {
                const isOwner = row.user_id === access.data?.createdBy
                return (
                  <li
                    key={row.user_id}
                    className="truncate rounded-md px-1.5 py-1 text-[11px] text-[var(--color-ink-muted)]"
                  >
                    <span className="font-medium text-[var(--color-ink)]">
                      {row.display_name || row.email || row.user_id?.slice(0, 8)}
                    </span>
                    {isOwner ? ' · owner' : ' · shared'}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <Input
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          placeholder="Search members…"
          className="mt-2 h-8 text-xs"
        />
        <ul className="mt-2 max-h-36 space-y-1 overflow-auto rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/40 p-1">
          {shareCandidates.length ? (
            shareCandidates.map((row) => {
              const id = row.user_id!
              const checked = selectedIds.has(id)
              return (
                <li key={id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs transition',
                      checked ? 'bg-teal-500/10' : 'hover:bg-[var(--color-surface)]/80',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => toggleMember(id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {row.display_name || row.email || id.slice(0, 8)}
                      </span>
                      <span className="block truncate text-[10px] text-[var(--color-ink-muted)]">
                        {row.email}
                        {row.role ? ` · ${row.role}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })
          ) : (
            <li className="px-1.5 py-2 text-[11px] text-[var(--color-ink-muted)]">
              {members.isLoading || access.isLoading
                ? 'Loading members…'
                : memberQuery.trim()
                  ? 'No matching members'
                  : 'Everyone eligible already has access'}
            </li>
          )}
        </ul>
        <Input
          value={shareNote}
          onChange={(e) => {
            setShareInfo(null)
            setShareNote(e.target.value)
          }}
          placeholder="Optional note…"
          className="mt-2 h-8 text-xs"
          maxLength={280}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!selectedIds.size || share.isPending}
            onClick={() => share.mutate()}
          >
            <Link2 className="h-3.5 w-3.5" />
            {share.isPending ? 'Sending…' : `Notify${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
          </Button>
        </div>
        {shareInfo ? (
          <p
            className={cn(
              'mt-1.5 text-[11px]',
              shareInfo.tone === 'error' ? 'text-red-700' : 'text-[var(--color-ink-muted)]',
            )}
          >
            {shareInfo.message}
          </p>
        ) : null}
      </div>
      ) : null}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Comments</p>
        <ul className="mt-2 max-h-40 space-y-2 overflow-auto">
          {(comments.data ?? []).map((c) => (
            <li key={c.id} className="rounded-lg bg-[var(--color-surface-2)]/80 px-2 py-1.5 text-xs">
              {c.body}
              {c.node_key ? (
                <span className="mt-0.5 block font-mono text-[10px] text-[var(--color-ink-muted)]">@{c.node_key}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {editable ? (
          <form className="mt-2 flex gap-1" onSubmit={onComment}>
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={selectedNodeKey ? `Comment on ${selectedNodeKey}` : 'Comment…'}
            />
            <Button type="submit" size="sm" disabled={!body.trim() || addComment.isPending}>
              Add
            </Button>
          </form>
        ) : null}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Change history
        </p>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
          {(changes.data ?? []).map((ch) => (
            <li
              key={ch.id}
              className={cn(
                'flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-xs',
                'bg-[var(--color-surface-2)]/60',
              )}
            >
              <div>
                <p className="font-medium">{ch.summary}</p>
                <p className="text-[10px] text-[var(--color-ink-muted)]">
                  {formatDistanceToNow(new Date(ch.created_at), { addSuffix: true })}
                </p>
              </div>
              {editable && ch.snapshot && onRestoreSnapshot ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(ch.id)}
                >
                  Restore
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-[var(--color-ink-muted)]">Org {instanceId.slice(0, 8)}… · Step locks · merge saves</p>
    </aside>
  )
}
