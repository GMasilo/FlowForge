import { parseDocumentBlocks } from '@/features/templates/documentLayout'

export const TEMPLATE_KINDS = [
  'email',
  'faq',
  'cart',
  'menu',
  'message',
  'hours',
  'legal',
  'receipt',
  'document',
  'agreement',
  'sso',
  'appointment',
  'location',
  'map',
  'qr',
  'whatsapp',
  'team',
  'pricing',
  'survey',
  'announcement',
  'sms',
  'push',
  'ticket',
  'certificate',
  'checklist',
  'consent',
  'webhook',
] as const

export type TemplateKind = (typeof TEMPLATE_KINDS)[number]

/** High-level buckets for the Templates ΓåÆ Create picker. */
export const TEMPLATE_KIND_CATEGORIES = [
  'messaging',
  'commerce',
  'content',
  'documents',
  'engagement',
  'integrations',
] as const

export type TemplateKindCategory = (typeof TEMPLATE_KIND_CATEGORIES)[number]

export const TEMPLATE_KIND_CATEGORY_META: Record<
  TemplateKindCategory,
  { label: string; hint: string }
> = {
  messaging: { label: 'Messaging', hint: 'Email, chat, SMS, and push' },
  commerce: { label: 'Commerce', hint: 'Catalogs, menus, pricing, receipts' },
  content: { label: 'Content', hint: 'FAQ, hours, locations, maps, QR, team, legal' },
  documents: { label: 'Documents', hint: 'Downloadable PDF / Word / Excel' },
  engagement: { label: 'Engagement', hint: 'Surveys, tickets, consent, appointments' },
  integrations: { label: 'Integrations', hint: 'SSO and webhooks' },
}

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

export const TEMPLATE_INPUT_TYPES = ['string', 'number', 'boolean', 'date', 'file'] as const
export type TemplateInputType = (typeof TEMPLATE_INPUT_TYPES)[number]

export type TemplateInput = {
  key: string
  label: string
  type: TemplateInputType
  required: boolean
}

export const COPY_TEMPLATE_KINDS = [
  'email',
  'faq',
  'menu',
  'message',
  'hours',
  'legal',
  'receipt',
  'document',
  'agreement',
  'appointment',
  'location',
  'map',
  'qr',
  'whatsapp',
  'team',
  'pricing',
  'survey',
  'announcement',
  'sms',
  'push',
  'ticket',
  'certificate',
  'checklist',
  'consent',
  'webhook',
] as const satisfies readonly TemplateKind[]

/** Downloadable file templates (PDF/Word/Excel) that use DocumentContent + {{templates.key.file}}. */
export const FILE_TEMPLATE_KINDS = ['document', 'agreement', 'certificate', 'checklist'] as const satisfies readonly TemplateKind[]

export function isFileTemplateKind(kind: string): kind is (typeof FILE_TEMPLATE_KINDS)[number] {
  return (FILE_TEMPLATE_KINDS as readonly string[]).includes(kind)
}

export function isTemplateInputType(value: string): value is TemplateInputType {
  return (TEMPLATE_INPUT_TYPES as readonly string[]).includes(value)
}

export function isCopyTemplateKind(kind: TemplateKind): boolean {
  return (COPY_TEMPLATE_KINDS as readonly TemplateKind[]).includes(kind)
}

export function emptyTemplateInput(): TemplateInput {
  return { key: '', label: '', type: 'string', required: true }
}

export function slugTemplateInputKey(raw: string, fallback: string): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const withLetter = /^[A-Za-z]/.test(cleaned) ? cleaned : fallback
  return withLetter.slice(0, 48) || fallback
}

export type EmailContent = { subject: string; html: string; inputs: TemplateInput[] }
export type FaqContent = { intro: string; items: FaqItem[]; inputs: TemplateInput[] }
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
export type MenuContent = { title: string; items: MenuItem[]; inputs: TemplateInput[] }
export type MessageContent = { text: string; inputs: TemplateInput[] }
export type HoursContent = { timezone: string; note: string; days: HoursDay[]; inputs: TemplateInput[] }
export type LegalContent = { title: string; body: string; inputs: TemplateInput[] }
export type ReceiptContent = { title: string; intro: string; footer: string; inputs: TemplateInput[] }

export const DOCUMENT_FORMATS = ['pdf', 'docx', 'xlsx'] as const
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]
export type DocumentFieldAs = 'text' | 'image'

export type DocumentField = {
  label: string
  value: string
  as: DocumentFieldAs
}

/** Column mapping for multi-row tables filled from an array variable. */
export type DocumentTableColumn = {
  /** Property on each row object (e.g. name) or 0-based index for array rows. */
  key: string
  label: string
}

export const DOCUMENT_LAYOUTS = ['flow', 'page'] as const
export type DocumentLayout = (typeof DOCUMENT_LAYOUTS)[number]
export const DOCUMENT_ORIENTATIONS = ['portrait', 'landscape'] as const
export type DocumentOrientation = (typeof DOCUMENT_ORIENTATIONS)[number]
export const DOCUMENT_BLOCK_TYPES = ['heading', 'text', 'field', 'image', 'divider', 'cart'] as const
export type DocumentBlockType = (typeof DOCUMENT_BLOCK_TYPES)[number]
export type DocumentAlign = 'left' | 'center' | 'right'
export const DOCUMENT_FONTS = ['helvetica', 'times', 'courier'] as const
export type DocumentFont = (typeof DOCUMENT_FONTS)[number]

export function isDocumentFont(value: string): value is DocumentFont {
  return value === 'helvetica' || value === 'times' || value === 'courier'
}

export function isDocumentOrientation(value: string): value is DocumentOrientation {
  return value === 'portrait' || value === 'landscape'
}

export type DocumentBlock = {
  id: string
  type: DocumentBlockType
  x: number
  y: number
  w: number
  h: number
  page: number
  text: string
  label: string
  value: string
  align: DocumentAlign
  fontSize: number
  fontFamily: DocumentFont
  bold: boolean
  color: string
  fill: string
}

export type DocumentContent = {
  format: DocumentFormat
  filename: string
  title: string
  intro: string
  body: string
  footer: string
  fields: DocumentField[]
  /** Expression resolving to an array of objects/arrays (e.g. {{inputs.lines}} or {{vars.items}}). */
  tableRowsSource: string
  tableColumns: DocumentTableColumn[]
  includeCart: boolean
  layout: DocumentLayout
  orientation: DocumentOrientation
  blocks: DocumentBlock[]
  inputs: TemplateInput[]
}

export type SsoProtocol = 'oidc' | 'saml'

/** IdP config for visitor Sign-in SSO ΓÇö stored on chatbot Templates, referenced by key. */
export type SsoContent = {
  protocol: SsoProtocol
  providerName: string
  buttonLabel: string
  oidcIssuer: string
  oidcClientId: string
  /** Optional secret reference / value ΓÇö prefer server vault for production. */
  oidcClientSecret: string
  oidcAuthorizationUrl: string
  oidcTokenUrl: string
  oidcJwksUrl: string
  oidcScopes: string
  samlEntityId: string
  samlSsoUrl: string
  samlCertificate: string
  samlAcsUrl: string
  emailClaim: string
  userIdClaim: string
  previewEmail: string
}

// --- New template content types ---

export type AppointmentService = {
  id: string
  name: string
  durationMinutes: number
  description: string
}

export type AppointmentContent = {
  title: string
  intro: string
  timezone: string
  services: AppointmentService[]
  note: string
  inputs: TemplateInput[]
}

export type LocationEntry = {
  name: string
  address: string
  city: string
  phone: string
  email: string
  hoursNote: string
  mapUrl: string
}

export type LocationContent = {
  intro: string
  locations: LocationEntry[]
  inputs: TemplateInput[]
}

export type MapPin = {
  label: string
  description: string
  /** Decimal latitude (or a template expression like {{vars.lat}}). */
  lat: string
  /** Decimal longitude (or a template expression). */
  lng: string
  link: string
}

export type MapContent = {
  title: string
  intro: string
  /** Fallback center when no pins resolve to numbers. */
  centerLat: string
  centerLng: string
  zoom: number
  style: 'roadmap' | 'satellite'
  /** Optional full iframe/embed URL. When set, overrides the generated OSM embed. */
  embedUrl: string
  pins: MapPin[]
  inputs: TemplateInput[]
}

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H'

export type QrContent = {
  title: string
  caption: string
  /** Text or URL encoded into the QR (supports {{inputs.*}} / expressions). */
  payload: string
  /** Pixel width/height of the generated image. */
  size: number
  errorCorrection: QrErrorCorrection
  foreground: string
  background: string
  /** Suggested download filename (PNG). */
  filename: string
  inputs: TemplateInput[]
}


export type WhatsappContent = {
  /** Phone for wa.me — digits or {{inputs.*}} */
  phone: string
  /** Prefill message — plain text or {{inputs.*}} */
  message: string
  buttonLabel: string
  title: string
  subtitle: string
  inputs: TemplateInput[]
}

