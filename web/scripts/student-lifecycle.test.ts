import {readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {describe,it,expect} from 'vitest'
import {defaultConfig,questionConfigSchema,entityConfigSchema} from '../src/features/designer/model/flowSchema'
import {parseFlowExport} from '../src/features/designer/utils/flowTransfer'
import {starterTemplateContent,parseTemplateContent,templatesExprMap} from '../src/features/templates/templateModel'
import {runAutomatedScenario} from '../src/features/designer/preview/automatedScenarios'
const root=fileURLToPath(new URL('../../',import.meta.url))
const source=JSON.parse(readFileSync(root+'artifacts/student-lifecycle/student-lifecycle.raw.json','utf8'))
source.nodes=source.nodes.map((n:any)=>({...n,config:{...defaultConfig(n.type),...n.config}}))
source.templates=[
 {key:'student_email',name:'Student lifecycle notification',kind:'email',description:'Configure SMTP and a verified recipient before live use.',content:parseTemplateContent('email',{...starterTemplateContent('email'),subject:'Student service update — {{vars.studentRef}}',html:'<h1>Student service update</h1><p>Hello {{vars.studentName}},</p><p>A service request for {{vars.studentRef}} has been processed. Check your official student portal for the authoritative status.</p>',inputs:[]})},
 {key:'student_document',name:'Graduation preparation guide',kind:'document',description:'Demonstration guide, not a qualification or official certificate.',content:parseTemplateContent('document',{...starterTemplateContent('document'),format:'pdf',filename:'summit-graduation-guide.pdf',title:'Summit graduation preparation — DEMONSTRATION',intro:'Prepared for {{vars.studentName}} ({{vars.studentRef}}).',body:'Confirm your official clearance, ceremony details and attendance with the registrar. This sample guide is not proof of graduation, enrolment or payment.',footer:'Fictional FlowForge student lifecycle showcase',fields:[],blocks:[],tableRowsSource:'',tableColumns:[],includeCart:false,inputs:[]})},
]
const pack=parseFlowExport(source)
const globals=Object.fromEntries(pack.globals.map(g=>[g.key,g.default_value]))
const templates=templatesExprMap(source.templates)
if(process.env.BUILD_STUDENT==='1'){
 const json=JSON.stringify(source,null,2)+'\n'
 writeFileSync(root+'artifacts/student-lifecycle/Student-Lifecycle.json',json)
 writeFileSync(root+'web/public/samples/flowforge-usecase-student-lifecycle.json',json)
}
describe('Student lifecycle showcase',()=>{
 it('preserves scripted answers, expected values and external mocks during import',()=>{
  const expected={answers:[{step:'consent',value:'I agree'}],values:{currentStage:'alumni'},mocks:{admission_status:{status:'Waitlisted'}}}
  const imported=parseFlowExport({...source,testScenarios:[{name:'Fixture round trip',globals:{demoMode:true},expected}]})
  expect(imported.testScenarios?.[0]?.expected).toMatchObject(expected)
 })
 it('imports complete entities, templates and automated scenario fixtures',()=>{
  expect(pack.entityDefs).toHaveLength(10);expect(pack.templates).toHaveLength(2);expect(pack.testScenarios).toHaveLength(14)
  for(const s of pack.testScenarios!)expect(s.expected?.answers?.length).toBeGreaterThan(0)
  for(const n of pack.nodes){if(n.type==='question')expect(questionConfigSchema.safeParse(n.config).success,n.key).toBe(true);if(n.type==='entity')expect(entityConfigSchema.safeParse(n.config).success,n.key).toBe(true)}
 })
 it('has one entry, unique keys and valid reachable routes',()=>{
  const ids=new Set(pack.nodes.map(n=>n.id));expect(ids.size).toBe(pack.nodes.length);expect(new Set(pack.nodes.map(n=>n.key)).size).toBe(pack.nodes.length)
  const byKey=new Map(pack.nodes.map(n=>[n.key,n]));const incoming=new Set(pack.edges.map(e=>e.target));expect(pack.nodes.filter(n=>!incoming.has(n.id)).map(n=>n.key)).toEqual(['welcome'])
  for(const e of pack.edges){expect(ids.has(e.source)).toBe(true);expect(ids.has(e.target)).toBe(true)}
  const seen=new Set<string>(),pending=[byKey.get('welcome')!.id]
  while(pending.length){const id=pending.pop()!;if(seen.has(id))continue;seen.add(id);const n=pack.nodes.find(n=>n.id===id)!;pending.push(...pack.edges.filter(e=>e.source===id).map(e=>e.target));for(const field of ['targetNodeKey','runAfterSkipTo'])if(n.config[field]){expect(byKey.has(String(n.config[field])),n.key).toBe(true);pending.push(byKey.get(String(n.config[field]))!.id)}}
  expect(seen.size).toBe(pack.nodes.length)
 })
 for(const scenario of pack.testScenarios??[])it(scenario.name,()=>{
  const result=runAutomatedScenario({scenario:{name:scenario.name,globals:scenario.globals,expected:scenario.expected},nodes:pack.nodes,edges:pack.edges,globals,templates})
  expect(result.status,JSON.stringify({checks:result.checks,visited:result.visited.map(id=>pack.nodes.find(n=>n.id===id)?.key)})).toBe('passed')
 })
})
