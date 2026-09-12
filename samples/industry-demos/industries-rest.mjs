/**
 * Remaining industry packs (mining, banking, retail, government).
 * Imported by build.mjs -- keep shape identical to health / education.
 */
import { attr, cartTemplate, enquiryAttributes, idAttr } from './kit.mjs'

function attachBranch(b, caseId, match, entryKey, exitKey) {
  b.link('sw_service', entryKey, caseId, match)
  b.link(exitKey, 'http_submit')
}

const mining = {
  id: 'mining',
  slug: 'usecase-mining',
  file: 'flowforge-usecase-mining.json',
  chatbotId: 'c3000000-0000-4000-8000-000000000003',
  flowId: 'f3000000-0000-4000-8000-000000000003',
  staticEntityId: 'b3100000-0000-4000-8000-000000000003',
  dynamicEntityId: 'b3200000-0000-4000-8000-000000000003',
  name: 'Mining -- Site induction & safety report',
  description:
    'OreGuard Mining: book induction, report hazards, request PPE, visitor access, and HSE contact.',
  brand: 'OreGuard Mining',
  guestLabel: 'Contractor',
  supportEmail: 'hse@oreguard.example',
  tagline: 'Safety first, always.',
  followupDays: 1,
  cities: ['Rustenburg', 'Kimberley', 'Welkom', 'Witbank', 'Polokwane', 'Johannesburg'],
  menuHints: [
    'Complete your safety orientation',
    'Log a safety concern',
    'Order safety equipment',
    'Register for site access',
    'Speak to the safety team',
  ],
  wrapChecklist: [
    'HSE reviews your submission',
    'You receive a confirmation email',
    'Site access may be granted',
    'Keep your reference for site check-in',
  ],
  accentNote: 'Stay safe out there!',
  welcome:
    'Hi — **OreGuard** site services.\n\nWhat do you need at the gate today?\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}{/color}',
  identity: {
    captchaPrompt: 'Site gate check — solve this before we log you in.',
    confirmPrompt: 'OreGuard demo only. Do not enter live site credentials or medical fitness records.',
    confirmLabel: 'I am a demo contractor — continue',
    intakeIntro:
      'A few contractor details for **{{vars.service}}** — then we continue.',
    servicePrompt: 'Which site service do you need?',
    menuBridge:
      '{{templates.main_menu.text}}\n\n{color:muted}Pick one — we’ll only ask for details after that.{/color}',
    recap: [
      '**Contractor on file · {{titleCase(vars.visitor_name)}}**',
      '',
      'Company: **{{coalesce(vars.company, "—")}}**',
      'Site region: **{{coalesce(vars.city, "—")}}**',
      'Mobile: {{coalesce(vars.phone, "—")}} · Email: `{{vars.email_display}}`',
      'Access ID: `{{if(empty(vars.national_id), "pending", vars.national_id)}}`',
      '',
      '{color:muted}HSE priority default: {{vars.priority}}{/color}',
    ].join('\n'),
    defaultPriority: 'standard',
    fields: [
      {
        key: 'ask_name',
        label: 'Contractor name',
        prompt: 'Your full name for the site register?',
        answerType: 'name',
        output: 'visitor_name',
      },
      {
        key: 'ask_company',
        label: 'Company',
        prompt: 'Which company are you representing on site?',
        answerType: 'text',
        output: 'company',
      },
      {
        key: 'ask_national_id',
        label: 'Site access ID',
        prompt: 'Contractor / access ID number? (demo)',
        answerType: 'national_id',
        output: 'national_id',
      },
      {
        key: 'ask_phone',
        label: 'Site phone',
        prompt: 'Mobile number for the induction desk to reach you?',
        answerType: 'phone',
        output: 'phone',
      },
      {
        key: 'ask_email',
        label: 'Email',
        prompt: 'Work email for induction confirmations?',
        answerType: 'email',
        output: 'email',
      },
      {
        key: 'ask_city',
        label: 'Site region',
        prompt: 'Which mining region / town are you working in?',
        answerType: 'autocomplete',
        output: 'city',
        config: { choicesFrom: '{{vars.service_cities}}' },
      },
      {
        key: 'ask_role',
        label: 'Role',
        prompt: 'Primary role on site?',
        answerType: 'choice',
        output: 'site_role',
        config: {
          choices: ['Construction', 'Maintenance', 'Logistics', 'Visitor escort', 'Other'],
        },
      },
    ],
  },
  hoursNote: 'Site office and induction desk hours (demo).',
  faqItems: [
    { question: 'Is this real site access?', answer: 'No — this is a demonstration only. Do not enter live site credentials.' },
    {
      question: 'How do I book induction?',
      answer: 'Choose Book induction from the menu and follow the steps to pick a site and time.',
    },
  ],
  legalTitle: 'Contractor demo terms',
  legalBody: 'Demo only. Do not enter real medical fitness records or live access credentials.',
  menuChoices: ['Book induction', 'Report hazard', 'Request PPE', 'Visitor access', 'Contact HSE'],
  cart: cartTemplate({
    key: 'ppe_store',
    name: 'OreGuard PPE store',
    intro: 'Personal protective equipment kits -- checkout includes shipping and VAT (demo).',
    categories: [
      { id: 'cat_head', name: 'Head & eyes' },
      { id: 'cat_body', name: 'Body & feet' },
    ],
    products: [
      { id: 'prod_hardhat', sku: 'OG-HH', name: 'Hard hat + lamp', description: 'Site standard', price: 420, categoryId: 'cat_head', stock: 60 },
      { id: 'prod_goggles', sku: 'OG-GG', name: 'Safety goggles', description: 'Anti-fog', price: 180, categoryId: 'cat_head', stock: 80 },
      { id: 'prod_boots', sku: 'OG-BT', name: 'Steel-toe boots', description: 'Pair', price: 890, categoryId: 'cat_body', stock: 35 },
      { id: 'prod_kit', sku: 'OG-KIT', name: 'Full PPE starter kit', description: 'Helmet, gloves, vest', price: 1450, categoryId: 'cat_body', stock: 25 },
    ],
  }),
  get staticEntity() {
    return {
      id: this.staticEntityId,
      key: 'mine_sites',
      name: 'Mine sites',
      description: 'Static site catalog',
      kind: 'static',
      attributes: [
        idAttr(),
        attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
        attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
        attr('induction_slots', 'Induction slots', 'number', { sort_order: 2 }),
      ],
      records: [
        { id: '31111111-1111-4111-8111-111111111301', code: 'PIT-A', name: 'Platinum East', induction_slots: 12 },
        { id: '31111111-1111-4111-8111-111111111302', code: 'PLT-B', name: 'Coal North', induction_slots: 8 },
        { id: '31111111-1111-4111-8111-111111111303', code: 'WKS-C', name: 'Copper West', induction_slots: 6 },
      ],
    }
  },
  get dynamicEntity() {
    return {
      id: this.dynamicEntityId,
      key: 'site_services',
      name: 'Site services',
      description: 'Logged OreGuard site requests',
      kind: 'dynamic',
      attributes: enquiryAttributes(),
      records: [],
    }
  },
  branches: [
    { caseId: 'case_induct', match: 'Book induction', label: 'Induction' },
    { caseId: 'case_hazard', match: 'Report hazard', label: 'Hazard' },
    { caseId: 'case_ppe', match: 'Request PPE', label: 'PPE' },
    { caseId: 'case_visitor', match: 'Visitor access', label: 'Visitor' },
    { caseId: 'case_contact', match: 'Contact HSE', label: 'Contact' },
  ],
  wireBranches(b, ind) {
    // Book induction
    b.message('intro_induct', 'Induction', 'Book a site induction slot.')
    b.http('http_sites', 'GET sites', {
      method: 'GET',
      path: '/mining/sites',
      outputVariable: 'live_sites',
    })
    b.entity('list_sites', 'List sites', {
      entityId: ind.staticEntityId,
      operation: 'list',
      outputVariable: 'mine_sites',
    })
    b.question('induct_site', 'Site', 'Which site?', 'choice', {
      output: 'site_name',
      config: { choices: ['Platinum East', 'Coal North', 'Copper West', 'Camp D'] },
    })
    b.question('induct_when', 'Slot', 'Preferred induction date and time?', 'appointment', {
      output: 'induction_at',
    })
    b.question('induct_sign', 'Acknowledgement', 'Sign the induction acknowledgement.', 'signature', {
      output: 'signature',
    })
    b.message(
      'done_induct',
      'Booked',
      'Induction at **{{vars.site_name}}** on **{{prettify(vars.induction_at)}}**.\nSites available: **{{length(vars.live_sites.data)}}** · local records: **{{length(vars.mine_sites)}}**.',
    )
    b.chain([
      'intro_induct',
      'http_sites',
      'list_sites',
      'induct_site',
      'induct_when',
      'induct_sign',
      'done_induct',
    ])
    attachBranch(b, 'case_induct', 'Book induction', 'intro_induct', 'done_induct')

    // Report hazard
    b.message('intro_hazard', 'Hazard', 'Report a site hazard (demo).')
    b.question('hazard_class', 'Class', 'Hazard class?', 'choice', {
      output: 'hazard_class',
      config: {
        choices: ['Slip / trip', 'Vehicle / traffic', 'Chemical', 'Electrical', 'Structural', 'Other'],
      },
    })
    b.question('hazard_severity', 'Severity', 'Severity level?', 'choice', {
      output: 'hazard_severity',
      config: { choices: ['Low', 'Medium', 'High', 'Critical'] },
    })
    b.question('hazard_form', 'Details', 'Describe the hazard.', 'form', {
      output: 'hazard_form',
      config: {
        formFields: [
          { key: 'location', label: 'Location / area', type: 'string', required: true },
          { key: 'description', label: 'What happened', type: 'string', required: true },
          { key: 'witnesses', label: 'Witnesses', type: 'string', required: false },
        ],
      },
    })
    b.condition('cond_high', 'High severity?', '{{vars.hazard_severity}}', 'contains', 'High')
    b.message(
      'msg_escalate',
      'Escalate',
      '{color:danger}**High / Critical path**{/color} -- HSE would page the area supervisor. Location: **{{vars.hazard_form.location}}**.',
    )
    b.message(
      'msg_log',
      'Log',
      '{color:success}**Logged for review**{/color}: **{{vars.hazard_class}}** at **{{vars.hazard_form.location}}**.',
    )
    b.message('done_hazard', 'Hazard done', 'Hazard report complete for **{{vars.hazard_class}}**.')
    b.chain(['intro_hazard', 'hazard_class', 'hazard_severity', 'hazard_form', 'cond_high'])
    b.link('cond_high', 'msg_escalate', 'true', 'High')
    b.link('cond_high', 'msg_log', 'false', 'Routine')
    b.link('msg_escalate', 'done_hazard')
    b.link('msg_log', 'done_hazard')
    attachBranch(b, 'case_hazard', 'Report hazard', 'intro_hazard', 'done_hazard')

    // Request PPE
    b.message('intro_ppe', 'PPE', 'Order PPE from the site store, then pay the cart total (demo).')
    b.question('ask_ppe_shop', 'Shop', 'Browse the OreGuard PPE store and checkout.', 'shop', {
      output: 'cart',
      config: { shopTemplateKey: 'ppe_store' },
    })
    b.question('ask_ppe_pay', 'Payment', 'Pay for your PPE order.', 'payment', {
      output: 'payment',
      config: {
        paymentAmount: '{{vars.cart.total}}',
        paymentItemName: 'OreGuard PPE',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
      },
    })
    b.message(
      'done_ppe',
      'Paid',
      'PPE total **{{vars.cart.total}} {{vars.cart.currency}}** - payment `{{coalesce(vars.payment.reference, "demo")}}`.',
    )
    b.chain(['intro_ppe', 'ask_ppe_shop', 'ask_ppe_pay', 'done_ppe'])
    attachBranch(b, 'case_ppe', 'Request PPE', 'intro_ppe', 'done_ppe')

    // Visitor access
    b.message('intro_visitor', 'Visitor', 'Arrange visitor access with a verification code.')
    b.question('visitor_host', 'Host', 'Who is hosting you on site?', 'text', {
      output: 'visitor_host',
    })
    b.question('visitor_when', 'Visit', 'When will you arrive?', 'appointment', {
      output: 'visit_at',
    })
    b.question('visitor_otp', 'Verification', 'Enter the verification code (any 6 digits for this demo).', 'otp', {
      output: 'otp_ok',
      config: { otpSubject: 'OreGuard visitor code', otpLength: 6 },
    })
    b.message(
      'done_visitor',
      'Access',
      'Visitor access for **{{vars.visitor_host}}** on **{{prettify(vars.visit_at)}}** — verified.',
    )
    b.chain(['intro_visitor', 'visitor_host', 'visitor_when', 'visitor_otp', 'done_visitor'])
    attachBranch(b, 'case_visitor', 'Visitor access', 'intro_visitor', 'done_visitor')

    // Contact HSE
    b.message('intro_hse', 'HSE', 'Send a message to Health, Safety & Environment.')
    b.question('hse_topic', 'Topic', 'What is this about?', 'choice', {
      output: 'hse_topic',
      config: { choices: ['Induction query', 'Incident follow-up', 'PPE / equipment', 'Policy', 'Other'] },
    })
    b.question('hse_detail', 'Message', 'Your message to HSE?', 'long_text', {
      output: 'contact_message',
    })
    b.message(
      'done_hse',
      'Sent',
      'HSE note logged: **{{vars.hse_topic}}**. We will reply to **{{vars.email}}**.',
    )
    b.chain(['intro_hse', 'hse_topic', 'hse_detail', 'done_hse'])
    attachBranch(b, 'case_contact', 'Contact HSE', 'intro_hse', 'done_hse')
  },
}

