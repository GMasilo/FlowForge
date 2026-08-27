import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { getStepOutputVariable } from '@/features/designer/model/flowSchema'
import {
  buildPublishedGraph,
  parsePublishedGraph,
  type PublishedFlowGraph,
} from '@/features/designer/utils/flowPublish'
import { mediaExprMap, catalogFromFilenames, collectMediaFilenamesFromNodes } from '@/features/designer/model/chatbotMedia'
import { interpolate, type PreviewEngineState } from '@/features/designer/preview/previewRuntime'
import { supabase } from '@/shared/lib/supabase'
import type { Json, VariableType } from '@/shared/types/database'
import { collectStoreImageFilenames, templatesExprMap } from '@/features/templates/templateModel'
import { instanceFileUrl, isFlowForgeApiConfigured } from '@/shared/lib/flowforgeApi'
import { nodeTypeLabel } from '@/features/designer/model/flowSchema'

export type TransferSourceOption = {
  /** Stored mapping source, e.g. `{{vars.email}}`. */
  value: string
  label: string
  detail?: string
}

const TRANSFER_SOURCE_STEP_TYPES = new Set([
  'question',
  'http',
  'email',
  'set_variable',
  'operation',
  'entity',
  'integration',
  'loop',
])

/** Nodes that can reach `nodeId` (upstream), excluding `nodeId` itself. */
export function ancestorNodeIds(nodeId: string, edges: DesignerEdge[]): Set<string> {
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.target) ?? []
    list.push(e.source)
    incoming.set(e.target, list)
  }
  const ancestors = new Set<string>()
  const stack = [...(incoming.get(nodeId) ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    if (ancestors.has(cur)) continue
    ancestors.add(cur)
    for (const p of incoming.get(cur) ?? []) stack.push(p)
  }
  return ancestors
}

/**
 * Variables already available before a Transfer step:
 * globals + output vars from upstream steps that actually produce values.
 * Excludes message/condition/end/handoff/transfer and anything at/after the current step.
 */
export function listTransferSourceOptions(args: {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: string[]
  transferNodeId: string
}): TransferSourceOption[] {
  const { nodes, edges, globals, transferNodeId } = args
  const upstream = ancestorNodeIds(transferNodeId, edges)
  const seen = new Set<string>()
  const opts: TransferSourceOption[] = []

  function add(value: string, label: string, detail?: string) {
    if (!value || seen.has(value)) return
    seen.add(value)
    opts.push({ value, label, detail })
  }

  for (const key of globals) {
    const k = key.trim()
    if (!k) continue
    add(`{{vars.${k}}}`, k, 'global')
  }

  for (const n of nodes) {
    if (!upstream.has(n.id)) continue
    if (!TRANSFER_SOURCE_STEP_TYPES.has(n.type)) continue

    const outVar = getStepOutputVariable(n)
    if (outVar) {
      add(`{{vars.${outVar}}}`, outVar, `from ${n.key}`)
    } else if (n.type === 'question') {
      // Questions always produce an answer even without a named output variable.
      add(`{{steps.${n.key}.response}}`, `${n.key}.response`, 'answer')
    }

    if (n.type === 'integration') {
      const key = String(n.config.resultVariable ?? '').trim()
      if (key) add(`{{vars.${key}}}`, key, `from ${n.key}`)
    }

    if (n.type === 'email') {
      const key = String(n.config.outputVariable ?? '').trim()
      if (key) add(`{{vars.${key}}}`, key, `from ${n.key}`)
    }

    if (n.type === 'loop') {
      const itemVar = String(n.config.itemVariable ?? 'item').trim() || 'item'
      const indexVar = String(n.config.indexVariable ?? 'index').trim() || 'index'
      add(`{{vars.${itemVar}}}`, itemVar, `loop ${n.key}`)
      add(`{{vars.${indexVar}}}`, indexVar, `loop ${n.key}`)
    }

    // Question answers also live on steps.*.response when no dedicated output var naming needed,
    // but prefer vars only — skip bare steps.* and never expose message steps.
  }

  return opts
}

export type TransferTargetOption = {
  /** Destination variable key written into the target vars bag. */
  value: string
  label: string
  detail?: string
}

