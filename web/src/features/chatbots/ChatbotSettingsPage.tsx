import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit, instanceFeatureEnabled, type Json, type VariableType } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { cn, slugify } from '@/shared/lib/utils'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { claimChatbotPublicSlug, formatChatbotSlugError } from '@/features/chatbots/claimChatbotPublicSlug'
import { parseTransferEntrySettings } from '@/features/designer/model/chatbotTransfer'
import {
  BRANDING_FONT_ACCEPT,
  BRANDING_LOGO_ACCEPT,
  CHAT_APPEARANCE_THEMES,
  FONT_PRESETS,
  STORY_MAX_COUNT,
  brandingToSettingsPatch,
  chatAppearanceThemeClass,
  chatMessageEntranceClass,
  chatRootStyle,
  ensureChatFontFace,
  parseChatbotBranding,
  resolveChatBranding,
  type ChatBubbleRadius,
  type ChatMessageEntrance,
  type ChatTypingStyle,
  type ChatTypewriterSpeed,
  type ChatbotBranding,
  type ChatbotStory,
} from '@/features/chatbots/chatbotBranding'
import { CHAT_LOGO_ICONS, ChatLogoGlyph } from '@/features/chatbots/chatbotLogoIcons'
import { normalizeBrandAccent } from '@/shared/lib/instanceBranding'
import { instanceFileUrl, uploadDesignerMedia } from '@/shared/lib/flowforgeApi'
import { publicChatUrl, publicEmbedUrl } from '@/shared/lib/publicChatUrls'
import { ChatStoriesRing } from '@/features/chat/ChatStoriesRing'
import {
  STORY_MEDIA_ACCEPT,
  isStoryActive,
  newStoryId,
  pruneExpiredStories,
  storyKindFromFilename,
  storyRemainingLabel,
} from '@/features/chat/chatStories'
import { SECTION_HELP } from '@/shared/help/pageHelp'
import { SectionHeading } from '@/shared/ui/help-tooltip'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { Badge } from '@/shared/ui/badge'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

const VARIABLE_TYPES: VariableType[] = ['string', 'number', 'boolean', 'date', 'array', 'object']

function parseDefaultValue(raw: string, type: VariableType): unknown {
  if (!raw.trim()) return null
  if (type === 'number') return Number(raw)
  if (type === 'boolean') return raw === 'true'
  if (type === 'array' || type === 'object') return JSON.parse(raw)
  return raw
}

function formatDefaultValue(value: unknown, type: VariableType): string {
  if (value == null) return ''
  if (type === 'array' || type === 'object') return JSON.stringify(value)
  if (type === 'boolean') return value === true ? 'true' : 'false'
  return String(value)
}

