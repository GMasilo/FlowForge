import type { FlowTemplateExport } from '@/features/designer/utils/flowTransfer'
import type { PackFlowBundle } from '@/features/chatbots/starterPackBuilder'
import { createPackBuilder, emptyPackBundle } from '@/features/chatbots/starterPackBuilder'
import { starterTemplateContent } from '@/features/templates/templateModel'

export type ChatbotStarterPackId =
  | 'blank'
  | 'essentials'
  | 'customer_support'
  | 'lead_capture'
  | 'appointment'
  | 'shop'
  | 'feedback'
  | 'contact_form'
  | 'faq_menu'
  | 'agent_handoff'
  | 'event_rsvp'
  | 'job_application'
  | 'it_helpdesk'
  | 'product_onboarding'

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
      key: 'agreement',
      name: 'Service agreement',
      kind: 'agreement',
      description: 'Adobe Sign–style PDF: parties, terms, signature, and date signed.',
      content: starterTemplateContent('agreement'),
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

function rsvpsEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'rsvps',
    name: 'RSVPs',
    description: 'Event RSVP responses.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      { key: 'email', label: 'Email', value_type: 'string', required: true, sort_order: 1 },
      { key: 'guests', label: 'Guests', value_type: 'number', required: false, sort_order: 2 },
      { key: 'attendance', label: 'Attendance', value_type: 'string', required: true, sort_order: 3 },
      { key: 'notes', label: 'Notes', value_type: 'string', required: false, sort_order: 4 },
    ],
  }
}

function applicationsEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'applications',
    name: 'Applications',
    description: 'Job applications from the chatbot.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      { key: 'email', label: 'Email', value_type: 'string', required: true, sort_order: 1 },
      { key: 'phone', label: 'Phone', value_type: 'string', required: false, sort_order: 2 },
      { key: 'role', label: 'Role', value_type: 'string', required: true, sort_order: 3 },
      { key: 'experience', label: 'Experience', value_type: 'string', required: false, sort_order: 4 },
      { key: 'cover_note', label: 'Cover note', value_type: 'string', required: false, sort_order: 5 },
    ],
  }
}

function ticketsEntity(id: string): PackFlowBundle['entityDefs'][number] {
  return {
    id,
    key: 'tickets',
    name: 'Tickets',
    description: 'IT / helpdesk tickets from chat.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      { key: 'email', label: 'Email', value_type: 'string', required: true, sort_order: 1 },
      { key: 'category', label: 'Category', value_type: 'string', required: true, sort_order: 2 },
      { key: 'priority', label: 'Priority', value_type: 'string', required: false, sort_order: 3 },
      { key: 'summary', label: 'Summary', value_type: 'string', required: true, sort_order: 4 },
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

function buildFaqMenu(): PackFlowBundle {
  const b = createPackBuilder()
  const caseHours = 'case_hours'
  const caseFaq = 'case_faq'
  const caseContact = 'case_contact'
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.main_menu.text}}',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_topic', 'Topic', 'Pick a topic to continue.', 'choice', {
    output: 'topic',
    config: { choices: ['Hours', 'FAQ', 'Talk to us'] },
  })
  b.switchStep('sw_topic', 'Route topic', '{{vars.topic}}', [
    { id: caseHours, match: 'Hours', label: 'Hours' },
    { id: caseFaq, match: 'FAQ', label: 'FAQ' },
    { id: caseContact, match: 'Talk to us', label: 'Contact' },
  ])
  b.message('msg_hours', 'Hours', '{{templates.hours_main.text}}')
  b.message('msg_faq', 'FAQ', '{{templates.help_faq.text}}', {
    templateBindings: { help_faq: { brand: '{{vars.brand_name}}' } },
  })
  b.question('ask_name', 'Name', 'What is your name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What email should we use?', 'email', { output: 'email' })
  b.question('ask_message', 'Message', 'How can we help?', 'long_text', { output: 'message' })
  b.message(
    'thanks_contact',
    'Thanks',
    'Thanks {{vars.visitor_name}} — we will follow up at {{vars.email}}.',
  )
  b.message('wrap', 'Anything else', 'Need something else? Restart the chat or pick another topic next time.')
  b.end('end', 'End', 'FAQ navigator complete.')

  b.chain(['welcome', 'ask_topic', 'sw_topic'])
  b.link('sw_topic', 'msg_hours', caseHours, 'Hours')
  b.link('sw_topic', 'msg_faq', caseFaq, 'FAQ')
  b.link('sw_topic', 'ask_name', caseContact, 'Contact')
  b.link('sw_topic', 'wrap', 'default', 'Default')
  b.link('msg_hours', 'wrap')
  b.link('msg_faq', 'wrap')
  b.chain(['ask_name', 'ask_email', 'ask_message', 'thanks_contact', 'wrap'])
  b.link('wrap', 'end')

  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
  }
}

