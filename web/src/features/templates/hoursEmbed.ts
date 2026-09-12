import type { HoursContent, HoursDay } from '@/features/templates/templateModel'
import { parseTemplateContent } from '@/features/templates/templateModel'

export type HoursEmbedPayload = {
  title: string
  timezone: string
  note: string
  days: HoursDay[]
}

export const FF_HOURS_OPEN = '<<ff:hours:'
export const FF_HOURS_CLOSE = '>>'

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

export function hoursEmbedFromTemplate(tpl: Record<string, unknown>): HoursEmbedPayload {
  const content = parseTemplateContent('hours', tpl) as HoursContent
  const title =
    (typeof tpl.name === 'string' && tpl.name.trim()) ||
    (typeof tpl.key === 'string' && tpl.key.trim()) ||
    'Opening hours'
  return {
    title,
    timezone: content.timezone.trim(),
    note: content.note.trim(),
    days: content.days,
  }
}

export function encodeHoursEmbed(payload: HoursEmbedPayload): string {
  return `${FF_HOURS_OPEN}${utf8ToB64(JSON.stringify(payload))}${FF_HOURS_CLOSE}`
}

export function decodeHoursEmbed(b64: string): HoursEmbedPayload | null {
  try {
    const raw = JSON.parse(b64ToUtf8(b64)) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const rec = raw as Record<string, unknown>
    const days = Array.isArray(rec.days)
      ? rec.days.map((item) => {
          const row = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
          return {
            day: typeof row.day === 'string' ? row.day : '',
            open: typeof row.open === 'string' ? row.open : '09:00',
            close: typeof row.close === 'string' ? row.close : '17:00',
            closed: row.closed === true,
          }
        })
      : []
    return {
      title: typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : 'Opening hours',
      timezone: typeof rec.timezone === 'string' ? rec.timezone : '',
      note: typeof rec.note === 'string' ? rec.note : '',
      days,
    }
  } catch {
    return null
  }
}

export function hoursEmbedPlainSummary(payload: HoursEmbedPayload): string {
  const lines = payload.days.map((d) =>
    d.closed ? `${d.day}: Closed` : `${d.day}: ${d.open}–${d.close}`,
  )
  return [payload.title, payload.timezone ? `Timezone: ${payload.timezone}` : '', ...lines, payload.note]
    .filter(Boolean)
    .join('\n')
}
