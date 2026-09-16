import type { MapContent, MapPin } from '@/features/templates/templateModel'
import { mapEmbedUrlFromContent, parseTemplateContent } from '@/features/templates/templateModel'

export type MapEmbedPayload = {
  title: string
  intro: string
  embedUrl: string
  style: 'roadmap' | 'satellite'
  pins: MapPin[]
}

export const FF_MAP_OPEN = '<<ff:map:'
export const FF_MAP_CLOSE = '>>'

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

/** True when URL was auto-built from center/pins (must rebuild after input fill). */
export function isAutoOpenStreetMapEmbed(url: string): boolean {
  return /openstreetmap\.org\/export\/embed\.html/i.test(url.trim())
}

function resolveMapEmbedUrl(content: MapContent): string {
  const custom = content.embedUrl.trim()
  // Prefer geometry after {{inputs.*}} fill; keep only true custom embeds (Google, Mapbox, …).
  if (!custom || isAutoOpenStreetMapEmbed(custom)) {
    return mapEmbedUrlFromContent({ ...content, embedUrl: '' })
  }
  return custom
}

export function mapEmbedFromTemplate(tpl: Record<string, unknown>): MapEmbedPayload {
  const content = parseTemplateContent('map', tpl) as MapContent
  const title =
    content.title.trim() ||
    (typeof tpl.name === 'string' && tpl.name.trim()) ||
    (typeof tpl.key === 'string' && tpl.key.trim()) ||
    'Map'
  return {
    title,
    intro: content.intro.trim(),
    embedUrl: resolveMapEmbedUrl(content),
    style: content.style,
    pins: content.pins,
  }
}

/** Interpolate {{inputs.*}} / {{vars.*}} in map fields before encoding the chat embed. */
export function fillMapTemplateForEmbed(
  tpl: Record<string, unknown>,
  fill: (raw: string) => string,
): Record<string, unknown> {
  const content = parseTemplateContent('map', tpl) as MapContent
  const rawEmbed = content.embedUrl.trim()
  // Drop pre-baked OSM URLs so mapEmbedFromTemplate rebuilds from filled pins/center.
  const embedUrl =
    rawEmbed && !isAutoOpenStreetMapEmbed(rawEmbed) ? fill(rawEmbed) : ''
  const filled: MapContent = {
    ...content,
    title: fill(content.title),
    intro: fill(content.intro),
    centerLat: fill(content.centerLat),
    centerLng: fill(content.centerLng),
    embedUrl,
    pins: content.pins.map((pin) => ({
      label: fill(pin.label),
      description: fill(pin.description),
      lat: fill(pin.lat),
      lng: fill(pin.lng),
      link: fill(pin.link),
    })),
  }
  return {
    ...tpl,
    ...filled,
    kind: 'map',
  }
}

export function encodeMapEmbed(payload: MapEmbedPayload): string {
  return `${FF_MAP_OPEN}${utf8ToB64(JSON.stringify(payload))}${FF_MAP_CLOSE}`
}

export function decodeMapEmbed(b64: string): MapEmbedPayload | null {
  try {
    const raw = JSON.parse(b64ToUtf8(b64)) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const rec = raw as Record<string, unknown>
    const pins: MapPin[] = Array.isArray(rec.pins)
      ? rec.pins.map((item) => {
          const row =
            item && typeof item === 'object' && !Array.isArray(item)
              ? (item as Record<string, unknown>)
              : {}
          return {
            label: typeof row.label === 'string' ? row.label : '',
            description: typeof row.description === 'string' ? row.description : '',
            lat: typeof row.lat === 'string' ? row.lat : String(row.lat ?? ''),
            lng: typeof row.lng === 'string' ? row.lng : String(row.lng ?? ''),
            link: typeof row.link === 'string' ? row.link : '',
          }
        })
      : []
    return {
      title: typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : 'Map',
      intro: typeof rec.intro === 'string' ? rec.intro : '',
      embedUrl: typeof rec.embedUrl === 'string' ? rec.embedUrl : '',
      style: rec.style === 'satellite' ? 'satellite' : 'roadmap',
      pins,
    }
  } catch {
    return null
  }
}

export function mapEmbedPlainSummary(payload: MapEmbedPayload): string {
  const pins = payload.pins
    .filter((p) => p.label.trim() || (p.lat.trim() && p.lng.trim()))
    .map((p) => {
      const coord = p.lat.trim() && p.lng.trim() ? `${p.lat.trim()}, ${p.lng.trim()}` : ''
      return `• ${[p.label.trim(), p.description.trim(), coord].filter(Boolean).join(' · ')}`
    })
  return [payload.title, payload.intro, ...pins].filter(Boolean).join('\n')
}
