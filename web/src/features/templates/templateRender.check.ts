/**
 * Manual check: npx vite-node src/features/templates/templateRender.check.ts
 */
import {
  buildShopCart,
  cartCatalogFromTemplates,
  parseTemplateContent,
  productMaxQty,
  renderReceiptFromCart,
  renderTemplateText,
  starterTemplateContent,
  templateExprValue,
  type CartContent,
} from '@/features/templates/templateModel'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const faq = starterTemplateContent('faq')
const faqText = renderTemplateText('faq', faq)
assert(faqText.includes('What are your hours?'), 'faq includes question')

const cart = starterTemplateContent('cart')
const cartText = renderTemplateText('cart', cart)
assert(cartText.toLowerCase().includes('espresso'), 'cart includes product')
assert(cartText.toLowerCase().includes('coffee'), 'cart includes category')

const parsedCart = parseTemplateContent('cart', cart) as CartContent
assert(parsedCart.products.length === 4, 'cart has products')
const built = buildShopCart(parsedCart, { prod_espresso: 2, prod_latte: 1 })
assert(built.itemCount === 3, 'shop qty totals')
assert(built.subtotal === 11.5, 'shop subtotal uses catalog prices')
assert(built.total === 11.5 && built.feesTotal === 0 && built.fees.length === 0, 'no fees by default')

{
  const withFees = parseTemplateContent('cart', {
    ...parsedCart,
    fees: [
      { id: 'fee_ship', name: 'Delivery', kind: 'fixed', amount: 3 },
      { id: 'fee_tax', name: 'Tax', kind: 'percent', amount: 10 },
    ],
  }) as CartContent
  const charged = buildShopCart(withFees, { prod_espresso: 2, prod_latte: 1 })
  assert(charged.subtotal === 11.5, 'fees do not change product subtotal')
  assert(charged.fees.length === 2, 'both fees applied')
  assert(charged.fees[0]?.value === 3, 'fixed delivery')
  assert(charged.fees[1]?.value === 1.15, '10% tax on subtotal')
  assert(charged.feesTotal === 4.15, 'fees total')
  assert(charged.total === 15.65, 'payable total includes fees')
  const emptyFees = buildShopCart(withFees, {})
  assert(emptyFees.total === 0 && emptyFees.fees.length === 0, 'fees skip empty cart')
}

const legacy = parseTemplateContent('cart', {
  currency: 'USD',
  items: [{ name: 'Widget', price: 9, sku: 'W-1', description: 'A widget' }],
})
assert('products' in legacy && legacy.products[0]?.name === 'Widget', 'legacy items migrate')
assert('categories' in legacy && legacy.categories.length >= 1, 'legacy gets a category')

const email = starterTemplateContent('email')
assert('html' in email && email.html.includes('{{inputs.name}}'), 'email html has placeholder')
assert('inputs' in email && email.inputs.some((i) => i.key === 'name'), 'email starter declares name input')

const expr = templateExprValue({
  id: '1',
  key: 'help_faq',
  name: 'Help',
  kind: 'faq',
  content: faq,
})
assert(typeof expr.text === 'string' && String(expr.text).includes('•'), 'expr text is rendered')

const cafeExpr = templateExprValue({
  id: '2',
  key: 'cafe',
  name: 'Café',
  kind: 'cart',
  content: cart,
})
assert(cartCatalogFromTemplates({ cafe: cafeExpr }, 'cafe')?.products.length === 4, 'shop catalog from expr map')
assert(
  cartCatalogFromTemplates({ cafe: { products: parsedCart.products, categories: parsedCart.categories } }, 'cafe')?.products
    .length === 4,
  'shop catalog from raw cart content',
)
assert(
  cartCatalogFromTemplates({ other: cafeExpr }, 'cafe')?.products.length === 4,
  'shop catalog finds cart by inner key when map key differs',
)

{
  const limited = parseTemplateContent('cart', {
    ...parsedCart,
    products: parsedCart.products.map((p) => (p.id === 'prod_espresso' ? { ...p, stock: 1 } : p)),
  }) as CartContent
  const oversell = buildShopCart(limited, { prod_espresso: 5 })
  assert(oversell.items[0]?.qty === 1, 'stock caps qty')
  const soldOut = parseTemplateContent('cart', {
    ...parsedCart,
    products: parsedCart.products.map((p) => (p.id === 'prod_espresso' ? { ...p, stock: 0 } : p)),
  }) as CartContent
  assert(buildShopCart(soldOut, { prod_espresso: 2 }).itemCount === 0, 'zero stock cannot sell')
  assert(productMaxQty({ stock: null }) === 99, 'null stock is unlimited')
  assert(productMaxQty({ stock: 0 }) === 0, 'zero stock max qty')
}

{
  const receipt = renderReceiptFromCart(
    { title: 'Your receipt', intro: 'Thanks Ada', footer: 'Come again', inputs: [] },
    built,
    { reference: 'PF-99' },
  )
  assert(receipt.includes('Espresso'), 'receipt lists items')
  assert(receipt.includes('Total'), 'receipt lists total')
  assert(receipt.includes('PF-99'), 'receipt lists payment reference')
  assert(receipt.includes('Come again'), 'receipt keeps footer')
}

const parsed = parseTemplateContent('hours', { timezone: 'UTC', days: [{ day: 'Monday', closed: true }] })
assert('days' in parsed && parsed.days[0]?.closed === true, 'hours parse')

{
  const doc = parseTemplateContent('document', starterTemplateContent('document'))
  assert('format' in doc && doc.format === 'pdf', 'document starter format')
  assert('fields' in doc && doc.fields.some((f) => f.as === 'image'), 'document starter signature field')
  assert('orientation' in doc && doc.orientation === 'portrait', 'document starter orientation')
  const legacy = parseTemplateContent('document', { format: 'pdf', filename: 'old.pdf', fields: [] })
  assert('orientation' in legacy && legacy.orientation === 'portrait', 'legacy document defaults portrait')
}

console.log(JSON.stringify({ ok: true, faqChars: faqText.length, cartChars: cartText.length }, null, 2))
