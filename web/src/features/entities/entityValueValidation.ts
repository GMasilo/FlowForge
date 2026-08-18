import type { VariableType } from '@/shared/types/database'

export type EntityAttrTypeSpec = {
  key: string
  label?: string | null
  value_type: VariableType
  required?: boolean | null
  default_value?: unknown
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/

export function isBlankEntityValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

export function describeJsType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export function coerceEntityValue(
  raw: unknown,
  type: VariableType,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (isBlankEntityValue(raw)) return { ok: true, value: undefined }

  switch (type) {
    case 'string': {
      if (typeof raw === 'string') return { ok: true, value: raw }
      if (typeof raw === 'number' && Number.isFinite(raw)) return { ok: true, value: String(raw) }
      if (typeof raw === 'boolean') return { ok: true, value: String(raw) }
      return { ok: false, error: 'must be a string' }
    }
    case 'number': {
      if (typeof raw === 'number' && Number.isFinite(raw)) return { ok: true, value: raw }
      if (typeof raw === 'string') {
        const n = Number(raw.trim().replace(/,/g, ''))
        if (raw.trim() !== '' && Number.isFinite(n)) return { ok: true, value: n }
      }
      return { ok: false, error: 'must be a number' }
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw }
      if (raw === 0 || raw === 1) return { ok: true, value: raw === 1 }
      if (typeof raw === 'string') {
        const s = raw.trim().toLowerCase()
        if (s === 'true' || s === 'yes' || s === '1') return { ok: true, value: true }
        if (s === 'false' || s === 'no' || s === '0') return { ok: true, value: false }
      }
      return { ok: false, error: 'must be a boolean' }
    }
    case 'date': {
      if (typeof raw !== 'string') return { ok: false, error: 'must be a date (YYYY-MM-DD)' }
      const trimmed = raw.trim()
      if (!DATE_RE.test(trimmed)) return { ok: false, error: 'must be a date (YYYY-MM-DD)' }
      const day = trimmed.slice(0, 10)
      if (Number.isNaN(Date.parse(day))) return { ok: false, error: 'must be a date (YYYY-MM-DD)' }
      return { ok: true, value: trimmed.length === 10 ? day : trimmed.replace(' ', 'T') }
    }
    case 'array': {
      if (Array.isArray(raw)) return { ok: true, value: raw }
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as unknown
          if (Array.isArray(parsed)) return { ok: true, value: parsed }
        } catch {
          /* not JSON */
        }
      }
      return { ok: false, error: 'must be an array' }
    }
    case 'object': {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ok: true, value: raw }
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as unknown
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ok: true, value: parsed }
        } catch {
          /* not JSON */
        }
      }
      return { ok: false, error: 'must be an object' }
    }
    default:
      return { ok: false, error: `unsupported type "${String(type)}"` }
  }
}

/**
 * Coerce and type-check values against entity attributes.
 * `partial` (flow update): only provided keys are checked; missing required fields stay on the existing row.
 * Full create/replace: defaults are applied and required attributes must be present.
 */
export function validateAndCoerceEntityValues(
  values: Record<string, unknown>,
  attributes: EntityAttrTypeSpec[],
  options?: { partial?: boolean },
): Record<string, unknown> {
  const partial = options?.partial === true
  const byKey = new Map(attributes.map((a) => [a.key, a]))
  const errors: string[] = []
  const out: Record<string, unknown> = {}

  for (const key of Object.keys(values)) {
    if (!byKey.has(key)) errors.push(`Unknown field "${key}"`)
  }

  for (const attr of attributes) {
    const label = attr.label?.trim() || attr.key
    const provided = Object.prototype.hasOwnProperty.call(values, attr.key)
    let raw: unknown = provided ? values[attr.key] : undefined

    if (!provided || isBlankEntityValue(raw)) {
      if (!partial && !isBlankEntityValue(attr.default_value)) {
        raw = attr.default_value
      } else if (attr.required) {
        if (!partial || provided) errors.push(`"${label}" is required`)
        continue
      } else {
        continue
      }
    }

    const coerced = coerceEntityValue(raw, attr.value_type)
    if (!coerced.ok) {
      errors.push(
        `"${label}" ${coerced.error} (column is ${attr.value_type}, got ${describeJsType(raw)})`,
      )
      continue
    }
    if (coerced.value === undefined) continue
    out[attr.key] = coerced.value
  }

  if (errors.length) throw new Error(errors.join('; '))
  return out
}
