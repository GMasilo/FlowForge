import type { CSSProperties } from 'react'
import { normalizeBrandAccent } from '@/shared/lib/instanceBranding'
import { instanceFileUrl, isFlowForgeApiConfigured } from '@/shared/lib/flowforgeApi'
import type { Json } from '@/shared/types/database'
import { parseChatLogoIconId, type ChatLogoIconId } from '@/features/chatbots/chatbotLogoIcons'

export type ChatTypingStyle = 'normal' | 'typewriter'
export type ChatBubbleRadius = 'default' | 'pill' | 'square'
export type { ChatLogoIconId }

export type ChatbotStory = {
  id: string
  filename: string
  caption?: string | null
  durationMs?: number | null
  createdAt: string
}

export type ResolvedChatStory = ChatbotStory & {
  url: string
  kind: 'image' | 'video'
  expiresAt: string
}

export type ChatbotBranding = {
  headerColor: string | null
  headerTextColor: string | null
  bubbleUserColor: string | null
  bubbleBotColor: string | null
  bubbleBotTextColor: string | null
  pageBackground: string | null
  accentColor: string | null
  logoUrl: string | null
  logoFilename: string | null
  /** Built-in icon used when no logo image is set. */
  logoIcon: ChatLogoIconId | null
  fontFamily: string | null
  fontUrl: string | null
  fontFilename: string | null
  typingStyle: ChatTypingStyle
  showEyebrow: boolean
  bubbleRadius: ChatBubbleRadius
  /** Ephemeral header stories (24h). Max 10; filtered on resolve. */
  stories: ChatbotStory[]
}

export type OrgChatBranding = {
  display_name?: string | null
  accent_color?: string | null
  logo_url?: string | null
} | null

export type ResolvedChatBranding = ChatbotBranding & {
  eyebrow: string | null
  resolvedLogoUrl: string | null
  resolvedLogoIcon: ChatLogoIconId | null
  resolvedFontUrl: string | null
  resolvedFontFamily: string | null
  resolvedStories: ResolvedChatStory[]
}

export const FONT_PRESETS = [
  { id: 'default', label: 'Default', family: '' },
  { id: 'system', label: 'System UI', family: 'system-ui, -apple-system, Segoe UI, sans-serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet', family: '"Trebuchet MS", sans-serif' },
  { id: 'courier', label: 'Courier', family: '"Courier New", Courier, monospace' },
] as const

export const BRANDING_FONT_ACCEPT = '.woff2,.woff,.ttf,.otf'
export const BRANDING_LOGO_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.svg'
export const STORY_TTL_MS = 24 * 60 * 60 * 1000
export const STORY_MAX_COUNT = 10

const DEFAULTS: ChatbotBranding = {
  headerColor: null,
  headerTextColor: null,
  bubbleUserColor: null,
  bubbleBotColor: null,
  bubbleBotTextColor: null,
  pageBackground: null,
  accentColor: null,
  logoUrl: null,
  logoFilename: null,
  logoIcon: null,
  fontFamily: null,
  fontUrl: null,
  fontFilename: null,
  typingStyle: 'normal',
  showEyebrow: true,
  bubbleRadius: 'default',
  stories: [],
}

