import { Plus, Trash2 } from 'lucide-react'
import {
  TEMPLATE_INPUT_TYPES,
  emptyTemplateInput,
  slugTemplateInputKey,
  type TemplateInput,
  type TemplateInputType,
} from '@/features/templates/templateModel'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'

const TYPE_LABEL: Record<TemplateInputType, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Yes / no',
  date: 'Date',
  file: 'File / signature',
}

export function TemplateInputsEditor({
  inputs,
  onChange,
  readOnly,
}: {
  inputs: TemplateInput[]
  onChange: (next: TemplateInput[]) => void
  readOnly?: boolean
}) {
  function patch(index: number, patch: Partial<TemplateInput>) {
    onChange(inputs.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>Inputs</Label>
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          Declare values this template needs. Use {'{{inputs.key}}'} in the copy. On a step, bind each input to a
          variable or type a literal.
        </p>
      </div>
      {inputs.map((input, index) => (
        <div
          key={`${input.key}-${index}`}
          className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-3 sm:grid-cols-[1fr_1fr_8rem_auto_auto]"
        >
          <div>
            <Label>Label</Label>
            <Input
              disabled={readOnly}
              value={input.label}
              onChange={(e) => {
                const label = e.target.value
                const key =
                  !input.key || input.key === slugTemplateInputKey(input.label, input.key)
                    ? slugTemplateInputKey(label, `input_${index + 1}`)
                    : input.key
                patch(index, { label, key })
              }}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label>Key</Label>
            <Input
              disabled={readOnly}
              value={input.key}
              onChange={(e) => patch(index, { key: slugTemplateInputKey(e.target.value, input.key || `input_${index + 1}`) })}
              placeholder="full_name"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              disabled={readOnly}
              value={input.type}
              onChange={(e) =>
                patch(index, {
                  type: TEMPLATE_INPUT_TYPES.includes(e.target.value as TemplateInputType)
                    ? (e.target.value as TemplateInputType)
                    : 'string',
                })
              }
            >
              {TEMPLATE_INPUT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-ink)]">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={input.required}
              onChange={(e) => patch(index, { required: e.target.checked })}
            />
            Required
          </label>
          <div className="flex items-end justify-end pb-0.5">
            <Button
              size="sm"
              variant="ghost"
              disabled={readOnly}
              onClick={() => onChange(inputs.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        disabled={readOnly}
        onClick={() => {
          const next = emptyTemplateInput()
          const n = inputs.length + 1
          next.key = `input_${n}`
          next.label = `Input ${n}`
          onChange([...inputs, next])
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        Add input
      </Button>
    </div>
  )
}
