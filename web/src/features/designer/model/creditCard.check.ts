import { formatCreditCardNumber, normalizeCreditCardNumber, validateCreditCardDetails } from './creditCard'
import { validateQuestionAnswer } from './answerValidation'
import { describeQuestionResponse, QUESTION_ANSWER_TYPE_OPTIONS } from './flowSchema'

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

for (const number of ['4111111111111111', '5555555555554444', '378282246310005', '6011111111111117']) {
  assert(normalizeCreditCardNumber(number) === number, 'Accept valid test card numbers')
  const result = validateQuestionAnswer({ answerType: 'credit_card', answerRequired: true }, {
    number: formatCreditCardNumber(number), expiry: '12/99', cvv: /^3[47]/.test(number) ? '0123' : '012',
  })
  assert(result.ok && (result.value as { number: string }).number === number, 'Normalize formatted card number')
  assert(result.ok && result.displayText === `Card ending in ${number.slice(-4)}`, 'Only show last four digits')
}
for (const number of ['4111111111111112', '0000000000000000', '4111', '41111111111111111111', '4111a111111111111', '4111.1111.1111.1111']) {
  assert(normalizeCreditCardNumber(number) === null, 'Reject invalid card number')
  assert(!validateQuestionAnswer({ answerType: 'credit_card' }, number).ok, 'Runtime rejects invalid number')
}
assert(normalizeCreditCardNumber('4111-1111-1111-1111') === '4111111111111111', 'Accept hyphen separators')
assert(formatCreditCardNumber('378282246310005') === '3782 822463 10005', 'Format 15 digit card')
assert(!validateQuestionAnswer({ answerType: 'credit_card', answerRequired: true }, '').ok, 'Required input')
const optional = validateQuestionAnswer({ answerType: 'credit_card', answerRequired: false }, '')
assert(optional.ok && optional.value === null, 'Optional blank answer')
assert(!validateQuestionAnswer({ answerType: 'credit_card' }, { number: '4111111111111111' }).ok, 'Reject arbitrary objects')
const metadata = describeQuestionResponse({ answerType: 'credit_card' })
assert(metadata.dataType === 'object', 'Object response metadata')
for (const field of ['number', 'expiry', 'cvv']) {
  assert(metadata.fields.some((f) => f.path === `response.${field}` && f.type === 'string'), 'Response fields available')
}
const now = new Date(2026, 8, 22)
const details = { number: '4111 1111 1111 1111', expiry: '09/26', cvv: '012' }
const current = validateCreditCardDetails(details, now)
assert(current.ok && current.value.cvv === '012', 'Current month valid and CVV leading zero preserved')
const longYear = validateCreditCardDetails({ ...details, expiry: '09/2026' }, now)
assert(longYear.ok && longYear.value.expiry === '09/26', 'Normalize four digit expiry year')
for (const expiry of ['08/26', '12/25', '00/27', '13/27', '9/26', '09/1999', '', 'later']) {
  assert(!validateCreditCardDetails({ ...details, expiry }, now).ok, 'Reject expired or malformed expiry')
}
for (const cvv of ['', '12', '1234', 'abc', '1 2', 123]) {
  assert(!validateCreditCardDetails({ ...details, cvv }, now).ok, 'Require three digit CVV')
}
assert(!validateCreditCardDetails({ ...details, number: '378282246310005' }, now).ok, 'Amex requires four digits')
assert(validateCreditCardDetails({ ...details, number: '378282246310005', cvv: '0123' }, now).ok, 'Amex accepts four digits')
assert(QUESTION_ANSWER_TYPE_OPTIONS.some((option) => option.value === 'credit_card'), 'Designer option available')
console.log('creditCard.check.ts: all checks passed')
