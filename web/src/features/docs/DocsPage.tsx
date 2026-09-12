import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { DOC_SECTIONS, type DocSection, type ExprFunctionDoc } from '@/features/docs/content'
import { SearchField } from '@/shared/ui/list-controls'

function FunctionReference({ fn }: { fn: ExprFunctionDoc }) {
  const anchor = `fn-${fn.name.toLowerCase()}`
  return (
    <article id={anchor} className="scroll-mt-24 border-t border-[var(--color-border)]/50 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-[family-name:var(--font-display)] text-lg font-semibold text-slate-900">
          {fn.name}
        </h4>
        <code className="rounded-md bg-slate-900/90 px-2 py-0.5 text-[12px] text-teal-100">{fn.signature}</code>
      </div>
      {fn.aliases?.length ? (
        <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
          Alias{fn.aliases.length === 1 ? '' : 'es'}:{' '}
          {fn.aliases.map((a) => (
            <code key={a} className="mx-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
              {a}
            </code>
          ))}
        </p>
      ) : null}
      <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{fn.description}</p>
      <div className="mt-3 space-y-3">
        {fn.examples.map((ex) => (
          <div key={ex.expression} className="overflow-hidden rounded-xl border border-teal-900/10 bg-slate-900">
            <pre className="overflow-x-auto px-4 py-2.5 text-[13px] leading-relaxed text-teal-50">
              <code>{ex.expression}</code>
            </pre>
            <div className="border-t border-white/10 bg-slate-950/60 px-4 py-2 text-[12px] leading-relaxed text-slate-300">
              <span className="text-slate-500">→ </span>
              <code className="text-emerald-300">{ex.result}</code>
              {ex.note ? <span className="mt-0.5 block text-slate-500">{ex.note}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

type DocSearchHit = {
  id: string
  kind: 'section' | 'topic' | 'function'
  title: string
  sectionTitle: string
  snippet: string
  score: number
}

function normalizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

function scoreText(haystack: string, tokens: string[]): number {
  if (!tokens.length) return 0
  const h = haystack.toLowerCase()
  let score = 0
  for (const t of tokens) {
    if (!h.includes(t)) return 0
    score += 1
    if (h.startsWith(t)) score += 2
    if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(h)) score += 1
  }
  return score
}

function snippetAround(text: string, tokens: string[], max = 140): string {
  const lower = text.toLowerCase()
  let idx = -1
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i >= 0 && (idx < 0 || i < idx)) idx = i
  }
  if (idx < 0) {
    const trimmed = text.trim()
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
  }
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, start + max)
  const slice = text.slice(start, end).trim()
  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`
}

function buildDocSearchIndex(sections: DocSection[]): DocSearchHit[] {
  const hits: DocSearchHit[] = []
  for (const section of sections) {
    hits.push({
      id: section.id,
      kind: 'section',
      title: section.title,
      sectionTitle: section.title,
      snippet: section.summary,
      score: 0,
    })
    for (const block of section.body) {
      const parts = [
        block.heading,
        ...(block.paragraphs ?? []),
        ...(block.bullets ?? []),
        block.code,
      ].filter((p): p is string => !!p && p.trim().length > 0)
      if (!parts.length) continue
      const blob = parts.join(' ')
      hits.push({
        id: section.id,
        kind: 'topic',
        title: block.heading || section.title,
        sectionTitle: section.title,
        snippet: parts[0]!,
        score: 0,
      })
      // Keep blob only for scoring via re-join in search — store in snippet field oversized is ok for scoring source
      hits[hits.length - 1]!.snippet = blob
    }
    for (const fn of section.functions ?? []) {
      const exampleBlob = fn.examples.map((e) => `${e.expression} ${e.result} ${e.note ?? ''}`).join(' ')
      hits.push({
        id: `fn-${fn.name.toLowerCase()}`,
        kind: 'function',
        title: fn.name,
        sectionTitle: section.title,
        snippet: `${fn.signature}. ${fn.description} ${(fn.aliases ?? []).join(' ')} ${exampleBlob}`,
        score: 0,
      })
    }
  }
  return hits
}

const DOC_SEARCH_INDEX = buildDocSearchIndex(DOC_SECTIONS)

function searchDocs(query: string): DocSearchHit[] {
  const tokens = normalizeQuery(query)
  if (!tokens.length) return []

  const scored: DocSearchHit[] = []
  for (const hit of DOC_SEARCH_INDEX) {
    const titleScore = scoreText(hit.title, tokens) * 5
    const sectionScore = scoreText(hit.sectionTitle, tokens) * 2
    const bodyScore = scoreText(hit.snippet, tokens)
    const total = titleScore + sectionScore + bodyScore
    if (total <= 0) continue
    scored.push({
      ...hit,
      score: total + (hit.kind === 'section' ? 1 : 0),
      snippet: snippetAround(hit.snippet, tokens),
    })
  }

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

  // Dedupe same anchor preferring higher score / more specific kind
  const seen = new Set<string>()
  const out: DocSearchHit[] = []
  for (const hit of scored) {
    const key = `${hit.kind}:${hit.id}:${hit.title}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hit)
    if (out.length >= 24) break
  }
  return out
}

const KIND_LABEL: Record<DocSearchHit['kind'], string> = {
  section: 'Section',
  topic: 'Topic',
  function: 'Function',
}

