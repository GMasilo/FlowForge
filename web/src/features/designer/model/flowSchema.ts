import { z } from 'zod'
import type { FlowNodeType, QuestionAnswerType, VariableType } from '@/shared/types/database'
import { collectPathRefs } from '@/features/designer/preview/expressionEval'

/** Predecessor outcomes that can gate a step. */
export const RUN_AFTER_KEYS = ['succeeded', 'failed', 'skipped', 'timedOut'] as const
export type RunAfterKey = (typeof RUN_AFTER_KEYS)[number]

export type RunAfterConfig = Record<RunAfterKey, boolean>

export const DEFAULT_RUN_AFTER: RunAfterConfig = {
  succeeded: true,
  failed: false,
  skipped: false,
  timedOut: false,
}

export const RUN_AFTER_OPTIONS: Array<{ key: RunAfterKey; label: string; hint: string }> = [
  { key: 'succeeded', label: 'is successful', hint: 'Previous step completed successfully' },
  { key: 'failed', label: 'has failed', hint: 'Previous step failed' },
  { key: 'skipped', label: 'is skipped', hint: 'Previous step was skipped by its run-after rules' },
  { key: 'timedOut', label: 'has timed out', hint: 'Previous step timed out' },
]

export function readRunAfter(config: Record<string, unknown> | undefined | null): RunAfterConfig {
  const raw = config?.runAfter
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_RUN_AFTER }
  }
  const o = raw as Record<string, unknown>
  return {
    succeeded: o.succeeded !== false,
    failed: o.failed === true,
    skipped: o.skipped === true,
    timedOut: o.timedOut === true,
  }
}

