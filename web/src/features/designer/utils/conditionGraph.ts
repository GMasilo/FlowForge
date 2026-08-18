import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'

export function outgoingMap(edges: DesignerEdge[]) {
  const map = new Map<string, DesignerEdge[]>()
  for (const e of edges) {
    const list = map.get(e.source) ?? []
    list.push(e)
    map.set(e.source, list)
  }
  return map
}

/** Nodes reachable from start without going through `stopIds`. */
export function reachableIds(
  startId: string | null | undefined,
  outgoing: Map<string, DesignerEdge[]>,
  stopIds: Set<string> = new Set(),
): Set<string> {
  const out = new Set<string>()
  if (!startId) return out
  const q = [startId]
  while (q.length) {
    const id = q.shift()!
    if (out.has(id) || stopIds.has(id)) continue
    out.add(id)
    for (const e of outgoing.get(id) ?? []) {
      if (!out.has(e.target) && !stopIds.has(e.target)) q.push(e.target)
    }
  }
  return out
}

/** Leaf node ids in a branch (nodes with no outgoing edge inside the branch set). */
export function branchLeafIds(
  startId: string | null | undefined,
  outgoing: Map<string, DesignerEdge[]>,
  branchIds: Set<string>,
): string[] {
  if (!startId) return []
  const leaves: string[] = []
  for (const id of branchIds) {
    const outs = (outgoing.get(id) ?? []).filter((e) => branchIds.has(e.target))
    if (!outs.length) leaves.push(id)
  }
  if (!leaves.length && branchIds.has(startId)) leaves.push(startId)
  return leaves
}

/** Leaf nodes that should continue after the branch (End steps stop the conversation). */
export function branchContinueLeafIds(
  startId: string | null | undefined,
  outgoing: Map<string, DesignerEdge[]>,
  branchIds: Set<string>,
  nodesById: Map<string, DesignerNode>,
): string[] {
  return branchLeafIds(startId, outgoing, branchIds).filter((id) => nodesById.get(id)?.type !== 'end')
}

export function conditionBranchStarts(conditionId: string, edges: DesignerEdge[]) {
  return {
    trueStart: edges.find((e) => e.source === conditionId && e.sourceHandle === 'true')?.target ?? null,
    falseStart: edges.find((e) => e.source === conditionId && e.sourceHandle === 'false')?.target ?? null,
  }
}

export function loopBodyStart(loopId: string, edges: DesignerEdge[]) {
  return edges.find((e) => e.source === loopId && e.sourceHandle === 'body')?.target ?? null
}

/**
 * Wire a continue/Then node after Yes and No branches of a condition.
 *
 * - Empty branch → condition handle connects straight to the continue step
 * - Branch leaf that is End → no continue edge (conversation ends there)
 * - Other branch leaves → connect to the continue step
 */
export function edgesForConditionThen(args: {
  conditionId: string
  thenNodeId: string
  edges: DesignerEdge[]
  nodes: DesignerNode[]
  newId: () => string
}): DesignerEdge[] {
  const { conditionId, thenNodeId, edges, nodes, newId } = args
  const nodesById = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = outgoingMap(edges)
  const trueEdge = edges.find((e) => e.source === conditionId && e.sourceHandle === 'true')
  const falseEdge = edges.find((e) => e.source === conditionId && e.sourceHandle === 'false')

  const trueStart = trueEdge?.target ?? null
  const falseStart = falseEdge?.target ?? null
  const bodyStartEarly = loopBodyStart(conditionId, edges)
  const trueReach = reachableIds(trueStart, outgoing)
  const falseReach = reachableIds(falseStart, outgoing)
  const bodyReachEarly = reachableIds(bodyStartEarly, outgoing)

  trueReach.delete(thenNodeId)
  falseReach.delete(thenNodeId)
  bodyReachEarly.delete(thenNodeId)

  const next = edges.filter(
    (e) =>
      !(e.target === thenNodeId && e.source === conditionId) &&
      !(
        e.target === thenNodeId &&
        (trueReach.has(e.source) || falseReach.has(e.source) || bodyReachEarly.has(e.source))
      ),
  )

  const add: DesignerEdge[] = []

  function wireBranch(handle: 'true' | 'false' | 'body', start: string | null, reach: Set<string>) {
    if (!start || start === thenNodeId) {
      add.push({
        id: newId(),
        source: conditionId,
        target: thenNodeId,
        sourceHandle: handle,
        label: 'Then',
      })
      return
    }

    if (nodesById.get(start)?.type === 'end' && reach.size <= 1) {
      return
    }

    const leavesFromBranch = branchContinueLeafIds(start, outgoing, reach, nodesById)
    for (const leaf of leavesFromBranch) {
      if (nodesById.get(leaf)?.type === 'end') continue
      if (
        next.some((e) => e.source === leaf && e.target === thenNodeId) ||
        add.some((e) => e.source === leaf && e.target === thenNodeId)
      ) {
        continue
      }
      add.push({ id: newId(), source: leaf, target: thenNodeId, label: 'Then' })
    }
  }

  wireBranch('true', trueStart, trueReach)
  wireBranch('false', falseStart, falseReach)

  const bodyStart = bodyStartEarly
  if (bodyStart || nodesById.get(conditionId)?.type === 'loop') {
    wireBranch('body', bodyStart, bodyReachEarly)
  }

  return [...next, ...add]
}

