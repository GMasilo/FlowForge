/**
 * Manual check: npx vite-node src/features/designer/preview/scenarioEval.check.ts
 */
import { evaluateScenario } from '@/features/designer/preview/scenarioEval'
import type { PreviewStepRun } from '@/features/designer/preview/previewRuntime'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const runs = [
  { nodeKey: 'ask_name', status: 'Succeeded' },
  { nodeKey: 'send', status: 'Failed' },
] as PreviewStepRun[]

const pass = evaluateScenario({
  name: 'VIP',
  expected: { variables: ['name'], stepKeys: ['ask_name'] },
  vars: { name: 'Ada' },
  runs,
})
assert(pass.passed, 'expected pass')

const fail = evaluateScenario({
  name: 'VIP',
  expected: { variables: ['email'], stepKeys: ['send'] },
  vars: { name: 'Ada' },
  runs,
})
assert(!fail.passed, 'expected fail')
assert(fail.checks.length === 2, 'two checks')

console.log('scenarioEval.check.ts: all passed')