export function readDelaySeconds(config: Record<string, unknown> | undefined | null): number {
  const n = Number(config?.delaySeconds ?? 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/** 0 = no timeout (unlimited). Applies to HTTP, email, and optional questions. */
export function readTimeoutSeconds(config: Record<string, unknown> | undefined | null): number {
  const n = Number(config?.timeoutSeconds ?? 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

/** Question answers default to required. */
export function isAnswerRequired(config: Record<string, unknown> | undefined | null): boolean {
  return config?.answerRequired !== false
}

export function defaultSharedSettings(): {
  runAfter: RunAfterConfig
  delaySeconds: number
  timeoutSeconds: number
} {
  return { runAfter: { ...DEFAULT_RUN_AFTER }, delaySeconds: 0, timeoutSeconds: 0 }
}

/** True when delay, timeout, or run-after differs from defaults. */
export function hasCustomStepSettings(config: Record<string, unknown> | undefined | null): boolean {
  return hasCustomStepSettingsForNode(config, false)
}

/** Like hasCustomStepSettings, but ignore run-after for flow-start nodes. */
export function hasCustomStepSettingsForNode(
  config: Record<string, unknown> | undefined | null,
  isFlowStart: boolean,
): boolean {
  if (readDelaySeconds(config) > 0) return true
  if (readTimeoutSeconds(config) > 0) return true
  if (isFlowStart) return false
  const ra = readRunAfter(config)
  return ra.failed || ra.skipped || ra.timedOut || ra.succeeded === false
}

export function stepSettingsSummary(config: Record<string, unknown> | undefined | null): string {
  const parts: string[] = []
  const delay = readDelaySeconds(config)
  if (delay > 0) parts.push(`Delay ${delay}s`)
  const timeout = readTimeoutSeconds(config)
  if (timeout > 0) parts.push(`Timeout ${timeout}s`)
  const ra = readRunAfter(config)
  const after = RUN_AFTER_OPTIONS.filter((o) => ra[o.key]).map((o) => o.label)
  if (after.length && (ra.failed || ra.skipped || ra.timedOut || ra.succeeded === false)) {
    parts.push(`Run after: ${after.join(', ')}`)
  } else if (ra.succeeded === false) {
    parts.push('Run after: (none)')
  }
  return parts.join(' · ') || 'Custom settings'
}

export const questionAnswerTypes = [
  'text',
  'long_text',
  'name',
  'number',
  'email',
  'phone',
  'url',
  'address',
  'postal_code',
  'country',
  'date',
  'time',
  'datetime',
  'boolean',
  'choice',
  'gender',
  'rating',
  'slider',
  'stars',
  'nps',
  'color',
  'thumbs',
  'likert',
  'mood',
  'percentage',
  'currency',
  'otp',
  'confirm',
  'stepper',
  'file',
  'signature',
  'image_choice',
  'ranking',
  'location',
  'appointment',
  'matrix',
  'national_id',
  'password',
  'autocomplete',
  'audio',
  'payment',
  'captcha',
  'form',
  'shop',
] as const satisfies readonly QuestionAnswerType[]

export const QUESTION_ANSWER_TYPE_OPTIONS: Array<{
  value: QuestionAnswerType
  label: string
  hint: string
}> = [
  { value: 'text', label: 'Text', hint: 'Short free-form text' },
  { value: 'long_text', label: 'Long text', hint: 'Multi-line free-form text' },
  { value: 'name', label: 'Name', hint: 'Person or organization name' },
  { value: 'number', label: 'Number', hint: 'Numeric value' },
  { value: 'stepper', label: 'Stepper', hint: 'Adjust a number with + / −' },
  { value: 'slider', label: 'Slider', hint: 'Drag a value between min and max' },
  { value: 'percentage', label: 'Percentage', hint: '0–100% value' },
  { value: 'currency', label: 'Currency', hint: 'Money amount with currency code' },
  { value: 'rating', label: 'Rating', hint: 'Numeric button scale (e.g. 1–5)' },
  { value: 'stars', label: 'Stars', hint: 'Tap-to-rate star scale' },
  { value: 'nps', label: 'NPS', hint: 'Net Promoter Score from 0–10' },
  { value: 'likert', label: 'Likert', hint: 'Agreement scale (disagree → agree)' },
  { value: 'mood', label: 'Mood', hint: 'Emoji sentiment scale' },
  { value: 'thumbs', label: 'Thumbs', hint: 'Thumbs up or thumbs down' },
  { value: 'boolean', label: 'Yes / No', hint: 'Boolean yes or no' },
  { value: 'confirm', label: 'Confirm', hint: 'Checkbox agreement before continuing' },
  { value: 'choice', label: 'Choice', hint: 'Pick from a list' },
  { value: 'gender', label: 'Gender', hint: 'Gender selection' },
  { value: 'email', label: 'Email', hint: 'Email address; optional domain allowlist' },
  { value: 'phone', label: 'Phone number', hint: 'Country code + digits' },
  { value: 'otp', label: 'OTP / PIN', hint: 'Digit code; optionally emailed via a connection' },
  { value: 'file', label: 'File upload', hint: 'Visitor uploads a file into this chatbot’s conversation folder' },
  { value: 'signature', label: 'Signature', hint: 'Draw-to-sign; stored as a PNG in the conversation folder' },
  { value: 'image_choice', label: 'Image choice', hint: 'Pick from picture cards; answer is an image object' },
  { value: 'ranking', label: 'Ranking', hint: 'Drag or reorder a list of items' },
  { value: 'autocomplete', label: 'Autocomplete', hint: 'Search and pick from a long list' },
  { value: 'appointment', label: 'Appointment', hint: 'Pick a date and a time' },
  { value: 'matrix', label: 'Matrix', hint: 'Rate several rows on the same scale' },
  { value: 'location', label: 'Location', hint: 'Share GPS coordinates, with an optional label' },
  { value: 'national_id', label: 'National ID', hint: 'ID / national number; SA ID checksum supported' },
  { value: 'password', label: 'Password', hint: 'Masked secret; shown as dots in chat' },
  { value: 'audio', label: 'Voice note', hint: 'Record a short audio reply into the conversation folder' },
  { value: 'payment', label: 'Payment', hint: 'PayFast or a pay link; server can confirm via a payment connection' },
  { value: 'captcha', label: 'Captcha', hint: 'Human check (math or distorted text) before continuing' },
  { value: 'form', label: 'Form', hint: 'Several fields on one screen, stored as a single object' },
  { value: 'shop', label: 'Shop', hint: 'Browse a store catalog, add products to a cart, then checkout' },
  { value: 'url', label: 'URL', hint: 'Web address (google.com or https://…)' },
  { value: 'address', label: 'Address', hint: 'Multi-line street / mailing address' },
  { value: 'postal_code', label: 'Postal code', hint: 'Digits only (ZIP / postal code)' },
  { value: 'country', label: 'Country', hint: 'ISO country code (searchable); custom values allowed' },
  { value: 'date', label: 'Date', hint: 'Calendar date' },
  { value: 'time', label: 'Time', hint: 'Time of day' },
  { value: 'datetime', label: 'Date & time', hint: 'Date with time' },
  { value: 'color', label: 'Color', hint: 'Pick a color (hex)' },
]

export const DEFAULT_GENDER_CHOICES = ['Female', 'Male', 'Non-binary', 'Prefer not to say'] as const

export const DEFAULT_LIKERT_CHOICES = [
  'Strongly disagree',
  'Disagree',
  'Neutral',
  'Agree',
  'Strongly agree',
] as const

export const DEFAULT_MOOD_OPTIONS = [
  { value: 'very_unhappy', emoji: '😞', label: 'Very unhappy' },
  { value: 'unhappy', emoji: '🙁', label: 'Unhappy' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'happy', emoji: '🙂', label: 'Happy' },
  { value: 'very_happy', emoji: '😄', label: 'Very happy' },
] as const

export const COMMON_CURRENCY_CODES = [
  'ZAR',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'INR',
  'NGN',
  'KES',
  'JPY',
] as const

export const variableTypes = [
  'string',
  'number',
  'boolean',
  'date',
  'array',
  'object',
] as const satisfies readonly VariableType[]

export const flowNodeTypes = [
  'message',
  'question',
  'http',
  'email',
  'condition',
  'loop',
  'set_variable',
  'operation',
  'entity',
  'end',
] as const satisfies readonly FlowNodeType[]

export const messageConfigSchema = z.object({
  text: z.string().default(''),
  /** Filenames in this chatbot's media library, shown with the message. */
  mediaFiles: z.array(z.string()).optional(),
  /** templateKey → inputKey → expression or literal. */
  templateBindings: z.record(z.string(), z.record(z.string(), z.string())).optional(),
})

export const questionConfigSchema = z.object({
  prompt: z.string().default(''),
  answerType: z.enum(questionAnswerTypes).default('text'),
  choices: z.array(z.string()).optional(),
  /**
   * Optional template resolving to a string array at runtime, e.g. {{vars.options}}.
   * When set and resolvable, overrides static `choices`.
   */
  choicesFrom: z.string().optional(),
  /** Allow selecting more than one choice (choice / gender). */
  allowMultiple: z.boolean().optional(),
  /** Minimum selections when allowMultiple is true. */
  minSelections: z.number().optional(),
  /** Maximum selections when allowMultiple is true. */
  maxSelections: z.number().optional(),
  /** When false, the user may skip; timeout also applies in preview. */
  answerRequired: z.boolean().default(true),
  outputVariable: z.string().default(''),
  /** Text length bounds (text-like types). */
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  /** Optional RegExp pattern (without surrounding slashes). */
  pattern: z.string().optional(),
  /** Shown when pattern fails; falls back to a generic message. */
  patternMessage: z.string().optional(),
  /** Number / rating / slider / stars / NPS bounds. */
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  /** Optional end labels for slider (and similar) controls. */
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  /** Date / time / datetime lower bound (ISO-ish string matching the input type). */
  minDate: z.string().optional(),
  /** Date / time / datetime upper bound. */
  maxDate: z.string().optional(),
  /** Phone validation strictness. Chat UI always collects country code + digits. */
  phoneFormat: z.enum(['any', 'e164']).optional().default('e164'),
  /**
   * When non-empty, email answers must use one of these domains (e.g. company.com).
   * Values are stored without a leading @.
   */
  allowedEmailDomains: z.array(z.string()).optional(),
  /** ISO 4217 currency code for currency answers (e.g. ZAR, USD). */
  currencyCode: z.string().optional(),
  /** Digit count for OTP / PIN answers. */
  otpLength: z.number().optional(),
  /** Email connection used to deliver the OTP (optional — without it, OTP is format-only). */
  otpConnectionId: z.string().optional(),
  /** Recipient template, e.g. {{vars.email}}. */
  otpTo: z.string().optional(),
  /** Subject template; use {{otp.code}} for the generated code. */
  otpSubject: z.string().optional(),
  /** Body template; use {{otp.code}} for the generated code. */
  otpBody: z.string().optional(),
  /** Seconds until the emailed code expires (default 300). */
  otpExpiresSeconds: z.number().optional(),
  /** Max incorrect attempts before the challenge is locked (default 5). */
  otpMaxAttempts: z.number().optional(),
  /** Checkbox label for confirm answers. */
  confirmLabel: z.string().optional(),
  /** Allowed upload kinds for file answers. */
  fileAccept: z.enum(['any', 'image', 'document', 'pdf']).optional(),
  /** Max files for file answers (1–5). */
  maxFiles: z.number().optional(),
  /** Picture options for image_choice (media library filenames). */
  imageChoices: z
    .array(z.object({ label: z.string(), filename: z.string() }))
    .optional(),
  /** Chat layout for image_choice: snapping gallery or all-at-once grid. */
  imageChoiceLayout: z.enum(['grid', 'gallery']).optional(),
  /** Column labels for matrix questions (defaults to Likert). */
  scaleChoices: z.array(z.string()).optional(),
  /** National ID rules: South African 13-digit checksum, or any digits. */
  idFormat: z.enum(['za', 'any']).optional(),
  /** Max recording length for voice notes (seconds). */
  maxDurationSeconds: z.number().optional(),
  /** Checkout / pay URL template, e.g. {{vars.checkout_url}} or https://pay.example/… */
  payUrl: z.string().optional(),
  /** Amount template shown on the pay button, e.g. {{vars.total}} or 150. */
  paymentAmount: z.string().optional(),
  payButtonLabel: z.string().optional(),
  paidButtonLabel: z.string().optional(),
  /** Payment connection (PayFast / custom notify) used to confirm the charge on the server. */
  paymentConnectionId: z.string().optional(),
  paymentItemName: z.string().optional(),
  paymentBuyerEmail: z.string().optional(),
  paymentBuyerName: z.string().optional(),
  /** Built-in captcha puzzle style. */
  captchaKind: z.enum(['math', 'text']).optional(),
  captchaMaxAttempts: z.number().optional(),
  /** Fields for the multi-field form answer type. */
  formFields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(['text', 'name', 'email', 'phone', 'number', 'date', 'long_text', 'url']),
        required: z.boolean().optional(),
      }),
    )
    .optional(),
  /** Store catalog template key for shop answers. */
  shopTemplateKey: z.string().optional(),
  /** OTP HTML email template key. */
  otpTemplateKey: z.string().optional(),
  /** templateKey → inputKey → expression or literal. */
  templateBindings: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  /** Filenames in this chatbot's media library, shown with the prompt. */
  mediaFiles: z.array(z.string()).optional(),
})

export const DEFAULT_OTP_SUBJECT = 'Your verification code'
export const DEFAULT_OTP_BODY =
  'Your verification code is {{otp.code}}.\n\nIt expires in 5 minutes. If you did not request this, you can ignore this email.'

/** Defaults applied when switching a question to OTP. */
export function defaultOtpEmailConfig(): {
  otpLength: number
  otpSubject: string
  otpBody: string
  otpExpiresSeconds: number
  otpMaxAttempts: number
} {
  return {
    otpLength: 6,
    otpSubject: DEFAULT_OTP_SUBJECT,
    otpBody: DEFAULT_OTP_BODY,
    otpExpiresSeconds: 300,
    otpMaxAttempts: 5,
  }
}

/** Default min/max/step when switching to a scale-like answer type. */
export function defaultScaleBounds(answerType: string): {
  min?: number
  max?: number
  step?: number
} {
  switch (answerType) {
    case 'rating':
    case 'stars':
      return { min: 1, max: 5, step: 1 }
    case 'nps':
      return { min: 0, max: 10, step: 1 }
    case 'slider':
    case 'percentage':
      return { min: 0, max: 100, step: 1 }
    case 'stepper':
      return { min: 0, max: 100, step: 1 }
    case 'currency':
      return { min: 0, step: 0.01 }
    default:
      return {}
  }
}

/** Normalize a domain entry: trim, lowercase, strip leading @ and trailing dot. */
export function normalizeEmailDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '').replace(/\.+$/, '')
}

