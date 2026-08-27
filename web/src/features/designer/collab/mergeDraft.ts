import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

export type MergeDraftArgs = {
  serverNodes: DesignerNode[]
  serverEdges: DesignerEdge[]
  localNodes: DesignerNode[]
  localEdges: DesignerEdge[]
  dirtyNodeKeys: Set<string>
  deletedNodeKeys: Set<string>
  peerLockedKeys: Set<string>
}

function byKey(nodes: DesignerNode[]): Map<string, DesignerNode> {
  const map = new Map<string, DesignerNode>()
  for (const n of nodes) map.set(n.key, n)
  return map
}

function byId(nodes: DesignerNode[]): Map<string, DesignerNode> {
  const map = new Map<string, DesignerNode>()
  for (const n of nodes) map.set(n.id, n)
  return map
}

type KeyEdge = {
  sourceKey: string
  targetKey: string
  sourceHandle?: string | null
  label?: string | null
}

function toKeyEdges(edges: DesignerEdge[], nodes: DesignerNode[]): KeyEdge[] {
  const idMap = byId(nodes)
  const out: KeyEdge[] = []
  for (const e of edges) {
    const s = idMap.get(e.source)
    const t = idMap.get(e.target)
    if (!s || !t) continue
    out.push({
      sourceKey: s.key,
      targetKey: t.key,
      sourceHandle: e.sourceHandle ?? null,
      label: e.label ?? null,
    })
  }
  return out
}

function edgeSig(e: KeyEdge): string {
  return `${e.sourceKey}|${e.targetKey}|${e.sourceHandle ?? ''}|${e.label ?? ''}`
}

/**
 * Merge local dirty edits onto the server draft by node key so concurrent
 * editors do not wipe each other's steps.
 */
export function mergeFlowDraft(args: MergeDraftArgs): {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
} {
  const {
    serverNodes,
    serverEdges,
    localNodes,
    localEdges,
    dirtyNodeKeys,
    deletedNodeKeys,
    peerLockedKeys,
  } = args

  const serverByKey = byKey(serverNodes)
  const localByKey = byKey(localNodes)
  const mergedByKey = new Map<string, DesignerNode>()

  // Start from server
  for (const [key, node] of serverByKey) {
    if (deletedNodeKeys.has(key) && !peerLockedKeys.has(key)) continue
    mergedByKey.set(key, node)
  }

  // Overlay dirty local nodes (new or edited). Never overwrite a peer-locked key
  // unless we somehow hold it locally as dirty from before the lock — still skip.
  for (const key of dirtyNodeKeys) {
    if (peerLockedKeys.has(key)) continue
    const local = localByKey.get(key)
    if (!local) continue
    const server = serverByKey.get(key)
    // Prefer local content; keep stable server id when key already exists
    if (server) {
      mergedByKey.set(key, {
        ...local,
        id: server.id,
      })
    } else {
      mergedByKey.set(key, local)
    }
  }

  const nodes = [...mergedByKey.values()]
  const keyToId = new Map(nodes.map((n) => [n.key, n.id]))

  const serverKeyEdges = toKeyEdges(serverEdges, serverNodes)
  const localKeyEdges = toKeyEdges(localEdges, localNodes)

  const resultKeys = new Map<string, KeyEdge>()

  for (const e of serverKeyEdges) {
    if (!keyToId.has(e.sourceKey) || !keyToId.has(e.targetKey)) continue
    const touchesDirty = dirtyNodeKeys.has(e.sourceKey) || dirtyNodeKeys.has(e.targetKey)
    if (touchesDirty) continue
    resultKeys.set(edgeSig(e), e)
  }

  for (const e of localKeyEdges) {
    if (!keyToId.has(e.sourceKey) || !keyToId.has(e.targetKey)) continue
    const touchesDirty = dirtyNodeKeys.has(e.sourceKey) || dirtyNodeKeys.has(e.targetKey)
    const locked =
      peerLockedKeys.has(e.sourceKey) || peerLockedKeys.has(e.targetKey)
    if (locked && !touchesDirty) continue
    if (!touchesDirty) {
      // Structural edge among clean keys: keep if already from server; else add local
      if (!resultKeys.has(edgeSig(e))) resultKeys.set(edgeSig(e), e)
      continue
    }
    resultKeys.set(edgeSig(e), e)
  }

  const edges: DesignerEdge[] = [...resultKeys.values()].map((e) => ({
    id: crypto.randomUUID(),
    source: keyToId.get(e.sourceKey)!,
    target: keyToId.get(e.targetKey)!,
    sourceHandle: e.sourceHandle ?? undefined,
    label: e.label ?? undefined,
  }))

  return { nodes, edges }
}

export function dbRowsToDesignerNodes(
  rows: Array<{
    id: string
    key: string
    type: string
    label: string
    config: unknown
    position_x: number | null
    position_y: number | null
  }>,
): DesignerNode[] {
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    type: r.type as DesignerNode['type'],
    label: r.label,
    config: (r.config && typeof r.config === 'object' ? r.config : {}) as Record<string, unknown>,
    position: { x: r.position_x ?? 0, y: r.position_y ?? 0 },
  }))
}

export function dbRowsToDesignerEdges(
  rows: Array<{
    id: string
    source_node_id: string
    target_node_id: string
    source_handle: string | null
    label: string | null
  }>,
): DesignerEdge[] {
  return rows.map((r) => ({
    id: r.id,
    source: r.source_node_id,
    target: r.target_node_id,
    sourceHandle: r.source_handle ?? undefined,
    label: r.label ?? undefined,
  }))
}
