import { useMemo } from 'react'
import type { Connection } from '@/shared/types/database'
import type { DesignerNode } from '@/features/designer/model/flowSchema'
import { getStepOutputVariable } from '@/features/designer/model/flowSchema'
import { connectionInfoFromRow } from '@/features/connections/connectionValidation'
import type { TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { EXPRESSION_FUNCTION_DOCS } from '@/features/designer/preview/expressionEval'
import { insertSnippet, type TemplateKind } from '@/features/templates/templateModel'
import type { ChatbotTemplate } from '@/shared/types/database'

export function buildTemplateSuggestions(args: {
  nodes: DesignerNode[]
  globals: string[]
  connections: Connection[]
  currentNodeId?: string
  media?: Array<{ key: string; filename: string }>
  templates?: Array<Pick<ChatbotTemplate, 'key' | 'name' | 'kind'>>
  /** When set, only these template kinds appear in {{ suggestions (e.g. no cart on Payment). */
  allowedTemplateKinds?: readonly TemplateKind[]
}): TemplateSuggestion[] {
  const { nodes, globals, connections, currentNodeId, media, templates, allowedTemplateKinds } = args
  const kindAllow = allowedTemplateKinds?.length ? new Set(allowedTemplateKinds) : null
  const out: TemplateSuggestion[] = []

  for (const fn of EXPRESSION_FUNCTION_DOCS) {
    out.push({
      insert: fn.insert,
      label: fn.name,
      group: 'Functions',
      detail: fn.hint,
    })
  }

  for (const key of globals) {
    out.push({
      insert: `{{vars.${key}}}`,
      label: key,
      group: 'Variables',
      detail: 'global',
    })
  }

  for (const file of media ?? []) {
    if (!file.key) continue
    out.push({
      insert: `{{renderFile(media.${file.key})}}`,
      label: file.key,
      group: 'Media',
      detail: `preview · ${file.filename}`,
    })
    out.push({
      insert: `{{media.${file.key}.url}}`,
      label: `${file.key}.url`,
      group: 'Media',
      detail: file.filename,
    })
  }

  for (const row of templates ?? []) {
    if (!row.key) continue
    if (kindAllow && !kindAllow.has(row.kind)) continue
    out.push({
      insert: insertSnippet(row.key, row.kind),
      label: row.key,
      group: 'Templates',
      detail: row.name,
    })
    if (row.kind === 'email') {
      out.push({
        insert: `{{templates.${row.key}.subject}}`,
        label: `${row.key}.subject`,
        group: 'Templates',
        detail: row.name,
      })
    }
    if (row.kind === 'receipt') {
      out.push({
        insert: `{{templates.${row.key}.html}}`,
        label: `${row.key}.html`,
        group: 'Templates',
        detail: `${row.name} · HTML`,
      })
    }
  }

  for (const node of nodes) {
    if (node.id === currentNodeId) continue
    const stepOut = getStepOutputVariable(node)
    if (stepOut) {
      out.push({
        insert: `{{vars.${stepOut}}}`,
        label: stepOut,
        group: 'Variables',
        detail: `from ${node.key}`,
      })
    }
    out.push({
      insert: `{{steps.${node.key}}}`,
      label: node.key,
      group: 'Steps',
      detail: node.type,
    })

    if (node.type === 'http' || node.type === 'email') {
      const connId = typeof node.config.connectionId === 'string' ? node.config.connectionId : ''
      const row = connections.find((c) => c.id === connId)
      if (row) {
        const info = connectionInfoFromRow(row)
        for (const path of info.responsePaths) {
          out.push({
            insert: `{{steps.${node.key}.${path.path}}}`,
            label: `${node.key}.${path.path}`,
            group: row.kind === 'http' ? 'HTTP responses' : 'Email results',
            detail: path.type,
          })
        }
        for (const param of info.inputParams) {
          if (!param.key.trim()) continue
          out.push({
            insert: `{{vars.${param.key.trim()}}}`,
            label: param.label || param.key,
            group: 'Connection inputs',
            detail: info.name,
          })
        }
      }
    }

    if (node.type === 'question') {
      out.push({
        insert: `{{steps.${node.key}.response}}`,
        label: `${node.key}.response`,
        group: 'Steps',
        detail: 'answer',
      })
      if (String(node.config.answerType ?? '') === 'shop') {
        const cartVar = String(node.config.outputVariable ?? '').trim()
        for (const field of ['total', 'subtotal', 'feesTotal', 'fees', 'itemCount', 'currency', 'items'] as const) {
          out.push({
            insert: `{{steps.${node.key}.response.${field}}}`,
            label: `${node.key}.response.${field}`,
            group: 'Steps',
            detail: 'shop cart',
          })
          if (cartVar) {
            out.push({
              insert: `{{vars.${cartVar}.${field}}}`,
              label: `${cartVar}.${field}`,
              group: 'Variables',
              detail: `from ${node.key}`,
            })
          }
        }
      }
    }

    if (node.type === 'loop') {
      const itemVar = String(node.config.itemVariable ?? 'item').trim() || 'item'
      const indexVar = String(node.config.indexVariable ?? 'index').trim() || 'index'
      out.push(
        {
          insert: `{{vars.${itemVar}}}`,
          label: itemVar,
          group: 'Loop',
          detail: `current item · ${node.key}`,
        },
        {
          insert: `{{vars.${indexVar}}}`,
          label: indexVar,
          group: 'Loop',
          detail: `0-based index · ${node.key}`,
        },
      )
    }
  }

  // Dedupe by insert
  const seen = new Set<string>()
  return out.filter((s) => {
    if (seen.has(s.insert)) return false
    seen.add(s.insert)
    return true
  })
}

export function useTemplateSuggestions(
  nodes: DesignerNode[],
  globals: string[],
  connections: Connection[],
  currentNodeId?: string,
  media?: Array<{ key: string; filename: string }>,
  templates?: Array<Pick<ChatbotTemplate, 'key' | 'name' | 'kind'>>,
  allowedTemplateKinds?: readonly TemplateKind[],
) {
  const kindsKey = allowedTemplateKinds?.join(',') ?? ''
  return useMemo(
    () =>
      buildTemplateSuggestions({
        nodes,
        globals,
        connections,
        currentNodeId,
        media,
        templates,
        allowedTemplateKinds,
      }),
    [nodes, globals, connections, currentNodeId, media, templates, kindsKey],
  )
}
