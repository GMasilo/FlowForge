import {afterEach,expect,it,vi} from 'vitest'
import {interpolateTemplate,interpolateTemplateForKey} from './expressionEval'
import {starterTemplateContent,templateExprValue} from '@/features/templates/templateModel'
import {decodeDocumentEmbed,FF_DOC_OPEN,FF_DOC_CLOSE} from '@/features/templates/documentFill'
afterEach(()=>vi.useRealTimers())
it('formats the supported UTC clock expression',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-28T12:00:00Z'))
 expect(interpolateTemplate('Completion date: {{formatDate(utcNow(), "yyyy-MM-dd")}}.',{vars:{},steps:{}})).toBe('Completion date: 2026-09-28.')
})
it('step input bindings override inherited inputs, including blanks and expressions',()=>{
 const ctx={vars:{name:'Step value'},steps:{},inputs:{name:'Template value',note:'Old note'},templateBindings:{cert:{name:'{{vars.name}}',note:''}}}
 expect(interpolateTemplateForKey('{{inputs.name}} / {{inputs.note}}',ctx,'cert')).toBe('Step value / ')
 expect(ctx.inputs.name).toBe('Template value')
})
it('uses step inputs when filling a downloadable certificate',()=>{
 const tpl=templateExprValue({id:'1',key:'cert',name:'Certificate',kind:'certificate',content:starterTemplateContent('certificate')})
 const output=interpolateTemplate('{{templates.cert.file}}',{vars:{},steps:{},embedMedia:true,inputs:{recipient:'Template recipient'},templates:{cert:tpl},templateBindings:{cert:{recipient:'Step recipient',course:'Flow design',date:'2026-09-28'}}})
 const start=output.indexOf(FF_DOC_OPEN)+FF_DOC_OPEN.length
 const filled=decodeDocumentEmbed(output.slice(start,output.indexOf(FF_DOC_CLOSE,start)))
 expect(filled?.blocks.some(block=>block.text==='Step recipient')).toBe(true)
 expect(filled?.blocks.some(block=>block.text==='Template recipient')).toBe(false)
})

for (const clock of ['utcNow']) {
 for (const mode of ['inline', 'binding']) it(`renders ${clock} in document ${mode}`,()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-28T12:00:00Z'))
  const content=starterTemplateContent('certificate') as import('@/features/templates/templateModel').DocumentContent
  const expression=`{{formatDate(${clock}(), "yyyy-MM-dd")}}`
  const dateBlock=content.blocks.find(block=>block.type==='field')!
  if(mode==='inline')dateBlock.value=expression
  const tpl=templateExprValue({id:'1',key:'cert',name:'Certificate',kind:'certificate',content})
  const output=interpolateTemplate('{{templates.cert.file}}',{vars:{},steps:{},embedMedia:true,templates:{cert:tpl},templateBindings:{cert:{date:expression}}})
  const start=output.indexOf(FF_DOC_OPEN)+FF_DOC_OPEN.length
  const filled=decodeDocumentEmbed(output.slice(start,output.indexOf(FF_DOC_CLOSE,start)))
  expect(filled?.blocks.find(block=>block.id===dateBlock.id)?.text).toBe('2026-09-28')
 })
}

it('rejects unknown functions in copy and bound document inputs',()=>{
 const invalid='{{formatDate(uctNow(), "yyyy-MM-dd")}}'
 expect(()=>interpolateTemplate(invalid,{vars:{},steps:{}})).toThrow('Unknown function "uctNow"')
 expect(()=>interpolateTemplateForKey('{{inputs.date}}',{vars:{},steps:{},templateBindings:{cert:{date:invalid}}},'cert')).toThrow('Unknown function "uctNow"')
 expect(()=>interpolateTemplate('{{doesNotExist()}}',{vars:{},steps:{}})).toThrow('available functions list')
})