/**
 * Insert first (or splice) step into a Yes/No/Body branch.
 * handle: 'true' | 'false' | 'body'
 */
export function edgesInsertBranchStep(args: {
  conditionId: string
  handle: 'true' | 'false' | 'body'
  newNodeId: string
  edges: DesignerEdge[]
  newId: () => string
}): DesignerEdge[] {
  const { conditionId, handle, newNodeId, edges, newId } = args
  const label = handle === 'true' ? 'Yes' : handle === 'false' ? 'No' : 'Each'
  const existing = edges.filter((e) => e.source === conditionId && e.sourceHandle === handle)
  const continueTargets = existing.map((e) => e.target)

  let next = edges.filter((e) => !(e.source === conditionId && e.sourceHandle === handle && e.target === newNodeId))
  next = next.filter((e) => !(e.source === conditionId && e.target === newNodeId && !e.sourceHandle))
  next = next.filter((e) => !(e.source === conditionId && e.sourceHandle === handle))

  next.push({
    id: newId(),
    source: conditionId,
    target: newNodeId,
    sourceHandle: handle,
    label,
  })

  for (const target of continueTargets) {
    if (target === newNodeId) continue
    if (!next.some((e) => e.source === newNodeId && e.target === target)) {
      next.push({ id: newId(), source: newNodeId, target, label: 'Then' })
    }
  }

  return next
}

/**
 * Nodes on this condition's Yes/No spines that can emit a Then edge for *this* IF.
 * Nested conditions are skipped; we resume after each nested IF's own After-IF roots.
 */
function collectBranchSpine(
  conditionId: string,
  edges: DesignerEdge[],
  nodesById: Map<string, DesignerNode>,
  continueRoots: Set<string>,
): Set<string> {
  const outgoing = outgoingMap(edges)
  const { trueStart, falseStart } = conditionBranchStarts(conditionId, edges)
  const spine = new Set<string>()

  function walk(start: string | null) {
    if (!start || continueRoots.has(start)) return
    const q = [start]
    const seen = new Set<string>()
    while (q.length) {
      const id = q.shift()!
      if (seen.has(id) || continueRoots.has(id)) continue
      seen.add(id)
      const node = nodesById.get(id)

      if (node?.type === 'condition' || node?.type === 'loop') {
        // Nested IF/loop stays on this branch; its After can Then into *this* container
        const nestedContinues = findContinueRootIds(id, edges, nodesById)
        for (const c of nestedContinues) {
          spine.add(c)
          for (const e of outgoing.get(c) ?? []) {
            if (e.label === 'Then') continue
            if (!continueRoots.has(e.target)) q.push(e.target)
          }
        }
        continue
      }

      spine.add(id)
      for (const e of outgoing.get(id) ?? []) {
        if (e.label === 'Then') continue
        if (!continueRoots.has(e.target)) q.push(e.target)
      }
    }
  }

  if (trueStart && !continueRoots.has(trueStart)) walk(trueStart)
  if (falseStart && !continueRoots.has(falseStart) && falseStart !== trueStart) walk(falseStart)
  const bodyStart = loopBodyStart(conditionId, edges)
  if (bodyStart && !continueRoots.has(bodyStart) && bodyStart !== trueStart && bodyStart !== falseStart) {
    walk(bodyStart)
  }

  return spine
}

