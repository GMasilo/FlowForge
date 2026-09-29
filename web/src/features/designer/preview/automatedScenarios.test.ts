import { describe, it, expect, vi } from 'vitest'
import { runAutomatedScenario } from './automatedScenarios'
import { evaluateScenario } from './scenarioEval'
import { defaultConfig, type DesignerNode, type DesignerEdge } from '../model/flowSchema'
const node = (key: string, type: DesignerNode['type'], config: Record<string, unknown> = {}): DesignerNode => ({ id: key, key, type, label: key, config: { ...defaultConfig(type), ...config }, position: { x: 0, y: 0 } })
const edges = (...keys: string[]): DesignerEdge[] => keys.slice(1).map((key, i) => ({ id: `${i}`, source: keys[i], target: key }))
const run = (nodes: DesignerNode[], expected: unknown, graph = edges(...nodes.map(n => n.key)), maxTicks?: number) => runAutomatedScenario({ scenario: { name: 'Test', globals: {}, expected }, nodes, edges: graph, maxTicks })
describe('automatic conversation checks', () => {
  it('uses real question validation and verifies the saved answer', () => {
    const result = run([node('name', 'question', { outputVariable: 'name' }), node('done', 'end')], { answers: [{ step: 'name', value: 'Alex' }], stepKeys: ['done'], values: { name: 'Alex' } })
    expect(result.status).toBe('passed')
    expect(result.visited).toEqual(['name', 'done'])
  })
  it('fails invalid answers without advancing', () => {
    const result = run([node('email', 'question', { answerType: 'email' }), node('done', 'end')], { answers: [{ step: 'email', value: 'not an email' }], stepKeys: ['done'] })
    expect(result.status).toBe('failed')
    expect(result.nodeId).toBe('email')
  })
  it('blocks missing answers and empty assertions', () => {
    expect(run([node('ask', 'question')], { stepKeys: ['ask'] }).status).toBe('blocked')
    expect(run([node('done', 'end')], {}).status).toBe('blocked')
  })
  it('fails unused answers and wrong expected values', () => {
    expect(run([node('done', 'end')], { answers: [{ step: 'missing', value: 'x' }], stepKeys: ['done'] }).status).toBe('failed')
    expect(run([node('done', 'end')], { values: { absent: 42 } }).status).toBe('failed')
  })
  it('never executes an external integration or payment', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network allowed'))
    try {
      for (const type of ['http', 'email', 'database', 'entity', 'integration', 'transfer', 'sign_in', 'handoff'] as const) expect(run([node('external', type)], { stepKeys: ['external'] }).status).toBe('blocked')
      expect(run([node('pay', 'question', { answerType: 'payment' })], { stepKeys: ['pay'] }).status).toBe('blocked')
      expect(fetchMock).not.toHaveBeenCalled()
    } finally { fetchMock.mockRestore() }
  })
  it('rejects cookie helpers in templates before evaluation', () => {
    const result = runAutomatedScenario({ scenario: { name: 'cookies', globals: {}, expected: { stepKeys: ['end'] } }, nodes: [node('end', 'end')], edges: [], templates: { dangerous: { text: '{{setCookie("x", "y")}}' } } })
    expect(result.status).toBe('blocked')
  })
  it('allows ordinary cookie text but blocks multiline cookie calls', () => {
    expect(run([node('done', 'end', { message: 'Would you like a cookie?' })], { stepKeys: ['done'] }).status).toBe('passed')
    expect(run([node('done', 'end', { message: '{{setCookie\n("key", "value")}}' })], { stepKeys: ['done'] }).status).toBe('blocked')
  })
  it('fails automatic cycles and bounded execution', () => {
    const graph = [node('a', 'message'), node('b', 'message')]
    expect(run(graph, { stepKeys: ['a'] }, [...edges('a', 'b'), { id: 'back', source: 'b', target: 'a' }]).status).toBe('failed')
    expect(run(graph, { stepKeys: ['a'] }, edges('a', 'b'), 1).checks[0].message).toContain('Execution limit')
  })
  it('runs simple button choices and blocks buttons with side effects', () => {
    const button = node('choose', 'button', { outputVariable: 'choice', buttons: [{ id: 'one', label: 'Choose', value: 'yes', listeners: [{ event: 'click', action: 'continue' }] }] })
    const expected = { answers: [{ step: 'choose', value: 'yes' }], values: { choice: 'yes' }, stepKeys: ['end'] }
    expect(run([button, node('end', 'end')], expected).status).toBe('passed')
    button.config.buttons = [{ id: 'one', label: 'Choose', value: 'yes', listeners: [{ event: 'click', action: 'emit_event' }] }]
    expect(run([button, node('end', 'end')], expected).status).toBe('blocked')
  })
  it('compares object values regardless of property insertion order', () => {
    expect(evaluateScenario({ name: 'object', expected: { values: { user: { a: 1, b: 2 } } }, vars: { user: { b: 2, a: 1 } }, runs: [] }).passed).toBe(true)
  })
})
