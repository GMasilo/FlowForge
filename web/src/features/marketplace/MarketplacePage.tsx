import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PlanLockedState } from '@/features/billing/PlanLockedState'
import {
  buildMarketplacePackFromChatbot,
  installFlowPackToInstance,
  marketplacePackSummary,
} from '@/features/chatbots/chatbotFlowTransfer'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit, instanceFeatureEnabled, type Json, type MarketplaceListing } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PAGE_HELP, SECTION_HELP } from '@/shared/help/pageHelp'
import { SectionHeading } from '@/shared/ui/help-tooltip'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

export function MarketplacePage() {
  const { instance, role } = useRequiredInstance()
  const { user, isSuperuser } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const marketplaceEnabled = instanceFeatureEnabled(instance, 'marketplace')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
    enabled: marketplaceEnabled,
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
    setNotice(null)
    if (!form.chatbotId) {
      setError('Select a source chatbot to serialize into the pack')
      return
    }
    const slug = slugify(form.slug || form.title)
    try {
      const pack = await buildMarketplacePackFromChatbot(form.chatbotId)
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
          pack: pack as unknown as Json,
          source_chatbot_id: form.chatbotId,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish pack')
    }
  }

  const install = useMutation({
    mutationFn: async (listing: MarketplaceListing) => {
      if (!user) throw new Error('Sign in required')
      const pack = listing.pack
      const isFlowPack =
        pack &&
        typeof pack === 'object' &&
        !Array.isArray(pack) &&
        (pack as { kind?: string }).kind === 'flowforge.chatbotFlow'

      let chatbotId: string | null = null
      let connectionsNeedRebind = false

      if (isFlowPack) {
        const result = await installFlowPackToInstance({
          instanceId: instance.id,
          name: `${listing.title} (install)`,
          pack,
          createdBy: user.id,
        })
        chatbotId = result.chatbotId
        connectionsNeedRebind = result.connectionsNeedRebind
      } else if (listing.source_chatbot_id) {
        const { data, error: cloneError } = await supabase.rpc('clone_chatbot_to_instance', {
          p_source_chatbot_id: listing.source_chatbot_id,
          p_target_instance_id: instance.id,
          p_new_name: `${listing.title} (install)`,
          p_include_published: true,
        })
        if (cloneError) throw cloneError
        chatbotId =
          data && typeof data === 'object' && 'chatbot_id' in data
            ? String((data as { chatbot_id: string }).chatbot_id)
            : null
        connectionsNeedRebind = true
      } else {
        throw new Error('This listing has no installable pack')
      }

      const { error: installError } = await supabase.rpc('record_marketplace_install', {
        p_listing_id: listing.id,
        p_target_instance_id: instance.id,
        p_target_chatbot_id: chatbotId,
      })
      if (installError) throw installError
      return { connectionsNeedRebind }
    },
    onError: (e: Error) => {
      setNotice(null)
      setError(e.message)
    },
    onSuccess: async (result) => {
      setError(null)
      setNotice(
        result.connectionsNeedRebind
          ? 'Installed. Rebind HTTP/email/payment connections on the new chatbot before publishing.'
          : 'Installed.',
      )
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

  if (!marketplaceEnabled) {
    return <PlanLockedState feature="marketplace" title="Marketplace" />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Share and install flow packs (steps, templates, entities) across organisations."
        help={PAGE_HELP.marketplace}
      />
      {error ? <FieldError>{error}</FieldError> : null}
      {notice ? <p className="text-sm text-teal-800">{notice}</p> : null}

      <div className="ff-stagger grid gap-3">
        {(listings.data ?? []).map((listing) => (
          <Card key={listing.id} className="ff-hover-lift flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{listing.title}</p>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {listing.kind} · {listing.visibility} · {listing.status} · {listing.install_count}{' '}
                installs
                {listing.category ? ` · ${listing.category}` : ''}
              </p>
              <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                {marketplacePackSummary(listing.pack)}
              </p>
              {listing.summary ? (
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{listing.summary}</p>
              ) : null}
            </div>
            {editable && listing.status === 'approved' ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={install.isPending}
                onClick={() => install.mutate(listing)}
              >
                Install
              </Button>
            ) : null}
            {isSuperuser && listing.status === 'pending' ? (
              <>
                <Button size="sm" onClick={() => review.mutate({ id: listing.id, approve: true })}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => review.mutate({ id: listing.id, approve: false })}
                >
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
          <SectionHeading title="Publish a pack" help={SECTION_HELP.publishPack} />
          <form className="space-y-3" onSubmit={(e) => void publishListing(e)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </label>
              <label className="space-y-1 text-xs">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="auto from title"
                />
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, visibility: e.target.value as typeof form.visibility }))
                  }
                >
                  <option value="private">Private</option>
                  <option value="org">Organisation</option>
                  <option value="public">Public (needs approval)</option>
                </Select>
              </label>
              <label className="space-y-1 text-xs sm:col-span-2">
                <Label>Source chatbot</Label>
                <Select
                  value={form.chatbotId}
                  onChange={(e) => setForm((f) => ({ ...f, chatbotId: e.target.value }))}
                  required
                >
                  <option value="">Select chatbot…</option>
                  {(bots.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Serializes flow, globals, templates, entities, and scenarios. Connection IDs are
                  stripped — rebind after install.
                </p>
              </label>
            </div>
            <Textarea
              rows={2}
              placeholder="Summary"
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            />
            <Button type="submit" size="sm" disabled={!form.title.trim() || !form.chatbotId}>
              Submit listing
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  )
}
