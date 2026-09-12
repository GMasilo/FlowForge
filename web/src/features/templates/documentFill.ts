import { parseConversationFileValue } from '@/features/designer/model/conversationFiles'
import {
  documentMime,
  findCartInVars,
  formatTemplateMoney,
  parseDocumentContent,
  sanitizeDocumentFilename,
  type DocumentAlign,
  type DocumentBlock,
  type DocumentBlockType,
  type DocumentContent,
  type DocumentFont,
  type DocumentFormat,
  type DocumentLayout,
  type DocumentOrientation,
  type DocumentTableColumn,
  type ShopCartValue,
} from '@/features/templates/templateModel'

export const FF_DOC_MARK = '__ffDoc'

export type FilledDocumentField = {
  label: string
  text: string
  imageUrl: string | null
}

export type FilledDocumentBlock = {
  id: string
  type: DocumentBlockType
  x: number
  y: number
  w: number
  h: number
  page: number
  text: string
  label: string
  imageUrl: string | null
  align: DocumentAlign
  fontSize: number
  fontFamily: DocumentFont
  bold: boolean
  color: string
  fill: string
}

export type FilledDocument = {
  format: DocumentFormat
  filename: string
  mime: string
  title: string
  intro: string
  body: string
  footer: string
  fields: FilledDocumentField[]
  /** Multi-row table from tableRowsSource + tableColumns (Excel-friendly). */
  table: {
    headers: string[]
    rows: string[][]
  } | null
  cart: {
    currency: string
    subtotal: string
    total: string
    items: Array<{ name: string; qty: number; lineTotal: string }>
    fees: Array<{ name: string; value: string }>
  } | null
  layout: DocumentLayout
  orientation: DocumentOrientation
  blocks: FilledDocumentBlock[]
}

export function isDocumentExprValue(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rec = value as Record<string, unknown>
  return rec[FF_DOC_MARK] === true || rec.kind === 'document'
}

export function documentContentFromExpr(value: unknown): DocumentContent | null {
  if (!isDocumentExprValue(value)) return null
  return parseDocumentContent(value as Record<string, unknown>)
}

function imageUrlFromValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim()
    if (/^(https?:\/\/|blob:|data:image\/)/i.test(t)) return t
    return null
  }
  const file = parseConversationFileValue(value)
  if (file?.dataUrl) return file.dataUrl
  if (file?.url) return file.url
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>
    const dataUrl = typeof rec.dataUrl === 'string' ? rec.dataUrl.trim() : ''
    if (dataUrl.startsWith('data:image/')) return dataUrl
    const url = typeof rec.url === 'string' ? rec.url.trim() : ''
    if (url && (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:image/'))) {
      return url
    }
  }
  return null
}

function stringifyValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const file = parseConversationFileValue(value)
  if (file) return file.originalName || file.filename
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function blockStyle(block: DocumentBlock) {
  return {
    fontFamily: block.fontFamily,
    bold: block.bold,
    color: block.color,
    fill: block.fill,
  }
}

function cartSnapshot(cart: ShopCartValue | null): FilledDocument['cart'] {
  if (!cart?.itemCount) return null
  return {
    currency: cart.currency,
    subtotal: formatTemplateMoney(cart.subtotal, cart.currency),
    total: formatTemplateMoney(cart.total ?? cart.subtotal, cart.currency),
    items: cart.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      lineTotal: formatTemplateMoney(item.lineTotal, cart.currency),
    })),
    fees: (cart.fees ?? []).map((fee) => ({
      name: fee.name,
      value: formatTemplateMoney(fee.value, cart.currency),
    })),
  }
}

function readPath(row: unknown, path: string): unknown {
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return undefined
  let cur: unknown = row
  for (const part of parts) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const idx = Number(part)
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return undefined
      cur = cur[idx]
      continue
    }
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Coerce eval result into a plain array of row values. */
export function coerceTableRowsSource(value: unknown): unknown[] {
  if (value == null) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      return coerceTableRowsSource(JSON.parse(trimmed))
    } catch {
      return trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    }
  }
  if (Array.isArray(value)) return value
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>
    if (Array.isArray(rec.items)) return rec.items
    if (Array.isArray(rec.rows)) return rec.rows
    if (Array.isArray(rec.data)) return rec.data
  }
  return []
}

