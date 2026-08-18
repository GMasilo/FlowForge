import { Plus, Trash2 } from 'lucide-react'
import {
  emptyInputParam,
  emptySchemaField,
  type ConnectionInputParam,
  type ExpectedResponse,
  type SchemaField,
} from '@/features/connections/responseSchema'
import { VARIABLE_TYPE_OPTIONS } from '@/features/connections/connectionConfig'
import type { VariableType } from '@/shared/types/database'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

export function InputParamsEditor({
  value,
  onChange,
  showLocation = true,
  disabled,
}: {
  value: ConnectionInputParam[]
  onChange: (next: ConnectionInputParam[]) => void
  showLocation?: boolean
  disabled?: boolean
}) {
  function update(index: number, patch: Partial<ConnectionInputParam>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Input parameters</h3>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Designers fill these in each step — use in path as {'{id}'} / :id or map to query/body/header.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onChange([...value, emptyInputParam()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add param
        </Button>
      </div>

      {!value.length ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
          No input parameters yet.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((param, index) => (
            <div key={index} className="rounded-xl border border-[var(--color-border)] bg-white/70 p-3">
              <div className={`grid gap-2 ${showLocation ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                <div>
                  <Label>Key</Label>
                  <Input
                    value={param.key}
                    disabled={disabled}
                    placeholder="userId"
                    onChange={(e) => update(index, { key: e.target.value, label: param.label || e.target.value })}
                  />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input
                    value={param.label}
                    disabled={disabled}
                    placeholder="User ID"
                    onChange={(e) => update(index, { label: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={param.type}
                    disabled={disabled}
                    onChange={(e) => update(index, { type: e.target.value as VariableType })}
                  >
                    {VARIABLE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                {showLocation ? (
                  <div>
                    <Label>Location</Label>
                    <Select
                      value={param.location}
                      disabled={disabled}
                      onChange={(e) =>
                        update(index, { location: e.target.value as ConnectionInputParam['location'] })
                      }
                    >
                      <option value="path">path</option>
                      <option value="query">query</option>
                      <option value="body">body</option>
                      <option value="header">header</option>
                    </Select>
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <label className="flex h-10 items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                    <input
                      type="checkbox"
                      checked={param.required}
                      disabled={disabled}
                      onChange={(e) => update(index, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    aria-label="Remove param"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Default</Label>
                  <Input
                    value={param.defaultValue ?? ''}
                    disabled={disabled}
                    onChange={(e) => update(index, { defaultValue: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Help text</Label>
                  <Input
                    value={param.description ?? ''}
                    disabled={disabled}
                    onChange={(e) => update(index, { description: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SchemaFieldsEditor({
  value,
  onChange,
  disabled,
  depth = 0,
}: {
  value: SchemaField[]
  onChange: (next: SchemaField[]) => void
  disabled?: boolean
  depth?: number
}) {
  function update(index: number, patch: Partial<SchemaField>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-2" style={{ marginLeft: depth ? depth * 12 : 0 }}>
      {value.map((field, index) => (
        <div key={index} className="rounded-lg border border-[var(--color-border)] bg-slate-50/60 p-2.5">
          <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto_auto]">
            <Input
              value={field.key}
              disabled={disabled}
              placeholder="field name"
              onChange={(e) => update(index, { key: e.target.value })}
            />
            <Select
              value={field.type}
              disabled={disabled}
              onChange={(e) => update(index, { type: e.target.value as VariableType })}
            >
              {VARIABLE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                checked={field.required}
                disabled={disabled}
                onChange={(e) => update(index, { required: e.target.checked })}
              />
              req
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {(field.type === 'object' || field.type === 'array') && depth < 3 ? (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] text-[var(--color-ink-muted)]">
                  {field.type === 'array' ? 'Item fields' : 'Nested fields'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() =>
                    update(index, { children: [...(field.children ?? []), emptySchemaField()] })
                  }
                >
                  <Plus className="h-3 w-3" />
                  Field
                </Button>
              </div>
              <SchemaFieldsEditor
                value={field.children ?? []}
                disabled={disabled}
                depth={depth + 1}
                onChange={(children) => update(index, { children })}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function ExpectedResponseEditor({
  value,
  onChange,
  disabled,
}: {
  value: ExpectedResponse
  onChange: (next: ExpectedResponse) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Expected response</h3>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Tell the designer the shape of the returned data so steps can reference fields safely.
        </p>
      </div>

      <div className="max-w-xs">
        <Label>Response data type</Label>
        <Select
          value={value.dataType}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, dataType: e.target.value as VariableType })}
        >
          {VARIABLE_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      {value.dataType === 'object' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Object schema</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onChange({ ...value, schema: [...value.schema, emptySchemaField()] })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add field
            </Button>
          </div>
          {!value.schema.length ? (
            <p className="rounded-xl border border-dashed border-amber-300/70 bg-amber-50/50 px-3 py-2 text-xs text-amber-800">
              Object responses need a schema so designers know available paths (e.g. data.user.id).
            </p>
          ) : (
            <SchemaFieldsEditor
              value={value.schema}
              disabled={disabled}
              onChange={(schema) => onChange({ ...value, schema })}
            />
          )}
        </div>
      ) : null}

      {value.dataType === 'array' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Array item schema (optional)</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() =>
                onChange({ ...value, itemSchema: [...(value.itemSchema ?? []), emptySchemaField()] })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add field
            </Button>
          </div>
          <SchemaFieldsEditor
            value={value.itemSchema ?? []}
            disabled={disabled}
            onChange={(itemSchema) => onChange({ ...value, itemSchema })}
          />
        </div>
      ) : null}

      <div>
        <Label>Sample JSON (optional)</Label>
        <Textarea
          value={value.sampleJson ?? ''}
          disabled={disabled}
          placeholder='{"data":{"id":1,"name":"Ada"}}'
          className="font-mono text-xs"
          onChange={(e) => onChange({ ...value, sampleJson: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Used when testing connections to verify the live response matches your schema.
        </p>
      </div>
    </div>
  )
}
