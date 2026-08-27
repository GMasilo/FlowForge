import { unzipSync, zipSync } from 'fflate'
import type { EntityAttribute, VariableType } from '@/shared/types/database'
import { coerceEntityValue } from '@/features/entities/entityValueValidation'
import { downloadBlob } from '@/shared/lib/downloadJson'

const VARIABLE_TYPES = new Set<VariableType>(['string', 'number', 'boolean', 'date', 'array', 'object'])
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type EntityExcelColumn = {
  key: string
  label: string
  value_type: VariableType
}

export type EntityExcelParseResult = {
  columns: EntityExcelColumn[]
  rows: Record<string, string>[]
  suggestedName: string
}

type ExcelRecordRow = { values: Record<string, unknown> }

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colLetter(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

function parseColLetters(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim())
  if (!m) return null
  return { col: parseColLetters(m[1]!), row: Number(m[2]) - 1 }
}

function valueToCell(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function xlsxCell(ref: string, value: string): string {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
}

function buildSheetXml(rows: string[][], sheetName: string): { sheet: string; workbook: string } {
  const sheetRows = rows.map((cols, r) => {
    const cells = cols.map((value, c) => xlsxCell(`${colLetter(c)}${r + 1}`, value)).join('')
    return `<row r="${r + 1}">${cells}</row>`
  })
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows.join('')}</sheetData>
</worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  return { sheet, workbook }
}

/** Build an .xlsx workbook: header keys, type row, then record values. */
export function buildEntityRecordsXlsx(input: {
  entityName: string
  attributes: Pick<EntityAttribute, 'key' | 'label' | 'value_type'>[]
  records: ExcelRecordRow[]
}): Uint8Array {
  const attrs = input.attributes
  const header = attrs.map((a) => a.key)
  const types = attrs.map((a) => a.value_type)
  const rows: string[][] = [header, types]
  for (const record of input.records) {
    rows.push(attrs.map((a) => valueToCell(record.values[a.key])))
  }
  const sheetName = (input.entityName || 'Records').slice(0, 31) || 'Records'
  const { sheet, workbook } = buildSheetXml(rows, sheetName)
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  const typesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  const enc = new TextEncoder()
  return zipSync({
    '[Content_Types].xml': enc.encode(typesXml),
    '_rels/.rels': enc.encode(rels),
    'xl/workbook.xml': enc.encode(workbook),
    'xl/_rels/workbook.xml.rels': enc.encode(wbRels),
    'xl/worksheets/sheet1.xml': enc.encode(sheet),
  })
}

export function downloadEntityRecordsExcel(input: {
  entityKey: string
  entityName: string
  attributes: Pick<EntityAttribute, 'key' | 'label' | 'value_type'>[]
  records: ExcelRecordRow[]
}) {
  const bytes = buildEntityRecordsXlsx(input)
  const copy = Uint8Array.from(bytes)
  const filename = `${input.entityKey || 'entity'}-records.xlsx`
  downloadBlob(filename, new Blob([copy], { type: XLSX_MIME }))
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

function excelSerialToDateString(serial: number): string {
  // Excel epoch 1899-12-30 (with 1900 leap-year bug compensated by day offset)
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return String(serial)
  return d.toISOString().slice(0, 10)
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi
  let m: RegExpExecArray | null
  while ((m = siRe.exec(xml))) {
    const chunk = m[1] ?? ''
    const texts = [...chunk.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/gi)].map((x) => decodeXmlEntities(x[1] ?? ''))
    out.push(texts.join(''))
  }
  return out
}

