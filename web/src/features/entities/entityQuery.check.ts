/**
 * Manual check: npx tsx --tsconfig tsconfig.app.json src/features/entities/entityQuery.check.ts
 */
import {
  normalizeEntityQuery,
  queryEntityRecords,
  compareEntityValue,
} from '@/features/entities/entityQuery'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(compareEntityValue('Ada', 'Ada', 'eq'), 'eq')
assert(compareEntityValue('Ada', 'Bob', 'neq'), 'neq')
assert(compareEntityValue(10, 5, 'gt'), 'gt')
assert(compareEntityValue('hello world', 'WORLD', 'contains'), 'contains case-insensitive')
assert(compareEntityValue('x', undefined, 'exists'), 'exists')
assert(!compareEntityValue('', undefined, 'exists'), 'empty not exists')

const rows = [
  { id: '1', values: { name: 'Ada', age: 36, city: 'London' } },
  { id: '2', values: { name: 'Bob', age: 22, city: 'Paris' } },
  { id: '3', values: { name: 'Cara', age: 36, city: 'London' } },
]

{
  const legacy = normalizeEntityQuery({ filterAttribute: 'city', filterEquals: 'London' })
  assert(legacy.filters.length === 1 && legacy.filters[0]?.operator === 'eq', 'legacy migrate')
  const out = queryEntityRecords(rows, legacy)
  assert(out.length === 2 && out.every((r) => r.values.city === 'London'), 'legacy filter')
}

{
  const out = queryEntityRecords(rows, {
    filters: [
      { attribute: 'age', operator: 'eq', value: '36' },
      { attribute: 'city', operator: 'eq', value: 'London' },
    ],
    filterLogic: 'and',
    sortAttribute: 'name',
    sortDirection: 'asc',
    limit: '',
  })
  assert(out.length === 2 && out[0]?.values.name === 'Ada', 'and + sort')
}

{
  const out = queryEntityRecords(rows, {
    filters: [
      { attribute: 'name', operator: 'eq', value: 'Bob' },
      { attribute: 'city', operator: 'eq', value: 'London' },
    ],
    filterLogic: 'or',
    sortAttribute: '',
    sortDirection: 'asc',
    limit: '2',
  })
  assert(out.length === 2, 'or + limit')
}

{
  const out = queryEntityRecords(rows, {
    filters: [{ attribute: 'age', operator: 'gt', value: '30' }],
    filterLogic: 'and',
    sortAttribute: 'age',
    sortDirection: 'desc',
    limit: '1',
  })
  assert(out.length === 1 && out[0]?.values.name === 'Ada' || out[0]?.values.name === 'Cara', 'gt limit')
}

console.log('entityQuery.check.ts: ok')
