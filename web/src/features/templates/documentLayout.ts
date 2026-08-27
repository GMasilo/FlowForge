import {
  isDocumentFont,
  type DocumentAlign,
  type DocumentBlock,
  type DocumentBlockType,
  type DocumentContent,
  type DocumentFont,
  type DocumentLayout,
  type DocumentOrientation,
} from '@/features/templates/templateModel'

export const A4_WIDTH_PT = 595.28
export const A4_HEIGHT_PT = 841.89
export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

export function a4SizeMm(orientation: DocumentOrientation = 'portrait'): { width: number; height: number } {
  return orientation === 'landscape'
    ? { width: A4_HEIGHT_MM, height: A4_WIDTH_MM }
    : { width: A4_WIDTH_MM, height: A4_HEIGHT_MM }
}

export function a4SizePt(orientation: DocumentOrientation = 'portrait'): { width: number; height: number } {
  return orientation === 'landscape'
    ? { width: A4_HEIGHT_PT, height: A4_WIDTH_PT }
    : { width: A4_WIDTH_PT, height: A4_HEIGHT_PT }
}

export function pctToMm(pct: number, axis: 'x' | 'y', orientation: DocumentOrientation = 'portrait'): number {
  const size = a4SizeMm(orientation)
  const page = axis === 'x' ? size.width : size.height
  return Math.round((pct / 100) * page * 10000) / 10000
}

export function mmToPct(mm: number, axis: 'x' | 'y', orientation: DocumentOrientation = 'portrait'): number {
  const size = a4SizeMm(orientation)
  const page = axis === 'x' ? size.width : size.height
  if (!Number.isFinite(mm) || page <= 0) return 0
  return (mm / page) * 100
}

/** Thinnest Line block, in millimetres. */
export const DIVIDER_MIN_MM = 0.1

function newBlockId(): string {
  return `blk_${Math.random().toString(36).slice(2, 8)}`
}

export function isDocumentLayout(value: string): value is DocumentLayout {
  return value === 'flow' || value === 'page'
}

