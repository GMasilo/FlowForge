import { useQuery } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { fetchFlowModules } from './subflowApi'
import { expandSubflows } from './subflows'
import { useState } from 'react'
import type { DesignerNode, DesignerEdge } from '@/features/designer/model/flowSchema'
import { parsePublishedGraph } from '@/features/designer/utils/flowPublish'
import { Card } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { compareGraphs, checkContentQuality } from './releaseQuality'
export function ReleaseComparison({ nodes, edges, production, staging, selectNode }: { nodes: DesignerNode[]; edges: DesignerEdge[]; production: unknown; staging: unknown; selectNode: (id:string)=>void }) {
  const {instance}=useRequiredInstance()
  const hasSubflows=nodes.some(n=>n.type==='operation'&&n.config.operation==='subflow')
  const modules=useQuery({queryKey:['flow-modules',instance.id],queryFn:()=>fetchFlowModules(instance.id),enabled:hasSubflows})
  let draft={nodes,edges}, expansionError=''
  try{if(hasSubflows){if(!modules.data)throw new Error(modules.error?.message??'Loading shared processes…');draft=expandSubflows(nodes,edges,modules.data)}}catch(e){expansionError=e instanceof Error?e.message:String(e)}
  const [target,setTarget]=useState('production')
  let baseline: ReturnType<typeof parsePublishedGraph> | null=null
  try { baseline=parsePublishedGraph(target==='production'?production:staging) } catch { /* unpublished */ }
  const changes=baseline&&!expansionError?compareGraphs(baseline,draft):[]
  const quality=checkContentQuality(nodes)
  return <Card className="p-4"><details><summary className="cursor-pointer font-semibold">Release comparison and content checks</summary><div className="space-y-3 pt-3">
    <label className="flex items-center gap-2 text-sm">Compare draft with <select value={target} onChange={e=>setTarget(e.target.value)} className="rounded border p-2"><option value="production">Production</option><option value="staging">Staging</option></select></label>
    {expansionError?<p role="status">{expansionError}</p>:!baseline?<p>No snapshot published to this environment.</p>:<><p className="text-sm">{changes.length} changed steps. Layout-only changes are excluded. Globals and templates should also be reviewed before publishing.</p><ul>{changes.map(c=><li key={c.key} className="flex flex-wrap items-center gap-2 py-1 text-sm"><strong>{c.kind}</strong> {c.label || c.key} ({c.key}) {c.fields.join(', ')} {c.kind!=='removed'&&nodes.some(n=>n.key===c.key)?<Button size="sm" variant="ghost" onClick={()=>{const n=nodes.find(n=>n.key===c.key);if(n)selectNode(n.id)}}>Show step</Button>:null}</li>)}</ul></>}
    <h3 className="font-medium">Accessibility and translation checks</h3>
    <p className="text-xs text-[var(--color-ink-muted)]">These checks cover labels, configured colours and translation placeholders. Also preview keyboard navigation, mobile layouts and screen-reader output.</p>
    {quality.length?<ul>{quality.map((i,k)=><li key={k} className="text-sm">{i.message}<Button size="sm" variant="ghost" onClick={()=>selectNode(i.nodeId)}>Show step</Button></li>)}</ul>:<p className="text-sm">No content issues found by these checks.</p>}
  </div></details></Card>
}
