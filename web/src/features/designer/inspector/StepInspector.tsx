import type { ConnectionWithConfig, FlowNodeType } from '@/shared/types/database'
import type { DesignerNode } from '@/features/designer/model/flowSchema'
import {
  CONDITION_OPERATOR_OPTIONS,
  conditionConfigSchema,
  getStepOutputVariable,
  extractTemplateRefs,
  httpConfigSchema,
  messageConfigSchema,
  OPERATION_OPTIONS,
  operationConfigSchema,
  loopConfigSchema,
  QUESTION_ANSWER_TYPE_OPTIONS,
  DEFAULT_GENDER_CHOICES,
  DEFAULT_LIKERT_CHOICES,
  DEFAULT_NUMBERED_CHOICES,
  DEFAULT_RANKING_ITEMS,
  DEFAULT_MATRIX_ROWS,
  COMMON_CURRENCY_CODES,
  FILE_ACCEPT_OPTIONS,
  DEFAULT_FORM_FIELDS,
  FORM_FIELD_TYPE_OPTIONS,
  slugFormFieldKey,
  type FormFieldDef,
  answerTypeUsesChoices,
  answerTypeUsesMultiSelect,
  answerTypeUsesLengthValidation,
  answerTypeUsesPattern,
  answerTypeUsesNumberBounds,
  answerTypeUsesDateBounds,
  earliestDatePickerMin,
  latestDatePickerMin,
  validateQuestionDateBounds,
  answerTypeUsesScaleLabels,
  answerTypeUsesImageChoices,
  describeQuestionResponse,
  describeOperationResponse,
  describeEntityResponse,
  normalizeEmailDomain,
  normalizeAllowedEmailDomains,
  readImageChoiceDrafts,
  readImageChoiceLayout,
  imageChoiceLabelFromFilename,
  type ImageChoiceOption,
  setVariableConfigSchema,
  variableTypes,
  ENTITY_OPERATIONS,
  entityConfigSchema,
  entityFiltersSchema,
  endConfigSchema,
  readDelaySeconds,
  readTimeoutSeconds,
  readRunAfter,
  isAnswerRequired,
  RUN_AFTER_OPTIONS,
  type RunAfterConfig,
  type RunAfterKey,
} from '@/features/designer/model/flowSchema'
import {
  parseTransferConfig,
  parseTransferEntrySettings,
  listTransferSourceOptions,
  listTransferTargetOptions,
  type TransferVariableMapping,
} from '@/features/designer/model/chatbotTransfer'
import { parsePublishedGraph } from '@/features/designer/utils/flowPublish'
import { connectionInfoFromRow } from '@/features/connections/connectionValidation'
import { EntityQueryBuilder } from '@/features/designer/inspector/EntityQueryBuilder'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import { confirmNodeDeletionMessage, planNodeDeletion } from '@/features/designer/utils/sequenceEdit'
import { fetchChatbotEntities } from '@/features/entities/entityApi'
import { isEntityPrimaryKey } from '@/features/entities/entityPrimaryKey'
import { coerceEntityValue } from '@/features/entities/entityValueValidation'
import { TemplateField, type TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import { useTemplateSuggestions } from '@/features/designer/inspector/templateSuggestions'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { FieldError } from '@/shared/ui/field-error'
import { Button } from '@/shared/ui/button'
import { DateTimePicker, dateTimeModeForAnswerType } from '@/shared/ui/date-time-picker'
import { cn } from '@/shared/lib/utils'
import { supabase } from '@/shared/lib/supabase'
import { StepMediaPicker } from '@/features/designer/inspector/StepMediaPicker'
import { FlowTemplatePicker, InsertTemplateControl } from '@/features/templates/FlowTemplatePicker'
import {
  TemplateInputBindings,
  ensureTemplateBinding,
} from '@/features/templates/TemplateInputBindings'
import { templateKindsForAnswerType } from '@/features/templates/templateKindCompatibility'
import { chatbotTemplatesQueryKey, fetchChatbotTemplates } from '@/features/templates/templateApi'
import {
  mediaKindOf,
  readMediaFiles,
} from '@/features/designer/model/chatbotMedia'
import {
  absoluteInstanceFileUrl,
  isFlowForgeApiConfigured,
  uploadDesignerMedia,
} from '@/shared/lib/flowforgeApi'
import { useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { buildQuestionAnswerTypePatch } from '@/features/designer/model/questionAnswerTypePatch'
import {
  applyAnswerTypeSuggestion,
  shouldAutoApplyAnswerType,
  suggestAnswerTypes,
} from '@/features/designer/model/flowSuggestions'

const MIN_CHOICE_SLOTS = 2

function padChoiceSlots(choices: string[], fallback?: readonly string[]): string[] {
  const base = (choices.length ? choices : fallback?.length ? fallback : []).map(String)
  const slots = base.length ? [...base] : []
  while (slots.length < MIN_CHOICE_SLOTS) slots.push('')
  return slots
}

function padImageChoiceSlots(options: ImageChoiceOption[]): ImageChoiceOption[] {
  const slots = options.map((o) => ({ label: o.label, filename: o.filename }))
  while (slots.length < MIN_CHOICE_SLOTS) slots.push({ label: '', filename: '' })
  return slots
}

function AllowedEmailDomainsEditor({
  domains,
  disabled,
  onChange,
}: {
  domains: string[]
  disabled?: boolean
  onChange: (next: string[]) => void
}) {
  const [slots, setSlots] = useState(() => (domains.length ? [...domains] : ['']))

  function commitSlots(next: string[]) {
    setSlots(next.length ? next : [''])
    onChange(normalizeAllowedEmailDomains(next))
  }

  return (
    <div className="space-y-2">
      <Label>Allowed domains</Label>
      {slots.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-medium text-[var(--color-ink-muted)]">
              @
            </span>
            <Input
              disabled={disabled}
              value={value}
              placeholder="company.com"
              className="pl-7"
              onChange={(e) => {
                const next = slots.map((s, i) => (i === index ? e.target.value : s))
                setSlots(next)
                onChange(normalizeAllowedEmailDomains(next))
              }}
              onBlur={() => {
                const next = slots.map((s) => normalizeEmailDomain(s))
                commitSlots(next.some(Boolean) ? next.filter(Boolean) : [''])
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || (slots.length === 1 && !normalizeEmailDomain(slots[0] ?? ''))}
            title="Remove"
            onClick={() => {
              const next = slots.filter((_, i) => i !== index)
              commitSlots(next)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => commitSlots([...slots, ''])}
      >
        <Plus className="h-3.5 w-3.5" />
        Add domain
      </Button>
      <p className="text-[11px] text-[var(--color-ink-muted)]">
        Leave empty to allow any email domain. Example: company.com
      </p>
    </div>
  )
}

function uniqueFormFields(fields: FormFieldDef[]): FormFieldDef[] {
  const seen = new Set<string>()
  return fields.map((field) => {
    let key = slugFormFieldKey(field.key || field.label)
    const base = key
    let n = 2
    while (seen.has(key)) key = `${base}_${n++}`
    seen.add(key)
    return {
      key,
      label: field.label,
      type: field.type,
      required: field.required !== false,
    }
  })
}

function FormFieldsEditor({
  fields,
  disabled,
  onChange,
}: {
  fields: FormFieldDef[]
  disabled?: boolean
  onChange: (next: FormFieldDef[]) => void
}) {
  const slots = fields.length ? fields : [...DEFAULT_FORM_FIELDS]

  function commit(next: FormFieldDef[]) {
    onChange(uniqueFormFields(next))
  }

  return (
    <div className="space-y-2">
      <Label>Form fields</Label>
      {slots.map((field, index) => (
        <div key={`${field.key}-${index}`} className="space-y-1.5 rounded-xl border border-[var(--color-border)] p-2">
          <div className="flex items-center gap-2">
            <Input
              disabled={disabled}
              value={field.label}
              placeholder="Label"
              onChange={(e) => {
                const label = e.target.value
                const next = slots.map((s, i) =>
                  i === index
                    ? {
                        ...s,
                        label,
                        key:
                          slugFormFieldKey(s.key) === slugFormFieldKey(s.label)
                            ? slugFormFieldKey(label)
                            : s.key,
                      }
                    : s,
                )
                commit(next)
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || slots.length <= 1}
              title="Remove"
              onClick={() => commit(slots.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select
              disabled={disabled}
              value={field.type}
              onChange={(e) => {
                const type = e.target.value as FormFieldDef['type']
                commit(slots.map((s, i) => (i === index ? { ...s, type } : s)))
              }}
            >
              {FORM_FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--color-ink-muted)]">
              <input
                type="checkbox"
                disabled={disabled}
                checked={field.required !== false}
                onChange={(e) =>
                  commit(slots.map((s, i) => (i === index ? { ...s, required: e.target.checked } : s)))
                }
              />
              Required
            </label>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() =>
          commit([
            ...slots,
            { key: 'field', label: 'Field', type: 'text', required: false },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Add field
      </Button>
      <p className="text-[11px] text-[var(--color-ink-muted)]">
        Stored as one object, e.g. {'{{vars.contact.name}}'}, {'{{vars.contact.email}}'}.
      </p>
    </div>
  )
}

function ImageChoiceEditor({
  options,
  media,
  disabled,
  instanceId,
  chatbotId,
  onChange,
}: {
  options: ImageChoiceOption[]
  media: Array<{ filename: string; url: string; mime: string }>
  disabled?: boolean
  instanceId: string
  chatbotId?: string
  onChange: (next: ImageChoiceOption[]) => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [slots, setSlots] = useState(() => padImageChoiceSlots(options))
  const slotsRef = useRef(slots)
  slotsRef.current = slots
  const images = media.filter((f) => mediaKindOf(f) === 'image')
  const canUpload = !!chatbotId && isFlowForgeApiConfigured() && !disabled

  function commit(next: ImageChoiceOption[]) {
    const padded = padImageChoiceSlots(next)
    setSlots(padded)
    onChange(padded)
  }

  const upload = useMutation({
    mutationFn: (file: File) => uploadDesignerMedia({ instanceId, chatbotId: chatbotId!, file }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['chatbot-media', instanceId, chatbotId] })
      const filename = String(result.filename ?? '').trim()
      if (!filename) return
      const label = imageChoiceLabelFromFilename(filename)
      const current = slotsRef.current
      const idx = current.findIndex((s) => !s.filename.trim())
      commit(
        idx >= 0
          ? current.map((s, i) =>
              i === idx ? { ...s, filename, label: s.label.trim() || label } : s,
            )
          : [...current, { label, filename }],
      )
    },
  })

  function update(index: number, patch: Partial<ImageChoiceOption>) {
    commit(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function pickImage(index: number, filename: string) {
    const current = slots[index]
    const patch: Partial<ImageChoiceOption> = { filename }
    if (filename && !current?.label.trim()) {
      patch.label = imageChoiceLabelFromFilename(filename)
    }
    update(index, patch)
  }

  return (
    <div className="space-y-2">
      <Label>Image options</Label>
      <p className="text-[11px] text-[var(--color-ink-muted)]">
        Each option is a picture plus a label. The answer is the selected image object
        {' '}({'{ label, filename, url, key }'}).
      </p>
      {slots.map((opt, index) => {
        const file = images.find((f) => f.filename === opt.filename)
        return (
          <div key={index} className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white p-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100">
              {file?.url ? (
                <img src={absoluteInstanceFileUrl(file.url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[9px] text-slate-400">No img</span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Input
                disabled={disabled}
                value={opt.label}
                placeholder="Label"
                onChange={(e) => update(index, { label: e.target.value })}
              />
              <Select
                disabled={disabled}
                value={opt.filename}
                onChange={(e) => pickImage(index, e.target.value)}
              >
                <option value="">Choose image…</option>
                {opt.filename && !images.some((f) => f.filename === opt.filename) ? (
                  <option value={opt.filename}>{opt.filename}</option>
                ) : null}
                {images.map((f) => (
                  <option key={f.filename} value={f.filename}>
                    {f.filename}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || slots.length <= MIN_CHOICE_SLOTS}
              title={slots.length <= MIN_CHOICE_SLOTS ? 'At least 2 options required' : 'Remove'}
              onClick={() => {
                if (slots.length <= MIN_CHOICE_SLOTS) return
                commit(slots.filter((_, i) => i !== index))
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => commit([...slots, { label: '', filename: '' }])}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </Button>
        {canUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) upload.mutate(file)
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Upload image
            </Button>
          </>
        ) : null}
      </div>
      {!images.length ? (
        <p className="text-[11px] text-amber-700">
          Upload an image here or in the Media library, then pick it for each option.
        </p>
      ) : null}
    </div>
  )
}

function ChoicesSourceEditor({
  choices,
  choicesFrom,
  fallback,
  disabled,
  suggestions,
  onChoicesChange,
  onChoicesFromChange,
}: {
  choices: string[]
  choicesFrom: string
  fallback?: readonly string[]
  disabled?: boolean
  suggestions: TemplateSuggestion[]
  onChoicesChange: (next: string[]) => void
  onChoicesFromChange: (next: string) => void
}) {
  const [mode, setMode] = useState<'list' | 'array'>(() =>
    choicesFrom.trim() ? 'array' : 'list',
  )
  const [slots, setSlots] = useState(() => padChoiceSlots(choices, fallback))

  function setModeAndPersist(next: 'list' | 'array') {
    setMode(next)
    if (next === 'list') {
      onChoicesFromChange('')
      const seeded = padChoiceSlots(choices, fallback)
      setSlots(seeded)
      onChoicesChange(seeded.map((s) => s.trim()).filter(Boolean))
    }
  }

  function commitSlots(next: string[]) {
    setSlots(next)
    onChoicesChange(next.map((s) => s.trim()).filter(Boolean))
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Choice source</Label>
        <Select
          disabled={disabled}
          value={mode}
          onChange={(e) => setModeAndPersist(e.target.value as 'list' | 'array')}
        >
          <option value="list">Option list</option>
          <option value="array">Array / variable</option>
        </Select>
      </div>

      {mode === 'list' ? (
        <div className="space-y-2">
          <Label>Choices</Label>
          {slots.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                disabled={disabled}
                value={value}
                placeholder={`Option ${index + 1}`}
                onChange={(e) => {
                  const next = slots.map((s, i) => (i === index ? e.target.value : s))
                  commitSlots(next)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || slots.length <= MIN_CHOICE_SLOTS}
                title={slots.length <= MIN_CHOICE_SLOTS ? 'At least 2 options required' : 'Remove'}
                onClick={() => {
                  if (slots.length <= MIN_CHOICE_SLOTS) return
                  commitSlots(slots.filter((_, i) => i !== index))
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => commitSlots([...slots, ''])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add choice
          </Button>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Start with two options. Add more as needed — commas are allowed in labels.
          </p>
        </div>
      ) : (
        <div>
          <Label>Array or variable</Label>
          <TemplateField
            disabled={disabled}
            value={choicesFrom}
            onChange={onChoicesFromChange}
            suggestions={suggestions}
            placeholder='{{vars.options}} or ["Yes, please", "No"]'
          />
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Resolves at runtime to a string array (variable, expression, or JSON array literal).
          </p>
        </div>
      )}
    </div>
  )
}

function StepRunSettings({
  config,
  nodeType,
  readOnly,
  isFlowStart,
  patchConfig,
}: {
  config: Record<string, unknown>
  nodeType: FlowNodeType
  readOnly?: boolean
  isFlowStart: boolean
  patchConfig: (partial: Record<string, unknown>) => void
}) {
  const runAfter = readRunAfter(config)
  const delaySeconds = readDelaySeconds(config)
  const timeoutSeconds = readTimeoutSeconds(config)
  const answerRequired = isAnswerRequired(config)
  const timeoutApplies =
    nodeType === 'http' ||
    nodeType === 'email' ||
    (nodeType === 'question' && !answerRequired)
  const timeoutDisabled = readOnly || !timeoutApplies || (nodeType === 'question' && answerRequired)
  const nonDefault =
    delaySeconds > 0 ||
    timeoutSeconds > 0 ||
    (!isFlowStart &&
      (runAfter.failed || runAfter.skipped || runAfter.timedOut || runAfter.succeeded === false))
  const runAfterDisabled = readOnly || isFlowStart

  function toggleRunAfter(key: RunAfterKey) {
    if (isFlowStart) return
    const next: RunAfterConfig = { ...runAfter, [key]: !runAfter[key] }
    // Keep at least one outcome selected
    if (!Object.values(next).some(Boolean)) return
    patchConfig({ runAfter: next })
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Settings</h3>
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          Delay{isFlowStart ? '' : ', run after,'} and timeout for this step.
          {nonDefault ? (
            <span className="ml-1 font-medium text-teal-800">Customized</span>
          ) : null}
        </p>
      </div>

      <div>
        <Label htmlFor="step-delay">Delay before run (seconds)</Label>
        <Input
          id="step-delay"
          type="number"
          min={0}
          step={1}
          disabled={readOnly}
          value={Number.isFinite(delaySeconds) ? delaySeconds : 0}
          onChange={(e) => {
            const n = Number(e.target.value)
            patchConfig({ delaySeconds: !Number.isFinite(n) || n < 0 ? 0 : n })
          }}
        />
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Wait this long before the step executes. Default is 0.
        </p>
      </div>

      <div className={!timeoutApplies || (nodeType === 'question' && answerRequired) ? 'opacity-60' : undefined}>
        <Label htmlFor="step-timeout">Timeout (seconds)</Label>
        <Input
          id="step-timeout"
          type="number"
          min={0}
          step={1}
          disabled={timeoutDisabled}
          value={Number.isFinite(timeoutSeconds) ? timeoutSeconds : 0}
          onChange={(e) => {
            const n = Number(e.target.value)
            patchConfig({ timeoutSeconds: !Number.isFinite(n) || n < 0 ? 0 : n })
          }}
        />
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          {nodeType === 'http' || nodeType === 'email'
            ? 'Abort the request if it takes longer. On timeout, status is Timed out (default 0 = none).'
            : nodeType === 'question' && answerRequired
              ? 'Available when the answer is Optional — times out while waiting for a reply.'
              : nodeType === 'question'
                ? 'While waiting for an optional answer. On timeout, status is Timed out (0 = none).'
                : 'Only applies to HTTP, email, and optional questions.'}
        </p>
      </div>

      <div className={isFlowStart ? 'opacity-60' : undefined}>
        <Label>Configure run after</Label>
        <p className="mb-2 text-[11px] text-[var(--color-ink-muted)]">
          {isFlowStart
            ? 'Not available on the first step — there is no preceding step.'
            : 'Run this step only if the previous step:'}
        </p>
        <ul className="space-y-1.5">
          {RUN_AFTER_OPTIONS.map((opt) => (
            <li key={opt.key}>
              <label
                className={cn(
                  'flex items-start gap-2 rounded-lg px-1.5 py-1',
                  runAfterDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/80',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-500/30 disabled:cursor-not-allowed"
                  disabled={runAfterDisabled}
                  checked={isFlowStart ? opt.key === 'succeeded' : runAfter[opt.key]}
                  onChange={() => toggleRunAfter(opt.key)}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-slate-800">{opt.label}</span>
                  <span className="block text-[10px] text-slate-500">{opt.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {!isFlowStart ? (
          <p className="mt-2 text-[10px] leading-snug text-slate-500">
            If the previous status isn’t checked, this step is skipped and the flow continues (so a later
            step can run after “is skipped” or “has timed out”).
          </p>
        ) : null}
      </div>
    </div>
  )
}

interface StepInspectorProps {
  node: DesignerNode
  connections: ConnectionWithConfig[]
  /** False while the chatbot connection list is still loading — do not clear selected IDs. */
  connectionsReady?: boolean
  readOnly?: boolean
  /** Soft lock held by another collaborator (first click wins) */
  lockedBy?: { name: string; color: string; waitingHint?: string } | null
}

function TransferStepFields({
  node,
  chatbotId,
  instanceId,
  readOnly,
  suggestions,
  patchConfig,
}: {
  node: DesignerNode
  chatbotId?: string
  instanceId: string
  readOnly: boolean
  suggestions: TemplateSuggestion[]
  patchConfig: (partial: Record<string, unknown>) => void
}) {
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const globals = useDesignerStore((s) => s.globalVariables)
  const cfg = parseTransferConfig(node.config)
  const siblings = useQuery({
    queryKey: ['instance-chatbots-transfer', instanceId, chatbotId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbots')
        .select('id, name, settings, public_enabled, instance_id')
        .eq('instance_id', instanceId)
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      // Same organisation only; soft-deleted bots are excluded above.
      return (data ?? []).filter((b) => b.id !== chatbotId && b.instance_id === instanceId)
    },
  })

  const targetMeta = useQuery({
    queryKey: ['transfer-target-meta', instanceId, cfg.targetChatbotId],
    enabled: !!cfg.targetChatbotId && !!instanceId,
    queryFn: async () => {
      const { data: bot, error: botErr } = await supabase
        .from('chatbots')
        .select('id, name, settings, instance_id, deleted_at')
        .eq('id', cfg.targetChatbotId)
        .eq('instance_id', instanceId)
        .is('deleted_at', null)
        .maybeSingle()
      if (botErr) throw botErr
      if (!bot) {
        throw new Error('Target chatbot is not active in this organisation')
      }
      const { data: flow, error: flowErr } = await supabase
        .from('chatbot_flows')
        .select('published_graph, id')
        .eq('chatbot_id', cfg.targetChatbotId)
        .maybeSingle()
      if (flowErr) throw flowErr

      type StepRow = {
        key: string
        label: string
        type: string
        config?: Record<string, unknown>
      }
      let steps: StepRow[] = []
      if (flow?.published_graph) {
        try {
          const graph = parsePublishedGraph(flow.published_graph)
          steps = graph.nodes.map((n) => ({
            key: n.key,
            label: n.label || n.key,
            type: n.type,
            config: n.config,
          }))
        } catch {
          steps = []
        }
      }
      if (!steps.length && flow?.id) {
        const { data: draftNodes } = await supabase
          .from('flow_nodes')
          .select('key, label, type, config')
          .eq('flow_id', flow.id)
          .order('position_y')
        steps = (draftNodes ?? []).map((n) => ({
          key: n.key,
          label: n.label || n.key,
          type: n.type,
          config: (n.config ?? {}) as Record<string, unknown>,
        }))
      }

      const { data: targetGlobals } = await supabase
        .from('chatbot_variables')
        .select('key')
        .eq('chatbot_id', cfg.targetChatbotId)
        .eq('scope', 'global')
        .order('key')

      return {
        required: parseTransferEntrySettings(bot.settings).requiredVariables,
        steps,
        globalKeys: (targetGlobals ?? []).map((g) => g.key),
        published: !!flow?.published_graph,
      }
    },
  })

  function setMappings(next: TransferVariableMapping[]) {
    patchConfig({ variableMappings: next })
  }

  const mappings = cfg.variableMappings
  const required = targetMeta.data?.required ?? []
  const sourceOptions = useMemo(() => {
    const opts = listTransferSourceOptions({
      nodes,
      edges,
      globals,
      transferNodeId: node.id,
    })
    // Keep a previously saved source visible even if the upstream graph changed.
    const seen = new Set(opts.map((o) => o.value))
    for (const row of mappings) {
      const value = row.source.trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      opts.push({ value, label: value, detail: 'saved' })
    }
    return opts
  }, [nodes, edges, globals, node.id, mappings])

  const targetOptions = useMemo(() => {
    const opts = listTransferTargetOptions({
      globals: targetMeta.data?.globalKeys ?? [],
      nodes: targetMeta.data?.steps ?? [],
    })
    const seen = new Set(opts.map((o) => o.value))
    for (const row of mappings) {
      const t = row.target.trim()
      if (t && !seen.has(t)) {
        seen.add(t)
        opts.push({ value: t, label: t, detail: 'saved' })
      }
    }
    for (const k of required) {
      if (k && !seen.has(k)) {
        seen.add(k)
        opts.push({ value: k, label: k, detail: 'required' })
      }
    }
    return opts
  }, [targetMeta.data?.globalKeys, targetMeta.data?.steps, mappings, required])

  const targetStillValid =
    !cfg.targetChatbotId ||
    siblings.isLoading ||
    (siblings.data ?? []).some((b) => b.id === cfg.targetChatbotId)

  return (
    <div className="space-y-3">
      <div>
        <Label>Target chatbot</Label>
        <Select
          disabled={readOnly || siblings.isLoading}
          value={cfg.targetChatbotId}
          onChange={(e) =>
            patchConfig({
              targetChatbotId: e.target.value,
              startNodeKey: '',
            })
          }
        >
          <option value="">Select chatbot…</option>
          {(siblings.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {cfg.targetChatbotId && !targetStillValid ? (
          <p className="mt-1 text-[11px] text-amber-800">
            Selected target is missing or inactive in this organisation — pick another chatbot.
          </p>
        ) : null}
        {cfg.targetChatbotId && targetMeta.data && !targetMeta.data.published ? (
          <p className="mt-1 text-[11px] text-amber-800">
            Target is not published yet — preview can use the draft; public chat needs a publish.
          </p>
        ) : null}
        {targetMeta.isError ? (
          <p className="mt-1 text-[11px] text-red-700">
            {targetMeta.error instanceof Error
              ? targetMeta.error.message
              : 'Could not load target chatbot'}
          </p>
        ) : null}
      </div>

      <div>
        <Label>Start at step</Label>
        <Select
          disabled={readOnly || !cfg.targetChatbotId || targetMeta.isLoading || !targetStillValid}
          value={cfg.startNodeKey}
          onChange={(e) => patchConfig({ startNodeKey: e.target.value })}
        >
          <option value="">Entry / first step</option>
          {(targetMeta.data?.steps ?? []).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({s.key})
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Message before transfer (optional)</Label>
        <TemplateField
          disabled={readOnly}
          multiline
          value={cfg.message}
          onChange={(v) => patchConfig({ message: v })}
          suggestions={suggestions}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={cfg.passAllVariables}
          onChange={(e) => patchConfig({ passAllVariables: e.target.checked })}
        />
        Pass all current variables to the target
      </label>
      <p className="text-[11px] text-[var(--color-ink-muted)]">
        Without this (or mappings below), the target entry step starts with a clean variable bag —
        only the target’s own globals plus explicitly mapped inputs. Prior step outputs are never
        carried over.
      </p>

      {required.length ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
          <p className="font-medium">Required on transfer entry</p>
          <p className="mt-1 text-amber-900/90">
            This chatbot requires: {required.map((k) => `{{vars.${k}}}`).join(', ')}
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label className="mb-0">Variable mappings</Label>
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setMappings([...mappings, { source: '', target: '' }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          ) : null}
        </div>
        <p className="mb-2 text-[11px] text-[var(--color-ink-muted)]">
          Map source values already set before this step onto the target’s globals or step output
          variables. Message steps are not listed as sources.
        </p>
        <div className="space-y-2">
          {mappings.map((row, idx) => (
            <div key={`map-${idx}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <Select
                disabled={readOnly || !sourceOptions.length}
                value={row.source}
                onChange={(e) => {
                  const next = mappings.map((m, i) => (i === idx ? { ...m, source: e.target.value } : m))
                  setMappings(next)
                }}
              >
                <option value="">Source…</option>
                {sourceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.detail ? `${o.label} (${o.detail})` : o.label}
                  </option>
                ))}
              </Select>
              <Select
                disabled={readOnly || !cfg.targetChatbotId || !targetStillValid}
                value={row.target}
                onChange={(e) => {
                  const next = mappings.map((m, i) => (i === idx ? { ...m, target: e.target.value } : m))
                  setMappings(next)
                }}
              >
                <option value="">
                  {!cfg.targetChatbotId
                    ? 'Select target chatbot first…'
                    : targetOptions.length
                      ? 'Target…'
                      : 'No target variables…'}
                </option>
                {targetOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {required.includes(o.value)
                      ? `${o.label} *`
                      : o.detail
                        ? `${o.label} (${o.detail})`
                        : o.label}
                  </option>
                ))}
              </Select>
              {!readOnly ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setMappings(mappings.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ))}
          {!mappings.length ? (
            <p className="text-xs text-[var(--color-ink-muted)]">No mappings yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function paramValuesOf(config: Record<string, unknown>): Record<string, string> {
  const raw = config.paramValues
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = String(v ?? '')
  }
  return out
}

function ConnectionParamFields({
  params,
  values,
  readOnly,
  onChange,
  suggestions,
}: {
  params: Array<{
    key: string
    label: string
    required: boolean
    location?: string
    description?: string
    defaultValue?: string
    type: string
  }>
  values: Record<string, string>
  readOnly?: boolean
  onChange: (next: Record<string, string>) => void
  suggestions: TemplateSuggestion[]
}) {
  if (!params.length) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
        This connection has no input parameters.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Connection inputs</h3>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Values from the connection definition — templates like {'{{vars.x}}'} are allowed.
        </p>
      </div>
      {params.map((param) => {
        const key = param.key.trim()
        if (!key) return null
        const multiline =
          param.type === 'textarea' || key === 'body' || (param.location === 'body' && param.type !== 'number')
        return (
          <div key={key}>
            <Label>
              {param.label || key}
              {param.required ? ' *' : ''}
              {param.location ? (
                <span className="ml-1 font-normal text-[var(--color-ink-muted)]">({param.location})</span>
              ) : null}
            </Label>
            <TemplateField
              disabled={readOnly}
              value={values[key] ?? ''}
              placeholder={param.defaultValue || param.description || key}
              suggestions={suggestions}
              multiline={multiline}
              onChange={(v) => onChange({ ...values, [key]: v })}
            />
            {param.description ? (
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{param.description}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ExpectedResponseHints({
  stepKey,
  outputVariable,
  paths,
  dataType,
}: {
  stepKey: string
  outputVariable?: string
  paths: Array<{ path: string; type: string }>
  dataType: string
}) {
  return (
    <ResponseTypeCard
      dataType={dataType}
      title={`Expected response (${dataType})`}
      stepKey={stepKey}
      outputVariable={outputVariable}
      fields={paths}
    />
  )
}

function QuestionResponseTypeCard({ node }: { node: DesignerNode }) {
  const info = describeQuestionResponse(node.config)
  return (
    <ResponseTypeCard
      dataType={info.dataType}
      example={info.example}
      stepKey={node.key}
      outputVariable={String(node.config.outputVariable ?? '')}
      fields={info.fields}
    />
  )
}

function ResponseTypeCard({
  dataType,
  title,
  example,
  stepKey,
  outputVariable,
  fields,
}: {
  dataType: string
  title?: string
  example?: string
  stepKey: string
  outputVariable?: string
  fields: Array<{ path: string; type: string }>
}) {
  const varKey = outputVariable?.trim()
  return (
    <div className="rounded-xl border border-teal-200/50 bg-teal-50/40 px-3 py-2">
      <p className="text-xs font-medium text-teal-900">
        {title ?? (
          <>
            Returns <code className="font-mono">{dataType}</code>
          </>
        )}
        {example ? <span className="ml-1 font-normal text-teal-800/80">· {example}</span> : null}
      </p>
      {fields.length ? (
        <ul className="mt-1 space-y-0.5 text-[11px] text-teal-800/90">
          {fields.slice(0, 12).map((p) => (
            <li key={p.path}>
              <code>{`{{steps.${stepKey}.${p.path}}}`}</code>
              <span className="text-teal-700/70"> · {p.type}</span>
            </li>
          ))}
          {varKey ? (
            <li className="pt-1 text-teal-700/80">
              Also {'{{vars.'}
              {varKey}
              {'}}'}
              {fields.some((f) => f.path.includes('.')) ? (
                <>
                  {' '}
                  and {'{{vars.'}
                  {varKey}
                  {'.…}}'}
                </>
              ) : null}{' '}
              after this step assigns the output variable.
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-teal-800/80">No schema fields — add them on the connection.</p>
      )}
    </div>
  )
}

function HttpStepFields({
  node,
  connections,
  readOnly,
  patchConfig,
  suggestions,
}: {
  node: DesignerNode
  connections: ConnectionWithConfig[]
  readOnly?: boolean
  patchConfig: (partial: Record<string, unknown>) => void
  suggestions: TemplateSuggestion[]
}) {
  const selected = connections.find((c) => c.id === node.config.connectionId && c.kind === 'http')
  const info = selected ? connectionInfoFromRow(selected) : null
  const paramValues = paramValuesOf(node.config)
  const selectedId = String(node.config.connectionId ?? '')
  const httpRows = connections.filter((c) => c.kind === 'http')

  function selectConnection(connectionId: string) {
    const row = connections.find((c) => c.id === connectionId && c.kind === 'http')
    if (!row) {
      patchConfig({ connectionId })
      return
    }
    const next = connectionInfoFromRow(row)
    const seeded: Record<string, string> = { ...paramValues }
    for (const p of next.inputParams) {
      if (!p.key.trim()) continue
      const key = p.key.trim()
      if (!seeded[key] && p.defaultValue) seeded[key] = p.defaultValue
    }
    patchConfig({
      connectionId,
      method: node.config.method || next.defaultMethod || 'GET',
      path: String(node.config.path || next.defaultPath || ''),
      paramValues: seeded,
    })
  }

  return (
    <>
      <div>
        <Label>Connection</Label>
        <Select
          disabled={readOnly}
          value={selectedId}
          onChange={(e) => selectConnection(e.target.value)}
        >
          <option value="">Select…</option>
          {selectedId && !httpRows.some((c) => c.id === selectedId) ? (
            <option value={selectedId}>Selected connection (loading…)</option>
          ) : null}
          {httpRows.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Method</Label>
        <Select
          disabled={readOnly}
          value={String(node.config.method ?? info?.defaultMethod ?? 'GET')}
          onChange={(e) => patchConfig(httpConfigSchema.parse({ ...node.config, method: e.target.value }))}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Path override</Label>
        <TemplateField
          disabled={readOnly}
          value={String(node.config.path ?? '')}
          onChange={(v) => patchConfig({ path: v })}
          placeholder={info?.defaultPath || '/users/{userId}'}
          suggestions={suggestions}
        />
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Leave blank to use the connection default. Path params use {'{key}'}, :key, or sample values below.
        </p>
      </div>

      {info ? (
        <ConnectionParamFields
          params={info.inputParams}
          values={paramValues}
          readOnly={readOnly}
          suggestions={suggestions}
          onChange={(next) => patchConfig({ paramValues: next })}
        />
      ) : null}

      <div>
        <Label>Body override (optional)</Label>
        <TemplateField
          disabled={readOnly}
          multiline
          value={String(node.config.body ?? '')}
          onChange={(v) => patchConfig({ body: v })}
          placeholder="JSON body — overrides body params when set"
          suggestions={suggestions}
        />
      </div>

      {info ? (
        <ExpectedResponseHints
          stepKey={node.key}
          outputVariable={String(node.config.outputVariable ?? '')}
          paths={info.responsePaths}
          dataType={info.expectedResponse.dataType}
        />
      ) : null}

      <VariableAssignField
        label="Output variable"
        value={String(node.config.outputVariable ?? '')}
        onChange={(v) => patchConfig({ outputVariable: v })}
        nodeId={node.id}
        readOnly={readOnly}
        placeholder="apiResponse"
        valueType={info?.expectedResponse.dataType}
      />
    </>
  )
}

function EmailStepFields({
  node,
  connections,
  readOnly,
  patchConfig,
  suggestions,
}: {
  node: DesignerNode
  connections: ConnectionWithConfig[]
  readOnly?: boolean
  patchConfig: (partial: Record<string, unknown>) => void
  suggestions: TemplateSuggestion[]
}) {
  const selected = connections.find((c) => c.id === node.config.connectionId && c.kind === 'email')
  const info = selected ? connectionInfoFromRow(selected) : null
  const paramValues = paramValuesOf(node.config)
  const selectedId = String(node.config.connectionId ?? '')
  const emailRows = connections.filter((c) => c.kind === 'email')

  function syncLegacy(nextParams: Record<string, string>) {
    patchConfig({
      paramValues: nextParams,
      to: nextParams.to ?? node.config.to ?? '',
      subject: nextParams.subject ?? node.config.subject ?? '',
      body: nextParams.body ?? node.config.body ?? '',
    })
  }

  function selectConnection(connectionId: string) {
    const row = connections.find((c) => c.id === connectionId && c.kind === 'email')
    if (!row) {
      patchConfig({ connectionId })
      return
    }
    const next = connectionInfoFromRow(row)
    const seeded: Record<string, string> = { ...paramValues }
    for (const p of next.inputParams) {
      if (!p.key.trim()) continue
      const key = p.key.trim()
      if (!seeded[key]) {
        if (key === 'to' && node.config.to) seeded[key] = String(node.config.to)
        else if (key === 'subject' && node.config.subject) seeded[key] = String(node.config.subject)
        else if (key === 'body' && node.config.body) seeded[key] = String(node.config.body)
        else if (p.defaultValue) seeded[key] = p.defaultValue
      }
    }
    patchConfig({
      connectionId,
      paramValues: seeded,
      to: seeded.to ?? '',
      subject: seeded.subject ?? '',
      body: seeded.body ?? '',
    })
  }

  const hasCustomParams = (info?.inputParams.length ?? 0) > 0
  const { chatbotId } = useParams()

  return (
    <>
      <div>
        <Label>Connection</Label>
        <Select
          disabled={readOnly}
          value={selectedId}
          onChange={(e) => selectConnection(e.target.value)}
        >
          <option value="">Select…</option>
          {selectedId && !emailRows.some((c) => c.id === selectedId) ? (
            <option value={selectedId}>Selected connection (loading…)</option>
          ) : null}
          {emailRows.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <FlowTemplatePicker
        chatbotId={chatbotId}
        kinds={['email', 'receipt']}
        readOnly={readOnly}
        valueKey={String(node.config.templateKey ?? '')}
        label="Email template"
        hint="Fills subject and body from an HTML email or a receipt. You can still edit the fields after."
        onSelectKey={(key, snippet) => {
          if (!key) {
            patchConfig({ templateKey: '' })
            return
          }
          const html = snippet.includes('.html')
          const subject = html ? `{{templates.${key}.subject}}` : `{{templates.${key}.title}}`
          const body = html ? `{{templates.${key}.html}}` : `{{templates.${key}.text}}`
          patchConfig({
            templateKey: key,
            subject,
            body,
            paramValues: { ...paramValues, subject, body },
            templateBindings: ensureTemplateBinding(node.config.templateBindings, key),
          })
        }}
      />

      {hasCustomParams && info ? (
        <ConnectionParamFields
          params={info.inputParams}
          values={paramValues}
          readOnly={readOnly}
          suggestions={suggestions}
          onChange={syncLegacy}
        />
      ) : (
        <>
          <div>
            <Label>To</Label>
            <TemplateField
              disabled={readOnly}
              value={String(node.config.to ?? '')}
              suggestions={suggestions}
              onChange={(v) => patchConfig({ to: v, paramValues: { ...paramValues, to: v } })}
            />
          </div>
          <div>
            <Label>Subject</Label>
            <TemplateField
              disabled={readOnly}
              value={String(node.config.subject ?? '')}
              suggestions={suggestions}
              onChange={(v) =>
                patchConfig({
                  subject: v,
                  paramValues: { ...paramValues, subject: v },
                })
              }
            />
          </div>
          <div>
            <Label>Body</Label>
            <TemplateField
              disabled={readOnly}
              multiline
              value={String(node.config.body ?? '')}
              suggestions={suggestions}
              onChange={(v) => patchConfig({ body: v, paramValues: { ...paramValues, body: v } })}
            />
          </div>
        </>
      )}

      {info ? (
        <ExpectedResponseHints
          stepKey={node.key}
          outputVariable={String(node.config.outputVariable ?? '')}
          paths={info.responsePaths}
          dataType={info.expectedResponse.dataType}
        />
      ) : null}
    </>
  )
}

function VariableAssignField({
  label,
  value,
  onChange,
  nodeId,
  readOnly,
  placeholder,
  valueType,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  nodeId: string
  readOnly?: boolean
  placeholder?: string
  valueType?: string
}) {
  const nodes = useDesignerStore((s) => s.nodes)
  const globals = useDesignerStore((s) => s.globalVariables)
  const trimmed = value.trim()
  const prior = trimmed
    ? nodes.filter((n) => n.id !== nodeId && getStepOutputVariable(n) === trimmed).map((n) => n.key)
    : []
  const hitsGlobal = trimmed !== '' && globals.includes(trimmed)

  return (
    <div>
      <Label>{label}</Label>
      <Input
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
        Stored as {'{{vars.'}
        {trimmed || 'name'}
        {'}}'}
        {valueType ? (
          <>
            {' '}
            (<code className="font-mono">{valueType}</code>)
          </>
        ) : null}
        . Reusing an existing key overwrites it at runtime.
      </p>
      {hitsGlobal || prior.length ? (
        <p className="mt-1 text-[11px] text-[var(--color-warning)]">
          {hitsGlobal
            ? `Will replace global variable "${trimmed}".`
            : `Will replace value previously set by: ${prior.join(', ')}.`}
        </p>
      ) : null}
    </div>
  )
}

export function StepInspector({
  node,
  connections,
  connectionsReady = true,
  readOnly: readOnlyProp,
  lockedBy,
}: StepInspectorProps) {
  const { chatbotId } = useParams()
  const { instance } = useRequiredInstance()
  const updateNode = useDesignerStore((s) => s.updateNode)
  const removeNode = useDesignerStore((s) => s.removeNode)
  const canDeleteSelected = useDesignerStore((s) => s.canDeleteNode)
  const copyNode = useDesignerStore((s) => s.copyNode)
  const pasteAfter = useDesignerStore((s) => s.pasteAfter)
  const duplicateNode = useDesignerStore((s) => s.duplicateNode)
  const clipboard = useDesignerStore((s) => s.clipboard)
  const moveNode = useDesignerStore((s) => s.moveNode)
  const canMoveNode = useDesignerStore((s) => s.canMoveNode)
  const issues = useDesignerStore((s) => s.issues).filter((i) => i.nodeId === node.id)
  const globals = useDesignerStore((s) => s.globalVariables)
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const readOnly = !!readOnlyProp || !!lockedBy
  const media = useChatbotMedia(instance.id, chatbotId)
  const templatesQuery = useQuery({
    queryKey: chatbotId ? chatbotTemplatesQueryKey(chatbotId) : ['chatbot-templates', 'none'],
    enabled: !!chatbotId,
    queryFn: () => fetchChatbotTemplates(chatbotId!),
  })
  const answerType = String(node.config.answerType ?? 'text')
  const questionTemplateKinds = node.type === 'question' ? templateKindsForAnswerType(answerType) : undefined
  const suggestions = useTemplateSuggestions(
    nodes,
    globals,
    connections,
    node.id,
    media.data,
    templatesQuery.data,
    questionTemplateKinds,
  )
  const moves = canMoveNode(node.id)
  const allowDelete = canDeleteSelected(node.id)
  // No incoming edges → flow start (nothing to run after)
  const isFlowStart = !edges.some((e) => e.target === node.id)

  /** Only connections already installed on this chatbot (Designer loads via listChatbotConnections). */
  const installedEmailConnections = useMemo(
    () => connections.filter((c) => c.kind === 'email'),
    [connections],
  )
  const installedPaymentConnections = useMemo(
    () => connections.filter((c) => c.kind === 'payment'),
    [connections],
  )

  useEffect(() => {
    if (!connectionsReady) return
    if (String(node.config.answerType) !== 'otp') return
    const selectedId = String(node.config.otpConnectionId ?? '').trim()
    if (!selectedId) return
    if (installedEmailConnections.some((c) => c.id === selectedId)) return
    const current = useDesignerStore.getState().nodes.find((n) => n.id === node.id)
    if (!current) return
    updateNode(node.id, {
      config: { ...current.config, otpConnectionId: null },
    })
  }, [
    connectionsReady,
    installedEmailConnections,
    node.config.answerType,
    node.config.otpConnectionId,
    node.id,
    updateNode,
  ])

  useEffect(() => {
    if (!connectionsReady) return
    if (String(node.config.answerType) !== 'payment') return
    const selectedId = String(node.config.paymentConnectionId ?? '').trim()
    if (!selectedId) return
    if (installedPaymentConnections.some((c) => c.id === selectedId)) return
    const current = useDesignerStore.getState().nodes.find((n) => n.id === node.id)
    if (!current) return
    updateNode(node.id, {
      config: { ...current.config, paymentConnectionId: null },
    })
  }, [
    connectionsReady,
    installedPaymentConnections,
    node.config.answerType,
    node.config.paymentConnectionId,
    node.id,
    updateNode,
  ])

  function onDeleteStep() {
    const plan = planNodeDeletion(node.id, nodes, edges)
    if (!plan) return
    if (!window.confirm(confirmNodeDeletionMessage(plan))) return
    removeNode(node.id)
  }

  function patchConfig(partial: Record<string, unknown>) {
    updateNode(node.id, { config: { ...node.config, ...partial } })
  }

  const operation = String(node.config.operation ?? 'concat')
  const operationMeta = OPERATION_OPTIONS.find((o) => o.value === operation) ?? OPERATION_OPTIONS[0]
  const operationResult = describeOperationResponse(operation)
  const needsRight = operationMeta.needsRight
  const needsReplaceWith = 'needsReplaceWith' in operationMeta && operationMeta.needsReplaceWith

  const entitiesQuery = useQuery({
    queryKey: ['chatbot-entities', chatbotId],
    enabled: !!chatbotId && node.type === 'entity',
    queryFn: () => fetchChatbotEntities(chatbotId!),
  })
  const entityOp = String(node.config.operation ?? 'list')
  const entityOpMeta = ENTITY_OPERATIONS.find((o) => o.value === entityOp) ?? ENTITY_OPERATIONS[0]
  const entityResult = describeEntityResponse(entityOp)
  const questionResponse = node.type === 'question' ? describeQuestionResponse(node.config) : null
  const dateAnswerType = String(node.config.answerType ?? '')
  const dateBoundMode = dateTimeModeForAnswerType(dateAnswerType) ?? 'date'
  const now = new Date()
  const earliestValue = String(node.config.minDate ?? '')
  const latestValue = String(node.config.maxDate ?? '')
  const dateBoundIssues = node.type === 'question' ? validateQuestionDateBounds(node.config, now) : []
  const earliestIssue = dateBoundIssues.find((i) => i.field === 'minDate')
  const latestIssue = dateBoundIssues.find((i) => i.field === 'maxDate')
  const selectedEntity = entitiesQuery.data?.find((e) => e.id === String(node.config.entityId ?? ''))
  const fieldMap =
    node.config.fieldMap && typeof node.config.fieldMap === 'object' && !Array.isArray(node.config.fieldMap)
      ? (node.config.fieldMap as Record<string, string>)
      : {}

  const answerSuggestions = useMemo(
    () =>
      node.type === 'question'
        ? suggestAnswerTypes({
            prompt: String(node.config.prompt ?? ''),
            nodes,
            currentNodeId: node.id,
            currentConfig: node.config,
            limit: 3,
          })
        : [],
    [node.type, node.config, node.id, nodes],
  )
  const autoAppliedPrompt = useRef('')
  useEffect(() => {
    if (readOnly || node.type !== 'question') return
    const prompt = String(node.config.prompt ?? '')
    if (!prompt.trim()) return
    const handle = window.setTimeout(() => {
      const current = useDesignerStore.getState().nodes.find((n) => n.id === node.id)
      if (!current || current.type !== 'question') return
      const top = suggestAnswerTypes({
        prompt: String(current.config.prompt ?? ''),
        nodes: useDesignerStore.getState().nodes,
        currentNodeId: node.id,
        currentConfig: current.config,
      })[0]
      if (
        !shouldAutoApplyAnswerType({
          currentAnswerType: String(current.config.answerType ?? 'text'),
          suggestion: top,
        })
      ) {
        return
      }
      const nextPrompt = String(current.config.prompt ?? '')
      const appliedKey = `${node.id}:${nextPrompt}`
      if (autoAppliedPrompt.current === appliedKey) return
      autoAppliedPrompt.current = appliedKey
      updateNode(node.id, { config: { ...current.config, ...applyAnswerTypeSuggestion(current.config, top!) } })
    }, 750)
    return () => window.clearTimeout(handle)
  }, [node.id, node.type, node.config.prompt, readOnly, updateNode])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{node.label || node.type}</h2>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Configure this step. Type {'{{'} for suggestions. References highlight in teal.
        </p>
        {lockedBy ? (
          <p
            className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900"
            style={{ borderLeftColor: lockedBy.color, borderLeftWidth: 3 }}
          >
            {lockedBy.name} is editing this step — view only until they leave it.
            {lockedBy.waitingHint ? (
              <span className="mt-1 block font-normal text-amber-800/90">{lockedBy.waitingHint}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div>
        <Label>Step key</Label>
        <Input
          value={node.key}
          disabled={readOnly}
          onChange={(e) => updateNode(node.id, { key: e.target.value })}
        />
      </div>
      <div>
        <Label>Label</Label>
        <Input
          value={node.label}
          disabled={readOnly}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
        />
      </div>

      {node.type === 'message' ? (
        <div>
          <Label>Message text</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={String(node.config.text ?? '')}
            onChange={(v) => patchConfig(messageConfigSchema.parse({ text: v }))}
            suggestions={suggestions}
            placeholder="Hello {{vars.name}}…"
          />
          <InsertTemplateControl
            chatbotId={chatbotId}
            kinds={['message', 'faq', 'menu', 'hours', 'legal', 'receipt', 'document']}
            readOnly={readOnly}
            onInsert={(snippet, key) => {
              const current = String(node.config.text ?? '')
              patchConfig({
                text: current ? `${current}\n\n${snippet}` : snippet,
                templateBindings: ensureTemplateBinding(node.config.templateBindings, key),
              })
            }}
          />
          <div className="mt-3">
            <StepMediaPicker
              instanceId={instance.id}
              chatbotId={chatbotId!}
              filenames={readMediaFiles(node.config)}
              disabled={readOnly || !chatbotId}
              onChange={(mediaFiles) => patchConfig({ mediaFiles })}
            />
          </div>
        </div>
      ) : null}

      {node.type === 'question' ? (
        <>
          <div>
            <Label>Prompt</Label>
            <TemplateField
              disabled={readOnly}
              multiline
              value={String(node.config.prompt ?? '')}
              onChange={(v) => patchConfig({ prompt: v })}
              suggestions={suggestions}
            />
            <InsertTemplateControl
              chatbotId={chatbotId}
              kinds={questionTemplateKinds}
              readOnly={readOnly}
              onInsert={(snippet, key) => {
                const current = String(node.config.prompt ?? '')
                patchConfig({
                  prompt: current ? `${current}\n\n${snippet}` : snippet,
                  templateBindings: ensureTemplateBinding(node.config.templateBindings, key),
                })
              }}
            />
            {answerSuggestions.length && !readOnly ? (
              <div className="mt-2 rounded-xl border border-teal-200/80 bg-teal-50/60 px-3 py-2">
                <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                  <Sparkles className="h-3 w-3" />
                  Suggested from prompt
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {answerSuggestions.map((s) => {
                    const active = String(node.config.answerType ?? '') === s.answerType
                    return (
                      <button
                        key={s.answerType}
                        type="button"
                        title={s.reason}
                        disabled={active}
                        onClick={() => patchConfig(applyAnswerTypeSuggestion(node.config, s))}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                          active
                            ? 'border-teal-500 bg-white text-teal-800'
                            : 'border-teal-200 bg-white text-slate-700 hover:border-teal-400 hover:text-teal-900',
                        )}
                      >
                        {s.label}
                        {typeof s.attributes.outputVariable === 'string' && !String(node.config.outputVariable ?? '').trim()
                          ? ` · ${s.attributes.outputVariable}`
                          : ''}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-teal-900/70">{answerSuggestions[0]?.reason}</p>
              </div>
            ) : null}
          </div>
          <div>
            <StepMediaPicker
              instanceId={instance.id}
              chatbotId={chatbotId!}
              filenames={readMediaFiles(node.config)}
              disabled={readOnly || !chatbotId}
              onChange={(mediaFiles) => patchConfig({ mediaFiles })}
            />
          </div>
          <div>
            <Label>Expected answer type</Label>
            <Select
              disabled={readOnly}
              value={String(node.config.answerType ?? 'text')}
              onChange={(e) => patchConfig(buildQuestionAnswerTypePatch(node.config, e.target.value))}
            >
              {answerSuggestions.length ? (
                <optgroup label="Suggested">
                  {answerSuggestions.map((s) => (
                    <option key={`sug-${s.answerType}`} value={s.answerType} title={s.reason}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="All types">
                {QUESTION_ANSWER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} title={opt.hint}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            </Select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              {QUESTION_ANSWER_TYPE_OPTIONS.find((o) => o.value === node.config.answerType)?.hint ??
                QUESTION_ANSWER_TYPE_OPTIONS[0].hint}
              {questionResponse ? (
                <>
                  {' · Returns '}
                  <code className="font-mono">{questionResponse.dataType}</code>
                  {questionResponse.example ? ` (${questionResponse.example})` : ''}
                </>
              ) : null}
            </p>
          </div>
          <div>
            <Label>Response</Label>
            <Select
              disabled={readOnly}
              value={isAnswerRequired(node.config) ? 'required' : 'optional'}
              onChange={(e) =>
                patchConfig({
                  answerRequired: e.target.value === 'required',
                  // Required questions ignore timeout; clear so Settings stay consistent
                  ...(e.target.value === 'required' ? { timeoutSeconds: 0 } : {}),
                })
              }
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </Select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              {isAnswerRequired(node.config)
                ? 'User must answer before the flow continues.'
                : 'User can skip. You can also set a Timeout under Settings (marks the step Timed out).'}
            </p>
          </div>
          {answerTypeUsesChoices(String(node.config.answerType ?? '')) ? (
            <>
              <ChoicesSourceEditor
                key={`${node.id}-choices-${String(node.config.answerType ?? 'choice')}`}
                disabled={readOnly}
                choices={
                  Array.isArray(node.config.choices)
                    ? (node.config.choices as string[]).map(String)
                    : []
                }
                choicesFrom={String(node.config.choicesFrom ?? '')}
                fallback={
                  String(node.config.answerType) === 'gender'
                    ? DEFAULT_GENDER_CHOICES
                    : String(node.config.answerType) === 'likert'
                      ? DEFAULT_LIKERT_CHOICES
                      : String(node.config.answerType) === 'numbered_choice'
                        ? DEFAULT_NUMBERED_CHOICES
                      : String(node.config.answerType) === 'ranking'
                          ? DEFAULT_RANKING_ITEMS
                          : String(node.config.answerType) === 'matrix'
                            ? DEFAULT_MATRIX_ROWS
                            : undefined
                }
                suggestions={suggestions}
                onChoicesChange={(choices) => patchConfig({ choices })}
                onChoicesFromChange={(choicesFrom) => patchConfig({ choicesFrom })}
              />
              {answerTypeUsesMultiSelect(String(node.config.answerType)) ? (
                <>
                  <div>
                    <Label>Selection</Label>
                    <Select
                      disabled={readOnly}
                      value={node.config.allowMultiple === true ? 'multiple' : 'single'}
                      onChange={(e) =>
                        patchConfig({
                          allowMultiple: e.target.value === 'multiple',
                          ...(e.target.value === 'single'
                            ? { minSelections: null, maxSelections: null }
                            : {}),
                        })
                      }
                    >
                      <option value="single">Single choice</option>
                      <option value="multiple">Multiple selection</option>
                    </Select>
                  </div>
                  {node.config.allowMultiple === true ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Min selections</Label>
                        <Input
                          disabled={readOnly}
                          type="number"
                          min={0}
                          value={
                            node.config.minSelections != null
                              ? String(node.config.minSelections)
                              : ''
                          }
                          placeholder="Optional"
                          onChange={(e) => {
                            const n = e.target.value === '' ? undefined : Number(e.target.value)
                            patchConfig({
                              minSelections: Number.isFinite(n as number) ? n : undefined,
                            })
                          }}
                        />
                      </div>
                      <div>
                        <Label>Max selections</Label>
                        <Input
                          disabled={readOnly}
                          type="number"
                          min={1}
                          value={
                            node.config.maxSelections != null
                              ? String(node.config.maxSelections)
                              : ''
                          }
                          placeholder="Optional"
                          onChange={(e) => {
                            const n = e.target.value === '' ? undefined : Number(e.target.value)
                            patchConfig({
                              maxSelections: Number.isFinite(n as number) ? n : undefined,
                            })
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          {answerTypeUsesNumberBounds(String(node.config.answerType ?? '')) ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Min</Label>
                  <Input
                    disabled={readOnly}
                    type="number"
                    value={node.config.min != null ? String(node.config.min) : ''}
                    placeholder={
                      String(node.config.answerType) === 'nps'
                        ? '0'
                        : String(node.config.answerType) === 'slider' ||
                            String(node.config.answerType) === 'percentage' ||
                            String(node.config.answerType) === 'stepper'
                          ? '0'
                          : String(node.config.answerType) === 'rating' ||
                              String(node.config.answerType) === 'stars'
                            ? '1'
                            : '—'
                    }
                    onChange={(e) => {
                      const n = e.target.value === '' ? undefined : Number(e.target.value)
                      patchConfig({ min: Number.isFinite(n as number) ? n : undefined })
                    }}
                  />
                </div>
                <div>
                  <Label>Max</Label>
                  <Input
                    disabled={readOnly}
                    type="number"
                    value={node.config.max != null ? String(node.config.max) : ''}
                    placeholder={
                      String(node.config.answerType) === 'nps'
                        ? '10'
                        : String(node.config.answerType) === 'slider' ||
                            String(node.config.answerType) === 'percentage' ||
                            String(node.config.answerType) === 'stepper'
                          ? '100'
                          : String(node.config.answerType) === 'rating' ||
                              String(node.config.answerType) === 'stars'
                            ? '5'
                            : '—'
                    }
                    onChange={(e) => {
                      const n = e.target.value === '' ? undefined : Number(e.target.value)
                      patchConfig({ max: Number.isFinite(n as number) ? n : undefined })
                    }}
                  />
                </div>
                <div>
                  <Label>Step</Label>
                  <Input
                    disabled={readOnly || String(node.config.answerType) === 'stars' || String(node.config.answerType) === 'nps'}
                    type="number"
                    value={node.config.step != null ? String(node.config.step) : ''}
                    placeholder="1"
                    onChange={(e) => {
                      const n = e.target.value === '' ? undefined : Number(e.target.value)
                      patchConfig({ step: Number.isFinite(n as number) ? n : undefined })
                    }}
                  />
                </div>
              </div>
              {answerTypeUsesScaleLabels(String(node.config.answerType ?? '')) ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Min label</Label>
                    <Input
                      disabled={readOnly}
                      value={String(node.config.minLabel ?? '')}
                      placeholder={
                        String(node.config.answerType) === 'nps' ? 'Not at all likely' : 'Low'
                      }
                      onChange={(e) =>
                        patchConfig({ minLabel: e.target.value.trim() ? e.target.value : null })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max label</Label>
                    <Input
                      disabled={readOnly}
                      value={String(node.config.maxLabel ?? '')}
                      placeholder={
                        String(node.config.answerType) === 'nps' ? 'Extremely likely' : 'High'
                      }
                      onChange={(e) =>
                        patchConfig({ maxLabel: e.target.value.trim() ? e.target.value : null })
                      }
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {answerTypeUsesDateBounds(String(node.config.answerType ?? '')) ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Earliest</Label>
                <DateTimePicker
                  disabled={readOnly}
                  size="sm"
                  mode={dateBoundMode}
                  value={earliestValue}
                  min={earliestDatePickerMin(dateAnswerType, now)}
                  onChange={(minDate) => patchConfig({ minDate: minDate || undefined })}
                  placeholder="No earliest limit"
                />
                {earliestIssue ? (
                  <p className="mt-1 text-[11px] text-rose-600">{earliestIssue.message}</p>
                ) : null}
              </div>
              <div>
                <Label>Latest</Label>
                <DateTimePicker
                  disabled={readOnly}
                  size="sm"
                  mode={dateBoundMode}
                  value={latestValue}
                  min={latestDatePickerMin(dateAnswerType, earliestValue, now)}
                  onChange={(maxDate) => patchConfig({ maxDate: maxDate || undefined })}
                  placeholder="No latest limit"
                />
                {latestIssue ? (
                  <p className="mt-1 text-[11px] text-rose-600">{latestIssue.message}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          {String(node.config.answerType) === 'email' ? (
            <AllowedEmailDomainsEditor
              key={`${node.id}-email-domains`}
              disabled={readOnly}
              domains={
                Array.isArray(node.config.allowedEmailDomains)
                  ? (node.config.allowedEmailDomains as string[]).map(String)
                  : []
              }
              onChange={(allowedEmailDomains) =>
                patchConfig({
                  allowedEmailDomains: allowedEmailDomains.length ? allowedEmailDomains : null,
                })
              }
            />
          ) : null}
          {String(node.config.answerType) === 'currency' || String(node.config.answerType) === 'payment' ? (
            <div>
              <Label>Currency</Label>
              <Select
                disabled={readOnly}
                value={String(node.config.currencyCode ?? 'ZAR')}
                onChange={(e) => patchConfig({ currencyCode: e.target.value })}
              >
                {COMMON_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {String(node.config.answerType) === 'payment' ? (
            <div className="space-y-3">
              <div>
                <Label>Payment connection</Label>
                <Select
                  disabled={readOnly}
                  value={String(node.config.paymentConnectionId ?? '')}
                  onChange={(e) => patchConfig({ paymentConnectionId: e.target.value || null })}
                >
                  <option value="">None (visitor confirms manually)</option>
                  {String(node.config.paymentConnectionId ?? '').trim() &&
                  !installedPaymentConnections.some(
                    (c) => c.id === String(node.config.paymentConnectionId ?? ''),
                  ) ? (
                    <option value={String(node.config.paymentConnectionId)}>
                      {connectionsReady ? 'Selected connection was not found' : 'Selected connection (loading…)'}
                    </option>
                  ) : null}
                  {installedPaymentConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  {installedPaymentConnections.length === 0
                    ? 'Install a Payment connection on this chatbot to have the server confirm PayFast (or a custom notify).'
                    : 'With a connection, chat waits until PayFast (or your notify URL) confirms the charge.'}
                </p>
              </div>
              <div>
                <Label>Pay URL</Label>
                <TemplateField
                  disabled={readOnly}
                  value={String(node.config.payUrl ?? '')}
                  onChange={(v) => patchConfig({ payUrl: v })}
                  suggestions={suggestions}
                  placeholder="https://pay.example/… or url variable"
                />
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Optional when using PayFast (checkout is built from the connection). Required for custom /
                  cash links. Leave empty for cash/EFT with no connection.
                </p>
              </div>
              <div>
                <Label>Amount</Label>
                <TemplateField
                  disabled={readOnly}
                  value={String(node.config.paymentAmount ?? '')}
                  onChange={(v) => patchConfig({ paymentAmount: v })}
                  suggestions={suggestions}
                  placeholder="150 or {{vars.cart.total}}"
                />
              </div>
              <div>
                <Label>Item name</Label>
                <TemplateField
                  disabled={readOnly}
                  value={String(node.config.paymentItemName ?? '')}
                  onChange={(v) => patchConfig({ paymentItemName: v })}
                  suggestions={suggestions}
                  placeholder="Order {{vars.order_id}}"
                />
              </div>
              <div>
                <Label>Buyer email</Label>
                <TemplateField
                  disabled={readOnly}
                  value={String(node.config.paymentBuyerEmail ?? '')}
                  onChange={(v) => patchConfig({ paymentBuyerEmail: v })}
                  suggestions={suggestions}
                  placeholder="{{vars.email}}"
                />
              </div>
              <div>
                <Label>Buyer name</Label>
                <TemplateField
                  disabled={readOnly}
                  value={String(node.config.paymentBuyerName ?? '')}
                  onChange={(v) => patchConfig({ paymentBuyerName: v })}
                  suggestions={suggestions}
                  placeholder="{{vars.name}}"
                />
              </div>
              <div>
                <Label>Pay button label</Label>
                <Input
                  disabled={readOnly}
                  value={String(node.config.payButtonLabel ?? 'Pay now')}
                  onChange={(e) => patchConfig({ payButtonLabel: e.target.value })}
                />
              </div>
              <div>
                <Label>Paid button label</Label>
                <Input
                  disabled={readOnly}
                  value={String(node.config.paidButtonLabel ?? "I've paid")}
                  onChange={(e) => patchConfig({ paidButtonLabel: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Without a connection this stays honor-system. With a connection the answer is stored as{' '}
                  {'{ status: "verified", reference, amount, currency }'} after the PHP callback succeeds.
                </p>
              </div>
            </div>
          ) : null}
          {String(node.config.answerType) === 'otp' ? (
            <div className="space-y-3">
              <div>
                <Label>Code length</Label>
                <Input
                  disabled={readOnly}
                  type="number"
                  min={4}
                  max={12}
                  value={node.config.otpLength != null ? String(node.config.otpLength) : '6'}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    patchConfig({
                      otpLength: Number.isFinite(n) ? Math.max(4, Math.min(12, Math.round(n))) : 6,
                    })
                  }}
                />
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Digits only (4–12). Chat shows one box per digit.
                </p>
              </div>
              <div>
                <Label>Email connection</Label>
                <Select
                  disabled={readOnly}
                  value={String(node.config.otpConnectionId ?? '')}
                  onChange={(e) => patchConfig({ otpConnectionId: e.target.value || null })}
                >
                  <option value="">None (manual PIN only)</option>
                  {String(node.config.otpConnectionId ?? '').trim() &&
                  !installedEmailConnections.some(
                    (c) => c.id === String(node.config.otpConnectionId ?? ''),
                  ) ? (
                    <option value={String(node.config.otpConnectionId)}>
                      {connectionsReady ? 'Selected connection was not found' : 'Selected connection (loading…)'}
                    </option>
                  ) : null}
                  {installedEmailConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  {installedEmailConnections.length === 0 ? (
                    <>
                      No email connections installed on this chatbot yet. Create one under Data, or{' '}
                      <Link
                        className="font-medium text-teal-700 hover:underline"
                        to={`/instances/${instance.id}/connections`}
                      >
                        install from ForgeHub
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Only email connections installed on this chatbot are listed. When set, Preview
                      emails a code and only accepts that code.
                    </>
                  )}
                </p>
              </div>
              {node.config.otpConnectionId ? (
                <>
                  <FlowTemplatePicker
                    chatbotId={chatbotId}
                    kinds={['email']}
                    readOnly={readOnly}
                    valueKey={String(node.config.otpTemplateKey ?? '')}
                    label="OTP email template"
                    hint="Optional HTML email template. The code is still available as {{otp.code}}."
                    onSelectKey={(key) => {
                      if (!key) {
                        patchConfig({ otpTemplateKey: '' })
                        return
                      }
                      patchConfig({
                        otpTemplateKey: key,
                        otpSubject: `{{templates.${key}.subject}}`,
                        otpBody: `{{templates.${key}.html}}\n\nYour code is {{otp.code}}.`,
                        templateBindings: ensureTemplateBinding(node.config.templateBindings, key),
                      })
                    }}
                  />
                  <div>
                    <Label>Send to</Label>
                    <TemplateField
                      disabled={readOnly}
                      value={String(node.config.otpTo ?? '')}
                      onChange={(v) => patchConfig({ otpTo: v })}
                      suggestions={suggestions}
                      placeholder="{{vars.email}}"
                    />
                    <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                      Usually a prior Email question saved to a variable.
                    </p>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <TemplateField
                      disabled={readOnly}
                      value={String(node.config.otpSubject ?? '')}
                      onChange={(v) => patchConfig({ otpSubject: v })}
                      suggestions={suggestions}
                      placeholder="Your verification code"
                    />
                  </div>
                  <div>
                    <Label>Body</Label>
                    <TemplateField
                      disabled={readOnly}
                      multiline
                      value={String(node.config.otpBody ?? '')}
                      onChange={(v) => patchConfig({ otpBody: v })}
                      suggestions={suggestions}
                      placeholder="Your code is {{otp.code}}"
                    />
                    <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                      Insert the code with {'{{otp.code}}'}.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Expires (seconds)</Label>
                      <Input
                        disabled={readOnly}
                        type="number"
                        min={30}
                        value={
                          node.config.otpExpiresSeconds != null
                            ? String(node.config.otpExpiresSeconds)
                            : '300'
                        }
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          patchConfig({
                            otpExpiresSeconds: Number.isFinite(n)
                              ? Math.max(30, Math.round(n))
                              : 300,
                          })
                        }}
                      />
                    </div>
                    <div>
                      <Label>Max attempts</Label>
                      <Input
                        disabled={readOnly}
                        type="number"
                        min={1}
                        max={20}
                        value={
                          node.config.otpMaxAttempts != null
                            ? String(node.config.otpMaxAttempts)
                            : '5'
                        }
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          patchConfig({
                            otpMaxAttempts: Number.isFinite(n)
                              ? Math.max(1, Math.min(20, Math.round(n)))
                              : 5,
                          })
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {String(node.config.answerType) === 'confirm' ? (
            <div>
              <Label>Checkbox label</Label>
              <Input
                disabled={readOnly}
                value={String(node.config.confirmLabel ?? '')}
                placeholder="I agree"
                onChange={(e) =>
                  patchConfig({ confirmLabel: e.target.value.trim() ? e.target.value : null })
                }
              />
            </div>
          ) : null}
          {String(node.config.answerType) === 'file' ? (
            <>
              <div>
                <Label>Allowed files</Label>
                <Select
                  disabled={readOnly}
                  value={String(node.config.fileAccept ?? 'any')}
                  onChange={(e) => patchConfig({ fileAccept: e.target.value })}
                >
                  {FILE_ACCEPT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} title={opt.hint}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Published chat stores uploads in this chatbot’s conversation folder on the API
                  server. Preview keeps files locally unless a public session exists.
                </p>
              </div>
              <div>
                <Label>Max files</Label>
                <Input
                  disabled={readOnly}
                  type="number"
                  min={1}
                  max={5}
                  value={node.config.maxFiles != null ? String(node.config.maxFiles) : '1'}
                  onChange={(e) => {
                    const n = e.target.value === '' ? 1 : Number(e.target.value)
                    patchConfig({ maxFiles: Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1 })
                  }}
                />
              </div>
            </>
          ) : null}
          {String(node.config.answerType) === 'signature' ? (
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Visitors draw a signature. It is stored as PNG in the conversation files folder
              {' '}({'{session}_{step}.png'}).
            </p>
          ) : null}
          {answerTypeUsesImageChoices(String(node.config.answerType ?? '')) ? (
            <>
              <ImageChoiceEditor
                key={`${node.id}-image-choices`}
                disabled={readOnly}
                instanceId={instance.id}
                chatbotId={chatbotId}
                media={media.data ?? []}
                options={readImageChoiceDrafts(node.config)}
                onChange={(imageChoices) => patchConfig({ imageChoices })}
              />
              <div>
                <Label>Display</Label>
                <Select
                  disabled={readOnly}
                  value={readImageChoiceLayout(node.config)}
                  onChange={(e) =>
                    patchConfig({
                      imageChoiceLayout: e.target.value === 'grid' ? 'grid' : 'gallery',
                    })
                  }
                >
                  <option value="gallery">Horizontal gallery</option>
                  <option value="grid">Grid</option>
                </Select>
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  {readImageChoiceLayout(node.config) === 'grid'
                    ? 'All picture cards are shown at once.'
                    : 'Swipe or use arrows; the focused image snaps to the center.'}
                </p>
              </div>
              <div>
                <Label>Selection</Label>
                <Select
                  disabled={readOnly}
                  value={node.config.allowMultiple === true ? 'multiple' : 'single'}
                  onChange={(e) =>
                    patchConfig({
                      allowMultiple: e.target.value === 'multiple',
                      ...(e.target.value === 'single'
                        ? { minSelections: null, maxSelections: null }
                        : {}),
                    })
                  }
                >
                  <option value="single">Single choice</option>
                  <option value="multiple">Multiple selection</option>
                </Select>
              </div>
            </>
          ) : null}
          {String(node.config.answerType) === 'matrix' ? (
            <div className="space-y-2">
              <Label>Scale columns</Label>
              <p className="text-[11px] text-[var(--color-ink-muted)]">
                Each row is rated on this scale. Rows come from the options list above.
              </p>
              {(Array.isArray(node.config.scaleChoices) && (node.config.scaleChoices as unknown[]).length
                ? (node.config.scaleChoices as unknown[]).map((s) => String(s ?? ''))
                : [...DEFAULT_LIKERT_CHOICES]
              ).map((label, index, slots) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    disabled={readOnly}
                    value={label}
                    onChange={(e) => {
                      const next = slots.map((s, i) => (i === index ? e.target.value : s))
                      patchConfig({ scaleChoices: next })
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={readOnly || slots.length <= 2}
                    onClick={() => patchConfig({ scaleChoices: slots.filter((_, i) => i !== index) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={readOnly}
                onClick={() => {
                  const slots =
                    Array.isArray(node.config.scaleChoices) && (node.config.scaleChoices as unknown[]).length
                      ? (node.config.scaleChoices as unknown[]).map((s) => String(s ?? ''))
                      : [...DEFAULT_LIKERT_CHOICES]
                  patchConfig({ scaleChoices: [...slots, ''] })
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add column
              </Button>
            </div>
          ) : null}
          {String(node.config.answerType) === 'national_id' ? (
            <div>
              <Label>ID format</Label>
              <Select
                disabled={readOnly}
                value={String(node.config.idFormat ?? 'za')}
                onChange={(e) => patchConfig({ idFormat: e.target.value })}
              >
                <option value="za">South African ID (13 digits + checksum)</option>
                <option value="any">Digits only (use min/max length)</option>
              </Select>
            </div>
          ) : null}
          {String(node.config.answerType) === 'audio' ? (
            <div>
              <Label>Max duration (seconds)</Label>
              <Input
                disabled={readOnly}
                type="number"
                min={5}
                max={180}
                value={node.config.maxDurationSeconds != null ? String(node.config.maxDurationSeconds) : '60'}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  patchConfig({
                    maxDurationSeconds: Number.isFinite(n) ? Math.min(180, Math.max(5, Math.round(n))) : 60,
                  })
                }}
              />
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                Recordings are stored as webm/ogg in the conversation files folder.
              </p>
            </div>
          ) : null}
          {String(node.config.answerType) === 'captcha' ? (
            <div className="space-y-3">
              <div>
                <Label>Puzzle type</Label>
                <Select
                  disabled={readOnly}
                  value={String(node.config.captchaKind ?? 'math')}
                  onChange={(e) => patchConfig({ captchaKind: e.target.value })}
                >
                  <option value="math">Math (a ± b)</option>
                  <option value="text">Distorted text</option>
                </Select>
              </div>
              <div>
                <Label>Max attempts</Label>
                <Input
                  disabled={readOnly}
                  type="number"
                  min={1}
                  max={20}
                  value={
                    node.config.captchaMaxAttempts != null ? String(node.config.captchaMaxAttempts) : '5'
                  }
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    patchConfig({
                      captchaMaxAttempts: Number.isFinite(n) ? Math.min(20, Math.max(1, Math.round(n))) : 5,
                    })
                  }}
                />
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Built-in check only — no Google/hCaptcha. The solution is never stored on the answer
                  variable.
                </p>
              </div>
            </div>
          ) : null}
          {String(node.config.answerType) === 'form' ? (
            <FormFieldsEditor
              key={`${node.id}-form-fields`}
              disabled={readOnly}
              fields={
                Array.isArray(node.config.formFields) && (node.config.formFields as unknown[]).length
                  ? (node.config.formFields as FormFieldDef[])
                  : DEFAULT_FORM_FIELDS
              }
              onChange={(formFields) => patchConfig({ formFields })}
            />
          ) : null}
          {String(node.config.answerType) === 'shop' ? (
            <div className="space-y-2">
              <FlowTemplatePicker
                chatbotId={chatbotId}
                kinds={['cart']}
                readOnly={readOnly}
                valueKey={String(node.config.shopTemplateKey ?? '')}
                label="Store catalog"
                hint="Visitors browse this catalog, add products to a cart, then checkout. The answer is { items, subtotal, fees, feesTotal, total, currency, itemCount }."
                onSelectKey={(key) => {
                  if (!key) {
                    patchConfig({ shopTemplateKey: '' })
                    return
                  }
                  const prompt = String(node.config.prompt ?? '').trim()
                  patchConfig({
                    shopTemplateKey: key,
                    ...(prompt ? {} : { prompt: `{{templates.${key}.intro}}` }),
                  })
                }}
              />
              <p className="text-[11px] text-[var(--color-ink-muted)]">
                After checkout, use{' '}
                <code className="font-mono">{`{{vars.${String(node.config.outputVariable || 'cart').trim()}.total}}`}</code>
                {' '}as the amount on a Payment step (product subtotal plus any catalog fees).
              </p>
            </div>
          ) : null}
          {String(node.config.answerType) === 'password' ? (
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Chat shows dots instead of the secret. The real value is still saved on the output
              variable for later steps.
            </p>
          ) : null}
          {String(node.config.answerType) === 'location' ? (
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Asks the visitor for GPS coordinates (lat/lng) plus an optional label. Stored as an
              object: {'{{vars.place.lat}}'}, {'{{vars.place.lng}}'}.
            </p>
          ) : null}
          {String(node.config.answerType) === 'phone' ? (
            <div>
              <Label>Phone format</Label>
              <Select
                disabled={readOnly}
                value={String(node.config.phoneFormat ?? 'e164')}
                onChange={(e) => patchConfig({ phoneFormat: e.target.value as 'any' | 'e164' })}
              >
                <option value="e164">Country code + number (E.164)</option>
                <option value="any">Any reasonable format</option>
              </Select>
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                Chat shows a country-code picker and digits-only number field.
              </p>
            </div>
          ) : null}
          {answerTypeUsesLengthValidation(String(node.config.answerType ?? '')) ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min length</Label>
                <Input
                  disabled={readOnly}
                  type="number"
                  min={0}
                  value={node.config.minLength != null ? String(node.config.minLength) : ''}
                  placeholder="—"
                  onChange={(e) => {
                    const n = e.target.value === '' ? undefined : Number(e.target.value)
                    patchConfig({ minLength: Number.isFinite(n as number) ? n : undefined })
                  }}
                />
              </div>
              <div>
                <Label>Max length</Label>
                <Input
                  disabled={readOnly}
                  type="number"
                  min={0}
                  value={node.config.maxLength != null ? String(node.config.maxLength) : ''}
                  placeholder="—"
                  onChange={(e) => {
                    const n = e.target.value === '' ? undefined : Number(e.target.value)
                    patchConfig({ maxLength: Number.isFinite(n as number) ? n : undefined })
                  }}
                />
              </div>
            </div>
          ) : null}
          {answerTypeUsesPattern(String(node.config.answerType ?? '')) ? (
            <>
              <div>
                <Label>Pattern (regex)</Label>
                <Input
                  disabled={readOnly}
                  value={String(node.config.pattern ?? '')}
                  placeholder="e.g. ^[A-Z]{2}\\d{4}$"
                  onChange={(e) => patchConfig({ pattern: e.target.value || undefined })}
                />
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Optional. Leave empty to skip custom format checks.
                </p>
              </div>
              {node.config.pattern ? (
                <div>
                  <Label>Pattern error message</Label>
                  <Input
                    disabled={readOnly}
                    value={String(node.config.patternMessage ?? '')}
                    placeholder="Does not match the required format."
                    onChange={(e) => patchConfig({ patternMessage: e.target.value || undefined })}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <QuestionResponseTypeCard node={node} />
          <VariableAssignField
            label="Output variable"
            value={String(node.config.outputVariable ?? '')}
            onChange={(v) => patchConfig({ outputVariable: v })}
            nodeId={node.id}
            readOnly={readOnly}
            placeholder={
              typeof answerSuggestions[0]?.attributes.outputVariable === 'string'
                ? String(answerSuggestions[0].attributes.outputVariable)
                : 'userAnswer'
            }
            valueType={questionResponse?.dataType}
          />
        </>
      ) : null}

      {node.type === 'http' ? (
        <HttpStepFields
          node={node}
          connections={connections}
          readOnly={readOnly}
          patchConfig={patchConfig}
          suggestions={suggestions}
        />
      ) : null}

      {node.type === 'email' ? (
        <EmailStepFields
          node={node}
          connections={connections}
          readOnly={readOnly}
          patchConfig={patchConfig}
          suggestions={suggestions}
        />
      ) : null}

      {node.type === 'condition' ? (
        <>
          <div>
            <Label>Check this value</Label>
            <TemplateField
              disabled={readOnly}
              value={String(node.config.left ?? '')}
              onChange={(v) => patchConfig({ left: v })}
              placeholder="{{vars.count}} or {{steps.email_1.ok}}"
              suggestions={suggestions}
            />
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              What you want to compare — usually a variable or a previous step result.
            </p>
          </div>
          <div>
            <Label>Rule</Label>
            <Select
              disabled={readOnly}
              value={String(node.config.operator ?? 'eq')}
              onChange={(e) => patchConfig(conditionConfigSchema.parse({ ...node.config, operator: e.target.value }))}
            >
              {CONDITION_OPERATOR_OPTIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              {CONDITION_OPERATOR_OPTIONS.find((o) => o.value === String(node.config.operator ?? 'eq'))?.hint}
            </p>
          </div>
          {(CONDITION_OPERATOR_OPTIONS.find((o) => o.value === String(node.config.operator ?? 'eq'))?.needsRight ??
            true) ? (
            <div>
              <Label>Compare to</Label>
              <TemplateField
                disabled={readOnly}
                value={String(node.config.right ?? '')}
                onChange={(v) => patchConfig({ right: v })}
                placeholder="true, 10, or {{vars.expected}}"
                suggestions={suggestions}
              />
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                The value on the other side of the rule (text, number, or another reference).
              </p>
            </div>
          ) : null}
          <p className="text-xs text-[var(--color-ink-muted)]">
            Yes/No paths are inside this step. Actions after the condition sit below it as normal steps (not inside the
            card). An End inside Yes or No stops that path.
          </p>
        </>
      ) : null}

      {node.type === 'loop' ? (
        <>
          <div>
            <Label>Array to loop</Label>
            <TemplateField
              disabled={readOnly}
              value={String(node.config.collection ?? '')}
              onChange={(v) => patchConfig(loopConfigSchema.parse({ ...node.config, collection: v }))}
              placeholder="{{steps.http_1.data}} or {{vars.items}}"
              suggestions={suggestions}
            />
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              Must resolve to a JSON array (HTTP response list or an array variable).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Item variable</Label>
              <Input
                disabled={readOnly}
                value={String(node.config.itemVariable ?? 'item')}
                onChange={(e) =>
                  patchConfig(loopConfigSchema.parse({ ...node.config, itemVariable: e.target.value || 'item' }))
                }
              />
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                Each record → {'{{vars.'}
                {String(node.config.itemVariable ?? 'item').trim() || 'item'}
                {'}}'}
              </p>
            </div>
            <div>
              <Label>Index variable</Label>
              <Input
                disabled={readOnly}
                value={String(node.config.indexVariable ?? 'index')}
                onChange={(e) =>
                  patchConfig(loopConfigSchema.parse({ ...node.config, indexVariable: e.target.value || 'index' }))
                }
              />
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                0-based → {'{{vars.'}
                {String(node.config.indexVariable ?? 'index').trim() || 'index'}
                {'}}'}
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Put actions under <span className="font-medium">Each item</span>. Steps below the For each card run once the
            list finishes (or if the array is empty).
          </p>
        </>
      ) : null}

      {node.type === 'set_variable' ? (
        <>
          <VariableAssignField
            label="Variable key"
            value={String(node.config.variableKey ?? '')}
            onChange={(v) => patchConfig({ variableKey: v })}
            nodeId={node.id}
            readOnly={readOnly}
          />
          <div>
            <Label>Type</Label>
            <Select
              disabled={readOnly}
              value={String(node.config.valueType ?? 'string')}
              onChange={(e) => patchConfig(setVariableConfigSchema.parse({ ...node.config, valueType: e.target.value }))}
            >
              {variableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Value</Label>
            <TemplateField
              disabled={readOnly}
              multiline
              value={String(node.config.value ?? '')}
              onChange={(v) => patchConfig({ value: v })}
              suggestions={suggestions}
            />
          </div>
        </>
      ) : null}

      {node.type === 'operation' ? (
        <>
          <div>
            <Label>Operation</Label>
            <Select
              disabled={readOnly}
              value={operation}
              onChange={(e) => patchConfig(operationConfigSchema.parse({ ...node.config, operation: e.target.value }))}
            >
              {OPERATION_OPTIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{operationMeta.hint}</p>
          </div>
          <ResponseTypeCard
            dataType={operationResult.dataType}
            example={operationResult.example}
            stepKey={node.key}
            outputVariable={String(node.config.outputVariable ?? '')}
            fields={[{ path: 'response', type: operationResult.dataType }]}
          />
          <div>
            <Label>{needsRight || needsReplaceWith ? 'Value' : 'Input'}</Label>
            <TemplateField
              disabled={readOnly}
              value={String(node.config.left ?? '')}
              onChange={(v) => patchConfig({ left: v })}
              suggestions={suggestions}
              placeholder="{{vars.name}} or text"
            />
          </div>
          {needsRight ? (
            <div>
              <Label>{operation === 'replace' ? 'Find' : operation === 'json_path' ? 'Path' : 'Right'}</Label>
              <TemplateField
                disabled={readOnly}
                value={String(node.config.right ?? '')}
                onChange={(v) => patchConfig({ right: v })}
                suggestions={suggestions}
                placeholder={operation === 'json_path' ? 'user.email' : '{{vars.other}}'}
              />
            </div>
          ) : null}
          {needsReplaceWith ? (
            <div>
              <Label>Replace with</Label>
              <TemplateField
                disabled={readOnly}
                value={String(node.config.replaceWith ?? '')}
                onChange={(v) => patchConfig({ replaceWith: v })}
                suggestions={suggestions}
                placeholder="replacement text"
              />
            </div>
          ) : null}
          <VariableAssignField
            label="Output variable"
            value={String(node.config.outputVariable ?? '')}
            onChange={(v) => patchConfig({ outputVariable: v })}
            nodeId={node.id}
            readOnly={readOnly}
            valueType={operationResult.dataType}
          />
        </>
      ) : null}

      {node.type === 'entity' ? (
        <>
          <div>
            <Label>Entity</Label>
            <Select
              disabled={readOnly}
              value={String(node.config.entityId ?? '')}
              onChange={(e) => patchConfig({ entityId: e.target.value })}
            >
              <option value="">Select…</option>
              {(entitiesQuery.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.kind})
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              Manage entities on the Data tab. Static = catalog (List/Get only); Dynamic = Create/Update/Delete too.
            </p>
          </div>
          <div>
            <Label>Action</Label>
            <Select
              disabled={readOnly}
              value={entityOp}
              onChange={(e) => patchConfig(entityConfigSchema.parse({ ...node.config, operation: e.target.value }))}
            >
              {ENTITY_OPERATIONS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">{entityOpMeta.hint}</p>
          </div>
          {entityOpMeta.needsRecordId ? (
            <div>
              <Label>Record id</Label>
              <TemplateField
                disabled={readOnly}
                value={String(node.config.recordId ?? '')}
                onChange={(v) => patchConfig({ recordId: v })}
                suggestions={suggestions}
                placeholder="{{vars.recordId}}"
              />
            </div>
          ) : null}
          {(entityOp === 'list' || entityOp === 'get') && selectedEntity?.attributes.length ? (
            <EntityQueryBuilder
              attributes={selectedEntity.attributes}
              filterAttribute={String(node.config.filterAttribute ?? '')}
              filterEquals={String(node.config.filterEquals ?? '')}
              filters={entityFiltersSchema.parse(node.config.filters ?? {})}
              suggestions={suggestions}
              readOnly={readOnly}
              onChange={(filters) =>
                patchConfig({
                  filters,
                  filterAttribute: '',
                  filterEquals: '',
                })
              }
            />
          ) : null}
          {entityOpMeta.needsFields && selectedEntity ? (
            <div className="space-y-2">
              <Label>Field values</Label>
              {!selectedEntity.attributes.length ? (
                <p className="text-xs text-[var(--color-ink-muted)]">Add attributes on the Data tab first.</p>
              ) : (
                selectedEntity.attributes.map((a) => {
                  const primaryKey = isEntityPrimaryKey(a.key)
                  // Update uses Record id; create auto-generates id when left blank.
                  if (primaryKey && entityOp === 'update') return null
                  const raw = fieldMap[a.key] ?? ''
                  const hasTemplate = extractTemplateRefs(raw).length > 0
                  const typeCheck =
                    !hasTemplate && raw.trim() ? coerceEntityValue(raw, a.value_type) : null
                  const typeOk = !typeCheck || typeCheck.ok
                  const requiredMark = a.required && !(primaryKey && entityOp === 'create')
                  return (
                  <div key={a.id}>
                    <Label>
                      {a.label || a.key}
                      {requiredMark ? ' *' : ''}
                      {primaryKey && entityOp === 'create' ? ' (auto)' : ''}
                      {a.is_unique && !primaryKey ? ' (unique)' : ''}
                      <span className="ml-1 font-normal text-[var(--color-ink-muted)]">
                        · {a.value_type}
                      </span>
                    </Label>
                    <TemplateField
                      disabled={readOnly}
                      value={raw}
                      onChange={(v) => patchConfig({ fieldMap: { ...fieldMap, [a.key]: v } })}
                      suggestions={suggestions}
                      placeholder={
                        primaryKey && entityOp === 'create'
                          ? 'Leave empty for auto UUID'
                          : `{{vars.${a.key}}} or a ${a.value_type} value`
                      }
                      hideHint={primaryKey && entityOp === 'create'}
                    />
                    {primaryKey && entityOp === 'create' ? (
                      <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                        Primary key is generated automatically when empty.
                      </p>
                    ) : null}
                    {!typeOk && typeCheck && !typeCheck.ok ? (
                      <p className="mt-1 text-[11px] text-rose-600">
                        This field is {a.value_type}. {typeCheck.error}.
                      </p>
                    ) : null}
                  </div>
                  )
                })
              )}
            </div>
          ) : null}
          {entityOp === 'get' && !entityOpMeta.needsRecordId ? (
            <div>
              <Label>Record id (optional)</Label>
              <TemplateField
                disabled={readOnly}
                value={String(node.config.recordId ?? '')}
                onChange={(v) => patchConfig({ recordId: v })}
                suggestions={suggestions}
                placeholder="Leave empty to use filter"
              />
            </div>
          ) : null}
          <ResponseTypeCard
            dataType={entityResult.dataType}
            example={entityResult.example}
            stepKey={node.key}
            outputVariable={String(node.config.outputVariable ?? '')}
            fields={entityResult.fields}
          />
          <VariableAssignField
            label="Output variable"
            value={String(node.config.outputVariable ?? '')}
            onChange={(v) => patchConfig({ outputVariable: v })}
            nodeId={node.id}
            readOnly={readOnly}
            placeholder={entityOp === 'list' ? 'records' : 'record'}
            valueType={entityResult.dataType}
          />
        </>
      ) : null}

      {node.type === 'transfer' ? (
        <TransferStepFields
          node={node}
          chatbotId={chatbotId}
          instanceId={instance.id}
          readOnly={readOnly}
          suggestions={suggestions}
          patchConfig={patchConfig}
        />
      ) : null}

      {node.type === 'end' ? (
        <div>
          <Label>End message (optional)</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={String(node.config.message ?? '')}
            onChange={(v) => patchConfig(endConfigSchema.parse({ message: v }))}
            suggestions={suggestions}
          />
          <InsertTemplateControl
            chatbotId={chatbotId}
            kinds={['message', 'faq', 'menu', 'hours', 'legal', 'receipt', 'document']}
            readOnly={readOnly}
            onInsert={(snippet, key) => {
              const current = String(node.config.message ?? '')
              patchConfig({
                message: current ? `${current}\n\n${snippet}` : snippet,
                templateBindings: ensureTemplateBinding(node.config.templateBindings, key),
              })
            }}
          />
          <div className="mt-3">
            <StepMediaPicker
              instanceId={instance.id}
              chatbotId={chatbotId!}
              filenames={readMediaFiles(node.config)}
              disabled={readOnly || !chatbotId}
              onChange={(mediaFiles) => patchConfig({ mediaFiles })}
            />
          </div>
        </div>
      ) : null}

      {node.type === 'message' || node.type === 'question' || node.type === 'end' || node.type === 'email' ? (
        <TemplateInputBindings
          templates={templatesQuery.data ?? []}
          config={node.config}
          readOnly={readOnly}
          suggestions={suggestions}
          onChange={(templateBindings) => patchConfig({ templateBindings })}
        />
      ) : null}

      <StepRunSettings
        config={node.config}
        nodeType={node.type}
        readOnly={readOnly}
        isFlowStart={isFlowStart}
        patchConfig={patchConfig}
      />

      {issues.length ? (
        <div className="rounded-lg bg-[var(--color-danger-soft)] p-3">
          {issues.map((issue, idx) => (
            <FieldError key={`${issue.code}-${idx}`}>{issue.message}</FieldError>
          ))}
        </div>
      ) : null}

      {!readOnly && (node.type !== 'end' || allowDelete) ? (
        <div className="flex flex-wrap gap-2">
          {node.type !== 'end' ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => copyNode(node.id)}>
                Copy
              </Button>
              <Button size="sm" variant="secondary" onClick={() => duplicateNode(node.id)}>
                Duplicate
              </Button>
              <Button size="sm" variant="secondary" disabled={!clipboard} onClick={() => pasteAfter(node.id)}>
                Paste after
              </Button>
              {moves.up || moves.down ? (
                <>
                  <Button size="sm" variant="ghost" disabled={!moves.up} onClick={() => moveNode(node.id, 'up')}>
                    Move up
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!moves.down} onClick={() => moveNode(node.id, 'down')}>
                    Move down
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
          {allowDelete ? (
            <Button variant="danger" size="sm" onClick={onDeleteStep}>
              Delete step
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
