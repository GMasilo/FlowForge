/**
 * Manual check: npx tsx --tsconfig tsconfig.app.json src/features/entities/entityQuery.check.ts
 */
import {
  coalesceEntityFilters,
  queryEntityRecords,
  type EntityFilters,
} from '@/features/entities/entityQuery'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const records = [
  { id: '1', values: { name: 'Ada', nps: 9, city: 'Cape Town' } },
  { id: '2', values: { name: 'Bob', nps: 4, city: 'Johannesburg' } },
  { id: '3', values: { name: 'Cara', nps: 8, city: 'Cape Town' } },
]

{
  const legacy = coalesceEntityFilters({ filterAttribute: 'city', filterEquals: 'Cape Town' })
  assert(legacy.clauses.length === 1 && legacy.clauses[0]?.operator === 'eq', 'legacy coalesce')
  const hit = queryEntityRecords(records, legacy, () => 'Cape Town')
  assert(hit.length === 2 && hit.every((r) => r.values.city === 'Cape Town'), 'legacy eq')
}

{
  const filters: EntityFilters = {
    logic: 'and',
    clauses: [
      { attribute: 'city', operator: 'eq', value: '{{vars.city}}' },
      { attribute: 'nps', operator: 'gte', value: '8' },
    ],
  }
  const hit = queryEntityRecords(records, filters, (raw) => {
    if (raw === '{{vars.city}}') return 'Cape Town'
    if (raw === '8') return 8
    return raw
  })
  assert(hit.length === 2 && hit.map((r) => r.values.name).join(',') === 'Ada,Cara', 'and filters')
}

{
  const filters: EntityFilters = {
    logic: 'or',
    clauses: [
      { attribute: 'name', operator: 'contains', value: 'o' },
      { attribute: 'nps', operator: 'lt', value: '5' },
    ],
  }
  const hit = queryEntityRecords(records, filters, (raw) => (raw === '5' ? 5 : raw))
  assert(hit.length === 1 && hit[0]?.values.name === 'Bob', 'or filters')
}

{
  const filters: EntityFilters = {
    logic: 'and',
    clauses: [{ attribute: 'email', operator: 'exists', value: '' }],
  }
  const hit = queryEntityRecords(
    [
      { id: 'a', values: { email: 'a@x.com' } },
      { id: 'b', values: { email: '' } },
      { id: 'c', values: {} },
    ],
    filters,
    () => undefined,
  )
  assert(hit.length === 1 && hit[0]?.id === 'a', 'exists')
}

console.log('entityQuery.check.ts: ok')