function ColorField({
  id,
  label,
  value,
  disabled,
  onChange,
  placeholder = '#0f766e',
}: {
  id: string
  label: string
  value: string
  disabled?: boolean
  onChange: (next: string) => void
  placeholder?: string
}) {
  const picker = normalizeBrandAccent(value) ?? placeholder
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent p-1"
          value={picker}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono"
        />
      </div>
    </div>
  )
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editKey, setEditKey] = useState('')
  const [editType, setEditType] = useState<VariableType>('string')
  const [editDefault, setEditDefault] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [publicEnabled, setPublicEnabled] = useState(false)
  const [publicSlug, setPublicSlug] = useState('')
  const [publicError, setPublicError] = useState<string | null>(null)
  const [publicHydrated, setPublicHydrated] = useState(false)
  const [requiredTransferVars, setRequiredTransferVars] = useState<string[]>([])
  const [transferEntryHydrated, setTransferEntryHydrated] = useState(false)
  const [transferEntryError, setTransferEntryError] = useState<string | null>(null)
  const [branding, setBranding] = useState<ChatbotBranding>(() => parseChatbotBranding(null))
  const [brandingHydrated, setBrandingHydrated] = useState(false)
  const [brandingError, setBrandingError] = useState<string | null>(null)
  const [fontPreset, setFontPreset] = useState('default')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const fontInputRef = useRef<HTMLInputElement>(null)
  const storyInputRef = useRef<HTMLInputElement>(null)

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
    setBrandingHydrated(false)
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

  useEffect(() => {
    if (!chatbot.data || brandingHydrated) return
    const parsed = parseChatbotBranding(chatbot.data.settings)
    setBranding(parsed)
    const match = FONT_PRESETS.find((p) => p.family && p.family === parsed.fontFamily)
    if (parsed.fontFilename || parsed.fontUrl) setFontPreset('custom')
    else if (match) setFontPreset(match.id)
    else if (parsed.fontFamily) setFontPreset('custom')
    else setFontPreset('default')
    setBrandingHydrated(true)
  }, [chatbot.data, brandingHydrated])

  const publicUrl = useMemo(() => {
    if (!publicEnabled || !publicSlug.trim()) return null
    return publicChatUrl(instance.slug, publicSlug.trim())
  }, [publicEnabled, publicSlug, instance.slug])

  const embedUrl = useMemo(() => {
    if (!publicEnabled || !publicSlug.trim()) return null
    return publicEmbedUrl(instance.slug, publicSlug.trim())
  }, [publicEnabled, publicSlug, instance.slug])

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
    const scriptSrc = `${window.location.origin}${basename}/embed.js?v=20260908-org-slug`
    const resolved = resolveChatBranding({
      settings: { branding: brandingToSettingsPatch(branding) },
      org: instance.brand_apply_to_public_chat
        ? {
            display_name: instance.brand_display_name || instance.name,
            accent_color: instance.brand_accent_color,
            logo_url: instance.brand_logo_url,
          }
        : null,
      instanceId: instance.id,
      chatbotId: chatbotId ?? null,
    })
    const header = resolved.headerColor ?? ''
    const accent = resolved.accentColor ?? header
    const logo = resolved.resolvedLogoUrl ?? ''
    const logoIcon = resolved.resolvedLogoIcon ?? ''
    const attrs = [
      `data-flowforge-org="${instance.slug}"`,
      `data-flowforge-slug="${publicSlug.trim()}"`,
      header ? `data-flowforge-header-color="${header}"` : '',
      accent ? `data-flowforge-accent="${accent}"` : '',
      logo ? `data-flowforge-logo="${logo}"` : '',
      !logo && logoIcon ? `data-flowforge-logo-icon="${logoIcon}"` : '',
    ]
      .filter(Boolean)
      .join(' ')
    return `<script async src="${scriptSrc}" ${attrs}></script>`
  }, [publicEnabled, publicSlug, branding, instance, chatbotId])

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
      if (slug) {
        await claimChatbotPublicSlug({
          chatbotId: chatbotId!,
          instanceId: instance.id,
          slug,
          extra: { public_enabled: publicEnabled },
        })
      } else {
        const { error } = await supabase
          .from('chatbots')
          .update({
            public_enabled: publicEnabled,
            public_slug: null,
          })
          .eq('id', chatbotId!)
        if (error) throw error
      }
      if (slug) setPublicSlug(slug)
    },
    onSuccess: async () => {
      setPublicError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
    },
    onError: (err: Error) => setPublicError(formatChatbotSlugError(err, publicSlug.trim() || undefined)),
  })

  const saveTransferEntry = useMutation({
    mutationFn: async (keys: string[]) => {
      const current =
        chatbot.data?.settings && typeof chatbot.data.settings === 'object' && !Array.isArray(chatbot.data.settings)
          ? { ...(chatbot.data.settings as { [key: string]: Json | undefined }) }
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

  const saveBranding = useMutation({
    mutationFn: async (next: ChatbotBranding) => {
      for (const key of [
        'headerColor',
        'headerTextColor',
        'bubbleUserColor',
        'bubbleBotColor',
        'bubbleBotTextColor',
        'pageBackground',
        'accentColor',
      ] as const) {
        const raw = next[key]
        if (raw && !normalizeBrandAccent(raw)) {
          throw new Error(`${key} must be a valid hex colour (#rrggbb)`)
        }
      }
      const current =
        chatbot.data?.settings && typeof chatbot.data.settings === 'object' && !Array.isArray(chatbot.data.settings)
          ? { ...(chatbot.data.settings as { [key: string]: Json | undefined }) }
          : {}
      const { error } = await supabase
        .from('chatbots')
        .update({
          settings: {
            ...current,
            branding: brandingToSettingsPatch(next),
          },
        })
        .eq('id', chatbotId!)
      if (error) throw error
      return next
    },
    onSuccess: async () => {
      setBrandingError(null)
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-branding', chatbotId] })
    },
    onError: (err: Error) => setBrandingError(err.message),
  })

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!chatbotId) throw new Error('Missing chatbot')
      const result = await uploadDesignerMedia({ instanceId: instance.id, chatbotId, file })
      return result.filename as string
    },
    onSuccess: (filename) => {
      setBranding((b) => ({ ...b, logoFilename: filename, logoUrl: null, logoIcon: null }))
      setBrandingError(null)
    },
    onError: (err: Error) => setBrandingError(err.message),
  })

  const uploadFont = useMutation({
    mutationFn: async (file: File) => {
      if (!chatbotId) throw new Error('Missing chatbot')
      const result = await uploadDesignerMedia({ instanceId: instance.id, chatbotId, file })
      return result.filename as string
    },
    onSuccess: (filename) => {
      setFontPreset('custom')
      setBranding((b) => ({ ...b, fontFilename: filename, fontUrl: null, fontFamily: null }))
      setBrandingError(null)
    },
    onError: (err: Error) => setBrandingError(err.message),
  })

  const uploadStory = useMutation({
    mutationFn: async (file: File) => {
      if (!chatbotId) throw new Error('Missing chatbot')
      const kind = storyKindFromFilename(file.name)
      if (!kind) throw new Error('Stories support images (jpg, png, gif, webp) and short videos (mp4, webm)')
      const active = pruneExpiredStories(branding.stories)
      if (active.length >= STORY_MAX_COUNT) {
        throw new Error(`You can have at most ${STORY_MAX_COUNT} active stories`)
      }
      const result = await uploadDesignerMedia({ instanceId: instance.id, chatbotId, file })
      return result.filename as string
    },
    onSuccess: (filename) => {
      const story: ChatbotStory = {
        id: newStoryId(),
        filename,
        caption: null,
        durationMs: null,
        createdAt: new Date().toISOString(),
      }
      setBranding((b) => ({
        ...b,
        stories: pruneExpiredStories([...b.stories, story]),
      }))
      setBrandingError(null)
    },
    onError: (err: Error) => setBrandingError(err.message),
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

  function patchBranding(patch: Partial<ChatbotBranding>) {
    setBranding((b) => ({ ...b, ...patch }))
  }

  function onFontPresetChange(id: string) {
    setFontPreset(id)
    if (id === 'default') {
      patchBranding({ fontFamily: null, fontFilename: null, fontUrl: null })
      return
    }
    if (id === 'custom') return
    const preset = FONT_PRESETS.find((p) => p.id === id)
    patchBranding({ fontFamily: preset?.family || null, fontFilename: null, fontUrl: null })
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
      if (editingId) {
        setEditingId(null)
        setEditError(null)
      }
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-rows', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-defaults', chatbotId] })
      if (requiredTransferVars.includes(key)) {
        persistTransferRequired(requiredTransferVars.filter((k) => k !== key))
      }
    },
  })

  function beginEditVariable(row: {
    id: string
    key: string
    value_type: VariableType
    default_value: unknown
  }) {
    setEditingId(row.id)
    setEditKey(row.key)
    setEditType(row.value_type)
    setEditDefault(formatDefaultValue(row.default_value, row.value_type))
    setEditError(null)
  }

  function cancelEditVariable() {
    setEditingId(null)
    setEditError(null)
  }

  const updateVariable = useMutation({
    mutationFn: async (row: {
      id: string
      previousKey: string
      key: string
      valueType: VariableType
      defaultRaw: string
    }) => {
      const key = row.key.trim()
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new Error(
          'Key must start with a letter or underscore and use only letters, numbers, and underscores',
        )
      }
      let defaultValue: unknown = null
      try {
        defaultValue = parseDefaultValue(row.defaultRaw, row.valueType)
      } catch {
        throw new Error('Default value must be valid JSON for array/object types')
      }
      if (row.valueType === 'number' && defaultValue != null && Number.isNaN(defaultValue)) {
        throw new Error('Default value must be a valid number')
      }
      const { data, error } = await supabase
        .from('chatbot_variables')
        .update({
          key,
          value_type: row.valueType,
          default_value: (defaultValue ?? null) as never,
        })
        .eq('id', row.id)
        .eq('scope', 'global')
        .select('id, key, value_type, default_value')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Could not update variable (no row updated)')
      return { previousKey: row.previousKey, key: data.key, row: data }
    },
    onSuccess: async (result) => {
      setEditingId(null)
      setEditError(null)
      qc.setQueryData(
        ['chatbot-variable-rows', chatbotId],
        (prev: { id: string; key: string; value_type: VariableType; default_value: unknown }[] | undefined) =>
          (prev ?? []).map((v) =>
            v.id === result.row.id
              ? {
                  ...v,
                  key: result.row.key,
                  value_type: result.row.value_type,
                  default_value: result.row.default_value,
                }
              : v,
          ),
      )
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-rows', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-variable-defaults', chatbotId] })
      if (result.previousKey !== result.key && requiredTransferVars.includes(result.previousKey)) {
        persistTransferRequired(
          requiredTransferVars.map((k) => (k === result.previousKey ? result.key : k)),
        )
      }
    },
    onError: (err: Error) => setEditError(err.message),
  })

  const resolvedPreview = useMemo(
    () =>
      resolveChatBranding({
        settings: { branding: brandingToSettingsPatch(branding) },
        org: instance.brand_apply_to_public_chat
          ? {
              display_name: instance.brand_display_name || instance.name,
              accent_color: instance.brand_accent_color,
              logo_url: instance.brand_logo_url,
            }
          : null,
        instanceId: instance.id,
        chatbotId: chatbotId ?? null,
      }),
    [branding, instance, chatbotId],
  )

  useEffect(() => {
    if (resolvedPreview.resolvedFontFamily && resolvedPreview.resolvedFontUrl) {
      ensureChatFontFace(resolvedPreview.resolvedFontFamily, resolvedPreview.resolvedFontUrl)
    }
  }, [resolvedPreview.resolvedFontFamily, resolvedPreview.resolvedFontUrl])

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
        <SectionHeading title="Chat appearance" help={SECTION_HELP.chatAppearance} size="lg" className="mt-0" />
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Brand this chatbot’s public chat, website embed, and designer preview. Empty fields fall back to organisation
          branding when enabled.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div>
              <Label>Theme</Label>
              <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                Pick a skin for the overall chat chrome. Colour fields below still override theme defaults when set.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CHAT_APPEARANCE_THEMES.map((theme) => {
                  const selected = branding.appearanceTheme === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      disabled={!editable}
                      onClick={() =>
                        patchBranding({
                          appearanceTheme: theme.id,
                          bubbleRadius: theme.bubbleRadius,
                        })
                      }
                      className={cn(
                        'rounded-xl border p-3 text-left transition',
                        selected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50 ring-1 ring-[var(--color-accent)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50',
                        !editable && 'cursor-default opacity-70',
                      )}
                    >
                      <span
                        className="mb-2 flex h-10 overflow-hidden rounded-lg ring-1 ring-black/5"
                        aria-hidden
                      >
                        <span className="w-[42%]" style={{ background: theme.swatch[0] }} />
                        <span className="w-[38%]" style={{ background: theme.swatch[1] }} />
                        <span className="flex-1" style={{ background: theme.swatch[2] }} />
                      </span>
                      <span className="block text-sm font-semibold text-[var(--color-ink)]">{theme.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-ink-muted)]">
                        {theme.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                id="brand-header"
                label="Header colour"
                value={branding.headerColor ?? ''}
                disabled={!editable}
                onChange={(v) => patchBranding({ headerColor: v || null })}
              />
              <ColorField
                id="brand-header-text"
                label="Header text colour"
                value={branding.headerTextColor ?? ''}
                disabled={!editable}
                onChange={(v) => patchBranding({ headerTextColor: v || null })}
                placeholder="#ffffff"
              />
              <ColorField
                id="brand-bubble-user"
                label="User bubble colour"
                value={branding.bubbleUserColor ?? ''}
                disabled={!editable}
                onChange={(v) => patchBranding({ bubbleUserColor: v || null })}
              />
              <ColorField
                id="brand-bubble-bot"
                label="Bot bubble colour"
                value={branding.bubbleBotColor ?? ''}
                disabled={!editable}
                onChange={(v) => patchBranding({ bubbleBotColor: v || null })}
                placeholder="#ffffff"
              />
              <ColorField
                id="brand-accent"
                label="Accent colour"
                value={branding.accentColor ?? ''}
                disabled={!editable}
                onChange={(v) => patchBranding({ accentColor: v || null })}
              />
              <ColorField
                id="brand-page-bg"
                label="Page background"
                value={branding.pageBackground ?? ''}
                disabled={!editable}
                onChange={(v) => patchBranding({ pageBackground: v || null })}
                placeholder="#f8fafc"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brand-typing">Typing style</Label>
                <Select
                  id="brand-typing"
                  value={branding.typingStyle}
                  disabled={!editable}
                  onChange={(e) => patchBranding({ typingStyle: e.target.value as ChatTypingStyle })}
                >
                  <option value="normal">Normal</option>
                  <option value="typewriter">Typewriter</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="brand-typewriter-speed">Typewriter speed</Label>
                <Select
                  id="brand-typewriter-speed"
                  value={branding.typewriterSpeed}
                  disabled={!editable || branding.typingStyle !== 'typewriter'}
                  onChange={(e) =>
                    patchBranding({ typewriterSpeed: e.target.value as ChatTypewriterSpeed })
                  }
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="brand-entrance">Message entrance</Label>
                <Select
                  id="brand-entrance"
                  value={branding.messageEntrance}
                  disabled={!editable}
                  onChange={(e) =>
                    patchBranding({ messageEntrance: e.target.value as ChatMessageEntrance })
                  }
                >
                  <option value="none">None</option>
                  <option value="fade">Fade</option>
                  <option value="rise">Rise</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="brand-radius">Bubble shape</Label>
                <Select
                  id="brand-radius"
                  value={branding.bubbleRadius}
                  disabled={!editable}
                  onChange={(e) => patchBranding({ bubbleRadius: e.target.value as ChatBubbleRadius })}
                >
                  <option value="default">Rounded</option>
                  <option value="pill">Pill</option>
                  <option value="square">Soft square</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="brand-font">Font</Label>
                <Select
                  id="brand-font"
                  value={fontPreset}
                  disabled={!editable}
                  onChange={(e) => onFontPresetChange(e.target.value)}
                >
                  {FONT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Custom upload…</option>
                </Select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <input
                  ref={fontInputRef}
                  type="file"
                  accept={BRANDING_FONT_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) uploadFont.mutate(file)
                  }}
                />
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={uploadFont.isPending}
                    onClick={() => fontInputRef.current?.click()}
                  >
                    {uploadFont.isPending ? 'Uploading…' : branding.fontFilename ? 'Replace font' : 'Upload font'}
                  </Button>
                ) : null}
                {branding.fontFilename ? (
                  <p className="truncate text-[11px] text-[var(--color-ink-muted)]">{branding.fontFilename}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Logo / icon</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={BRANDING_LOGO_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) uploadLogo.mutate(file)
                  }}
                />
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {editable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={uploadLogo.isPending}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploadLogo.isPending
                        ? 'Uploading…'
                        : branding.logoFilename || branding.logoUrl
                          ? 'Replace logo'
                          : 'Upload logo'}
                    </Button>
                  ) : null}
                  {(branding.logoFilename || branding.logoUrl || branding.logoIcon) && editable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patchBranding({ logoFilename: null, logoUrl: null, logoIcon: null })
                      }
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                {branding.logoFilename ? (
                  <p className="mt-1 truncate text-[11px] text-[var(--color-ink-muted)]">{branding.logoFilename}</p>
                ) : null}
                <div className="mt-2">
                  <Label htmlFor="brand-logo-url">Or logo URL</Label>
                  <Input
                    id="brand-logo-url"
                    type="url"
                    value={branding.logoUrl ?? ''}
                    disabled={!editable}
                    onChange={(e) =>
                      patchBranding({
                        logoUrl: e.target.value.trim() || null,
                        logoFilename: e.target.value.trim() ? null : branding.logoFilename,
                        logoIcon: e.target.value.trim() ? null : branding.logoIcon,
                      })
                    }
                    placeholder="https://cdn.example.com/logo.png"
                  />
                </div>
                <div className="mt-3">
                  <Label>Or pick an icon</Label>
                  <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
                    Used in the chat header and embed launcher when no logo image is set.
                  </p>
                  <div className="mt-2 grid grid-cols-8 gap-1.5">
                    {CHAT_LOGO_ICONS.map(({ id, label, Icon }) => {
                      const selected = branding.logoIcon === id && !branding.logoUrl && !branding.logoFilename
                      return (
                        <button
                          key={id}
                          type="button"
                          title={label}
                          aria-label={label}
                          aria-pressed={selected}
                          disabled={!editable}
                          onClick={() =>
                            patchBranding({
                              logoIcon: id,
                              logoUrl: null,
                              logoFilename: null,
                            })
                          }
                          className={
                            selected
                              ? 'grid h-9 w-9 place-items-center rounded-lg border border-teal-600 bg-teal-50 text-teal-800'
                              : 'grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-teal-500/50 hover:text-[var(--color-ink)] disabled:opacity-50'
                          }
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <label className="inline-flex items-start gap-2 self-end text-sm text-[var(--color-ink)]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                  checked={branding.showEyebrow}
                  disabled={!editable}
                  onChange={(e) => patchBranding({ showEyebrow: e.target.checked })}
                />
                <span>
                  Show eyebrow label
                  <span className="mt-0.5 block text-[var(--color-ink-muted)]">
                    Small label above the bot name (organisation name when set).
                  </span>
                </span>
              </label>

              <div className="sm:col-span-2 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Label>Stories</Label>
                    <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
                      Instagram-style media on the chat header logo. Each story expires after 24 hours.
                      Max {STORY_MAX_COUNT} active.
                    </p>
                  </div>
                  {editable ? (
                    <>
                      <input
                        ref={storyInputRef}
                        type="file"
                        accept={STORY_MEDIA_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (file) uploadStory.mutate(file)
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={
                          uploadStory.isPending ||
                          pruneExpiredStories(branding.stories).length >= STORY_MAX_COUNT
                        }
                        onClick={() => storyInputRef.current?.click()}
                      >
                        {uploadStory.isPending ? 'Uploading…' : 'Add story'}
                      </Button>
                    </>
                  ) : null}
                </div>
                {branding.stories.length === 0 ? (
                  <p className="text-xs text-[var(--color-ink-muted)]">No stories yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {branding.stories.map((story, index) => {
                      const active = isStoryActive(story)
                      const kind = storyKindFromFilename(story.filename)
                      const thumbUrl =
                        chatbotId && kind
                          ? instanceFileUrl({
                              kind: 'media',
                              instanceId: instance.id,
                              chatbotId,
                              filename: story.filename,
                            })
                          : null
                      return (
                        <li
                          key={story.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
                        >
                          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--color-surface-2)] text-[10px] text-[var(--color-ink-muted)]">
                            {thumbUrl && kind === 'image' ? (
                              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                            ) : thumbUrl && kind === 'video' ? (
                              <video src={thumbUrl} className="h-full w-full object-cover" muted playsInline />
                            ) : (
                              '—'
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-xs font-medium text-[var(--color-ink)]">
                                {story.filename}
                              </p>
                              <Badge className="text-[10px]">
                                {active ? storyRemainingLabel(story.createdAt) : 'Expired'}
                              </Badge>
                            </div>
                            <Input
                              value={story.caption ?? ''}
                              disabled={!editable}
                              placeholder="Caption (optional)"
                              className="h-8 text-xs"
                              onChange={(e) => {
                                const caption = e.target.value.trim() || null
                                setBranding((b) => ({
                                  ...b,
                                  stories: b.stories.map((s) =>
                                    s.id === story.id ? { ...s, caption } : s,
                                  ),
                                }))
                              }}
                            />
                          </div>
                          {editable ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 !px-0"
                                disabled={index === 0}
                                aria-label="Move up"
                                onClick={() =>
                                  setBranding((b) => {
                                    if (index === 0) return b
                                    const next = [...b.stories]
                                    const tmp = next[index - 1]!
                                    next[index - 1] = next[index]!
                                    next[index] = tmp
                                    return { ...b, stories: next }
                                  })
                                }
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 !px-0"
                                disabled={index >= branding.stories.length - 1}
                                aria-label="Move down"
                                onClick={() =>
                                  setBranding((b) => {
                                    if (index >= b.stories.length - 1) return b
                                    const next = [...b.stories]
                                    const tmp = next[index + 1]!
                                    next[index + 1] = next[index]!
                                    next[index] = tmp
                                    return { ...b, stories: next }
                                  })
                                }
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 !px-0"
                                aria-label="Remove story"
                                onClick={() =>
                                  setBranding((b) => ({
                                    ...b,
                                    stories: b.stories.filter((s) => s.id !== story.id),
                                  }))
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {brandingError ? <FieldError>{brandingError}</FieldError> : null}
            {editable ? (
              <Button
                type="button"
                size="sm"
                disabled={saveBranding.isPending}
                onClick={() => saveBranding.mutate(branding)}
              >
                {saveBranding.isPending ? 'Saving…' : 'Save appearance'}
              </Button>
            ) : null}
          </div>

          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-sm',
              chatAppearanceThemeClass(resolvedPreview.appearanceTheme),
            )}
            style={chatRootStyle(resolvedPreview)}
          >
            <div
              data-ff-chat-header
              className="relative flex items-center gap-2 px-3 py-2.5"
              style={{
                background: 'var(--ff-chat-header-gradient)',
                color: 'var(--ff-chat-header-fg)',
              }}
            >
              <div data-ff-chat-header-content className="relative flex min-w-0 flex-1 items-center gap-2">
              <ChatStoriesRing
                stories={resolvedPreview.resolvedStories}
                chatbotId={`${chatbotId || 'bot'}:settings-preview`}
                size="sm"
                viewerMode="absolute"
              >
                <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white/20 ring-1 ring-white/30">
                  {resolvedPreview.resolvedLogoUrl ? (
                    <img src={resolvedPreview.resolvedLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ChatLogoGlyph id={resolvedPreview.resolvedLogoIcon} className="h-3.5 w-3.5" />
                  )}
                </span>
              </ChatStoriesRing>
              <div className="min-w-0">
                {resolvedPreview.showEyebrow ? (
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-75">
                    {resolvedPreview.eyebrow || 'Preview'}
                  </p>
                ) : null}
                <p className="truncate text-sm font-semibold">{bot.name}</p>
              </div>
              </div>
            </div>
            <div
              className="space-y-2 px-3 py-3"
              style={{ background: 'var(--ff-chat-page-gradient)' }}
            >
              <div
                key={`preview-bot-${branding.messageEntrance}-${branding.typingStyle}-${branding.typewriterSpeed}-${branding.appearanceTheme}`}
                className={cn(
                  'ff-chat-bubble-bot max-w-[90%] px-3 py-2 text-xs shadow-sm',
                  chatMessageEntranceClass(branding.messageEntrance, true),
                )}
                style={{
                  background: 'var(--ff-chat-bubble-bot)',
                  color: 'var(--ff-chat-bubble-bot-fg)',
                  borderRadius: 'var(--ff-chat-bubble-radius)',
                }}
              >
                {branding.typingStyle === 'typewriter'
                  ? `Hello… typing ${branding.typewriterSpeed}.`
                  : 'Hello — how can I help?'}
              </div>
              <div className="flex justify-end">
                <div
                  key={`preview-user-${branding.messageEntrance}-${branding.appearanceTheme}`}
                  className={cn(
                    'ff-chat-bubble-user max-w-[90%] px-3 py-2 text-xs shadow-sm',
                    chatMessageEntranceClass(branding.messageEntrance, true),
                  )}
                  style={{
                    background: 'linear-gradient(135deg, var(--ff-chat-bubble-user), var(--ff-chat-bubble-user-2))',
                    color: 'var(--ff-chat-bubble-user-fg)',
                    borderRadius: 'var(--ff-chat-bubble-radius)',
                    borderBottomRightRadius: '0.35rem',
                  }}
                >
                  Looks good!
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeading title="Public chat" help={SECTION_HELP.publicChat} size="lg" className="mt-0" />
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Share a link so visitors can run the published production flow without signing in. URLs are scoped to this
          organisation ({instance.slug}). For staging tests, use the{' '}
          <Link className="font-medium underline" to={`/instances/${instance.id}/chatbots/${chatbotId}/test`}>
            Test
          </Link>{' '}
          tab — it provides one unique staging link with live monitoring.
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
                Publish staging from Design, then open the{' '}
                <Link className="font-medium underline" to={`/instances/${instance.id}/chatbots/${chatbotId}/test`}>
                  Test
                </Link>{' '}
                tab for your staging link and live monitor. Staging is not shared here — only production public URLs
                appear on this page.
              </p>
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
                  <p className="mb-1.5 text-[11px] text-teal-800/90">
                    One script tag — includes the floating chat button, panel, styles, and auto-resizing iframe. No extra
                    CSS or markup on your site.
                  </p>
                  <Textarea readOnly rows={2} value={scriptSnippet} className="font-mono text-[11px]" />
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
        <SectionHeading title="Global variables" help={SECTION_HELP.globalVariables} size="lg" className="mt-0" />
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
                {VARIABLE_TYPES.map((t) => (
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
            const isEditing = editingId === v.id
            if (isEditing && editable) {
              return (
                <li key={v.id} className="py-3">
                  <form
                    className="grid gap-3 sm:grid-cols-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setEditError(null)
                      updateVariable.mutate({
                        id: v.id,
                        previousKey: v.key,
                        key: editKey,
                        valueType: editType,
                        defaultRaw: editDefault,
                      })
                    }}
                  >
                    <div>
                      <Label>Key</Label>
                      <Input
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as VariableType)}
                      >
                        {VARIABLE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Default</Label>
                      <Input
                        value={editDefault}
                        onChange={(e) => setEditDefault(e.target.value)}
                        placeholder={editType === 'array' || editType === 'object' ? 'JSON' : 'Value'}
                      />
                    </div>
                    <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
                      <Button type="submit" size="sm" disabled={updateVariable.isPending}>
                        {updateVariable.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditVariable}
                        disabled={updateVariable.isPending}
                      >
                        Cancel
                      </Button>
                      {editError ? <FieldError>{editError}</FieldError> : null}
                    </div>
                  </form>
                </li>
              )
            }
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
                      onClick={() =>
                        beginEditVariable({
                          id: v.id,
                          key: v.key,
                          value_type: v.value_type,
                          default_value: v.default_value,
                        })
                      }
                    >
                      Edit
                    </Button>
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