function clamp(n: number, min = 0, max = 255): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('')}`
}

function mix(hex: string, toward: 'white' | 'black', amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const t = toward === 'white' ? 255 : 0
  return toHex(
    rgb.r + (t - rgb.r) * amount,
    rgb.g + (t - rgb.g) * amount,
    rgb.b + (t - rgb.b) * amount,
  )
}

function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

function contrastFg(bg: string): string {
  return relativeLuminance(bg) > 0.55 ? '#042f2e' : '#ffffff'
}

function asColor(value: unknown): string | null {
  return normalizeBrandAccent(typeof value === 'string' ? value : null)
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t || null
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function storyKindFromFilename(filename: string): 'image' | 'video' | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  if (['mp4', 'webm'].includes(ext)) return 'video'
  return null
}

function parseStories(raw: unknown): ChatbotStory[] {
  if (!Array.isArray(raw)) return []
  const out: ChatbotStory[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const id = asTrimmed(row.id)
    const filename = asTrimmed(row.filename)
    const createdAt = asTrimmed(row.createdAt) ?? asTrimmed(row.created_at)
    if (!id || !filename || !createdAt) continue
    if (!storyKindFromFilename(filename)) continue
    if (seen.has(id)) continue
    seen.add(id)
    const durationRaw = row.durationMs
    const durationMs =
      typeof durationRaw === 'number' && Number.isFinite(durationRaw) && durationRaw > 0
        ? Math.round(durationRaw)
        : null
    out.push({
      id,
      filename,
      caption: asTrimmed(row.caption),
      durationMs,
      createdAt,
    })
    if (out.length >= STORY_MAX_COUNT) break
  }
  return out
}

function resolveStories(
  stories: ChatbotStory[],
  instanceId?: string | null,
  chatbotId?: string | null,
  now = Date.now(),
): ResolvedChatStory[] {
  if (!instanceId || !chatbotId || !isFlowForgeApiConfigured()) return []
  const out: ResolvedChatStory[] = []
  for (const story of stories) {
    const created = Date.parse(story.createdAt)
    if (Number.isNaN(created) || now - created >= STORY_TTL_MS) continue
    const kind = storyKindFromFilename(story.filename)
    if (!kind) continue
    try {
      out.push({
        ...story,
        kind,
        url: instanceFileUrl({
          kind: 'media',
          instanceId,
          chatbotId,
          filename: story.filename,
        }),
        expiresAt: new Date(created + STORY_TTL_MS).toISOString(),
      })
    } catch {
      // Skip stories whose media URL cannot be built.
    }
  }
  return out
}

export function parseChatbotBranding(settings: unknown): ChatbotBranding {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ...DEFAULTS, stories: [] }
  }
  const raw = (settings as { branding?: unknown }).branding
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULTS, stories: [] }
  }
  const b = raw as Record<string, unknown>
  const typing = b.typingStyle === 'typewriter' ? 'typewriter' : 'normal'
  const radius =
    b.bubbleRadius === 'pill' || b.bubbleRadius === 'square' ? b.bubbleRadius : 'default'
  return {
    headerColor: asColor(b.headerColor),
    headerTextColor: asColor(b.headerTextColor),
    bubbleUserColor: asColor(b.bubbleUserColor),
    bubbleBotColor: asColor(b.bubbleBotColor),
    bubbleBotTextColor: asColor(b.bubbleBotTextColor),
    pageBackground: asColor(b.pageBackground),
    accentColor: asColor(b.accentColor),
    logoUrl: asTrimmed(b.logoUrl),
    logoFilename: asTrimmed(b.logoFilename),
    logoIcon: parseChatLogoIconId(b.logoIcon),
    fontFamily: asTrimmed(b.fontFamily),
    fontUrl: asTrimmed(b.fontUrl),
    fontFilename: asTrimmed(b.fontFilename),
    typingStyle: typing,
    showEyebrow: asBool(b.showEyebrow, true),
    bubbleRadius: radius,
    stories: parseStories(b.stories),
  }
}

export function brandingToSettingsPatch(branding: ChatbotBranding): { [key: string]: Json | undefined } {
  const now = Date.now()
  const stories = branding.stories
    .filter((s) => {
      const t = Date.parse(s.createdAt)
      return !Number.isNaN(t) && now - t < STORY_TTL_MS
    })
    .slice(0, STORY_MAX_COUNT)
    .map((s) => ({
      id: s.id,
      filename: s.filename,
      createdAt: s.createdAt,
      ...(s.caption ? { caption: s.caption } : {}),
      ...(s.durationMs ? { durationMs: s.durationMs } : {}),
    }))

  const out: { [key: string]: Json | undefined } = {
    typingStyle: branding.typingStyle,
    showEyebrow: branding.showEyebrow,
    bubbleRadius: branding.bubbleRadius,
    stories: stories as unknown as Json,
  }
  const optional: Array<keyof ChatbotBranding> = [
    'headerColor',
    'headerTextColor',
    'bubbleUserColor',
    'bubbleBotColor',
    'bubbleBotTextColor',
    'pageBackground',
    'accentColor',
    'logoUrl',
    'logoFilename',
    'logoIcon',
    'fontFamily',
    'fontUrl',
    'fontFilename',
  ]
  for (const key of optional) {
    const value = branding[key]
    if (value) out[key] = value as Json
  }
  return out
}

export function resolveChatBranding(opts: {
  settings?: unknown
  chatbotBranding?: unknown
  org?: OrgChatBranding
  instanceId?: string | null
  chatbotId?: string | null
}): ResolvedChatBranding {
  const fromSettings =
    opts.chatbotBranding != null
      ? parseChatbotBranding({ branding: opts.chatbotBranding })
      : parseChatbotBranding(opts.settings)
  const orgAccent = asColor(opts.org?.accent_color)
  const orgLogo = asTrimmed(opts.org?.logo_url)
  const orgName = asTrimmed(opts.org?.display_name)

  const headerColor = fromSettings.headerColor ?? orgAccent
  const bubbleUserColor = fromSettings.bubbleUserColor ?? orgAccent
  const accentColor = fromSettings.accentColor ?? orgAccent

  let resolvedLogoUrl = fromSettings.logoUrl
  if (
    !resolvedLogoUrl &&
    fromSettings.logoFilename &&
    opts.instanceId &&
    opts.chatbotId &&
    isFlowForgeApiConfigured()
  ) {
    resolvedLogoUrl = instanceFileUrl({
      kind: 'media',
      instanceId: opts.instanceId,
      chatbotId: opts.chatbotId,
      filename: fromSettings.logoFilename,
    })
  }
  // Picked icons intentionally replace org logo fallback.
  if (!resolvedLogoUrl && !fromSettings.logoIcon) {
    resolvedLogoUrl = orgLogo
  }
  const resolvedLogoIcon = resolvedLogoUrl ? null : fromSettings.logoIcon

  let resolvedFontUrl = fromSettings.fontUrl
  if (
    !resolvedFontUrl &&
    fromSettings.fontFilename &&
    opts.instanceId &&
    opts.chatbotId &&
    isFlowForgeApiConfigured()
  ) {
    resolvedFontUrl = instanceFileUrl({
      kind: 'media',
      instanceId: opts.instanceId,
      chatbotId: opts.chatbotId,
      filename: fromSettings.fontFilename,
    })
  }

  const customFamily =
    resolvedFontUrl && fromSettings.fontFilename
      ? `FFChatCustom_${fromSettings.fontFilename.replace(/[^A-Za-z0-9]/g, '_')}`
      : null
  const resolvedFontFamily = customFamily ?? fromSettings.fontFamily

  return {
    ...fromSettings,
    headerColor,
    bubbleUserColor,
    accentColor,
    logoUrl: fromSettings.logoUrl ?? orgLogo,
    eyebrow: fromSettings.showEyebrow ? orgName : null,
    resolvedLogoUrl,
    resolvedLogoIcon,
    resolvedFontUrl,
    resolvedFontFamily,
    resolvedStories: resolveStories(fromSettings.stories, opts.instanceId, opts.chatbotId),
  }
}

export type ChatBrandingCssVars = Record<string, string>

/** Default teal/cyan palette matching the current chat UI. */
export function chatBrandingCssVars(branding: ResolvedChatBranding): ChatBrandingCssVars {
  const header = branding.headerColor ?? '#0d9488'
  const header2 = mix(header, 'white', 0.22)
  const headerFg = branding.headerTextColor ?? contrastFg(header)
  const user = branding.bubbleUserColor ?? '#0d9488'
  const user2 = mix(user, 'white', 0.18)
  const userFg = contrastFg(user)
  const bot = branding.bubbleBotColor ?? '#ffffff'
  const botFg = branding.bubbleBotTextColor ?? (bot === '#ffffff' ? '#1e293b' : contrastFg(bot))
  const page = branding.pageBackground ?? '#f8fafc'
  const accent = branding.accentColor ?? header
  const radius =
    branding.bubbleRadius === 'pill' ? '1.5rem' : branding.bubbleRadius === 'square' ? '0.5rem' : '1.25rem'

  const vars: ChatBrandingCssVars = {
    '--ff-chat-header': header,
    '--ff-chat-header-2': header2,
    '--ff-chat-header-fg': headerFg,
    '--ff-chat-bubble-user': user,
    '--ff-chat-bubble-user-2': user2,
    '--ff-chat-bubble-user-fg': userFg,
    '--ff-chat-bubble-bot': bot,
    '--ff-chat-bubble-bot-fg': botFg,
    '--ff-chat-page-bg': page,
    '--ff-chat-page-bg-2': mix(page === '#f8fafc' ? '#ccfbf1' : page, 'white', 0.35),
    '--ff-chat-accent': accent,
    '--ff-chat-accent-soft': mix(accent, 'white', 0.85),
    '--ff-chat-bubble-radius': radius,
  }
  if (branding.resolvedFontFamily) {
    vars['--ff-chat-font'] = branding.resolvedFontFamily
  }
  return vars
}

export function chatRootStyle(branding: ResolvedChatBranding): CSSProperties {
  const vars = chatBrandingCssVars(branding)
  const style = { ...vars } as CSSProperties
  // Keep product accent tokens in sync so send buttons / chips match chat branding.
  style['--color-accent' as keyof CSSProperties] = vars['--ff-chat-accent'] as never
  style['--color-accent-2' as keyof CSSProperties] = vars['--ff-chat-header-2'] as never
  style['--color-accent-soft' as keyof CSSProperties] = vars['--ff-chat-accent-soft'] as never
  style['--color-accent-fg' as keyof CSSProperties] = vars['--ff-chat-header-fg'] as never
  if (branding.resolvedFontFamily) {
    style.fontFamily = `var(--ff-chat-font), var(--font-sans), system-ui, sans-serif`
  }
  return style
}

/** Payload posted to embed.js so the host-page launcher matches chat branding. */
export function embedBrandingMessagePayload(branding: ResolvedChatBranding): {
  headerColor: string
  accentColor: string
  logoUrl: string | null
  logoIcon: ChatLogoIconId | null
} {
  const vars = chatBrandingCssVars(branding)
  return {
    headerColor: vars['--ff-chat-header']!,
    accentColor: vars['--ff-chat-accent']!,
    logoUrl: branding.resolvedLogoUrl,
    logoIcon: branding.resolvedLogoIcon,
  }
}

/** Ensure @font-face exists for an uploaded chat font. */
export function ensureChatFontFace(family: string, url: string): void {
  if (typeof document === 'undefined') return
  const id = `ff-chat-font-${family}`
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  const safeUrl = url.replace(/"/g, '\\"')
  style.textContent = `@font-face{font-family:"${family}";src:url("${safeUrl}") format("woff2"),url("${safeUrl}");font-display:swap;}`
  document.head.appendChild(style)
}
