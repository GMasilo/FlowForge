/**
 * Manual check: npx vite-node src/features/designer/validation/skipVariables.check.ts
 */
import assert from 'node:assert/strict'
import { validateFlow } from '@/features/designer/validation/referenceValidator'
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

function varProblems(issues: { code: string; message: string }[]) {
  return issues.filter((i) => i.code === 'forward_var_ref' || i.code === 'unknown_var')
}

{
  // skip_to with no defaults — message uses vars from bypassed question
  const skip = node('s', 'skip_1', 'skip_to', { targetNodeKey: 'msg_1' })
  const q = node('q', 'q_1', 'question', { prompt: 'Name?', outputVariable: 'name' })
  const msg = node('m', 'msg_1', 'message', { text: 'Hi {{vars.name}}' })
  const nodes = [skip, q, msg]
  const edges = [edge('s', 'q'), edge('q', 'm')]

  const issues = validateFlow(nodes, edges, { globalVariables: [] })
  const problems = varProblems(issues.filter((i) => i.nodeId === 'm'))
  assert.equal(
    problems.length,
    0,
    `expected no var problems on message after skip, got: ${problems.map((p) => p.message).join('; ')}`,
  )
}

{
  // Button skip_to — same expectation
  const btn = node('b', 'btn_1', 'button', {
    buttons: [
      {
        id: '1',
        label: 'Skip',
        value: 'skip',
        listeners: [{ id: 'l', event: 'click', action: 'skip_to', skipToNodeKey: 'msg_1' }],
      },
    ],
    outputVariable: 'choice',
  })
  const q = node('q', 'q_1', 'question', { prompt: 'Name?', outputVariable: 'name' })
  const msg = node('m', 'msg_1', 'message', { text: 'Hi {{vars.name}}' })
  const nodes = [btn, q, msg]
  const edges = [edge('b', 'q'), edge('q', 'm')]

  const issues = validateFlow(nodes, edges, { globalVariables: [] })
  const problems = varProblems(issues.filter((i) => i.nodeId === 'm'))
  assert.equal(
    problems.length,
    0,
    `button skip: expected no var problems, got: ${problems.map((p) => p.message).join('; ')}`,
  )
}

{
  // Empty default → null at runtime
  const skip = node('s', 'skip_1', 'skip_to', {
    targetNodeKey: 'msg_1',
    variableDefaults: [{ variableKey: 'name', value: '' }],
  })
  const q = node('q', 'q_1', 'question', { prompt: 'Name?', outputVariable: 'name' })
  const msg = node('m', 'msg_1', 'message', { text: 'Hi {{vars.name}}' })
  const nodes = [skip, q, msg]
  const edges = [edge('s', 'q'), edge('q', 'm')]

  let state = createInitialPreviewState(nodes, edges, {})
  state = tickPreview(state, nodes, edges)
  assert.equal(state.currentId, 'm')
  assert.equal(state.vars.name, null)

  const issues = validateFlow(nodes, edges, { globalVariables: [] })
  const overwrite = issues.filter((i) => i.code === 'variable_overwrite' && i.nodeId === 'q')
  assert.equal(overwrite.length, 0, 'skip defaults should not warn as overwrite on question')
}

console.log('skipVariables.check.ts: ok')