function parseSheetRows(xml: string, shared: string[]): string[][] {
  const grid = new Map<string, string>()
  let maxRow = -1
  let maxCol = -1

  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi
  let m: RegExpExecArray | null
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1] ?? m[3] ?? ''
    const body = m[2] ?? ''
    const refM = /\br="([^"]+)"/.exec(attrs)
    if (!refM) continue
    const parsed = parseCellRef(refM[1]!)
    if (!parsed) continue
    const typeM = /\bt="([^"]+)"/.exec(attrs)
    const t = typeM?.[1] ?? ''
    let value = ''
    if (t === 'inlineStr') {
      const tm = /<t[^>]*>([\s\S]*?)<\/t>/i.exec(body)
      value = tm ? decodeXmlEntities(tm[1] ?? '') : ''
    } else if (t === 's') {
      const vm = /<v[^>]*>([\s\S]*?)<\/v>/i.exec(body)
      const idx = Number(vm?.[1] ?? '')
      value = Number.isFinite(idx) ? (shared[idx] ?? '') : ''
    } else if (t === 'b') {
      const vm = /<v[^>]*>([\s\S]*?)<\/v>/i.exec(body)
      value = vm?.[1]?.trim() === '1' ? 'true' : 'false'
    } else {
      const isM = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/i.exec(body)
      if (isM) value = decodeXmlEntities(isM[1] ?? '')
      else {
        const vm = /<v[^>]*>([\s\S]*?)<\/v>/i.exec(body)
        value = vm ? decodeXmlEntities(vm[1] ?? '').trim() : ''
      }
    }
    grid.set(`${parsed.row}:${parsed.col}`, value)
    maxRow = Math.max(maxRow, parsed.row)
    maxCol = Math.max(maxCol, parsed.col)
  }

  const rows: string[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxCol; c++) row.push(grid.get(`${r}:${c}`) ?? '')
    rows.push(row)
  }
  return rows
}

