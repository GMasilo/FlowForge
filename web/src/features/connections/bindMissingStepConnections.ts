import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type { ConnectionKind } from '@/shared/types/database'

export type BindableConnection = {
  id: string
  name: string
  kind: ConnectionKind
}

const BINDABLE_STEP_TYPES = new Set(['http', 'email', 'database'])

function connectionIdOf(node: DesignerNode): string {
  const raw = node.config?.connectionId
  return typeof raw === 'string' ? raw.trim() : ''
}

/** Prefer a sole connection of that kind, else a name that looks like a demo lab. */
export function pickConnectionForKind(
  kind: ConnectionKind,
  connections: BindableConnection[],
): string | null {
  const ofKind = connections.filter((c) => c.kind === kind)
  if (!ofKind.length) return null
  if (ofKind.length === 1) return ofKind[0]!.id
  const demo =
    ofKind.find((c) => /^demo\b/i.test(c.name.trim())) ??
    ofKind.find((c) => /demo\s*lab/i.test(c.name)) ??
    ofKind.find((c) => /demo/i.test(c.name))
  return demo?.id ?? null
}

/**
 * Fill empty connectionId on http/email/database steps when a clear match exists.
 * Does not overwrite an already-set connectionId.
 */
export function bindMissingStepConnections(
  nodes: DesignerNode[],
  connections: BindableConnection[],
): { nodes: DesignerNode[]; changed: boolean; boundCount: number } {
  const picks = new Map<ConnectionKind, string | null>()
  for (const kind of ['http', 'email', 'database'] as ConnectionKind[]) {
    picks.set(kind, pickConnectionForKind(kind, connections))
  }

  let boundCount = 0
  const next = nodes.map((node) => {
    if (!BINDABLE_STEP_TYPES.has(node.type)) return node
    if (connectionIdOf(node)) return node
    const pick = picks.get(node.type as ConnectionKind)
    if (!pick) return node
    boundCount += 1
    return {
      ...node,
      config: { ...node.config, connectionId: pick },
    }
  })

  return { nodes: next, changed: boundCount > 0, boundCount }
}

/**
 * Packs ship an optional SMTP step that errors when no email connection exists.
 * Drop unbound optional email steps (and always drop key email_smtp when unbound).
 */
export function dropOrphanOptionalEmailSteps(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  connections: BindableConnection[],
): { nodes: DesignerNode[]; edges: DesignerEdge[]; changed: boolean } {
  const hasEmailConnection = connections.some((c) => c.kind === 'email')

  const dropIds = new Set(
    nodes
      .filter((n) => {
        if (n.type !== 'email') return false
        if (connectionIdOf(n)) return false
        // Always remove the industry-pack placeholder when unbound.
        if (n.key === 'email_smtp') return true
        // Other optional email steps only when no email connection is installed.
        return !hasEmailConnection && /optional/i.test(n.label)
      })
      .map((n) => n.id),
  )
  if (!dropIds.size) return { nodes, edges, changed: false }

  const nextNodes = nodes.filter((n) => !dropIds.has(n.id))
  let nextEdges = edges.filter((e) => !dropIds.has(e.source) && !dropIds.has(e.target))

  for (const id of dropIds) {
    const incoming = edges.filter((e) => e.target === id)
    const outgoing = edges.filter((e) => e.source === id)
    for (const inn of incoming) {
      for (const out of outgoing) {
        nextEdges.push({
          id: crypto.randomUUID(),
          source: inn.source,
          target: out.target,
          sourceHandle: inn.sourceHandle,
          label: inn.label ?? out.label,
        })
      }
    }
  }

  const seen = new Set<string>()
  nextEdges = nextEdges.filter((e) => {
    const key = `${e.source}|${e.target}|${e.sourceHandle ?? ''}|${e.label ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { nodes: nextNodes, edges: nextEdges, changed: true }
}

/** Apply bind + optional-email prune in one pass. */
export function reconcileStepConnections(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  connections: BindableConnection[],
): { nodes: DesignerNode[]; edges: DesignerEdge[]; changed: boolean } {
  const pruned = dropOrphanOptionalEmailSteps(nodes, edges, connections)
  const bound = bindMissingStepConnections(pruned.nodes, connections)
  return {
    nodes: bound.nodes,
    edges: pruned.edges,
    changed: pruned.changed || bound.changed,
  }
}
