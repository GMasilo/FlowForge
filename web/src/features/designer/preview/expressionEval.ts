/**
 * FlowForge expression language for text/config fields.
 *
 * Examples:
 *   parseJson({{vars.jsonStr}})
 *   {{parseJson(vars.jsonStr).items[0].name}}
 *   {{vars.count + 1}}
 *   {{if(empty(vars.x), 'n/a', vars.x)}}
 *   {{coalesce(vars.a, vars.b, 'fallback')}}
 *   {{prettify(utcNow(), 'relative')}}
 */

import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addSeconds,
  addWeeks,
  addYears,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
  formatDistanceToNow,
} from 'date-fns'
import { formatMediaForText, renderFileValue } from '../model/chatbotMedia'
import {
  documentContentFromExpr,
  encodeDocumentEmbed,
  fillDocumentSnapshot,
  isDocumentExprValue,
} from '@/features/templates/documentFill'
import {
  findCartInVars,
  findPaymentInVars,
  parseTemplateBindingMap,
  renderReceiptFromCart,
  renderReceiptHtml,
  type ReceiptContent,
  type TemplateBindingMap,
} from '@/features/templates/templateModel'

export type ExprContext = {
  vars: Record<string, unknown>
  steps: Record<string, unknown>
  media?: Record<string, unknown>
  templates?: Record<string, unknown>
  /** Resolved template inputs for the template currently being filled. */
  inputs?: Record<string, unknown>
  /** Step-level bindings: templateKey → inputKey → expression or literal. */
  templateBindings?: TemplateBindingMap
  /** When true, media files in chat templates become inline previews. */
  embedMedia?: boolean
}

export type ExprResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string }

export const EXPRESSION_FUNCTION_DOCS: Array<{
  name: string
  insert: string
  hint: string
}> = [
  { name: 'parseJson', insert: '{{parseJson(vars.)}}', hint: 'Parse a JSON string into object/array' },
  { name: 'json', insert: '{{json(vars.)}}', hint: 'Alias of parseJson' },
  { name: 'string', insert: '{{string(vars.)}}', hint: 'Convert value to text' },
  { name: 'toJson', insert: '{{toJson(vars.)}}', hint: 'Serialize value to a JSON string' },
  { name: 'coalesce', insert: '{{coalesce(vars., vars.)}}', hint: 'First non-null/empty value' },
  { name: 'if', insert: '{{if(vars., trueValue, falseValue)}}', hint: 'Conditional value' },
  { name: 'empty', insert: '{{empty(vars.)}}', hint: 'True when null, "", or empty collection' },
  { name: 'length', insert: '{{length(vars.)}}', hint: 'String/array/object length' },
  { name: 'concat', insert: '{{concat(vars., vars.)}}', hint: 'Join values as text' },
  { name: 'contains', insert: '{{contains(vars., "needle")}}', hint: 'Substring or array membership' },
  { name: 'startsWith', insert: '{{startsWith(vars., "prefix")}}', hint: 'True when text starts with prefix' },
  { name: 'endsWith', insert: '{{endsWith(vars., "suffix")}}', hint: 'True when text ends with suffix' },
  { name: 'toLower', insert: '{{toLower(vars.)}}', hint: 'Lowercase text' },
  { name: 'toUpper', insert: '{{toUpper(vars.)}}', hint: 'Uppercase text' },
  { name: 'trim', insert: '{{trim(vars.)}}', hint: 'Strip leading/trailing whitespace' },
  { name: 'replace', insert: '{{replace(vars., "find", "with")}}', hint: 'Replace all occurrences' },
  { name: 'split', insert: '{{split(vars., ",")}}', hint: 'Split text into an array' },
  { name: 'join', insert: '{{join(vars., ",")}}', hint: 'Join array items into text' },
  { name: 'slice', insert: '{{slice(vars., 0, 5)}}', hint: 'Slice a string or array' },
  { name: 'padStart', insert: '{{padStart(vars., 4, "0")}}', hint: 'Pad text at the start' },
  { name: 'padEnd', insert: '{{padEnd(vars., 4, " ")}}', hint: 'Pad text at the end' },
  { name: 'capitalize', insert: '{{capitalize(vars.)}}', hint: 'Capitalize first letter' },
  { name: 'titleCase', insert: '{{titleCase(vars.)}}', hint: 'Title Case Each Word' },
  { name: 'slugify', insert: '{{slugify(vars.)}}', hint: 'URL-safe slug from text' },
  { name: 'first', insert: '{{first(vars.)}}', hint: 'First item of an array' },
  { name: 'last', insert: '{{last(vars.)}}', hint: 'Last item of an array' },
  { name: 'at', insert: '{{at(vars., 0)}}', hint: 'Item at index (supports negative)' },
  { name: 'reverse', insert: '{{reverse(vars.)}}', hint: 'Reverse a string or array' },
  { name: 'unique', insert: '{{unique(vars.)}}', hint: 'Deduplicate array items' },
  { name: 'keys', insert: '{{keys(vars.)}}', hint: 'Object keys as an array' },
  { name: 'values', insert: '{{values(vars.)}}', hint: 'Object values as an array' },
  { name: 'int', insert: '{{int(vars.)}}', hint: 'Parse integer' },
  { name: 'float', insert: '{{float(vars.)}}', hint: 'Parse number' },
  { name: 'bool', insert: '{{bool(vars.)}}', hint: 'Coerce to boolean' },
  { name: 'equals', insert: '{{equals(vars., vars.)}}', hint: 'Equality check' },
  { name: 'round', insert: '{{round(vars., 2)}}', hint: 'Round a number (optional decimals)' },
  { name: 'floor', insert: '{{floor(vars.)}}', hint: 'Round down' },
  { name: 'ceil', insert: '{{ceil(vars.)}}', hint: 'Round up' },
  { name: 'abs', insert: '{{abs(vars.)}}', hint: 'Absolute value' },
  { name: 'min', insert: '{{min(vars., vars.)}}', hint: 'Smallest number' },
  { name: 'max', insert: '{{max(vars., vars.)}}', hint: 'Largest number' },
  { name: 'clamp', insert: '{{clamp(vars., 0, 100)}}', hint: 'Clamp number between min and max' },
  { name: 'utcNow', insert: '{{utcNow()}}', hint: 'Current UTC ISO timestamp' },
  { name: 'prettify', insert: '{{prettify(vars.)}}', hint: 'Human-friendly date/time' },
  { name: 'formatDate', insert: '{{formatDate(vars., "MMM d, yyyy")}}', hint: 'Format a date with a pattern' },
  { name: 'dateAdd', insert: '{{dateAdd(vars., 1, "days")}}', hint: 'Add time to a date' },
  { name: 'dateDiff', insert: '{{dateDiff(vars., vars., "days")}}', hint: 'Difference between dates' },
  { name: 'renderFile', insert: '{{renderFile(media.)}}', hint: 'Show an image/file preview in chat' },
]