const banking = {
  id: 'banking',
  slug: 'usecase-banking',
  file: 'flowforge-usecase-banking.json',
  chatbotId: 'c3000000-0000-4000-8000-000000000004',
  flowId: 'f3000000-0000-4000-8000-000000000004',
  staticEntityId: 'b3100000-0000-4000-8000-000000000004',
  dynamicEntityId: 'b3200000-0000-4000-8000-000000000004',
  name: 'Banking -- Everyday banking assistant',
  description:
    'LedgerBank: open an account, check a demo balance, apply for a loan, explore cards, or get support.',
  brand: 'LedgerBank',
  guestLabel: 'Client',
  supportEmail: 'support@ledgerbank.example',
  tagline: 'Banking made simple.',
  followupDays: 2,
  cities: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Sandton', 'Centurion'],
  menuHints: [
    'Start your new account',
    'View your demo balance',
    'Get a loan quote',
    'Browse card options',
    'Report fraud or get help',
  ],
  wrapChecklist: [
    'Our team reviews your request',
    'You receive confirmation by email',
    'A banker may call you',
    'Keep your reference for enquiries',
  ],
  accentNote: 'Your finances, your way.',
  welcome:
    'Hi — I’m your **LedgerBank** assistant.\n\nWhat would you like to do?\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}} · secure demo{/color}',
  identity: {
    captchaPrompt: 'Security check before we open a banking profile.',
    confirmPrompt: 'LedgerBank demonstration only — never enter live passwords, card numbers, or real ID documents.',
    confirmLabel: 'I understand — continue with demo banking',
    intakeIntro:
      'A few details for **{{vars.service}}** — then we continue.',
    servicePrompt: 'What would you like to do?',
    menuBridge:
      '{{templates.main_menu.text}}\n\n{color:muted}Pick one — we ask for ID only after that.{/color}',
    recap: [
      '**Client profile · {{titleCase(vars.visitor_name)}}**',
      '',
      'ID: `{{if(empty(vars.national_id), "pending", slice(vars.national_id, 0, 6) + "••••")}}`',
      'Branch area: **{{coalesce(vars.city, "—")}}** · {{coalesce(vars.postal_code, "")}}',
      'Contact: `{{vars.email_display}}` · {{coalesce(vars.phone, "—")}}',
      '',
      '{color:muted}Demo credentials noted — never use real secrets here.{/color}',
    ].join('\n'),
    fields: [
      {
        key: 'ask_name',
        label: 'Legal name',
        prompt: 'Full legal name on the account?',
        answerType: 'name',
        output: 'visitor_name',
      },
      {
        key: 'ask_national_id',
        label: 'ID number',
        prompt: 'National ID number? (demo value only)',
        answerType: 'national_id',
        output: 'national_id',
      },
      {
        key: 'ask_email',
        label: 'Email',
        prompt: 'Email for statements and verification codes?',
        answerType: 'email',
        output: 'email',
      },
      {
        key: 'ask_phone',
        label: 'Mobile',
        prompt: 'Mobile number linked to the account?',
        answerType: 'phone',
        output: 'phone',
      },
      {
        key: 'ask_password',
        label: 'Demo PIN',
        prompt: 'Create a demo banking PIN / password (not a real one).',
        answerType: 'password',
        output: 'demo_password',
      },
      {
        key: 'ask_city',
        label: 'Branch city',
        prompt: 'Preferred branch city?',
        answerType: 'autocomplete',
        output: 'city',
        config: { choicesFrom: '{{vars.service_cities}}' },
      },
      {
        key: 'ask_postal',
        label: 'Postal code',
        prompt: 'Postal code for correspondence?',
        answerType: 'postal_code',
        output: 'postal_code',
      },
    ],
  },
  hoursNote: 'Branch and digital support hours (demo).',
  faqItems: [
    { question: 'Is this real banking?', answer: 'No — this is a demonstration. Do not enter live credentials or real card numbers.' },
    {
      question: 'How do I check a balance?',
      answer: 'Choose Check balance from the menu and follow the verification steps in the demo.',
    },
  ],
  legalTitle: 'Banking demo terms',
  legalBody: 'Demo only. Do not enter real ID numbers, passwords, or live card details.',
  menuChoices: [
    'Open account',
    'Check balance',
    'Apply for loan',
    'Cards & products',
    'Fraud / support',
  ],
  cart: cartTemplate({
    key: 'card_store',
    name: 'LedgerBank card desk',
    intro: 'Optional card and product fees (demo catalog).',
    categories: [{ id: 'cat_cards', name: 'Cards' }],
    products: [
      { id: 'prod_debit', sku: 'LB-DEB', name: 'Debit card issue fee', description: 'Plastic + PIN mailer', price: 75, categoryId: 'cat_cards', stock: 999 },
      { id: 'prod_credit', sku: 'LB-CRD', name: 'Credit card annual fee', description: 'Year 1', price: 450, categoryId: 'cat_cards', stock: 999 },
      { id: 'prod_metal', sku: 'LB-MTL', name: 'Metal card upgrade', description: 'Optional', price: 1200, categoryId: 'cat_cards', stock: 40 },
    ],
  }),
  get staticEntity() {
    return {
      id: this.staticEntityId,
      key: 'banking_products',
      name: 'Banking products',
      description: 'Static product catalog',
      kind: 'static',
      attributes: [
        idAttr(),
        attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
        attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
        attr('monthly_fee', 'Monthly fee', 'number', { sort_order: 2 }),
      ],
      records: [
        { id: '31111111-1111-4111-8111-111111111401', code: 'CHQ', name: 'Everyday cheque', monthly_fee: 59 },
        { id: '31111111-1111-4111-8111-111111111402', code: 'SAV', name: 'Savings Plus', monthly_fee: 0 },
        { id: '31111111-1111-4111-8111-111111111403', code: 'BIZ', name: 'Business starter', monthly_fee: 149 },
      ],
    }
  },
  get dynamicEntity() {
    return {
      id: this.dynamicEntityId,
      key: 'banking_enquiries',
      name: 'Banking enquiries',
      description: 'Logged LedgerBank requests',
      kind: 'dynamic',
      attributes: enquiryAttributes(),
      records: [],
    }
  },
  branches: [
    { caseId: 'case_account', match: 'Open account', label: 'Open account' },
    { caseId: 'case_balance', match: 'Check balance', label: 'Balance' },
    { caseId: 'case_loan', match: 'Apply for loan', label: 'Loan' },
    { caseId: 'case_cards', match: 'Cards & products', label: 'Cards' },
    { caseId: 'case_support', match: 'Fraud / support', label: 'Support' },
  ],
  wireBranches(b, ind) {
    // Open account
    b.message('intro_account', 'Open account', 'Start a demo account opening.')
    b.question('acct_type', 'Account type', 'Which account?', 'choice', {
      output: 'account_type',
      config: { choices: ['Everyday cheque', 'Savings Plus', 'Youth / student', 'Business starter'] },
    })
    b.question('acct_id', 'ID (demo)', 'Demo ID / passport number (do not use a real one)?', 'text', {
      output: 'id_number',
    })
    b.operation('op_id_len', 'ID length', {
      operation: 'length',
      left: '{{vars.id_number}}',
      right: '',
      outputVariable: 'id_length',
    })
    b.question('acct_deposit', 'Deposit', 'Planned opening deposit?', 'currency', {
      output: 'opening_deposit',
      required: false,
    })
    b.question('acct_sign', 'Mandate', 'Sign the account opening mandate.', 'signature', {
      output: 'signature',
    })
    b.message(
      'done_account',
      'Opened',
      '**{{vars.account_type}}** application for **{{vars.visitor_name}}** - ID length **{{vars.id_length}}** - deposit **{{coalesce(vars.opening_deposit, "n/a")}}**.',
    )
    b.chain([
      'intro_account',
      'acct_type',
      'acct_id',
      'op_id_len',
      'acct_deposit',
      'acct_sign',
      'done_account',
    ])
    attachBranch(b, 'case_account', 'Open account', 'intro_account', 'done_account')

    // Check balance
    b.message('intro_balance', 'Balance', 'Look up a demo balance (OTP required).')
    b.question('bal_account', 'Account', 'Which account label?', 'choice', {
      output: 'account',
      config: {
        choices: ['Cheque .... 4821', 'Savings .... 0193', 'Credit card .... 7740'],
      },
    })
    b.question('bal_otp', 'Verification', 'Enter the verification code (any 6 digits for this demo).', 'otp', {
      output: 'otp_ok',
      config: { otpSubject: 'LedgerBank balance code', otpLength: 6 },
    })
    b.http('http_balance', 'GET balance', {
      method: 'GET',
      path: '/banking/balance',
      paramValues: { account: '{{vars.account}}' },
      outputVariable: 'balance',
    })
    b.message(
      'done_balance',
      'Balance',
      '**{{vars.account}}**: available **{{vars.balance.data.available}} {{vars.balance.data.currency}}** - pending **{{vars.balance.data.pending}}**.',
    )
    b.chain(['intro_balance', 'bal_account', 'bal_otp', 'http_balance', 'done_balance'])
    attachBranch(b, 'case_balance', 'Check balance', 'intro_balance', 'done_balance')

    // Apply for loan
    b.message('intro_loan', 'Loan', 'Request a demo loan quote.')
    b.question('loan_type', 'Loan type', 'What kind of loan?', 'choice', {
      output: 'loan_type',
      config: { choices: ['Personal', 'Home', 'Vehicle', 'Business'] },
    })
    b.question('loan_amount', 'Amount', 'How much do you need?', 'currency', {
      output: 'loan_amount',
    })
    b.question('loan_afford', 'Affordability', 'What share of income feels comfortable for repayments?', 'percentage', {
      output: 'afford_pct',
    })
    b.question('loan_term', 'Term', 'Term in months?', 'number', {
      output: 'loan_term',
    })
    b.question('loan_form', 'Employment', 'Employment details', 'form', {
      output: 'loan_form',
      config: {
        formFields: [
          { key: 'employer', label: 'Employer', type: 'string', required: true },
          { key: 'income', label: 'Monthly income', type: 'number', required: true },
          { key: 'years', label: 'Years employed', type: 'number', required: false },
        ],
      },
    })
    b.operation('op_afford_cap', 'Affordability cap', {
      operation: 'multiply',
      left: '{{vars.loan_form.income}}',
      right: '{{vars.afford_pct / 100}}',
      outputVariable: 'afford_cap',
    })
    b.http('http_loan', 'Request loan quote', {
      method: 'POST',
      path: '/banking/loan-quote',
      body: JSON.stringify({
        loan_type: '{{vars.loan_type}}',
        amount: '{{vars.loan_amount}}',
        term: '{{vars.loan_term}}',
        employer: '{{vars.loan_form.employer}}',
        income: '{{vars.loan_form.income}}',
        afford_pct: '{{vars.afford_pct}}',
        name: '{{vars.visitor_name}}',
        email: '{{vars.email}}',
      }),
      outputVariable: 'loan_quote',
    })
    b.setVar('set_quote_id', 'Quote id', 'quote_id', '{{vars.loan_quote.quote_id}}')
    b.condition(
      'cond_loan',
      'Pre-approved?',
      '{{vars.loan_quote.decision}}',
      'eq',
      'pre_approved_demo',
    )
    b.message(
      'msg_approved',
      'Pre-approved',
      '{color:success}**Pre-approved (demo)**{/color} — quote **{{vars.quote_id}}** — ~**{{round(vars.loan_quote.estimated_monthly, 2)}} {{vars.loan_quote.currency}}**/month.\nComfort band: **{{round(vars.afford_pct, 0)}}%** of income (cap ~**{{round(vars.afford_cap, 0)}}**).',
    )
    b.message(
      'msg_review',
      'Manual review',
      '{color:warning}**Manual review**{/color} — quote **{{vars.quote_id}}** — a banker would call next.\nYou marked **{{round(vars.afford_pct, 0)}}%** affordability.',
    )
    b.message('done_loan', 'Loan done', 'Loan quote complete for **{{vars.loan_type}}**.')
    b.chain([
      'intro_loan',
      'loan_type',
      'loan_amount',
      'loan_afford',
      'loan_term',
      'loan_form',
      'op_afford_cap',
      'http_loan',
      'set_quote_id',
      'cond_loan',
    ])
    b.link('cond_loan', 'msg_approved', 'true', 'Pre-approved')
    b.link('cond_loan', 'msg_review', 'false', 'Review')
    b.link('msg_approved', 'done_loan')
    b.link('msg_review', 'done_loan')
    attachBranch(b, 'case_loan', 'Apply for loan', 'intro_loan', 'done_loan')

    // Cards & products
    b.message('intro_cards', 'Cards', 'Browse products, then optionally order a card.')
    b.http('http_products', 'GET products', {
      method: 'GET',
      path: '/banking/products',
      outputVariable: 'live_products',
    })
    b.entity('list_products', 'List products', {
      entityId: ind.staticEntityId,
      operation: 'list',
      outputVariable: 'banking_products',
    })
    b.message(
      'msg_products',
      'Catalogue',
      'We found **{{length(vars.live_products.data)}}** products (local list has **{{length(vars.banking_products)}}**).\n\nFeatured: **{{at(vars.live_products.data, 0).name}}**.',
    )
    b.question(
      'ask_card_shop',
      'Card shop',
      'Optional: browse the card desk and add fees (skip if you only wanted the catalogue).',
      'shop',
      {
        output: 'cart',
        required: false,
        config: { shopTemplateKey: 'card_store' },
      },
    )
    b.question('ask_card_pay', 'Payment', 'Pay card fees if you checked out (optional).', 'payment', {
      output: 'payment',
      required: false,
      config: {
        paymentAmount: '{{coalesce(vars.cart.total, 0)}}',
        paymentItemName: 'LedgerBank cards',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
      },
    })
    b.message(
      'done_cards',
      'Done',
      'Products reviewed. Cart total **{{coalesce(vars.cart.total, "0")}}** - payment `{{coalesce(vars.payment.reference, "skipped")}}`.',
    )
    b.chain([
      'intro_cards',
      'http_products',
      'list_products',
      'msg_products',
      'ask_card_shop',
      'ask_card_pay',
      'done_cards',
    ])
    attachBranch(b, 'case_cards', 'Cards & products', 'intro_cards', 'done_cards')

    // Fraud / support
    b.message('intro_support', 'Support', 'Fraud or general support (demo).')
    b.question('support_issue', 'Issue', 'What do you need?', 'choice', {
      output: 'support_issue',
      config: {
        choices: ['Suspected fraud', 'Lost / stolen card', 'Dispute a transaction', 'General enquiry'],
      },
    })
    b.question('support_detail', 'Details', 'Tell us what happened.', 'long_text', {
      output: 'support_detail',
    })
    b.message(
      'done_support',
      'Logged',
      '**{{vars.support_issue}}** logged for **{{vars.visitor_name}}**. A specialist would follow up on **{{vars.email}}**.',
    )
    b.chain(['intro_support', 'support_issue', 'support_detail', 'done_support'])
    attachBranch(b, 'case_support', 'Fraud / support', 'intro_support', 'done_support')
  },
}

