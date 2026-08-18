import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { flowNodeTypes } from '@/features/designer/model/flowSchema'
import type { PreviewStepRun } from '@/features/designer/preview/previewRuntime'
import type { VariableType } from '@/shared/types/database'

export const FLOW_EXPORT_KIND = 'flowforge.chatbotFlow' as const
export const RUN_HISTORY_KIND = 'flowforge.previewRunHistory' as const
export const TRANSFER_VERSION = 1 as const

export type FlowGlobalExport = {
  key: string
  value_type: VariableType
  default_value: unknown
  description?: string | null
}

export type FlowEntityExport = {
  id: string
  key: string
}

export type ChatbotFlowExport = {
  kind: typeof FLOW_EXPORT_KIND
  version: typeof TRANSFER_VERSION
  exportedAt: string
  chatbot: {
    id: string
    name: string
    description?: string | null
  }
  flow: {
    id: string
    name: string
    version: number
  }
  globals: FlowGlobalExport[]
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  /** Entity id/key pairs for remapping entity steps on import. */
  entities?: FlowEntityExport[]
}

export type PreviewRunHistoryExport = {
  kind: typeof RUN_HISTORY_KIND
  version: typeof TRANSFER_VERSION
  exportedAt: string
  chatbot: { id: string; name: string }
  flowId: string | null
  runs: PreviewStepRun[]
}

const NODE_TYPES = new Set<string>(flowNodeTypes)

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function sanitizeNode(raw: unknown, index: number): DesignerNode {
  if (!isRecord(raw)) throw new Error(`Node #${index + 1} is invalid`)
  const id = String(raw.id ?? '').trim() || crypto.randomUUID()
  const key = String(raw.key ?? '').trim()
  const type = String(raw.type ?? '')
  if (!key) throw new Error(`Node #${index + 1} is missing key`)
  if (!NODE_TYPES.has(type)) throw new Error(`Node "${key}" has unknown type "${type}"`)
  const position = isRecord(raw.position)
    ? { x: Number(raw.position.x) || 0, y: Number(raw.position.y) || 0 }
    : { x: 0, y: 0 }
  return {
    id,
    key,
    type: type as DesignerNode['type'],
    label: String(raw.label ?? key),
    config: isRecord(raw.config) ? (raw.config as Record<string, unknown>) : {},
    position,
  }
}

function sanitizeEdge(raw: unknown, index: number, nodeIds: Set<string>): DesignerEdge {
  if (!isRecord(raw)) throw new Error(`Edge #${index + 1} is invalid`)
  const source = String(raw.source ?? '').trim()
  const target = String(raw.target ?? '').trim()
  if (!source || !target) throw new Error(`Edge #${index + 1} is missing source/target`)
  if (!nodeIds.has(source) || !nodeIds.has(target)) {
    throw new Error(`Edge #${index + 1} references unknown nodes`)
  }
  return {
    id: String(raw.id ?? '').trim() || crypto.randomUUID(),
    source,
    target,
    sourceHandle: (raw.sourceHandle as string | null | undefined) ?? null,
    label: (raw.label as string | null | undefined) ?? null,
  }
}

export function buildFlowExport(args: {
  chatbot: { id: string; name: string; description?: string | null }
  flow: { id: string; name: string; version: number }
  globals: FlowGlobalExport[]
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  entities?: FlowEntityExport[]
}): ChatbotFlowExport {
  return {
    kind: FLOW_EXPORT_KIND,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    chatbot: {
      id: args.chatbot.id,
      name: args.chatbot.name,
      description: args.chatbot.description ?? null,
    },
    flow: {
      id: args.flow.id,
      name: args.flow.name,
      version: args.flow.version,
    },
    globals: args.globals,
    nodes: args.nodes,
    edges: args.edges,
    ...(args.entities?.length ? { entities: args.entities } : {}),
  }
}