/**
 * Roots of the "After IF" continue path for a specific condition — not Yes/No children.
 * Nested IFs keep their own After-IF roots; those are not stolen by the parent IF.
 */
export function findContinueRootIds(
  conditionId: string,
  edges: DesignerEdge[],
  nodesOrMap?: DesignerNode[] | Map<string, DesignerNode>,
): Set<string> {
  const nodesById =
    nodesOrMap instanceof Map ? nodesOrMap : new Map((nodesOrMap ?? []).map((n) => [n.id, n]))

  const roots = new Set<string>()
  const { trueStart, falseStart } = conditionBranchStarts(conditionId, edges)
  const trueEdge = edges.find((e) => e.source === conditionId && e.sourceHandle === 'true')
  const falseEdge = edges.find((e) => e.source === conditionId && e.sourceHandle === 'false')
  const bodyEdge = edges.find((e) => e.source === conditionId && e.sourceHandle === 'body')

  if (trueStart && falseStart && trueStart === falseStart) {
    roots.add(trueStart)
  }

  // Empty IF with only one handle left (often after a nested insert stole End into Yes):
  // treat that shared End/start as After, not as branch content.
  if (trueStart && !falseStart && !bodyEdge) {
    if (trueEdge?.label === 'Then' || nodesById.get(trueStart)?.type === 'end') {
      roots.add(trueStart)
    }
  }
  if (falseStart && !trueStart && !bodyEdge) {
    if (falseEdge?.label === 'Then' || nodesById.get(falseStart)?.type === 'end') {
      roots.add(falseStart)
    }
  }

  for (const e of edges) {
    if (e.source === conditionId && e.label === 'Then') {
      roots.add(e.target)
    }
  }

  if (!nodesById.size) return roots

  const spine = collectBranchSpine(conditionId, edges, nodesById, roots)
  for (const e of edges) {
    if (e.label !== 'Then') continue
    if (spine.has(e.source)) {
      roots.add(e.target)
    }
  }

  return roots
}

/**
 * Insert a new After-IF step immediately before an existing continue root (often End).
 * Retargets this condition's Then / empty-handle edges that currently enter the root.
 */
export function edgesInsertBeforeContinueRoot(args: {
  conditionId: string
  newNodeId: string
  continueRootId: string
  edges: DesignerEdge[]
  nodes: DesignerNode[]
  newId: () => string
}): DesignerEdge[] {
  const { conditionId, newNodeId, continueRootId, edges, nodes, newId } = args
  const nodesById = new Map(nodes.map((n) => [n.id, n]))
  const roots = findContinueRootIds(conditionId, edges, nodesById)
  if (!roots.has(continueRootId)) return edges

  const spine = collectBranchSpine(conditionId, edges, nodesById, roots)

  const next = edges.map((e) => {
    if (e.target !== continueRootId) return e
    if (e.source === conditionId && (e.sourceHandle === 'true' || e.sourceHandle === 'false' || e.sourceHandle === 'body')) {
      return { ...e, id: newId(), target: newNodeId, label: 'Then' }
    }
    if (e.label === 'Then' && (spine.has(e.source) || e.source === conditionId)) {
      return { ...e, id: newId(), target: newNodeId }
    }
    return e
  })

  if (!next.some((e) => e.source === newNodeId && e.target === continueRootId)) {
    next.push({ id: newId(), source: newNodeId, target: continueRootId })
  }

  return next.filter(
    (e) => !(e.source === conditionId && e.target === newNodeId && !e.sourceHandle),
  )
}

export function findJoinIds(
  conditionId: string,
  edges: DesignerEdge[],
  nodes?: DesignerNode[],
): Set<string> {
  return findContinueRootIds(conditionId, edges, nodes)
}

export type LinearBranch = 'true' | 'false' | 'then' | 'body' | 'default'

export type LinearItem = {
  node: DesignerNode
  depth: number
  branch?: LinearBranch
  /** First step of a Yes / No / Body / After section at this depth */
  branchStart?: boolean
}

