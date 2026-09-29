import { getStepOutputVariables, type DesignerNode } from '@/features/designer/model/flowSchema'

export function scenarioSuggestions(nodes: DesignerNode[], globals: Record<string, unknown> = {}) {
  const variables = new Map<string, string[]>()
  for (const key of Object.keys(globals)) variables.set(key, ['Global'])
  for (const node of nodes) for (const key of getStepOutputVariables(node)) {
    const name = key.trim()
    if (name) variables.set(name, [...new Set([...(variables.get(name) ?? []), node.label || node.key])])
  }
  return {
    variables: [...variables].sort(([a], [b]) => a.localeCompare(b)).map(([key, sources]) => ({key, label: `${key} — ${sources.join(', ')}`})),
    steps: nodes.map(n => ({key:n.key, label:`${n.label || n.key} (${n.key})`})),
    answers: nodes.filter(n => n.type === 'question' || n.type === 'button').map(n => ({key:n.key, label:`${n.label || n.key} (${n.key}) — ${n.type === 'question' ? String(n.config.answerType ?? 'text') : 'button value'}`})),
    mocks: nodes.filter(n => ['http','database','email','entity','integration'].includes(n.type)).map(n => ({key:n.key,label:`${n.label || n.key} (${n.key})`})),
  }
}

export function addScenarioName(text: string, key: string): string {
  return [...new Set([...text.split(/[\s,]+/).filter(Boolean), key])].join(', ')
}

/** Explicit additions preserve existing fixtures and reject malformed JSON. */
export function addScenarioEntry(text: string, key: string, value: unknown): string {
  let current: unknown
  try { current = JSON.parse(text) } catch { throw new Error('Correct the JSON in this field before adding a flow suggestion.') }
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('This field must contain a JSON object.')
  if (Object.prototype.hasOwnProperty.call(current, key)) throw new Error(`"${key}" already has a value. Edit it in the field below.`)
  return JSON.stringify({...current, [key]:value}, null, 2)
}

export function addScenarioAnswer(text: string, key: string): string {
  let current: unknown
  try { current = JSON.parse(text) } catch { throw new Error('Correct the scripted answers JSON before adding a step.') }
  if (!Array.isArray(current)) throw new Error('Scripted answers must be a JSON array.')
  return JSON.stringify([...current, {step:key,value:''}], null, 2)
}
