/**
 * Manual check: npx vite-node src/features/designer/validation/referenceValidator.templates.check.ts
 */
import { validateFlow } from '@/features/designer/validation/referenceValidator'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function node(partial: Partial<DesignerNode> & Pick<DesignerNode, 'id' | 'key' | 'type'>): DesignerNode {
  return {
    label: partial.key,
    config: {},
    position: { x: 0, y: 0 },
    ...partial,
  }
}

const welcome = { html: 'Hello {{vars.name}} from {{vars.brand}}' }

{
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', body: '{{templates.welcome.html}}' },
  })
  const issues = validateFlow([email], [], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: { welcome },
  })
  assert(
    issues.some((i) => i.code === 'unknown_var' && i.message.includes('welcome') && i.message.includes('vars.name')),
    'unset template var is an error on the calling step',
  )
  assert(
    issues.some((i) => i.code === 'unknown_var' && i.message.includes('vars.brand')),
    'second unset template var is also flagged',
  )
}

{
  const ask = node({
    id: 'q1',
    key: 'ask_name',
    type: 'question',
    config: { prompt: 'Name?', outputVariable: 'name' },
  })
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', body: '{{templates.welcome.html}}' },
  })
  const edge: DesignerEdge = { id: 'ed', source: 'q1', target: 'e1' }
  const issues = validateFlow([ask, email], [edge], {
    globalVariables: ['brand'],
    templateKeys: ['welcome'],
    templateContents: { welcome },
  })
  assert(
    !issues.some((i) => i.code === 'unknown_var' || i.code === 'forward_var_ref'),
    'vars set by a prior question and a global are allowed',
  )
}

{
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', templateKey: 'welcome', body: 'custom' },
  })
  const issues = validateFlow([email], [], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: { welcome },
  })
  assert(
    issues.some((i) => i.code === 'unknown_var' && i.message.includes('welcome')),
    'templateKey on the step still expands template placeholders',
  )
}

{
  const later = node({
    id: 'q1',
    key: 'ask_name',
    type: 'question',
    config: { prompt: 'Name?', outputVariable: 'name' },
  })
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', body: '{{templates.welcome.html}}' },
  })
  const edge: DesignerEdge = { id: 'ed', source: 'e1', target: 'q1' }
  const issues = validateFlow([email, later], [edge], {
    globalVariables: ['brand'],
    templateKeys: ['welcome'],
    templateContents: { welcome },
  })
  assert(
    issues.some((i) => i.code === 'forward_var_ref' && i.message.includes('ask_name')),
    'template var set only after the calling step is a forward-ref error',
  )
}

{
  const ask = node({
    id: 'q1',
    key: 'ask_name',
    type: 'question',
    config: { prompt: 'Name?', outputVariable: 'fullName' },
  })
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', body: '{{templates.welcome.html}}' },
  })
  const edge: DesignerEdge = { id: 'ed', source: 'q1', target: 'e1' }
  const welcomeUser = { html: 'Hello {{vars.userName}}' }
  const issues = validateFlow([ask, email], [edge], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: { welcome: welcomeUser },
  })
  assert(
    issues.some((i) => i.code === 'unknown_var' && i.nodeId === 'e1' && i.message.includes('vars.userName')),
    'renamed output is an unknown_var on the email step',
  )
  assert(
    !issues.some((i) => i.nodeId === 'q1' && (i.code === 'unknown_var' || i.code === 'downstream_unset_var')),
    'unset template vars are not copied onto earlier questions',
  )
}

{
  const ask = node({
    id: 'q1',
    key: 'ask_name',
    type: 'question',
    config: { prompt: 'Name?', outputVariable: 'userName' },
  })
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', templateKey: 'welcome', body: '{{templates.welcome.html}}' },
  })
  const edge: DesignerEdge = { id: 'ed', source: 'q1', target: 'e1' }
  const issues = validateFlow([ask, email], [edge], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: { welcome: { html: 'Hello {{userName}}' } },
  })
  assert(
    !issues.some((i) => i.code === 'unknown_var' || i.code === 'forward_var_ref'),
    'bare {{userName}} in a template is the same as {{vars.userName}} when the question sets it',
  )
}

