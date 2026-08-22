import {
  DEFAULT_MOOD_OPTIONS,
  isAnswerRequired,
  normalizeAllowedEmailDomains,
  readImageChoices,
  readScaleChoices,
  readFormFields,
  resolveQuestionChoices,
  calendarDateString,
  clockTimeString,
  type QuestionConfig,
} from '@/features/designer/model/flowSchema'
import {
  displayNameForFiles,
  isAllowedConversationFile,
  normalizeFileAccept,
  normalizeMaxFiles,
  parseConversationFileList,
} from '@/features/designer/model/conversationFiles'
import { countryDisplayLabel, normalizeCountryValue } from '@/shared/lib/countries'
import { mediaKeyFromFilename } from '@/features/designer/model/chatbotMedia'
import {
  buildShopCart,
  cartCatalogFromTemplates,
  qtyMapFromShopAnswer,
  shopCartDisplayText,
} from '@/features/templates/templateModel'

/** Map "2", "2.", "#2", or a label to the choice value. */
export function resolveNumberedChoiceInput(raw: string, choices: string[]): string | null {
  const text = raw.trim()
  if (!text || !choices.length) return null

  const exact = choices.find((c) => c === text)
  if (exact) return exact
  const lower = text.toLowerCase()
  const byLabel = choices.find((c) => c.toLowerCase() === lower)
  if (byLabel) return byLabel

  const numbered = text.match(/^#?\s*(\d+)\s*[.)]?\s*$/)
  if (numbered) {
    const index = Number(numbered[1]) - 1
    if (Number.isInteger(index) && index >= 0 && index < choices.length) {
      return choices[index]!
    }
    return null
  }

  // "2 Blue" or "2. Blue"
  const withLabel = text.match(/^#?\s*(\d+)\s*[.)]\s*(.+)$/)
  if (withLabel) {
    const index = Number(withLabel[1]) - 1
    const label = withLabel[2]!.trim()
    if (Number.isInteger(index) && index >= 0 && index < choices.length) {
      const atIndex = choices[index]!
      if (!label || atIndex.toLowerCase() === label.toLowerCase()) return atIndex
    }
  }

  return null
}

export type AnswerValidationResult =
  | { ok: true; value: unknown; displayText: string }
  | { ok: false; error: string }

function asOptionalNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function asOptionalString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t || undefined
}

function checkLength(
  text: string,
  minLength: number | undefined,
  maxLength: number | undefined,
): string | null {
  if (minLength != null && text.length < minLength) {
    return `Must be at least ${minLength} character${minLength === 1 ? '' : 's'}.`
  }
  if (maxLength != null && text.length > maxLength) {
    return `Must be at most ${maxLength} character${maxLength === 1 ? '' : 's'}.`
  }
  return null
}

function checkPattern(text: string, pattern: string | undefined, patternMessage: string | undefined): string | null {
  if (!pattern) return null
  try {
    const re = new RegExp(pattern)
    if (!re.test(text)) return patternMessage?.trim() || 'Does not match the required format.'
  } catch {
    return 'Invalid validation pattern configured.'
  }
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i
const E164_RE = /^\+[1-9]\d{6,14}$/
const PHONE_RE = /^[+]?[\d\s().-]{7,20}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function zaIdChecksumOk(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false
  const mm = Number(id.slice(2, 4))
  const dd = Number(id.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false
  let oddSum = 0
  let evenConcat = ''
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) oddSum += Number(id[i])
    else evenConcat += id[i]
  }
  const evenSum = String(Number(evenConcat) * 2)
    .split('')
    .reduce((sum, d) => sum + Number(d), 0)
  const check = (10 - ((oddSum + evenSum) % 10)) % 10
  return check === Number(id[12])
}

function compareIsoLike(a: string, b: string): number {
  return a.localeCompare(b)
}

/**
 * Validate and coerce a question answer against the node's config.
 * Accepts a single string or multiple selected choices.
 */
export function validateQuestionAnswer(
  config: Record<string, unknown> | QuestionConfig,
  answer: string | string[] | Record<string, unknown> | Record<string, unknown>[],
  options?: { choices?: string[]; templates?: Record<string, unknown> },
): AnswerValidationResult {
  const answerType = String(config.answerType ?? 'text')
  const required = isAnswerRequired(config as Record<string, unknown>)

  const minLength = asOptionalNumber(config.minLength)
  const maxLength = asOptionalNumber(config.maxLength)
  const pattern = asOptionalString(config.pattern)
  const patternMessage = asOptionalString(config.patternMessage)
  const min = asOptionalNumber(config.min)
  const max = asOptionalNumber(config.max)
  const minDate = asOptionalString(config.minDate)
  const maxDate = asOptionalString(config.maxDate)
  const phoneFormat = asOptionalString(config.phoneFormat) === 'any' ? 'any' : 'e164'
  const allowMultiple = config.allowMultiple === true
  const minSelections = asOptionalNumber(config.minSelections)
  const maxSelections = asOptionalNumber(config.maxSelections)

  if (answerType === 'boolean') {
    const raw = Array.isArray(answer) ? answer[0] ?? '' : answer
    const normalized = String(raw).trim().toLowerCase()
    if (!normalized) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'Please choose Yes or No.' }
    }
    if (normalized === 'true' || normalized === 'yes') {
      return { ok: true, value: true, displayText: 'Yes' }
    }
    if (normalized === 'false' || normalized === 'no') {
      return { ok: true, value: false, displayText: 'No' }
    }
    return { ok: false, error: 'Please choose Yes or No.' }
  }

  if (answerType === 'file' || answerType === 'signature') {
    const files = parseConversationFileList(answer)
    if (!files.length) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return {
        ok: false,
        error: answerType === 'signature' ? 'Please add a signature.' : 'Please attach a file.',
      }
    }
    const accept = answerType === 'signature' ? 'image' : normalizeFileAccept(config.fileAccept)
    const maxFiles = answerType === 'signature' ? 1 : normalizeMaxFiles(config.maxFiles)
    if (files.length > maxFiles) {
      return {
        ok: false,
        error: maxFiles === 1 ? 'Please attach only one file.' : `Attach at most ${maxFiles} files.`,
      }
    }
    for (const file of files) {
      if (!isAllowedConversationFile({ name: file.originalName || file.filename }, accept)) {
        return { ok: false, error: 'That file type is not allowed.' }
      }
    }
    const value = files.length === 1 ? files[0] : files
    return { ok: true, value, displayText: displayNameForFiles(files) }
  }

  if (answerType === 'audio') {
    const files = parseConversationFileList(answer)
    if (!files.length) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'Please record a voice note.' }
    }
    if (files.length > 1) return { ok: false, error: 'Please send a single recording.' }
    const name = files[0]!.originalName || files[0]!.filename
    const ext = name.split('.').pop()?.toLowerCase() ?? ''
    if (!['webm', 'ogg', 'mp3', 'wav'].includes(ext)) {
      return { ok: false, error: 'Voice notes must be webm, ogg, mp3, or wav.' }
    }
    return { ok: true, value: files[0], displayText: 'Voice note' }
  }

  if (answerType === 'ranking') {
    const choices = options?.choices ?? resolveQuestionChoices(config as Record<string, unknown>)
    const ranked = (Array.isArray(answer) ? answer : []).map((s) => String(s).trim()).filter(Boolean)
    if (!ranked.length) {
      if (!required) return { ok: true, value: [], displayText: '' }
      return { ok: false, error: 'Please rank the items.' }
    }
    if (choices.length && (ranked.length !== choices.length || choices.some((c) => !ranked.includes(c)))) {
      return { ok: false, error: 'Rank every item in the list.' }
    }
    return {
      ok: true,
      value: ranked,
      displayText: ranked.map((item, i) => `${i + 1}. ${item}`).join(', '),
    }
  }

  if (answerType === 'location') {
    const rec = !Array.isArray(answer) && answer && typeof answer === 'object' ? answer : null
    const lat = rec ? Number((rec as { lat?: unknown }).lat) : NaN
    const lng = rec ? Number((rec as { lng?: unknown }).lng) : NaN
    const label = rec && typeof (rec as { label?: unknown }).label === 'string'
      ? String((rec as { label: string }).label).trim()
      : ''
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'Please share a location.' }
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { ok: false, error: 'Location coordinates are out of range.' }
    }
    const accuracyRaw = rec ? Number((rec as { accuracy?: unknown }).accuracy) : NaN
    const value: Record<string, unknown> = {
      lat,
      lng,
      ...(Number.isFinite(accuracyRaw) ? { accuracy: accuracyRaw } : {}),
      ...(label ? { label } : {}),
    }
    const display = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    return { ok: true, value, displayText: display }
  }

  if (answerType === 'appointment') {
    const rec = !Array.isArray(answer) && answer && typeof answer === 'object' ? answer : null
    const date = rec && typeof (rec as { date?: unknown }).date === 'string' ? String((rec as { date: string }).date).trim() : ''
    const time = rec && typeof (rec as { time?: unknown }).time === 'string' ? String((rec as { time: string }).time).trim() : ''
    if (!date || !time) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'Please pick a date and a time.' }
    }
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
      return { ok: false, error: 'Please pick a valid date.' }
    }
    const normalizedTime = time.length === 5 ? time : time.slice(0, 5)
    if (!TIME_RE.test(normalizedTime)) {
      return { ok: false, error: 'Please pick a valid time.' }
    }
    const minDate = asOptionalString(config.minDate)
    const maxDate = asOptionalString(config.maxDate)
    if (minDate && date < minDate) return { ok: false, error: `Date must be on or after ${minDate}.` }
    if (maxDate && date > maxDate) return { ok: false, error: `Date must be on or before ${maxDate}.` }
    if (date === calendarDateString() && normalizedTime < clockTimeString()) {
      return { ok: false, error: 'Please pick a time from now on.' }
    }
    return {
      ok: true,
      value: { date, time: normalizedTime },
      displayText: `${date} at ${normalizedTime}`,
    }
  }

  if (answerType === 'matrix') {
    const rows = options?.choices ?? resolveQuestionChoices(config as Record<string, unknown>)
    const scale = readScaleChoices(config as Record<string, unknown>)
    const rec = !Array.isArray(answer) && answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {}
    const filled: Record<string, string> = {}
    for (const row of rows) {
      const raw = rec[row]
      const val = raw == null ? '' : String(raw).trim()
      if (!val) continue
      if (scale.length && !scale.includes(val)) {
        return { ok: false, error: `“${val}” is not on the scale.` }
      }
      filled[row] = val
    }
    if (rows.length && Object.keys(filled).length < rows.length) {
      if (!required && !Object.keys(filled).length) return { ok: true, value: {}, displayText: '' }
      return { ok: false, error: 'Please rate every row.' }
    }
    return {
      ok: true,
      value: filled,
      displayText: Object.entries(filled).map(([row, val]) => `${row}: ${val}`).join('; '),
    }
  }

  if (answerType === 'payment') {
    const rec = !Array.isArray(answer) && answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : null
    const status = rec ? String(rec.status ?? '').trim().toLowerCase() : ''
    const needsVerify = String(config.paymentConnectionId ?? '').trim() !== ''
    const accepted = needsVerify ? status === 'verified' : status === 'paid' || status === 'verified'
    if (!accepted) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return {
        ok: false,
        error: needsVerify
          ? 'Waiting for payment confirmation from the provider.'
          : 'Please confirm payment to continue.',
      }
    }
    const url = rec && typeof rec.url === 'string' ? rec.url.trim() : ''
    const amountRaw = rec?.amount
    const amount =
      typeof amountRaw === 'number' && Number.isFinite(amountRaw)
        ? amountRaw
        : typeof amountRaw === 'string' && amountRaw.trim()
          ? amountRaw.trim()
          : null
    const currency = rec && typeof rec.currency === 'string' ? rec.currency.trim().toUpperCase() : ''
    const reference = rec && typeof rec.reference === 'string' ? rec.reference.trim() : ''
    const providerPaymentId =
      rec && typeof rec.providerPaymentId === 'string' ? rec.providerPaymentId.trim() : ''
    const storedStatus = needsVerify ? 'verified' : status === 'verified' ? 'verified' : 'paid'
    const value: Record<string, unknown> = {
      status: storedStatus,
      ...(url ? { url } : {}),
      ...(amount != null ? { amount } : {}),
      ...(currency ? { currency } : {}),
      ...(reference ? { reference } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
    }
    const amountText =
      amount == null ? '' : currency ? `${currency} ${amount}` : String(amount)
    const label = storedStatus === 'verified' ? 'Paid' : 'Paid'
    return { ok: true, value, displayText: amountText ? `${label} ${amountText}` : label }
  }

  if (answerType === 'captcha') {
    const text = Array.isArray(answer) ? String(answer[0] ?? '').trim() : String(answer ?? '').trim()
    if (!text) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'Please complete the captcha.' }
    }
    return { ok: true, value: { ok: true }, displayText: 'Verified' }
  }

  if (answerType === 'form') {
    const fields = readFormFields(config as Record<string, unknown>)
    const rec = !Array.isArray(answer) && answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {}
    if (!fields.length) {
      if (!required) return { ok: true, value: {}, displayText: '' }
      return { ok: false, error: 'This form has no fields configured.' }
    }
    const out: Record<string, unknown> = {}
    const display: string[] = []
    for (const field of fields) {
      const raw = rec[field.key]
      const asAnswer: string | string[] =
        typeof raw === 'string' || Array.isArray(raw) ? (raw as string | string[]) : raw == null ? '' : String(raw)
      const fieldRequired = field.required !== false
      if (!fieldRequired && (asAnswer === '' || (Array.isArray(asAnswer) && !asAnswer.length))) {
        out[field.key] = null
        continue
      }
      const result = validateQuestionAnswer(
        { answerType: field.type, answerRequired: fieldRequired },
        asAnswer,
      )
      if (!result.ok) {
        return { ok: false, error: `${field.label}: ${result.error}` }
      }
      out[field.key] = result.value
      if (result.displayText) display.push(result.displayText)
    }
    return { ok: true, value: out, displayText: display.join(' · ') }
  }

  if (answerType === 'shop') {
    const catalog = cartCatalogFromTemplates(
      options?.templates,
      String(config.shopTemplateKey ?? ''),
    )
    if (!catalog) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'This shop has no store catalog linked.' }
    }
    const cart = buildShopCart(catalog, qtyMapFromShopAnswer(answer))
    if (!cart.itemCount) {
      if (!required) return { ok: true, value: cart, displayText: '' }
      return { ok: false, error: 'Add at least one product before checkout.' }
    }
    return { ok: true, value: cart, displayText: shopCartDisplayText(cart) }
  }

  if (answerType === 'image_choice') {
    const optionsList = readImageChoices(config as Record<string, unknown>)
    const byLabel = new Map(optionsList.map((o) => [o.label, o]))
    const rawPicks = Array.isArray(answer) ? answer : answer ? [answer] : []
    const picks: Array<{ label: string; extra: Record<string, unknown> }> = []
    for (const item of rawPicks) {
      if (typeof item === 'string') {
        const label = item.trim()
        if (label) picks.push({ label, extra: {} })
        continue
      }
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        const label = String(rec.label ?? '').trim()
        if (label) picks.push({ label, extra: rec })
      }
    }
    if (!picks.length) {
      if (!required) return { ok: true, value: allowMultiple ? [] : null, displayText: '' }
      return { ok: false, error: 'Please select an option.' }
    }
    if (!allowMultiple && picks.length > 1) {
      return { ok: false, error: 'Please select only one option.' }
    }
    const stored: Array<Record<string, unknown>> = []
    for (const pick of picks) {
      const opt = byLabel.get(pick.label)
      if (optionsList.length && !opt) {
        return { ok: false, error: `"${pick.label}" is not a valid option.` }
      }
      const filename = opt?.filename || String(pick.extra.filename ?? '').trim()
      const url = typeof pick.extra.url === 'string' ? pick.extra.url.trim() : ''
      const key =
        typeof pick.extra.key === 'string' && pick.extra.key.trim()
          ? pick.extra.key.trim()
          : filename
            ? mediaKeyFromFilename(filename)
            : ''
      stored.push({
        label: pick.label,
        ...(filename ? { filename } : {}),
        ...(key ? { key } : {}),
        ...(url ? { url } : {}),
      })
    }
    if (allowMultiple) {
      const unique: Array<Record<string, unknown>> = []
      const seen = new Set<string>()
      for (const item of stored) {
        const label = String(item.label ?? '')
        if (seen.has(label)) continue
        seen.add(label)
        unique.push(item)
      }
      if (minSelections != null && unique.length < minSelections) {
        return {
          ok: false,
          error: `Select at least ${minSelections} option${minSelections === 1 ? '' : 's'}.`,
        }
      }
      if (maxSelections != null && unique.length > maxSelections) {
        return {
          ok: false,
          error: `Select at most ${maxSelections} option${maxSelections === 1 ? '' : 's'}.`,
        }
      }
      return {
        ok: true,
        value: unique,
        displayText: unique.map((item) => String(item.label ?? '')).join(', '),
      }
    }
    return {
      ok: true,
      value: stored[0],
      displayText: String(stored[0]?.label ?? ''),
    }
  }

  if (
    answerType === 'choice' ||
    answerType === 'numbered_choice' ||
    answerType === 'gender' ||
    answerType === 'likert' ||
    answerType === 'autocomplete'
  ) {
    const choices = options?.choices ?? resolveQuestionChoices(config as Record<string, unknown>)
    const selectedRaw = (Array.isArray(answer) ? answer : answer ? [answer] : [])
      .map((s) => String(s).trim())
      .filter(Boolean)

    if (!selectedRaw.length) {
      if (!required) return { ok: true, value: allowMultiple ? [] : null, displayText: '' }
      return {
        ok: false,
        error:
          answerType === 'numbered_choice'
            ? 'Reply with a number from the list (e.g. 2), or pick an option.'
            : 'Please select an option.',
      }
    }

    if (!allowMultiple && selectedRaw.length > 1) {
      return { ok: false, error: 'Please select only one option.' }
    }

    const selected: string[] = []
    for (const s of selectedRaw) {
      const resolved =
        answerType === 'numbered_choice' ? resolveNumberedChoiceInput(s, choices) : s
      if (!resolved) {
        return {
          ok: false,
          error:
            answerType === 'numbered_choice'
              ? `"${s}" is not a valid number or option.`
              : `"${s}" is not a valid option.`,
        }
      }
      if (answerType !== 'numbered_choice' && choices.length && !choices.includes(resolved)) {
        return { ok: false, error: `"${s}" is not a valid option.` }
      }
      selected.push(resolved)
    }

    if (allowMultiple) {
      const unique = [...new Set(selected)]
      if (minSelections != null && unique.length < minSelections) {
        return {
          ok: false,
          error: `Select at least ${minSelections} option${minSelections === 1 ? '' : 's'}.`,
        }
      }
      if (maxSelections != null && unique.length > maxSelections) {
        return {
          ok: false,
          error: `Select at most ${maxSelections} option${maxSelections === 1 ? '' : 's'}.`,
        }
      }
      return { ok: true, value: unique, displayText: unique.join(', ') }
    }

    const value = selected[0]!
    if (answerType === 'numbered_choice') {
      const index = choices.indexOf(value)
      const displayText = index >= 0 ? `${index + 1}. ${value}` : value
      return { ok: true, value, displayText }
    }

    return { ok: true, value, displayText: value }
  }

  const text = Array.isArray(answer) ? answer.join(', ').trim() : String(answer ?? '').trim()

  if (!text) {
    if (!required) return { ok: true, value: null, displayText: '' }
    return { ok: false, error: 'An answer is required.' }
  }

  if (
    answerType === 'number' ||
    answerType === 'rating' ||
    answerType === 'slider' ||
    answerType === 'stars' ||
    answerType === 'nps' ||
    answerType === 'percentage' ||
    answerType === 'currency' ||
    answerType === 'stepper'
  ) {
    const n = Number(text.replace(/,/g, '').replace(/%/g, ''))
    if (!Number.isFinite(n)) return { ok: false, error: 'Please enter a valid number.' }

    if (answerType === 'percentage') {
      const lo = Math.min(100, Math.max(0, min ?? 0))
      const hi = Math.min(100, Math.max(0, max ?? 100))
      const pMin = Math.min(lo, hi)
      const pMax = Math.max(lo, hi)
      if (n < pMin) return { ok: false, error: `Must be at least ${pMin}%.` }
      if (n > pMax) return { ok: false, error: `Must be at most ${pMax}%.` }
      return { ok: true, value: n, displayText: `${n}%` }
    }

    const effectiveMin =
      answerType === 'rating' || answerType === 'stars'
        ? (min ?? 1)
        : answerType === 'nps' || answerType === 'slider' || answerType === 'stepper'
          ? (min ?? 0)
          : answerType === 'currency'
            ? (min ?? 0)
            : min
    const effectiveMax =
      answerType === 'rating' || answerType === 'stars'
        ? (max ?? 5)
        : answerType === 'nps'
          ? (max ?? 10)
          : answerType === 'slider' || answerType === 'stepper'
            ? (max ?? 100)
            : max
    if (effectiveMin != null && n < effectiveMin) {
      return { ok: false, error: `Must be at least ${effectiveMin}.` }
    }
    if (effectiveMax != null && n > effectiveMax) {
      return { ok: false, error: `Must be at most ${effectiveMax}.` }
    }
    if (answerType === 'currency') {
      const code = String(config.currencyCode ?? 'ZAR').trim().toUpperCase() || 'ZAR'
      let formatted = `${code} ${n}`
      try {
        formatted = new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: code,
          currencyDisplay: 'symbol',
        }).format(n)
      } catch {
        /* invalid currency code — keep fallback */
      }
      return { ok: true, value: n, displayText: formatted }
    }
    const displayText =
      answerType === 'stars' ? `${n} star${n === 1 ? '' : 's'}` : String(n)
    return { ok: true, value: n, displayText }
  }

  if (answerType === 'thumbs') {
    const normalized = text.toLowerCase()
    if (normalized === 'up' || normalized === 'true' || normalized === 'yes') {
      return { ok: true, value: 'up', displayText: 'Thumbs up' }
    }
    if (normalized === 'down' || normalized === 'false' || normalized === 'no') {
      return { ok: true, value: 'down', displayText: 'Thumbs down' }
    }
    return { ok: false, error: 'Please choose thumbs up or thumbs down.' }
  }

  if (answerType === 'mood') {
    const hit = DEFAULT_MOOD_OPTIONS.find(
      (m) => m.value === text || m.label.toLowerCase() === text.toLowerCase() || m.emoji === text,
    )
    if (!hit) return { ok: false, error: 'Please choose a mood.' }
    return { ok: true, value: hit.value, displayText: `${hit.emoji} ${hit.label}` }
  }

  if (answerType === 'otp') {
    const length = asOptionalNumber(config.otpLength) ?? 6
    const digits = text.replace(/\D/g, '')
    if (digits.length !== length) {
      return { ok: false, error: `Enter the ${length}-digit code.` }
    }
    return { ok: true, value: digits, displayText: digits }
  }

  if (answerType === 'confirm') {
    const normalized = text.toLowerCase()
    if (normalized === 'true' || normalized === 'yes' || normalized === 'confirmed') {
      const label = asOptionalString(config.confirmLabel) || 'Confirmed'
      return { ok: true, value: true, displayText: label }
    }
    return { ok: false, error: 'Please confirm to continue.' }
  }

  if (answerType === 'color') {
    if (!COLOR_RE.test(text)) {
      return { ok: false, error: 'Please choose a valid color (e.g. #14b8a6).' }
    }
    const normalized = text.length === 4
      ? `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase()
      : text.toLowerCase()
    return { ok: true, value: normalized, displayText: normalized }
  }

  if (answerType === 'email') {
    if (!EMAIL_RE.test(text)) return { ok: false, error: 'Please enter a valid email address.' }
    const allowedDomains = normalizeAllowedEmailDomains(config.allowedEmailDomains)
    if (allowedDomains.length) {
      const domain = text.slice(text.lastIndexOf('@') + 1).toLowerCase()
      if (!allowedDomains.includes(domain)) {
        const list = allowedDomains.map((d) => `@${d}`).join(', ')
        return {
          ok: false,
          error:
            allowedDomains.length === 1
              ? `Email must use the domain @${allowedDomains[0]}.`
              : `Email must use one of these domains: ${list}.`,
        }
      }
    }
    const lenErr = checkLength(text, minLength, maxLength)
    if (lenErr) return { ok: false, error: lenErr }
    return { ok: true, value: text, displayText: text }
  }

  if (answerType === 'phone') {
    const compact = text.replace(/[\s()-]/g, '')
    if (phoneFormat === 'e164') {
      if (!E164_RE.test(compact)) {
        return { ok: false, error: 'Enter a valid phone number with country code.' }
      }
    } else if (!E164_RE.test(compact) && !PHONE_RE.test(text)) {
      return { ok: false, error: 'Please enter a valid phone number.' }
    }
    const stored = E164_RE.test(compact) ? compact : text
    const lenErr = checkLength(stored, minLength, maxLength)
    if (lenErr) return { ok: false, error: lenErr }
    const patErr = checkPattern(stored, pattern, patternMessage)
    if (patErr) return { ok: false, error: patErr }
    return { ok: true, value: stored, displayText: stored }
  }

  if (answerType === 'url') {
    if (!URL_RE.test(text)) return { ok: false, error: 'Please enter a valid URL (e.g. google.com).' }
    const normalized = /^https?:\/\//i.test(text) ? text : `https://${text}`
    return { ok: true, value: normalized, displayText: text }
  }

  if (answerType === 'date') {
    if (!DATE_RE.test(text) || Number.isNaN(Date.parse(text))) {
      return { ok: false, error: 'Please enter a valid date (YYYY-MM-DD).' }
    }
    if (minDate && compareIsoLike(text, minDate) < 0) {
      return { ok: false, error: `Date must be on or after ${minDate}.` }
    }
    if (maxDate && compareIsoLike(text, maxDate) > 0) {
      return { ok: false, error: `Date must be on or before ${maxDate}.` }
    }
    return { ok: true, value: text, displayText: text }
  }

  if (answerType === 'time') {
    if (!TIME_RE.test(text)) return { ok: false, error: 'Please enter a valid time (HH:MM).' }
    if (minDate && compareIsoLike(text, minDate) < 0) {
      return { ok: false, error: `Time must be on or after ${minDate}.` }
    }
    if (maxDate && compareIsoLike(text, maxDate) > 0) {
      return { ok: false, error: `Time must be on or before ${maxDate}.` }
    }
    return { ok: true, value: text, displayText: text }
  }

  if (answerType === 'datetime') {
    const normalized = text.includes('T') ? text : text.replace(' ', 'T')
    if (!DATETIME_RE.test(normalized) || Number.isNaN(Date.parse(normalized))) {
      return { ok: false, error: 'Please enter a valid date and time.' }
    }
    if (minDate && compareIsoLike(normalized, minDate) < 0) {
      return { ok: false, error: `Must be on or after ${minDate}.` }
    }
    if (maxDate && compareIsoLike(normalized, maxDate) > 0) {
      return { ok: false, error: `Must be on or before ${maxDate}.` }
    }
    const nowFloor = `${calendarDateString()}T${clockTimeString()}`
    if (compareIsoLike(normalized, nowFloor) < 0) {
      return { ok: false, error: 'Please pick a time from now on.' }
    }
    return { ok: true, value: normalized, displayText: normalized }
  }

  if (answerType === 'country') {
    const normalized = normalizeCountryValue(text)
    if (!normalized) {
      if (!required) return { ok: true, value: null, displayText: '' }
      return { ok: false, error: 'Please select a country.' }
    }
    const lenErr = checkLength(normalized, minLength, maxLength)
    if (lenErr) return { ok: false, error: lenErr }
    const patErr = checkPattern(normalized, pattern, patternMessage)
    if (patErr) return { ok: false, error: patErr }
    return {
      ok: true,
      value: normalized,
      displayText: countryDisplayLabel(normalized),
    }
  }

  if (answerType === 'national_id') {
    const digits = text.replace(/\D/g, '')
    const format = asOptionalString(config.idFormat) === 'any' ? 'any' : 'za'
    if (format === 'za') {
      if (!zaIdChecksumOk(digits)) {
        return { ok: false, error: 'Enter a valid 13-digit South African ID number.' }
      }
      return { ok: true, value: digits, displayText: digits }
    }
    if (!digits) return { ok: false, error: 'Please enter an ID number.' }
    const lenErr = checkLength(digits, minLength ?? 6, maxLength ?? 20)
    if (lenErr) return { ok: false, error: lenErr }
    const patErr = checkPattern(digits, pattern, patternMessage)
    if (patErr) return { ok: false, error: patErr }
    return { ok: true, value: digits, displayText: digits }
  }

  if (answerType === 'password') {
    const lenErr = checkLength(text, minLength ?? 4, maxLength)
    if (lenErr) return { ok: false, error: lenErr }
    const patErr = checkPattern(text, pattern, patternMessage)
    if (patErr) return { ok: false, error: patErr }
    return { ok: true, value: text, displayText: '••••••' }
  }

  if (answerType === 'postal_code') {
    if (!/^\d+$/.test(text)) {
      return { ok: false, error: 'Postal code must contain digits only.' }
    }
    const lenErr = checkLength(text, minLength, maxLength)
    if (lenErr) return { ok: false, error: lenErr }
    const patErr = checkPattern(text, pattern, patternMessage)
    if (patErr) return { ok: false, error: patErr }
    return { ok: true, value: text, displayText: text }
  }

  // text, long_text, name, address, and any unknown type
  const lenErr = checkLength(text, minLength, maxLength)
  if (lenErr) return { ok: false, error: lenErr }
  const patErr = checkPattern(text, pattern, patternMessage)
  if (patErr) return { ok: false, error: patErr }

  if (answerType === 'name' && text.length < 2 && minLength == null) {
    return { ok: false, error: 'Please enter a name.' }
  }

  return { ok: true, value: text, displayText: text }
}