type TokKind =
  | 'number'
  | 'string'
  | 'ident'
  | 'true'
  | 'false'
  | 'null'
  | 'lparen'
  | 'rparen'
  | 'lbrack'
  | 'rbrack'
  | 'dot'
  | 'comma'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'percent'
  | 'eq'
  | 'neq'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  | 'and'
  | 'or'
  | 'not'
  | 'qmark'
  | 'colon'
  | 'brace'
  | 'eof'

type Token = { kind: TokKind; value: string; index: number }

function isIdentStart(ch: string) {
  return /[A-Za-z_]/.test(ch)
}
function isIdent(ch: string) {
  return /[A-Za-z0-9_]/.test(ch)
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const push = (kind: TokKind, value: string, index = i) => tokens.push({ kind, value, index })

  while (i < source.length) {
    const ch = source[i]!

    if (/\s/.test(ch)) {
      i += 1
      continue
    }

    if (ch === '{' && source[i + 1] === '{') {
      const start = i
      i += 2
      let depth = 1
      let end = -1
      while (i < source.length) {
        if (source[i] === '{' && source[i + 1] === '{') {
          depth += 1
          i += 2
          continue
        }
        if (source[i] === '}' && source[i + 1] === '}') {
          depth -= 1
          if (depth === 0) {
            end = i
            break
          }
          i += 2
          continue
        }
        i += 1
      }
      if (end < 0) throw new Error('Unclosed {{ reference')
      const inner = source.slice(start + 2, end).trim()
      push('brace', inner, start)
      i = end + 2
      continue
    }

    if (ch === '"' || ch === "'") {
      const quote = ch
      const start = i
      i += 1
      let out = ''
      while (i < source.length) {
        const c = source[i]!
        if (c === '\\' && i + 1 < source.length) {
          const n = source[i + 1]!
          out += n === 'n' ? '\n' : n === 't' ? '\t' : n
          i += 2
          continue
        }
        if (c === quote) {
          i += 1
          push('string', out, start)
          break
        }
        out += c
        i += 1
      }
      if (tokens[tokens.length - 1]?.kind !== 'string' || tokens[tokens.length - 1]?.index !== start) {
        throw new Error('Unclosed string literal')
      }
      continue
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const start = i
      let raw = ''
      while (i < source.length && /[0-9.]/.test(source[i]!)) {
        raw += source[i]
        i += 1
      }
      push('number', raw, start)
      continue
    }

    if (isIdentStart(ch)) {
      const start = i
      let raw = ''
      while (i < source.length && isIdent(source[i]!)) {
        raw += source[i]
        i += 1
      }
      const lower = raw.toLowerCase()
      if (lower === 'true') push('true', raw, start)
      else if (lower === 'false') push('false', raw, start)
      else if (lower === 'null') push('null', raw, start)
      else if (lower === 'and') push('and', raw, start)
      else if (lower === 'or') push('or', raw, start)
      else if (lower === 'not') push('not', raw, start)
      else push('ident', raw, start)
      continue
    }

    const two = source.slice(i, i + 2)
    if (two === '==') {
      push('eq', two, i)
      i += 2
      continue
    }
    if (ch === '=') {
      push('eq', ch, i)
      i += 1
      continue
    }
    if (two === '!=' || two === '<>') {
      push('neq', two, i)
      i += 2
      continue
    }
    if (two === '<=') {
      push('lte', two, i)
      i += 2
      continue
    }
    if (two === '>=') {
      push('gte', two, i)
      i += 2
      continue
    }
    if (two === '&&') {
      push('and', two, i)
      i += 2
      continue
    }
    if (two === '||') {
      push('or', two, i)
      i += 2
      continue
    }

    const map: Record<string, TokKind> = {
      '(': 'lparen',
      ')': 'rparen',
      '[': 'lbrack',
      ']': 'rbrack',
      '.': 'dot',
      ',': 'comma',
      '+': 'plus',
      '-': 'minus',
      '*': 'star',
      '/': 'slash',
      '%': 'percent',
      '<': 'lt',
      '>': 'gt',
      '!': 'not',
      '?': 'qmark',
      ':': 'colon',
    }
    const kind = map[ch]
    if (!kind) throw new Error(`Unexpected character "${ch}" at ${i}`)
    push(kind, ch, i)
    i += 1
  }

  push('eof', '', i)
  return tokens
}

