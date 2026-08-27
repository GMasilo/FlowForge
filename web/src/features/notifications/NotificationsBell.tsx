import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, CheckCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useInstanceContext } from '@/features/instances/InstanceContext'
import { subscribeUserNotifications } from '@/shared/lib/realtime'
import { supabase } from '@/shared/lib/supabase'
import type { UserNotification } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

function kindLabel(kind: string): string {
  switch (kind) {
    case 'handoff.escalated':
      return 'Handoff'
    case 'handoff.assigned':
    case 'handoff.transferred':
      return 'Assignment'
            case 'handoff.visitor_message':
      return 'Visitor'
    case 'flow.comment':
      return 'Comment'
    case 'flow.shared':
      return 'Share'
    case 'flow.published':
      return 'Publish'
    case 'member.joined':
      return 'Members'
    case 'alert.threshold':
    case 'alert.digest':
      return 'Alert'
    default:
      return 'Update'
  }
}

export function NotificationsBell() {
  const { user } = useAuth()
  const ctx = useInstanceContext()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null)

  const queryKey = ['user-notifications', user?.id, ctx?.instance?.id ?? 'all'] as const

  const notifications = useQuery({
    queryKey,
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(40)
      if (ctx?.instance?.id) {
        q = q.eq('instance_id', ctx.instance.id)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as UserNotification[]
    },
  })

  useEffect(() => {
    if (!user) return
    const channel = subscribeUserNotifications(user.id, () => {
      void qc.invalidateQueries({ queryKey: ['user-notifications', user.id] })
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, qc])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open || !buttonRef.current) {
      setPanelPos(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    setPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }, [open])

  const rows = notifications.data ?? []
  const unreadCount = useMemo(() => rows.filter((n) => !n.read_at).length, [rows])

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user-notifications', user?.id] })
    },
  })

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_instance_id: ctx?.instance?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user-notifications', user?.id] })
    },
  })

  if (!user) return null

  const panel =
    open && panelPos ? (
      <div
        ref={panelRef}
        className="fixed z-[80] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
        style={{ top: panelPos.top, right: panelPos.right }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/70 px-3 py-2">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Notifications</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={markAll.isPending || unreadCount === 0}
            onClick={() => markAll.mutate()}
            title="Mark all read"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span className="text-[11px]">Mark all</span>
          </Button>
        </div>
        <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
          {notifications.isLoading ? (
            <p className="px-3 py-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : !rows.length ? (
            <p className="px-3 py-4 text-sm text-[var(--color-ink-muted)]">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/60">
              {rows.map((n) => {
                const unread = !n.read_at
                const inner = (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        {kindLabel(n.kind)}
                      </span>
                      <span className="text-[10px] text-[var(--color-ink-muted)]">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={cn('mt-1 text-sm', unread ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-ink)]')}>
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-ink-muted)]">{n.body}</p>
                    ) : null}
                  </div>
                )
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        to={n.href}
                        className={cn(
                          'flex gap-2 px-3 py-2.5 transition hover:bg-slate-50',
                          unread ? 'bg-teal-50/40' : '',
                        )}
                        onClick={() => {
                          if (unread) markOne.mutate(n.id)
                          setOpen(false)
                        }}
                      >
                        {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" /> : <span className="w-2 shrink-0" />}
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          'flex w-full gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50',
                          unread ? 'bg-teal-50/40' : '',
                        )}
                        onClick={() => {
                          if (unread) markOne.mutate(n.id)
                        }}
                      >
                        {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" /> : <span className="w-2 shrink-0" />}
                        {inner}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="relative inline-flex items-center justify-center rounded-xl px-2 py-1.5 text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  )
}
