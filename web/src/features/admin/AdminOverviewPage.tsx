import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Bot,
  Building2,
  Gauge,
  Recycle,
  ScrollText,
  Users,
  Webhook,
  type LucideIcon,
} from 'lucide-react'
import { instanceAdminPath } from '@/features/admin/adminPaths'
import { fetchDeletedChatbots } from '@/features/chatbots/RecycleBinPage'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import type { AuditEvent, InstanceUsageMonthly } from '@/shared/types/database'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type OverviewStats = {
  chatbotCount: number
  recycleCount: number
  memberCount: number
  inviteCount: number
  webhookCount: number
  usage: Pick<InstanceUsageMonthly, 'conversations' | 'emails' | 'http_calls'>
  recentEvents: AuditEvent[]
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}) {
  return (
    <Link to={to} className="block">
      <Card className="ff-hover-lift h-full transition hover:border-[var(--color-accent)]/40">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-to-br from-[var(--color-accent)]/15 to-[var(--color-accent-2)]/15 p-2.5 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/10">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              {label}
            </p>
            <p className="mt-1 truncate text-2xl font-semibold text-[var(--color-ink)]">{value}</p>
            {hint ? <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{hint}</p> : null}
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function AdminOverviewPage() {
  const { instance } = useRequiredInstance()
  const ym = currentYearMonth()
  const admin = (page?: string) => instanceAdminPath(instance.id, page)

  const stats = useQuery({
    queryKey: ['admin-overview', instance.id, ym],
    queryFn: async (): Promise<OverviewStats> => {
      const [
        chatbotRes,
        deleted,
        memberRes,
        inviteRes,
        webhookRes,
        usageRes,
        eventsRes,
      ] = await Promise.all([
        supabase
          .from('chatbots')
          .select('id', { count: 'exact', head: true })
          .eq('instance_id', instance.id)
          .is('deleted_at', null),
        fetchDeletedChatbots(instance.id),
        supabase
          .from('instance_members')
          .select('user_id, role, profiles(is_superuser)')
          .eq('instance_id', instance.id),
        supabase
          .from('instance_invites')
          .select('id', { count: 'exact', head: true })
          .eq('instance_id', instance.id),
        supabase
          .from('instance_webhooks')
          .select('id', { count: 'exact', head: true })
          .eq('instance_id', instance.id),
        supabase
          .from('instance_usage_monthly')
          .select('conversations, emails, http_calls')
          .eq('instance_id', instance.id)
          .eq('year_month', ym)
          .maybeSingle(),
        supabase
          .from('audit_events')
          .select('*')
          .eq('instance_id', instance.id)
          .order('created_at', { ascending: false })
          .limit(6),
      ])

      if (chatbotRes.error) throw chatbotRes.error
      if (memberRes.error) throw memberRes.error
      if (inviteRes.error) throw inviteRes.error
      if (webhookRes.error) throw webhookRes.error
      if (usageRes.error) throw usageRes.error
      if (eventsRes.error) throw eventsRes.error

      const memberCount = (memberRes.data ?? []).filter((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return !(row.role === 'owner' && profile?.is_superuser)
      }).length

      const usageRow = usageRes.data as Pick<
        InstanceUsageMonthly,
        'conversations' | 'emails' | 'http_calls'
      > | null

      return {
        chatbotCount: chatbotRes.count ?? 0,
        recycleCount: deleted.length,
        memberCount,
        inviteCount: inviteRes.count ?? 0,
        webhookCount: webhookRes.count ?? 0,
        usage: usageRow ?? { conversations: 0, emails: 0, http_calls: 0 },
        recentEvents: (eventsRes.data ?? []) as AuditEvent[],
      }
    },
  })

  const data = stats.data
  const used = data?.usage
  const usageHint = used
    ? `${used.conversations.toLocaleString()} chats · ${used.emails.toLocaleString()} emails · ${used.http_calls.toLocaleString()} HTTP`
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description={`Manage chatbots, users, and organisation settings for ${instance.name}.`}
      />

      {stats.isError ? (
        <p className="text-sm text-[var(--color-danger)]">
          {stats.error instanceof Error ? stats.error.message : 'Failed to load admin overview'}
        </p>
      ) : null}

      <div className="ff-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          to={admin('chatbots')}
          icon={Bot}
          label="Chatbots"
          value={stats.isLoading ? '…' : String(data?.chatbotCount ?? 0)}
          hint="Active bots in this organisation"
        />
        <StatCard
          to={admin('users')}
          icon={Users}
          label="Users"
          value={stats.isLoading ? '…' : String(data?.memberCount ?? 0)}
          hint={
            data?.inviteCount
              ? `${data.inviteCount} pending invite${data.inviteCount === 1 ? '' : 's'}`
              : 'People with access'
          }
        />
        <StatCard
          to={admin('recycle-bin')}
          icon={Recycle}
          label="Recycle bin"
          value={stats.isLoading ? '…' : String(data?.recycleCount ?? 0)}
          hint="Deleted chatbots you can restore"
        />
        <StatCard
          to={admin('usage')}
          icon={Gauge}
          label={`Usage (${ym})`}
          value={used ? used.conversations.toLocaleString() : stats.isLoading ? '…' : '0'}
          hint={usageHint ?? 'Conversations this month'}
        />
        <StatCard
          to={admin('webhooks')}
          icon={Webhook}
          label="Webhooks"
          value={stats.isLoading ? '…' : String(data?.webhookCount ?? 0)}
          hint="Outbound event subscriptions"
        />
        <StatCard
          to={admin('settings')}
          icon={Building2}
          label="Organisation"
          value={instance.name}
          hint={instance.contact_email || instance.slug}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[var(--color-ink-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Recent activity</h2>
          </div>
          <Link
            to={admin('audit')}
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Open audit log
          </Link>
        </div>
        {stats.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : data?.recentEvents.length ? (
          <ul className="divide-y divide-[var(--color-border)]/60">
            {data.recentEvents.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="font-medium text-[var(--color-ink)]">{ev.action}</span>
                <span className="text-[var(--color-ink-muted)]">
                  {ev.resource_type}
                  {ev.created_at
                    ? ` · ${formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">No audit events yet.</p>
        )}
      </Card>
    </div>
  )
}
