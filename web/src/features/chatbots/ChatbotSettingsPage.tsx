import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit, type VariableType } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { slugify } from '@/shared/lib/utils'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
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
  const [varError, setVarError] = useState<string | null>(null)
  const [publicEnabled, setPublicEnabled] = useState(false)
  const [publicSlug, setPublicSlug] = useState('')
  const [publicError, setPublicError] = useState<string | null>(null)
  const [publicHydrated, setPublicHydrated] = useState(false)

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
  }, [chatbotId])

  useEffect(() => {
    if (!chatbot.data || publicHydrated) return
    setPublicEnabled(!!chatbot.data.public_enabled)
    setPublicSlug(chatbot.data.public_slug ?? '')
    setPublicHydrated(true)
  }, [chatbot.data, publicHydrated])

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
        .select('published_at, published_graph, version, has_draft_changes')
        .eq('chatbot_id', chatbotId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const isPublished = !!(flowPublish.data?.published_at && flowPublish.data.published_graph != null)

  const variables = useQuery({
    queryKey: ['chatbot-variables', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_variables')
        .select('*')
        .eq('chatbot_id', chatbotId!)
        .eq('scope', 'global')
        .order('key')
      if (error) throw error
      return data
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
      if (publicEnabled && !slug) throw new Error('Public slug is required when public access is enabled')
      if (publicEnabled && !isPublished) {
        throw new Error('Publish the flow in Design before enabling public chat')
      }
      const { error } = await supabase
        .from('chatbots')
        .update({
          public_enabled: publicEnabled,
          public_slug: publicEnabled ? slug : null,
        })
        .eq('id', chatbotId!)
      if (error) throw error
      if (publicEnabled && slug) setPublicSlug(slug)
      if (!publicEnabled) setPublicSlug('')
    },
    onSuccess: async () => {
      setPublicError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
    onError: (err: Error) => setPublicError(err.message),
  })

  const addVariable = useMutation({
    mutationFn: async () => {
      let defaultValue: unknown = null
      try {
        defaultValue = parseDefaultValue(varDefault, varType)
      } catch {
        throw new Error('Default value must be valid JSON for array/object types')
      }
      const { error } = await supabase.from('chatbot_variables').insert({
        chatbot_id: chatbotId!,
        key: varKey.trim(),
        value_type: varType,
        default_value: defaultValue as never,
        scope: 'global',
      })
      if (error) throw error
    },
    onSuccess: async () => {
      setVarKey('')
      setVarDefault('')
      setVarError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot-variables', chatbotId] })
    },
    onError: (err: Error) => setVarError(err.message),
  })

  const deleteVariable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chatbot_variables').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chatbot-variables', chatbotId] })
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
          Share a link so visitors can run the published flow without signing in.
        </p>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publicEnabled}
              disabled={!editable}
              onChange={(e) => setPublicEnabled(e.target.checked)}
            />
            Enable public access
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
              Public URL:{' '}
              <a href={publicUrl} className="font-medium underline" target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </p>
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
          Available throughout the flow as {'{{vars.key}}'}
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
            <div className="sm:col-span-4">
              <Button type="submit" size="sm" disabled={addVariable.isPending}>
                Add variable
              </Button>
              {varError ? <FieldError>{varError}</FieldError> : null}
            </div>
          </form>
        ) : null}
        <ul className="mt-4 divide-y divide-[var(--color-border)]">
          {variables.data?.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <span className="font-medium">{v.key}</span>
                <Badge className="ml-2">{v.value_type}</Badge>
                <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                  default: {JSON.stringify(v.default_value)}
                </div>
              </div>
              {editable ? (
                <Button variant="ghost" size="sm" onClick={() => deleteVariable.mutate(v.id)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
          {!variables.data?.length ? (
            <li className="py-3 text-sm text-[var(--color-ink-muted)]">No global variables yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  )
}
