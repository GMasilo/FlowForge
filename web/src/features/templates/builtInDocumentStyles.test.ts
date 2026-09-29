import {expect,it} from 'vitest'
import {PDFDocument} from 'pdf-lib'
import {starterTemplateContent, type DocumentContent} from './templateModel'
import {fillDocumentSnapshot} from './documentFill'
import {generateDocumentFile} from './documentGenerate'
for(const kind of ['agreement','certificate','checklist'] as const) it(`${kind} retains its bindings and exports portrait A4`,async()=>{
 const content=starterTemplateContent(kind) as DocumentContent
 expect(content.inputs.length).toBeGreaterThan(0)
 const values:Record<string,unknown>={company_name:'Summit Services',signer_name:'Alex Student',signer_email:'alex@example.invalid',scope:'Orientation and student support services.',signed_at:'2026-09-28',recipient:'Alex Student',course:'Introduction to digital services',date:'2026-09-28',title:'Ready for orientation',items:[{item:'Activate portal',status:'Done'},{item:'Review timetable',status:'Pending'}]}
 const text=(s:string)=>s.replace(/\{\{inputs\.(\w+)\}\}/g,(_,key)=>String(values[key]??''))
 const result=await generateDocumentFile(fillDocumentSnapshot(content,text,s=>values[/inputs\.(\w+)/.exec(s)?.[1]??'']??s,{}))
 const pdf=await PDFDocument.load(result.bytes)
 expect(pdf.getPageCount()).toBe(kind==='agreement'?2:1)
 for(const page of pdf.getPages()){expect(page.getWidth()).toBeCloseTo(595.28,1);expect(page.getHeight()).toBeCloseTo(841.89,1)}
})
