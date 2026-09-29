import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { nodeTypeLabel, type DesignerEdge, type DesignerNode } from '@/features/designer/model/flowSchema'
import { parseSwitchCases } from '@/features/designer/model/switchStep'
import { downloadBlob } from '@/shared/lib/downloadJson'
import { CANVAS_NODE_HEIGHT, CANVAS_NODE_WIDTH, computeCanvasLayout } from '@/features/designer/utils/canvasLayout'
import {
  CANVAS_NODE_COLOR,
  canvasEdgeMeta,
  canvasStepPreview,
} from '@/features/designer/utils/canvasVisuals'
import { safeDownloadBasename } from '@/features/designer/utils/flowTransfer'

const PAGE_MAX = 14400
const MARGIN = 48
const NODE_H = CANVAS_NODE_HEIGHT + 8
const NODE_W = CANVAS_NODE_WIDTH
const HEADER_H = 36

export type CanvasPdfPoint = { x: number; y: number }

function hexRgb(hex: string): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1]!, 16) : 0x64748b
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function pdfSafe(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, (ch) => {
    if (ch === '…' || ch === '→' || ch === '·') return '-'
    return '?'
  })
}

function nodePositions(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  override?: Map<string, CanvasPdfPoint>,
): Map<string, CanvasPdfPoint> {
  let layout: Map<string, CanvasPdfPoint> | undefined
  const out = new Map<string, CanvasPdfPoint>()
  for (const n of nodes) {
    const fromView = override?.get(n.id)
    if (fromView && Number.isFinite(fromView.x) && Number.isFinite(fromView.y)) {
      out.set(n.id, fromView)
      continue
    }
    const stored = n.position
    const hasStored =
      stored && Number.isFinite(stored.x) && Number.isFinite(stored.y) && (stored.x !== 0 || stored.y !== 0)
    if (!hasStored) layout ??= computeCanvasLayout(nodes, edges)
    out.set(n.id, hasStored ? { x: stored.x, y: stored.y } : (layout?.get(n.id) ?? { x: 0, y: 0 }))
  }
  return out
}

function sourceAnchor(
  node: DesignerNode,
  pos: CanvasPdfPoint,
  sourceHandle: string | null | undefined,
): CanvasPdfPoint {
  const y = pos.y + NODE_H
  if (node.type === 'condition') {
    const t = sourceHandle === 'false' ? 0.72 : 0.28
    return { x: pos.x + NODE_W * t, y }
  }
  if (node.type === 'switch') {
    const handles = [
      ...parseSwitchCases(node.config.cases).map((c) => c.id),
      'default',
    ]
    const n = Math.max(1, handles.length)
    const idx = Math.max(0, handles.indexOf(sourceHandle ?? 'default'))
    const t = (idx + 1) / (n + 1)
    return { x: pos.x + NODE_W * t, y }
  }
  if (node.type === 'loop' && sourceHandle === 'body') {
    return { x: pos.x + NODE_W * 0.28, y }
  }
  return { x: pos.x + NODE_W / 2, y }
}

function targetAnchor(pos: CanvasPdfPoint): CanvasPdfPoint {
  return { x: pos.x + NODE_W / 2, y: pos.y }
}

function fitText(font: PDFFont, text: string, size: number, maxWidth: number): string {
  const raw = pdfSafe(text)
  if (!raw) return ''
  if (font.widthOfTextAtSize(raw, size) <= maxWidth) return raw
  if (font.widthOfTextAtSize('...', size) > maxWidth) return ''
  let low = 0
  let high = raw.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (font.widthOfTextAtSize(`${raw.slice(0, mid)}...`, size) <= maxWidth) low = mid
    else high = mid - 1
  }
  return `${raw.slice(0, low)}...`
}

function drawArrow(page: PDFPage, from: CanvasPdfPoint, to: CanvasPdfPoint, color: RGB, flipY: (y: number) => number) {
  const x1 = from.x
  const y1 = flipY(from.y)
  const x2 = to.x
  const y2 = flipY(to.y)
  const midY = (y1 + y2) / 2
  // PDF coordinates are already bottom-up. SVG paths invert their Y axis,
  // which used to put connectors outside the page.
  const points = [{ x: x1, y: y1 }, { x: x1, y: midY }, { x: x2, y: midY }, { x: x2, y: y2 }]
  for (let i = 1; i < points.length; i++) {
    page.drawLine({ start: points[i - 1]!, end: points[i]!, color, thickness: 1.4 })
  }
  const size = 7
  const dir = y2 >= midY ? 1 : -1
  for (const dx of [-size, size]) {
    page.drawLine({ start: { x: x2, y: y2 }, end: { x: x2 + dx, y: y2 - dir * size * 1.4 }, color, thickness: 1.4 })
  }
}

