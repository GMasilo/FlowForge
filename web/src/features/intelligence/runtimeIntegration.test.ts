import { expect, test, vi } from 'vitest'
const api = vi.hoisted(() => ({ http: vi.fn() }))
vi.mock('@/shared/lib/flowforgeApi', () => ({ executeHttpConnection: api.http, sendEmailConnection: vi.fn(), executeDatabaseConnection: vi.fn(), isFlowForgeApiConfigured: () => true }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: {} }))
import { createInitialPreviewState, runConnectionStep } from '@/features/designer/preview/previewRuntime'
import type { DesignerNode } from '@/features/designer/model/flowSchema'

test('public HTTP read retries through the runtime and records the final result once', async () => {
  api.http.mockReset().mockResolvedValueOnce({ ok: false, status: 503, headers: {}, data: {} }).mockResolvedValue({ ok: true, status: 200, headers: {}, data: { ready: true } })
  const node: DesignerNode = { id: 'get', key: 'get', label: 'Read', type: 'http', position: { x: 0, y: 0 }, config: { connectionId: 'read-connection', method: 'GET', outputVariable: 'reply' } }
  const state = await runConnectionStep(createInitialPreviewState([node], [], {}), [node], [], {}, { chatbotId: 'bot', sessionId: 'session' })
  expect(api.http).toHaveBeenCalledTimes(2)
  expect(state.runs).toHaveLength(1)
  expect(state.runs[0]!.status).toBe('Succeeded')
})

test('public HTTP write failures are recorded without replaying the side effect', async () => {
  api.http.mockReset().mockResolvedValue({ ok: false, status: 503, headers: {}, data: {} })
  const node: DesignerNode = { id: 'post', key: 'post', label: 'Write', type: 'http', position: { x: 0, y: 0 }, config: { connectionId: 'write-connection', method: 'POST' } }
  const state = await runConnectionStep(createInitialPreviewState([node], [], {}), [node], [], {}, { chatbotId: 'bot', sessionId: 'session' })
  expect(api.http).toHaveBeenCalledTimes(1)
  expect(state.runs[0]!.status).toBe('Failed')
})
