import type { FlowNodeType } from '@/shared/types/database'
import { readSetVariableAssignments, type DesignerNode } from '@/features/designer/model/flowSchema'

/** Light-theme node accents (matches `--color-node-*` in index.css). */
export const CANVAS_NODE_COLOR: Record<FlowNodeType, string> = {
  message: '#0369a1',
  question: '#0f766e',
  http: '#7c3aed',
  database: '#7c3aed',
  email: '#ea580c',
  integration: '#7c3aed',
  handoff: '#0f766e',
  transfer: '#7c3aed',
  sign_in: '#0f766e',
  button: '#0f766e',
  skip_to: '#ca8a04',
  restart: '#334155',
  condition: '#ca8a04',
  switch: '#d97706',
  loop: '#0d9488',
  set_variable: '#475569',
  operation: '#4f46e5',
  entity: '#7c3aed',
  end: '#334155',
}

export function truncateCanvasText(value: string, max = 42) {
  const t = value.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

export function canvasStepPreview(node: DesignerNode): string {
  const c = node.config as Record<string, unknown>
  switch (node.type) {
    case 'message':
      return truncateCanvasText(String(c.text ?? c.message ?? ''))
    case 'question':
      return truncateCanvasText(String(c.prompt ?? c.question ?? ''))
    case 'http':
      return truncateCanvasText(`${String(c.method ?? 'GET')} ${String(c.url ?? c.path ?? '')}`)
    case 'database':
      return truncateCanvasText(`${String(c.operation ?? 'query')} · ${String(c.sql ?? 'SQL…')}`)
    case 'email':
      return truncateCanvasText(String(c.to ?? c.subject ?? ''))
    case 'integration':
      return truncateCanvasText(String(c.action ?? 'Integration'))
    case 'handoff':
      return truncateCanvasText(String(c.message ?? 'Escalate to agent'))
    case 'transfer':
      return truncateCanvasText(String(c.startNodeKey ? `Start at ${c.startNodeKey}` : 'Transfer to chatbot'))
    case 'sign_in':
      return truncateCanvasText(String(c.prompt ?? c.mode ?? 'Sign in'))
    case 'button': {
      const buttons = Array.isArray(c.buttons) ? c.buttons : []
      const labels = buttons
        .map((b) => (b && typeof b === 'object' && 'label' in b ? String((b as { label?: unknown }).label ?? '') : ''))
        .filter(Boolean)
      return truncateCanvasText(labels.length ? labels.join(' · ') : String(c.text ?? 'Button'))
    }
    case 'skip_to': {
      const target = String(c.targetNodeKey ?? '').trim()
      const defaults = Array.isArray(c.variableDefaults) ? c.variableDefaults.length : 0
      if (!target) return truncateCanvasText('Skip to…')
      return truncateCanvasText(defaults ? `→ ${target} · ${defaults} var${defaults === 1 ? '' : 's'}` : `→ ${target}`)
    }
    case 'restart':
      return c.clearCookies ? 'Restart · clear cookies' : 'Restart conversation'
    case 'condition':
      return truncateCanvasText(String(c.expression ?? c.left ?? 'If…'))
    case 'switch':
      return truncateCanvasText(String(c.value ?? 'Switch…'))
    case 'loop':
      return truncateCanvasText(String(c.collection ?? 'Each item'))
    case 'set_variable': {
      const keys = readSetVariableAssignments(c)
        .map((row) => row.variableKey.trim())
        .filter(Boolean)
      if (!keys.length) return truncateCanvasText('Set variables…')
      if (keys.length === 1) return truncateCanvasText(`${keys[0]} = …`)
      return truncateCanvasText(`${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''} = …`)
    }
    case 'operation':
      return truncateCanvasText(String(c.operation ?? c.name ?? ''))
    case 'entity':
      return truncateCanvasText(`${String(c.operation ?? 'list')} · entity`)
    case 'end':
      return 'Conversation ends'
    default:
      return ''
  }
}

export function canvasEdgeMeta(sourceHandle: string | null | undefined, label: string | null | undefined) {
  if (label === 'Then') {
    return { label: 'Then', stroke: '#64748b', labelColor: '#475569' }
  }
  if (sourceHandle === 'true' || label === 'Yes') {
    return { label: 'Yes', stroke: '#059669', labelColor: '#047857' }
  }
  if (sourceHandle === 'false' || label === 'No') {
    return { label: 'No', stroke: '#e11d48', labelColor: '#be123c' }
  }
  if (sourceHandle === 'success' || label === 'Success') {
    return { label: 'Success', stroke: '#059669', labelColor: '#047857' }
  }
  if (sourceHandle === 'fail' || label === 'Fail') {
    return { label: 'Fail', stroke: '#e11d48', labelColor: '#be123c' }
  }
  if (sourceHandle === 'body' || label === 'Each') {
    return { label: 'Each', stroke: '#0d9488', labelColor: '#0f766e' }
  }
  if (sourceHandle === 'default' || label === 'Default') {
    return { label: 'Default', stroke: '#64748b', labelColor: '#475569' }
  }
  if (sourceHandle?.startsWith('case_') || label === 'Case') {
    return { label: label && label !== 'Then' ? label : 'Case', stroke: '#d97706', labelColor: '#b45309' }
  }
  return { label: label ?? undefined, stroke: '#94a3b8', labelColor: '#64748b' }
}
