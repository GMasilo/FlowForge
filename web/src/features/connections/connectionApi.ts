import { supabase } from '@/shared/lib/supabase'
import type {
  Connection,
  ConnectionKind,
  ConnectionVisibility,
  ConnectionWithConfig,
  Json,
} from '@/shared/types/database'

export type MarketplaceConnection = Connection & {
  chatbot_name?: string | null
  owner_email?: string | null
  linked_to_chatbot?: boolean
  share_user_ids?: string[]
}

/** Connections installed on this chatbot (owner auto-link + ForgeHub installs). */
export async function listChatbotConnections(chatbotId: string): Promise<ConnectionWithConfig[]> {
  const { data: links, error: linkError } = await supabase
    .from('chatbot_connections')
    .select('connection_id')
    .eq('chatbot_id', chatbotId)
  if (linkError) throw linkError
  const ids = [...new Set((links ?? []).map((l) => l.connection_id).filter(Boolean))]
  if (!ids.length) return []

  const { data: rows, error } = await supabase
    .from('connections')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error

  // Only return rows that were actually linked (defense against over-broad results).
  const linked = new Set(ids)
  const out: ConnectionWithConfig[] = []
  for (const row of rows ?? []) {
    if (!linked.has(row.id)) continue
    const canManage = await checkCanManage(row.id)
    let config: Json | null | undefined
    if (canManage) {
      const { data: secret } = await supabase
        .from('connection_secrets')
        .select('config')
        .eq('connection_id', row.id)
        .maybeSingle()
      config = secret?.config ?? {}
    }
    out.push({ ...row, config, canManage })
  }
  return out
}

export async function listOwnedConnections(chatbotId: string): Promise<ConnectionWithConfig[]> {
  const { data: rows, error } = await supabase
    .from('connections')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error

  const out: ConnectionWithConfig[] = []
  for (const row of rows ?? []) {
    const { data: secret } = await supabase
      .from('connection_secrets')
      .select('config')
      .eq('connection_id', row.id)
      .maybeSingle()
    out.push({ ...row, config: secret?.config ?? {}, canManage: true })
  }
  return out
}

/** Connections the signed-in user created in this organisation (full secrets when manageable). */
export async function listMyCreatedConnections(args: {
  instanceId: string
  userId: string
}): Promise<(ConnectionWithConfig & { chatbot_name?: string | null })[]> {
  const { data: rows, error } = await supabase
    .from('connections')
    .select('*')
    .eq('instance_id', args.instanceId)
    .eq('created_by', args.userId)
    .order('updated_at', { ascending: false })
  if (error) throw error

  const chatbotIds = [...new Set((rows ?? []).map((r) => r.chatbot_id))]
  const names = new Map<string, string>()
  if (chatbotIds.length) {
    const { data: bots } = await supabase.from('chatbots').select('id, name').in('id', chatbotIds)
    for (const b of bots ?? []) names.set(b.id, b.name)
  }

  const out: (ConnectionWithConfig & { chatbot_name?: string | null })[] = []
  for (const row of rows ?? []) {
    const canManage = await checkCanManage(row.id)
    let config: Json | null | undefined
    if (canManage) {
      const { data: secret } = await supabase
        .from('connection_secrets')
        .select('config')
        .eq('connection_id', row.id)
        .maybeSingle()
      config = secret?.config ?? {}
    }
    out.push({
      ...row,
      config,
      canManage,
      chatbot_name: names.get(row.chatbot_id) ?? null,
    })
  }
  return out
}

export async function listMarketplaceConnections(args: {
  instanceId: string
  chatbotId?: string | null
}): Promise<MarketplaceConnection[]> {
  const { data: rows, error } = await supabase
    .from('connections')
    .select('*')
    .eq('instance_id', args.instanceId)
    .in('visibility', ['global', 'shared'])
    .order('name')
  if (error) throw error

  const chatbotIds = [...new Set((rows ?? []).map((r) => r.chatbot_id))]
  const chatbotNames = new Map<string, string>()
  if (chatbotIds.length) {
    const { data: bots } = await supabase.from('chatbots').select('id, name').in('id', chatbotIds)
    for (const b of bots ?? []) chatbotNames.set(b.id, b.name)
  }

  let linked = new Set<string>()
  if (args.chatbotId) {
    const { data: links } = await supabase
      .from('chatbot_connections')
      .select('connection_id')
      .eq('chatbot_id', args.chatbotId)
    linked = new Set((links ?? []).map((l) => l.connection_id))
  }

  const out: MarketplaceConnection[] = []
  for (const row of rows ?? []) {
    // Hide private-owned duplicates that somehow have wrong visibility
    if (row.visibility === 'private') continue
    let share_user_ids: string[] | undefined
    if (row.visibility === 'shared') {
      const { data: shares } = await supabase
        .from('connection_shares')
        .select('user_id')
        .eq('connection_id', row.id)
      share_user_ids = (shares ?? []).map((s) => s.user_id)
    }
    out.push({
      ...row,
      chatbot_name: chatbotNames.get(row.chatbot_id) ?? null,
      linked_to_chatbot: args.chatbotId ? linked.has(row.id) : false,
      share_user_ids,
    })
  }
  return out
}

async function checkCanManage(connectionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_manage_connection', { p_connection_id: connectionId })
  if (error) return false
  return !!data
}

