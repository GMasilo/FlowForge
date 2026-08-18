/**
 * Manual check: npx vite-node src/features/designer/preview/questionTimeout.check.ts
 */
import {
  createInitialPreviewState,
  tickPreview,
  timeoutPreviewQuestion,
  type PreviewEngineState,
} from './previewRuntime'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const nodes: DesignerNode[] = [
  {
    id: 'q',
    key: 'ask',
    type: 'question',
    label: 'Ask',
    config: {
      prompt: 'Optional?',
      answerType: 'text',
      answerRequired: false,
      outputVariable: 'ans',
      timeoutSeconds: 5,
      runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
      delaySeconds: 0,
    },
    position: { x: 0, y: 0 },
  },
  {
    id: 'm',
    key: 'fallback',
    type: 'message',
    label: 'Fallback',
    config: {
      text: 'Timed out path',
      runAfter: { succeeded: false, failed: false, skipped: false, timedOut: true },
      delaySeconds: 0,
      timeoutSeconds: 0,
    },
    position: { x: 0, y: 0 },
  },
]

const edges: DesignerEdge[] = [{ id: 'e1', source: 'q', target: 'm' }]

let state: PreviewEngineState = createInitialPreviewState(nodes, edges, {})
state = tickPreview(state, nodes, edges)
assert(state.phase.kind === 'waiting_input', 'should wait')

state = timeoutPreviewQuestion(state, nodes, edges)
assert(state.runs[0]?.status === 'TimedOut', `expected TimedOut got ${state.runs[0]?.status}`)

// continue until message runs (or finished)
let guard = 0
while (state.phase.kind === 'typing' && state.currentId && guard < 10) {
  state = tickPreview(state, nodes, edges)
  guard += 1
}

assert(state.runs.some((r) => r.nodeKey === 'fallback' && r.status === 'Succeeded'), 'fallback ran after timed out')
assert(
  state.messages.some((m) => m.role === 'bot' && m.text === 'Timed out path'),
  'fallback message',
)

console.log(
  JSON.stringify(
    {
      ok: true,
      statuses: state.runs.map((r) => `${r.nodeKey}:${r.status}`),
      texts: state.messages.filter((m) => m.role === 'bot' || m.role === 'system').map((m) => m.text),
    },
    null,
    2,
  ),
)
