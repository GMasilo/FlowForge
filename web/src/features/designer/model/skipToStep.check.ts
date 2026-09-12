/**
 * Manual check: npx vite-node src/features/designer/model/skipToStep.check.ts
 */
import assert from 'node:assert/strict'
import {
  nodesBypassedBySkipJump,
  collectSkipTargetKeys,
  listSkipMissingVariables,
} from '@/features/designer/model/skipToStep'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import {
  createInitialPreviewState,
  tickPreview,
} from '@/features/designer/preview/previewRuntime'

function node(
  id: string,
  key: string,
  type: DesignerNode['type'],
  config: Record<string, unknown> = {},
): DesignerNode {
  return { id, key, type, label: key, config, position: { x: 0, y: 0 } }
}

function edge(source: string, target: string): DesignerEdge {
  return { id: `${source}-${target}`, source, target }
}

{
  const a = node('a', 'a', 'message', { text: 'hi' })
  const b = node('b', 'b', 'question', { prompt: 'Name?', outputVariable: 'name' })
  const c = node('c', 'c', 'question', { prompt: 'Email?', outputVariable: 'email' })
  const d = node('d', 'd', 'message', { text: 'Hello {{vars.name}} {{vars.email}}' })
  const nodes = [a, b, c, d]
  const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'd')]

  const bypassed = nodesBypassedBySkipJump('a', 'd', nodes, edges)
  assert.deepEqual(
    bypassed.map((n) => n.key).sort(),
    ['b', 'c'],
    'linear skip bypasses intermediate questions',
  )

  const missing = listSkipMissingVariables('a', 'd', nodes, edges)
  assert.equal(missing.find((m) => m.variableKey === 'name')?.referenced, true)
  assert.equal(missing.find((m) => m.variableKey === 'email')?.referenced, true)
}

{
  const btn = node('btn', 'btn', 'button', {
    buttons: [
      {
        id: '1',
        label: 'Go',
        value: 'go',
        listeners: [{ id: 'l', event: 'click', action: 'skip_to', skipToNodeKey: 'end_msg' }],
      },
    ],
  })
  assert.deepEqual(collectSkipTargetKeys(btn), ['end_msg'])
}

{
  const skip = node('s', 'skip_1', 'skip_to', {
    targetNodeKey: 'msg_2',
    variableDefaults: [{ variableKey: 'answer', value: 'skipped' }],
  })
  const q = node('q', 'q_1', 'question', { prompt: '?', outputVariable: 'answer' })
  const msg = node('m', 'msg_2', 'message', { text: '{{coalesce(vars.answer, "none")}}' })
  const nodes = [skip, q, msg]
  const edges = [edge('s', 'q'), edge('q', 'm')]

  const missing = listSkipMissingVariables('s', 'm', nodes, edges)
  assert.equal(missing.length, 1)
  assert.equal(missing[0]?.variableKey, 'answer')
  assert.equal(missing[0]?.referenced, true)

  let state = createInitialPreviewState(nodes, edges, {})
  state = tickPreview(state, nodes, edges)
  assert.equal(state.currentId, 'm', 'skip jumps to msg_2')
  assert.equal(state.vars.answer, 'skipped', 'configured default applied')
}

console.log('skipToStep.check.ts: ok')
