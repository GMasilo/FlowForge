import { Plus, Trash2 } from 'lucide-react'
import {
  CONDITION_OPERATOR_OPTIONS,
  type EntityFilterClauseConfig,
  type EntityFiltersConfig,
} from '@/features/designer/model/flowSchema'
import { coalesceEntityFilters } from '@/features/entities/entityQuery'
import { TemplateField, type TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import type { EntityAttribute } from '@/shared/types/database'

export function EntityQueryBuilder({
  attributes,
  filterAttribute,
  filterEquals,
  filters,
  suggestions = [],
  readOnly,
  valueMode = 'template',
  onChange,
}: {
  attributes: EntityAttribute[]
  filterAttribute?: string
  filterEquals?: string
  filters?: EntityFiltersConfig | null
  suggestions?: TemplateSuggestion[]
  readOnly?: boolean
  /** `template` = flow designer bindings; `plain` = Data-page literal values. */
  valueMode?: 'template' | 'plain'
  onChange: (next: EntityFiltersConfig) => void
}) {
  const resolved = coalesceEntityFilters({ filters, filterAttribute, filterEquals })
  const clauses = resolved.clauses.length
    ? resolved.clauses
    : ([{ attribute: '', operator: 'eq', value: '' }] as EntityFilterClauseConfig[])

  function commit(next: EntityFiltersConfig) {
    onChange({
      logic: next.logic === 'or' ? 'or' : 'and',
      clauses: next.clauses.map((c) => ({
        attribute: c.attribute ?? '',
        operator: c.operator ?? 'eq',
        value: c.value ?? '',
      })),
    })
  }

  function patchClause(index: number, patch: Partial<EntityFilterClauseConfig>) {
    const nextClauses = clauses.map((c, i) => (i === index ? { ...c, ...patch } : c))
    commit({ logic: resolved.logic, clauses: nextClauses })
  }

  function addClause() {
    commit({
      logic: resolved.logic,
      clauses: [...clauses, { attribute: attributes[0]?.key ?? '', operator: 'eq', value: '' }],
    })
  }

  function removeClause(index: number) {
    const nextClauses = clauses.filter((_, i) => i !== index)
    commit({
      logic: resolved.logic,
      clauses: nextClauses.length ? nextClauses : [{ attribute: '', operator: 'eq', value: '' }],
    })
  }

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/50 p-3">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Label>Query filters</Label>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-ink-muted)]">
              {valueMode === 'plain'
                ? 'Filter records with no-code conditions (AND/OR).'
                : 'Match records by attribute. Values accept literals or {{vars.*}}.'}
            </p>
          </div>
          {!readOnly && clauses.some((c) => c.attribute.trim()) ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0 text-[11px]"
              onClick={() => commit({ logic: 'and', clauses: [{ attribute: '', operator: 'eq', value: '' }] })}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div>
          <Label>Match</Label>
          <Select
            disabled={readOnly}
            value={resolved.logic}
            onChange={(e) => commit({ logic: e.target.value as 'and' | 'or', clauses })}
          >
            <option value="and">All conditions (AND)</option>
            <option value="or">Any condition (OR)</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {clauses.map((clause, index) => {
          const opMeta =
            CONDITION_OPERATOR_OPTIONS.find((o) => o.value === clause.operator) ?? CONDITION_OPERATOR_OPTIONS[0]
          return (
            <div key={index} className="min-w-0 space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Condition {index + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={readOnly || clauses.length <= 1}
                  onClick={() => removeClause(index)}
                  aria-label="Remove condition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="min-w-0">
                <Label>Attribute</Label>
                <Select
                  disabled={readOnly}
                  value={clause.attribute}
                  onChange={(e) => patchClause(index, { attribute: e.target.value })}
                >
                  <option value="">Select…</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={a.key}>
                      {a.label || a.key}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="min-w-0">
                <Label>Operator</Label>
                <Select
                  disabled={readOnly}
                  value={clause.operator}
                  onChange={(e) =>
                    patchClause(index, {
                      operator: e.target.value as EntityFilterClauseConfig['operator'],
                    })
                  }
                >
                  {CONDITION_OPERATOR_OPTIONS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </Select>
              </div>

              {opMeta?.needsRight ? (
                <div className="min-w-0">
                  <Label>Value</Label>
                  {valueMode === 'plain' ? (
                    <Input
                      className="h-9 text-sm"
                      disabled={readOnly}
                      value={clause.value}
                      onChange={(e) => patchClause(index, { value: e.target.value })}
                      placeholder="Value to match"
                    />
                  ) : (
                    <TemplateField
                      disabled={readOnly}
                      value={clause.value}
                      onChange={(v) => patchClause(index, { value: v })}
                      suggestions={suggestions}
                      placeholder="{{vars.value}} or literal"
                      hideHint
                    />
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-ink-muted)]">No value needed for this operator.</p>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly ? (
        <Button type="button" size="sm" variant="secondary" onClick={addClause}>
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </Button>
      ) : null}
    </div>
  )
}
