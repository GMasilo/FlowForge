import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'

export function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/')
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Design conversational flows for your organisations"
      footer={
        <>
          <p>
            Need an account? Ask your organisation admin for an invite link.
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            <Link className="hover:text-[var(--color-accent)]" to="/help">
              Help
            </Link>
            <span className="text-[var(--color-border)]">·</span>
            <Link className="hover:text-[var(--color-accent)]" to="/docs">
              Docs
            </Link>
            <span className="text-[var(--color-border)]">·</span>
            <Link className="hover:text-[var(--color-accent)]" to="/faq">
              FAQ
            </Link>
          </p>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              className="text-xs font-medium text-[var(--color-accent)] hover:opacity-90"
              to="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
