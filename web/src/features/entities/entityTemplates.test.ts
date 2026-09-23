import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn(), insert: vi.fn(), from: vi.fn() }))
vi.mock('./entityApi', () => ({ createEntity: mocks.create, deleteEntity: mocks.remove, keyFromName: (name: string) => name.toLowerCase() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: mocks.from } }))
import { ENTITY_TEMPLATES } from './entityTemplates'
import { createEntityFromTemplate } from './createEntityFromTemplate'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.create.mockResolvedValue({ id: 'new-entity' })
  mocks.from.mockReturnValue({ insert: mocks.insert })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.remove.mockResolvedValue(undefined)
})
test('starter schemas have distinct fields and leave primary key creation to the entity API', () => {
  for (const template of ENTITY_TEMPLATES) {
    expect(new Set(template.fields.map(field => field.key)).size).toBe(template.fields.length)
    expect(template.fields.some(field => field.key === 'id')).toBe(false)
  }
})
test('blank creates no extra attributes', async () => {
  await createEntityFromTemplate({ chatbotId: 'bot', name: 'Custom', kind: 'dynamic', templateKey: 'blank' })
  expect(mocks.create).toHaveBeenCalledOnce()
  expect(mocks.insert).not.toHaveBeenCalled()
})
test('starter creates typed fields with required and unique flags and allows storage override', async () => {
  await createEntityFromTemplate({ chatbotId: 'bot', name: 'Inventory', kind: 'dynamic', templateKey: 'products' })
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Inventory', kind: 'dynamic' }))
  expect(mocks.insert).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ entity_id: 'new-entity', key: 'sku', required: true, is_unique: true, is_identifier: false }),
    expect.objectContaining({ key: 'price', value_type: 'number', required: true }),
  ]))
})
test('failed schema setup removes only the newly created entity', async () => {
  const failure = new Error('Save failed')
  mocks.insert.mockResolvedValue({ error: failure })
  await expect(createEntityFromTemplate({ chatbotId: 'bot', name: 'Users', kind: 'dynamic', templateKey: 'users' })).rejects.toThrow('Save failed')
  expect(mocks.remove).toHaveBeenCalledWith('new-entity')
})
test('invalid template never creates an entity', async () => {
  await expect(createEntityFromTemplate({ chatbotId: 'bot', name: 'Test', kind: 'dynamic', templateKey: 'missing' })).rejects.toThrow('valid entity template')
  expect(mocks.create).not.toHaveBeenCalled()
})
