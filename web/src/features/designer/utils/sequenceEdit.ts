import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import {
  buildLinearItems,
  conditionBranchStarts,
  findContinueRootIds,
  loopBodyStart,
  outgoingMap,
  reachableIds,
  type LinearItem,
} from '@/features/designer/utils/conditionGraph'

export type ScopeNode =
  | { kind: 'step'; item: LinearItem }
  | {
      kind: 'condition'
      item: LinearItem
      yes: ScopeNode[]
      no: ScopeNode[]
      then: ScopeNode[]
    }
  | {
      kind: 'loop'
      item: LinearItem
      body: ScopeNode[]
      then: ScopeNode[]
    }

/** Build a nested scope tree from flat linear items. */
export function toScopeTree(items: LinearItem[]): ScopeNode[] {
  let i = 0

  function parseCondition(item: LinearItem): ScopeNode {
    const condDepth = item.depth
    const yes: ScopeNode[] = []
    const no: ScopeNode[] = []
    const then: ScopeNode[] = []

    while (i < items.length) {
      const next = items[i]!
      if (next.branch === 'true' && next.depth === condDepth + 1) {
        yes.push(...parseSequence('true', condDepth + 1))
        continue
      }
      if (next.branch === 'false' && next.depth === condDepth + 1) {
        no.push(...parseSequence('false', condDepth + 1))
        continue
      }
      if (next.branch === 'then' && next.depth === condDepth) {
        then.push(...parseSequence('then', condDepth))
        continue
      }
      break
    }

    return { kind: 'condition', item, yes, no, then }
  }

  function parseLoop(item: LinearItem): ScopeNode {
    const loopDepth = item.depth
    const body: ScopeNode[] = []
    const then: ScopeNode[] = []

    while (i < items.length) {
      const next = items[i]!
      if (next.branch === 'body' && next.depth === loopDepth + 1) {
        body.push(...parseSequence('body', loopDepth + 1))
        continue
      }
      if (next.branch === 'then' && next.depth === loopDepth) {
        then.push(...parseSequence('then', loopDepth))
        continue
      }
      break
    }

    return { kind: 'loop', item, body, then }
  }

  function parseContainer(item: LinearItem): ScopeNode {
    if (item.node.type === 'loop') return parseLoop(item)
    return parseCondition(item)
  }

  function parseSequence(branch: LinearItem['branch'], depth: number): ScopeNode[] {
    const out: ScopeNode[] = []
    while (i < items.length) {
      const item = items[i]!
      if (item.branch !== branch || item.depth !== depth) break
      i += 1
      if (item.node.type === 'condition' || item.node.type === 'loop') {
        out.push(parseContainer(item))
      } else {
        out.push({ kind: 'step', item })
      }
    }
    return out
  }

  function parseRoot(): ScopeNode[] {
    const out: ScopeNode[] = []
    while (i < items.length) {
      const item = items[i]!
      if (
        (item.node.type === 'condition' || item.node.type === 'loop') &&
        (item.branch == null || item.branch === 'default' || item.branch === 'then')
      ) {
        i += 1
        out.push(parseContainer(item))
        continue
      }
      if (item.branch === 'true' || item.branch === 'false' || item.branch === 'body') break
      i += 1
      if (item.node.type === 'condition' || item.node.type === 'loop') {
        out.push(parseContainer(item))
      } else {
        out.push({ kind: 'step', item })
      }
    }
    return out
  }

  return parseRoot()
}

export function isReorderableNode(node: DesignerNode) {
  return node.type !== 'end' && node.type !== 'condition' && node.type !== 'loop'
}

/**
 * End steps are deletable unless they are the chatbot’s final main-spine End
 * (last depth-0 Linear step with nothing after it). Ends on Yes / No / Body
 * branches and other mid-flow Ends can be removed.
 */
export function canDeleteNode(
  id: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): boolean {
  const node = nodes.find((n) => n.id === id)
  if (!node) return false
  if (node.type !== 'end') return true

  // Has a successor wired after this End — treat as mid-flow.
  if (edges.some((e) => e.source === id)) return true

  const spine = buildLinearItems(nodes, edges).filter((item) => item.depth === 0)
  if (!spine.length) return true
  const last = spine[spine.length - 1]!
  return last.node.id !== id
}

export type NodeDeletePlan = {
  deleteIds: string[]
  /** After / Then roots kept and rewired to predecessors. */
  continueIds: string[]
  label: string
  kind: 'simple' | 'container'
}

