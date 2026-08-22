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
