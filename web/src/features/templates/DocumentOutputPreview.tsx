import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { fillDocumentSnapshot, type FilledDocument, type FilledDocumentBlock } from '@/features/templates/documentFill'
import { a4SizeMm, cssFontFamily } from '@/features/templates/documentLayout'
import { ensurePageBlocks } from '@/features/templates/DocumentPageEditor'
import {
  templateInputsOf,
  type DocumentContent,
  type DocumentOrientation,
  type TemplateInput,
  type TemplateKind,
  TEMPLATE_KIND_META,
} from '@/features/templates/templateModel'
import { cn } from '@/shared/lib/utils'

function sampleInputValue(input: TemplateInput): string {
  const label = input.label.trim() || input.key
  switch (input.type) {
    case 'number':
      return '42'
    case 'boolean':
      return 'Yes'
    case 'date':
      return '15 Sep 2026'
    case 'file':
      return `[${label || 'file'}]`
    default:
      if (/email/i.test(input.key) || /email/i.test(label)) return 'alex@example.com'
      if (/name/i.test(input.key) || /name/i.test(label)) return 'Alex Example'
      if (/phone/i.test(input.key)) return '+1 555 0100'
      return label ? `Sample ${label}` : 'Sample value'
  }
}

function previewEvaluators(content: DocumentContent) {
  const samples = Object.fromEntries(
    templateInputsOf(content).map((input) => [input.key, sampleInputValue(input)]),
  )

  const evalText = (source: string) =>
    String(source ?? '')
      .replace(/\{\{\s*inputs\.([A-Za-z0-9_]+)\s*\}\}/g, (_, key: string) => samples[key] ?? `«${key}»`)
      .replace(/\{\{[^}]+\}\}/g, '…')

  const evalValue = (source: string): unknown => {
    const m = /^\{\{\s*inputs\.([A-Za-z0-9_]+)\s*\}\}$/.exec(String(source ?? '').trim())
    if (m) {
      const key = m[1]!
      if (/signature|image|file/i.test(key)) return null
      return samples[key] ?? null
    }
    return evalText(source)
  }

  return { evalText, evalValue }
}

function PaperShell({
  orientation,
  compact,
  formatLabel,
  children,
}: {
  orientation: DocumentOrientation
  compact?: boolean
  formatLabel: string
  children: ReactNode
}) {
  const mm = a4SizeMm(orientation)
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'mx-auto w-full overflow-hidden rounded-sm border border-[var(--color-border)] bg-white text-slate-900 shadow-[0_12px_40px_-18px_rgb(15_23_42_/_0.45)]',
          compact ? 'max-w-[220px]' : 'max-w-md',
        )}
        style={{ aspectRatio: `${mm.width} / ${mm.height}` }}
      >
        <div className="h-full w-full overflow-hidden">{children}</div>
      </div>
      <p className="text-center text-[10px] text-[var(--color-ink-muted)]">
        Output preview · {formatLabel} · A4 {orientation}
      </p>
    </div>
  )
}

