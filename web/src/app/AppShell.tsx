import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { CircleHelp, LogOut, Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { SuperuserBadge } from '@/shared/ui/superuser-badge'
import { InitialsAvatar } from '@/shared/ui/initials-avatar'
import { useInstanceContext } from '@/features/instances/InstanceContext'
import { canAdmin } from '@/shared/types/database'
import { cn } from '@/shared/lib/utils'

export function AppShell() {
  const { profile, user, isSuperuser, signOut } = useAuth()
  const ctx = useInstanceContext()
  const location = useLocation()
  const homeTo = isSuperuser ? '/instances' : ctx?.instance ? `/instances/${ctx.instance.id}` : '/'
  const profileActive = location.pathname === '/profile'
  const label = profile?.display_name ?? profile?.email ?? 'Profile'

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-white/50 bg-white/70 shadow-[0_8px_30px_-18px_rgb(15_23_42_/_0.35)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link to={homeTo} className="group flex shrink-0 items-center gap-2.5">
              <span className="ff-brand-mark grid h-9 w-9 place-items-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                <span className="ff-gradient-text">FlowForge</span>
              </span>
            </Link>
            <InstanceHeaderBits />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <InstanceNav />
            <Link
              to="/help"
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-white/80 hover:text-teal-900"
              title="Help"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="hidden lg:inline">Help</span>
            </Link>
            <Link
              to="/profile"
              className={cn(
                'flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition',
                profileActive
                  ? 'border-teal-300/80 bg-teal-50/90 shadow-sm'
                  : 'border-[var(--color-border)]/70 bg-white/60 hover:border-teal-300/60 hover:bg-white',
              )}
              title="Open profile"
            >
              <InitialsAvatar
                name={profile?.display_name}
                email={profile?.email ?? user?.email}
                seed={user?.id}
                size="sm"
              />
              <span className="hidden max-w-[120px] truncate text-sm text-[var(--color-ink-muted)] md:inline">
                {label}
              </span>
              {isSuperuser ? <SuperuserBadge compact className="hidden sm:inline-flex" /> : null}
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function InstanceHeaderBits() {
  const ctx = useInstanceContext()
  if (!ctx?.instance) return null
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-[var(--color-ink-muted)]/50">/</span>
      <Link
        to={`/instances/${ctx.instance.id}`}
        className="truncate rounded-lg px-1.5 py-0.5 font-medium transition hover:bg-teal-500/10 hover:text-teal-800"
      >
        {ctx.instance.name}
      </Link>
      {ctx.role ? <Badge>{ctx.role}</Badge> : null}
    </div>
  )
}

function InstanceNav() {
  const { instanceId } = useParams()
  const ctx = useInstanceContext()
  const location = useLocation()
  if (!instanceId || !ctx?.instance) return null

  const isAdmin = canAdmin(ctx.role)
  const links = [
    { to: `/instances/${instanceId}`, label: 'Chatbots', end: true },
    { to: `/instances/${instanceId}/connections`, label: 'Connections', end: false },
    { to: `/instances/${instanceId}/conversations`, label: 'Conversations', end: false },
    { to: `/instances/${instanceId}/analytics`, label: 'Analytics', end: false },
    { to: `/instances/${instanceId}/members`, label: 'Users', end: false },
    ...(isAdmin
      ? [
          { to: `/instances/${instanceId}/integrations`, label: 'Integrations', end: false },
          { to: `/instances/${instanceId}/audit`, label: 'Audit', end: false },
          { to: `/instances/${instanceId}/webhooks`, label: 'Webhooks', end: false },
          { to: `/instances/${instanceId}/usage`, label: 'Usage', end: false },
        ]
      : []),
  ]

  return (
    <nav className="hidden items-center gap-1 rounded-xl border border-[var(--color-border)]/70 bg-white/50 p-1 sm:flex">
      {links.map((link) => {
        const active = link.end
          ? location.pathname === link.to
          : location.pathname.startsWith(link.to)
        return (
          <Link
            key={link.to}
            to={link.to}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-sm'
                : 'text-[var(--color-ink-muted)] hover:bg-white hover:text-[var(--color-ink)] hover:shadow-sm',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
