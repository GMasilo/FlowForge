import { expect, it } from 'vitest'
import { PDFDocument, PDFName } from 'pdf-lib'
import { DOCUMENT_DESIGNS, applyDocumentDesign } from './documentDesigns'
import { starterTemplateContent, type DocumentContent } from './templateModel'
import { fillDocumentSnapshot } from './documentFill'
import { generateDocumentFile } from './documentGenerate'
for (const design of DOCUMENT_DESIGNS) it(`generates ${design.name} as A4 portrait with embedded image`,async()=>{
 const content=applyDocumentDesign(starterTemplateContent('document') as DocumentContent,design.id)
 const image=content.blocks.find(b=>b.type==='image')!
 image.value='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
 const filled=fillDocumentSnapshot(content,s=>s,s=>s,{})
 const result=await generateDocumentFile(filled)
 const pdf=await PDFDocument.load(result.bytes)
 expect(pdf.getPageCount()).toBe(1)
 expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28,1)
 expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89,1)
 expect(pdf.getPage(0).node.Resources()?.has(PDFName.of('XObject'))).toBe(true)
 for(const b of content.blocks){expect(b.y+b.h).toBeLessThanOrEqual(100);expect(b.x+b.w).toBeLessThanOrEqual(100)}
})