/**
 * Variables the destination chatbot can receive on transfer entry:
 * its globals plus output keys produced by steps in its flow.
 */
export function listTransferTargetOptions(args: {
  globals: string[]
  nodes: Array<{
    key: string
    type: string
    label?: string
    config?: Record<string, unknown>
  }>
}): TransferTargetOption[] {
  const seen = new Set<string>()
  const opts: TransferTargetOption[] = []

  function add(value: string, label: string, detail?: string) {
    const key = value.trim()
    if (!key || seen.has(key)) return
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return
    seen.add(key)
    opts.push({ value: key, label, detail })
  }

  for (const g of args.globals) {
    add(g, g.trim(), 'global')
  }

  for (const n of args.nodes) {
    if (!TRANSFER_SOURCE_STEP_TYPES.has(n.type)) continue
    const cfg = n.config ?? {}

    if (
      n.type === 'question' ||
      n.type === 'http' ||
      n.type === 'operation' ||
      n.type === 'entity'
    ) {
      const key = String(cfg.outputVariable ?? '').trim()
      if (key) add(key, key, `step ${n.key}`)
    } else if (n.type === 'set_variable') {
      const key = String(cfg.variableKey ?? '').trim()
      if (key) add(key, key, `step ${n.key}`)
    }

    if (n.type === 'integration') {
      const key = String(cfg.resultVariable ?? '').trim()
      if (key) add(key, key, `step ${n.key}`)
    }

    if (n.type === 'email') {
      const key = String(cfg.outputVariable ?? '').trim()
      if (key) add(key, key, `step ${n.key}`)
    }

    if (n.type === 'loop') {
      const itemVar = String(cfg.itemVariable ?? 'item').trim() || 'item'
      const indexVar = String(cfg.indexVariable ?? 'index').trim() || 'index'
      add(itemVar, itemVar, `loop ${n.key}`)
      add(indexVar, indexVar, `loop ${n.key}`)
    }
  }

  return opts
}

export type TransferVariableMapping = {
  /** Source expression or var key, e.g. `customer_id` or `{{vars.email}}`. */
  source: string
  /** Target variable key on the destination chatbot. */
  target: string
}

export type TransferStepConfig = {
  targetChatbotId: string
  startNodeKey: string
  message: string
  passAllVariables: boolean
  variableMappings: TransferVariableMapping[]
}

export type TransferEntrySettings = {
  requiredVariables: string[]
}

export function parseTransferConfig(config: Record<string, unknown> | undefined | null): TransferStepConfig {
  const raw = config ?? {}
  const mappingsRaw = raw.variableMappings
  const mappings: TransferVariableMapping[] = []
  if (Array.isArray(mappingsRaw)) {
    for (const row of mappingsRaw) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const source = String((row as { source?: unknown }).source ?? '')
      const target = String((row as { target?: unknown }).target ?? '')
      // Keep blank / incomplete rows so the designer "Add" control works.
      mappings.push({ source, target })
    }
  }
  return {
    targetChatbotId: String(raw.targetChatbotId ?? '').trim(),
    startNodeKey: String(raw.startNodeKey ?? '').trim(),
    message: String(raw.message ?? ''),
    passAllVariables: raw.passAllVariables === true,
    variableMappings: mappings,
  }
}

export function parseTransferEntrySettings(settings: unknown): TransferEntrySettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { requiredVariables: [] }
  }
  const entry = (settings as { transferEntry?: unknown }).transferEntry
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { requiredVariables: [] }
  }
  const raw = (entry as { requiredVariables?: unknown }).requiredVariables
  if (!Array.isArray(raw)) return { requiredVariables: [] }
  return {
    requiredVariables: raw
      .map((v) => String(v ?? '').trim())
      .filter((v) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v)),
  }
}

