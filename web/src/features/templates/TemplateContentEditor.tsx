import {
  Users,
  Briefcase,
  Share2,
  Plus, Trash2 } from 'lucide-react'
import { TemplateField } from '@/features/designer/inspector/TemplateField'
import type { TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import {
  WEEKDAYS,
  emptyDocumentField,
  emptyDocumentTableColumn,
  emptyAppointmentService,
  emptyLocationEntry,
  emptyMapPin,
  emptyTeamMember,
  emptyPricingPlan,
  emptySurveyQuestion,
  emptyTicketField,
  emptyWebhookHeader,
  isCopyTemplateKind,
  templateInputsOf,
  type AnnouncementContent,
  type AnnouncementSeverity,
  type AppointmentContent,
  type AppointmentService,
  type CartContent,
  type ConsentContent,
  type DocumentContent,
  type DocumentField,
  type DocumentFormat,
  type DocumentTableColumn,
  type EmailContent,
  type FaqContent,
  type HoursContent,
  type LegalContent,
  type LocationContent,
  type LocationEntry,
  type MapContent,
  type MapPin,
  type MenuContent,
  type MessageContent,
  type PricingContent,
  type PricingPlan,
  type PushContent,
  type SocialShareContent,
  type SocialSharePlatform,
  type QrContent,
  type QrErrorCorrection,
  type ReceiptContent,
  type SmsChannel,
  type SmsContent,
  type SsoContent,
  type SurveyContent,
  type SurveyQuestion,
  type SurveyQuestionKind,
  type TeamContent,
  type TeamMember,
  type TemplateContent,
  type TemplateKind,
  type TicketContent,
  type TicketField,
  type TicketPriority,
  type WebhookContent,
  type WebhookHeader,
  type WebhookMethod,
SOCIAL_SHARE_PLATFORM_META, defaultSocialSharePlatforms, } from '@/features/templates/templateModel'
import { DocumentPageEditor, ensurePageBlocks } from '@/features/templates/DocumentPageEditor'
import { StoreCatalogEditor } from '@/features/templates/StoreCatalogEditor'
import { PaymentTemplateEditor } from './PaymentTemplateEditor'
import { parsePaymentTemplateContent } from './paymentTemplate'
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
function asAppointment(c: TemplateContent): AppointmentContent {
  return c as AppointmentContent
}
function asLocation(c: TemplateContent): LocationContent {
  return c as LocationContent
}
function asMap(c: TemplateContent): MapContent {
  return c as MapContent
}
function asQr(c: TemplateContent): QrContent {
  return c as QrContent
}
function asTeam(c: TemplateContent): TeamContent {
  return c as TeamContent
}
function asPricing(c: TemplateContent): PricingContent {
  return c as PricingContent
}
function asSurvey(c: TemplateContent): SurveyContent {
  return c as SurveyContent
}
function asAnnouncement(c: TemplateContent): AnnouncementContent {
  return c as AnnouncementContent
}
function asSms(c: TemplateContent): SmsContent {
  return c as SmsContent
}
function asPush(c: TemplateContent): PushContent {
  return c as PushContent
}
function asTicket(c: TemplateContent): TicketContent {
  return c as TicketContent
}
function asConsent(c: TemplateContent): ConsentContent {
  return c as ConsentContent
}
function asWebhook(c: TemplateContent): WebhookContent {
  return c as WebhookContent
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
  if (kind === 'payment') return <PaymentTemplateEditor content={parsePaymentTemplateContent(content)} onChange={onChange} suggestions={suggestions} readOnly={readOnly} />
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

  if (kind === 'appointment') {
    const c = asAppointment(content)
    function patchService(index: number, patch: Partial<AppointmentService>) {
      const services = c.services.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, services })
    }
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <TemplateField
            disabled={readOnly}
            value={c.title}
            suggestions={suggestions}
            onChange={(title) => onChange({ ...c, title })}
            placeholder="Book an appointment"
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
        <div>
          <Label>Timezone</Label>
          <Input
            disabled={readOnly}
            value={c.timezone}
            onChange={(e) => onChange({ ...c, timezone: e.target.value })}
            placeholder="Africa/Johannesburg"
          />
        </div>
        <div className="space-y-2">
          <Label>Services</Label>
          {c.services.map((svc, index) => (
            <div
              key={svc.id || index}
              className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 sm:grid-cols-[1fr_5rem_1fr_auto]"
            >
              <Input
                disabled={readOnly}
                value={svc.name}
                placeholder="Service name"
                onChange={(e) => patchService(index, { name: e.target.value })}
              />
              <Input
                disabled={readOnly}
                type="number"
                value={svc.durationMinutes}
                min={5}
                placeholder="30"
                onChange={(e) => patchService(index, { durationMinutes: Number(e.target.value) || 30 })}
              />
              <Input
                disabled={readOnly}
                value={svc.description}
                placeholder="Description"
                onChange={(e) => patchService(index, { description: e.target.value })}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly || c.services.length <= 1}
                onClick={() => onChange({ ...c, services: c.services.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, services: [...c.services, emptyAppointmentService()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add service
          </Button>
        </div>
        <div>
          <Label>Note</Label>
          <TemplateField
            disabled={readOnly}
            value={c.note}
            suggestions={suggestions}
            onChange={(note) => onChange({ ...c, note })}
          />
        </div>
      </div>
    )
  }

  if (kind === 'location') {
    const c = asLocation(content)
    function patchLocation(index: number, patch: Partial<LocationEntry>) {
      const locations = c.locations.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, locations })
    }
    return (
      <div className="space-y-3">
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
          <Label>Locations</Label>
          {c.locations.map((loc, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">Location {index + 1}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || c.locations.length <= 1}
                  onClick={() => onChange({ ...c, locations: c.locations.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  disabled={readOnly}
                  value={loc.name}
                  placeholder="Name"
                  onChange={(e) => patchLocation(index, { name: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={loc.city}
                  placeholder="City"
                  onChange={(e) => patchLocation(index, { city: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={loc.address}
                  placeholder="Address"
                  className="sm:col-span-2"
                  onChange={(e) => patchLocation(index, { address: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={loc.phone}
                  placeholder="Phone"
                  onChange={(e) => patchLocation(index, { phone: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  type="email"
                  value={loc.email}
                  placeholder="Email"
                  onChange={(e) => patchLocation(index, { email: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={loc.hoursNote}
                  placeholder="Hours note"
                  onChange={(e) => patchLocation(index, { hoursNote: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={loc.mapUrl}
                  placeholder="Map URL"
                  onChange={(e) => patchLocation(index, { mapUrl: e.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, locations: [...c.locations, emptyLocationEntry()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add location
          </Button>
        </div>
      </div>
    )
  }

  if (kind === 'map') {
    const c = asMap(content)
    function patchPin(index: number, patch: Partial<MapPin>) {
      const pins = c.pins.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, pins })
    }
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Title</Label>
            <TemplateField
              disabled={readOnly}
              value={c.title}
              suggestions={suggestions}
              onChange={(title) => onChange({ ...c, title })}
            />
          </div>
          <div>
            <Label>Map style</Label>
            <Select
              disabled={readOnly}
              value={c.style}
              onChange={(e) =>
                onChange({ ...c, style: e.target.value === 'satellite' ? 'satellite' : 'roadmap' })
              }
            >
              <option value="roadmap">Roadmap (OpenStreetMap)</option>
              <option value="satellite">Satellite (use custom embed URL)</option>
            </Select>
          </div>
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
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Center latitude</Label>
            <Input
              disabled={readOnly}
              value={c.centerLat}
              placeholder="-26.2041"
              onChange={(e) => onChange({ ...c, centerLat: e.target.value })}
            />
          </div>
          <div>
            <Label>Center longitude</Label>
            <Input
              disabled={readOnly}
              value={c.centerLng}
              placeholder="28.0473"
              onChange={(e) => onChange({ ...c, centerLng: e.target.value })}
            />
          </div>
          <div>
            <Label>Zoom (1–19)</Label>
            <Input
              disabled={readOnly}
              type="number"
              min={1}
              max={19}
              value={String(c.zoom)}
              onChange={(e) => {
                const n = Number(e.target.value)
                onChange({
                  ...c,
                  zoom: Number.isFinite(n) ? Math.max(1, Math.min(19, Math.round(n))) : 12,
                })
              }}
            />
          </div>
        </div>
        <div>
          <Label>Custom embed URL (optional)</Label>
          <Input
            disabled={readOnly}
            value={c.embedUrl}
            placeholder="https://… iframe src — overrides generated map"
            onChange={(e) => onChange({ ...c, embedUrl: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Leave empty to generate an OpenStreetMap embed from the center / first pin.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Pins</Label>
          {c.pins.map((pin, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">Pin {index + 1}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || c.pins.length <= 1}
                  onClick={() => onChange({ ...c, pins: c.pins.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  disabled={readOnly}
                  value={pin.label}
                  placeholder="Label"
                  onChange={(e) => patchPin(index, { label: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={pin.link}
                  placeholder="Link (optional)"
                  onChange={(e) => patchPin(index, { link: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={pin.lat}
                  placeholder="Latitude"
                  onChange={(e) => patchPin(index, { lat: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={pin.lng}
                  placeholder="Longitude"
                  onChange={(e) => patchPin(index, { lng: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={pin.description}
                  placeholder="Description"
                  className="sm:col-span-2"
                  onChange={(e) => patchPin(index, { description: e.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, pins: [...c.pins, emptyMapPin()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add pin
          </Button>
        </div>
      </div>
    )
  }

  if (kind === 'qr') {
    const c = asQr(content)
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Title</Label>
            <TemplateField
              disabled={readOnly}
              value={c.title}
              suggestions={suggestions}
              placeholder="Scan to continue"
              onChange={(title) => onChange({ ...c, title })}
            />
          </div>
          <div>
            <Label>Download filename</Label>
            <TemplateField
              disabled={readOnly}
              value={c.filename}
              suggestions={suggestions}
              placeholder="qr.png"
              onChange={(filename) => onChange({ ...c, filename })}
            />
          </div>
        </div>
        <div>
          <Label>Caption</Label>
          <TemplateField
            disabled={readOnly}
            value={c.caption}
            suggestions={suggestions}
            placeholder="Point your camera at this code"
            onChange={(caption) => onChange({ ...c, caption })}
          />
        </div>
        <div>
          <Label>Payload (URL or text)</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.payload}
            suggestions={suggestions}
            placeholder="{{inputs.url}}"
            onChange={(payload) => onChange({ ...c, payload })}
          />
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Encoded into the QR. Use {'{{inputs.*}}'} or a literal https URL.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Size (px)</Label>
            <Input
              disabled={readOnly}
              type="number"
              min={64}
              max={512}
              value={String(c.size)}
              onChange={(e) => {
                const n = Number(e.target.value)
                onChange({
                  ...c,
                  size: Number.isFinite(n) ? Math.max(64, Math.min(512, Math.round(n))) : 180,
                })
              }}
            />
          </div>
          <div>
            <Label>Error correction</Label>
            <Select
              disabled={readOnly}
              value={c.errorCorrection}
              onChange={(e) => {
                const v = e.target.value as QrErrorCorrection
                onChange({
                  ...c,
                  errorCorrection: v === 'L' || v === 'Q' || v === 'H' ? v : 'M',
                })
              }}
            >
              <option value="L">L — low (~7%)</option>
              <option value="M">M — medium (~15%)</option>
              <option value="Q">Q — quartile (~25%)</option>
              <option value="H">H — high (~30%)</option>
            </Select>
          </div>
          <div>
            <Label>Foreground</Label>
            <Input
              disabled={readOnly}
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(c.foreground) ? c.foreground : '#0f172a'}
              onChange={(e) => onChange({ ...c, foreground: e.target.value })}
            />
          </div>
          <div>
            <Label>Background</Label>
            <Input
              disabled={readOnly}
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(c.background) ? c.background : '#ffffff'}
              onChange={(e) => onChange({ ...c, background: e.target.value })}
            />
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'social_share') {
    const c = (content as SocialShareContent)
    const platforms = c.platforms?.length ? c.platforms : defaultSocialSharePlatforms()
    function patchPlatform(id: string, patch: Partial<SocialSharePlatform>) {
      const next = platforms.map((p: SocialSharePlatform) => (p.id === id ? { ...p, ...patch } : p))
      onChange({ ...c, platforms: next })
    }
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <TemplateField
            disabled={readOnly}
            value={c.title ?? ''}
            suggestions={suggestions}
            onChange={(title) => onChange({ ...c, title })}
          />
        </div>
        <div>
          <Label>Share text</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.text ?? ''}
            suggestions={suggestions}
            onChange={(text) => onChange({ ...c, text })}
          />
        </div>
        <div className="space-y-2">
          <Label>Platforms</Label>
          <p className="text-[11px] text-[var(--color-ink-muted)]">
            Enable an app and set its own URL or @username. Off or empty = hidden.
          </p>
          {platforms.map((p: SocialSharePlatform) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center"
            >
              <label className="flex min-w-[9rem] items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={!!p.enabled}
                  onChange={(ev) => patchPlatform(p.id, { enabled: ev.target.checked })}
                />
                {p.id === 'x' ? (
                  <Share2 className="h-4 w-4 shrink-0 text-sky-500" />
                ) : p.id === 'linkedin' ? (
                  <Briefcase className="h-4 w-4 shrink-0 text-blue-600" />
                ) : (
                  <Users className="h-4 w-4 shrink-0 text-blue-500" />
                )}
                {SOCIAL_SHARE_PLATFORM_META[p.id]?.label ?? p.id}
              </label>
              <div className="min-w-0 flex-1">
                <TemplateField
                  disabled={readOnly || !p.enabled}
                  value={p.url ?? ''}
                  suggestions={suggestions}
                  onChange={(url) => patchPlatform(p.id, { url })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  
  if (kind === 'team') {
    const c = asTeam(content)
    function patchMember(index: number, patch: Partial<TeamMember>) {
      const members = c.members.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, members })
    }
    return (
      <div className="space-y-3">
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
          <Label>Team members</Label>
          {c.members.map((member, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">Member {index + 1}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || c.members.length <= 1}
                  onClick={() => onChange({ ...c, members: c.members.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  disabled={readOnly}
                  value={member.name}
                  placeholder="Name"
                  onChange={(e) => patchMember(index, { name: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={member.role}
                  placeholder="Role"
                  onChange={(e) => patchMember(index, { role: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={member.skills}
                  placeholder="Skills"
                  onChange={(e) => patchMember(index, { skills: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  type="email"
                  value={member.email}
                  placeholder="Email"
                  onChange={(e) => patchMember(index, { email: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  value={member.handoffKey}
                  placeholder="Handoff key"
                  className="sm:col-span-2"
                  onChange={(e) => patchMember(index, { handoffKey: e.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, members: [...c.members, emptyTeamMember()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add member
          </Button>
        </div>
      </div>
    )
  }

  if (kind === 'pricing') {
    const c = asPricing(content)
    function patchPlan(index: number, patch: Partial<PricingPlan>) {
      const plans = c.plans.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, plans })
    }
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Currency</Label>
            <Input
              disabled={readOnly}
              value={c.currency}
              onChange={(e) => onChange({ ...c, currency: e.target.value })}
              placeholder="USD"
            />
          </div>
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
          <Label>Plans</Label>
          {c.plans.map((plan, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">Plan {index + 1}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || c.plans.length <= 1}
                  onClick={() => onChange({ ...c, plans: c.plans.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  disabled={readOnly}
                  value={plan.name}
                  placeholder="Plan name"
                  onChange={(e) => patchPlan(index, { name: e.target.value })}
                />
                <Input
                  disabled={readOnly}
                  type="number"
                  value={plan.price}
                  min={0}
                  placeholder="0"
                  onChange={(e) => patchPlan(index, { price: Number(e.target.value) || 0 })}
                />
                <Input
                  disabled={readOnly}
                  value={plan.period}
                  placeholder="month"
                  onChange={(e) => patchPlan(index, { period: e.target.value })}
                />
              </div>
              <div className="mt-2">
                <Textarea
                  disabled={readOnly}
                  value={plan.features.join('\n')}
                  placeholder="Features (one per line)"
                  rows={3}
                  onChange={(e) => patchPlan(index, { features: e.target.value.split('\n') })}
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={plan.highlight}
                  onChange={(e) => patchPlan(index, { highlight: e.target.checked })}
                />
                Highlight this plan
              </label>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, plans: [...c.plans, emptyPricingPlan()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add plan
          </Button>
        </div>
      </div>
    )
  }

  if (kind === 'survey') {
    const c = asSurvey(content)
    function patchQuestion(index: number, patch: Partial<SurveyQuestion>) {
      const questions = c.questions.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, questions })
    }
    return (
      <div className="space-y-3">
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
          <Label>Questions</Label>
          {c.questions.map((q, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">Question {index + 1}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || c.questions.length <= 1}
                  onClick={() => onChange({ ...c, questions: c.questions.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                <Input
                  disabled={readOnly}
                  value={q.prompt}
                  placeholder="Question prompt"
                  onChange={(e) => patchQuestion(index, { prompt: e.target.value })}
                />
                <Select
                  disabled={readOnly}
                  value={q.kind}
                  onChange={(e) => patchQuestion(index, { kind: e.target.value as SurveyQuestionKind })}
                >
                  <option value="nps">NPS</option>
                  <option value="likert">Likert</option>
                  <option value="text">Text</option>
                  <option value="choice">Choice</option>
                </Select>
              </div>
              {q.kind === 'choice' && (
                <Textarea
                  disabled={readOnly}
                  className="mt-2"
                  value={q.choices.join('\n')}
                  placeholder="Choices (one per line)"
                  rows={3}
                  onChange={(e) => patchQuestion(index, { choices: e.target.value.split('\n') })}
                />
              )}
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, questions: [...c.questions, emptySurveyQuestion()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add question
          </Button>
        </div>
      </div>
    )
  }

  if (kind === 'announcement') {
    const c = asAnnouncement(content)
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <TemplateField
            disabled={readOnly}
            value={c.title}
            suggestions={suggestions}
            onChange={(title) => onChange({ ...c, title })}
          />
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
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Severity</Label>
            <Select
              disabled={readOnly}
              value={c.severity}
              onChange={(e) => onChange({ ...c, severity: e.target.value as AnnouncementSeverity })}
            >
              <option value="info">Info</option>
              <option value="promo">Promo</option>
              <option value="warning">Warning</option>
            </Select>
          </div>
          <div>
            <Label>Starts at</Label>
            <Input
              disabled={readOnly}
              type="datetime-local"
              value={c.startsAt}
              onChange={(e) => onChange({ ...c, startsAt: e.target.value })}
            />
          </div>
          <div>
            <Label>Ends at</Label>
            <Input
              disabled={readOnly}
              type="datetime-local"
              value={c.endsAt}
              onChange={(e) => onChange({ ...c, endsAt: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>CTA label</Label>
            <Input
              disabled={readOnly}
              value={c.ctaLabel}
              onChange={(e) => onChange({ ...c, ctaLabel: e.target.value })}
              placeholder="Learn more"
            />
          </div>
          <div>
            <Label>CTA value</Label>
            <TemplateField
              disabled={readOnly}
              value={c.ctaValue}
              suggestions={suggestions}
              onChange={(ctaValue) => onChange({ ...c, ctaValue })}
              placeholder="https://example.com"
            />
          </div>
        </div>
      </div>
    )
  }

  if (kind === 'sms') {
    const c = asSms(content)
    const charCount = c.body.length
    const maxChars = c.maxChars || (c.channel === 'whatsapp' ? 4096 : 160)
    const overLimit = charCount > maxChars
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Channel</Label>
            <Select
              disabled={readOnly}
              value={c.channel}
              onChange={(e) => {
                const channel = e.target.value as SmsChannel
                onChange({
                  ...c,
                  channel,
                  maxChars: channel === 'whatsapp' ? 4096 : 160,
                })
              }}
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
          </div>
          <div>
            <Label>Max characters</Label>
            <Input
              disabled={readOnly}
              type="number"
              value={c.maxChars}
              min={1}
              onChange={(e) => onChange({ ...c, maxChars: Number(e.target.value) || 160 })}
            />
          </div>
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
          <p className={`mt-1 text-[11px] ${overLimit ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-muted)]'}`}>
            {charCount} / {maxChars} characters{overLimit ? ' (over limit)' : ''}
          </p>
        </div>
      </div>
    )
  }

  if (kind === 'push') {
    const c = asPush(content)
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <TemplateField
            disabled={readOnly}
            value={c.title}
            suggestions={suggestions}
            onChange={(title) => onChange({ ...c, title })}
          />
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
      </div>
    )
  }

  if (kind === 'ticket') {
    const c = asTicket(content)
    function patchField(index: number, patch: Partial<TicketField>) {
      const fields = c.fields.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, fields })
    }
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Title</Label>
            <TemplateField
              disabled={readOnly}
              value={c.title}
              suggestions={suggestions}
              onChange={(title) => onChange({ ...c, title })}
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              disabled={readOnly}
              value={c.priority}
              onChange={(e) => onChange({ ...c, priority: e.target.value as TicketPriority })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Summary</Label>
          <TemplateField
            disabled={readOnly}
            multiline
            value={c.summary}
            suggestions={suggestions}
            onChange={(summary) => onChange({ ...c, summary })}
          />
        </div>
        <div className="space-y-2">
          <Label>Fields</Label>
          {c.fields.map((field, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 sm:grid-cols-[1fr_1fr_auto]"
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
            onClick={() => onChange({ ...c, fields: [...c.fields, emptyTicketField()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add field
          </Button>
        </div>
      </div>
    )
  }

  if (kind === 'certificate' || kind === 'checklist') {
    // Reuse document editor — same as document/agreement
    const c = asDocument(content)
    const kindLabel = kind === 'certificate' ? 'Certificate' : 'Checklist'
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
        <div className="rounded-xl border border-teal-200/70 bg-teal-50/40 px-3 py-2 text-[11px] text-slate-600">
          {kindLabel} PDF: fill from answers, then send{' '}
          <code className="font-mono">{'{{templates.key.file}}'}</code> on a Message or End step.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{kindLabel} title</Label>
            <TemplateField
              disabled={readOnly}
              value={c.title}
              suggestions={suggestions}
              onChange={(title) => onChange({ ...c, title })}
            />
          </div>
          <div>
            <Label>Download file name</Label>
            <TemplateField
              disabled={readOnly}
              value={c.filename}
              suggestions={suggestions}
              onChange={(filename) => onChange({ ...c, filename, format: 'pdf' })}
              placeholder={`${kind}-{{inputs.name}}.pdf`}
            />
          </div>
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
        {kind === 'checklist' && (
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-3">
            <Label>Data table (multiple rows)</Label>
            <div>
              <Label>Rows source</Label>
              <TemplateField
                disabled={readOnly}
                value={c.tableRowsSource}
                suggestions={suggestions}
                onChange={(tableRowsSource) => onChange({ ...c, tableRowsSource })}
                placeholder="{{inputs.items}}"
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
                  placeholder="Property key"
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
                  onClick={() => onChange({ ...c, tableColumns: c.tableColumns.filter((_, i) => i !== index) })}
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
        )}
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
      </div>
    )
  }

  if (kind === 'consent') {
    const c = asConsent(content)
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Title</Label>
            <TemplateField
              disabled={readOnly}
              value={c.title}
              suggestions={suggestions}
              onChange={(title) => onChange({ ...c, title })}
            />
          </div>
          <div>
            <Label>Version</Label>
            <Input
              disabled={readOnly}
              value={c.version}
              onChange={(e) => onChange({ ...c, version: e.target.value })}
              placeholder="1.0"
            />
          </div>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Accept label</Label>
            <Input
              disabled={readOnly}
              value={c.acceptLabel}
              onChange={(e) => onChange({ ...c, acceptLabel: e.target.value })}
              placeholder="I accept"
            />
          </div>
          <div>
            <Label>Decline label</Label>
            <Input
              disabled={readOnly}
              value={c.declineLabel}
              onChange={(e) => onChange({ ...c, declineLabel: e.target.value })}
              placeholder="I decline"
            />
          </div>
        </div>
        <div>
          <Label>Effective at</Label>
          <Input
            disabled={readOnly}
            type="datetime-local"
            value={c.effectiveAt}
            onChange={(e) => onChange({ ...c, effectiveAt: e.target.value })}
          />
        </div>
      </div>
    )
  }

  if (kind === 'webhook') {
    const c = asWebhook(content)
    function patchHeader(index: number, patch: Partial<WebhookHeader>) {
      const headers = c.headers.map((row, i) => (i === index ? { ...row, ...patch } : row))
      onChange({ ...c, headers })
    }
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              disabled={readOnly}
              value={c.name}
              onChange={(e) => onChange({ ...c, name: e.target.value })}
              placeholder="Webhook name"
            />
          </div>
          <div>
            <Label>Method</Label>
            <Select
              disabled={readOnly}
              value={c.method}
              onChange={(e) => onChange({ ...c, method: e.target.value as WebhookMethod })}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Input
            disabled={readOnly}
            value={c.description}
            onChange={(e) => onChange({ ...c, description: e.target.value })}
          />
        </div>
        <div>
          <Label>Content-Type</Label>
          <Input
            disabled={readOnly}
            value={c.contentType}
            onChange={(e) => onChange({ ...c, contentType: e.target.value })}
            placeholder="application/json"
          />
        </div>
        <div className="space-y-2">
          <Label>Headers</Label>
          {c.headers.map((header, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                disabled={readOnly}
                value={header.key}
                placeholder="Header name"
                onChange={(e) => patchHeader(index, { key: e.target.value })}
              />
              <TemplateField
                disabled={readOnly}
                value={header.value}
                suggestions={suggestions}
                onChange={(value) => patchHeader(index, { value })}
                placeholder="{{inputs.token}}"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => onChange({ ...c, headers: c.headers.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="secondary"
            disabled={readOnly}
            onClick={() => onChange({ ...c, headers: [...c.headers, emptyWebhookHeader()] })}
          >
            <Plus className="h-3.5 w-3.5" />
            Add header
          </Button>
        </div>
        <div>
          <Label>JSON body</Label>
          <Textarea
            disabled={readOnly}
            className="min-h-[160px] font-mono text-xs"
            value={c.bodyJson}
            onChange={(e) => onChange({ ...c, bodyJson: e.target.value })}
            placeholder='{"key": "{{inputs.value}}"}'
            spellCheck={false}
          />
          <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
            Use {'{{inputs.key}}'} to insert input values into the JSON body.
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
