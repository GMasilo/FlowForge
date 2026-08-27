/**
 * Builds samples/flowforge-feature-tour.json — a chatbot that walks through
 * every question type, step type, template kind, and entity operation.
 *
 * Run from repo root: node samples/feature-tour/build.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'flowforge-feature-tour.json')

const PROGRAMS_ID = 'b1000000-0000-4000-8000-000000000001'
const VISITS_ID = 'b1000000-0000-4000-8000-000000000002'

const SHARED = {
  runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
  delaySeconds: 0,
  timeoutSeconds: 0,
}

let seq = 1
const idByKey = new Map()
function nid(key) {
  const existing = idByKey.get(key)
  if (existing) return existing
  const id = `a1000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`
  idByKey.set(key, id)
  return id
}
function eid() {
  return `e1000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`
}

function node(key, type, label, config, extra = {}) {
  return {
    id: nid(key),
    key,
    type,
    label,
    config: { ...SHARED, ...config, ...extra },
    position: { x: 80, y: 40 },
  }
}

function message(key, label, text, extra = {}) {
  return node(key, 'message', label, { text, ...extra })
}

function question(key, label, prompt, answerType, extra = {}) {
  const { output, required, config = {}, ...rest } = extra
  return node(key, 'question', label, {
    prompt,
    answerType,
    answerRequired: required !== false,
    outputVariable: output ?? key.replace(/^ask_/, ''),
    ...config,
    ...rest,
  })
}

const templates = [
  {
    key: 'welcome_msg',
    name: 'Welcome message',
    kind: 'message',
    description: 'Opening copy with a guest name input.',
    content: {
      inputs: [{ key: 'name', label: 'Guest name', type: 'string', required: true }],
      text: 'Hi {{inputs.name}} — welcome to the ForgeHub feature tour. I will walk you through every FlowForge response type, plus templates, data, and logic steps.',
    },
  },
  {
    key: 'tour_menu',
    name: 'Tour menu',
    kind: 'menu',
    description: 'Quick-reply style overview of what this bot covers.',
    content: {
      inputs: [],
      title: 'This tour covers',
      items: [
        { label: 'Identity', description: 'Name, contact, ID, address', value: 'identity' },
        { label: 'Scales', description: 'Ratings, NPS, mood, sliders', value: 'scales' },
        { label: 'Shop', description: 'Catalog, cart, payment, receipt', value: 'shop' },
        { label: 'Data', description: 'Entities, variables, HTTP, email', value: 'data' },
      ],
    },
  },
  {
    key: 'studio_hours',
    name: 'Studio hours',
    kind: 'hours',
    description: 'Weekly opening hours shown in chat.',
    content: {
      inputs: [],
      timezone: 'Africa/Johannesburg',
      note: 'This is demo copy for the Hours template.',
      days: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ].map((day) => ({
        day,
        open: '09:00',
        close: day === 'Saturday' ? '13:00' : '17:00',
        closed: day === 'Sunday',
      })),
    },
  },
  {
    key: 'help_faq',
    name: 'Help / FAQ',
    kind: 'faq',
    description: 'Feature FAQ inserted into the welcome message.',
    content: {
      inputs: [{ key: 'brand', label: 'Brand', type: 'string', required: false }],
      intro: 'Quick answers about {{coalesce(inputs.brand, "ForgeHub")}}:',
      items: [
        {
          question: 'What is this chatbot?',
          answer: 'A single flow that uses every question type, template kind, and data step FlowForge ships.',
        },
        {
          question: 'Do I need connections?',
          answer: 'HTTP, email, OTP delivery, and PayFast confirmation are optional. Without them those steps are mocked or self-confirmed in Preview.',
        },
        {
          question: 'Where is my data stored?',
          answer: 'Answers land in variables. Near the end, an Entity step writes a Visits record you can inspect on the Data tab.',
        },
      ],
    },
  },
  {
    key: 'terms_of_use',
    name: 'Terms of use',
    kind: 'legal',
    description: 'Legal copy shown before the confirm checkbox.',
    content: {
      inputs: [],
      title: 'Feature tour terms',
      body: 'This is a demonstration. Answers stay on this chatbot. Do not enter real secrets, card numbers, or production credentials. By continuing you agree we may store this conversation for the tour.',
    },
  },
  {
    key: 'tour_followup',
    name: 'Tour follow-up email',
    kind: 'email',
    description: 'HTML email sent after the visit record is created.',
    content: {
      inputs: [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'brand', label: 'Brand', type: 'string', required: false },
        { key: 'visit_id', label: 'Visit id', type: 'string', required: false },
      ],
      subject: '{{coalesce(inputs.brand, "ForgeHub")}} tour recap for {{inputs.name}}',
      html: `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;color:#ffffff;">
            <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85;">{{coalesce(inputs.brand, "ForgeHub")}}</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;">Thanks {{inputs.name}}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.65;">
            <p style="margin:0 0 16px;">You finished the FlowForge feature tour. Your visit id is <strong>{{coalesce(inputs.visit_id, "pending")}}</strong>.</p>
            <p style="margin:0;color:#64748b;font-size:13px;">Bind an email connection on the Send email step to deliver this for real.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    },
  },
  {
    key: 'forgehub_store',
    name: 'ForgeHub store',
    kind: 'cart',
    description: 'Catalog with categories, stock, fixed shipping, and percent tax.',
    content: {
      currency: 'ZAR',
      storeName: 'ForgeHub merch',
      intro: 'Add a souvenir to your cart. Checkout total includes shipping and VAT.',
      checkoutLabel: 'Checkout',
      cartHint: 'Quantities cannot exceed remaining stock. Fees apply when the cart has items.',
      categories: [
        { id: 'cat_wear', name: 'Wear' },
        { id: 'cat_desk', name: 'Desk' },
      ],
      products: [
        {
          id: 'prod_tee',
          sku: 'FF-TEE',
          name: 'FlowForge tee',
          description: 'Soft cotton, teal mark',
          price: 280,
          categoryId: 'cat_wear',
          image: '',
          stock: 12,
        },
        {
          id: 'prod_cap',
          sku: 'FF-CAP',
          name: 'Canvas cap',
          description: 'Adjustable, embroidered',
          price: 180,
          categoryId: 'cat_wear',
          image: '',
          stock: 8,
        },
        {
          id: 'prod_mug',
          sku: 'FF-MUG',
          name: 'Studio mug',
          description: 'Ceramic, 350 ml',
          price: 95,
          categoryId: 'cat_desk',
          image: '',
          stock: 20,
        },
        {
          id: 'prod_sticker',
          sku: 'FF-STK',
          name: 'Sticker pack',
          description: 'Six die-cut logos',
          price: 45,
          categoryId: 'cat_desk',
          image: '',
          stock: 40,
        },
      ],
      fees: [
        { id: 'fee_ship', name: 'Shipping', kind: 'fixed', amount: 45 },
        { id: 'fee_vat', name: 'VAT', kind: 'percent', amount: 15 },
      ],
    },
  },
  {
    key: 'order_receipt',
    name: 'Order receipt',
    kind: 'receipt',
    description: 'Filled after shop + payment with cart lines and totals.',
    content: {
      inputs: [
        { key: 'name', label: 'Name', type: 'string', required: false },
        { key: 'order_id', label: 'Order id', type: 'string', required: false },
      ],
      title: 'ForgeHub receipt',
      intro: 'Thanks {{inputs.name}} — visit {{inputs.order_id}} is on file.',
      footer: 'This receipt is generated from the Receipt template.',
    },
  },
  {
    key: 'visit_pack',
    name: 'Visit pack',
    kind: 'document',
    description: 'Downloadable PDF filled from name, email, and signature.',
    content: {
      format: 'pdf',
      filename: 'forgehub-visit-{{inputs.name}}.pdf',
      title: 'ForgeHub visit pack',
      intro: 'Prepared for {{inputs.name}} on {{prettify(utcNow())}}.',
      body: 'This document is generated from a Downloadable file template. The signature field uses the drawing from this conversation.',
      footer: 'Generated by FlowForge.',
      fields: [
        { label: 'Full name', value: '{{inputs.name}}', as: 'text' },
        { label: 'Email', value: '{{inputs.email}}', as: 'text' },
        { label: 'Signature', value: '{{inputs.signature}}', as: 'image' },
      ],
      includeCart: true,
      layout: 'flow',
      blocks: [],
      inputs: [
        { key: 'name', label: 'Full name', type: 'string', required: true },
        { key: 'email', label: 'Email', type: 'string', required: true },
        { key: 'signature', label: 'Signature', type: 'file', required: true },
      ],
    },
  },
]

const entityDefs = [
  {
    id: PROGRAMS_ID,
    key: 'catalog_programs',
    name: 'Catalog programs',
    description: 'Static catalog used by Entity → List during the tour.',
    kind: 'static',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'code', label: 'Code', value_type: 'string', required: true, is_unique: true, sort_order: 0 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 1 },
      { key: 'faculty', label: 'Faculty', value_type: 'string', required: true, sort_order: 2 },
      { key: 'seats', label: 'Seats', value_type: 'number', required: false, sort_order: 3 },
    ],
    records: [
      { id: '11111111-1111-4111-8111-111111111101', code: 'CS-101', name: 'Computer Science', faculty: 'Science', seats: 120 },
      { id: '11111111-1111-4111-8111-111111111102', code: 'DS-201', name: 'Data Studio', faculty: 'Science', seats: 40 },
      { id: '11111111-1111-4111-8111-111111111103', code: 'UX-110', name: 'Conversation design', faculty: 'Humanities', seats: 28 },
    ],
  },
  {
    id: VISITS_ID,
    key: 'tour_visits',
    name: 'Tour visits',
    description: 'Dynamic table written by Entity → Create at the end of the tour.',
    kind: 'dynamic',
    attributes: [
      { key: 'id', label: 'Id', value_type: 'string', required: true, is_identifier: true, is_unique: true, sort_order: -1 },
      { key: 'name', label: 'Name', value_type: 'string', required: true, sort_order: 0 },
      { key: 'email', label: 'Email', value_type: 'string', required: true, is_unique: true, sort_order: 1 },
      { key: 'phone', label: 'Phone', value_type: 'string', required: false, sort_order: 2 },
      { key: 'country', label: 'Country', value_type: 'string', required: false, sort_order: 3 },
      { key: 'city', label: 'City', value_type: 'string', required: false, sort_order: 4 },
      { key: 'nps', label: 'NPS', value_type: 'number', required: false, sort_order: 5 },
      { key: 'cart_total', label: 'Cart total', value_type: 'number', required: false, sort_order: 6 },
      { key: 'interests', label: 'Interests', value_type: 'array', required: false, sort_order: 7 },
      { key: 'profile', label: 'Profile form', value_type: 'object', required: false, sort_order: 8 },
      { key: 'notes', label: 'Notes', value_type: 'string', required: false, sort_order: 9 },
    ],
  },
]

const nodes = [
  message(
    'welcome',
    'Welcome',
    '{{templates.welcome_msg.text}}\n\n{{templates.tour_menu.text}}\n\n{{templates.studio_hours.text}}\n\n{{templates.help_faq.text}}\n\n{{templates.terms_of_use.text}}',
    {
      delaySeconds: 1,
      templateBindings: {
        welcome_msg: { name: '{{vars.guest_label}}' },
        help_faq: { brand: '{{vars.brand_name}}' },
      },
    },
  ),
  question('ask_captcha', 'Captcha', 'Quick human check before we start.', 'captcha', {
    output: 'captcha_ok',
    config: { captchaKind: 'math', captchaMaxAttempts: 5 },
  }),
  question(
    'ask_confirm',
    'Confirm terms',
    'Please confirm you are running a demonstration and will not enter real secrets.',
    'confirm',
    { output: 'terms_ok', config: { confirmLabel: 'I agree — this is a demo' } },
  ),

  message('sec_identity', 'Identity', 'First, identity and contact — name, email, phone, address, ID, and a few extras.'),
  question('ask_name', 'Name', 'What is your full name?', 'name', { output: 'visitor_name' }),
  question('ask_nickname', 'Nickname', 'What should I call you? (short text)', 'text', {
    output: 'nickname',
    config: { minLength: 1, maxLength: 40 },
  }),
  question('ask_bio', 'Bio', 'Write a short bio (optional long text).', 'long_text', {
    output: 'bio',
    required: false,
    config: { maxLength: 500 },
  }),
  question('ask_email', 'Email', 'What is your email address?', 'email', { output: 'email' }),
  question('ask_phone', 'Phone', 'What is your phone number?', 'phone', {
    output: 'phone',
    config: { phoneFormat: 'e164' },
  }),
  question('ask_password', 'Password', 'Enter a demo password (masked in chat — do not use a real one).', 'password', {
    output: 'secret',
    required: false,
    config: { minLength: 6, maxLength: 64 },
  }),
  question('ask_national_id', 'National ID', 'Enter a national ID or similar number (6–16 digits). Switch the question to South African format if you want the 13-digit checksum.', 'national_id', {
    output: 'national_id',
    config: { idFormat: 'any', minLength: 6, maxLength: 16 },
  }),
  question('ask_gender', 'Gender', 'How do you describe your gender?', 'gender', { output: 'gender' }),
  question('ask_country', 'Country', 'Which country are you in?', 'country', { output: 'country' }),
  question('ask_address', 'Address', 'What is your street / mailing address?', 'address', { output: 'address' }),
  question('ask_postal', 'Postal code', 'Postal / ZIP code (digits).', 'postal_code', { output: 'postal_code' }),
  question('ask_website', 'Website', 'Personal or company URL (optional).', 'url', { output: 'website', required: false }),
  question('ask_color', 'Color', 'Pick a favourite colour.', 'color', { output: 'favorite_color' }),

  message('sec_when', 'When & where', 'Dates, times, an appointment, and an optional GPS location.'),
  question('ask_birthday', 'Birthday', 'What is your date of birth?', 'date', { output: 'birthday' }),
  question('ask_time', 'Time', 'What time of day works best for a callback?', 'time', { output: 'preferred_time' }),
  question('ask_datetime', 'Date & time', 'Pick a date and time for a follow-up.', 'datetime', { output: 'callback_at' }),
  question('ask_appointment', 'Appointment', 'Book a studio appointment (date + time).', 'appointment', { output: 'appointment' }),
  question('ask_location', 'Location', 'Share a location (browser GPS) if you want — optional.', 'location', {
    output: 'location',
    required: false,
  }),

  message('sec_feel', 'Scales & numbers', 'Every numeric and sentiment control: yes/no, thumbs, mood, Likert, ratings, sliders, money.'),
  question('ask_subscribe', 'Subscribe', 'Should we email you a recap after the tour?', 'boolean', { output: 'subscribe' }),
  question('ask_thumbs', 'Thumbs', 'Thumbs up or down on this tour so far?', 'thumbs', { output: 'thumbs' }),
  question('ask_mood', 'Mood', 'How are you feeling about FlowForge?', 'mood', { output: 'mood' }),
  question('ask_likert', 'Likert', '“The designer is easy to follow.”', 'likert', { output: 'likert' }),
  question('ask_rating', 'Rating', 'Rate the welcome copy from 1–5.', 'rating', {
    output: 'rating',
    config: { min: 1, max: 5, step: 1 },
  }),
  question('ask_stars', 'Stars', 'Star rating for the overall product.', 'stars', {
    output: 'stars',
    config: { min: 1, max: 5, step: 1 },
  }),
  question('ask_nps', 'NPS', 'How likely are you to recommend FlowForge? (0–10)', 'nps', {
    output: 'nps',
    config: { min: 0, max: 10, step: 1, minLabel: 'Not likely', maxLabel: 'Extremely likely' },
  }),
  question('ask_slider', 'Slider', 'How much effort did this take so far?', 'slider', {
    output: 'effort',
    config: { min: 0, max: 100, step: 1, minLabel: 'None', maxLabel: 'A lot' },
  }),
  question('ask_percentage', 'Percentage', 'How confident are you that you will finish the tour?', 'percentage', {
    output: 'confidence',
    config: { min: 0, max: 100, step: 1 },
  }),
  question('ask_stepper', 'Stepper', 'How many people are in your party? (+ / −)', 'stepper', {
    output: 'party_size',
    config: { min: 1, max: 20, step: 1 },
  }),
  question('ask_currency', 'Currency', 'Demo budget in ZAR (not charged).', 'currency', {
    output: 'budget',
    config: { currencyCode: 'ZAR', min: 0, step: 0.01 },
  }),
  question('ask_headcount', 'Number', 'How many chatbots do you plan to build? (number)', 'number', {
    output: 'headcount',
    config: { min: 0, max: 100, step: 1 },
  }),

  message('sec_pick', 'Choices', 'Lists, autocomplete, ranking, a matrix, and picture cards.'),
  question('ask_interests', 'Interests', 'Which areas do you care about? (multi-select)', 'choice', {
    output: 'interests',
    config: {
      allowMultiple: true,
      minSelections: 1,
      maxSelections: 4,
      choices: ['Flows', 'Templates', 'Entities', 'Payments', 'Analytics', 'Expressions'],
    },
  }),
  question('ask_city', 'City', 'Search and pick a city.', 'autocomplete', {
    output: 'city',
    config: { choicesFrom: '{{vars.featured_cities}}' },
  }),
  question('ask_ranking', 'Ranking', 'Rank these priorities (drag to reorder).', 'ranking', {
    output: 'priorities',
    config: { choices: ['Speed', 'Reliability', 'Design', 'Integrations'] },
  }),
  question('ask_matrix', 'Matrix', 'Rate each row on the same scale.', 'matrix', {
    output: 'matrix',
    config: {
      choices: ['Preview', 'Publish', 'Public chat'],
      scaleChoices: ['Needs work', 'OK', 'Strong'],
    },
  }),
  question(
    'ask_look',
    'Image choice',
    'Pick a look (upload look_studio.png and look_garden.png to the Media library, or skip if those files are missing).',
    'image_choice',
    {
      output: 'look',
      required: false,
      config: {
        imageChoiceLayout: 'gallery',
        imageChoices: [
          { label: 'Studio', filename: 'look_studio.png' },
          { label: 'Garden', filename: 'look_garden.png' },
        ],
      },
    },
  ),

  message('sec_files', 'Files & extra', 'Uploads, signature, voice note, OTP, and a multi-field form.'),
  question('ask_file', 'File', 'Upload a sample image or PDF (optional).', 'file', {
    output: 'upload',
    required: false,
    config: { fileAccept: 'any', maxFiles: 2 },
  }),
  question('ask_signature', 'Signature', 'Draw your signature — we will stamp it on the visit pack PDF.', 'signature', {
    output: 'signature',
  }),
  question('ask_audio', 'Voice note', 'Record a short voice note if you want (optional; times out after 45s).', 'audio', {
    output: 'voice_note',
    required: false,
    config: { timeoutSeconds: 45, maxDurationSeconds: 20 },
  }),
  question('ask_otp', 'OTP', 'Enter a 6-digit demo PIN (format-only unless you bind an email connection).', 'otp', {
    output: 'otp',
    config: {
      otpLength: 6,
      otpSubject: 'Your ForgeHub code',
      otpBody: 'Your verification code is {{otp.code}}.',
      otpExpiresSeconds: 300,
      otpMaxAttempts: 5,
    },
  }),
  question('ask_form', 'Form', 'Company details on one screen (stored as a single object).', 'form', {
    output: 'profile_form',
    config: {
      formFields: [
        { key: 'company', label: 'Company', type: 'name', required: true },
        { key: 'role', label: 'Role', type: 'text', required: true },
        { key: 'site', label: 'Company URL', type: 'url', required: false },
        { key: 'notes', label: 'Notes', type: 'long_text', required: false },
      ],
    },
  }),

  message(
    'sec_shop',
    'Shop & pay',
    'Next is the store catalog (Templates → Store catalog). Add items, checkout, then pay the cart total — that is product subtotal plus shipping and VAT.',
  ),
  question('ask_shop', 'Shop', 'Browse the ForgeHub catalog and checkout.', 'shop', {
    output: 'cart',
    config: { shopTemplateKey: 'forgehub_store' },
  }),
  question(
    'ask_payment',
    'Payment',
    'Pay {{vars.cart.total}} {{vars.cart.currency}} (self-confirm in Preview, or bind a Payment connection).',
    'payment',
    {
      output: 'payment',
      config: {
        paymentAmount: '{{vars.cart.total}}',
        paymentItemName: 'ForgeHub merch',
        paymentBuyerEmail: '{{vars.email}}',
        paymentBuyerName: '{{vars.visitor_name}}',
        payButtonLabel: 'Pay now',
        paidButtonLabel: 'I have paid',
      },
    },
  ),

  node('set_full_name', 'set_variable', 'Full name', {
    variableKey: 'full_name',
    value: '{{trim(concat(vars.visitor_name, " ", coalesce(vars.nickname, "")))}}',
    valueType: 'string',
  }),
  node('op_upper', 'operation', 'Uppercase name', {
    operation: 'uppercase',
    left: '{{vars.full_name}}',
    right: '',
    outputVariable: 'full_name_upper',
  }),
  node('op_add', 'operation', 'Extra seat', {
    operation: 'add',
    left: '{{vars.party_size}}',
    right: '1',
    outputVariable: 'extra_seat',
  }),
  node('op_len', 'operation', 'Bio length', {
    operation: 'length',
    left: '{{coalesce(vars.bio, "")}}',
    right: '',
    outputVariable: 'bio_length',
  }),
  node('op_json', 'operation', 'Stringify form', {
    operation: 'stringify_json',
    left: '{{vars.profile_form}}',
    right: '',
    outputVariable: 'form_json',
  }),
  node('op_parse', 'operation', 'Parse form JSON', {
    operation: 'parse_json',
    left: '{{vars.form_json}}',
    right: '',
    outputVariable: 'form_object',
  }),
  node('op_path', 'operation', 'Company from form', {
    operation: 'json_path',
    left: '{{vars.form_object}}',
    right: 'company',
    outputVariable: 'company_name',
  }),
  node('op_replace', 'operation', 'Email display', {
    operation: 'replace',
    left: '{{vars.email}}',
    right: '@',
    replaceWith: ' at ',
    outputVariable: 'email_display',
  }),

  node('cond_nps', 'condition', 'Promoter?', {
    left: '{{vars.nps}}',
    operator: 'gte',
    right: '9',
  }),
  message(
    'msg_promoter',
    'Promoter',
    'NPS {{vars.nps}} — thank you, {{vars.nickname}}. You are a promoter. Uppercase name: {{vars.full_name_upper}}.',
  ),
  message(
    'msg_thanks',
    'Feedback',
    'NPS {{vars.nps}} — thanks for the honest score, {{vars.nickname}}. We will keep building.',
  ),

  node('loop_interests', 'loop', 'Each interest', {
    collection: '{{vars.interests}}',
    itemVariable: 'item',
    indexVariable: 'index',
  }),
  message('msg_interest', 'Interest item', 'Interest {{vars.index}}: {{vars.item}}'),

  node('list_programs', 'entity', 'List programs', {
    entityId: PROGRAMS_ID,
    operation: 'list',
    recordId: '',
    filterAttribute: '',
    filterEquals: '',
    fieldMap: {},
    outputVariable: 'programs',
  }),
  node('create_visit', 'entity', 'Create visit', {
    entityId: VISITS_ID,
    operation: 'create',
    recordId: '',
    filterAttribute: '',
    filterEquals: '',
    fieldMap: {
      name: '{{vars.full_name}}',
      email: '{{vars.email}}',
      phone: '{{vars.phone}}',
      country: '{{vars.country}}',
      city: '{{vars.city}}',
      nps: '{{vars.nps}}',
      cart_total: '{{vars.cart.total}}',
      interests: '{{vars.interests}}',
      profile: '{{vars.profile_form}}',
      notes: '{{vars.bio}}',
    },
    outputVariable: 'visit',
  }),
  node('http_ping', 'http', 'HTTP ping', {
    connectionId: '',
    method: 'GET',
    path: '/',
    body: '',
    paramValues: {},
    outputVariable: 'http_result',
  }),
  node('email_followup', 'email', 'Send recap', {
    connectionId: '',
    templateKey: 'tour_followup',
    to: '{{vars.email}}',
    subject: '',
    body: '{{templates.tour_followup.html}}',
    paramValues: {},
    templateBindings: {
      tour_followup: {
        name: '{{vars.full_name}}',
        brand: '{{vars.brand_name}}',
        visit_id: '{{vars.visit.id}}',
      },
    },
  }),
  message(
    'msg_wrap',
    'Receipt & file',
    'Visit {{vars.visit.id}} saved. Catalog had {{steps.list_programs.count}} programs. Extra seat count {{vars.extra_seat}}. Bio length {{vars.bio_length}}.\n\n{{templates.order_receipt.text}}\n\n{{templates.visit_pack.file}}',
    {
      templateBindings: {
        order_receipt: {
          name: '{{vars.full_name}}',
          order_id: '{{vars.visit.id}}',
        },
        visit_pack: {
          name: '{{vars.full_name}}',
          email: '{{vars.email}}',
          signature: '{{vars.signature}}',
        },
      },
    },
  ),
  node('end_tour', 'end', 'End', {
    message:
      'Done, {{vars.full_name}}. You used every question type, all template kinds, entities, a condition, a loop, operations, HTTP, and email. Bind connections on Data if you want live HTTP, SMTP, OTP, or PayFast.',
  }),
]

const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]))

function link(from, to, sourceHandle = null, label = null) {
  return {
    id: eid(),
    source: byKey[from].id,
    target: byKey[to].id,
    sourceHandle,
    label,
  }
}

const linearBefore = [
  'welcome',
  'ask_captcha',
  'ask_confirm',
  'sec_identity',
  'ask_name',
  'ask_nickname',
  'ask_bio',
  'ask_email',
  'ask_phone',
  'ask_password',
  'ask_national_id',
  'ask_gender',
  'ask_country',
  'ask_address',
  'ask_postal',
  'ask_website',
  'ask_color',
  'sec_when',
  'ask_birthday',
  'ask_time',
  'ask_datetime',
  'ask_appointment',
  'ask_location',
  'sec_feel',
  'ask_subscribe',
  'ask_thumbs',
  'ask_mood',
  'ask_likert',
  'ask_rating',
  'ask_stars',
  'ask_nps',
  'ask_slider',
  'ask_percentage',
  'ask_stepper',
  'ask_currency',
  'ask_headcount',
  'sec_pick',
  'ask_interests',
  'ask_city',
  'ask_ranking',
  'ask_matrix',
  'ask_look',
  'sec_files',
  'ask_file',
  'ask_signature',
  'ask_audio',
  'ask_otp',
  'ask_form',
  'sec_shop',
  'ask_shop',
  'ask_payment',
  'set_full_name',
  'op_upper',
  'op_add',
  'op_len',
  'op_json',
  'op_parse',
  'op_path',
  'op_replace',
  'cond_nps',
]

const linearAfter = [
  'list_programs',
  'create_visit',
  'http_ping',
  'email_followup',
  'msg_wrap',
  'end_tour',
]

const edges = []
for (let i = 0; i < linearBefore.length - 1; i++) {
  edges.push(link(linearBefore[i], linearBefore[i + 1]))
}
edges.push(link('cond_nps', 'msg_promoter', 'true', 'Yes'))
edges.push(link('cond_nps', 'msg_thanks', 'false', 'No'))
edges.push(link('msg_promoter', 'loop_interests'))
edges.push(link('msg_thanks', 'loop_interests'))
edges.push(link('loop_interests', 'msg_interest', 'body', 'Each'))
edges.push(link('msg_interest', linearAfter[0], null, 'Then'))
for (let i = 0; i < linearAfter.length - 1; i++) {
  edges.push(link(linearAfter[i], linearAfter[i + 1]))
}

nodes.forEach((n, i) => {
  n.position = { x: 80, y: 40 + i * 100 }
})

const payload = {
  kind: 'flowforge.chatbotFlow',
  version: 1,
  exportedAt: new Date().toISOString(),
  chatbot: {
    id: 'c1000000-0000-4000-8000-000000000001',
    name: 'ForgeHub Feature Tour',
    description:
      'Walks through every FlowForge question type, template kind, entity operation, and logic step. Import from Chatbots → Import.',
  },
  flow: {
    id: 'f1000000-0000-4000-8000-000000000001',
    name: 'Main',
    version: 1,
  },
  globals: [
    { key: 'brand_name', value_type: 'string', default_value: 'ForgeHub', description: 'Shown in templates and the recap email' },
    { key: 'guest_label', value_type: 'string', default_value: 'explorer', description: 'Name used in the welcome template before we ask' },
    { key: 'support_email', value_type: 'string', default_value: 'hello@forgehub.example', description: 'Demo support address' },
    {
      key: 'featured_cities',
      value_type: 'array',
      default_value: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein'],
      description: 'Choices for the autocomplete city question',
    },
  ],
  nodes,
  edges,
  entities: entityDefs.map((e) => ({ id: e.id, key: e.key })),
  entityDefs,
  templates,
  testScenarios: [
    {
      name: 'Happy path seeds',
      globals: {
        brand_name: 'ForgeHub',
        guest_label: 'Ada',
        featured_cities: ['Cape Town', 'Johannesburg', 'Durban'],
      },
      expected: {
        variables: ['visitor_name', 'email', 'cart', 'visit', 'full_name'],
        stepKeys: ['welcome', 'ask_shop', 'create_visit', 'end_tour'],
      },
    },
  ],
}

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Wrote ${OUT}`)
console.log(`${nodes.length} nodes, ${edges.length} edges, ${templates.length} templates, ${entityDefs.length} entities`)
