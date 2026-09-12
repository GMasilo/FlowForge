import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Upload } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { USE_CASES, type UseCaseIndustryId } from '@/features/landing/useCases'
import { claimChatbotPublicSlug, formatChatbotSlugError } from '@/features/chatbots/claimChatbotPublicSlug'
import { importPlatformDemoChatbot } from '@/features/platform/importPlatformDemoChatbot'
import {
  landingEmbedUrl,
  normalizeUseCaseDemos,
  platformSettingsQueryKey,
  PLATFORM_SETTINGS_ID,
  type PlatformSettingsRow,
  type UseCaseDemosMap,
} from '@/features/platform/platformSettings'
import { parseFlowExport } from '@/features/designer/utils/flowTransfer'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'
import type { Instance, Json } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PAGE_HELP } from '@/shared/help/pageHelp'
import { PageHeader } from '@/shared/ui/page-header'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

type SettingsForm = {
  hero_tagline: string
  hero_description: string
  about_text: string
  contact_email: string
  contact_phone: string
  contact_url: string
  landing_public_slug: string
  landing_demo_instance_id: string
  usecase_demos: UseCaseDemosMap
}

function emptyUseCaseDemos(): UseCaseDemosMap {
  const out: UseCaseDemosMap = {}
  for (const industry of USE_CASES) {
    out[industry.id] = {
      chatbot_id: null,
      public_slug: industry.suggestedSlug,
    }
  }
  return out
}

function fromRow(row: PlatformSettingsRow): SettingsForm {
  const stored = normalizeUseCaseDemos(row.usecase_demos)
  const usecase_demos = emptyUseCaseDemos()
  for (const industry of USE_CASES) {
    const entry = stored[industry.id]
    usecase_demos[industry.id] = {
      chatbot_id: entry?.chatbot_id ?? null,
      public_slug: entry?.public_slug?.trim() || industry.suggestedSlug,
    }
  }
  return {
    hero_tagline: row.hero_tagline ?? '',
    hero_description: row.hero_description ?? '',
    about_text: row.about_text ?? '',
    contact_email: row.contact_email ?? '',
    contact_phone: row.contact_phone ?? '',
    contact_url: row.contact_url ?? '',
    landing_public_slug: row.landing_public_slug ?? '',
    landing_demo_instance_id: row.landing_demo_instance_id ?? '',
    usecase_demos,
  }
}

function serializeUseCaseDemos(map: UseCaseDemosMap): Json {
  const out: Record<string, { chatbot_id: string | null; public_slug: string | null }> = {}
  for (const industry of USE_CASES) {
    const entry = map[industry.id]
    const slug = entry?.public_slug?.trim() || industry.suggestedSlug
    out[industry.id] = {
      chatbot_id: entry?.chatbot_id?.trim() || null,
      public_slug: slug,
    }
  }
  return out
}

function sampleHref(file: string) {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
  return `${base}/samples/${file}`
}

