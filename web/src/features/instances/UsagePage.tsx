import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  formatQuotaCap,
  ORGANISATION_PLAN_IDS,
  parseOrganisationPlan,
  planLimitsFor,
  type OrganisationPlanId,
} from '@/features/billing/planCatalog'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import {
  canAdmin,
  type Instance,
  type InstanceUsageMonthly,
} from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { Select } from '@/shared/ui/select'
import { PAGE_HELP, SECTION_HELP } from '@/shared/help/pageHelp'
import { SectionHeading } from '@/shared/ui/help-tooltip'
import { PageHeader } from '@/shared/ui/page-header'
import { cn } from '@/shared/lib/utils'

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function QuotaBar({ used, max, label }: { used: number; max: number; label: string }) {
  const unlimited = max < 0
  const pct = !unlimited && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-[var(--color-ink)]">{label}</span>
        <span className="text-[var(--color-ink-muted)]">
          {used.toLocaleString()} / {unlimited ? '∞' : max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
          style={{ width: unlimited ? '8%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function UsagePage() {
  const { instance, role } = useRequiredInstance()
  const { isSuperuser } = useAuth()
  const qc = useQueryClient()
  const isAdmin = canAdmin(role)
  const ym = currentYearMonth()
  const [allowlist, setAllowlist] = useState('')
  const [quotaConv, setQuotaConv] = useState('')
  const [quotaEmail, setQuotaEmail] = useState('')
  const [quotaHttp, setQuotaHttp] = useState('')
  const [planDraft, setPlanDraft] = useState<OrganisationPlanId>('business')
  const [error, setError] = useState<string | null>(null)
  const [planMessage, setPlanMessage] = useState<string | null>(null)

  const plan = parseOrganisationPlan(instance.plan)
  const catalog = planLimitsFor(plan)
  const canEditQuotas = isSuperuser || plan === 'enterprise'

  const fresh = useQuery({
    queryKey: ['instance-usage-settings', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instances')
        .select(
          'id, plan, http_host_allowlist, quota_max_conversations_month, quota_max_emails_month, quota_max_http_calls_month, quota_max_chatbots, quota_max_seats, features',
        )
        .eq('id', instance.id)
        .single()
      if (qError) throw qError
      return data as Pick<
        Instance,
        | 'id'
        | 'plan'
        | 'http_host_allowlist'
        | 'quota_max_conversations_month'
        | 'quota_max_emails_month'
        | 'quota_max_http_calls_month'
        | 'quota_max_chatbots'
        | 'quota_max_seats'
        | 'features'
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

  const seats = useQuery({
    queryKey: ['instance-seat-count', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('organisation_seat_count', {
        p_instance_id: instance.id,
      })
      if (rpcError) throw rpcError
      return typeof data === 'number' ? data : Number(data) || 0
    },
  })

  const bots = useQuery({
    queryKey: ['instance-chatbot-count', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('organisation_chatbot_count', {
        p_instance_id: instance.id,
      })
      if (rpcError) throw rpcError
      return typeof data === 'number' ? data : Number(data) || 0
    },
  })

  useEffect(() => {
    if (!fresh.data) return
    setAllowlist((fresh.data.http_host_allowlist ?? []).join(', '))
    setQuotaConv(String(fresh.data.quota_max_conversations_month))
    setQuotaEmail(String(fresh.data.quota_max_emails_month))
    setQuotaHttp(String(fresh.data.quota_max_http_calls_month))
    setPlanDraft(parseOrganisationPlan(fresh.data.plan))
  }, [fresh.data])

  const save = useMutation({
    mutationFn: async () => {
      const hosts = allowlist
        .split(/[,\n]/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
      const patch: {
        http_host_allowlist: string[]
        updated_at: string
        quota_max_conversations_month?: number
        quota_max_emails_month?: number
        quota_max_http_calls_month?: number
      } = {
        http_host_allowlist: hosts,
        updated_at: new Date().toISOString(),
      }
      if (canEditQuotas) {
        patch.quota_max_conversations_month = Math.max(0, Number(quotaConv) || 0)
        patch.quota_max_emails_month = Math.max(0, Number(quotaEmail) || 0)
        patch.quota_max_http_calls_month = Math.max(0, Number(quotaHttp) || 0)
      }
      const { error: updateError } = await supabase.from('instances').update(patch).eq('id', instance.id)
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

  const setPlan = useMutation({
    mutationFn: async (next: OrganisationPlanId) => {
      const { error: rpcError } = await supabase.rpc('set_organisation_plan', {
        p_instance_id: instance.id,
        p_plan: next,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: async () => {
      setPlanMessage('Plan updated — features and quotas applied.')
      setError(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['instance-usage-settings', instance.id] }),
        qc.invalidateQueries({ queryKey: ['instance', instance.id] }),
      ])
    },
    onError: (err: Error) => {
      setPlanMessage(null)
      setError(err.message)
    },
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
  const maxBots = row?.quota_max_chatbots ?? catalog.quotaMaxChatbots
  const maxSeats = row?.quota_max_seats ?? catalog.quotaMaxSeats

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage & plan"
        description={`Plan limits and HTTP host allowlist for ${instance.name}.`}
        help={PAGE_HELP.usage}
      />

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              Current plan
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
              {catalog.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Features and monthly quotas follow the{' '}
              <Link to="/pricing" className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline">
                pricing catalog
              </Link>
              .
            </p>
          </div>
          {isSuperuser ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="org-plan">Change plan</Label>
                <Select
                  id="org-plan"
                  value={planDraft}
                  onChange={(e) => setPlanDraft(e.target.value as OrganisationPlanId)}
                  className="min-w-[10rem]"
                >
                  {ORGANISATION_PLAN_IDS.map((id) => (
                    <option key={id} value={id}>
                      {planLimitsFor(id).label}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                disabled={setPlan.isPending || planDraft === plan}
                onClick={() => setPlan.mutate(planDraft)}
              >
                {setPlan.isPending ? 'Applying…' : 'Apply plan'}
              </Button>
            </div>
          ) : (
            <Link to="/pricing" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
              View plans
            </Link>
          )}
        </div>
        {planMessage ? <p className="text-sm text-teal-800">{planMessage}</p> : null}
        <ul className="grid gap-2 text-sm text-[var(--color-ink-muted)] sm:grid-cols-2">
          <li>
            Chatbots: {bots.data?.toLocaleString() ?? '—'} / {formatQuotaCap(maxBots)}
          </li>
          <li>
            Seats: {seats.data?.toLocaleString() ?? '—'} / {formatQuotaCap(maxSeats)}
          </li>
        </ul>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">This month ({ym})</h2>
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
          <SectionHeading title="Limits & allowlist" help={SECTION_HELP.httpAllowlist} className="mb-0" />
          {!canEditQuotas ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              Monthly quotas are fixed by the {catalog.label} plan. Enterprise organisations (or platform
              superusers) can customise them.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="q-conv">Max conversations / month</Label>
              <Input
                id="q-conv"
                type="number"
                min={0}
                value={quotaConv}
                onChange={(e) => setQuotaConv(e.target.value)}
                disabled={!canEditQuotas}
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
                disabled={!canEditQuotas}
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
                disabled={!canEditQuotas}
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
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
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