export function DocsPage() {
  const location = useLocation()
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchDocs(query), [query])
  const searching = normalizeQuery(query).length > 0

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace(/^#/, '')
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const input = document.getElementById('docs-search') as HTMLInputElement | null
        input?.focus()
        input?.select()
      }
      if (e.key === 'Escape') {
        const input = document.getElementById('docs-search') as HTMLInputElement | null
        if (document.activeElement === input) {
          setQuery('')
          input?.blur()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ff-page-enter">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700/80">Documentation</p>
        <h1 className="mt-2 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
          How FlowForge works
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          A practical guide to the whole product: organisations and Admin, flows and designer, live Inbox, Conversations,
          Analytics, Connections, Integrations, Marketplace, compliance, security, and ops.
          Prefer short answers? See the{' '}
          <Link className="font-medium text-teal-800 underline decoration-teal-700/30 underline-offset-4" to="/faq">
            FAQ
          </Link>{' '}
          or{' '}
          <Link className="font-medium text-teal-800 underline decoration-teal-700/30 underline-offset-4" to="/help">
            Help
          </Link>
          .
        </p>
      </header>

      <section
        id="search"
        className="mt-8 scroll-mt-24 rounded-2xl border border-[var(--color-border)]/80 bg-white/70 p-4 shadow-sm sm:p-5"
        aria-label="Search documentation"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Search</h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
              Find sections, topics, and expression functions across this guide.
            </p>
          </div>
          <p className="hidden text-[11px] text-[var(--color-ink-muted)] sm:block">
            <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl
            </kbd>
            {' + '}
            <kbd className="rounded border border-[var(--color-border)] bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
              K
            </kbd>
          </p>
        </div>
        <div className="mt-3">
          <SearchField
            id="docs-search"
            value={query}
            onChange={setQuery}
            placeholder="Search docs — e.g. embed, handoff, SSO…"
            className="w-full"
          />
        </div>

        {searching ? (
          <div id="docs-search-results" className="mt-4" role="listbox" aria-label="Search results">
            {results.length ? (
              <ul className="divide-y divide-[var(--color-border)]/70 overflow-hidden rounded-xl border border-[var(--color-border)]/70 bg-white">
                {results.map((hit) => (
                  <li key={`${hit.kind}-${hit.id}-${hit.title}`}>
                    <a href={`#${hit.id}`} className="block px-3.5 py-3 transition hover:bg-teal-50/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {KIND_LABEL[hit.kind]}
                        </span>
                        {hit.kind !== 'section' ? (
                          <span className="text-[11px] text-[var(--color-ink-muted)]">{hit.sectionTitle}</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {hit.kind === 'function' ? (
                          <code className="font-mono text-[13px] text-teal-900">{hit.title}</code>
                        ) : (
                          hit.title
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[var(--color-ink-muted)]">
                        {hit.snippet}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-slate-50/80 px-4 py-6 text-center text-sm text-[var(--color-ink-muted)]">
                No matches for “{query.trim()}”. Try another keyword, or browse the outline.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">On this page</p>
          <nav className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
            <a
              href="#search"
              className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-ink-muted)] transition hover:bg-white/80 hover:text-teal-900"
            >
              Search
            </a>
            {DOC_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-ink-muted)] transition hover:bg-white/80 hover:text-teal-900"
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
                    className="rounded-md px-2 py-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:bg-white/80 hover:text-teal-900"
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
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{section.title}</h2>
              <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{section.summary}</p>
              <div className="mt-5 space-y-5 border-t border-[var(--color-border)]/60 pt-5">
                {section.body.map((block, i) => (
                  <div key={i} className="space-y-2">
                    {block.heading ? (
                      <h3 className="text-base font-semibold text-slate-800">{block.heading}</h3>
                    ) : null}
                    {block.paragraphs?.map((p) => (
                      <p key={p} className="text-[15px] leading-relaxed text-slate-700">
                        {p}
                      </p>
                    ))}
                    {block.bullets ? (
                      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
                        {block.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                    {block.code ? (
                      <pre className="overflow-x-auto rounded-xl border border-teal-900/10 bg-slate-900 px-4 py-3 text-[13px] leading-relaxed text-teal-50">
                        <code>{block.code}</code>
                      </pre>
                    ) : null}
                    {block.image ? (
                      <figure className="overflow-hidden rounded-xl border border-[var(--color-border)]/80 bg-white shadow-sm">
                        <img
                          src={`${import.meta.env.BASE_URL}${block.image.src.replace(/^\//, '')}`}
                          alt={block.image.alt}
                          className="block w-full object-cover object-top"
                          loading="lazy"
                        />
                        {block.image.caption ? (
                          <figcaption className="border-t border-[var(--color-border)]/60 px-3 py-2 text-xs text-[var(--color-ink-muted)]">
                            {block.image.caption}
                          </figcaption>
                        ) : null}
                      </figure>
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
                        className="rounded-full border border-teal-200/80 bg-teal-50/60 px-2.5 py-1 font-mono text-[11px] text-teal-900"
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
            <Link to="/help" className="inline-flex items-center gap-1.5 font-medium text-teal-800 hover:underline">
              Guided help <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/faq" className="inline-flex items-center gap-1.5 font-medium text-teal-800 hover:underline">
              Common questions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
