import { expect, it, vi } from 'vitest'
import { createInitialPreviewState, runIntegrationStep } from './previewRuntime'
import { actionsForProvider, defaultActionForProvider } from '@/features/integrations/integrationActions'

vi.mock('@/shared/lib/flowforgeApi', () => ({ isFlowForgeApiConfigured: () => false, executeIntegrationAction: vi.fn() }))

it('fails unconfigured intent classification instead of inventing a successful prediction', async () => {
  const nodes = [{ id: 'intent', key: 'intent', type: 'integration' as const, label: 'Understand intent', position: { x: 0, y: 0 }, config: { action: 'ml.classify_intent', outputVariable: 'intentResult' } }]
  const next = await runIntegrationStep(createInitialPreviewState(nodes, [], {}), nodes, [])
  expect(next.runs.at(-1)?.status).toBe('Failed')
  expect(next.vars.intentResult).toMatchObject({ ok: false, data: { intent: 'unknown', matched: false } })
  expect(next.vars.intentResult).not.toHaveProperty('mocked')
})

it('offers intent classification on Custom API without changing its existing default', () => {
  expect(actionsForProvider('custom').some(action => action.id === 'ml.classify_intent')).toBe(true)
  expect(defaultActionForProvider('custom')).toBe('custom.request')
})