function buildAgentHandoff(): PackFlowBundle {
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.terms_legal.text}}\n\nI can collect a few details, then connect you with a teammate.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What is your name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What is the best email to reach you?', 'email', { output: 'email' })
  b.question('ask_reason', 'Reason', 'What do you need help with?', 'choice', {
    output: 'reason',
    config: { choices: ['Billing', 'Technical issue', 'Account access', 'Other'] },
  })
  b.question('ask_details', 'Details', 'Add any details that will help the agent.', 'long_text', {
    output: 'details',
    required: false,
  })
  b.message(
    'bridging',
    'Bridging',
    'Thanks {{vars.visitor_name}}. Connecting you with an agent about “{{vars.reason}}”…',
  )
  b.handoff(
    'handoff',
    'Handoff',
    'An agent will join shortly. Summary: {{vars.reason}} — {{vars.details}}',
  )
  b.end('end', 'End', 'Handoff complete. Configure Inbox queues under Admin if needed.')
  b.chain(['welcome', 'ask_name', 'ask_email', 'ask_reason', 'ask_details', 'bridging', 'handoff', 'end'])
  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
  }
}

function buildEventRsvp(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = rsvpsEntity(entityId)
  const caseYes = 'case_yes'
  const caseNo = 'case_no'
  const caseMaybe = 'case_maybe'
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\nYou are invited — tell us if you can make it.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What is your name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What is your email?', 'email', { output: 'email' })
  b.question('ask_attendance', 'Attendance', 'Will you attend?', 'choice', {
    output: 'attendance',
    config: { choices: ['Yes', 'No', 'Maybe'] },
  })
  b.question('ask_guests', 'Guests', 'How many guests (including you)?', 'number', {
    output: 'guests',
    required: false,
    config: { min: 1, max: 10 },
  })
  b.question('ask_notes', 'Notes', 'Dietary needs or other notes (optional)', 'long_text', {
    output: 'notes',
    required: false,
  })
  b.entity('save_rsvp', 'Save RSVP', {
    entityId,
    operation: 'create',
    outputVariable: 'rsvp',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      guests: '{{vars.guests}}',
      attendance: '{{vars.attendance}}',
      notes: '{{vars.notes}}',
    },
  })
  b.switchStep('sw_attendance', 'Route RSVP', '{{vars.attendance}}', [
    { id: caseYes, match: 'Yes', label: 'Attending' },
    { id: caseNo, match: 'No', label: 'Declined' },
    { id: caseMaybe, match: 'Maybe', label: 'Maybe' },
  ])
  b.message(
    'msg_yes',
    'Confirmed',
    'Wonderful, {{vars.visitor_name}} — we have you down for {{coalesce(vars.guests, "1")}} guest(s). See you there!',
  )
  b.message('msg_no', 'Declined', 'Thanks for letting us know, {{vars.visitor_name}}. You will be missed.')
  b.message(
    'msg_maybe',
    'Maybe',
    'Thanks {{vars.visitor_name}} — we will hold a tentative spot and check in closer to the date.',
  )
  b.end('end', 'End', 'RSVP saved under Data → RSVPs.')

  b.chain(['welcome', 'ask_name', 'ask_email', 'ask_attendance', 'ask_guests', 'ask_notes', 'save_rsvp', 'sw_attendance'])
  b.link('sw_attendance', 'msg_yes', caseYes, 'Yes')
  b.link('sw_attendance', 'msg_no', caseNo, 'No')
  b.link('sw_attendance', 'msg_maybe', caseMaybe, 'Maybe')
  b.link('sw_attendance', 'msg_maybe', 'default', 'Default')
  b.link('msg_yes', 'end')
  b.link('msg_no', 'end')
  b.link('msg_maybe', 'end')

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

