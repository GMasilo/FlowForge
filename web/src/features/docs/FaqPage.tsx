import { Link } from 'react-router-dom'
import { FAQ_ITEMS } from '@/features/docs/content'

export function FaqPage() {
  return (
    <div className="ff-page-enter mx-auto max-w-2xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]/80">FAQ</p>
        <h1 className="mt-2 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
          Common questions
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          Short answers about organisations, editing rights, preview, shop checkout, templates, and data. For deeper walkthroughs, open the{' '}
          <Link className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4" to="/docs">
            documentation
          </Link>
          .
        </p>
      </header>

      <div className="mt-10 space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.id}
            id={item.id}
            className="group rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/70 px-4 py-1 shadow-[var(--shadow-soft)] open:bg-[var(--color-surface)]/90"
          >
            <summary className="cursor-pointer list-none py-3 font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-[var(--color-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3">
                {item.question}
                <span className="mt-0.5 text-lg font-normal text-[var(--color-accent)] transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="border-t border-[var(--color-border)]/50 pb-4 pt-3 text-[15px] leading-relaxed text-[var(--color-ink)]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-sm text-[var(--color-ink-muted)]">
        Still stuck? Visit <Link className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4" to="/help">Help</Link> for task-oriented guides.
      </p>
    </div>
  )
}
