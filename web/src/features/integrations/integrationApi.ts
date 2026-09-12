import { supabase } from '@/shared/lib/supabase'
import type {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  Json,
} from '@/shared/types/database'

export type IntegrationWithSecrets = Integration & {
  secrets?: Json | null
}

export type InstalledIntegration = Integration & {
  owned: boolean
}

/** Instance-wide list (Alerts, org Integrations page). Prefer listChatbotIntegrations in Designer. */
export async function listIntegrations(instanceId: string): Promise<Integration[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('instance_id', instanceId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as Integration[]
}

/** Integrations installed on this chatbot (owner auto-link + installs). */
export async function listChatbotIntegrations(chatbotId: string): Promise<InstalledIntegration[]> {
  const { data: links, error: linkError } = await supabase
    .from('chatbot_integrations')
    .select('integration_id')
    .eq('chatbot_id', chatbotId)
  if (linkError) throw linkError
  const ids = [...new Set((links ?? []).map((l) => l.integration_id).filter(Boolean))]
  if (!ids.length) return []

  const { data: rows, error } = await supabase
    .from('integrations')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error

  const linked = new Set(ids)
  const out: InstalledIntegration[] = []
  for (const row of rows ?? []) {
    if (!linked.has(row.id)) continue
    out.push({
      ...(row as Integration),
      owned: row.chatbot_id === chatbotId,
    })
  }
  return out
}

export async function listOwnedIntegrations(chatbotId: string): Promise<Integration[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as Integration[]
}

/** Other chatbots' integrations in this org that are not yet installed here. */
export async function listInstallableIntegrations(args: {
  instanceId: string
  chatbotId: string
}): Promise<Integration[]> {
  const { data: rows, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('instance_id', args.instanceId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error

  const { data: links } = await supabase
    .from('chatbot_integrations')
    .select('integration_id')
    .eq('chatbot_id', args.chatbotId)
  const installed = new Set((links ?? []).map((l) => l.integration_id))
  return ((rows ?? []) as Integration[]).filter((r) => !installed.has(r.id))
}

export async function getIntegrationSecrets(integrationId: string): Promise<Json> {
  const { data, error } = await supabase
    .from('integration_secrets')
    .select('secrets')
    .eq('integration_id', integrationId)
    .maybeSingle()
  if (error) throw error
  return (data?.secrets as Json) ?? {}
}

export async function createIntegration(input: {
  instanceId: string
  chatbotId: string
  provider: IntegrationProvider
  name: string
  config: Json
  secrets: Json
  status?: IntegrationStatus
  createdBy: string
}): Promise<Integration> {
  const { data, error } = await supabase
    .from('integrations')
    .insert({
      instance_id: input.instanceId,
      chatbot_id: input.chatbotId,
      provider: input.provider,
      name: input.name.trim(),
      config: input.config ?? {},
      status: input.status ?? 'disconnected',
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error

  const { error: secError } = await supabase.from('integration_secrets').upsert({
    integration_id: data.id,
    secrets: input.secrets ?? {},
    updated_at: new Date().toISOString(),
  })
  if (secError) throw secError

  // Ensure install link even if the DB trigger is missing on an older deploy.
  await addIntegrationToChatbot({
    chatbotId: input.chatbotId,
    integrationId: data.id,
    addedBy: input.createdBy,
  })

  return data as Integration
}

export async function updateIntegration(input: {
  id: string
  name: string
  config: Json
  secrets?: Json
  status?: IntegrationStatus
}): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({
      name: input.name.trim(),
      config: input.config ?? {},
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw error

  if (input.secrets !== undefined) {
    const { error: secError } = await supabase.from('integration_secrets').upsert({
      integration_id: input.id,
      secrets: input.secrets,
      updated_at: new Date().toISOString(),
    })
    if (secError) throw secError
  }
}

export async function setIntegrationStatus(
  id: string,
  status: IntegrationStatus,
): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteIntegration(id: string): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function addIntegrationToChatbot(args: {
  chatbotId: string
  integrationId: string
  addedBy?: string | null
}): Promise<void> {
  const { error } = await supabase.from('chatbot_integrations').insert({
    chatbot_id: args.chatbotId,
    integration_id: args.integrationId,
    added_by: args.addedBy ?? null,
  })
  if (error) {
    if (error.code === '23505') return
    throw error
  }
}

export async function removeIntegrationFromChatbot(args: {
  chatbotId: string
  integrationId: string
}): Promise<void> {
  const { data: row } = await supabase
    .from('integrations')
    .select('chatbot_id')
    .eq('id', args.integrationId)
    .maybeSingle()
  if (row?.chatbot_id === args.chatbotId) {
    throw new Error('Cannot unlink an integration from its owning chatbot. Delete the integration instead.')
  }
  const { error } = await supabase
    .from('chatbot_integrations')
    .delete()
    .eq('chatbot_id', args.chatbotId)
    .eq('integration_id', args.integrationId)
  if (error) throw error
}
