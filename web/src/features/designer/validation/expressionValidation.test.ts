import { describe, expect, it } from 'vitest'
import { validateFlow } from './referenceValidator'
import { validateExpressionText } from '../preview/expressionEval'
import type { DesignerNode } from '../model/flowSchema'

const node = (config: Record<string, unknown>): DesignerNode => ({ id: 'message', key: 'certificate', label: 'Certificate', type: 'message', position: { x: 0, y: 0 }, config })
const errors = (config: Record<string, unknown>, templateContents?: Record<string, unknown>) => validateFlow([node(config)], [], { globalVariables: [], templateContents }).filter(issue => issue.code === 'invalid_expression')
describe('Problems expression validation', () => {
  it.each(['formatDate(ucNow(), "yyyy-MM-dd")', '{{formatDate(ucNow(), "yyyy-MM-dd")}}'])('reports the typo in %s', text => {
    expect(errors({ text })).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'error', nodeId: 'message', field: 'text', message: expect.stringContaining('Unknown function "ucNow"') })]))
  })
  it('reports bindings with their exact field', () => {
    expect(errors({ templateBindings: { cert: { date: 'ucNow()' } } })[0]?.field).toBe('templateBindings.cert.date')
  })
  it('checks referenced templates recursively and tolerates cycles', () => {
    const issues = errors({ text: '{{templates.cert.file}}' }, { cert: { body: '{{templates.other.file}}' }, other: { body: '{{ucNow()}} {{templates.cert.file}}' } })
    expect(issues[0]?.field).toBe('templates.other.body')
    expect(issues[0]?.message).toContain('ucNow')
  })
  it('reports broken syntax and clears when corrected', () => {
    expect(errors({ text: '{{formatDate(utcNow(), }}' })).toHaveLength(1)
    expect(errors({ text: '{{formatDate(utcNow(), "yyyy-MM-dd")}}' })).toHaveLength(0)
  })
  it('checks multiline on-run scripts without executing them', () => {
    expect(errors({ onRun: `// Comment
setVar("name", "Changed")
ucNow()` })).toHaveLength(1)
    expect(validateExpressionText('{{parseJson(vars.futureResponse)}}')).toBeNull()
    expect(validateExpressionText('{{setCookie("name", "value")}}')).toBeNull()
    expect(validateExpressionText('Hello there')).toBeNull()
    expect(validateExpressionText('{{tabulate(vars.records)}}')).toBeNull()
  })
})

it('treats saved entity and connection UUIDs as literals', () => {
  expect(errors({ entityId: '12dd4955-1234-4567-89ab-0123456789ab', connectionId: '1de6769b-1234-4567-89ab-0123456789ab' })).toHaveLength(0)
  expect(validateExpressionText('1 + )')).not.toBeNull()
  expect(validateExpressionText('ucNow()')).toContain('Unknown function')
})
