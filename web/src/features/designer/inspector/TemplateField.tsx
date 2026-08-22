import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type TemplateSuggestion = {
  insert: string
  label: string
  group: string
  detail?: string
}

type CommonProps = {
  value: string
  onChange: (value: string) => void
  suggestions?: TemplateSuggestion[]
  placeholder?: string
  disabled?: boolean
  className?: string
  multiline?: boolean
  rows?: number
}

type TextSeg = { id: string; kind: 'text'; text: string }
type ChipSeg = { id: string; kind: 'chip'; raw: string }
type Segment = TextSeg | ChipSeg

const REF_RE = /\{\{[\s\S]*?\}\}/g

let segSeq = 0
function nextId(prefix: string) {
  segSeq += 1
  return `${prefix}-${segSeq}`
}

function chipLabel(raw: string): string {
  return raw.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '') || raw
}

function parseSegments(value: string): Segment[] {
  const segs: Segment[] = []
  REF_RE.lastIndex = 0
  let last = 0
  let match: RegExpExecArray | null
  while ((match = REF_RE.exec(value)) !== null) {
    segs.push({ id: nextId('t'), kind: 'text', text: value.slice(last, match.index) })
    segs.push({ id: nextId('c'), kind: 'chip', raw: match[0] })
    last = match.index + match[0].length
  }
  segs.push({ id: nextId('t'), kind: 'text', text: value.slice(last) })
  return segs
}

function serializeSegments(segments: Segment[]): string {
  return segments.map((s) => (s.kind === 'chip' ? s.raw : s.text)).join('')
}

function mergeAdjacentText(segments: Segment[]): Segment[] {
  const merged: Segment[] = []
  for (const s of segments) {
    const prev = merged[merged.length - 1]
    if (s.kind === 'text' && prev?.kind === 'text') {
      merged[merged.length - 1] = { ...prev, text: prev.text + s.text }
    } else {
      merged.push(s)
    }
  }
  if (!merged.some((s) => s.kind === 'text')) {
    merged.push({ id: nextId('t'), kind: 'text', text: '' })
  }
  return merged
}

function filterSuggestions(all: TemplateSuggestion[], query: string): TemplateSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return all.slice(0, 40)
  return all
    .filter(
      (s) =>
        s.insert.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q) ||
        (s.detail ?? '').toLowerCase().includes(q),
    )
    .slice(0, 40)
}