export type CalendarContent = {
  title: string
  description: string
  location: string
  start: string
  end: string
  timezone: string
  buttonLabel: string
  inputs: TemplateInput[]
}

export type SocialSharePlatform = 'x' | 'linkedin' | 'facebook'

export type SocialShareContent = {
  url: string
  title: string
  text: string
  platforms: SocialSharePlatform[]
  inputs: TemplateInput[]
}

export type WaitlistContent = {
  title: string
  subtitle: string
  position: string
  eta: string
  message: string
  notifyLabel: string
  inputs: TemplateInput[]
}
export type TeamMember = {
  name: string
  role: string
  skills: string
  email: string
  handoffKey: string
}

export type TeamContent = {
  intro: string
  members: TeamMember[]
  inputs: TemplateInput[]
}

export type PricingPlan = {
  name: string
  price: number
  period: string
  features: string[]
  highlight: boolean
}

export type PricingContent = {
  currency: string
  intro: string
  plans: PricingPlan[]
  inputs: TemplateInput[]
}

export type SurveyQuestionKind = 'nps' | 'likert' | 'text' | 'choice'

export type SurveyQuestion = {
  prompt: string
  kind: SurveyQuestionKind
  choices: string[]
}

export type SurveyContent = {
  intro: string
  questions: SurveyQuestion[]
  inputs: TemplateInput[]
}

export type AnnouncementSeverity = 'info' | 'promo' | 'warning'

export type AnnouncementContent = {
  title: string
  body: string
  severity: AnnouncementSeverity
  startsAt: string
  endsAt: string
  ctaLabel: string
  ctaValue: string
  inputs: TemplateInput[]
}

export type SmsChannel = 'sms' | 'whatsapp'

export type SmsContent = {
  channel: SmsChannel
  body: string
  maxChars: number
  inputs: TemplateInput[]
}

export type PushContent = {
  title: string
  body: string
  inputs: TemplateInput[]
}

export type TicketPriority = 'low' | 'normal' | 'high'

export type TicketField = {
  label: string
  value: string
}

export type TicketContent = {
  title: string
  priority: TicketPriority
  summary: string
  fields: TicketField[]
  inputs: TemplateInput[]
}

export type ConsentContent = {
  title: string
  version: string
  body: string
  acceptLabel: string
  declineLabel: string
  effectiveAt: string
  inputs: TemplateInput[]
}

export type WebhookMethod = 'POST' | 'PUT' | 'PATCH'

export type WebhookHeader = {
  key: string
  value: string
}

export type WebhookContent = {
  name: string
  description: string
  method: WebhookMethod
  contentType: string
  bodyJson: string
  headers: WebhookHeader[]
  inputs: TemplateInput[]
}

// certificate and checklist use DocumentContent

export type TemplateContent =
  | EmailContent
  | FaqContent
  | CartContent
  | MenuContent
  | MessageContent
  | HoursContent
  | LegalContent
  | ReceiptContent
  | DocumentContent
  | SsoContent
  | AppointmentContent
  | LocationContent
  | MapContent
  | QrContent
  | WhatsappContent
  | CalendarContent
  | SocialShareContent
  | WaitlistContent
  | TeamContent
  | PricingContent
  | SurveyContent
  | AnnouncementContent
  | SmsContent
  | PushContent
  | TicketContent
  | ConsentContent
  | WebhookContent

export const TEMPLATE_KIND_META: Record<
  TemplateKind,
  {
    label: string
    hint: string
    insertField: string
    category: TemplateKindCategory
    tags: readonly string[]
  }
> = {
  email: {
    label: 'HTML email',
    hint: 'Subject + HTML body for Email steps and OTP messages',
    insertField: 'html',
    category: 'messaging',
    tags: ['email', 'otp', 'html'],
  },
  faq: {
    label: 'Help / FAQ',
    hint: 'Reusable Q&A you can drop into chat steps',
    insertField: 'text',
    category: 'content',
    tags: ['chat', 'help', 'faq'],
  },
  cart: {
    label: 'Store catalog',
    hint: 'Categories, products, and checkout fees visitors add to a cart',
    insertField: 'text',
    category: 'commerce',
    tags: ['shop', 'products', 'checkout'],
  },
  menu: {
    label: 'Menu',
    hint: 'Quick-reply style options and help menus',
    insertField: 'text',
    category: 'commerce',
    tags: ['chat', 'menu', 'options'],
  },
  message: {
    label: 'Chat message',
    hint: 'Welcome, away, or handoff copy',
    insertField: 'text',
    category: 'messaging',
    tags: ['chat', 'copy'],
  },
  hours: {
    label: 'Opening hours',
    hint: 'Weekly schedule shown in chat or email',
    insertField: 'text',
    category: 'content',
    tags: ['schedule', 'hours'],
  },
  legal: {
    label: 'Legal',
    hint: 'Terms, privacy, or consent copy',
    insertField: 'text',
    category: 'content',
    tags: ['legal', 'privacy', 'terms'],
  },
  receipt: {
    label: 'Receipt',
    hint: 'Order confirmation filled from the cart and payment at send time',
    insertField: 'text',
    category: 'commerce',
    tags: ['shop', 'payment', 'receipt'],
  },
  document: {
    label: 'Downloadable file',
    hint: 'PDF, Word, or Excel filled from answers ΓÇö list layout or a visual A4 page (portrait or landscape)',
    insertField: 'file',
    category: 'documents',
    tags: ['pdf', 'word', 'excel', 'download'],
  },
  agreement: {
    label: 'Agreement',
    hint: 'Adobe SignΓÇôstyle PDF: parties, terms, signature, and date signed ΓÇö download after the visitor signs',
    insertField: 'file',
    category: 'documents',
    tags: ['pdf', 'signature', 'legal'],
  },
  sso: {
    label: 'SSO / IdP',
    hint: 'OIDC or SAML identity provider for Sign-in steps ΓÇö configure here, then select on the step',
    insertField: 'providerName',
    category: 'integrations',
    tags: ['auth', 'oidc', 'saml'],
  },
  appointment: {
    label: 'Appointment',
    hint: 'Bookable services with duration, timezone, and notes',
    insertField: 'text',
    category: 'engagement',
    tags: ['booking', 'calendar'],
  },
  location: {
    label: 'Locations',
    hint: 'Store or office addresses, phone, email, and hours',
    insertField: 'text',
    category: 'content',
    tags: ['address', 'map', 'contact'],
  },
  map: {
    label: 'Map view',
    hint: 'Interactive map with pins ΓÇö show stores, meetups, or delivery zones in chat',
    insertField: 'text',
    category: 'content',
    tags: ['map', 'pins', 'geo', 'embed'],
  },
  qr: {
    label: 'QR code',
    hint: 'Generate a scannable QR from a URL or text ΓÇö show and download in chat',
    insertField: 'text',
    category: 'content',
    tags: ['qr', 'barcode', 'link', 'embed'],
  },
  whatsapp: {
    label: 'WhatsApp',
    hint: 'Chat to us on WhatsApp — builds https://wa.me/{number}?text={message}',
    insertField: 'text',
    category: 'messaging',
    tags: ['whatsapp', 'chat', 'cta', 'embed', 'contact', 'wa.me'],
  },    calendar: {
    label: 'Calendar invite',
    hint: 'Booking invite — Google Calendar URL from start/end/title',
    insertField: 'text',
    category: 'engagement',
    tags: ['calendar', 'booking', 'ics', 'google', 'invite'],
  },
  social_share: {
    label: 'Social share',
    hint: 'Prefilled share links for X, LinkedIn, and Facebook',
    insertField: 'text',
    category: 'engagement',
    tags: ['share', 'x', 'twitter', 'linkedin', 'facebook', 'social'],
  },
  waitlist: {
    label: 'Waitlist',
    hint: 'Queue position, ETA, and notify-me copy',
    insertField: 'text',
    category: 'engagement',
    tags: ['waitlist', 'queue', 'eta', 'notify'],
  },team: {
    label: 'Team',
    hint: 'Team members with roles, skills, and handoff keys',
    insertField: 'text',
    category: 'content',
    tags: ['people', 'handoff'],
  },
  pricing: {
    label: 'Pricing',
    hint: 'Pricing plans with features and highlight option',
    insertField: 'text',
    category: 'commerce',
    tags: ['plans', 'pricing'],
  },
  survey: {
    label: 'Survey',
    hint: 'NPS, Likert, text, or choice questions',
    insertField: 'text',
    category: 'engagement',
    tags: ['nps', 'feedback', 'form'],
  },
  announcement: {
    label: 'Announcement',
    hint: 'Banners and promos with severity, dates, and CTA',
    insertField: 'text',
    category: 'messaging',
    tags: ['banner', 'promo'],
  },
  sms: {
    label: 'SMS / WhatsApp',
    hint: 'Short messages with character limits for SMS or WhatsApp',
    insertField: 'text',
    category: 'messaging',
    tags: ['sms', 'whatsapp'],
  },
  push: {
    label: 'Push notification',
    hint: 'Title and body for mobile push messages',
    insertField: 'text',
    category: 'messaging',
    tags: ['push', 'mobile'],
  },
  ticket: {
    label: 'Ticket',
    hint: 'Support ticket with priority, summary, and fields',
    insertField: 'text',
    category: 'engagement',
    tags: ['support', 'ticket'],
  },
  certificate: {
    label: 'Certificate',
    hint: 'PDF certificate filled from answers ΓÇö download after completion',
    insertField: 'file',
    category: 'documents',
    tags: ['pdf', 'certificate'],
  },
  checklist: {
    label: 'Checklist',
    hint: 'PDF checklist document ΓÇö download after completion',
    insertField: 'file',
    category: 'documents',
    tags: ['pdf', 'checklist'],
  },
  consent: {
    label: 'Consent',
    hint: 'Versioned consent form with accept/decline labels',
    insertField: 'text',
    category: 'engagement',
    tags: ['consent', 'gdpr', 'form'],
  },
  webhook: {
    label: 'Webhook',
    hint: 'HTTP request config ΓÇö method, headers, and JSON body',
    insertField: 'text',
    category: 'integrations',
    tags: ['http', 'api', 'webhook'],
  },
}

