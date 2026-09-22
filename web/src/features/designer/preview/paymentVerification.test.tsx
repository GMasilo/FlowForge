import { describe, expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PaymentAnswerField, type PaymentPhase } from '@/features/chat/PaymentAnswerField'
import { validateQuestionAnswer } from '../model/answerValidation'
import { validateFlow } from '../validation/referenceValidator'
import { createInitialPreviewState, submitPreviewAnswer, tickPreview } from './previewRuntime'
import type { DesignerNode } from '../model/flowSchema'
import './paymentCaptchaForm.check'
import '../model/answerValidation.check'

const payment: PaymentPhase = { url: 'https://example.com/pay', amount: '150', currency: 'ZAR', payLabel: 'Pay now', paidLabel: "I've paid", verify: true, connectionId: 'payment-connection' }
const config = { answerType: 'payment', paymentConnectionId: 'payment-connection', answerRequired: true }
describe('payment verification', () => {
  test('missing callbacks never expose a manual confirmation button', () => {
    const html = renderToStaticMarkup(<PaymentAnswerField payment={payment} onSubmit={() => { throw new Error('Must not submit') }} />)
    expect(html).toContain('Payment verification is unavailable')
    expect(html).not.toContain('<button')
    const missingCheck = renderToStaticMarkup(<PaymentAnswerField payment={payment} onStartPayment={async () => ({ reference: 'ref', checkoutUrl: 'https://example.com' })} onSubmit={() => {}} />)
    expect(missingCheck).not.toContain('<button')
  })
  test('manual, pending, failed and unreferenced answers cannot pass', () => {
    for (const status of ['paid', 'pending', 'failed', 'cancelled']) {
      expect(validateQuestionAnswer(config, { status, reference: 'ref' }).ok).toBe(false)
      expect(validateQuestionAnswer({ ...config, answerRequired: false }, { status, reference: 'ref' }).ok).toBe(false)
    }
    expect(validateQuestionAnswer(config, { status: 'verified' }).ok).toBe(false)
    expect(validateQuestionAnswer({ answerType: 'payment' }, { status: 'verified', reference: 'ref' }).ok).toBe(false)
    expect(validateQuestionAnswer(config, { status: 'verified', reference: 'ref' }).ok).toBe(true)
  })
  test('runtime waits for verified payment and designer flags missing setup', () => {
    const node: DesignerNode = { id: 'pay', key: 'pay', label: 'Pay', type: 'question', position: { x: 0, y: 0 }, config: { ...config, prompt: 'Pay now', outputVariable: 'receipt' } }
    let state = createInitialPreviewState([node], [], {})
    for (let i = 0; i < 10 && state.phase.kind === 'typing'; i++) state = tickPreview(state, [node], [])
    const rejected = submitPreviewAnswer(state, [node], [], { status: 'paid', reference: 'ref' })
    expect(rejected.phase.kind).toBe('waiting_input')
    expect(rejected.vars.receipt).toBeUndefined()
    const accepted = submitPreviewAnswer(state, [node], [], { status: 'verified', reference: 'ref' })
    expect(accepted.vars.receipt).toEqual({ status: 'verified', reference: 'ref' })
    const issues = validateFlow([{ ...node, config: { ...node.config, paymentConnectionId: '' } }], [], { globalVariables: [] })
    expect(issues.some(issue => issue.code === 'payment_verification_required' && issue.severity === 'error')).toBe(true)
  })
})
