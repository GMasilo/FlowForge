import assert from 'node:assert/strict'
import {
  bindMissingStepConnections,
  dropOrphanOptionalEmailSteps,
  pickConnectionForKind,
  reconcileStepConnections,
} from './bindMissingStepConnections.ts'
import type { DesignerNode, DesignerEdge } from '@/features/designer/model/flowSchema'

const httpA = { id: 'c1', name: 'Demo Http', kind: 'http' as const }
const httpB = { id: 'c2', name: 'Other API', kind: 'http' as const }
const emailA = { id: 'e1', name: 'SMTP', kind: 'email' as const }

assert.equal(pickConnectionForKind('http', [httpA]), 'c1')
assert.equal(pickConnectionForKind('http', [httpA, httpB]), 'c1')
assert.equal(pickConnectionForKind('http', [httpB, { id: 'c3', name: 'Prod', kind: 'http' }]), null)
assert.equal(pickConnectionForKind('email', []), null)

const nodes: DesignerNode[] = [
  {
    id: 'n1',
    key: 'http_balance',
    type: 'http',
    label: 'Balance',
    config: { connectionId: '', path: '/banking/balance' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'n2',
    key: 'email_smtp',
    type: 'email',
    label: 'SMTP email (optional)',
    config: { connectionId: '' },
    position: { x: 0, y: 0 },
  },
  {
    id: 'n3',
    key: 'wrap',
    type: 'message',
    label: 'Wrap',
    config: { text: 'done' },
    position: { x: 0, y: 0 },
  },
]

const edges: DesignerEdge[] = [
  { id: 'e1', source: 'n1', target: 'n2', sourceHandle: null, label: null },
  { id: 'e2', source: 'n2', target: 'n3', sourceHandle: null, label: null },
]

const bound = bindMissingStepConnections(nodes, [httpA])
assert.equal(bound.boundCount, 1)
assert.equal(bound.nodes[0]!.config.connectionId, 'c1')
assert.equal(String(bound.nodes[1]!.config.connectionId ?? ''), '')

const pruned = dropOrphanOptionalEmailSteps(bound.nodes, edges, [httpA])
assert.equal(pruned.changed, true)
assert.equal(pruned.nodes.length, 2)
assert.ok(pruned.edges.some((e) => e.source === 'n1' && e.target === 'n3'))

const full = reconcileStepConnections(nodes, edges, [httpA])
assert.equal(full.nodes.find((n) => n.key === 'http_balance')?.config.connectionId, 'c1')
assert.equal(full.nodes.find((n) => n.key === 'email_smtp'), undefined)

const withEmail = reconcileStepConnections(nodes, edges, [httpA, emailA])
assert.equal(withEmail.nodes.find((n) => n.key === 'email_smtp'), undefined)
assert.equal(withEmail.nodes.find((n) => n.key === 'http_balance')?.config.connectionId, 'c1')

const customOptional: DesignerNode = {
  id: 'n4',
  key: 'email_custom',
  type: 'email',
  label: 'SMTP email (optional)',
  config: { connectionId: '' },
  position: { x: 0, y: 0 },
}
const keepWhenEmailExists = dropOrphanOptionalEmailSteps(
  [...nodes.filter((n) => n.key !== 'email_smtp'), customOptional],
  edges,
  [httpA, emailA],
)
assert.ok(keepWhenEmailExists.nodes.find((n) => n.key === 'email_custom'))

console.log('bindMissingStepConnections checks passed')