export function buildLinearItems(nodes: DesignerNode[], edges: DesignerEdge[]): LinearItem[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = outgoingMap(edges)
  const incomingCount = new Map<string, number>()
  for (const n of nodes) incomingCount.set(n.id, 0)
  for (const e of edges) incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1)

  const flowRoots = nodes.filter((n) => (incomingCount.get(n.id) ?? 0) === 0)
  const start = flowRoots[0] ?? nodes[0]
  if (!start) return []

  const items: LinearItem[] = []
  const visited = new Set<string>()

  function push(nodeId: string, depth: number, branch?: LinearBranch) {
    if (visited.has(nodeId)) return
    const node = byId.get(nodeId)
    if (!node) return
    visited.add(nodeId)
    const prev = items[items.length - 1]
    const branchStart =
      !!branch && (branch === 'true' || branch === 'false' || branch === 'then' || branch === 'body')
        ? !prev || prev.branch !== branch || prev.depth !== depth
        : false
    items.push({ node, depth, branch, branchStart })
  }

  function walkSubtree(nodeId: string, depth: number, branch: LinearBranch | undefined, stop: Set<string>) {
    if (stop.has(nodeId) || visited.has(nodeId)) return
    const node = byId.get(nodeId)
    if (!node) return

    if (node.type === 'condition' || node.type === 'loop') {
      walkFrom(nodeId, depth, branch, stop)
      return
    }

    push(nodeId, depth, branch)
    for (const e of outgoing.get(nodeId) ?? []) {
      if (stop.has(e.target)) continue
      if (e.label === 'Then') continue
      walkSubtree(e.target, depth, branch, stop)
    }
  }

  function walkFrom(nodeId: string, depth: number, branch?: LinearBranch, stop: Set<string> = new Set()) {
    if (visited.has(nodeId) || stop.has(nodeId)) return
    const node = byId.get(nodeId)
    if (!node) return
    push(nodeId, depth, branch)

    if (node.type === 'condition') {
      const { trueStart, falseStart } = conditionBranchStarts(node.id, edges)
      const continueRoots = findContinueRootIds(node.id, edges, byId)

      if (trueStart && !continueRoots.has(trueStart)) {
        walkSubtree(trueStart, depth + 1, 'true', continueRoots)
      }
      if (falseStart && !continueRoots.has(falseStart)) {
        walkSubtree(falseStart, depth + 1, 'false', continueRoots)
      }

      const continueList = [...continueRoots].filter(
        (id) => !visited.has(id) && !stop.has(id) && byId.has(id),
      )
      continueList.sort((a, b) => {
        const ya = byId.get(a)?.position.y ?? 0
        const yb = byId.get(b)?.position.y ?? 0
        return ya - yb
      })
      for (const continueId of continueList) {
        walkFrom(continueId, depth, 'then', stop)
      }

      for (const e of outgoing.get(node.id) ?? []) {
        if (e.sourceHandle === 'true' || e.sourceHandle === 'false') continue
        if (!visited.has(e.target) && !continueRoots.has(e.target) && !stop.has(e.target)) {
          walkFrom(e.target, depth, 'default', stop)
        }
      }

      return
    }

    if (node.type === 'loop') {
      const bodyStart = loopBodyStart(node.id, edges)
      const continueRoots = findContinueRootIds(node.id, edges, byId)

      if (bodyStart && !continueRoots.has(bodyStart)) {
        walkSubtree(bodyStart, depth + 1, 'body', continueRoots)
      }

      const continueList = [...continueRoots].filter(
        (id) => !visited.has(id) && !stop.has(id) && byId.has(id),
      )
      continueList.sort((a, b) => {
        const ya = byId.get(a)?.position.y ?? 0
        const yb = byId.get(b)?.position.y ?? 0
        return ya - yb
      })
      for (const continueId of continueList) {
        walkFrom(continueId, depth, 'then', stop)
      }

      for (const e of outgoing.get(node.id) ?? []) {
        if (e.sourceHandle === 'body') continue
        if (!visited.has(e.target) && !continueRoots.has(e.target) && !stop.has(e.target)) {
          walkFrom(e.target, depth, 'default', stop)
        }
      }

      return
    }

    for (const e of outgoing.get(nodeId) ?? []) {
      if (e.label === 'Then') continue
      if (stop.has(e.target)) continue
      walkFrom(e.target, depth, branch, stop)
    }
  }

  walkFrom(start.id, 0)
  for (const n of nodes) {
    if (!visited.has(n.id)) walkFrom(n.id, 0)
  }
  return items
}
