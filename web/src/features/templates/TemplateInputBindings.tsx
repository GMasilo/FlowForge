import { extractTemplateRefs } from '@/features/designer/model/flowSchema'
import { TemplateField, type TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import {
  isTemplateKind,
  parseTemplateBindingMap,
  parseTemplateContent,
  templateInputsOf,
  type TemplateBindingMap,
  type TemplateInput,
  type TemplateKind,
} from '@/features/templates/templateModel'
import type { ChatbotTemplate } from '@/shared/types/database'
import { Label } from '@/shared/ui/label'

export { parseTemplateBindingMap } from '@/features/templates/templateModel'
export type { TemplateBindingMap } from '@/features/templates/templateModel'

export function ensureTemplateBinding(raw: unknown, templateKey: string): TemplateBindingMap {
  const next = parseTemplateBindingMap(raw)
  if (templateKey.trim() && !next[templateKey]) next[templateKey] = {}
  return next
}

export function templateKeysUsedInStep(config: Record<string, unknown>): string[] {
  const keys = new Set<string>()
  for (const value of [config.templateKey, config.otpTemplateKey]) {
    if (typeof value === 'string' && value.trim()) keys.add(value.trim())
  }
  for (const key of Object.keys(parseTemplateBindingMap(config.templateBindings))) {
    if (key.trim()) keys.add(key)
  }
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      for (const ref of extractTemplateRefs(value)) {
        const parts = ref.split('.').map((p) => p.trim())
        if (parts[0] === 'templates' && parts[1]) keys.add(parts[1])
      }
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (value && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) walk(nested)
    }
  }
  walk(config)
  return [...keys]
}

export function TemplateInputBindings({
  templates,
  config,
  readOnly,
  suggestions,
  onChange,
}: {
  templates: Array<Pick<ChatbotTemplate, 'key' | 'name' | 'kind' | 'content'>>
  config: Record<string, unknown>
  readOnly?: boolean
  suggestions: TemplateSuggestion[]
  onChange: (next: TemplateBindingMap) => void
}) {
  const bindings = parseTemplateBindingMap(config.templateBindings)
  const usedKeys = templateKeysUsedInStep(config)
  const blocks = usedKeys
    .map((key) => {
      const row = templates.find((t) => t.key === key)
      if (!row || !isTemplateKind(row.kind) || row.kind === 'cart') return null
      const inputs = templateInputsOf(parseTemplateContent(row.kind, row.content))
      if (!inputs.length) return null
      return { key, name: row.name, kind: row.kind as TemplateKind, inputs }
    })
    .filter((b): b is { key: string; name: string; kind: TemplateKind; inputs: TemplateInput[] } => !!b)

  if (!blocks.length) return null

  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.key} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Template inputs · {block.name}</h3>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Bind {'{{vars.*}}'} or type a value. File inputs accept a signature or media expression.
            </p>
          </div>
          {block.inputs.map((input) => (
            <div key={`${block.key}.${input.key}`}>
              <Label>
                {input.label || input.key}
                {input.required ? ' *' : ''}
                <span className="ml-1 font-normal text-[var(--color-ink-muted)]">({input.type})</span>
              </Label>
              <TemplateField
                disabled={readOnly}
                value={bindings[block.key]?.[input.key] ?? ''}
                suggestions={suggestions}
                placeholder={input.type === 'file' ? '{{vars.signature}}' : `{{vars.${input.key}}}`}
                onChange={(value) => {
                  const next = parseTemplateBindingMap(config.templateBindings)
                  next[block.key] = { ...(next[block.key] ?? {}), [input.key]: value }
                  onChange(next)
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
