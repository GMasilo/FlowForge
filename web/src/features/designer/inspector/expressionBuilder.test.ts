import { expect, it } from 'vitest'
import { buildExpression } from './expressionBuilderModel'
import { evaluateExpression, validateExpressionText } from '../preview/expressionEval'
it('quotes literal text safely and preserves number precedence', () => {
  const text = buildExpression('join', [{ kind: 'text', value: 'A "quoted" value' }, { kind: 'text', value: '!' }])
  expect(evaluateExpression(text, { vars: {}, steps: {} })).toBe('A "quoted" value!')
  const math = buildExpression('multiply', [{ kind: 'expression', value: '{{2 + 3}}' }, { kind: 'number', value: '4' }])
  expect(evaluateExpression(math, { vars: {}, steps: {} })).toBe(20)
})
it('rejects missing numbers and invalid functions', () => {
  expect(() => buildExpression('add', [{ kind: 'number', value: '' }])).toThrow()
  expect(validateExpressionText(buildExpression('date', [{ kind: 'expression', value: 'ucNow()' }, { kind: 'text', value: 'yyyy-MM-dd' }]))).toContain('Unknown function')
})
