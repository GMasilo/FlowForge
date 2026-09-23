import { beforeEach, describe, expect, test } from 'vitest'
import { cleanQuestionConfig, cleanQuestionNodes, questionResponseFields } from './questionConfigCleanup'
import { questionAnswerTypes, type DesignerNode } from './flowSchema'
import { useDesignerStore } from '../store/designerStore'

const common = { prompt: 'Your answer?', outputVariable: 'answer', answerRequired: true, mediaFiles: ['image.png'], delaySeconds: 2 }
const node = (config: Record<string, unknown>): DesignerNode => ({ id: 'q', key: 'q', label: 'Question', type: 'question', position: { x: 0, y: 0 }, config })
beforeEach(() => useDesignerStore.getState().setPeerLocks({}))

describe('question response cleanup', () => {
  test('every type starts clean when switched from every other type', () => {
    for (const oldType of questionAnswerTypes) {
      const old = cleanQuestionConfig({ ...common, answerType: oldType }, true)
      for (const type of questionAnswerTypes) {
        if (oldType === type) continue
        const changed = cleanQuestionConfig({ ...old, answerType: type }, true)
        expect(changed).toEqual(cleanQuestionConfig({ ...common, answerType: type }, true))
        expect(Object.values(changed)).not.toContain(null)
      }
    }
  })
  test('load removes incompatible fields and nulls but preserves current validation', () => {
    const polluted = Object.fromEntries(questionResponseFields.map(key => [key, null]))
    const result = cleanQuestionConfig({ ...polluted, ...common, answerType: 'text', minLength: 3, pattern: '^a', otpTemplateKey: 'otp', paymentConnectionId: 'pay', min: 8, phoneFormat: 'e164' })
    expect(result).toEqual({ ...common, answerType: 'text', minLength: 3, pattern: '^a' })
    expect(cleanQuestionConfig(result)).toEqual(result)
  })
  test('removes retired response bindings while keeping templates referenced by the prompt', () => {
    const old = { ...common, answerType: 'otp', otpTemplateKey: 'email', paymentTemplateKey: 'checkout', templateBindings: { email: { name: 'A' }, checkout: { amount: '10' } } }
    const changed = cleanQuestionConfig({ ...old, answerType: 'text', prompt: '{{templates.email.html}}' }, true)
    expect(changed.templateBindings).toEqual({ email: { name: 'A' } })
    expect(changed).not.toHaveProperty('otpTemplateKey')
    expect(changed).not.toHaveProperty('paymentTemplateKey')
  })
  test('store switching resets shared response settings and supports undo', () => {
    const store = useDesignerStore.getState()
    store.setFlow({ flowId: 'flow', nodes: [node({ ...common, answerType: 'slider', min: 5, max: 10 })], edges: [], globalVariables: [] })
    store.updateNode('q', { config: { ...useDesignerStore.getState().nodes[0].config, answerType: 'number' } })
    expect(useDesignerStore.getState().nodes[0].config).not.toHaveProperty('min')
    expect(useDesignerStore.getState().nodes[0].config).not.toHaveProperty('max')
    store.undo()
    expect(useDesignerStore.getState().nodes[0].config).toMatchObject({ answerType: 'slider', min: 5, max: 10 })
  })
  test('load cleanup marks only changed questions for saving and leaves other steps alone', () => {
    const question = node({ ...common, answerType: 'email', allowedEmailDomains: ['example.com'], otpBody: 'stale' })
    const message: DesignerNode = { ...node({ text: 'Hello', min: 1 }), id: 'm', key: 'm', type: 'message' }
    expect(cleanQuestionNodes([question, message])[1]).toBe(message)
    useDesignerStore.getState().setFlow({ flowId: 'flow', nodes: [question, message], edges: [], globalVariables: [] })
    const state = useDesignerStore.getState()
    expect(state.dirty).toBe(true)
    expect(state.dirtyNodeKeys).toEqual(['q'])
    expect(state.nodes[0].config).not.toHaveProperty('otpBody')
    expect(state.nodes[0].config.allowedEmailDomains).toEqual(['example.com'])
    state.setFlow({ flowId: 'flow', nodes: state.nodes, edges: [], globalVariables: [] })
    expect(useDesignerStore.getState().dirty).toBe(false)
  })
})