function inferColumns(rows: unknown[]): DocumentTableColumn[] {
  const firstObj = rows.find((row) => row && typeof row === 'object' && !Array.isArray(row)) as
    | Record<string, unknown>
    | undefined
  if (firstObj) {
    return Object.keys(firstObj).map((key) => ({ key, label: key }))
  }
  const firstArr = rows.find((row) => Array.isArray(row)) as unknown[] | undefined
  if (firstArr?.length) {
    return firstArr.map((_, i) => ({ key: String(i), label: `Column ${i + 1}` }))
  }
  return [{ key: '0', label: 'Value' }]
}

export function buildFilledTable(
  source: unknown,
  columns: DocumentTableColumn[],
): FilledDocument['table'] {
  const rows = coerceTableRowsSource(source)
  if (!rows.length) return null
  const cols =
    columns.filter((c) => c.key.trim() || c.label.trim()).length > 0
      ? columns
          .filter((c) => c.key.trim() || c.label.trim())
          .map((c) => ({
            key: c.key.trim() || c.label.trim(),
            label: c.label.trim() || c.key.trim(),
          }))
      : inferColumns(rows)
  if (!cols.length) return null

  const headers = cols.map((c) => c.label || c.key)
  const outRows = rows.map((row) =>
    cols.map((col, colIdx) => {
      if (Array.isArray(row)) {
        const idx = Number(col.key)
        if (Number.isInteger(idx) && idx >= 0 && idx < row.length) {
          return stringifyValue(row[idx])
        }
        return stringifyValue(row[colIdx] ?? '')
      }
      if (row && typeof row === 'object') {
        return stringifyValue(readPath(row, col.key))
      }
      return colIdx === 0 ? stringifyValue(row) : ''
    }),
  )
  return { headers, rows: outRows }
}

export function fillDocumentSnapshot(
  content: DocumentContent,
  evalText: (source: string) => string,
  evalValue: (source: string) => unknown,
  vars: Record<string, unknown>,
): FilledDocument {
  const format = content.format
  const filename = sanitizeDocumentFilename(evalText(content.filename) || `document.${format}`, format)
  const fields: FilledDocumentField[] = content.fields
    .filter((f) => f.label.trim() || f.value.trim())
    .map((f) => {
      const label = evalText(f.label) || 'Field'
      if (f.as === 'image') {
        const raw = f.value.trim() ? evalValue(f.value) : null
        return { label, text: stringifyValue(raw), imageUrl: imageUrlFromValue(raw) }
      }
      return { label, text: evalText(f.value), imageUrl: null }
    })
  const tableSource = content.tableRowsSource.trim()
    ? evalValue(content.tableRowsSource)
    : null
  return {
    format,
    filename,
    mime: documentMime(format),
    title: evalText(content.title),
    intro: evalText(content.intro),
    body: evalText(content.body),
    footer: evalText(content.footer),
    fields,
    table: tableSource != null ? buildFilledTable(tableSource, content.tableColumns) : null,
    cart: content.includeCart || content.blocks.some((b) => b.type === 'cart') ? cartSnapshot(findCartInVars(vars)) : null,
    layout: content.layout === 'page' ? 'page' : 'flow',
    orientation: content.orientation === 'landscape' ? 'landscape' : 'portrait',
    blocks: content.blocks.map((block) => {
      if (block.type === 'image') {
        const raw = block.value.trim() ? evalValue(block.value) : null
        return {
          id: block.id,
          type: block.type,
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          page: block.page,
          text: stringifyValue(raw),
          label: evalText(block.label),
          imageUrl: imageUrlFromValue(raw),
          align: block.align,
          fontSize: block.fontSize,
          ...blockStyle(block),
        }
      }
      if (block.type === 'field') {
        return {
          id: block.id,
          type: block.type,
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          page: block.page,
          text: evalText(block.value),
          label: evalText(block.label),
          imageUrl: null,
          align: block.align,
          fontSize: block.fontSize,
          ...blockStyle(block),
        }
      }
      return {
        id: block.id,
        type: block.type,
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        page: block.page,
        text: evalText(block.text),
        label: evalText(block.label),
        imageUrl: null,
        align: block.align,
        fontSize: block.fontSize,
        ...blockStyle(block),
      }
    }),
  }
}