/** Plan which nodes are removed when deleting `id` (containers also remove branch interiors). */
export function planNodeDeletion(
  id: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): NodeDeletePlan | null {
  const node = nodes.find((n) => n.id === id)
  if (!node || !canDeleteNode(id, nodes, edges)) return null

  const label = node.label || node.key

  if (node.type === 'condition' || node.type === 'loop') {
    const continueRoots = findContinueRootIds(id, edges, nodes)
    const outgoing = outgoingMap(edges)
    const { trueStart, falseStart } = conditionBranchStarts(id, edges)
    const bodyStart = loopBodyStart(id, edges)
    const deleteIds = new Set<string>([id])

    for (const start of [trueStart, falseStart, bodyStart]) {
      if (!start || continueRoots.has(start)) continue
      for (const rid of reachableIds(start, outgoing, continueRoots)) {
        deleteIds.add(rid)
      }
    }

    return {
      deleteIds: [...deleteIds],
      continueIds: [...continueRoots],
      label,
      kind: 'container',
    }
  }

  return { deleteIds: [id], continueIds: [], label, kind: 'simple' }
}

export function confirmNodeDeletionMessage(plan: NodeDeletePlan): string {
  if (plan.kind === 'container') {
    const nested = Math.max(0, plan.deleteIds.length - 1)
    const nestedBit =
      nested === 0
        ? 'This removes the container (no nested steps).'
        : `This also deletes ${nested} nested step${nested === 1 ? '' : 's'} inside it.`
    return `Delete “${plan.label}”?\n\n${nestedBit}\nSteps after it (After) will be kept.`
  }
  return `Delete step “${plan.label}”?`
}

export function findSiblingContext(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  nodeId: string,
): { sequenceIds: string[]; index: number } | null {
  const tree = toScopeTree(buildLinearItems(nodes, edges))

  function walk(seq: ScopeNode[]): { sequenceIds: string[]; index: number } | null {
    const ids = seq.map((n) => n.item.node.id)
    const index = ids.indexOf(nodeId)
    if (index >= 0) return { sequenceIds: ids, index }

    for (const n of seq) {
      if (n.kind === 'condition') {
        const hit = walk(n.yes) ?? walk(n.no) ?? walk(n.then)
        if (hit) return hit
      } else if (n.kind === 'loop') {
        const hit = walk(n.body) ?? walk(n.then)
        if (hit) return hit
      }
    }
    return null
  }

  return walk(tree)
}

/**
 * Swap two adjacent sequence neighbors earlier → later along an existing edge.
 * Preserves branch handles on both nodes.
 */
export function edgesSwapAdjacent(
  earlierId: string,
  laterId: string,
  edges: DesignerEdge[],
  newId: () => string,
): DesignerEdge[] | null {
  const links = edges.filter((e) => e.source === earlierId && e.target === laterId)
  if (!links.length) return null

  let next = edges.filter((e) => !(e.source === earlierId && e.target === laterId))

  next = next.map((e) => {
    if (e.target === earlierId) return { ...e, id: newId(), target: laterId }
    return e
  })

  next = next.map((e) => {
    if (e.source === laterId && !e.sourceHandle && e.target !== earlierId) {
      return { ...e, id: newId(), source: earlierId }
    }
    return e
  })

  for (const link of links) {
    next.push({
      id: newId(),
      source: laterId,
      target: earlierId,
      sourceHandle: null,
      label: link.label === 'Yes' || link.label === 'No' || link.label === 'Each' ? 'Then' : link.label,
    })
  }

  return next
}

export function edgesMoveInSequence(
  nodeId: string,
  direction: 'up' | 'down',
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  newId: () => string,
): DesignerEdge[] | null {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node || !isReorderableNode(node)) return null

  const ctx = findSiblingContext(nodes, edges, nodeId)
  if (!ctx) return null

  const neighborIndex = direction === 'up' ? ctx.index - 1 : ctx.index + 1
  if (neighborIndex < 0 || neighborIndex >= ctx.sequenceIds.length) return null

  const neighborId = ctx.sequenceIds[neighborIndex]!
  const neighbor = nodes.find((n) => n.id === neighborId)
  if (!neighbor || !isReorderableNode(neighbor)) return null

  const earlierId = direction === 'up' ? neighborId : nodeId
  const laterId = direction === 'up' ? nodeId : neighborId
  return edgesSwapAdjacent(earlierId, laterId, edges, newId)
}

export function edgesMoveToIndex(
  nodeId: string,
  toIndex: number,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  newId: () => string,
): DesignerEdge[] | null {
  const ctx = findSiblingContext(nodes, edges, nodeId)
  if (!ctx) return null
  if (toIndex < 0 || toIndex >= ctx.sequenceIds.length || toIndex === ctx.index) return null

  let working = edges
  let index = ctx.index
  if (toIndex < index) {
    while (index > toIndex) {
      const next = edgesMoveInSequence(nodeId, 'up', nodes, working, newId)
      if (!next) return null
      working = next
      index -= 1
    }
  } else {
    while (index < toIndex) {
      const next = edgesMoveInSequence(nodeId, 'down', nodes, working, newId)
      if (!next) return null
      working = next
      index += 1
    }
  }
  return working
}
