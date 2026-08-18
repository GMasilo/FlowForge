/**
 * Manual check: npx vite-node src/features/designer/store/designerHistory.check.ts
 */
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { useDesignerStore } from '@/features/designer/store/designerStore'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function node(
  id: string,
  type: DesignerNode['type'],
  extra?: Partial<DesignerNode>,
): DesignerNode {
  return {
    id,
    key: id,
    type,
    label: extra?.label ?? id,
    config: extra?.config ?? {},
    position: extra?.position ?? { x: 0, y: 0 },
  }
}

const seedNodes: DesignerNode[] = [
  node('start', 'message', { label: 'Start', config: { text: 'hi' } }),
  node('cond', 'condition', { label: 'If', config: { left: '1', operator: 'eq', right: '1' } }),
  node('yes', 'message', { label: 'Yes', config: { text: 'yes' } }),
  node('no', 'message', { label: 'No', config: { text: 'no' } }),
  node('after', 'message', { label: 'After', config: { text: 'after' } }),
  node('end', 'end', { label: 'End' }),
]

const seedEdges: DesignerEdge[] = [
  { id: 'e0', source: 'start', target: 'cond' },
  { id: 'e1', source: 'cond', target: 'yes', sourceHandle: 'true' },
  { id: 'e2', source: 'cond', target: 'no', sourceHandle: 'false' },
  { id: 'e3', source: 'yes', target: 'after', label: 'Then' },
  { id: 'e4', source: 'no', target: 'after', label: 'Then' },
  { id: 'e5', source: 'after', target: 'end' },
]

function loadSeed() {
  useDesignerStore.getState().setFlow({
    flowId: 'f1',
    nodes: structuredClone(seedNodes),
    edges: structuredClone(seedEdges),
    globalVariables: [],
  })
}

loadSeed()
const store = useDesignerStore.getState()
assert(!store.canUndo && !store.canRedo, 'fresh load has empty history')
assert(store.nodes.length === 6, 'seed size')

const addedId = useDesignerStore.getState().addNode('message', 'start')
assert(useDesignerStore.getState().canUndo, 'addNode records history')
assert(useDesignerStore.getState().nodes.some((n) => n.id === addedId), 'node added')
assert(useDesignerStore.getState().undo(), 'undo addNode')
assert(!useDesignerStore.getState().nodes.some((n) => n.id === addedId), 'addNode undone')
assert(useDesignerStore.getState().nodes.length === 6, 'seed restored')
assert(useDesignerStore.getState().canRedo, 'redo available after undo')
assert(useDesignerStore.getState().redo(), 'redo addNode')
assert(useDesignerStore.getState().nodes.some((n) => n.id === addedId), 'addNode redone')

loadSeed()
useDesignerStore.getState().removeNode('cond')
assert(!useDesignerStore.getState().nodes.some((n) => n.id === 'cond'), 'condition deleted')
assert(!useDesignerStore.getState().nodes.some((n) => n.id === 'yes'), 'yes branch deleted')
assert(useDesignerStore.getState().undo(), 'undo delete condition')
const afterDeleteUndo = useDesignerStore.getState()
assert(afterDeleteUndo.nodes.some((n) => n.id === 'cond'), 'condition restored')
assert(afterDeleteUndo.nodes.some((n) => n.id === 'yes'), 'yes restored')
assert(afterDeleteUndo.nodes.some((n) => n.id === 'no'), 'no restored')
assert(
  afterDeleteUndo.edges.some((e) => e.source === 'cond' && e.target === 'yes'),
  'yes edge restored',
)

loadSeed()
useDesignerStore.getState().copyNode('start')
const pasted = useDesignerStore.getState().pasteAfter('start')
assert(pasted, 'paste created a node')
assert(useDesignerStore.getState().nodes.length === 7, 'paste added one node')
const pastedNode = useDesignerStore.getState().nodes.find((n) => n.id === pasted)
assert(pastedNode?.label === 'Start', 'paste copied label')
assert(useDesignerStore.getState().undo(), 'undo paste')
assert(useDesignerStore.getState().nodes.length === 6, 'paste is a single undo step')
assert(!useDesignerStore.getState().nodes.some((n) => n.id === pasted), 'pasted node gone')

loadSeed()
useDesignerStore.getState().updateNode('start', { label: 'S' })
useDesignerStore.getState().updateNode('start', { label: 'St' })
useDesignerStore.getState().updateNode('start', { label: 'Start edited' })
assert(useDesignerStore.getState().nodes.find((n) => n.id === 'start')?.label === 'Start edited', 'label updated')
assert(useDesignerStore.getState().undo(), 'undo coalesced typing')
assert(useDesignerStore.getState().nodes.find((n) => n.id === 'start')?.label === 'Start', 'typing coalesced into one undo')
assert(!useDesignerStore.getState().canUndo, 'no further undo after coalesced edit')

loadSeed()
useDesignerStore.getState().updateNode('start', { label: 'A' })
useDesignerStore.getState().updateNode('after', { label: 'B' })
assert(useDesignerStore.getState().undo(), 'undo second node')
assert(useDesignerStore.getState().nodes.find((n) => n.id === 'after')?.label === 'After', 'second node restored')
assert(useDesignerStore.getState().nodes.find((n) => n.id === 'start')?.label === 'A', 'first node edit kept')
assert(useDesignerStore.getState().undo(), 'undo first node')
assert(useDesignerStore.getState().nodes.find((n) => n.id === 'start')?.label === 'Start', 'first node restored')

loadSeed()
useDesignerStore.getState().applyNodePositions(new Map([['start', { x: 40, y: 80 }]]), { silent: true })
assert(!useDesignerStore.getState().canUndo, 'silent layout does not record history')
assert(useDesignerStore.getState().nodes.find((n) => n.id === 'start')?.position.x === 40, 'silent layout applied')

loadSeed()
useDesignerStore.getState().applyNodePositions(new Map([['start', { x: 40, y: 80 }]]), { recordHistory: false })
assert(!useDesignerStore.getState().canUndo, 'recordHistory false skips undo stack')
assert(useDesignerStore.getState().dirty, 'non-silent skip still marks dirty')

loadSeed()
useDesignerStore.getState().addNode('message', 'start')
assert(useDesignerStore.getState().canUndo, 'history after add')
loadSeed()
assert(!useDesignerStore.getState().canUndo && !useDesignerStore.getState().canRedo, 'setFlow clears history')

loadSeed()
const beforeBatch = useDesignerStore.getState().nodes.length
useDesignerStore.getState().beginHistoryBatch()
const batchId = useDesignerStore.getState().addNode('message')
useDesignerStore.getState().setEdges([
  ...useDesignerStore.getState().edges,
  { id: 'batch-e', source: 'start', target: batchId },
])
useDesignerStore.getState().endHistoryBatch()
assert(useDesignerStore.getState().nodes.length === beforeBatch + 1, 'batch added node')
assert(useDesignerStore.getState().undo(), 'undo batch')
assert(useDesignerStore.getState().nodes.length === beforeBatch, 'batch add+setEdges is one undo')
assert(!useDesignerStore.getState().edges.some((e) => e.id === 'batch-e'), 'batch edge undone')

loadSeed()
useDesignerStore.getState().addNode('question')
useDesignerStore.getState().undo()
assert(useDesignerStore.getState().canRedo, 'redo after undo')
useDesignerStore.getState().addNode('email')
assert(!useDesignerStore.getState().canRedo, 'new edit clears redo')

console.log(JSON.stringify({ ok: true, checks: 12 }, null, 2))
