import { useAuth } from '@/features/auth/AuthProvider'
import { releaseReviewBlockReason } from './releaseReview'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { Card } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'
import { operationsError, operationsDb, fetchOperations, operationsRpc, type OperationsSettings } from './operationsApi'
import { compareGraphs } from './releaseQuality'
import { parsePublishedGraph } from '@/features/designer/utils/flowPublish'
export function ChatbotOperationsPage() {
 const {user}=useAuth()
 const { chatbotId='' }=useParams(); const {instance,role}=useRequiredInstance(); const admin=canAdmin(role); const qc=useQueryClient()
 const [form,setForm]=useState<OperationsSettings>({});const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [saved,setSaved]=useState(false)
 const [reviewError,setReviewError]=useState<{id:string;message:string}|null>(null)
 const policy=useQuery({queryKey:['chatbot-operations',chatbotId],queryFn:()=>fetchOperations(chatbotId)})
 const bot=useQuery({queryKey:['operations-bot',chatbotId],queryFn:async()=>{const {data,error}=await supabase.from('chatbots').select('name').eq('id',chatbotId).eq('instance_id',instance.id).single();if(error)throw operationsError(error);return data}})
 const links=useQuery({queryKey:['operations-connections',chatbotId],queryFn:async()=>{const {data,error}=await supabase.from('chatbot_connections').select('connection_id,connections(id,name,kind)').eq('chatbot_id',chatbotId);if(error)throw operationsError(error);return (data??[]).flatMap(r=>r.connections?[r.connections]:[])}})
 const flows=useQuery({queryKey:['operations-flows',chatbotId],queryFn:async()=>{const {data,error}=await supabase.from('chatbot_flows').select('id,published_graph').eq('chatbot_id',chatbotId);if(error)throw operationsError(error);return data??[]}})
 const reviews=useQuery({queryKey:['release-reviews',chatbotId,flows.data],enabled:!!flows.data?.length,queryFn:async()=>{const {data,error}=await operationsDb.from('flow_release_reviews').select('*').in('flow_id',flows.data!.map(f=>f.id)).order('requested_at',{ascending:false}).limit(50);if(error)throw operationsError(error);return data??[]}})
 const failures=useQuery({queryKey:['integration-failures',chatbotId],queryFn:async()=>{const {data,error}=await supabase.from('conversation_events').select('id,session_id,node_key,created_at,payload,conversation_sessions!inner(chatbot_id)').eq('conversation_sessions.chatbot_id',chatbotId).eq('kind','step.run').in('payload->>status',['Failed','TimedOut']).order('created_at',{ascending:false}).limit(100);if(error)throw operationsError(error);return data??[]}})
 useEffect(()=>{if(policy.data)setForm(policy.data)},[policy.data])
 async function save(){setBusy(true);setError('');setSaved(false);try{const hours=Number(form.resumeHours??0);if(!Number.isInteger(hours)||hours<0||hours>168)throw new Error('Resume expiry must be 0–168 hours.');const {error}=await operationsDb.from('chatbot_operations').upsert({chatbot_id:chatbotId,settings:form,updated_at:new Date().toISOString()});if(error)throw operationsError(error);await qc.invalidateQueries({queryKey:['chatbot-operations',chatbotId]});setSaved(true)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function decide(id:string,approve:boolean){
  if(busy)return
  setReviewError(null)
  const reason=releaseReviewBlockReason(reviews.data?.find(r=>r.id===id),user?.id,admin)
  if(reason){setReviewError({id,message:reason});return}
  setBusy(true)
  try{
   await operationsRpc('decide_release_review',{p_review_id:id,p_approve:approve,p_note:null})
   await qc.invalidateQueries({queryKey:['release-reviews',chatbotId]})
  }catch(e){
   setReviewError({id,message:e instanceof Error?e.message:String(e)})
   void reviews.refetch()
  }finally{setBusy(false)}
 }

 return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{bot.data?.name??'Chatbot'} operations</h1><ChatbotSubNav instanceId={instance.id} chatbotId={chatbotId}/></div>
 {[...new Set([policy.error,bot.error,links.error,flows.error,reviews.error,failures.error].filter(Boolean).map(e=>e!.message))].map(message=><p role="alert" key={message}>{message}</p>)}
 {error?<p role="alert" className="text-red-600">{error}</p>:null}
 <Card className="space-y-4 p-4"><h2 className="font-semibold">Release, privacy and session controls</h2><fieldset disabled={!admin||busy||policy.isPending||policy.isError} className="space-y-4">
 <label className="flex gap-2"><input type="checkbox" checked={!!form.requireApproval} onChange={e=>setForm({...form,requireApproval:e.target.checked})}/>Require another administrator to approve the exact production release</label>
 <label className="block text-sm">Resume interrupted conversations for (hours; 0 disables)<Input type="number" min={0} max={168} value={form.resumeHours??0} onChange={e=>setForm({...form,resumeHours:Number(e.target.value)})}/></label>
 <p className="text-xs text-[var(--color-ink-muted)]">Resume is limited to this browser tab and checkpoints at questions or buttons. Flows collecting passwords, card details or sign-in credentials do not save checkpoints.</p>
 <label className="block text-sm">Sensitive variable names (comma separated)<Input value={(form.sensitiveVariables??[]).join(', ')} onChange={e=>setForm({...form,sensitiveVariables:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label>
 <label className="block text-sm">Consent message shown before the conversation starts<Textarea value={form.consentText??''} onChange={e=>setForm({...form,consentText:e.target.value})}/></label>
 <label className="block text-sm">Default language code<Input value={form.defaultLocale??'en'} onChange={e=>setForm({...form,defaultLocale:e.target.value})}/></label>
 <h3 className="font-medium">Environment connections</h3><p className="text-sm">Map a flow connection to separate installed connections for staging and production. Credentials remain in the existing restricted connection store. Bindings apply to public and staging sessions; designer preview uses its selected connection.</p>
 {(links.data??[]).map(c=><div key={c.id} className="grid gap-2 rounded border p-3 sm:grid-cols-3"><span>{c.name}</span>{(['staging','production'] as const).map(env=><label key={env} className="text-sm">{env}<select className="block w-full rounded border p-2" value={form.connectionBindings?.[c.id]?.[env]??c.id} onChange={e=>setForm({...form,connectionBindings:{...form.connectionBindings,[c.id]:{staging:c.id,production:c.id,...form.connectionBindings?.[c.id],[env]:e.target.value}}})}>{(links.data??[]).filter(x=>x.kind===c.kind).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>)}</div>)}
 <Button onClick={()=>void save()} disabled={busy}>{busy?'Saving…':'Save controls'}</Button>{saved?<p role="status">Controls saved.</p>:null}
 </fieldset></Card>
 <Card className="space-y-3 p-4"><h2 className="font-semibold">Release approvals</h2><p className="text-sm">Request approval from Design. Approval is tied to an exact snapshot and used once. The requester cannot approve their own release.</p>{reviews.isPending&&flows.isPending?<p>Loading reviews…</p>:null}{reviews.data?.length===0?<p>No release requests.</p>:null}{reviews.data?.map(r=>{
 const blockReason=releaseReviewBlockReason(r,user?.id,admin)
 let changes:ReturnType<typeof compareGraphs>=[];try{const before=parsePublishedGraph(flows.data?.find(f=>f.id===r.flow_id)?.published_graph);changes=compareGraphs(before,parsePublishedGraph(r.graph))}catch{/* no published baseline */}
 return <details key={r.id} className="rounded border p-3"><summary className="cursor-pointer">{new Date(r.requested_at).toLocaleString()} · {r.status} · {changes.length} changed steps</summary><ul>{changes.map(c=><li key={c.key}>{c.kind}: {c.label||c.key} — {c.fields.join(', ')}</li>)}</ul><details><summary>Review full release snapshot</summary><pre className="max-h-80 overflow-auto text-xs">{JSON.stringify(r.graph,null,2)}</pre></details>{r.status==='pending'&&blockReason?<p className="pt-2 text-sm" id={`review-reason-${r.id}`}>{blockReason}</p>:null}{reviewError&&reviewError.id===r.id?<p role="alert" className="pt-2 text-sm text-red-600">{reviewError.message}</p>:null}{admin&&r.status==='pending'?<div className="flex gap-2 pt-2"><Button aria-describedby={blockReason?`review-reason-${r.id}`:undefined} disabled={busy||!!blockReason} onClick={()=>void decide(r.id,true)}>Approve snapshot</Button><Button variant="secondary" aria-describedby={blockReason?`review-reason-${r.id}`:undefined} disabled={busy||!!blockReason} onClick={()=>void decide(r.id,false)}>Reject</Button></div>:null}</details>})}</Card>
 <Card className="space-y-3 p-4"><h2 className="font-semibold">Integration failures</h2><p className="text-sm">Latest 100 failed or timed-out steps. Inspect the conversation before retrying operations that may create records or charges.</p>{failures.isPending?<p>Loading failures…</p>:null}{failures.data?.length===0?<p>No failed steps found.</p>:null}<ul>{failures.data?.map(f=><li key={f.id} className="border-b py-2 text-sm"><Link className="underline" to={`/instances/${instance.id}/conversations/${f.session_id}`}>{f.node_key??'Step'} · {new Date(f.created_at).toLocaleString()}</Link></li>)}</ul><Link className="text-sm underline" to={`/instances/${instance.id}/chatbots/${chatbotId}/webhooks`}>Webhook delivery history and replay</Link></Card>
 <div className="flex flex-wrap gap-4 text-sm"><Link className="underline" to={`/instances/${instance.id}/admin/compliance`}>Consent, retention and visitor data requests</Link><Link className="underline" to={`/instances/${instance.id}/admin/audit`}>Audit trail</Link><Link className="underline" to={`/instances/${instance.id}/agent`}>Agent queues and routing</Link></div>
 </div>
}
