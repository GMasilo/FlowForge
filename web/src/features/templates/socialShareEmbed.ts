import type {
  SocialShareContent,
  SocialSharePlatform,
  SocialSharePlatformId,
} from '@/features/templates/templateModel'
import {
  defaultSocialSharePlatforms,
  parseTemplateContent,
  socialShareLinkFor,
  SOCIAL_SHARE_PLATFORM_META,
} from '@/features/templates/templateModel'

export type SocialShareEmbedPlatform = {
  id: SocialSharePlatformId
  label: string
  url: string
}

export type SocialShareEmbedPayload = {
  title: string
  text: string
  platforms: SocialShareEmbedPlatform[]
}

export const FF_SOCIAL_SHARE_OPEN = '<<ff:socialshare:'
export const FF_SOCIAL_SHARE_CLOSE = '>>'

function utf8ToB64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function b64ToUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function socialShareEmbedFromTemplate(tpl: Record<string, unknown>): SocialShareEmbedPayload {
  const content = parseTemplateContent('social_share', tpl) as SocialShareContent
  const platforms: SocialShareEmbedPlatform[] = []
  const list = content.platforms?.length ? content.platforms : defaultSocialSharePlatforms()
  for (const p of list) {
    const link = socialShareLinkFor(p, content.text)
    if (!link) continue
    platforms.push({
      id: p.id,
      label: SOCIAL_SHARE_PLATFORM_META[p.id]?.label ?? p.id,
      url: link,
    })
  }
  return {
    title: content.title.trim(),
    text: content.text.trim(),
    platforms,
  }
}

export function fillSocialShareTemplateForEmbed(
  tpl: Record<string, unknown>,
  fill: (raw: string) => string,
): Record<string, unknown> {
  const content = parseTemplateContent('social_share', tpl) as SocialShareContent
  const platforms: SocialSharePlatform[] = (content.platforms?.length
    ? content.platforms
    : defaultSocialSharePlatforms()
  ).map((p) => ({ ...p, url: fill(p.url) }))
  const filled: SocialShareContent = {
    ...content,
    title: fill(content.title),
    text: fill(content.text),
    platforms,
  }
  return { ...tpl, ...filled, kind: 'social_share' }
}

export function encodeSocialShareEmbed(payload: SocialShareEmbedPayload): string {
  return `${FF_SOCIAL_SHARE_OPEN}${utf8ToB64(JSON.stringify(payload))}${FF_SOCIAL_SHARE_CLOSE}`
}

export function decodeSocialShareEmbed(b64: string): SocialShareEmbedPayload | null {
  try {
    const parsed = JSON.parse(b64ToUtf8(b64)) as Partial<SocialShareEmbedPayload>
    if (!parsed || typeof parsed !== 'object') return null
    const platforms: SocialShareEmbedPlatform[] = []
    for (const row of Array.isArray(parsed.platforms) ? parsed.platforms : []) {
      if (!row || typeof row !== 'object') continue
      const r = row as Partial<SocialShareEmbedPlatform>
      const id = r.id
      if (!(['x','linkedin','facebook','instagram','tiktok','youtube','twitch','threads','pinterest'] as string[]).includes(id as string)) continue
      const url = typeof r.url === 'string' ? r.url.trim() : ''
      if (!url) continue
      platforms.push({
        id,
        label: typeof r.label === 'string' && r.label.trim() ? r.label.trim() : (SOCIAL_SHARE_PLATFORM_META[id]?.label ?? id),
        url,
      })
    }
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      text: typeof parsed.text === 'string' ? parsed.text : '',
      platforms,
    }
  } catch {
    return null
  }
}

export function socialShareEmbedPlainSummary(payload: SocialShareEmbedPayload): string {
  const lines = [payload.title.trim(), payload.text.trim()]
  for (const p of payload.platforms) lines.push(`${p.label}: ${p.url}`)
  return lines.filter(Boolean).join('\n') || 'Share'
}