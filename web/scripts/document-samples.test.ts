import { INVOICE_SAMPLE_INPUTS } from '../src/features/templates/invoiceDocument'
import {it,expect} from 'vitest'
import {mkdirSync,writeFileSync} from 'node:fs'
import {DOCUMENT_GALLERY,createGalleryDocument} from '../src/features/templates/documentGallery'
import {fillDocumentSnapshot} from '../src/features/templates/documentFill'
import {generateDocumentFile} from '../src/features/templates/documentGenerate'
import {PDFDocument} from 'pdf-lib'
const values:Record<string,unknown>={company_name:'Summit Services',signer_name:'Alex Morgan',signer_email:'alex@example.invalid',scope:'Provide an orientation workshop, a practical guide and a follow-up support session.',signed_at:'28 September 2026',recipient:'Alex Morgan',course:'Digital Service Foundations',date:'28 September 2026',title:'Ready for orientation',items:[{item:'Activate your student portal',status:'Complete'},{item:'Review the programme timetable',status:'Complete'},{item:'Confirm your orientation session',status:'Pending'},{item:'Prepare questions for your adviser',status:'Pending'},{item:'Check travel and accessibility arrangements',status:'Pending'}]}
for(const sample of DOCUMENT_GALLERY) it(sample.name,async()=>{
 const document=createGalleryDocument(sample)
 const sampleValues = sample.id === 'invoice' ? INVOICE_SAMPLE_INPUTS : values
 const result=await generateDocumentFile(fillDocumentSnapshot(document,
  s=>s.replace(/\{\{inputs\.(\w+)\}\}/g,(_,key)=>String(sampleValues[key]??'')),
  s=>sampleValues[/inputs\.(\w+)/.exec(s)?.[1]??'']??s,{}))
 const pdf=await PDFDocument.load(result.bytes)
 expect(pdf.getPageCount()).toBe(sample.kind==='agreement'||sample.id==='invoice'?2:1)
 expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89)
 if(process.env.BUILD_DOCUMENT_SAMPLES==='1'){
  const folder=new URL('../public/samples/documents/',import.meta.url)
  mkdirSync(folder,{recursive:true});writeFileSync(new URL(sample.id+'.pdf',folder),result.bytes)
 }
})

