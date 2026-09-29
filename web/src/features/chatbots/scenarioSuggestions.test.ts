import { describe, expect, it } from 'vitest'
import { scenarioSuggestions, addScenarioName, addScenarioEntry, addScenarioAnswer } from './scenarioSuggestions'
import type { DesignerNode } from '@/features/designer/model/flowSchema'
const node=(key:string,type:DesignerNode['type'],config:Record<string,unknown>):DesignerNode=>({id:key,key,type,label:key,config,position:{x:0,y:0}})
describe('flow scenario suggestions',()=>{
 it('discovers multiple outputs, global names and mapped subflow outputs without duplicates',()=>{
  const result=scenarioSuggestions([node('ask','question',{outputVariable:'name'}),node('assign','set_variable',{assignments:[{variableKey:'count',value:'1'},{variableKey:'name',value:'Alex'}]}),node('shared','operation',{operation:'subflow',subflowOutputs:{result:'total'}})],{name:'Guest'})
  expect(result.variables.map(v=>v.key)).toEqual(['count','name','total'])
  expect(result.variables.find(v=>v.key==='name')?.label).toContain('Global, ask, assign')
 })
 it('separates answer steps from mocked services and refreshes when the draft changes',()=>{
  const nodes=[node('ask','question',{}),node('choice','button',{}),node('lookup','http',{}),node('login','sign_in',{})]
  expect(scenarioSuggestions(nodes).answers.map(n=>n.key)).toEqual(['ask','choice'])
  expect(scenarioSuggestions(nodes).mocks.map(n=>n.key)).toEqual(['lookup'])
  expect(scenarioSuggestions(nodes.slice(1)).steps.map(n=>n.key)).not.toContain('ask')
 })
 it('deduplicates names while retaining manual entries',()=>expect(addScenarioName('custom, name','name')).toBe('custom, name'))
 it('preserves entered JSON and rejects replacement or malformed input',()=>{
  expect(JSON.parse(addScenarioEntry('{"custom":false}','count',0))).toEqual({custom:false,count:0})
  expect(()=>addScenarioEntry('{"count":8}','count',null)).toThrow('already has a value')
  expect(()=>addScenarioEntry('{','count',0)).toThrow('Correct the JSON')
  expect(()=>addScenarioEntry('[]','count',0)).toThrow('JSON object')
 })
 it('appends repeated answers for loops without changing existing answers',()=>expect(JSON.parse(addScenarioAnswer('[{"step":"ask","value":"Alex"}]','ask'))).toEqual([{step:'ask',value:'Alex'},{step:'ask',value:''}]))
})
