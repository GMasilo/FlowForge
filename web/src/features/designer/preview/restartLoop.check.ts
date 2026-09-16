/**
 * Manual check: npx vite-node src/features/designer/preview/restartLoop.check.ts
 */
import assert from 'node:assert/strict'
import {
  createInitialPreviewState,
  tickPreview,
  type PreviewEngineState,
} from '@/features/designer/preview/previewRuntime'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

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

function runUntilSettled(
  start: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  max = 40,
): PreviewEngineState {
  let state = start
  for (let i = 0; i < max; i += 1) {
    if (state.phase.kind !== 'typing' || !state.currentId) return state
    const next = tickPreview(state, nodes, edges)
    if (next === state || (next.currentId === state.currentId && next.phase.kind === state.phase.kind && next.runs.length === state.runs.length)) {
      return next
    }
    state = next
  }
  throw new Error('did not settle — likely infinite loop')
}

{
  const a = node('a', 'msg_1', 'message', { text: 'Hello' })
  const b = node('b', 'restart_1', 'restart', { clearCookies: false })
  const nodes = [a, b]
  const edges = [edge('a', 'b')]
  const final = runUntilSettled(createInitialPreviewState(nodes, edges, {}), nodes, edges)
  assert.notEqual(final.phase.kind, 'restart', 'leading restart must not fire without interaction')
  assert.ok(
    final.runs.some((r) => r.nodeKey === 'restart_1' && r.processed?.suppressed === true),
    'restart should run suppressed (not fire a host restart)',
  )
}

{
  const a = node('a', 'msg_1', 'message', { text: 'Hello' })
  const b = node('b', 'skip_1', 'skip_to', { targetNodeKey: 'msg_1' })
  const nodes = [a, b]
  const edges = [edge('a', 'b')]
  const final = runUntilSettled(createInitialPreviewState(nodes, edges, {}), nodes, edges)
  assert.equal(final.phase.kind, 'finished', 'skip back to earlier message must stop, not loop')
  assert.ok(
    final.messages.some((m) => m.role === 'system' && /loop/i.test(m.text)),
    'should explain the loop stop',
  )
}

console.log('restartLoop.check.ts: ok')
