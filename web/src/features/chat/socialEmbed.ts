/** Social / video URL embeds for chat messages (YouTube, X, Vimeo, …). */

export type SocialEmbedProvider = 'youtube' | 'x' | 'vimeo' | 'spotify' | 'tiktok'

export type SocialEmbedPayload = {
  provider: SocialEmbedProvider
  /** Canonical public page URL */
  url: string
  /** Provider-specific id used to build a safe iframe src */
  id: string
  title: string
}

export const FF_EMBED_OPEN = '<<ff:embed:'
export const FF_EMBED_CLOSE = '>>'
export const FF_SOCIAL_EMBED_MARK = '__ffSocialEmbed'

function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function b64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function safeHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    // Normalize to https for embeds
    url.protocol = 'https:'
    return url
  } catch {
    return null
  }
}

function youtubeIdFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return /^[\w-]{6,}$/.test(id) ? id : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? ''
      return /^[\w-]{6,}$/.test(id) ? id : null
    }
    const parts = url.pathname.split('/').filter(Boolean)
    if ((parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') && parts[1]) {
      const id = parts[1]
      return /^[\w-]{6,}$/.test(id) ? id : null
    }
  }
  return null
}

function xStatusIdFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'twitter.com' && host !== 'x.com' && host !== 'mobile.twitter.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  // /{user}/status/{id} or /i/status/{id}
  const statusIdx = parts.findIndex((p) => p === 'status')
  if (statusIdx < 0 || !parts[statusIdx + 1]) return null
  const id = parts[statusIdx + 1]!.split('?')[0] ?? ''
  return /^\d{5,}$/.test(id) ? id : null
}

function vimeoIdFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (host === 'player.vimeo.com' && parts[0] === 'video' && parts[1]) {
    return /^\d+$/.test(parts[1]) ? parts[1] : null
  }
  // /123456789 or /channels/…/123 or /groups/…/videos/123
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]!
    if (/^\d{6,}$/.test(part)) return part
  }
  return null
}

function spotifyFromUrl(url: URL): { id: string; kind: string } | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'open.spotify.com' && host !== 'spotify.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  // /track/id | /album/id | /playlist/id | /episode/id | /show/id
  if (parts.length >= 2 && ['track', 'album', 'playlist', 'episode', 'show'].includes(parts[0]!)) {
    const id = parts[1]!.split('?')[0] ?? ''
    if (/^[A-Za-z0-9]{10,}$/.test(id)) return { id: `${parts[0]}/${id}`, kind: parts[0]! }
  }
  return null
}

function tiktokIdFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host !== 'tiktok.com' && host !== 'vm.tiktok.com' && !host.endsWith('.tiktok.com')) return null
  const parts = url.pathname.split('/').filter(Boolean)
  // /@user/video/1234567890
  const videoIdx = parts.findIndex((p) => p === 'video')
  if (videoIdx >= 0 && parts[videoIdx + 1]) {
    const id = parts[videoIdx + 1]!.split('?')[0] ?? ''
    return /^\d{5,}$/.test(id) ? id : null
  }
  return null
}

export function parseSocialEmbedUrl(raw: string): SocialEmbedPayload | null {
  const url = safeHttpsUrl(raw)
  if (!url) return null

  const yt = youtubeIdFromUrl(url)
  if (yt) {
    return {
      provider: 'youtube',
      url: `https://www.youtube.com/watch?v=${yt}`,
      id: yt,
      title: 'YouTube video',
    }
  }

  const xId = xStatusIdFromUrl(url)
  if (xId) {
    return {
      provider: 'x',
      url: `https://x.com/i/status/${xId}`,
      id: xId,
      title: 'Post on X',
    }
  }

  const vimeo = vimeoIdFromUrl(url)
  if (vimeo) {
    return {
      provider: 'vimeo',
      url: `https://vimeo.com/${vimeo}`,
      id: vimeo,
      title: 'Vimeo video',
    }
  }

  const spotify = spotifyFromUrl(url)
  if (spotify) {
    return {
      provider: 'spotify',
      url: `https://open.spotify.com/${spotify.id}`,
      id: spotify.id,
      title: `Spotify ${spotify.kind}`,
    }
  }

  const tiktok = tiktokIdFromUrl(url)
  if (tiktok) {
    return {
      provider: 'tiktok',
      url: url.toString(),
      id: tiktok,
      title: 'TikTok video',
    }
  }

  return null
}

export function encodeSocialEmbed(payload: SocialEmbedPayload): string {
  return `${FF_EMBED_OPEN}${utf8ToB64(JSON.stringify(payload))}${FF_EMBED_CLOSE}`
}

export function decodeSocialEmbed(b64: string): SocialEmbedPayload | null {
  try {
    const raw = JSON.parse(b64ToUtf8(b64)) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const rec = raw as Record<string, unknown>
    const provider = rec.provider
    if (
      provider !== 'youtube' &&
      provider !== 'x' &&
      provider !== 'vimeo' &&
      provider !== 'spotify' &&
      provider !== 'tiktok'
    ) {
      return null
    }
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const url = typeof rec.url === 'string' ? rec.url.trim() : ''
    if (!id || !url) return null
    return {
      provider,
      id,
      url,
      title: typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : provider,
    }
  } catch {
    return null
  }
}

export function isSocialEmbedExprValue(value: unknown): value is SocialEmbedPayload & {
  [FF_SOCIAL_EMBED_MARK]?: true
} {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)[FF_SOCIAL_EMBED_MARK] === true
  )
}

export function socialEmbedExprValue(payload: SocialEmbedPayload): Record<string, unknown> {
  return { [FF_SOCIAL_EMBED_MARK]: true, ...payload }
}

/** Safe iframe src for known providers only (never pass through arbitrary URLs). */
export function socialEmbedIframeSrc(payload: SocialEmbedPayload): string | null {
  switch (payload.provider) {
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(payload.id)}?rel=0`
    case 'x':
      return `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(payload.id)}`
    case 'vimeo':
      return `https://player.vimeo.com/video/${encodeURIComponent(payload.id)}`
    case 'spotify':
      return `https://open.spotify.com/embed/${payload.id}`
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${encodeURIComponent(payload.id)}`
    default:
      return null
  }
}

export function socialEmbedAspectClass(payload: SocialEmbedPayload): string {
  switch (payload.provider) {
    case 'youtube':
    case 'vimeo':
      // ~16:9 with a solid floor so narrow bubbles still look watchable
      return 'aspect-video min-h-[220px]'
    case 'spotify':
      return 'h-[232px]'
    case 'x':
      return 'h-[520px]'
    case 'tiktok':
      return 'mx-auto h-[560px] w-full max-w-[320px]'
    default:
      return 'aspect-video min-h-[220px]'
  }
}

export function socialEmbedPlainSummary(payload: SocialEmbedPayload): string {
  return payload.url
}

export const SOCIAL_EMBED_PROVIDERS_HINT =
  'YouTube, X (Twitter), Vimeo, Spotify, or TikTok'
