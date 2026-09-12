import { useAuth } from '@/features/auth/AuthProvider'
import { HomeRedirect } from '@/features/auth/HomeRedirect'
import { AppShell } from '@/app/AppShell'
import { PublicShell } from '@/features/docs/PublicShell'
import { LandingPage } from '@/features/landing/LandingPage'

function LoadingScreen() {
  return (
    <div className="flex min-h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
      Loading…
    </div>
  )
}

/**
 * `/` serves the public landing page when signed out, and the authenticated home when signed in.
 */
export function RootPage() {
  const { session, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!session) {
    return (
      <PublicShell>
        <LandingPage />
      </PublicShell>
    )
  }

  return (
    <AppShell>
      <HomeRedirect />
    </AppShell>
  )
}
