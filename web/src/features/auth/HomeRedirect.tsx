import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'

function extractInviteToken(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('invite')?.trim()
    if (fromQuery) return fromQuery
  } catch {
    /* plain token */
  }
  const match = trimmed.match(/[?&]invite=([^&#]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1]).trim()
  return trimmed
}

/**
 * Post-login landing:
 * - Superusers → organisations list
 * - Clients → their organisation chatbots (first membership)
 */
export function HomeRedirect() {
  const { user, isSuperuser, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [checkingInvites, setCheckingInvites] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupOrgName, setLookupOrgName] = useState<string | null>(null)

  const memberships = useQuery({
    queryKey: ['home-memberships', user?.id],
    enabled: !!user?.id && !isSuperuser && !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instance_members')
        .select('instance_id, instances(id, name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  async function onCheckInvites() {
    setCheckingInvites(true)
    setCheckMessage(null)
    setCheckError(null)
    const { error } = await supabase.rpc('claim_my_organisation_invites')
    if (error) {
      setCheckError(error.message)
      setCheckingInvites(false)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['home-memberships', user?.id] })
    const refreshed = await memberships.refetch()
    setCheckingInvites(false)
    if (refreshed.data?.some((m) => m.instance_id)) {
      setCheckMessage('Invite found — redirecting…')
      return
    }
    setCheckMessage('No pending invites match your account email.')
  }

  async function onLookupInvite(e: FormEvent) {
    e.preventDefault()
    const token = extractInviteToken(inviteInput)
    if (!token) {
      setLookupError('Paste an invite token or signup URL.')
      setLookupOrgName(null)
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    setLookupOrgName(null)
    const { data, error: rpcError } = await supabase.rpc('lookup_organisation_invite', {
      p_token: token,
    })
    setLookupLoading(false)
    if (rpcError) {
      setLookupError(rpcError.message)
      return
    }
    if (!data || typeof data !== 'object') {
      setLookupError('This invite is invalid or has already been used.')
      return
    }
    const invite = data as { organisation_name?: string | null }
    setLookupOrgName(invite.organisation_name ?? 'an organisation')
  }

  if (authLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
  }

  if (isSuperuser) {
    return <Navigate to="/instances" replace />
  }

  if (memberships.isLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
  }

  const first = memberships.data?.[0]
  if (first?.instance_id) {
    return <Navigate to={`/instances/${first.instance_id}`} replace />
  }

  return (
    <Card className="ff-page-enter mx-auto max-w-lg space-y-5 border-dashed border-teal-300/50 bg-teal-50/30 text-center">
      <div>
        <h1 className="text-lg font-semibold">No organisation yet</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Your account is not linked to an organisation. Ask your FlowForge admin to invite you.
        </p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          If you were invited, sign in with the same email as the invite
          {user?.email ? (
            <>
              {' '}
              (<span className="font-medium text-slate-700">{user.email}</span>)
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="space-y-2">
        <Button type="button" onClick={onCheckInvites} disabled={checkingInvites}>
          {checkingInvites ? 'Checking…' : 'Check for invites'}
        </Button>
        {checkError ? <FieldError>{checkError}</FieldError> : null}
        {checkMessage ? <p className="text-sm text-teal-800">{checkMessage}</p> : null}
      </div>

      <form className="space-y-3 border-t border-teal-200/60 pt-5 text-left" onSubmit={onLookupInvite}>
        <div>
          <Label htmlFor="invite-token">Have an invite link or token?</Label>
          <Input
            id="invite-token"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="Paste invite URL or token"
            autoComplete="off"
          />
        </div>
        {lookupError ? <FieldError>{lookupError}</FieldError> : null}
        {lookupOrgName ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Invite for <span className="font-medium text-slate-700">{lookupOrgName}</span>. Invites
            are claimed automatically when your email matches. Ask an admin to re-invite this
            email: <span className="font-medium text-slate-700">{user?.email ?? 'your account'}</span>
          </p>
        ) : null}
        <Button type="submit" variant="secondary" className="w-full" disabled={lookupLoading}>
          {lookupLoading ? 'Looking up…' : 'Look up invite'}
        </Button>
      </form>

      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-teal-200/60 pt-4 text-xs text-[var(--color-ink-muted)]">
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
    </Card>
  )
}
