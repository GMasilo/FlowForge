import { useId, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { formatCreditCardNumber, validateCreditCardDetails, type CreditCardResponse } from '@/features/designer/model/creditCard'

const inputClassName = 'h-11 min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] outline-none focus:border-[var(--ff-chat-accent)] focus:ring-4 focus:ring-[var(--ff-chat-accent-soft)]'

export function CreditCardAnswerField({ onSubmit }: { onSubmit: (value: CreditCardResponse) => void }) {
  const id = useId()
  const [value, setValue] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form className="space-y-2 text-[var(--color-ink)]" onSubmit={(event) => {
      event.preventDefault()
      const result = validateCreditCardDetails({ number: value, expiry, cvv })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSubmit(result.value)
      setValue('')
      setExpiry('')
      setCvv('')
      setError(null)
    }}>
      <label htmlFor={id} className="text-sm font-medium">Card number</label>
      <div className="flex items-center gap-2">
        <CreditCard aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--color-ink-muted)]" />
        <input id={id} type="text" inputMode="numeric" autoComplete="cc-number"
          spellCheck={false} required maxLength={25} value={value}
          placeholder="1234 5678 9012 3456" aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => { setValue(formatCreditCardNumber(event.target.value)); setError(null) }}
          className={`${inputClassName} flex-1`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${id}-expiry`} className="text-sm font-medium">Expiry date</label>
          <input id={`${id}-expiry`} type="text" inputMode="numeric" autoComplete="cc-exp"
            required maxLength={7} value={expiry} placeholder="MM/YY" spellCheck={false}
            aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              const next = event.target.value
              setExpiry(/^\d{3,6}$/.test(next) ? `${next.slice(0, 2)}/${next.slice(2)}` : next)
              setError(null)
            }}
            className={`${inputClassName} w-full`} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-cvv`} className="text-sm font-medium">CVV</label>
          <input id={`${id}-cvv`} type="password" inputMode="numeric" autoComplete="cc-csc"
            required maxLength={4} value={cvv} placeholder="CVV" spellCheck={false}
            aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => { setCvv(event.target.value); setError(null) }}
            className={`${inputClassName} w-full`} />
        </div>
      </div>
      <Button type="submit" disabled={!value.trim() || !expiry.trim() || !cvv.trim()} className="h-11 rounded-2xl bg-none bg-[var(--ff-chat-accent)] text-[var(--ff-chat-accent-fg)]">Send</Button>
      {error ? <p id={`${id}-error`} role="alert" className="rounded-lg bg-[var(--color-danger-soft)] px-2 py-1 text-xs text-[var(--color-danger)]">{error}</p> : null}
    </form>
  )
}