const retail = {
  id: 'retail',
  slug: 'usecase-retail',
  file: 'flowforge-usecase-retail.json',
  chatbotId: 'c3000000-0000-4000-8000-000000000005',
  flowId: 'f3000000-0000-4000-8000-000000000005',
  staticEntityId: 'b3100000-0000-4000-8000-000000000005',
  dynamicEntityId: 'b3200000-0000-4000-8000-000000000005',
  name: 'Retail -- Personal shopper & orders',
  description:
    'Northline Market: shop the edit, track orders, book a stylist, start returns, and leave feedback.',
  brand: 'Northline Market',
  guestLabel: 'Shopper',
  supportEmail: 'hello@northline.example',
  tagline: 'Style meets substance.',
  followupDays: 2,
  cities: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Sandton', 'Stellenbosch'],
  menuHints: [
    'Browse this week\'s edit',
    'Check your order status',
    'Personal styling session',
    'Initiate a return',
    'Share your experience',
  ],
  wrapChecklist: [
    'Our team reviews your request',
    'You receive confirmation by email',
    'A stylist may follow up',
    'Keep your reference for orders',
  ],
  accentNote: 'Thank you for shopping with us!',
  welcome:
    'Hi from **Northline Market**.\n\nWhat can I help you with?\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}{/color}',
  identity: {
    captchaPrompt: 'Quick check before we personalise your shopping session.',
    confirmPrompt: 'Northline demo store — do not enter live payment details or real delivery addresses for fulfilment.',
    confirmLabel: 'Shop the demo — continue',
    intakeIntro:
      'A light style profile for **{{vars.service}}** — then we continue.',
    servicePrompt: 'What can Northline help with?',
    menuBridge:
      '{{templates.main_menu.text}}\n\n{color:muted}Pick one — no long form until you choose.{/color}',
    recap: [
      '**Shopper profile · {{titleCase(vars.visitor_name)}}**',
      '',
      'Style vibe: **{{coalesce(vars.mood, "—")}}** · favourite colour **{{coalesce(vars.fav_color, "—")}}**',
      'Home store: **{{coalesce(vars.city, "—")}}**',
      'Email: `{{vars.email_display}}`{{if(empty(vars.phone), "", " · " + vars.phone)}}',
      '',
      '{color:muted}Let us find something you love.{/color}',
    ].join('\n'),
    fields: [
      {
        key: 'ask_name',
        label: 'First name',
        prompt: 'What should we call you while you shop?',
        answerType: 'name',
        output: 'visitor_name',
      },
      {
        key: 'ask_email',
        label: 'Email',
        prompt: 'Email for order updates and receipts?',
        answerType: 'email',
        output: 'email',
      },
      {
        key: 'ask_color',
        label: 'Colour',
        prompt: 'Favourite colour for styling tips?',
        answerType: 'color',
        output: 'fav_color',
      },
      {
        key: 'ask_mood',
        label: 'Shopping mood',
        prompt: 'What is your shopping mood today?',
        answerType: 'mood',
        output: 'mood',
      },
      {
        key: 'ask_city',
        label: 'Store',
        prompt: 'Which Northline store is closest?',
        answerType: 'autocomplete',
        output: 'city',
        config: { choicesFrom: '{{vars.service_cities}}' },
      },
      {
        key: 'ask_phone',
        label: 'Mobile',
        prompt: 'Mobile for click-and-collect alerts? (optional)',
        answerType: 'phone',
        output: 'phone',
        required: false,
      },
    ],
  },
  hoursNote: 'Flagship store and click-and-collect hours (demo).',
  faqItems: [
    { question: 'Are orders real?', answer: 'No — this is a demonstration. Try order reference NL-45821 when tracking.' },
    {
      question: 'How do I track an order?',
      answer: 'Choose Track my order from the menu and enter a demo reference such as NL-45821.',
    },
  ],
  legalTitle: 'Shopper demo terms',
  legalBody: 'Demo only. Do not enter live payment credentials or real addresses for fulfilment.',
  menuChoices: [
    'Shop the edit',
    'Track my order',
    'Book a stylist',
    'Start a return',
    'Store feedback',
  ],
  cart: cartTemplate({
    key: 'northline_store',
    name: 'Northline edit',
    intro: 'Curated pieces from this week\'s edit -- shipping and VAT included at checkout (demo).',
    categories: [
      { id: 'cat_wear', name: 'Wear' },
      { id: 'cat_home', name: 'Home' },
    ],
    products: [
      { id: 'prod_linen', sku: 'NL-LIN', name: 'Weekend linen shirt', description: 'Relaxed fit', price: 899, categoryId: 'cat_wear', stock: 28 },
      { id: 'prod_denim', sku: 'NL-DNM', name: 'Workday denim', description: 'Mid wash', price: 1299, categoryId: 'cat_wear', stock: 18 },
      { id: 'prod_candle', sku: 'NL-CND', name: 'Studio candle', description: 'Cedar / citrus', price: 320, categoryId: 'cat_home', stock: 45 },
      { id: 'prod_tote', sku: 'NL-TOT', name: 'Market tote', description: 'Canvas', price: 450, categoryId: 'cat_home', stock: 30 },
    ],
  }),
  get staticEntity() {
    return {
      id: this.staticEntityId,
      key: 'featured_collections',
      name: 'Featured collections',
      description: 'Static collection catalog',
      kind: 'static',
      attributes: [
        idAttr(),
        attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
        attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
        attr('theme', 'Theme', 'string', { sort_order: 2 }),
      ],
      records: [
        { id: '31111111-1111-4111-8111-111111111501', code: 'WORK', name: 'Workday Edit', theme: 'Office' },
        { id: '31111111-1111-4111-8111-111111111502', code: 'WEEK', name: 'Weekend Linen', theme: 'Leisure' },
        { id: '31111111-1111-4111-8111-111111111503', code: 'GIFT', name: 'Gift Under R500', theme: 'Gifting' },
      ],
    }
  },
  get dynamicEntity() {
    return {
      id: this.dynamicEntityId,
      key: 'shopper_requests',
      name: 'Shopper requests',
      description: 'Logged Northline shopper requests',
      kind: 'dynamic',
      attributes: enquiryAttributes(),
      records: [],
    }
  },
  branches: [
    { caseId: 'case_shop', match: 'Shop the edit', label: 'Shop' },
    { caseId: 'case_track', match: 'Track my order', label: 'Track' },
    { caseId: 'case_stylist', match: 'Book a stylist', label: 'Stylist' },
    { caseId: 'case_return', match: 'Start a return', label: 'Return' },
    { caseId: 'case_feedback', match: 'Store feedback', label: 'Feedback' },
  ],
  wireBranches(b, ind) {
    // Shop the edit
    b.message('intro_shop', 'Shop', 'Browse featured collections, then shop the edit.')
    b.entity('list_collections', 'List collections', {
      entityId: ind.staticEntityId,
      operation: 'list',
      outputVariable: 'featured_collections',
    })
    b.message(
      'msg_collections',
      'Collections',
      'Featured collections loaded: **{{length(vars.featured_collections)}}** rows.',
    )
    b.question('ask_shop', 'Shop', 'Add items from the Northline edit and checkout.', 'shop', {
      output: 'cart',
      config: { shopTemplateKey: 'northline_store' },
    })
    b.question('ask_payment', 'Payment', 'Pay for your cart.', 'payment', {
      output: 'payment',
      config: {
        paymentAmount: '{{vars.cart.total}}',
        paymentItemName: 'Northline Market',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
      },
    })
    b.message(
      'done_shop',
      'Paid',
      'Cart total **{{vars.cart.total}} {{vars.cart.currency}}** - payment `{{coalesce(vars.payment.reference, "demo")}}`.',
    )
    b.chain([
      'intro_shop',
      'list_collections',
      'msg_collections',
      'ask_shop',
      'ask_payment',
      'done_shop',
    ])
    attachBranch(b, 'case_shop', 'Shop the edit', 'intro_shop', 'done_shop')

    // Track my order
    b.message('intro_track', 'Track', 'Look up a demo order (try NL-45821).')
    b.question('track_ref', 'Reference', 'Order reference?', 'text', {
      output: 'order_ref',
    })
    b.question('track_otp', 'Verification', 'Enter the verification code (any 6 digits for this demo).', 'otp', {
      output: 'otp_ok',
      config: { otpSubject: 'Northline order code', otpLength: 6 },
    })
    b.http('http_order', 'GET order', {
      method: 'GET',
      path: '/retail/orders/{{vars.order_ref}}',
      outputVariable: 'order',
    })
    b.message(
      'done_track',
      'Status',
      '**{{vars.order_ref}}**: **{{vars.order.data.status}}** - ETA **{{coalesce(vars.order.data.eta, "n/a")}}** - **{{coalesce(vars.order.data.amount, "?")}} {{coalesce(vars.order.data.currency, "")}}**.',
    )
    b.chain(['intro_track', 'track_ref', 'track_otp', 'http_order', 'done_track'])
    attachBranch(b, 'case_track', 'Track my order', 'intro_track', 'done_track')

    // Book a stylist
    b.message('intro_stylist', 'Stylist', 'Book a personal styling session.')
    b.question('stylist_occasion', 'Occasion', 'What is the occasion?', 'choice', {
      output: 'occasion',
      config: { choices: ['Work wardrobe', 'Weekend reset', 'Event / wedding', 'Gift editing'] },
    })
    b.question('stylist_rank', 'Priorities', 'Rank what matters most.', 'ranking', {
      output: 'style_priorities',
      config: { choices: ['Fit', 'Colour', 'Budget', 'Trends', 'Sustainability'] },
    })
    b.question('stylist_when', 'Slot', 'Preferred stylist appointment?', 'appointment', {
      output: 'stylist_at',
    })
    b.question('stylist_budget', 'Budget', 'Rough spend budget?', 'currency', {
      output: 'budget',
    })
    b.message(
      'done_stylist',
      'Booked',
      'Stylist for **{{vars.occasion}}** on **{{prettify(vars.stylist_at)}}** - top priority **{{first(vars.style_priorities)}}** - budget **{{vars.budget}}**.',
    )
    b.chain([
      'intro_stylist',
      'stylist_occasion',
      'stylist_rank',
      'stylist_when',
      'stylist_budget',
      'done_stylist',
    ])
    attachBranch(b, 'case_stylist', 'Book a stylist', 'intro_stylist', 'done_stylist')

    // Start a return
    b.message('intro_return', 'Return', 'Start a return within the demo window.')
    b.question('ret_ref', 'Order', 'Order reference to return?', 'text', {
      output: 'return_ref',
    })
    b.question('ret_days', 'Days since purchase', 'How many days since purchase?', 'number', {
      output: 'days_since_purchase',
    })
    b.question('ret_reason', 'Reason', 'Why are you returning?', 'choice', {
      output: 'return_reason',
      config: { choices: ['Wrong size', 'Not as described', 'Changed mind', 'Damaged', 'Other'] },
    })
    b.condition('cond_return', 'Within 30 days?', '{{vars.days_since_purchase}}', 'lte', '30')
    b.message(
      'msg_return_ok',
      'Eligible',
      '{color:success}**Within 30 days**{/color} -- return for **{{vars.return_ref}}** (**{{vars.return_reason}}**) can proceed.',
    )
    b.message(
      'msg_return_late',
      'Outside window',
      '{color:warning}**Outside the 30-day window**{/color} ({{vars.days_since_purchase}} days). A specialist would advise next steps.',
    )
    b.message('done_return', 'Return done', 'Return flow complete for **{{vars.return_ref}}**.')
    b.chain(['intro_return', 'ret_ref', 'ret_days', 'ret_reason', 'cond_return'])
    b.link('cond_return', 'msg_return_ok', 'true', 'Eligible')
    b.link('cond_return', 'msg_return_late', 'false', 'Late')
    b.link('msg_return_ok', 'done_return')
    b.link('msg_return_late', 'done_return')
    attachBranch(b, 'case_return', 'Start a return', 'intro_return', 'done_return')

    // Store feedback
    b.message('intro_feedback', 'Feedback', 'How was your Northline experience?')
    b.question('ask_nps', 'NPS', 'How likely are you to recommend Northline? (0-10)', 'nps', {
      output: 'nps',
    })
    b.question('ask_comments', 'Comments', 'Anything else we should know?', 'long_text', {
      output: 'preferences',
      required: false,
    })
    b.message('done_feedback', 'Thanks', 'NPS **{{vars.nps}}** -- thank you for the feedback.')
    b.chain(['intro_feedback', 'ask_nps', 'ask_comments', 'done_feedback'])
    attachBranch(b, 'case_feedback', 'Store feedback', 'intro_feedback', 'done_feedback')
  },
}

