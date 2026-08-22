import type { FlowTemplateExport } from '@/features/designer/utils/flowTransfer'
import type { PackFlowBundle } from '@/features/chatbots/starterPackBuilder'
import { createPackBuilder, emptyPackBundle } from '@/features/chatbots/starterPackBuilder'

export type ChatbotStarterPackId =
  | 'blank'
  | 'essentials'
  | 'customer_support'
  | 'lead_capture'
  | 'appointment'
  | 'shop'
  | 'feedback'
  | 'contact_form'

export type ChatbotStarterPack = {
  id: ChatbotStarterPackId
  name: string
  summary: string
  /** Shown under the card; what gets created. */
  includes: string[]
  /** Suggested chatbot name when the field is empty. */
  suggestedName: string
  suggestedDescription: string
  /** When true, keep the DB default welcome→end flow and only seed templates/globals. */
  keepDefaultFlow?: boolean
  build: () => PackFlowBundle
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

function hoursDays() {
  return WEEKDAYS.map((day) => ({
    day,
    open: '09:00',
    close: day === 'Saturday' ? '13:00' : '17:00',
    closed: day === 'Sunday',
  }))
}

/** Templates most organisations need on day one. */
export function commonOrgTemplates(_brand = 'Your organisation'): FlowTemplateExport[] {
  return [
    {
      key: 'welcome_msg',
      name: 'Welcome message',
      kind: 'message',
      description: 'Opening copy with guest name.',
      content: {
        inputs: [{ key: 'name', label: 'Guest name', type: 'string', required: false }],
        text: 'Hi {{coalesce(inputs.name, "there")}} — welcome to {{coalesce(vars.brand_name, "our team")}}. How can we help?',
      },
    },
    {
      key: 'main_menu',
      name: 'Main menu',
      kind: 'menu',
      description: 'Quick topics visitors can choose from.',
      content: {
        inputs: [],
        title: 'How can we help?',
        items: [
          { label: 'Hours', description: 'Opening times', value: 'hours' },
          { label: 'FAQ', description: 'Common questions', value: 'faq' },
          { label: 'Talk to us', description: 'Leave your details', value: 'contact' },
        ],
      },
    },
    {
      key: 'hours_main',
      name: 'Opening hours',
      kind: 'hours',
      description: 'Weekly schedule for chat or email.',
      content: {
        inputs: [],
        timezone: 'Africa/Johannesburg',
        note: 'Public holidays may differ. Edit this template on the Templates tab.',
        days: hoursDays(),
      },
    },
    {
      key: 'help_faq',
      name: 'Help / FAQ',
      kind: 'faq',
      description: 'Reusable Q&A for support menus.',
      content: {
        inputs: [{ key: 'brand', label: 'Brand', type: 'string', required: false }],
        intro: 'Common questions about {{coalesce(inputs.brand, vars.brand_name, "us")}}:',
        items: [
          {
            question: 'What are your hours?',
            answer: 'See {{templates.hours_main.text}} or ask a teammate.',
          },
          {
            question: 'How do I get help?',
            answer: 'Share your name and email and we will follow up.',
          },
          {
            question: 'Can I talk to a person?',
            answer: 'Yes — leave a message and we will hand you over.',
          },
        ],
      },
    },
    {
      key: 'terms_legal',
      name: 'Terms of use',
      kind: 'legal',
      description: 'Short privacy / terms copy for confirm steps.',
      content: {
        inputs: [],
        title: 'Terms of use',
        body: 'By continuing you agree we may store this conversation to help with your request. We do not sell your personal data. Edit this template to match your policy.',
      },
    },
    {
      key: 'followup_email',
      name: 'Follow-up email',
      kind: 'email',
      description: 'HTML email for confirmations and OTP-style follow-ups.',
      content: {
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'brand', label: 'Brand', type: 'string', required: false },
          { key: 'message', label: 'Message', type: 'string', required: true },
        ],
        subject: '{{coalesce(inputs.brand, vars.brand_name, "Update")}} for {{inputs.name}}',
        html: `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;color:#ffffff;">
            <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;">{{coalesce(inputs.brand, vars.brand_name, "")}}</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;">Hello {{inputs.name}}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">{{inputs.message}}</p>
            <p style="margin:0;color:#64748b;font-size:13px;">If you did not expect this, you can ignore the email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      },
    },
  ]
}

function brandGlobals(brand = 'Your organisation'): PackFlowBundle['globals'] {
  return [
    {
      key: 'brand_name',
      value_type: 'string',
      default_value: brand,
      description: 'Organisation or product name used in templates',
    },
    {
      key: 'support_email',
      value_type: 'string',
      default_value: 'hello@example.com',
      description: 'Public support address',
    },
  ]
}

function shopCatalogTemplate(): FlowTemplateExport {
  return {
    key: 'store_catalog',
    name: 'Store catalog',
    kind: 'cart',
    description: 'Categories, products, and checkout fees for Shop questions.',
    content: {
      currency: 'ZAR',
      storeName: 'Online store',
      intro: 'Browse products and add items to your cart.',
      checkoutLabel: 'Checkout',
      cartHint: 'Change quantities anytime, then checkout to continue.',
      categories: [
        { id: 'cat_featured', name: 'Featured' },
        { id: 'cat_extras', name: 'Extras' },
      ],
      products: [
        {
          id: 'prod_starter',
          sku: 'SKU-001',
          name: 'Starter pack',
          description: 'Most popular option',
          price: 199,
          categoryId: 'cat_featured',
          image: '',
          stock: 25,
        },
        {
          id: 'prod_pro',
          sku: 'SKU-002',
          name: 'Pro pack',
          description: 'Extra capacity',
          price: 449,
          categoryId: 'cat_featured',
          image: '',
          stock: 12,
        },
        {
          id: 'prod_addon',
          sku: 'SKU-003',
          name: 'Add-on',
          description: 'Optional extra',
          price: 79,
          categoryId: 'cat_extras',
          image: '',
          stock: 40,
        },
      ],
      fees: [
        { id: 'fee_ship', name: 'Shipping', kind: 'fixed', amount: 45 },
        { id: 'fee_vat', name: 'VAT', kind: 'percent', amount: 15 },
      ],
    },
  }
}

function receiptTemplate(): FlowTemplateExport {
  return {
    key: 'order_receipt',
    name: 'Order receipt',
    kind: 'receipt',
    description: 'Filled after shop/payment with cart lines and totals.',
    content: {
      inputs: [
        { key: 'name', label: 'Name', type: 'string', required: false },
        { key: 'order_id', label: 'Order id', type: 'string', required: false },
      ],
      title: 'Order confirmation',
      intro: 'Thanks {{coalesce(inputs.name, "there")}} — we received order {{coalesce(inputs.order_id, "")}}.',
      footer: 'Reply in this chat if anything looks wrong.',
    },
  }
}

function leadsEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'leads',
    name: 'Leads',
    description: 'Captured contacts from the chatbot.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      {
        key: 'email',
        label: 'Email',
        value_type: 'string',
        required: true,
        is_unique: true,
        sort_order: 1,
      },
      { key: 'phone', label: 'Phone', value_type: 'string', required: false, sort_order: 2 },
      { key: 'company', label: 'Company', value_type: 'string', required: false, sort_order: 3 },
      { key: 'interest', label: 'Interest', value_type: 'string', required: false, sort_order: 4 },
      { key: 'notes', label: 'Notes', value_type: 'string', required: false, sort_order: 5 },
    ],
  }
}

function appointmentsEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'appointments',
    name: 'Appointments',
    description: 'Booked slots from the chatbot.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      {
        key: 'email',
        label: 'Email',
        value_type: 'string',
        required: true,
        sort_order: 1,
      },
      { key: 'phone', label: 'Phone', value_type: 'string', required: false, sort_order: 2 },
      { key: 'when', label: 'When', value_type: 'object', required: true, sort_order: 3 },
      { key: 'reason', label: 'Reason', value_type: 'string', required: false, sort_order: 4 },
    ],
  }
}

function feedbackEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'feedback',
    name: 'Feedback',
    description: 'Survey responses from the chatbot.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: false, sort_order: 0 },
      { key: 'email', label: 'Email', value_type: 'string', required: false, sort_order: 1 },
      { key: 'nps', label: 'NPS', value_type: 'number', required: false, sort_order: 2 },
      { key: 'stars', label: 'Stars', value_type: 'number', required: false, sort_order: 3 },
      { key: 'mood', label: 'Mood', value_type: 'string', required: false, sort_order: 4 },
      { key: 'comment', label: 'Comment', value_type: 'string', required: false, sort_order: 5 },
    ],
  }
}

function contactsEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'contacts',
    name: 'Contacts',
    description: 'Contact form submissions.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      {
        key: 'email',
        label: 'Email',
        value_type: 'string',
        required: true,
        sort_order: 1,
      },
      { key: 'phone', label: 'Phone', value_type: 'string', required: false, sort_order: 2 },
      { key: 'message', label: 'Message', value_type: 'string', required: false, sort_order: 3 },
      { key: 'payload', label: 'Form payload', value_type: 'object', required: false, sort_order: 4 },
    ],
  }
}

function buildEssentials(): PackFlowBundle {
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.main_menu.text}}\n\n{{templates.hours_main.text}}\n\n{{templates.help_faq.text}}\n\n{{templates.terms_legal.text}}',
    {
      templateBindings: {
        welcome_msg: { name: '' },
        help_faq: { brand: '{{vars.brand_name}}' },
      },
    },
  )
  b.question('ask_name', 'Name', 'What should we call you?', 'name', { output: 'visitor_name' })
  b.message(
    'hello',
    'Hello',
    'Thanks {{vars.visitor_name}}. Edit this flow on Design, and customise the Templates tab for your organisation.',
    {
      templateBindings: {
        welcome_msg: { name: '{{vars.visitor_name}}' },
      },
    },
  )
  b.end('end', 'End', 'You are all set — open Templates to edit hours, FAQ, legal, and email copy.')
  b.chain(['welcome', 'ask_name', 'hello', 'end'])
  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
  }
}

function buildCustomerSupport(): PackFlowBundle {
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.main_menu.text}}\n\n{{templates.terms_legal.text}}',
    {
      templateBindings: {
        welcome_msg: { name: '' },
      },
    },
  )
  b.question('ask_topic', 'Topic', 'What do you need help with?', 'choice', {
    output: 'topic',
    config: {
      choices: ['Hours', 'FAQ', 'Something else'],
    },
  })
  b.condition('cond_topic', 'Is hours?', '{{vars.topic}}', 'eq', 'Hours')
  b.message('msg_hours', 'Hours', '{{templates.hours_main.text}}')
  b.message('msg_faq', 'FAQ', '{{templates.help_faq.text}}', {
    templateBindings: { help_faq: { brand: '{{vars.brand_name}}' } },
  })
  b.question('ask_name', 'Name', 'What is your name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What email can we reach you on?', 'email', { output: 'email' })
  b.question('ask_details', 'Details', 'Tell us a bit more about your request.', 'long_text', {
    output: 'details',
    required: false,
  })
  b.message(
    'thanks',
    'Thanks',
    'Thanks {{vars.visitor_name}}. We have your note about “{{vars.topic}}” and will follow up at {{vars.email}}.',
  )
  b.end('end', 'End', 'Conversation complete. Bind an email connection if you want a live follow-up.')

  b.chain(['welcome', 'ask_topic', 'cond_topic'])
  b.link('cond_topic', 'msg_hours', 'true', 'Yes')
  b.link('cond_topic', 'msg_faq', 'false', 'No')
  b.link('msg_hours', 'ask_name')
  b.link('msg_faq', 'ask_name')
  b.chain(['ask_name', 'ask_email', 'ask_details', 'thanks', 'end'])

  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
  }
}

function buildLeadCapture(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = leadsEntity(entityId)
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\nWe will take a few details and save them for your team.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What is your full name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What is your work email?', 'email', { output: 'email' })
  b.question('ask_phone', 'Phone', 'Phone number (optional)', 'phone', {
    output: 'phone',
    required: false,
  })
  b.question('ask_company', 'Company', 'Which company are you with?', 'text', {
    output: 'company',
    required: false,
  })
  b.question('ask_interest', 'Interest', 'What are you interested in?', 'choice', {
    output: 'interest',
    config: { choices: ['Product demo', 'Pricing', 'Partnership', 'Support', 'Other'] },
  })
  b.question('ask_notes', 'Notes', 'Anything else we should know?', 'long_text', {
    output: 'notes',
    required: false,
  })
  b.entity('save_lead', 'Save lead', {
    entityId,
    operation: 'create',
    outputVariable: 'lead',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      phone: '{{vars.phone}}',
      company: '{{vars.company}}',
      interest: '{{vars.interest}}',
      notes: '{{vars.notes}}',
    },
  })
  b.message(
    'confirm',
    'Confirm',
    'Thanks {{vars.visitor_name}} — we saved your lead ({{vars.lead.id}}). Someone will follow up at {{vars.email}}.',
  )
  b.end('end', 'End', 'Lead captured. Open Data → Leads to review records.')
  b.chain([
    'welcome',
    'ask_name',
    'ask_email',
    'ask_phone',
    'ask_company',
    'ask_interest',
    'ask_notes',
    'save_lead',
    'confirm',
    'end',
  ])
  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
    entityDefs: [entity],
    entities: [{ id: entityId, key: entity.key }],
    testScenarios: [
      {
        name: 'Sample lead seeds',
        globals: { brand_name: 'Your organisation' },
        expected: { variables: ['visitor_name', 'email', 'lead'], stepKeys: ['save_lead', 'end'] },
      },
    ],
  }
}

function buildAppointment(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = appointmentsEntity(entityId)
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.hours_main.text}}\n\nBook a time that works for you.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What is your name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What is your email?', 'email', { output: 'email' })
  b.question('ask_phone', 'Phone', 'Phone number (optional)', 'phone', {
    output: 'phone',
    required: false,
  })
  b.question('ask_when', 'When', 'When would you like to meet?', 'appointment', {
    output: 'appointment',
  })
  b.question('ask_reason', 'Reason', 'What is the appointment for?', 'text', {
    output: 'reason',
    required: false,
  })
  b.entity('save_appt', 'Save appointment', {
    entityId,
    operation: 'create',
    outputVariable: 'booking',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      phone: '{{vars.phone}}',
      when: '{{vars.appointment}}',
      reason: '{{vars.reason}}',
    },
  })
  b.message(
    'confirm',
    'Confirm',
    'Booked, {{vars.visitor_name}}. We will confirm {{vars.appointment.date}} at {{vars.appointment.time}} via {{vars.email}}.',
  )
  b.end('end', 'End', 'Appointment saved under Data → Appointments.')
  b.chain([
    'welcome',
    'ask_name',
    'ask_email',
    'ask_phone',
    'ask_when',
    'ask_reason',
    'save_appt',
    'confirm',
    'end',
  ])
  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
    entityDefs: [entity],
    entities: [{ id: entityId, key: entity.key }],
  }
}

function buildShop(): PackFlowBundle {
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\nBrowse the catalog, checkout, then pay the cart total (subtotal plus fees).',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What is your name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'Email for the receipt', 'email', { output: 'email' })
  b.question('ask_shop', 'Shop', 'Add items and checkout.', 'shop', {
    output: 'cart',
    config: { shopTemplateKey: 'store_catalog' },
  })
  b.question(
    'ask_payment',
    'Payment',
    'Pay {{vars.cart.total}} {{vars.cart.currency}} (self-confirm in Preview, or bind a Payment connection).',
    'payment',
    {
      output: 'payment',
      config: {
        paymentAmount: '{{vars.cart.total}}',
        paymentItemName: 'Online order',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
        payButtonLabel: 'Pay now',
        paidButtonLabel: 'I have paid',
      },
    },
  )
  b.message(
    'receipt',
    'Receipt',
    '{{templates.order_receipt.text}}',
    {
      templateBindings: {
        order_receipt: {
          name: '{{vars.visitor_name}}',
          order_id: '{{coalesce(vars.payment.reference, "pending")}}',
        },
      },
    },
  )
  b.end('end', 'End', 'Thanks for your order. Bind a Payment connection for live PayFast confirmation.')
  b.chain(['welcome', 'ask_name', 'ask_email', 'ask_shop', 'ask_payment', 'receipt', 'end'])
  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: [...commonOrgTemplates(), shopCatalogTemplate(), receiptTemplate()],
  }
}

function buildFeedback(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = feedbackEntity(entityId)
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\nA short survey — your answers help us improve.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'Your name (optional)', 'name', {
    output: 'visitor_name',
    required: false,
  })
  b.question('ask_email', 'Email', 'Email (optional)', 'email', { output: 'email', required: false })
  b.question('ask_nps', 'NPS', 'How likely are you to recommend us? (0–10)', 'nps', {
    output: 'nps',
    config: { min: 0, max: 10, step: 1, minLabel: 'Not likely', maxLabel: 'Extremely likely' },
  })
  b.question('ask_stars', 'Stars', 'Overall experience', 'stars', {
    output: 'stars',
    config: { min: 1, max: 5, step: 1 },
  })
  b.question('ask_mood', 'Mood', 'How do you feel about our service?', 'mood', { output: 'mood' })
  b.question('ask_comment', 'Comment', 'Anything else you would like to share?', 'long_text', {
    output: 'comment',
    required: false,
  })
  b.entity('save_feedback', 'Save feedback', {
    entityId,
    operation: 'create',
    outputVariable: 'response',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      nps: '{{vars.nps}}',
      stars: '{{vars.stars}}',
      mood: '{{vars.mood}}',
      comment: '{{vars.comment}}',
    },
  })
  b.condition('cond_nps', 'Promoter?', '{{vars.nps}}', 'gte', '9')
  b.message('msg_promoter', 'Promoter', 'Thank you — we are glad you would recommend us.')
  b.message('msg_thanks', 'Thanks', 'Thanks for the honest score. We will keep improving.')
  b.end('end', 'End', 'Feedback saved under Data → Feedback.')

  b.chain([
    'welcome',
    'ask_name',
    'ask_email',
    'ask_nps',
    'ask_stars',
    'ask_mood',
    'ask_comment',
    'save_feedback',
    'cond_nps',
  ])
  b.link('cond_nps', 'msg_promoter', 'true', 'Yes')
  b.link('cond_nps', 'msg_thanks', 'false', 'No')
  b.link('msg_promoter', 'end')
  b.link('msg_thanks', 'end')

  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
    entityDefs: [entity],
    entities: [{ id: entityId, key: entity.key }],
  }
}

function buildContactForm(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = contactsEntity(entityId)
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.terms_legal.text}}\n\nFill in the form and we will get back to you.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_form', 'Contact form', 'Your details', 'form', {
    output: 'contact',
    config: {
      formFields: [
        { key: 'name', label: 'Name', type: 'name', required: true },
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'phone', label: 'Phone', type: 'phone', required: false },
        { key: 'message', label: 'Message', type: 'long_text', required: true },
      ],
    },
  })
  b.entity('save_contact', 'Save contact', {
    entityId,
    operation: 'create',
    outputVariable: 'record',
    fieldMap: {
      name: '{{vars.contact.name}}',
      email: '{{vars.contact.email}}',
      phone: '{{vars.contact.phone}}',
      message: '{{vars.contact.message}}',
      payload: '{{vars.contact}}',
    },
  })
  b.message(
    'thanks',
    'Thanks',
    'Thanks {{vars.contact.name}} — we received your message and will reply at {{vars.contact.email}}.',
  )
  b.end('end', 'End', 'Contact saved under Data → Contacts.')
  b.chain(['welcome', 'ask_form', 'save_contact', 'thanks', 'end'])
  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
    entityDefs: [entity],
    entities: [{ id: entityId, key: entity.key }],
  }
}

export const CHATBOT_STARTER_PACKS: ChatbotStarterPack[] = [
  {
    id: 'blank',
    name: 'Blank',
    summary: 'Empty chatbot with the default welcome and end steps.',
    includes: ['Default welcome → end flow'],
    suggestedName: '',
    suggestedDescription: '',
    keepDefaultFlow: true,
    build: () => emptyPackBundle(),
  },
  {
    id: 'essentials',
    name: 'Essentials',
    summary: 'Starter welcome flow plus the templates most organisations need.',
    includes: ['Welcome + name', 'Message, menu, hours, FAQ, legal, email templates', 'Brand globals'],
    suggestedName: 'Organisation assistant',
    suggestedDescription: 'Starter chatbot with common templates ready to customise.',
    build: buildEssentials,
  },
  {
    id: 'customer_support',
    name: 'Customer support',
    summary: 'Hours, FAQ, and a short handoff so visitors can leave contact details.',
    includes: ['Topic branch', 'Hours & FAQ templates', 'Name / email / details', 'Common org templates'],
    suggestedName: 'Support assistant',
    suggestedDescription: 'Help visitors with hours, FAQ, and a contact handoff.',
    build: buildCustomerSupport,
  },
  {
    id: 'lead_capture',
    name: 'Lead capture',
    summary: 'Collect name, email, company, and interest into a Leads entity.',
    includes: ['Lead questions', 'Leads entity', 'Common org templates', 'Test scenario'],
    suggestedName: 'Lead capture',
    suggestedDescription: 'Capture sales leads into a structured Leads table.',
    build: buildLeadCapture,
  },
  {
    id: 'appointment',
    name: 'Appointment booking',
    summary: 'Book a date and time and store it under Appointments.',
    includes: ['Appointment question', 'Appointments entity', 'Hours template'],
    suggestedName: 'Book an appointment',
    suggestedDescription: 'Let visitors pick a slot and leave their contact details.',
    build: buildAppointment,
  },
  {
    id: 'shop',
    name: 'Shop & checkout',
    summary: 'Store catalog, cart checkout, payment, and receipt.',
    includes: ['Shop + payment flow', 'Store catalog', 'Receipt template', 'Common org templates'],
    suggestedName: 'Online store',
    suggestedDescription: 'Browse products, checkout, and confirm payment.',
    build: buildShop,
  },
  {
    id: 'feedback',
    name: 'Feedback survey',
    summary: 'NPS, stars, mood, and free-text — saved to Feedback.',
    includes: ['Survey questions', 'Feedback entity', 'Promoter branch'],
    suggestedName: 'Feedback survey',
    suggestedDescription: 'Collect satisfaction scores and comments.',
    build: buildFeedback,
  },
  {
    id: 'contact_form',
    name: 'Contact form',
    summary: 'Multi-field form on one screen, stored as Contacts.',
    includes: ['Form question', 'Contacts entity', 'Legal template'],
    suggestedName: 'Contact us',
    suggestedDescription: 'Simple contact form with name, email, and message.',
    build: buildContactForm,
  },
]

export function getChatbotStarterPack(id: string | null | undefined): ChatbotStarterPack {
  return CHATBOT_STARTER_PACKS.find((p) => p.id === id) ?? CHATBOT_STARTER_PACKS[0]!
}
