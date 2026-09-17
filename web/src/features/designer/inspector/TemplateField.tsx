import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
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
  /** Hide the long expression help under the field (useful in dense panels). */
  hideHint?: boolean
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

/** Accept full `{{ΓÇª}}`, bare path, or mixed text; empty ΓåÆ remove. */
function normalizeChipDraft(draft: string): string {
  const t = draft.trim()
  if (!t) return ''
  if (/\{\{[\s\S]*?\}\}/.test(t) || t.includes('{{')) return t
  return `{{${t}}}`
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

let measureEl: HTMLSpanElement | null = null

/** Exact glyph width for the control's font (avoids ch-unit gaps and scrollWidth undershoot). */
function measureTextWidth(el: HTMLElement, text: string): number {
  if (!measureEl) {
    measureEl = document.createElement('span')
    measureEl.setAttribute('aria-hidden', 'true')
    Object.assign(measureEl.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      height: 'auto',
      width: 'auto',
      top: '0',
      left: '-9999px',
      pointerEvents: 'none',
    })
    document.body.appendChild(measureEl)
  }
  const cs = getComputedStyle(el)
  measureEl.style.font = cs.font
  measureEl.style.fontSize = cs.fontSize
  measureEl.style.fontFamily = cs.fontFamily
  measureEl.style.fontWeight = cs.fontWeight
  measureEl.style.fontStyle = cs.fontStyle
  measureEl.style.letterSpacing = cs.letterSpacing
  measureEl.style.textTransform = cs.textTransform
  measureEl.textContent = text.length ? text : ''
  // +1px keeps the caret from clipping without a visible sparse gap.
  return Math.ceil(measureEl.getBoundingClientRect().width) + (text.length ? 1 : 0)
}

function fitTextControl(
  el: HTMLInputElement | HTMLTextAreaElement,
  opts: { text: string; caretSlot: boolean; maxWidth?: number },
) {
  if (opts.caretSlot) {
    el.style.width = '0px'
    el.style.minWidth = '0px'
    el.style.maxWidth = '0px'
    el.style.height = '20px'
    return
  }
  const empty = opts.text.length === 0
  el.style.minWidth = empty ? '8px' : '0px'
  const measured = Math.max(empty ? 8 : 1, measureTextWidth(el, opts.text))
  const hardCap =
    opts.maxWidth != null && opts.maxWidth > 0 ? Math.floor(opts.maxWidth) : undefined
  const width = hardCap != null ? Math.min(measured, hardCap) : measured
  el.style.width = `${width}px`
  el.style.maxWidth = hardCap != null ? `${hardCap}px` : ''
  el.style.whiteSpace = 'pre'
  el.style.height = '20px'
}

function lineRefKey(segId: string, lineIdx: number) {
  return `${segId}#${lineIdx}`
}

function segCaretFromLine(lines: string[], lineIdx: number, lineCaret: number): number {
  let offset = 0
  for (let i = 0; i < lineIdx; i++) offset += (lines[i]?.length ?? 0) + 1
  return offset + lineCaret
}

