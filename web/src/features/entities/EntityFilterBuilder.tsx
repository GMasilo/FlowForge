import { Plus, Trash2 } from 'lucide-react'
import type { VariableType } from '@/shared/types/database'
import {
  ENTITY_FILTER_OPERATOR_OPTIONS,
  emptyEntityFilterClause,
  type EntityFilterClause,
  type EntityFilterLogic,
  type EntityQuerySpec,
} from '@/features/entities/entityQuery'
import { TemplateField, type TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'

export type EntityFilterAttributeOption = {
  key: string
  label?: string | null
  value_type?: VariableType | string
}

type Props = {
  attributes: EntityFilterAttributeOption[]
  query: EntityQuerySpec
  onChange: (next: EntityQuerySpec) => void
  /** Flow mode uses TemplateField for values; browse uses plain inputs. */
  mode?: 'flow' | 'browse'
  suggestions?: TemplateSuggestion[]
  readOnly?: boolean
  showSortLimit?: boolean
  /** Compact label for Data page vs inspector. */
  title?: string
}

export function EntityFilterBuilder({
  attributes,
  query,
  onChange,
  mode = 'flow',
  suggestions = [],
  readOnly = false,
  showSortLimit = true,
  title = 'Query',
}: Props) {
  function patch(partial: Partial<EntityQuerySpec>) {
    onChange({ ...query, ...partial })
  }

  function updateClause(index: number, partial: Partial<EntityFilterClause>) {
    const filters = query.filters.map((c, i) => (i === index ? { ...c, ...partial } : c))
    patch({ filters })
  }

  function addClause() {
    const firstAttr = attributes[0]?.key ?? ''
    patch({
      filters: [...query.filters, { ...emptyEntityFilterClause(), attribute: firstAttr }],
    })
  }

  function removeClause(index: number) {
    patch({ filters: query.filters.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border)]/90 bg-[var(--color-surface-2)]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Filter records with conditions{showSortLimit ? ', then sort and limit' : ''}. No code required.
          </p>
        </div>
        {!readOnly ? (
          <Button size="sm" variant="secondary" type="button" onClick={addClause} disabled={!attributes.length}>
            <Plus className="h-3.5 w-3.5" />
            Add condition
          </Button>
        ) : null}
      </div>

      {query.filters.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="mb-0">Match</Label>
          <Select
            className="h-8 w-auto min-w-[140px]"
            disabled={readOnly}
            value={query.filterLogic}
            onChange={(e) => patch({ filterLogic: e.target.value as EntityFilterLogic })}
          >
            <option value="and">All conditions (AND)</option>
            <option value="or">Any condition (OR)</option>
          </Select>
        </div>
      ) : null}

      {!query.filters.length ? (
        <p className="text-xs text-[var(--color-ink-muted)]">No conditions — all records are included.</p>
      ) : (
        <ul className="space-y-2">
          {query.filters.map((clause, index) => {
            const opMeta =
              ENTITY_FILTER_OPERATOR_OPTIONS.find((o) => o.value === clause.operator) ??
              ENTITY_FILTER_OPERATOR_OPTIONS[0]!
            const attr = attributes.find((a) => a.key === clause.attribute)
            return (
              <li
                key={`filter-${index}`}
                className="grid gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto]"
              >
                <div>
                  {index === 0 ? <Label>Attribute</Label> : null}
                  <Select
                    className="h-8"
                    disabled={readOnly}
                    value={clause.attribute}
                    onChange={(e) => updateClause(index, { attribute: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {attributes.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label || a.key}
                        {a.value_type ? ` (${a.value_type})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  {index === 0 ? <Label>Operator</Label> : null}
                  <Select
                    className="h-8"
                    disabled={readOnly}
                    value={clause.operator}
                    onChange={(e) =>
                      updateClause(index, {
                        operator: e.target.value as EntityFilterClause['operator'],
                      })
                    }
                  >
                    {ENTITY_FILTER_OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  {index === 0 ? <Label>Value</Label> : null}
                  {opMeta.needsValue ? (
                    mode === 'flow' ? (
                      <TemplateField
                        disabled={readOnly}
                        value={clause.value}
                        onChange={(v) => updateClause(index, { value: v })}
                        suggestions={suggestions}
                        placeholder={attr?.value_type === 'number' ? '42 or {{vars.n}}' : '{{vars.value}}'}
                      />
                    ) : (
                      <Input
                        className="h-8"
                        disabled={readOnly}
                        value={clause.value}
                        onChange={(e) => updateClause(index, { value: e.target.value })}
                        placeholder="Value"
                      />
                    )
                  ) : (
                    <p className="flex h-8 items-center text-[11px] text-[var(--color-ink-muted)]">{opMeta.hint}</p>
                  )}
                </div>
                {!readOnly ? (
                  <div className={`flex ${index === 0 ? 'items-end' : 'items-center'}`}>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                      title="Remove condition"
                      onClick={() => removeClause(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {showSortLimit ? (
        <div className="grid gap-2 border-t border-[var(--color-border)]/80 pt-3 sm:grid-cols-3">
          <div>
            <Label>Sort by</Label>
            <Select
              className="h-8"
              disabled={readOnly}
              value={query.sortAttribute}
              onChange={(e) => patch({ sortAttribute: e.target.value })}
            >
              <option value="">(none)</option>
              {attributes.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label || a.key}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Direction</Label>
            <Select
              className="h-8"
              disabled={readOnly || !query.sortAttribute}
              value={query.sortDirection}
              onChange={(e) => patch({ sortDirection: e.target.value === 'desc' ? 'desc' : 'asc' })}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </Select>
          </div>
          <div>
            <Label>Limit</Label>
            {mode === 'flow' ? (
              <TemplateField
                disabled={readOnly}
                value={query.limit}
                onChange={(v) => patch({ limit: v })}
                suggestions={suggestions}
                placeholder="10 or {{vars.limit}}"
              />
            ) : (
              <Input
                className="h-8"
                disabled={readOnly}
                type="number"
                min={1}
                value={query.limit}
                onChange={(e) => patch({ limit: e.target.value })}
                placeholder="All"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
