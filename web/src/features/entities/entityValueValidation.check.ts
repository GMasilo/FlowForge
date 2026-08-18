/**
 * Manual check: npx vite-node src/features/entities/entityValueValidation.check.ts
 */
import { coerceEntityValue, validateAndCoerceEntityValues } from '@/features/entities/entityValueValidation'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

{
  const n = coerceEntityValue('42', 'number')
  assert(n.ok && n.value === 42, 'numeric string coerces to number')
}
{
  const bad = coerceEntityValue('hello', 'number')
  assert(!bad.ok, 'non-numeric string fails number')
}
{
  const obj = coerceEntityValue({ date: '2026-08-14', time: '10:00' }, 'string')
  assert(!obj.ok, 'object is rejected for string column')
}
{
  const d = coerceEntityValue('2026-08-14', 'date')
  assert(d.ok && d.value === '2026-08-14', 'date string accepted')
}
{
  const arr = coerceEntityValue('[1,2]', 'array')
  assert(arr.ok && Array.isArray(arr.value) && (arr.value as number[]).length === 2, 'JSON array string parses')
}

const attrs = [
  { key: 'name', label: 'Name', value_type: 'string' as const, required: true },
  { key: 'age', label: 'Age', value_type: 'number' as const, required: false },
  { key: 'when', label: 'When', value_type: 'date' as const, required: false },
]

{
  const out = validateAndCoerceEntityValues({ name: 'Ada', age: '36' }, attrs)
  assert(out.name === 'Ada' && out.age === 36, 'create coerces age')
}
{
  let failed = false
  try {
    validateAndCoerceEntityValues({ age: 1 }, attrs)
  } catch {
    failed = true
  }
  assert(failed, 'create requires name')
}
{
  const out = validateAndCoerceEntityValues({ age: '7' }, attrs, { partial: true })
  assert(out.age === 7 && out.name === undefined, 'partial update skips missing required')
}
{
  let failed = false
  try {
    validateAndCoerceEntityValues({ name: 'Ada', age: { n: 1 } }, attrs)
  } catch (e) {
    failed = e instanceof Error && e.message.includes('Age') && e.message.includes('number')
  }
  assert(failed, 'object rejected for number column')
}
{
  let failed = false
  try {
    validateAndCoerceEntityValues({ name: 'Ada', extra: 1 }, attrs)
  } catch (e) {
    failed = e instanceof Error && e.message.includes('Unknown field')
  }
  assert(failed, 'unknown field rejected')
}

console.log('entityValueValidation.check.ts: all passed')