/** Clean designer-configured allowlist; empty means any domain is allowed. */
export function normalizeAllowedEmailDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const d = normalizeEmailDomain(String(item ?? ''))
    if (!d || !d.includes('.') || seen.has(d)) continue
    seen.add(d)
    out.push(d)
  }
  return out
}

export function answerTypeUsesChoices(answerType: string): boolean {
  return (
    answerType === 'choice' ||
    answerType === 'gender' ||
    answerType === 'likert' ||
    answerType === 'ranking' ||
    answerType === 'matrix' ||
    answerType === 'autocomplete'
  )
}

export function answerTypeUsesMultiSelect(answerType: string): boolean {
  return (
    answerType === 'choice' ||
    answerType === 'gender' ||
    answerType === 'autocomplete' ||
    answerType === 'image_choice'
  )
}

export const DEFAULT_RANKING_ITEMS = ['First', 'Second', 'Third'] as const

export const DEFAULT_MATRIX_ROWS = ['Item 1', 'Item 2', 'Item 3'] as const

export const FORM_FIELD_TYPES = [
  'text',
  'name',
  'email',
  'phone',
  'number',
  'date',
  'long_text',
  'url',
] as const

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export type FormFieldDef = {
  key: string
  label: string
  type: FormFieldType
  required?: boolean
}

