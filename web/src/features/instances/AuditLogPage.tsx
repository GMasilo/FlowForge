import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin, type AuditEvent } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { Card } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'
import { Navigate } from 'react-router-dom'

export function AuditLogPage() {
  const { instance, role } = useRequiredInstance()
  const isAdmin = canAdmin(role)

  const events = useQuery({
    queryKey: ['audit-events', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as AuditEvent[]
    },
  })

  if (!isAdmin) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description={`Security and admin activity for ${instance.name}.`}
      />

      <Card className="overflow-hidden p-0">
        {events.isLoading ? (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">Loading…</p>
        ) : events.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/80 text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                  <th className="px-4 py-2.5 font-semibold">Resource</th>
                  <th className="px-4 py-2.5 font-semibold">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/60">
                {events.data.map((ev) => (
                  <tr key={ev.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[var(--color-ink-muted)]">
                      {format(new Date(ev.created_at), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[var(--color-ink)]">{ev.action}</td>
                    <td className="px-4 py-2.5 text-[var(--color-ink-muted)]">
                      <span className="font-mono text-[12px]">{ev.resource_type}</span>
                      {ev.resource_id ? (
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--color-ink-muted)]">
                          {ev.resource_id}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 font-mono text-[11px] text-[var(--color-ink-muted)]">
                      {JSON.stringify(ev.meta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-sm text-[var(--color-ink-muted)]">No audit events yet.</p>
        )}
      </Card>
    </div>
  )
}
