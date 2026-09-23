import { expect, test } from 'vitest'
import { paymentAmountForCheckout } from './paymentAmount'

test('checkout accepts the grouped amount shown in chat', () => {
  expect(paymentAmountForCheckout('1,234.56')).toBe('1234.56')
  expect(paymentAmountForCheckout(' 150 ')).toBe('150.00')
  expect(paymentAmountForCheckout(75.5)).toBe('75.50')
})
test('invalid, missing and unresolved amounts fail before checkout', () => {
  for (const value of ['', ' ', '{{inputs.amount}}', '12,34', 'ZAR 150', '0', '-10', 'Infinity', '10000000000']) {
    expect(() => paymentAmountForCheckout(value)).toThrow(/Payment amount/)
  }
})