function getByPath(value: unknown, path: string[]): unknown {
  let cur: unknown = value
  for (const part of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

/** Resolve a mapping source against current runtime state. */
export function resolveTransferSourceValue(
  source: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
): unknown {
  const trimmed = source.trim()
  if (!trimmed) return undefined

  const templateMatch = trimmed.match(/^\{\{\s*([\s\S]+?)\s*\}\}$/)
  const pathExpr = templateMatch ? templateMatch[1]!.trim() : trimmed

  if (pathExpr.startsWith('vars.')) {
    return getByPath(vars, pathExpr.slice(5).split('.').filter(Boolean))
  }
  if (pathExpr.startsWith('steps.')) {
    return getByPath(stepOutputs, pathExpr.slice(6).split('.').filter(Boolean))
  }
  // Bare key → vars first, then stepOutputs
  if (Object.prototype.hasOwnProperty.call(vars, pathExpr)) return vars[pathExpr]
  const dotted = pathExpr.split('.').filter(Boolean)
  if (dotted.length > 1) {
    const fromVars = getByPath(vars, dotted)
    if (fromVars !== undefined) return fromVars
    return getByPath(stepOutputs, dotted)
  }
  return vars[pathExpr]
}

export function buildTransferVariables(args: {
  config: TransferStepConfig
  sourceVars: Record<string, unknown>
  stepOutputs: Record<string, unknown>
  targetGlobals: Record<string, unknown>
  fromChatbotId?: string | null
  fromChatbotName?: string | null
}): { vars: Record<string, unknown>; providedKeys: Set<string> } {
  const { config, sourceVars, stepOutputs, targetGlobals, fromChatbotId, fromChatbotName } = args
  const providedKeys = new Set<string>()
  /** Fresh bag for the target entry step — never inherits source vars unless opted in. */
  const next: Record<string, unknown> = {}

  if (config.passAllVariables) {
    for (const [k, v] of Object.entries(sourceVars)) {
      // Refresh transfer meta on the destination; don't copy stale transfer markers.
      if (
        k === '_transfer_entry' ||
        k === '_transferred_from' ||
        k === '_transferred_from_name'
      ) {
        continue
      }
      next[k] = v
      providedKeys.add(k)
    }
  }

  for (const map of config.variableMappings) {
    const target = map.target.trim()
    const source = map.source.trim()
    if (!target || !source) continue
    const value = resolveTransferSourceValue(source, sourceVars, stepOutputs)
    if (value !== undefined) {
      next[target] = value
      providedKeys.add(target)
    }
  }

  // Target chatbot globals only fill keys that were not explicitly provided.
  for (const [k, v] of Object.entries(targetGlobals)) {
    if (!(k in next) || next[k] === undefined || next[k] === null || next[k] === '') {
      next[k] = v
    }
  }

  if (sourceVars._environment != null) next._environment = sourceVars._environment
  if (fromChatbotId) next._transferred_from = fromChatbotId
  if (fromChatbotName) next._transferred_from_name = fromChatbotName
  next._transfer_entry = true
  return { vars: next, providedKeys }
}

export function missingRequiredTransferVariables(
  required: string[],
  vars: Record<string, unknown>,
  providedKeys?: Set<string>,
): string[] {
  const missing: string[] = []
  for (const key of required) {
    if (providedKeys && !providedKeys.has(key)) {
      missing.push(key)
      continue
    }
    if (!(key in vars) || vars[key] == null) {
      missing.push(key)
      continue
    }
    if (typeof vars[key] === 'string' && !String(vars[key]).trim()) {
      missing.push(key)
    }
  }
  return missing
}

export function findStartNodeId(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  startNodeKey: string | null | undefined,
): string | null {
  const key = (startNodeKey ?? '').trim()
  if (key) {
    const hit = nodes.find((n) => n.key === key)
    if (hit) return hit.id
  }
  const incoming = new Set(edges.map((e) => e.target))
  const root = nodes.find((n) => !incoming.has(n.id)) ?? nodes[0]
  return root?.id ?? null
}

export function applyGraphTransfer(args: {
  prev: PreviewEngineState
  graph: PublishedFlowGraph
  vars: Record<string, unknown>
  startNodeKey?: string | null
  transferMessage?: string | null
  mediaCatalog?: PreviewEngineState['mediaCatalog']
  templates?: Record<string, unknown>
}): PreviewEngineState {
  const { prev, graph, vars, startNodeKey, transferMessage, mediaCatalog, templates } = args
  const currentId = findStartNodeId(graph.nodes, graph.edges, startNodeKey)
  const messages = [...prev.messages]
  const text = (transferMessage ?? '').trim()
  if (text) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'bot',
      text,
      createdAt: new Date().toISOString(),
    })
  }
  const catalog = mediaCatalog ?? prev.mediaCatalog
  return {
    ...prev,
    currentId,
    // Replace vars entirely — do not spread prev.vars (source chatbot state).
    vars,
    // Prior step outputs must not be visible to the target entry step.
    stepOutputs: {},
    messages,
    phase: currentId ? { kind: 'typing' } : { kind: 'finished' },
    loopStack: [],
    otpChallenge: null,
    captchaChallenge: null,
    mediaCatalog: catalog,
    media: mediaExprMap(catalog),
    templates: templates ?? prev.templates,
  }
}

