import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit, instanceFeatureEnabled, type VariableType } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { parseTransferEntrySettings } from '@/features/designer/model/chatbotTransfer'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { Badge } from '@/shared/ui/badge'

function parseDefaultValue(raw: string, type: VariableType): unknown {
  if (!raw.trim()) return null
  if (type === 'number') return Number(raw)
  if (type === 'boolean') return raw === 'true'
  if (type === 'array' || type === 'object') return JSON.parse(raw)
  return raw
}

export function ChatbotSettingsPage() {
  const { chatbotId } = useParams()
  const { instance, role } = useRequiredInstance()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [varKey, setVarKey] = useState('')
  const [varType, setVarType] = useState<VariableType>('string')
  const [varDefault, setVarDefault] = useState('')
  const [varRequireTransfer, setVarRequireTransfer] = useState(false)
  const [varError, setVarError] = useState<string | null>(null)
  const [publicEnabled, setPublicEnabled] = useState(false)
  const [publicSlug, setPublicSlug] = useState('')
  const [publicError, setPublicError] = useState<string | null>(null)
  const [publicHydrated, setPublicHydrated] = useState(false)
  const [requiredTransferVars, setRequiredTransferVars] = useState<string[]>([])
  const [transferEntryHydrated, setTransferEntryHydrated] = useState(false)
  const [transferEntryError, setTransferEntryError] = useState<string | null>(null)

  const chatbot = useQuery({
    queryKey: ['chatbot', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase.from('chatbots').select('*').eq('id', chatbotId!).single()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    setPublicHydrated(false)
    setTransferEntryHydrated(false)
  }, [chatbotId])

  useEffect(() => {
    if (!chatbot.data || publicHydrated) return
    setPublicEnabled(!!chatbot.data.public_enabled)
    setPublicSlug(chatbot.data.public_slug ?? '')
    setPublicHydrated(true)
  }, [chatbot.data, publicHydrated])

  useEffect(() => {
    if (!chatbot.data || transferEntryHydrated) return
    setRequiredTransferVars(parseTransferEntrySettings(chatbot.data.settings).requiredVariables)
    setTransferEntryHydrated(true)
  }, [chatbot.data, transferEntryHydrated])

  const publicUrl = useMemo(() => {
    if (!publicEnabled || !publicSlug.trim()) return null
    const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
    return `${window.location.origin}${basename}/c/${publicSlug.trim()}`
  }, [publicEnabled, publicSlug])

  const embedUrl = useMemo(() => {
    if (!publicEnabled || !publicSlug.trim()) return null
    const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
    return `${window.location.origin}${basename}/embed/${publicSlug.trim()}`
  }, [publicEnabled, publicSlug])

  const stagingUrl = useMemo(() => {
    if (!instanceFeatureEnabled(instance, 'staging') || !publicSlug.trim()) return null
    const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
    return `${window.location.origin}${basename}/c/${publicSlug.trim()}?env=staging`
  }, [instance, publicSlug])

  const stagingEmbedUrl = useMemo(() => {
    if (!instanceFeatureEnabled(instance, 'staging') || !publicSlug.trim()) return null
    const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
    return `${window.location.origin}${basename}/embed/${publicSlug.trim()}?env=staging`
  }, [instance, publicSlug])

  const iframeSnippet = useMemo(() => {
    if (!embedUrl) return null
    return `<iframe
  src="${embedUrl}"
  title="FlowForge chat"
  width="100%"
  height="560"
  style="border:0;border-radius:16px;max-width:100%;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
  allow="clipboard-write"
></iframe>`
  }, [embedUrl])

  const scriptSnippet = useMemo(() => {
    if (!publicEnabled || !publicSlug.trim()) return null
    const basename = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
    const scriptSrc = `${window.location.origin}${basename}/embed.js`
    return `<div data-flowforge-slug="${publicSlug.trim()}" data-flowforge-height="560"></div>
<script async src="${scriptSrc}"></script>`
  }, [publicEnabled, publicSlug])

  const [copied, setCopied] = useState<'iframe' | 'script' | null>(null)

  async function copySnippet(kind: 'iframe' | 'script', text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setPublicError('Could not copy to clipboard')
    }
  }

  const flowPublish = useQuery({
    queryKey: ['chatbot-flow-publish', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select(
          'published_at, published_graph, version, has_draft_changes, staging_published_at, staging_published_graph, staging_version',
        )
        .eq('chatbot_id', chatbotId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const isPublished = !!(flowPublish.data?.published_at && flowPublish.data.published_graph != null)
  const isStagingPublished = !!(
    flowPublish.data?.staging_published_at && flowPublish.data.staging_published_graph != null
  )

  const variables = useQuery({
    queryKey: ['chatbot-variable-rows', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_variables')
        .select('*')
        .eq('chatbot_id', chatbotId!)
        .eq('scope', 'global')
        .order('key')
      if (error) throw error
      return data ?? []
    },
  })

  const saveBot = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      const { error } = await supabase
        .from('chatbots')
        .update({ name: payload.name, description: payload.description || null })
        .eq('id', chatbotId!)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
  })

  const savePublic = useMutation({
    mutationFn: async () => {
      const slug = publicSlug.trim() ? slugify(publicSlug.trim()) || publicSlug.trim() : null
      if ((publicEnabled || instanceFeatureEnabled(instance, 'staging')) && !slug) {
        throw new Error('Public slug is required for production or staging links')
      }
      if (publicEnabled && !isPublished) {
        throw new Error('Publish the flow in Design before enabling public chat')
      }
      const { error } = await supabase
        .from('chatbots')
        .update({
          public_enabled: publicEnabled,
          // Keep slug even when production is off so staging links still work.
          public_slug: slug,
        })
        .eq('id', chatbotId!)
      if (error) throw error
      if (slug) setPublicSlug(slug)
    },
    onSuccess: async () => {
      setPublicError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
    onError: (err: Error) => setPublicError(err.message),
  })

  const saveTransferEntry = useMutation({
    mutationFn: async (keys: string[]) => {
      const current =
        chatbot.data?.settings && typeof chatbot.data.settings === 'object' && !Array.isArray(chatbot.data.settings)
          ? { ...(chatbot.data.settings as Record<string, unknown>) }
          : {}
      const { error } = await supabase
        .from('chatbots')
        .update({
          settings: {
            ...current,
            transferEntry: { requiredVariables: keys },
          },
        })
        .eq('id', chatbotId!)
      if (error) throw error
      return keys
    },
    onSuccess: async (keys) => {
      setRequiredTransferVars(keys)
      setTransferEntryError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
    },
    onError: (err: Error) => setTransferEntryError(err.message),
  })

  function persistTransferRequired(keys: string[]) {
    setRequiredTransferVars(keys)
    saveTransferEntry.mutate(keys)
  }

  function toggleTransferRequired(key: string, required: boolean) {
    const next = required
      ? [...new Set([...requiredTransferVars, key])]
      : requiredTransferVars.filter((k) => k !== key)
    persistTransferRequired(next)
  }

  const addVariable = useMutation({
    mutationFn: async () => {
      let defaultValue: unknown = null
      try {
        defaultValue = parseDefaultValue(varDefault, varType)
      } catch {
        throw new Error('Default value must be valid JSON for array/object types')
      }
      const key = varKey.trim()
      const { error } = await supabase.from('chatbot_variables').insert({
        chatbot_id: chatbotId!,
        key,
        value_type: varType,
        default_value: defaultValue as never,
        scope: 'global',
      })
      if (error) throw error
      return { key, requireTransfer: varRequireTransfer }
    },
    onSuccess: async (result) => {
      setVarKey('')
      setVarDefault('')
      setVarRequireTransfer(false)
      setVarError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-rows', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-defaults', chatbotId] })
      if (result.requireTransfer) {
        persistTransferRequired([...new Set([...requiredTransferVars, result.key])])
      }
    },
    onError: (err: Error) => setVarError(err.message),
  })

  const deleteVariable = useMutation({
    mutationFn: async (row: { id: string; key: string }) => {
      const { error } = await supabase.from('chatbot_variables').delete().eq('id', row.id)
      if (error) throw error
      return row.key
    },
    onSuccess: async (key) => {
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-rows', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-defaults', chatbotId] })
      if (requiredTransferVars.includes(key)) {
        persistTransferRequired(requiredTransferVars.filter((k) => k !== key))
      }
    },
  })

  if (chatbot.isLoading || !chatbot.data) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading chatbot…</p>
  }

  const bot = chatbot.data

  function onSaveBot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editable) return
    const form = new FormData(e.currentTarget)
    saveBot.mutate({
      name: String(form.get('name') ?? ''),
      description: String(form.get('description') ?? ''),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{bot.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Chatbot settings & global variables</p>
        </div>
        <ChatbotSubNav instanceId={instance.id} chatbotId={bot.id} />
      </div>

      <Card>
        <form className="space-y-3" onSubmit={onSaveBot}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={bot.name} disabled={!editable} required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={bot.description ?? ''}
              disabled={!editable}
            />
          </div>
          {editable ? (
            <Button type="submit" disabled={saveBot.isPending}>
              {saveBot.isPending ? 'Saving…' : 'Save'}
            </Button>
          ) : null}
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-medium">Public chat</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Share a link so visitors can run the published flow without signing in. Staging uses the same
          slug with <code className="text-[11px]">?env=staging</code> and does not require production to be enabled.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publicEnabled}
              disabled={!editable}
              onChange={(e) => setPublicEnabled(e.target.checked)}
            />
            Enable production public access
          </label>
          <div>
            <Label htmlFor="public-slug">Public slug</Label>
            <Input
              id="public-slug"
              value={publicSlug}
              disabled={!editable}
              onChange={(e) => setPublicSlug(e.target.value)}
              placeholder={slugify(bot.name) || 'my-chatbot'}
            />
          </div>
          {publicEnabled && !isPublished ? (
            <p className="text-xs text-amber-800">
              This chatbot is not published yet. Publish from Design before public chat will work.
            </p>
          ) : null}
          {publicUrl ? (
            <p className="break-all text-xs text-teal-800">
              Production URL:{' '}
              <a href={publicUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </p>
          ) : null}
          {instanceFeatureEnabled(instance, 'staging') ? (
            <div className="space-y-2 rounded-xl border border-sky-200/70 bg-sky-50/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-sky-900">Staging</p>
                {isStagingPublished ? (
                  <Badge className="bg-sky-100 text-sky-900">
                    v{flowPublish.data?.staging_version ?? 0}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600">Not published</Badge>
                )}
              </div>
              <p className="text-[11px] text-sky-800/90">
                Publish staging from Design to test without changing the live bot.
              </p>
              {stagingUrl && isStagingPublished ? (
                <p className="break-all text-xs text-sky-900">
                  Staging URL:{' '}
                  <a href={stagingUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                    {stagingUrl}
                  </a>
                </p>
              ) : null}
              {stagingEmbedUrl && isStagingPublished ? (
                <p className="break-all text-[11px] text-sky-800">
                  Staging embed:{' '}
                  <a href={stagingEmbedUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                    {stagingEmbedUrl}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          {embedUrl ? (
            <div className="space-y-3 rounded-xl border border-teal-200/70 bg-teal-50/40 p-3">
              <p className="text-xs font-medium text-teal-900">Website embed</p>
              <p className="break-all text-[11px] text-teal-800">
                Embed URL:{' '}
                <a href={embedUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                  {embedUrl}
                </a>
              </p>
              {iframeSnippet ? (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Label className="text-[11px]">iframe snippet</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void copySnippet('iframe', iframeSnippet)}
                    >
                      {copied === 'iframe' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <Textarea readOnly rows={7} value={iframeSnippet} className="font-mono text-[11px]" />
                </div>
              ) : null}
              {scriptSnippet ? (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Label className="text-[11px]">Script loader (auto-resize)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void copySnippet('script', scriptSnippet)}
                    >
                      {copied === 'script' ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <Textarea readOnly rows={3} value={scriptSnippet} className="font-mono text-[11px]" />
                </div>
              ) : null}
            </div>
          ) : null}
          {publicError ? <FieldError>{publicError}</FieldError> : null}
          {editable ? (
            <Button
              type="button"
              size="sm"
              disabled={savePublic.isPending}
              onClick={() => savePublic.mutate()}
            >
              {savePublic.isPending ? 'Saving…' : 'Save public settings'}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium">Global variables</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Available throughout the flow as {'{{vars.key}}'}. Mark variables as{' '}
          <span className="font-medium text-[var(--color-ink)]">Transfer variables</span> when this
          chatbot receives a transfer — the sending bot must map them (or use pass-all).
        </p>
        {editable ? (
          <form
            className="mt-4 grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              addVariable.mutate()
            }}
          >
            <div>
              <Label>Key</Label>
              <Input value={varKey} onChange={(e) => setVarKey(e.target.value)} pattern="[A-Za-z_][A-Za-z0-9_]*" required />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={varType} onChange={(e) => setVarType(e.target.value as VariableType)}>
                {(['string', 'number', 'boolean', 'date', 'array', 'object'] as VariableType[]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Default</Label>
              <Input
                value={varDefault}
                onChange={(e) => setVarDefault(e.target.value)}
                placeholder={varType === 'array' || varType === 'object' ? 'JSON' : 'Value'}
              />
            </div>
            <div className="sm:col-span-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={varRequireTransfer}
                  onChange={(e) => setVarRequireTransfer(e.target.checked)}
                />
                Required transfer variable
              </label>
              <Button type="submit" size="sm" disabled={addVariable.isPending}>
                Add variable
              </Button>
              {varError ? <FieldError>{varError}</FieldError> : null}
            </div>
          </form>
        ) : null}
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {(variables.data ?? []).map((v) => {
            const isTransferRequired = requiredTransferVars.includes(v.key)
            return (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{v.key}</span>
                    <Badge className="ml-0">{v.value_type}</Badge>
                    {isTransferRequired ? (
                      <Badge className="bg-teal-100 text-teal-900">Transfer</Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                    default: {JSON.stringify(v.default_value)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editable ? (
                    <label className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                      <input
                        type="checkbox"
                        checked={isTransferRequired}
                        disabled={saveTransferEntry.isPending}
                        onChange={(e) => toggleTransferRequired(v.key, e.target.checked)}
                      />
                      Required on transfer
                    </label>
                  ) : null}
                  {editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteVariable.mutate({ id: v.id, key: v.key })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
          {!variables.data?.length ? (
            <li className="py-3 text-sm text-[var(--color-ink-muted)]">No global variables yet.</li>
          ) : null}
        </ul>

        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Transfer variables</h3>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            When another chatbot transfers into this one, these must be provided as mapped inputs (or
            via pass-all). They show as required targets on the Transfer step.
          </p>
          <ul className="mt-3 space-y-1.5">
            {requiredTransferVars.length ? (
              requiredTransferVars.map((key) => {
                const exists = (variables.data ?? []).some((v) => v.key === key)
                return (
                  <li key={key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <code className="text-xs">{`{{vars.${key}}}`}</code>
                      {!exists ? (
                        <span className="text-[11px] text-amber-800">Not in globals — add or remove</span>
                      ) : null}
                    </span>
                    {editable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleTransferRequired(key, false)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                )
              })
            ) : (
              <li className="text-sm text-[var(--color-ink-muted)]">
                No transfer variables marked yet. Use “Required on transfer” on a global above.
              </li>
            )}
          </ul>
          {transferEntryError ? <FieldError>{transferEntryError}</FieldError> : null}
        </div>
      </Card>
    </div>
  )
}
