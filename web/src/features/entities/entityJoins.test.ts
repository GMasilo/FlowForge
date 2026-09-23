import { expect, test } from 'vitest'
import { joinEntityRows, selectEntityColumns, type EntityJoin } from './entityJoins'
const join: EntityJoin = { entityId: 'users', alias: 'customer', localColumn: 'user_id', foreignColumn: 'id', kind: 'left' }
const base = [{ id: 'a', user_id: '1', amount: 50 }, { id: 'b', user_id: '2', amount: 70 }, { id: 'c', user_id: null, amount: 10 }]
const load = async () => [{ id: '1', name: 'Alex', email: 'a@example.com' }, { id: '1', name: 'Sam', email: 's@example.com' }, { id: null, name: 'No match', email: '' }]
test('left joins retain unmatched rows and expand multiple matches without matching nulls', async () => {
  const rows = await joinEntityRows(base, [join], load)
  expect(rows).toHaveLength(4)
  expect(rows[0].customer).toHaveProperty('name', 'Alex')
  expect(rows[2].customer).toBeNull()
  expect(rows[3].customer).toBeNull()
})
test('inner joins exclude unmatched rows', async () => {
  expect(await joinEntityRows(base, [{ ...join, kind: 'inner' }], load)).toHaveLength(2)
})
test('projection includes only chosen base and nested columns', async () => {
  const rows = selectEntityColumns(await joinEntityRows(base, [join], load), ['amount', 'customer.name'])
  expect(rows[0]).toEqual({ amount: 50, customer: { name: 'Alex' } })
  expect(rows[2]).toEqual({ amount: 70, customer: null })
  expect(() => selectEntityColumns(base, [])).toThrow('at least one')
})
test('conflicting aliases, unsafe keys and denied loaders fail closed', async () => {
  await expect(joinEntityRows(base, [{ ...join, alias: 'amount' }], load)).rejects.toThrow('conflicts')
  await expect(joinEntityRows(base, [{ ...join, alias: '__proto__' }], load)).rejects.toThrow('valid')
  await expect(joinEntityRows(base, [join], async () => { throw new Error('Query denied') })).rejects.toThrow('Query denied')
})
