export const PAYMENT_TEMPLATE_DEFAULTS = {
  paymentConnectionId: '', payUrl: '', paymentAmount: '', currencyCode: 'ZAR',
  paymentItemName: '', paymentBuyerEmail: '', paymentBuyerName: '',
  payButtonLabel: 'Pay now', paidButtonLabel: "I've paid",
}
export type PaymentTemplateContent = typeof PAYMENT_TEMPLATE_DEFAULTS

/** Explicit allowlist: credentials must never be stored or published in template content. */
export function parsePaymentTemplateContent(raw: unknown): PaymentTemplateContent {
  const rec = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  return Object.fromEntries(Object.entries(PAYMENT_TEMPLATE_DEFAULTS).map(([key, fallback]) =>
    [key, typeof rec[key] === 'string' ? rec[key] : fallback],
  )) as PaymentTemplateContent
}

export function resolvePaymentQuestionConfig(
  config: Record<string, unknown>, templates?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (config.answerType !== 'payment') return config
  const key = String(config.paymentTemplateKey ?? '').trim()
  if (!key) return config
  const raw = templates?.[key]
  const rec = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
  const valid = rec && (rec.kind === 'payment' || (!rec.kind && 'paymentConnectionId' in rec))
  return { ...config, ...parsePaymentTemplateContent(valid ? rec : null) }
}
