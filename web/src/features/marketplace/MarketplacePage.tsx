import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit, type MarketplaceListing } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

export function MarketplacePage() {
  const { instance, role } = useRequiredInstance()
  const { user, isSuperuser } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    slug: '',
    summary: '',
    category: 'support',
    kind: 'flow_pack' as 'flow_pack' | 'template_pack',
    visibility: 'org' as 'private' | 'org' | 'public',
    chatbotId: '',
  })

  const listings = useQuery({
    queryKey: ['marketplace-listings', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('marketplace_listings')
        .select('*')
        .or(`publisher_instance_id.eq.${instance.id},and(status.eq.approved,visibility.eq.public)`)
        .order('updated_at', { ascending: false })
        .limit(100)
      if (qError) throw qError
      return (data ?? []) as MarketplaceListing[]
    },
  })

  const bots = useQuery({
    queryKey: ['chatbots-lite', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('instance_id', instance.id)
        .is('deleted_at', null)
        .order('name')
      if (qError) throw qError
      return data ?? []
    },
  })

  async function publishListing(e: FormEvent) {
    e.preventDefault()
    if (!user || !editable) return
    setError(null)
    const slug = slugify(form.slug || form.title)
    const { data, error: insertError } = await supabase
      .from('marketplace_listings')
      .insert({
        publisher_instance_id: instance.id,
        kind: form.kind,
        visibility: form.visibility,
        status: 'draft',
        slug,
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        category: form.category,
        pack: { note: 'Install clones structure via clone_chatbot_to_instance or flow import' },
        source_chatbot_id: form.chatbotId || null,
        created_by: user.id,
      })
      .select('id')
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    const { error: submitError } = await supabase.rpc('submit_marketplace_listing', {
      p_listing_id: data.id,
    })
    if (submitError) {
      setError(submitError.message)
      return
    }
    setForm((f) => ({ ...f, title: '', slug: '', summary: '' }))
    await qc.invalidateQueries({ queryKey: ['marketplace-listings', instance.id] })
  }

  const install = useMutation({
    mutationFn: async (listing: MarketplaceListing) => {
      if (listing.source_chatbot_id) {
        const { data, error: cloneError } = await supabase.rpc('clone_chatbot_to_instance', {
          p_source_chatbot_id: listing.source_chatbot_id,
          p_target_instance_id: instance.id,
          p_new_name: `${listing.title} (install)`,
          p_include_published: true,
        })
        if (cloneError) throw cloneError
        const chatbotId =
          data && typeof data === 'object' && 'chatbot_id' in data
            ? String((data as { chatbot_id: string }).chatbot_id)
            : null
        const { error: installError } = await supabase.rpc('record_marketplace_install', {
          p_listing_id: listing.id,
          p_target_instance_id: instance.id,
          p_target_chatbot_id: chatbotId,
        })
        if (installError) throw installError
        return
      }
      const { error: installError } = await supabase.rpc('record_marketplace_install', {
        p_listing_id: listing.id,
        p_target_instance_id: instance.id,
        p_target_chatbot_id: null,
      })
      if (installError) throw installError
    },
    onError: (e: Error) => setError(e.message),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['marketplace-listings', instance.id] })
    },
  })

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error: rpcError } = await supabase.rpc('review_marketplace_listing', {
        p_listing_id: id,
        p_approve: approve,
      })
      if (rpcError) throw rpcError
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['marketplace-listings', instance.id] })
    },
  })

  const removeListing = useMutation({
    mutationFn: async (listing: MarketplaceListing) => {
      const { error: rpcError } = await supabase.rpc('delete_marketplace_listing', {
        p_listing_id: listing.id,
      })
      if (rpcError) throw rpcError
    },
    onError: (e: Error) => setError(e.message),
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: ['marketplace-listings', instance.id] })
    },
  })

  function canRemoveListing(listing: MarketplaceListing): boolean {
    if (isSuperuser) return true
    return editable && listing.publisher_instance_id === instance.id
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Share and install flow/template packs across organisations."
      />
      {error ? <FieldError>{error}</FieldError> : null}

      <div className="grid gap-3">
        {(listings.data ?? []).map((listing) => (
          <Card key={listing.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{listing.title}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {listing.kind} · {listing.visibility} · {listing.status} · {listing.install_count} installs
                {listing.category ? ` · ${listing.category}` : ''}
              </p>
              {listing.summary ? <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{listing.summary}</p> : null}
            </div>
            {editable && listing.status === 'approved' ? (
              <Button size="sm" variant="secondary" disabled={install.isPending} onClick={() => install.mutate(listing)}>
                Install
              </Button>
            ) : null}
            {isSuperuser && listing.status === 'pending' ? (
              <>
                <Button size="sm" onClick={() => review.mutate({ id: listing.id, approve: true })}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => review.mutate({ id: listing.id, approve: false })}>
                  Reject
                </Button>
              </>
            ) : null}
            {canRemoveListing(listing) ? (
              <Button
                size="sm"
                variant="danger"
                disabled={removeListing.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Remove “${listing.title}” from the marketplace? Install history for this listing will be deleted; installed chatbots are kept.`,
                    )
                  ) {
                    return
                  }
                  removeListing.mutate(listing)
                }}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </Card>
        ))}
      </div>

      {editable ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Publish a pack</h2>
          <form className="space-y-3" onSubmit={(e) => void publishListing(e)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </label>
              <label className="space-y-1 text-xs">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="auto from title" />
              </label>
              <label className="space-y-1 text-xs">
                <Label>Kind</Label>
                <Select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as typeof form.kind }))}
                >
                  <option value="flow_pack">Flow pack</option>
                  <option value="template_pack">Template pack</option>
                </Select>
              </label>
              <label className="space-y-1 text-xs">
                <Label>Visibility</Label>
                <Select
                  value={form.visibility}
                  onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as typeof form.visibility }))}
                >
                  <option value="private">Private</option>
                  <option value="org">Organisation</option>
                  <option value="public">Public (needs approval)</option>
                </Select>
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">
                <Label>Source chatbot (for install clone)</Label>
                <Select value={form.chatbotId} onChange={(e) => setForm((f) => ({ ...f, chatbotId: e.target.value }))}>
                  <option value="">None</option>
                  {(bots.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <Textarea
              rows={2}
              placeholder="Summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
            <Button type="submit" size="sm" disabled={!form.title.trim()}>
              Submit listing
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