export async function buildCanvasPdf(args: {
  title: string
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  positions?: Map<string, CanvasPdfPoint>
}): Promise<Uint8Array> {
  const positions = nodePositions(args.nodes, args.edges, args.positions)
  let minX = 0
  let minY = 0
  let maxX = NODE_W
  let maxY = NODE_H
  if (args.nodes.length) {
    minX = Infinity
    minY = Infinity
    maxX = -Infinity
    maxY = -Infinity
    for (const n of args.nodes) {
      const p = positions.get(n.id)!
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + NODE_W)
      maxY = Math.max(maxY, p.y + NODE_H)
    }
  }

  const contentW = Math.max(320, maxX - minX)
  const contentH = Math.max(180, maxY - minY)
  const originX = -minX
  const originY = -minY

  // Scale the content within fixed margins, not the entire page. Scaling the
  // margins too while still drawing them at full size clipped large exports.
  const scale = Math.min(1, (PAGE_MAX - MARGIN * 2) / contentW,
    (PAGE_MAX - MARGIN * 2 - HEADER_H) / contentH)
  const pageW = Math.min(PAGE_MAX, contentW * scale + MARGIN * 2)
  const pageH = Math.min(PAGE_MAX, contentH * scale + MARGIN * 2 + HEADER_H)

  const pdf = await PDFDocument.create()
  pdf.setTitle(`${args.title} flow`)
  pdf.setProducer('FlowForge')
  const page = pdf.addPage([pageW, pageH])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const flipY = (y: number) => pageH - (MARGIN + HEADER_H + (y + originY) * scale)
  const mapX = (x: number) => MARGIN + (x + originX) * scale

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
    color: hexRgb('#f8fafc'),
  })

  page.drawText(fitText(bold, args.title || 'Flow', 14, pageW - MARGIN * 2), {
    x: MARGIN,
    y: pageH - 30,
    size: 14,
    font: bold,
    color: hexRgb('#0f172a'),
  })
  page.drawText(
    fitText(
      regular,
      `${args.nodes.length} step${args.nodes.length === 1 ? '' : 's'}  ·  canvas export`,
      9,
      pageW - MARGIN * 2,
    ),
    {
      x: MARGIN,
      y: pageH - 44,
      size: 9,
      font: regular,
      color: hexRgb('#64748b'),
    },
  )

  const byId = new Map(args.nodes.map((n) => [n.id, n]))

  for (const e of args.edges) {
    const src = byId.get(e.source)
    const srcPos = positions.get(e.source)
    const tgtPos = positions.get(e.target)
    if (!src || !srcPos || !tgtPos) continue
    const from = sourceAnchor(src, srcPos, e.sourceHandle)
    const to = targetAnchor(tgtPos)
    const meta = canvasEdgeMeta(e.sourceHandle, e.label)
    const color = hexRgb(meta.stroke)
    const mappedFrom = { x: mapX(from.x), y: from.y }
    const mappedTo = { x: mapX(to.x), y: to.y }
    drawArrow(page, mappedFrom, mappedTo, color, flipY)
    if (meta.label) {
      const mx = (mappedFrom.x + mappedTo.x) / 2
      const my = (flipY(from.y) + flipY(to.y)) / 2
      const label = fitText(bold, meta.label, 8, 120)
      const tw = bold.widthOfTextAtSize(label, 8)
      page.drawRectangle({
        x: mx - tw / 2 - 4,
        y: my - 5,
        width: tw + 8,
        height: 12,
        color: rgb(1, 1, 1),
        borderColor: hexRgb('#e2e8f0'),
        borderWidth: 0.5,
      })
      page.drawText(label, {
        x: mx - tw / 2,
        y: my - 2,
        size: 8,
        font: bold,
        color: hexRgb(meta.labelColor),
      })
    }
  }

  for (const n of args.nodes) {
    const p = positions.get(n.id)!
    const x = mapX(p.x)
    const y = flipY(p.y) - NODE_H * scale
    const w = NODE_W * scale
    const h = NODE_H * scale
    const accent = hexRgb(CANVAS_NODE_COLOR[n.type] ?? '#64748b')
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: rgb(1, 1, 1),
      borderColor: hexRgb('#e2e8f0'),
      borderWidth: 0.9,
    })
    page.drawRectangle({
      x: x + 3 * scale,
      y: y + 8 * scale,
      width: 4 * scale,
      height: h - 16 * scale,
      color: accent,
    })
    const pad = 14 * scale
    const textX = x + pad
    const textMax = w - pad - 8 * scale
    const labelSize = 10 * scale
    const metaSize = 8 * scale
    page.drawText(fitText(bold, n.label || n.key, labelSize, textMax), {
      x: textX,
      y: y + h - 18 * scale,
      size: labelSize,
      font: bold,
      color: hexRgb('#1e293b'),
    })
    page.drawText(fitText(regular, nodeTypeLabel(n.type), metaSize, textMax), {
      x: textX,
      y: y + h - 32 * scale,
      size: metaSize,
      font: regular,
      color: hexRgb('#64748b'),
    })
    const preview = canvasStepPreview(n)
    if (preview) {
      page.drawText(fitText(regular, preview, metaSize, textMax), {
        x: textX,
        y: y + 12 * scale,
        size: metaSize,
        font: regular,
        color: hexRgb('#94a3b8'),
      })
    }
  }

  return pdf.save()
}

export async function downloadCanvasPdf(args: {
  title: string
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  positions?: Map<string, CanvasPdfPoint>
}): Promise<void> {
  const bytes = await buildCanvasPdf(args)
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const stamp = new Date().toISOString().slice(0, 10)
  downloadBlob(`${safeDownloadBasename(args.title)}-canvas-${stamp}.pdf`, blob)
}
