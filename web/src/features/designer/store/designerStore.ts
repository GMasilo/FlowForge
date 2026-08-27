import { create } from 'zustand'
import type { FlowNodeType } from '@/shared/types/database'
import {
  defaultConfig,
  nodeTypeLabel,
  type DesignerEdge,
  type DesignerNode,
} from '@/features/designer/model/flowSchema'
import { buildQuestionAnswerTypePatch } from '@/features/designer/model/questionAnswerTypePatch'
import type { ConnectionValidationInfo } from '@/features/connections/connectionValidation'
import { validateFlow, type ValidationIssue } from '@/features/designer/validation/referenceValidator'
import {
  canDeleteNode as nodeIsDeletable,
  edgesMoveInSequence,
  edgesMoveToIndex,
  findSiblingContext,
  isReorderableNode,
  planNodeDeletion,
} from '@/features/designer/utils/sequenceEdit'
import type { PeerStepLock } from '@/features/designer/collab/stepLocks'

export type DesignerViewMode = 'linear' | 'canvas'

export type AddNodeSeed = {
  label?: string
  config?: Record<string, unknown>
}

export type StepClipboard = {
  type: FlowNodeType
  label: string
  config: Record<string, unknown>
}

interface DesignerState {
  flowId: string | null
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  selectedNodeId: string | null
  viewMode: DesignerViewMode
  globalVariables: string[]
  connectionsById: Record<string, ConnectionValidationInfo>
  dirty: boolean
  /** Node keys changed locally since last clean save (for merge-before-save). */
  dirtyNodeKeys: string[]
  /** Node keys removed locally since last clean save. */
  deletedNodeKeys: string[]
  /** Soft locks from peer presence: nodeKey → peer */
  peerLocks: Record<string, PeerStepLock>
  issues: ValidationIssue[]
  clipboard: StepClipboard | null
  /** null = library not loaded yet */
  mediaKeys: string[] | null
  /** null = library not loaded yet */
  templateKeys: string[] | null
  /** Template JSON by key. null = not loaded yet. */
  templateContents: Record<string, unknown> | null
  canUndo: boolean
  canRedo: boolean
  setFlow: (payload: {
    flowId: string
    nodes: DesignerNode[]
    edges: DesignerEdge[]
    globalVariables: string[]
  }) => void
  setConnections: (connectionsById: Record<string, ConnectionValidationInfo>) => void
  setMediaKeys: (keys: string[] | null) => void
  setTemplateKeys: (keys: string[] | null, contents?: Record<string, unknown> | null) => void
  setViewMode: (mode: DesignerViewMode) => void
  selectNode: (id: string | null) => void
  setPeerLocks: (locks: Record<string, PeerStepLock>) => void
  /** Patch nodes from server for keys that are not locally dirty. */
  mergeServerDraft: (nodes: DesignerNode[], edges: DesignerEdge[]) => void
  updateNode: (id: string, patch: Partial<Pick<DesignerNode, 'key' | 'label' | 'config' | 'position'>>) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  /** Batch-update positions (e.g. canvas Arrange). Marks dirty unless silent. */
  applyNodePositions: (
    positions: Map<string, { x: number; y: number }>,
    opts?: { silent?: boolean; recordHistory?: boolean },
  ) => void
  /** Returns the new node id. Optional seed pre-fills label/config (e.g. suggested steps). */
  addNode: (type: FlowNodeType, afterNodeId?: string | null, seed?: AddNodeSeed) => string
  removeNode: (id: string) => void
  canDeleteNode: (id: string) => boolean
  copyNode: (id: string) => boolean
  pasteAfter: (afterNodeId?: string | null) => string | null
  duplicateNode: (id: string) => string | null
  moveNode: (id: string, direction: 'up' | 'down') => boolean
  moveNodeToIndex: (id: string, toIndex: number) => boolean
  canMoveNode: (id: string) => { up: boolean; down: boolean }
  setEdges: (edges: DesignerEdge[]) => void
  connect: (edge: Omit<DesignerEdge, 'id'> & { id?: string }) => void
  markClean: () => void
  revalidate: () => void
  undo: () => boolean
  redo: () => boolean
  beginHistoryBatch: () => void
  endHistoryBatch: () => void
  runHistoryBatch: <T>(fn: () => T) => T
}

type HistorySnapshot = {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  selectedNodeId: string | null
}

const HISTORY_LIMIT = 80
const UPDATE_COALESCE_MS = 450