export const FORM_FIELD_TYPE_OPTIONS: Array<{ value: FormFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'long_text', label: 'Long text' },
  { value: 'url', label: 'URL' },
]

export const DEFAULT_FORM_FIELDS: FormFieldDef[] = [
  { key: 'name', label: 'Name', type: 'name', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'phone', label: 'Phone', type: 'phone', required: false },
]

export function slugFormFieldKey(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'field'
}

export function readFormFields(config: Record<string, unknown> | undefined | null): FormFieldDef[] {
  const raw = config?.formFields
  if (!Array.isArray(raw)) return []
  const out: FormFieldDef[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const label = String(rec.label ?? '').trim()
    const typeRaw = String(rec.type ?? 'text')
    const type = (FORM_FIELD_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as FormFieldType)
      : 'text'
    const key = slugFormFieldKey(String(rec.key ?? label))
    if (!label || !key || seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      label,
      type,
      required: rec.required !== false,
    })
  }
  return out
}

export function readScaleChoices(config: Record<string, unknown> | undefined | null): string[] {
  const from = coerceChoiceList(config?.scaleChoices)
  return from.length ? from : [...DEFAULT_LIKERT_CHOICES]
}

export function answerTypeUsesFileUpload(answerType: string): boolean {
  return answerType === 'file' || answerType === 'signature'
}

export function answerTypeUsesImageChoices(answerType: string): boolean {
  return answerType === 'image_choice'
}

export const FILE_ACCEPT_OPTIONS = [
  { value: 'any', label: 'Any allowed type', hint: 'Images, documents, audio, video, zip' },
  { value: 'image', label: 'Images', hint: 'jpg, png, gif, webp' },
  { value: 'document', label: 'Documents', hint: 'pdf, txt, csv, Word, Excel' },
  { value: 'pdf', label: 'PDF only', hint: 'PDF files' },
] as const

export type FileAcceptKind = (typeof FILE_ACCEPT_OPTIONS)[number]['value']

export type ImageChoiceOption = { label: string; filename: string }

export type ImageChoiceLayout = 'grid' | 'gallery'

export function readImageChoiceLayout(
  config: Record<string, unknown> | undefined | null,
): ImageChoiceLayout {
  return String(config?.imageChoiceLayout ?? '') === 'grid' ? 'grid' : 'gallery'
}

/** Label shown in chat when the designer picks a file and leaves the label blank. */
export function imageChoiceLabelFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '')
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Incomplete rows for the inspector (image picked before a label is typed). */
export function readImageChoiceDrafts(config: Record<string, unknown> | undefined | null): ImageChoiceOption[] {
  const raw = config?.imageChoices
  if (!Array.isArray(raw)) return []
  const out: ImageChoiceOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const label = String(rec.label ?? '').trim()
    const filename = String(rec.filename ?? '').trim()
    out.push({ label, filename })
  }
  return out
}

export function readImageChoices(config: Record<string, unknown> | undefined | null): ImageChoiceOption[] {
  const out: ImageChoiceOption[] = []
  const seen = new Set<string>()
  for (const item of readImageChoiceDrafts(config)) {
    const label = item.label.trim() || imageChoiceLabelFromFilename(item.filename)
    const filename = item.filename.trim()
    if (!label || !filename || seen.has(label)) continue
    seen.add(label)
    out.push({ label, filename })
  }
  return out
}

export function answerTypeUsesLengthValidation(answerType: string): boolean {
  return (
    answerType === 'text' ||
    answerType === 'long_text' ||
    answerType === 'name' ||
    answerType === 'address' ||
    answerType === 'postal_code' ||
    answerType === 'country' ||
    answerType === 'phone' ||
    answerType === 'password' ||
    answerType === 'national_id'
  )
}

export function answerTypeUsesPattern(answerType: string): boolean {
  return (
    answerType === 'text' ||
    answerType === 'long_text' ||
    answerType === 'name' ||
    answerType === 'address' ||
    answerType === 'postal_code' ||
    answerType === 'country' ||
    answerType === 'phone' ||
    answerType === 'password' ||
    answerType === 'national_id'
  )
}

export function answerTypeUsesNumberBounds(answerType: string): boolean {
  return (
    answerType === 'number' ||
    answerType === 'rating' ||
    answerType === 'slider' ||
    answerType === 'stars' ||
    answerType === 'nps' ||
    answerType === 'percentage' ||
    answerType === 'currency' ||
    answerType === 'stepper'
  )
}

