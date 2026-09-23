import { describe, expect, test } from 'vitest'
import { parsePaymentTemplateContent, resolvePaymentQuestionConfig } from './paymentTemplate'
import { isTemplateKind, templatesExprMap, starterTemplateContent } from './templateModel'
import { buildPublishedGraph } from '@/features/designer/utils/flowPublish'
import { createInitialPreviewState, tickPreview, submitPreviewAnswer } from '@/features/designer/preview/previewRuntime'
import { validateFlow } from '@/features/designer/validation/referenceValidator'
import { parsePaymentConfig, toPaymentJson } from '@/features/connections/connectionConfig'
import type { DesignerNode } from '@/features/designer/model/flowSchema'
import { templateKeysUsedInStep } from './TemplateInputBindings'

const content = { ...parsePaymentTemplateContent({}), paymentConnectionId: 'connection', paymentAmount: '{{vars.total}}', paymentItemName: 'Order', currencyCode: 'ZAR' }
const row = { id: 'template', key: 'checkout', name: 'Checkout', kind: 'payment' as const, content }
const templates = templatesExprMap([row])
const node: DesignerNode = { id: 'pay', key: 'pay', label: 'Pay', type: 'question', position: { x: 0, y: 0 }, config: { answerType: 'payment', paymentTemplateKey: 'checkout', prompt: 'Pay now', outputVariable: 'receipt' } }

describe('payment templates', () => {
  test('registers the template and excludes provider credentials from published content', () => {
    expect(isTemplateKind('payment')).toBe(true)
    expect(starterTemplateContent('payment')).toHaveProperty('paymentAmount', '{{vars.cart.total}}')
    const unsafe = { ...content, secretKey: 'private', webhookSecret: 'private', merchantKey: 'private' }
    expect(parsePaymentTemplateContent(unsafe)).toEqual(content)
    const graph = buildPublishedGraph({ nodes: [node], edges: [], globals: [], publishVersion: 1, templates: [{ ...row, content: unsafe }] })
    expect(JSON.stringify(graph)).not.toContain('private')
  })
  test('resolves saved templates and fails closed for deleted or wrong-kind templates', () => {
    expect(resolvePaymentQuestionConfig(node.config, templates)).toHaveProperty('paymentConnectionId', 'connection')
    const stale = { ...node.config, paymentConnectionId: 'old-connection' }
    expect(resolvePaymentQuestionConfig(stale, {})).toHaveProperty('paymentConnectionId', '')
    expect(resolvePaymentQuestionConfig(stale, { checkout: { kind: 'email', paymentConnectionId: 'wrong' } })).toHaveProperty('paymentConnectionId', '')
    const direct = { answerType: 'payment', paymentConnectionId: 'direct' }
    expect(resolvePaymentQuestionConfig(direct, templates)).toBe(direct)
  })
  test('runtime resolves amounts and waits for provider verification', () => {
    let state = createInitialPreviewState([node], [], { total: 149.95 }, [], templates)
    for (let i = 0; i < 10 && state.phase.kind === 'typing'; i++) state = tickPreview(state, [node], [])
    expect(state.phase).toMatchObject({ kind: 'waiting_input', payment: { amount: '149.95', currency: 'ZAR', connectionId: 'connection', verify: true } })
    expect(submitPreviewAnswer(state, [node], [], { status: 'paid', reference: 'ref' }).vars.receipt).toBeUndefined()
    expect(submitPreviewAnswer(state, [node], [], { status: 'verified', reference: 'ref' }).vars.receipt).toEqual({ status: 'verified', reference: 'ref' })
  })
  test('designer reports a missing template and a missing connection', () => {
    const valid = validateFlow([node], [], { globalVariables: [], templateKeys: ['checkout'], templateContents: { checkout: content } })
    expect(valid.some(issue => issue.code === 'payment_verification_required')).toBe(false)
    const missing = validateFlow([node], [], { globalVariables: [], templateKeys: [], templateContents: {} })
    expect(missing.some(issue => issue.code === 'unknown_payment_template')).toBe(true)
    expect(missing.some(issue => issue.code === 'payment_verification_required')).toBe(true)
  })
  test('Stripe connection settings survive editing', () => {
    const config = parsePaymentConfig({ provider: 'stripe', secretKey: 'sk_test_example', webhookSecret: 'whsec_example' })
    expect(config.provider).toBe('stripe')
    expect(parsePaymentConfig(toPaymentJson(config))).toEqual(config)
  })
  test('payment inputs survive publication and are resolved in checkout fields', () => {
    const inputContent = parsePaymentTemplateContent({ ...content,
      inputs: [{ key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'buyerEmail', label: 'Buyer email', type: 'string', required: true }],
      paymentAmount: '{{inputs.amount}}', paymentBuyerEmail: '{{inputs.buyerEmail}}',
      paymentItemName: 'Order for {{inputs.buyerEmail}}', payButtonLabel: 'Pay {{inputs.amount}}',
    })
    const graph = buildPublishedGraph({ nodes: [node], edges: [], globals: [], publishVersion: 1, templates: [{ ...row, content: inputContent }] })
    const inputTemplates = templatesExprMap(graph.templates ?? [])
    const inputNode: DesignerNode = { ...node, config: { ...node.config, templateBindings: { checkout: { amount: '{{vars.total}}', buyerEmail: '{{vars.email}}' } } } }
    let state = createInitialPreviewState([inputNode], [], { total: 75.5, email: 'buyer@example.com' }, [], inputTemplates)
    for (let i = 0; i < 10 && state.phase.kind === 'typing'; i++) state = tickPreview(state, [inputNode], [])
    expect(state.phase).toMatchObject({ kind: 'waiting_input', payment: { amount: '75.5', buyerEmail: 'buyer@example.com', itemName: 'Order for buyer@example.com', payLabel: 'Pay 75.5' } })
    expect(templateKeysUsedInStep(node.config)).toContain('checkout')
    const missing = validateFlow([node], [], { globalVariables: [], templateKeys: ['checkout'], templateContents: { checkout: inputContent } })
    expect(missing.filter(issue => issue.code === 'unbound_template_input')).toHaveLength(2)
    const bound = validateFlow([inputNode], [], { globalVariables: ['total', 'email'], templateKeys: ['checkout'], templateContents: { checkout: inputContent } })
    expect(bound.some(issue => issue.code === 'unbound_template_input')).toBe(false)
  })
})
