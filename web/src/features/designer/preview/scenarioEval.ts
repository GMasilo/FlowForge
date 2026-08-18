import type { PreviewStepRun } from '@/features/designer/preview/previewRuntime'

export type ScenarioExpected = {
  variables?: string[]
  stepKeys?: string[]
}

export type ScenarioCheck = {
  ok: boolean
  message: string
}

export type ScenarioResult = {
  name: string
  passed: boolean
  checks: ScenarioCheck[]
}

export function parseScenarioExpected(raw: unknown): ScenarioExpected {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const rec = raw as Record<string, unknown>
  const variables = Array.isArray(rec.variables)
    ? rec.variables.map((v) => String(v).trim()).filter(Boolean)
    : typeof rec.variables === 'string'
      ? rec.variables.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean)
      : []
  const stepKeys = Array.isArray(rec.stepKeys)
    ? rec.stepKeys.map((v) => String(v).trim()).filter(Boolean)
    : typeof rec.stepKeys === 'string'
      ? rec.stepKeys.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean)
      : Array.isArray(rec.steps)
        ? rec.steps.map((v) => String(v).trim()).filter(Boolean)
        : []
  return { variables, stepKeys }
}

export function parseScenarioGlobals(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return { ...(raw as Record<string, unknown>) }
}

export function evaluateScenario(args: {
  name: string
  expected: unknown
  vars: Record<string, unknown>
  runs: PreviewStepRun[]
}): ScenarioResult {
  const expected = parseScenarioExpected(args.expected)
  const checks: ScenarioCheck[] = []
  for (const key of expected.variables ?? []) {
    const present = Object.prototype.hasOwnProperty.call(args.vars, key) && args.vars[key] != null && args.vars[key] !== ''
    checks.push({
      ok: present,
      message: present ? `Variable "${key}" is set` : `Missing variable "${key}"`,
    })
  }
  const succeeded = new Set(
    args.runs.filter((r) => r.status === 'Succeeded').map((r) => r.nodeKey),
  )
  for (const key of expected.stepKeys ?? []) {
    const ok = succeeded.has(key)
    checks.push({
      ok,
      message: ok ? `Step "${key}" succeeded` : `Step "${key}" did not succeed`,
    })
  }
  if (!checks.length) {
    checks.push({ ok: true, message: 'No expected checks — run recorded' })
  }
  return {
    name: args.name,
    passed: checks.every((c) => c.ok),
    checks,
  }
}
