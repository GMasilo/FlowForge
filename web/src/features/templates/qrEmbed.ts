import type { QrContent, QrErrorCorrection } from '@/features/templates/templateModel'
import { parseTemplateContent } from '@/features/templates/templateModel'

export type QrEmbedPayload = {
  title: string
  caption: string
  payload: string
  size: number
  errorCorrection: QrErrorCorrection
  foreground: string
  background: string
  filename: string
}

export const FF_QR_OPEN = '<<ff:qr:'
export const FF_QR_CLOSE = '>>'

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

export function qrEmbedFromTemplate(tpl: Record<string, unknown>): QrEmbedPayload {
  const content = parseTemplateContent('qr', tpl) as QrContent
  return {
    title: content.title.trim(),
    caption: content.caption.trim(),
    payload: content.payload.trim(),
    size: content.size,
    errorCorrection: content.errorCorrection,
    foreground: content.foreground,
    background: content.background,
    filename: content.filename.trim() || 'qr.png',
  }
}

/** Fill expression fields on a QR template before embedding. */
export function fillQrTemplateForEmbed(
  tpl: Record<string, unknown>,
  fill: (raw: string) => string,
): Record<string, unknown> {
  const content = parseTemplateContent('qr', tpl) as QrContent
  const filled: QrContent = {
    ...content,
    title: fill(content.title),
    caption: fill(content.caption),
    payload: fill(content.payload),
    filename: fill(content.filename),
  }
  return { ...tpl, ...filled, kind: 'qr' }
}

export function encodeQrEmbed(payload: QrEmbedPayload): string {
  return `${FF_QR_OPEN}${utf8ToB64(JSON.stringify(payload))}${FF_QR_CLOSE}`
}

export function decodeQrEmbed(b64: string): QrEmbedPayload | null {
  try {
    const parsed = JSON.parse(b64ToUtf8(b64)) as Partial<QrEmbedPayload>
    if (!parsed || typeof parsed !== 'object') return null
    const payload = typeof parsed.payload === 'string' ? parsed.payload.trim() : ''
    if (!payload) return null
    const ec = parsed.errorCorrection
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      caption: typeof parsed.caption === 'string' ? parsed.caption : '',
      payload,
      size: typeof parsed.size === 'number' && Number.isFinite(parsed.size) ? Math.max(64, Math.min(512, Math.round(parsed.size))) : 180,
      errorCorrection: ec === 'L' || ec === 'Q' || ec === 'H' ? ec : 'M',
      foreground: typeof parsed.foreground === 'string' && parsed.foreground.trim() ? parsed.foreground.trim() : '#0f172a',
      background: typeof parsed.background === 'string' && parsed.background.trim() ? parsed.background.trim() : '#ffffff',
      filename: typeof parsed.filename === 'string' && parsed.filename.trim() ? parsed.filename.trim() : 'qr.png',
    }
  } catch {
    return null
  }
}

export function qrEmbedPlainSummary(payload: QrEmbedPayload): string {
  const lines = [payload.title.trim(), payload.caption.trim(), payload.payload.trim()].filter(Boolean)
  return lines.join('\n') || 'QR code'
}
