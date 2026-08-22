/**
 * Manual check: npx tsx --tsconfig tsconfig.app.json src/features/entities/entityExcel.check.ts
 */
import {
  buildEntityRecordsXlsx,
  parseEntitySpreadsheet,
} from '@/features/entities/entityExcel'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const attrs = [
  { key: 'sku', label: 'SKU', value_type: 'string' as const },
  { key: 'price', label: 'Price', value_type: 'number' as const },
  { key: 'active', label: 'Active', value_type: 'boolean' as const },
]

const records = [
  { id: 'r1', values: { sku: 'A-1', price: 9.5, active: true } },
  { id: 'r2', values: { sku: 'B-2', price: 12, active: false } },
]

const bytes = buildEntityRecordsXlsx({
  entityName: 'Products',
  attributes: attrs,
  records,
})

assert(bytes.byteLength > 100, 'xlsx has content')
assert(bytes[0] === 0x50 && bytes[1] === 0x4b, 'xlsx is a zip')

const xlsxCopy = Uint8Array.from(bytes)
const file = new File([xlsxCopy], 'Products.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
const parsed = parseEntitySpreadsheet(file, xlsxCopy)

assert(parsed.columns.length === 3, 'three columns')
assert(parsed.columns[0]?.key === 'sku', 'sku key')
assert(parsed.columns[1]?.value_type === 'number', 'price type from type row')
assert(parsed.columns[2]?.value_type === 'boolean', 'active type from type row')
assert(parsed.rows.length === 2, 'two data rows')
assert(parsed.rows[0]?.sku === 'A-1', 'first sku')
assert(parsed.rows[0]?.price === '9.5', 'first price as string cell')
assert(parsed.rows[1]?.active === 'false', 'second active')

const csvText = 'Name,Qty\nstring,number\nWidget,3\nGadget,1\n'
const csvBytes = new TextEncoder().encode(csvText)
const csvFile = new File([csvBytes], 'catalog.csv', { type: 'text/csv' })
const csvParsed = parseEntitySpreadsheet(csvFile, csvBytes, csvText)
assert(csvParsed.columns[0]?.key === 'Name', 'csv header key')
assert(csvParsed.columns[1]?.value_type === 'number', 'csv type row')
assert(csvParsed.rows.length === 2 && csvParsed.rows[0]?.Name === 'Widget', 'csv row')

console.log('entityExcel.check.ts: ok')
