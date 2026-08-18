import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import { buildLinearItems } from '@/features/designer/utils/conditionGraph'
import { toScopeTree, type ScopeNode } from '@/features/designer/utils/sequenceEdit'

export const CANVAS_NODE_WIDTH = 232
export const CANVAS_NODE_HEIGHT = 76
const V_GAP = 64
const H_GAP = 56
const BRANCH_MIN_W = 120
const LOOP_INDENT = 48
const ORIGIN_X = 48
const ORIGIN_Y = 40

export type CanvasPoint = { x: number; y: number }

type LayoutBox = {
  width: number
  height: number
  /** Positions relative to the box's top-left. */
  positions: Map<string, CanvasPoint>
}

function offsetPositions(positions: Map<string, CanvasPoint>, dx: number, dy: number) {
  const next = new Map<string, CanvasPoint>()
  for (const [id, p] of positions) {
    next.set(id, { x: p.x + dx, y: p.y + dy })
  }
  return next
}

function centerX(boxWidth: number, nodeWidth = CANVAS_NODE_WIDTH) {
  return Math.max(0, (boxWidth - nodeWidth) / 2)
}

function layoutSequence(seq: ScopeNode[]): LayoutBox {
  if (!seq.length) {
    return { width: BRANCH_MIN_W, height: 0, positions: new Map() }
  }

  const parts: LayoutBox[] = seq.map((node) => {
    if (node.kind === 'condition') return layoutCondition(node)
    if (node.kind === 'loop') return layoutLoop(node)
    return {
      width: CANVAS_NODE_WIDTH,
      height: CANVAS_NODE_HEIGHT,
      positions: new Map([[node.item.node.id, { x: 0, y: 0 }]]),
    }
  })

  const width = Math.max(CANVAS_NODE_WIDTH, ...parts.map((p) => p.width))
  const positions = new Map<string, CanvasPoint>()
  let y = 0

  for (const part of parts) {
    const dx = centerX(width, part.width)
    for (const [id, p] of part.positions) {
      positions.set(id, { x: p.x + dx, y: p.y + y })
    }
    y += part.height + V_GAP
  }

  return {
    width,
    height: Math.max(0, y - V_GAP),
    positions,
  }
}

function layoutCondition(node: Extract<ScopeNode, { kind: 'condition' }>): LayoutBox {
  const yes = layoutSequence(node.yes)
  const no = layoutSequence(node.no)
  const then = layoutSequence(node.then)

  const yesW = Math.max(BRANCH_MIN_W, yes.width)
  const noW = Math.max(BRANCH_MIN_W, no.width)
  const branchesW = yesW + H_GAP + noW
  const width = Math.max(CANVAS_NODE_WIDTH, branchesW, then.width)

  const positions = new Map<string, CanvasPoint>()
  const condX = centerX(width)
  positions.set(node.item.node.id, { x: condX, y: 0 })

  const branchTop = CANVAS_NODE_HEIGHT + V_GAP
  const branchesLeft = centerX(width, branchesW)

  const yesDx = branchesLeft + centerX(yesW, yes.width)
  const noDx = branchesLeft + yesW + H_GAP + centerX(noW, no.width)
  for (const [id, p] of yes.positions) {
    positions.set(id, { x: p.x + yesDx, y: p.y + branchTop })
  }
  for (const [id, p] of no.positions) {
    positions.set(id, { x: p.x + noDx, y: p.y + branchTop })
  }

  const branchBottom = branchTop + Math.max(yes.height, no.height, 24)
  const thenTop = branchBottom + V_GAP
  const thenDx = centerX(width, then.width)
  for (const [id, p] of then.positions) {
    positions.set(id, { x: p.x + thenDx, y: p.y + thenTop })
  }

  const height = then.positions.size ? thenTop + then.height : branchBottom

  return { width, height, positions }
}

function layoutLoop(node: Extract<ScopeNode, { kind: 'loop' }>): LayoutBox {
  const body = layoutSequence(node.body)
  const then = layoutSequence(node.then)

  const bodyW = Math.max(BRANCH_MIN_W, body.width)
  const contentW = Math.max(CANVAS_NODE_WIDTH, LOOP_INDENT + bodyW, then.width)
  const width = contentW

  const positions = new Map<string, CanvasPoint>()
  positions.set(node.item.node.id, { x: centerX(width), y: 0 })

  const bodyTop = CANVAS_NODE_HEIGHT + V_GAP
  const bodyDx = LOOP_INDENT + centerX(Math.max(CANVAS_NODE_WIDTH, width - LOOP_INDENT), body.width)
  for (const [id, p] of body.positions) {
    positions.set(id, { x: p.x + bodyDx, y: p.y + bodyTop })
  }

  const bodyBottom = bodyTop + Math.max(body.height, 24)
  const thenTop = bodyBottom + V_GAP
  const thenDx = centerX(width, then.width)
  for (const [id, p] of then.positions) {
    positions.set(id, { x: p.x + thenDx, y: p.y + thenTop })
  }

  const height = then.positions.size ? thenTop + then.height : bodyBottom

  return { width, height, positions }
}

/**
 * Top-down auto-layout from the same scope tree as Linear view.
 * Places Yes left / No right, loop body indented, Then below branches.
 */
export function computeCanvasLayout(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): Map<string, CanvasPoint> {
  const tree = toScopeTree(buildLinearItems(nodes, edges))
  const root = layoutSequence(tree)
  const positions = offsetPositions(root.positions, ORIGIN_X, ORIGIN_Y)

  // Orphans (disconnected / not yet in linear spine) — park to the right.
  let orphanY = ORIGIN_Y
  const placed = new Set(positions.keys())
  const orphanX = ORIGIN_X + root.width + H_GAP * 2
  for (const n of nodes) {
    if (placed.has(n.id)) continue
    positions.set(n.id, { x: orphanX, y: orphanY })
    orphanY += CANVAS_NODE_HEIGHT + V_GAP
  }

  return positions
}

/** True when many nodes share nearly the same spot (typical of naive insert stacking). */
export function canvasLooksCollapsed(nodes: DesignerNode[]): boolean {
  if (nodes.length < 2) return false
  const buckets = new Map<string, number>()
  for (const n of nodes) {
    const key = `${Math.round(n.position.x / 40)}:${Math.round(n.position.y / 40)}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.values()].some((c) => c >= Math.min(3, nodes.length))
}
