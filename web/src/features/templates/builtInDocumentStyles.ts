import { emptyDocumentBlock } from './documentLayout'
import type { DocumentBlock, DocumentContent } from './templateModel'
export function styleBuiltInDocument(kind: string, content: DocumentContent): DocumentContent {
 const block=(type:DocumentBlock['type'],y:number,patch:Partial<DocumentBlock>):DocumentBlock=>({...emptyDocumentBlock(type,y),y,...patch})
 if(kind==='checklist')return {...content,orientation:'portrait',intro:'YOUR ACTION PLAN\nWork through each item, record its status and review any outstanding actions before completing the checklist.',body:'',footer:'Review outstanding items with the responsible person. Keep this checklist for your records.'}
 if(kind==='certificate')return {...content,layout:'page',orientation:'portrait',blocks:[
  block('divider',8,{color:'#b45309',h:0.6}),
  block('heading',15,{text:'CERTIFICATE',fontSize:30,align:'center',fontFamily:'times',h:7}),
  block('text',24,{text:'OF COMPLETION',fontSize:13,align:'center',color:'#b45309',h:4}),
  block('text',35,{text:'This certificate is presented to',fontSize:12,align:'center',color:'#64748b',h:5}),
  block('heading',44,{text:'{{inputs.recipient}}',fontSize:27,align:'center',fontFamily:'times',h:10}),
  block('text',58,{text:'In recognition of successful completion of',fontSize:12,align:'center',h:5}),
  block('heading',65,{text:'{{inputs.course}}',fontSize:18,align:'center',color:'#b45309',h:10}),
  block('field',80,{label:'Completion date',value:'{{inputs.date}}',fontSize:11,align:'center',h:5}),
  block('divider',90,{color:'#b45309',h:0.4}),
  block('text',94,{text:content.footer,fontSize:9,align:'center',color:'#64748b',h:3}),
 ]}
 return {...content,layout:'page',orientation:'portrait',blocks:[
  block('heading',7,{text:'SERVICE AGREEMENT',fontSize:11,color:'#0f766e',h:4}),
  block('heading',15,{text:'A clear commitment.',fontSize:27,h:8}),
  block('text',26,{text:content.intro,fontSize:11,color:'#475569',h:9}),
  block('field',38,{label:'Provider',value:'{{inputs.company_name}}',h:6}),
  block('field',46,{label:'Prepared for',value:'{{inputs.signer_name}}',h:6}),
  block('field',54,{label:'Email',value:'{{inputs.signer_email}}',h:6}),
  block('heading',65,{text:'Scope of service',fontSize:16,color:'#0f766e',h:5}),
  block('text',73,{text:'{{inputs.scope}}',fontSize:11,h:18}),
  block('text',95,{text:'SERVICE AGREEMENT / 01',fontSize:8,color:'#64748b',h:3}),
  block('heading',8,{page:2,text:'Review and acceptance',fontSize:24,h:8}),
  block('text',22,{page:2,text:content.body,fontSize:11,h:38}),
  block('image',65,{page:2,label:'Signature',value:'{{inputs.signature}}',w:50,h:16}),
  block('field',84,{page:2,label:'Date signed',value:'{{inputs.signed_at}}',h:5}),
  block('text',95,{page:2,text:'Keep a copy for your records. / 02',fontSize:8,color:'#64748b',h:3}),
 ]}
}