function getByPath(value: unknown, path: string[]): unknown {
  let cur = value
  for (const part of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as object).length === 0
  return false
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  return value != null
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (value == null || value === '') return null
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function prettifyDate(value: unknown, styleOrPattern?: unknown): string | null {
  const d = toDate(value)
  if (!d) return null
  const style = String(styleOrPattern ?? 'datetime').trim().toLowerCase()
  switch (style) {
    case '':
    case 'datetime':
    case 'pretty':
    case 'prettify':
      return format(d, 'MMM d, yyyy · h:mm a')
    case 'date':
      return format(d, 'MMM d, yyyy')
    case 'time':
      return format(d, 'h:mm a')
    case 'relative':
    case 'ago':
      return formatDistanceToNow(d, { addSuffix: true })
    case 'iso':
      return d.toISOString()
    default:
      // Treat as a date-fns format pattern (preserve original casing)
      try {
        return format(d, String(styleOrPattern))
      } catch {
        throw new Error(`prettify: invalid format "${String(styleOrPattern)}"`)
      }
  }
}

function dateAdd(value: unknown, amountRaw: unknown, unitRaw: unknown): string | null {
  const d = toDate(value)
  const amount = asFiniteNumber(amountRaw)
  if (!d || amount == null) return null
  const unit = String(unitRaw ?? 'days').toLowerCase()
  let next: Date
  switch (unit) {
    case 'ms':
    case 'millisecond':
    case 'milliseconds':
      next = new Date(d.getTime() + amount)
      break
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      next = addSeconds(d, amount)
      break
    case 'm':
    case 'min':
    case 'minute':
    case 'minutes':
      next = addMinutes(d, amount)
      break
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      next = addHours(d, amount)
      break
    case 'd':
    case 'day':
    case 'days':
      next = addDays(d, amount)
      break
    case 'w':
    case 'week':
    case 'weeks':
      next = addWeeks(d, amount)
      break
    case 'month':
    case 'months':
      next = addMonths(d, amount)
      break
    case 'y':
    case 'year':
    case 'years':
      next = addYears(d, amount)
      break
    default:
      throw new Error(`dateAdd: unknown unit "${unitRaw}"`)
  }
  return next.toISOString()
}

function dateDiff(aRaw: unknown, bRaw: unknown, unitRaw: unknown): number | null {
  const a = toDate(aRaw)
  const b = toDate(bRaw)
  if (!a || !b) return null
  const unit = String(unitRaw ?? 'days').toLowerCase()
  switch (unit) {
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return differenceInSeconds(a, b)
    case 'm':
    case 'min':
    case 'minute':
    case 'minutes':
      return differenceInMinutes(a, b)
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return differenceInHours(a, b)
    case 'd':
    case 'day':
    case 'days':
      return differenceInDays(a, b)
    default:
      throw new Error(`dateDiff: unknown unit "${unitRaw}"`)
  }
}

function slugify(value: unknown): string {
  return asString(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCase(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .replace(/(^|[^\p{L}\p{N}]+)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

function callFunction(name: string, args: unknown[]): unknown {
  const n = name.toLowerCase()
  switch (n) {
    case 'parsejson':
    case 'json': {
      const left = args[0]
      if (left !== null && typeof left === 'object') return left
      try {
        return JSON.parse(String(left ?? ''))
      } catch {
        throw new Error('parseJson: invalid JSON')
      }
    }
    case 'stringify':
    case 'tojson':
      return typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0] ?? null)
    case 'string':
    case 'tostring':
      return asString(args[0])
    case 'coalesce':
    case 'default':
      for (const a of args) {
        if (!isEmpty(a)) return a
      }
      return args[args.length - 1] ?? null
    case 'if':
      return truthy(args[0]) ? args[1] : args[2]
    case 'empty':
    case 'isblank':
      return isEmpty(args[0])
    case 'length':
    case 'len': {
      const v = args[0]
      if (Array.isArray(v)) return v.length
      if (v && typeof v === 'object') return Object.keys(v as object).length
      return String(v ?? '').length
    }
    case 'concat':
      return args.map(asString).join('')
    case 'contains':
    case 'includes': {
      const hay = args[0]
      const needle = args[1]
      if (Array.isArray(hay)) return hay.some((x) => String(x) === String(needle))
      return asString(hay).includes(asString(needle))
    }
    case 'startswith':
      return asString(args[0]).startsWith(asString(args[1]))
    case 'endswith':
      return asString(args[0]).endsWith(asString(args[1]))
    case 'tolower':
    case 'lowercase':
      return asString(args[0]).toLowerCase()
    case 'toupper':
    case 'uppercase':
      return asString(args[0]).toUpperCase()
    case 'trim':
      return asString(args[0]).trim()
    case 'replace':
      return asString(args[0]).split(asString(args[1])).join(asString(args[2] ?? ''))
    case 'split':
      return asString(args[0]).split(asString(args[1] ?? ''))
    case 'join': {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]]
      return arr.map(asString).join(asString(args[1] ?? ''))
    }
    case 'slice': {
      const start = asFiniteNumber(args[1]) ?? 0
      const end = args.length >= 3 ? asFiniteNumber(args[2]) : undefined
      if (Array.isArray(args[0])) {
        return end == null ? args[0].slice(start) : args[0].slice(start, end)
      }
      const text = asString(args[0])
      return end == null ? text.slice(start) : text.slice(start, end)
    }
    case 'padstart': {
      const len = asFiniteNumber(args[1]) ?? 0
      return asString(args[0]).padStart(Math.max(0, Math.floor(len)), asString(args[2] ?? ' '))
    }
    case 'padend': {
      const len = asFiniteNumber(args[1]) ?? 0
      return asString(args[0]).padEnd(Math.max(0, Math.floor(len)), asString(args[2] ?? ' '))
    }
    case 'capitalize': {
      const s = asString(args[0])
      if (!s) return s
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
    case 'titlecase':
    case 'title':
      return titleCase(args[0])
    case 'slugify':
    case 'slug':
      return slugify(args[0])
    case 'first':
      return Array.isArray(args[0]) ? args[0][0] : args[0]
    case 'last':
      return Array.isArray(args[0]) ? args[0][args[0].length - 1] : args[0]
    case 'at':
    case 'nth': {
      const idx = asFiniteNumber(args[1])
      if (idx == null) return null
      const i = Math.trunc(idx)
      if (Array.isArray(args[0])) {
        const arr = args[0]
        return arr[i < 0 ? arr.length + i : i]
      }
      const text = asString(args[0])
      const ch = text[i < 0 ? text.length + i : i]
      return ch ?? null
    }
    case 'reverse': {
      if (Array.isArray(args[0])) return [...args[0]].reverse()
      return asString(args[0]).split('').reverse().join('')
    }
    case 'unique': {
      const arr = Array.isArray(args[0]) ? args[0] : [args[0]]
      const seen = new Set<string>()
      const out: unknown[] = []
      for (const item of arr) {
        const key = typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
          ? String(item)
          : JSON.stringify(item)
        if (seen.has(key)) continue
        seen.add(key)
        out.push(item)
      }
      return out
    }
    case 'keys':
      return args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? Object.keys(args[0] as object)
        : []
    case 'values':
      return args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])
        ? Object.values(args[0] as object)
        : []
    case 'int':
    case 'integer': {
      const n = parseInt(String(args[0] ?? ''), 10)
      return Number.isNaN(n) ? null : n
    }
    case 'float':
    case 'number':
    case 'decimal': {
      const n = Number(args[0])
      return Number.isNaN(n) ? null : n
    }
    case 'bool':
    case 'boolean':
      return truthy(args[0])
    case 'equals':
    case 'equal':
      return String(args[0]) === String(args[1])
    case 'add':
      return Number(args[0]) + Number(args[1])
    case 'sub':
    case 'subtract':
      return Number(args[0]) - Number(args[1])
    case 'mul':
    case 'multiply':
      return Number(args[0]) * Number(args[1])
    case 'div':
    case 'divide':
      return Number(args[1]) === 0 ? null : Number(args[0]) / Number(args[1])
    case 'mod':
    case 'modulo': {
      const b = Number(args[1])
      return b === 0 ? null : Number(args[0]) % b
    }
    case 'round': {
      const n = asFiniteNumber(args[0])
      if (n == null) return null
      const decimals = asFiniteNumber(args[1]) ?? 0
      const f = 10 ** Math.max(0, Math.floor(decimals))
      return Math.round(n * f) / f
    }
    case 'floor': {
      const n = asFiniteNumber(args[0])
      return n == null ? null : Math.floor(n)
    }
    case 'ceil': {
      const n = asFiniteNumber(args[0])
      return n == null ? null : Math.ceil(n)
    }
    case 'abs': {
      const n = asFiniteNumber(args[0])
      return n == null ? null : Math.abs(n)
    }
    case 'min': {
      const nums = args.map(asFiniteNumber).filter((x): x is number => x != null)
      return nums.length ? Math.min(...nums) : null
    }
    case 'max': {
      const nums = args.map(asFiniteNumber).filter((x): x is number => x != null)
      return nums.length ? Math.max(...nums) : null
    }
    case 'clamp': {
      const n = asFiniteNumber(args[0])
      const lo = asFiniteNumber(args[1])
      const hi = asFiniteNumber(args[2])
      if (n == null || lo == null || hi == null) return null
      return Math.min(Math.max(n, Math.min(lo, hi)), Math.max(lo, hi))
    }
    case 'utcnow':
    case 'now':
      return new Date().toISOString()
    case 'prettify':
    case 'prettyfy':
    case 'preetyfy':
    case 'prettytime':
    case 'prettydate':
      return prettifyDate(args[0], args[1])
    case 'formatdate':
    case 'dateformat': {
      const d = toDate(args[0])
      if (!d) return null
      const pattern = String(args[1] ?? 'MMM d, yyyy')
      try {
        return format(d, pattern)
      } catch {
        throw new Error(`formatDate: invalid format "${pattern}"`)
      }
    }
    case 'dateadd':
    case 'adddate':
      return dateAdd(args[0], args[1], args[2])
    case 'datediff':
    case 'diffdate':
      return dateDiff(args[0], args[1], args[2])
    case 'not':
      return !truthy(args[0])
    case 'and':
      return args.every(truthy)
    case 'or':
      return args.some(truthy)
    case 'null':
      return null
    case 'renderfile':
    case 'render_file':
    case 'file':
      return renderFileValue(args[0])
    default:
      throw new Error(`Unknown function "${name}"`)
  }
}

