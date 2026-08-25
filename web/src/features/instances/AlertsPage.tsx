import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Bell, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { listIntegrations } from '@/features/integrations/integrationApi'
import {
  canAdmin,
  type AlertDelivery,
  type InstanceAlertRule,
  type InstanceAlertSettings,
} from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { displaySessionStatus } from '@/features/instances/conversationStatus'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { PageHeader } from '@/shared/ui/page-header'
import { FieldError } from '@/shared/ui/field-error'
import { Badge } from '@/shared/ui/badge'

type AlertMetric = InstanceAlertRule['metric']

const METRIC_LABELS: Record<AlertMetric, string> = {
  abandon_rate: 'Abandon rate ≥ %',
  failed_sessions: 'Failed sessions ≥ count',
  completion_rate_below: 'Completion rate ≤ %',
  quota_conversations_pct: 'Conversation quota used ≥ %',
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AlertsPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = canAdmin(role)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('High abandon rate')
  const [metric, setMetric] = useState<AlertMetric>('abandon_rate')
  const [threshold, setThreshold] = useState('40')
  const [windowHours, setWindowHours] = useState('24')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifySlack, setNotifySlack] = useState(false)
  const [slackIntegrationId, setSlackIntegrationId] = useState('')

  const rules = useQuery({
    queryKey: ['alert-rules', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_alert_rules')
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
      if (qError) throw qError
      return (data ?? []) as InstanceAlertRule[]
    },
  })

  const settings = useQuery({
    queryKey: ['alert-settings', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_alert_settings')
        .select('*')
        .eq('instance_id', instance.id)
        .maybeSingle()
      if (qError) throw qError
      return (data as InstanceAlertSettings | null) ?? null
    },
  })

  const deliveries = useQuery({
    queryKey: ['alert-deliveries', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('alert_deliveries')
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(40)
      if (qError) throw qError
      return (data ?? []) as AlertDelivery[]
    },
  })

  const integrations = useQuery({
    queryKey: ['instance-integrations', instance.id],
    enabled: isAdmin,
    queryFn: () => listIntegrations(instance.id),
  })

  const slackIntegrations = useMemo(
    () => (integrations.data ?? []).filter((i) => i.provider === 'slack' && i.status === 'connected'),
    [integrations.data],
  )

  const sessions = useQuery({
    queryKey: ['conversation-sessions-alerts', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('conversation_sessions')
        .select('id, status, created_at, updated_at, completed_at')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (qError) throw qError
      return data ?? []
    },
  })

  const usage = useQuery({
    queryKey: ['instance-usage-alerts', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      const [{ data: inst }, { data: row }] = await Promise.all([
        supabase
          .from('instances')
          .select('quota_max_conversations_month')
          .eq('id', instance.id)
          .single(),
        supabase
          .from('instance_usage_monthly')
          .select('conversations')
          .eq('instance_id', instance.id)
          .eq('year_month', ym)
          .maybeSingle(),
      ])
      return {
        max: Number(inst?.quota_max_conversations_month ?? 0),
        used: Number(row?.conversations ?? 0),
      }
    },
  })

  const evaluations = useMemo(() => {
    const now = Date.now()
    const list = rules.data ?? []
    return list.map((rule) => {
      const cutoff = now - rule.window_hours * 3600_000
      const windowSessions = (sessions.data ?? []).filter((s) => {
        const t = Date.parse(s.created_at)
        return Number.isFinite(t) && t >= cutoff
      })
      const n = windowSessions.length
      let value = 0
      let unit = ''
      if (rule.metric === 'abandon_rate') {
        const abandoned = windowSessions.filter((s) => displaySessionStatus(s) === 'abandoned').length
        value = n ? (abandoned / n) * 100 : 0
        unit = '%'
      } else if (rule.metric === 'failed_sessions') {
        value = windowSessions.filter((s) => s.status === 'failed').length
        unit = ''
      } else if (rule.metric === 'completion_rate_below') {
        const completed = windowSessions.filter((s) => s.status === 'completed').length
        value = n ? (completed / n) * 100 : 100
        unit = '%'
      } else if (rule.metric === 'quota_conversations_pct') {
        const max = usage.data?.max ?? 0
        const used = usage.data?.used ?? 0
        value = max > 0 ? (used / max) * 100 : 0
        unit = '%'
      }
      const triggered =
        rule.enabled &&
        (rule.metric === 'completion_rate_below'
          ? value <= Number(rule.threshold)
          : value >= Number(rule.threshold))
      return { rule, value, unit, triggered, sampleSize: n }
    })
  }, [rules.data, sessions.data, usage.data])

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sign in required')
      const n = name.trim()
      if (!n) throw new Error('Name is required')
      if (notifySlack && !slackIntegrationId) {
        throw new Error('Pick a Slack integration or turn off Slack notify')
      }
      const { error: insError } = await supabase.from('instance_alert_rules').insert({
        instance_id: instance.id,
        name: n,
        metric,
        threshold: Number(threshold) || 0,
        window_hours: Math.max(1, Number(windowHours) || 24),
        enabled: true,
        notify_email: notifyEmail,
        notify_slack: notifySlack,
        slack_integration_id: notifySlack ? slackIntegrationId || null : null,
        created_by: user.id,
      })
      if (insError) throw insError
    },
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['alert-rules', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateRule = useMutation({
    mutationFn: async (patch: {
      id: string
      notify_email?: boolean
      notify_slack?: boolean
      slack_integration_id?: string | null
      enabled?: boolean
    }) => {
      const { id, ...rest } = patch
      const { error: updError } = await supabase.from('instance_alert_rules').update(rest).eq('id', id)
      if (updError) throw updError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alert-rules', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await supabase.from('instance_alert_rules').delete().eq('id', id)
      if (delError) throw delError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alert-rules', instance.id] })
    },
  })

  const saveDigest = useMutation({
    mutationFn: async (next: {
      digest_enabled: boolean
      digest_weekday: number
      digest_slack_integration_id: string | null
    }) => {
      const { error: upsertError } = await supabase.from('instance_alert_settings').upsert({
        instance_id: instance.id,
        digest_enabled: next.digest_enabled,
        digest_weekday: next.digest_weekday,
        digest_slack_integration_id: next.digest_slack_integration_id,
        updated_at: new Date().toISOString(),
      })
      if (upsertError) throw upsertError
    },
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['alert-settings', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const digestEnabled = settings.data?.digest_enabled ?? false
  const digestWeekday = settings.data?.digest_weekday ?? 1
  const digestSlackId = settings.data?.digest_slack_integration_id ?? ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description={`Threshold rules and weekly digests for ${instance.name}. Notifications use ${
          instance.contact_email || 'organisation contact email (set in settings)'
        }.`}
      />

      {error ? <FieldError>{error}</FieldError> : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">Weekly digest</h2>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Email KPIs to the organisation contact email on the chosen UTC weekday. Optional Slack.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={digestEnabled}
              onChange={(e) =>
                saveDigest.mutate({
                  digest_enabled: e.target.checked,
                  digest_weekday: digestWeekday,
                  digest_slack_integration_id: digestSlackId || null,
                })
              }
            />
            Enable weekly digest
          </label>
          <div>
            <Label>Weekday (UTC)</Label>
            <Select
              value={String(digestWeekday)}
              onChange={(e) =>
                saveDigest.mutate({
                  digest_enabled: digestEnabled,
                  digest_weekday: Number(e.target.value),
                  digest_slack_integration_id: digestSlackId || null,
                })
              }
            >
              {WEEKDAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Slack (optional)</Label>
            <Select
              value={digestSlackId}
              onChange={(e) =>
                saveDigest.mutate({
                  digest_enabled: digestEnabled,
                  digest_weekday: digestWeekday,
                  digest_slack_integration_id: e.target.value || null,
                })
              }
            >
              <option value="">None</option>
              {slackIntegrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {settings.data?.last_digest_at ? (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Last digest {formatDistanceToNow(new Date(settings.data.last_digest_at), { addSuffix: true })}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
          <Plus className="h-4 w-4" />
          New rule
        </h2>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={onSubmit}>
          <div className="lg:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Metric</Label>
            <Select value={metric} onChange={(e) => setMetric(e.target.value as AlertMetric)}>
              {(Object.keys(METRIC_LABELS) as AlertMetric[]).map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Threshold</Label>
            <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div>
            <Label>Window (hours)</Label>
            <Input type="number" min={1} value={windowHours} onChange={(e) => setWindowHours(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifySlack} onChange={(e) => setNotifySlack(e.target.checked)} />
            Slack
          </label>
          {notifySlack ? (
            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Slack integration</Label>
              <Select value={slackIntegrationId} onChange={(e) => setSlackIntegrationId(e.target.value)}>
                <option value="">Select…</option>
                {slackIntegrations.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
              {!slackIntegrations.length ? (
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Connect Slack under{' '}
                  <Link to={`/instances/${instance.id}/integrations`} className="text-teal-800 underline">
                    Integrations
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Add rule'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        {rules.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading rules…</p>
        ) : evaluations.length ? (
          <ul className="divide-y divide-[var(--color-border)]/60">
            {evaluations.map(({ rule, value, unit, triggered, sampleSize }) => (
              <li key={rule.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Bell
                    className={
                      triggered ? 'h-4 w-4 text-amber-500' : 'h-4 w-4 text-[var(--color-ink-muted)]'
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--color-ink)]">{rule.name}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {METRIC_LABELS[rule.metric]} · threshold {rule.threshold}
                      {rule.metric.includes('rate') || rule.metric.includes('pct') ? '%' : ''} · last{' '}
                      {rule.window_hours}h · n={sampleSize}
                      {rule.last_notified_at
                        ? ` · last notified ${formatDistanceToNow(new Date(rule.last_notified_at), { addSuffix: true })}`
                        : ''}
                    </p>
                  </div>
                  <Badge className={triggered ? 'bg-amber-100 text-amber-900' : undefined}>
                    {triggered ? 'Triggered' : 'OK'} · {value.toFixed(1)}
                    {unit}
                  </Badge>
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 pl-7 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!rule.notify_email}
                      onChange={(e) =>
                        updateRule.mutate({ id: rule.id, notify_email: e.target.checked })
                      }
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!rule.notify_slack}
                      onChange={(e) =>
                        updateRule.mutate({
                          id: rule.id,
                          notify_slack: e.target.checked,
                          slack_integration_id: e.target.checked
                            ? rule.slack_integration_id || slackIntegrations[0]?.id || null
                            : null,
                        })
                      }
                    />
                    Slack
                  </label>
                  {rule.notify_slack ? (
                    <Select
                      className="h-8 max-w-[12rem] text-xs"
                      value={rule.slack_integration_id ?? ''}
                      onChange={(e) =>
                        updateRule.mutate({
                          id: rule.id,
                          slack_integration_id: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Select Slack…</option>
                      {slackIntegrations.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">
            No alert rules yet. Add one to monitor abandon rate, failures, or quota burn.
          </p>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)]/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Recent deliveries</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Logged by the server cron (<code className="text-[10px]">POST /api/alerts/run</code>).
          </p>
        </div>
        {deliveries.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : (deliveries.data ?? []).length ? (
          <ul className="divide-y divide-[var(--color-border)]/60">
            {(deliveries.data ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <Badge className={d.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}>
                  {d.ok ? 'ok' : 'failed'}
                </Badge>
                <span className="text-[var(--color-ink)]">
                  {d.kind} · {d.channel}
                </span>
                <span className="text-xs text-[var(--color-ink-muted)]">
                  {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                </span>
                {d.error ? (
                  <span className="w-full text-xs text-rose-700 sm:w-auto">{d.error}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">No deliveries yet.</p>
        )}
      </Card>
    </div>
  )
}
