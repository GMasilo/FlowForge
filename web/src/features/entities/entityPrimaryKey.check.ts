/**
 * Manual check: npx tsx --tsconfig tsconfig.app.json src/features/entities/entityPrimaryKey.check.ts
 */
import {
  ENTITY_PRIMARY_KEY,
  ensurePrimaryKeyColumn,
  ensurePrimaryKeyValue,
  entityPrimaryKeyAttribute,
  isEntityPrimaryKey,
} from '@/features/entities/entityPrimaryKey'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(ENTITY_PRIMARY_KEY === 'id', 'pk key')
assert(isEntityPrimaryKey('id'), 'is pk')
assert(!isEntityPrimaryKey('email'), 'not pk')

const spec = entityPrimaryKeyAttribute(-1)
assert(spec.required && spec.is_unique && spec.is_identifier && spec.value_type === 'string', 'pk flags')

const generated = ensurePrimaryKeyValue({ name: 'Ada' })
assert(typeof generated.id === 'string' && (generated.id as string).length > 10, 'auto id')
assert(generated.name === 'Ada', 'preserves fields')

const locked = ensurePrimaryKeyValue({ id: 'x', name: 'Ada' }, { existingId: 'locked' })
assert(locked.id === 'locked', 'existing id wins')

const cols = ensurePrimaryKeyColumn([
  { key: 'name', label: 'Name', value_type: 'string' as const },
  { key: 'id', label: 'Row Id', value_type: 'number' as const },
])
assert(cols[0]?.key === 'id' && cols[0]?.value_type === 'string', 'id first as string')
assert(cols.length === 2 && cols[1]?.key === 'name', 'other cols kept once')

console.log('entityPrimaryKey.check.ts: ok')