{
  const pay = node({
    id: 'p1',
    key: 'pay',
    type: 'question',
    config: {
      prompt: 'Checkout {{templates.store.text}}',
      answerType: 'payment',
      outputVariable: 'payment',
    },
  })
  const issues = validateFlow([pay], [], {
    globalVariables: [],
    templateKeys: ['store'],
    templateContents: { store: { currency: 'ZAR', categories: [], products: [] } },
  })
  assert(
    issues.some((i) => i.code === 'incompatible_template' && i.message.includes('store')),
    'cart template on a payment prompt is flagged',
  )
}

{
  const shop = node({
    id: 's1',
    key: 'shop',
    type: 'question',
    config: {
      prompt: '{{templates.store.intro}}',
      answerType: 'shop',
      outputVariable: 'cart',
      shopTemplateKey: 'store',
    },
  })
  const issues = validateFlow([shop], [], {
    globalVariables: [],
    templateKeys: ['store'],
    templateContents: { store: { currency: 'ZAR', categories: [], products: [] } },
  })
  assert(
    !issues.some((i) => i.code === 'incompatible_template'),
    'cart template on a shop prompt is allowed',
  )
}

{
  const welcomeInputs = {
    html: 'Hello {{inputs.name}}',
    inputs: [{ key: 'name', label: 'Full name', type: 'string', required: true }],
  }
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', body: '{{templates.welcome.html}}' },
  })
  const issues = validateFlow([email], [], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: { welcome: welcomeInputs },
  })
  assert(
    issues.some(
      (i) =>
        i.code === 'unbound_template_input' &&
        i.field === 'templateBindings.welcome.name' &&
        i.message.includes('Full name'),
    ),
    'required template input without a binding is an error',
  )
  assert(
    !issues.some((i) => i.code === 'unknown_var' && i.message.includes('inputs')),
    '{{inputs.*}} is not treated as a chatbot variable',
  )
}

{
  const ask = node({
    id: 'q1',
    key: 'ask_name',
    type: 'question',
    config: { prompt: 'Name?', outputVariable: 'name' },
  })
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: {
      connectionId: 'c1',
      body: '{{templates.welcome.html}}',
      templateBindings: { welcome: { name: '{{vars.name}}' } },
    },
  })
  const edge: DesignerEdge = { id: 'ed', source: 'q1', target: 'e1' }
  const issues = validateFlow([ask, email], [edge], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: {
      welcome: {
        html: 'Hello {{inputs.name}}',
        inputs: [{ key: 'name', label: 'Full name', type: 'string', required: true }],
      },
    },
  })
  assert(
    !issues.some((i) => i.code === 'unbound_template_input' || i.code === 'unknown_var' || i.code === 'unknown_template_input'),
    'bound required input is valid',
  )
}

{
  const email = node({
    id: 'e1',
    key: 'send',
    type: 'email',
    config: { connectionId: 'c1', body: '{{templates.welcome.html}}' },
  })
  const issues = validateFlow([email], [], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: {
      welcome: {
        html: 'Hello {{inputs.nickname}}',
        inputs: [{ key: 'name', label: 'Name', type: 'string', required: false }],
      },
    },
  })
  assert(
    issues.some((i) => i.code === 'unknown_template_input' && i.message.includes('inputs.nickname')),
    'undeclared {{inputs.*}} on a template is an error',
  )
}

{
  const otp = node({
    id: 'q1',
    key: 'verify',
    type: 'question',
    config: {
      prompt: 'Enter the code',
      answerType: 'otp',
      outputVariable: 'otp',
      otpTemplateKey: 'welcome',
    },
  })
  const issues = validateFlow([otp], [], {
    globalVariables: [],
    templateKeys: ['welcome'],
    templateContents: {
      welcome: {
        html: 'Code for {{inputs.name}}',
        inputs: [{ key: 'name', label: 'Name', type: 'string', required: true }],
      },
    },
  })
  assert(
    issues.some((i) => i.code === 'unbound_template_input' && i.field === 'templateBindings.welcome.name'),
    'otpTemplateKey required inputs must be bound',
  )
}

console.log('referenceValidator.templates.check.ts: all passed')
