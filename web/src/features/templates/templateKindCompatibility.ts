import type { TemplateKind } from '@/features/templates/templateModel'

/** Base chat copy kinds for chat prompt embedding. */
const CHAT_COPY_KINDS: TemplateKind[] = ['message', 'faq', 'menu', 'hours', 'legal']

/** New chat embed kinds that can also appear in chat prompts. */
const EXTENDED_CHAT_COPY_KINDS: TemplateKind[] = [
  ...CHAT_COPY_KINDS,
  'appointment',
  'location',
  'map',
  'qr',
  'team',
  'pricing',
  'survey',
  'announcement',
]

/** Message-like kinds that can be used as default text for many answer types. */
const MESSAGE_LIKE_KINDS: TemplateKind[] = [
  ...EXTENDED_CHAT_COPY_KINDS,
  'sms',
  'push',
  'ticket',
  'consent',
]

/** File template kinds like document (not for chat prompts). */
const FILE_KINDS: TemplateKind[] = ['document', 'agreement', 'certificate', 'checklist']

/**
 * Template kinds that may be inserted into a question prompt for a given response type.
 * Store catalogs belong on Shop only — dropping one onto Payment (or similar) dumps cart
 * copy into checkout and can loop shop ↔ payment via prompt suggestions.
 */
export function templateKindsForAnswerType(answerType: string): TemplateKind[] {
  switch (answerType) {
    case 'shop':
      return [...EXTENDED_CHAT_COPY_KINDS, 'cart']
    case 'payment':
      return ['message', 'faq', 'hours', 'legal', 'receipt', 'consent']
    case 'email':
    case 'otp':
      return ['message', 'faq', 'sms', 'push']
    case 'form':
      return ['message', 'faq', 'legal', 'hours', 'consent']
    case 'appointment':
      return [...EXTENDED_CHAT_COPY_KINDS, 'appointment']
    default:
      return [...MESSAGE_LIKE_KINDS, 'receipt']
  }
}

export function isTemplateKindAllowedForAnswerType(kind: TemplateKind, answerType: string): boolean {
  return templateKindsForAnswerType(answerType).includes(kind)
}

/** True for file kinds that generate downloadable files (PDF, etc). */
export function isFileTemplateKindForChat(kind: TemplateKind): boolean {
  return FILE_KINDS.includes(kind)
}

/** Webhook is config-only — not for chat prompts. */
export function isWebhookKind(kind: TemplateKind): boolean {
  return kind === 'webhook'
}

/** Cart JSON is stored without `kind`; products[] is unique vs FAQ/menu `items`. */
export function templateContentLooksLikeCart(content: unknown): boolean {
  return (
    !!content &&
    typeof content === 'object' &&
    !Array.isArray(content) &&
    Array.isArray((content as { products?: unknown }).products)
  )
}