/** Unique tags across all template kinds (sorted). */
export function allTemplateKindTags(): string[] {
  const tags = new Set<string>()
  for (const kind of TEMPLATE_KINDS) {
    for (const tag of TEMPLATE_KIND_META[kind].tags) tags.add(tag)
  }
  return [...tags].sort((a, b) => a.localeCompare(b))
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return {}
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

export function parseTemplateInputs(raw: unknown): TemplateInput[] {
  if (!Array.isArray(raw)) return []
  const out: TemplateInput[] = []
  const seen = new Set<string>()
  raw.forEach((item, index) => {
    const row = asRecord(item)
    const key = slugTemplateInputKey(str(row.key) || str(row.label), `input_${index + 1}`)
    if (!key || seen.has(key)) return
    seen.add(key)
    const typeRaw = str(row.type)
    out.push({
      key,
      label: str(row.label) || key,
      type: isTemplateInputType(typeRaw) ? typeRaw : 'string',
      required: row.required !== false,
    })
  })
  return out
}

export function templateInputsOf(content: TemplateContent): TemplateInput[] {
  if (!content || typeof content !== 'object' || !('inputs' in content)) return []
  const inputs = (content as { inputs?: unknown }).inputs
  return Array.isArray(inputs) ? (inputs as TemplateInput[]) : []
}

export type TemplateBindingMap = Record<string, Record<string, string>>

export function parseTemplateBindingMap(raw: unknown): TemplateBindingMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: TemplateBindingMap = {}
  for (const [templateKey, inner] of Object.entries(raw as Record<string, unknown>)) {
    if (!templateKey.trim()) continue
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) {
      out[templateKey] = {}
      continue
    }
    const row: Record<string, string> = {}
    for (const [inputKey, value] of Object.entries(inner as Record<string, unknown>)) {
      row[inputKey] = typeof value === 'string' ? value : String(value ?? '')
    }
    out[templateKey] = row
  }
  return out
}