function lineFromSegCaret(lines: string[], caret: number): { lineIdx: number; lineCaret: number } {
  let remaining = Math.max(0, caret)
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i]!.length
    if (remaining <= len || i === lines.length - 1) {
      return { lineIdx: i, lineCaret: Math.min(remaining, len) }
    }
    remaining -= len + 1
  }
  return { lineIdx: 0, lineCaret: 0 }
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
  hideHint = false,
}: CommonProps) {
  const listId = useId()
  const [segments, setSegments] = useState<Segment[]>(() => parseSegments(value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')
  const [editSegId, setEditSegId] = useState<string | null>(null)
  const [tokenStart, setTokenStart] = useState<number | null>(null)
  const [editingChipId, setEditingChipId] = useState<string | null>(null)
  const [editingChipDraft, setEditingChipDraft] = useState('')
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const chipEditRef = useRef<HTMLInputElement | null>(null)
  const editingChipDraftRef = useRef('')
  const editingChipIdRef = useRef<string | null>(null)
  const skipSync = useRef(false)
  const chipEditPending = useRef(false)

  const filtered = useMemo(() => filterSuggestions(suggestions, query), [suggestions, query])
  const serialized = serializeSegments(segments)

  const shellRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  function contentMaxWidth() {
    return rowRef.current?.clientWidth ?? shellRef.current?.clientWidth
  }

  useLayoutEffect(() => {
    const lastTextId = [...segments].reverse().find((s) => s.kind === 'text')?.id
    const maxWidth = contentMaxWidth()
    for (const seg of segments) {
      if (seg.kind !== 'text') continue
      const lines = seg.text.split('\n')
      const isLastText = seg.id === lastTextId
      lines.forEach((line, lineIdx) => {
        const el = inputRefs.current.get(lineRefKey(seg.id, lineIdx))
        if (!el) return
        const empty = line.length === 0
        // Only the final empty caret slot between chips collapses; blank lines stay clickable.
        const caretSlot = empty && !isLastText && lines.length === 1
        fitTextControl(el, { text: line, caretSlot, maxWidth })
      })
    }
    if (editingChipId && chipEditRef.current) {
      fitTextControl(chipEditRef.current, {
        text: editingChipDraft,
        caretSlot: false,
        maxWidth,
      })
    }
  }, [segments, multiline, editingChipId, editingChipDraft])

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
    setEditingChipId(null)
    editingChipIdRef.current = null
    editingChipDraftRef.current = ''
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
      const target = cleaned.find((s) => s.id === focus.segId && s.kind === 'text')
      const textSeg =
        target?.kind === 'text'
          ? target
          : cleaned.find((s) => s.kind === 'text')
      if (!textSeg || textSeg.kind !== 'text') return
      const lines = textSeg.text.split('\n')
      const caret = textSeg.id === focus.segId ? focus.caret : textSeg.text.length
      const { lineIdx, lineCaret } = lineFromSegCaret(lines, caret)
      const el = inputRefs.current.get(lineRefKey(textSeg.id, lineIdx))
      if (!el) return
      el.focus()
      const pos = Math.min(lineCaret, el.value.length)
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

  function analyzeChipDraft(text: string, caret: number) {
    const before = text.slice(0, caret)
    const start = before.lastIndexOf('{{')
    const inner =
      start >= 0 ? before.slice(start + 2).replace(/\}\}[\s\S]*$/, '') : chipLabel(text)
    setQuery(inner.trim())
    setOpen(true)
    setEditSegId(null)
    setTokenStart(null)
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

    const prev = segments.find((s) => s.id === segId)
    const lineCountChanged =
      prev?.kind === 'text' && prev.text.split('\n').length !== text.split('\n').length
    const next = segments.map((s) => (s.id === segId && s.kind === 'text' ? { ...s, text } : s))
    if (lineCountChanged) {
      commit(next, { segId, caret })
      return
    }
    skipSync.current = true
    setSegments(next)
    onChange(serializeSegments(next))
    analyzeCaret(segId, text, caret)
  }

  function removeChip(chipId: string) {
    if (editingChipIdRef.current === chipId) {
      editingChipIdRef.current = null
      editingChipDraftRef.current = ''
      setEditingChipId(null)
      setOpen(false)
    }
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

  function startEditChip(chipId: string, raw: string) {
    if (disabled) return
    chipEditPending.current = true
    editingChipIdRef.current = chipId
    editingChipDraftRef.current = raw
    setEditingChipId(chipId)
    setEditingChipDraft(raw)
    setEditSegId(null)
    setTokenStart(null)
    analyzeChipDraft(raw, raw.length)
    requestAnimationFrame(() => {
      chipEditPending.current = false
      const el = chipEditRef.current
      if (!el) return
      el.focus()
      // Select inner path so typing replaces the reference quickly; braces stay editable.
      const inner = chipLabel(raw)
      const start = raw.indexOf(inner)
      if (start >= 0 && inner.length) {
        el.setSelectionRange(start, start + inner.length)
      } else {
        el.select()
      }
      fitTextControl(el, { text: raw, caretSlot: false, maxWidth: contentMaxWidth() })
    })
  }

  function cancelChipEdit() {
    editingChipIdRef.current = null
    editingChipDraftRef.current = ''
    setEditingChipId(null)
    setEditingChipDraft('')
    setOpen(false)
    setQuery('')
  }

  function commitChipEdit(draft?: string) {
    const chipId = editingChipIdRef.current
    if (!chipId) return
    const idx = segments.findIndex((s) => s.id === chipId)
    const text = draft ?? editingChipDraftRef.current
    editingChipIdRef.current = null
    editingChipDraftRef.current = ''
    setEditingChipId(null)
    setEditingChipDraft('')
    setOpen(false)
    setQuery('')
    if (idx < 0) return

    const normalized = normalizeChipDraft(text)
    if (!normalized) {
      removeChip(chipId)
      return
    }

    const parts = parseSegments(normalized)
    // Single clean reference ΓåÆ keep one chip (preserve id when possible)
    if (
      parts.length === 3 &&
      parts[0]?.kind === 'text' &&
      parts[0].text === '' &&
      parts[1]?.kind === 'chip' &&
      parts[2]?.kind === 'text' &&
      parts[2].text === ''
    ) {
      const raw = parts[1].raw
      const next = segments.map((s) => (s.id === chipId ? { ...s, kind: 'chip' as const, raw } : s))
      const after = next[idx + 1]?.kind === 'text' ? next[idx + 1] : null
      commit(next, after && after.kind === 'text' ? { segId: after.id, caret: 0 } : undefined)
      return
    }

    const next = [...segments.slice(0, idx), ...parts, ...segments.slice(idx + 1)]
    const lastText = [...parts].reverse().find((p) => p.kind === 'text')
    commit(next, lastText ? { segId: lastText.id, caret: lastText.text.length } : undefined)
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

  function currentSegCaret(segId: string): number | null {
    const seg = segments.find((s) => s.id === segId)
    if (!seg || seg.kind !== 'text') return null
    const lines = seg.text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const el = inputRefs.current.get(lineRefKey(segId, i))
      if (el && document.activeElement === el) {
        return segCaretFromLine(lines, i, el.selectionStart ?? 0)
      }
    }
    return null
  }

  function insertSuggestion(s: TemplateSuggestion) {
    if (editingChipId) {
      chipEditPending.current = true
      setEditingChipDraft(s.insert)
      requestAnimationFrame(() => {
        commitChipEdit(s.insert)
        chipEditPending.current = false
      })
      return
    }
    if (editSegId && tokenStart != null) {
      const caret = currentSegCaret(editSegId) ?? tokenStart
      insertChipAt(editSegId, tokenStart, Math.max(caret, tokenStart), s.insert)
    } else {
      const textSeg =
        [...segments].reverse().find((x) => x.kind === 'text') ??
        segments.find((x) => x.kind === 'text')
      if (textSeg && textSeg.kind === 'text') {
        const caret = currentSegCaret(textSeg.id) ?? textSeg.text.length
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

  function onKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    segId: string,
    lineIdx: number,
    lines: string[],
  ) {
    if (open && filtered.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertSuggestion(filtered[active]!)
        return
      }
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
    }

    const el = e.currentTarget
    const lineCaret = el.selectionStart ?? 0
    const lineEnd = el.selectionEnd ?? lineCaret

            if (multiline && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const left = lines[lineIdx]!.slice(0, lineCaret)
      const right = lines[lineIdx]!.slice(lineEnd)
      const nextLines = [...lines.slice(0, lineIdx), left, right, ...lines.slice(lineIdx + 1)]
      updateText(segId, nextLines.join('\n'), segCaretFromLine(nextLines, lineIdx + 1, 0))
      return
    }

    if (e.key === 'Backspace' && lineCaret === 0 && lineEnd === 0 && lineIdx > 0) {
      e.preventDefault()
      const prevLen = lines[lineIdx - 1]!.length
      const merged = `${lines[lineIdx - 1]}${lines[lineIdx]}`
      const nextLines = [...lines.slice(0, lineIdx - 1), merged, ...lines.slice(lineIdx + 1)]
      updateText(segId, nextLines.join('\n'), segCaretFromLine(nextLines, lineIdx - 1, prevLen))
      return
    }

    if (e.key === 'Delete' && lineCaret === el.value.length && lineEnd === el.value.length && lineIdx < lines.length - 1) {
      e.preventDefault()
      const merged = `${lines[lineIdx]}${lines[lineIdx + 1]}`
      const nextLines = [...lines.slice(0, lineIdx), merged, ...lines.slice(lineIdx + 2)]
      updateText(segId, nextLines.join('\n'), segCaretFromLine(nextLines, lineIdx, lineCaret))
      return
    }

    if (e.key === 'ArrowLeft' && lineCaret === 0 && lineEnd === 0 && lineIdx > 0) {
      e.preventDefault()
      const prev = inputRefs.current.get(lineRefKey(segId, lineIdx - 1))
      if (!prev) return
      prev.focus()
      const pos = prev.value.length
      prev.setSelectionRange(pos, pos)
      return
    }

    if (e.key === 'ArrowRight' && lineCaret === el.value.length && lineEnd === el.value.length && lineIdx < lines.length - 1) {
      e.preventDefault()
      const next = inputRefs.current.get(lineRefKey(segId, lineIdx + 1))
      if (!next) return
      next.focus()
      next.setSelectionRange(0, 0)
    }
  }

  function onChipEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelChipEdit()
      return
    }
    if (open && filtered.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertSuggestion(filtered[active]!)
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commitChipEdit()
    }
  }

  const showPlaceholder = !serialized && !!placeholder && !editingChipId

  return (
    <div className={cn('relative min-w-0', className)}>
      <div
        ref={shellRef}
        className={cn(
          'relative min-w-0 overflow-x-hidden rounded-xl border border-[var(--color-border)] bg-white/90 px-2 py-1.5 shadow-sm transition-all duration-200 hover:border-[var(--color-accent)]/35 focus-within:border-[var(--color-accent)] focus-within:ring-4 focus-within:ring-teal-500/15',
          multiline ? 'min-h-24' : 'min-h-10',
          disabled && 'pointer-events-none opacity-60',
        )}
        style={multiline ? { minHeight: `${rows * 1.5 + 1}rem` } : undefined}
        onClick={() => {
          if (editingChipId) return
          const lastText = [...segments].reverse().find((s) => s.kind === 'text')
          if (!lastText || lastText.kind !== 'text') return
          const lines = lastText.text.split('\n')
          const el = inputRefs.current.get(lineRefKey(lastText.id, lines.length - 1))
          el?.focus()
        }}
      >
        {showPlaceholder ? (
          <span className="pointer-events-none absolute left-3 top-2.5 z-0 text-sm text-[var(--color-ink-muted)]">
            {placeholder}
          </span>
        ) : null}

        <div
          ref={rowRef}
          className={cn(
            // Flex + fixed line height keeps chips and text on one baseline.
            'relative z-[1] flex min-w-0 w-full flex-wrap items-center gap-y-0.5',
            !multiline && 'flex-nowrap overflow-x-auto',
          )}
        >
          {segments.map((seg, segIndex) => {
            if (seg.kind === 'chip') {
              if (editingChipId === seg.id) {
                return (
                  <input
                    key={seg.id}
                    ref={(el) => {
                      chipEditRef.current = el
                      if (el) {
                        fitTextControl(el, {
                          text: editingChipDraft,
                          caretSlot: false,
                          maxWidth: contentMaxWidth(),
                        })
                      }
                    }}
                    value={editingChipDraft}
                    spellCheck={false}
                    aria-autocomplete="list"
                    aria-controls={listId}
                    aria-label="Edit reference"
                    className="box-border h-5 max-w-full shrink-0 rounded-md border-0 bg-teal-500/15 px-1.5 font-mono text-xs font-semibold leading-5 text-teal-900 caret-teal-950 ring-1 ring-teal-600/40 focus-visible:outline-none"
                    style={{ width: 48, minWidth: 48 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const el = e.currentTarget
                      const next = el.value
                      editingChipDraftRef.current = next
                      setEditingChipDraft(next)
                      fitTextControl(el, {
                        text: next,
                        caretSlot: false,
                        maxWidth: contentMaxWidth(),
                      })
                      analyzeChipDraft(next, el.selectionStart ?? next.length)
                    }}
                    onKeyUp={(e) =>
                      analyzeChipDraft(
                        e.currentTarget.value,
                        e.currentTarget.selectionStart ?? e.currentTarget.value.length,
                      )
                    }
                    onKeyDown={onChipEditKeyDown}
                    onBlur={() => {
                      window.setTimeout(() => {
                        if (chipEditPending.current) return
                        if (editingChipIdRef.current === seg.id) commitChipEdit()
                      }, 120)
                    }}
                  />
                )
              }
              return (
                <span
                  key={seg.id}
                  contentEditable={false}
                  className="inline-flex h-5 max-w-full min-w-0 shrink-0 items-center gap-0 rounded-md bg-teal-500/15 py-0 pl-1.5 pr-0 text-xs font-semibold leading-5 text-teal-900 ring-1 ring-teal-500/25"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="min-w-0 truncate font-mono leading-5 hover:underline"
                    title={`${seg.raw} ΓÇö click to edit`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation()
                      startEditChip(seg.id, seg.raw)
                    }}
                  >
                    {chipLabel(seg.raw)}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${seg.raw}`}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-teal-800/80 transition hover:bg-teal-600/20 hover:text-teal-950"
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

            const isLastText = segments.findLastIndex((s) => s.kind === 'text') === segIndex
            const lines = seg.text.split('\n')
            const maxWidth = contentMaxWidth()

            return lines.map((line, lineIdx) => {
              const isOnlyLine = lines.length === 1
              const isCaretSlot = isOnlyLine && line.length === 0 && !isLastText
              const refKey = lineRefKey(seg.id, lineIdx)
              const textStyle: CSSProperties = isCaretSlot
                ? {
                    width: 0,
                    maxWidth: 0,
                    minWidth: 0,
                    padding: 0,
                    margin: 0,
                    border: 0,
                    overflow: 'hidden',
                    opacity: 0,
                    height: 20,
                  }
                : {
                    width: 0,
                    minWidth: line.length === 0 ? 8 : 0,
                    maxWidth: maxWidth != null && maxWidth > 0 ? `${Math.floor(maxWidth)}px` : undefined,
                    height: 20,
                    whiteSpace: 'pre',
                  }

              return (
                <span key={refKey} className="contents">
                  {lineIdx > 0 ? <span className="h-0 w-full basis-full" aria-hidden /> : null}
                  <input
                    ref={(el) => {
                      if (el) {
                        inputRefs.current.set(refKey, el)
                        fitTextControl(el, {
                          text: line,
                          caretSlot: isCaretSlot,
                          maxWidth,
                        })
                      } else {
                        inputRefs.current.delete(refKey)
                      }
                    }}
                    disabled={disabled}
                    value={line}
                    spellCheck={false}
                    tabIndex={isCaretSlot ? -1 : undefined}
                    aria-autocomplete="list"
                    aria-controls={listId}
                    className={cn(
                      'box-border h-5 shrink-0 border-0 bg-transparent p-0 text-sm leading-5 text-[var(--color-ink)] caret-[var(--color-ink)] focus-visible:outline-none',
                      isCaretSlot && 'm-0',
                    )}
                    style={textStyle}
                    onChange={(e) => {
                      const el = e.currentTarget
                      const nextLines = [...lines]
                      nextLines[lineIdx] = el.value
                      fitTextControl(el, {
                        text: el.value,
                        caretSlot: false,
                        maxWidth: contentMaxWidth(),
                      })
                      updateText(
                        seg.id,
                        nextLines.join('\n'),
                        segCaretFromLine(nextLines, lineIdx, el.selectionStart ?? el.value.length),
                      )
                    }}
                    onKeyUp={(e) => {
                      const nextLines = [...lines]
                      nextLines[lineIdx] = e.currentTarget.value
                      const caret = segCaretFromLine(
                        nextLines,
                        lineIdx,
                        e.currentTarget.selectionStart ?? 0,
                      )
                      analyzeCaret(seg.id, nextLines.join('\n'), caret)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const nextLines = [...lines]
                      nextLines[lineIdx] = e.currentTarget.value
                      const caret = segCaretFromLine(
                        nextLines,
                        lineIdx,
                        e.currentTarget.selectionStart ?? 0,
                      )
                      analyzeCaret(seg.id, nextLines.join('\n'), caret)
                    }}
                    onKeyDown={(e) => onKeyDown(e, seg.id, lineIdx, lines)}
                    onFocus={() => {
                      if (editingChipId) commitChipEdit()
                    }}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                  />
                </span>
              )
            })
          })}
          {/* Click target for the trailing empty area without stretching the last text segment. */}
          <span className="min-h-5 min-w-[2rem] flex-1 basis-8" aria-hidden />
        </div>
      </div>

      {open && filtered.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-teal-200/70 bg-white/95 p-1 shadow-lg backdrop-blur"
        >
          {filtered.map((s, idx) => (
            <li key={`${s.insert}-${idx}`}>
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                className={cn(
                  'flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left text-xs',
                  idx === active ? 'bg-teal-50 text-teal-950' : 'hover:bg-slate-50',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  chipEditPending.current = true
                  insertSuggestion(s)
                }}
              >
                <span className="font-semibold">{s.label}</span>
                <span className="font-mono text-[11px] text-teal-700">{s.insert}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                  {s.group}
                  {s.detail ? ` ┬╖ ${s.detail}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!hideHint ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-ink-muted)]">
          Type <code className="rounded bg-slate-100 px-1">{'{{'}</code> for vars, steps, and functions.
          Expressions work inline ΓÇö e.g.{' '}
          <code className="rounded bg-slate-100 px-1">parseJson({`{{vars.jsonStr}}`})</code>,{' '}
          <code className="rounded bg-slate-100 px-1">{`{{vars.count + 1}}`}</code>,{' '}
          <code className="rounded bg-slate-100 px-1">{`{{if(empty(vars.x), 'n/a', vars.x)}}`}</code>.
          Click a chip to edit it, or use ├ù to remove. Use{' '}
          <code className="rounded bg-slate-100 px-1">{`{{embed("https://ΓÇª")}}`}</code> for YouTube, X,
          Vimeo, Spotify, or TikTok.
        </p>
      ) : null}
    </div>
  )
}