export function PlatformSettingsPage() {
  const { user, isSuperuser, loading: authLoading } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [usecaseImportBusy, setUsecaseImportBusy] = useState<UseCaseIndustryId | null>(null)
  const [usecaseImportError, setUsecaseImportError] = useState<string | null>(null)
  const importBusyRef = useRef(false)
  const usecaseImportBusyRef = useRef<UseCaseIndustryId | null>(null)

  const settings = useQuery({
    queryKey: platformSettingsQueryKey,
    enabled: isSuperuser,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('id', PLATFORM_SETTINGS_ID)
        .single()
      if (qError) throw qError
      const row = data as PlatformSettingsRow & { usecase_demos?: unknown }
      return {
        ...row,
        usecase_demos: normalizeUseCaseDemos(row.usecase_demos),
      } satisfies PlatformSettingsRow
    },
  })

  const instances = useQuery({
    queryKey: ['instances-all', user?.id],
    enabled: isSuperuser && !!user?.id,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('instances')
        .select('id, name, slug')
        .order('name', { ascending: true })
      if (qError) throw qError
      return (data ?? []) as Pick<Instance, 'id' | 'name' | 'slug'>[]
    },
  })

  const demoChatbot = useQuery({
    queryKey: ['platform-demo-chatbot', settings.data?.landing_demo_chatbot_id],
    enabled: !!settings.data?.landing_demo_chatbot_id,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name, public_enabled, public_slug, instance_id, chatbot_flows(published_at, published_graph)')
        .eq('id', settings.data!.landing_demo_chatbot_id!)
        .single()
      if (qError) throw qError
      return data
    },
  })

  const usecaseChatbotIds = useMemo(() => {
    if (!form) return [] as string[]
    return USE_CASES.map((u) => form.usecase_demos[u.id]?.chatbot_id)
      .filter((id): id is string => !!id?.trim())
  }, [form])

  const usecaseChatbots = useQuery({
    queryKey: ['platform-usecase-chatbots', usecaseChatbotIds.join(',')],
    enabled: usecaseChatbotIds.length > 0,
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select('id, name, public_enabled, public_slug, chatbot_flows(published_at, published_graph)')
        .in('id', usecaseChatbotIds)
      if (qError) throw qError
      return data ?? []
    },
  })

  const usecaseChatbotById = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        name: string
        public_enabled: boolean | null
        public_slug: string | null
        chatbot_flows:
          | { published_at: string | null; published_graph: Json | null }
          | { published_at: string | null; published_graph: Json | null }[]
          | null
      }
    >()
    for (const row of usecaseChatbots.data ?? []) map.set(row.id, row)
    return map
  }, [usecaseChatbots.data])

  useEffect(() => {
    if (!settings.data || hydrated) return
    setForm(fromRow(settings.data))
    setHydrated(true)
  }, [settings.data, hydrated])

  const embedPreviewUrl = useMemo(() => {
    const org =
      (instances.data ?? []).find((i) => i.id === form?.landing_demo_instance_id)?.slug ?? null
    return landingEmbedUrl(form?.landing_public_slug, org)
  }, [form?.landing_public_slug, form?.landing_demo_instance_id, instances.data])

  const hostOrgSlug =
    (instances.data ?? []).find((i) => i.id === form?.landing_demo_instance_id)?.slug ?? null

  const save = useMutation({
    mutationFn: async (next: SettingsForm) => {
      const slug = next.landing_public_slug.trim() || null
      const usecase_demos = serializeUseCaseDemos(next.usecase_demos)
      const { error: updateError } = await supabase
        .from('platform_settings')
        .update({
          hero_tagline: next.hero_tagline.trim() || null,
          hero_description: next.hero_description.trim() || null,
          about_text: next.about_text.trim() || null,
          contact_email: next.contact_email.trim() || null,
          contact_phone: next.contact_phone.trim() || null,
          contact_url: next.contact_url.trim() || null,
          landing_public_slug: slug,
          landing_demo_instance_id: next.landing_demo_instance_id.trim() || null,
          usecase_demos,
          updated_by: user!.id,
        })
        .eq('id', PLATFORM_SETTINGS_ID)
      if (updateError) throw updateError

      if (slug && settings.data?.landing_demo_chatbot_id && next.landing_demo_instance_id.trim()) {
        try {
          await claimChatbotPublicSlug({
            chatbotId: settings.data.landing_demo_chatbot_id,
            instanceId: next.landing_demo_instance_id.trim(),
            slug,
            extra: { public_enabled: true },
          })
        } catch (err) {
          throw new Error(formatChatbotSlugError(err, slug))
        }
      }

      for (const industry of USE_CASES) {
        const entry = next.usecase_demos[industry.id]
        const botId = entry?.chatbot_id?.trim()
        const botSlug = entry?.public_slug?.trim() || industry.suggestedSlug
        if (!botId || !next.landing_demo_instance_id.trim()) continue
        try {
          await claimChatbotPublicSlug({
            chatbotId: botId,
            instanceId: next.landing_demo_instance_id.trim(),
            slug: botSlug,
            extra: { public_enabled: true },
          })
        } catch (err) {
          throw new Error(`${industry.brand}: ${formatChatbotSlugError(err, botSlug)}`)
        }
      }
    },
    onSuccess: async () => {
      setError(null)
      await qc.invalidateQueries({ queryKey: platformSettingsQueryKey })
      await qc.invalidateQueries({ queryKey: ['platform-settings-public'] })
      await qc.invalidateQueries({ queryKey: ['platform-usecase-chatbots'] })
      if (settings.data?.landing_demo_chatbot_id) {
        await qc.invalidateQueries({
          queryKey: ['platform-demo-chatbot', settings.data.landing_demo_chatbot_id],
        })
      }
    },
    onError: (err: Error) => setError(err.message),
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    save.mutate(form)
  }

  async function importLandingDemo() {
    if (!form?.landing_demo_instance_id.trim()) {
      setImportError('Choose an organisation to host the landing demo chatbot.')
      return
    }
    if (importBusyRef.current) return
    importBusyRef.current = true
    setImportBusy(true)
    setImportError(null)
    try {
      const instanceId = form.landing_demo_instance_id.trim()
      const result = await importPlatformDemoChatbot({
        instanceId,
        userId: user!.id,
        existingChatbotId: settings.data?.landing_demo_chatbot_id,
        preferredSlug: form.landing_public_slug,
        fallbackSlug: 'try-flowforge',
        publishNote: 'Landing page demo import',
        descriptionFallback: 'Public demo on the FlowForge landing page',
      })

      const { error: platformError } = await supabase
        .from('platform_settings')
        .update({
          landing_demo_instance_id: instanceId,
          landing_demo_chatbot_id: result.chatbotId,
          landing_public_slug: result.slug,
          updated_by: user!.id,
        })
        .eq('id', PLATFORM_SETTINGS_ID)
      if (platformError) throw platformError

      setForm((prev) =>
        prev
          ? {
              ...prev,
              landing_public_slug: result.slug,
              landing_demo_instance_id: instanceId,
            }
          : prev,
      )
      await qc.invalidateQueries({ queryKey: platformSettingsQueryKey })
      await qc.invalidateQueries({ queryKey: ['platform-settings-public'] })
      await qc.invalidateQueries({ queryKey: ['platform-demo-chatbot', result.chatbotId] })
    } catch (e) {
      if (e instanceof Error && e.message === 'No file selected') return
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      importBusyRef.current = false
      setImportBusy(false)
    }
  }

  async function importUseCaseDemo(industryId: UseCaseIndustryId, source: 'file' | 'bundled') {
    if (!form?.landing_demo_instance_id.trim()) {
      setUsecaseImportError('Choose a host organisation (same as landing demo) first.')
      return
    }
    if (usecaseImportBusyRef.current) return
    usecaseImportBusyRef.current = industryId
    setUsecaseImportBusy(industryId)
    setUsecaseImportError(null)
    try {
      const industry = USE_CASES.find((u) => u.id === industryId)!
      const instanceId = form.landing_demo_instance_id.trim()
      const preferredSlug =
        form.usecase_demos[industryId]?.public_slug?.trim() || industry.suggestedSlug

      let pack: ReturnType<typeof parseFlowExport> | undefined
      if (source === 'bundled') {
        const res = await fetch(sampleHref(industry.sampleFile))
        if (!res.ok) throw new Error(`Could not load ${industry.sampleFile} (${res.status})`)
        pack = parseFlowExport(await res.json())
      }

      const result = await importPlatformDemoChatbot({
        instanceId,
        userId: user!.id,
        existingChatbotId: form.usecase_demos[industryId]?.chatbot_id,
        preferredSlug,
        fallbackSlug: industry.suggestedSlug,
        publishNote: `Use case demo import (${industry.brand})`,
        descriptionFallback: `${industry.brand} industry use-case demo`,
        pack,
      })

      const nextDemos: UseCaseDemosMap = {
        ...form.usecase_demos,
        [industryId]: {
          chatbot_id: result.chatbotId,
          public_slug: result.slug,
        },
      }

      const { error: platformError } = await supabase
        .from('platform_settings')
        .update({
          landing_demo_instance_id: instanceId,
          usecase_demos: serializeUseCaseDemos(nextDemos),
          updated_by: user!.id,
        })
        .eq('id', PLATFORM_SETTINGS_ID)
      if (platformError) throw platformError

      setForm((prev) => (prev ? { ...prev, usecase_demos: nextDemos } : prev))
      await qc.invalidateQueries({ queryKey: platformSettingsQueryKey })
      await qc.invalidateQueries({ queryKey: ['platform-settings-public'] })
      await qc.invalidateQueries({ queryKey: ['platform-usecase-chatbots'] })
    } catch (e) {
      if (e instanceof Error && e.message === 'No file selected') return
      setUsecaseImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      usecaseImportBusyRef.current = null
      setUsecaseImportBusy(null)
    }
  }

  function setUseCaseSlug(industryId: UseCaseIndustryId, value: string) {
    setForm((prev) => {
      if (!prev) return prev
      const current = prev.usecase_demos[industryId] ?? {}
      return {
        ...prev,
        usecase_demos: {
          ...prev.usecase_demos,
          [industryId]: {
            ...current,
            public_slug: slugify(value) || value,
          },
        },
      }
    })
  }

  if (authLoading || settings.isLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
  }

  if (!isSuperuser) {
    return <Navigate to="/" replace />
  }

  if (!form) {
    return <FieldError>Platform settings could not be loaded.</FieldError>
  }

  const flowRel = demoChatbot.data?.chatbot_flows
  const flowRow = Array.isArray(flowRel) ? flowRel[0] : flowRel
  const demoPublished = !!(flowRow?.published_at && flowRow.published_graph != null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Configure the public landing page, contact details, landing demo, and industry use-case chatbots."
        help={PAGE_HELP.platformSettings}
      />

      <form className="space-y-6" onSubmit={onSubmit}>
        <Card className="space-y-4 p-5">
          <h2 className="text-base font-semibold">Landing page content</h2>
          <div>
            <Label htmlFor="hero-tagline">Hero tagline</Label>
            <Input
              id="hero-tagline"
              value={form.hero_tagline}
              onChange={(e) => setForm({ ...form, hero_tagline: e.target.value })}
              placeholder="Conversational automation platform"
            />
          </div>
          <div>
            <Label htmlFor="hero-description">Hero description</Label>
            <Textarea
              id="hero-description"
              rows={3}
              value={form.hero_description}
              onChange={(e) => setForm({ ...form, hero_description: e.target.value })}
              placeholder="FlowForge helps organisations design, preview, and publish conversational experiences…"
            />
          </div>
          <div>
            <Label htmlFor="about-text">About</Label>
            <Textarea
              id="about-text"
              rows={4}
              value={form.about_text}
              onChange={(e) => setForm({ ...form, about_text: e.target.value })}
              placeholder="Short paragraph shown on the landing page footer."
            />
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-base font-semibold">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="hello@flowforge.example"
              />
            </div>
            <div>
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="+27 00 000 0000"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="contact-url">Website or contact URL</Label>
              <Input
                id="contact-url"
                type="url"
                value={form.contact_url}
                onChange={(e) => setForm({ ...form, contact_url: e.target.value })}
                placeholder="https://example.com/contact"
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold">Demo host organisation</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Landing and use-case demos are hosted in one organisation. “Try demo” on the public Use cases page
              uses this org slug.
            </p>
          </div>
          <div>
            <Label htmlFor="demo-instance">Host organisation</Label>
            <Select
              id="demo-instance"
              value={form.landing_demo_instance_id}
              onChange={(e) => setForm({ ...form, landing_demo_instance_id: e.target.value })}
            >
              <option value="">Select organisation…</option>
              {(instances.data ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.slug})
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold">Landing demo chatbot</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Import a published flow pack to embed on the public landing page. Use the bundled sample{' '}
              <a
                href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/samples/flowforge-home-demo.json`}
                download="flowforge-home-demo.json"
                className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-accent)] hover:opacity-90"
              >
                flowforge-home-demo.json
              </a>{' '}
              (regenerate with{' '}
              <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs">
                node samples/home-demo/build.mjs
              </code>
              ).
            </p>
          </div>

          <div>
            <Label htmlFor="landing-slug">Public slug</Label>
            <Input
              id="landing-slug"
              value={form.landing_public_slug}
              onChange={(e) =>
                setForm({ ...form, landing_public_slug: slugify(e.target.value) || e.target.value })
              }
              placeholder="try-flowforge"
            />
          </div>

          {settings.data?.landing_demo_chatbot_id ? (
            <div className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/50 px-3 py-2.5 text-sm">
              <p>
                Demo bot: <span className="font-medium">{demoChatbot.data?.name ?? 'Loading…'}</span>
                {demoPublished ? (
                  <span className="ml-2 text-emerald-700">· Published</span>
                ) : (
                  <span className="ml-2 text-amber-700">· Not published</span>
                )}
              </p>
              {form.landing_demo_instance_id ? (
                <Link
                  className="mt-1 inline-flex items-center gap-1 text-[var(--color-accent)] hover:opacity-90"
                  to={`/instances/${form.landing_demo_instance_id}/chatbots/${settings.data.landing_demo_chatbot_id}/design`}
                >
                  Open in designer
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}

          {embedPreviewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
              <iframe
                src={embedPreviewUrl}
                title="Landing demo chatbot preview"
                className="h-[420px] w-full border-0"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={importBusy} onClick={() => void importLandingDemo()}>
              <Upload className="h-4 w-4" />
              {importBusy ? 'Importing…' : 'Import flow pack'}
            </Button>
          </div>
          {importError ? <FieldError>{importError}</FieldError> : null}
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold">Use case demos</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              Configure each industry chatbot for the public{' '}
              <Link to="/use-cases" className="text-[var(--color-accent)] hover:opacity-90">
                Use cases
              </Link>{' '}
              page. Set the public slug, import the sample pack, then save. Hosted in the demo organisation above
              {hostOrgSlug ? (
                <>
                  {' '}
                  (<code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs">{hostOrgSlug}</code>)
                </>
              ) : null}
              .
            </p>
          </div>

          <ul className="space-y-4">
            {USE_CASES.map((industry) => {
              const entry = form.usecase_demos[industry.id]
              const botId = entry?.chatbot_id?.trim() || null
              const bot = botId ? usecaseChatbotById.get(botId) : null
              const flowRelUc = bot?.chatbot_flows
              const flowRowUc = Array.isArray(flowRelUc) ? flowRelUc[0] : flowRelUc
              const published = !!(flowRowUc?.published_at && flowRowUc.published_graph != null)
              const busy = usecaseImportBusy === industry.id
              return (
                <li
                  key={industry.id}
                  className="rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
                        {industry.brand}
                      </p>
                      <h3 className="text-sm font-semibold">{industry.title}</h3>
                    </div>
                    <a
                      href={sampleHref(industry.sampleFile)}
                      download={industry.sampleFile}
                      className="text-xs font-medium text-[var(--color-accent)] hover:opacity-90"
                    >
                      {industry.sampleFile}
                    </a>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <Label htmlFor={`usecase-slug-${industry.id}`}>Public slug</Label>
                      <Input
                        id={`usecase-slug-${industry.id}`}
                        value={entry?.public_slug ?? industry.suggestedSlug}
                        onChange={(e) => setUseCaseSlug(industry.id, e.target.value)}
                        placeholder={industry.suggestedSlug}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy || !!usecaseImportBusy}
                        onClick={() => void importUseCaseDemo(industry.id, 'bundled')}
                      >
                        <Upload className="h-4 w-4" />
                        {busy ? 'Importing…' : botId ? 'Re-import sample' : 'Import sample'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy || !!usecaseImportBusy}
                        onClick={() => void importUseCaseDemo(industry.id, 'file')}
                      >
                        Choose JSON…
                      </Button>
                    </div>
                  </div>

                  {botId ? (
                    <div className="mt-3 text-sm text-[var(--color-ink-muted)]">
                      <p>
                        Bot: <span className="font-medium text-[var(--color-ink)]">{bot?.name ?? 'Loading…'}</span>
                        {published ? (
                          <span className="ml-2 text-emerald-700">· Published</span>
                        ) : bot ? (
                          <span className="ml-2 text-amber-700">· Not published</span>
                        ) : null}
                      </p>
                      {form.landing_demo_instance_id ? (
                        <Link
                          className="mt-1 inline-flex items-center gap-1 text-[var(--color-accent)] hover:opacity-90"
                          to={`/instances/${form.landing_demo_instance_id}/chatbots/${botId}/design`}
                        >
                          Open in designer
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      ) : null}
                      {hostOrgSlug && entry?.public_slug ? (
                        <p className="mt-1 font-mono text-[11px]">
                          /o/{hostOrgSlug}/c/{entry.public_slug}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                      Not imported yet. Download or pick {industry.sampleFile}, then import.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          {usecaseImportError ? <FieldError>{usecaseImportError}</FieldError> : null}
        </Card>

        {error ? <FieldError>{error}</FieldError> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save platform settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}
