import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type {
  FlowEntityDefExport,
  FlowGlobalExport,
  FlowTemplateExport,
  FlowTestScenarioExport,
} from '@/features/designer/utils/flowTransfer'

const SHARED = {
  runAfter: { succeeded: true, failed: false, skipped: false, timedOut: false },
  delaySeconds: 0,
  timeoutSeconds: 0,
}

export type PackFlowBundle = {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
  templates: FlowTemplateExport[]
  entityDefs: FlowEntityDefExport[]
  testScenarios: FlowTestScenarioExport[]
  entities: Array<{ id: string; key: string }>
}

type Builder = {
  id: (key: string) => string
  edgeId: () => string
  message: (key: string, label: string, text: string, extra?: Record<string, unknown>) => DesignerNode
  question: (
    key: string,
    label: string,
    prompt: string,
    answerType: string,
    extra?: {
      output?: string
      required?: boolean
      config?: Record<string, unknown>
    },
  ) => DesignerNode
  setVar: (key: string, label: string, variableKey: string, value: string, valueType?: string) => DesignerNode
  entity: (
    key: string,
    label: string,
    config: {
      entityId: string
      operation: string
      fieldMap?: Record<string, string>
      outputVariable?: string
      filterAttribute?: string
      filterEquals?: string
      recordId?: string
    },
  ) => DesignerNode
  condition: (key: string, label: string, left: string, operator: string, right: string) => DesignerNode
  end: (key: string, label: string, message: string) => DesignerNode
  link: (from: string, to: string, sourceHandle?: string | null, label?: string | null) => DesignerEdge
  chain: (keys: string[]) => DesignerEdge[]
  byKey: (key: string) => DesignerNode
  nodes: DesignerNode[]
  edges: DesignerEdge[]
}

export function createPackBuilder(): Builder {
  const idByKey = new Map<string, string>()
  const nodes: DesignerNode[] = []
  const edges: DesignerEdge[] = []
  const nodeByKey = new Map<string, DesignerNode>()

  function id(key: string) {
    const existing = idByKey.get(key)
    if (existing) return existing
    const next = crypto.randomUUID()
    idByKey.set(key, next)
    return next
  }

  function edgeId() {
    return crypto.randomUUID()
  }

  function push(node: DesignerNode) {
    nodes.push(node)
    nodeByKey.set(node.key, node)
    return node
  }

  function message(key: string, label: string, text: string, extra: Record<string, unknown> = {}) {
    return push({
      id: id(key),
      key,
      type: 'message',
      label,
      config: { ...SHARED, text, ...extra },
      position: { x: 80, y: 40 + nodes.length * 100 },
    })
  }

  function question(
    key: string,
    label: string,
    prompt: string,
    answerType: string,
    extra: { output?: string; required?: boolean; config?: Record<string, unknown> } = {},
  ) {
    return push({
      id: id(key),
      key,
      type: 'question',
      label,
      config: {
        ...SHARED,
        prompt,
        answerType,
        answerRequired: extra.required !== false,
        outputVariable: extra.output ?? key.replace(/^ask_/, ''),
        ...(extra.config ?? {}),
      },
      position: { x: 80, y: 40 + nodes.length * 100 },
    })
  }

  function setVar(key: string, label: string, variableKey: string, value: string, valueType = 'string') {
    return push({
      id: id(key),
      key,
      type: 'set_variable',
      label,
      config: { ...SHARED, variableKey, value, valueType },
      position: { x: 80, y: 40 + nodes.length * 100 },
    })
  }

  function entity(
    key: string,
    label: string,
    config: {
      entityId: string
      operation: string
      fieldMap?: Record<string, string>
      outputVariable?: string
      filterAttribute?: string
      filterEquals?: string
      filters?: Array<{ attribute: string; operator?: string; value?: string }>
      filterLogic?: 'and' | 'or'
      sortAttribute?: string
      sortDirection?: 'asc' | 'desc'
      limit?: string
      recordId?: string
    },
  ) {
    return push({
      id: id(key),
      key,
      type: 'entity',
      label,
      config: {
        ...SHARED,
        entityId: config.entityId,
        operation: config.operation,
        recordId: config.recordId ?? '',
        filterAttribute: config.filterAttribute ?? '',
        filterEquals: config.filterEquals ?? '',
        filters: config.filters ?? [],
        filterLogic: config.filterLogic ?? 'and',
        sortAttribute: config.sortAttribute ?? '',
        sortDirection: config.sortDirection ?? 'asc',
        limit: config.limit ?? '',
        fieldMap: config.fieldMap ?? {},
        outputVariable: config.outputVariable ?? '',
      },
      position: { x: 80, y: 40 + nodes.length * 100 },
    })
  }

  function condition(key: string, label: string, left: string, operator: string, right: string) {
    return push({
      id: id(key),
      key,
      type: 'condition',
      label,
      config: { ...SHARED, left, operator, right },
      position: { x: 80, y: 40 + nodes.length * 100 },
    })
  }

  function end(key: string, label: string, messageText: string) {
    return push({
      id: id(key),
      key,
      type: 'end',
      label,
      config: { ...SHARED, message: messageText },
      position: { x: 80, y: 40 + nodes.length * 100 },
    })
  }

  function byKey(key: string) {
    const n = nodeByKey.get(key)
    if (!n) throw new Error(`Unknown step key "${key}"`)
    return n
  }

  function link(from: string, to: string, sourceHandle: string | null = null, label: string | null = null) {
    const edge: DesignerEdge = {
      id: edgeId(),
      source: byKey(from).id,
      target: byKey(to).id,
      sourceHandle,
      label,
    }
    edges.push(edge)
    return edge
  }

  function chain(keys: string[]) {
    const out: DesignerEdge[] = []
    for (let i = 0; i < keys.length - 1; i++) {
      out.push(link(keys[i]!, keys[i + 1]!))
    }
    return out
  }

  return {
    id,
    edgeId,
    message,
    question,
    setVar,
    entity,
    condition,
    end,
    link,
    chain,
    byKey,
    nodes,
    edges,
  }
}

export function emptyPackBundle(): PackFlowBundle {
  return {
    nodes: [],
    edges: [],
    globals: [],
    templates: [],
    entityDefs: [],
    testScenarios: [],
    entities: [],
  }
}
