import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateFlow } from './referenceValidator.ts'
import type { ConnectionValidationInfo } from '@/features/connections/connectionValidation'

const packPath = join(process.cwd(), '../samples/flowforge-usecase-banking.json')
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const nodes = pack.nodes.map((n: { type: string; config: Record<string, unknown> }) => {
  if (n.type === 'http') return { ...n, config: { ...n.config, connectionId: 'demo' } }
  return n
})
const edges = pack.edges
const globals = (pack.globals || []).map((g: { key: string }) => g.key)
const templates = Object.fromEntries(
  (pack.templates || []).map((t: { key: string; content: unknown }) => [t.key, t.content]),
)
const demo: ConnectionValidationInfo = {
  id: 'demo',
  name: 'Demo',
  kind: 'http',
  inputParams: [],
  expectedResponse: {
    dataType: 'object',
    schema: [{ key: 'ok', type: 'boolean', required: false }],
    itemSchema: [],
    sampleJson: '',
  },
  responsePaths: [],
}
const issues = validateFlow(nodes, edges, {
  globalVariables: globals,
  templateKeys: Object.keys(templates),
  templateContents: templates,
  installedEntityIds: (pack.entityDefs || []).map((e: { id: string }) => e.id),
  connectionsById: { demo },
})
const errors = issues.filter((i) => i.severity === 'error')
console.log('errors', errors.length)
for (const e of errors) {
  const n = nodes.find((x: { id: string; key: string }) => x.id === e.nodeId)
  console.log(`${n?.key ?? '?'}: ${e.code} — ${e.message}`)
}
if (errors.length) process.exitCode = 1
else console.log('banking pack variable validation clean')
