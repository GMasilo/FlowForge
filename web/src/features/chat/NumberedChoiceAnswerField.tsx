import { useState, type FormEvent } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Numbered list: tap a row or type 1 / 2 / … to pick.
 * Stored value is the choice label (e.g. "Blue"), not the number.
 */
export function NumberedChoiceAnswerField({
  choices,
  disabled,
  className,
  onSelect,
}: {
  choices: string[]
  disabled?: boolean
  className?: string
  onSelect: (value: string) => void
}) {
  const [draft, setDraft] = useState('')

  function submitNumber(e: FormEvent) {
    e.preventDefault()
    const raw = draft.trim()
    if (!raw || disabled) return
    onSelect(raw)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-col gap-1.5" role="listbox" aria-label="Numbered options">
        {choices.map((choice, index) => {
          const n = index + 1
          return (
            <button
              key={`${n}-${choice}`}
              type="button"
              role="option"
              disabled={disabled}
              onClick={() => onSelect(String(n))}
              className={cn(
                'flex items-start gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left text-sm transition',
                'hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] disabled:opacity-50',
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-[12px] font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20">
                {n}
              </span>
              <span className="pt-0.5 font-medium text-[var(--color-ink)]">{choice}</span>
            </button>
          )
        })}
      </div>
      <form className="flex items-center gap-2" onSubmit={submitNumber}>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Or type a number…"
          aria-label="Type the option number"
          className={cn(
            'h-10 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-ink)]',
            'outline-none focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-2 focus:ring-[var(--color-accent)]/20',
            'disabled:opacity-50',
          )}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className={cn(
            'h-10 shrink-0 rounded-2xl bg-[var(--color-accent)]$1text-[var(--color-accent-fg)] transition',
            'hover:bg-[var(--color-accent)] disabled:opacity-50',
          )}
        >
          Send
        </button>
      </form>
    </div>
  )
}
