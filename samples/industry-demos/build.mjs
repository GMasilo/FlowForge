/**
 * Industry service demos — menu→switch journeys with entities, HTTP, shop, email, etc.
 * Run from repo root: node samples/industry-demos/build.mjs
 *
 * After import, bind organisation connections named:
 *   Demo Lab HTTP  → https://gkjtt.co.za/flowforge/demo
 *   Demo Lab SQLite (optional)
 * See web/demo/CONNECTIONS.md
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  attr,
  cartTemplate,
  createBuilder,
  emailHtml,
  enquiryAttributes,
  hoursDays,
  idAttr,
  packDocumentTemplate,
} from './kit.mjs'
import { EXTRA_INDUSTRIES } from './industries-rest.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = join(ROOT, '..')
const PUBLIC = join(REPO, 'web', 'public', 'samples')

const DEMO = 'https://gkjtt.co.za/flowforge/demo'

const DEFAULT_CITIES = ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein']

function commonTemplates(ind) {
  const menuHints = ind.menuHints ?? ind.menuChoices.map(() => '')
  return [
    {
      key: 'welcome_msg',
      name: 'Welcome',
      kind: 'message',
      description: 'Opening copy',
      content: {
        inputs: [{ key: 'name', label: 'Guest name', type: 'string', required: true }],
        text: ind.welcome,
      },
    },
    {
      key: 'main_menu',
      name: 'Services menu',
      kind: 'menu',
      description: 'Service overview with hints',
      content: {
        inputs: [],
        title: 'How can I help?',
        items: ind.menuChoices.map((label, i) => ({ label, description: menuHints[i] ?? '', value: label })),
      },
    },
    {
      key: 'hours_main',
      name: 'Opening hours',
      kind: 'hours',
      description: 'Hours card',
      content: { inputs: [], timezone: 'Africa/Johannesburg', note: ind.hoursNote, days: hoursDays() },
    },
    {
      key: 'help_faq',
      name: 'FAQ',
      kind: 'faq',
      description: 'FAQ with intro',
      content: {
        inputs: [{ key: 'brand', label: 'Brand', type: 'string', required: false }],
        title: 'FAQ',
        intro: `Quick answers about {{coalesce(inputs.brand, "${ind.brand}")}}:`,
        items: ind.faqItems,
      },
    },
    {
      key: 'terms_of_use',
      name: 'Terms',
      kind: 'legal',
      description: 'Demo terms',
      content: { inputs: [], title: ind.legalTitle, body: ind.legalBody },
    },
    {
      key: 'followup_email',
      name: 'Follow-up email',
      kind: 'email',
      description: 'Confirmation email HTML with reference',
      content: {
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: true },
          { key: 'brand', label: 'Brand', type: 'string', required: false },
          { key: 'service', label: 'Service', type: 'string', required: false },
          { key: 'reference', label: 'Reference', type: 'string', required: false },
          { key: 'city', label: 'City', type: 'string', required: false },
          { key: 'followup', label: 'Follow-up date', type: 'string', required: false },
          { key: 'summary', label: 'Summary', type: 'string', required: false },
          { key: 'support', label: 'Support email', type: 'string', required: false },
        ],
        subject: `${ind.brand}: your {{coalesce(inputs.service, "request")}} · ref {{coalesce(inputs.reference, "pending")}}`,
        html: emailHtml(ind.brand),
      },
    },
    {
      key: 'order_receipt',
      name: 'Receipt',
      kind: 'receipt',
      description: 'Shop receipt with expressions',
      content: {
        inputs: [
          { key: 'name', label: 'Name', type: 'string', required: false },
          { key: 'service', label: 'Service', type: 'string', required: false },
          { key: 'city', label: 'City', type: 'string', required: false },
          { key: 'order_id', label: 'Order id', type: 'string', required: false },
        ],
        title: `${ind.brand} receipt`,
        intro: 'Thanks **{{titleCase(inputs.name)}}** — {{coalesce(inputs.service, "your request")}} in {{coalesce(inputs.city, "your area")}}.\n\nReference: **{{coalesce(inputs.order_id, "pending")}}**',
        footer: `Demo receipt · ${ind.brand} · FlowForge`,
      },
    },
    packDocumentTemplate(ind),
    ind.cart,
  ]
}

function wireIdentityAndMenu(b, ind) {
  const identity = ind.identity ?? {}
  const fields = Array.isArray(identity.fields) ? identity.fields : []

  // Keep the opener light: greet only. Hours / FAQ / terms stay as templates for later use.
  b.message('welcome', 'Welcome', '{{templates.welcome_msg.text}}', {
    templateBindings: {
      welcome_msg: { name: '{{vars.guest_label}}' },
    },
  })

  b.question(
    'ask_captcha',
    'Captcha',
    identity.captchaPrompt ?? 'Quick human check before we start.',
    'captcha',
    {
      output: 'captcha_ok',
      config: { captchaKind: 'math', captchaMaxAttempts: 5 },
    },
  )
  b.question(
    'ask_confirm',
    'Confirm demo',
    identity.confirmPrompt ??
      'This is a demonstration — do not enter real secrets or live credentials.',
    'confirm',
    {
      output: 'terms_ok',
      config: { confirmLabel: identity.confirmLabel ?? 'I agree — this is a demo' },
    },
  )

  // Let visitors choose a path before any profile intake.
  b.message(
    'menu_bridge',
    'Services',
    identity.menuBridge ??
      [
        '{{templates.main_menu.text}}',
        '',
        '{color:muted}Pick what you need — we will only ask for details after that.{/color}',
      ].join('\n'),
  )

  b.question(
    'ask_service',
    'Service',
    identity.servicePrompt ?? 'What would you like to do?',
    'choice',
    {
      output: 'service',
      config: { choices: ind.menuChoices },
    },
  )

  if (identity.intakeIntro) {
    b.message('intake_intro', 'A few details', identity.intakeIntro)
  }

  const fieldKeys = []
  for (const field of fields) {
    const key = field.key
    fieldKeys.push(key)
    b.question(key, field.label, field.prompt, field.answerType, {
      output: field.output,
      required: field.required !== false,
      config: field.config ?? {},
    })
  }

  // Defaults so closer/PDF bindings stay safe when an industry skips a field.
  b.setVars('set_identity_vars', 'Identity variables', [
    { variableKey: 'full_name', value: '{{trim(coalesce(vars.visitor_name, ""))}}', valueType: 'string' },
    { variableKey: 'phone', value: '{{coalesce(vars.phone, "")}}', valueType: 'string' },
    { variableKey: 'country', value: '{{coalesce(vars.country, "")}}', valueType: 'string' },
    { variableKey: 'city', value: '{{coalesce(vars.city, "")}}', valueType: 'string' },
    { variableKey: 'gender', value: '{{coalesce(vars.gender, "")}}', valueType: 'string' },
    { variableKey: 'birthday', value: '{{coalesce(vars.birthday, "")}}', valueType: 'string' },
    { variableKey: 'address', value: '{{coalesce(vars.address, "")}}', valueType: 'string' },
    { variableKey: 'mood', value: '{{coalesce(vars.mood, "")}}', valueType: 'string' },
    { variableKey: 'national_id', value: '{{coalesce(vars.national_id, "")}}', valueType: 'string' },
    { variableKey: 'company', value: '{{coalesce(vars.company, "")}}', valueType: 'string' },
    { variableKey: 'postal_code', value: '{{coalesce(vars.postal_code, "")}}', valueType: 'string' },
    { variableKey: 'priority', value: identity.defaultPriority ?? 'standard', valueType: 'string' },
    { variableKey: 'summary', value: '', valueType: 'string' },
    {
      variableKey: 'checklist',
      value: JSON.stringify(
        ind.wrapChecklist ?? [
          'We review your details',
          'You receive a confirmation',
          'A specialist may follow up',
        ],
      ),
      valueType: 'array',
    },
  ])

  b.operation('op_upper_name', 'Uppercase name', {
    operation: 'upper',
    left: '{{vars.visitor_name}}',
    right: '',
    outputVariable: 'visitor_name_upper',
  })
  b.operation('op_name_len', 'Name length', {
    operation: 'length',
    left: '{{vars.visitor_name}}',
    right: '',
    outputVariable: 'name_len',
  })
  b.operation('op_email_display', 'Email display', {
    operation: 'replace',
    left: '{{vars.email}}',
    right: '@',
    replaceWith: ' [at] ',
    outputVariable: 'email_display',
  })

  b.message(
    'identity_recap',
    'Profile ready',
    identity.recap ??
      [
        '**Thanks, {{titleCase(vars.visitor_name)}}**',
        '',
        '📧 `{{vars.email_display}}`',
        '{color:muted}Today is {{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}.{/color}',
      ].join('\n'),
  )

  b.setVar('init_signature', 'Init signature', 'signature', '')

  b.switchStep(
    'sw_service',
    'Route service',
    '{{vars.service}}',
    ind.branches.map((br) => ({ id: br.caseId, match: br.match, label: br.label })),
  )

  const chainKeys = ['welcome', 'ask_captcha', 'ask_confirm', 'menu_bridge', 'ask_service']
  if (identity.intakeIntro) chainKeys.push('intake_intro')
  chainKeys.push(
    ...fieldKeys,
    'set_identity_vars',
    'op_upper_name',
    'op_name_len',
    'op_email_display',
    'identity_recap',
    'init_signature',
    'sw_service',
  )
  b.chain(chainKeys)
}

function wireCloser(b, ind) {
  // http_submit is created earlier so branches can link to it.
  // After http_submit, set reference and followup variables
  b.setVars('set_ref_vars', 'Set reference', [
    { variableKey: 'reference', value: '{{coalesce(vars.lab_submit.submission_id, "pending")}}', valueType: 'string' },
    { variableKey: 'followup_on', value: '{{formatDate(dateAdd(utcNow(), coalesce(vars.followup_days, 2), "days"), "EEE d MMM")}}', valueType: 'string' },
  ])
  // Set summary if empty
  b.setVars('set_summary_vars', 'Set summary', [
    { variableKey: 'summary', value: '{{if(empty(vars.summary), vars.service + " in " + coalesce(vars.city, "your area"), vars.summary)}}', valueType: 'string' },
  ])

  // Internal notification (hidden from visitor)
  b.http('http_email_sink', 'Notify inbox', {
    method: 'POST',
    path: '/email/sink',
    body: JSON.stringify({
      to: '{{vars.email}}',
      subject: `${ind.brand}: {{vars.service}}`,
      body: 'Thanks {{vars.visitor_name}} -- we logged your {{vars.service}} request. Ref {{vars.reference}}.',
    }),
    outputVariable: 'email_sink',
  })

  // Real email to visitor with rich template
  b.email('send_email', 'Send confirmation', {
    connectionId: '',
    templateKey: 'followup_email',
    to: '{{vars.email}}',
    subject: '',
    body: '{{templates.followup_email.html}}',
    templateBindings: {
      followup_email: {
        name: '{{vars.full_name}}',
        brand: '{{vars.brand_name}}',
        service: '{{vars.service}}',
        reference: '{{vars.reference}}',
        city: '{{vars.city}}',
        followup: '{{vars.followup_on}}',
        summary: '{{vars.summary}}',
        support: '{{vars.support_email}}',
      },
    },
  })

  // Save enquiry with expanded fields
  b.entity('save_enquiry', 'Save enquiry', {
    entityId: ind.dynamicEntityId,
    operation: 'create',
    fieldMap: {
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      phone: '{{coalesce(vars.phone, "")}}',
      country: '{{coalesce(vars.country, "")}}',
      city: '{{coalesce(vars.city, "")}}',
      service: '{{vars.service}}',
      summary: '{{vars.summary}}',
      priority: '{{vars.priority}}',
      mood: '{{coalesce(vars.mood, "")}}',
      reference: '{{vars.reference}}',
      followup_on: '{{vars.followup_on}}',
    },
    outputVariable: 'enquiry',
  })

  // Loop through checklist items
  b.loop('loop_next', 'Next steps', '{{vars.checklist}}', 'check_item', 'check_index')
  b.message(
    'msg_check_item',
    'Checklist item',
    '{{vars.check_index + 1}}. {{vars.check_item}}',
  )

  // Wrap message — visitor-friendly, no internal jargon
  b.question(
    'ask_doc_sign',
    'Sign pack',
    'Please sign so we can stamp your confirmation pack.',
    'signature',
    { output: 'signature' },
  )

  b.message(
    'wrap',
    'Confirmation',
    [
      '## Thanks, {{titleCase(vars.visitor_name)}} ✓',
      '',
      '**Service:** {{vars.service}}',
      '**Reference:** `{{vars.reference}}`',
      '**Follow-up:** around {{vars.followup_on}}',
      '',
      '📍 {{coalesce(vars.city, "Your area")}}, {{coalesce(vars.country, "")}}',
      '📱 {{coalesce(vars.phone, "—")}}',
      '📧 `{{vars.email_display}}`',
      '',
      ind.accentNote ? `{color:accent}${ind.accentNote}{/color}` : '{color:accent}Keep this confirmation for your records.{/color}',
      '',
      '---',
      '',
      '{{templates.order_receipt.text}}',
      '',
      '{{templates.pack_document.file}}',
    ].join('\n'),
    {
      templateBindings: {
        order_receipt: {
          name: '{{vars.visitor_name}}',
          service: '{{vars.service}}',
          city: '{{vars.city}}',
          order_id: '{{coalesce(vars.enquiry.id, vars.reference, "demo")}}',
        },
        pack_document: {
          name: '{{vars.visitor_name}}',
          email: '{{vars.email}}',
          phone: '{{vars.phone}}',
          country: '{{vars.country}}',
          city: '{{vars.city}}',
          service: '{{vars.service}}',
          priority: '{{vars.priority}}',
          mood: '{{vars.mood}}',
          reference: '{{vars.reference}}',
          followup: '{{vars.followup_on}}',
          summary: '{{vars.summary}}',
          signature: '{{vars.signature}}',
          brand: '{{vars.brand_name}}',
          support: '{{vars.support_email}}',
        },
      },
    },
  )
  b.end('end', 'Goodbye', [
    'Thanks for exploring **{{vars.brand_name}}**.',
    '',
    '{{coalesce(vars.brand_tagline, "")}}',
    '',
    '{color:muted}Restart the chat to try another service.{/color}',
  ].join('\n'))

  // Chain: http_submit → set_ref_vars → set_summary_vars → http_email_sink → send_email → save_enquiry → loop_next → (body) → ask_doc_sign → wrap → end
  b.chain(['http_submit', 'set_ref_vars', 'set_summary_vars', 'http_email_sink', 'send_email', 'save_enquiry', 'loop_next'])
  // Loop body edge
  b.link('loop_next', 'msg_check_item', 'body', 'Each')
  // After loop body, collect signature then wrap
  b.link('msg_check_item', 'ask_doc_sign', null, 'Then')
  b.chain(['ask_doc_sign', 'wrap', 'end'])
}

/** @param {ReturnType<typeof createBuilder>} b */
function attachBranch(b, caseId, match, entryKey, exitKey) {
  b.link('sw_service', entryKey, caseId, match)
  b.link(exitKey, 'http_submit')
}

