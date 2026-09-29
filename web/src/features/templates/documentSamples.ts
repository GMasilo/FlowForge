import { emptyDocumentBlock } from './documentLayout'
import { emptyTemplateContent, type DocumentBlock, type DocumentContent } from './templateModel'

export const DOCUMENT_SAMPLES = [
  { id: 'student-welcome', name: 'Student welcome guide', brand: 'SUMMIT UNIVERSITY', title: 'Your journey starts here.', subtitle: '2027 STUDENT EXPERIENCE / WELCOME EDITION', accent: '#0f766e', description: 'A polished welcome guide with an orientation schedule, support contacts and a readiness checklist.', summary: 'Welcome to Summit, Alex. Your first weeks are about finding your people, exploring your programme and building routines that help you thrive. Keep this guide close as you prepare for campus life.', stats: ['03 / DAYS OF DISCOVERY', '12 / STUDENT SOCIETIES', '01 / COMMUNITY'], sections: [
    ['Your first week', 'Monday, 09:00 - Campus welcome and student services tour.\nTuesday, 10:00 - Meet your faculty and explore the learning portal.\nWednesday, 14:00 - Clubs, mentoring and a student-life showcase.'],
    ['Arrive ready', 'Bring your orientation invitation and a notebook. Review your programme timetable, activate your student portal and plan your travel. Ask the welcome desk for accessible routes or appointment support.'],
    ['People in your corner', 'Student services: welcome@summit.example\nAcademic support: advising@summit.example\nVisit the student hub between 08:00 and 16:00, Monday to Friday.'],
  ], takeaway: 'YOUR NEXT STEP\nConfirm your orientation session and write down one question for your adviser.' },
  { id: 'service-impact', name: 'Service impact report', brand: 'NORTHSTAR SERVICE STUDIO', title: 'A month of better service.', subtitle: 'SEPTEMBER 2026 / OPERATIONS BRIEF', accent: '#1d4ed8', description: 'An executive report with headline metrics, findings and a practical action plan.', summary: 'The September pilot simplified enquiry handling across three service teams. Clearer routing and a shared knowledge base helped customers reach the right support sooner. The figures below are fictional sample data.', stats: ['1,240 / REQUESTS', '92% / WITHIN TARGET', '4.6 / SATISFACTION'], sections: [
    ['What changed', 'Routine enquiries moved into guided self-service. Complex requests kept a clear route to an adviser, with the conversation context attached. Teams reviewed unanswered questions every Friday.'],
    ['What we learned', 'The most frequent friction was unclear document requirements. Customers completed requests more confidently when shown an example and a short checklist. Evening demand remained higher than expected.'],
    ['Next month: three priorities', '01  Rewrite the five most-used document checklists.\n02  Test evening callback slots with the support team.\n03  Review unresolved requests weekly and report the outcome.'],
  ], takeaway: 'DECISION REQUESTED\nApprove a four-week follow-up pilot with a named owner for each priority.' },
  { id: 'project-proposal', name: 'Digital service proposal', brand: 'LUMEN DIGITAL', title: 'Make every interaction count.', subtitle: 'PROJECT OUTLINE / PREPARED FOR ACME SERVICES', accent: '#7c3aed', description: 'A client-ready project outline with objectives, delivery phases and success measures.', summary: 'A six-week discovery and pilot programme to create a consistent service journey. The proposal brings customer research, guided conversations and human support into one measurable experience. This is an illustrative proposal, not a contract.', stats: ['06 / WEEKS', '03 / DELIVERY PHASES', '01 / SHARED ROADMAP'], sections: [
    ['The opportunity', 'Reduce repetitive enquiries and make complex requests easier to complete. Start with one high-volume service, establish a baseline and improve the experience through a small, measurable pilot.'],
    ['How we deliver', 'Weeks 1-2 / Discover: interview teams and map the current journey.\nWeeks 3-4 / Build: prototype the flow, content and handoff process.\nWeeks 5-6 / Pilot: test with users, review outcomes and refine.'],
    ['How success is measured', 'Track completion rate, time to resolution and customer feedback. Compare pilot results with the baseline, document accessibility findings and agree which improvements should move into the next release.'],
  ], takeaway: 'LET US START\nConfirm your service owner and arrange a 45-minute discovery workshop.' },
] as const

export function createDocumentSample(id: string): DocumentContent {
  const sample = DOCUMENT_SAMPLES.find(s => s.id === id) ?? DOCUMENT_SAMPLES[0]
  const block = (type: DocumentBlock['type'], y: number, patch: Partial<DocumentBlock>): DocumentBlock => ({...emptyDocumentBlock(type,y),y,...patch})
  const blocks: DocumentBlock[] = [
    block('heading',6,{text:sample.brand,fontSize:11,color:sample.accent,h:3}),
    block('text',11,{text:sample.subtitle,fontSize:9,color:'#64748b',h:3}),
    block('heading',17,{text:sample.title,fontSize:28,h:10,w:86}),
    block('text',29,{text:sample.summary,fontSize:11,h:11,color:'#334155'}),
    ...sample.stats.map((text,i)=>block('heading',42,{x:8+i*29,w:26,h:6,text,fontSize:10,color:sample.accent,fill:'#f1f5f9'})),
    ...sample.sections.flatMap(([heading,text],i)=>[
      block('heading',51+i*11,{text:heading,fontSize:13,color:sample.accent,h:3}),
      block('text',55+i*11,{text,fontSize:10,h:7}),
    ]),
    block('text',86,{text:sample.takeaway,fontSize:10,bold:true,color:sample.accent,fill:'#f1f5f9',h:7}),
    block('divider',95,{color:'#cbd5e1'}),
    block('text',96,{text:'FICTIONAL SAMPLE  /  FLOWFORGE DOCUMENTS                                            01',fontSize:8,color:'#64748b',h:2}),
  ]
  return {...emptyTemplateContent('document') as DocumentContent,format:'pdf',filename:sample.id+'.pdf',title:sample.name,layout:'page',orientation:'portrait',fields:[],blocks}
}

