import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin, type InstanceWebhook, type WebhookDelivery } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'
import { Badge } from '@/shared/ui/badge'

const EVENT_OPTIONS = [
  'flow.published',
  'conversation.completed',
  'conversation.failed',
] as const

export function WebhooksPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = canAdmin(role)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['flow.published'])
  const [error, setError] = useState<string | null>(null)

  const hooks = useQuery({
    queryKey: ['instance-webhooks', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_webhooks')
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
      if (qError) throw qError
      return data as InstanceWebhook[]
    },
  })

  const deliveries = useQuery({
    queryKey: ['webhook-deliveries', instance.id],
    enabled: isAdmin && !!hooks.data?.length,
    queryFn: async () => {
      const ids = (hooks.data ?? []).map((h) => h.id)
      if (!ids.length) return [] as Array<WebhookDelivery & { webhook_name?: string }>
      const { data, error: qError } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .in('webhook_id', ids)
        .order('created_at', { ascending: false })
        .limit(50)
      if (qError) throw qError
      const nameById = new Map((hooks.data ?? []).map((h) => [h.id, h.name]))
      return ((data ?? []) as WebhookDelivery[]).map((d) => ({
        ...d,
        webhook_name: nameById.get(d.webhook_id) ?? d.webhook_id.slice(0, 8),
      }))
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !url.trim()) throw new Error('Name and URL are required')
      if (!events.length) throw new Error('Select at least one event')
      const { error: insertError } = await supabase.from('instance_webhooks').insert({
        instance_id: instance.id,
        name: name.trim(),
        url: url.trim(),
        events,
        created_by: user!.id,
      })
      if (insertError) throw insertError
    },
    onSuccess: async () => {
      setName('')
      setUrl('')
      setEvents(['flow.published'])
      setOpen(false)
      setError(null)
      await qc.invalidateQueries({ queryKey: ['instance-webhooks', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error: updateError } = await supabase
        .from('instance_webhooks')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (updateError) throw updateError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['instance-webhooks', instance.id] })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await supabase.from('instance_webhooks').delete().eq('id', id)
      if (delError) throw delError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['instance-webhooks', instance.id] })
    },
  })

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  function toggleEvent(ev: string) {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev]))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description={`Notify external systems when things happen in ${instance.name}. Conversation completed and failed payloads include the session’s variables.`}
        actions={
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add webhook
          </Button>
        }
      />

      {open ? (
        <Card>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="hook-name">Name</Label>
              <Input id="hook-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="hook-url">URL</Label>
              <Input
                id="hook-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/hooks/flowforge"
                required
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((ev) => {
                  const on = events.includes(ev)
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={
                        on
                          ? 'rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white'
                          : 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-muted)]'
                      }
                    >
                      {ev}
                    </button>
                  )
                })}
              </div>
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Create webhook'}
            </Button>
          </form>
        </Card>
      ) : null}

      {hooks.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : hooks.data?.length ? (
        <div className="space-y-3">
          {hooks.data.map((hook) => (
            <Card key={hook.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[var(--color-ink)]">{hook.name}</h2>
                  <Badge>{hook.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-[var(--color-ink-muted)]">{hook.url}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hook.events.map((ev) => (
                    <span
                      key={ev}
                      className="rounded-md bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-ink-muted)]"
                    >
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleEnabled.mutate({ id: hook.id, enabled: !hook.enabled })}
                >
                  {hook.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(hook.id)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">No webhooks configured.</p>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)]/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Recent deliveries</h2>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Last 50 attempts across this organisation’s webhooks
          </p>
        </div>
        {deliveries.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading deliveries…</p>
        ) : deliveries.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Webhook</th>
                  <th className="px-4 py-2 font-semibold">Event</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {deliveries.data.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--color-ink-muted)]">
                      {format(new Date(d.created_at), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{d.webhook_name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-[var(--color-ink-muted)]">{d.event}</td>
                    <td className="px-4 py-2">
                      <Badge className={d.ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}>
                        {d.ok ? 'OK' : 'Fail'}
                        {d.status_code != null ? ` · ${d.status_code}` : ''}
                      </Badge>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-rose-600">{d.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">No deliveries logged yet.</p>
        )}
      </Card>
    </div>
  )
}
