import { expect, it } from 'vitest'
import { insertDocumentPage, emptyDocumentBlock, documentPageCount } from './documentLayout'
import { emptyTemplateContent, type DocumentContent } from './templateModel'
import { fillDocumentSnapshot } from './documentFill'
import { generateDocumentFile } from './documentGenerate'
import { PDFDocument } from 'pdf-lib'
it('inserts a page and preserves later pages and their positions', async () => {
  const first = { ...emptyDocumentBlock('text', 8), text: 'First page', page: 1 }
  const last = { ...emptyDocumentBlock('text', 20), text: 'Last page', page: 2 }
  const blocks = insertDocumentPage([first, last], 1, 'portrait')
  expect(blocks[0]).toEqual(first)
  expect(blocks[1]).toEqual({ ...last, page: 3 })
  expect(blocks[2].page).toBe(2)
  expect(documentPageCount(blocks)).toBe(3)
  expect(last.page).toBe(2)
  const content = { ...emptyTemplateContent('document') as DocumentContent, layout: 'page' as const, blocks }
  const file = await generateDocumentFile(fillDocumentSnapshot(content, s => s, s => s, {}))
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBe(3)
})