export async function fetchTargetChatbotGraph(args: {
  chatbotId: string
  instanceId: string
  environment?: 'production' | 'staging'
  preferDraft?: boolean
}): Promise<{
  graph: PublishedFlowGraph
  name: string
  settings: unknown
  globals: Record<string, unknown>
}> {
  const env = args.environment ?? 'production'
  const { data: bot, error: botErr } = await supabase
    .from('chatbots')
    .select('id, name, settings, instance_id, deleted_at')
    .eq('id', args.chatbotId)
    .eq('instance_id', args.instanceId)
    .is('deleted_at', null)
    .maybeSingle()
  if (botErr) throw botErr
  if (!bot) {
    throw new Error('Target chatbot is not active in this organisation')
  }

  const { data: flow, error: flowErr } = await supabase
    .from('chatbot_flows')
    .select('published_graph, staging_published_graph, id')
    .eq('chatbot_id', args.chatbotId)
    .maybeSingle()
  if (flowErr) throw flowErr

  let graph: PublishedFlowGraph | null = null
  const rawGraph = env === 'staging' ? flow?.staging_published_graph : flow?.published_graph
  if (rawGraph && typeof rawGraph === 'object') {
    try {
      graph = parsePublishedGraph(rawGraph)
    } catch {
      graph = null
    }
  }

  if (!graph && args.preferDraft && flow?.id) {
    const [{ data: nodes }, { data: edges }, { data: globals }] = await Promise.all([
      supabase
        .from('flow_nodes')
        .select('id, key, type, label, config, position_x, position_y')
        .eq('flow_id', flow.id),
      supabase
        .from('flow_edges')
        .select('id, source_node_id, target_node_id, source_handle, label')
        .eq('flow_id', flow.id),
      supabase
        .from('chatbot_variables')
        .select('key, default_value, value_type, description')
        .eq('chatbot_id', args.chatbotId)
        .eq('scope', 'global'),
    ])
    graph = buildPublishedGraph({
      nodes: (nodes ?? []).map((n) => ({
        id: n.id,
        key: n.key,
        type: n.type,
        label: n.label ?? n.key,
        config: (n.config ?? {}) as Record<string, unknown>,
        position: { x: n.position_x, y: n.position_y },
      })),
      edges: (edges ?? []).map((e) => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        sourceHandle: e.source_handle,
        label: e.label,
      })),
      globals: (globals ?? []).map((g) => ({
        key: g.key,
        default_value: g.default_value,
        value_type: (g.value_type as VariableType) || 'string',
        description: g.description,
      })),
      publishVersion: 0,
      templates: [],
    })
  }

  if (!graph) {
    throw new Error(
      env === 'staging'
        ? 'Target chatbot has no staging publish'
        : 'Target chatbot is not published',
    )
  }

  const globalsMap: Record<string, unknown> = {}
  for (const g of graph.globals) globalsMap[g.key] = g.default_value

  const { data: liveGlobals } = await supabase
    .from('chatbot_variables')
    .select('key, default_value')
    .eq('chatbot_id', args.chatbotId)
    .eq('scope', 'global')
  if (liveGlobals?.length) {
    for (const row of liveGlobals) {
      if (!(row.key in globalsMap) || globalsMap[row.key] == null) {
        globalsMap[row.key] = row.default_value
      }
    }
  }

  return {
    graph,
    name: bot.name,
    settings: bot.settings,
    globals: globalsMap,
  }
}

