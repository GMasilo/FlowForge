import type { VariableType } from '@/shared/types/database'

export const ENTITY_FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists'] as const
export type EntityFilterOperator = (typeof ENTITY_FILTER_OPERATORS)[number]

export type EntityFilterLogic = 'and' | 'or'

export type EntityFilterClause = {
  attribute: string
  operator: EntityFilterOperator
  /** Literal or template string; unused for `exists`. */
  value: string
}

export type EntityQuerySpec = {
  filters: EntityFilterClause[]
  filterLogic: EntityFilterLogic
  sortAttribute: string
  sortDirection: 'asc' | 'desc'
  /** Max rows after filter/sort. Empty / invalid = no limit. */
  limit: string
}

export const ENTITY_FILTER_OPERATOR_OPTIONS: Array<{
  value: EntityFilterOperator
  label: string
  hint: string
  needsValue: boolean
}> = [
  { value: 'eq', label: 'Equals', hint: 'Attribute equals the value', needsValue: true },
  { value: 'neq', label: 'Does not equal', hint: 'Attribute differs from the value', needsValue: true },
  { value: 'gt', label: 'Greater than', hint: 'Numeric / date comparison', needsValue: true },
  { value: 'gte', label: 'Greater or equal', hint: 'Numeric / date comparison', needsValue: true },
  { value: 'lt', label: 'Less than', hint: 'Numeric / date comparison', needsValue: true },
  { value: 'lte', label: 'Less or equal', hint: 'Numeric / date comparison', needsValue: true },
  { value: 'contains', label: 'Contains', hint: 'Text includes the value', needsValue: true },
  { value: 'exists', label: 'Has a value', hint: 'Attribute is present and not empty', needsValue: false },
]

export function emptyEntityFilterClause(): EntityFilterClause {
  return { attribute: '', operator: 'eq', value: '' }
}

export function emptyEntityQuerySpec(): EntityQuerySpec {
  return {
    filters: [],
    filterLogic: 'and',
    sortAttribute: '',
    sortDirection: 'asc',
    limit: '',
  }
}

/** Merge legacy filterAttribute/filterEquals into a query spec. */
export function normalizeEntityQuery(input: {
  filters?: unknown
  filterLogic?: unknown
  sortAttribute?: unknown
  sortDirection?: unknown
  limit?: unknown
  filterAttribute?: unknown
  filterEquals?: unknown
}): EntityQuerySpec {
  const filtersRaw = Array.isArray(input.filters) ? input.filters : []
  let filters: EntityFilterClause[] = filtersRaw
    .map((raw) => normalizeClause(raw))
    .filter((c): c is EntityFilterClause => !!c)

  const legacyAttr = String(input.filterAttribute ?? '').trim()
  if (!filters.length && legacyAttr) {
    filters = [
      {
        attribute: legacyAttr,
        operator: 'eq',
        value: String(input.filterEquals ?? ''),
      },
    ]
  }

  const logic = input.filterLogic === 'or' ? 'or' : 'and'
  const sortDirection = input.sortDirection === 'desc' ? 'desc' : 'asc'
  return {
    filters,
    filterLogic: logic,
    sortAttribute: String(input.sortAttribute ?? '').trim(),
    sortDirection,
    limit: String(input.limit ?? '').trim(),
  }
}

function normalizeClause(raw: unknown): EntityFilterClause | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const attribute = String(row.attribute ?? '').trim()
  const operatorRaw = String(row.operator ?? 'eq')
  const operator = (ENTITY_FILTER_OPERATORS as readonly string[]).includes(operatorRaw)
    ? (operatorRaw as EntityFilterOperator)
    : 'eq'
  return {
    attribute,
    operator,
    value: String(row.value ?? ''),
  }
}

export function compareEntityValue(left: unknown, right: unknown, operator: EntityFilterOperator): boolean {
  switch (operator) {
    case 'eq':
      return stringifyComparable(left) === stringifyComparable(right)
    case 'neq':
      return stringifyComparable(left) !== stringifyComparable(right)
    case 'gt':
      return toComparableNumber(left) > toComparableNumber(right)
    case 'gte':
      return toComparableNumber(left) >= toComparableNumber(right)
    case 'lt':
      return toComparableNumber(left) < toComparableNumber(right)
    case 'lte':
      return toComparableNumber(left) <= toComparableNumber(right)
    case 'contains':
      return stringifyComparable(left).toLowerCase().includes(stringifyComparable(right).toLowerCase())
    case 'exists':
      return left !== undefined && left !== null && !(typeof left === 'string' && left.trim() === '')
    default:
      return false
  }
}

function stringifyComparable(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toComparableNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const s = String(value ?? '').trim()
  if (!s) return Number.NaN
  // Dates as YYYY-MM-DD compare lexicographically via timestamp
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s.slice(0, 10))
    if (!Number.isNaN(t)) return t
  }
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : Number.NaN
}

export type EntityQueryRecord = {
  id: string
  values: Record<string, unknown>
}

function clauseMatches(
  record: EntityQueryRecord,
  clause: EntityFilterClause,
  resolvedValue: unknown,
): boolean {
  const attr = clause.attribute.trim()
  if (!attr) return true
  const left = record.values[attr]
  if (clause.operator === 'exists') return compareEntityValue(left, undefined, 'exists')
  return compareEntityValue(left, resolvedValue, clause.operator)
}

/**
 * Apply no-code query: filter → sort → limit.
 * `resolveValue` maps each clause value (templates already resolved for flow).
 */
export function queryEntityRecords<T extends EntityQueryRecord>(
  records: T[],
  spec: EntityQuerySpec,
  options?: {
    /** Per-clause resolved comparison value (defaults to clause.value). */
    resolveValue?: (clause: EntityFilterClause, index: number) => unknown
  },
): T[] {
  const active = spec.filters.filter((c) => c.attribute.trim())
  let rows = records
  if (active.length) {
    rows = records.filter((record) => {
      const results = active.map((clause, index) => {
        const resolved =
          options?.resolveValue?.(clause, index) ??
          (clause.operator === 'exists' ? undefined : clause.value)
        return clauseMatches(record, clause, resolved)
      })
      return spec.filterLogic === 'or' ? results.some(Boolean) : results.every(Boolean)
    })
  }

  const sortKey = spec.sortAttribute.trim()
  if (sortKey) {
    const dir = spec.sortDirection === 'desc' ? -1 : 1
    rows = [...rows].sort((a, b) => {
      const av = a.values[sortKey]
      const bv = b.values[sortKey]
      const an = toComparableNumber(av)
      const bn = toComparableNumber(bv)
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return (an - bn) * dir
      const as = stringifyComparable(av)
      const bs = stringifyComparable(bv)
      if (as < bs) return -1 * dir
      if (as > bs) return 1 * dir
      return 0
    })
  }

  const limitN = Number(String(spec.limit ?? '').trim())
  if (Number.isFinite(limitN) && limitN > 0) {
    rows = rows.slice(0, Math.floor(limitN))
  }

  return rows
}

/** Hint text for attribute types in the builder. */
export function attributeTypeHint(valueType: VariableType | string | undefined): string {
  if (!valueType) return ''
  return String(valueType)
}
