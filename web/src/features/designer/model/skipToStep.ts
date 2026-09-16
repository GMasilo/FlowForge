import {
  collectConfigStrings,
  extractTemplateRefs,
  getStepOutputVariables,
  type DesignerEdge,
  type DesignerNode,
} from '@/features/designer/model/flowSchema'

/** Skip-to step: jump to another step by key (same target model as Button → Skip to step). */

export type SkipVariableDefault = {
  variableKey: string
  value: string
}

export type SkipMissingVariable = {
  variableKey: string
  fromStepKey: string
  fromStepLabel: string
  /** True when the target (or a step reachable from it) references {{vars.key}}. */
  referenced: boolean
}

export function readSkipToTargetKey(config: Record<string, unknown> | undefined | null): string {
  return String(config?.targetNodeKey ?? '').trim()
}

export function readSkipVariableDefaults(
  config: Record<string, unknown> | undefined | null,
): SkipVariableDefault[] {
  const raw = config?.variableDefaults
  if (!Array.isArray(raw)) return []
  const out: SkipVariableDefault[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const variableKey = String(row.variableKey ?? '').trim()
    if (!variableKey || seen.has(variableKey)) continue
    seen.add(variableKey)
    out.push({
      variableKey,
      value: typeof row.value === 'string' ? row.value : String(row.value ?? ''),
    })
  }
  return out
}

/** Step keys this node may jump to (dedicated skip, run-after skip, button listeners). */
export function collectSkipTargetKeys(node: DesignerNode): string[] {
  const keys = new Set<string>()
  if (node.type === 'skip_to') {
    const target = readSkipToTargetKey(node.config)
    if (target) keys.add(target)
  }
  const runAfterSkip = String(node.config.runAfterSkipTo ?? '').trim()
  if (runAfterSkip) keys.add(runAfterSkip)

  if (node.type === 'button' && Array.isArray(node.config.buttons)) {
    for (const raw of node.config.buttons) {
      if (!raw || typeof raw !== 'object') continue
      const listeners = Array.isArray((raw as { listeners?: unknown }).listeners)
        ? ((raw as { listeners: unknown[] }).listeners)
        : []
      for (const lst of listeners) {
        if (!lst || typeof lst !== 'object') continue
        const row = lst as Record<string, unknown>
        if (String(row.action ?? '') !== 'skip_to') continue
        const target = String(row.skipToNodeKey ?? '').trim()
        if (target) keys.add(target)
      }
    }
  }
  return [...keys]
}

/**
 * Nodes that lie on at least one edge-path from `fromId` to `targetId` (exclusive).
 * Used when teleporting via skip so we can mark bypassed step outputs as unset.
 */
export function nodesBypassedBySkipJump(
  fromId: string,
  targetId: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): DesignerNode[] {
  if (!fromId || !targetId || fromId === targetId) return []

  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  for (const n of nodes) {
    outgoing.set(n.id, [])
    incoming.set(n.id, [])
  }
  for (const e of edges) {
    outgoing.get(e.source)?.push(e.target)
    incoming.get(e.target)?.push(e.source)
  }

  const reachableFromFrom = new Set<string>()
  {
    const q = [fromId]
    const seen = new Set<string>()
    while (q.length) {
      const cur = q.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      reachableFromFrom.add(cur)
      for (const next of outgoing.get(cur) ?? []) q.push(next)
    }
  }

  const canReachTarget = new Set<string>()
  {
    const q = [targetId]
    const seen = new Set<string>()
    while (q.length) {
      const cur = q.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      canReachTarget.add(cur)
      for (const prev of incoming.get(cur) ?? []) q.push(prev)
    }
  }

  if (!reachableFromFrom.has(targetId)) return []

  return nodes.filter(
    (n) =>
      n.id !== fromId &&
      n.id !== targetId &&
      reachableFromFrom.has(n.id) &&
      canReachTarget.has(n.id),
  )
}

function varNameFromTemplateRef(rawRef: string): string | null {
  const t = String(rawRef ?? '').trim()
  if (!t) return null
  if (/^vars\./i.test(t)) {
    const name = t.slice(5).split(/[.(/\[]/)[0]?.trim() ?? ''
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null
  }
  // Bare {{name}} is treated as vars.name elsewhere in the product.
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return t
  return null
}

function varsReferencedByNode(node: DesignerNode): Set<string> {
  const out = new Set<string>()
  for (const text of collectConfigStrings(node.config)) {
    for (const raw of extractTemplateRefs(text)) {
      const name = varNameFromTemplateRef(raw)
      if (name) out.add(name)
    }
  }
  return out
}

/** Variable names referenced by `startId` and every step reachable from it. */
export function varsReferencedFromSubtree(
  startId: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): Set<string> {
  const outgoing = new Map<string, string[]>()
  for (const n of nodes) outgoing.set(n.id, [])
  for (const e of edges) outgoing.get(e.source)?.push(e.target)

  const reachable = new Set<string>()
  const q = [startId]
  while (q.length) {
    const cur = q.shift()!
    if (reachable.has(cur)) continue
    reachable.add(cur)
    for (const next of outgoing.get(cur) ?? []) q.push(next)
  }

  const refs = new Set<string>()
  for (const node of nodes) {
    if (!reachable.has(node.id)) continue
    for (const name of varsReferencedByNode(node)) refs.add(name)
  }
  return refs
}

/**
 * Variables written by steps that this skip jumps over.
 * `referenced` is true when the jump target (or later) uses {{vars.key}}.
 */
export function listSkipMissingVariables(
  fromId: string,
  targetId: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): SkipMissingVariable[] {
  const bypassed = nodesBypassedBySkipJump(fromId, targetId, nodes, edges)
  if (!bypassed.length) return []
  const referenced = varsReferencedFromSubtree(targetId, nodes, edges)
  const byKey = new Map<string, SkipMissingVariable>()
  for (const step of bypassed) {
    for (const variableKey of getStepOutputVariables(step)) {
      const existing = byKey.get(variableKey)
      if (existing) {
        if (referenced.has(variableKey)) existing.referenced = true
        continue
      }
      byKey.set(variableKey, {
        variableKey,
        fromStepKey: step.key,
        fromStepLabel: (step.label || step.key).trim() || step.key,
        referenced: referenced.has(variableKey),
      })
    }
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.referenced !== b.referenced) return a.referenced ? -1 : 1
    return a.variableKey.localeCompare(b.variableKey)
  })
}

