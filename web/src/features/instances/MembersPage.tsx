import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Pencil, Plus, Trash2, X, Mail } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { useAuth } from '@/features/auth/AuthProvider'
import { canAdmin } from '@/shared/types/database'
import type { InstanceRole } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import {
  inviteOrganisationMember,
  isFlowForgeApiConfigured,
  resendOrganisationInvite,
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

type OrgUserRow = {
  kind: 'member' | 'invite'
  status: 'active' | 'pending'
  id: string
  user_id: string | null
  invite_id: string | null
  email: string | null
  display_name: string | null
  role: InstanceRole
  job_title: string | null
  phone: string | null
  department: string | null
  notes: string | null
  is_superuser: boolean
  email_sent_at: string | null
  email_last_error: string | null
  token: string | null
  last_sign_in_at: string | null
  created_at: string
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

function inviteSignupUrl(token: string): string {
  const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
  return `${window.location.origin}${basename}/signup?invite=${encodeURIComponent(token)}`
}

function rowKey(row: OrgUserRow): string {
  return `${row.kind}:${row.id}`
}

function memberSelectable(row: OrgUserRow, selfId?: string | null): boolean {
  return row.kind === 'member' && row.role !== 'owner' && row.user_id !== selfId
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkRole, setBulkRole] = useState<InstanceRole>('editor')
  const apiConfigured = isFlowForgeApiConfigured()
  const isAdmin = canAdmin(role)

  const users = useQuery({
    queryKey: ['organisation-users', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase.rpc('list_organisation_users', {
        p_instance_id: instance.id,
      })
      if (qError) throw qError
      const rows = (Array.isArray(data) ? data : []) as OrgUserRow[]
      return rows
    },
  })

  const filteredUsers = useMemo(() => {
    return (users.data ?? []).filter((row) =>
      matchesQuery(search, [
        row.display_name,
        row.email,
        row.job_title,
        row.department,
        row.phone,
        row.notes,
        row.role,
        row.status,
      ]),
    )
  }, [users.data, search])

  const selectableKeys = useMemo(
    () =>
      filteredUsers
        .filter((row) => {
          if (row.kind === 'invite') return isAdmin
          return memberSelectable(row, user?.id)
        })
        .map(rowKey),
    [filteredUsers, isAdmin, user?.id],
  )

  const allSelected =
    selectableKeys.length > 0 && selectableKeys.every((key) => selected.has(key))

  useEffect(() => {
    const valid = new Set((users.data ?? []).map(rowKey))
    setSelected((prev) => {
      const next = new Set<string>()
      for (const id of prev) if (valid.has(id)) next.add(id)
      return next
    })
  }, [users.data])

  const selectedActiveUserIds = useMemo(() => {
    const ids: string[] = []
    for (const row of users.data ?? []) {
      if (row.kind === 'member' && selected.has(rowKey(row)) && row.user_id) {
        ids.push(row.user_id)
      }
    }
    return ids
  }, [selected, users.data])

  const selectedPending = useMemo(() => {
    return (users.data ?? []).filter(
      (row) => row.status === 'pending' && selected.has(rowKey(row)),
    )
  }, [selected, users.data])

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

      if (!apiConfigured) {
        throw new Error(
          'VITE_FLOWFORGE_API_URL is not configured. Invitation emails are sent through the FlowForge API.',
        )
      }

      const result = await inviteOrganisationMember({
        instanceId: instance.id,
        email: form.email.trim().toLowerCase(),
        role: form.role,
        displayName: form.display_name.trim() || null,
        jobTitle: form.job_title.trim() || null,
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        notes: form.notes.trim() || null,
        sendEmail: true,
      })

      if (!result.ok && result.error) {
        throw new Error(result.error)
      }

      return result
    },
    onSuccess: async (result) => {
      const status =
        result && typeof result === 'object' && 'status' in result ? result.status : null
      if (status === 'invited') {
        const emailSent = 'email_sent' in result && result.email_sent
        const emailSkipped = 'email_skipped' in result && result.email_skipped
        const emailError =
          'email_error' in result && result.email_error ? String(result.email_error) : ''
        setInfo(
          emailSent
            ? {
                tone: 'ok',
                message:
                  'User added as Pending and invitation email sent. They become Active after signing in.',
              }
            : emailSkipped
              ? {
                  tone: 'info',
                  message: 'User saved as Pending without sending email.',
                }
              : {
                  tone: 'error',
                  message: `User saved as Pending, but the invitation email was not sent${
                    emailError ? `: ${emailError}` : ''
                  }. Use Resend invite to try again.`,
                },
        )
      } else if (status === 'updated') {
        setInfo({ tone: 'ok', message: 'User updated.' })
      } else if (status === 'added') {
        setInfo({
          tone: 'ok',
          message: 'Existing account added to the organisation (Active).',
        })
      } else {
        setInfo({ tone: 'ok', message: 'User saved.' })
      }
      resetForm()
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const resendInvite = useMutation({
    mutationFn: async (row: OrgUserRow) => {
      if (!apiConfigured) {
        throw new Error('VITE_FLOWFORGE_API_URL is not configured')
      }
      await resendOrganisationInvite({
        inviteId: row.invite_id ?? undefined,
        instanceId: instance.id,
        userId: row.user_id ?? undefined,
        email: row.email ?? undefined,
      })
    },
    onSuccess: async () => {
      setInfo({ tone: 'ok', message: 'Invitation email resent.' })
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
    },
    onError: async (err: Error) => {
      setInfo({ tone: 'error', message: `Invite email failed: ${err.message}` })
      setError(err.message)
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
    },
  })

  const removeInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error: delError } = await supabase.from('instance_invites').delete().eq('id', id)
      if (delError) throw delError
    },
    onSuccess: async () => {
      setInfo({ tone: 'ok', message: 'Pending invite cancelled.' })
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
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
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
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
      setSelected(new Set())
      setInfo({
        tone: 'ok',
        message: `Removed ${userIds.length} user${userIds.length === 1 ? '' : 's'}.`,
      })
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
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
      setSelected(new Set())
      setInfo({
        tone: 'ok',
        message: `Updated ${userIds.length} user${userIds.length === 1 ? '' : 's'} to ${nextRole}.`,
      })
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  const bulkCancelInvites = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: delError } = await supabase.from('instance_invites').delete().in('id', ids)
      if (delError) throw delError
    },
    onSuccess: async (_, ids) => {
      setSelected(new Set())
      setInfo({
        tone: 'ok',
        message: `Cancelled ${ids.length} pending invite${ids.length === 1 ? '' : 's'}.`,
      })
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  const bulkResendInvites = useMutation({
    mutationFn: async (rows: OrgUserRow[]) => {
      if (!apiConfigured) {
        throw new Error('VITE_FLOWFORGE_API_URL is not configured')
      }
      let sent = 0
      const errors: string[] = []
      for (const row of rows) {
        try {
          await resendOrganisationInvite({
            inviteId: row.invite_id ?? undefined,
            instanceId: instance.id,
            userId: row.user_id ?? undefined,
            email: row.email ?? undefined,
          })
          sent += 1
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Failed to send invite email')
        }
      }
      if (!sent && errors.length) throw new Error(errors[0] ?? 'Failed to resend invites')
      return { sent, failed: errors.length }
    },
    onSuccess: async (result) => {
      setSelected(new Set())
      setInfo({
        tone: result.failed ? 'error' : 'ok',
        message: result.failed
          ? `Resent ${result.sent}, failed ${result.failed}.`
          : `Resent ${result.sent} invite email${result.sent === 1 ? '' : 's'}.`,
      })
      await qc.invalidateQueries({ queryKey: ['organisation-users', instance.id] })
    },
    onError: (err: Error) => setInfo({ tone: 'error', message: err.message }),
  })

  async function copyInviteLink(row: OrgUserRow) {
    if (!row.token) {
      setInfo({
        tone: 'info',
        message: 'No signup link available for this user. Use Resend invite instead.',
      })
      return
    }
    try {
      await navigator.clipboard.writeText(inviteSignupUrl(row.token))
      setInfo({ tone: 'ok', message: `Invite link copied for ${row.email}.` })
    } catch {
      setInfo({ tone: 'error', message: 'Could not copy invite link to the clipboard.' })
    }
  }

  function confirmRemove(row: OrgUserRow) {
    if (row.kind === 'invite' && row.invite_id) {
      if (!window.confirm(`Cancel pending invite for ${row.email}?`)) return
      removeInvite.mutate(row.invite_id)
      return
    }
    if (!memberSelectable(row, user?.id) || !row.user_id) return
    const name = row.display_name ?? row.email ?? 'this user'
    if (!window.confirm(`Remove ${name} from ${instance.name}? They will lose access immediately.`)) {
      return
    }
    removeMember.mutate(row.user_id)
  }

  function confirmBulkRemoveMembers() {
    const ids = selectedActiveUserIds
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
    const ids = selectedPending
      .map((row) => row.invite_id)
      .filter((id): id is string => !!id)
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

  function startEdit(row: OrgUserRow) {
    if (row.kind !== 'member' || row.role === 'owner' || !row.user_id) return
    setForm({
      email: row.email ?? '',
      display_name: row.display_name ?? '',
      job_title: row.job_title ?? '',
      phone: row.phone ?? '',
      department: row.department ?? '',
      notes: row.notes ?? '',
      role: row.role,
    })
    setEditingUserId(row.user_id)
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

  const colSpan = isAdmin ? 7 : 5
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
              ? 'rounded-xl border border-teal-200/80 bg-teal-50/80 px-3 py-2 text-sm text-teal-900'
              : info.tone === 'error'
                ? 'rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-sm text-rose-900'
                : 'rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm text-slate-800'
          }
          role="status"
        >
          {info.message}
        </p>
      ) : null}

      {open && isAdmin ? (
        <Card className="ff-page-enter border-teal-200/60">
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
                    New emails are added as Pending and receive an invitation link automatically.
                    Existing accounts are added as Active.
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
                  <option value="agent">agent</option>
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
              {!editingUserId && !apiConfigured ? (
                <p className="sm:col-span-2 text-xs text-amber-800">
                  Set `VITE_FLOWFORGE_API_URL` so invitation emails can be sent when you add a user.
                </p>
              ) : null}
            </div>

            {error ? <FieldError>{error}</FieldError> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMember.isPending}>
                {saveMember.isPending
                  ? editingUserId
                    ? 'Saving…'
                    : 'Adding & sending invite…'
                  : editingUserId
                    ? 'Save changes'
                    : 'Add user & send invite'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <SearchField
        id="users-search"
        value={search}
        onChange={setSearch}
        placeholder="Search users…"
      />

      {isAdmin && selected.size > 0 ? (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <div className="flex flex-wrap items-center gap-2">
            {selectedActiveUserIds.length > 0 ? (
              <>
                <Select
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value as InstanceRole)}
                  className="h-8 w-auto min-w-[7rem]"
                  aria-label="Bulk role"
                >
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="agent">agent</option>
                  <option value="viewer">viewer</option>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={bulkBusy}
                  onClick={() =>
                    bulkSetRole.mutate({ userIds: selectedActiveUserIds, nextRole: bulkRole })
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
              </>
            ) : null}
            {selectedPending.length > 0 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={bulkBusy || !apiConfigured}
                  onClick={() => bulkResendInvites.mutate(selectedPending)}
                >
                  <Mail className="h-4 w-4" />
                  Resend invite
                </Button>
                {selectedPending.some((row) => row.invite_id) ? (
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
                ) : null}
              </>
            ) : null}
          </div>
        </BulkActionBar>
      ) : null}

      <Card className="overflow-x-auto p-0">
        {users.isError ? (
          <p className="px-5 py-4 text-sm text-rose-700">
            Could not load users:{' '}
            {users.error instanceof Error ? users.error.message : 'Unknown error'}
          </p>
        ) : null}
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-muted)]">
            <tr>
              {isAdmin ? (
                <th className="px-5 py-3 font-medium">
                  <RowCheckbox
                    checked={allSelected}
                    onChange={(on) => setSelected(setAllIds(selectableKeys, on))}
                    label="Select all users"
                    className="mt-0"
                  />
                </th>
              ) : null}
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Job</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
              {isAdmin ? <th className="px-5 py-3 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {users.isLoading ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-8 text-center text-[var(--color-ink-muted)]">
                  Loading users…
                </td>
              </tr>
            ) : null}
            {filteredUsers.map((row) => {
              const name = row.display_name ?? row.email ?? 'User'
              const email = row.email
              const canSelect =
                row.kind === 'invite' ? isAdmin : memberSelectable(row, user?.id)
              const key = rowKey(row)
              return (
                <tr key={key} className="border-b border-[var(--color-border)] last:border-0">
                  {isAdmin ? (
                    <td className="px-5 py-3 align-top">
                      {canSelect ? (
                        <RowCheckbox
                          checked={selected.has(key)}
                          onChange={(on) => setSelected((prev) => toggleId(prev, key, on))}
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
                        seed={row.id}
                        size="md"
                        title={name}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">{name}</div>
                          {row.is_superuser ? <SuperuserBadge /> : null}
                        </div>
                        <div className="text-xs text-[var(--color-ink-muted)]">{email}</div>
                        {row.notes ? (
                          <p className="mt-1 max-w-xs text-xs text-[var(--color-ink-muted)] line-clamp-2">
                            {row.notes}
                          </p>
                        ) : null}
                        {row.status === 'pending' && row.email_last_error && !row.email_sent_at ? (
                          <p className="mt-1 max-w-xs text-[11px] text-rose-700/90 line-clamp-2">
                            {row.email_last_error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 align-top text-[var(--color-ink-muted)]">
                    <div>{row.job_title ?? '—'}</div>
                    {row.department ? <div className="text-xs">{row.department}</div> : null}
                  </td>
                  <td className="px-5 py-3 align-top text-[var(--color-ink-muted)]">
                    {row.phone ?? '—'}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <Badge>{row.role}</Badge>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <Badge
                      className={
                        row.status === 'active'
                          ? undefined
                          : 'from-amber-500/15 to-amber-500/10 text-amber-900 ring-amber-600/15'
                      }
                    >
                      {row.status === 'active' ? 'Active' : 'Pending'}
                    </Badge>
                  </td>
                  {isAdmin ? (
                    <td className="px-5 py-3 align-top">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {row.status === 'pending' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label={`Resend invite to ${email}`}
                            disabled={resendInvite.isPending || !apiConfigured}
                            title={
                              !apiConfigured
                                ? 'Invite email API is not configured'
                                : `Resend invitation email to ${email}`
                            }
                            onClick={() => resendInvite.mutate(row)}
                          >
                            <Mail className="h-4 w-4" />
                            Resend invite
                          </Button>
                        ) : null}
                        {row.kind === 'invite' && row.token ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Copy invite link for ${email}`}
                            title="Copy signup link"
                            onClick={() => void copyInviteLink(row)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {row.kind === 'member' && memberSelectable(row, user?.id) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${name}`}
                            onClick={() => startEdit(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {(row.kind === 'invite' || memberSelectable(row, user?.id)) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={
                              row.kind === 'invite' ? `Cancel invite for ${email}` : `Remove ${name}`
                            }
                            disabled={removeMember.isPending || removeInvite.isPending}
                            onClick={() => confirmRemove(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {!users.isLoading && !filteredUsers.length ? (
              <tr>
                <td colSpan={colSpan} className="px-5 py-8 text-center text-[var(--color-ink-muted)]">
                  {users.data?.length ? 'No users match your search.' : 'No users yet.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
