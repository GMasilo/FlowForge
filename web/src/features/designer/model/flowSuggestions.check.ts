/**
 * Manual check: npx vite-node src/features/designer/model/flowSuggestions.check.ts
 */
import type { FlowNodeType } from '@/shared/types/database'
import {
  applyAnswerTypeSuggestion,
  shouldAutoApplyAnswerType,
  suggestAnswerTypes,
  suggestNextSteps,
} from '@/features/designer/model/flowSuggestions'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { defaultConfig } from '@/features/designer/model/flowSchema'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function topType(prompt: string) {
  return suggestAnswerTypes({ prompt })[0]
}

{
  const s = topType('What is your email address?')
  assert(s?.answerType === 'email', `email prompt → email, got ${s?.answerType}`)
  assert(s!.attributes.outputVariable === 'email', `email variable, got ${s!.attributes.outputVariable}`)
  assert(s!.score >= 0.88, 'email is high confidence')
}

{
  const s = topType('Please use your @acme.com email')
  assert(s?.answerType === 'email', 'domain mention still email')
  assert(Array.isArray(s!.attributes.allowedEmailDomains) && (s!.attributes.allowedEmailDomains as string[]).includes('acme.com'), 'allowlist domain')
}

{
  const s = topType("What's your name?")
  assert(s?.answerType === 'name', `name prompt → name, got ${s?.answerType}`)
}

{
  const s = topType('What is your phone number?')
  assert(s?.answerType === 'phone', `phone prompt → phone, got ${s?.answerType}`)
}

{
  const s = topType('Enter the 6-digit verification code we emailed you')
  assert(s?.answerType === 'otp', `otp prompt → otp, got ${s?.answerType}`)
}

{
  const s = topType('Would you like to continue?')
  assert(s?.answerType === 'boolean', `yes/no → boolean, got ${s?.answerType}`)
}

{
  const s = topType('I agree to the terms and conditions')
  assert(s?.answerType === 'confirm', `terms → confirm, got ${s?.answerType}`)
}

{
  const s = topType('Pick one: Red, Green, or Blue')
  assert(s?.answerType === 'choice', `listed options → choice, got ${s?.answerType}`)
  const choices = s!.attributes.choices as string[]
  assert(Array.isArray(choices) && choices.includes('Red') && choices.includes('Blue'), `extracted choices ${JSON.stringify(choices)}`)
}

{
  const s = topType('Rate us from 1 to 5')
  assert(s?.answerType === 'rating', `rate 1-5 → rating, got ${s?.answerType}`)
  assert(s!.attributes.min === 1 && s!.attributes.max === 5, `bounds 1-5, got ${s!.attributes.min}-${s!.attributes.max}`)
}

{
  const s = topType('How many stars would you give us?')
  assert(s?.answerType === 'stars', `stars → stars, got ${s?.answerType}`)
}

{
  const s = topType('How likely are you to recommend us to a friend?')
  assert(s?.answerType === 'nps', `recommend → nps, got ${s?.answerType}`)
}

{
  const s = topType('Please sign here')
  assert(s?.answerType === 'signature', `sign → signature, got ${s?.answerType}`)
}

{
  const s = topType('Upload your CV as a PDF')
  assert(s?.answerType === 'file', `upload → file, got ${s?.answerType}`)
  assert(s!.attributes.fileAccept === 'pdf' || s!.attributes.fileAccept === 'document', `cv/pdf accept, got ${s!.attributes.fileAccept}`)
}

{
  const s = topType('Pay now to complete your order')
  assert(s?.answerType === 'payment', `pay now → payment, got ${s?.answerType}`)
}

{
  const s = topType('Browse the store and add items to your cart')
  assert(s?.answerType === 'shop', `store → shop, got ${s?.answerType}`)
}

{
  const s = topType('What is your date of birth?')
  assert(s?.answerType === 'date', `dob → date, got ${s?.answerType}`)
}

{
  const s = topType('Book an appointment — pick a date and time')
  assert(s?.answerType === 'appointment', `book slot → appointment, got ${s?.answerType}`)
}

{
  const s = topType('South African ID number')
  assert(s?.answerType === 'national_id', `sa id → national_id, got ${s?.answerType}`)
}

{
  const applied = applyAnswerTypeSuggestion({ prompt: 'What is your email?', answerType: 'text' }, topType('What is your email?')!)
  assert(applied.answerType === 'email', 'apply sets answer type')
  assert(applied.outputVariable === 'email', 'apply sets output variable when empty')
}

{
  const applied = applyAnswerTypeSuggestion(
    { prompt: 'What is your email?', answerType: 'text', outputVariable: 'contact' },
    topType('What is your email?')!,
  )
  assert(
    applied.outputVariable == null || applied.outputVariable === 'contact',
    'apply does not overwrite an existing variable',
  )
}

{
  assert(shouldAutoApplyAnswerType({ currentAnswerType: 'text', suggestion: topType('What is your email?') }), 'auto-apply high-confidence email')
  assert(
    !shouldAutoApplyAnswerType({ currentAnswerType: 'phone', suggestion: topType('What is your email?') }),
    'do not auto-apply over a chosen type',
  )
}

function node(
  id: string,
  type: FlowNodeType,
  config: Record<string, unknown> = {},
  extra?: Partial<DesignerNode>,
): DesignerNode {
  return {
    id,
    key: extra?.key ?? id,
    type,
    label: extra?.label ?? type,
    config: { ...defaultConfig(type), ...config },
    position: { x: 0, y: 0 },
  }
}

