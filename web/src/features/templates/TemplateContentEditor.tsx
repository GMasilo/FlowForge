import { Plus, Trash2 } from 'lucide-react'
import { TemplateField } from '@/features/designer/inspector/TemplateField'
import type { TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import {
  WEEKDAYS,
  emptyDocumentField,
  emptyDocumentTableColumn,
  isCopyTemplateKind,
  templateInputsOf,
  type CartContent,
  type DocumentContent,
  type DocumentField,
  type DocumentFormat,
  type DocumentTableColumn,
  type EmailContent,
  type FaqContent,
  type HoursContent,
  type LegalContent,
  type MenuContent,
  type MessageContent,
  type ReceiptContent,
  type SsoContent,
  type TemplateContent,
  type TemplateKind,
} from '@/features/templates/templateModel'
import { DocumentPageEditor, ensurePageBlocks } from '@/features/templates/DocumentPageEditor'
import { StoreCatalogEditor } from '@/features/templates/StoreCatalogEditor'
import { TemplateInputsEditor } from '@/features/templates/TemplateInputsEditor'
import type { ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

function asEmail(c: TemplateContent): EmailContent {
  return c as EmailContent
}
function asFaq(c: TemplateContent): FaqContent {
  return c as FaqContent
}
function asCart(c: TemplateContent): CartContent {
  return c as CartContent
}
function asMenu(c: TemplateContent): MenuContent {
  return c as MenuContent
}
function asMessage(c: TemplateContent): MessageContent {
  return c as MessageContent
}
function asHours(c: TemplateContent): HoursContent {
  return c as HoursContent
}
function asLegal(c: TemplateContent): LegalContent {
  return c as LegalContent
}
function asReceipt(c: TemplateContent): ReceiptContent {
  return c as ReceiptContent
}
function asDocument(c: TemplateContent): DocumentContent {
  return c as DocumentContent
}
function asSso(c: TemplateContent): SsoContent {
  return c as SsoContent
}

export function TemplateContentEditor({
  kind,
  content,
  onChange,
  suggestions,
  readOnly,
  media,
}: {
  kind: TemplateKind
  content: TemplateContent
  onChange: (next: TemplateContent) => void
  suggestions: TemplateSuggestion[]
  readOnly?: boolean
  media?: ChatbotMediaFile[]
}) {
  const fields = (
    <TemplateKindFields
      kind={kind}
      content={content}
      onChange={onChange}
      suggestions={suggestions}
      readOnly={readOnly}
      media={media}
    />
  )
  if (!isCopyTemplateKind(kind)) return fields
  return (
    <div className="space-y-6">
      <TemplateInputsEditor
        inputs={templateInputsOf(content)}
        readOnly={readOnly}
        onChange={(inputs) => onChange({ ...(content as object), inputs } as TemplateContent)}
      />
      {fields}
    </div>
  )
}

function TemplateKindFields({
  kind,
  content,
  onChange,
  suggestions,
  readOnly,
  media,
}: {
  kind: TemplateKind
  content: TemplateContent
  onChange: (next: TemplateContent) => void
  suggestions: TemplateSuggestion[]
  readOnly?: boolean
  media?: ChatbotMediaFile[]
}) {
  if (kind === 'email') {
    const c = asEmail(content)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Subject</Label>
            <TemplateField
              disabled={readOnly}
              value={c.subject}
              suggestions={suggestions}
              onChange={(subject) => onChange({ ...c, subject })}
              placeholder="Order {{inputs.order_id}} confirmed"
            />
          </div>
          <div>
            <Label>HTML body</Label>
            <Textarea
              disabled={readOnly}
              value={c.html}
              onChange={(e) => onChange({ ...c, html: e.target.value })}
              className="min-h-[320px] font-mono text-[12px]"
              placeholder="<h1>Hello {{inputs.name}}</h1>"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              Use {'{{inputs.key}}'} — bind those inputs on the Email step when the message is sent.
            </p>
          </div>
        </div>
        <div>
          <Label>Preview</Label>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={c.html || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">HTML preview appears here.</p>'}
            className="h-[420px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        </div>
      </div>
    )
  }

  if (kind === 'faq') {
    const c = asFaq(content)
    return (
      <div className="space-y-3">
        <div>
          <Label>Intro</Label>
          <TemplateField
            disabled={readOnly}
            value={c.intro}
            suggestions={suggestions}
            onChange={(intro) => onChange({ ...c, intro })}
            placeholder="Here are answers to common questions:"
          />
        </div>
        {c.items.map((item, index) => (
          <div key={index} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--color-ink-muted)]">Question {index + 1}</p>
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly || c.items.length <= 1}
                onClick={() => onChange({ ...c, items: c.items.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              disabled={readOnly}
              value={item.question}
              onChange={(e) => {
                const items = c.items.map((row, i) => (i === index ? { ...row, question: e.target.value } : row))
                onChange({ ...c, items })
              }}
              placeholder="How do I reset my password?"
            />
            <Textarea
              disabled={readOnly}
              className="mt-2"
              value={item.answer}
              onChange={(e) => {
                const items = c.items.map((row, i) => (i === index ? { ...row, answer: e.target.value } : row))
                onChange({ ...c, items })
              }}
              placeholder="Open Settings → Security, then choose Reset password."
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          disabled={readOnly}
          onClick={() => onChange({ ...c, items: [...c.items, { question: '', answer: '' }] })}
        >
          <Plus className="h-3.5 w-3.5" />
          Add question
        </Button>
      </div>
    )
  }

  if (kind === 'cart') {
    return (
      <StoreCatalogEditor
        content={asCart(content)}
        onChange={onChange}
        suggestions={suggestions}
        readOnly={readOnly}
        media={media}
      />
    )
  }

  if (kind === 'menu') {
    const c = asMenu(content)
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input disabled={readOnly} value={c.title} onChange={(e) => onChange({ ...c, title: e.target.value })} />
        </div>
        {c.items.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
            <Input
              disabled={readOnly}
              value={item.label}
              placeholder="Label"
              onChange={(e) => {
                const items = c.items.map((row, i) => (i === index ? { ...row, label: e.target.value } : row))
                onChange({ ...c, items })
              }}
            />
            <Input
              disabled={readOnly}
              value={item.description}
              placeholder="Description"
              onChange={(e) => {
                const items = c.items.map((row, i) => (i === index ? { ...row, description: e.target.value } : row))
                onChange({ ...c, items })
              }}
            />
            <Input
              disabled={readOnly}
              value={item.value}
              placeholder="Value"
              onChange={(e) => {
                const items = c.items.map((row, i) => (i === index ? { ...row, value: e.target.value } : row))
                onChange({ ...c, items })
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={readOnly || c.items.length <= 1}
              onClick={() => onChange({ ...c, items: c.items.filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          disabled={readOnly}
          onClick={() => onChange({ ...c, items: [...c.items, { label: '', description: '', value: '' }] })}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </Button>
      </div>
    )
  }

  if (kind === 'message') {
    const c = asMessage(content)
    return (
      <div>
        <Label>Message</Label>
        <TemplateField
          disabled={readOnly}
          multiline
          value={c.text}
          suggestions={suggestions}
          onChange={(text) => onChange({ ...c, text })}
          placeholder="Hi {{inputs.name}} — how can I help?"
        />
      </div>
    )
  }

  if (kind === 'hours') {
    const c = asHours(content)
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Timezone</Label>
            <Input
              disabled={readOnly}
              value={c.timezone}
              onChange={(e) => onChange({ ...c, timezone: e.target.value })}
              placeholder="Africa/Johannesburg"
            />
          </div>
          <div>
            <Label>Note</Label>
            <Input disabled={readOnly} value={c.note} onChange={(e) => onChange({ ...c, note: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          {(c.days.length ? c.days : WEEKDAYS.map((day) => ({ day, open: '09:00', close: '17:00', closed: false }))).map(
            (day, index) => (
              <div key={day.day || index} className="grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-2">
                <p className="text-sm font-medium text-[var(--color-ink)]">{day.day}</p>
                <Input
                  disabled={readOnly || day.closed}
                  type="time"
                  value={day.open}
                  onChange={(e) => {
                    const days = c.days.map((row, i) => (i === index ? { ...row, open: e.target.value } : row))
                    onChange({ ...c, days })
                  }}
                />
                <Input
                  disabled={readOnly || day.closed}
                  type="time"
                  value={day.close}
                  onChange={(e) => {
                    const days = c.days.map((row, i) => (i === index ? { ...row, close: e.target.value } : row))
                    onChange({ ...c, days })
                  }}
                />
                <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={day.closed}
                    onChange={(e) => {
                      const days = c.days.map((row, i) => (i === index ? { ...row, closed: e.target.checked } : row))
                      onChange({ ...c, days })
                    }}
                  />
                  Closed
                </label>
              </div>
            ),
          )}
        </div>
      </div>
    )
  }

  if (kind === 'legal') {
    const c = asLegal(content)
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input disabled={readOnly} value={c.title} onChange={(e) => onChange({ ...c, title: e.target.value })} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            disabled={readOnly}
            className="min-h-40"
            value={c.body}
            onChange={(e) => onChange({ ...c, body: e.target.value })}
          />
        </div>
      </div>
    )
  }

  if (kind === 'document') {
    const c = asDocument(content)
    function patchField(index: number, patch: Partial<DocumentField>) {
      const fields = c.fields.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, fields })
    }
    function patchColumn(index: number, patch: Partial<DocumentTableColumn>) {
      const tableColumns = c.tableColumns.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, tableColumns })
    }
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>File type</Label>
            <Select
              disabled={readOnly}
              value={c.format}
              onChange={(e) => {
                const format = e.target.value as DocumentFormat
                const nextName = c.filename.replace(/\.[A-Za-z0-9]+$/, '') || 'document'
                onChange({ ...c, format, filename: `${nextName}.${format}` })
              }}
            >
              <option value="pdf">PDF</option>
              <option value="docx">Word (.docx)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </Select>
          </div>
          <div>
            <Label>Download name</Label>
            <TemplateField
              disabled={readOnly}
              value={c.filename}
              suggestions={suggestions}
              onChange={(filename) => onChange({ ...c, filename })}
              placeholder={`agreement-{{inputs.name}}.${c.format}`}
            />
          </div>
        </div>
        <div>
          <Label>Layout</Label>
          <Select
            disabled={readOnly}
            value={c.layout}
            onChange={(e) => {
              const layout = e.target.value === 'page' ? 'page' : 'flow'
              onChange({
                ...c,
                layout,
                blocks: layout === 'page' ? ensurePageBlocks(c) : c.blocks,
              })
            }}
          >
            <option value="flow">List (top to bottom)</option>
            <option value="page">Page (drag on A4)</option>
          </Select>
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Page layout is a Word-style canvas: place headings, fields, and signatures exactly where they should print.
            Snap to the grid and other blocks, then set font and color per block. Best fidelity is PDF.
          </p>
        </div>
        <div>
          <Label>Page orientation</Label>
          <Select
            disabled={readOnly}
            value={c.orientation === 'landscape' ? 'landscape' : 'portrait'}
            onChange={(e) =>
              onChange({
                ...c,
                orientation: e.target.value === 'landscape' ? 'landscape' : 'portrait',
              })
            }
          >
            <option value="portrait">Portrait (A4 tall)</option>
            <option value="landscape">Landscape (A4 wide)</option>
          </Select>
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Applies to PDF and Word. Page layout canvas matches the chosen orientation.
          </p>
        </div>
        {c.layout === 'page' ? (
          <DocumentPageEditor content={c} onChange={onChange} suggestions={suggestions} readOnly={readOnly} />
        ) : (
          <>
        <div>
          <Label>Title</Label>
          <TemplateField
            disabled={readOnly}
            value={c.title}
            suggestions={suggestions}
            onChange={(title) => onChange({ ...c, title })}
            placeholder="Service agreement"
          />
        </div>
        <div>
          <Label>Intro</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.intro}
            suggestions={suggestions}
            onChange={(intro) => onChange({ ...c, intro })}
          />
        </div>
        <div className="space-y-2">
          <Label>Fields</Label>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Map answers into the file. Use Image for a signature or photo stored as a file object.
          </p>
          {c.fields.map((field, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 sm:grid-cols-[1fr_1fr_7.5rem_auto]"
            >
              <Input
                disabled={readOnly}
                value={field.label}
                placeholder="Label"
                onChange={(e) => patchField(index, { label: e.target.value })}
              />
              <TemplateField
                disabled={readOnly}
                value={field.value}
                suggestions={suggestions}
                onChange={(value) => patchField(index, { value })}
                placeholder="{{inputs.name}}"
              />
              <Select
                disabled={readOnly}
                value={field.as}
                onChange={(e) => patchField(index, { as: e.target.value === 'image' ? 'image' : 'text' })}
              >
                <option value="text">Text</option>
                <option value="image">Image</option>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly || c.fields.length <= 1}
                onClick={() => onChange({ ...c, fields: c.fields.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, fields: [...c.fields, emptyDocumentField()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add field
          </Button>
        </div>
        <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
          <Label>Data table (multiple rows)</Label>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Bind an array of objects (or JSON array string). Excel writes a header row plus one row per item.
            Example source: {'{{inputs.lines}}'} or {'{{vars.items}}'} with columns key <code className="font-mono">name</code>,{' '}
            <code className="font-mono">qty</code>. Leave columns empty to infer keys from the first object.
          </p>
          <div>
            <Label>Rows source</Label>
            <TemplateField
              disabled={readOnly}
              value={c.tableRowsSource}
              suggestions={suggestions}
              onChange={(tableRowsSource) => onChange({ ...c, tableRowsSource })}
              placeholder="{{inputs.lines}} or {{vars.items}}"
            />
          </div>
          {c.tableColumns.map((col, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-2 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                disabled={readOnly}
                value={col.key}
                placeholder="Property key (e.g. name)"
                onChange={(e) => patchColumn(index, { key: e.target.value })}
              />
              <Input
                disabled={readOnly}
                value={col.label}
                placeholder="Header label"
                onChange={(e) => patchColumn(index, { label: e.target.value })}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() =>
                  onChange({ ...c, tableColumns: c.tableColumns.filter((_, i) => i !== index) })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, tableColumns: [...c.tableColumns, emptyDocumentTableColumn()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add column
          </Button>
        </div>
        <div>
          <Label>Body</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.body}
            suggestions={suggestions}
            onChange={(body) => onChange({ ...c, body })}
          />
        </div>
        <div>
          <Label>Footer</Label>
          <TemplateField
            disabled={readOnly}
            value={c.footer}
            suggestions={suggestions}
            onChange={(footer) => onChange({ ...c, footer })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={c.includeCart}
            onChange={(e) => onChange({ ...c, includeCart: e.target.checked })}
          />
          Include shop cart line items when a cart variable is set
        </label>
          </>
        )}
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          Insert {'{{templates.key.file}}'} on a Message or End step. Visitors get a download chip; the file is built
          from this conversation’s answers (including signatures) when they click it.
        </p>
      </div>
    )
  }

  if (kind === 'agreement') {
    const c = asDocument(content)
    function patchField(index: number, patch: Partial<DocumentField>) {
      const fields = c.fields.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, fields })
    }
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-[11px] text-slate-600">
          Adobe Sign–style agreement: collect party details and a signature in the flow, then send{' '}
          <code className="font-mono">{'{{templates.key.file}}'}</code> on a Message or End step so the visitor
          downloads a signed PDF.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Agreement name</Label>
            <TemplateField
              disabled={readOnly}
              value={c.title}
              suggestions={suggestions}
              onChange={(title) => onChange({ ...c, title })}
              placeholder="Service agreement"
            />
          </div>
          <div>
            <Label>Download file name</Label>
            <TemplateField
              disabled={readOnly}
              value={c.filename}
              suggestions={suggestions}
              onChange={(filename) => onChange({ ...c, filename, format: 'pdf' })}
              placeholder="agreement-{{inputs.signer_name}}.pdf"
            />
          </div>
        </div>
        <div>
          <Label>Message to signer</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.intro}
            suggestions={suggestions}
            onChange={(intro) => onChange({ ...c, intro })}
            placeholder="Please review and sign…"
          />
        </div>
        <div>
          <Label>Agreement terms</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.body}
            suggestions={suggestions}
            onChange={(body) => onChange({ ...c, body })}
            placeholder="1. Parties… 2. Scope… 3. Acceptance…"
          />
        </div>
        <div className="space-y-2">
          <Label>Parties, signature & date</Label>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Use <span className="font-medium">Image</span> for the signature field (bind a Signature question). Use
            text for names, email, company, and date signed.
          </p>
          {c.fields.map((field, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 sm:grid-cols-[1fr_1fr_7.5rem_auto]"
            >
              <Input
                disabled={readOnly}
                value={field.label}
                placeholder="Label"
                onChange={(e) => patchField(index, { label: e.target.value })}
              />
              <TemplateField
                disabled={readOnly}
                value={field.value}
                suggestions={suggestions}
                onChange={(value) => patchField(index, { value })}
                placeholder="{{inputs.signer_name}}"
              />
              <Select
                disabled={readOnly}
                value={field.as}
                onChange={(e) => patchField(index, { as: e.target.value === 'image' ? 'image' : 'text' })}
              >
                <option value="text">Text</option>
                <option value="image">Signature / image</option>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly || c.fields.length <= 1}
                onClick={() => onChange({ ...c, fields: c.fields.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() => onChange({ ...c, fields: [...c.fields, emptyDocumentField()] })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add field
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() =>
                onChange({
                  ...c,
                  fields: [
                    ...c.fields,
                    { label: 'Signature', value: '{{inputs.signature}}', as: 'image' },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add signature
            </Button>
          </div>
        </div>
        <div>
          <Label>Footer / completion note</Label>
          <TemplateField
            disabled={readOnly}
            value={c.footer}
            suggestions={suggestions}
            onChange={(footer) => onChange({ ...c, footer })}
            placeholder="Electronically signed via FlowForge…"
          />
        </div>
        <div>
          <Label>Layout</Label>
          <Select
            disabled={readOnly}
            value={c.layout}
            onChange={(e) => {
              const layout = e.target.value === 'page' ? 'page' : 'flow'
              onChange({
                ...c,
                format: 'pdf',
                layout,
                blocks: layout === 'page' ? ensurePageBlocks(c) : c.blocks,
              })
            }}
          >
            <option value="flow">List (top to bottom)</option>
            <option value="page">Page (place signatures on A4)</option>
          </Select>
        </div>
        {c.layout === 'page' ? (
          <DocumentPageEditor
            content={{ ...c, format: 'pdf' }}
            onChange={(next) => onChange({ ...next, format: 'pdf' })}
            suggestions={suggestions}
            readOnly={readOnly}
          />
        ) : null}
        <p className="text-[11px] text-[var(--color-ink-muted)]">
          Typical flow: ask name / email / scope → Signature question → Message with{' '}
          {'{{templates.agreement.file}}'} and bind inputs (including signature).
        </p>
      </div>
    )
  }

  if (kind === 'sso') {
    const c = asSso(content)
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Protocol</Label>
            <Select
              disabled={readOnly}
              value={c.protocol}
              onChange={(e) =>
                onChange({ ...c, protocol: e.target.value === 'saml' ? 'saml' : 'oidc' })
              }
            >
              <option value="oidc">OIDC</option>
              <option value="saml">SAML</option>
            </Select>
          </div>
          <div>
            <Label>Provider name</Label>
            <Input
              disabled={readOnly}
              value={c.providerName}
              onChange={(e) => onChange({ ...c, providerName: e.target.value })}
              placeholder="Company SSO"
            />
          </div>
        </div>
        <div>
          <Label>Button label</Label>
          <Input
            disabled={readOnly}
            value={c.buttonLabel}
            onChange={(e) => onChange({ ...c, buttonLabel: e.target.value })}
            placeholder="Continue with SSO"
          />
        </div>
        {c.protocol === 'saml' ? (
          <div className="space-y-2 rounded-xl border border-[var(--color-border)]/60 p-3">
            <p className="text-[11px] font-medium text-[var(--color-ink-muted)]">SAML IdP</p>
            <Input
              disabled={readOnly}
              value={c.samlEntityId}
              onChange={(e) => onChange({ ...c, samlEntityId: e.target.value })}
              placeholder="Entity ID"
            />
            <Input
              disabled={readOnly}
              value={c.samlSsoUrl}
              onChange={(e) => onChange({ ...c, samlSsoUrl: e.target.value })}
              placeholder="SSO URL"
            />
            <Input
              disabled={readOnly}
              value={c.samlAcsUrl}
              onChange={(e) => onChange({ ...c, samlAcsUrl: e.target.value })}
              placeholder="https://…/flowforge/api/chat/sso_callback"
            />
            <p className="text-[11px] text-[var(--color-ink-muted)]">
              Register this ACS URL with your IdP. Use the FlowForge API callback
              (<code className="text-[10px]">/api/chat/sso_callback</code>) so chat progress is kept
              and the provider user object is returned into variables.
            </p>
            <Textarea
              disabled={readOnly}
              rows={4}
              value={c.samlCertificate}
              onChange={(e) => onChange({ ...c, samlCertificate: e.target.value })}
              placeholder="PEM certificate"
              className="font-mono text-xs"
            />
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-[var(--color-border)]/60 p-3">
            <p className="text-[11px] font-medium text-[var(--color-ink-muted)]">OIDC IdP</p>
            <Input
              disabled={readOnly}
              value={c.oidcIssuer}
              onChange={(e) => onChange({ ...c, oidcIssuer: e.target.value })}
              placeholder="Issuer"
            />
            <Input
              disabled={readOnly}
              value={c.oidcClientId}
              onChange={(e) => onChange({ ...c, oidcClientId: e.target.value })}
              placeholder="Client ID"
            />
            <Input
              disabled={readOnly}
              type="password"
              autoComplete="off"
              value={c.oidcClientSecret}
              onChange={(e) => onChange({ ...c, oidcClientSecret: e.target.value })}
              placeholder="Client secret (prefer server vault in production)"
            />
            <Input
              disabled={readOnly}
              value={c.oidcAuthorizationUrl}
              onChange={(e) => onChange({ ...c, oidcAuthorizationUrl: e.target.value })}
              placeholder="Authorization URL"
            />
            <Input
              disabled={readOnly}
              value={c.oidcTokenUrl}
              onChange={(e) => onChange({ ...c, oidcTokenUrl: e.target.value })}
              placeholder="Token URL"
            />
            <Input
              disabled={readOnly}
              value={c.oidcJwksUrl}
              onChange={(e) => onChange({ ...c, oidcJwksUrl: e.target.value })}
              placeholder="JWKS URL"
            />
            <Input
              disabled={readOnly}
              value={c.oidcScopes}
              onChange={(e) => onChange({ ...c, oidcScopes: e.target.value })}
              placeholder="openid email profile"
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Email claim</Label>
            <Input
              disabled={readOnly}
              value={c.emailClaim}
              onChange={(e) => onChange({ ...c, emailClaim: e.target.value })}
              placeholder="email"
            />
          </div>
          <div>
            <Label>User id claim</Label>
            <Input
              disabled={readOnly}
              value={c.userIdClaim}
              onChange={(e) => onChange({ ...c, userIdClaim: e.target.value })}
              placeholder="sub"
            />
          </div>
        </div>
        <div>
          <Label>Preview email</Label>
          <Input
            disabled={readOnly}
            type="email"
            value={c.previewEmail}
            onChange={(e) => onChange({ ...c, previewEmail: e.target.value })}
            placeholder="sso.user@example.com"
          />
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Used when simulating IdP success in designer preview. Reference this template from a Sign-in
            step (Source → SSO).
          </p>
        </div>
      </div>
    )
  }

  const c = asReceipt(content)
  return (
    <div className="space-y-3">
      <div>
        <Label>Title</Label>
        <Input disabled={readOnly} value={c.title} onChange={(e) => onChange({ ...c, title: e.target.value })} />
      </div>
      <div>
        <Label>Intro</Label>
        <TemplateField
          disabled={readOnly}
          multiline
          value={c.intro}
          suggestions={suggestions}
          onChange={(intro) => onChange({ ...c, intro })}
        />
      </div>
      <div>
        <Label>Footer</Label>
        <TemplateField
          disabled={readOnly}
          value={c.footer}
          suggestions={suggestions}
          onChange={(footer) => onChange({ ...c, footer })}
        />
      </div>
    </div>
  )
}
