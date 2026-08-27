/**
 * Manual check: npx vite-node src/features/designer/model/answerValidation.check.ts
 */
import { validateQuestionAnswer } from '@/features/designer/model/answerValidation'
import { describeQuestionResponse } from '@/features/designer/model/flowSchema'
import { starterTemplateContent, templateExprValue } from '@/features/templates/templateModel'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

{
  const r = validateQuestionAnswer({ answerType: 'email', answerRequired: true }, 'bad')
  assert(!r.ok && r.error.includes('email'), 'email rejects invalid')
}
{
  const r = validateQuestionAnswer({ answerType: 'email', answerRequired: true }, 'a@b.com')
  assert(r.ok && r.value === 'a@b.com', 'email accepts valid')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'email', allowedEmailDomains: ['company.com'], answerRequired: true },
    'user@gmail.com',
  )
  assert(!r.ok && r.error.includes('company.com'), 'email rejects other domains')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'email', allowedEmailDomains: ['@Company.com', 'partner.org'], answerRequired: true },
    'User@company.com',
  )
  assert(r.ok, 'email accepts allowlisted domain case-insensitively')
}
{
  const r = validateQuestionAnswer({ answerType: 'number', min: 1, max: 10, answerRequired: true }, '0')
  assert(!r.ok, 'number rejects below min')
}
{
  const r = validateQuestionAnswer({ answerType: 'number', min: 1, max: 10, answerRequired: true }, '5')
  assert(r.ok && r.value === 5, 'number accepts in range')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'choice', choices: ['A', 'B'], allowMultiple: true, minSelections: 2, answerRequired: true },
    ['A'],
  )
  assert(!r.ok, 'multi choice enforces minSelections')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'choice', choices: ['A', 'B'], allowMultiple: true, answerRequired: true },
    ['A', 'B'],
  )
  assert(r.ok && Array.isArray(r.value) && r.value.length === 2, 'multi choice accepts array')
}
{
  const r = validateQuestionAnswer({ answerType: 'gender', answerRequired: true }, 'Female')
  assert(r.ok && r.value === 'Female', 'gender uses default choices')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'numbered_choice', choices: ['Red', 'Blue'], answerRequired: true },
    '2',
  )
  assert(r.ok && r.value === 'Blue' && r.displayText === '2. Blue', 'numbered choice maps 2 → Blue')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'numbered_choice', choices: ['Red', 'Blue'], answerRequired: true },
    'Blue',
  )
  assert(r.ok && r.value === 'Blue', 'numbered choice accepts label')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'numbered_choice', choices: ['Red', 'Blue'], answerRequired: true },
    '9',
  )
  assert(!r.ok, 'numbered choice rejects out-of-range number')
}
{
  const r = validateQuestionAnswer({ answerType: 'phone', phoneFormat: 'e164', answerRequired: true }, '555')
  assert(!r.ok, 'e164 phone rejects local')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'phone', phoneFormat: 'e164', answerRequired: true },
    '+15551234567',
  )
  assert(r.ok && r.value === '+15551234567', 'e164 phone accepts')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'phone', phoneFormat: 'e164', answerRequired: true },
    '+27 82 123 4567',
  )
  assert(r.ok && r.value === '+27821234567', 'e164 phone normalizes spaces')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'text', minLength: 3, pattern: '^[A-Z]+$', patternMessage: 'UPPER only', answerRequired: true },
    'ab',
  )
  assert(!r.ok, 'text enforces minLength')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'text', pattern: '^[A-Z]+$', patternMessage: 'UPPER only', answerRequired: true },
    'ABC',
  )
  assert(r.ok, 'text accepts matching pattern')
}
{
  const r = validateQuestionAnswer({ answerType: 'rating', answerRequired: true }, '6')
  assert(!r.ok, 'rating defaults max 5')
}
{
  const r = validateQuestionAnswer({ answerType: 'rating', answerRequired: true }, '3')
  assert(r.ok && r.value === 3, 'rating accepts')
}
{
  const r = validateQuestionAnswer({ answerType: 'slider', answerRequired: true }, '40')
  assert(r.ok && r.value === 40, 'slider accepts')
}
{
  const r = validateQuestionAnswer({ answerType: 'stars', answerRequired: true }, '5')
  assert(r.ok && r.displayText === '5 stars', 'stars accepts')
}
{
  const r = validateQuestionAnswer({ answerType: 'nps', answerRequired: true }, '11')
  assert(!r.ok, 'nps rejects above 10')
}
{
  const r = validateQuestionAnswer({ answerType: 'color', answerRequired: true }, '#0d9488')
  assert(r.ok && r.value === '#0d9488', 'color accepts hex')
}
{
  const r = validateQuestionAnswer({ answerType: 'url', answerRequired: true }, 'google.com')
  assert(r.ok && r.value === 'https://google.com' && r.displayText === 'google.com', 'url accepts bare host')
}
{
  const r = validateQuestionAnswer({ answerType: 'url', answerRequired: true }, 'https://www.google.com/search')
  assert(r.ok && r.value === 'https://www.google.com/search', 'url keeps full https URL')
}
{
  const r = validateQuestionAnswer({ answerType: 'url', answerRequired: true }, 'not a url')
  assert(!r.ok, 'url rejects nonsense')
}
{
  const r = validateQuestionAnswer({ answerType: 'file', answerRequired: true }, '')
  assert(!r.ok, 'file requires an upload')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'file', fileAccept: 'pdf', answerRequired: true },
    {
      filename: 'a.pdf',
      originalName: 'a.pdf',
      url: 'https://example.com/file/get?name=a.pdf',
      mime: 'application/pdf',
      size: 12,
      key: 'a_pdf',
    },
  )
  assert(r.ok && r.displayText === 'a.pdf', 'file accepts pdf')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'file', fileAccept: 'pdf', answerRequired: true },
    {
      filename: 'a.png',
      originalName: 'a.png',
      url: 'https://example.com/file/get?name=a.png',
      mime: 'image/png',
      size: 12,
      key: 'a_png',
    },
  )
  assert(!r.ok, 'file rejects disallowed type')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'signature', answerRequired: true },
    {
      filename: 'signature.png',
      originalName: 'signature.png',
      url: 'blob:preview',
      mime: 'image/png',
      size: 40,
      key: 'signature_png',
    },
  )
  assert(r.ok, 'signature accepts png')
}
{
  const r = validateQuestionAnswer(
    {
      answerType: 'image_choice',
      imageChoices: [
        { label: 'Studio', filename: 'studio.png' },
        { label: 'Garden', filename: 'garden.png' },
      ],
      answerRequired: true,
    },
    'Studio',
  )
  assert(r.ok && typeof r.value === 'object' && r.value !== null, 'image choice stores an image object')
  const stored = r.value as { label: string; filename: string; key: string }
  assert(stored.label === 'Studio' && stored.filename === 'studio.png' && stored.key === 'studio_png', 'image object has label filename key')
}
{
  const r = validateQuestionAnswer(
    {
      answerType: 'image_choice',
      imageChoices: [
        { label: 'Studio', filename: 'studio.png' },
        { label: 'Garden', filename: 'garden.png' },
      ],
      allowMultiple: true,
      answerRequired: true,
    },
    ['Studio', 'Garden'],
  )
  assert(r.ok && Array.isArray(r.value) && r.value.length === 2, 'image choice multi stores an array')
  assert(
    (r.value as Array<{ label: string }>).every((item) => typeof item === 'object' && typeof item.label === 'string'),
    'image choice multi is an array of image objects',
  )
}
{
  const r = validateQuestionAnswer(
    {
      answerType: 'image_choice',
      imageChoices: [{ label: 'Studio', filename: 'studio.png' }],
      answerRequired: true,
    },
    { label: 'Studio', filename: 'studio.png', url: 'https://cdn.example/studio.png' },
  )
  assert(
    r.ok && (r.value as { url?: string }).url === 'https://cdn.example/studio.png',
    'image choice keeps url from a submitted object',
  )
}
{
  const single = describeQuestionResponse({ answerType: 'image_choice' })
  assert(single.dataType === 'object' && single.example.includes('filename'), 'image choice returns an image object')
  const multi = describeQuestionResponse({ answerType: 'image_choice', allowMultiple: true })
  assert(multi.dataType === 'array' && multi.example.includes('{ label, filename, url, key }'), 'image choice multi returns image objects')
  assert(
    multi.fields.some((f) => f.path === 'response[].label'),
    'image choice multi exposes object field paths',
  )
}
{
  const r = validateQuestionAnswer(
    { answerType: 'national_id', idFormat: 'za', answerRequired: true },
    '8001015009087',
  )
  assert(r.ok && r.value === '8001015009087', 'za id accepts valid checksum')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'national_id', idFormat: 'za', answerRequired: true },
    '8001015009080',
  )
  assert(!r.ok, 'za id rejects bad checksum')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'ranking', choices: ['A', 'B', 'C'], answerRequired: true },
    ['C', 'A', 'B'],
  )
  assert(r.ok && JSON.stringify(r.value) === JSON.stringify(['C', 'A', 'B']), 'ranking stores order')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'location', answerRequired: true },
    { lat: -26.2, lng: 28.0, label: 'JHB' },
  )
  assert(r.ok && r.displayText === 'JHB', 'location accepts gps')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'appointment', answerRequired: true },
    { date: '2026-12-01', time: '14:30' },
  )
  assert(r.ok && r.displayText === '2026-12-01 at 14:30', 'appointment accepts date and time')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'appointment', choices: ['09:00', '10:00'], answerRequired: true },
    { date: '2026-12-01', time: '14:30' },
  )
  assert(r.ok, 'appointment ignores legacy time-slot choices')
}
{
  const r = validateQuestionAnswer(
    {
      answerType: 'matrix',
      choices: ['Speed', 'Quality'],
      scaleChoices: ['Low', 'High'],
      answerRequired: true,
    },
    { Speed: 'High', Quality: 'Low' },
  )
  assert(r.ok, 'matrix accepts all rows')
}
{
  const r = validateQuestionAnswer({ answerType: 'password', answerRequired: true }, 'secret1')
  assert(r.ok && r.displayText === '••••••' && r.value === 'secret1', 'password masks display')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'payment', answerRequired: true },
    { status: 'paid', url: 'https://pay.example/x', amount: 150, currency: 'ZAR' },
  )
  assert(r.ok && r.displayText.includes('150'), 'payment accepts paid confirmation')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'payment', paymentConnectionId: 'conn-1', answerRequired: true },
    { status: 'paid', amount: 150, currency: 'ZAR' },
  )
  assert(!r.ok, 'connected payment rejects self-confirm')
}
{
  const r = validateQuestionAnswer(
    { answerType: 'payment', paymentConnectionId: 'conn-1', answerRequired: true },
    { status: 'verified', amount: 150, currency: 'ZAR', reference: 'abc' },
  )
  assert(r.ok && (r.value as { status: string }).status === 'verified', 'connected payment accepts verified')
}
{
  const r = validateQuestionAnswer({ answerType: 'captcha', answerRequired: true }, '12')
  assert(r.ok && JSON.stringify(r.value) === JSON.stringify({ ok: true }), 'captcha stores ok flag')
}
{
  const r = validateQuestionAnswer(
    {
      answerType: 'form',
      formFields: [
        { key: 'name', label: 'Name', type: 'name', required: true },
        { key: 'email', label: 'Email', type: 'email', required: true },
        { key: 'phone', label: 'Phone', type: 'phone', required: false },
      ],
      answerRequired: true,
    },
    { name: 'Jane Doe', email: 'jane@x.com', phone: '' },
  )
  assert(r.ok && (r.value as { name: string }).name === 'Jane Doe', 'form accepts required fields')
}
{
  const r = validateQuestionAnswer(
    {
      answerType: 'form',
      formFields: [{ key: 'email', label: 'Email', type: 'email', required: true }],
      answerRequired: true,
    },
    { email: 'nope' },
  )
  assert(!r.ok && r.error.includes('Email'), 'form rejects invalid field')
}
{
  const catalog = starterTemplateContent('cart')
  const templates = {
    cafe: templateExprValue({
      id: '1',
      key: 'cafe',
      name: 'Cafe',
      kind: 'cart',
      content: catalog,
    }),
  }
  const r = validateQuestionAnswer(
    { answerType: 'shop', shopTemplateKey: 'cafe', answerRequired: true },
    { items: [{ id: 'prod_espresso', qty: 2, price: 1 }] },
    { templates },
  )
  assert(r.ok && typeof r.value === 'object' && r.value !== null, 'shop accepts cart')
  const cart = r.value as { subtotal: number; itemCount: number }
  assert(cart.itemCount === 2 && cart.subtotal === 7, 'shop ignores spoofed prices')
}
{
  const shop = describeQuestionResponse({ answerType: 'shop' })
  assert(shop.dataType === 'object' && shop.example.includes('subtotal'), 'shop response shape')
}

console.log('answerValidation.check.ts: all passed')