function buildJobApplication(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = applicationsEntity(entityId)
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.terms_legal.text}}\n\nApply for an open role in a few steps.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What is your full name?', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'What is your email?', 'email', { output: 'email' })
  b.question('ask_phone', 'Phone', 'Phone number (optional)', 'phone', {
    output: 'phone',
    required: false,
  })
  b.question('ask_role', 'Role', 'Which role are you applying for?', 'choice', {
    output: 'role',
    config: {
      choices: ['Customer success', 'Engineering', 'Sales', 'Operations', 'Other'],
    },
  })
  b.question('ask_experience', 'Experience', 'Years of relevant experience', 'choice', {
    output: 'experience',
    config: { choices: ['0–1', '2–4', '5–8', '9+'] },
  })
  b.question('ask_cover', 'Cover note', 'Why are you a great fit? (short note)', 'long_text', {
    output: 'cover_note',
    required: false,
  })
  b.entity('save_app', 'Save application', {
    entityId,
    operation: 'create',
    outputVariable: 'application',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      phone: '{{vars.phone}}',
      role: '{{vars.role}}',
      experience: '{{vars.experience}}',
      cover_note: '{{vars.cover_note}}',
    },
  })
  b.message(
    'thanks',
    'Thanks',
    'Thanks {{vars.visitor_name}} — we received your application for {{vars.role}} and will reply at {{vars.email}}.',
  )
  b.end('end', 'End', 'Application saved under Data → Applications.')
  b.chain([
    'welcome',
    'ask_name',
    'ask_email',
    'ask_phone',
    'ask_role',
    'ask_experience',
    'ask_cover',
    'save_app',
    'thanks',
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

function buildItHelpdesk(): PackFlowBundle {
  const entityId = crypto.randomUUID()
  const entity = ticketsEntity(entityId)
  const caseUrgent = 'case_urgent'
  const caseNormal = 'case_normal'
  const caseLow = 'case_low'
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\nLog an IT request and we will triage it.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'Your name', 'name', { output: 'visitor_name' })
  b.question('ask_email', 'Email', 'Work email', 'email', { output: 'email' })
  b.question('ask_category', 'Category', 'What kind of issue is this?', 'choice', {
    output: 'category',
    config: {
      choices: ['Password / access', 'Hardware', 'Software', 'Network', 'Other'],
    },
  })
  b.question('ask_priority', 'Priority', 'How urgent is this?', 'choice', {
    output: 'priority',
    config: { choices: ['Urgent', 'Normal', 'Low'] },
  })
  b.question('ask_summary', 'Summary', 'Describe the issue', 'long_text', { output: 'summary' })
  b.entity('save_ticket', 'Save ticket', {
    entityId,
    operation: 'create',
    outputVariable: 'ticket',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      category: '{{vars.category}}',
      priority: '{{vars.priority}}',
      summary: '{{vars.summary}}',
    },
  })
  b.switchStep('sw_priority', 'Route priority', '{{vars.priority}}', [
    { id: caseUrgent, match: 'Urgent', label: 'Urgent' },
    { id: caseNormal, match: 'Normal', label: 'Normal' },
    { id: caseLow, match: 'Low', label: 'Low' },
  ])
  b.message(
    'msg_urgent',
    'Urgent',
    'Ticket {{vars.ticket.id}} logged as urgent. Connecting you with support…',
  )
  b.handoff('handoff', 'Handoff', 'Urgent IT ticket: {{vars.category}} — {{vars.summary}}')
  b.message(
    'msg_normal',
    'Normal',
    'Ticket {{vars.ticket.id}} created. Our team will follow up at {{vars.email}} within one business day.',
  )
  b.message(
    'msg_low',
    'Low',
    'Ticket {{vars.ticket.id}} queued. We will get to it when higher-priority work allows.',
  )
  b.end('end', 'End', 'Ticket saved under Data → Tickets.')

  b.chain([
    'welcome',
    'ask_name',
    'ask_email',
    'ask_category',
    'ask_priority',
    'ask_summary',
    'save_ticket',
    'sw_priority',
  ])
  b.link('sw_priority', 'msg_urgent', caseUrgent, 'Urgent')
  b.link('sw_priority', 'msg_normal', caseNormal, 'Normal')
  b.link('sw_priority', 'msg_low', caseLow, 'Low')
  b.link('sw_priority', 'msg_normal', 'default', 'Default')
  b.link('msg_urgent', 'handoff')
  b.link('handoff', 'end')
  b.link('msg_normal', 'end')
  b.link('msg_low', 'end')

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

function buildProductOnboarding(): PackFlowBundle {
  const caseSolo = 'case_solo'
  const caseTeam = 'case_team'
  const caseEnterprise = 'case_enterprise'
  const b = createPackBuilder()
  b.message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\nA quick tour so we can tailor {{vars.brand_name}} for you.',
    { templateBindings: { welcome_msg: { name: '' } } },
  )
  b.question('ask_name', 'Name', 'What should we call you?', 'name', { output: 'visitor_name' })
  b.question('ask_role', 'Role', 'What best describes your role?', 'choice', {
    output: 'role',
    config: { choices: ['Founder', 'Marketer', 'Support lead', 'Developer', 'Other'] },
  })
  b.question('ask_goal', 'Goal', 'What do you want to achieve first?', 'choice', {
    output: 'goal',
    config: {
      choices: ['Answer FAQs', 'Capture leads', 'Take payments', 'Hand off to agents'],
    },
  })
  b.question('ask_size', 'Team size', 'How big is your team?', 'choice', {
    output: 'team_size',
    config: { choices: ['Just me', '2–10', '11–50', '51+'] },
  })
  b.switchStep('sw_size', 'Route size', '{{vars.team_size}}', [
    { id: caseSolo, match: 'Just me', label: 'Solo' },
    { id: caseTeam, match: '2–10', label: 'Small team' },
    { id: caseEnterprise, match: '51+', label: 'Larger org' },
  ])
  b.message(
    'msg_solo',
    'Solo tip',
    'Great start, {{vars.visitor_name}}. Try the Essentials templates and publish a simple FAQ first.',
  )
  b.message(
    'msg_team',
    'Team tip',
    'Nice — invite editors on Organisation → Users, then share a staging link before go-live.',
  )
  b.message(
    'msg_enterprise',
    'Org tip',
    'For larger teams, set up SSO, queues, and compliance under Admin once you publish.',
  )
  b.message(
    'next',
    'Next steps',
    'You said your first goal is “{{vars.goal}}”. Open Design to customise the flow, then Test before publishing.',
  )
  b.end('end', 'End', 'Onboarding complete — keep editing on Design and Templates.')

  b.chain(['welcome', 'ask_name', 'ask_role', 'ask_goal', 'ask_size', 'sw_size'])
  b.link('sw_size', 'msg_solo', caseSolo, 'Solo')
  b.link('sw_size', 'msg_team', caseTeam, 'Team')
  b.link('sw_size', 'msg_enterprise', caseEnterprise, 'Enterprise')
  b.link('sw_size', 'msg_team', 'default', 'Default')
  b.link('msg_solo', 'next')
  b.link('msg_team', 'next')
  b.link('msg_enterprise', 'next')
  b.link('next', 'end')

  return {
    ...emptyPackBundle(),
    nodes: b.nodes,
    edges: b.edges,
    globals: brandGlobals(),
    templates: commonOrgTemplates(),
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
  {
    id: 'faq_menu',
    name: 'FAQ navigator',
    summary: 'Menu topics routed with a Switch step to hours, FAQ, or contact.',
    includes: ['Choice menu', 'Switch routing', 'Hours & FAQ templates'],
    suggestedName: 'FAQ assistant',
    suggestedDescription: 'Guide visitors through hours, FAQ, or a short contact path.',
    build: buildFaqMenu,
  },
  {
    id: 'agent_handoff',
    name: 'Agent handoff',
    summary: 'Collect context, then escalate to a live agent in Inbox.',
    includes: ['Triage questions', 'Handoff step', 'Common org templates'],
    suggestedName: 'Live support',
    suggestedDescription: 'Qualify the visitor, then hand off to your agent queue.',
    build: buildAgentHandoff,
  },
  {
    id: 'event_rsvp',
    name: 'Event RSVP',
    summary: 'Collect attendance, guests, and notes into an RSVPs entity.',
    includes: ['RSVP questions', 'Switch on Yes/No/Maybe', 'RSVPs entity'],
    suggestedName: 'Event RSVP',
    suggestedDescription: 'Let guests confirm attendance for your next event.',
    build: buildEventRsvp,
  },
  {
    id: 'job_application',
    name: 'Job application',
    summary: 'Capture role, experience, and a cover note into Applications.',
    includes: ['Career questions', 'Applications entity', 'Legal template'],
    suggestedName: 'Careers chatbot',
    suggestedDescription: 'Accept job applications with structured screening questions.',
    build: buildJobApplication,
  },
  {
    id: 'it_helpdesk',
    name: 'IT helpdesk',
    summary: 'Log tickets by category and priority; urgent cases hand off.',
    includes: ['Ticket form', 'Priority switch', 'Handoff', 'Tickets entity'],
    suggestedName: 'IT helpdesk',
    suggestedDescription: 'Triage IT issues and escalate urgent tickets to agents.',
    build: buildItHelpdesk,
  },
  {
    id: 'product_onboarding',
    name: 'Product onboarding',
    summary: 'A short guided tour that branches tips by team size.',
    includes: ['Onboarding questions', 'Switch tips', 'Brand globals'],
    suggestedName: 'Getting started',
    suggestedDescription: 'Welcome new users and point them to the right next step.',
    build: buildProductOnboarding,
  },
]

export function getChatbotStarterPack(id: string | null | undefined): ChatbotStarterPack {
  return CHATBOT_STARTER_PACKS.find((p) => p.id === id) ?? CHATBOT_STARTER_PACKS[0]!
}
