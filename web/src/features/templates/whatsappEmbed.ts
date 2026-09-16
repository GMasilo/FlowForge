import type { WhatsappContent } from '@/features/templates/templateModel'
import { parseTemplateContent } from '@/features/templates/templateModel'

export type WhatsappEmbedPayload = {
  phone: string
  message: string
  buttonLabel: string
  title: string
  subtitle: string
}

export const FF_WHATSAPP_OPEN = '<<ff:whatsapp:'
export const FF_WHATSAPP_CLOSE = '>>'

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

/** Digits only for wa.me (strip +, spaces, dashes). */
export function normalizeWhatsappPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

export function whatsappChatUrl(phone: string, message: string): string | null {
  const digits = normalizeWhatsappPhone(phone)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  const text = message.trim()
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function whatsappEmbedFromTemplate(tpl: Record<string, unknown>): WhatsappEmbedPayload {
  const content = parseTemplateContent('whatsapp', tpl) as WhatsappContent
  return {
    phone: content.phone.trim(),
    message: content.message.trim(),
    buttonLabel: content.buttonLabel.trim() || 'Chat to us on WhatsApp',
    title: content.title.trim(),
    subtitle: content.subtitle.trim(),
  }
}

export function fillWhatsappTemplateForEmbed(
  tpl: Record<string, unknown>,
  fill: (raw: string) => string,
): Record<string, unknown> {
  const content = parseTemplateContent('whatsapp', tpl) as WhatsappContent
  const filled: WhatsappContent = {
    ...content,
    phone: fill(content.phone),
    message: fill(content.message),
    buttonLabel: fill(content.buttonLabel) || 'Chat to us on WhatsApp',
    title: fill(content.title),
    subtitle: fill(content.subtitle),
  }
  return { ...tpl, ...filled, kind: 'whatsapp' }
}

export function encodeWhatsappEmbed(payload: WhatsappEmbedPayload): string {
  return `${FF_WHATSAPP_OPEN}${utf8ToB64(JSON.stringify(payload))}${FF_WHATSAPP_CLOSE}`
}

export function decodeWhatsappEmbed(b64: string): WhatsappEmbedPayload | null {
  try {
    const parsed = JSON.parse(b64ToUtf8(b64)) as Partial<WhatsappEmbedPayload>
    if (!parsed || typeof parsed !== 'object') return null
    const phone = typeof parsed.phone === 'string' ? parsed.phone.trim() : ''
    if (!normalizeWhatsappPhone(phone)) return null
    return {
      phone,
      message: typeof parsed.message === 'string' ? parsed.message : '',
      buttonLabel:
        typeof parsed.buttonLabel === 'string' && parsed.buttonLabel.trim()
          ? parsed.buttonLabel.trim()
          : 'Chat to us on WhatsApp',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : '',
    }
  } catch {
    return null
  }
}

export function whatsappEmbedPlainSummary(payload: WhatsappEmbedPayload): string {
  const url = whatsappChatUrl(payload.phone, payload.message)
  return [payload.title, payload.subtitle, payload.buttonLabel, url].filter(Boolean).join('\n') || 'WhatsApp'
}
