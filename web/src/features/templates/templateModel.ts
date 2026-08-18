export const TEMPLATE_KINDS = [
  'email',
  'faq',
  'cart',
  'menu',
  'message',
  'hours',
  'legal',
  'receipt',
] as const

export type TemplateKind = (typeof TEMPLATE_KINDS)[number]

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

export type FaqItem = { question: string; answer: string }
export type StoreCategory = { id: string; name: string }
export type StoreProduct = {
  id: string
  sku: string
  name: string
  description: string
  price: number
  categoryId: string
  image: string
  /** Null/undefined means unlimited. */
  stock?: number | null
}
export type MenuItem = { label: string; description: string; value: string }
export type HoursDay = { day: string; open: string; close: string; closed: boolean }

export type EmailContent = { subject: string; html: string }
export type FaqContent = { intro: string; items: FaqItem[] }
export type StoreFeeKind = 'fixed' | 'percent'

export type StoreFee = {
  id: string
  name: string
  kind: StoreFeeKind
  amount: number
}

export type CartContent = {
  currency: string
  storeName: string
  intro: string
  checkoutLabel: string
  cartHint: string
  categories: StoreCategory[]
  products: StoreProduct[]
  fees: StoreFee[]
}
export type MenuContent = { title: string; items: MenuItem[] }
export type MessageContent = { text: string }
export type HoursContent = { timezone: string; note: string; days: HoursDay[] }
export type LegalContent = { title: string; body: string }
export type ReceiptContent = { title: string; intro: string; footer: string }

export type TemplateContent =
  | EmailContent
  | FaqContent
  | CartContent
  | MenuContent
  | MessageContent
  | HoursContent
  | LegalContent
  | ReceiptContent

export const TEMPLATE_KIND_META: Record<
  TemplateKind,
  { label: string; hint: string; insertField: string }
> = {
  email: {
    label: 'HTML email',
    hint: 'Subject + HTML body for Email steps and OTP messages',
    insertField: 'html',
  },
  faq: {
    label: 'Help / FAQ',
    hint: 'Reusable Q&A you can drop into chat steps',
    insertField: 'text',
  },
  cart: {
    label: 'Store catalog',
    hint: 'Categories, products, and checkout fees visitors add to a cart',
    insertField: 'text',
  },
  menu: {
    label: 'Menu',
    hint: 'Quick-reply style options and help menus',
    insertField: 'text',
  },
  message: {
    label: 'Chat message',
    hint: 'Welcome, away, or handoff copy',
    insertField: 'text',
  },
  hours: {
    label: 'Opening hours',
    hint: 'Weekly schedule shown in chat or email',
    insertField: 'text',
  },
  legal: {
    label: 'Legal',
    hint: 'Terms, privacy, or consent copy',
    insertField: 'text',
  },
  receipt: {
    label: 'Receipt',
    hint: 'Order confirmation filled from the cart and payment at send time',
    insertField: 'text',
  },
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function emptyHoursDays(): HoursDay[] {
  return WEEKDAYS.map((day) => ({
    day,
    open: '09:00',
    close: '17:00',
    closed: day === 'Saturday' || day === 'Sunday',
  }))
}

export function newStoreId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function slugStoreId(raw: string, prefix: string, fallback: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_+$/g, '')
    .slice(0, 24)
  return s ? `${prefix}_${s}` : fallback
}

export function emptyStoreCategory(name = ''): StoreCategory {
  return { id: newStoreId('cat'), name }
}

export function emptyStoreProduct(categoryId: string): StoreProduct {
  return {
    id: newStoreId('prod'),
    sku: '',
    name: '',
    description: '',
    price: 0,
    categoryId,
    image: '',
    stock: null,
  }
}

export function emptyStoreFee(name = ''): StoreFee {
  return {
    id: newStoreId('fee'),
    name,
    kind: 'fixed',
    amount: 0,
  }
}