export async function transferPublicConversation(args: {
  sessionId: string
  targetChatbotId: string
  startNodeKey?: string | null
  variables: Record<string, unknown>
  fromNodeKey?: string | null
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('transfer_public_conversation', {
    p_session_id: args.sessionId,
    p_target_chatbot_id: args.targetChatbotId,
    p_start_node_key: args.startNodeKey || null,
    p_variables: args.variables as Json,
    p_from_node_key: args.fromNodeKey || null,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('Invalid transfer response')
  return data as Record<string, unknown>
}

export async function executeChatbotTransfer(args: {
  state: PreviewEngineState
  node: DesignerNode
  mode: 'public' | 'preview'
  sessionId?: string | null
  environment?: 'production' | 'staging'
  fromChatbotId: string
  fromChatbotName?: string | null
  instanceId: string
}): Promise<{
  state: PreviewEngineState
  graph: PublishedFlowGraph
  chatbotId: string
  name: string
}> {
  const config = parseTransferConfig(args.node.config)
  if (!config.targetChatbotId) {
    throw new Error('Select a target chatbot on the Transfer step')
  }
  if (config.targetChatbotId === args.fromChatbotId) {
    throw new Error('Cannot transfer to the same chatbot')
  }

  const env = args.environment ?? 'production'
  if (!args.instanceId) {
    throw new Error('Organisation required for transfer')
  }
  const target = await fetchTargetChatbotGraph({
    chatbotId: config.targetChatbotId,
    instanceId: args.instanceId,
    environment: env,
    preferDraft: args.mode === 'preview',
  })

  const required = parseTransferEntrySettings(target.settings).requiredVariables
  const { vars: mapped, providedKeys } = buildTransferVariables({
    config,
    sourceVars: args.state.vars,
    stepOutputs: args.state.stepOutputs,
    targetGlobals: target.globals,
    fromChatbotId: args.fromChatbotId,
    fromChatbotName: args.fromChatbotName ?? null,
  })

  const missing = missingRequiredTransferVariables(required, mapped, providedKeys)
  if (missing.length) {
    throw new Error(`Missing required transfer variables: ${missing.join(', ')}`)
  }

  if (args.mode === 'public') {
    if (!args.sessionId) throw new Error('Session required for transfer')
    await transferPublicConversation({
      sessionId: args.sessionId,
      targetChatbotId: config.targetChatbotId,
      startNodeKey: config.startNodeKey || null,
      variables: mapped,
      fromNodeKey: args.node.key,
    })
  }

  const message = config.message.trim()
    ? interpolate(
        config.message,
        args.state.vars,
        args.state.stepOutputs,
        args.state.media,
        true,
        args.state.templates,
      )
    : ''

  const filenames = [
    ...new Set([
      ...collectMediaFilenamesFromNodes(target.graph.nodes),
      ...collectStoreImageFilenames(target.graph.templates ?? []),
    ]),
  ]
  const mediaCatalog =
    isFlowForgeApiConfigured() && args.instanceId
      ? catalogFromFilenames(filenames, (filename) =>
          instanceFileUrl({
            kind: 'media',
            instanceId: args.instanceId,
            chatbotId: config.targetChatbotId,
            filename,
          }),
        )
      : []

  const templates = templatesExprMap(target.graph.templates ?? [])
  const nextState = applyGraphTransfer({
    prev: args.state,
    graph: target.graph,
    vars: mapped,
    startNodeKey: config.startNodeKey || null,
    transferMessage: message,
    mediaCatalog,
    templates,
  })

  const now = new Date().toISOString()
  const runs = [
    ...args.state.runs,
    {
      id: crypto.randomUUID(),
      nodeId: args.node.id,
      nodeKey: args.node.key,
      nodeLabel: args.node.label || args.node.key,
      type: args.node.type,
      typeLabel: nodeTypeLabel(args.node.type),
      status: 'Succeeded' as const,
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      inputs: {
        targetChatbotId: config.targetChatbotId,
        startNodeKey: config.startNodeKey || null,
      },
      processed: { mappedKeys: Object.keys(mapped) },
      outputs: { chatbotId: config.targetChatbotId, name: target.name },
      savedAs: null,
    },
  ]

  return {
    state: { ...nextState, runs },
    graph: target.graph,
    chatbotId: config.targetChatbotId,
    name: target.name,
  }
}
