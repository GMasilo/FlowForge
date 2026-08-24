import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'
import type { Instance } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { PageHeader } from '@/shared/ui/page-header'

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

export function InstanceSettingsPage() {
  const { instance } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState<OrgFormState>(() => fromInstance(instance))
  const [slugTouched, setSlugTouched] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(fromInstance(instance))
    setSlugTouched(true)
  }, [instance])

  useEffect(() => {
    if (slugTouched) return
    setForm((prev) => ({ ...prev, slug: slugify(prev.name) }))
  }, [form.name, slugTouched])

  const save = useMutation({
    mutationFn: async (values: OrgFormState) => {
      const { data, error: rpcError } = await supabase.rpc('update_organisation', {
        p_id: instance.id,
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
      setError(null)
      setSaved(true)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['instance', instance.id] }),
        qc.invalidateQueries({ queryKey: ['instances-all', user?.id] }),
        qc.invalidateQueries({ queryKey: ['admin-overview', instance.id] }),
      ])
    },
    onError: (err: Error) => {
      setSaved(false)
      setError(err.message)
    },
  })

  function setField<K extends keyof OrgFormState>(key: K, value: OrgFormState[K]) {
    setSaved(false)
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Display name and slug are required')
      return
    }
    save.mutate(form)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation"
        description={`Profile and contact details for ${instance.name}.`}
      />

      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
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
              placeholder="Internal notes about this organisation"
              rows={3}
            />
          </div>

          {error ? <FieldError>{error}</FieldError> : null}
          {saved && !error ? (
            <p className="text-sm text-[var(--color-accent)]" role="status">
              Organisation details saved.
            </p>
          ) : null}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