function utf8ToB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function b64ToUtf8(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export const FF_DOC_OPEN = '<<ff:doc:'
export const FF_DOC_CLOSE = '>>'

export function encodeDocumentEmbed(doc: FilledDocument): string {
  return `${FF_DOC_OPEN}${utf8ToB64(JSON.stringify(doc))}${FF_DOC_CLOSE}`
}

export function parseFilledDocument(raw: unknown): FilledDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const format = rec.format === 'docx' || rec.format === 'xlsx' || rec.format === 'pdf' ? rec.format : null
  if (!format || typeof rec.filename !== 'string') return null
  const fields = Array.isArray(rec.fields)
    ? rec.fields.map((item) => {
        const row = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
        return {
          label: typeof row.label === 'string' ? row.label : '',
          text: typeof row.text === 'string' ? row.text : '',
          imageUrl: typeof row.imageUrl === 'string' && row.imageUrl ? row.imageUrl : null,
        }
      })
    : []
  const cartRaw =
    rec.cart && typeof rec.cart === 'object' && !Array.isArray(rec.cart) ? (rec.cart as Record<string, unknown>) : null
  const tableRaw =
    rec.table && typeof rec.table === 'object' && !Array.isArray(rec.table)
      ? (rec.table as Record<string, unknown>)
      : null
  const table =
    tableRaw && Array.isArray(tableRaw.headers) && Array.isArray(tableRaw.rows)
      ? {
          headers: tableRaw.headers.map((h) => String(h ?? '')),
          rows: tableRaw.rows.map((row) =>
            Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [String(row ?? '')],
          ),
        }
      : null
  const blocks = Array.isArray(rec.blocks)
    ? rec.blocks
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const row = item as Record<string, unknown>
          const type = String(row.type ?? '')
          if (
            type !== 'heading' &&
            type !== 'text' &&
            type !== 'field' &&
            type !== 'image' &&
            type !== 'divider' &&
            type !== 'cart'
          ) {
            return null
          }
          const num = (v: unknown, fallback: number) => {
            const n = typeof v === 'number' ? v : Number(v)
            return Number.isFinite(n) ? n : fallback
          }
          return {
            id: typeof row.id === 'string' ? row.id : '',
            type: type as DocumentBlockType,
            x: num(row.x, 8),
            y: num(row.y, 8),
            w: num(row.w, 84),
            h: num(row.h, 8),
            page: num(row.page, 1),
            text: typeof row.text === 'string' ? row.text : '',
            label: typeof row.label === 'string' ? row.label : '',
            imageUrl: typeof row.imageUrl === 'string' && row.imageUrl ? row.imageUrl : null,
            align: (row.align === 'center' || row.align === 'right' ? row.align : 'left') as DocumentAlign,
            fontSize: num(row.fontSize, 11),
            fontFamily: (row.fontFamily === 'times' || row.fontFamily === 'courier' ? row.fontFamily : 'helvetica') as DocumentFont,
            bold: typeof row.bold === 'boolean' ? row.bold : type === 'heading',
            color: typeof row.color === 'string' && row.color ? row.color : type === 'divider' ? '#94a3b8' : '#0f172a',
            fill: typeof row.fill === 'string' ? row.fill : '',
          }
        })
        .filter((b): b is NonNullable<typeof b> => !!b)
    : []
  return {
    format,
    filename: rec.filename,
    mime: typeof rec.mime === 'string' && rec.mime ? rec.mime : documentMime(format),
    title: typeof rec.title === 'string' ? rec.title : '',
    intro: typeof rec.intro === 'string' ? rec.intro : '',
    body: typeof rec.body === 'string' ? rec.body : '',
    footer: typeof rec.footer === 'string' ? rec.footer : '',
    fields,
    table,
    layout: rec.layout === 'page' ? 'page' : ('flow' as DocumentLayout),
    orientation: (rec.orientation === 'landscape' ? 'landscape' : 'portrait') as DocumentOrientation,
    blocks,
    cart: cartRaw
      ? {
          currency: typeof cartRaw.currency === 'string' ? cartRaw.currency : '',
          subtotal: typeof cartRaw.subtotal === 'string' ? cartRaw.subtotal : '',
          total: typeof cartRaw.total === 'string' ? cartRaw.total : '',
          items: Array.isArray(cartRaw.items)
            ? cartRaw.items.map((item) => {
                const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
                return {
                  name: typeof row.name === 'string' ? row.name : '',
                  qty: typeof row.qty === 'number' ? row.qty : Number(row.qty) || 0,
                  lineTotal: typeof row.lineTotal === 'string' ? row.lineTotal : '',
                }
              })
            : [],
          fees: Array.isArray(cartRaw.fees)
            ? cartRaw.fees.map((item) => {
                const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
                return {
                  name: typeof row.name === 'string' ? row.name : '',
                  value: typeof row.value === 'string' ? row.value : '',
                }
              })
            : [],
        }
      : null,
  }
}

export function decodeDocumentEmbed(b64: string): FilledDocument | null {
  try {
    return parseFilledDocument(JSON.parse(b64ToUtf8(b64)))
  } catch {
    return null
  }
}

