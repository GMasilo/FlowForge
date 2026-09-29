import { expect, it } from 'vitest'
import { buildFilledTable, fillDocumentSnapshot } from './documentFill'
import { emptyTemplateContent, parseDocumentContent, type DocumentContent } from './templateModel'
import { emptyDocumentBlock } from './documentLayout'
import { generateDocumentFile } from './documentGenerate'
import { PDFDocument } from 'pdf-lib'
import { mkdirSync, writeFileSync } from 'node:fs'
it('sums numeric columns and retains total settings through parsing', () => {
  const columns = [{ key: 'name', label: 'Item' }, { key: 'amount', label: 'Amount', total: true }]
  expect(buildFilledTable([{ name: 'A', amount: 0.1 }, { name: 'B', amount: 0.2 }], columns)?.rows.at(-1)).toEqual(['Total', '0.30'])
  expect(() => buildFilledTable([{ amount: 'USD 2' }], columns)).toThrow('plain numbers')
  expect(parseDocumentContent({ tableColumns: columns }).tableColumns[1].total).toBe(true)
})
it('appends a long table after designed PDF pages with automatic continuation', async () => {
  const content: DocumentContent = { ...emptyTemplateContent('document') as DocumentContent, layout: 'page', title: 'Service invoice', blocks: [{ ...emptyDocumentBlock('heading', 10), text: 'Service invoice' }], tableRowsSource: '{{inputs.lines}}', tableColumns: [{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', total: true }] }
  const rows = Array.from({ length: 80 }, (_, index) => ({ description: `Service item ${index + 1}: detailed delivery and customer support`, amount: 25 }))
  const filled = fillDocumentSnapshot(content, s => s, () => rows, {})
  const file = await generateDocumentFile(filled)
  const pdf = await PDFDocument.load(file.bytes)
  expect(pdf.getPageCount()).toBeGreaterThan(2)
  expect(filled.table?.rows.at(-1)).toEqual(['Total', '2000.00'])
  if (process.env.BUILD_TABLE_SAMPLE === '1') { mkdirSync('tmp/pdfs', { recursive: true }); writeFileSync('tmp/pdfs/dynamic-table.pdf', file.bytes) }
})