function buildPack(ind, index) {
  const prefix = `a3${String(index + 1).padStart(3, '0')}000-0000-4000-8000-`
  const b = createBuilder(prefix)
  wireIdentityAndMenu(b, ind)
  // Create submit node before branches so attachBranch can link to it.
  b.http('http_submit', 'Confirm request', {
    method: 'POST',
    path: '/industry/submit',
    body: JSON.stringify({
      industry: ind.id,
      service: '{{vars.service}}',
      name: '{{vars.visitor_name}}',
      email: '{{vars.email}}',
      phone: '{{vars.phone}}',
      country: '{{vars.country}}',
      city: '{{vars.city}}',
      mood: '{{vars.mood}}',
      priority: '{{vars.priority}}',
    }),
    outputVariable: 'lab_submit',
  })
  ind.wireBranches(b, ind)
  wireCloser(b, ind)
  // All switch exits converge on http_submit (including default) so closer vars are guaranteed.
  b.link('sw_service', 'http_submit', 'default', 'Default')

  const templates = commonTemplates(ind)
  const entityDefs = [ind.staticEntity, ind.dynamicEntity]

  return {
    kind: 'flowforge.chatbotFlow',
    version: 1,
    exportedAt: new Date().toISOString(),
    chatbot: {
      id: ind.chatbotId,
      name: ind.name,
      description: ind.description,
    },
    flow: { id: ind.flowId, name: 'Main', version: 1 },
    globals: [
      {
        key: 'brand_name',
        label: 'Brand',
        value_type: 'string',
        default_value: ind.brand,
        description: 'Organisation or product name displayed to visitors.',
      },
      {
        key: 'brand_tagline',
        label: 'Tagline',
        value_type: 'string',
        default_value: ind.tagline ?? '',
        description: 'Short slogan shown at the end of the chat.',
      },
      {
        key: 'guest_label',
        label: 'Guest label',
        value_type: 'string',
        default_value: ind.guestLabel,
        description: 'How we address a visitor before they give their name.',
      },
      {
        key: 'support_email',
        label: 'Support email',
        value_type: 'string',
        default_value: ind.supportEmail,
        description: 'Contact email for visitor queries.',
      },
      {
        key: 'followup_days',
        label: 'Follow-up days',
        value_type: 'number',
        default_value: ind.followupDays ?? 2,
        description: 'Days until the estimated follow-up date.',
      },
      {
        key: 'service_cities',
        label: 'Service cities',
        value_type: 'array',
        default_value: ind.cities ?? DEFAULT_CITIES,
        description: 'City choices for the autocomplete field.',
      },
      {
        key: 'demo_lab_base',
        label: 'Demo lab base URL',
        value_type: 'string',
        default_value: DEMO,
        description: 'Internal demo API base (not shown to visitors).',
      },
    ],
    nodes: b.nodes,
    edges: b.edges,
    entities: entityDefs.map((e) => ({ id: e.id, key: e.key })),
    entityDefs,
    templates,
    testScenarios: [],
    connectionHints: [
      {
        name: 'Demo Lab HTTP',
        kind: 'http',
        baseUrl: DEMO,
        note: 'Required for lookups, quotes, submit, and email sink.',
      },
      {
        name: 'Demo Lab SQLite',
        kind: 'database',
        note: 'Optional -- SQLite file on the demo host (see CONNECTIONS.md).',
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Industries
// ---------------------------------------------------------------------------

/** @type {Array<any>} */
const INDUSTRIES = [
  {
    id: 'health',
    slug: 'usecase-health',
    file: 'flowforge-usecase-health.json',
    chatbotId: 'c3000000-0000-4000-8000-000000000001',
    flowId: 'f3000000-0000-4000-8000-000000000001',
    staticEntityId: 'b3100000-0000-4000-8000-000000000001',
    dynamicEntityId: 'b3200000-0000-4000-8000-000000000001',
    name: 'Health — Patient intake & care journey',
    description:
      'CareFlow Clinic: book visits, triage symptoms, pharmacy shop, records release, and feedback.',
    brand: 'CareFlow Clinic',
    guestLabel: 'Patient',
    supportEmail: 'care@careflow.example',
    tagline: 'Your wellness, our priority.',
    followupDays: 2,
    cities: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Sandton', 'Centurion'],
    menuHints: [
      'Schedule a visit or telehealth session',
      'Quick symptom check and triage',
      'Order wellness products',
      'Request medical records',
      'Share your experience',
    ],
    wrapChecklist: [
      'Our team reviews your request',
      'You receive a confirmation email',
      'A care coordinator may follow up',
      'Keep this reference for your records',
    ],
    accentNote: 'If symptoms worsen, please seek immediate care.',
    welcome:
      'Hi — I’m the **CareFlow** clinic assistant.\n\nTell me what you need and we’ll take it from there.\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}{/color}',
    identity: {
      captchaPrompt: 'Quick patient check — solve this before we open your file.',
      confirmPrompt: 'This is a CareFlow demonstration. Do not enter real medical history or someone else’s ID.',
      confirmLabel: 'I understand — continue as a demo patient',
      intakeIntro:
        'A couple of details for **{{vars.service}}** — then we continue.',
      servicePrompt: 'What brings you in today?',
      menuBridge:
        '{{templates.main_menu.text}}\n\n{color:muted}Pick one — we’ll only ask for details after that.{/color}',
      recap: [
        '**Patient file ready for {{titleCase(vars.visitor_name)}}**',
        '',
        'Born {{if(empty(vars.birthday), "—", formatDate(vars.birthday, "d MMM yyyy"))}} · {{coalesce(vars.gender, "gender not shared")}}',
        'Contact: `{{vars.email_display}}` · {{coalesce(vars.phone, "no phone on file")}}',
        'Feeling today: **{{coalesce(vars.mood, "—")}}**',
        '',
        '{color:muted}Preferred clinic area: {{coalesce(vars.city, "any CareFlow site")}}{/color}',
      ].join('\n'),
      fields: [
        {
          key: 'ask_name',
          label: 'Patient name',
          prompt: 'Patient full name as it should appear on the clinic file?',
          answerType: 'name',
          output: 'visitor_name',
        },
        {
          key: 'ask_birthday',
          label: 'Date of birth',
          prompt: 'Date of birth? (demo — use any date)',
          answerType: 'date',
          output: 'birthday',
        },
        {
          key: 'ask_gender',
          label: 'Gender',
          prompt: 'Gender for the clinic chart? (optional)',
          answerType: 'gender',
          output: 'gender',
          required: false,
        },
        {
          key: 'ask_phone',
          label: 'Mobile',
          prompt: 'Mobile number for appointment SMS reminders?',
          answerType: 'phone',
          output: 'phone',
        },
        {
          key: 'ask_email',
          label: 'Email',
          prompt: 'Email for prescriptions and visit summaries?',
          answerType: 'email',
          output: 'email',
        },
        {
          key: 'ask_city',
          label: 'Clinic area',
          prompt: 'Which CareFlow area is most convenient?',
          answerType: 'autocomplete',
          output: 'city',
          config: { choicesFrom: '{{vars.service_cities}}' },
        },
        {
          key: 'ask_mood',
          label: 'How you feel',
          prompt: 'How are you feeling as you start this visit?',
          answerType: 'mood',
          output: 'mood',
        },
      ],
    },
    hoursNote: 'Clinic hours for walk-ins and telehealth (demo).',
    faqItems: [
      { question: 'Is this medical advice?', answer: 'No — this is a demonstration only. Do not enter real patient data.' },
      {
        question: 'How do I book a visit?',
        answer: 'Choose Book appointment from the menu, then pick a service and time that suits you.',
      },
    ],
    legalTitle: 'Patient demo terms',
    legalBody: 'Demo only. Do not enter real medical history or third-party ID numbers.',
    menuChoices: [
      'Book appointment',
      'Report symptoms',
      'Pharmacy shop',
      'Request records',
      'Clinic feedback',
    ],
    cart: cartTemplate({
      key: 'clinic_store',
      name: 'CareFlow pharmacy',
      intro: 'Wellness products — checkout includes shipping and VAT (demo).',
      categories: [
        { id: 'cat_vax', name: 'Vaccines' },
        { id: 'cat_well', name: 'Wellness' },
      ],
      products: [
        { id: 'prod_flu', sku: 'CF-FLU', name: 'Flu shot voucher', description: 'Seasonal vaccination', price: 350, categoryId: 'cat_vax', stock: 40 },
        { id: 'prod_tele', sku: 'CF-TEL', name: 'Telehealth credit', description: '15-min video consult', price: 280, categoryId: 'cat_well', stock: 50 },
        { id: 'prod_kit', sku: 'CF-KIT', name: 'Home vitals kit', description: 'BP cuff + oximeter', price: 620, categoryId: 'cat_well', stock: 22 },
      ],
    }),
    get staticEntity() {
      return {
        id: this.staticEntityId,
        key: 'clinic_services',
        name: 'Clinic services',
        description: 'Static service catalog',
        kind: 'static',
        attributes: [
          idAttr(),
          attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
          attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
          attr('wait_mins', 'Wait (mins)', 'number', { sort_order: 2 }),
        ],
        records: [
          { id: '31111111-1111-4111-8111-111111111101', code: 'GP-01', name: 'General practice', wait_mins: 25 },
          { id: '31111111-1111-4111-8111-111111111102', code: 'TEL-10', name: 'Telehealth triage', wait_mins: 10 },
          { id: '31111111-1111-4111-8111-111111111103', code: 'VAX-03', name: 'Nurse / vaccinations', wait_mins: 15 },
        ],
      }
    },
    get dynamicEntity() {
      return {
        id: this.dynamicEntityId,
        key: 'care_requests',
        name: 'Care requests',
        description: 'Logged CareFlow enquiries',
        kind: 'dynamic',
        attributes: enquiryAttributes(),
        records: [],
      }
    },
    branches: [
      { caseId: 'case_appt', match: 'Book appointment', label: 'Appointment' },
      { caseId: 'case_triage', match: 'Report symptoms', label: 'Triage' },
      { caseId: 'case_shop', match: 'Pharmacy shop', label: 'Pharmacy' },
      { caseId: 'case_records', match: 'Request records', label: 'Records' },
      { caseId: 'case_feedback', match: 'Clinic feedback', label: 'Feedback' },
    ],
    wireBranches(b, ind) {
      // Appointment
      b.message('intro_appt', 'Appointment', 'Let’s book a clinic or telehealth slot.')
      b.entity('list_services', 'List services', {
        entityId: ind.staticEntityId,
        operation: 'list',
        outputVariable: 'clinic_services',
      })
      b.question('appt_type', 'Visit type', 'Which service?', 'choice', {
        output: 'visit_type',
        config: {
          choices: ['General practice', 'Telehealth triage', 'Nurse / vaccinations', 'Paediatrics'],
        },
      })
      b.question('appt_returning', 'Returning?', 'Have you visited CareFlow before?', 'boolean', {
        output: 'returning_patient',
      })
      b.question('appt_clinic', 'Clinic area', 'Roughly where should we see you? (optional)', 'location', {
        output: 'clinic_geo',
        required: false,
      })
      b.question('appt_stars', 'Preference', 'Preferred clinician rating (demo)?', 'stars', {
        output: 'clinician_pref',
        required: false,
      })
      b.question('appt_when', 'Slot', 'Preferred date and time?', 'appointment', {
        output: 'appointment_at',
      })
      b.question('appt_reason', 'Reason', 'Brief reason for the visit?', 'long_text', {
        output: 'visit_reason',
      })
      b.http('http_appt', 'Confirm booking', {
        method: 'POST',
        path: '/health/appointments',
        body: JSON.stringify({
          visit_type: '{{vars.visit_type}}',
          appointment_at: '{{vars.appointment_at}}',
          reason: '{{vars.visit_reason}}',
          patient: '{{vars.visitor_name}}',
          email: '{{vars.email}}',
          returning: '{{vars.returning_patient}}',
        }),
        outputVariable: 'booking',
      })
      b.setVar('set_booking_id', 'Booking id', 'booking_id', '{{vars.booking.booking_id}}')
      b.message(
        'done_appt',
        'Booked',
        [
          'Booked **{{vars.visit_type}}** for **{{prettify(vars.appointment_at)}}**.',
          'Reminder day: **{{formatDate(dateAdd(vars.appointment_at, -1, "days"), "EEE d MMM")}}**.',
          'Reference: **{{vars.booking_id}}** · returning patient: **{{if(vars.returning_patient, "yes", "no")}}**.',
          '{{if(empty(vars.clinician_pref), "", concat("Preferred rating: ", vars.clinician_pref, "★"))}}',
        ].join('\n'),
      )
      b.chain([
        'intro_appt',
        'list_services',
        'appt_type',
        'appt_returning',
        'appt_clinic',
        'appt_stars',
        'appt_when',
        'appt_reason',
        'http_appt',
        'set_booking_id',
        'done_appt',
      ])
      attachBranch(b, 'case_appt', 'Book appointment', 'intro_appt', 'done_appt')

      // Triage
      b.message('intro_triage', 'Triage', 'Short triage — not a diagnosis.')
      b.question('symptom_main', 'Symptom', 'Main symptom today?', 'choice', {
        output: 'main_symptom',
        config: {
          choices: ['Fever / flu', 'Pain', 'Cough / breathing', 'Stomach', 'Mental wellbeing', 'Other'],
        },
      })
      b.question('symptom_severity', 'Severity', 'How severe (1–5)?', 'likert', { output: 'severity' })
      b.question('symptom_days', 'Days', 'How many days?', 'number', { output: 'symptom_days' })
      b.http('http_services', 'Load wait times', {
        method: 'GET',
        path: '/health/services',
        outputVariable: 'live_services',
      })
      b.condition('cond_urgent', 'Urgent?', '{{vars.severity}}', 'gte', '4')
      b.message(
        'msg_urgent',
        'Urgent path',
        '{color:danger}**Higher severity**{/color} ({{vars.severity}}/5). A nurse would call you next. There are **{{length(vars.live_services.data)}}** clinic services available right now.',
      )
      b.message(
        'msg_routine',
        'Routine path',
        '{color:success}**Routine triage**{/color} for **{{vars.main_symptom}}** (~{{vars.symptom_days}} days). There are **{{length(vars.live_services.data)}}** clinic services available right now.',
      )
      b.message('done_triage', 'Triage done', 'Triage complete for **{{vars.main_symptom}}**.')
      b.chain(['intro_triage', 'symptom_main', 'symptom_severity', 'symptom_days', 'http_services', 'cond_urgent'])
      b.link('cond_urgent', 'msg_urgent', 'true', 'Urgent')
      b.link('cond_urgent', 'msg_routine', 'false', 'Routine')
      b.link('msg_urgent', 'done_triage')
      b.link('msg_routine', 'done_triage')
      attachBranch(b, 'case_triage', 'Report symptoms', 'intro_triage', 'done_triage')

      // Pharmacy shop
      b.message('intro_shop', 'Pharmacy', 'Add wellness items, then pay the cart total (demo payment).')
      b.question('ask_shop', 'Shop', 'Browse the CareFlow pharmacy and checkout.', 'shop', {
        output: 'cart',
        config: { shopTemplateKey: 'clinic_store' },
      })
      b.question('ask_payment', 'Payment', 'Pay for your cart.', 'payment', {
        output: 'payment',
        config: {
          paymentAmount: '{{vars.cart.total}}',
          paymentItemName: 'CareFlow pharmacy',
          paymentBuyerEmail: '{{vars.email}}',
          paymentBuyerName: '{{vars.visitor_name}}',
        },
      })
      b.message(
        'done_shop',
        'Paid',
        'Cart total **{{vars.cart.total}} {{vars.cart.currency}}** · payment `{{coalesce(vars.payment.reference, "demo")}}`.',
      )
      b.chain(['intro_shop', 'ask_shop', 'ask_payment', 'done_shop'])
      attachBranch(b, 'case_shop', 'Pharmacy shop', 'intro_shop', 'done_shop')

      // Records
      b.message('intro_records', 'Records', 'Request a copy of your medical records.')
      b.question('record_type', 'Type', 'What do you need?', 'choice', {
        output: 'record_type',
        config: { choices: ['Visit summary', 'Lab results', 'Vaccination card', 'Referral letter'] },
      })
      b.question('ask_otp', 'Verification', 'Enter the verification code sent to your email (any 6 digits for this demo).', 'otp', {
        output: 'otp_ok',
        config: { otpSubject: 'CareFlow records code', otpLength: 6 },
      })
      b.question('ask_signature', 'Signature', 'Sign to authorise release.', 'signature', {
        output: 'signature',
      })
      b.message(
        'done_records',
        'Released',
        '**{{vars.record_type}}** queued for **{{vars.visitor_name}}**. PDF pack is attached at wrap-up.',
      )
      b.chain(['intro_records', 'record_type', 'ask_otp', 'ask_signature', 'done_records'])
      attachBranch(b, 'case_records', 'Request records', 'intro_records', 'done_records')

      // Feedback
      b.message('intro_feedback', 'Feedback', 'Tell us about your last visit.')
      b.question('ask_form', 'Visit form', 'Complete this short form.', 'form', {
        output: 'visit_form',
        config: {
          formFields: [
            { key: 'clinician', label: 'Clinician name', type: 'string', required: false },
            { key: 'department', label: 'Department', type: 'string', required: true },
            { key: 'comments', label: 'Comments', type: 'string', required: false },
          ],
        },
      })
      b.question('ask_wait_stars', 'Wait time', 'How was the wait?', 'stars', { output: 'wait_stars' })
      b.question('ask_thumbs', 'Overall', 'Was the visit helpful overall?', 'thumbs', {
        output: 'visit_thumbs',
      })
      b.question('ask_nps', 'NPS', 'How likely are you to recommend CareFlow? (0–10)', 'nps', {
        output: 'nps',
      })
      b.condition('cond_nps', 'Promoter?', '{{vars.nps}}', 'gte', '9')
      b.message(
        'msg_promoter',
        'Promoter',
        '{color:success}**Thank you!**{/color} NPS **{{vars.nps}}** · wait **{{vars.wait_stars}}★** · helpful: **{{vars.visit_thumbs}}**.',
      )
      b.message(
        'msg_feedback_ok',
        'Noted',
        '{color:warning}**We hear you.**{/color} NPS **{{vars.nps}}** · department **{{vars.visit_form.department}}**.',
      )
      b.message(
        'done_feedback',
        'Thanks',
        'Feedback saved for **{{vars.visit_form.department}}** · score band {{if(vars.nps >= 9, "promoter", if(vars.nps >= 7, "passive", "detractor"))}}.',
      )
      b.chain(['intro_feedback', 'ask_form', 'ask_wait_stars', 'ask_thumbs', 'ask_nps', 'cond_nps'])
      b.link('cond_nps', 'msg_promoter', 'true', 'Promoter')
      b.link('cond_nps', 'msg_feedback_ok', 'false', 'Other')
      b.link('msg_promoter', 'done_feedback')
      b.link('msg_feedback_ok', 'done_feedback')
      attachBranch(b, 'case_feedback', 'Clinic feedback', 'intro_feedback', 'done_feedback')
    },
  },
]

// Continue industries in part 2 file content — append remaining 5
INDUSTRIES.push(
  {
    id: 'education',
    slug: 'usecase-education',
    file: 'flowforge-usecase-education.json',
    chatbotId: 'c3000000-0000-4000-8000-000000000002',
    flowId: 'f3000000-0000-4000-8000-000000000002',
    staticEntityId: 'b3100000-0000-4000-8000-000000000002',
    dynamicEntityId: 'b3200000-0000-4000-8000-000000000002',
    name: 'Education — Student application journey',
    description:
      'Summit University: apply, browse programmes, open days, fee estimates, and status checks.',
    brand: 'Summit University',
    guestLabel: 'Applicant',
    supportEmail: 'admissions@summit.example',
    tagline: 'Shape your future with us.',
    followupDays: 3,
    cities: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Stellenbosch', 'East London'],
    menuHints: [
      'Start your application',
      'Explore faculties and courses',
      'Visit our campus',
      'Calculate your costs',
      'Track your application',
    ],
    wrapChecklist: [
      'Our admissions team reviews your details',
      'You receive confirmation by email',
      'A faculty advisor may reach out',
      'Keep your reference for future enquiries',
    ],
    accentNote: 'Good luck with your application journey!',
    welcome:
      'Hi from **Summit University** Admissions.\n\nWhat are you here for today?\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}{/color}',
    identity: {
      captchaPrompt: 'Prove you are human before we open an applicant profile.',
      confirmPrompt: 'Demo admissions only — do not upload real transcripts or identity documents.',
      confirmLabel: 'Continue as a demo applicant',
      intakeIntro:
        'Quick applicant details for **{{vars.service}}** — then we continue.',
      servicePrompt: 'How can Admissions help?',
      menuBridge:
        '{{templates.main_menu.text}}\n\n{color:muted}Pick one — we’ll only ask for details after that.{/color}',
      recap: [
        '**Applicant profile · {{titleCase(vars.visitor_name)}}**',
        '',
        'ID on file: `{{if(empty(vars.national_id), "not provided", vars.national_id)}}`',
        'From **{{coalesce(vars.country, "—")}}** · preferred campus city **{{coalesce(vars.city, "—")}}**',
        'Email: `{{vars.email_display}}` · Cell: {{coalesce(vars.phone, "—")}}',
        '{{if(empty(vars.birthday), "", "Date of birth: " + formatDate(vars.birthday, "d MMM yyyy"))}}',
        '',
        '{color:muted}Ready when you are — pick a service next.{/color}',
      ].join('\n'),
      fields: [
        {
          key: 'ask_name',
          label: 'Applicant name',
          prompt: 'Full name as it should appear on your application?',
          answerType: 'name',
          output: 'visitor_name',
        },
        {
          key: 'ask_national_id',
          label: 'ID / passport',
          prompt: 'National ID or passport number? (demo — any value)',
          answerType: 'national_id',
          output: 'national_id',
        },
        {
          key: 'ask_email',
          label: 'Email',
          prompt: 'Best email for offer letters and status updates?',
          answerType: 'email',
          output: 'email',
        },
        {
          key: 'ask_phone',
          label: 'Cell',
          prompt: 'Best cell number if Admissions needs to call you?',
          answerType: 'phone',
          output: 'phone',
        },
        {
          key: 'ask_country',
          label: 'Country',
          prompt: 'Country of residence / citizenship?',
          answerType: 'country',
          output: 'country',
        },
        {
          key: 'ask_birthday',
          label: 'Date of birth',
          prompt: 'Date of birth for age banding?',
          answerType: 'date',
          output: 'birthday',
        },
        {
          key: 'ask_city',
          label: 'Campus city',
          prompt: 'Which campus city interests you most?',
          answerType: 'autocomplete',
          output: 'city',
          config: { choicesFrom: '{{vars.service_cities}}' },
        },
      ],
    },
    hoursNote: 'Admissions counter hours (demo).',
    faqItems: [
      { question: 'Is this a real application?', answer: 'No — this is a demonstration. Do not upload real documents.' },
      {
        question: 'How do I see programmes?',
        answer: 'Choose Browse programmes from the menu to explore what is on offer in this demo.',
      },
    ],
    legalTitle: 'Applicant demo terms',
    legalBody: 'Demo only. Do not upload real transcripts or ID documents.',
    menuChoices: [
      'Apply for a programme',
      'Browse programmes',
      'Book an open day',
      'Fee estimate',
      'Check application status',
    ],
    cart: cartTemplate({
      key: 'uni_fees',
      name: 'Summit fees desk',
      intro: 'Optional fee items (demo catalog).',
      categories: [{ id: 'cat_fees', name: 'Fees' }],
      products: [
        { id: 'prod_app', sku: 'SU-APP', name: 'Application fee', description: 'Non-refundable', price: 350, categoryId: 'cat_fees', stock: 999 },
        { id: 'prod_dep', sku: 'SU-DEP', name: 'Acceptance deposit', description: 'Toward tuition', price: 2500, categoryId: 'cat_fees', stock: 999 },
      ],
    }),
    get staticEntity() {
      return {
        id: this.staticEntityId,
        key: 'programme_catalogue',
        name: 'Programme catalogue',
        description: 'Static programmes',
        kind: 'static',
        attributes: [
          idAttr(),
          attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
          attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
          attr('faculty', 'Faculty', 'string', { required: true, sort_order: 2 }),
          attr('seats', 'Seats', 'number', { sort_order: 3 }),
        ],
        records: [
          { id: '31111111-1111-4111-8111-111111111201', code: 'BCOM', name: 'BCom Business Management', faculty: 'Commerce', seats: 80 },
          { id: '31111111-1111-4111-8111-111111111202', code: 'BENG', name: 'BEng Civil Engineering', faculty: 'Engineering', seats: 40 },
          { id: '31111111-1111-4111-8111-111111111203', code: 'NURS', name: 'BSc Nursing', faculty: 'Health', seats: 35 },
        ],
      }
    },
    get dynamicEntity() {
      return {
        id: this.dynamicEntityId,
        key: 'admissions_enquiries',
        name: 'Admissions enquiries',
        description: 'Logged admissions requests',
        kind: 'dynamic',
        attributes: enquiryAttributes(),
        records: [],
      }
    },
    branches: [
      { caseId: 'case_apply', match: 'Apply for a programme', label: 'Apply' },
      { caseId: 'case_browse', match: 'Browse programmes', label: 'Browse' },
      { caseId: 'case_openday', match: 'Book an open day', label: 'Open day' },
      { caseId: 'case_fees', match: 'Fee estimate', label: 'Fees' },
      { caseId: 'case_status', match: 'Check application status', label: 'Status' },
    ],
    wireBranches(b, ind) {
      b.message('intro_apply', 'Apply', 'Start a programme application.')
      b.question('prog_choice', 'Programme', 'Which programme?', 'choice', {
        output: 'programme',
        config: {
          choices: [
            'BCom Business Management',
            'BEng Civil Engineering',
            'BSc Nursing',
            'BA Digital Media',
            'Foundation year',
          ],
        },
      })
      b.question('prog_rank', 'Priorities', 'Rank what matters most.', 'ranking', {
        output: 'priorities',
        config: { choices: ['Reputation', 'Fees', 'Location', 'Bursaries', 'Flexible classes'] },
      })
      b.question('prog_form', 'Background', 'Applicant details', 'form', {
        output: 'applicant_form',
        config: {
          formFields: [
            { key: 'school', label: 'High school', type: 'string', required: true },
            { key: 'year', label: 'Matric year', type: 'number', required: true },
            { key: 'gpa', label: 'Average / GPA', type: 'number', required: false },
          ],
        },
      })
      b.question('prog_sign', 'Declaration', 'Sign the applicant declaration.', 'signature', {
        output: 'signature',
      })
      b.message(
        'done_apply',
        'Applied',
        'Application for **{{vars.programme}}** · top priority **{{first(vars.priorities)}}** · school **{{vars.applicant_form.school}}**.',
      )
      b.chain(['intro_apply', 'prog_choice', 'prog_rank', 'prog_form', 'prog_sign', 'done_apply'])
      attachBranch(b, 'case_apply', 'Apply for a programme', 'intro_apply', 'done_apply')

      b.message('intro_browse', 'Browse', 'Browse programmes available in this demo.')
      b.http('http_programmes', 'GET programmes', {
        method: 'GET',
        path: '/education/programmes',
        outputVariable: 'live_programmes',
      })
      b.entity('list_programmes', 'List catalogue', {
        entityId: ind.staticEntityId,
        operation: 'list',
        outputVariable: 'programme_catalogue',
      })
      b.message(
        'done_browse',
        'Catalogue',
        'We found **{{length(vars.live_programmes.data)}}** programmes (local list has **{{length(vars.programme_catalogue)}}**).\n\nFeatured: **{{at(vars.live_programmes.data, 0).name}}**.',
      )
      b.chain(['intro_browse', 'http_programmes', 'list_programmes', 'done_browse'])
      attachBranch(b, 'case_browse', 'Browse programmes', 'intro_browse', 'done_browse')

      b.message('intro_openday', 'Open day', 'Reserve a campus open-day slot.')
      b.question('od_campus', 'Campus', 'Which campus?', 'choice', {
        output: 'campus',
        config: { choices: ['Main campus', 'City campus', 'Online preview'] },
      })
      b.question('od_when', 'Date', 'Preferred open-day slot?', 'appointment', { output: 'open_day_at' })
      b.question('od_confirm', 'Confirm', 'Confirm you will attend.', 'confirm', {
        output: 'od_ok',
        config: { confirmLabel: 'Yes — book my place' },
      })
      b.message(
        'done_openday',
        'Booked',
        'Open day at **{{vars.campus}}** on **{{prettify(vars.open_day_at)}}**.',
      )
      b.chain(['intro_openday', 'od_campus', 'od_when', 'od_confirm', 'done_openday'])
      attachBranch(b, 'case_openday', 'Book an open day', 'intro_openday', 'done_openday')

      b.message('intro_fees', 'Fees', 'Estimate fees with a quick calculation.')
      b.question('fee_residency', 'Residency', 'Fee category?', 'choice', {
        output: 'residency',
        config: { choices: ['South African', 'SADC', 'International'] },
      })
      b.question('fee_tuition', 'Tuition', 'Expected annual tuition?', 'currency', {
        output: 'tuition',
      })
      b.question('fee_bursary', 'Bursary', 'Expected bursary / discount?', 'currency', {
        output: 'bursary',
        required: false,
      })
      b.setVar('set_base_fee', 'Base fee', 'base_fee', '{{vars.tuition}}', 'number')
      b.operation('op_net_fee', 'Net fee', {
        operation: 'subtract',
        left: '{{vars.base_fee}}',
        right: '{{coalesce(vars.bursary, 0)}}',
        outputVariable: 'net_fee',
      })
      b.condition('cond_balance', 'Balance due?', '{{vars.net_fee}}', 'gt', '0')
      b.message(
        'msg_balance',
        'Balance',
        '{color:warning}Estimated balance due:{/color} **{{round(vars.net_fee, 2)}}** ({{vars.residency}}).',
      )
      b.message(
        'msg_covered',
        'Covered',
        '{color:success}Bursary appears to cover tuition{/color} for this demo estimate.',
      )
      b.message('done_fees', 'Fees done', 'Fee estimate complete.')
      b.chain([
        'intro_fees',
        'fee_residency',
        'fee_tuition',
        'fee_bursary',
        'set_base_fee',
        'op_net_fee',
        'cond_balance',
      ])
      b.link('cond_balance', 'msg_balance', 'true', 'Due')
      b.link('cond_balance', 'msg_covered', 'false', 'Covered')
      b.link('msg_balance', 'done_fees')
      b.link('msg_covered', 'done_fees')
      attachBranch(b, 'case_fees', 'Fee estimate', 'intro_fees', 'done_fees')

      b.message('intro_status', 'Status', 'Look up a demo application reference.')
      b.question('status_ref', 'Reference', 'Application reference (try SUM-2026-001)?', 'text', {
        output: 'app_reference',
      })
      b.question('status_otp', 'Verification', 'Enter the verification code (any 6 digits for this demo).', 'otp', {
        output: 'otp_ok',
        config: { otpSubject: 'Summit status code', otpLength: 6 },
      })
      b.message(
        'done_status',
        'Status',
        '**{{vars.app_reference}}**: {color:accent}Under review{/color} -- documents received, faculty decision pending.',
      )
      b.chain(['intro_status', 'status_ref', 'status_otp', 'done_status'])
      attachBranch(b, 'case_status', 'Check application status', 'intro_status', 'done_status')
    },
  },
  ...EXTRA_INDUSTRIES,
)

mkdirSync(PUBLIC, { recursive: true })

const index = []
for (let i = 0; i < INDUSTRIES.length; i++) {
  const ind = INDUSTRIES[i]
  const pack = buildPack(ind, i)
  const outPath = join(ROOT, ind.file)
  writeFileSync(outPath, JSON.stringify(pack, null, 2) + '\n')
  copyFileSync(outPath, join(PUBLIC, ind.file))
  index.push({
    id: ind.id,
    slug: ind.slug,
    file: ind.file,
    name: ind.name,
    brand: ind.brand,
    description: ind.description,
  })
  console.log('Wrote', ind.file, `(${pack.nodes.length} nodes, ${pack.edges.length} edges)`)
}

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.json'), JSON.stringify(index, null, 2) + '\n')
writeFileSync(join(PUBLIC, 'usecase-index.json'), JSON.stringify(index, null, 2) + '\n')
console.log('Done --', INDUSTRIES.length, 'industry packs · demo lab', DEMO)
