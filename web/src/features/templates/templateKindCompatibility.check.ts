/**
 * Manual check: npx vite-node src/features/templates/templateKindCompatibility.check.ts
 */
import {
  isTemplateKindAllowedForAnswerType,
  templateContentLooksLikeCart,
  templateKindsForAnswerType,
} from '@/features/templates/templateKindCompatibility'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

{
  const shop = templateKindsForAnswerType('shop')
  assert(shop.includes('cart'), 'shop allows store catalogs')
  assert(shop.includes('message'), 'shop still allows chat copy')
  assert(!shop.includes('email'), 'HTML email is not a chat prompt')
}

{
  const payment = templateKindsForAnswerType('payment')
  assert(!payment.includes('cart'), 'payment must not insert a cart (shop ↔ payment loop)')
  assert(payment.includes('receipt'), 'payment allows receipts')
  assert(payment.includes('message'), 'payment allows chat copy')
}

{
  assert(!isTemplateKindAllowedForAnswerType('cart', 'payment'), 'cart + payment blocked')
  assert(!isTemplateKindAllowedForAnswerType('cart', 'text'), 'cart + text blocked')
  assert(!isTemplateKindAllowedForAnswerType('cart', 'email'), 'cart + email blocked')
  assert(isTemplateKindAllowedForAnswerType('cart', 'shop'), 'cart + shop allowed')
  assert(!isTemplateKindAllowedForAnswerType('email', 'shop'), 'HTML email not in shop prompt')
}

{
  assert(templateContentLooksLikeCart({ currency: 'ZAR', categories: [], products: [] }), 'cart JSON')
  assert(!templateContentLooksLikeCart({ intro: '', items: [{ question: 'Q', answer: 'A' }] }), 'faq is not cart')
  assert(!templateContentLooksLikeCart({ items: [{ label: 'A', value: 'a' }] }), 'menu is not cart')
}

console.log('templateKindCompatibility.check.ts: all passed')