export function answerTypeUsesScaleLabels(answerType: string): boolean {
  return answerType === 'slider' || answerType === 'nps' || answerType === 'percentage'
}

export function answerTypeUsesDateBounds(answerType: string): boolean {
  return answerType === 'date' || answerType === 'time' || answerType === 'datetime' || answerType === 'appointment'
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar day as YYYY-MM-DD. */
export function calendarDateString(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Local clock time as HH:mm. */
export function clockTimeString(now = new Date()): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
}

export function dateBoundUsesCalendar(answerType: string): boolean {
  return answerType === 'date' || answerType === 'datetime' || answerType === 'appointment'
}

export function dateBoundUsesTime(answerType: string): boolean {
  return answerType === 'time' || answerType === 'datetime'
}

export function dateBoundDatePart(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const day = t.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function dateBoundTimePart(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^\d{2}:\d{2}/.test(t) && !t.includes('T')) return t.slice(0, 5)
  const i = t.indexOf('T')
  if (i < 0) return null
  const time = t.slice(i + 1, i + 6)
  return /^\d{2}:\d{2}$/.test(time) ? time : null
}

export type DateBoundIssue = { field: 'minDate' | 'maxDate'; message: string }

function timeHasPassedOnDay(raw: string, today: string, nowTime: string): boolean {
  const day = dateBoundDatePart(raw)
  const time = dateBoundTimePart(raw)
  if (!time) return false
  if (day && day !== today) return false
  return time < nowTime
}

/** Designer rules: earliest/latest must not be in the past; latest must not precede earliest. */
export function validateQuestionDateBounds(
  config: Record<string, unknown> | undefined | null,
  now = new Date(),
): DateBoundIssue[] {
  const answerType = String(config?.answerType ?? '')
  if (!answerTypeUsesDateBounds(answerType)) return []

  const today = calendarDateString(now)
  const nowTime = clockTimeString(now)
  const minRaw = String(config?.minDate ?? '').trim()
  const maxRaw = String(config?.maxDate ?? '').trim()
  const issues: DateBoundIssue[] = []

  if (dateBoundUsesCalendar(answerType)) {
    const minDay = dateBoundDatePart(minRaw)
    const maxDay = dateBoundDatePart(maxRaw)
    if (minDay && minDay < today) {
      issues.push({
        field: 'minDate',
        message: `Earliest date (${minDay}) has passed. Set it to today or later.`,
      })
    }
    if (maxDay && maxDay < today) {
      issues.push({
        field: 'maxDate',
        message: `Latest date (${maxDay}) has passed. Set it to today or later.`,
      })
    }
  }

  if (dateBoundUsesTime(answerType)) {
    if (minRaw && timeHasPassedOnDay(minRaw, today, nowTime)) {
      issues.push({
        field: 'minDate',
        message: `Earliest time (${dateBoundTimePart(minRaw)}) has passed. Set it to the current time or later.`,
      })
    }
    if (maxRaw && timeHasPassedOnDay(maxRaw, today, nowTime)) {
      issues.push({
        field: 'maxDate',
        message: `Latest time (${dateBoundTimePart(maxRaw)}) has passed. Set it to the current time or later.`,
      })
    }
  }

  if (minRaw && maxRaw && maxRaw < minRaw) {
    issues.push({
      field: 'maxDate',
      message: dateBoundUsesCalendar(answerType)
        ? `Latest date cannot be before earliest (${dateBoundDatePart(minRaw) ?? minRaw}).`
        : 'Latest time cannot be before earliest.',
    })
  }

  return issues
}

/** Lower bound for the Earliest picker (today / now, depending on answer type). */
export function earliestDatePickerMin(answerType: string, now = new Date()): string | undefined {
  if (answerType === 'time') return clockTimeString(now)
  if (answerType === 'datetime') return `${calendarDateString(now)}T${clockTimeString(now)}`
  if (dateBoundUsesCalendar(answerType)) return calendarDateString(now)
  return undefined
}

/** Lower bound for the Latest picker: now and/or the earliest value, whichever is later. */
export function latestDatePickerMin(
  answerType: string,
  minDate: string,
  now = new Date(),
): string | undefined {
  const floor = earliestDatePickerMin(answerType, now)
  const minRaw = minDate.trim()
  if (minRaw && floor) return minRaw > floor ? minRaw : floor
  return minRaw || floor
}

export type ResponseFieldHint = { path: string; type: VariableType }

export type QuestionResponseTypeInfo = {
  dataType: VariableType
  example: string
  fields: ResponseFieldHint[]
}

const FILE_RESPONSE_FIELDS: ResponseFieldHint[] = [
  { path: 'filename', type: 'string' },
  { path: 'originalName', type: 'string' },
  { path: 'url', type: 'string' },
  { path: 'mime', type: 'string' },
  { path: 'size', type: 'number' },
  { path: 'key', type: 'string' },
]

function wrapQuestionResponse(
  dataType: VariableType,
  example: string,
  nested: ResponseFieldHint[] = [],
): QuestionResponseTypeInfo {
  return {
    dataType,
    example,
    fields: [
      { path: 'response', type: dataType },
      ...nested.map((f) => ({ path: `response.${f.path}`, type: f.type })),
    ],
  }
}

function formFieldResponseType(type: FormFieldType): VariableType {
  if (type === 'number') return 'number'
  if (type === 'date') return 'date'
  return 'string'
}

/** Stored shape of a question answer (`{{steps.key.response}}` / output variable). */
export function describeQuestionResponse(
  config: Record<string, unknown> | undefined | null,
): QuestionResponseTypeInfo {
  const answerType = String(config?.answerType ?? 'text')
  const allowMultiple = config?.allowMultiple === true
  const maxFiles = typeof config?.maxFiles === 'number' && Number.isFinite(config.maxFiles) ? config.maxFiles : 1

  switch (answerType) {
    case 'number':
    case 'rating':
    case 'slider':
    case 'stars':
    case 'nps':
    case 'percentage':
    case 'currency':
    case 'stepper':
      return wrapQuestionResponse('number', answerType === 'percentage' ? '75' : '42')
    case 'boolean':
    case 'confirm':
      return wrapQuestionResponse('boolean', 'true')
    case 'date':
      return wrapQuestionResponse('date', '2026-08-14')
    case 'time':
      return wrapQuestionResponse('string', '14:30')
    case 'datetime':
      return wrapQuestionResponse('string', '2026-08-14T14:30')
    case 'choice':
    case 'gender':
    case 'autocomplete':
      return allowMultiple
        ? wrapQuestionResponse('array', '["Studio", "Garden"]')
        : wrapQuestionResponse('string', '"Studio"')
    case 'image_choice': {
      const imgFields: ResponseFieldHint[] = [
        { path: 'label', type: 'string' },
        { path: 'filename', type: 'string' },
        { path: 'url', type: 'string' },
        { path: 'key', type: 'string' },
      ]
      if (allowMultiple) {
        return {
          dataType: 'array',
          example: '[{ label, filename, url, key }]',
          fields: [
            { path: 'response', type: 'array' },
            { path: 'response[]', type: 'object' },
            ...imgFields.map((f) => ({ path: `response[].${f.path}`, type: f.type })),
          ],
        }
      }
      return wrapQuestionResponse('object', '{ label, filename, url, key }', imgFields)
    }
    case 'ranking':
      return wrapQuestionResponse('array', '["First", "Second", "Third"]')
    case 'appointment':
      return wrapQuestionResponse('object', '{ date, time }', [
        { path: 'date', type: 'date' },
        { path: 'time', type: 'string' },
      ])
    case 'location':
      return wrapQuestionResponse('object', '{ lat, lng, label? }', [
        { path: 'lat', type: 'number' },
        { path: 'lng', type: 'number' },
        { path: 'accuracy', type: 'number' },
        { path: 'label', type: 'string' },
      ])
    case 'matrix':
      return wrapQuestionResponse('object', '{ "Row": "Agree" }')
    case 'payment':
      return wrapQuestionResponse('object', '{ status, amount, currency, reference }', [
        { path: 'status', type: 'string' },
        { path: 'amount', type: 'number' },
        { path: 'currency', type: 'string' },
        { path: 'reference', type: 'string' },
        { path: 'url', type: 'string' },
        { path: 'providerPaymentId', type: 'string' },
      ])
    case 'captcha':
      return wrapQuestionResponse('object', '{ ok: true }', [{ path: 'ok', type: 'boolean' }])
    case 'form': {
      const fields = readFormFields(config)
      return wrapQuestionResponse(
        'object',
        `{ ${fields.map((f) => f.key).join(', ') || '…'} }`,
        fields.map((f) => ({ path: f.key, type: formFieldResponseType(f.type) })),
      )
    }
    case 'shop':
      return wrapQuestionResponse('object', '{ items, subtotal, fees, feesTotal, total, currency, itemCount }', [
        { path: 'items', type: 'array' },
        { path: 'subtotal', type: 'number' },
        { path: 'fees', type: 'array' },
        { path: 'feesTotal', type: 'number' },
        { path: 'total', type: 'number' },
        { path: 'currency', type: 'string' },
        { path: 'itemCount', type: 'number' },
      ])
    case 'file':
      if (maxFiles > 1) {
        return wrapQuestionResponse('array', '[{ filename, url, mime, … }]')
      }
      return wrapQuestionResponse('object', '{ filename, url, mime, … }', FILE_RESPONSE_FIELDS)
    case 'signature':
    case 'audio':
      return wrapQuestionResponse('object', '{ filename, url, mime, … }', FILE_RESPONSE_FIELDS)
    default:
      return wrapQuestionResponse('string', '"…"')
  }
}

/** Result type written by an Operation step. */
export function describeOperationResponse(operation: string): { dataType: VariableType | 'unknown'; example: string } {
  switch (operation) {
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
    case 'length':
      return { dataType: 'number', example: '42' }
    case 'parse_json':
      return { dataType: 'object', example: '{ … }' }
    case 'json_path':
      return { dataType: 'unknown', example: 'value at path' }
    default:
      return { dataType: 'string', example: '"…"' }
  }
}

/** Payload written by an Entity step (`{{steps.key.record}}` / `.records`). */
export function describeEntityResponse(operation: string): QuestionResponseTypeInfo {
  if (operation === 'list') {
    return {
      dataType: 'array',
      example: '[{ id, … }]',
      fields: [
        { path: 'records', type: 'array' },
        { path: 'count', type: 'number' },
      ],
    }
  }
  if (operation === 'delete') {
    return {
      dataType: 'object',
      example: '{ deleted: true, id }',
      fields: [
        { path: 'deleted', type: 'boolean' },
        { path: 'id', type: 'string' },
      ],
    }
  }
  return {
    dataType: 'object',
    example: '{ id, … }',
    fields: [
      { path: 'record', type: 'object' },
      { path: 'id', type: 'string' },
    ],
  }
}

export function coerceChoiceList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((c) => String(c).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean)
      }
    } catch {
      /* not JSON */
    }
  }
  return []
}