function findWorksheetPath(files: Record<string, Uint8Array>): string | null {
  const wb = files['xl/workbook.xml']
  const rels = files['xl/_rels/workbook.xml.rels']
  if (!wb || !rels) {
    const fallback = Object.keys(files).find((k) => /xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    return fallback ?? null
  }
  const dec = new TextDecoder()
  const wbXml = dec.decode(wb)
  const relsXml = dec.decode(rels)
  const sheetM = /<sheet\b[^>]*\br:id="([^"]+)"/i.exec(wbXml) ?? /<sheet\b[^>]*\bid="([^"]+)"/i.exec(wbXml)
  const rid = sheetM?.[1]
  if (!rid) {
    const fallback = Object.keys(files).find((k) => /xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    return fallback ?? null
  }
  const relM = new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`, 'i').exec(relsXml)
  const target = relM?.[1]
  if (!target) return null
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\.\//, '')}`
  return path.replace(/\\/g, '/')
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
      continue
    }
    cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

function sanitizeKey(raw: string, index: number): string {
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const withLetter = cleaned && /^[A-Za-z]/.test(cleaned) ? cleaned : `col_${index + 1}${cleaned ? `_${cleaned}` : ''}`
  return withLetter.slice(0, 48) || `col_${index + 1}`
}

function isTypeRow(cells: string[]): boolean {
  if (!cells.length) return false
  return cells.every((c) => {
    const t = c.trim().toLowerCase()
    return t === '' || VARIABLE_TYPES.has(t as VariableType)
  }) && cells.some((c) => VARIABLE_TYPES.has(c.trim().toLowerCase() as VariableType))
}

function inferType(samples: string[]): VariableType {
  const nonEmpty = samples.map((s) => s.trim()).filter(Boolean)
  if (!nonEmpty.length) return 'string'
  if (nonEmpty.every((s) => /^(true|false|yes|no|0|1)$/i.test(s))) return 'boolean'
  if (nonEmpty.every((s) => s !== '' && Number.isFinite(Number(s.replace(/,/g, ''))))) return 'number'
  if (nonEmpty.every((s) => /^\d{4}-\d{2}-\d{2}/.test(s))) return 'date'
  if (nonEmpty.every((s) => (s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}')))) {
    try {
      const parsed = nonEmpty.map((s) => JSON.parse(s) as unknown)
      if (parsed.every((v) => Array.isArray(v))) return 'array'
      if (parsed.every((v) => v && typeof v === 'object' && !Array.isArray(v))) return 'object'
    } catch {
      /* fall through */
    }
  }
  return 'string'
}

function gridToParseResult(grid: string[][], suggestedName: string): EntityExcelParseResult {
  if (!grid.length) throw new Error('Spreadsheet is empty')
  const header = grid[0]!.map((h, i) => (h.trim() ? h.trim() : `Column ${i + 1}`))
  let typeCells: string[] | null = null
  let dataStart = 1
  if (grid[1] && isTypeRow(grid[1])) {
    typeCells = grid[1]
    dataStart = 2
  }
  const usedKeys = new Set<string>()
  const columns: EntityExcelColumn[] = header.map((label, i) => {
    let key = sanitizeKey(label, i)
    let n = 2
    while (usedKeys.has(key.toLowerCase())) {
      key = `${sanitizeKey(label, i)}_${n++}`.slice(0, 48)
    }
    usedKeys.add(key.toLowerCase())
    const declared = typeCells?.[i]?.trim().toLowerCase()
    const value_type =
      declared && VARIABLE_TYPES.has(declared as VariableType)
        ? (declared as VariableType)
        : inferType(grid.slice(dataStart).map((r) => r[i] ?? ''))
    return { key, label, value_type }
  })

  const rows: Record<string, string>[] = []
  for (let r = dataStart; r < grid.length; r++) {
    const line = grid[r]!
    if (line.every((c) => !String(c ?? '').trim())) continue
    const values: Record<string, string> = {}
    columns.forEach((col, i) => {
      let raw = String(line[i] ?? '')
      if (col.value_type === 'date' && raw && /^\d+(\.\d+)?$/.test(raw.trim())) {
        raw = excelSerialToDateString(Number(raw))
      }
      values[col.key] = raw
    })
    rows.push(values)
  }

  return { columns, rows, suggestedName }
}

function parseXlsxBytes(bytes: Uint8Array, suggestedName: string): EntityExcelParseResult {
  const files = unzipSync(bytes) as Record<string, Uint8Array>
  const dec = new TextDecoder()
  const sharedPath = Object.keys(files).find((k) => /xl\/sharedStrings\.xml$/i.test(k))
  const shared = sharedPath ? parseSharedStrings(dec.decode(files[sharedPath]!)) : []
  const sheetPath = findWorksheetPath(files)
  if (!sheetPath || !files[sheetPath]) throw new Error('Could not find a worksheet in the Excel file')
  const grid = parseSheetRows(dec.decode(files[sheetPath]!), shared)
  return gridToParseResult(grid, suggestedName)
}

/** Parse .xlsx or .csv into columns + string rows. */
export function parseEntitySpreadsheet(file: File, bytes: Uint8Array, textFallback?: string): EntityExcelParseResult {
  const name = file.name.replace(/\.(xlsx|csv)$/i, '') || 'Imported'
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    const text = textFallback ?? new TextDecoder().decode(bytes)
    return gridToParseResult(parseCsv(text), name)
  }
  if (lower.endsWith('.xlsx') || file.type === XLSX_MIME || bytes[0] === 0x50) {
    return parseXlsxBytes(bytes, name)
  }
  throw new Error('Choose an .xlsx or .csv file')
}

export function pickEntitySpreadsheetFile(): Promise<{ file: File; parsed: EntityExcelParseResult }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept =
      '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        reject(new Error('No file selected'))
        return
      }
      file
        .arrayBuffer()
        .then((buf) => {
          const bytes = new Uint8Array(buf)
          const parsed = parseEntitySpreadsheet(file, bytes)
          resolve({ file, parsed })
        })
        .catch(() => reject(new Error('Could not read file')))
    })
    document.body.appendChild(input)
    input.click()
  })
}

export function cellToEntityValue(raw: string, type: VariableType): unknown {
  if (raw.trim() === '') return undefined
  const coerced = coerceEntityValue(raw, type)
  if (!coerced.ok) throw new Error(coerced.error)
  return coerced.value
}
