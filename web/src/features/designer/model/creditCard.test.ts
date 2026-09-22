import { test, expect } from 'vitest'
import './creditCard.check'
import { createInitialPreviewState, submitPreviewAnswer, tickPreview } from '../preview/previewRuntime'
import type { DesignerNode } from './flowSchema'

test('credit card answers are masked in successful and failed chat messages', () => {
  const nodes: DesignerNode[] = [{
    id: 'card', key: 'card', type: 'question', label: 'Card number', position: { x: 0, y: 0 },
    config: { prompt: 'Enter a card number', answerType: 'credit_card', outputVariable: 'cardNumber', answerRequired: true },
  }]
  let state = createInitialPreviewState(nodes, [], {})
  for (let i = 0; i < 10 && state.phase.kind === 'typing'; i++) state = tickPreview(state, nodes, [])
  expect(state.phase.kind).toBe('waiting_input')
  const rejected = submitPreviewAnswer(state, nodes, [], { number: '4111111111111112', expiry: '12/99', cvv: '987' })
  expect(rejected.phase.kind).toBe('waiting_input')
  expect(JSON.stringify(rejected.messages)).not.toContain('4111111111111112')
  expect(JSON.stringify(rejected.messages)).not.toContain('987')
  const accepted = submitPreviewAnswer(state, nodes, [], { number: '4111 1111 1111 1111', expiry: '12/99', cvv: '987' })
  expect(accepted.vars.cardNumber).toEqual({ number: '4111111111111111', expiry: '12/99', cvv: '987' })
  expect(JSON.stringify(accepted.messages)).toContain('Card ending in 1111')
  expect(JSON.stringify(accepted.messages)).not.toContain('4111111111111111')
  expect(JSON.stringify(accepted.messages)).not.toContain('987')
  expect(JSON.stringify(accepted.messages)).not.toContain('12/99')
})