class Parser {
  private i = 0
  private tokens: Token[]
  private ctx: ExprContext
  constructor(tokens: Token[], ctx: ExprContext) {
    this.tokens = tokens
    this.ctx = ctx
  }

  private peek(): Token {
    return this.tokens[this.i] ?? { kind: 'eof', value: '', index: -1 }
  }
  private take(): Token {
    const t = this.peek()
    this.i += 1
    return t
  }
  private expect(kind: TokKind): Token {
    const t = this.take()
    if (t.kind !== kind) throw new Error(`Expected ${kind}, got ${t.kind}`)
    return t
  }
  private match(...kinds: TokKind[]): Token | null {
    if (kinds.includes(this.peek().kind)) return this.take()
    return null
  }

  parse(): unknown {
    const value = this.parseExpr()
    if (this.peek().kind !== 'eof') {
      throw new Error(`Unexpected token "${this.peek().value}"`)
    }
    return value
  }

  private parseExpr(): unknown {
    return this.parseTernary()
  }

  private parseTernary(): unknown {
    const cond = this.parseOr()
    if (this.match('qmark')) {
      const a = this.parseExpr()
      this.expect('colon')
      const b = this.parseExpr()
      return truthy(cond) ? a : b
    }
    return cond
  }

  private parseOr(): unknown {
    let left = this.parseAnd()
    while (this.match('or')) {
      const right = this.parseAnd()
      left = truthy(left) || truthy(right)
    }
    return left
  }

