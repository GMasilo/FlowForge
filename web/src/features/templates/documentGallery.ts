import { createInvoiceDocument } from './invoiceDocument'
import { DOCUMENT_SAMPLES, createDocumentSample } from './documentSamples'
import { starterTemplateContent, type DocumentContent } from './templateModel'
export const DOCUMENT_GALLERY = [
 {id:'invoice',kind:'document' as const,name:'Invoice',description:'An editable A4 invoice with billing details, three item rows, totals, payment instructions and a notes page. Supply calculated amounts through step inputs.'},
 ...DOCUMENT_SAMPLES.map(sample=>({...sample,kind:'document' as const})),
 {id:'agreement',kind:'agreement' as const,name:'Agreement',description:'A structured two-page service agreement with parties, scope and signature sections.'},
 {id:'certificate',kind:'certificate' as const,name:'Certificate',description:'A formal A4 portrait certificate with gold accents and recipient details.'},
 {id:'checklist',kind:'checklist' as const,name:'Checklist',description:'A clear action checklist with item statuses and automatic page continuation.'},
]
export type DocumentGallerySample = typeof DOCUMENT_GALLERY[number]
export function createGalleryDocument(sample:DocumentGallerySample):DocumentContent {
 if (sample.id === 'invoice') return createInvoiceDocument()
 return sample.kind==='document' ? createDocumentSample(sample.id) : starterTemplateContent(sample.kind) as DocumentContent
}