let past: HistorySnapshot[] = []
let future: HistorySnapshot[] = []
let batchDepth = 0
let batchCaptured = false
let coalesceKey: string | null = null
let coalesceAt = 0

function newId() {
  return crypto.randomUUID()
}

function uniqueKey(type: FlowNodeType, nodes: DesignerNode[]) {
  const base = type === 'set_variable' ? 'set_var' : type
  let i = 1
  const existing = new Set(nodes.map((n) => n.key))
  while (existing.has(`${base}_${i}`)) i += 1
  return `${base}_${i}`
}

function recompute(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  globalVariables: string[],
  connectionsById: Record<string, ConnectionValidationInfo>,
  mediaKeys: string[] | null = null,
  templateKeys: string[] | null = null,
  templateContents: Record<string, unknown> | null = null,
) {
  return validateFlow(nodes, edges, {
    globalVariables,
    connectionsById,
    mediaKeys,
    templateKeys,
    templateContents,
  })
}

function cloneSnapshot(nodes: DesignerNode[], edges: DesignerEdge[], selectedNodeId: string | null): HistorySnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
    selectedNodeId,
  }
}

function resetHistory() {
  past = []
  future = []
  batchDepth = 0
  batchCaptured = false
  coalesceKey = null
  coalesceAt = 0
}

function pushPast(nodes: DesignerNode[], edges: DesignerEdge[], selectedNodeId: string | null) {
  past.push(cloneSnapshot(nodes, edges, selectedNodeId))
  if (past.length > HISTORY_LIMIT) past.shift()
  future = []
}

function captureHistory(
  state: { nodes: DesignerNode[]; edges: DesignerEdge[]; selectedNodeId: string | null },
  opts?: { coalesceKey?: string; skip?: boolean },
): { canUndo: boolean; canRedo: boolean } | Record<string, never> {
  if (opts?.skip) return {}
  if (batchDepth > 0) {
    if (batchCaptured) return {}
    batchCaptured = true
    coalesceKey = null
    pushPast(state.nodes, state.edges, state.selectedNodeId)
    return { canUndo: true, canRedo: false }
  }
  const now = Date.now()
  if (opts?.coalesceKey && coalesceKey === opts.coalesceKey && now - coalesceAt < UPDATE_COALESCE_MS) {
    coalesceAt = now
    return {}
  }
  coalesceKey = opts?.coalesceKey ?? null
  coalesceAt = now
  pushPast(state.nodes, state.edges, state.selectedNodeId)
  return { canUndo: true, canRedo: false }
}

function beginHistoryBatch() {
  batchDepth += 1
}

function endHistoryBatch() {
  batchDepth = Math.max(0, batchDepth - 1)
  if (batchDepth === 0) batchCaptured = false
}

function addDirtyKeys(existing: string[], ...keys: string[]): string[] {
  const set = new Set(existing)
  for (const k of keys) {
    if (k) set.add(k)
  }
  return [...set]
}

