import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'

function resetRedirectTo() {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${basename}/reset-password`
}

export function ForgotPasswordPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetRedirectTo(),
    })
    setSubmitting(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We’ll email you a link to choose a new password"
      footer={
        <p>
          Remembered it?{' '}
          <Link
            className="font-semibold text-teal-700 underline decoration-teal-700/30 underline-offset-4"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-3 text-sm text-[var(--color-ink-muted)]">
          <p className="font-medium text-slate-700">Check your email</p>
          <p>
            If an account exists for <span className="font-medium text-slate-700">{email}</span>, we
            sent a password reset link. Open it to continue.
          </p>
          <Link
            className="inline-block font-semibold text-teal-700 underline decoration-teal-700/30 underline-offset-4"
            to="/login"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error ? <FieldError>{error}</FieldError> : null}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
