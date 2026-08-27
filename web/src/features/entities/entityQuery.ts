import type { EntityRecordView } from '@/features/entities/entityApi'

export type EntityFilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists'

export type EntityFilterClause = {
  attribute: string
  operator: EntityFilterOperator
  value: string
}

export type EntityFilters = {
  logic: 'and' | 'or'
  clauses: EntityFilterClause[]
}

export function compareEntityValues(left: unknown, right: unknown, operator: EntityFilterOperator): boolean {
  switch (operator) {
    case 'eq':
      return String(left ?? '') === String(right ?? '')
    case 'neq':
      return String(left ?? '') !== String(right ?? '')
    case 'gt':
      return Number(left) > Number(right)
    case 'gte':
      return Number(left) >= Number(right)
    case 'lt':
      return Number(left) < Number(right)
    case 'lte':
      return Number(left) <= Number(right)
    case 'contains':
      return String(left ?? '').includes(String(right ?? ''))
    case 'exists':
      return left !== undefined && left !== null && left !== ''
    default:
      return false
  }
}

export function matchEntityFilterClause(
  record: EntityRecordView,
  clause: EntityFilterClause,
  resolvedValue: unknown,
): boolean {
  const attr = clause.attribute.trim()
  if (!attr) return true
  const left = record.values[attr]
  return compareEntityValues(left, resolvedValue, clause.operator)
}

/** Apply no-code query filters. Clauses with empty attribute are ignored. */
export function queryEntityRecords(
  records: EntityRecordView[],
  filters: EntityFilters | null | undefined,
  resolveValue: (raw: string) => unknown,
): EntityRecordView[] {
  const clauses = (filters?.clauses ?? []).filter((c) => c.attribute.trim())
  if (!clauses.length) return records
  const logic = filters?.logic === 'or' ? 'or' : 'and'

  return records.filter((record) => {
    const results = clauses.map((clause) => {
      const resolved =
        clause.operator === 'exists' ? undefined : resolveValue(String(clause.value ?? ''))
      return matchEntityFilterClause(record, clause, resolved)
    })
    return logic === 'or' ? results.some(Boolean) : results.every(Boolean)
  })
}

/** Build filters from legacy single attribute/equals fields when needed. */
export function coalesceEntityFilters(input: {
  filters?: EntityFilters | null
  filterAttribute?: string | null
  filterEquals?: string | null
}): EntityFilters {
  const clauses = (input.filters?.clauses ?? []).filter((c) => c.attribute.trim())
  if (clauses.length) {
    return {
      logic: input.filters?.logic === 'or' ? 'or' : 'and',
      clauses,
    }
  }
  const attr = String(input.filterAttribute ?? '').trim()
  if (!attr) return { logic: 'and', clauses: [] }
  return {
    logic: 'and',
    clauses: [
      {
        attribute: attr,
        operator: 'eq',
        value: String(input.filterEquals ?? ''),
      },
    ],
  }
}
