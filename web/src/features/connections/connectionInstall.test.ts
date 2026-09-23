import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: mocks.from } }))
import { addConnectionToChatbot } from './connectionApi'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.from.mockReturnValue({ upsert: mocks.upsert })
})
test('install ignores an existing owner link without overwriting it', async () => {
  mocks.upsert.mockResolvedValue({ error: null })
  await addConnectionToChatbot({ chatbotId: 'bot', connectionId: 'connection', addedBy: 'user' })
  expect(mocks.from).toHaveBeenCalledWith('chatbot_connections')
  expect(mocks.upsert).toHaveBeenCalledWith({ chatbot_id: 'bot', connection_id: 'connection', added_by: 'user' }, { onConflict: 'chatbot_id,connection_id', ignoreDuplicates: true })
})
test('permission and other install errors still reach the caller', async () => {
  const error = { code: '42501', message: 'Permission denied' }
  mocks.upsert.mockResolvedValue({ error })
  await expect(addConnectionToChatbot({ chatbotId: 'bot', connectionId: 'connection', addedBy: 'user' })).rejects.toEqual(error)
})