  private parseAnd(): unknown {
    let left = this.parseEquality()
    while (this.match('and')) {
      const right = this.parseEquality()
      left = truthy(left) && truthy(right)
    }
    return left
  }

  private parseEquality(): unknown {
    let left = this.parseCompare()
    for (;;) {
      if (this.match('eq')) left = String(left) === String(this.parseCompare())
      else if (this.match('neq')) left = String(left) !== String(this.parseCompare())
      else break
    }
    return left
  }

  private parseCompare(): unknown {
    let left = this.parseAdd()
    for (;;) {
      if (this.match('lt')) left = Number(left) < Number(this.parseAdd())
      else if (this.match('gt')) left = Number(left) > Number(this.parseAdd())
      else if (this.match('lte')) left = Number(left) <= Number(this.parseAdd())
      else if (this.match('gte')) left = Number(left) >= Number(this.parseAdd())
      else break
    }
    return left
  }

  private parseAdd(): unknown {
    let left = this.parseMul()
    for (;;) {
      if (this.match('plus')) {
        const right = this.parseMul()
        if (typeof left === 'string' || typeof right === 'string') left = asString(left) + asString(right)
        else left = Number(left) + Number(right)
      } else if (this.match('minus')) {
        left = Number(left) - Number(this.parseMul())
      } else break
    }
    return left
  }

