import type { TemplateKind } from '@/features/templates/templateModel'

const CHAT_COPY_KINDS: TemplateKind[] = ['message', 'faq', 'menu', 'hours', 'legal']

/**
 * Template kinds that may be inserted into a question prompt for a given response type.
 * Store catalogs belong on Shop only — dropping one onto Payment (or similar) dumps cart
 * copy into checkout and can loop shop ↔ payment via prompt suggestions.
 */
export function templateKindsForAnswerType(answerType: string): TemplateKind[] {
  switch (answerType) {
    case 'shop':
      return [...CHAT_COPY_KINDS, 'cart']
    case 'payment':
      return ['message', 'faq', 'hours', 'legal', 'receipt']
    case 'email':
    case 'otp':
      return ['message', 'faq']
    case 'form':
      return ['message', 'faq', 'legal', 'hours']
    default:
      return [...CHAT_COPY_KINDS, 'receipt']
  }
}

export function isTemplateKindAllowedForAnswerType(kind: TemplateKind, answerType: string): boolean {
  return templateKindsForAnswerType(answerType).includes(kind)
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
