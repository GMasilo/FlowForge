import { Link, NavLink, Outlet } from 'react-router-dom'
import { BookOpen, CircleHelp, LifeBuoy, Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { buttonVariants } from '@/shared/ui/button'
import { ThemeToggle } from '@/shared/ui/theme-toggle'
import { cn } from '@/shared/lib/utils'

const NAV = [
  { to: '/docs', label: 'Docs', icon: BookOpen },
  { to: '/faq', label: 'FAQ', icon: CircleHelp },
  { to: '/help', label: 'Help', icon: LifeBuoy },
] as const

export function PublicShell() {
  const { session, loading } = useAuth()
  const signedIn = !loading && !!session

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)]/50 bg-[var(--color-surface)]/70 shadow-[var(--shadow-soft)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2.5">
          <Link to={signedIn ? '/' : '/login'} className="group flex shrink-0 items-center gap-2.5">
            <span className="ff-brand-mark grid h-9 w-9 place-items-center rounded-xl text-white transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              <span className="ff-gradient-text">FlowForge</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/50 p-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)] shadow-sm'
                      : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] hover:shadow-sm',
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {signedIn ? (
              <Link to="/" className={buttonVariants({ size: 'sm' })}>
                Open app
              </Link>
            ) : (
              <Link to="/login" className={buttonVariants({ size: 'sm' })}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent_65%)]" />
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)]/50 bg-[var(--color-surface)]/40 py-6 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-[var(--color-ink-muted)]">
          <p>
            <span className="ff-gradient-text font-[family-name:var(--font-display)] font-semibold">FlowForge</span>
            <span className="mx-2 text-[var(--color-border)]">·</span>
            Build conversational flows with confidence
          </p>
          <div className="flex flex-wrap gap-4">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-[var(--color-accent)]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