export function isDocumentBlockType(value: string): value is DocumentBlockType {
  return (
    value === 'heading' ||
    value === 'text' ||
    value === 'field' ||
    value === 'image' ||
    value === 'divider' ||
    value === 'cart'
  )
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function roundPct(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function normalizeDocumentColor(raw: unknown, fallback = '#0f172a'): string {
  const s = String(raw ?? '').trim()
  if (/^#([0-9a-f]{3})$/i.test(s)) {
    const h = s.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase()
  }
  if (/^#([0-9a-f]{6})$/i.test(s)) return s.toLowerCase()
  return fallback
}

export function optionalDocumentFill(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'transparent') return ''
  return normalizeDocumentColor(s, '')
}

export function hexToRgb01(hex: string, fallback = '#0f172a'): { r: number; g: number; b: number } {
  const n = normalizeDocumentColor(hex, fallback)
  return {
    r: parseInt(n.slice(1, 3), 16) / 255,
    g: parseInt(n.slice(3, 5), 16) / 255,
    b: parseInt(n.slice(5, 7), 16) / 255,
  }
}

export function cssFontFamily(font: DocumentFont): string {
  if (font === 'times') return '"Times New Roman", Times, serif'
  if (font === 'courier') return '"Courier New", Courier, monospace'
  return 'Helvetica, Arial, sans-serif'
}

export function docxFontName(font: DocumentFont): string {
  if (font === 'times') return 'Times New Roman'
  if (font === 'courier') return 'Courier New'
  return 'Helvetica'
}

export function clampBlock(block: DocumentBlock, orientation: DocumentOrientation = 'portrait'): DocumentBlock {
  const w = clamp(block.w, 2, 100)
  const h = clamp(block.h, block.type === 'divider' ? mmToPct(DIVIDER_MIN_MM, 'y', orientation) : 1.5, 100)
  const x = clamp(block.x, 0, 100 - w)
  const y = clamp(block.y, 0, 100 - h)
  const fontSize = clamp(block.fontSize || (block.type === 'heading' ? 18 : 11), 8, 36)
  const align: DocumentAlign =
    block.align === 'center' || block.align === 'right' ? block.align : 'left'
  const fontFamily: DocumentFont = isDocumentFont(String(block.fontFamily ?? ''))
    ? block.fontFamily
    : 'helvetica'
  const bold = typeof block.bold === 'boolean' ? block.bold : block.type === 'heading'
  const color = normalizeDocumentColor(block.color, block.type === 'divider' ? '#94a3b8' : '#0f172a')
  return {
    ...block,
    x: roundPct(x),
    y: roundPct(y),
    w: roundPct(w),
    h: roundPct(h),
    page: Math.max(1, Math.floor(block.page || 1)),
    fontSize,
    fontFamily,
    bold,
    color,
    fill: optionalDocumentFill(block.fill),
    align,
    text: block.text ?? '',
    label: block.label ?? '',
    value: block.value ?? '',
  }
}

export function emptyDocumentBlock(
  type: DocumentBlockType,
  y = 8,
  orientation: DocumentOrientation = 'portrait',
): DocumentBlock {
  const defaults: Record<DocumentBlockType, Pick<DocumentBlock, 'w' | 'h' | 'fontSize' | 'text' | 'label'>> = {
    heading: { w: 84, h: 7, fontSize: 18, text: 'Heading', label: '' },
    text: { w: 84, h: 10, fontSize: 11, text: '', label: '' },
    field: { w: 84, h: 6, fontSize: 11, text: '', label: 'Field' },
    image: { w: 36, h: 12, fontSize: 11, text: '', label: 'Signature' },
    divider: { w: 84, h: mmToPct(0.35, 'y', orientation), fontSize: 11, text: '', label: '' },
    cart: { w: 84, h: 18, fontSize: 10, text: '', label: 'Order' },
  }
  const d = defaults[type]
  return clampBlock(
    {
      id: newBlockId(),
      type,
      x: 8,
      y,
      w: d.w,
      h: d.h,
      page: 1,
      text: d.text,
      label: d.label,
      value: type === 'field' ? '{{inputs.name}}' : type === 'image' ? '{{inputs.signature}}' : '',
      align: 'left',
      fontSize: d.fontSize,
      fontFamily: 'helvetica',
      bold: type === 'heading',
      color: type === 'divider' ? '#94a3b8' : '#0f172a',
      fill: '',
    },
    orientation,
  )
}

export function parseDocumentBlocks(raw: unknown): DocumentBlock[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const row = item as Record<string, unknown>
      const type = isDocumentBlockType(String(row.type ?? '')) ? (row.type as DocumentBlockType) : null
      if (!type) return null
      const num = (v: unknown, fallback: number) => {
        const n = typeof v === 'number' ? v : Number(v)
        return Number.isFinite(n) ? n : fallback
      }
      return clampBlock({
        id: typeof row.id === 'string' && row.id.trim() ? row.id : newBlockId(),
        type,
        x: num(row.x, 8),
        y: num(row.y, 8),
        w: num(row.w, 84),
        h: num(row.h, 8),
        page: num(row.page, 1),
        text: typeof row.text === 'string' ? row.text : '',
        label: typeof row.label === 'string' ? row.label : '',
        value: typeof row.value === 'string' ? row.value : '',
        align: row.align === 'center' || row.align === 'right' ? row.align : 'left',
        fontSize: num(row.fontSize, type === 'heading' ? 18 : 11),
        fontFamily: isDocumentFont(String(row.fontFamily ?? '')) ? (row.fontFamily as DocumentFont) : 'helvetica',
        bold: typeof row.bold === 'boolean' ? row.bold : type === 'heading',
        color: typeof row.color === 'string' ? row.color : '',
        fill: typeof row.fill === 'string' ? row.fill : '',
      })
    })
    .filter((b): b is DocumentBlock => !!b)
}

export function flowToPageBlocks(
  content: Pick<DocumentContent, 'title' | 'intro' | 'body' | 'footer' | 'fields' | 'orientation'>,
): DocumentBlock[] {
  const orientation = content.orientation === 'landscape' ? 'landscape' : 'portrait'
  const blocks: DocumentBlock[] = []
  let y = 8
  const add = (type: DocumentBlockType, patch: Partial<DocumentBlock>) => {
    const block = clampBlock({ ...emptyDocumentBlock(type, y, orientation), ...patch, y, type }, orientation)
    blocks.push(block)
    y = roundPct(block.y + block.h + 1.5)
  }
  if (content.title.trim()) add('heading', { text: content.title, w: 84 })
  if (content.intro.trim()) add('text', { text: content.intro, h: 8 })
  for (const field of content.fields) {
    if (!field.label.trim() && !field.value.trim()) continue
    if (field.as === 'image') {
      add('image', { label: field.label || 'Signature', value: field.value, w: 40, h: 12 })
    } else {
      add('field', { label: field.label || 'Field', value: field.value, h: 5.5 })
    }
  }
  if (content.body.trim()) add('text', { text: content.body, h: 14 })
  if (content.footer.trim()) add('text', { text: content.footer, y: 92, h: 4, fontSize: 9 })
  return blocks
}

export function blockBoxPts(
  block: Pick<DocumentBlock, 'x' | 'y' | 'w' | 'h'>,
  orientation: DocumentOrientation = 'portrait',
): {
  x: number
  y: number
  w: number
  h: number
} {
  const page = a4SizePt(orientation)
  const w = (block.w / 100) * page.width
  const h = (block.h / 100) * page.height
  const x = (block.x / 100) * page.width
  const y = page.height - (block.y / 100) * page.height - h
  return { x, y, w, h }
}

