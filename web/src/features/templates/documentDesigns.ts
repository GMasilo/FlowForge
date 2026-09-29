import { emptyDocumentBlock } from './documentLayout'
import type { DocumentBlock, DocumentContent } from './templateModel'

export const DOCUMENT_DESIGNS = [
  { id: 'welcome', name: 'Welcome pack', title: 'Your next chapter', accent: '#0f766e', intro: 'Welcome aboard. Everything you need to get started is collected here.', heading: 'Your first steps', body: '1. Review your details and requirements.\n2. Gather the documents you need.\n3. Confirm your next appointment.\n4. Contact your adviser if you need help.' },
  { id: 'report', name: 'Service report', title: 'Progress at a glance', accent: '#1d4ed8', intro: 'A clear summary of the work completed, key findings and recommended next steps.', heading: 'Findings and recommendations', body: 'SUMMARY\nDescribe the outcome and what it means.\n\nRECOMMENDATIONS\nOutline the next actions, their owners and expected completion dates.' },
  { id: 'proposal', name: 'Project proposal', title: 'Ideas into action', accent: '#7c3aed', intro: 'A focused plan that connects your objectives to practical deliverables.', heading: 'Scope and approach', body: 'OBJECTIVES\nDescribe the results you want to achieve.\n\nDELIVERABLES\nList the work included and the agreed milestones.\n\nNEXT STEPS\nConfirm the scope, timeline and project owner.' },
] as const

export function applyDocumentDesign(content: DocumentContent, id: string): DocumentContent {
  const design = DOCUMENT_DESIGNS.find(d => d.id === id) ?? DOCUMENT_DESIGNS[0]
  const block = (type: DocumentBlock['type'], y: number, patch: Partial<DocumentBlock>): DocumentBlock => ({ ...emptyDocumentBlock(type, y), ...patch })
  return { ...content, format: 'pdf', filename: content.filename.replace(/\.[^.]+$/, '') + '.pdf', layout: 'page', orientation: 'portrait', blocks: [
    block('heading', 7, { text: design.name.toUpperCase(), fontSize: 11, color: design.accent, h: 3 }),
    block('heading', 13, { text: design.title, fontSize: 30, h: 8 }),
    block('divider', 23, { color: design.accent, h: 0.5 }),
    block('text', 27, { text: design.intro, fontSize: 13, h: 8, color: '#475569' }),
    block('image', 38, { label: 'Add your cover image', value: '', w: 84, h: 19, fill: '#f1f5f9' }),
    block('heading', 62, { text: design.heading, fontSize: 18, color: design.accent, h: 5 }),
    block('text', 69, { text: design.body, fontSize: 11, h: 20 }),
    block('divider', 93, { color: '#cbd5e1' }),
    block('text', 95, { text: 'Your organisation  |  Contact details', fontSize: 9, color: '#64748b', h: 3 }),
  ] }
}
