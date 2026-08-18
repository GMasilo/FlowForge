/**
 * Manual check: npx vite-node src/features/designer/utils/deleteContainer.check.ts
 */
import { planNodeDeletion } from './sequenceEdit'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { useDesignerStore } from '@/features/designer/store/designerStore'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const nodes: DesignerNode[] = [
  {
    id: 'start',
    key: 'start',
    type: 'message',
    label: 'Start',
    config: { text: 'hi' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'cond',
    key: 'if_1',
    type: 'condition',
    label: 'If',
    config: { left: '1', operator: 'eq', right: '1' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'yes',
    key: 'yes_msg',
    type: 'message',
    label: 'Yes',
    config: { text: 'yes' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'no',
    key: 'no_msg',
    type: 'message',
    label: 'No',
    config: { text: 'no' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'after',
    key: 'after_msg',
    type: 'message',
    label: 'After',
    config: { text: 'after' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'end',
    key: 'end_1',
    type: 'end',
    label: 'End',
    config: {},
    position: { x: 0, y: 0 },
  },
]

const edges: DesignerEdge[] = [
  { id: 'e0', source: 'start', target: 'cond' },
  { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
  { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
  { id: 'e3', source: 'yes', target: 'after', label: 'Then' },
  { id: 'e4', source: 'no', target: 'after', label: 'Then' },
  { id: 'e5', source: 'after', target: 'end' },
]

const plan = planNodeDeletion('cond', nodes, edges)
assert(plan?.kind === 'container', 'container plan')
assert(plan!.deleteIds.includes('cond'), 'delete cond')
assert(plan!.deleteIds.includes('yes'), 'delete yes')
assert(plan!.deleteIds.includes('no'), 'delete no')
assert(!plan!.deleteIds.includes('after'), 'keep after')
assert(plan!.continueIds.includes('after'), 'continue after')

useDesignerStore.getState().setFlow({
  flowId: 'f1',
  nodes,
  edges,
  globalVariables: [],
})
useDesignerStore.getState().removeNode('cond')
const state = useDesignerStore.getState()
const ids = new Set(state.nodes.map((n) => n.id))
assert(!ids.has('cond') && !ids.has('yes') && !ids.has('no'), 'branches gone')
assert(ids.has('after') && ids.has('start') && ids.has('end'), 'spine kept')
assert(
  state.edges.some((e) => e.source === 'start' && e.target === 'after'),
  'start → after bridged',
)

console.log(
  JSON.stringify(
    {
      ok: true,
      remaining: state.nodes.map((n) => n.key),
      edges: state.edges.map((e) => `${e.source}->${e.target}`),
    },
    null,
    2,
  ),
)
