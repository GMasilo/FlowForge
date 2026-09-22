/** Run: node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.app.json src/features/instances/membersExcel.check.ts */
import { buildMembersXlsx, MEMBER_IMPORT_HEADERS, parseMembersImportFile } from './membersExcel'
import { importMemberRows } from './membersImport'
import { unzipSync, zipSync } from 'fflate'

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

const csv = (text: string) => new File([text], 'users.csv', { type: 'text/csv' })
async function rejects(file: File, message: string) {
  try { await parseMembersImportFile(file) } catch (error) {
    assert(error instanceof Error && error.message.includes(message), `Expected ${message}, got ${error}`)
    return
  }
  throw new Error(`Expected rejection: ${message}`)
}

const bytes = buildMembersXlsx([
  [...MEMBER_IMPORT_HEADERS],
  ['JANE@example.com', 'Jane & <Sam> "Doe" 😀', 'admin', 'Lead', '+27 0123', 'R&D', 'One\nTwo'],
])
const rows = await parseMembersImportFile(new File([Uint8Array.from(bytes)], 'users.xlsx'))
assert(rows.length === 1 && rows[0]!.email === 'jane@example.com', 'XLSX normalizes email')
assert(rows[0]!.display_name === 'Jane & <Sam> "Doe" 😀', 'XML text round trips')
assert(rows[0]!.phone === '+27 0123' && rows[0]!.notes === 'One\nTwo', 'phone and multiline notes preserved')

const archive = unzipSync(bytes)
archive['xl/worksheets/custom.xml'] = new TextEncoder().encode('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="inlineStr"><is><r><t>Jane </t></r><r><t>&amp; Sam</t></r></is></c></row><row r="1048576"><c r="XFD1048576"/></row></sheetData></worksheet>')
archive['xl/sharedStrings.xml'] = new TextEncoder().encode('<sst><si><t>email</t></si><si><t>shared@example.com</t></si></sst>')
archive['xl/_rels/workbook.xml.rels'] = new TextEncoder().encode('<Relationships><Relationship Target="/xl/worksheets/custom.xml" Id="rId1"/></Relationships>')
const shared = await parseMembersImportFile(new File([Uint8Array.from(zipSync(archive))], 'excel.xlsx'))
assert(shared[0]!.email === 'shared@example.com', 'Workbook relationships and shared strings supported; trailing formatting ignored')

const parsed = await parseMembersImportFile(csv('\uFEFFEmail,Full Name,Role,Notes\r\n\r\nA@example.com,"A, B",,"line 1\nline 2"\r\n'))
assert(parsed[0]!.role === 'editor' && parsed[0]!.rowNumber === 3, 'Default role and blank row numbers')
assert(parsed[0]!.display_name === 'A, B' && parsed[0]!.notes === 'line 1\nline 2', 'Quoted CSV fields')
await rejects(csv('email\na@example.com\nA@example.com'), 'duplicate email')
await rejects(csv('email,name\n,Missing'), 'Row 2: email is required')
await rejects(csv('email\ninvalid'), 'invalid email')
await rejects(csv('email,role\na@example.com,owner'), 'owner')
await rejects(csv('email,role\na@example.com,agent'), 'not enabled')
await rejects(csv('email\n"unclosed'), 'unclosed')
await rejects(csv('name\nJane'), 'Missing required column')
await rejects(csv('email\n'), 'No data rows')
await rejects(new File(['x'], 'users.xls'), '.xlsx or .csv')
await rejects(csv('email\n' + Array.from({ length: 1001 }, (_, i) => `u${i}@example.com`).join('\n')), 'at most 1000')
const agent = await parseMembersImportFile(csv('email,role\na@example.com,agent'), { allowAgent: true })
assert(agent[0]!.role === 'agent', 'Agent role accepted when enabled')

const batch = ['existing', 'added', 'invited', 'mailfail', 'rejected', 'network', 'last'].map((name, i) => ({
  ...rows[0]!, email: `${name}@example.com`, rowNumber: i + 2,
}))
const calls: string[] = []
const progress: number[] = []
const results = await importMemberRows(batch, new Set(['EXISTING@example.com']), async (row) => {
  calls.push(row.email)
  if (row.email.startsWith('network')) throw new Error('Network unavailable')
  if (row.email.startsWith('rejected')) return { ok: false, status: '', error: 'Seat limit reached' }
  if (row.email.startsWith('mailfail')) return { ok: true, status: 'invited', email_sent: false, email_error: 'Mail unavailable' }
  if (row.email.startsWith('invited')) return { ok: true, status: 'invited', email_sent: true }
  return { ok: true, status: 'added' }
}, (completed) => progress.push(completed))
assert(calls.length === 6 && !calls.includes('existing@example.com'), 'Existing users skipped without requests')
assert(results.map((r) => r.outcome).join(',') === 'skipped,saved,saved,warning,failed,failed,saved', 'Partial results and email failures distinguished')
assert(progress.join(',') === '1,2,3,4,5,6,7', 'Progress includes every row')
console.log('membersExcel.check.ts: all checks passed')
