import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X, Mail } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { useAuth } from '@/features/auth/AuthProvider'
import { canAdmin } from '@/shared/types/database'
import type { InstanceInvite, InstanceRole } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import {
  isFlowForgeApiConfigured,
  sendOrganisationInviteEmail,
} from '@/shared/lib/flowforgeApi'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Badge } from '@/shared/ui/badge'
import { SuperuserBadge } from '@/shared/ui/superuser-badge'
import { InitialsAvatar } from '@/shared/ui/initials-avatar'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'
import {
  BulkActionBar,
  matchesQuery,
  RowCheckbox,
  SearchField,
  setAllIds,
  toggleId,
} from '@/shared/ui/list-controls'

type MemberRow = {
  user_id: string
  role: InstanceRole
  display_name: string | null
  job_title: string | null
  phone: string | null
  department: string | null
  notes: string | null
  profiles: {
    email: string | null
    display_name: string | null
    is_superuser: boolean | null
  } | null
}

type MemberForm = {
  email: string
  display_name: string
  job_title: string
  phone: string
  department: string
  notes: string
  role: InstanceRole
}

const emptyForm = (): MemberForm => ({
  email: '',
  display_name: '',
  job_title: '',
  phone: '',
  department: '',
  notes: '',
  role: 'editor',
})

function inviteEmailLabel(inv: InstanceInvite): { label: string; tone: 'ok' | 'error' | 'pending' } {
  if (inv.email_sent_at) {
    return { label: 'Email sent', tone: 'ok' }
  }
  if (inv.email_last_error) {
    return { label: 'Email failed', tone: 'error' }
  }
  return { label: 'Not sent', tone: 'pending' }
}

function memberSelectable(m: MemberRow, selfId?: string | null): boolean {
  return m.role !== 'owner' && m.user_id !== selfId
}

