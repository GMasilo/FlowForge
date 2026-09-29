import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
// Isolate the additive schema until generated database types are refreshed.
export const operationsDb: SupabaseClient = supabase
export type OperationsSettings = { requireApproval?: boolean; resumeHours?: number; sensitiveVariables?: string[]; consentText?: string; defaultLocale?: string; connectionBindings?: Record<string,{staging:string;production:string}> }
export async function fetchOperations(chatbotId:string): Promise<OperationsSettings> {
 const {data,error}=await operationsDb.from('chatbot_operations').select('settings').eq('chatbot_id',chatbotId).maybeSingle();if(error)throw operationsError(error);return data?.settings ?? {}
}
export async function operationsRpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await operationsDb.rpc(name,args);if(error)throw operationsError(error);return data as T}

/** Old deployments remain usable; other failures must not bypass configured consent. */
export async function fetchPublicOperations(sessionId: string): Promise<OperationsSettings> {
 const { data, error } = await operationsDb.rpc('public_chat_operations', {p_session_id: sessionId})
 if (error && ['PGRST202', '42883'].includes(error.code)) return {}
 if (error) throw new Error(error.message)
 return data ?? {}
}

export function operationsError(error:{code?:string;message:string}):Error {
 return new Error(['PGRST205','42P01','PGRST202','42883','42703'].includes(error.code??'')?'Operations setup is not installed yet. Ask your administrator to apply the chatbot operations database migration.':error.message)
}
