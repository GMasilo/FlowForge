import type { VariableType } from '@/shared/types/database'
import { isBlankEntityValue } from '@/features/entities/entityValueValidation'

/** Forced primary-key attribute key on every entity. */
export const ENTITY_PRIMARY_KEY = 'id'

export type EntityPrimaryKeySpec = {
  key: typeof ENTITY_PRIMARY_KEY
  label: string
  value_type: VariableType
  required: true
  is_identifier: true
  is_unique: true
  sort_order: number
}

export function isEntityPrimaryKey(key: string): boolean {
  return key.trim() === ENTITY_PRIMARY_KEY
}

export function entityPrimaryKeyAttribute(sortOrder = 0): EntityPrimaryKeySpec {
  return {
    key: ENTITY_PRIMARY_KEY,
    label: 'Id',
    value_type: 'string',
    required: true,
    is_identifier: true,
    is_unique: true,
    sort_order: sortOrder,
  }
}

/** Ensure `values.id` is a non-empty string (UUID when missing). */
export function ensurePrimaryKeyValue(
  values: Record<string, unknown>,
  options?: { existingId?: string },
): Record<string, unknown> {
  const next = { ...values }
  const existing = options?.existingId
  if (existing !== undefined && !isBlankEntityValue(existing)) {
    next[ENTITY_PRIMARY_KEY] = String(existing)
    return next
  }
  const current = next[ENTITY_PRIMARY_KEY]
  if (!isBlankEntityValue(current)) {
    next[ENTITY_PRIMARY_KEY] = String(current)
    return next
  }
  next[ENTITY_PRIMARY_KEY] = crypto.randomUUID()
  return next
}

/** Prepend / normalize a primary-key column for Excel import. */
export function ensurePrimaryKeyColumn<T extends { key: string; label: string; value_type: VariableType }>(
  columns: T[],
): T[] {
  const pk = entityPrimaryKeyAttribute(0)
  const without = columns.filter((c) => !isEntityPrimaryKey(c.key))
  const existing = columns.find((c) => isEntityPrimaryKey(c.key))
  const idCol = {
    ...(existing ?? ({} as T)),
    key: pk.key,
    label: existing?.label?.trim() || pk.label,
    value_type: 'string' as VariableType,
  } as T
  return [idCol, ...without]
}
