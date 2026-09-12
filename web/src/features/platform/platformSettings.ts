import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { appBasePath, publicEmbedUrl } from '@/shared/lib/publicChatUrls'
import type { UseCaseIndustryId } from '@/features/landing/useCases'

export type PublicPlatformSettings = {
  hero_tagline: string | null
  hero_description: string | null
  about_text: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_url: string | null
  landing_public_slug: string | null
  landing_org_slug: string | null
  /** Industry id → public slug configured in Platform settings. */
  usecase_slugs: Partial<Record<UseCaseIndustryId, string>>
}

export type UseCaseDemoEntry = {
  chatbot_id?: string | null
  public_slug?: string | null
}

export type UseCaseDemosMap = Partial<Record<UseCaseIndustryId, UseCaseDemoEntry>>

export type PlatformSettingsRow = Omit<PublicPlatformSettings, 'landing_org_slug' | 'usecase_slugs'> & {
  id: string
  landing_demo_instance_id: string | null
  landing_demo_chatbot_id: string | null
  usecase_demos: UseCaseDemosMap
  updated_at: string
  updated_by: string | null
}

export const PLATFORM_SETTINGS_ID = 'default'
export const platformSettingsQueryKey = ['platform-settings'] as const
export const publicPlatformSettingsQueryKey = ['platform-settings-public'] as const

export { appBasePath }

export function landingEmbedUrl(
  publicSlug: string | null | undefined,
  orgSlug?: string | null | undefined,
): string | null {
  const slug = publicSlug?.trim()
  if (!slug) return null
  return publicEmbedUrl(orgSlug?.trim() || null, slug)
}

export function embedScriptUrl(): string {
  return `${window.location.origin}${appBasePath()}/embed.js`
}

export type EmbedScriptOptions = {
  slug: string
  org?: string
  base?: string
  panelTitle?: string
  panelSubtitle?: string
  position?: 'bottom-right' | 'bottom-left'
}

let embedScriptPromise: Promise<void> | null = null

function applyEmbedScriptAttributes(script: HTMLScriptElement, options?: EmbedScriptOptions) {
  if (!options?.slug) return
  script.setAttribute('data-flowforge-slug', options.slug.trim())
  if (options.org?.trim()) script.setAttribute('data-flowforge-org', options.org.trim())
  else script.removeAttribute('data-flowforge-org')
  if (options.base) script.setAttribute('data-flowforge-base', options.base.replace(/\/$/, ''))
  if (options.panelTitle) script.setAttribute('data-flowforge-panel-title', options.panelTitle)
  if (options.panelSubtitle) script.setAttribute('data-flowforge-panel-subtitle', options.panelSubtitle)
  if (options.position) script.setAttribute('data-flowforge-position', options.position)
}

function mountEmbedWidget(options: EmbedScriptOptions) {
  window.FlowForgeEmbed?.init({
    slug: options.slug.trim(),
    org: options.org?.trim() || undefined,
    base: options.base?.replace(/\/$/, ''),
    panelTitle: options.panelTitle,
    panelSubtitle: options.panelSubtitle,
    position: options.position,
  })
}

/** Loads embed.js once and mounts the floating chat launcher + panel. */
export function ensureEmbedScriptLoaded(options?: EmbedScriptOptions): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()

  const src = embedScriptUrl()

  function afterLoad() {
    if (options?.slug) {
      mountEmbedWidget(options)
    } else {
      window.FlowForgeEmbed?.refresh()
    }
  }

  if (window.FlowForgeEmbed) {
    afterLoad()
    return Promise.resolve()
  }

  const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
  if (existing) {
    applyEmbedScriptAttributes(existing, options)
    if (window.FlowForgeEmbed) {
      afterLoad()
      return Promise.resolve()
    }
    if (embedScriptPromise) {
      return embedScriptPromise.then(() => afterLoad())
    }
    embedScriptPromise = new Promise((resolve, reject) => {
      existing.addEventListener(
        'load',
        () => {
          afterLoad()
          resolve()
        },
        { once: true },
      )
      existing.addEventListener('error', () => reject(new Error('Failed to load embed script')), {
        once: true,
      })
    })
    return embedScriptPromise
  }

  embedScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = src
    applyEmbedScriptAttributes(script, options)
    script.onload = () => {
      afterLoad()
      resolve()
    }
    script.onerror = () => reject(new Error('Failed to load embed script'))
    document.body.appendChild(script)
  })
  return embedScriptPromise
}

export async function fetchPublicPlatformSettings(): Promise<PublicPlatformSettings> {
  const { data, error } = await supabase.rpc('get_platform_settings')
  if (error) throw error
  const row = (data ?? {}) as Partial<PublicPlatformSettings> & {
    usecase_slugs?: Record<string, string> | null
  }
  const rawSlugs = row.usecase_slugs && typeof row.usecase_slugs === 'object' ? row.usecase_slugs : {}
  const usecase_slugs: Partial<Record<UseCaseIndustryId, string>> = {}
  for (const [key, value] of Object.entries(rawSlugs)) {
    if (typeof value === 'string' && value.trim()) {
      usecase_slugs[key as UseCaseIndustryId] = value.trim()
    }
  }
  return {
    hero_tagline: row.hero_tagline ?? null,
    hero_description: row.hero_description ?? null,
    about_text: row.about_text ?? null,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    contact_url: row.contact_url ?? null,
    landing_public_slug: row.landing_public_slug ?? null,
    landing_org_slug: row.landing_org_slug ?? null,
    usecase_slugs,
  }
}

export async function fetchPlatformSettingsRow(): Promise<PlatformSettingsRow> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', PLATFORM_SETTINGS_ID)
    .single()
  if (error) throw error
  const row = data as PlatformSettingsRow & { usecase_demos?: unknown }
  return {
    ...row,
    usecase_demos: normalizeUseCaseDemos(row.usecase_demos),
  }
}

export function normalizeUseCaseDemos(raw: unknown): UseCaseDemosMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: UseCaseDemosMap = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const entry = value as Record<string, unknown>
    out[key as UseCaseIndustryId] = {
      chatbot_id: typeof entry.chatbot_id === 'string' ? entry.chatbot_id : null,
      public_slug: typeof entry.public_slug === 'string' ? entry.public_slug : null,
    }
  }
  return out
}

export function usePublicPlatformSettings() {
  return useQuery({
    queryKey: publicPlatformSettingsQueryKey,
    queryFn: fetchPublicPlatformSettings,
    staleTime: 60_000,
  })
}