function edge(source: string, target: string, extra?: Partial<DesignerEdge>): DesignerEdge {
  return { id: `${source}->${target}`, source, target, ...extra }
}

{
  const next = suggestNextSteps({ nodes: [], edges: [] })
  assert(next[0]?.type === 'message', `empty flow → message, got ${next[0]?.type}`)
}

{
  const nodes = [node('m1', 'message', { text: 'Welcome! Let us get started.' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'm1' })
  assert(
    next.some((s) => s.type === 'question' && s.seed?.config?.answerType === 'name'),
    `after welcome → ask name, got ${next.map((s) => s.label).join(', ')}`,
  )
}

{
  const nodes = [node('q1', 'question', { prompt: 'Name?', answerType: 'name', outputVariable: 'name' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'q1' })
  assert(
    next.some((s) => s.seed?.config?.answerType === 'email'),
    `after name → ask email, got ${next.map((s) => s.label).join(', ')}`,
  )
}

{
  const nodes = [
    node('q1', 'question', { prompt: 'Email?', answerType: 'email', outputVariable: 'email' }),
    node('q2', 'question', { prompt: 'OTP', answerType: 'otp', outputVariable: 'otp' }),
  ]
  const next = suggestNextSteps({
    nodes,
    edges: [edge('q1', 'q2')],
    afterNodeId: 'q1',
  })
  assert(
    !next.some((s) => s.seed?.config?.answerType === 'otp'),
    'do not re-suggest OTP when the next step is already OTP',
  )
}

{
  const nodes = [node('q1', 'question', { prompt: 'Continue?', answerType: 'boolean', outputVariable: 'ok' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'q1' })
  const cond = next.find((s) => s.type === 'condition')
  assert(cond, `after yes/no → condition, got ${next.map((s) => s.type).join(', ')}`)
  assert(String(cond!.seed?.config?.left ?? '').includes('vars.ok'), 'condition left uses the answer variable')
}

{
  const nodes = [node('q1', 'question', { prompt: 'Shop', answerType: 'shop', outputVariable: 'cart' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'q1' })
  const pay = next.find((s) => s.seed?.config?.answerType === 'payment')
  assert(pay, `after shop → payment, got ${next.map((s) => s.label).join(', ')}`)
  assert(String(pay!.seed?.config?.paymentAmount ?? '').includes('cart.total'), 'payment amount uses cart total')
}

{
  const nodes = [
    node('q_shop', 'question', { prompt: 'Shop', answerType: 'shop', outputVariable: 'cart' }),
    node('q1', 'question', { prompt: 'Pay', answerType: 'payment', outputVariable: 'payment' }),
    node('q0', 'question', { prompt: 'Email?', answerType: 'email', outputVariable: 'email' }),
  ]
  const next = suggestNextSteps({ nodes, edges: [edge('q0', 'q1')], afterNodeId: 'q1' })
  const email = next.find((s) => s.type === 'email')
  assert(email, `after payment with email on file → send email, got ${next.map((s) => s.type).join(', ')}`)
  const body = String(email!.seed?.config?.body ?? '')
  assert(body.includes('templates.receipt.html'), `receipt html in email body, got ${body}`)
  assert(body.includes('vars.cart.total'), `cart total in email body, got ${body}`)
  assert(body.includes('response.reference'), `payment reference in email body, got ${body}`)
  const thanks = next.find((s) => s.type === 'message')
  assert(String(thanks?.seed?.config?.text ?? '').includes('templates.receipt.text'), 'thank-you uses receipt text')
}

{
  const nodes = [node('q1', 'question', { prompt: 'Please sign', answerType: 'signature', outputVariable: 'signature' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'q1' })
  const doc = next.find((s) => s.label === 'Send filled file')
  assert(doc, `after signature → filled file, got ${next.map((s) => s.label).join(', ')}`)
  assert(String(doc!.seed?.config?.text ?? '').includes('templates.agreement.file'), 'document insert snippet')
}

{
  const nodes = [node('h1', 'http', { method: 'GET', path: '/items', outputVariable: 'items' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'h1' })
  assert(next.some((s) => s.type === 'condition'), 'after HTTP → condition')
  assert(next.some((s) => s.type === 'loop'), 'GET /items → loop')
}

{
  const nodes = [node('m1', 'message', { text: 'Thank you! You are all set.' })]
  const next = suggestNextSteps({ nodes, edges: [], afterNodeId: 'm1' })
  assert(next.some((s) => s.type === 'end'), `closing message → end, got ${next.map((s) => s.type).join(', ')}`)
}

{
  const nodes = [
    node('q1', 'question', { prompt: 'Name?', answerType: 'name', outputVariable: 'name' }),
    node('q2', 'question', { prompt: 'Email?', answerType: 'email', outputVariable: 'email' }),
  ]
  const next = suggestNextSteps({ nodes, edges: [edge('q1', 'q2')], afterNodeId: 'q2' })
  assert(
    !next.some((s) => s.seed?.config?.answerType === 'email'),
    'do not suggest asking for email again',
  )
}

{
  const s = suggestAnswerTypes({
    prompt: 'What is your email?',
    nodes: [node('q0', 'question', { prompt: 'Work email', answerType: 'email', outputVariable: 'email' })],
    currentNodeId: 'q1',
  })[0]
  assert(s?.attributes.outputVariable === 'email_2', `unique variable when taken, got ${s?.attributes.outputVariable}`)
}

console.log('flowSuggestions checks passed')
