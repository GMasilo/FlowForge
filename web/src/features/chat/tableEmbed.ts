export type ChatTable = { columns: string[]; rows: string[][] }
export function tabulate(value: unknown): ChatTable {
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { throw new Error('tabulate needs records, not a file URL. Import the Excel file first and use its records.') } }
  if (value === undefined || value === null) throw new Error('No records were supplied. Check the variable name and that the preceding step stores its result in that variable.')
  // Entity/API and Excel outputs may carry a records envelope. Cells remain flat.
  if (typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'records') && Array.isArray((value as { records?: unknown }).records)) value = (value as { records: unknown[] }).records
  const records = Array.isArray(value) ? value : [value]
  if (records.length > 1000) throw new Error('tabulate supports up to 1,000 rows. Filter the records first.')
  const columns = new Set<string>()
  for (const row of records) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('tabulate needs a flat object or an array of flat objects.')
    for (const [key, cell] of Object.entries(row)) {
      if (cell !== null && typeof cell === 'object') throw new Error(`Column "${key}" contains a nested object or array. Select flat columns in the Entity step before calling tabulate.`)
      columns.add(key)
    }
  }
  if (columns.size > 100) throw new Error('tabulate supports up to 100 columns.')
  const names = [...columns]
  const table = { columns: names, rows: records.map(row => names.map(key => Object.hasOwn(row as object, key) ? String((row as Record<string, unknown>)[key] ?? '') : '')) }
  if (JSON.stringify(table).length > 1000000) throw new Error('Table is too large. Filter the records first.')
  return table
}
export function encodeTable(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(tabulate(value)))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `<<ff:table:${btoa(binary)}>>`
}
export function decodeTable(encoded: string): ChatTable | null {
  try {
    if (encoded.length > 6000000) return null
    const table = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)))) as ChatTable
    if (!Array.isArray(table.columns) || table.columns.length > 100 || !table.columns.every(c => typeof c === 'string') || !Array.isArray(table.rows) || table.rows.length > 1000 || !table.rows.every(r => Array.isArray(r) && r.length === table.columns.length && r.every(c => typeof c === 'string'))) return null
    return table
  } catch { return null }
}