export function MembersPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState<MemberForm>(emptyForm)
  const [open, setOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<{ message: string; tone: 'ok' | 'error' | 'info' } | null>(null)
  const [search, setSearch] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(() => new Set())
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(() => new Set())
  const [bulkRole, setBulkRole] = useState<InstanceRole>('editor')
  const isAdmin = canAdmin(role)

  const members = useQuery({
    queryKey: ['members', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_members')
        .select(
          'user_id, role, display_name, job_title, phone, department, notes, profiles(email, display_name, is_superuser)',
        )
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: true })
      if (qError) throw qError
      return ((data ?? []) as unknown as MemberRow[]).filter(
        (m) => !(m.profiles?.is_superuser && m.role === 'owner'),
      )
    },
  })

  const invites = useQuery({
    queryKey: ['member-invites', instance.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instance_invites')
        .select('*')
        .eq('instance_id', instance.id)
        .order('created_at', { ascending: false })
      if (qError) throw qError
      return data as InstanceInvite[]
    },
  })

  const filteredMembers = useMemo(() => {
    return (members.data ?? []).filter((m) =>
      matchesQuery(search, [
        m.display_name,
        m.profiles?.display_name,
        m.profiles?.email,
        m.job_title,
        m.department,
        m.phone,
        m.notes,
        m.role,
      ]),
    )
  }, [members.data, search])

  const filteredInvites = useMemo(() => {
    return (invites.data ?? []).filter((inv) =>
      matchesQuery(search, [
        inv.display_name,
        inv.email,
        inv.job_title,
        inv.department,
        inv.phone,
        inv.notes,
        inv.role,
      ]),
    )
  }, [invites.data, search])

  const selectableMemberIds = useMemo(
    () => filteredMembers.filter((m) => memberSelectable(m, user?.id)).map((m) => m.user_id),
    [filteredMembers, user?.id],
  )
  const filteredInviteIds = useMemo(() => filteredInvites.map((i) => i.id), [filteredInvites])

  const allMembersSelected =
    selectableMemberIds.length > 0 && selectableMemberIds.every((id) => selectedMembers.has(id))
  const allInvitesSelected =
    filteredInviteIds.length > 0 && filteredInviteIds.every((id) => selectedInvites.has(id))

  useEffect(() => {
    const validMembers = new Set((members.data ?? []).map((m) => m.user_id))
    setSelectedMembers((prev) => {
      const next = new Set<string>()
      for (const id of prev) if (validMembers.has(id)) next.add(id)
      return next
    })
  }, [members.data])

  useEffect(() => {
    const validInvites = new Set((invites.data ?? []).map((i) => i.id))
    setSelectedInvites((prev) => {
      const next = new Set<string>()
      for (const id of prev) if (validInvites.has(id)) next.add(id)
      return next
    })
  }, [invites.data])

  const saveMember = useMutation({
    mutationFn: async () => {
      if (editingUserId) {
        const { error: rpcError } = await supabase.rpc('update_organisation_member', {
          p_instance_id: instance.id,
          p_user_id: editingUserId,
          p_role: form.role,
          p_display_name: form.display_name,
          p_job_title: form.job_title,
          p_phone: form.phone,
          p_department: form.department,
          p_notes: form.notes,
        })
        if (rpcError) throw rpcError
        return { status: 'updated' as const }
      }

      const { data, error: rpcError } = await supabase.rpc('add_organisation_member', {
        p_instance_id: instance.id,
        p_email: form.email.trim().toLowerCase(),
        p_role: form.role,
        p_display_name: form.display_name.trim() || null,
        p_job_title: form.job_title.trim() || null,
        p_phone: form.phone.trim() || null,
        p_department: form.department.trim() || null,
        p_notes: form.notes.trim() || null,
      })
      if (rpcError) throw rpcError

      const result = data as { status?: string; invite_id?: string; email?: string }
      if (result?.status === 'invited' && result.invite_id) {
        if (!isFlowForgeApiConfigured()) {
          return {
            ...result,
            emailSent: false as const,
            emailError: 'API URL not configured',
          }
        }
        try {
          await sendOrganisationInviteEmail({ inviteId: result.invite_id })
          return { ...result, emailSent: true as const }
        } catch (err) {
          const emailError = err instanceof Error ? err.message : 'Failed to send invite email'
          return {
            ...result,
            emailSent: false as const,
            emailError,
          }
        }
      }
      return result
    },
    onSuccess: async (result) => {
      const status =
        result && typeof result === 'object' && 'status' in result ? result.status : null
      if (status === 'invited') {
        const emailSent = 'emailSent' in result && result.emailSent
        const emailError = 'emailError' in result ? String(result.emailError ?? '') : ''
        setInfo(
          emailSent
            ? {
                tone: 'ok',
                message: 'Invite created and email sent. They can create their account from the link.',
              }
            : {
                tone: 'error',
                message: `Invite saved, but email was not sent${emailError ? `: ${emailError}` : ''}. Use Resend on the pending invite to try again.`,
              },
        )
      } else if (status === 'updated') {
        setInfo({ tone: 'ok', message: 'User updated.' })
      } else {
        setInfo({ tone: 'ok', message: 'User added to the organisation.' })
      }
      resetForm()
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['members', instance.id] }),
        qc.invalidateQueries({ queryKey: ['member-invites', instance.id] }),
      ])
    },
    onError: (err: Error) => setError(err.message),
  })

  const resendInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      if (!isFlowForgeApiConfigured()) {
        throw new Error('VITE_FLOWFORGE_API_URL is not configured')
      }
      await sendOrganisationInviteEmail({ inviteId })
    },
    onSuccess: async () => {
      setInfo({ tone: 'ok', message: 'Invite email sent successfully.' })
      await qc.invalidateQueries({ queryKey: ['member-invites', instance.id] })
    },
    onError: async (err: Error) => {
      setInfo({ tone: 'error', message: `Invite email failed: ${err.message}` })
      setError(err.message)
      await qc.invalidateQueries({ queryKey: ['member-invites', instance.id] })
    },
  })

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await supabase.from('instance_invites').delete().eq('id', id)
      if (delError) throw delError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['member-invites', instance.id] })
    },
  })

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error: rpcError } = await supabase.rpc('remove_organisation_member', {
        p_instance_id: instance.id,
        p_user_id: userId,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: async () => {
      setInfo({ tone: 'ok', message: 'User removed from the organisation.' })
      if (editingUserId) resetForm()
      await qc.invalidateQueries({ queryKey: ['members', instance.id] })
    },
    onError: (err: Error) => {
      setInfo({ tone: 'error', message: err.message })
      setError(err.message)
    },
  })

  const bulkRemoveMembers = useMutation({
    mutationFn: async (userIds: string[]) => {
      const errors: string[] = []
      for (const userId of userIds) {
        const { error: rpcError } = await supabase.rpc('remove_organisation_member', {
          p_instance_id: instance.id,
          p_user_id: userId,
        })
        if (rpcError) errors.push(rpcError.message)
      }
      if (errors.length) throw new Error(errors[0] ?? 'Failed to remove some users')
    },
    onSuccess: async (_, userIds) => {
      setSelectedMembers(new Set())
      setInfo({
        tone: 'ok',
        message: `Removed ${userIds.length} user${userIds.length === 1 ? '' : 's'} from the organisation.`,
      })
      await qc.invalidateQueries({ queryKey: ['members', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  const bulkSetRole = useMutation({
    mutationFn: async ({ userIds, nextRole }: { userIds: string[]; nextRole: InstanceRole }) => {
      if (nextRole === 'owner') throw new Error('Cannot assign the owner role in bulk')
      const errors: string[] = []
      for (const userId of userIds) {
        const { error: rpcError } = await supabase.rpc('update_organisation_member', {
          p_instance_id: instance.id,
          p_user_id: userId,
          p_role: nextRole,
        })
        if (rpcError) errors.push(rpcError.message)
      }
      if (errors.length) throw new Error(errors[0] ?? 'Failed to update some roles')
    },
    onSuccess: async (_, { userIds, nextRole }) => {
      setSelectedMembers(new Set())
      setInfo({
        tone: 'ok',
        message: `Updated ${userIds.length} user${userIds.length === 1 ? '' : 's'} to ${nextRole}.`,
      })
      await qc.invalidateQueries({ queryKey: ['members', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  const bulkCancelInvites = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: delError } = await supabase.from('instance_invites').delete().in('id', ids)
      if (delError) throw delError
    },
    onSuccess: async (_, ids) => {
      setSelectedInvites(new Set())
      setInfo({
        tone: 'ok',
        message: `Cancelled ${ids.length} invite${ids.length === 1 ? '' : 's'}.`,
      })
      await qc.invalidateQueries({ queryKey: ['member-invites', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  const bulkResendInvites = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!isFlowForgeApiConfigured()) {
        throw new Error('VITE_FLOWFORGE_API_URL is not configured')
      }
      let sent = 0
      const errors: string[] = []
      for (const inviteId of ids) {
        try {
          await sendOrganisationInviteEmail({ inviteId })
          sent += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to send invite email'
          errors.push(message)
        }
      }
      if (!sent && errors.length) throw new Error(errors[0] ?? 'Failed to resend invites')
      return { sent, failed: errors.length }
    },
    onSuccess: async (result) => {
      setSelectedInvites(new Set())
      setInfo({
        tone: result.failed ? 'error' : 'ok',
        message: result.failed
          ? `Resent ${result.sent}, failed ${result.failed}.`
          : `Resent ${result.sent} invite email${result.sent === 1 ? '' : 's'}.`,
      })
      await qc.invalidateQueries({ queryKey: ['member-invites', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  function confirmRemoveMember(m: MemberRow) {
    if (!memberSelectable(m, user?.id)) return
    const name = m.display_name ?? m.profiles?.display_name ?? m.profiles?.email ?? 'this user'
    if (!window.confirm(`Remove ${name} from ${instance.name}? They will lose access immediately.`)) {
      return
    }
    removeMember.mutate(m.user_id)
  }

  function confirmBulkRemoveMembers() {
    const ids = [...selectedMembers]
    if (!ids.length) return
    if (
      !window.confirm(
        `Remove ${ids.length} user${ids.length === 1 ? '' : 's'} from ${instance.name}? They will lose access immediately.`,
      )
    ) {
      return
    }
    bulkRemoveMembers.mutate(ids)
  }

  function confirmBulkCancelInvites() {
    const ids = [...selectedInvites]
    if (!ids.length) return
    if (!window.confirm(`Cancel ${ids.length} pending invite${ids.length === 1 ? '' : 's'}?`)) {
      return
    }
    bulkCancelInvites.mutate(ids)
  }

  function resetForm() {
    setForm(emptyForm())
    setEditingUserId(null)
    setOpen(false)
    setError(null)
  }

  function startCreate() {
    setForm(emptyForm())
    setEditingUserId(null)
    setInfo(null)
    setError(null)
    setOpen(true)
  }

  function startEdit(m: MemberRow) {
    if (m.role === 'owner') return
    setForm({
      email: m.profiles?.email ?? '',
      display_name: m.display_name ?? m.profiles?.display_name ?? '',
      job_title: m.job_title ?? '',
      phone: m.phone ?? '',
      department: m.department ?? '',
      notes: m.notes ?? '',
      role: m.role,
    })
    setEditingUserId(m.user_id)
    setInfo(null)
    setError(null)
    setOpen(true)
  }

  function setField<K extends keyof MemberForm>(key: K, value: MemberForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    if (!editingUserId && !form.email.trim()) return
    saveMember.mutate()
  }

  const memberColSpan = isAdmin ? 6 : 4
  const bulkBusy =
    bulkRemoveMembers.isPending ||
    bulkSetRole.isPending ||
    bulkCancelInvites.isPending ||
    bulkResendInvites.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`People with access to ${instance.name}.`}
        actions={
          isAdmin ? (
            <Button onClick={() => (open && !editingUserId ? resetForm() : startCreate())}>
              <Plus className="h-4 w-4" />
              Add user
            </Button>
          ) : null
        }
      />

      {info ? (
        <p
          className={
            info.tone === 'ok'
              ? 'rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/80 px-3 py-2 text-sm text-[var(--color-accent)]'
              : info.tone === 'error'
                ? 'rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/80 px-3 py-2 text-sm text-[var(--color-danger)]'
                : 'rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-2)]/80 px-3 py-2 text-sm text-[var(--color-ink)]'
          }
          role="status"
        >
          {info.message}
        </p>
      ) : null}

      {open && isAdmin ? (
        <Card className="ff-page-enter border-[var(--color-accent)]/20">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                {editingUserId ? 'Edit user' : 'Add user'}
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="colleague@company.com"
                  required={!editingUserId}
                  disabled={!!editingUserId}
                />
                {!editingUserId ? (
                  <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    If they do not have an account yet, a pending invite is saved until they sign up.
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="member-name">Display name</Label>
                <Input
                  id="member-name"
                  value={form.display_name}
                  onChange={(e) => setField('display_name', e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label htmlFor="member-role">Access role</Label>
                <Select
                  id="member-role"
                  value={form.role}
                  onChange={(e) => setField('role', e.target.value as InstanceRole)}
                >
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="member-job">Job title</Label>
                <Input
                  id="member-job"
                  value={form.job_title}
                  onChange={(e) => setField('job_title', e.target.value)}
                  placeholder="Operations manager"
                />
              </div>
              <div>
                <Label htmlFor="member-dept">Department</Label>
                <Input
                  id="member-dept"
                  value={form.department}
                  onChange={(e) => setField('department', e.target.value)}
                  placeholder="Customer success"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="member-phone">Phone</Label>
                <Input
                  id="member-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+31 6 1234 5678"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="member-notes">Notes</Label>
                <Textarea
                  id="member-notes"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Internal notes about this person"
                  rows={3}
                />
              </div>
            </div>

            {error ? <FieldError>{error}</FieldError> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMember.isPending}>
                {saveMember.isPending
                  ? 'Saving…'
                  : editingUserId
                    ? 'Save changes'
                    : 'Add user'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <SearchField
        id="users-search"
        value={search}
        onChange={setSearch}
        placeholder="Search users and invites…"
      />

      {isAdmin && selectedMembers.size > 0 ? (
        <BulkActionBar count={selectedMembers.size} onClear={() => setSelectedMembers(new Set())}>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value as InstanceRole)}
              className="h-8 w-auto min-w-[7rem]"
              aria-label="Bulk role"
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() =>
                bulkSetRole.mutate({ userIds: [...selectedMembers], nextRole: bulkRole })
              }
            >
              Set role
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={bulkBusy}
              onClick={confirmBulkRemoveMembers}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        </BulkActionBar>
      ) : null}

      <Card className="overflow-x-auto p-0">
        {members.isError ? (
          <p className="px-5 py-4 text-sm text-[var(--color-danger)]">
            Could not load users:{' '}
            {members.error instanceof Error ? members.error.message : 'Unknown error'}
          </p>
        ) : null}
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-muted)]">
            <tr>
              {isAdmin ? (
                <th className="px-5 py-3 font-medium">
                  <RowCheckbox
                    checked={allMembersSelected}
                    onChange={(on) => setSelectedMembers(setAllIds(selectableMemberIds, on))}
                    label="Select all removable users"
                    className="mt-0"
                  />
                </th>
              ) : null}
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Job</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Role</th>
              {isAdmin ? <th className="px-5 py-3 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {members.isLoading ? (
              <tr>
                <td colSpan={memberColSpan} className="px-5 py-8 text-center text-[var(--color-ink-muted)]">
                  Loading users…
                </td>
              </tr>
            ) : null}
            {filteredMembers.map((m) => {
              const name = m.display_name ?? m.profiles?.display_name ?? 'User'
              const email = m.profiles?.email
              const isPlatformSuperuser = !!m.profiles?.is_superuser
              const canSelect = memberSelectable(m, user?.id)
              return (
                <tr key={m.user_id} className="border-b border-[var(--color-border)] last:border-0">
                  {isAdmin ? (
                    <td className="px-5 py-3 align-top">
                      {canSelect ? (
                        <RowCheckbox
                          checked={selectedMembers.has(m.user_id)}
                          onChange={(on) =>
                            setSelectedMembers((prev) => toggleId(prev, m.user_id, on))
                          }
                          label={`Select ${name}`}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-5 py-3 align-top">
                    <div className="flex items-start gap-3">
                      <InitialsAvatar
                        name={name}
                        email={email}
                        seed={m.user_id}
                        size="md"
                        title={name}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{name}</div>
                          {isPlatformSuperuser ? <SuperuserBadge /> : null}
                        </div>
                        <div className="text-xs text-[var(--color-ink-muted)]">{email}</div>
                        {m.notes ? (
                          <p className="mt-1 max-w-xs text-xs text-[var(--color-ink-muted)] line-clamp-2">
                            {m.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 align-top text-[var(--color-ink-muted)]">
                    <div>{m.job_title ?? '—'}</div>
                    {m.department ? <div className="text-xs">{m.department}</div> : null}
                  </td>
                  <td className="px-5 py-3 align-top text-[var(--color-ink-muted)]">
                    {m.phone ?? '—'}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <Badge>{m.role}</Badge>
                  </td>
                  {isAdmin ? (
                    <td className="px-5 py-3 align-top">
                      {canSelect ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${name}`}
                            onClick={() => startEdit(m)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${name}`}
                            disabled={removeMember.isPending}
                            onClick={() => confirmRemoveMember(m)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {!members.isLoading && !filteredMembers.length ? (
              <tr>
                <td colSpan={memberColSpan} className="px-5 py-8 text-center text-[var(--color-ink-muted)]">
                  {members.data?.length ? 'No users match your search.' : 'No users yet.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {isAdmin && (invites.data?.length || search) ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Pending invites</h2>
            {filteredInviteIds.length ? (
              <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                <RowCheckbox
                  checked={allInvitesSelected}
                  onChange={(on) => setSelectedInvites(setAllIds(filteredInviteIds, on))}
                  label="Select all visible invites"
                  className="mt-0"
                />
                Select all
              </label>
            ) : null}
          </div>

          {selectedInvites.size > 0 ? (
            <BulkActionBar count={selectedInvites.size} onClear={() => setSelectedInvites(new Set())}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={bulkBusy}
                onClick={() => bulkResendInvites.mutate([...selectedInvites])}
              >
                <Mail className="h-4 w-4" />
                Resend
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={bulkBusy}
                onClick={confirmBulkCancelInvites}
              >
                <Trash2 className="h-4 w-4" />
                Cancel invites
              </Button>
            </BulkActionBar>
          ) : null}

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium" />
                  <th className="px-5 py-3 font-medium">Invite</th>
                  <th className="px-5 py-3 font-medium">Job</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((inv) => {
                  const emailStatus = inviteEmailLabel(inv)
                  return (
                    <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-3 align-top">
                        <RowCheckbox
                          checked={selectedInvites.has(inv.id)}
                          onChange={(on) =>
                            setSelectedInvites((prev) => toggleId(prev, inv.id, on))
                          }
                          label={`Select invite ${inv.email}`}
                        />
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <InitialsAvatar
                            name={inv.display_name}
                            email={inv.email}
                            seed={inv.id}
                            size="md"
                            title={inv.display_name ?? inv.email}
                          />
                          <div className="min-w-0">
                            <div className="font-medium">{inv.display_name ?? inv.email}</div>
                            <div className="text-xs text-[var(--color-ink-muted)]">{inv.email}</div>
                            {inv.phone ? (
                              <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                                {inv.phone}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top text-[var(--color-ink-muted)]">
                        <div>{inv.job_title ?? '—'}</div>
                        {inv.department ? <div className="text-xs">{inv.department}</div> : null}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <Badge>{inv.role}</Badge>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <Badge
                          className={
                            emailStatus.tone === 'ok'
                              ? undefined
                              : emailStatus.tone === 'error'
                                ? 'from-[var(--color-danger)]/15 to-rose-500/10 text-[var(--color-danger)] ring-rose-600/15'
                                : 'from-amber-500/15 to-amber-500/10 text-[var(--color-warning)] ring-amber-600/15'
                          }
                          title={
                            inv.email_sent_at
                              ? `Sent ${new Date(inv.email_sent_at).toLocaleString()}`
                              : (inv.email_last_error ?? undefined)
                          }
                        >
                          {emailStatus.label}
                        </Badge>
                        {inv.email_last_error && !inv.email_sent_at ? (
                          <p className="mt-1 max-w-[14rem] text-[11px] text-[var(--color-danger)]/90 line-clamp-2">
                            {inv.email_last_error}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Resend invite to ${inv.email}`}
                            disabled={resendInvite.isPending}
                            onClick={() => resendInvite.mutate(inv.id)}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Cancel invite for ${inv.email}`}
                            disabled={removeInvite.isPending}
                            onClick={() => removeInvite.mutate(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!filteredInvites.length ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[var(--color-ink-muted)]">
                      {invites.data?.length
                        ? 'No invites match your search.'
                        : 'No pending invites.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
