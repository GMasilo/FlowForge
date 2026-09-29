import { describe,it,expect,vi } from 'vitest'
import { expandSubflows, type FlowModule } from './subflows'
import { compareGraphs, contrastRatio, checkContentQuality } from './releaseQuality'
import { redactSensitive, redactChatText, canCheckpointFlow, localizedStepText } from './conversationPrivacy'
import { validateValueAgainstSchema } from '@/features/connections/responseSchema'
import { runAutomatedScenario } from '@/features/designer/preview/automatedScenarios'
import { defaultConfig, type DesignerNode, type DesignerEdge } from '@/features/designer/model/flowSchema'
const node=(id:string,type:DesignerNode['type'],config:Record<string,unknown>={}):DesignerNode=>({id,key:id,label:id,type,config:{...defaultConfig(type),...config},position:{x:0,y:0}})
const edges=(...ids:string[]):DesignerEdge[]=>ids.slice(1).map((id,i)=>({id:`e${i}`,source:ids[i],target:id}))
const module:FlowModule={id:'m',name:'Uppercase',revision:1,inputs:['input'],outputs:['result'],graph:{nodes:[node('upper','operation',{operation:'uppercase',left:'{{vars.input}}',outputVariable:'result'}),node('done','end')],edges:edges('upper','done')}}
const call=(id:string,input:string,output:string)=>node(id,'operation',{operation:'subflow',subflowId:'m',subflowInputs:{input},subflowOutputs:{result:output}})
describe('reusable subflows',()=>{
 it('isolates repeated calls and maps outputs through the actual runtime',()=>{const graph=expandSubflows([call('first','Alex','firstResult'),call('second','Sam','secondResult'),node('end','end')],edges('first','second','end'),[module]);const result=runAutomatedScenario({scenario:{name:'calls',globals:{input:'unchanged'},expected:{values:{firstResult:'ALEX',secondResult:'SAM',input:'unchanged'}}},...graph});expect(result.status).toBe('passed')})
 it('rejects missing inputs, modules and recursive calls',()=>{expect(()=>expandSubflows([call('a','x','out')],[],[])).toThrow('not found');expect(()=>expandSubflows([node('a','operation',{operation:'subflow',subflowId:'m'})],[],[module])).toThrow('Map input');expect(()=>expandSubflows([call('a','x','out')],[],[{...module,graph:{nodes:[call('recurse','x','out')],edges:[]}}])).toThrow('Recursive')})
 it('rejects custom scripts that can escape module variable isolation',()=>expect(()=>expandSubflows([call('a','x','out')],[],[{...module,graph:{nodes:[node('a','end',{onRun:'setVar("shared", 1)'})],edges:[]}}])).toThrow('on-run'))
 it('rejects multiple entry points',()=>expect(()=>expandSubflows([call('a','x','out')],[],[{...module,graph:{nodes:[node('a','end'),node('b','end')],edges:[]}}])).toThrow('one entry'))
})
describe('release and content checks',()=>{
 it('ignores canvas movement but catches routes and response changes',()=>{const before={nodes:[node('a','question'),node('b','end')],edges:edges('a','b')};const after=structuredClone(before);after.nodes[0].position.x=99;expect(compareGraphs(before,after)).toEqual([]);after.nodes[0].config.answerType='email';after.edges=[];expect(compareGraphs(before,after)[0].fields).toEqual(['config','routes'])})
 it('calculates contrast and detects altered translation placeholders',()=>{expect(contrastRatio('#ffffff','#000000')).toBe(21);expect(checkContentQuality([node('a','message',{text:'Hello {{vars.name}}',localizedText:{fr:'Bonjour'}})])[0].message).toContain('placeholders')})
})
describe('contracts and privacy',()=>{
 it('masks sensitive values echoed in conversation text',()=>expect(redactChatText('Your account is 12345',{account:'12345'},new Set(['account']))).toBe('Your account is [Redacted]'))

 it('rejects impossible dates and nonfinite numeric responses',()=>{expect(validateValueAgainstSchema('2026-02-30','date',[])).toHaveLength(1);expect(validateValueAgainstSchema('2024-02-29','date',[])).toEqual([]);expect(validateValueAgainstSchema(Infinity,'number',[])).toHaveLength(1)})
 it('does not treat inherited fields as response data',()=>expect(validateValueAgainstSchema(Object.create({name:'Alex'}),'object',[{key:'name',type:'string',required:true}])).toHaveLength(1))
 it('redacts configured and nested credentials without changing the input',()=>{const raw={account:'private',nested:{password:'secret'},other:'ok'};expect(redactSensitive(raw,new Set(['account']))).toEqual({account:'[Redacted]',nested:{password:'[Redacted]'},other:'ok'});expect(raw.nested.password).toBe('secret')})
 it('disables checkpoints for sensitive and transfer journeys',()=>{expect(canCheckpointFlow([node('password','question',{answerType:'password'})])).toBe(false);expect(canCheckpointFlow([node('transfer','transfer')])).toBe(false);expect(canCheckpointFlow([node('ask','question')])).toBe(true)})
 it('uses exact locale, language fallback, then original text',()=>{const c={text:'Hello',localizedText:{fr:'Bonjour','fr-CA':'Salut'}};expect(localizedStepText(c,'text',{_locale:'fr-CA'})).toBe('Salut');expect(localizedStepText(c,'text',{_locale:'fr-BE'})).toBe('Bonjour');expect(localizedStepText(c,'text',{_locale:'de'})).toBe('Hello')})
})
describe('mocked integrations',()=>{
 it('uses mocked output to exercise the next branch without a request',()=>{const spy=vi.spyOn(globalThis,'fetch');try{const result=runAutomatedScenario({scenario:{name:'mock',globals:{},expected:{mocks:{lookup:{value:{name:'Alex'}}},values:{person:{name:'Alex'}},stepKeys:['end']}},nodes:[node('lookup','http',{outputVariable:'person'}),node('end','end')],edges:edges('lookup','end')});expect(result.status).toBe('passed');expect(spy).not.toHaveBeenCalled()}finally{spy.mockRestore()}})
})