  private parseMul(): unknown {
    let left = this.parseUnary()
    for (;;) {
      if (this.match('star')) left = Number(left) * Number(this.parseUnary())
      else if (this.match('slash')) {
        const right = Number(this.parseUnary())
        left = right === 0 ? null : Number(left) / right
      } else if (this.match('percent')) left = Number(left) % Number(this.parseUnary())
      else break
    }
    return left
  }

  private parseUnary(): unknown {
    if (this.match('not')) return !truthy(this.parseUnary())
    if (this.match('minus')) return -Number(this.parseUnary())
    if (this.match('plus')) return Number(this.parseUnary())
    return this.parsePostfix()
  }

  private parsePostfix(): unknown {
    let value = this.parsePrimary()
    for (;;) {
      if (this.match('dot')) {
        const ident = this.expect('ident').value
        value = getByPath(value, [ident])
      } else if (this.match('lbrack')) {
        const idx = this.parseExpr()
        this.expect('rbrack')
        if (Array.isArray(value)) {
          const n = Number(idx)
          value = Number.isInteger(n) ? value[n] : undefined
        } else if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[String(idx)]
        } else {
          value = undefined
        }
      } else break
    }
    return value
  }

  private parsePrimary(): unknown {
    const t = this.peek()

    if (t.kind === 'number') {
      this.take()
      return Number(t.value)
    }
    if (t.kind === 'string') {
      this.take()
      return t.value
    }
    if (t.kind === 'true') {
      this.take()
      return true
    }
    if (t.kind === 'false') {
      this.take()
      return false
    }
    if (t.kind === 'null') {
      this.take()
      return null
    }
    if (t.kind === 'brace') {
      this.take()
      // Nested {{ expr }} — evaluate as its own expression (usually a path)
      return evaluateExpression(t.value, this.ctx)
    }
    if (t.kind === 'lparen') {
      this.take()
      const v = this.parseExpr()
      this.expect('rparen')
      return v
    }
    if (t.kind === 'ident') {
      const name = this.take().value
      if (this.peek().kind === 'lparen') {
        this.take()
        const args: unknown[] = []
        if (this.peek().kind !== 'rparen') {
          args.push(this.parseExpr())
          while (this.match('comma')) args.push(this.parseExpr())
        }
        this.expect('rparen')
        return callFunction(name, args)
      }
      // Path: vars.foo.bar / steps.key.path / media.logo_png
      const path = [name]
      while (this.match('dot')) {
        path.push(this.expect('ident').value)
      }
      return resolvePath(path, this.ctx)
    }
    throw new Error(`Unexpected token "${t.value || t.kind}"`)
  }
}

