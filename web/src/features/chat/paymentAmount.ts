/** Match the amount displayed by chat, including correctly grouped thousands. */
export function paymentAmountForCheckout(raw: string | number): string {
  const value = String(raw).trim()
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value)) {
    throw new Error('Payment amount must resolve to a positive number. Check the Payment template amount and its input bindings.')
  }
  const amount = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount < 0.005 || amount > 9999999999.99) {
    throw new Error('Payment amount must be at least 0.01 and no more than 9,999,999,999.99. Check the Payment template amount and its input bindings.')
  }
  return amount.toFixed(2)
}
