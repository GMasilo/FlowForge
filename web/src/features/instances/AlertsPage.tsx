import { useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin } from '@/shared/types/database'
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

type AlertMetric =
  | 'abandon_rate'
  | 'failed_sessions'
  | 'completion_rate_below'
  | 'quota_conversations_pct'

type AlertRule = {
  id: string
  instance_id: string
  name: string
  metric: AlertMetric
  threshold: number
  window_hours: number
  enabled: boolean
  created_at: string
}

const METRIC_LABELS: Record<AlertMetric, string> = {
  abandon_rate: 'Abandon rate ≥ %',
  failed_sessions: 'Failed sessions ≥ count',
  completion_rate_below: 'Completion rate ≤ %',
  quota_conversations_pct: 'Conversation quota used ≥ %',
}

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

  const rules = useQuery({
    queryKey: ['alert-rules', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_alert_rules' as never)
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
      if (qError) throw qError
      return (data ?? []) as AlertRule[]
    },
  })

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
      const { error: insError } = await supabase.from('instance_alert_rules' as never).insert({
        instance_id: instance.id,
        name: n,
        metric,
        threshold: Number(threshold) || 0,
        window_hours: Math.max(1, Number(windowHours) || 24),
        enabled: true,
        created_by: user.id,
      } as never)
      if (insError) throw insError
    },
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['alert-rules', instance.id] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await supabase
        .from('instance_alert_rules' as never)
        .delete()
        .eq('id', id)
      if (delError) throw delError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alert-rules', instance.id] })
    },
  })

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description={`Threshold rules for abandon rate, failures, completion, and quota on ${instance.name}.`}
      />

      {error ? <FieldError>{error}</FieldError> : null}

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
              <li key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
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
                  </p>
                </div>
                <Badge className={triggered ? 'bg-amber-100 text-amber-900' : undefined}>
                  {triggered ? 'Triggered' : 'OK'} · {value.toFixed(1)}
                  {unit}
                </Badge>
                <Button size="sm" variant="danger" onClick={() => remove.mutate(rule.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">
            No alert rules yet. Add one to monitor abandon rate, failures, or quota burn.
          </p>
        )}
      </Card>
    </div>
  )
}