function isPeerLocked(peerLocks: Record<string, PeerStepLock>, nodeKey: string | undefined): boolean {
  return !!nodeKey && !!peerLocks[nodeKey]
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  flowId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  viewMode: 'linear',
  globalVariables: [],
  connectionsById: {},
  dirty: false,
  dirtyNodeKeys: [],
  deletedNodeKeys: [],
  peerLocks: {},
  issues: [],
  clipboard: null,
  mediaKeys: null,
  templateKeys: null,
  templateContents: null,
  canUndo: false,
  canRedo: false,

  setFlow: ({ flowId, nodes, edges, globalVariables }) => {
    const { connectionsById, mediaKeys, templateKeys } = get()
    resetHistory()
    set({
      flowId,
      nodes,
      edges,
      globalVariables,
      dirty: false,
      dirtyNodeKeys: [],
      deletedNodeKeys: [],
      selectedNodeId: nodes[0]?.id ?? null,
      issues: recompute(nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      canUndo: false,
      canRedo: false,
    })
  },

  setConnections: (connectionsById) => {
    const { nodes, edges, globalVariables, mediaKeys, templateKeys } = get()
    set({
      connectionsById,
      issues: recompute(nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
    })
  },

  setMediaKeys: (mediaKeys) => {
    const { nodes, edges, globalVariables, connectionsById, templateKeys } = get()
    set({
      mediaKeys,
      issues: recompute(nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
    })
  },

  setTemplateKeys: (templateKeys, templateContents) => {
    const { nodes, edges, globalVariables, connectionsById, mediaKeys } = get()
    const contents = templateContents === undefined ? get().templateContents : templateContents
    set({
      templateKeys,
      templateContents: contents,
      issues: recompute(nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, contents),
    })
  },

  setViewMode: (viewMode) => set({ viewMode }),

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  setPeerLocks: (peerLocks) => set({ peerLocks }),

  mergeServerDraft: (serverNodes, serverEdges) => {
    const { nodes, edges, dirtyNodeKeys, deletedNodeKeys, peerLocks, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId } =
      get()
    const dirty = new Set(dirtyNodeKeys)
    const deleted = new Set(deletedNodeKeys)
    const localByKey = new Map(nodes.map((n) => [n.key, n]))
    const nextByKey = new Map<string, DesignerNode>()

    for (const sn of serverNodes) {
      if (deleted.has(sn.key)) continue
      if (dirty.has(sn.key)) {
        const local = localByKey.get(sn.key)
        nextByKey.set(sn.key, local ?? sn)
      } else {
        nextByKey.set(sn.key, sn)
      }
    }
    for (const local of nodes) {
      if (dirty.has(local.key) && !nextByKey.has(local.key) && !peerLocks[local.key]) {
        nextByKey.set(local.key, local)
      }
    }

    const nextNodes = [...nextByKey.values()]
    // Prefer server edges for clean keys; keep local edges touching dirty keys
    const idByKey = new Map(nextNodes.map((n) => [n.key, n.id]))
    const oldLocalById = new Map(nodes.map((n) => [n.id, n]))
    const oldServerById = new Map(serverNodes.map((n) => [n.id, n]))

    const nextEdges: DesignerEdge[] = []
    const seen = new Set<string>()

    function pushEdge(sourceKey: string, targetKey: string, sourceHandle?: string | null, label?: string | null) {
      const source = idByKey.get(sourceKey)
      const target = idByKey.get(targetKey)
      if (!source || !target) return
      const sig = `${sourceKey}|${targetKey}|${sourceHandle ?? ''}|${label ?? ''}`
      if (seen.has(sig)) return
      seen.add(sig)
      nextEdges.push({
        id: crypto.randomUUID(),
        source,
        target,
        sourceHandle: sourceHandle ?? undefined,
        label: label ?? undefined,
      })
    }

    for (const e of serverEdges) {
      const sk = oldServerById.get(e.source)?.key
      const tk = oldServerById.get(e.target)?.key
      if (!sk || !tk) continue
      if (dirty.has(sk) || dirty.has(tk)) continue
      pushEdge(sk, tk, e.sourceHandle, e.label)
    }
    for (const e of edges) {
      const sk = oldLocalById.get(e.source)?.key
      const tk = oldLocalById.get(e.target)?.key
      if (!sk || !tk) continue
      if (!(dirty.has(sk) || dirty.has(tk))) continue
      pushEdge(sk, tk, e.sourceHandle, e.label)
    }

    const nextSelected =
      selectedNodeId && nextNodes.some((n) => n.id === selectedNodeId)
        ? selectedNodeId
        : nextNodes.find((n) => n.key === oldLocalById.get(selectedNodeId ?? '')?.key)?.id ??
          nextNodes[0]?.id ??
          null

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: nextSelected,
      issues: recompute(nextNodes, nextEdges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
    })
  },

  updateNode: (id, patch) => {
    const state = get()
    const current = state.nodes.find((n) => n.id === id)
    if (!current) return
    if (isPeerLocked(state.peerLocks, current.key)) return
    if (patch.key && patch.key !== current.key && isPeerLocked(state.peerLocks, patch.key)) return
    const next = state.nodes.map((n) => (n.id === id ? { ...n, ...patch, config: patch.config ?? n.config } : n))
    const { nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId, dirtyNodeKeys } = state
    const keys = addDirtyKeys(dirtyNodeKeys, current.key, patch.key ?? current.key)
    set({
      nodes: next,
      dirty: true,
      dirtyNodeKeys: keys,
      issues: recompute(next, edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges, selectedNodeId }, { coalesceKey: `updateNode:${id}` }),
    })
  },

  updateNodePosition: (id, position) => {
    const { nodes, edges, selectedNodeId, peerLocks, dirtyNodeKeys } = get()
    const current = nodes.find((n) => n.id === id)
    if (!current) return
    if (isPeerLocked(peerLocks, current.key)) return
    if (Math.abs(current.position.x - position.x) < 0.5 && Math.abs(current.position.y - position.y) < 0.5) return
    set({
      nodes: nodes.map((n) => (n.id === id ? { ...n, position } : n)),
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, current.key),
      ...captureHistory({ nodes, edges, selectedNodeId }, { coalesceKey: `position:${id}` }),
    })
  },

  applyNodePositions: (positions, opts) => {
    const { nodes, edges, selectedNodeId, dirty, peerLocks, dirtyNodeKeys } = get()
    let changed = false
    const touched: string[] = []
    const next = nodes.map((n) => {
      const pos = positions.get(n.id)
      if (!pos) return n
      if (isPeerLocked(peerLocks, n.key)) return n
      if (Math.abs(n.position.x - pos.x) < 0.5 && Math.abs(n.position.y - pos.y) < 0.5) return n
      changed = true
      touched.push(n.key)
      return { ...n, position: pos }
    })
    if (!changed) return
    const skipHistory = opts?.silent || opts?.recordHistory === false
    set({
      nodes: next,
      dirty: opts?.silent ? dirty : true,
      dirtyNodeKeys: opts?.silent ? dirtyNodeKeys : addDirtyKeys(dirtyNodeKeys, ...touched),
      ...captureHistory({ nodes, edges, selectedNodeId }, { skip: skipHistory }),
    })
  },

  addNode: (type, afterNodeId, seed) => {
    const { nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId, dirtyNodeKeys, peerLocks } =
      get()
    if (afterNodeId) {
      const after = nodes.find((n) => n.id === afterNodeId)
      if (after && isPeerLocked(peerLocks, after.key)) {
        // Still allow insert after a locked step for flow growth; mark after as dirty for edge merge
      }
    }
    const id = newId()
    const key = uniqueKey(type, nodes)
    const yBase =
      afterNodeId != null
        ? (nodes.find((n) => n.id === afterNodeId)?.position.y ?? 0) + 120
        : nodes.reduce((max, n) => Math.max(max, n.position.y), 0) + 120

    let config = defaultConfig(type)
    if (seed?.config) {
      if (type === 'question' && seed.config.answerType) {
        config = {
          ...config,
          ...buildQuestionAnswerTypePatch(config, String(seed.config.answerType)),
          ...seed.config,
        }
      } else {
        config = { ...config, ...seed.config }
      }
    }

    const node: DesignerNode = {
      id,
      key,
      type,
      label: seed?.label?.trim() || nodeTypeLabel(type),
      config,
      position: { x: 80, y: yBase },
    }

    let nextEdges = [...edges]
    const nextNodes = [...nodes, node]
    const touchKeys = [key]
    if (afterNodeId) {
      const after = nodes.find((n) => n.id === afterNodeId)
      if (after) touchKeys.push(after.key)
      const outgoing = edges.filter((e) => e.source === afterNodeId && !e.sourceHandle)
      const formerTargets = [...new Set(outgoing.map((e) => e.target))]

      if (type === 'condition') {
        nextEdges = edges
          .filter((e) => !(e.source === afterNodeId && !e.sourceHandle))
          .concat(
            { id: newId(), source: afterNodeId, target: id },
            ...formerTargets.flatMap((target) => [
              {
                id: newId(),
                source: id,
                target,
                sourceHandle: 'true' as const,
                label: 'Then',
              },
              {
                id: newId(),
                source: id,
                target,
                sourceHandle: 'false' as const,
                label: 'Then',
              },
            ]),
          )
      } else if (type === 'loop') {
        nextEdges = edges
          .filter((e) => !(e.source === afterNodeId && !e.sourceHandle))
          .concat(
            { id: newId(), source: afterNodeId, target: id },
            ...formerTargets.map((target) => ({
              id: newId(),
              source: id,
              target,
              sourceHandle: 'body' as const,
              label: 'Then',
            })),
          )
      } else if (outgoing.length) {
        nextEdges = edges
          .filter((e) => !(e.source === afterNodeId && !e.sourceHandle))
          .concat(
            { id: newId(), source: afterNodeId, target: id },
            ...outgoing.map((e) => ({ ...e, id: newId(), source: id })),
          )
      } else {
        nextEdges = [...edges, { id: newId(), source: afterNodeId, target: id }]
      }
    }

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: id,
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, ...touchKeys),
      issues: recompute(nextNodes, nextEdges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges, selectedNodeId }),
    })
    return id
  },

  canDeleteNode: (id) => {
    const { nodes, edges, peerLocks } = get()
    const node = nodes.find((n) => n.id === id)
    if (node && isPeerLocked(peerLocks, node.key)) return false
    return nodeIsDeletable(id, nodes, edges)
  },

  removeNode: (id) => {
    const { nodes, edges, globalVariables, connectionsById, selectedNodeId, mediaKeys, templateKeys, peerLocks, dirtyNodeKeys, deletedNodeKeys } =
      get()
    const target = nodes.find((n) => n.id === id)
    if (target && isPeerLocked(peerLocks, target.key)) return
    const plan = planNodeDeletion(id, nodes, edges)
    if (!plan) return

    const deleteSet = new Set(plan.deleteIds)
    for (const delId of deleteSet) {
      const n = nodes.find((x) => x.id === delId)
      if (n && isPeerLocked(peerLocks, n.key)) return
    }
    const nextNodes = nodes.filter((n) => !deleteSet.has(n.id))
    let nextEdges = edges.filter((e) => !deleteSet.has(e.source) && !deleteSet.has(e.target))

    if (plan.kind === 'container') {
      const incoming = edges.filter((e) => e.target === id && !deleteSet.has(e.source))
      for (const inn of incoming) {
        for (const cont of plan.continueIds) {
          if (deleteSet.has(cont)) continue
          nextEdges.push({
            id: newId(),
            source: inn.source,
            target: cont,
            sourceHandle: inn.sourceHandle,
            label: inn.label,
          })
        }
      }
    } else {
      const incoming = edges.filter((e) => e.target === id)
      const outgoing = edges.filter((e) => e.source === id)
      for (const inn of incoming) {
        for (const out of outgoing) {
          nextEdges.push({
            id: newId(),
            source: inn.source,
            target: out.target,
            sourceHandle: inn.sourceHandle,
            label: inn.label ?? out.label,
          })
        }
      }
    }

    // Dedupe identical source→target→handle edges
    const seen = new Set<string>()
    nextEdges = nextEdges.filter((e) => {
      const key = `${e.source}|${e.target}|${e.sourceHandle ?? ''}|${e.label ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const nextSelected = deleteSet.has(selectedNodeId ?? '')
      ? plan.continueIds.find((cid) => !deleteSet.has(cid) && nextNodes.some((n) => n.id === cid)) ??
        nextNodes[0]?.id ??
        null
      : selectedNodeId

    const removedKeys = nodes.filter((n) => deleteSet.has(n.id)).map((n) => n.key)
    const neighborKeys = [
      ...edges.filter((e) => deleteSet.has(e.source) || deleteSet.has(e.target)).flatMap((e) => {
        const s = nodes.find((n) => n.id === e.source)
        const t = nodes.find((n) => n.id === e.target)
        return [s?.key, t?.key].filter(Boolean) as string[]
      }),
    ]

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: nextSelected,
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, ...neighborKeys),
      deletedNodeKeys: addDirtyKeys(deletedNodeKeys, ...removedKeys),
      issues: recompute(nextNodes, nextEdges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges, selectedNodeId }),
    })
  },

  copyNode: (id) => {
    const node = get().nodes.find((n) => n.id === id)
    if (!node || node.type === 'end') return false
    set({
      clipboard: {
        type: node.type,
        label: node.label,
        config: structuredClone(node.config),
      },
    })
    return true
  },

  pasteAfter: (afterNodeId) => {
    const { clipboard } = get()
    if (!clipboard || clipboard.type === 'end') return null
    return get().runHistoryBatch(() => {
      const id = get().addNode(clipboard.type, afterNodeId ?? null)
      get().updateNode(id, {
        label: clipboard.label,
        config: structuredClone(clipboard.config),
      })
      return id
    })
  },

  duplicateNode: (id) => {
    const ok = get().copyNode(id)
    if (!ok) return null
    return get().pasteAfter(id)
  },

  moveNode: (id, direction) => {
    const { nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId, peerLocks, dirtyNodeKeys } =
      get()
    const node = nodes.find((n) => n.id === id)
    if (node && isPeerLocked(peerLocks, node.key)) return false
    const next = edgesMoveInSequence(id, direction, nodes, edges, newId)
    if (!next) return false
    set({
      edges: next,
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, ...(node ? [node.key] : []), ...nodes.map((n) => n.key)),
      issues: recompute(nodes, next, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges, selectedNodeId }),
    })
    return true
  },

  moveNodeToIndex: (id, toIndex) => {
    const { nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId, peerLocks, dirtyNodeKeys } =
      get()
    const node = nodes.find((n) => n.id === id)
    if (node && isPeerLocked(peerLocks, node.key)) return false
    const next = edgesMoveToIndex(id, toIndex, nodes, edges, newId)
    if (!next) return false
    set({
      edges: next,
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, ...nodes.map((n) => n.key)),
      issues: recompute(nodes, next, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges, selectedNodeId }),
    })
    return true
  },

  canMoveNode: (id) => {
    const { nodes, edges, peerLocks } = get()
    const node = nodes.find((n) => n.id === id)
    if (!node || !isReorderableNode(node) || isPeerLocked(peerLocks, node.key)) return { up: false, down: false }
    const ctx = findSiblingContext(nodes, edges, id)
    if (!ctx) return { up: false, down: false }
    const prev = ctx.index > 0 ? nodes.find((n) => n.id === ctx.sequenceIds[ctx.index - 1]) : null
    const next = ctx.index < ctx.sequenceIds.length - 1 ? nodes.find((n) => n.id === ctx.sequenceIds[ctx.index + 1]) : null
    return {
      up: !!prev && isReorderableNode(prev),
      down: !!next && isReorderableNode(next),
    }
  },

  setEdges: (edges) => {
    const { nodes, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId, dirtyNodeKeys } = get()
    const prevEdges = get().edges
    set({
      edges,
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, ...nodes.map((n) => n.key)),
      issues: recompute(nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges: prevEdges, selectedNodeId }),
    })
  },

  connect: (edge) => {
    const { edges, nodes, globalVariables, connectionsById, mediaKeys, templateKeys, selectedNodeId, peerLocks, dirtyNodeKeys } =
      get()
    const source = nodes.find((n) => n.id === edge.source)
    const target = nodes.find((n) => n.id === edge.target)
    if (isPeerLocked(peerLocks, source?.key) || isPeerLocked(peerLocks, target?.key)) return
    const next = [
      ...edges,
      {
        id: edge.id ?? newId(),
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        label: edge.label ?? null,
      },
    ]
    set({
      edges: next,
      dirty: true,
      dirtyNodeKeys: addDirtyKeys(dirtyNodeKeys, source?.key ?? '', target?.key ?? ''),
      issues: recompute(nodes, next, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      ...captureHistory({ nodes, edges, selectedNodeId }),
    })
  },

  markClean: () => set({ dirty: false, dirtyNodeKeys: [], deletedNodeKeys: [] }),

  revalidate: () => {
    const { nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys } = get()
    set({ issues: recompute(nodes, edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents) })
  },

  undo: () => {
    if (!past.length) return false
    const { nodes, edges, selectedNodeId, globalVariables, connectionsById, mediaKeys, templateKeys } = get()
    const prev = past.pop()!
    future.push(cloneSnapshot(nodes, edges, selectedNodeId))
    coalesceKey = null
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      selectedNodeId: prev.selectedNodeId,
      dirty: true,
      dirtyNodeKeys: prev.nodes.map((n) => n.key),
      issues: recompute(prev.nodes, prev.edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      canUndo: past.length > 0,
      canRedo: true,
    })
    return true
  },

  redo: () => {
    if (!future.length) return false
    const { nodes, edges, selectedNodeId, globalVariables, connectionsById, mediaKeys, templateKeys } = get()
    const next = future.pop()!
    past.push(cloneSnapshot(nodes, edges, selectedNodeId))
    coalesceKey = null
    set({
      nodes: next.nodes,
      edges: next.edges,
      selectedNodeId: next.selectedNodeId,
      dirty: true,
      dirtyNodeKeys: next.nodes.map((n) => n.key),
      issues: recompute(next.nodes, next.edges, globalVariables, connectionsById, mediaKeys, templateKeys, get().templateContents),
      canUndo: true,
      canRedo: future.length > 0,
    })
    return true
  },

  beginHistoryBatch,
  endHistoryBatch,
  runHistoryBatch: (fn) => {
    beginHistoryBatch()
    try {
      return fn()
    } finally {
      endHistoryBatch()
    }
  },
}))
