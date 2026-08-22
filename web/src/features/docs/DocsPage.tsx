import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { DOC_SECTIONS, type ExprFunctionDoc } from '@/features/docs/content'

function FunctionReference({ fn }: { fn: ExprFunctionDoc }) {
  const anchor = `fn-${fn.name.toLowerCase()}`
  return (
    <article id={anchor} className="scroll-mt-24 border-t border-[var(--color-border)]/50 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
          {fn.name}
        </h4>
        <code className="rounded-md bg-slate-900/90 px-2 py-0.5 text-[12px] text-teal-100">{fn.signature}</code>
      </div>
      {fn.aliases?.length ? (
        <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
          Alias{fn.aliases.length === 1 ? '' : 'es'}:{' '}
          {fn.aliases.map((a) => (
            <code key={a} className="mx-0.5 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--color-ink)]">
              {a}
            </code>
          ))}
        </p>
      ) : null}
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink)]">{fn.description}</p>
      <div className="mt-3 space-y-3">
        {fn.examples.map((ex) => (
          <div key={ex.expression} className="overflow-hidden rounded-xl border border-[var(--color-accent)]/15 bg-slate-900">
            <pre className="overflow-x-auto px-4 py-2.5 text-[13px] leading-relaxed text-teal-50">
              <code>{ex.expression}</code>
            </pre>
            <div className="border-t border-white/10 bg-slate-950/60 px-4 py-2 text-[12px] leading-relaxed text-white/45">
              <span className="text-white/40">→ </span>
              <code className="text-emerald-300">{ex.result}</code>
              {ex.note ? <span className="mt-0.5 block text-white/40">{ex.note}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

export function DocsPage() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace(/^#/, '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  return (
    <div className="ff-page-enter">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]/80">Documentation</p>
        <h1 className="mt-2 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
          How FlowForge works
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          A practical guide to organisations, the flow designer, questions, variables, expressions, connections, and data.
          Prefer short answers? See the{' '}
          <Link className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4" to="/faq">
            FAQ
          </Link>{' '}
          or{' '}
          <Link className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/30 underline-offset-4" to="/help">
            Help
          </Link>
          .
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">On this page</p>
          <nav className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
            {DOC_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)]/80 hover:text-[var(--color-accent)]"
              >
                {section.title}
              </a>
            ))}
          </nav>
          {DOC_SECTIONS.some((s) => s.functions?.length) ? (
            <div className="mt-6 hidden lg:block">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                Functions
              </p>
              <nav className="flex flex-col gap-0.5">
                {DOC_SECTIONS.flatMap((s) => s.functions ?? []).map((fn) => (
                  <a
                    key={fn.name}
                    href={`#fn-${fn.name.toLowerCase()}`}
                    className="rounded-md px-2 py-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)]/80 hover:text-[var(--color-accent)]"
                  >
                    {fn.name}
                  </a>
                ))}
              </nav>
            </div>
          ) : null}
        </aside>

        <div className="space-y-12">
          {DOC_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{section.title}</h2>
              <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{section.summary}</p>
              <div className="mt-5 space-y-5 border-t border-[var(--color-border)]/60 pt-5">
                {section.body.map((block, i) => (
                  <div key={i} className="space-y-2">
                    {block.heading ? (
                      <h3 className="text-base font-semibold text-[var(--color-ink)]">{block.heading}</h3>
                    ) : null}
                    {block.paragraphs?.map((p) => (
                      <p key={p} className="text-[15px] leading-relaxed text-[var(--color-ink)]">
                        {p}
                      </p>
                    ))}
                    {block.bullets ? (
                      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[var(--color-ink)]">
                        {block.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                    {block.code ? (
                      <pre className="overflow-x-auto rounded-xl border border-[var(--color-accent)]/15 bg-slate-900 px-4 py-3 text-[13px] leading-relaxed text-teal-50">
                        <code>{block.code}</code>
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>

              {section.functions?.length ? (
                <div className="mt-8 space-y-6">
                  <div className="flex flex-wrap gap-2 lg:hidden">
                    {section.functions.map((fn) => (
                      <a
                        key={fn.name}
                        href={`#fn-${fn.name.toLowerCase()}`}
                        className="rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/60 px-2.5 py-1 font-mono text-[11px] text-[var(--color-accent)]"
                      >
                        {fn.name}
                      </a>
                    ))}
                  </div>
                  {section.functions.map((fn) => (
                    <FunctionReference key={fn.name} fn={fn} />
                  ))}
                </div>
              ) : null}
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-border)]/60 pt-8 text-sm">
            <Link to="/help" className="inline-flex items-center gap-1.5 font-medium text-[var(--color-accent)] hover:underline">
              Guided help <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/faq" className="inline-flex items-center gap-1.5 font-medium text-[var(--color-accent)] hover:underline">
              Common questions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
