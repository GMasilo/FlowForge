import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

/** Structural analysis: conditions are treated as possible branches, not evaluated. */
export function analyzeGraph(nodes: DesignerNode[], edges: DesignerEdge[]) {
  const ids = new Set(nodes.map(n => n.id))
  const byId = new Map(nodes.map(n => [n.id, n]))
  const byKey = new Map(nodes.map(n => [n.key, n.id]))
  const links = edges.filter(e => ids.has(e.source) && ids.has(e.target))
  const hasIncoming = new Set(links.map(e => e.target))
  const entry = nodes.find(n => !hasIncoming.has(n.id))?.id ?? nodes[0]?.id
  const out = new Map(nodes.map(n => [n.id, new Set<string>()]))
  const incoming = new Map(nodes.map(n => [n.id, new Set<string>()]))
  for (const e of links) if (byId.get(e.source)?.type !== 'end') out.get(e.source)!.add(e.target)
  for (const n of nodes) {
    if (n.type === 'skip_to') {
      const target = byKey.get(String(n.config.targetNodeKey ?? ''))
      if (target) { out.get(n.id)!.clear(); out.get(n.id)!.add(target) }
    }
  }
  for (const [source, targets] of out) for (const target of targets) incoming.get(target)!.add(source)
  const distances = new Map<string, number>()
  const queue = entry ? [entry] : []
  if (entry) distances.set(entry, 0)
  for (let i = 0; i < queue.length; i++) for (const next of out.get(queue[i]!) ?? []) {
    if (!distances.has(next)) { distances.set(next, distances.get(queue[i]!)! + 1); queue.push(next) }
  }
  // Iterative Kosaraju SCC traversal avoids recursion limits on large flows.
  const seen = new Set<string>(), order: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const stack: Array<[string, boolean]> = [[id, false]]
    while (stack.length) {
      const [v, done] = stack.pop()!
      if (done) { order.push(v); continue }
      if (seen.has(v)) continue
      seen.add(v); stack.push([v, true])
      for (const next of out.get(v)!) if (!seen.has(next)) stack.push([next, false])
    }
  }
  const components: string[][] = [], assigned = new Set<string>()
  for (const id of order.reverse()) {
    if (assigned.has(id)) continue
    const component: string[] = [], stack = [id]
    assigned.add(id)
    while (stack.length) {
      const v = stack.pop()!; component.push(v)
      for (const next of incoming.get(v)!) if (!assigned.has(next)) { assigned.add(next); stack.push(next) }
    }
    components.push(component)
  }
  const cycles = components.filter(c => c.length > 1 || out.get(c[0]!)!.has(c[0]!))
  const exits = nodes.filter(n => n.type === 'end' || !out.get(n.id)!.size).map(n => n.id)
  const canExit = new Set(exits), reverseQueue = [...exits]
  for (let i = 0; i < reverseQueue.length; i++) for (const prev of incoming.get(reverseQueue[i]!)!) {
    if (!canExit.has(prev)) { canExit.add(prev); reverseQueue.push(prev) }
  }
  const dead = nodes.filter(n => !distances.has(n.id)).map(n => n.id)
  const trapped = nodes.filter(n => distances.has(n.id) && !canExit.has(n.id)).map(n => n.id)
  const branches = [...distances.keys()].reduce((sum, id) => sum + Math.max(0, out.get(id)!.size - 1), 0)
  const shortestExit = exits.filter(id => distances.has(id)).map(id => distances.get(id)! + 1)
  // Lay out the SCC condensation graph; all nodes in a cycle share a column.
  const componentOf = new Map(components.flatMap((c, i) => c.map(id => [id, i] as const)))
  const dag = components.map(() => new Set<number>()), degrees = components.map(() => 0), ranks = components.map(() => 0)
  for (const [source, targets] of out) for (const target of targets) {
    const a = componentOf.get(source)!, b = componentOf.get(target)!
    if (a !== b && !dag[a]!.has(b)) { dag[a]!.add(b); degrees[b]!++ }
  }
  const ready = degrees.flatMap((degree, i) => degree === 0 ? [i] : [])
  for (let i = 0; i < ready.length; i++) for (const next of dag[ready[i]!]!) {
    ranks[next] = Math.max(ranks[next]!, ranks[ready[i]!]! + 1)
    if (--degrees[next]! === 0) ready.push(next)
  }
  const rows = new Map<number, number>(), positions = new Map<string, { x: number; y: number }>()
  for (const n of nodes) {
    const rank = ranks[componentOf.get(n.id)!]!, row = rows.get(rank) ?? 0
    positions.set(n.id, { x: 48 + rank * 300, y: 40 + row * 160 }); rows.set(rank, row + 1)
  }
  return { entry, dead, trapped, cycles, complexity: nodes.length ? branches + 1 : 0,
    shortestExit: shortestExit.length ? Math.min(...shortestExit) : null, positions,
    danglingEdges: edges.filter(e => !ids.has(e.source) || !ids.has(e.target)).length }
}
