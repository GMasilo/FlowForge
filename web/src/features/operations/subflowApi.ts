import { operationsDb, operationsError } from './operationsApi'
import { expandSubflows, type FlowModule } from './subflows'
import type { DesignerNode, DesignerEdge } from '@/features/designer/model/flowSchema'
export async function fetchFlowModules(instanceId:string):Promise<FlowModule[]>{const {data,error}=await operationsDb.from('flow_modules').select('*').eq('instance_id',instanceId).order('name');if(error)throw operationsError(error);return data??[]}
export async function expandStoredSubflows(instanceId:string,nodes:DesignerNode[],edges:DesignerEdge[]){
 if(!nodes.some(n=>n.config.operation==='subflow'))return {nodes,edges}
 return expandSubflows(nodes,edges,await fetchFlowModules(instanceId))
}
