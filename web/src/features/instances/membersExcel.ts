import { unzipSync, zipSync } from 'fflate'
import { downloadBlob } from '@/shared/lib/downloadJson'
import type { InstanceRole } from '@/shared/types/database'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Columns for the organisation members import template. */
export const MEMBER_IMPORT_HEADERS = [
  'email',
  'display_name',
  'role',
  'job_title',
  'phone',
  'department',
  'notes',
] as const

export type MemberImportHeader = (typeof MEMBER_IMPORT_HEADERS)[number]

export type MemberImportRow = {
  email: string
  display_name: string
  role: InstanceRole
  job_title: string
  phone: string
  department: string
  notes: string
  /** 1-based spreadsheet row number (for error messages). */
  rowNumber: number
}

const ASSIGNABLE_ROLES: InstanceRole[] = ['admin', 'editor', 'agent', 'viewer']
export const MAX_MEMBER_IMPORT_ROWS = 1000

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

export function buildMembersXlsx(rows: string[][], sheetName = 'Members'): Uint8Array {
  const { sheet, workbook } = buildSheetXml(rows, sheetName)
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  const enc = new TextEncoder()
  return zipSync({
    '[Content_Types].xml': enc.encode(contentTypes),
    '_rels/.rels': enc.encode(rels),
    'xl/workbook.xml': enc.encode(workbook),
    'xl/_rels/workbook.xml.rels': enc.encode(wbRels),
    'xl/worksheets/sheet1.xml': enc.encode(sheet),
  })
}

/** Download a members import template with replaceable sample rows (.xlsx). */
export function downloadMembersImportTemplate() {
  const example: string[][] = [
    [...MEMBER_IMPORT_HEADERS],
    [
      'jane@example.com',
      'Jane Doe',
      'editor',
      'Product Manager',
      '+27 82 000 0000',
      'Product',
      'Optional notes',
    ],
    [
      'sam@example.com',
      'Sam Lee',
      'viewer',
      '',
      '',
      'Support',
      '',
    ],
  ]
  const bytes = buildMembersXlsx(example)
  const copy = Uint8Array.from(bytes)
  downloadBlob(
    'flowforge-members-import-template.xlsx',
    new Blob([copy], { type: XLSX_MIME }),
  )
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
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
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^/]*)\/>/gi
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
      value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
        .map((tm) => decodeXmlEntities(tm[1] ?? '')).join('')
    } else if (t === 's') {
      const vm = /<v[^>]*>([\s\S]*?)<\/v>/i.exec(body)
      const idx = Number(vm?.[1] ?? '')
      value = Number.isFinite(idx) ? (shared[idx] ?? '') : ''
    } else {
      const vm = /<v[^>]*>([\s\S]*?)<\/v>/i.exec(body)
      value = vm ? decodeXmlEntities(vm[1] ?? '') : ''
    }
    if (!value.trim()) continue
    if (parsed.row > MAX_MEMBER_IMPORT_ROWS || parsed.col > 100) {
      throw new Error(`Use at most ${MAX_MEMBER_IMPORT_ROWS} data rows and 101 columns`)
    }
    grid.set(`${parsed.row}:${parsed.col}`, value)
    maxRow = Math.max(maxRow, parsed.row)
    maxCol = Math.max(maxCol, parsed.col)
  }
  const rows: string[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxCol; c++) {
      row.push(grid.get(`${r}:${c}`) ?? '')
    }
    rows.push(row)
  }
  return rows
}

