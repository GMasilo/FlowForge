import { useState } from 'react'
import { Check, Copy, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/shared/ui/button'

export function PlatformApiTokenCard() {
  const { session } = useAuth()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const token = session?.access_token ?? ''

  async function copyToken() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      setCopyError(false)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopyError(true)
    }
  }

  if (!session) {
    return (
      <div className="rounded-xl border border-dashed border-teal-300/70 bg-teal-50/50 px-4 py-3 text-sm text-slate-700">
        <p>
          For integrations and service accounts, organisation owners create a long-lived{' '}
          <code className="rounded bg-white/80 px-1.5 py-0.5 text-[13px]">ffpat_</code> token on Admin →
          Security. Sign in to copy a short-lived session JWT for a quick Postman test.
        </p>
        <Link
          to="/login"
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:underline"
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-teal-200/70 bg-teal-50/60 px-4 py-3">
      <p className="text-sm text-slate-700">
        Service accounts should use a long-lived token from{' '}
        <strong>Admin → Security</strong> (<code className="rounded bg-white/80 px-1.5 py-0.5 text-[13px]">ffpat_…</code>
        ). This button copies your current session JWT for a quick try — it expires.
      </p>
      <Button type="button" size="sm" variant="secondary" className="gap-2" onClick={() => void copyToken()}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy session JWT'}
      </Button>
      {copyError ? (
        <p className="text-xs text-rose-700">Clipboard was blocked. Copy the token from the browser session instead.</p>
      ) : null}
    </div>
  )
}
