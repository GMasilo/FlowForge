import type { ConnectionWithConfig, FlowNodeType } from '@/shared/types/database'
import {
  getStepOutputVariable,
  nodeTypeLabel,
  type DesignerNode,
} from '@/features/designer/model/flowSchema'
import { connectionInfoFromRow } from '@/features/connections/connectionValidation'

export type DataEntryKind = 'global' | 'step_var' | 'loop' | 'step_ref' | 'connection'

export type DataInventoryEntry = {
  id: string
  kind: DataEntryKind
  /** Template users can copy, e.g. {{vars.userName}} */
  insert: string
  label: string
  detail?: string
  typeBadge?: string
  sourceNodeKey?: string
  sourceNodeType?: FlowNodeType
  connectionId?: string
  connectionKind?: string
}

export type GlobalVariableRow = {
  key: string
  value_type: string
  default_value?: unknown
  description?: string | null
}

export type LinkedConnectionRow = {
  id: string
  connection_id: string
  connections: Pick<ConnectionWithConfig, 'id' | 'name' | 'kind'> | null
}

export function collectChatbotDataInventory(args: {
  globals: GlobalVariableRow[]
  nodes: DesignerNode[]
  connections: ConnectionWithConfig[]
  linked: LinkedConnectionRow[]
}): {
  globals: DataInventoryEntry[]
  stepVars: DataInventoryEntry[]
  loopLocals: DataInventoryEntry[]
  stepRefs: DataInventoryEntry[]
  connections: DataInventoryEntry[]
} {
  const { globals, nodes, connections, linked } = args

  const globalEntries: DataInventoryEntry[] = globals.map((v) => ({
    id: `global:${v.key}`,
    kind: 'global',
    insert: `{{vars.${v.key}}}`,
    label: v.key,
    typeBadge: v.value_type,
    detail:
      v.default_value == null
        ? 'No default'
        : `default: ${typeof v.default_value === 'string' ? v.default_value : JSON.stringify(v.default_value)}`,
  }))

  const stepVars: DataInventoryEntry[] = []
  const loopLocals: DataInventoryEntry[] = []
  const stepRefs: DataInventoryEntry[] = []

  for (const node of nodes) {
    const out = getStepOutputVariable(node)
    if (out) {
      const kindLabel =
        node.type === 'question'
          ? 'Question answer'
          : node.type === 'http'
            ? 'HTTP response'
            : node.type === 'operation'
              ? 'Operation result'
              : 'Set variable'
      stepVars.push({
        id: `step-var:${node.id}:${out}`,
        kind: 'step_var',
        insert: `{{vars.${out}}}`,
        label: out,
        detail: kindLabel,
        typeBadge: nodeTypeLabel(node.type),
        sourceNodeKey: node.key,
        sourceNodeType: node.type,
      })
    }

    stepRefs.push({
      id: `step:${node.id}`,
      kind: 'step_ref',
      insert: `{{steps.${node.key}}}`,
      label: node.key,
      detail: node.label || nodeTypeLabel(node.type),
      typeBadge: nodeTypeLabel(node.type),
      sourceNodeKey: node.key,
      sourceNodeType: node.type,
    })

    if (node.type === 'question') {
      stepRefs.push({
        id: `step:${node.id}:response`,
        kind: 'step_ref',
        insert: `{{steps.${node.key}.response}}`,
        label: `${node.key}.response`,
        detail: 'Answer text',
        typeBadge: 'Question',
        sourceNodeKey: node.key,
        sourceNodeType: node.type,
      })
    }

    if (node.type === 'http' || node.type === 'email') {
      const connId = typeof node.config.connectionId === 'string' ? node.config.connectionId : ''
      const row = connections.find((c) => c.id === connId)
      if (row) {
        const info = connectionInfoFromRow(row)
        for (const path of info.responsePaths) {
          stepRefs.push({
            id: `step:${node.id}:${path.path}`,
            kind: 'step_ref',
            insert: `{{steps.${node.key}.${path.path}}}`,
            label: `${node.key}.${path.path}`,
            detail: `${info.name} · ${path.type}`,
            typeBadge: nodeTypeLabel(node.type),
            sourceNodeKey: node.key,
            sourceNodeType: node.type,
            connectionId: row.id,
            connectionKind: row.kind,
          })
        }
      }
    }

    if (node.type === 'loop') {
      const itemVar = String(node.config.itemVariable ?? 'item').trim() || 'item'
      const indexVar = String(node.config.indexVariable ?? 'index').trim() || 'index'
      loopLocals.push(
        {
          id: `loop:${node.id}:item`,
          kind: 'loop',
          insert: `{{vars.${itemVar}}}`,
          label: itemVar,
          detail: `Current item · ${node.key}`,
          typeBadge: 'For each',
          sourceNodeKey: node.key,
          sourceNodeType: node.type,
        },
        {
          id: `loop:${node.id}:index`,
          kind: 'loop',
          insert: `{{vars.${indexVar}}}`,
          label: indexVar,
          detail: `0-based index · ${node.key}`,
          typeBadge: 'For each',
          sourceNodeKey: node.key,
          sourceNodeType: node.type,
        },
      )
    }
  }

  const usedConnectionIds = new Set<string>()
  for (const node of nodes) {
    if (node.type !== 'http' && node.type !== 'email') continue
    const connId = typeof node.config.connectionId === 'string' ? node.config.connectionId : ''
    if (connId) usedConnectionIds.add(connId)
  }
  for (const row of linked) {
    if (row.connection_id) usedConnectionIds.add(row.connection_id)
  }

  const connectionEntries: DataInventoryEntry[] = []
  for (const id of usedConnectionIds) {
    const row = connections.find((c) => c.id === id)
    if (!row) continue
    const info = connectionInfoFromRow(row)
    const linkedRow = linked.find((l) => l.connection_id === id)
    const usedBy = nodes
      .filter(
        (n) =>
          (n.type === 'http' || n.type === 'email') &&
          typeof n.config.connectionId === 'string' &&
          n.config.connectionId === id,
      )
      .map((n) => n.key)

    connectionEntries.push({
      id: `conn:${id}`,
      kind: 'connection',
      insert: row.name,
      label: row.name,
      detail: [
        linkedRow ? 'Linked to chatbot' : 'Used in flow only',
        usedBy.length ? `steps: ${usedBy.join(', ')}` : null,
        info.inputParams.length ? `${info.inputParams.length} input(s)` : null,
        `${info.responsePaths.length} response path(s)`,
      ]
        .filter(Boolean)
        .join(' · '),
      typeBadge: row.kind,
      connectionId: id,
      connectionKind: row.kind,
    })

    for (const param of info.inputParams) {
      const key = param.key.trim()
      if (!key) continue
      connectionEntries.push({
        id: `conn:${id}:in:${key}`,
        kind: 'connection',
        insert: `{{vars.${key}}}`,
        label: param.label || key,
        detail: `Input · ${row.name}${param.required ? ' · required' : ''}`,
        typeBadge: param.type,
        connectionId: id,
        connectionKind: row.kind,
      })
    }

    for (const path of info.responsePaths.slice(0, 12)) {
      connectionEntries.push({
        id: `conn:${id}:out:${path.path}`,
        kind: 'connection',
        insert: path.path,
        label: path.path,
        detail: `Response schema · ${row.name}`,
        typeBadge: path.type,
        connectionId: id,
        connectionKind: row.kind,
      })
    }
  }

  return {
    globals: globalEntries,
    stepVars,
    loopLocals,
    stepRefs,
    connections: connectionEntries,
  }
}