export function inputSuggestionsFromTemplate(inputs: TemplateInput[]): Array<{ insert: string; label: string; hint: string }> {
  return inputs
    .filter((input) => input.key.trim())
    .map((input) => ({
      insert: `{{inputs.${input.key}}}`,
      label: input.label || input.key,
      hint: `${input.type}${input.required ? ' ┬╖ required' : ''}`,
    }))
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

export function emptyDocumentField(): DocumentField {
  return { label: '', value: '', as: 'text' }
}

export function emptyDocumentTableColumn(): DocumentTableColumn {
  return { key: '', label: '' }
}

export function isDocumentFormat(value: string): value is DocumentFormat {
  return (DOCUMENT_FORMATS as readonly string[]).includes(value)
}

export function documentExtension(format: DocumentFormat): string {
  return format
}

export function documentMime(format: DocumentFormat): string {
  if (format === 'pdf') return 'application/pdf'
  if (format === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

export function sanitizeDocumentFilename(raw: string, format: DocumentFormat): string {
  const trimmed = raw.trim() || `document.${format}`
  const base = trimmed.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ')
  const ext = `.${format}`
  if (base.toLowerCase().endsWith(ext)) return base
  const withoutExt = base.replace(/\.[A-Za-z0-9]+$/, '')
  return `${withoutExt || 'document'}${ext}`
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

function parseDocumentFields(raw: unknown): DocumentField[] {
  if (!Array.isArray(raw)) return [emptyDocumentField()]
  const fields = raw.map((item) => {
    const row = asRecord(item)
    return {
      label: str(row.label),
      value: str(row.value),
      as: str(row.as) === 'image' ? 'image' : 'text',
    } satisfies DocumentField
  })
  return fields.length ? fields : [emptyDocumentField()]
}

function parseDocumentTableColumns(raw: unknown): DocumentTableColumn[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const row = asRecord(item)
      return {
        key: str(row.key),
        label: str(row.label) || str(row.key),
      } satisfies DocumentTableColumn
    })
    .filter((col) => col.key.trim() || col.label.trim())
}

export function parseDocumentContent(raw: Record<string, unknown> | DocumentContent): DocumentContent {
  const c = asRecord(raw)
  const format = isDocumentFormat(str(c.format)) ? (str(c.format) as DocumentFormat) : 'pdf'
  return {
    format,
    filename: str(c.filename, `document.${format}`) || `document.${format}`,
    title: str(c.title),
    intro: str(c.intro),
    body: str(c.body),
    footer: str(c.footer),
    fields: parseDocumentFields(c.fields),
    tableRowsSource: str(c.tableRowsSource),
    tableColumns: parseDocumentTableColumns(c.tableColumns),
    includeCart: c.includeCart === true,
    layout: str(c.layout) === 'page' ? 'page' : 'flow',
    orientation: isDocumentOrientation(str(c.orientation)) ? (str(c.orientation) as DocumentOrientation) : 'portrait',
    blocks: parseDocumentBlocks(c.blocks),
    inputs: parseTemplateInputs(c.inputs),
  }
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
      return { subject: '', html: '', inputs: [] }
    case 'faq':
      return { intro: '', items: [{ question: '', answer: '' }], inputs: [] }
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
      return { title: '', items: [{ label: '', description: '', value: '' }], inputs: [] }
    case 'message':
      return { text: '', inputs: [] }
    case 'hours':
      return { timezone: '', note: '', days: emptyHoursDays(), inputs: [] }
    case 'legal':
      return { title: '', body: '', inputs: [] }
    case 'receipt':
      return { title: 'Your receipt', intro: '', footer: 'Thank you for your order.', inputs: [] }
    case 'document':
      return {
        format: 'pdf',
        filename: 'document.pdf',
        title: '',
        intro: '',
        body: '',
        footer: '',
        fields: [emptyDocumentField()],
        tableRowsSource: '',
        tableColumns: [],
        includeCart: false,
        layout: 'flow',
        orientation: 'portrait',
        blocks: [],
        inputs: [],
      }
    case 'agreement':
      return emptyAgreementContent()
    case 'sso':
      return emptySsoContent()
    case 'appointment':
      return emptyAppointmentContent()
    case 'location':
      return emptyLocationContent()
    case 'map':
      return emptyMapContent()
    case 'qr':
      return emptyQrContent()
    case 'whatsapp':
      return emptyWhatsappContent()
    case 'calendar':
      return emptyCalendarContent()
    case 'social_share':
      return emptySocialShareContent()
    case 'waitlist':
      return emptyWaitlistContent()
    case 'team':
      return emptyTeamContent()
    case 'pricing':
      return emptyPricingContent()
    case 'survey':
      return emptySurveyContent()
    case 'announcement':
      return emptyAnnouncementContent()
    case 'sms':
      return emptySmsContent()
    case 'push':
      return emptyPushContent()
    case 'ticket':
      return emptyTicketContent()
    case 'certificate':
      return emptyCertificateContent()
    case 'checklist':
      return emptyChecklistContent()
    case 'consent':
      return emptyConsentContent()
    case 'webhook':
      return emptyWebhookContent()
  }
}

export function emptyAgreementContent(): DocumentContent {
  return {
    format: 'pdf',
    filename: 'agreement.pdf',
    title: '',
    intro: '',
    body: '',
    footer: '',
    fields: [
      { label: 'Signer name', value: '{{inputs.signer_name}}', as: 'text' },
      { label: 'Signer email', value: '{{inputs.signer_email}}', as: 'text' },
      { label: 'Signature', value: '{{inputs.signature}}', as: 'image' },
      { label: 'Date signed', value: '{{inputs.signed_at}}', as: 'text' },
    ],
    tableRowsSource: '',
    tableColumns: [],
    includeCart: false,
    layout: 'flow',
    orientation: 'portrait',
    blocks: [],
    inputs: [
      { key: 'signer_name', label: 'Signer name', type: 'string', required: true },
      { key: 'signer_email', label: 'Signer email', type: 'string', required: true },
      { key: 'signature', label: 'Signature', type: 'file', required: true },
      { key: 'signed_at', label: 'Date signed', type: 'date', required: false },
    ],
  }
}

export function emptySsoContent(): SsoContent {
  return {
    protocol: 'oidc',
    providerName: '',
    buttonLabel: 'Continue with SSO',
    oidcIssuer: '',
    oidcClientId: '',
    oidcClientSecret: '',
    oidcAuthorizationUrl: '',
    oidcTokenUrl: '',
    oidcJwksUrl: '',
    oidcScopes: 'openid email profile',
    samlEntityId: '',
    samlSsoUrl: '',
    samlCertificate: '',
    samlAcsUrl: '',
    emailClaim: 'email',
    userIdClaim: 'sub',
    previewEmail: 'sso.user@example.com',
  }
}

export function emptyAppointmentService(): AppointmentService {
  return { id: newStoreId('svc'), name: '', durationMinutes: 30, description: '' }
}

export function emptyAppointmentContent(): AppointmentContent {
  return {
    title: '',
    intro: '',
    timezone: '',
    services: [emptyAppointmentService()],
    note: '',
    inputs: [],
  }
}

export function emptyLocationEntry(): LocationEntry {
  return { name: '', address: '', city: '', phone: '', email: '', hoursNote: '', mapUrl: '' }
}

export function emptyLocationContent(): LocationContent {
  return { intro: '', locations: [emptyLocationEntry()], inputs: [] }
}

export function emptyMapPin(): MapPin {
  return { label: '', description: '', lat: '', lng: '', link: '' }
}

export function emptyMapContent(): MapContent {
  return {
    title: '',
    intro: '',
    centerLat: '-26.2041',
    centerLng: '28.0473',
    zoom: 12,
    style: 'roadmap',
    embedUrl: '',
    pins: [emptyMapPin()],
    inputs: [],
  }
}

export function emptyQrContent(): QrContent {
  return {
    title: '',
    caption: '',
    payload: '',
    size: 180,
    errorCorrection: 'M',
    foreground: '#0f172a',
    background: '#ffffff',
    filename: 'qr.png',
    inputs: [],
  }
}


export function emptyWhatsappContent(): WhatsappContent {
  return {
    phone: '',
    message: '',
    buttonLabel: 'Chat to us on WhatsApp',
    title: '',
    subtitle: '',
    inputs: [],
  }
}

export function emptyCalendarContent(): CalendarContent {
  return {
    title: '', description: '', location: '', start: '', end: '', timezone: '',
    buttonLabel: 'Add to calendar', inputs: [],
  }
}

export function emptySocialShareContent(): SocialShareContent {
  return {
    url: '', title: '', text: '',
    platforms: ['x', 'linkedin', 'facebook'], inputs: [],
  }
}

export function emptyWaitlistContent(): WaitlistContent {
  return {
    title: '', subtitle: '', position: '', eta: '', message: '',
    notifyLabel: 'Notify me', inputs: [],
  }
}
export function emptyTeamMember(): TeamMember {
  return { name: '', role: '', skills: '', email: '', handoffKey: '' }
}

export function emptyTeamContent(): TeamContent {
  return { intro: '', members: [emptyTeamMember()], inputs: [] }
}

export function emptyPricingPlan(): PricingPlan {
  return { name: '', price: 0, period: 'month', features: [], highlight: false }
}

export function emptyPricingContent(): PricingContent {
  return { currency: 'USD', intro: '', plans: [emptyPricingPlan()], inputs: [] }
}

export function emptySurveyQuestion(): SurveyQuestion {
  return { prompt: '', kind: 'text', choices: [] }
}

export function emptySurveyContent(): SurveyContent {
  return { intro: '', questions: [emptySurveyQuestion()], inputs: [] }
}

export function emptyAnnouncementContent(): AnnouncementContent {
  return {
    title: '',
    body: '',
    severity: 'info',
    startsAt: '',
    endsAt: '',
    ctaLabel: '',
    ctaValue: '',
    inputs: [],
  }
}

export function emptySmsContent(): SmsContent {
  return { channel: 'sms', body: '', maxChars: 160, inputs: [] }
}

export function emptyPushContent(): PushContent {
  return { title: '', body: '', inputs: [] }
}

export function emptyTicketField(): TicketField {
  return { label: '', value: '' }
}

export function emptyTicketContent(): TicketContent {
  return { title: '', priority: 'normal', summary: '', fields: [emptyTicketField()], inputs: [] }
}

export function emptyCertificateContent(): DocumentContent {
  return {
    format: 'pdf',
    filename: 'certificate.pdf',
    title: '',
    intro: '',
    body: '',
    footer: '',
    fields: [emptyDocumentField()],
    tableRowsSource: '',
    tableColumns: [],
    includeCart: false,
    layout: 'flow',
    orientation: 'portrait',
    blocks: [],
    inputs: [],
  }
}

export function emptyChecklistContent(): DocumentContent {
  return {
    format: 'pdf',
    filename: 'checklist.pdf',
    title: '',
    intro: '',
    body: '',
    footer: '',
    fields: [emptyDocumentField()],
    tableRowsSource: '',
    tableColumns: [],
    includeCart: false,
    layout: 'flow',
    orientation: 'portrait',
    blocks: [],
    inputs: [],
  }
}

export function emptyConsentContent(): ConsentContent {
  return {
    title: '',
    version: '1.0',
    body: '',
    acceptLabel: 'I accept',
    declineLabel: 'I decline',
    effectiveAt: '',
    inputs: [],
  }
}

export function emptyWebhookHeader(): WebhookHeader {
  return { key: '', value: '' }
}

export function emptyWebhookContent(): WebhookContent {
  return {
    name: '',
    description: '',
    method: 'POST',
    contentType: 'application/json',
    bodyJson: '{}',
    headers: [],
    inputs: [],
  }
}

export function starterTemplateContent(kind: TemplateKind): TemplateContent {
  switch (kind) {
    case 'email':
      return {
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'brand', label: 'Brand', type: 'string', required: false },
          { key: 'message', label: 'Message', type: 'string', required: true },
        ],
        subject: 'Hello {{inputs.name}}',
        html: `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;color:#ffffff;">
            <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;">{{inputs.brand}}</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;">Hello {{inputs.name}}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">Thanks for getting in touch. HereΓÇÖs a quick update:</p>
            <p style="margin:0 0 20px;">{{inputs.message}}</p>
            <p style="margin:0;color:#64748b;font-size:13px;">If you didnΓÇÖt request this, you can ignore the email.</p>
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
        inputs: [],
        intro: 'Here are answers to common questions:',
        items: [
          { question: 'What are your hours?', answer: 'See {{templates.hours_main.text}} or ask a teammate.' },
          { question: 'How do I track an order?', answer: 'Share your order number and we will look it up.' },
          { question: 'Can I talk to a person?', answer: 'Yes ΓÇö say ΓÇ£agentΓÇ¥ and we will hand you over.' },
        ],
      }
    case 'cart': {
      const coffee = { id: 'cat_coffee', name: 'Coffee' }
      const pastry = { id: 'cat_pastries', name: 'Pastries' }
      return {
        currency: 'USD',
        storeName: 'Corner caf├⌐',
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
        inputs: [],
        title: 'How can I help?',
        items: [
          { label: 'Hours', description: 'Opening times', value: 'hours' },
          { label: 'Orders', description: 'Track or change an order', value: 'orders' },
          { label: 'Talk to a person', description: 'Hand off to an agent', value: 'agent' },
        ],
      }
    case 'message':
      return {
        inputs: [{ key: 'name', label: 'Name', type: 'string', required: true }],
        text: 'Hi {{inputs.name}} ΓÇö welcome! I can help with orders, hours, and common questions.',
      }
    case 'hours':
      return {
        inputs: [],
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
        inputs: [],
        title: 'Terms of use',
        body: 'By continuing you agree we may store this conversation to help with your request. We do not sell your personal data.',
      }
    case 'receipt':
      return {
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: false },
          { key: 'order_id', label: 'Order id', type: 'string', required: false },
        ],
        title: 'Order confirmation',
        intro: 'Thanks {{inputs.name}} ΓÇö weΓÇÖve received your order {{inputs.order_id}}.',
        footer: 'Reply to this chat if anything looks wrong.',
      }
    case 'document':
      return {
        format: 'pdf',
        filename: 'agreement-{{inputs.name}}.pdf',
        title: 'Service agreement',
        intro: 'Prepared for {{inputs.name}} on {{prettify(utcNow())}}.',
        body: 'By signing below, {{inputs.name}} agrees to the terms discussed in this conversation.',
        footer: 'Generated by FlowForge.',
        fields: [
          { label: 'Full name', value: '{{inputs.name}}', as: 'text' },
          { label: 'Email', value: '{{inputs.email}}', as: 'text' },
          { label: 'Signature', value: '{{inputs.signature}}', as: 'image' },
        ],
        tableRowsSource: '',
        tableColumns: [],
        includeCart: false,
        layout: 'flow',
        orientation: 'portrait',
        blocks: [],
        inputs: [
          { key: 'name', label: 'Full name', type: 'string', required: true },
          { key: 'email', label: 'Email', type: 'string', required: true },
          { key: 'signature', label: 'Signature', type: 'file', required: true },
        ],
      }
    case 'agreement':
      return {
        format: 'pdf',
        filename: 'agreement-{{inputs.signer_name}}.pdf',
        title: 'Service agreement',
        intro:
          'Please review this agreement carefully. By signing, you acknowledge the terms below and confirm your identity.',
        body: [
          '1. Parties',
          'This agreement is between {{inputs.company_name}} (ΓÇ£ProviderΓÇ¥) and {{inputs.signer_name}} (ΓÇ£SignerΓÇ¥), email {{inputs.signer_email}}.',
          '',
          '2. Scope',
          '{{inputs.scope}}',
          '',
          '3. Acceptance',
          'The Signer confirms they have read and agree to these terms. The electronic signature below has the same effect as a handwritten signature.',
          '',
          '4. Effective date',
          'This agreement takes effect on the date signed below.',
        ].join('\n'),
        footer: 'Electronically signed via FlowForge ┬╖ Keep a copy for your records.',
        fields: [
          { label: 'Provider / company', value: '{{inputs.company_name}}', as: 'text' },
          { label: 'Signer name', value: '{{inputs.signer_name}}', as: 'text' },
          { label: 'Signer email', value: '{{inputs.signer_email}}', as: 'text' },
          { label: 'Signature', value: '{{inputs.signature}}', as: 'image' },
          { label: 'Date signed', value: '{{inputs.signed_at}}', as: 'text' },
        ],
        tableRowsSource: '',
        tableColumns: [],
        includeCart: false,
        layout: 'flow',
        orientation: 'portrait',
        blocks: [],
        inputs: [
          { key: 'company_name', label: 'Company / provider', type: 'string', required: true },
          { key: 'signer_name', label: 'Signer name', type: 'string', required: true },
          { key: 'signer_email', label: 'Signer email', type: 'string', required: true },
          { key: 'scope', label: 'Scope / terms summary', type: 'string', required: true },
          { key: 'signature', label: 'Signature', type: 'file', required: true },
          { key: 'signed_at', label: 'Date signed', type: 'date', required: false },
        ],
      }
    case 'sso':
      return {
        protocol: 'oidc',
        providerName: 'Company SSO',
        buttonLabel: 'Continue with SSO',
        oidcIssuer: 'https://idp.example.com',
        oidcClientId: '',
        oidcClientSecret: '',
        oidcAuthorizationUrl: 'https://idp.example.com/oauth2/authorize',
        oidcTokenUrl: 'https://idp.example.com/oauth2/token',
        oidcJwksUrl: 'https://idp.example.com/.well-known/jwks.json',
        oidcScopes: 'openid email profile',
        samlEntityId: '',
        samlSsoUrl: '',
        samlCertificate: '',
        samlAcsUrl: '',
        emailClaim: 'email',
        userIdClaim: 'sub',
        previewEmail: 'sso.user@example.com',
      }
    case 'appointment':
      return {
        title: 'Book an appointment',
        intro: "Select a service and we'll find an available slot for you.",
        timezone: 'Africa/Johannesburg',
        services: [
          { id: 'svc_consult', name: 'Consultation', durationMinutes: 30, description: 'Initial consultation' },
          { id: 'svc_followup', name: 'Follow-up', durationMinutes: 15, description: 'Quick follow-up call' },
        ],
        note: 'Appointments are confirmed via email.',
        inputs: [
          { key: 'date', label: 'Date', type: 'date', required: true },
          { key: 'service', label: 'Service', type: 'string', required: true },
        ],
      }
    case 'location':
      return {
        intro: 'Visit us at one of our locations:',
        locations: [
          {
            name: 'Head Office',
            address: '123 Main Street',
            city: 'Johannesburg',
            phone: '+27 11 123 4567',
            email: 'info@example.com',
            hoursNote: 'MonΓÇôFri 8amΓÇô5pm',
            mapUrl: 'https://maps.google.com/?q=-26.2041,28.0473',
          },
        ],
        inputs: [],
      }
    case 'map':
      return {
        title: 'Find us',
        intro: 'Our offices and partner locations:',
        centerLat: '-26.2041',
        centerLng: '28.0473',
        zoom: 12,
        style: 'roadmap',
        embedUrl: '',
        pins: [
          {
            label: 'Head Office',
            description: '123 Main Street, Johannesburg',
            lat: '-26.2041',
            lng: '28.0473',
            link: 'https://maps.google.com/?q=-26.2041,28.0473',
          },
          {
            label: 'Sandton Hub',
            description: '5th Street, Sandton',
            lat: '-26.1076',
            lng: '28.0567',
            link: '',
          },
        ],
        inputs: [],
      }
    case 'qr':
      return {
        title: 'Scan to open',
        caption: 'Point your camera at this code',
        payload: '{{inputs.url}}',
        size: 200,
        errorCorrection: 'M',
        foreground: '#0f172a',
        background: '#ffffff',
        filename: 'link-{{inputs.label}}.png',
        inputs: [
          { key: 'url', label: 'URL or text', type: 'string', required: true },
          { key: 'label', label: 'Short label', type: 'string', required: false },
        ],
      }
    case 'whatsapp':
      return {
        title: 'Need help?',
        subtitle: 'Message us on WhatsApp — we typically reply within a few minutes.',
        phone: '{{inputs.phone}}',
        message: 'Hi! I have a question about {{inputs.topic}}.',
        buttonLabel: 'Chat to us on WhatsApp',
        inputs: [
          { key: 'phone', label: 'WhatsApp number', type: 'string', required: true },
          { key: 'topic', label: 'Topic', type: 'string', required: false },
        ],
      }
    case 'team':
      return {
        intro: 'Meet our team:',
        members: [
          { name: 'Alex Smith', role: 'Support Lead', skills: 'Billing, Technical', email: 'alex@example.com', handoffKey: 'alex' },
          { name: 'Jordan Lee', role: 'Account Manager', skills: 'Sales, Onboarding', email: 'jordan@example.com', handoffKey: 'jordan' },
        ],
        inputs: [],
      }
    case 'pricing':
      return {
        currency: 'USD',
        intro: 'Choose a plan that works for you:',
        plans: [
          { name: 'Starter', price: 0, period: 'month', features: ['5 chatbots', 'Community support'], highlight: false },
          { name: 'Pro', price: 49, period: 'month', features: ['Unlimited chatbots', 'Priority support', 'Analytics'], highlight: true },
          { name: 'Enterprise', price: 199, period: 'month', features: ['Everything in Pro', 'SSO', 'SLA'], highlight: false },
        ],
        inputs: [],
      }
    case 'survey':
      return {
        intro: "We'd love your feedback:",
        questions: [
          { prompt: 'How likely are you to recommend us?', kind: 'nps', choices: [] },
          { prompt: 'How satisfied are you with our service?', kind: 'likert', choices: [] },
          { prompt: 'Any additional comments?', kind: 'text', choices: [] },
        ],
        inputs: [],
      }
    case 'announcement':
      return {
        title: 'Scheduled maintenance',
        body: "We'll be performing maintenance on Saturday from 2amΓÇô4am UTC. Service may be briefly unavailable.",
        severity: 'warning',
        startsAt: '',
        endsAt: '',
        ctaLabel: 'Learn more',
        ctaValue: 'https://status.example.com',
        inputs: [],
      }
    case 'sms':
      return {
        channel: 'sms',
        body: 'Hi {{inputs.name}}, your appointment is confirmed for {{inputs.date}}. Reply HELP for support.',
        maxChars: 160,
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'date', label: 'Date', type: 'date', required: true },
        ],
      }
    case 'push':
      return {
        title: 'New message',
        body: 'You have a new message from {{inputs.sender}}. Tap to view.',
        inputs: [{ key: 'sender', label: 'Sender', type: 'string', required: true }],
      }
    case 'ticket':
      return {
        title: 'Support ticket',
        priority: 'normal',
        summary: '{{inputs.issue}}',
        fields: [
          { label: 'Customer', value: '{{inputs.name}}' },
          { label: 'Email', value: '{{inputs.email}}' },
        ],
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'email', label: 'Email', type: 'string', required: true },
          { key: 'issue', label: 'Issue', type: 'string', required: true },
        ],
      }
    case 'certificate':
      return {
        format: 'pdf',
        filename: 'certificate-{{inputs.recipient}}.pdf',
        title: 'Certificate of Completion',
        intro: 'This certifies that',
        body: '{{inputs.recipient}}\n\nhas successfully completed {{inputs.course}} on {{inputs.date}}.',
        footer: 'FlowForge Certification',
        fields: [
          { label: 'Recipient', value: '{{inputs.recipient}}', as: 'text' },
          { label: 'Course', value: '{{inputs.course}}', as: 'text' },
          { label: 'Date', value: '{{inputs.date}}', as: 'text' },
        ],
        tableRowsSource: '',
        tableColumns: [],
        includeCart: false,
        layout: 'flow',
        orientation: 'landscape',
        blocks: [],
        inputs: [
          { key: 'recipient', label: 'Recipient name', type: 'string', required: true },
          { key: 'course', label: 'Course name', type: 'string', required: true },
          { key: 'date', label: 'Completion date', type: 'date', required: true },
        ],
      }
    case 'checklist':
      return {
        format: 'pdf',
        filename: 'checklist-{{inputs.title}}.pdf',
        title: '{{inputs.title}}',
        intro: 'Complete the following items:',
        body: '{{inputs.items}}',
        footer: 'Generated by FlowForge',
        fields: [{ label: 'Title', value: '{{inputs.title}}', as: 'text' }],
        tableRowsSource: '{{inputs.items}}',
        tableColumns: [
          { key: 'item', label: 'Item' },
          { key: 'status', label: 'Status' },
        ],
        includeCart: false,
        layout: 'flow',
        orientation: 'portrait',
        blocks: [],
        inputs: [
          { key: 'title', label: 'Checklist title', type: 'string', required: true },
          { key: 'items', label: 'Items (JSON array)', type: 'string', required: true },
        ],
      }
    case 'consent':
      return {
        title: 'Data processing consent',
        version: '1.0',
        body: 'By accepting, you agree that we may collect and process your personal data as described in our privacy policy.',
        acceptLabel: 'I accept',
        declineLabel: 'I decline',
        effectiveAt: '',
        inputs: [],
      }
    case 'webhook':
      return {
        name: 'Notify CRM',
        description: 'Posts lead data to the CRM system',
        method: 'POST',
        contentType: 'application/json',
        bodyJson: JSON.stringify({ name: '{{inputs.name}}', email: '{{inputs.email}}' }, null, 2),
        headers: [{ key: 'Authorization', value: 'Bearer {{inputs.token}}' }],
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'email', label: 'Email', type: 'string', required: true },
          { key: 'token', label: 'API token', type: 'string', required: false },
        ],
      }
  }
}

export function parseTemplateContent(kind: TemplateKind, raw: unknown): TemplateContent {
  const c = asRecord(raw)
  switch (kind) {
    case 'email':
      return { subject: str(c.subject), html: str(c.html), inputs: parseTemplateInputs(c.inputs) }
    case 'faq': {
      const items = Array.isArray(c.items)
        ? c.items.map((item) => {
            const row = asRecord(item)
            return { question: str(row.question), answer: str(row.answer) }
          })
        : [{ question: '', answer: '' }]
      return {
        intro: str(c.intro),
        items: items.length ? items : [{ question: '', answer: '' }],
        inputs: parseTemplateInputs(c.inputs),
      }
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
        inputs: parseTemplateInputs(c.inputs),
      }
    }
    case 'message':
      return { text: str(c.text), inputs: parseTemplateInputs(c.inputs) }
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
      return {
        timezone: str(c.timezone),
        note: str(c.note),
        days: days.length ? days : emptyHoursDays(),
        inputs: parseTemplateInputs(c.inputs),
      }
    }
    case 'legal':
      return { title: str(c.title), body: str(c.body), inputs: parseTemplateInputs(c.inputs) }
    case 'receipt':
      return {
        title: str(c.title, 'Your receipt'),
        intro: str(c.intro),
        footer: str(c.footer),
        inputs: parseTemplateInputs(c.inputs),
      }
    case 'document':
    case 'agreement':
    case 'certificate':
    case 'checklist':
      return parseDocumentContent(c)
    case 'sso':
      return parseSsoContent(c)
    case 'appointment':
      return parseAppointmentContent(c)
    case 'location':
      return parseLocationContent(c)
    case 'map':
      return parseMapContent(c)
    case 'qr':
      return parseQrContent(c)
    case 'whatsapp':
      return parseWhatsappContent(c)
    case 'calendar':
      return parseCalendarContent(c)
    case 'social_share':
      return parseSocialShareContent(c)
    case 'waitlist':
      return parseWaitlistContent(c)
    case 'team':
      return parseTeamContent(c)
    case 'pricing':
      return parsePricingContent(c)
    case 'survey':
      return parseSurveyContent(c)
    case 'announcement':
      return parseAnnouncementContent(c)
    case 'sms':
      return parseSmsContent(c)
    case 'push':
      return parsePushContent(c)
    case 'ticket':
      return parseTicketContent(c)
    case 'consent':
      return parseConsentContent(c)
    case 'webhook':
      return parseWebhookContent(c)
  }
}

export function parseSsoContent(raw: unknown): SsoContent {
  const c = asRecord(raw)
  const protocolRaw = str(c.protocol, 'oidc')
  const protocol: SsoProtocol = protocolRaw === 'saml' ? 'saml' : 'oidc'
  const empty = emptySsoContent()
  return {
    protocol,
    providerName: str(c.providerName, empty.providerName),
    buttonLabel: str(c.buttonLabel, empty.buttonLabel) || empty.buttonLabel,
    oidcIssuer: str(c.oidcIssuer),
    oidcClientId: str(c.oidcClientId),
    oidcClientSecret: str(c.oidcClientSecret),
    oidcAuthorizationUrl: str(c.oidcAuthorizationUrl),
    oidcTokenUrl: str(c.oidcTokenUrl),
    oidcJwksUrl: str(c.oidcJwksUrl),
    oidcScopes: str(c.oidcScopes, empty.oidcScopes) || empty.oidcScopes,
    samlEntityId: str(c.samlEntityId),
    samlSsoUrl: str(c.samlSsoUrl),
    samlCertificate: str(c.samlCertificate),
    samlAcsUrl: str(c.samlAcsUrl),
    emailClaim: str(c.emailClaim, 'email') || 'email',
    userIdClaim: str(c.userIdClaim, 'sub') || 'sub',
    previewEmail: str(c.previewEmail, empty.previewEmail) || empty.previewEmail,
  }
}

export function parseAppointmentContent(raw: unknown): AppointmentContent {
  const c = asRecord(raw)
  const services: AppointmentService[] = Array.isArray(c.services)
    ? c.services.map((item) => {
        const row = asRecord(item)
        return {
          id: str(row.id) || newStoreId('svc'),
          name: str(row.name),
          durationMinutes: num(row.durationMinutes, 30),
          description: str(row.description),
        }
      })
    : [emptyAppointmentService()]
  return {
    title: str(c.title),
    intro: str(c.intro),
    timezone: str(c.timezone),
    services: services.length ? services : [emptyAppointmentService()],
    note: str(c.note),
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseLocationContent(raw: unknown): LocationContent {
  const c = asRecord(raw)
  const locations: LocationEntry[] = Array.isArray(c.locations)
    ? c.locations.map((item) => {
        const row = asRecord(item)
        return {
          name: str(row.name),
          address: str(row.address),
          city: str(row.city),
          phone: str(row.phone),
          email: str(row.email),
          hoursNote: str(row.hoursNote),
          mapUrl: str(row.mapUrl),
        }
      })
    : [emptyLocationEntry()]
  return {
    intro: str(c.intro),
    locations: locations.length ? locations : [emptyLocationEntry()],
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseMapContent(raw: unknown): MapContent {
  const c = asRecord(raw)
  const zoomRaw = Number(c.zoom)
  const styleRaw = str(c.style)
  const pins: MapPin[] = Array.isArray(c.pins)
    ? c.pins.map((item) => {
        const row = asRecord(item)
        return {
          label: str(row.label),
          description: str(row.description),
          lat: str(row.lat),
          lng: str(row.lng),
          link: str(row.link),
        }
      })
    : [emptyMapPin()]
  return {
    title: str(c.title),
    intro: str(c.intro),
    centerLat: str(c.centerLat) || '-26.2041',
    centerLng: str(c.centerLng) || '28.0473',
    zoom: Number.isFinite(zoomRaw) ? Math.max(1, Math.min(19, Math.round(zoomRaw))) : 12,
    style: styleRaw === 'satellite' ? 'satellite' : 'roadmap',
    embedUrl: str(c.embedUrl),
    pins: pins.length ? pins : [emptyMapPin()],
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseQrContent(raw: unknown): QrContent {
  const c = asRecord(raw)
  const sizeRaw = Number(c.size)
  const ecRaw = str(c.errorCorrection).toUpperCase()
  const errorCorrection: QrErrorCorrection =
    ecRaw === 'L' || ecRaw === 'Q' || ecRaw === 'H' ? ecRaw : 'M'
  return {
    title: str(c.title),
    caption: str(c.caption),
    payload: str(c.payload),
    size: Number.isFinite(sizeRaw) ? Math.max(64, Math.min(512, Math.round(sizeRaw))) : 180,
    errorCorrection,
    foreground: str(c.foreground) || '#0f172a',
    background: str(c.background) || '#ffffff',
    filename: str(c.filename) || 'qr.png',
    inputs: parseTemplateInputs(c.inputs),
  }
}


export function parseWhatsappContent(raw: unknown): WhatsappContent {
  const c = asRecord(raw)
  return {
    phone: str(c.phone),
    message: str(c.message),
    buttonLabel: str(c.buttonLabel) || 'Chat to us on WhatsApp',
    title: str(c.title),
    subtitle: str(c.subtitle),
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseCalendarContent(raw: unknown): CalendarContent {
  const c = asRecord(raw)
  return {
    title: str(c.title), description: str(c.description), location: str(c.location),
    start: str(c.start), end: str(c.end), timezone: str(c.timezone),
    buttonLabel: str(c.buttonLabel) || 'Add to calendar',
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseSocialShareContent(raw: unknown): SocialShareContent {
  const c = asRecord(raw)
  const allowed = new Set(['x', 'linkedin', 'facebook'])
  const platforms = Array.isArray(c.platforms)
    ? (c.platforms as unknown[]).map((p) => String(p)).filter((p): p is SocialSharePlatform => allowed.has(p))
    : (['x', 'linkedin', 'facebook'] as SocialSharePlatform[])
  return {
    url: str(c.url), title: str(c.title), text: str(c.text),
    platforms: platforms.length ? platforms : ['x', 'linkedin', 'facebook'],
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseWaitlistContent(raw: unknown): WaitlistContent {
  const c = asRecord(raw)
  return {
    title: str(c.title), subtitle: str(c.subtitle), position: str(c.position),
    eta: str(c.eta), message: str(c.message),
    notifyLabel: str(c.notifyLabel) || 'Notify me',
    inputs: parseTemplateInputs(c.inputs),
  }
}
/** Build an OpenStreetMap embed URL from map center / first numeric pin. */
export function mapEmbedUrlFromContent(content: MapContent): string {
  const custom = content.embedUrl.trim()
  if (custom) return custom

  const numericPins = content.pins
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      label: p.label.trim(),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  const centerLat = Number(content.centerLat)
  const centerLng = Number(content.centerLng)
  const lat = numericPins[0]?.lat ?? (Number.isFinite(centerLat) ? centerLat : -26.2041)
  const lng = numericPins[0]?.lng ?? (Number.isFinite(centerLng) ? centerLng : 28.0473)
  const zoom = Math.max(1, Math.min(19, Math.round(Number(content.zoom)) || 12))
  // Web Mercator: one tile Γëê 360/2^z degrees wide. Halve for a comfortable iframe frame.
  const lngSpan = 360 / 2 ** zoom
  const latRad = (lat * Math.PI) / 180
  const latSpan = lngSpan * Math.max(0.2, Math.cos(latRad))
  const west = lng - lngSpan / 2
  const east = lng + lngSpan / 2
  const south = lat - latSpan / 2
  const north = lat + latSpan / 2
  const bbox = `${west}%2C${south}%2C${east}%2C${north}`
  const marker = `${lat}%2C${lng}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`
}

export function parseTeamContent(raw: unknown): TeamContent {
  const c = asRecord(raw)
  const members: TeamMember[] = Array.isArray(c.members)
    ? c.members.map((item) => {
        const row = asRecord(item)
        return {
          name: str(row.name),
          role: str(row.role),
          skills: str(row.skills),
          email: str(row.email),
          handoffKey: str(row.handoffKey),
        }
      })
    : [emptyTeamMember()]
  return {
    intro: str(c.intro),
    members: members.length ? members : [emptyTeamMember()],
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parsePricingContent(raw: unknown): PricingContent {
  const c = asRecord(raw)
  const plans: PricingPlan[] = Array.isArray(c.plans)
    ? c.plans.map((item) => {
        const row = asRecord(item)
        return {
          name: str(row.name),
          price: num(row.price),
          period: str(row.period, 'month'),
          features: Array.isArray(row.features) ? row.features.map((f) => String(f)) : [],
          highlight: row.highlight === true,
        }
      })
    : [emptyPricingPlan()]
  return {
    currency: str(c.currency, 'USD'),
    intro: str(c.intro),
    plans: plans.length ? plans : [emptyPricingPlan()],
    inputs: parseTemplateInputs(c.inputs),
  }
}

function isSurveyQuestionKind(v: string): v is SurveyQuestionKind {
  return v === 'nps' || v === 'likert' || v === 'text' || v === 'choice'
}

export function parseSurveyContent(raw: unknown): SurveyContent {
  const c = asRecord(raw)
  const questions: SurveyQuestion[] = Array.isArray(c.questions)
    ? c.questions.map((item) => {
        const row = asRecord(item)
        const kindRaw = str(row.kind, 'text')
        return {
          prompt: str(row.prompt),
          kind: isSurveyQuestionKind(kindRaw) ? kindRaw : 'text',
          choices: Array.isArray(row.choices) ? row.choices.map((ch) => String(ch)) : [],
        }
      })
    : [emptySurveyQuestion()]
  return {
    intro: str(c.intro),
    questions: questions.length ? questions : [emptySurveyQuestion()],
    inputs: parseTemplateInputs(c.inputs),
  }
}

function isAnnouncementSeverity(v: string): v is AnnouncementSeverity {
  return v === 'info' || v === 'promo' || v === 'warning'
}

export function parseAnnouncementContent(raw: unknown): AnnouncementContent {
  const c = asRecord(raw)
  const severityRaw = str(c.severity, 'info')
  return {
    title: str(c.title),
    body: str(c.body),
    severity: isAnnouncementSeverity(severityRaw) ? severityRaw : 'info',
    startsAt: str(c.startsAt),
    endsAt: str(c.endsAt),
    ctaLabel: str(c.ctaLabel),
    ctaValue: str(c.ctaValue),
    inputs: parseTemplateInputs(c.inputs),
  }
}

function isSmsChannel(v: string): v is SmsChannel {
  return v === 'sms' || v === 'whatsapp'
}

export function parseSmsContent(raw: unknown): SmsContent {
  const c = asRecord(raw)
  const channelRaw = str(c.channel, 'sms')
  const channel = isSmsChannel(channelRaw) ? channelRaw : 'sms'
  return {
    channel,
    body: str(c.body),
    maxChars: num(c.maxChars, channel === 'whatsapp' ? 4096 : 160),
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parsePushContent(raw: unknown): PushContent {
  const c = asRecord(raw)
  return {
    title: str(c.title),
    body: str(c.body),
    inputs: parseTemplateInputs(c.inputs),
  }
}

function isTicketPriority(v: string): v is TicketPriority {
  return v === 'low' || v === 'normal' || v === 'high'
}

export function parseTicketContent(raw: unknown): TicketContent {
  const c = asRecord(raw)
  const priorityRaw = str(c.priority, 'normal')
  const fields: TicketField[] = Array.isArray(c.fields)
    ? c.fields.map((item) => {
        const row = asRecord(item)
        return { label: str(row.label), value: str(row.value) }
      })
    : [emptyTicketField()]
  return {
    title: str(c.title),
    priority: isTicketPriority(priorityRaw) ? priorityRaw : 'normal',
    summary: str(c.summary),
    fields: fields.length ? fields : [emptyTicketField()],
    inputs: parseTemplateInputs(c.inputs),
  }
}

export function parseConsentContent(raw: unknown): ConsentContent {
  const c = asRecord(raw)
  const empty = emptyConsentContent()
  return {
    title: str(c.title),
    version: str(c.version, '1.0'),
    body: str(c.body),
    acceptLabel: str(c.acceptLabel, empty.acceptLabel) || empty.acceptLabel,
    declineLabel: str(c.declineLabel, empty.declineLabel) || empty.declineLabel,
    effectiveAt: str(c.effectiveAt),
    inputs: parseTemplateInputs(c.inputs),
  }
}

function isWebhookMethod(v: string): v is WebhookMethod {
  return v === 'POST' || v === 'PUT' || v === 'PATCH'
}

export function parseWebhookContent(raw: unknown): WebhookContent {
  const c = asRecord(raw)
  const methodRaw = str(c.method, 'POST').toUpperCase()
  const headers: WebhookHeader[] = Array.isArray(c.headers)
    ? c.headers.map((item) => {
        const row = asRecord(item)
        return { key: str(row.key), value: str(row.value) }
      })
    : []
  return {
    name: str(c.name),
    description: str(c.description),
    method: isWebhookMethod(methodRaw) ? methodRaw : 'POST',
    contentType: str(c.contentType, 'application/json'),
    bodyJson: str(c.bodyJson, '{}'),
    headers,
    inputs: parseTemplateInputs(c.inputs),
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
        .map((i) => `ΓÇó ${i.question.trim()}\n  ${i.answer.trim()}`)
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
          const desc = p.description.trim() ? ` ΓÇö ${p.description.trim()}` : ''
          return `ΓÇó ${p.name.trim()}${sku}: ${price}${desc}`
        })
        blocks.push([cat.name.trim(), ...lines].filter(Boolean).join('\n'))
      }
      if (c.cartHint.trim()) blocks.push(c.cartHint.trim())
      const feeLines = (c.fees ?? [])
        .filter((f) => f.name.trim() && f.amount > 0)
        .map((f) =>
          f.kind === 'percent'
            ? `ΓÇó ${f.name.trim()}: ${f.amount}%`
            : `ΓÇó ${f.name.trim()}: ${formatTemplateMoney(f.amount, c.currency)}`,
        )
      if (feeLines.length) blocks.push(['Fees', ...feeLines].join('\n'))
      return blocks.filter(Boolean).join('\n\n')
    }
    case 'menu': {
      const c = content as MenuContent
      const lines = c.items
        .filter((i) => i.label.trim())
        .map((i) => {
          const desc = i.description.trim() ? ` ΓÇö ${i.description.trim()}` : ''
          return `ΓÇó ${i.label.trim()}${desc}`
        })
      return [c.title.trim(), ...lines].filter(Boolean).join('\n')
    }
    case 'message':
      return (content as MessageContent).text.trim()
    case 'hours': {
      const c = content as HoursContent
      const lines = c.days.map((d) =>
        d.closed ? `${d.day}: Closed` : `${d.day}: ${d.open}ΓÇô${d.close}`,
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
    case 'document':
    case 'agreement': {
      const c = content as DocumentContent
      const fields = c.fields
        .filter((f) => f.label.trim() || f.value.trim())
        .map((f) => `${f.label.trim() || 'Field'}: ${f.value.trim()}`)
      return [c.title.trim(), c.intro.trim(), ...fields, c.body.trim(), c.footer.trim()]
        .filter(Boolean)
        .join('\n')
    }
    case 'sso': {
      const c = content as SsoContent
      const name = c.providerName.trim() || 'SSO'
      if (c.protocol === 'saml') {
        return `${name} ┬╖ SAML ┬╖ ${c.samlSsoUrl.trim() || 'no SSO URL'}`
      }
      return `${name} ┬╖ OIDC ┬╖ ${c.oidcIssuer.trim() || c.oidcAuthorizationUrl.trim() || 'no issuer'}`
    }
    case 'appointment': {
      const c = content as AppointmentContent
      const services = c.services
        .filter((s) => s.name.trim())
        .map((s) => `ΓÇó ${s.name.trim()} (${s.durationMinutes}min)${s.description.trim() ? ` ΓÇö ${s.description.trim()}` : ''}`)
      return [c.title.trim(), c.intro.trim(), ...services, c.note.trim()].filter(Boolean).join('\n')
    }
    case 'location': {
      const c = content as LocationContent
      const locs = c.locations
        .filter((l) => l.name.trim() || l.address.trim())
        .map((l) => {
          const parts = [l.name.trim(), l.address.trim(), l.city.trim(), l.phone.trim(), l.email.trim(), l.hoursNote.trim()].filter(Boolean)
          return `ΓÇó ${parts.join(' ┬╖ ')}`
        })
      return [c.intro.trim(), ...locs].filter(Boolean).join('\n')
    }
    case 'map': {
      const c = content as MapContent
      const pins = c.pins
        .filter((p) => p.label.trim() || (p.lat.trim() && p.lng.trim()))
        .map((p) => {
          const coord =
            p.lat.trim() && p.lng.trim() ? `${p.lat.trim()}, ${p.lng.trim()}` : ''
          const parts = [p.label.trim(), p.description.trim(), coord].filter(Boolean)
          return `ΓÇó ${parts.join(' ┬╖ ')}`
        })
      return [c.title.trim(), c.intro.trim(), ...pins].filter(Boolean).join('\n')
    }
    case 'qr': {
      const c = content as QrContent
      return [c.title.trim(), c.caption.trim(), c.payload.trim()].filter(Boolean).join('\n')
    }
    case 'whatsapp': {
      const c = content as WhatsappContent
      const phone = c.phone.trim()
      const message = c.message.trim()
      const digits = phone.replace(/[^0-9]/g, '')
      const wa =
        digits.length > 0
          ? message
            ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
            : `https://wa.me/${digits}`
          : ''
      return [c.title.trim(), c.subtitle.trim(), c.buttonLabel.trim() || 'Chat to us on WhatsApp', wa]
        .filter(Boolean)
        .join('\n')
    }
    case 'team': {
      const c = content as TeamContent
      const members = c.members
        .filter((m) => m.name.trim())
        .map((m) => `ΓÇó ${m.name.trim()} (${m.role.trim()})${m.skills.trim() ? ` ΓÇö ${m.skills.trim()}` : ''}`)
      return [c.intro.trim(), ...members].filter(Boolean).join('\n')
    }
    case 'pricing': {
      const c = content as PricingContent
      const plans = c.plans
        .filter((p) => p.name.trim())
        .map((p) => {
          const price = formatTemplateMoney(p.price, c.currency)
          const features = p.features.filter(Boolean).join(', ')
          return `ΓÇó ${p.name.trim()}: ${price}/${p.period}${features ? ` ΓÇö ${features}` : ''}`
        })
      return [c.intro.trim(), ...plans].filter(Boolean).join('\n')
    }
    case 'survey': {
      const c = content as SurveyContent
      const questions = c.questions
        .filter((q) => q.prompt.trim())
        .map((q) => `ΓÇó [${q.kind}] ${q.prompt.trim()}`)
      return [c.intro.trim(), ...questions].filter(Boolean).join('\n')
    }
    case 'announcement': {
      const c = content as AnnouncementContent
      const badge = c.severity === 'warning' ? 'ΓÜá∩╕Å' : c.severity === 'promo' ? '≡ƒÄë' : 'Γä╣∩╕Å'
      const cta = c.ctaLabel.trim() ? `[${c.ctaLabel.trim()}](${c.ctaValue.trim()})` : ''
      return [badge + ' ' + c.title.trim(), c.body.trim(), cta].filter(Boolean).join('\n')
    }
    case 'sms': {
      const c = content as SmsContent
      return `[${c.channel.toUpperCase()}] ${c.body.trim()}`
    }
    case 'push': {
      const c = content as PushContent
      return [c.title.trim(), c.body.trim()].filter(Boolean).join('\n')
    }
    case 'ticket': {
      const c = content as TicketContent
      const fields = c.fields
        .filter((f) => f.label.trim() || f.value.trim())
        .map((f) => `${f.label.trim()}: ${f.value.trim()}`)
      return [`[${c.priority.toUpperCase()}] ${c.title.trim()}`, c.summary.trim(), ...fields].filter(Boolean).join('\n')
    }
    case 'certificate':
    case 'checklist': {
      const c = content as DocumentContent
      const fields = c.fields
        .filter((f) => f.label.trim() || f.value.trim())
        .map((f) => `${f.label.trim() || 'Field'}: ${f.value.trim()}`)
      return [c.title.trim(), c.intro.trim(), ...fields, c.body.trim(), c.footer.trim()]
        .filter(Boolean)
        .join('\n')
    }
    case 'consent': {
      const c = content as ConsentContent
      return [
        `${c.title.trim()} (v${c.version.trim()})`,
        c.body.trim(),
        `[${c.acceptLabel.trim()}] / [${c.declineLabel.trim()}]`,
      ]
        .filter(Boolean)
        .join('\n')
    }
    case 'webhook': {
      const c = content as WebhookContent
      const headers = c.headers.filter((h) => h.key.trim()).map((h) => `${h.key}: ${h.value}`).join(', ')
      return [
        `${c.name.trim()} ┬╖ ${c.method} ${c.contentType}`,
        c.description.trim(),
        headers ? `Headers: ${headers}` : '',
        c.bodyJson.trim(),
      ]
        .filter(Boolean)
        .join('\n')
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
  if (args.kind === 'map') {
    const c = content as MapContent
    base.labels = c.pins.map((p) => p.label).filter(Boolean)
    base.embedUrl = mapEmbedUrlFromContent(c)
    base.pinCount = c.pins.filter((p) => p.label.trim() || (p.lat.trim() && p.lng.trim())).length
  }
  if (args.kind === 'qr') {
    const c = content as QrContent
    base.payload = c.payload
    base.filename = c.filename
    base.size = c.size
  }
  if (args.kind === 'whatsapp') {
    const c = content as WhatsappContent
    const digits = c.phone.trim().replace(/[^0-9]/g, '')
    const message = c.message.trim()
    base.phone = c.phone
    base.message = c.message
    base.buttonLabel = c.buttonLabel
    base.url =
      digits.length > 0
        ? message
          ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
          : `https://wa.me/${digits}`
        : ''
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
  if (args.kind === 'document' || args.kind === 'agreement' || args.kind === 'certificate' || args.kind === 'checklist') {
    const c = content as DocumentContent
    base.format = c.format
    base.filename = c.filename
    base.file = { __ffDoc: true, key: args.key, ...c }
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
      lines.push(`${item.name} ├ù ${item.qty} ΓÇö ${formatTemplateMoney(item.lineTotal, cart.currency)}`)
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
  const names = cart.items.map((line) => `${line.name} ├ù ${line.qty}`).join(', ')
  const feeNote =
    cart.fees?.length
      ? ` incl. ${cart.fees.map((f) => f.name).join(', ')}`
      : ''
  return `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'} ┬╖ ${formatted}${feeNote}${names ? ` (${names})` : ''}`
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
