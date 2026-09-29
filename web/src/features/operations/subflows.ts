import type { DesignerNode, DesignerEdge } from '@/features/designer/model/flowSchema'
import { readSetVariableAssignments } from '@/features/designer/model/flowSchema'
export type FlowModule = { id:string; name:string; revision:number; graph:{nodes:DesignerNode[];edges:DesignerEdge[]}; inputs:string[]; outputs:string[] }
export function expandSubflows(nodes:DesignerNode[],edges:DesignerEdge[],modules:FlowModule[],stack:string[]=[]):{nodes:DesignerNode[];edges:DesignerEdge[]} {
 let resultNodes=structuredClone(nodes), resultEdges=structuredClone(edges)
 for (const call of nodes.filter(n=>n.type==='operation'&&n.config.operation==='subflow')) {
  const module=modules.find(m=>m.id===call.config.subflowId)
  if(!module)throw new Error(`Subflow not found for ${call.key}`)
  if(stack.includes(module.id)||stack.length>=8)throw new Error(`Recursive or deeply nested subflow: ${module.name}`)
  const graph=expandSubflows(module.graph.nodes,module.graph.edges,modules,[...stack,module.id])
  const roots=graph.nodes.filter(n=>!graph.edges.some(e=>e.target===n.id))
  if(roots.length!==1)throw new Error(`Subflow ${module.name} must have exactly one entry step`)
  if(graph.nodes.some(n=>n.type==='restart'||n.type==='transfer'))throw new Error(`Subflow ${module.name} cannot restart or transfer the whole conversation`)
  if(graph.nodes.some(n=>String(n.config.onRun??'').trim()))throw new Error(`Subflow ${module.name} cannot contain custom on-run scripts`)
  const prefix=`sf_${call.key}_`
  const ids=new Map(graph.nodes.map(n=>[n.id,`${call.id}_${n.id}`]))
  const keys=new Map(graph.nodes.map(n=>[n.key,prefix+n.key]))
  const locals=new Set([...module.inputs,...module.outputs])
  for(const n of graph.nodes){for(const field of ['outputVariable','itemVariable','indexVariable'])if(typeof n.config[field]==='string'&&n.config[field])locals.add(n.config[field] as string);for(const a of readSetVariableAssignments(n.type==='set_variable'?n.config:{}))if(a.variableKey)locals.add(a.variableKey)}
  const findListenerVars=(value:unknown):void=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(findListenerVars);return}const obj=value as Record<string,unknown>;if(typeof obj.varName==='string'&&obj.varName)locals.add(obj.varName);Object.values(obj).forEach(findListenerVars)}
  graph.nodes.forEach(n=>findListenerVars(n.config))
  if([...locals].some(k=>!/^[A-Za-z_]\w*$/.test(k)))throw new Error('Subflow variable names must use letters, digits and underscores')
  const rewrite=(value:unknown,field=''):unknown=>{
   if(Array.isArray(value))return value.map(v=>rewrite(v))
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,k)]))
   if(typeof value!=='string')return value
   if(['outputVariable','itemVariable','indexVariable','variableKey','varName'].includes(field)&&locals.has(value))return prefix+value
   if(['targetNodeKey','skipToNodeKey','runAfterSkipTo'].includes(field)&&keys.has(value))return keys.get(value)
   return value.replace(/\bvars\.([A-Za-z_]\w*)/g,(all,k)=>locals.has(k)?`vars.${prefix}${k}`:all).replace(/\bsteps\.([A-Za-z_]\w*)/g,(all,k)=>keys.has(k)?`steps.${keys.get(k)}`:all).replace(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g,(all,k)=>locals.has(k)?`{{vars.${prefix}${k}}}`:all)
  }
  if(String(call.config.onRun??'').trim())throw new Error('Subflow calls cannot contain custom on-run scripts')
  const inputMap=(call.config.subflowInputs??{}) as Record<string,string>, outputMap=(call.config.subflowOutputs??{}) as Record<string,string>
  for(const name of Object.values(outputMap))if(name?.trim()&&!/^[A-Za-z_]\w*$/.test(name.trim()))throw new Error('Subflow outputs must map to simple variable names')
  for(const name of module.inputs)if(!Object.prototype.hasOwnProperty.call(inputMap,name)||!String(inputMap[name]).trim())throw new Error(`Map input ${name} on ${call.key}`)
  const entry:DesignerNode={...call,type:'set_variable',config:{runAfter:call.config.runAfter,runAfterSkipTo:call.config.runAfterSkipTo,assignments:[...[...locals].map(name=>({variableKey:prefix+name,value:'{{null()}}',valueType:'object'})),...module.inputs.map(name=>({variableKey:prefix+name,value:inputMap[name],valueType:'object'}))]}}
  const exitId=call.id+'_return'
  const exit:DesignerNode={...call,id:exitId,key:call.key+'_return',type:'set_variable',label:`Return from ${module.name}`,config:{assignments:module.outputs.filter(name=>outputMap[name]?.trim()).map(name=>({variableKey:outputMap[name].trim(),value:`{{vars.${prefix}${name}}}`,valueType:'object'}))}}
  const body=graph.nodes.map(n=>({...n,id:ids.get(n.id)!,key:keys.get(n.key)!,type:n.type==='end'?'message' as const:n.type,config:n.type==='end'?{text:rewrite(n.config.message??'')}:rewrite(n.config) as Record<string,unknown>}))
  const exits=graph.nodes.filter(n=>!graph.edges.some(e=>e.source===n.id)||n.type==='end')
  if(!exits.length)throw new Error(`Subflow ${module.name} needs a return path`)
  resultNodes=resultNodes.filter(n=>n.id!==call.id).concat(entry,...body,exit)
  resultEdges=resultEdges.map(e=>e.source===call.id?{...e,source:exitId}:e).concat(
    {id:call.id+'_enter',source:call.id,target:ids.get(roots[0].id)!},
    ...graph.edges.filter(e=>!graph.nodes.some(n=>n.id===e.source&&n.type==='end')).map(e=>({...e,id:call.id+'_'+e.id,source:ids.get(e.source)!,target:ids.get(e.target)!})),
    ...exits.map(n=>({id:call.id+'_exit_'+n.id,source:ids.get(n.id)!,target:exitId}))
  )
  if(resultNodes.length>2000)throw new Error('Expanded flow exceeds 2,000 steps')
 }
 return {nodes:resultNodes,edges:resultEdges}
}
