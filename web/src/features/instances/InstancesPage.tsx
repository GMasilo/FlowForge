import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/shared/lib/supabase'
import { cn, slugify } from '@/shared/lib/utils'
import type { Instance } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
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

type OrgFormState = {
  name: string
  legal_name: string
  slug: string
  contact_email: string
  phone: string
  website: string
  billing_address: string
  notes: string
}

const emptyForm = (): OrgFormState => ({
  name: '',
  legal_name: '',
  slug: '',
  contact_email: '',
  phone: '',
  website: '',
  billing_address: '',
  notes: '',
})

function fromInstance(row: Instance): OrgFormState {
  return {
    name: row.name,
    legal_name: row.legal_name ?? '',
    slug: row.slug,
    contact_email: row.contact_email ?? '',
    phone: row.phone ?? '',
    website: row.website ?? '',
    billing_address: row.billing_address ?? '',
    notes: row.notes ?? '',
  }
}

export function InstancesPage() {
  const { user, isSuperuser, loading: authLoading } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState<OrgFormState>(emptyForm)
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const list = useQuery({
    queryKey: ['instances-all', user?.id],
    enabled: !!user?.id && isSuperuser,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instances')
        .select('*')
        .order('name', { ascending: true })
      if (qError) throw qError
      return (data ?? []) as Instance[]
    },
  })

  const filtered = useMemo(() => {
    const rows = list.data ?? []
    return rows.filter((org) =>
      matchesQuery(search, [
        org.name,
        org.slug,
        org.legal_name,
        org.contact_email,
        org.phone,
        org.website,
        org.notes,
      ]),
    )
  }, [list.data, search])

  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered])
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))

  useEffect(() => {
    if (editingId || slugTouched) return
    setForm((prev) => ({ ...prev, slug: slugify(prev.name) }))
  }, [form.name, editingId, slugTouched])

  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set((list.data ?? []).map((o) => o.id))
      const next = new Set<string>()
      for (const id of prev) if (valid.has(id)) next.add(id)
      return next
    })
  }, [list.data])

  const create = useMutation({
    mutationFn: async (values: OrgFormState) => {
      const slug =
        values.slug.trim() ||
        `${slugify(values.name) || 'org'}-${Math.random().toString(36).slice(2, 7)}`
      const { data, error: rpcError } = await supabase.rpc('create_organisation', {
        p_name: values.name.trim(),
        p_slug: slug,
        p_legal_name: values.legal_name.trim() || null,
        p_contact_email: values.contact_email.trim() || null,
        p_phone: values.phone.trim() || null,
        p_website: values.website.trim() || null,
        p_billing_address: values.billing_address.trim() || null,
        p_notes: values.notes.trim() || null,
      })
      if (rpcError) throw rpcError
      return data
    },
    onSuccess: async () => {
      resetForm()
      await qc.invalidateQueries({ queryKey: ['instances-all', user?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: OrgFormState }) => {
      const { data, error: rpcError } = await supabase.rpc('update_organisation', {
        p_id: id,
        p_name: values.name.trim(),
        p_slug: values.slug.trim(),
        p_legal_name: values.legal_name.trim() || null,
        p_contact_email: values.contact_email.trim() || null,
        p_phone: values.phone.trim() || null,
        p_website: values.website.trim() || null,
        p_billing_address: values.billing_address.trim() || null,
        p_notes: values.notes.trim() || null,
      })
      if (rpcError) throw rpcError
      return data
    },
    onSuccess: async () => {
      resetForm()
      await qc.invalidateQueries({ queryKey: ['instances-all', user?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: delError } = await supabase.from('instances').delete().in('id', ids)
      if (delError) throw delError
    },
    onSuccess: async () => {
      setSelected(new Set())
      setError(null)
      await qc.invalidateQueries({ queryKey: ['instances-all', user?.id] })
    },
    onError: (err: Error) => setError(err.message),
  })

  function resetForm() {
    setForm(emptyForm())
    setSlugTouched(false)
    setEditingId(null)
    setOpen(false)
    setError(null)
  }

  function startCreate() {
    setForm(emptyForm())
    setSlugTouched(false)
    setEditingId(null)
    setError(null)
    setOpen(true)
  }

  function startEdit(row: Instance) {
    setForm(fromInstance(row))
    setSlugTouched(true)
    setEditingId(row.id)
    setError(null)
    setOpen(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) return
    if (editingId) update.mutate({ id: editingId, values: form })
    else create.mutate(form)
  }

  function setField<K extends keyof OrgFormState>(key: K, value: OrgFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function confirmBulkDelete() {
    const ids = [...selected]
    if (!ids.length) return
    const label = ids.length === 1 ? 'this organisation' : `${ids.length} organisations`
    if (
      !window.confirm(
        `Delete ${label}? Chatbots, connections, and users for ${ids.length === 1 ? 'it' : 'them'} will be removed permanently.`,
      )
    ) {
      return
    }
    bulkDelete.mutate(ids)
  }

  if (authLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
  }

  if (!isSuperuser) {
    return <Navigate to="/" replace />
  }

  const saving = create.isPending || update.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisations"
        description="Client accounts for FlowForge. Only app admins can create and manage organisations."
        actions={
          <Button onClick={() => (open && !editingId ? resetForm() : startCreate())}>
            <Plus className="h-4 w-4" />
            New organisation
          </Button>
        }
      />

      {open ? (
        <Card className="ff-page-enter border-teal-200/60">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                {editingId ? 'Edit organisation' : 'New organisation'}
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="org-name">Display name</Label>
                <Input
                  id="org-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Acme Corp"
                  required
                />
              </div>
              <div>
                <Label htmlFor="org-legal">Legal name</Label>
                <Input
                  id="org-legal"
                  value={form.legal_name}
                  onChange={(e) => setField('legal_name', e.target.value)}
                  placeholder="Acme Corporation Ltd"
                />
              </div>
              <div>
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setField('slug', slugify(e.target.value) || e.target.value)
                  }}
                  placeholder="acme-corp"
                  required
                />
              </div>
              <div>
                <Label htmlFor="org-email">Contact email</Label>
                <Input
                  id="org-email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setField('contact_email', e.target.value)}
                  placeholder="billing@acme.com"
                />
              </div>
              <div>
                <Label htmlFor="org-phone">Phone</Label>
                <Input
                  id="org-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+31 20 123 4567"
                />
              </div>
              <div>
                <Label htmlFor="org-website">Website</Label>
                <Input
                  id="org-website"
                  type="url"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="org-billing">Billing address</Label>
              <Textarea
                id="org-billing"
                value={form.billing_address}
                onChange={(e) => setField('billing_address', e.target.value)}
                placeholder="Street, city, postal code, country"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="org-notes">Notes</Label>
              <Textarea
                id="org-notes"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Internal notes about this client"
                rows={3}
              />
            </div>

            {error ? <FieldError>{error}</FieldError> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? editingId
                    ? 'Saving…'
                    : 'Creating…'
                  : editingId
                    ? 'Save changes'
                    : 'Create organisation'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          id="org-search"
          value={search}
          onChange={setSearch}
          placeholder="Search organisations…"
        />
        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
          <RowCheckbox
            checked={allFilteredSelected}
            onChange={(on) => setSelected(setAllIds(filteredIds, on))}
            label="Select all visible organisations"
            className="mt-0"
          />
          Select all
        </label>
      </div>

      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={bulkDelete.isPending}
          onClick={confirmBulkDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </BulkActionBar>

      {error && !open ? <FieldError>{error}</FieldError> : null}

      {list.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : filtered.length ? (
        <div className="ff-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((org) => {
            const isSelected = selected.has(org.id)
            return (
              <Card
                key={org.id}
                className={cn(
                  'ff-hover-lift group relative overflow-hidden',
                  isSelected && 'ring-2 ring-teal-500/35',
                )}
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-teal-400/20 to-sky-400/10 transition-transform duration-500 group-hover:scale-125" />
                <div className="relative flex items-start gap-3">
                  <RowCheckbox
                    checked={isSelected}
                    onChange={(on) => setSelected((prev) => toggleId(prev, org.id, on))}
                    label={`Select ${org.name}`}
                  />
                  <Link to={`/instances/${org.id}`} className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-500/15 to-cyan-500/15 text-teal-700 ring-1 ring-teal-600/10">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-semibold">{org.name}</h2>
                        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{org.slug}</p>
                        {org.contact_email ? (
                          <p className="mt-1 truncate text-xs text-[var(--color-ink-muted)]">
                            {org.contact_email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${org.name}`}
                    onClick={() => startEdit(org)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="ff-page-enter border-dashed border-teal-300/50 bg-teal-50/30 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {list.data?.length
              ? 'No organisations match your search.'
              : 'No organisations yet. Create one to onboard a client.'}
          </p>
        </Card>
      )}
    </div>
  )
}