/** Parse designer JSON-array text into choice labels. Returns null when invalid. */
export function parseChoicesJson(raw: string): string[] | null {
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.map((c) => String(c)).map((s) => s.trim()).filter(Boolean)
  } catch {
    return null
  }
}

export function formatChoicesJson(choices: string[]): string {
  return JSON.stringify(choices, null, 2)
}

export function resolveQuestionChoices(
  config: Record<string, unknown> | undefined | null,
  runtime?: { resolve?: (raw: string) => unknown },
): string[] {
  const answerType = String(config?.answerType ?? 'text')
  const from = String(config?.choicesFrom ?? '').trim()
  if (from && runtime?.resolve) {
    const resolved = coerceChoiceList(runtime.resolve(from))
    if (resolved.length) return resolved
  }

  const raw = Array.isArray(config?.choices) ? (config!.choices as unknown[]) : []
  const choices = coerceChoiceList(raw)
  if (choices.length) return choices
  if (answerType === 'image_choice') return readImageChoices(config).map((c) => c.label)
  if (answerType === 'gender') return [...DEFAULT_GENDER_CHOICES]
  if (answerType === 'likert') return [...DEFAULT_LIKERT_CHOICES]
  return []
}

export const httpConfigSchema = z.object({
  connectionId: z.string().default(''),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  path: z.string().default(''),
  body: z.string().default(''),
  paramValues: z.record(z.string(), z.string()).default({}),
  outputVariable: z.string().default(''),
})

