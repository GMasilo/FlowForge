/**
 * Manual check: npx vite-node src/features/designer/preview/paymentCaptchaForm.check.ts
 */
import {
  createInitialPreviewState,
  refreshCaptchaChallenge,
  submitPreviewAnswer,
  tickPreview,
  type PreviewEngineState,
} from './previewRuntime'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function runUntilWait(state: PreviewEngineState, nodes: DesignerNode[], edges: DesignerEdge[]) {
  let next = state
  let guard = 0
  while (next.phase.kind === 'typing' && next.currentId && guard < 10) {
    next = tickPreview(next, nodes, edges)
    guard += 1
  }
  return next
}

{
  const nodes: DesignerNode[] = [
    {
      id: 'pay',
      key: 'pay',
      type: 'question',
      label: 'Pay',
      config: {
        prompt: 'Please pay {{vars.total}}',
        answerType: 'payment',
        payUrl: 'https://pay.example/{{vars.order}}',
        paymentAmount: '{{vars.total}}',
        currencyCode: 'ZAR',
        outputVariable: 'receipt',
        answerRequired: true,
        runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
        delaySeconds: 0,
        timeoutSeconds: 0,
      },
      position: { x: 0, y: 0 },
    },
  ]
  const edges: DesignerEdge[] = []
  let state = createInitialPreviewState(nodes, edges, { total: 150, order: 'abc' })
  state = runUntilWait(state, nodes, edges)
  assert(state.phase.kind === 'waiting_input', 'payment waits')
  if (state.phase.kind === 'waiting_input') {
    assert(state.phase.payment?.url === 'https://pay.example/abc', 'pay url interpolated')
    assert(state.phase.payment?.amount === '150', 'amount interpolated')
  }
  state = submitPreviewAnswer(state, nodes, edges, {
    status: 'paid',
    url: 'https://pay.example/abc',
    amount: 150,
    currency: 'ZAR',
  })
  assert(state.vars.receipt && (state.vars.receipt as { status: string }).status === 'paid', 'payment stored')
  assert(state.messages.some((m) => m.role === 'user' && m.link?.url === 'https://pay.example/abc'), 'payment user link')
}

{
  const nodes: DesignerNode[] = [
    {
      id: 'cap',
      key: 'cap',
      type: 'question',
      label: 'Captcha',
      config: {
        prompt: 'Prove you are human',
        answerType: 'captcha',
        captchaKind: 'math',
        captchaMaxAttempts: 3,
        outputVariable: 'human',
        answerRequired: true,
        runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
        delaySeconds: 0,
        timeoutSeconds: 0,
      },
      position: { x: 0, y: 0 },
    },
  ]
  const edges: DesignerEdge[] = []
  let state = createInitialPreviewState(nodes, edges, {})
  state = runUntilWait(state, nodes, edges)
  assert(state.phase.kind === 'waiting_input' && state.captchaChallenge, 'captcha wait')
  const firstAnswer = state.captchaChallenge!.answer
  const firstPrompt =
    state.phase.kind === 'waiting_input' ? state.phase.captchaPrompt : ''
  assert(firstPrompt && !JSON.stringify(state.vars).includes(firstAnswer), 'solution not in vars')
  state = submitPreviewAnswer(state, nodes, edges, 'nope')
  assert(state.phase.kind === 'waiting_input', 'wrong captcha stays')
  assert(state.captchaChallenge?.attempts === 1, 'captcha attempts increment')
  state = refreshCaptchaChallenge(state, nodes)
  const refreshed = state.captchaChallenge!.answer
  assert(state.captchaChallenge?.attempts === 1, 'refresh keeps attempts')
  state = submitPreviewAnswer(state, nodes, edges, refreshed)
  assert((state.vars.human as { ok?: boolean })?.ok === true, 'captcha stores ok flag')
  assert(JSON.stringify(state.vars.human) === JSON.stringify({ ok: true }), 'solution not stored')
}

{
  const nodes: DesignerNode[] = [
    {
      id: 'form',
      key: 'form',
      type: 'question',
      label: 'Form',
      config: {
        prompt: 'Your details',
        answerType: 'form',
        formFields: [
          { key: 'name', label: 'Name', type: 'name', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
        ],
        outputVariable: 'contact',
        answerRequired: true,
        runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
        delaySeconds: 0,
        timeoutSeconds: 0,
      },
      position: { x: 0, y: 0 },
    },
  ]
  const edges: DesignerEdge[] = []
  let state = createInitialPreviewState(nodes, edges, {})
  state = runUntilWait(state, nodes, edges)
  state = submitPreviewAnswer(state, nodes, edges, { name: 'Ada', email: 'ada@x.com' })
  const contact = state.vars.contact as { name?: string; email?: string }
  assert(contact?.name === 'Ada' && contact?.email === 'ada@x.com', 'form object stored')
}

console.log('paymentCaptchaForm.check.ts: all passed')