/** Remap entity node config.entityId using export keys → target chatbot entity ids. */
export function remapEntityIds(
  nodes: DesignerNode[],
  entitiesExport: FlowEntityExport[] | undefined,
  targetEntities: FlowEntityExport[],
): DesignerNode[] {
  if (!entitiesExport?.length && !targetEntities.length) return nodes

  const byKey = new Map(targetEntities.map((e) => [e.key, e.id]))
  const byId = new Map(targetEntities.map((e) => [e.id, e.id]))
  const exportKeyById = new Map(entitiesExport?.map((e) => [e.id, e.key]) ?? [])

  return nodes.map((node) => {
    if (node.type !== 'entity') return node
    const rawId = String(node.config.entityId ?? '').trim()
    if (!rawId) return node

    // Prefer key from export payload
    const exportKey = exportKeyById.get(rawId)
    if (exportKey && byKey.has(exportKey)) {
      return {
        ...node,
        config: { ...node.config, entityId: byKey.get(exportKey) },
      }
    }

    // Fall back: same id still exists on target
    if (byId.has(rawId)) return node

    // Last resort: treat rawId as a key
    if (byKey.has(rawId)) {
      return {
        ...node,
        config: { ...node.config, entityId: byKey.get(rawId) },
      }
    }

    return node
  })
}

export function buildRunHistoryExport(args: {
  chatbot: { id: string; name: string }
  flowId: string | null
  runs: PreviewStepRun[]
}): PreviewRunHistoryExport {
  return {
    kind: RUN_HISTORY_KIND,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    chatbot: args.chatbot,
    flowId: args.flowId,
    runs: args.runs,
  }
}

export function parseFlowExport(raw: unknown): {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
  entities?: FlowEntityExport[]
  meta: {
    chatbotId?: string
    chatbotName?: string
    chatbotDescription?: string | null
    flowName?: string
    flowVersion?: number
    exportedAt?: string
  }
} {
  if (!isRecord(raw)) throw new Error('Invalid flow file')
  if (raw.kind != null && raw.kind !== FLOW_EXPORT_KIND) {
    throw new Error(`Unsupported file kind "${String(raw.kind)}". Expected ${FLOW_EXPORT_KIND}`)
  }
  if (!Array.isArray(raw.nodes)) throw new Error('Flow file is missing nodes[]')
  if (!Array.isArray(raw.edges)) throw new Error('Flow file is missing edges[]')

  const nodes = raw.nodes.map((n, i) => sanitizeNode(n, i))
  const keys = new Set<string>()
  for (const n of nodes) {
    if (keys.has(n.key)) throw new Error(`Duplicate step key "${n.key}"`)
    keys.add(n.key)
  }
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = raw.edges.map((e, i) => sanitizeEdge(e, i, nodeIds))

  const globals: FlowGlobalExport[] = []
  if (Array.isArray(raw.globals)) {
    for (const g of raw.globals) {
      if (!isRecord(g)) continue
      const key = String(g.key ?? '').trim()
      if (!key) continue
      globals.push({
        key,
        value_type: (String(g.value_type ?? 'string') as VariableType) || 'string',
        default_value: g.default_value ?? null,
        description: (g.description as string | null | undefined) ?? null,
      })
    }
  }

  const chatbot = isRecord(raw.chatbot) ? raw.chatbot : null
  const flow = isRecord(raw.flow) ? raw.flow : null
  const flowVersionRaw = flow?.version
  const flowVersion =
    typeof flowVersionRaw === 'number' && Number.isFinite(flowVersionRaw)
      ? flowVersionRaw
      : typeof flowVersionRaw === 'string' && flowVersionRaw.trim() !== '' && Number.isFinite(Number(flowVersionRaw))
        ? Number(flowVersionRaw)
        : undefined

  const entities: FlowEntityExport[] = []
  if (Array.isArray(raw.entities)) {
    for (const e of raw.entities) {
      if (!isRecord(e)) continue
      const id = String(e.id ?? '').trim()
      const key = String(e.key ?? '').trim()
      if (!id || !key) continue
      entities.push({ id, key })
    }
  }

  return {
    nodes,
    edges,
    globals,
    ...(entities.length ? { entities } : {}),
    meta: {
      chatbotId: chatbot && typeof chatbot.id === 'string' ? chatbot.id : undefined,
      chatbotName: chatbot && typeof chatbot.name === 'string' ? chatbot.name : undefined,
      chatbotDescription:
        chatbot && 'description' in chatbot
          ? ((chatbot.description as string | null | undefined) ?? null)
          : undefined,
      flowName: flow && typeof flow.name === 'string' ? flow.name : undefined,
      flowVersion,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : undefined,
    },
  }
}

export function safeDownloadBasename(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || 'flowforge'
}
