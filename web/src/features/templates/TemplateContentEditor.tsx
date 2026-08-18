import { Plus, Trash2 } from 'lucide-react'
import { TemplateField } from '@/features/designer/inspector/TemplateField'
import type { TemplateSuggestion } from '@/features/designer/inspector/TemplateField'
import {
  WEEKDAYS,
  type CartContent,
  type EmailContent,
  type FaqContent,
  type HoursContent,
  type LegalContent,
  type MenuContent,
  type MessageContent,
  type ReceiptContent,
  type TemplateContent,
  type TemplateKind,
} from '@/features/templates/templateModel'
import { StoreCatalogEditor } from '@/features/templates/StoreCatalogEditor'
import type { ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
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
              placeholder="Order {{vars.order_id}} confirmed"
            />
          </div>
          <div>
            <Label>HTML body</Label>
            <Textarea
              disabled={readOnly}
              value={c.html}
              onChange={(e) => onChange({ ...c, html: e.target.value })}
              className="min-h-[320px] font-mono text-[12px]"
              placeholder="<h1>Hello {{vars.name}}</h1>"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
              Use {'{{vars.*}}'} and {'{{steps.*}}'} — they are filled when the email is sent.
            </p>
          </div>
        </div>
        <div>
          <Label>Preview</Label>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={c.html || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">HTML preview appears here.</p>'}
            className="h-[420px] w-full rounded-xl border border-[var(--color-border)] bg-white"
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
          <div key={index} className="rounded-xl border border-[var(--color-border)] bg-white/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Question {index + 1}</p>
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
          <div key={index} className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-white/70 p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
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
          placeholder="Hi {{vars.name}} — how can I help?"
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
                <p className="text-sm font-medium text-slate-700">{day.day}</p>
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
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
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
