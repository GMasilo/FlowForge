import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Grid3x3, Minus, Plus, Type } from 'lucide-react'
import type { TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { TemplateField } from '@/features/designer/inspector/TemplateField'
import {
  DIVIDER_MIN_MM,
  clampBlock,
  cssFontFamily,
  emptyDocumentBlock,
  flowToPageBlocks,
  mmToPct,
  pctToMm,
  snapBlockMove,
  snapBlockResize,
  type SnapGuide,
} from '@/features/templates/documentLayout'
import type {
  DocumentBlock,
  DocumentBlockType,
  DocumentContent,
  DocumentFont,
} from '@/features/templates/templateModel'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

const ADD_TYPES: Array<{ type: DocumentBlockType; label: string }> = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'field', label: 'Field' },
  { type: 'image', label: 'Signature' },
  { type: 'divider', label: 'Line' },
  { type: 'cart', label: 'Cart' },
]

const COLOR_PRESETS = ['#0f172a', '#334155', '#0f766e', '#1d4ed8', '#b45309', '#be123c', '#ffffff']

export function DocumentPageEditor({
  content,
  onChange,
  suggestions,
  readOnly,
}: {
  content: DocumentContent
  onChange: (next: DocumentContent) => void
  suggestions: TemplateSuggestion[]
  readOnly?: boolean
}) {
  const pageRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: string
    mode: 'move' | 'resize'
    startX: number
    startY: number
    orig: DocumentBlock
  } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(content.blocks[0]?.id ?? null)
  const [snapGrid, setSnapGrid] = useState(true)
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const selected = content.blocks.find((b) => b.id === selectedId) ?? null

  function patchBlocks(blocks: DocumentBlock[]) {
    onChange({ ...content, layout: 'page', blocks })
  }

  function patchBlock(id: string, patch: Partial<DocumentBlock>) {
    patchBlocks(content.blocks.map((b) => (b.id === id ? clampBlock({ ...b, ...patch }) : b)))
  }

  function addBlock(type: DocumentBlockType) {
    const y = content.blocks.reduce((max, b) => Math.max(max, b.y + b.h), 6) + 1.5
    const block = emptyDocumentBlock(type, Math.min(88, y))
    patchBlocks([...content.blocks, block])
    setSelectedId(block.id)
  }

  function pagePoint(e: ReactPointerEvent) {
    const rect = pageRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 1 || rect.height < 1) return { x: 0, y: 0 }
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function snapOpts(e: ReactPointerEvent) {
    const free = e.altKey
    return { grid: snapGrid && !free, guides: !free }
  }

  function onBlockPointerDown(e: ReactPointerEvent, block: DocumentBlock, mode: 'move' | 'resize') {
    if (readOnly) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setSelectedId(block.id)
    const p = pagePoint(e)
    drag.current = { id: block.id, mode, startX: p.x, startY: p.y, orig: block }
  }

  function onPagePointerMove(e: ReactPointerEvent) {
    const active = drag.current
    if (!active) return
    const p = pagePoint(e)
    const dx = p.x - active.startX
    const dy = p.y - active.startY
    const siblings = content.blocks.filter((b) => b.id !== active.id)
    const opts = snapOpts(e)
    if (active.mode === 'resize') {
      const next = snapBlockResize(active.orig, dx, dy, siblings, {
        ...opts,
        snapHeight: active.orig.type !== 'divider',
      })
      setGuides(next.guides)
      patchBlock(active.id, { w: next.w, h: next.h })
    } else {
      const next = snapBlockMove(active.orig, dx, dy, siblings, opts)
      setGuides(next.guides)
      patchBlock(active.id, { x: next.x, y: next.y })
    }
  }

  function endDrag() {
    drag.current = null
    setGuides([])
  }

  const showTextStyle =
    selected && selected.type !== 'divider' && selected.type !== 'image'

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {ADD_TYPES.map((item) => (
            <Button
              key={item.type}
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() => addBlock(item.type)}
            >
              <Plus className="h-3.5 w-3.5" />
              {item.label}
            </Button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={snapGrid}
              onChange={(e) => setSnapGrid(e.target.checked)}
            />
            <Grid3x3 className="h-3.5 w-3.5" />
            Snap to grid
          </label>
        </div>
        <div
          ref={pageRef}
          className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-sm bg-[var(--color-surface)] shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-[var(--color-border)]"
          style={{ aspectRatio: '210 / 297', containerType: 'size' }}
          onPointerMove={onPagePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={() => setSelectedId(null)}
        >
          {snapGrid ? (
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.035)_1px,transparent_1px)] bg-[size:2%_2%]" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.07)_1px,transparent_1px)] bg-[size:10%_10%]" />
          {guides.map((guide, i) =>
            guide.axis === 'v' ? (
              <div
                key={`v-${i}-${guide.pos}`}
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-[var(--color-accent)]"
                style={{ left: `${guide.pos}%` }}
              />
            ) : (
              <div
                key={`h-${i}-${guide.pos}`}
                className="pointer-events-none absolute right-0 left-0 z-10 h-px bg-[var(--color-accent)]"
                style={{ top: `${guide.pos}%` }}
              />
            ),
          )}
          {content.blocks.map((block) => {
            const active = block.id === selectedId
            const divider = block.type === 'divider'
            return (
              <div
                key={block.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onBlockPointerDown(e, block, 'move')}
                className={cn(
                  'absolute',
                  divider
                    ? cn(active ? 'z-[1]' : '', readOnly && 'cursor-default')
                    : cn(
                        'overflow-hidden rounded-[3px] border px-1 py-0.5 text-[10px] leading-tight',
                        active ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/40',
                        block.bold ? 'font-bold' : 'font-normal',
                        readOnly && 'cursor-default',
                      ),
                )}
                style={{
                  left: `${block.x}%`,
                  top: `${block.y}%`,
                  width: `${block.w}%`,
                  height: divider ? 0 : `${block.h}%`,
                  textAlign: block.align,
                  fontSize: divider ? undefined : `${Math.max(8, block.fontSize * 0.55)}px`,
                  fontWeight: block.bold ? 700 : 400,
                  fontFamily: divider ? undefined : cssFontFamily(block.fontFamily),
                  color: divider ? undefined : block.color || '#0f172a',
                  background: divider ? 'transparent' : block.fill || 'rgba(255,255,255,0.9)',
                }}
              >
                {divider ? (
                  <>
                    <span className="absolute inset-x-0 -top-2 -bottom-2" />
                    <span
                      className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
                      style={{
                        height: `max(0.35px, ${block.h}cqh)`,
                        backgroundColor: block.color || '#94a3b8',
                      }}
                    />
                  </>
                ) : (
                  blockPreview(block)
                )}
                {active && !readOnly ? (
                  <span
                    className={cn(
                      'absolute z-10 cursor-nwse-resize bg-[var(--color-accent)]',
                      divider ? 'right-0 top-1/2 h-2 w-2 -translate-y-1/2' : 'right-0 bottom-0 h-3 w-3',
                    )}
                    onPointerDown={(e) => onBlockPointerDown(e, block, 'resize')}
                  />
                ) : null}
              </div>
            )
          })}
          {!content.blocks.length ? (
            <p className="absolute inset-0 grid place-items-center text-center text-xs text-[var(--color-ink-muted)]">
              Add a heading, field, or signature, then drag it into place.
            </p>
          ) : null}
        </div>
        <p className="text-center text-[11px] text-[var(--color-ink-muted)]">
          A4 page. Type millimetres in the sidebar, or drag on the page. Pull the teal corner to resize. Blocks snap to
          the grid and to each other; hold Alt to move freely. PDF keeps these positions; Word and Excel follow the same
          order.
        </p>
      </div>
      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3">
        {selected ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">{blockTypeLabel(selected.type)}</p>
            {selected.type === 'heading' || selected.type === 'text' ? (
              <div>
                <Label>Text</Label>
                <TemplateField
                  disabled={readOnly}
                  multiline={selected.type === 'text'}
                  value={selected.text}
                  suggestions={suggestions}
                  onChange={(text) => patchBlock(selected.id, { text })}
                />
              </div>
            ) : null}
            {selected.type === 'field' || selected.type === 'image' ? (
              <>
                <div>
                  <Label>Label</Label>
                  <Input
                    disabled={readOnly}
                    value={selected.label}
                    onChange={(e) => patchBlock(selected.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{selected.type === 'image' ? 'Image / signature' : 'Value'}</Label>
                  <TemplateField
                    disabled={readOnly}
                    value={selected.value}
                    suggestions={suggestions}
                    onChange={(value) => patchBlock(selected.id, { value })}
                    placeholder={selected.type === 'image' ? '{{inputs.signature}}' : '{{inputs.name}}'}
                  />
                </div>
              </>
            ) : null}
            {selected.type === 'cart' ? (
              <div>
                <Label>Heading</Label>
                <Input
                  disabled={readOnly}
                  value={selected.label}
                  onChange={(e) => patchBlock(selected.id, { label: e.target.value })}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <MmField
                label="Left"
                disabled={readOnly}
                value={pctToMm(selected.x, 'x')}
                min={0}
                max={210}
                onChange={(mm) => patchBlock(selected.id, { x: mmToPct(mm, 'x') })}
              />
              <MmField
                label="Top"
                disabled={readOnly}
                value={pctToMm(selected.y, 'y')}
                min={0}
                max={297}
                onChange={(mm) => patchBlock(selected.id, { y: mmToPct(mm, 'y') })}
              />
              <MmField
                label="Width"
                disabled={readOnly}
                value={pctToMm(selected.w, 'x')}
                min={4}
                max={210}
                onChange={(mm) => patchBlock(selected.id, { w: mmToPct(mm, 'x') })}
              />
              <MmField
                label={selected.type === 'divider' ? 'Thickness' : 'Height'}
                disabled={readOnly}
                value={pctToMm(selected.h, 'y')}
                min={selected.type === 'divider' ? DIVIDER_MIN_MM : 4}
                max={297}
                onChange={(mm) => patchBlock(selected.id, { h: mmToPct(mm, 'y') })}
              />
            </div>
            <p className="-mt-1 text-[11px] text-[var(--color-ink-muted)]">A4 millimetres. You can still drag on the page.</p>
            {showTextStyle ? (
              <>
                <div>
                  <Label>Font</Label>
                  <Select
                    disabled={readOnly}
                    value={selected.fontFamily}
                    onChange={(e) =>
                      patchBlock(selected.id, { fontFamily: parseFont(e.target.value) })
                    }
                  >
                    <option value="helvetica">Helvetica</option>
                    <option value="times">Times</option>
                    <option value="courier">Courier</option>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Align</Label>
                    <Select
                      disabled={readOnly}
                      value={selected.align}
                      onChange={(e) =>
                        patchBlock(selected.id, {
                          align: e.target.value === 'center' || e.target.value === 'right' ? e.target.value : 'left',
                        })
                      }
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Font size</Label>
                    <Input
                      disabled={readOnly}
                      type="number"
                      min={8}
                      max={36}
                      value={selected.fontSize}
                      onChange={(e) => patchBlock(selected.id, { fontSize: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={!!selected.bold}
                    onChange={(e) => patchBlock(selected.id, { bold: e.target.checked })}
                  />
                  Bold
                </label>
              </>
            ) : null}
            <HexField
              label={selected.type === 'divider' ? 'Line color' : 'Text color'}
              value={selected.color || (selected.type === 'divider' ? '#94a3b8' : '#0f172a')}
              disabled={readOnly}
              onChange={(color) => patchBlock(selected.id, { color })}
            />
            {selected.type !== 'divider' ? (
              <HexField
                label="Fill"
                value={selected.fill}
                allowEmpty
                disabled={readOnly}
                onChange={(fill) => patchBlock(selected.id, { fill })}
              />
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              disabled={readOnly}
              onClick={() => {
                patchBlocks(content.blocks.filter((b) => b.id !== selected.id))
                setSelectedId(null)
              }}
            >
              <Minus className="h-3.5 w-3.5" />
              Remove
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <Type className="h-4 w-4" />
            Select a block to edit its text, font, or color.
          </p>
        )}
      </div>
    </div>
  )
}

export function ensurePageBlocks(content: DocumentContent): DocumentBlock[] {
  if (content.blocks.length) return content.blocks
  return flowToPageBlocks(content)
}

function parseFont(value: string): DocumentFont {
  return value === 'times' || value === 'courier' ? value : 'helvetica'
}

function blockTypeLabel(type: DocumentBlockType): string {
  return ADD_TYPES.find((t) => t.type === type)?.label ?? type
}

function blockPreview(block: DocumentBlock): string {
  if (block.type === 'divider') return ''
  if (block.type === 'cart') return block.label || 'Cart'
  if (block.type === 'image') return block.label || 'Signature'
  if (block.type === 'field') return `${block.label || 'Field'}: ${block.value || '…'}`
  return block.text || (block.type === 'heading' ? 'Heading' : 'Text')
}

function MmField({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (mm: number) => void
  disabled?: boolean
  min: number
  max: number
}) {
  return (
    <div>
      <Label>
        {label} <span className="font-normal text-[var(--color-ink-muted)]">(mm)</span>
      </Label>
      <Input
        disabled={disabled}
        type="number"
        min={min}
        max={max}
        step="any"
        value={Number.isFinite(value) ? Number(value.toFixed(4)) : ''}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          onChange(n)
        }}
      />
    </div>
  )
}

function HexField({
  label,
  value,
  onChange,
  disabled,
  allowEmpty,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  allowEmpty?: boolean
}) {
  const hex = /^#([0-9a-f]{6})$/i.test(value)
    ? value
    : /^#([0-9a-f]{3})$/i.test(value)
      ? value
      : allowEmpty
        ? '#ffffff'
        : '#0f172a'
  const picker =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm"
          style={{ background: value || 'transparent' }}
          title={label}
        >
          <input
            type="color"
            disabled={disabled}
            value={picker}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            aria-label={label}
          />
        </label>
        <Input
          disabled={disabled}
          value={value}
          spellCheck={false}
          placeholder={allowEmpty ? 'None' : '#0f172a'}
          onChange={(e) => onChange(e.target.value.trim())}
          className="h-9 font-mono text-xs"
        />
        {allowEmpty && value ? (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange('')}>
            Clear
          </Button>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {allowEmpty ? (
          <button
            type="button"
            disabled={disabled}
            title="No fill"
            onClick={() => onChange('')}
            className="h-4 w-4 rounded-sm border border-dashed border-[var(--color-border)] bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-[size:6px_6px]"
          />
        ) : null}
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            title={preset}
            onClick={() => onChange(preset)}
            className={cn(
              'h-4 w-4 rounded-sm border border-[var(--color-border)]',
              value.toLowerCase() === preset ? 'ring-2 ring-[var(--color-accent)] ring-offset-1' : '',
            )}
            style={{ background: preset }}
          />
        ))}
      </div>
    </div>
  )
}