export function TemplateField({
  value,
  onChange,
  suggestions = [],
  placeholder,
  disabled,
  className,
  multiline,
  rows = 4,
}: CommonProps) {
  const listId = useId()
  const [segments, setSegments] = useState<Segment[]>(() => parseSegments(value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [editSegId, setEditSegId] = useState<string | null>(null)
  const [tokenStart, setTokenStart] = useState<number | null>(null)
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map())
  const skipSync = useRef(false)

  const filtered = useMemo(() => filterSuggestions(suggestions, query), [suggestions, query])
  const serialized = serializeSegments(segments)

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false
      return
    }
    if (serialized === value) return
    setSegments(parseSegments(value))
    setOpen(false)
    setTokenStart(null)
    setEditSegId(null)
  }, [value, serialized])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  function commit(next: Segment[], focus?: { segId: string; caret: number }) {
    const cleaned = mergeAdjacentText(next)
    skipSync.current = true
    setSegments(cleaned)
    onChange(serializeSegments(cleaned))
    if (!focus) return
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(focus.segId)
      if (!el) {
        // id may have been merged — focus first text
        const first = cleaned.find((s) => s.kind === 'text')
        if (!first) return
        const fallback = inputRefs.current.get(first.id)
        fallback?.focus()
        return
      }
      el.focus()
      const pos = Math.min(focus.caret, el.value.length)
      el.setSelectionRange(pos, pos)
    })
  }

  function analyzeCaret(segId: string, text: string, caret: number) {
    const before = text.slice(0, caret)
    const start = before.lastIndexOf('{{')
    if (start < 0) {
      setOpen(false)
      setTokenStart(null)
      setEditSegId(null)
      setQuery('')
      return
    }
    const afterOpen = before.slice(start + 2)
    if (afterOpen.includes('}}')) {
      setOpen(false)
      setTokenStart(null)
      setEditSegId(null)
      setQuery('')
      return
    }
    setEditSegId(segId)
    setTokenStart(start)
    setQuery(afterOpen.trim())
    setOpen(true)
  }

  function updateText(segId: string, text: string, caret: number) {
    // Promote any complete {{...}} typed/pasted into chips
    if (/\{\{[\s\S]*?\}\}/.test(text)) {
      const idx = segments.findIndex((s) => s.id === segId)
      if (idx < 0) return
      const parts = parseSegments(text)
      const next = [...segments.slice(0, idx), ...parts, ...segments.slice(idx + 1)]
      const lastText = [...parts].reverse().find((p) => p.kind === 'text')
      commit(next, lastText ? { segId: lastText.id, caret: lastText.text.length } : undefined)
      setOpen(false)
      setTokenStart(null)
      setEditSegId(null)
      return
    }

    const next = segments.map((s) => (s.id === segId && s.kind === 'text' ? { ...s, text } : s))
    skipSync.current = true
    setSegments(next)
    onChange(serializeSegments(next))
    analyzeCaret(segId, text, caret)
  }

  function removeChip(chipId: string) {
    const idx = segments.findIndex((s) => s.id === chipId)
    if (idx < 0) return
    const next = segments.filter((s) => s.id !== chipId)
    const neighbor =
      (next[idx - 1]?.kind === 'text' ? next[idx - 1] : null) ??
      (next[idx]?.kind === 'text' ? next[idx] : null) ??
      next.find((s) => s.kind === 'text')
    commit(
      next,
      neighbor && neighbor.kind === 'text'
        ? { segId: neighbor.id, caret: neighbor.text.length }
        : undefined,
    )
  }

  function insertChipAt(segId: string, start: number, end: number, raw: string) {
    const idx = segments.findIndex((s) => s.id === segId)
    if (idx < 0) return
    const seg = segments[idx]
    if (!seg || seg.kind !== 'text') return

    const beforeSeg: TextSeg = { id: seg.id, kind: 'text', text: seg.text.slice(0, start) }
    const chipSeg: ChipSeg = { id: nextId('c'), kind: 'chip', raw }
    const afterSeg: TextSeg = { id: nextId('t'), kind: 'text', text: seg.text.slice(end) }
    const next = [...segments.slice(0, idx), beforeSeg, chipSeg, afterSeg, ...segments.slice(idx + 1)]
    commit(next, { segId: afterSeg.id, caret: 0 })
  }

  function insertSuggestion(s: TemplateSuggestion) {
    if (editSegId && tokenStart != null) {
      const el = inputRefs.current.get(editSegId)
      const caret = el?.selectionStart ?? tokenStart
      insertChipAt(editSegId, tokenStart, caret, s.insert)
    } else {
      const textSeg = segments.find((x) => x.kind === 'text')
      if (textSeg && textSeg.kind === 'text') {
        const el = inputRefs.current.get(textSeg.id)
        const caret = el?.selectionStart ?? textSeg.text.length
        insertChipAt(textSeg.id, caret, caret, s.insert)
      } else {
        const afterId = nextId('t')
        commit(
          [
            { id: nextId('t'), kind: 'text', text: '' },
            { id: nextId('c'), kind: 'chip', raw: s.insert },
            { id: afterId, kind: 'text', text: '' },
          ],
          { segId: afterId, caret: 0 },
        )
      }
    }
    setOpen(false)
    setTokenStart(null)
    setEditSegId(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!open || !filtered.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertSuggestion(filtered[active]!)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showPlaceholder = !serialized && !!placeholder

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-2 py-1.5 shadow-sm transition-all duration-200 hover:border-[var(--color-accent)]/35 focus-within:border-[var(--color-accent)] focus-within:ring-4 focus-within:ring-[var(--color-accent)]/15',
          multiline ? 'min-h-24' : 'min-h-10',
          disabled && 'pointer-events-none opacity-60',
        )}
        style={multiline ? { minHeight: `${rows * 1.5 + 1}rem` } : undefined}
        onClick={() => {
          const lastText = [...segments].reverse().find((s) => s.kind === 'text')
          if (lastText) inputRefs.current.get(lastText.id)?.focus()
        }}
      >
        {showPlaceholder ? (
          <span className="pointer-events-none absolute left-3 top-2.5 z-0 text-sm text-[var(--color-ink-muted)]">
            {placeholder}
          </span>
        ) : null}

        <div
          className={cn(
            'relative z-[1] flex w-full items-center gap-1',
            multiline ? 'flex-wrap content-start' : 'flex-nowrap overflow-x-auto',
          )}
        >
          {segments.map((seg) => {
            if (seg.kind === 'chip') {
              return (
                <span
                  key={seg.id}
                  contentEditable={false}
                  className="inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-lg bg-[var(--color-accent)]/$1 py-0.5 pl-2 pr-0.5 text-xs font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate font-mono" title={seg.raw}>
                    {chipLabel(seg.raw)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${seg.raw}`}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--color-accent)]/80 transition hover:bg-[var(--color-accent)]/20 hover:text-[var(--color-accent)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeChip(seg.id)
                    }}
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </span>
              )
            }

            const widthCh = Math.max(1, Math.min(64, seg.text.length + (multiline ? 2 : 1)))

            if (multiline) {
              return (
                <textarea
                  key={seg.id}
                  ref={(el) => {
                    if (el) inputRefs.current.set(seg.id, el)
                    else inputRefs.current.delete(seg.id)
                  }}
                  disabled={disabled}
                  value={seg.text}
                  rows={1}
                  spellCheck={false}
                  aria-autocomplete="list"
                  aria-controls={listId}
                  className="min-h-[1.5rem] min-w-[1ch] grow resize-none bg-transparent py-0.5 text-sm text-[var(--color-ink)] caret-[var(--color-ink)] focus-visible:outline-none"
                  style={{ width: `${widthCh}ch` }}
                  onChange={(e) => {
                    const el = e.currentTarget
                    updateText(seg.id, el.value, el.selectionStart ?? el.value.length)
                  }}
                  onKeyUp={(e) =>
                    analyzeCaret(seg.id, e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
                  }
                  onClick={(e) => {
                    e.stopPropagation()
                    analyzeCaret(seg.id, e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
                  }}
                  onKeyDown={onKeyDown}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
              )
            }

            return (
              <input
                key={seg.id}
                ref={(el) => {
                  if (el) inputRefs.current.set(seg.id, el)
                  else inputRefs.current.delete(seg.id)
                }}
                disabled={disabled}
                value={seg.text}
                spellCheck={false}
                aria-autocomplete="list"
                aria-controls={listId}
                className="h-7 min-w-[1ch] bg-transparent text-sm text-[var(--color-ink)] caret-[var(--color-ink)] focus-visible:outline-none"
                style={{ width: `${widthCh}ch`, flexGrow: seg.text.length > 16 ? 1 : 0 }}
                onChange={(e) => {
                  const el = e.currentTarget
                  updateText(seg.id, el.value, el.selectionStart ?? el.value.length)
                }}
                onKeyUp={(e) =>
                  analyzeCaret(seg.id, e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
                }
                onClick={(e) => {
                  e.stopPropagation()
                  analyzeCaret(seg.id, e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
                }}
                onKeyDown={onKeyDown}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              />
            )
          })}
        </div>
      </div>

      {open && filtered.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-surface)]/95 p-1 shadow-lg backdrop-blur"
        >
          {filtered.map((s, idx) => (
            <li key={`${s.insert}-${idx}`}>
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                className={cn(
                  'flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left text-xs',
                  idx === active ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'hover:bg-[var(--color-surface-2)]',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertSuggestion(s)
                }}
              >
                <span className="font-semibold">{s.label}</span>
                <span className="font-mono text-[11px] text-[var(--color-accent)]">{s.insert}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                  {s.group}
                  {s.detail ? ` · ${s.detail}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-[11px] leading-snug text-[var(--color-ink-muted)]">
        Type <code className="rounded bg-[var(--color-surface-2)] px-1">{'{{'}</code> for vars, steps, and functions.
        Expressions work inline — e.g.{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">parseJson({`{{vars.jsonStr}}`})</code>,{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">{`{{vars.count + 1}}`}</code>,{' '}
        <code className="rounded bg-[var(--color-surface-2)] px-1">{`{{if(empty(vars.x), 'n/a', vars.x)}}`}</code>.
        Chips are read-only — use × to remove.
      </p>
    </div>
  )
}
