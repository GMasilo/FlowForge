import { operationsRpc } from './operationsApi'
export type ResumeTicket={token:string;revision:number;expiresAt:string}
export class ConversationCheckpoint {
 private queue:Promise<unknown>=Promise.resolve()
 public ticket:ResumeTicket
 constructor(ticket:ResumeTicket){this.ticket=ticket}
 save(snapshot:unknown):Promise<void>{
  const task=this.queue.then(async()=>{this.ticket.revision=await operationsRpc<number>('save_conversation_checkpoint',{p_token:this.ticket.token,p_revision:this.ticket.revision,p_snapshot:snapshot})})
  this.queue=task;return task
 }
 claim():Promise<void>{const task=this.queue.then(async()=>{this.ticket.revision=await operationsRpc<number>('claim_conversation_input',{p_token:this.ticket.token,p_revision:this.ticket.revision})});this.queue=task;return task}
}
export function readResumeTicket(key:string):ResumeTicket|null{try{const raw=sessionStorage.getItem(key);if(!raw)return null;const t=JSON.parse(raw);return typeof t.token==='string'&&Date.parse(t.expiresAt)>Date.now()?t:null}catch{return null}}
export function storeResumeTicket(key:string,ticket:ResumeTicket|null){try{if(ticket)sessionStorage.setItem(key,JSON.stringify(ticket));else sessionStorage.removeItem(key)}catch{/* browser storage unavailable */}}
