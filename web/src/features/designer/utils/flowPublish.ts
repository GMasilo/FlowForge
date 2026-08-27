import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type { FlowGlobalExport } from '@/features/designer/utils/flowTransfer'
import { isTemplateKind } from '@/features/templates/templateModel'
import type { Json, TemplateKind } from '@/shared/types/database'

export const PUBLISHED_GRAPH_KIND = 'flowforge.publishedGraph' as const
export const PUBLISHED_GRAPH_VERSION = 1 as const

export type PublishedTemplate = {
  id: string
  key: string
  name: string
  kind: TemplateKind
  content: Json
}

/** Snapshot stored in chatbot_flows.published_graph — production/live. */
export type PublishedFlowGraph = {
  kind: typeof PUBLISHED_GRAPH_KIND
  version: typeof PUBLISHED_GRAPH_VERSION
  publishedAt: string
  publishVersion: number
  globals: FlowGlobalExport[]
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  templates?: PublishedTemplate[]
}

export function buildPublishedGraph(args: {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
  publishVersion: number
  publishedAt?: string
  templates?: PublishedTemplate[]
}): PublishedFlowGraph {
  const publishedAt = args.publishedAt ?? new Date().toISOString()
  return {
    kind: PUBLISHED_GRAPH_KIND,
    version: PUBLISHED_GRAPH_VERSION,
    publishedAt,
    publishVersion: args.publishVersion,
    globals: args.globals,
    nodes: args.nodes,
    edges: args.edges,
    templates: args.templates ?? [],
  }
}

export function publishedGraphAsJson(graph: PublishedFlowGraph): Json {
  return graph as unknown as Json
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Validate + normalize a published_graph JSON blob from the DB / public RPC. */
export function parsePublishedGraph(raw: unknown): PublishedFlowGraph {
  if (!isRecord(raw)) throw new Error('Invalid published graph')
  if (raw.kind !== PUBLISHED_GRAPH_KIND) {
    throw new Error(`Unsupported published graph kind "${String(raw.kind)}"`)
  }
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new Error('Published graph is missing nodes/edges')
  }
  const globals: FlowGlobalExport[] = []
  if (Array.isArray(raw.globals)) {
    for (const g of raw.globals) {
      if (!isRecord(g)) continue
      const key = String(g.key ?? '').trim()
      if (!key) continue
      globals.push({
        key,
        value_type: (String(g.value_type ?? 'string') as FlowGlobalExport['value_type']) || 'string',
        default_value: g.default_value ?? null,
        description: (g.description as string | null | undefined) ?? null,
      })
    }
  }
  const templates: PublishedTemplate[] = []
  if (Array.isArray(raw.templates)) {
    for (const t of raw.templates) {
      if (!isRecord(t)) continue
      const key = String(t.key ?? '').trim()
      const kind = String(t.kind ?? '')
      if (!key || !isTemplateKind(kind)) continue
      templates.push({
        id: String(t.id ?? key),
        key,
        name: String(t.name ?? key),
        kind,
        content: (t.content as Json) ?? {},
      })
    }
  }
  return {
    kind: PUBLISHED_GRAPH_KIND,
    version: PUBLISHED_GRAPH_VERSION,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : new Date().toISOString(),
    publishVersion: typeof raw.publishVersion === 'number' ? raw.publishVersion : 1,
    globals,
    nodes: raw.nodes as DesignerNode[],
    edges: raw.edges as DesignerEdge[],
    templates,
  }
}

export type PublishStatus =
  | { kind: 'never'; label: string }
  | { kind: 'draft'; label: string; version: number; publishedAt: string }
  | { kind: 'live'; label: string; version: number; publishedAt: string }

export function getPublishStatus(flow: {
  version: number
  published_at: string | null
  has_draft_changes: boolean
  published_graph: unknown
}): PublishStatus {
  if (!flow.published_at || flow.published_graph == null) {
    return { kind: 'never', label: 'Not published' }
  }
  if (flow.has_draft_changes) {
    return {
      kind: 'draft',
      label: `Unpublished changes · v${flow.version}`,
      version: flow.version,
      publishedAt: flow.published_at,
    }
  }
  return {
    kind: 'live',
    label: `Published v${flow.version}`,
    version: flow.version,
    publishedAt: flow.published_at,
  }
}

export type StagingPublishStatus =
  | { kind: 'never'; label: string }
  | { kind: 'live'; label: string; version: number; publishedAt: string }

export function getStagingPublishStatus(flow: {
  staging_version?: number | null
  staging_published_at?: string | null
  staging_published_graph?: unknown
}): StagingPublishStatus {
  if (!flow.staging_published_at || flow.staging_published_graph == null) {
    return { kind: 'never', label: 'Staging not published' }
  }
  return {
    kind: 'live',
    label: `Staging v${flow.staging_version ?? 0}`,
    version: flow.staging_version ?? 0,
    publishedAt: flow.staging_published_at,
  }
}