export const emailConfigSchema = z.object({
  connectionId: z.string().default(''),
  templateKey: z.string().default(''),
  to: z.string().default(''),
  subject: z.string().default(''),
  body: z.string().default(''),
  paramValues: z.record(z.string(), z.string()).default({}),
  templateBindings: z.record(z.string(), z.record(z.string(), z.string())).optional(),
})

export const conditionConfigSchema = z.object({
  left: z.string().default(''),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists']).default('eq'),
  right: z.string().default(''),
})

export const CONDITION_OPERATOR_OPTIONS: Array<{
  value: z.infer<typeof conditionConfigSchema>['operator']
  label: string
  hint: string
  needsRight: boolean
}> = [
  { value: 'eq', label: 'Equals', hint: 'Both sides are the same', needsRight: true },
  { value: 'neq', label: 'Does not equal', hint: 'Both sides are different', needsRight: true },
  { value: 'gt', label: 'Is greater than', hint: 'Left side is larger than the right (numbers)', needsRight: true },
  {
    value: 'gte',
    label: 'Is greater than or equal to',
    hint: 'Left side is larger than or the same as the right',
    needsRight: true,
  },
  { value: 'lt', label: 'Is less than', hint: 'Left side is smaller than the right (numbers)', needsRight: true },
  {
    value: 'lte',
    label: 'Is less than or equal to',
    hint: 'Left side is smaller than or the same as the right',
    needsRight: true,
  },
  {
    value: 'contains',
    label: 'Contains',
    hint: 'Left side text includes the right side text',
    needsRight: true,
  },
  {
    value: 'exists',
    label: 'Has a value',
    hint: 'Left side is present and not empty — no right side needed',
    needsRight: false,
  },
]

export const loopConfigSchema = z.object({
  /** Template ref or JSON resolving to an array, e.g. {{steps.http_1.data}} or {{vars.items}} */
  collection: z.string().default(''),
  /** Written each iteration — default {{vars.item}} */
  itemVariable: z.string().default('item'),
  /** Written each iteration (0-based) — default {{vars.index}} */
  indexVariable: z.string().default('index'),
})

export const setVariableConfigSchema = z.object({
  variableKey: z.string().default(''),
  value: z.string().default(''),
  valueType: z.enum(variableTypes).default('string'),
})

export const OPERATION_OPTIONS = [
  {
    value: 'concat',
    label: 'Concatenate',
    hint: 'Join left and right as text',
    needsRight: true,
  },
  {
    value: 'add',
    label: 'Add',
    hint: 'left + right (numbers)',
    needsRight: true,
  },
  {
    value: 'subtract',
    label: 'Subtract',
    hint: 'left − right (numbers)',
    needsRight: true,
  },
  {
    value: 'multiply',
    label: 'Multiply',
    hint: 'left × right (numbers)',
    needsRight: true,
  },
  {
    value: 'divide',
    label: 'Divide',
    hint: 'left ÷ right (numbers)',
    needsRight: true,
  },
  {
    value: 'json_path',
    label: 'JSON path',
    hint: 'Read a dotted path from left (object/JSON); right is the path',
    needsRight: true,
  },
  {
    value: 'uppercase',
    label: 'Uppercase',
    hint: 'Convert left text to UPPERCASE',
    needsRight: false,
  },
  {
    value: 'lowercase',
    label: 'Lowercase',
    hint: 'Convert left text to lowercase',
    needsRight: false,
  },
  {
    value: 'sentence_case',
    label: 'Sentence case',
    hint: 'Capitalize the first letter of left text',
    needsRight: false,
  },
  {
    value: 'trim',
    label: 'Trim',
    hint: 'Remove leading/trailing whitespace from left',
    needsRight: false,
  },
  {
    value: 'length',
    label: 'Length',
    hint: 'Character length of left (or array length)',
    needsRight: false,
  },
  {
    value: 'parse_json',
    label: 'Parse JSON',
    hint: 'Parse left as JSON into an object/array',
    needsRight: false,
  },
  {
    value: 'stringify_json',
    label: 'Stringify JSON',
    hint: 'Serialize left to a JSON string',
    needsRight: false,
  },
  {
    value: 'replace',
    label: 'Replace text',
    hint: 'In left, replace occurrences of “find” with “replace with”',
    needsRight: true,
    needsReplaceWith: true,
  },
] as const

export type OperationKind = (typeof OPERATION_OPTIONS)[number]['value']