function parseOptionalStock(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Remaining units that can be added; null stock means unlimited (capped at 99). */
export function productMaxQty(product: Pick<StoreProduct, 'stock'>): number {
  if (product.stock == null) return 99
  return Math.max(0, Math.min(99, Math.floor(product.stock)))
}

function parseStoreFees(raw: unknown): StoreFee[] {
  if (!Array.isArray(raw)) return []
  const out: StoreFee[] = []
  raw.forEach((item, index) => {
    const row = asRecord(item)
    const kind = str(row.kind) === 'percent' ? 'percent' : 'fixed'
    out.push({
      id: str(row.id) || slugStoreId(str(row.name), 'fee', `fee_${index + 1}`),
      name: str(row.name),
      kind,
      amount: Math.max(0, num(row.amount)),
    })
  })
  return out
}

function money(n: number): number {
  return Number(n.toFixed(2))
}

function defaultStoreCategories(): StoreCategory[] {
  return [{ id: 'cat_general', name: 'General' }]
}

function defaultStoreProducts(categoryId: string): StoreProduct[] {
  return [emptyStoreProduct(categoryId)]
}

export function emptyTemplateContent(kind: TemplateKind): TemplateContent {
  switch (kind) {
    case 'email':
      return { subject: '', html: '' }
    case 'faq':
      return { intro: '', items: [{ question: '', answer: '' }] }
    case 'cart': {
      const categories = defaultStoreCategories()
      return {
        currency: 'USD',
        storeName: '',
        intro: '',
        checkoutLabel: 'Checkout',
        cartHint: '',
        categories,
        products: defaultStoreProducts(categories[0]!.id),
        fees: [],
      }
    }
    case 'menu':
      return { title: '', items: [{ label: '', description: '', value: '' }] }
    case 'message':
      return { text: '' }
    case 'hours':
      return { timezone: '', note: '', days: emptyHoursDays() }
    case 'legal':
      return { title: '', body: '' }
    case 'receipt':
      return { title: 'Your receipt', intro: '', footer: 'Thank you for your order.' }
  }
}

export function starterTemplateContent(kind: TemplateKind): TemplateContent {
  switch (kind) {
    case 'email':
      return {
        subject: 'Hello {{vars.name}}',
        html: `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;color:#ffffff;">
            <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;">{{vars.brand}}</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;">Hello {{vars.name}}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">Thanks for getting in touch. Here’s a quick update:</p>
            <p style="margin:0 0 20px;">{{vars.message}}</p>
            <p style="margin:0;color:#64748b;font-size:13px;">If you didn’t request this, you can ignore the email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }
    case 'faq':
      return {
        intro: 'Here are answers to common questions:',
        items: [
          { question: 'What are your hours?', answer: 'See {{templates.hours_main.text}} or ask a teammate.' },
          { question: 'How do I track an order?', answer: 'Share your order number and we will look it up.' },
          { question: 'Can I talk to a person?', answer: 'Yes — say “agent” and we will hand you over.' },
        ],
      }
    case 'cart': {
      const coffee = { id: 'cat_coffee', name: 'Coffee' }
      const pastry = { id: 'cat_pastries', name: 'Pastries' }
      return {
        currency: 'USD',
        storeName: 'Corner café',
        intro: 'Browse the menu and add items to your cart.',
        checkoutLabel: 'Checkout',
        cartHint: 'Change quantities anytime, then checkout to continue.',
        categories: [coffee, pastry],
        products: [
          {
            id: 'prod_espresso',
            sku: 'COF-ESP',
            name: 'Espresso',
            description: 'Double shot, rich and short',
            price: 3.5,
            categoryId: coffee.id,
            image: '',
          },
          {
            id: 'prod_latte',
            sku: 'COF-LAT',
            name: 'Latte',
            description: 'Espresso with steamed milk',
            price: 4.5,
            categoryId: coffee.id,
            image: '',
          },
          {
            id: 'prod_croissant',
            sku: 'PAS-CRO',
            name: 'Croissant',
            description: 'Butter croissant, baked daily',
            price: 3,
            categoryId: pastry.id,
            image: '',
          },
          {
            id: 'prod_muffin',
            sku: 'PAS-MUF',
            name: 'Blueberry muffin',
            description: 'Soft muffin with blueberries',
            price: 2.75,
            categoryId: pastry.id,
            image: '',
          },
        ],
        fees: [],
      }
    }
    case 'menu':
      return {
        title: 'How can I help?',
        items: [
          { label: 'Hours', description: 'Opening times', value: 'hours' },
          { label: 'Orders', description: 'Track or change an order', value: 'orders' },
          { label: 'Talk to a person', description: 'Hand off to an agent', value: 'agent' },
        ],
      }
    case 'message':
      return {
        text: 'Hi {{vars.name}} — welcome! I can help with orders, hours, and common questions.',
      }
    case 'hours':
      return {
        timezone: 'Africa/Johannesburg',
        note: 'Public holidays may differ.',
        days: WEEKDAYS.map((day) => ({
          day,
          open: '09:00',
          close: '17:00',
          closed: day === 'Sunday',
        })),
      }
    case 'legal':
      return {
        title: 'Terms of use',
        body: 'By continuing you agree we may store this conversation to help with your request. We do not sell your personal data.',
      }
    case 'receipt':
      return {
        title: 'Order confirmation',
        intro: 'Thanks {{vars.name}} — we’ve received your order {{vars.order_id}}.',
        footer: 'Reply to this chat if anything looks wrong.',
      }
  }
}

export function parseTemplateContent(kind: TemplateKind, raw: unknown): TemplateContent {
  const c = asRecord(raw)
  switch (kind) {
    case 'email':
      return { subject: str(c.subject), html: str(c.html) }
    case 'faq': {
      const items = Array.isArray(c.items)
        ? c.items.map((item) => {
            const row = asRecord(item)
            return { question: str(row.question), answer: str(row.answer) }
          })
        : [{ question: '', answer: '' }]
      return { intro: str(c.intro), items: items.length ? items : [{ question: '', answer: '' }] }
    }
    case 'cart': {
      const fallbackCats = defaultStoreCategories()
      const categories = Array.isArray(c.categories)
        ? c.categories.map((item, index) => {
            const row = asRecord(item)
            const fallback = `cat_${index + 1}`
            return {
              id: str(row.id) || slugStoreId(str(row.name), 'cat', fallback),
              name: str(row.name, `Category ${index + 1}`),
            }
          })
        : []
      const categoryIds = new Set(categories.map((cat) => cat.id))
      const firstCat = categories[0]?.id || fallbackCats[0]!.id

      const fromProducts = Array.isArray(c.products) ? c.products : []
      const fromLegacyItems = Array.isArray(c.items) && !fromProducts.length ? c.items : []
      const rawProducts = fromProducts.length ? fromProducts : fromLegacyItems

      const products = rawProducts.map((item, index) => {
        const row = asRecord(item)
        const fallback = `prod_${index + 1}`
        const categoryId = str(row.categoryId)
        return {
          id: str(row.id) || slugStoreId(str(row.sku) || str(row.name), 'prod', fallback),
          sku: str(row.sku),
          name: str(row.name),
          description: str(row.description),
          price: num(row.price),
          categoryId: categoryId && categoryIds.has(categoryId) ? categoryId : firstCat,
          image: str(row.image),
          stock: parseOptionalStock(row.stock),
        }
      })

      const resolvedCategories = categories.length
        ? categories
        : fromLegacyItems.length
          ? [{ id: firstCat, name: 'Shop' }]
          : fallbackCats

      return {
        currency: str(c.currency, 'USD'),
        storeName: str(c.storeName),
        intro: str(c.intro),
        checkoutLabel: str(c.checkoutLabel, 'Checkout') || 'Checkout',
        cartHint: str(c.cartHint) || str(c.checkoutHint),
        categories: resolvedCategories,
        products: products.length ? products : defaultStoreProducts(resolvedCategories[0]!.id),
        fees: parseStoreFees(c.fees),
      }
    }
    case 'menu': {
      const items = Array.isArray(c.items)
        ? c.items.map((item) => {
            const row = asRecord(item)
            return { label: str(row.label), description: str(row.description), value: str(row.value) }
          })
        : []
      return {
        title: str(c.title),
        items: items.length ? items : [{ label: '', description: '', value: '' }],
      }
    }
    case 'message':
      return { text: str(c.text) }
    case 'hours': {
      const days = Array.isArray(c.days)
        ? c.days.map((item) => {
            const row = asRecord(item)
            return {
              day: str(row.day),
              open: str(row.open, '09:00'),
              close: str(row.close, '17:00'),
              closed: row.closed === true,
            }
          })
        : emptyHoursDays()
      return { timezone: str(c.timezone), note: str(c.note), days: days.length ? days : emptyHoursDays() }
    }
    case 'legal':
      return { title: str(c.title), body: str(c.body) }
    case 'receipt':
      return { title: str(c.title, 'Your receipt'), intro: str(c.intro), footer: str(c.footer) }
  }
}

export function formatTemplateMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function renderTemplateText(kind: TemplateKind, content: TemplateContent): string {
  switch (kind) {
    case 'email': {
      const c = content as EmailContent
      const plain = c.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      return [c.subject, plain].filter(Boolean).join('\n')
    }
    case 'faq': {
      const c = content as FaqContent
      const items = c.items
        .filter((i) => i.question.trim() || i.answer.trim())
        .map((i) => `• ${i.question.trim()}\n  ${i.answer.trim()}`)
      return [c.intro.trim(), ...items].filter(Boolean).join('\n\n')
    }
    case 'cart': {
      const c = content as CartContent
      const byCat = new Map<string, StoreProduct[]>()
      for (const product of c.products.filter((p) => p.name.trim())) {
        const list = byCat.get(product.categoryId) ?? []
        list.push(product)
        byCat.set(product.categoryId, list)
      }
      const blocks: string[] = []
      if (c.storeName.trim()) blocks.push(c.storeName.trim())
      if (c.intro.trim()) blocks.push(c.intro.trim())
      for (const cat of c.categories) {
        const items = byCat.get(cat.id) ?? []
        if (!items.length && !cat.name.trim()) continue
        const lines = items.map((p) => {
          const price = formatTemplateMoney(p.price, c.currency)
          const sku = p.sku.trim() ? ` (${p.sku.trim()})` : ''
          const desc = p.description.trim() ? ` — ${p.description.trim()}` : ''
          return `• ${p.name.trim()}${sku}: ${price}${desc}`
        })
        blocks.push([cat.name.trim(), ...lines].filter(Boolean).join('\n'))
      }
      if (c.cartHint.trim()) blocks.push(c.cartHint.trim())
      const feeLines = (c.fees ?? [])
        .filter((f) => f.name.trim() && f.amount > 0)
        .map((f) =>
          f.kind === 'percent'
            ? `• ${f.name.trim()}: ${f.amount}%`
            : `• ${f.name.trim()}: ${formatTemplateMoney(f.amount, c.currency)}`,
        )
      if (feeLines.length) blocks.push(['Fees', ...feeLines].join('\n'))
      return blocks.filter(Boolean).join('\n\n')
    }
    case 'menu': {
      const c = content as MenuContent
      const lines = c.items
        .filter((i) => i.label.trim())
        .map((i) => {
          const desc = i.description.trim() ? ` — ${i.description.trim()}` : ''
          return `• ${i.label.trim()}${desc}`
        })
      return [c.title.trim(), ...lines].filter(Boolean).join('\n')
    }
    case 'message':
      return (content as MessageContent).text.trim()
    case 'hours': {
      const c = content as HoursContent
      const lines = c.days.map((d) =>
        d.closed ? `${d.day}: Closed` : `${d.day}: ${d.open}–${d.close}`,
      )
      return [c.timezone.trim() ? `Timezone: ${c.timezone.trim()}` : '', ...lines, c.note.trim()]
        .filter(Boolean)
        .join('\n')
    }
    case 'legal': {
      const c = content as LegalContent
      return [c.title.trim(), c.body.trim()].filter(Boolean).join('\n\n')
    }
    case 'receipt': {
      const c = content as ReceiptContent
      return renderReceiptFromCart(c, null, null)
    }
  }
}

export function templateExprValue(args: {
  id: string
  key: string
  name: string
  kind: TemplateKind
  content: unknown
}): Record<string, unknown> {
  const content = parseTemplateContent(args.kind, args.content)
  const text = renderTemplateText(args.kind, content)
  const base: Record<string, unknown> = {
    id: args.id,
    key: args.key,
    name: args.name,
    kind: args.kind,
    text,
    ...content,
  }
  if (args.kind === 'email') {
    const c = content as EmailContent
    base.subject = c.subject
    base.html = c.html
    base.body = c.html
  }
  if (args.kind === 'faq') {
    base.labels = (content as FaqContent).items.map((i) => i.question).filter(Boolean)
  }
  if (args.kind === 'menu') {
    base.labels = (content as MenuContent).items.map((i) => i.label).filter(Boolean)
  }
  if (args.kind === 'cart') {
    const c = content as CartContent
    base.labels = c.products.map((p) => p.name).filter(Boolean)
    base.productCount = c.products.filter((p) => p.name.trim()).length
    base.categoryNames = c.categories.map((cat) => cat.name).filter(Boolean)
  }
  if (args.kind === 'receipt') {
    base.html = renderReceiptHtml(text)
  }
  return base
}

export type ShopCartLine = {
  id: string
  sku: string
  name: string
  price: number
  qty: number
  lineTotal: number
  categoryId: string
}

export type ShopCartFeeLine = {
  id: string
  name: string
  kind: StoreFeeKind
  amount: number
  value: number
}

export type ShopCartValue = {
  items: ShopCartLine[]
  currency: string
  itemCount: number
  subtotal: number
  fees: ShopCartFeeLine[]
  feesTotal: number
  total: number
}

export function cartCatalogFromExpr(value: unknown): CartContent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rec = value as Record<string, unknown>
  if (
    rec.kind === 'cart' ||
    Array.isArray(rec.products) ||
    Array.isArray(rec.categories) ||
    Array.isArray(rec.items)
  ) {
    return parseTemplateContent('cart', rec) as CartContent
  }
  if (rec.content && typeof rec.content === 'object' && !Array.isArray(rec.content)) {
    return cartCatalogFromExpr(rec.content)
  }
  return null
}

export function cartCatalogFromTemplates(
  templates: Record<string, unknown> | undefined,
  key: string,
): CartContent | null {
  const trimmed = key.trim()
  if (!trimmed || !templates) return null
  const direct = cartCatalogFromExpr(templates[trimmed])
  if (direct) return direct
  for (const value of Object.values(templates)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const rec = value as Record<string, unknown>
    if (String(rec.key ?? '').trim() !== trimmed) continue
    const found = cartCatalogFromExpr(value)
    if (found) return found
  }
  return null
}

export function qtyMapFromShopAnswer(answer: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!answer || typeof answer !== 'object') return out
  const rec = answer as Record<string, unknown>
  const items = Array.isArray(rec.items) ? rec.items : Array.isArray(answer) ? answer : []
  for (const item of items) {
    const row = asRecord(item)
    const id = str(row.id)
    const qty = Math.floor(num(row.qty))
    if (!id || qty <= 0) continue
    out[id] = (out[id] ?? 0) + qty
  }
  return out
}

export function buildShopCart(catalog: CartContent, qtyById: Record<string, number>): ShopCartValue {
  const byId = new Map(catalog.products.filter((p) => p.id && p.name.trim()).map((p) => [p.id, p]))
  const items: ShopCartLine[] = []
  for (const [id, rawQty] of Object.entries(qtyById)) {
    const product = byId.get(id)
    if (!product) continue
    const qty = Math.min(productMaxQty(product), Math.max(0, Math.floor(rawQty)))
    if (qty <= 0) continue
    items.push({
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      qty,
      lineTotal: Number((product.price * qty).toFixed(2)),
      categoryId: product.categoryId,
    })
  }
  const itemCount = items.reduce((sum, line) => sum + line.qty, 0)
  const subtotal = money(items.reduce((sum, line) => sum + line.lineTotal, 0))
  const fees: ShopCartFeeLine[] = []
  if (itemCount > 0) {
    for (const fee of catalog.fees ?? []) {
      const name = fee.name.trim()
      if (!name || !(fee.amount > 0)) continue
      const value =
        fee.kind === 'percent' ? money((subtotal * fee.amount) / 100) : money(fee.amount)
      if (value <= 0) continue
      fees.push({
        id: fee.id,
        name,
        kind: fee.kind === 'percent' ? 'percent' : 'fixed',
        amount: fee.amount,
        value,
      })
    }
  }
  const feesTotal = money(fees.reduce((sum, fee) => sum + fee.value, 0))
  return {
    items,
    currency: catalog.currency || 'USD',
    itemCount,
    subtotal,
    fees,
    feesTotal,
    total: money(subtotal + feesTotal),
  }
}

export type PaymentReceiptBits = {
  reference?: string | null
  amount?: unknown
  currency?: string | null
  status?: string | null
}

export function findCartInVars(vars: Record<string, unknown>): ShopCartValue | null {
  for (const value of Object.values(vars)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const rec = value as Record<string, unknown>
    if (Array.isArray(rec.items) && ('total' in rec || 'subtotal' in rec || 'itemCount' in rec)) {
      return rec as unknown as ShopCartValue
    }
  }
  return null
}

export function findPaymentInVars(
  vars: Record<string, unknown>,
  steps: Record<string, unknown>,
): PaymentReceiptBits | null {
  const fromVars = Object.values(vars)
    .map((v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null))
    .find((row) => row && (row.reference || String(row.status ?? '') === 'paid'))
  if (fromVars?.reference || fromVars?.status) {
    return {
      reference: fromVars.reference != null ? String(fromVars.reference) : null,
      amount: fromVars.amount,
      currency: fromVars.currency != null ? String(fromVars.currency) : null,
      status: fromVars.status != null ? String(fromVars.status) : null,
    }
  }
  for (const value of Object.values(steps)) {
    const rec = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
    const response =
      rec?.response && typeof rec.response === 'object' ? (rec.response as Record<string, unknown>) : rec
    if (response?.reference) {
      return {
        reference: String(response.reference),
        amount: response.amount,
        currency: response.currency != null ? String(response.currency) : null,
        status: response.status != null ? String(response.status) : null,
      }
    }
  }
  return null
}

export function renderReceiptFromCart(
  content: ReceiptContent,
  cart?: ShopCartValue | null,
  payment?: PaymentReceiptBits | null,
): string {
  const lines: string[] = []
  if (content.title.trim()) lines.push(content.title.trim())
  if (content.intro.trim()) lines.push(content.intro.trim())
  if (cart?.itemCount) {
    lines.push('')
    for (const item of cart.items) {
      lines.push(`${item.name} × ${item.qty} — ${formatTemplateMoney(item.lineTotal, cart.currency)}`)
    }
    if (cart.fees?.length) {
      lines.push(`Subtotal ${formatTemplateMoney(cart.subtotal, cart.currency)}`)
      for (const fee of cart.fees) {
        lines.push(`${fee.name} ${formatTemplateMoney(fee.value, cart.currency)}`)
      }
    }
    lines.push(`Total ${formatTemplateMoney(cart.total ?? cart.subtotal, cart.currency)}`)
  }
  if (payment?.reference) {
    lines.push(`Reference ${payment.reference}`)
  }
  if (content.footer.trim()) {
    lines.push('')
    lines.push(content.footer.trim())
  }
  return lines
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n')
}

export function renderReceiptHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>\n')
}

export function shopCartDisplayText(cart: ShopCartValue): string {
  if (!cart.itemCount) return 'Empty cart'
  const payable = cart.total ?? cart.subtotal
  const formatted = formatTemplateMoney(payable, cart.currency)
  const names = cart.items.map((line) => `${line.name} × ${line.qty}`).join(', ')
  const feeNote =
    cart.fees?.length
      ? ` incl. ${cart.fees.map((f) => f.name).join(', ')}`
      : ''
  return `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'} · ${formatted}${feeNote}${names ? ` (${names})` : ''}`
}

export function collectStoreImageFilenames(
  rows: Array<{ kind: string; content: unknown }>,
): string[] {
  const names = new Set<string>()
  for (const row of rows) {
    if (row.kind !== 'cart') continue
    const catalog = parseTemplateContent('cart', row.content) as CartContent
    for (const product of catalog.products) {
      const image = product.image.trim()
      if (image) names.add(image)
    }
  }
  return [...names]
}

export function insertSnippet(key: string, kind: TemplateKind): string {
  const field = TEMPLATE_KIND_META[kind].insertField
  return `{{templates.${key}.${field}}}`
}

export function keyFromTemplateName(name: string, kind: TemplateKind): string {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const withLetter = /^[A-Za-z]/.test(cleaned) ? cleaned : `${kind}_${cleaned}`
  return withLetter.slice(0, 48) || kind
}

export function isTemplateKind(value: string): value is TemplateKind {
  return (TEMPLATE_KINDS as readonly string[]).includes(value)
}

export function templatesExprMap(
  rows: Array<{ id: string; key: string; name: string; kind: string; content: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const row of rows) {
    if (!isTemplateKind(row.kind) || !row.key.trim()) continue
    out[row.key] = templateExprValue({
      id: row.id,
      key: row.key,
      name: row.name,
      kind: row.kind,
      content: row.content,
    })
  }
  return out
}
