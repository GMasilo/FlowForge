import { afterEach, expect, it, vi } from 'vitest'
import { PDFDocument, PDFPage } from 'pdf-lib'
import { buildCanvasPdf } from './exportCanvasPdf'
import type { DesignerNode } from '../model/flowSchema'
afterEach(()=>vi.restoreAllMocks())
it('keeps large negative-coordinate flows and connectors inside the exported page',async()=>{
 const lines=vi.spyOn(PDFPage.prototype,'drawLine')
 const rectangles=vi.spyOn(PDFPage.prototype,'drawRectangle')
 const nodes:DesignerNode[]=[{id:'a',key:'a',label:'Start',type:'message',config:{text:'Hello'},position:{x:-500,y:-1000}},{id:'b',key:'b',label:'Finish',type:'end',config:{},position:{x:400,y:50000}}]
 const bytes=await buildCanvasPdf({title:'Student lifecycle',nodes,edges:[{id:'ab',source:'a',target:'b'}]})
 const pdf=await PDFDocument.load(bytes)
 const page=pdf.getPage(0)
 expect(pdf.getTitle()).toBe('Student lifecycle flow')
 expect(page.getHeight()).toBeLessThanOrEqual(14400)
 expect(lines.mock.calls.length).toBe(5)
 for(const [options] of lines.mock.calls) for(const point of [options!.start!,options!.end!]){
  expect(point.x).toBeGreaterThanOrEqual(0);expect(point.x).toBeLessThanOrEqual(page.getWidth())
  expect(point.y).toBeGreaterThanOrEqual(0);expect(point.y).toBeLessThanOrEqual(page.getHeight())
 }
 for(const [options] of rectangles.mock.calls){
  expect(options!.y!).toBeGreaterThanOrEqual(0)
  expect(options!.y!+options!.height!).toBeLessThanOrEqual(page.getHeight()+0.001)
 }
})
it('exports an empty flow and supplied canvas positions',async()=>{
 expect((await PDFDocument.load(await buildCanvasPdf({title:'Empty',nodes:[],edges:[]}))).getPageCount()).toBe(1)
 const node:DesignerNode={id:'a',key:'a',label:'Question',type:'question',config:{},position:{x:0,y:99999}}
 const pdf=await PDFDocument.load(await buildCanvasPdf({title:'Moved',nodes:[node],edges:[],positions:new Map([['a',{x:0,y:0}]])}))
 expect(pdf.getPage(0).getHeight()).toBeLessThan(1000)
})