export function documentPageCount(blocks: Array<{ page?: number }>): number {
  let max = 1
  for (const block of blocks) {
    const page = Math.max(1, Math.floor(block.page || 1))
    if (page > max) max = page
  }
  return max
}

export const DOCUMENT_GRID_PCT = 2
export const DOCUMENT_ALIGN_THRESHOLD = 0.8

export type SnapGuide = { axis: 'v' | 'h'; pos: number }

export function snapToGrid(n: number, grid = DOCUMENT_GRID_PCT): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n / grid) * grid
}

type Box = Pick<DocumentBlock, 'x' | 'y' | 'w' | 'h'>

function collectTargets(siblings: Box[]): { x: number[]; y: number[] } {
  const x = [0, 50, 100]
  const y = [0, 50, 100]
  for (const s of siblings) {
    x.push(s.x, s.x + s.w, s.x + s.w / 2)
    y.push(s.y, s.y + s.h, s.y + s.h / 2)
  }
  return { x, y }
}

function nearestDelta(value: number, targets: number[], threshold: number): { pos: number; delta: number } | null {
  let best: { pos: number; delta: number } | null = null
  for (const pos of targets) {
    const delta = pos - value
    const dist = Math.abs(delta)
    if (dist > threshold) continue
    if (!best || dist < Math.abs(best.delta)) best = { pos, delta }
  }
  return best
}

function pickSnap(
  candidates: Array<{ pos: number; delta: number } | null>,
): { pos: number; delta: number } | null {
  let best: { pos: number; delta: number } | null = null
  for (const c of candidates) {
    if (!c) continue
    if (!best || Math.abs(c.delta) < Math.abs(best.delta)) best = c
  }
  return best
}

export function snapBlockMove(
  orig: Box,
  dx: number,
  dy: number,
  siblings: Box[],
  opts: { grid: boolean; guides: boolean },
): { x: number; y: number; guides: SnapGuide[] } {
  let x = orig.x + dx
  let y = orig.y + dy
  const guides: SnapGuide[] = []
  if (opts.guides) {
    const targets = collectTargets(siblings)
    const xSnap = pickSnap([
      nearestDelta(x, targets.x, DOCUMENT_ALIGN_THRESHOLD),
      nearestDelta(x + orig.w / 2, targets.x, DOCUMENT_ALIGN_THRESHOLD),
      nearestDelta(x + orig.w, targets.x, DOCUMENT_ALIGN_THRESHOLD),
    ])
    const ySnap = pickSnap([
      nearestDelta(y, targets.y, DOCUMENT_ALIGN_THRESHOLD),
      nearestDelta(y + orig.h / 2, targets.y, DOCUMENT_ALIGN_THRESHOLD),
      nearestDelta(y + orig.h, targets.y, DOCUMENT_ALIGN_THRESHOLD),
    ])
    if (xSnap) {
      x += xSnap.delta
      guides.push({ axis: 'v', pos: roundPct(xSnap.pos) })
    } else if (opts.grid) {
      x = snapToGrid(x)
    }
    if (ySnap) {
      y += ySnap.delta
      guides.push({ axis: 'h', pos: roundPct(ySnap.pos) })
    } else if (opts.grid) {
      y = snapToGrid(y)
    }
    return { x, y, guides }
  }
  if (opts.grid) {
    x = snapToGrid(x)
    y = snapToGrid(y)
  }
  return { x, y, guides }
}

export function snapBlockResize(
  orig: Box,
  dx: number,
  dy: number,
  siblings: Box[],
  opts: { grid: boolean; guides: boolean; snapHeight?: boolean },
): { w: number; h: number; guides: SnapGuide[] } {
  let w = orig.w + dx
  let h = orig.h + dy
  const snapH = opts.snapHeight !== false
  const guides: SnapGuide[] = []
  if (opts.guides) {
    const targets = collectTargets(siblings)
    const right = nearestDelta(orig.x + w, targets.x, DOCUMENT_ALIGN_THRESHOLD)
    const bottom = snapH ? nearestDelta(orig.y + h, targets.y, DOCUMENT_ALIGN_THRESHOLD) : null
    if (right) {
      w = right.pos - orig.x
      guides.push({ axis: 'v', pos: roundPct(right.pos) })
    } else if (opts.grid) {
      w = snapToGrid(w)
    }
    if (bottom) {
      h = bottom.pos - orig.y
      guides.push({ axis: 'h', pos: roundPct(bottom.pos) })
    } else if (opts.grid && snapH) {
      h = snapToGrid(h)
    }
    return { w, h, guides }
  }
  if (opts.grid) {
    w = snapToGrid(w)
    if (snapH) h = snapToGrid(h)
  }
  return { w, h, guides }
}
