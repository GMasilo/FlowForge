import { supabase } from '@/shared/lib/supabase'
import type { Json } from '@/shared/types/database'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import {
  remapEntityIds,
  type FlowEntityExport,
  type FlowGlobalExport,
} from '@/features/designer/utils/flowTransfer'

export async function loadFlowBundle(chatbotId: string): Promise<{
  chatbot: { id: string; name: string; description: string | null }
  flow: { id: string; name: string; version: number }
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
}> {
  const { data: chatbot, error: chatbotError } = await supabase
    .from('chatbots')
    .select('id, name, description')
    .eq('id', chatbotId)
    .single()
  if (chatbotError) throw chatbotError

  const { data: flow, error: flowError } = await supabase
    .from('chatbot_flows')
    .select('id, name, version')
    .eq('chatbot_id', chatbotId)
    .single()
  if (flowError) throw flowError

  const [{ data: nodesData, error: nodesError }, { data: edgesData, error: edgesError }, { data: vars, error: varsError }] =
    await Promise.all([
      supabase.from('flow_nodes').select('*').eq('flow_id', flow.id),
      supabase.from('flow_edges').select('*').eq('flow_id', flow.id),
      supabase
        .from('chatbot_variables')
        .select('key, value_type, default_value, description')
        .eq('chatbot_id', chatbotId)
        .eq('scope', 'global'),
    ])
  if (nodesError) throw nodesError
  if (edgesError) throw edgesError
  if (varsError) throw varsError

  return {
    chatbot: {
      id: chatbot.id,
      name: chatbot.name,
      description: chatbot.description ?? null,
    },
    flow: { id: flow.id, name: flow.name, version: flow.version },
    nodes: (nodesData ?? []).map((n) => ({
      id: n.id,
      key: n.key,
      type: n.type,
      label: n.label ?? n.key,
      config: (n.config as Record<string, unknown>) ?? {},
      position: { x: n.position_x, y: n.position_y },
    })),
    edges: (edgesData ?? []).map((e) => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      sourceHandle: e.source_handle,
      label: e.label,
    })),
    globals: (vars ?? []).map((v) => ({
      key: v.key,
      value_type: v.value_type,
      default_value: v.default_value,
      description: v.description,
    })),
  }
}

export async function loadChatbotEntities(chatbotId: string): Promise<FlowEntityExport[]> {
  const { data, error } = await supabase
    .from('chatbot_entities')
    .select('id, key')
    .eq('chatbot_id', chatbotId)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []).map((e) => ({ id: e.id, key: e.key }))
}

export async function replaceFlowInDb(args: {
  chatbotId: string
  flowId: string
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
  entitiesExport?: FlowEntityExport[]
  /** When set, also refresh chatbot name/description from the import. */
  chatbotMeta?: { name?: string; description?: string | null }
}) {
  const { chatbotId, flowId, edges, globals, chatbotMeta, entitiesExport } = args

  const targetEntities = await loadChatbotEntities(chatbotId)
  const nodes = remapEntityIds(args.nodes, entitiesExport, targetEntities)

  const { error: delEdgesError } = await supabase.from('flow_edges').delete().eq('flow_id', flowId)
  if (delEdgesError) throw delEdgesError
  const { error: delNodesError } = await supabase.from('flow_nodes').delete().eq('flow_id', flowId)
  if (delNodesError) throw delNodesError

  if (nodes.length) {
    const { error: insertNodesError } = await supabase.from('flow_nodes').insert(
      nodes.map((n) => ({
        id: n.id,
        flow_id: flowId,
        key: n.key,
        type: n.type,
        label: n.label,
        config: n.config as Json,
        position_x: n.position.x,
        position_y: n.position.y,
      })),
    )
    if (insertNodesError) throw insertNodesError
  }

  if (edges.length) {
    const { error: insertEdgesError } = await supabase.from('flow_edges').insert(
      edges.map((e) => ({
        id: e.id,
        flow_id: flowId,
        source_node_id: e.source,
        target_node_id: e.target,
        source_handle: e.sourceHandle ?? null,
        label: e.label ?? null,
      })),
    )
    if (insertEdgesError) throw insertEdgesError
  }

  for (const g of globals) {
    const { data: existing } = await supabase
      .from('chatbot_variables')
      .select('id')
      .eq('chatbot_id', chatbotId)
      .eq('scope', 'global')
      .eq('key', g.key)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from('chatbot_variables')
        .update({
          value_type: g.value_type,
          default_value: g.default_value as never,
          description: g.description ?? null,
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('chatbot_variables').insert({
        chatbot_id: chatbotId,
        key: g.key,
        value_type: g.value_type,
        default_value: g.default_value as never,
        description: g.description ?? null,
        scope: 'global',
      })
      if (error) throw error
    }
  }

  const savedAt = new Date().toISOString()
  const { error: flowUpdateError } = await supabase
    .from('chatbot_flows')
    .update({ updated_at: savedAt, has_draft_changes: true })
    .eq('id', flowId)
  if (flowUpdateError) throw flowUpdateError

  const chatbotPatch: {
    updated_at: string
    name?: string
    description?: string | null
  } = { updated_at: savedAt }
  if (chatbotMeta?.name?.trim()) chatbotPatch.name = chatbotMeta.name.trim()
  if (chatbotMeta && 'description' in chatbotMeta) {
    chatbotPatch.description = chatbotMeta.description?.trim() || null
  }
  const { error: botUpdateError } = await supabase.from('chatbots').update(chatbotPatch).eq('id', chatbotId)
  if (botUpdateError) throw botUpdateError
}

export function versionCompareHint(fileVersion: number | undefined, localVersion: number | undefined): string | null {
  if (fileVersion == null || localVersion == null) return null
  if (fileVersion < localVersion) {
    return `File flow version (v${fileVersion}) is older than the current chatbot (v${localVersion}). Replacing may discard newer work.`
  }
  if (fileVersion > localVersion) {
    return `File flow version (v${fileVersion}) is newer than the current chatbot (v${localVersion}).`
  }
  return `File and current chatbot are both at flow version v${localVersion}.`
}
