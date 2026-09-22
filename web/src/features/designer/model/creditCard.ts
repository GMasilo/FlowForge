/** Accept only digits and common card-number separators; preserve leading digits as text. */
export function normalizeCreditCardNumber(value: string): string | null {
  const input = value.trim()
  if (!/^[\d -]+$/.test(input)) return null
  const digits = input.replace(/[ -]/g, '')
  if (!/^\d{12,19}$/.test(digits) || /^(\d)\1+$/.test(digits)) return null
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0 ? digits : null
}

export function formatCreditCardNumber(value: string): string {
  // Keep invalid characters visible so validation can explain the problem.
  if (!/^[\d -]*$/.test(value)) return value
  const digits = value.replace(/[ -]/g, '')
  if (/^3[47]/.test(digits)) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10)].filter(Boolean).join(' ')
  }
  return digits.match(/.{1,4}/g)?.join(' ') ?? ''
}

export function maskedCreditCardNumber(digits: string): string {
  return `Card ending in ${digits.slice(-4)}`
}

export type CreditCardResponse = { number: string; expiry: string; cvv: string }

export function validateCreditCardDetails(answer: unknown, now = new Date()):
  | { ok: true; value: CreditCardResponse }
  | { ok: false; error: string } {
  const fields = answer && typeof answer === 'object' && !Array.isArray(answer)
    ? answer as Record<string, unknown> : {}
  const number = typeof fields.number === 'string' ? normalizeCreditCardNumber(fields.number) : null
  if (!number) return { ok: false, error: 'Enter a valid card number containing 12 to 19 digits.' }
  const match = typeof fields.expiry === 'string' ? /^(\d{2})\s*\/\s*(\d{2}|\d{4})$/.exec(fields.expiry.trim()) : null
  if (!match) return { ok: false, error: 'Enter the expiry date as MM/YY.' }
  const month = Number(match[1])
  const year = match[2]!.length === 2 ? 2000 + Number(match[2]) : Number(match[2])
  if (month < 1 || month > 12 || year < 2000 || year > 2099) {
    return { ok: false, error: 'Enter a valid expiry date as MM/YY.' }
  }
  // A card remains valid throughout its expiry month.
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return { ok: false, error: 'This card has expired. Use a card with a current expiry date.' }
  }
  const cvv = typeof fields.cvv === 'string' ? fields.cvv.trim() : ''
  const isAmex = /^3[47]/.test(number)
  if (!(isAmex ? /^\d{4}$/ : /^\d{3}$/).test(cvv)) {
    return { ok: false, error: `Enter the ${isAmex ? '4' : '3'}-digit CVV.` }
  }
  return { ok: true, value: { number, expiry: `${match[1]}/${String(year).slice(-2)}`, cvv } }
}
