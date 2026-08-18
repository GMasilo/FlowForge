import {
  defaultScaleBounds,
  normalizeAllowedEmailDomains,
  isAnswerRequired,
  calendarDateString,
  clockTimeString,
} from '@/features/designer/model/flowSchema'

export type AnswerInputConstraints = {
  min?: number
  max?: number
  step?: number | 'any'
  minLength?: number
  maxLength?: number
  pattern?: string
  minDate?: string
  maxDate?: string
  required: boolean
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
  autoComplete?: string
  spellCheck?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function asString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t || undefined
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build an HTML pattern that matches allowlisted email domains (case-insensitive via character classes where needed). */
function emailAllowlistPattern(domains: string[]): string | undefined {
  if (!domains.length) return undefined
  const alts = domains.map(escapeRegex).join('|')
  // HTML pattern matches the whole value; keep it simple and lowercase-friendly.
  return `[^\\s@]+@(${alts})`
}

/**
 * Resolve HTML / control constraints from question config so the chat input
 * mirrors the same rules enforced by `validateQuestionAnswer`.
 */
export function resolveAnswerInputConstraints(
  answerType: string,
  config: Record<string, unknown>,
): AnswerInputConstraints {
  const defaults = defaultScaleBounds(answerType)
  const configuredMin = asNumber(config.min)
  const configuredMax = asNumber(config.max)
  const configuredStep = asNumber(config.step)
  const configuredMinLength = asNumber(config.minLength)
  const configuredMaxLength = asNumber(config.maxLength)
  const configuredPattern = asString(config.pattern)
  const required = isAnswerRequired(config)

  const out: AnswerInputConstraints = { required }

  // Numeric bounds (match validation defaults)
  if (
    answerType === 'number' ||
    answerType === 'rating' ||
    answerType === 'stars' ||
    answerType === 'nps' ||
    answerType === 'slider' ||
    answerType === 'percentage' ||
    answerType === 'currency' ||
    answerType === 'stepper'
  ) {
    out.min = configuredMin ?? defaults.min
    out.max = configuredMax ?? defaults.max
    out.step = configuredStep ?? defaults.step ?? (answerType === 'number' ? 'any' : 1)
    if (answerType === 'number') out.inputMode = 'decimal'
    if (answerType === 'currency') {
      out.inputMode = 'decimal'
      out.min = configuredMin ?? 0
      out.step = configuredStep ?? 0.01
    }
    if (answerType === 'percentage') {
      // Percentages are 0–100; honor designer min/max within that range.
      const lo = configuredMin ?? defaults.min ?? 0
      const hi = configuredMax ?? defaults.max ?? 100
      out.min = Math.min(100, Math.max(0, lo))
      out.max = Math.min(100, Math.max(0, hi))
      if (out.min > out.max) {
        const swap = out.min
        out.min = out.max
        out.max = swap
      }
      out.step = configuredStep ?? defaults.step ?? 1
    }
  }

  // Text length / pattern
  if (
    answerType === 'text' ||
    answerType === 'long_text' ||
    answerType === 'name' ||
    answerType === 'address' ||
    answerType === 'postal_code' ||
    answerType === 'country' ||
    answerType === 'phone' ||
    answerType === 'email' ||
    answerType === 'url'
  ) {
    out.minLength =
      configuredMinLength ?? (answerType === 'name' ? 2 : undefined)
    out.maxLength = configuredMaxLength
    if (answerType === 'postal_code') {
      out.pattern = configuredPattern ?? '\\d+'
      out.inputMode = 'numeric'
      out.autoComplete = 'postal-code'
      out.autoCapitalize = 'none'
      out.spellCheck = false
    } else if (answerType === 'email') {
      out.inputMode = 'email'
      out.autoComplete = 'email'
      out.autoCapitalize = 'none'
      out.spellCheck = false
      const domains = normalizeAllowedEmailDomains(config.allowedEmailDomains)
      out.pattern = configuredPattern ?? emailAllowlistPattern(domains)
    } else if (answerType === 'url') {
      out.inputMode = 'url'
      out.autoCapitalize = 'none'
      out.spellCheck = false
      out.pattern = configuredPattern
    } else if (answerType === 'phone') {
      out.inputMode = 'numeric'
      out.autoComplete = 'tel-national'
      out.autoCapitalize = 'none'
      out.spellCheck = false
      // National number segment: keep length caps reasonable for E.164
      out.minLength = configuredMinLength
      out.maxLength = configuredMaxLength ?? 15
      out.pattern = configuredPattern ?? '\\d+'
    } else {
      out.pattern = configuredPattern
      if (answerType === 'name') {
        out.autoComplete = 'name'
        out.autoCapitalize = 'words'
      }
    }
  }

  if (answerType === 'otp') {
    const length = asNumber(config.otpLength) ?? 6
    out.minLength = length
    out.maxLength = length
    out.pattern = `\\d{${length}}`
    out.inputMode = 'numeric'
    out.autoComplete = 'one-time-code'
    out.autoCapitalize = 'none'
    out.spellCheck = false
  }

  if (answerType === 'color') {
    out.pattern = configuredPattern ?? '#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})'
    out.autoCapitalize = 'none'
    out.spellCheck = false
  }

  if (answerType === 'date' || answerType === 'time' || answerType === 'datetime') {
    out.minDate = asString(config.minDate)
    out.maxDate = asString(config.maxDate)
    const now = new Date()
    if (answerType === 'datetime') {
      const floor = `${calendarDateString(now)}T${clockTimeString(now)}`
      out.minDate = out.minDate && out.minDate > floor ? out.minDate : floor
    } else if (answerType === 'time' && out.minDate) {
      const floor = clockTimeString(now)
      out.minDate = out.minDate > floor ? out.minDate : floor
    } else if (answerType === 'date') {
      const floor = calendarDateString(now)
      if (out.minDate && out.minDate < floor) out.minDate = floor
    }
  }

  return out
}

/** Convenience for native <input min/max/step> string attrs. */
export function constraintAttr(value: number | string | undefined): string | undefined {
  if (value == null) return undefined
  return String(value)
}
