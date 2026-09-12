import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import {
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  type LegalDocument,
} from '@/features/docs/legalContent'

function LegalDocumentView({ doc, other }: { doc: LegalDocument; other: LegalDocument }) {
  return (
    <div className="ff-page-enter mx-auto max-w-3xl">
      <header>
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          <Scale className="h-3.5 w-3.5" aria-hidden />
          Legal
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          Effective date: <time dateTime="2026-09-11">{doc.effectiveDate}</time>
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">{doc.summary}</p>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
          Also see{' '}
          <Link
            className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4"
            to={`/${other.slug}`}
          >
            {other.title}
          </Link>
          .
        </p>
      </header>

      <nav
        aria-label="On this page"
        className="mt-8 rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/70 p-4 shadow-[var(--shadow-soft)]"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          On this page
        </p>
        <ol className="mt-2 columns-1 gap-x-8 text-sm sm:columns-2">
          {doc.sections.map((section) => (
            <li key={section.id} className="break-inside-avoid py-0.5">
              <a
                href={`#${section.id}`}
                className="text-[var(--color-ink-muted)] hover:text-[var(--color-accent)]"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--color-ink)]/90">
              {section.paragraphs.map((p, i) => (
                <p key={`${section.id}-p-${i}`}>{p}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc space-y-1.5 pl-5 text-[var(--color-ink-muted)]">
                  {section.bullets.map((item, i) => (
                    <li key={`${section.id}-b-${i}`}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-[var(--color-ink-muted)]">
        Questions? Visit{' '}
        <Link
          className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4"
          to="/help"
        >
          Help
        </Link>{' '}
        or return to the{' '}
        <Link
          className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4"
          to="/"
        >
          home page
        </Link>
        .
      </p>
    </div>
  )
}

export function TermsPage() {
  return <LegalDocumentView doc={TERMS_OF_SERVICE} other={PRIVACY_POLICY} />
}

export function PrivacyPage() {
  return <LegalDocumentView doc={PRIVACY_POLICY} other={TERMS_OF_SERVICE} />
}