const government = {
  id: 'government',
  slug: 'usecase-government',
  file: 'flowforge-usecase-government.json',
  chatbotId: 'c3000000-0000-4000-8000-000000000006',
  flowId: 'f3000000-0000-4000-8000-000000000006',
  staticEntityId: 'b3100000-0000-4000-8000-000000000006',
  dynamicEntityId: 'b3200000-0000-4000-8000-000000000006',
  name: 'Government -- Citizen service request',
  description:
    'CivicAssist: lodge requests, check cases, book counters, pay permit fees, and rate service.',
  brand: 'CivicAssist',
  guestLabel: 'Citizen',
  supportEmail: 'help@civicassist.example',
  tagline: 'At your service.',
  followupDays: 5,
  cities: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Bloemfontein', 'Gqeberha'],
  menuHints: [
    'Report an issue',
    'Track your case',
    'Book an appointment',
    'Pay fees online',
    'Rate our service',
  ],
  wrapChecklist: [
    'Your request is logged',
    'You receive a confirmation email',
    'A case worker reviews it',
    'Keep your reference for follow-up',
  ],
  accentNote: 'We are here to help.',
  welcome:
    'Hi — **CivicAssist** for residents.\n\nWhat do you need help with?\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}}{/color}',
  identity: {
    captchaPrompt: 'Resident verification before we open a municipal file.',
    confirmPrompt: 'CivicAssist demonstration — do not submit real ID documents or live payment credentials.',
    confirmLabel: 'Continue as a demo resident',
    intakeIntro:
      'A few resident details for **{{vars.service}}** — then we continue.',
    servicePrompt: 'Which civic service do you need?',
    menuBridge:
      '{{templates.main_menu.text}}\n\n{color:muted}Pick one — address and ID come after that.{/color}',
    defaultPriority: 'standard',
    recap: [
      '**Resident file · {{titleCase(vars.visitor_name)}}**',
      '',
      'ID: `{{if(empty(vars.national_id), "not on file", vars.national_id)}}`',
      'Address: {{coalesce(vars.address, "—")}} · {{coalesce(vars.postal_code, "")}}',
      'Municipality: **{{coalesce(vars.city, "—")}}**',
      'Contact: `{{vars.email_display}}` · {{coalesce(vars.phone, "—")}}',
      '',
      '{color:muted}Your details stay in this demo conversation only.{/color}',
    ].join('\n'),
    fields: [
      {
        key: 'ask_name',
        label: 'Full name',
        prompt: 'Full name as registered for municipal correspondence?',
        answerType: 'name',
        output: 'visitor_name',
      },
      {
        key: 'ask_national_id',
        label: 'ID number',
        prompt: 'South African ID / resident number? (demo)',
        answerType: 'national_id',
        output: 'national_id',
      },
      {
        key: 'ask_address',
        label: 'Street address',
        prompt: 'Street address for the service request location?',
        answerType: 'address',
        output: 'address',
      },
      {
        key: 'ask_postal',
        label: 'Postal code',
        prompt: 'Postal code?',
        answerType: 'postal_code',
        output: 'postal_code',
      },
      {
        key: 'ask_city',
        label: 'Municipality',
        prompt: 'Which city / municipality?',
        answerType: 'autocomplete',
        output: 'city',
        config: { choicesFrom: '{{vars.service_cities}}' },
      },
      {
        key: 'ask_phone',
        label: 'Contact number',
        prompt: 'Best phone number for the case worker?',
        answerType: 'phone',
        output: 'phone',
      },
      {
        key: 'ask_email',
        label: 'Email',
        prompt: 'Email for case updates?',
        answerType: 'email',
        output: 'email',
      },
    ],
  },
  hoursNote: 'Civic centre counter hours (demo).',
  faqItems: [
    { question: 'Is this a real municipal case?', answer: 'No — this is a demonstration. Try case reference CA-2026-1188 for status.' },
    {
      question: 'How do I check a case?',
      answer: 'Choose Check case status from the menu and enter a demo reference such as CA-2026-1188.',
    },
  ],
  legalTitle: 'Citizen demo terms',
  legalBody: 'Demo only. Do not submit real ID documents or live payment credentials.',
  menuChoices: [
    'Lodge a service request',
    'Check case status',
    'Book a counter visit',
    'Pay a permit fee',
    'Service rating',
  ],
  cart: cartTemplate({
    key: 'permit_fees',
    name: 'CivicAssist permit desk',
    intro: 'Permit and licence fees (demo catalog).',
    categories: [{ id: 'cat_permits', name: 'Permits' }],
    products: [
      { id: 'prod_build', sku: 'CA-BLD', name: 'Building plan fee', description: 'Residential', price: 850, categoryId: 'cat_permits', stock: 999 },
      { id: 'prod_event', sku: 'CA-EVT', name: 'Event permit', description: 'Public gathering', price: 420, categoryId: 'cat_permits', stock: 999 },
      { id: 'prod_trade', sku: 'CA-TRD', name: 'Trading licence renewal', description: 'Annual', price: 650, categoryId: 'cat_permits', stock: 999 },
    ],
  }),
  get staticEntity() {
    return {
      id: this.staticEntityId,
      key: 'municipal_services',
      name: 'Municipal services',
      description: 'Static service catalog',
      kind: 'static',
      attributes: [
        idAttr(),
        attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
        attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
        attr('department', 'Department', 'string', { required: true, sort_order: 2 }),
      ],
      records: [
        { id: '31111111-1111-4111-8111-111111111601', code: 'WASTE', name: 'Waste collection', department: 'Sanitation' },
        { id: '31111111-1111-4111-8111-111111111602', code: 'ROAD', name: 'Pothole repair', department: 'Roads' },
        { id: '31111111-1111-4111-8111-111111111603', code: 'RATES', name: 'Rates / valuation query', department: 'Finance' },
      ],
    }
  },
  get dynamicEntity() {
    return {
      id: this.dynamicEntityId,
      key: 'citizen_requests',
      name: 'Citizen requests',
      description: 'Logged CivicAssist requests',
      kind: 'dynamic',
      attributes: enquiryAttributes(),
      records: [],
    }
  },
  branches: [
    { caseId: 'case_lodge', match: 'Lodge a service request', label: 'Lodge' },
    { caseId: 'case_status', match: 'Check case status', label: 'Status' },
    { caseId: 'case_counter', match: 'Book a counter visit', label: 'Counter' },
    { caseId: 'case_permit', match: 'Pay a permit fee', label: 'Permit' },
    { caseId: 'case_rating', match: 'Service rating', label: 'Rating' },
  ],
  wireBranches(b, ind) {
    // Lodge — enhanced with priority, location, file evidence, condition
    b.message('intro_lodge', 'Lodge', 'Lodge a municipal service request.')
    b.entity('list_services', 'List services', {
      entityId: ind.staticEntityId,
      operation: 'list',
      outputVariable: 'municipal_services',
    })
    b.question('lodge_type', 'Service', 'Which service?', 'choice', {
      output: 'service_type',
      config: {
        choices: ['Waste collection', 'Pothole repair', 'Rates / valuation query', 'Street light', 'Other'],
      },
    })
    b.question('lodge_priority', 'Priority', 'How urgent is this?', 'choice', {
      output: 'lodge_priority',
      config: { choices: ['Standard', 'Urgent', 'Emergency'] },
    })
    b.question('lodge_location', 'Location', 'Share the location if possible (optional).', 'location', {
      output: 'lodge_location',
      required: false,
    })
    b.question('lodge_form', 'Details', 'Request details', 'form', {
      output: 'request_form',
      config: {
        formFields: [
          { key: 'address', label: 'Address / suburb', type: 'string', required: true },
          { key: 'postal_code', label: 'Postal code', type: 'string', required: false },
          { key: 'details', label: 'What needs attention', type: 'string', required: true },
          { key: 'contact_pref', label: 'Preferred contact', type: 'string', required: false },
        ],
      },
    })
    b.question('lodge_file', 'Evidence', 'Upload a photo or document as evidence (optional).', 'file', {
      output: 'lodge_evidence',
      required: false,
      config: { fileAccept: 'any', maxFiles: 2 },
    })
    b.question('lodge_sign', 'Declaration', 'Sign the citizen declaration.', 'signature', {
      output: 'signature',
    })
    b.condition('cond_urgent_sla', 'Urgent SLA?', '{{vars.lodge_priority}}', 'eq', 'Emergency')
    b.message(
      'msg_emergency_sla',
      'Emergency SLA',
      [
        '{color:danger}**Emergency priority**{/color}',
        '',
        'Your request will be escalated for faster response.',
        'Address: **{{vars.request_form.address}}**',
        '{{if(empty(vars.lodge_evidence), "", "{color:accent}Evidence uploaded.{/color}")}}',
      ].join('\n'),
    )
    b.message(
      'msg_standard_sla',
      'Standard SLA',
      [
        '{color:success}**{{vars.lodge_priority}} priority**{/color}',
        '',
        'Your request has been logged.',
        'Address: **{{vars.request_form.address}}**',
        'Services available: **{{length(vars.municipal_services)}}**',
      ].join('\n'),
    )
    b.message(
      'done_lodge',
      'Lodged',
      '**{{vars.service_type}}** logged for **{{vars.request_form.address}}**.',
    )
    b.chain([
      'intro_lodge',
      'list_services',
      'lodge_type',
      'lodge_priority',
      'lodge_location',
      'lodge_form',
      'lodge_file',
      'lodge_sign',
      'cond_urgent_sla',
    ])
    b.link('cond_urgent_sla', 'msg_emergency_sla', 'true', 'Emergency')
    b.link('cond_urgent_sla', 'msg_standard_sla', 'false', 'Standard')
    b.link('msg_emergency_sla', 'done_lodge')
    b.link('msg_standard_sla', 'done_lodge')
    attachBranch(b, 'case_lodge', 'Lodge a service request', 'intro_lodge', 'done_lodge')

    // Check case
    b.message('intro_case', 'Case status', 'Look up a demo case (try CA-2026-1188).')
    b.question('case_ref', 'Reference', 'Case reference?', 'text', {
      output: 'case_ref',
    })
    b.question('case_otp', 'Verification', 'Enter the verification code (any 6 digits for this demo).', 'otp', {
      output: 'otp_ok',
      config: { otpSubject: 'CivicAssist case code', otpLength: 6 },
    })
    b.http('http_case', 'GET case', {
      method: 'GET',
      path: '/government/cases/{{vars.case_ref}}',
      outputVariable: 'case_status',
    })
    b.message(
      'done_case',
      'Status',
      '**{{vars.case_ref}}**: **{{vars.case_status.data.status}}** - department **{{vars.case_status.data.department}}** - last update **{{vars.case_status.data.last_update}}**.',
    )
    b.chain(['intro_case', 'case_ref', 'case_otp', 'http_case', 'done_case'])
    attachBranch(b, 'case_status', 'Check case status', 'intro_case', 'done_case')

    // Book counter
    b.message('intro_counter', 'Counter', 'Book a civic centre counter visit.')
    b.question('counter_office', 'Office', 'Which office?', 'choice', {
      output: 'office',
      config: { choices: ['Main civic centre', 'North satellite', 'Online video counter'] },
    })
    b.question('counter_when', 'Slot', 'Preferred counter appointment?', 'appointment', {
      output: 'counter_at',
    })
    b.question('counter_confirm', 'Confirm', 'Confirm you will attend.', 'confirm', {
      output: 'counter_ok',
      config: { confirmLabel: 'Yes -- book my place' },
    })
    b.message(
      'done_counter',
      'Booked',
      'Counter visit at **{{vars.office}}** on **{{prettify(vars.counter_at)}}**.',
    )
    b.chain(['intro_counter', 'counter_office', 'counter_when', 'counter_confirm', 'done_counter'])
    attachBranch(b, 'case_counter', 'Book a counter visit', 'intro_counter', 'done_counter')

    // Pay permit
    b.message('intro_permit', 'Permit', 'Select permit fees and pay (demo).')
    b.question('permit_type', 'Permit', 'Which permit category?', 'choice', {
      output: 'permit_type',
      config: { choices: ['Building plan', 'Event permit', 'Trading licence', 'Other'] },
    })
    b.question('ask_permit_shop', 'Fees', 'Add fees from the permit desk and checkout.', 'shop', {
      output: 'cart',
      config: { shopTemplateKey: 'permit_fees' },
    })
    b.question('ask_permit_pay', 'Payment', 'Pay the permit fees.', 'payment', {
      output: 'payment',
      config: {
        paymentAmount: '{{vars.cart.total}}',
        paymentItemName: 'CivicAssist permits',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
      },
    })
    b.message(
      'done_permit',
      'Paid',
      '**{{vars.permit_type}}** - total **{{vars.cart.total}} {{vars.cart.currency}}** - payment `{{coalesce(vars.payment.reference, "demo")}}`.',
    )
    b.chain(['intro_permit', 'permit_type', 'ask_permit_shop', 'ask_permit_pay', 'done_permit'])
    attachBranch(b, 'case_permit', 'Pay a permit fee', 'intro_permit', 'done_permit')

    // Service rating
    b.message('intro_rating', 'Rating', 'Rate your recent CivicAssist experience.')
    b.question('ask_nps', 'NPS', 'How likely are you to recommend CivicAssist? (0-10)', 'nps', {
      output: 'nps',
    })
    b.question('ask_rating_detail', 'Comments', 'Optional comments', 'long_text', {
      output: 'request_detail',
      required: false,
    })
    b.message('done_rating', 'Thanks', 'Service rating **{{vars.nps}}** recorded. Thank you.')
    b.chain(['intro_rating', 'ask_nps', 'ask_rating_detail', 'done_rating'])
    attachBranch(b, 'case_rating', 'Service rating', 'intro_rating', 'done_rating')
  },
}