export async function createChatbotConnection(input: {
  instanceId: string
  chatbotId: string
  name: string
  kind: ConnectionKind
  config: Json
  visibility?: ConnectionVisibility
  createdBy: string
}): Promise<ConnectionWithConfig> {
  const { data: row, error } = await supabase
    .from('connections')
    .insert({
      instance_id: input.instanceId,
      chatbot_id: input.chatbotId,
      name: input.name.trim(),
      kind: input.kind,
      visibility: input.visibility ?? 'private',
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error

  const { error: secretError } = await supabase.from('connection_secrets').insert({
    connection_id: row.id,
    config: input.config,
  })
  if (secretError) throw secretError

  // Ensure install link even if the DB trigger is missing on an older deploy.
  await addConnectionToChatbot({
    chatbotId: input.chatbotId,
    connectionId: row.id,
    addedBy: input.createdBy,
  })

  return { ...row, config: input.config, canManage: true }
}

export async function updateChatbotConnection(input: {
  id: string
  name: string
  kind: ConnectionKind
  config: Json
  visibility: ConnectionVisibility
}): Promise<void> {
  const { error } = await supabase
    .from('connections')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      visibility: input.visibility,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw error

  const { error: secretError } = await supabase.from('connection_secrets').upsert({
    connection_id: input.id,
    config: input.config,
    updated_at: new Date().toISOString(),
  })
  if (secretError) throw secretError
}

export async function deleteConnection(id: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_connection', { p_connection_id: id })
  if (error) throw error
}

export async function restoreConnection(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_connection', { p_connection_id: id })
  if (error) throw error
}

export async function setConnectionShares(connectionId: string, userIds: string[]): Promise<void> {
  const unique = [...new Set(userIds)]
  const { error: delError } = await supabase.from('connection_shares').delete().eq('connection_id', connectionId)
  if (delError) throw delError
  if (!unique.length) return
  const { error } = await supabase.from('connection_shares').insert(
    unique.map((user_id) => ({ connection_id: connectionId, user_id })),
  )
  if (error) throw error
}

export async function listConnectionShares(connectionId: string): Promise<string[]> {
  const { data, error } = await supabase.from('connection_shares').select('user_id').eq('connection_id', connectionId)
  if (error) throw error
  return (data ?? []).map((r) => r.user_id)
}

export async function addConnectionToChatbot(args: {
  chatbotId: string
  connectionId: string
  addedBy: string
}): Promise<void> {
  const { error } = await supabase.from('chatbot_connections').insert({
    chatbot_id: args.chatbotId,
    connection_id: args.connectionId,
    added_by: args.addedBy,
  })
  if (error) {
    if (error.code === '23505') return
    throw error
  }
}

export async function removeConnectionFromChatbot(args: {
  chatbotId: string
  connectionId: string
}): Promise<void> {
  // Don't allow removing the owner chatbot's automatic link while connection is owned there
  const { data: conn } = await supabase
    .from('connections')
    .select('chatbot_id')
    .eq('id', args.connectionId)
    .maybeSingle()
  if (conn?.chatbot_id === args.chatbotId) {
    throw new Error('Cannot unlink a connection from its owning chatbot. Delete the connection instead.')
  }
  const { error } = await supabase
    .from('chatbot_connections')
    .delete()
    .eq('chatbot_id', args.chatbotId)
    .eq('connection_id', args.connectionId)
  if (error) throw error
}

/** Load secrets for runtime when the connection is usable by this chatbot (RPC). */
export async function loadConnectionConfigForUse(
  connectionId: string,
  chatbotId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('connection_config_for_use', {
    p_connection_id: connectionId,
    p_chatbot_id: chatbotId,
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data as Record<string, unknown>
}

/** Load email SMTP secrets for preview/OTP (direct secrets, then RPC). */
export async function loadEmailConnectionConfig(
  connectionId: string,
  chatbotId: string,
): Promise<Record<string, unknown> | null> {
  const { data: secret, error: secretError } = await supabase
    .from('connection_secrets')
    .select('config')
    .eq('connection_id', connectionId)
    .maybeSingle()
  if (secretError) {
    // Fall through to RPC — SELECT may be denied for non-managers
    console.warn('connection_secrets read failed', secretError.message)
  } else if (secret?.config && typeof secret.config === 'object' && !Array.isArray(secret.config)) {
    const cfg = secret.config as Record<string, unknown>
    if (String(cfg.smtpHost ?? '').trim() && String(cfg.fromEmail ?? '').trim()) {
      return cfg
    }
  }

  const { data, error } = await supabase.rpc('connection_config_for_use', {
    p_connection_id: connectionId,
    p_chatbot_id: chatbotId,
  })
  if (error) {
    throw new Error(`connection_config_for_use failed: ${error.message}`)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }
  const viaRpc = data as Record<string, unknown>
  if (String(viaRpc.smtpHost ?? '').trim() && String(viaRpc.fromEmail ?? '').trim()) {
    return viaRpc
  }
  // Config exists but SMTP fields missing
  if (Object.keys(viaRpc).length > 0) {
    throw new Error(
      'Email connection is missing smtpHost/fromEmail. Edit the connection and save SMTP settings.',
    )
  }
  return null
}

export function visibilityLabel(v: ConnectionVisibility): string {
  switch (v) {
    case 'private':
      return 'Private'
    case 'global':
      return 'Global (organisation)'
    case 'shared':
      return 'Shared'
  }
}
