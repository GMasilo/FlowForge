import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export type PaymentPhase = {
  url: string
  amount: string
  currency: string
  payLabel: string
  paidLabel: string
  connectionId?: string
  itemName?: string
  buyerEmail?: string
  buyerName?: string
  nodeKey?: string
  verify?: boolean
}

export type PaymentCheckout = {
  reference: string
  checkoutUrl: string
  fields?: Record<string, string>
}

function formatAmount(amount: string, currency: string): string {
  const trimmed = amount.trim()
  if (!trimmed) return ''
  const n = Number(trimmed.replace(/,/g, ''))
  const code = currency.trim().toUpperCase() || 'ZAR'
  if (Number.isFinite(n)) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(n)
    } catch {
      return `${code} ${trimmed}`
    }
  }
  return `${code} ${trimmed}`.trim()
}

function openCheckout(checkoutUrl: string, fields?: Record<string, string>) {
  const entries = Object.entries(fields ?? {}).filter(([, v]) => v !== '')
  if (!entries.length) {
    window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
    return
  }
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = checkoutUrl
  form.target = '_blank'
  form.rel = 'noopener'
  for (const [name, value] of entries) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  form.remove()
}

export function PaymentAnswerField({
  payment,
  disabled,
  className,
  onSubmit,
  onStartPayment,
  onCheckPayment,
}: {
  payment: PaymentPhase
  disabled?: boolean
  className?: string
  onSubmit: (value: {
    status: 'paid' | 'verified'
    url?: string
    amount?: string | number
    currency?: string
    reference?: string
    providerPaymentId?: string
  }) => void
  onStartPayment?: () => Promise<PaymentCheckout>
  onCheckPayment?: (
    reference: string,
  ) => Promise<{ status: string; providerPaymentId?: string | null }>
}) {
  const amountText = formatAmount(payment.amount, payment.currency)
  const url = payment.url.trim()
  const verify = payment.verify === true && !!onStartPayment
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'verified' | 'failed'>('idle')
  const pollRef = useRef<number | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function paidPayload(status: 'paid' | 'verified', extra?: { reference?: string; providerPaymentId?: string }) {
    const amountRaw = payment.amount.trim()
    const asNumber = Number(amountRaw.replace(/,/g, ''))
    return {
      status,
      ...(url ? { url } : {}),
      ...(amountRaw ? { amount: Number.isFinite(asNumber) ? asNumber : amountRaw } : {}),
      ...(payment.currency.trim() ? { currency: payment.currency.trim().toUpperCase() } : {}),
      ...(extra?.reference ? { reference: extra.reference } : {}),
      ...(extra?.providerPaymentId ? { providerPaymentId: extra.providerPaymentId } : {}),
    }
  }

  async function startVerifiedPay() {
    if (!onStartPayment) return
    setBusy(true)
    setError(null)
    try {
      const started = await onStartPayment()
      setReference(started.reference)
      openCheckout(started.checkoutUrl, started.fields)
      setPhase('waiting')
      if (pollRef.current) window.clearInterval(pollRef.current)
      pollRef.current = window.setInterval(() => {
        void checkOnce(started.reference)
      }, 2500)
      await checkOnce(started.reference)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment')
      setPhase('failed')
    } finally {
      setBusy(false)
    }
  }

  async function checkOnce(ref: string) {
    if (!onCheckPayment) return
    try {
      const result = await onCheckPayment(ref)
      if (result.status === 'verified') {
        if (submittedRef.current) return
        submittedRef.current = true
        if (pollRef.current) window.clearInterval(pollRef.current)
        setPhase('verified')
        onSubmit(
          paidPayload('verified', {
            reference: ref,
            providerPaymentId: result.providerPaymentId ?? undefined,
          }),
        )
      } else if (result.status === 'failed' || result.status === 'cancelled') {
        if (pollRef.current) window.clearInterval(pollRef.current)
        setPhase('failed')
        setError('Payment was not completed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check payment')
    }
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      {amountText ? (
        <p className="text-sm font-semibold text-[var(--color-ink)]">Amount due: {amountText}</p>
      ) : null}
      {verify ? (
        <>
          <Button
            type="button"
            className="h-11 rounded-2xl"
            disabled={disabled || busy || phase === 'waiting' || phase === 'verified'}
            onClick={() => void startVerifiedPay()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {payment.payLabel || 'Pay now'}
          </Button>
          {phase === 'waiting' ? (
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Waiting for the payment provider to confirm{reference ? ` (${reference.slice(0, 8)}…)` : ''}…
            </p>
          ) : null}
          {phase === 'waiting' && reference && onCheckPayment ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl"
              disabled={disabled || busy}
              onClick={() => void checkOnce(reference)}
            >
              Check payment
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {url ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl"
              disabled={disabled}
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-4 w-4" />
              {payment.payLabel || 'Pay now'}
            </Button>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">No pay link — confirm when the payment is done (cash, EFT, …).</p>
          )}
          <Button
            type="button"
            className="h-11 rounded-2xl"
            disabled={disabled}
            onClick={() => onSubmit(paidPayload('paid'))}
          >
            {payment.paidLabel || "I've paid"}
          </Button>
        </>
      )}
      {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  )
}
