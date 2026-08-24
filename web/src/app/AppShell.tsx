import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { ChevronDown, CircleHelp, LogOut, Shield, Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { SuperuserBadge } from '@/shared/ui/superuser-badge'
import { InitialsAvatar } from '@/shared/ui/initials-avatar'
import { ThemeToggle } from '@/shared/ui/theme-toggle'
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
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)]/50 bg-[var(--color-surface)]/70 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5">
            <Link to={homeTo} className="group flex shrink-0 items-center gap-2.5">
              <span className="ff-brand-mark grid h-9 w-9 place-items-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="hidden font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight sm:inline">
                <span className="ff-gradient-text">FlowForge</span>
              </span>
            </Link>
            <InstanceHeaderBits />
          </div>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <InstanceNav />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/help"
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
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
                  ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/90 shadow-sm'
                  : 'border-[var(--color-border)]/70 bg-[var(--color-surface)]/60 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]',
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
        {ctx?.instance ? (
          <div className="border-t border-[var(--color-border)]/40 px-4 py-2 md:hidden">
            <InstanceNav />
          </div>
        ) : null}
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
    <div className="flex min-w-0 max-w-[12rem] items-center gap-1.5 text-sm sm:max-w-[16rem] md:max-w-[20rem]">
      <span className="shrink-0 text-[var(--color-ink-muted)]/50">/</span>
      <Link
        to={`/instances/${ctx.instance.id}`}
        title={ctx.instance.name}
        className="min-w-0 truncate rounded-lg px-1.5 py-0.5 font-medium transition hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
      >
        {ctx.instance.name}
      </Link>
      {ctx.role ? <Badge className="shrink-0">{ctx.role}</Badge> : null}
    </div>
  )
}

type NavLinkItem = { to: string; label: string; end?: boolean }

function InstanceNav() {
  const { instanceId } = useParams()
  const ctx = useInstanceContext()
  const location = useLocation()
  if (!instanceId || !ctx?.instance) return null

  const isAdmin = canAdmin(ctx.role)
  const base = `/instances/${instanceId}`

  const primaryLinks: NavLinkItem[] = [
    { to: base, label: 'Chatbots', end: true },
    { to: `${base}/connections`, label: 'Connections' },
    { to: `${base}/conversations`, label: 'Conversations' },
    { to: `${base}/analytics`, label: 'Analytics' },
  ]

  const adminLinks: NavLinkItem[] = [
    { to: `${base}/members`, label: 'Users' },
    { to: `${base}/integrations`, label: 'Integrations' },
    { to: `${base}/audit`, label: 'Audit' },
    { to: `${base}/webhooks`, label: 'Webhooks' },
    { to: `${base}/usage`, label: 'Usage' },
    { to: `${base}/alerts`, label: 'Alerts' },
  ]

  return (
    <nav className="inline-flex max-w-full items-center gap-1 rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/50 p-1">
      <div className="inline-flex min-w-0 items-center gap-1 overflow-x-auto">
        {primaryLinks.map((link) => (
          <NavPill key={link.to} link={link} pathname={location.pathname} />
        ))}
      </div>

      {isAdmin ? (
        <AdminNavMenu links={adminLinks} pathname={location.pathname} />
      ) : (
        <NavPill link={{ to: `${base}/members`, label: 'Users' }} pathname={location.pathname} />
      )}
    </nav>
  )
}

function NavPill({ link, pathname }: { link: NavLinkItem; pathname: string }) {
  const active = link.end ? pathname === link.to : pathname.startsWith(link.to)
  return (
    <Link
      to={link.to}
      className={cn(
        'shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-200',
        active
          ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-sm'
          : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm',
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
            className="min-w-[11rem] overflow-hidden rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)] p-1 shadow-[var(--shadow-soft)]"
          >
            {links.map((link) => {
              const active = pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  role="menuitem"
                  to={link.to}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm font-medium transition',
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
          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-200',
          adminActive || open
            ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-sm'
            : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm',
        )}
      >
        <Shield className="h-3.5 w-3.5" aria-hidden />
        Admin
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  )
}
