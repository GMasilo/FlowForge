import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { ChevronDown, CircleHelp, LogOut, Shield, Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { SuperuserBadge } from '@/shared/ui/superuser-badge'
import { InitialsAvatar } from '@/shared/ui/initials-avatar'
import { ThemeToggle } from '@/shared/ui/theme-toggle'
import { NotificationsBell } from '@/features/notifications/NotificationsBell'
import { useInstanceContext } from '@/features/instances/InstanceContext'
import { brandLogoUrl, brandWorkspaceTitle } from '@/shared/lib/instanceBranding'
import { canAdmin, instanceFeatureEnabled, isAgentRole } from '@/shared/types/database'
import { cn } from '@/shared/lib/utils'

export function AppShell({ children }: { children?: ReactNode }) {
  const { profile, user, isSuperuser, signOut } = useAuth()
  const ctx = useInstanceContext()
  const location = useLocation()
  const homeTo = isSuperuser ? '/instances' : ctx?.instance ? `/instances/${ctx.instance.id}` : '/'
  const profileActive = location.pathname === '/profile'
  const label = profile?.display_name ?? profile?.email ?? 'Profile'
  const workspaceTitle = ctx?.instance ? brandWorkspaceTitle(ctx.instance) : 'FlowForge'
  const logoUrl = ctx?.instance ? brandLogoUrl(ctx.instance) : null

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)]/40 bg-[var(--color-surface)]/75 shadow-[0_8px_30px_-18px_rgb(15_23_42_/_0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[var(--color-surface)]/65">
        <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5">
            <Link to={homeTo} className="group flex shrink-0 items-center gap-2.5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-9 w-9 rounded-xl object-contain ring-1 ring-[var(--color-border)]/60 transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-105"
                />
              ) : (
                <span className="ff-brand-mark grid h-9 w-9 place-items-center rounded-xl text-white transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-105 group-hover:rotate-3">
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
              <span className="hidden font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:inline">
                <span className="ff-gradient-text">{workspaceTitle}</span>
              </span>
            </Link>
            <InstanceHeaderBits />
          </div>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            {isSuperuser ? <SuperuserAdminNav pathname={location.pathname} /> : null}
            <InstanceNav />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-3">
            <NotificationsBell />
            <ThemeToggle />
            <Link
              to="/help"
              className="ff-interactive inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm"
              title="Help"
            >
              <CircleHelp className="h-4 w-4" />
              <span className="hidden lg:inline">Help</span>
            </Link>
            <Link
              to="/privacy"
              className="ff-interactive hidden items-center rounded-xl px-2 py-1.5 text-sm font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm sm:inline-flex"
              title="Privacy Policy"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden xl:inline">Privacy</span>
            </Link>
            <Link
              to="/profile"
              className={cn(
                'ff-interactive flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5',
                profileActive
                  ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/90 shadow-sm'
                  : 'border-[var(--color-border)]/70 bg-[var(--color-surface)]/60 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] hover:shadow-sm',
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
        {ctx?.instance || isSuperuser ? (
          <div className="border-t border-[var(--color-border)]/40 px-4 py-2 md:hidden">
            {isSuperuser ? <SuperuserAdminNav pathname={location.pathname} /> : null}
            <InstanceNav />
          </div>
        ) : null}
      </header>
      <main
        key={location.pathname}
        className="ff-page-enter mx-auto w-full max-w-7xl flex-1 px-4 py-8"
      >
        {children ?? <Outlet />}
      </main>
    </div>
  )
}

type NavLinkItem = { to: string; label: string; end?: boolean }

function SuperuserAdminNav({ pathname }: { pathname: string }) {
  return (
    <nav className="mb-2 inline-flex max-w-full items-center gap-1 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/60 p-1 shadow-sm backdrop-blur-md md:mb-0 md:mr-2">
      <NavPill link={{ to: '/admin/platform', label: 'Platform' }} pathname={pathname} />
    </nav>
  )
}

function InstanceHeaderBits() {
  const ctx = useInstanceContext()
  if (!ctx?.instance) return null
  return (
    <div className="flex min-w-0 max-w-[12rem] items-center gap-1.5 text-sm sm:max-w-[16rem] md:max-w-[20rem]">
      <span className="shrink-0 text-[var(--color-ink-muted)]/50">/</span>
      <Link
        to={`/instances/${ctx.instance.id}`}
        title={ctx.instance.name}
        className="ff-interactive min-w-0 truncate rounded-lg px-1.5 py-0.5 font-medium hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
      >
        {ctx.instance.name}
      </Link>
      {ctx.role ? <Badge className="shrink-0">{ctx.role}</Badge> : null}
    </div>
  )
}

function InstanceNav() {
  const { instanceId } = useParams()
  const ctx = useInstanceContext()
  const location = useLocation()
  if (!instanceId || !ctx?.instance) return null

  const isAdmin = canAdmin(ctx.role)
  const agentOnly = isAgentRole(ctx.role)
  const base = `/instances/${instanceId}`
  const inst = ctx.instance
  const has = (flag: Parameters<typeof instanceFeatureEnabled>[1]) => instanceFeatureEnabled(inst, flag)

  // Editors/viewers: builder-focused primary nav (no Agent console — that stays under Admin).
  const primaryLinks: NavLinkItem[] = agentOnly
    ? [
        { to: `${base}/inbox`, label: 'Inbox' },
        { to: `${base}/conversations`, label: 'Conversations' },
      ]
    : [
        { to: base, label: 'Chatbots', end: true },
        { to: `${base}/connections`, label: 'Connections' },
        { to: `${base}/conversations`, label: 'Conversations' },
        { to: `${base}/inbox`, label: 'Inbox' },
        ...(isAdmin && has('agent_console') ? [{ to: `${base}/agent`, label: 'Agent console' }] : []),
        { to: `${base}/analytics`, label: 'Analytics' },
        ...(has('marketplace') ? [{ to: `${base}/marketplace`, label: 'Marketplace' }] : []),
      ]

  const adminLinks: NavLinkItem[] = [
    { to: `${base}/admin`, label: 'Overview', end: true },
    { to: `${base}/admin/chatbots`, label: 'Chatbots' },
    { to: `${base}/admin/users`, label: 'Users' },
    { to: `${base}/admin/recycle-bin`, label: 'Recycle bin' },
    { to: `${base}/admin/settings`, label: 'Organisation' },
    ...(has('compliance') ? [{ to: `${base}/admin/compliance`, label: 'Compliance' }] : []),
    { to: `${base}/admin/security`, label: 'Security' },
    ...(has('agent_console') ? [{ to: `${base}/agent`, label: 'Agent console' }] : []),
    ...(has('integrations') ? [{ to: `${base}/integrations`, label: 'Integrations' }] : []),
    { to: `${base}/admin/usage`, label: 'Usage' },
    ...(has('webhooks') ? [{ to: `${base}/admin/webhooks`, label: 'Webhooks' }] : []),
    { to: `${base}/admin/audit`, label: 'Audit' },
    ...(has('alerts') ? [{ to: `${base}/alerts`, label: 'Alerts' }] : []),
  ]

  return (
    <nav className="inline-flex max-w-full items-center gap-1 rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/60 p-1 shadow-sm backdrop-blur-md">
      <div className="inline-flex min-w-0 items-center gap-1 overflow-x-auto">
        {primaryLinks.map((link) => (
          <NavPill key={link.to} link={link} pathname={location.pathname} />
        ))}
      </div>

      {agentOnly ? null : isAdmin ? (
        <AdminNavMenu links={adminLinks} pathname={location.pathname} />
      ) : null}
    </nav>
  )
}

function NavPill({ link, pathname }: { link: NavLinkItem; pathname: string }) {
  const active = link.end ? pathname === link.to : pathname.startsWith(link.to)
  return (
    <Link
      to={link.to}
      className={cn(
        'ff-interactive shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium ring-1 ring-transparent',
        active
          ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-[var(--shadow-lift)] ring-[var(--color-accent)]/25'
          : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-md hover:ring-[var(--color-border)]',
      )}
    >
      {link.label}
    </Link>
  )
}

function AdminNavMenu({ links, pathname }: { links: NavLinkItem[]; pathname: string }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const adminActive = links.some((l) => pathname.startsWith(l.to))

  const updatePosition = () => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = 176
    const padding = 8
    let left = rect.left
    if (left + menuWidth > window.innerWidth - padding) {
      left = Math.max(padding, rect.right - menuWidth)
    }
    setCoords({ top: rect.bottom + 6, left })
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    updatePosition()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onScrollOrResize() {
      updatePosition()
    }
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const menu =
    open && coords
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Admin"
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 100 }}
            className="min-w-[11rem] animate-[ff-fade-in_0.16s_ease_both] overflow-hidden rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/95 p-1 shadow-[var(--shadow-soft)] backdrop-blur-xl"
          >
            {links.map((link) => {
              const active = link.end ? pathname === link.to : pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  role="menuitem"
                  to={link.to}
                  className={cn(
                    'ff-interactive block rounded-lg px-3 py-2 text-sm font-medium',
                    active
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'ff-interactive inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium',
          adminActive || open
            ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-sm'
            : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm',
        )}
      >
        <Shield className="h-3.5 w-3.5" aria-hidden />
        Admin
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200 ease-[var(--ease-spring)]', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  )
}
