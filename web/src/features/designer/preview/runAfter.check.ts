/**
 * Manual check: npx vite-node src/features/designer/preview/runAfter.check.ts
 */
import {
  createInitialPreviewState,
  tickPreview,
  type PreviewEngineState,
} from './previewRuntime'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function msgNode(id: string, key: string, text: string, extras: Record<string, unknown> = {}): DesignerNode {
  return {
    id,
    key,
    type: 'message',
    label: key,
    config: { text, runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false }, delaySeconds: 0, ...extras },
    position: { x: 0, y: 0 },
  }
}

const nodes: DesignerNode[] = [
  msgNode('a', 'a', 'A ok'),
  msgNode('b', 'b', 'B should skip', {
    runAfter: { succeeded: false, failed: true, skipped: false, timedOut: false },
  }),
  msgNode('c', 'c', 'C after skip', {
    runAfter: { succeeded: false, failed: false, skipped: true, timedOut: false },
  }),
]

const edges: DesignerEdge[] = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'b', target: 'c' },
]

function runAll(state: PreviewEngineState): PreviewEngineState {
  let s = state
  let guard = 0
  while (s.phase.kind === 'typing' && s.currentId && guard < 20) {
    s = tickPreview(s, nodes, edges)
    guard += 1
  }
  return s
}

const final = runAll(createInitialPreviewState(nodes, edges, {}))
const statuses = final.runs.map((r) => `${r.nodeKey}:${r.status}`)
const texts = final.messages.filter((m) => m.role === 'bot').map((m) => m.text)

assert(statuses[0] === 'a:Succeeded', `expected a succeeded, got ${statuses[0]}`)
assert(statuses[1] === 'b:Skipped', `expected b skipped, got ${statuses[1]}`)
assert(statuses[2] === 'c:Succeeded', `expected c succeeded, got ${statuses[2]}`)
assert(texts.includes('A ok'), 'message A')
assert(!texts.includes('B should skip'), 'B must not message')
assert(texts.includes('C after skip'), 'message C')
assert(final.phase.kind === 'finished', 'finished')

console.log(JSON.stringify({ ok: true, statuses, texts }, null, 2))
