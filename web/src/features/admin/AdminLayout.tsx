import { NavLink, Navigate, Outlet, useParams } from 'react-router-dom'
import {
  Bot,
  Building2,
  Gauge,
  LayoutDashboard,
  Lock,
  Recycle,
  Scale,
  ScrollText,
  Users,
  Webhook,
} from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin } from '@/shared/types/database'
import { cn } from '@/shared/lib/utils'
import { instanceAdminPath } from '@/features/admin/adminPaths'

const tabs = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/chatbots', label: 'Chatbots', icon: Bot, end: false },
  { to: '/users', label: 'Users', icon: Users, end: false },
  { to: '/recycle-bin', label: 'Recycle bin', icon: Recycle, end: false },
  { to: '/settings', label: 'Organisation', icon: Building2, end: false },
  { to: '/compliance', label: 'Compliance', icon: Scale, end: false },
  { to: '/security', label: 'Security', icon: Lock, end: false },
  { to: '/usage', label: 'Usage', icon: Gauge, end: false },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook, end: false },
  { to: '/audit', label: 'Audit', icon: ScrollText, end: false },
] as const

export function AdminLayout() {
  const { instance, role } = useRequiredInstance()
  if (!canAdmin(role)) {
    return <Navigate to={`/instances/${instance.id}`} replace />
  }

  const base = instanceAdminPath(instance.id)

  return (
    <div className="space-y-6">
      <nav
        aria-label="Organisation admin"
        className="flex w-fit max-w-full flex-wrap rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-2)]/80 p-1"
      >
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to || 'overview'}
            to={`${base}${to}`}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition',
                isActive
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-sm'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]',
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}

/** Owners/admins land in the admin Users section; other roles are redirected away. */
export function MembersRoute() {
  const { instance, role } = useRequiredInstance()
  if (canAdmin(role)) {
    return <Navigate to={instanceAdminPath(instance.id, 'users')} replace />
  }
  return <Navigate to={`/instances/${instance.id}`} replace />
}

export function LegacyAdminRedirect({ page }: { page: string }) {
  const { instanceId } = useParams()
  if (!instanceId) return <Navigate to="/" replace />
  return <Navigate to={instanceAdminPath(instanceId, page)} replace />
}
