import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/shared/lib/supabase'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'
import { cn } from '@/shared/lib/utils'

export function SignupPage() {
  const { signUp, session, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')?.trim() ?? ''

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState<string | null>(null)
  const [inviteLocked, setInviteLocked] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    ;(async () => {
      setInviteLoading(true)
      setInviteError(null)
      const { data, error: rpcError } = await supabase.rpc('lookup_organisation_invite', {
        p_token: inviteToken,
      })
      if (cancelled) return
      setInviteLoading(false)
      if (rpcError) {
        setInviteError(rpcError.message)
        return
      }
      if (!data || typeof data !== 'object') {
        setInviteError('This invite link is invalid or has already been used.')
        return
      }
      const invite = data as {
        email?: string
        display_name?: string | null
        organisation_name?: string | null
      }
      if (!invite.email) {
        setInviteError('This invite link is invalid or has already been used.')
        return
      }
      setEmail(invite.email)
      if (invite.display_name) setDisplayName(invite.display_name)
      setOrgName(invite.organisation_name ?? null)
      setInviteLocked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  if (!loading && session) return <Navigate to="/" replace />

  if (!inviteToken) {
    return <Navigate to="/login" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!inviteToken || inviteError) return
    setSubmitting(true)
    setError(null)
    const result = await signUp(email, password, displayName)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/')
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 ff-mesh" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-orange-300/15 blur-3xl" />

      <div className="ff-page-enter relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ff-brand-mark text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            <span className="ff-gradient-text">FlowForge</span>
          </p>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            {orgName ? (
              <>
                Join <span className="font-medium text-slate-700">{orgName}</span>
              </>
            ) : inviteLoading ? (
              'Checking your invite…'
            ) : (
              'Create your account from an invite'
            )}
          </p>
        </div>
        <Card className="border-white/70 p-6 shadow-[var(--shadow-lift)]">
          {inviteLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading invite…</p>
          ) : inviteError ? (
            <div className="space-y-4">
              <FieldError>{inviteError}</FieldError>
              <p className="text-sm text-[var(--color-ink-muted)]">
                Ask your organisation admin to send a new invite link.
              </p>
              <Link to="/login" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
                Go to sign in
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  readOnly={inviteLocked}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create account & join'}
              </Button>
            </form>
          )}
        </Card>
        <div className="mt-5 text-center text-sm text-[var(--color-ink-muted)]">
          <p>
            Already have an account?{' '}
            <Link
              className="font-semibold text-teal-700 underline decoration-teal-700/30 underline-offset-4"
              to="/login"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            <Link className="hover:text-teal-800" to="/help">
              Help
            </Link>
            <span className="text-[var(--color-border)]">·</span>
            <Link className="hover:text-teal-800" to="/docs">
              Docs
            </Link>
            <span className="text-[var(--color-border)]">·</span>
            <Link className="hover:text-teal-800" to="/faq">
              FAQ
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