/** Merge a single default into the stored list (keeps unrelated keys). */
export function upsertSkipVariableDefault(
  config: Record<string, unknown>,
  variableKey: string,
  value: string,
): SkipVariableDefault[] {
  const key = variableKey.trim()
  const current = readSkipVariableDefaults(config).filter((row) => row.variableKey !== key)
  if (!key) return current
  current.push({ variableKey: key, value })
  return current.sort((a, b) => a.variableKey.localeCompare(b.variableKey))
}

/**
 * Ensure every referenced missing key has a variableDefaults row (empty = null at runtime).
 * Drops rows for keys that are no longer missing/referenced for this jump.
 */
export function syncSkipVariableDefaults(
  config: Record<string, unknown>,
  referencedMissingKeys: string[],
): SkipVariableDefault[] {
  const existing = readSkipVariableDefaults(config)
  const byKey = new Map(existing.map((row) => [row.variableKey, row.value]))
  const want = new Set(referencedMissingKeys.map((k) => k.trim()).filter(Boolean))
  const next: SkipVariableDefault[] = []
  for (const key of want) {
    next.push({ variableKey: key, value: byKey.get(key) ?? '' })
  }
  // Keep manually set defaults for keys still in config but not currently listed? Drop them —
  // they would still apply at runtime but confuse the inspector. Prefer only current missing.
  return next.sort((a, b) => a.variableKey.localeCompare(b.variableKey))
}

/** True when target is reachable from source following graph edges. */
export function canReachNode(
  fromId: string,
  targetId: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): boolean {
  if (!fromId || !targetId) return false
  if (fromId === targetId) return true
  const outgoing = new Map<string, string[]>()
  for (const n of nodes) outgoing.set(n.id, [])
  for (const e of edges) outgoing.get(e.source)?.push(e.target)
  const q = [fromId]
  const seen = new Set<string>()
  while (q.length) {
    const cur = q.shift()!
    if (seen.has(cur)) continue
    seen.add(cur)
    if (cur === targetId) return true
    for (const next of outgoing.get(cur) ?? []) q.push(next)
  }
  return false
}

/**
 * Variables a skip-capable step makes available when it jumps (explicit defaults +
 * outputs of bypassed steps, which runtime nulls). Matches previewRuntime behaviour.
 */
export function variablesProvidedBySkipJump(
  source: DesignerNode,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): string[] {
  const keys = new Set<string>()
  for (const row of readSkipVariableDefaults(source.config)) {
    if (row.variableKey) keys.add(row.variableKey)
  }

  const byKey = new Map(nodes.map((n) => [n.key, n]))
  for (const targetKey of collectSkipTargetKeys(source)) {
    if (!targetKey || targetKey === source.key) continue
    const target = byKey.get(targetKey)
    if (!target) continue
    if (!canReachNode(source.id, target.id, nodes, edges)) continue

    const bypassed = nodesBypassedBySkipJump(source.id, target.id, nodes, edges)
    for (const step of bypassed) {
      for (const key of getStepOutputVariables(step)) keys.add(key)
    }

    // Run-after skip also skips the source step itself.
    if (String(source.config.runAfterSkipTo ?? '').trim() === targetKey) {
      for (const key of getStepOutputVariables(source)) {
        // Avoid counting this source's own skip defaults twice; still include real outputs.
        if (source.type === 'skip_to') continue
        keys.add(key)
      }
    }
  }
  return [...keys]
}

/** Step keys whose outputs are marked skipped when this source jumps. */
export function stepsSkippedByJump(
  source: DesignerNode,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): string[] {
  const keys = new Set<string>()
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  for (const targetKey of collectSkipTargetKeys(source)) {
    if (!targetKey || targetKey === source.key) continue
    const target = byKey.get(targetKey)
    if (!target || !canReachNode(source.id, target.id, nodes, edges)) continue
    for (const step of nodesBypassedBySkipJump(source.id, target.id, nodes, edges)) {
      keys.add(step.key)
    }
    if (String(source.config.runAfterSkipTo ?? '').trim() === targetKey) {
      keys.add(source.key)
    }
  }
  return [...keys]
}
