import { readOnRun, type DesignerNode, type DesignerEdge } from '../model/flowSchema'
import { createInitialPreviewState, tickPreview, submitPreviewAnswer, submitPreviewSuggestion, handlePreviewButtonInteract, completeMockStep } from './previewRuntime'
import { evaluateScenario, parseScenarioExpected, parseScenarioGlobals, type ScenarioCheck } from './scenarioEval'

export type AutomatedScenario = { name: string; globals: unknown; expected: unknown }
export type AutomatedResult = { name: string; status: 'passed' | 'failed' | 'blocked'; checks: ScenarioCheck[]; nodeId?: string; visited: string[] }
const safeTypes = new Set(['message', 'button', 'question', 'set_variable', 'operation', 'condition', 'switch', 'loop', 'end', 'skip_to'])

function containsCookieExpression(value: unknown): boolean {
  if (typeof value === 'string') return /\b(?:get|set|clear|delete|remove)?cookie\s*\(/i.test(value.replace(/\\[nrt]/g, ' '))
  if (Array.isArray(value)) return value.some(containsCookieExpression)
  return !!value && typeof value === 'object' && Object.values(value).some(containsCookieExpression)
}

/** Runs only local conversation logic. External actions and browser state require manual testing. */
export function runAutomatedScenario(args: {
  scenario: AutomatedScenario; nodes: DesignerNode[]; edges: DesignerEdge[];
  globals?: Record<string, unknown>; templates?: Record<string, unknown>; maxTicks?: number;
}): AutomatedResult {
  const { scenario, nodes, edges } = args
  const expected = parseScenarioGlobals(scenario.expected)
  const answers = Array.isArray(expected.answers) ? expected.answers : []
  let answerIndex = 0
  let state = createInitialPreviewState(structuredClone(nodes), edges, structuredClone({ ...args.globals, ...parseScenarioGlobals(scenario.globals) }), [], structuredClone(args.templates ?? {}))
  const result = (status: AutomatedResult['status'], message: string): AutomatedResult => ({
    name: scenario.name, status, checks: [{ ok: false, message }], nodeId: state.currentId ?? undefined,
    visited: [...new Set(state.runs.map(r => r.nodeId))],
  })
  // Templates and fixture values can themselves contain expressions. Reject browser-state helpers
  // across all inputs before evaluation; never share real visitor cookies with automated tests.
  if (containsCookieExpression(args)) {
    return result('blocked', 'Cookie expressions require a manual preview test.')
  }
  if (!nodes.length) return result('blocked', 'The flow has no steps.')
  try {
    for (let tick = 0; tick < Math.min(args.maxTicks ?? 500, 2000); tick++) {
      if (state.phase.kind === 'finished') {
        if (state.messages.some(m => m.text.startsWith('Stopped:'))) return result('failed', 'An automatic cycle stopped the conversation.')
        if (answerIndex < answers.length) return result('failed', 'The flow ended before all scripted answers were used.')
        if (state.runs.some(r => r.status === 'Failed' || r.status === 'TimedOut')) return result('failed', 'A step failed or timed out.')
        const evaluated = evaluateScenario({ name: scenario.name, expected, vars: state.vars, runs: state.runs })
        const parsedExpected = parseScenarioExpected(expected)
        const assertions = parsedExpected.variables?.length || parsedExpected.stepKeys?.length || Object.keys(parseScenarioGlobals(expected.values)).length
        if (!assertions) return result('blocked', 'Add at least one expected variable, value, or successful step.')
        return { name: scenario.name, status: evaluated.passed ? 'passed' : 'failed', checks: evaluated.checks, visited: [...new Set(state.runs.map(r => r.nodeId))] }
      }
      const node = nodes.find(n => n.id === state.currentId)
      if (!node) return result('failed', 'The next step could not be found.')
      const mocks = parseScenarioGlobals(expected.mocks)
      if (['http','database','email','entity','integration'].includes(node.type) && Object.prototype.hasOwnProperty.call(mocks, node.key)) {
        if (readOnRun(node.config)) return result('blocked', `Mocked step "${node.key}" has an On run script requiring manual preview.`)
        const mock = parseScenarioGlobals(mocks[node.key])
        if (!Object.prototype.hasOwnProperty.call(mock, 'value')) return result('failed', `Mock "${node.key}" needs a value.`)
        if (mock.status && !['Succeeded','Failed','TimedOut','Skipped'].includes(String(mock.status))) return result('failed', 'Invalid mock status')
        state = completeMockStep(state, nodes, edges, { value: mock.value, status: mock.status as 'Succeeded' | 'Failed' | 'TimedOut' | 'Skipped' | undefined })
        continue
      }
      if (!safeTypes.has(node.type)) return result('blocked', `Step "${node.key}" (${node.type}) requires manual testing; no external action was performed.`)
      if (readOnRun(node.config)) return result('blocked', `Step "${node.key}" has an On run script; verify it in manual preview.`)
      if (node.type === 'question' && ['payment', 'otp', 'captcha', 'sign_in', 'file', 'image', 'signature'].includes(String(node.config.answerType))) return result('blocked', `Step "${node.key}" needs an interactive or external response.`)
      if (state.phase.kind === 'waiting_input' || state.phase.kind === 'waiting_suggestion' || state.phase.kind === 'waiting_button') {
        const entry = parseScenarioGlobals(answers[answerIndex])
        if (entry.step !== node.key || !Object.prototype.hasOwnProperty.call(entry, 'value')) return result('blocked', `Add scripted answer ${answerIndex + 1} for step "${node.key}".`)
        const value = entry.value
        if (state.phase.kind === 'waiting_button') {
          const button = state.phase.buttons.find(b => b.value === value)
          if (!button) return result('failed', `Unknown button value for "${node.key}".`)
          if (button.listeners.some(l => !['continue', 'skip_to'].includes(l.action))) return result('blocked', `Button on "${node.key}" has actions requiring manual preview.`)
          state = handlePreviewButtonInteract(state, nodes, edges, 'click', button).state
        } else if (state.phase.kind === 'waiting_suggestion') {
          if (typeof value !== 'string' || !state.phase.suggestions.includes(value)) return result('failed', `Invalid suggestion for "${node.key}".`)
          state = submitPreviewSuggestion(state, nodes, edges, value)
        } else {
          if (value === null || !['string', 'object'].includes(typeof value)) return result('failed', `Answer for "${node.key}" must be text, an object, or an array.`)
          state = submitPreviewAnswer(state, nodes, edges, value as Parameters<typeof submitPreviewAnswer>[3])
          if (state.phase.kind === 'waiting_input') return result('failed', `Step "${node.key}": ${state.phase.validationError ?? 'Answer did not advance the flow.'}`)
        }
        answerIndex++
      } else if (state.phase.kind === 'typing' || state.phase.kind === 'idle') {
        state = tickPreview(state, nodes, edges)
      } else return result('blocked', `Step "${node.key}" requires manual interaction.`)
    }
    return result('failed', 'Execution limit reached; check loops or shorten the scenario.')
  } catch (error) {
    return result('failed', error instanceof Error ? error.message : 'Scenario execution failed.')
  }
}
