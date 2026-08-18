import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      if (data.session) {
        setHasRecoverySession(true)
        setChecking(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(!!session)
        setChecking(false)
      } else if (!session) {
        setHasRecoverySession(false)
        setChecking(false)
      }
    })

    const timeout = window.setTimeout(() => {
      if (mounted) setChecking(false)
    }, 2500)

    return () => {
      mounted = false
      window.clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Complete the reset for your FlowForge account"
      footer={
        <p>
          <Link
            className="font-semibold text-teal-700 underline decoration-teal-700/30 underline-offset-4"
            to="/login"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      {checking ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Verifying reset link…</p>
      ) : !hasRecoverySession ? (
        <div className="space-y-4">
          <FieldError>
            This reset link is invalid or has expired. Request a new password reset email.
          </FieldError>
          <Link
            className="inline-block font-semibold text-teal-700 underline decoration-teal-700/30 underline-offset-4"
            to="/forgot-password"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
