import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  canAdmin,
  type Instance,
  type InstanceUsageMonthly,
} from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function QuotaBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {used.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function UsagePage() {
  const { instance, role } = useRequiredInstance()
  const qc = useQueryClient()
  const isAdmin = canAdmin(role)
  const ym = currentYearMonth()
  const [allowlist, setAllowlist] = useState('')
  const [quotaConv, setQuotaConv] = useState('')
  const [quotaEmail, setQuotaEmail] = useState('')
  const [quotaHttp, setQuotaHttp] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fresh = useQuery({
    queryKey: ['instance-usage-settings', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instances')
        .select(
          'id, http_host_allowlist, quota_max_conversations_month, quota_max_emails_month, quota_max_http_calls_month',
        )
        .eq('id', instance.id)
        .single()
      if (qError) throw qError
      return data as Pick<
        Instance,
        | 'id'
        | 'http_host_allowlist'
        | 'quota_max_conversations_month'
        | 'quota_max_emails_month'
        | 'quota_max_http_calls_month'
      >
    },
  })

  const usage = useQuery({
    queryKey: ['instance-usage-monthly', instance.id, ym],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_usage_monthly')
        .select('*')
        .eq('instance_id', instance.id)
        .eq('year_month', ym)
        .maybeSingle()
      if (qError) throw qError
      return (data as InstanceUsageMonthly | null) ?? {
        instance_id: instance.id,
        year_month: ym,
        conversations: 0,
        emails: 0,
        http_calls: 0,
        updated_at: new Date().toISOString(),
      }
    },
  })

  useEffect(() => {
    if (!fresh.data) return
    setAllowlist((fresh.data.http_host_allowlist ?? []).join(', '))
    setQuotaConv(String(fresh.data.quota_max_conversations_month))
    setQuotaEmail(String(fresh.data.quota_max_emails_month))
    setQuotaHttp(String(fresh.data.quota_max_http_calls_month))
  }, [fresh.data])

  const save = useMutation({
    mutationFn: async () => {
      const hosts = allowlist
        .split(/[,\n]/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
      const { error: updateError } = await supabase
        .from('instances')
        .update({
          http_host_allowlist: hosts,
          quota_max_conversations_month: Math.max(0, Number(quotaConv) || 0),
          quota_max_emails_month: Math.max(0, Number(quotaEmail) || 0),
          quota_max_http_calls_month: Math.max(0, Number(quotaHttp) || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id)
      if (updateError) throw updateError
    },
    onSuccess: async () => {
      setError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['instance-usage-settings', instance.id] }),
        qc.invalidateQueries({ queryKey: ['instance', instance.id] }),
      ])
    },
    onError: (err: Error) => setError(err.message),
  })

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const row = fresh.data
  const used = usage.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage & quotas"
        description={`Monthly limits and HTTP host allowlist for ${instance.name}.`}
      />

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">This month ({ym})</h2>
        {row && used ? (
          <div className="space-y-4">
            <QuotaBar
              label="Conversations"
              used={used.conversations}
              max={row.quota_max_conversations_month}
            />
            <QuotaBar label="Emails" used={used.emails} max={row.quota_max_emails_month} />
            <QuotaBar label="HTTP calls" used={used.http_calls} max={row.quota_max_http_calls_month} />
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">Loading usage…</p>
        )}
      </Card>

      <Card>
        <form className="space-y-3" onSubmit={onSubmit}>
          <h2 className="text-base font-semibold text-slate-800">Limits & allowlist</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="q-conv">Max conversations / month</Label>
              <Input
                id="q-conv"
                type="number"
                min={0}
                value={quotaConv}
                onChange={(e) => setQuotaConv(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="q-email">Max emails / month</Label>
              <Input
                id="q-email"
                type="number"
                min={0}
                value={quotaEmail}
                onChange={(e) => setQuotaEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="q-http">Max HTTP calls / month</Label>
              <Input
                id="q-http"
                type="number"
                min={0}
                value={quotaHttp}
                onChange={(e) => setQuotaHttp(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="allowlist">HTTP host allowlist</Label>
            <Textarea
              id="allowlist"
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              placeholder="api.example.com, hooks.partner.io"
              rows={3}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Comma-separated hosts. Empty means default platform policy applies.
            </p>
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
