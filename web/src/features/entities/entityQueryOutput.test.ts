import { beforeEach, expect, test, vi } from 'vitest'
const mock = vi.hoisted(() => ({ allow: vi.fn(), list: vi.fn(), publicOp: vi.fn(), from: vi.fn() }))
vi.mock('./entityApi', () => ({ assertEntityLinkAllows: mock.allow, listEntityRecords: mock.list, publicChatEntityOp: mock.publicOp, toRecordPayload: (row: {id:string;values:object}) => ({id:row.id,...row.values}) }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: mock.from } }))
import { entityQueryOutput } from './entityQueryOutput'
import { createInitialPreviewState, runEntityStep } from '@/features/designer/preview/previewRuntime'
import type { DesignerNode } from '@/features/designer/model/flowSchema'
const config = { operation: 'list', joins: [{ entityId: 'customers', alias: 'customer', localColumn: 'customer_id', foreignColumn: 'id', kind: 'inner' }], columnMode: 'selected', selectedColumns: ['customer.name'] }
const output = { records: [{ id: 'order', customer_id: '1', total: 10 }] }
beforeEach(() => vi.resetAllMocks())
test('public joins use the same session-scoped RPC and project output', async () => {
  mock.publicOp.mockResolvedValue({ records: [{ id: '1', values: { name: 'Alex', email: 'private@example.com' } }] })
  expect(await entityQueryOutput(output, config, 'bot', 'session')).toEqual({ records: [{ customer: { name: 'Alex' } }], count: 1 })
  expect(mock.publicOp).toHaveBeenCalledWith({ entityId: 'customers', chatbotId: 'bot', sessionId: 'session', operation: 'list' })
  expect(mock.from).not.toHaveBeenCalled()
})
test('preview permission denial prevents reading joined records', async () => {
  mock.allow.mockRejectedValue(new Error('Query denied'))
  await expect(entityQueryOutput(output, config, 'bot')).rejects.toThrow('Query denied')
  expect(mock.allow).toHaveBeenCalledWith('customers', 'bot', 'query')
  expect(mock.from).not.toHaveBeenCalled()
})
test('legacy all-column reads keep their result unchanged', async () => {
  expect(await entityQueryOutput(output, { operation: 'list' }, 'bot')).toBe(output)
  expect(mock.from).not.toHaveBeenCalled()
})
test('Get returns the first joined match, not an unmatched earlier base record', async () => {
  mock.publicOp.mockImplementation(async ({ entityId }) => entityId === 'orders'
    ? { entity: { key: 'orders', kind: 'dynamic' }, records: [{ id: 'first', values: { customer_id: 'missing' } }, { id: 'second', values: { customer_id: '1' } }] }
    : { records: [{ id: '1', values: { name: 'Alex' } }] })
  const node: DesignerNode = { id: 'entity', key: 'entity', type: 'entity', label: 'Entity', position: { x: 0, y: 0 }, config: { ...config, entityId: 'orders', operation: 'get', outputVariable: 'foundCustomer' } }
  const state = await runEntityStep(createInitialPreviewState([node], [], {}), [node], [], { chatbotId: 'bot', sessionId: 'session' })
  expect(state.vars.foundCustomer).toEqual({ customer: { name: 'Alex' } })
})
