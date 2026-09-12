import { supabase } from '@/shared/lib/supabase'
import type { Json } from '@/shared/types/database'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import {
  remapEntityIds,
  remapFlowGraphIds,
  type ChatbotFlowExport,
  type FlowEntityDefExport,
  type FlowEntityExport,
  type FlowGlobalExport,
  type FlowTemplateExport,
  type FlowTestScenarioExport,
} from '@/features/designer/utils/flowTransfer'
import {
  createEntity,
  ensureEntityPrimaryKey,
  restoreEntity,
  replaceStaticRecordsFromImport,
  upsertAttribute,
} from '@/features/entities/entityApi'

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

/** Create templates, entity schemas, and test scenarios from a flow export. */
export async function applyImportedBundleData(args: {
  chatbotId: string
  templates?: FlowTemplateExport[]
  entityDefs?: FlowEntityDefExport[]
  testScenarios?: FlowTestScenarioExport[]
  createdBy?: string | null
}): Promise<void> {
  const { chatbotId, createdBy } = args

  for (const def of args.entityDefs ?? []) {
    const { data: existingRows, error: lookupError } = await supabase
      .from('chatbot_entities')
      .select('id, deleted_at')
      .eq('chatbot_id', chatbotId)
      .eq('key', def.key)
    if (lookupError) throw lookupError
    const alive = (existingRows ?? []).find((row) => !row.deleted_at)
    const any = alive ?? existingRows?.[0]
    let entityId = any?.id

    if (entityId && any?.deleted_at) {
      await restoreEntity(entityId)
    } else if (!entityId) {
      const createdEntity = await createEntity({
        chatbotId,
        key: def.key,
        name: def.name,
        description: def.description ?? undefined,
        kind: def.kind,
      })
      entityId = createdEntity.id
    }

    if (!entityId) continue

    await ensureEntityPrimaryKey(entityId)

    for (const [index, attr] of def.attributes.entries()) {
      if (attr.key === 'id') continue
      await upsertAttribute({
        entityId,
        key: attr.key,
        label: attr.label ?? attr.key,
        value_type: attr.value_type,
        required: attr.required,
        is_identifier: false,
        is_unique: attr.is_unique,
        default_value: (attr.default_value as Json | null | undefined) ?? null,
        sort_order: attr.sort_order ?? index,
      })
    }
    if (def.kind === 'static' && (def.records?.length ?? 0) > 0) {
      await replaceStaticRecordsFromImport(entityId, def.records ?? [])
    }
  }

  for (const tmpl of args.templates ?? []) {
    const { data: existingRows, error: lookupError } = await supabase
      .from('chatbot_templates')
      .select('id, deleted_at')
      .eq('chatbot_id', chatbotId)
      .eq('key', tmpl.key)
    if (lookupError) throw lookupError
    const alive = (existingRows ?? []).find((row) => !row.deleted_at)
    const any = alive ?? existingRows?.[0]
    const patch = {
      name: tmpl.name,
      description: tmpl.description ?? null,
      content: tmpl.content as Json,
      deleted_at: null,
    }
    if (any?.id) {
      const { error } = await supabase.from('chatbot_templates').update(patch).eq('id', any.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('chatbot_templates').insert({
        chatbot_id: chatbotId,
        key: tmpl.key,
        name: tmpl.name,
        description: tmpl.description ?? null,
        kind: tmpl.kind,
        content: tmpl.content as Json,
        created_by: createdBy ?? null,
      })
      if (error) throw error
    }
  }

  for (const scenario of args.testScenarios ?? []) {
    const { data: existing, error: lookupError } = await supabase
      .from('chatbot_test_scenarios')
      .select('id')
      .eq('chatbot_id', chatbotId)
      .eq('name', scenario.name)
      .maybeSingle()
    if (lookupError) throw lookupError
    const globals = (scenario.globals ?? {}) as Json
    const expected = (scenario.expected ?? {}) as Json
    if (existing?.id) {
      const { error } = await supabase
        .from('chatbot_test_scenarios')
        .update({ globals, expected })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('chatbot_test_scenarios').insert({
        chatbot_id: chatbotId,
        name: scenario.name,
        globals,
        expected,
        created_by: createdBy ?? null,
      })
      if (error) throw error
    }
  }
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
}): Promise<{ nodes: DesignerNode[]; edges: DesignerEdge[] }> {
  const { chatbotId, flowId, edges, globals, chatbotMeta, entitiesExport } = args

  const targetEntities = await loadChatbotEntities(chatbotId)
  const entityRemapped = remapEntityIds(args.nodes, entitiesExport, targetEntities)
  const { nodes, edges: remappedEdges } = remapFlowGraphIds(entityRemapped, edges)

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

  if (remappedEdges.length) {
    const { error: insertEdgesError } = await supabase.from('flow_edges').insert(
      remappedEdges.map((e) => ({
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

  return { nodes, edges: remappedEdges }
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

function stripConnectionIdsFromNodes(nodes: DesignerNode[]): DesignerNode[] {
  return nodes.map((n) => {
    if (!n.config || typeof n.config !== 'object') return n
    if (!('connectionId' in n.config)) return n
    const { connectionId: _ignored, ...rest } = n.config
    return { ...n, config: rest }
  })
}

/** Full flowforge.chatbotFlow pack for marketplace publish. */
export async function buildMarketplacePackFromChatbot(chatbotId: string): Promise<ChatbotFlowExport> {
  const { fetchChatbotEntities } = await import('@/features/entities/entityApi')
  const { fetchChatbotTemplates } = await import('@/features/templates/templateApi')
  const { fetchChatbotTestScenarios } = await import('@/features/designer/preview/testScenarioApi')
  const { buildFlowExport } = await import('@/features/designer/utils/flowTransfer')

  const [bundle, entities, entityRows, templateRows, scenarioRows] = await Promise.all([
    loadFlowBundle(chatbotId),
    loadChatbotEntities(chatbotId),
    fetchChatbotEntities(chatbotId),
    fetchChatbotTemplates(chatbotId),
    fetchChatbotTestScenarios(chatbotId),
  ])

  const entityDefs: FlowEntityDefExport[] = entityRows.map((row) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    kind: row.kind,
    attributes: row.attributes.map((a) => ({
      key: a.key,
      label: a.label,
      value_type: a.value_type,
      required: a.required,
      is_identifier: a.is_identifier,
      is_unique: a.is_unique,
      default_value: a.default_value,
      sort_order: a.sort_order,
    })),
    records: (row.static_records ?? []).map((r) =>
      r.values && typeof r.values === 'object' && !Array.isArray(r.values)
        ? (r.values as Record<string, unknown>)
        : {},
    ),
  }))
  const templates: FlowTemplateExport[] = templateRows.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description,
    kind: row.kind,
    content: row.content,
  }))
  const testScenarios: FlowTestScenarioExport[] = scenarioRows.map((row) => ({
    name: row.name,
    globals:
      row.globals && typeof row.globals === 'object' && !Array.isArray(row.globals)
        ? (row.globals as Record<string, unknown>)
        : {},
    expected:
      row.expected && typeof row.expected === 'object' && !Array.isArray(row.expected)
        ? (row.expected as { variables?: string[]; stepKeys?: string[] })
        : {},
  }))

  return buildFlowExport({
    chatbot: bundle.chatbot,
    flow: bundle.flow,
    globals: bundle.globals,
    nodes: stripConnectionIdsFromNodes(bundle.nodes),
    edges: bundle.edges,
    entities,
    entityDefs,
    templates,
    testScenarios,
  })
}

export function marketplacePackSummary(pack: unknown): string {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return 'No pack payload'
  const p = pack as Record<string, unknown>
  if (p.kind !== 'flowforge.chatbotFlow') {
    return typeof p.note === 'string' ? p.note : 'Legacy listing (clone-only)'
  }
  const nodes = Array.isArray(p.nodes) ? p.nodes.length : 0
  const templates = Array.isArray(p.templates) ? p.templates.length : 0
  const entities = Array.isArray(p.entityDefs)
    ? p.entityDefs.length
    : Array.isArray(p.entities)
      ? p.entities.length
      : 0
  return `${nodes} steps · ${templates} templates · ${entities} entities`
}

/** Install a serialized pack into a new chatbot in the target instance. */
export async function installFlowPackToInstance(args: {
  instanceId: string
  name: string
  pack: unknown
  createdBy: string
}): Promise<{ chatbotId: string; connectionsNeedRebind: boolean }> {
  const { parseFlowExport } = await import('@/features/designer/utils/flowTransfer')
  const parsed = parseFlowExport(args.pack)
  const { data: bot, error: botError } = await supabase
    .from('chatbots')
    .insert({
      instance_id: args.instanceId,
      name: args.name,
      description: parsed.meta.chatbotDescription ?? null,
      created_by: args.createdBy,
    })
    .select('id')
    .single()
  if (botError) throw botError

  const flowBundle = await loadFlowBundle(bot.id)
  await applyImportedBundleData({
    chatbotId: bot.id,
    templates: parsed.templates,
    entityDefs: parsed.entityDefs,
    testScenarios: parsed.testScenarios,
    createdBy: args.createdBy,
  })
  const entitiesExport = parsed.entityDefs?.length
    ? parsed.entityDefs.map((e) => ({ id: e.id, key: e.key }))
    : parsed.entities
  await replaceFlowInDb({
    chatbotId: bot.id,
    flowId: flowBundle.flow.id,
    nodes: stripConnectionIdsFromNodes(parsed.nodes),
    edges: parsed.edges,
    globals: parsed.globals,
    entitiesExport,
    chatbotMeta: {
      name: args.name,
      description: parsed.meta.chatbotDescription ?? null,
    },
  })

  return { chatbotId: bot.id, connectionsNeedRebind: true }
}

