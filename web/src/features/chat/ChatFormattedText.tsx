import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Lightweight, safe chat styling (no HTML). Supports:
 *   **bold**  *italic*  ~~strike~~  `code`  [label](https://…)
 *   {color:danger}text{/color}  {color:#0f766e}text{/color}
 * Escape with a backslash: \* \` \[ \\ \{
 * Newlines are preserved. Underscore marks are omitted so emails stay intact.
 */
const NAMED_COLORS: Record<string, string> = {
  accent: 'var(--color-accent)',
  highlight: 'var(--color-highlight)',
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  success: 'var(--color-success)',
  muted: 'var(--color-ink-muted)',
  ink: 'var(--color-ink)',
  teal: '#0f766e',
  cyan: '#0891b2',
  orange: '#f97316',
  red: '#e11d48',
  green: '#059669',
  blue: '#0369a1',
}

const TOKEN =
  /\\([\\*_`~[\]{])|(\{color:([a-z]+|#[0-9a-fA-F]{3,8})\}([\s\S]*?)\{\/color\}|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|~~[^~\n]+?~~|`[^`\n]+?`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g

function resolveColor(raw: string): string | null {
  const key = raw.trim().toLowerCase()
  if (NAMED_COLORS[key]) return NAMED_COLORS[key]!
  if (/^#[0-9a-f]{3}$/i.test(raw) || /^#[0-9a-f]{6}$/i.test(raw) || /^#[0-9a-f]{8}$/i.test(raw)) {
    return raw
  }
  return null
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0
    if (start > last) {
      nodes.push(text.slice(last, start))
    }
    const key = `${keyPrefix}-${i++}`
    const escaped = match[1]
    if (escaped !== undefined) {
      nodes.push(escaped)
      last = start + match[0]!.length
      continue
    }
    const token = match[2]!
    const colorName = match[3]
    const colorBody = match[4]
    if (colorName !== undefined && colorBody !== undefined) {
      const color = resolveColor(colorName)
      if (color) {
        const style: CSSProperties = { color }
        nodes.push(
          <span key={key} style={style}>
            {renderInline(colorBody, key)}
          </span>,
        )
      } else {
        // Unknown colour — show content unstyled, keep markers out of the bubble.
        nodes.push(...renderInline(colorBody, key))
      }
      last = start + match[0]!.length
      continue
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderInline(token.slice(2, -2), key)}
        </strong>,
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), key)}
        </em>,
      )
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(
        <span key={key} className="line-through opacity-80">
          {renderInline(token.slice(2, -2), key)}
        </span>,
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.9em] text-inherit"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
      if (link) {
        nodes.push(
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:opacity-80"
          >
            {link[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    }
    last = start + match[0]!.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function ChatFormattedText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  if (!text) return null
  // Colour spans may wrap newlines; parse the whole string, then restore line breaks.
  const parts = text.split('\n')
  return (
    <div className={cn('break-words', className)}>
      {parts.map((line, i) => (
        <p key={i} className={cn(i > 0 && 'mt-1', !line && 'min-h-[1em]')}>
          {line ? renderInline(line, `l${i}`) : '\u00a0'}
        </p>
      ))}
    </div>
  )
}

export const CHAT_NAMED_COLORS = Object.keys(NAMED_COLORS)
