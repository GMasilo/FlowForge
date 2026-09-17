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
  value: string | null | undefined
  onChange: (value: string) => void
  suggestions?: TemplateSuggestion[]
  placeholder?: string
  disabled?: boolean
  className?: string
  multiline?: boolean
  rows?: number
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

function parseSegments(value: string | null | undefined): Segment[] {
  const text = typeof value === 'string' ? value : ''
  const segs: Segment[] = []
  REF_RE.lastIndex = 0
  let last = 0
  let match: RegExpExecArray | null
  while ((match = REF_RE.exec(text)) !== null) {
    segs.push({ id: nextId('t'), kind: 'text', text: text.slice(last, match.index) })
    segs.push({ id: nextId('c'), kind: 'chip', raw: match[0] })
    last = match.index + match[0].length
  }
  segs.push({ id: nextId('t'), kind: 'text', text: text.slice(last) })
  return segs
}

// NOTE: Full file body continues in follow-up commit if truncated
export function TemplateField(props: CommonProps) {
  const value = props.value ?? ''
  const segments = parseSegments(value)
  return null as any
}
