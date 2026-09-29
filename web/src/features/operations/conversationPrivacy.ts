import type { DesignerNode } from '@/features/designer/model/flowSchema'
export const SENSITIVE_ANSWER_TYPES = new Set(['password','credit_card','national_id','otp','sign_in'])
export function sensitiveVariableNames(nodes:DesignerNode[],configured:string[]=[]):Set<string>{
 const keys=new Set(configured)
 for(const n of nodes)if(n.config.sensitive===true||SENSITIVE_ANSWER_TYPES.has(String(n.config.answerType))||n.type==='sign_in')for(const field of ['outputVariable','tokenVariable','profileVariable']){const key=String(n.config[field]??'').trim();if(key)keys.add(key)}
 keys.add('auth_token');return keys
}
export function redactSensitive(value:unknown,names:Set<string>,depth=0):unknown {
 if(depth>30)return '[Redacted: depth limit]'
 if(Array.isArray(value))return value.map(v=>redactSensitive(v,names,depth+1))
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,names.has(k)||/password|passwd|cvv|cvc|cardnumber|card_number|authorization|access_token|refresh_token|secret/i.test(k)?'[Redacted]':redactSensitive(v,names,depth+1)]))
 return value
}
export function canCheckpointFlow(nodes:DesignerNode[]):boolean{return !nodes.some(n=>n.type==='sign_in'||n.type==='transfer'||n.config.answerRequired===false||n.config.sensitive===true||SENSITIVE_ANSWER_TYPES.has(String(n.config.answerType)))}
export function localizedStepText(config:Record<string,unknown>,field:string,vars:Record<string,unknown>,fallback=''):string{
 const locale=String(vars._locale??'en');const translations=config.localizedText
 if(translations&&typeof translations==='object'&&!Array.isArray(translations)){const map=translations as Record<string,unknown>;const text=map[locale]??map[locale.split('-')[0]];if(typeof text==='string'&&text.trim())return text}
 return String(config[field]??fallback)
}

/** Mask known sensitive values even when a later message echoes them. */
export function redactChatText(text:string,vars:Record<string,unknown>,names:Set<string>):string {
 const secrets:string[]=[]
 const collect=(value:unknown)=>{if(typeof value==='string'&&value)secrets.push(value);else if(typeof value==='number')secrets.push(String(value));else if(value&&typeof value==='object')Object.values(value).forEach(collect)}
 for(const key of names)collect(vars[key])
 for(const value of [...new Set(secrets)].sort((a,b)=>b.length-a.length))text=text.split(value).join('[Redacted]')
 return text
}