function resolvePath(parts: string[], ctx: ExprContext): unknown {
  if (parts.length < 2) return undefined
  const [kind, name, ...rest] = parts
  if (kind === 'inputs') {
    const value = ctx.inputs?.[name!]
    return rest.length ? getByPath(value, rest) : value
  }
  const root =
    kind === 'vars'
      ? ctx.vars[name!]
      : kind === 'steps'
        ? ctx.steps[name!]
        : kind === 'media'
          ? ctx.media?.[name!]
          : kind === 'templates'
            ? ctx.templates?.[name!]
            : undefined
  if (kind === 'templates' && name && root && typeof root === 'object' && !Array.isArray(root)) {
    const tpl = root as Record<string, unknown>
    const fillCtx = ctxForTemplate(ctx, name)
    const field = rest[0]
    if (isReceiptTemplate(tpl) && (field === 'text' || field === 'html')) {
      const filled = filledReceiptText(tpl, fillCtx, name)
      const value = field === 'html' ? renderReceiptHtml(filled) : filled
      return rest.length > 1 ? getByPath(value, rest.slice(1)) : value
    }
    if (tpl.kind !== 'cart' && field && COPY_STRING_FIELDS.has(field) && typeof tpl[field] === 'string') {
      const filled = filledCopyString(String(tpl[field]), fillCtx, `${name}.${field}`)
      return rest.length > 1 ? getByPath(filled, rest.slice(1)) : filled
    }
  }
  return rest.length ? getByPath(root, rest) : root
}

const COPY_STRING_FIELDS = new Set([
  'text',
  'html',
  'subject',
  'body',
  'title',
  'intro',
  'footer',
  'filename',
  'note',
])

function ctxForTemplate(ctx: ExprContext, templateKey: string): ExprContext {
  const bindings = ctx.templateBindings?.[templateKey] ?? parseTemplateBindingMap(undefined)
  const inputs: Record<string, unknown> = { ...(ctx.inputs ?? {}) }
  const bindCtx: ExprContext = { ...ctx, inputs }
  for (const [key, raw] of Object.entries(bindings)) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    inputs[key] = resolveExpressionValue(trimmed, bindCtx)
  }
  return { ...ctx, inputs }
}

function isReceiptTemplate(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (value as { kind?: unknown }).kind === 'receipt'
}

const receiptFillGuard = new Set<string>()
const copyFillGuard = new Set<string>()

function filledCopyString(raw: string, ctx: ExprContext, guardKey: string): string {
  if (copyFillGuard.has(guardKey)) return raw
  copyFillGuard.add(guardKey)
  try {
    return interpolateTemplate(raw, ctx)
  } finally {
    copyFillGuard.delete(guardKey)
  }
}

function filledReceiptText(tpl: Record<string, unknown>, ctx: ExprContext, templateKey: string): string {
  if (receiptFillGuard.has(templateKey)) {
    return String(tpl.text ?? '')
  }
  receiptFillGuard.add(templateKey)
  try {
    const content: ReceiptContent = {
      title: interpolateTemplate(String(tpl.title ?? ''), ctx),
      intro: interpolateTemplate(String(tpl.intro ?? ''), ctx),
      footer: interpolateTemplate(String(tpl.footer ?? ''), ctx),
      inputs: Array.isArray(tpl.inputs) ? (tpl.inputs as ReceiptContent['inputs']) : [],
    }
    return renderReceiptFromCart(content, findCartInVars(ctx.vars), findPaymentInVars(ctx.vars, ctx.steps))
  } finally {
    receiptFillGuard.delete(templateKey)
  }
}