function parseXlsxBytes(bytes: Uint8Array): string[][] {
  let expandedSize = 0
  const files = unzipSync(bytes, { filter: (entry) => {
    if (!entry.name.startsWith('xl/') || !/\.(xml|rels)$/.test(entry.name)) return false
    expandedSize += entry.originalSize
    if (expandedSize > 20 * 1024 * 1024) throw new Error('Spreadsheet is too large when expanded')
    return true
  } })
  const decoder = new TextDecoder()
  let shared: string[] = []
  const ss = files['xl/sharedStrings.xml']
  if (ss) shared = parseSharedStrings(decoder.decode(ss))
  const workbook = decoder.decode(files['xl/workbook.xml'])
  const firstSheet = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1]
  const relationships = decoder.decode(files['xl/_rels/workbook.xml.rels'])
  const relationship = [...relationships.matchAll(/<Relationship\b[^>]*>/g)]
    .find(([tag]) => /\bId="([^"]+)"/.exec(tag)?.[1] === firstSheet)
  const target = relationship ? /\bTarget="([^"]+)"/.exec(relationship[0])?.[1] : undefined
  const sheetPath = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`) : 'xl/worksheets/sheet1.xml'
  const sheet = files[sheetPath]
  if (!sheet) throw new Error('Spreadsheet has no worksheet')
  return parseSheetRows(decoder.decode(sheet), shared)
}

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cur)
      cur = ''
      continue
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      rows.push(row)
      row = []
      continue
    }
    cur += ch
  }
  if (inQuotes) throw new Error('CSV contains an unclosed quoted field')
  row.push(cur)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

function normalizeRole(raw: string): InstanceRole {
  const r = raw.trim().toLowerCase()
  if (r === 'admin' || r === 'administrator') return 'admin'
  if (r === 'editor' || r === 'edit' || r === 'member') return 'editor'
  if (r === 'viewer' || r === 'view' || r === 'read' || r === 'readonly') return 'viewer'
  if (r === 'agent') return 'agent'
  if (r === 'owner') {
    throw new Error('role "owner" cannot be assigned via import — use admin, editor, or viewer')
  }
  if (!r) return 'editor'
    throw new Error(`invalid role "${raw}" (use admin, editor, agent, or viewer)`)
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Parse an .xlsx or .csv members file into validated rows. */
export async function parseMembersImportFile(file: File, options: { allowAgent?: boolean } = {}): Promise<MemberImportRow[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB')
  const name = file.name.toLowerCase()
  let grid: string[][]
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    grid = parseCsvText(await file.text())
  } else if (name.endsWith('.xlsx')) {
    const buf = new Uint8Array(await file.arrayBuffer())
    grid = parseXlsxBytes(buf)
  } else {
    throw new Error('Choose an .xlsx or .csv file')
  }
  if (!grid.length) throw new Error('Spreadsheet is empty')

  const header = grid[0]!.map(normalizeHeader)
  const emailIdx = header.findIndex((h) => h === 'email' || h === 'e-mail' || h === 'mail')
  if (emailIdx < 0) {
    throw new Error('Missing required column: email')
  }
  const idx = (keys: string[]) => header.findIndex((h) => keys.includes(h))
  const displayIdx = idx(['display_name', 'name', 'full_name'])
  const roleIdx = idx(['role', 'access', 'access_role'])
  const jobIdx = idx(['job_title', 'title', 'job'])
  const phoneIdx = idx(['phone', 'mobile', 'tel'])
  const deptIdx = idx(['department', 'dept', 'team'])
  const notesIdx = idx(['notes', 'note', 'comment'])

  const out: MemberImportRow[] = []
  const seen = new Map<string, number>()
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r] ?? []
    const email = (cells[emailIdx] ?? '').trim()
    if (!cells.some((cell) => cell.trim())) continue
    if (!email) throw new Error(`Row ${r + 1}: email is required`)
    if (!isEmail(email)) {
      throw new Error(`Row ${r + 1}: invalid email "${email}"`)
    }
    let role: InstanceRole = 'editor'
    try {
      role = normalizeRole(roleIdx >= 0 ? (cells[roleIdx] ?? '') : 'editor')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'invalid role'
      throw new Error(`Row ${r + 1}: ${msg}`)
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new Error(`Row ${r + 1}: role must be admin, editor, or viewer`)
    }
    if (role === 'agent' && !options.allowAgent) {
      throw new Error(`Row ${r + 1}: agent access is not enabled for this organisation`)
    }
    const previous = seen.get(email.toLowerCase())
    if (previous) throw new Error(`Row ${r + 1}: duplicate email "${email}" (also on row ${previous})`)
    seen.set(email.toLowerCase(), r + 1)
    if (out.length >= MAX_MEMBER_IMPORT_ROWS) throw new Error(`Import at most ${MAX_MEMBER_IMPORT_ROWS} users at a time`)
    out.push({
      email: email.toLowerCase(),
      display_name: displayIdx >= 0 ? (cells[displayIdx] ?? '').trim() : '',
      role,
      job_title: jobIdx >= 0 ? (cells[jobIdx] ?? '').trim() : '',
      phone: phoneIdx >= 0 ? (cells[phoneIdx] ?? '').trim() : '',
      department: deptIdx >= 0 ? (cells[deptIdx] ?? '').trim() : '',
      notes: notesIdx >= 0 ? (cells[notesIdx] ?? '').trim() : '',
      rowNumber: r + 1,
    })
  }
  if (!out.length) throw new Error('No data rows found (email is required on each row)')
  return out
}

export function pickMembersImportFile(options: { allowAgent?: boolean } = {}): Promise<{ file: File; rows: MemberImportRow[] } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
    input.style.display = 'none'
    input.addEventListener('cancel', () => {
      input.remove()
      resolve(null)
    }, { once: true })
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      parseMembersImportFile(file, options)
        .then((rows) => resolve({ file, rows }))
        .catch(reject)
    })
    document.body.appendChild(input)
    input.click()
  })
}
