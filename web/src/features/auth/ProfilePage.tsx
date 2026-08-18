import { useEffect, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'
import { InitialsAvatar } from '@/shared/ui/initials-avatar'
import { SuperuserBadge } from '@/shared/ui/superuser-badge'

export function ProfilePage() {
  const { user, profile, isSuperuser, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
  }, [profile?.display_name])

  const save = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not signed in')
      const next = displayName.trim()
      if (!next) throw new Error('Display name is required')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: next })
        .eq('id', user.id)
      if (updateError) throw updateError
    },
    onSuccess: async () => {
      setError(null)
      setInfo('Profile saved.')
      await refreshProfile()
    },
    onError: (err: Error) => {
      setInfo(null)
      setError(err.message)
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const name = profile?.display_name ?? user?.email ?? 'Your profile'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile" description="Your FlowForge account details." />

      <Card className="ff-page-enter overflow-hidden border-teal-200/50 p-0">
        <div className="relative border-b border-[var(--color-border)] bg-gradient-to-br from-teal-50/80 via-white to-cyan-50/60 px-6 py-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/15 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <InitialsAvatar
              name={profile?.display_name}
              email={profile?.email ?? user?.email}
              seed={user?.id}
              size="xl"
              title={name}
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900">
                  {name}
                </h2>
                {isSuperuser ? <SuperuserBadge /> : null}
              </div>
              <p className="truncate text-sm text-[var(--color-ink-muted)]">
                {profile?.email ?? user?.email}
              </p>
            </div>
          </div>
        </div>

        <form className="space-y-4 px-6 py-6" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={profile?.email ?? user?.email ?? ''}
              readOnly
              disabled
            />
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              Email comes from your sign-in account and cannot be changed here.
            </p>
          </div>
          <div>
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
              maxLength={80}
            />
          </div>

          {error ? <FieldError>{error}</FieldError> : null}
          {info ? (
            <p className="rounded-xl border border-teal-200/80 bg-teal-50/80 px-3 py-2 text-sm text-teal-900" role="status">
              {info}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
