import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canEdit } from '@/shared/types/database'
import { operationsError, operationsDb } from './operationsApi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
export function SavedReplies({draft,onChoose}:{draft:string;onChoose:(text:string)=>void}){
 const {instance,role}=useRequiredInstance();const qc=useQueryClient();const [title,setTitle]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const replies=useQuery({queryKey:['saved-replies',instance.id],queryFn:async()=>{const {data,error}=await operationsDb.from('saved_replies').select('id,title,body').eq('instance_id',instance.id).order('title');if(error)throw operationsError(error);return data??[]}})
 async function save(){setBusy(true);setError('');try{const {error}=await operationsDb.from('saved_replies').insert({instance_id:instance.id,title:title.trim(),body:draft.trim()});if(error)throw operationsError(error);setTitle('');await qc.invalidateQueries({queryKey:['saved-replies',instance.id]})}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <div className="space-y-2"><select aria-label="Saved reply" className="w-full rounded border p-2 text-sm" value="" onChange={e=>{const row=replies.data?.find(r=>r.id===e.target.value);if(row)onChoose(row.body)}}><option value="">Insert a saved reply…</option>{replies.data?.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>{canEdit(role)?<details><summary className="cursor-pointer text-xs">Save the current reply for the team</summary><div className="flex gap-2 py-2"><Input aria-label="Saved reply title" placeholder="Reply title" value={title} onChange={e=>setTitle(e.target.value)}/><Button type="button" size="sm" disabled={busy||!draft.trim()||!title.trim()} onClick={()=>void save()}>Save reply</Button></div></details>:null}{error||replies.error?<p role="alert" className="text-xs">{error||replies.error?.message}</p>:null}</div>
}
export function ConversationSummary({events}:{events:{kind:string;node_key?:string|null;payload:unknown}[]}){
 const failed=events.filter(e=>e.kind==='step.run'&&e.payload&&typeof e.payload==='object'&&['Failed','TimedOut'].includes(String((e.payload as Record<string,unknown>).status)))
 const user=events.filter(e=>e.kind==='message.user'),agent=events.filter(e=>e.kind==='message.agent')
 const last=user.at(-1)?.payload;const text=last&&typeof last==='object'?String((last as Record<string,unknown>).text??''):''
 return <details className="rounded border p-3"><summary className="cursor-pointer text-sm font-semibold">Conversation summary</summary><p className="py-2 text-sm">{user.length} visitor messages · {agent.length} agent replies · {failed.length} failed steps</p>{text?<p className="text-sm">Latest visitor message: {text.slice(0,500)}</p>:null}{failed.length?<p className="text-sm">Steps needing attention: {[...new Set(failed.map(e=>e.node_key??'Unknown'))].join(', ')}</p>:null}<p className="mt-2 text-xs text-[var(--color-ink-muted)]">Generated from recorded events; no external AI service is used.</p></details>
}
