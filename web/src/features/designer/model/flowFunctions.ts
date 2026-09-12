/**
 * Functions available to Button → Run function (and future step actions).
 * Includes every app expression helper, plus setVar as a side-effecting action.
 */

import { EXPRESSION_FUNCTIONS } from '@/features/docs/content'

export type FlowFunctionParamDef = {
  key: string
  label: string
  hint?: string
  required?: boolean
  multiline?: boolean
  placeholder?: string
}

export type FlowFunctionKind = 'runtime' | 'expression' | 'host'

export type FlowFunctionDef = {
  /** Stable id used in config, e.g. setVar / toUpper */
  name: string
  /** Shown in the dropdown, e.g. setVar(varName, varValue) */
  label: string
  description: string
  /**
   * runtime = engine side effects (setVar)
   * expression = pure helpers from the expression language
   * host = postMessage to embed parent
   */
  kind: FlowFunctionKind
  params: FlowFunctionParamDef[]
}

const RESULT_VARIABLE_PARAM: FlowFunctionParamDef = {
  key: 'resultVariable',
  label: 'Store result in',
  hint: 'Variable name to assign the return value (without {{vars.}})',
  required: true,
  placeholder: 'result',
}

/** Parse `fn(a, b, …)` into ordered parameter defs. */
export function paramsFromSignature(signature: string): FlowFunctionParamDef[] {
  const open = signature.indexOf('(')
  const close = signature.lastIndexOf(')')
  if (open < 0 || close <= open) return []
  const inner = signature.slice(open + 1, close).trim()
  if (!inner) return []

  const parts = inner.split(',').map((p) => p.trim()).filter(Boolean)
  const out: FlowFunctionParamDef[] = []
  let variadicIndex = 0

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (part === '…' || part === '...' || part.includes('…') || part.includes('...')) {
      for (let j = 0; j < 3; j++) {
        variadicIndex += 1
        out.push({
          key: `arg${variadicIndex}`,
          label: `arg${variadicIndex}`,
          required: false,
          placeholder: 'optional extra argument',
        })
      }
      continue
    }
    const key = part.replace(/[^\w]/g, '') || `arg${i + 1}`
    out.push({
      key,
      label: part,
      required: i === 0,
      placeholder: part,
    })
  }
  return out
}

const SET_VAR: FlowFunctionDef = {
  name: 'setVar',
  label: 'setVar(varName, varValue)',
  description: 'Set a flow variable immediately (available as {{vars.name}} on later steps).',
  kind: 'runtime',
  params: [
    {
      key: 'varName',
      label: 'varName',
      hint: 'Variable key without {{vars.}} — e.g. status',
      required: true,
      placeholder: 'status',
    },
    {
      key: 'varValue',
      label: 'varValue',
      hint: 'Literal or template, e.g. ready or {{vars.user.email}}',
      required: true,
      multiline: true,
      placeholder: 'value or {{vars.…}}',
    },
  ],
}

const SET_COOKIE: FlowFunctionDef = {
  name: 'setCookie',
  label: 'setCookie(name, value, days?)',
  description:
    'Save a browser cookie for later visits to this chatbot only (returning users). Optional days defaults to 365; use 0 for session.',
  kind: 'runtime',
  params: [
    {
      key: 'name',
      label: 'name',
      hint: 'Cookie key, e.g. email',
      required: true,
      placeholder: 'email',
    },
    {
      key: 'value',
      label: 'value',
      hint: 'Literal or template to store',
      required: true,
      multiline: true,
      placeholder: '{{vars.email}}',
    },
    {
      key: 'days',
      label: 'days',
      hint: 'Lifetime in days (default 365). Use 0 for a session cookie.',
      required: false,
      placeholder: '365',
    },
  ],
}

const CLEAR_COOKIE: FlowFunctionDef = {
  name: 'clearCookie',
  label: 'clearCookie(name)',
  description: 'Delete a saved FlowForge chat cookie for this chatbot.',
  kind: 'runtime',
  params: [
    {
      key: 'name',
      label: 'name',
      hint: 'Cookie key to remove',
      required: true,
      placeholder: 'email',
    },
  ],
}

const RUNTIME_ACTIONS: FlowFunctionDef[] = [SET_VAR, SET_COOKIE, CLEAR_COOKIE]
const RUNTIME_ACTION_NAMES = new Set(RUNTIME_ACTIONS.map((fn) => fn.name))

function expressionFunctionDefs(): FlowFunctionDef[] {
  return EXPRESSION_FUNCTIONS.filter((fn) => !RUNTIME_ACTION_NAMES.has(fn.name)).map((fn) => {
    const params = [...paramsFromSignature(fn.signature), RESULT_VARIABLE_PARAM]
    const aliasNote = fn.aliases?.length ? ` Aliases: ${fn.aliases.join(', ')}.` : ''
    return {
      name: fn.name,
      label: fn.signature,
      description: `${fn.description}${aliasNote}`,
      kind: 'expression' as const,
      params,
    }
  })
}

/** Runtime actions first (setVar, cookies), then every documented expression function. */
export const FLOW_FUNCTIONS: FlowFunctionDef[] = [...RUNTIME_ACTIONS, ...expressionFunctionDefs()]

export const FLOW_FUNCTION_OPTIONS = FLOW_FUNCTIONS.map((fn) => ({
  value: fn.name,
  label: fn.label,
  description: fn.description,
  kind: fn.kind,
}))

export function getFlowFunction(name: string | undefined | null): FlowFunctionDef | undefined {
  const key = String(name ?? '').trim()
  if (!key) return undefined
  const exact = FLOW_FUNCTIONS.find((fn) => fn.name === key)
  if (exact) return exact
  const lower = key.toLowerCase()
  return FLOW_FUNCTIONS.find((fn) => {
    if (fn.name.toLowerCase() === lower) return true
    if (fn.kind !== 'expression') return false
    const doc = EXPRESSION_FUNCTIONS.find((d) => d.name === fn.name)
    return doc?.aliases?.some((a) => a.toLowerCase() === lower) ?? false
  })
}

export function emptyFunctionParams(def?: FlowFunctionDef | null): Record<string, string> {
  if (!def) return {}
  const out: Record<string, string> = {}
  for (const p of def.params) out[p.key] = ''
  return out
}

/** Parse stored params; migrate legacy functionArgs JSON blob when needed. */
export function parseFunctionParams(
  raw: unknown,
  legacyArgs?: string,
): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v
      else if (v == null) out[k] = ''
      else out[k] = String(v)
    }
    return out
  }
  const trimmed = String(legacyArgs ?? '').trim()
  if (!trimmed) return {}
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parseFunctionParams(parsed)
    }
  } catch {
    // ignore
  }
  return {}
}

/** Coerce a template/literal string into a stored / call argument value. */
export function coerceFunctionParamValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isFinite(n)) return n
  }
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return raw
  }
}

/** Ordered call args for an expression function (excludes resultVariable). */
export function expressionCallArgs(
  def: FlowFunctionDef,
  params: Record<string, string>,
): unknown[] {
  const args: unknown[] = []
  for (const p of def.params) {
    if (p.key === 'resultVariable') continue
    const raw = params[p.key]
    if (raw == null || String(raw).trim() === '') {
      args.push(undefined)
      continue
    }
    args.push(coerceFunctionParamValue(String(raw)))
  }
  while (args.length && args[args.length - 1] === undefined) args.pop()
  return args
}
