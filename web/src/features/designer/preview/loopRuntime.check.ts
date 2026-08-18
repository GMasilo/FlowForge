/**
 * Manual runtime check for For each (loop) steps.
 * Run: npx tsx src/features/designer/preview/loopRuntime.check.ts
 */
import {
  createInitialPreviewState,
  tickPreview,
  type PreviewEngineState,
} from './previewRuntime'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

function node(
  partial: Pick<DesignerNode, 'id' | 'key' | 'type'> & Partial<DesignerNode>,
): DesignerNode {
  return {
    label: partial.key,
    config: {},
    position: { x: 0, y: 0 },
    ...partial,
  }
}

function edge(
  source: string,
  target: string,
  extra: Partial<DesignerEdge> = {},
): DesignerEdge {
  return { id: crypto.randomUUID(), source, target, ...extra }
}

function runToIdle(state: PreviewEngineState, nodes: DesignerNode[], edges: DesignerEdge[], max = 40) {
  let s = state
  for (let i = 0; i < max; i++) {
    if (s.phase.kind === 'finished' || s.phase.kind === 'waiting_input') break
    s = tickPreview(s, nodes, edges)
  }
  return s
}

const nodes: DesignerNode[] = [
  node({
    id: 'sv',
    key: 'set_var_1',
    type: 'set_variable',
    config: { variableKey: 'items', value: '["alpha","beta","gamma"]', valueType: 'array' },
  }),
  node({
    id: 'loop',
    key: 'loop_1',
    type: 'loop',
    config: { collection: '{{vars.items}}', itemVariable: 'item', indexVariable: 'index' },
  }),
  node({
    id: 'msg',
    key: 'message_1',
    type: 'message',
    config: { text: 'Item {{vars.index}}: {{vars.item}}' },
  }),
  node({
    id: 'done',
    key: 'message_2',
    type: 'message',
    config: { text: 'Loop finished' },
  }),
]

const edges: DesignerEdge[] = [
  edge('sv', 'loop'),
  // Real wiring: Each → body action; body leaf Then → After
  edge('loop', 'msg', { sourceHandle: 'body', label: 'Each' }),
  edge('msg', 'done', { label: 'Then' }),
]

// Also verify empty-body leaf (no outgoing) still iterates
const nodesLeaf: DesignerNode[] = [
  node({
    id: 'sv',
    key: 'set_var_1',
    type: 'set_variable',
    config: { variableKey: 'items', value: '["a","b"]', valueType: 'array' },
  }),
  node({
    id: 'loop',
    key: 'loop_1',
    type: 'loop',
    config: { collection: '{{vars.items}}', itemVariable: 'item', indexVariable: 'index' },
  }),
  node({
    id: 'msg',
    key: 'message_1',
    type: 'message',
    config: { text: '{{vars.item}}' },
  }),
]
const edgesLeaf: DesignerEdge[] = [
  edge('sv', 'loop'),
  edge('loop', 'msg', { sourceHandle: 'body', label: 'Each' }),
]

let state = createInitialPreviewState(nodes, edges, {})
state = runToIdle(state, nodes, edges)

const botTexts = state.messages.filter((m) => m.role === 'bot').map((m) => m.text)
const expected = ['Item 0: alpha', 'Item 1: beta', 'Item 2: gamma', 'Loop finished']
const ok =
  expected.every((t, i) => botTexts[i] === t) &&
  botTexts.length === expected.length &&
  state.phase.kind === 'finished' &&
  state.loopStack.length === 0

let leaf = createInitialPreviewState(nodesLeaf, edgesLeaf, {})
leaf = runToIdle(leaf, nodesLeaf, edgesLeaf)
const leafTexts = leaf.messages.filter((m) => m.role === 'bot').map((m) => m.text)
const leafOk =
  leafTexts.join(',') === 'a,b' && leaf.phase.kind === 'finished' && leaf.loopStack.length === 0

console.log(
  JSON.stringify(
    { ok, botTexts, phase: state.phase.kind, leafOk, leafTexts, leafPhase: leaf.phase.kind },
    null,
    2,
  ),
)
if (!ok || !leafOk) throw new Error('loopRuntime check failed')