function FlowDocumentPreview({ doc, compact }: { doc: FilledDocument; compact?: boolean }) {
  const fields = doc.fields.slice(0, compact ? 4 : 12)
  return (
    <PaperShell orientation={doc.orientation} compact={compact} formatLabel={doc.format.toUpperCase()}>
      <div
        className={cn(
          'h-full overflow-hidden bg-white px-[8%] py-[7%] font-sans text-slate-800',
          compact ? 'text-[7px] leading-snug' : 'text-[10px] leading-relaxed',
        )}
      >
        <p className={cn('font-semibold text-slate-900', compact ? 'text-[9px]' : 'text-[13px]')}>
          {doc.title.trim() || doc.filename || 'Document'}
        </p>
        {doc.intro.trim() ? (
          <p className="mt-1 whitespace-pre-wrap text-slate-600">{doc.intro.trim()}</p>
        ) : null}
        {fields.length ? (
          <dl className="mt-2 space-y-1 border-t border-slate-200 pt-2">
            {fields.map((field, i) => (
              <div key={`${field.label}-${i}`} className="grid grid-cols-[0.9fr_1.1fr] gap-2">
                <dt className="font-medium text-slate-500">{field.label}</dt>
                <dd className="min-w-0">
                  {field.imageUrl ? (
                    <span className="inline-block h-6 w-16 rounded border border-dashed border-slate-300 bg-slate-50" />
                  ) : (
                    <span className="break-words text-slate-800">{field.text || '—'}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {doc.table?.headers.length ? (
          <div className="mt-2 overflow-hidden rounded border border-slate-200">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50">
                  {doc.table.headers.map((h) => (
                    <th key={h} className="border-b border-slate-200 px-1.5 py-1 font-semibold text-slate-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.table.rows.slice(0, compact ? 2 : 5).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border-b border-slate-100 px-1.5 py-1 text-slate-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {doc.body.trim() ? (
          <p className="mt-2 whitespace-pre-wrap text-slate-700">{doc.body.trim()}</p>
        ) : null}
        {doc.footer.trim() ? (
          <p className="mt-3 border-t border-slate-200 pt-2 text-slate-500">{doc.footer.trim()}</p>
        ) : null}
      </div>
    </PaperShell>
  )
}

function PageBlockPreview({ block, compact }: { block: FilledDocumentBlock; compact?: boolean }) {
  if (block.type === 'divider') {
    return (
      <span
        className="absolute inset-x-0 top-1/2 -translate-y-1/2"
        style={{
          height: `max(1px, ${Math.max(0.35, block.h)}%)`,
          backgroundColor: '#94a3b8',
        }}
      />
    )
  }
  if (block.type === 'image') {
    return (
      <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[8px] text-slate-400">
        {block.label || 'Signature'}
      </div>
    )
  }
  if (block.type === 'cart') {
    return (
      <div className="h-full overflow-hidden rounded bg-slate-50 px-1 py-0.5 text-[8px] text-slate-600">
        {block.label || 'Order'}
      </div>
    )
  }
  const text =
    block.type === 'field'
      ? `${block.label ? `${block.label}: ` : ''}${block.text || '…'}`
      : block.text || (block.type === 'heading' ? 'Heading' : 'Text')
  return (
    <div
      className={cn('h-full overflow-hidden px-0.5 py-0.5 leading-tight', compact ? 'text-[6px]' : 'text-[8px]')}
      style={{
        textAlign: block.align,
        fontSize: `${Math.max(compact ? 5 : 7, block.fontSize * (compact ? 0.35 : 0.5))}px`,
        fontWeight: block.bold || block.type === 'heading' ? 700 : 400,
        fontFamily: cssFontFamily(block.fontFamily),
        color: block.color || '#0f172a',
        background: block.fill || 'transparent',
      }}
    >
      {text}
    </div>
  )
}

function PageDocumentPreview({ doc, compact }: { doc: FilledDocument; compact?: boolean }) {
  const blocks = doc.blocks.filter((b) => !b.page || b.page <= 1)
  return (
    <PaperShell orientation={doc.orientation} compact={compact} formatLabel={doc.format.toUpperCase()}>
      <div className="relative h-full w-full bg-white" style={{ containerType: 'size' }}>
        {blocks.map((block) => (
          <div
            key={block.id}
            className="absolute"
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.w}%`,
              height: block.type === 'divider' ? 0 : `${block.h}%`,
            }}
          >
            <PageBlockPreview block={block} compact={compact} />
          </div>
        ))}
        {!blocks.length ? (
          <p className="absolute inset-0 grid place-items-center text-center text-[10px] text-slate-400">
            Empty page layout
          </p>
        ) : null}
      </div>
    </PaperShell>
  )
}

/**
 * Renders a paper-style preview of the filled document output (sample input values).
 */
export function DocumentOutputPreview({
  kind,
  content,
  compact = false,
}: {
  kind: TemplateKind
  content: DocumentContent
  compact?: boolean
}) {
  const filled = useMemo(() => {
    const withBlocks =
      content.layout === 'page'
        ? { ...content, blocks: ensurePageBlocks(content) }
        : content
    const { evalText, evalValue } = previewEvaluators(withBlocks)
    return fillDocumentSnapshot(withBlocks, evalText, evalValue, {})
  }, [content])

  return (
    <div className="space-y-2">
      {!compact ? (
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          {TEMPLATE_KIND_META[kind].label} with sample field values — matches the downloadable output layout.
        </p>
      ) : null}
      {filled.layout === 'page' ? (
        <PageDocumentPreview doc={filled} compact={compact} />
      ) : (
        <FlowDocumentPreview doc={filled} compact={compact} />
      )}
    </div>
  )
}