/** True when the field is likely a whole expression rather than prose + interpolations. */
export function looksLikeExpression(source: string): boolean {
  const t = source.trim()
  if (!t) return false
  if (/^\{\{[\s\S]*\}\}$/.test(t)) return true
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(t)) return true
  if (/^(vars|steps|media|templates|inputs)\./.test(t)) return true
  if (/^["'\d\-!(]/.test(t) && /[+\-*/%<>=!&|?]/.test(t)) return true
  return false
}

export function evaluateExpression(source: string, ctx: ExprContext): unknown {
  const trimmed = source.trim()
  if (!trimmed) return ''
  const tokens = tokenize(trimmed)
  return new Parser(tokens, ctx).parse()
}

export function tryEvaluateExpression(source: string, ctx: ExprContext): ExprResult {
  try {
    return { ok: true, value: evaluateExpression(source, ctx) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const documentFillGuard = new Set<string>()

function formatDocumentForText(value: unknown, ctx: ExprContext): string | null {
  if (!isDocumentExprValue(value)) return null
  const rec = value as Record<string, unknown>
  const key = typeof rec.key === 'string' ? rec.key : ''
  if (key && documentFillGuard.has(key)) {
    return typeof rec.filename === 'string' && rec.filename ? rec.filename : 'document'
  }
  if (key) documentFillGuard.add(key)
  try {
    const content = documentContentFromExpr(value)
    if (!content) return null
    const fillCtx = key ? ctxForTemplate(ctx, key) : ctx
    const filled = fillDocumentSnapshot(
      content,
      (source) => interpolateTemplate(source, fillCtx),
      (source) => resolveExpressionValue(source, fillCtx),
      ctx.vars,
    )
    if (ctx.embedMedia) return encodeDocumentEmbed(filled)
    return filled.filename
  } finally {
    if (key) documentFillGuard.delete(key)
  }
}

function formatForText(value: unknown, ctx: ExprContext): string {
  const document = formatDocumentForText(value, ctx)
  if (document !== null) return document
  const embedded = formatMediaForText(value, ctx.embedMedia === true)
  if (embedded !== null) return embedded
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Replace `{{ ... }}` blocks; each block is a full expression.
 * Also used for plain refs: `{{vars.name}}`.
 */
export function interpolateTemplate(template: string, ctx: ExprContext): string {
  return template.replace(/\{\{([\s\S]*?)\}\}/g, (_, raw: string) => {
    const result = tryEvaluateExpression(raw.trim(), ctx)
    if (!result.ok) return `{{${raw}}}`
    return formatForText(result.value, ctx)
  })
}

/**
 * Resolve a config field that may be a sole expression, sole ref, literal, or mixed template.
 */
export function resolveExpressionValue(raw: string, ctx: ExprContext): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (looksLikeExpression(trimmed)) {
    const result = tryEvaluateExpression(trimmed, ctx)
    if (result.ok) return result.value
  }

  // Sole {{expr}} already covered by looksLikeExpression; keep literal helpers for non-expr text
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed !== '' && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

  return interpolateTemplate(raw, ctx)
}

/** Collect `vars.name` / `steps.key` path heads for validation. */
export function collectPathRefs(source: string): string[] {
  const refs: string[] = []
  const seen = new Set<string>()

  const push = (ref: string) => {
    const r = ref.trim()
    if (!r || seen.has(r)) return
    seen.add(r)
    refs.push(r)
  }

  // {{ ... }} inners — take paths from expression, or whole if simple path-only
  const braceRe = /\{\{([\s\S]*?)\}\}/g
  let m: RegExpExecArray | null
  while ((m = braceRe.exec(source)) !== null) {
    const inner = m[1]!.trim()
    const fromInner = scanPathLiterals(inner)
    if (fromInner.length) fromInner.forEach(push)
    else push(inner)
  }

  // Bare expression fields without braces still reference vars./steps./media.
  const withoutBraces = source.replace(/\{\{[\s\S]*?\}\}/g, ' ')
  if (looksLikeExpression(source.trim()) || /(?:^|[^.\w])(vars|steps|media|templates|inputs)\./.test(withoutBraces)) {
    scanPathLiterals(withoutBraces).forEach(push)
  }

  return refs
}

function scanPathLiterals(source: string): string[] {
  const refs: string[] = []
  // Strip string literals so we don't pick paths inside quotes
  const scrubbed = source.replace(/(['"])(?:\\.|(?!\1).)*\1/g, '""')
  const re = /\b(vars|steps|media|templates|inputs)\.[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(scrubbed)) !== null) {
    refs.push(m[0])
  }
  return refs
}

/** Shared parseJson helper for the Operation step (handles already-parsed objects). */
export function parseJsonValue(left: unknown): { ok: true; value: unknown } | { ok: false; value: null; error: string } {
  if (left !== null && typeof left === 'object') return { ok: true, value: left }
  try {
    return { ok: true, value: JSON.parse(String(left ?? '')) }
  } catch (e) {
    return {
      ok: false,
      value: null,
      error: e instanceof Error ? e.message : 'Invalid JSON',
    }
  }
}