export const operationConfigSchema = z.object({
  operation: z
    .enum([
      'concat',
      'add',
      'subtract',
      'multiply',
      'divide',
      'json_path',
      'uppercase',
      'lowercase',
      'sentence_case',
      'trim',
      'length',
      'parse_json',
      'stringify_json',
      'replace',
    ])
    .default('concat'),
  left: z.string().default(''),
  right: z.string().default(''),
  replaceWith: z.string().default(''),
  outputVariable: z.string().default(''),
})

export const endConfigSchema = z.object({
  message: z.string().optional(),
  mediaFiles: z.array(z.string()).optional(),
  templateBindings: z.record(z.string(), z.record(z.string(), z.string())).optional(),
})

export const ENTITY_OPERATIONS = [
  { value: 'list', label: 'List records', hint: 'Return matching records as an array', needsRecordId: false, needsFields: false, writes: true },
  { value: 'get', label: 'Get record', hint: 'Fetch one record by id or filter', needsRecordId: false, needsFields: false, writes: true },
  { value: 'create', label: 'Create record', hint: 'Insert a new dynamic record', needsRecordId: false, needsFields: true, writes: true },
  { value: 'update', label: 'Update record', hint: 'Update a dynamic record by id', needsRecordId: true, needsFields: true, writes: true },
  { value: 'delete', label: 'Delete record', hint: 'Delete a dynamic record by id', needsRecordId: true, needsFields: false, writes: true },
] as const

export type EntityOperation = (typeof ENTITY_OPERATIONS)[number]['value']

export const entityConfigSchema = z.object({
  entityId: z.string().default(''),
  operation: z.enum(['list', 'get', 'create', 'update', 'delete']).default('list'),
  /** Template / expression resolving to a record UUID (get/update/delete). */
  recordId: z.string().default(''),
  /** Optional attribute key to filter list/get. */
  filterAttribute: z.string().default(''),
  /** Template value the filter attribute must equal. */
  filterEquals: z.string().default(''),
  /** Attr key → template value for create/update. */
  fieldMap: z.record(z.string(), z.string()).default({}),
  outputVariable: z.string().default(''),
})

export type MessageConfig = z.infer<typeof messageConfigSchema>
export type QuestionConfig = z.infer<typeof questionConfigSchema>
export type HttpConfig = z.infer<typeof httpConfigSchema>
export type EmailConfig = z.infer<typeof emailConfigSchema>
export type ConditionConfig = z.infer<typeof conditionConfigSchema>
export type LoopConfig = z.infer<typeof loopConfigSchema>
export type SetVariableConfig = z.infer<typeof setVariableConfigSchema>
export type OperationConfig = z.infer<typeof operationConfigSchema>
export type EntityConfig = z.infer<typeof entityConfigSchema>
export type EndConfig = z.infer<typeof endConfigSchema>

export type NodeConfigMap = {
  message: MessageConfig
  question: QuestionConfig
  http: HttpConfig
  email: EmailConfig
  condition: ConditionConfig
  loop: LoopConfig
  set_variable: SetVariableConfig
  operation: OperationConfig
  entity: EntityConfig
  end: EndConfig
}

export interface DesignerNode {
  id: string
  key: string
  type: FlowNodeType
  label: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface DesignerEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  label?: string | null
}

export function defaultConfig(type: FlowNodeType): Record<string, unknown> {
  const shared = defaultSharedSettings()
  switch (type) {
    case 'message':
      return { ...messageConfigSchema.parse({}), ...shared }
    case 'question':
      return { ...questionConfigSchema.parse({}), ...shared }
    case 'http':
      return { ...httpConfigSchema.parse({}), ...shared }
    case 'email':
      return { ...emailConfigSchema.parse({}), ...shared }
    case 'condition':
      return { ...conditionConfigSchema.parse({}), ...shared }
    case 'loop':
      return { ...loopConfigSchema.parse({}), ...shared }
    case 'set_variable':
      return { ...setVariableConfigSchema.parse({}), ...shared }
    case 'operation':
      return { ...operationConfigSchema.parse({}), ...shared }
    case 'entity':
      return { ...entityConfigSchema.parse({}), ...shared }
    case 'end':
      return { ...endConfigSchema.parse({}), ...shared }
  }
}

export function nodeTypeLabel(type: FlowNodeType): string {
  switch (type) {
    case 'message':
      return 'Message'
    case 'question':
      return 'Question'
    case 'http':
      return 'HTTP request'
    case 'email':
      return 'Send email'
    case 'condition':
      return 'Condition'
    case 'loop':
      return 'For each'
    case 'set_variable':
      return 'Set variable'
    case 'operation':
      return 'Operation'
    case 'entity':
      return 'Entity'
    case 'end':
      return 'End'
  }
}

export const TEMPLATE_REF_REGEX = /\{\{([\s\S]*?)\}\}/g

export function extractTemplateRefs(input: string): string[] {
  return collectPathRefs(input)
}

export function collectConfigStrings(config: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const value of Object.values(config)) {
    if (typeof value === 'string') out.push(value)
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') out.push(item)
      }
    } else if (value && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        if (typeof nested === 'string') out.push(nested)
      }
    }
  }
  return out
}

/** Step-produced variable key from a node config, if any. */
export function getStepOutputVariable(node: DesignerNode): string | null {
  const cfg = node.config
  if (node.type === 'question' || node.type === 'http' || node.type === 'operation' || node.type === 'entity') {
    const key = cfg.outputVariable
    return typeof key === 'string' && key.trim() ? key.trim() : null
  }
  if (node.type === 'set_variable') {
    const key = cfg.variableKey
    return typeof key === 'string' && key.trim() ? key.trim() : null
  }
  return null
}