const crm = {
  id: 'crm',
  slug: 'usecase-crm',
  file: 'flowforge-usecase-crm.json',
  chatbotId: 'c3000000-0000-4000-8000-000000000007',
  flowId: 'f3000000-0000-4000-8000-000000000007',
  staticEntityId: 'b3100000-0000-4000-8000-000000000007',
  dynamicEntityId: 'b3200000-0000-4000-8000-000000000007',
  name: 'CRM -- Sales & customer success assistant',
  description:
    'PulseCRM: look up accounts, capture leads, log tickets, check deals, book meetings, and buy add-ons.',
  brand: 'PulseCRM',
  guestLabel: 'Rep',
  supportEmail: 'success@pulsecrm.example',
  tagline: 'Pipeline, people, and follow-through.',
  followupDays: 1,
  cities: ['Johannesburg', 'Cape Town', 'Durban', 'Sandton', 'Pretoria', 'Gqeberha'],
  menuHints: [
    'Find a customer on file',
    'Qualify a new opportunity',
    'Open a support case',
    'Track a deal reference',
    'Schedule discovery time',
    'Seats, AI, SSO, and success hours',
  ],
  wrapChecklist: [
    'Your CRM activity is logged',
    'You receive a confirmation email',
    'Your account owner may follow up',
    'Keep the reference for the next touch',
  ],
  accentNote: 'Keep the pipeline moving.',
  welcome:
    'Hi — I’m your **PulseCRM** workspace assistant.\n\nAccounts, leads, tickets, deals, meetings, and add-ons — what do you need?\n\n{color:muted}{{formatDate(utcNow(), "EEEE, d MMMM yyyy")}} · demo CRM{/color}',
  identity: {
    captchaPrompt: 'Workspace check before we open CRM records.',
    confirmPrompt:
      'PulseCRM demonstration only — do not enter live customer PII, passwords, or production deal data.',
    confirmLabel: 'I understand — continue with demo CRM',
    intakeIntro: 'A few details for **{{vars.service}}** — then we continue.',
    servicePrompt: 'What would you like to do in PulseCRM?',
    menuBridge:
      '{{templates.main_menu.text}}\n\n{color:muted}Pick one — we’ll only ask for extra details after that.{/color}',
    recap: [
      '**Rep on file · {{titleCase(vars.visitor_name)}}**',
      '',
      'Company: **{{coalesce(vars.company, "—")}}**',
      'Territory: **{{coalesce(vars.city, "—")}}**',
      'Role: **{{coalesce(vars.crm_role, "—")}}**',
      'Contact: `{{vars.email_display}}` · {{coalesce(vars.phone, "—")}}',
      '',
      '{color:muted}Demo CRM only — never paste live secrets here.{/color}',
    ].join('\n'),
    defaultPriority: 'standard',
    fields: [
      {
        key: 'ask_name',
        label: 'Your name',
        prompt: 'Your name for CRM activity logs?',
        answerType: 'name',
        output: 'visitor_name',
      },
      {
        key: 'ask_company',
        label: 'Company',
        prompt: 'Which company / workspace are you representing?',
        answerType: 'text',
        output: 'company',
      },
      {
        key: 'ask_email',
        label: 'Work email',
        prompt: 'Work email? (try rep@pulsecrm.example for a seeded account)',
        answerType: 'email',
        output: 'email',
      },
      {
        key: 'ask_phone',
        label: 'Mobile',
        prompt: 'Mobile for meeting reminders?',
        answerType: 'phone',
        output: 'phone',
      },
      {
        key: 'ask_city',
        label: 'Territory',
        prompt: 'Primary territory / city?',
        answerType: 'autocomplete',
        output: 'city',
        config: { choicesFrom: '{{vars.service_cities}}' },
      },
      {
        key: 'ask_role',
        label: 'Role',
        prompt: 'Your role in the CRM workspace?',
        answerType: 'choice',
        output: 'crm_role',
        config: {
          choices: ['Account executive', 'Customer success', 'Sales ops', 'Support agent', 'Admin'],
        },
      },
    ],
  },
  hoursNote: 'Success desk and sales floor hours (demo).',
  faqItems: [
    {
      question: 'Is this a real CRM?',
      answer: 'No — this is a PulseCRM demonstration. Do not enter live customer data.',
    },
    {
      question: 'How do I look up an account?',
      answer: 'Choose Look up account and use rep@pulsecrm.example after verification.',
    },
    {
      question: 'Where do I check a deal?',
      answer: 'Choose Check deal status and try reference DEAL-2026-0042.',
    },
  ],
  legalTitle: 'CRM demo terms',
  legalBody: 'Demo only. Do not enter real customer PII, passwords, or production pipeline data.',
  menuChoices: [
    'Look up account',
    'Capture a lead',
    'Log a ticket',
    'Check deal status',
    'Book a meeting',
    'CRM add-ons',
  ],
  cart: cartTemplate({
    key: 'crm_store',
    name: 'PulseCRM add-ons',
    intro: 'Seats, AI insights, SSO, and success hours — checkout includes shipping and VAT (demo).',
    categories: [
      { id: 'cat_capacity', name: 'Capacity' },
      { id: 'cat_platform', name: 'Platform' },
    ],
    products: [
      {
        id: 'prod_seats',
        sku: 'PC-SEATS',
        name: 'Extra seats (10-pack)',
        description: 'Add ten named users',
        price: 2400,
        categoryId: 'cat_capacity',
        stock: 40,
      },
      {
        id: 'prod_ai',
        sku: 'PC-AI',
        name: 'AI insight add-on',
        description: 'Deal risk & next-best action',
        price: 8900,
        categoryId: 'cat_platform',
        stock: 25,
      },
      {
        id: 'prod_sso',
        sku: 'PC-SSO',
        name: 'SSO / SCIM pack',
        description: 'Enterprise identity',
        price: 12000,
        categoryId: 'cat_platform',
        stock: 15,
      },
      {
        id: 'prod_success',
        sku: 'PC-SUCCESS',
        name: 'Success hours (5)',
        description: 'Onboarding & playbooks',
        price: 6500,
        categoryId: 'cat_capacity',
        stock: 30,
      },
    ],
  }),
  get staticEntity() {
    return {
      id: this.staticEntityId,
      key: 'crm_segments',
      name: 'CRM segments',
      description: 'Static account segments / tiers',
      kind: 'static',
      attributes: [
        idAttr(),
        attr('code', 'Code', 'string', { required: true, is_unique: true, sort_order: 0 }),
        attr('name', 'Name', 'string', { required: true, sort_order: 1 }),
        attr('target_arr', 'Target ARR', 'number', { sort_order: 2 }),
      ],
      records: [
        { id: '71111111-1111-4111-8111-111111111701', code: 'STARTER', name: 'Starter', target_arr: 50000 },
        { id: '71111111-1111-4111-8111-111111111702', code: 'GROWTH', name: 'Growth', target_arr: 200000 },
        { id: '71111111-1111-4111-8111-111111111703', code: 'ENT', name: 'Enterprise', target_arr: 750000 },
      ],
    }
  },
  get dynamicEntity() {
    return {
      id: this.dynamicEntityId,
      key: 'crm_activities',
      name: 'CRM activities',
      description: 'Logged PulseCRM workspace activities',
      kind: 'dynamic',
      attributes: enquiryAttributes(),
      records: [],
    }
  },
  branches: [
    { caseId: 'case_lookup', match: 'Look up account', label: 'Lookup' },
    { caseId: 'case_lead', match: 'Capture a lead', label: 'Lead' },
    { caseId: 'case_ticket', match: 'Log a ticket', label: 'Ticket' },
    { caseId: 'case_deal', match: 'Check deal status', label: 'Deal' },
    { caseId: 'case_meeting', match: 'Book a meeting', label: 'Meeting' },
    { caseId: 'case_addons', match: 'CRM add-ons', label: 'Add-ons' },
  ],
  wireBranches(b, ind) {
    // Look up account
    b.message(
      'intro_lookup',
      'Lookup',
      'Look up a customer account. Try **rep@pulsecrm.example** after verification.',
    )
    b.question('lookup_email', 'Account email', 'Which account email should we search?', 'email', {
      output: 'lookup_email',
    })
    b.question('lookup_otp', 'Verification', 'Enter the verification code (any 6 digits for this demo).', 'otp', {
      output: 'otp_ok',
      config: { otpSubject: 'PulseCRM account code', otpLength: 6 },
    })
    b.http('http_account', 'GET account', {
      method: 'GET',
      path: '/crm/accounts',
      paramValues: { email: '{{vars.lookup_email}}' },
      outputVariable: 'crm_account',
    })
    b.http('http_pipeline_snapshot', 'GET pipeline', {
      method: 'GET',
      path: '/crm/pipeline',
      outputVariable: 'crm_pipeline',
    })
    b.entity('list_segments', 'List segments', {
      entityId: ind.staticEntityId,
      operation: 'list',
      outputVariable: 'crm_segments',
    })
    b.condition('cond_found', 'Account found?', '{{vars.crm_account.data.company}}', 'exists', '')
    b.message(
      'msg_account_found',
      'Account',
      [
        '{color:success}**Account on file**{/color}',
        '',
        '**{{vars.crm_account.data.company}}** · `{{vars.crm_account.data.account_code}}`',
        'Contact: **{{vars.crm_account.data.contact_name}}** · {{vars.crm_account.data.email}}',
        'Tier: **{{vars.crm_account.data.tier}}** · Owner: **{{vars.crm_account.data.owner}}**',
        'ARR: **{{vars.crm_account.data.arr}}** · Status: **{{vars.crm_account.data.status}}**',
        '',
        'Pipeline stages online: **{{length(vars.crm_pipeline.data)}}** · local segments: **{{length(vars.crm_segments)}}**',
      ].join('\n'),
    )
    b.message(
      'msg_account_missing',
      'Not found',
      [
        '{color:warning}**No account for that email**{/color}',
        '',
        'Try `rep@pulsecrm.example`, or capture a new lead instead.',
        'Pipeline stages available: **{{length(vars.crm_pipeline.data)}}**.',
      ].join('\n'),
    )
    b.message('done_lookup', 'Lookup done', 'Account lookup complete for **{{vars.lookup_email}}**.')
    b.chain([
      'intro_lookup',
      'lookup_email',
      'lookup_otp',
      'http_account',
      'http_pipeline_snapshot',
      'list_segments',
      'cond_found',
    ])
    b.link('cond_found', 'msg_account_found', 'true', 'Found')
    b.link('cond_found', 'msg_account_missing', 'false', 'Missing')
    b.link('msg_account_found', 'done_lookup')
    b.link('msg_account_missing', 'done_lookup')
    attachBranch(b, 'case_lookup', 'Look up account', 'intro_lookup', 'done_lookup')

    // Capture a lead
    b.message('intro_lead', 'Lead', 'Capture and score a new lead for the pipeline.')
    b.question('lead_source', 'Source', 'Lead source?', 'choice', {
      output: 'lead_source',
      config: {
        choices: ['Inbound web', 'Event / webinar', 'Partner referral', 'Outbound', 'Other'],
      },
    })
    b.question('lead_form', 'Lead details', 'Company and contact details', 'form', {
      output: 'lead_form',
      config: {
        formFields: [
          { key: 'company', label: 'Company', type: 'string', required: true },
          { key: 'contact', label: 'Contact name', type: 'string', required: true },
          { key: 'title', label: 'Title', type: 'string', required: false },
          { key: 'need', label: 'What do they need?', type: 'string', required: true },
          { key: 'employees', label: 'Employees (approx)', type: 'number', required: false },
        ],
      },
    })
    b.question('lead_interest', 'Interest', 'Rank what matters most for this lead.', 'ranking', {
      output: 'lead_interest',
      config: {
        choices: ['Sales pipeline', 'Support tickets', 'Analytics', 'Integrations', 'Migration'],
      },
    })
    b.question('lead_budget', 'Budget feel', 'Rough annual budget interest?', 'currency', {
      output: 'lead_budget',
      required: false,
    })
    b.question('lead_score', 'Fit score', 'How strong is the fit (0–100)?', 'number', {
      output: 'lead_score',
    })
    b.operation('op_lead_band', 'Score band', {
      operation: 'add',
      left: '{{vars.lead_score}}',
      right: '0',
      outputVariable: 'lead_score_n',
    })
    b.condition('cond_hot', 'Hot lead?', '{{vars.lead_score}}', 'gte', '75')
    b.http('http_lead', 'POST lead', {
      method: 'POST',
      path: '/crm/leads',
      body: JSON.stringify({
        company: '{{vars.lead_form.company}}',
        contact: '{{vars.lead_form.contact}}',
        title: '{{vars.lead_form.title}}',
        need: '{{vars.lead_form.need}}',
        source: '{{vars.lead_source}}',
        interest: '{{vars.lead_interest}}',
        budget: '{{vars.lead_budget}}',
        score: '{{vars.lead_score}}',
        owner: '{{vars.visitor_name}}',
        email: '{{vars.email}}',
        city: '{{vars.city}}',
      }),
      outputVariable: 'lead_result',
    })
    b.message(
      'msg_hot_lead',
      'Hot',
      [
        '{color:accent}**Hot lead**{/color} — route to AE immediately.',
        '',
        '**{{vars.lead_form.company}}** · score **{{vars.lead_score}}**',
        'Lead id: `{{vars.lead_result.lead_id}}` · Owner queue: **{{vars.lead_result.owner}}**',
        'Top interests: **{{first(vars.lead_interest)}}**',
      ].join('\n'),
    )
    b.message(
      'msg_warm_lead',
      'Warm',
      [
        '{color:success}**Lead captured**{/color}',
        '',
        '**{{vars.lead_form.company}}** · score **{{vars.lead_score}}**',
        'Lead id: `{{vars.lead_result.lead_id}}`',
        'Source: **{{vars.lead_source}}**',
      ].join('\n'),
    )
    b.message('done_lead', 'Lead done', 'Lead **{{vars.lead_result.lead_id}}** is in the pipeline.')
    b.chain([
      'intro_lead',
      'lead_source',
      'lead_form',
      'lead_interest',
      'lead_budget',
      'lead_score',
      'op_lead_band',
      'http_lead',
      'cond_hot',
    ])
    b.link('cond_hot', 'msg_hot_lead', 'true', 'Hot')
    b.link('cond_hot', 'msg_warm_lead', 'false', 'Warm')
    b.link('msg_hot_lead', 'done_lead')
    b.link('msg_warm_lead', 'done_lead')
    attachBranch(b, 'case_lead', 'Capture a lead', 'intro_lead', 'done_lead')

    // Log a ticket
    b.message('intro_ticket', 'Ticket', 'Log a customer support ticket against an account.')
    b.question('ticket_account', 'Account', 'Which account is affected?', 'text', {
      output: 'ticket_account',
    })
    b.question('ticket_type', 'Type', 'Ticket type?', 'choice', {
      output: 'ticket_type',
      config: {
        choices: ['Billing', 'Product bug', 'How-to', 'Integration', 'Data / import', 'Other'],
      },
    })
    b.question('ticket_priority', 'Priority', 'Priority?', 'choice', {
      output: 'ticket_priority',
      config: { choices: ['Low', 'Normal', 'High', 'Critical'] },
    })
    b.question('ticket_form', 'Details', 'Describe the issue', 'form', {
      output: 'ticket_form',
      config: {
        formFields: [
          { key: 'summary', label: 'Summary', type: 'string', required: true },
          { key: 'steps', label: 'Steps to reproduce', type: 'string', required: false },
          { key: 'impact', label: 'Business impact', type: 'string', required: true },
        ],
      },
    })
    b.question('ticket_file', 'Attachment', 'Upload a screenshot or log (optional).', 'file', {
      output: 'ticket_file',
      required: false,
      config: { fileAccept: 'any', maxFiles: 2 },
    })
    b.condition('cond_sev', 'High severity?', '{{vars.ticket_priority}}', 'contains', 'High')
    b.http('http_ticket', 'POST ticket', {
      method: 'POST',
      path: '/crm/tickets',
      body: JSON.stringify({
        account: '{{vars.ticket_account}}',
        type: '{{vars.ticket_type}}',
        priority: '{{vars.ticket_priority}}',
        summary: '{{vars.ticket_form.summary}}',
        impact: '{{vars.ticket_form.impact}}',
        reporter: '{{vars.visitor_name}}',
        email: '{{vars.email}}',
      }),
      outputVariable: 'ticket_result',
    })
    b.message(
      'msg_sev_high',
      'Escalate',
      [
        '{color:danger}**{{vars.ticket_priority}} priority**{/color}',
        '',
        'Ticket `{{vars.ticket_result.ticket_id}}` · SLA **{{vars.ticket_result.sla_hours}}h**',
        'Account: **{{vars.ticket_account}}** · {{vars.ticket_form.summary}}',
      ].join('\n'),
    )
    b.message(
      'msg_sev_normal',
      'Queued',
      [
        '{color:success}**Ticket logged**{/color}',
        '',
        'Ticket `{{vars.ticket_result.ticket_id}}` · SLA **{{vars.ticket_result.sla_hours}}h**',
        'Type: **{{vars.ticket_type}}** · Account: **{{vars.ticket_account}}**',
      ].join('\n'),
    )
    b.message('done_ticket', 'Ticket done', 'Support ticket **{{vars.ticket_result.ticket_id}}** recorded.')
    b.chain([
      'intro_ticket',
      'ticket_account',
      'ticket_type',
      'ticket_priority',
      'ticket_form',
      'ticket_file',
      'http_ticket',
      'cond_sev',
    ])
    b.link('cond_sev', 'msg_sev_high', 'true', 'High')
    b.link('cond_sev', 'msg_sev_normal', 'false', 'Normal')
    b.link('msg_sev_high', 'done_ticket')
    b.link('msg_sev_normal', 'done_ticket')
    attachBranch(b, 'case_ticket', 'Log a ticket', 'intro_ticket', 'done_ticket')

    // Check deal status
    b.message(
      'intro_deal',
      'Deal',
      'Look up a pipeline deal. Try **DEAL-2026-0042**.',
    )
    b.question('deal_ref', 'Deal reference', 'Deal reference?', 'text', {
      output: 'deal_ref',
    })
    b.http('http_deal', 'GET deal', {
      method: 'GET',
      path: '/crm/deals/{{vars.deal_ref}}',
      outputVariable: 'deal',
    })
    b.http('http_products', 'GET products', {
      method: 'GET',
      path: '/crm/products',
      outputVariable: 'crm_products',
    })
    b.message(
      'done_deal',
      'Deal',
      [
        '**{{vars.deal.data.name}}** · `{{vars.deal.data.deal_ref}}`',
        '',
        'Stage: {color:accent}**{{vars.deal.data.stage}}**{/color}',
        'Amount: **{{vars.deal.data.amount}} {{vars.deal.data.currency}}** · Close: **{{vars.deal.data.close_date}}**',
        'Account: **{{vars.deal.data.company}}** (`{{vars.deal.data.account_code}}`) · Owner **{{vars.deal.data.owner}}**',
        '',
        'Catalog add-ons online: **{{length(vars.crm_products.data)}}**',
      ].join('\n'),
    )
    b.chain(['intro_deal', 'deal_ref', 'http_deal', 'http_products', 'done_deal'])
    attachBranch(b, 'case_deal', 'Check deal status', 'intro_deal', 'done_deal')

    // Book a meeting
    b.message('intro_meeting', 'Meeting', 'Book a discovery or QBR meeting.')
    b.question('meeting_type', 'Meeting type', 'What kind of meeting?', 'choice', {
      output: 'meeting_type',
      config: {
        choices: ['Discovery call', 'Demo', 'QBR / success review', 'Renewal planning', 'Support deep-dive'],
      },
    })
    b.question('meeting_when', 'When', 'Preferred date and time?', 'appointment', {
      output: 'meeting_at',
    })
    b.question('meeting_attendees', 'Attendees', 'Rank who should attend (most important first).', 'ranking', {
      output: 'meeting_attendees',
      config: {
        choices: ['Economic buyer', 'Champion', 'Technical evaluator', 'Success manager', 'Partner'],
      },
    })
    b.question('meeting_notes', 'Agenda', 'Agenda notes?', 'long_text', {
      output: 'meeting_notes',
      required: false,
    })
    b.question('meeting_confirm', 'Confirm', 'Confirm the calendar hold.', 'confirm', {
      output: 'meeting_ok',
      config: { confirmLabel: 'Yes — book this meeting' },
    })
    b.http('http_meeting', 'POST meeting', {
      method: 'POST',
      path: '/crm/meetings',
      body: JSON.stringify({
        type: '{{vars.meeting_type}}',
        when: '{{vars.meeting_at}}',
        attendees: '{{vars.meeting_attendees}}',
        notes: '{{vars.meeting_notes}}',
        organizer: '{{vars.visitor_name}}',
        email: '{{vars.email}}',
        company: '{{vars.company}}',
      }),
      outputVariable: 'meeting_result',
    })
    b.message(
      'done_meeting',
      'Booked',
      [
        '**{{vars.meeting_type}}** on **{{prettify(vars.meeting_at)}}**',
        'Meeting id: `{{vars.meeting_result.meeting_id}}`',
        'Attendees (priority order): **{{join(vars.meeting_attendees, ", ")}}**',
      ].join('\n'),
    )
    b.chain([
      'intro_meeting',
      'meeting_type',
      'meeting_when',
      'meeting_attendees',
      'meeting_notes',
      'meeting_confirm',
      'http_meeting',
      'done_meeting',
    ])
    attachBranch(b, 'case_meeting', 'Book a meeting', 'intro_meeting', 'done_meeting')

    // CRM add-ons shop
    b.message('intro_addons', 'Add-ons', 'Browse PulseCRM add-ons and pay the cart total (demo).')
    b.http('http_addon_catalog', 'GET catalog', {
      method: 'GET',
      path: '/crm/products',
      outputVariable: 'addon_catalog',
    })
    b.message(
      'msg_addon_hint',
      'Catalog',
      'Online catalog has **{{length(vars.addon_catalog.data)}}** add-ons — pick what you need in the store.',
    )
    b.question('ask_addon_shop', 'Shop', 'Browse the PulseCRM add-on store and checkout.', 'shop', {
      output: 'cart',
      config: { shopTemplateKey: 'crm_store' },
    })
    b.question('ask_addon_pay', 'Payment', 'Pay for your CRM add-ons.', 'payment', {
      output: 'payment',
      config: {
        paymentAmount: '{{vars.cart.total}}',
        paymentItemName: 'PulseCRM add-ons',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
      },
    })
    b.message(
      'done_addons',
      'Paid',
      'Add-ons total **{{vars.cart.total}} {{vars.cart.currency}}** — payment `{{coalesce(vars.payment.reference, "demo")}}`.',
    )
    b.chain(['intro_addons', 'http_addon_catalog', 'msg_addon_hint', 'ask_addon_shop', 'ask_addon_pay', 'done_addons'])
    attachBranch(b, 'case_addons', 'CRM add-ons', 'intro_addons', 'done_addons')
  },
}

export const EXTRA_INDUSTRIES = [mining, banking, retail, government, crm]
