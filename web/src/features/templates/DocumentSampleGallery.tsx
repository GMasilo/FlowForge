import { useState } from 'react'
import { DocumentSamplePreview } from './DocumentSamplePreview'
import { DOCUMENT_GALLERY, createGalleryDocument, type DocumentGallerySample } from './documentGallery'
import type { DocumentContent } from './templateModel'
import { Button } from '@/shared/ui/button'
export function DocumentSampleGallery({search,onChoose}:{search:string;onChoose:(sample:DocumentGallerySample,content:DocumentContent)=>void}){
 const [preview, setPreview] = useState<DocumentGallerySample | null>(null)
 const samples=DOCUMENT_GALLERY.filter(sample=>`${sample.name} ${sample.description} pdf document`.toLowerCase().includes(search.toLowerCase()))
 if(!samples.length)return null
 return <section className="space-y-3" aria-label="Sample PDF document templates">
  <div><h3 className="font-semibold">Rich PDF documents</h3><p className="text-xs text-[var(--color-ink-muted)]">Ready-made A4 portrait samples. Download a PDF or customise a copy.</p></div>
  <div className="grid gap-3 md:grid-cols-3">{samples.map(sample=><div key={sample.id} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-4">
   <button type="button" aria-label={`Preview ${sample.name}`} onClick={()=>setPreview(sample)} className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]"><img src={`${import.meta.env.BASE_URL}samples/documents/${sample.id}.png`} alt={`${sample.name} page preview`} className="mx-auto w-full max-w-48 rounded border border-slate-200" loading="lazy" /></button>
   <Button type="button" variant="secondary" size="sm" onClick={()=>setPreview(sample)}>Preview full document</Button>
   <h4 className="font-semibold">{sample.name}</h4><p className="flex-1 text-xs text-[var(--color-ink-muted)]">{sample.description}</p>
   <Button type="button" size="sm" onClick={()=>onChoose(sample,createGalleryDocument(sample))}>Use template</Button>
   <a className="text-center text-sm underline" href={`${import.meta.env.BASE_URL}samples/documents/${sample.id}.pdf`} download>Download sample PDF</a>
  </div>)}</div>
 {preview && <DocumentSamplePreview sample={preview} onClose={()=>setPreview(null)} />}
 </section>
}
