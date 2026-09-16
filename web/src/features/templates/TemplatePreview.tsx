import type { CSSProperties, ReactNode } from 'react'
import { Bell, Smartphone } from 'lucide-react'
import { ChatFormattedText } from '@/features/chat/ChatFormattedText'
import { ConfirmAnswerField } from '@/features/chat/ConfirmAnswerField'
import { LikertAnswerField } from '@/features/chat/LikertAnswerField'
import { NpsAnswerField } from '@/features/chat/NpsAnswerField'
import { OpeningHoursCard } from '@/features/chat/OpeningHoursCard'
import { ShopAnswerField } from '@/features/chat/ShopAnswerField'
import { SuggestionResponseChips } from '@/features/chat/SuggestionResponseChips'
import type { ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'
import { DEFAULT_LIKERT_CHOICES } from '@/features/designer/model/flowSchema'
import { DocumentOutputPreview } from '@/features/templates/DocumentOutputPreview'
import { hoursEmbedFromTemplate } from '@/features/templates/hoursEmbed'
import { QrCodeCard } from '@/features/chat/QrCodeCard'
import type { QrEmbedPayload } from '@/features/templates/qrEmbed'
import {
  formatTemplateMoney,
  isFileTemplateKind,
  mapEmbedUrlFromContent,
  renderTemplateText,
  TEMPLATE_KIND_META,
  type AnnouncementContent,
  type AppointmentContent,
  type CartContent,
  type ConsentContent,
  type DocumentContent,
  type EmailContent,
  type FaqContent,
  type HoursContent,
  type LocationContent,
  type MapContent,
  type MenuContent,
  type MessageContent,
  type PricingContent,
  type PushContent,
  type QrContent,
  type ReceiptContent,
  type SmsContent,
  type SurveyContent,
  type TeamContent,
  type TemplateContent,
  type TemplateKind,
  type TicketContent,
  type WebhookContent,
} from '@/features/templates/templateModel'
import { cn } from '@/shared/lib/utils'

/** Theme-aware visitor-chat chrome (follows admin light/dark tokens). */
function VisitorChatFrame({
  label,
  compact,
  children,
}: {
  label: string
  compact?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-[var(--color-border)] text-[var(--color-ink)] shadow-sm"
      style={
        compact
          ? { background: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)' }
          : {
              background:
                'linear-gradient(to bottom, var(--color-surface), color-mix(in srgb, var(--color-accent-soft) 45%, var(--color-surface)))',
            }
      }
    >
      {!compact ? (
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
            Preview · {label}
          </p>
          <span className="text-[10px] text-[var(--color-ink-muted)]">Visitor chat</span>
        </div>
      ) : null}
      <div
        className={cn(
          'space-y-2.5',
          compact ? 'max-h-36 overflow-hidden p-2.5' : 'max-h-[480px] overflow-auto p-3.5',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function BotBubble({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={cn(
          'max-w-[95%] rounded-2xl rounded-bl-md border border-[var(--color-border)]/80 bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-relaxed text-[var(--color-ink)] shadow-sm',
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </div>
  )
}

function AnswerArea({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-sm pl-0.5">{children}</div>
}

function EmptyHint({ text = 'Add content to see a preview' }: { text?: string }) {
  return <p className="text-xs text-[var(--color-ink-muted)] italic">{text}</p>
}

function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  )
}

function noop() {
  /* preview only */
}

function TextBubble({ text, compact }: { text: string; compact?: boolean }) {
  const trimmed = text.trim()
  if (!trimmed) return <EmptyHint />
  return (
    <BotBubble className={compact ? 'text-xs' : undefined}>
      <div className={cn(compact && 'line-clamp-5')}>
        <ChatFormattedText text={trimmed} />
      </div>
    </BotBubble>
  )
}

function EmailPreview({ content, compact }: { content: EmailContent; compact?: boolean }) {
  if (compact) {
    const plain = content.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return (
      <div className="space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        <p className="truncate text-[10px] font-semibold text-[var(--color-ink-muted)]">
          Subject: {content.subject.trim() || '(no subject)'}
        </p>
        <p className="line-clamp-3 text-[11px] text-[var(--color-ink)]">{plain || 'Empty HTML body'}</p>
      </div>
    )
  }
  return (
    <SurfaceCard>
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <p className="text-[11px] text-[var(--color-ink-muted)]">Subject</p>
        <p className="text-sm font-medium text-[var(--color-ink)]">
          {content.subject.trim() || '(no subject)'}
        </p>
      </div>
      <iframe
        title="Email template preview"
        sandbox=""
        srcDoc={
          content.html ||
          '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">HTML preview appears here.</p>'
        }
        className="h-[320px] w-full bg-[var(--color-surface)]"
      />
    </SurfaceCard>
  )
}

function SurveyPreview({ content, compact }: { content: SurveyContent; compact?: boolean }) {
  const questions = content.questions.filter((q) => q.prompt.trim())
  const shown = compact ? questions.slice(0, 1) : questions
  if (!content.intro.trim() && !shown.length) return <EmptyHint />

  return (
    <>
      {content.intro.trim() ? (
        <BotBubble>
          <ChatFormattedText text={content.intro.trim()} />
        </BotBubble>
      ) : null}
      {shown.map((q, i) => {
        const choices =
          q.choices.filter((c) => c.trim()).length > 0
            ? q.choices.filter((c) => c.trim())
            : q.kind === 'likert'
              ? [...DEFAULT_LIKERT_CHOICES]
              : q.kind === 'choice'
                ? ['Option A', 'Option B', 'Option C']
                : []
        return (
          <div key={`${q.prompt}-${i}`} className="space-y-2">
            <BotBubble>
              <ChatFormattedText text={q.prompt.trim()} />
            </BotBubble>
            <AnswerArea>
              {q.kind === 'nps' ? (
                <NpsAnswerField disabled onSelect={noop} />
              ) : q.kind === 'likert' || q.kind === 'choice' ? (
                <LikertAnswerField choices={choices} disabled onSelect={noop} />
              ) : (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-ink-muted)] shadow-sm">
                  Type your answer…
                </div>
              )}
            </AnswerArea>
          </div>
        )
      })}
      {compact && questions.length > 1 ? (
        <p className="text-[10px] text-[var(--color-ink-muted)]">+{questions.length - 1} more questions</p>
      ) : null}
    </>
  )
}

function MenuPreview({ content, compact }: { content: MenuContent; compact?: boolean }) {
  const items = content.items.filter((i) => i.label.trim())
  const shown = compact ? items.slice(0, 4) : items
  if (!content.title.trim() && !shown.length) return <EmptyHint />
  return (
    <>
      <BotBubble>
        <ChatFormattedText
          text={[content.title.trim(), ...shown.map((i) => {
            const desc = i.description.trim() ? ` — ${i.description.trim()}` : ''
            return `• ${i.label.trim()}${desc}`
          })].filter(Boolean).join('\n')}
        />
      </BotBubble>
      <AnswerArea>
        <SuggestionResponseChips
          suggestions={shown.map((i) => i.label.trim())}
          disabled
          onSelect={noop}
        />
      </AnswerArea>
    </>
  )
}

function FaqPreview({ content, compact }: { content: FaqContent; compact?: boolean }) {
  const items = content.items.filter((i) => i.question.trim() || i.answer.trim())
  const shown = compact ? items.slice(0, 2) : items
  if (!content.intro.trim() && !shown.length) return <EmptyHint />
  const text = [
    content.intro.trim(),
    ...shown.map((i) => `**${i.question.trim() || 'Question'}**\n${i.answer.trim() || '—'}`),
  ]
    .filter(Boolean)
    .join('\n\n')
  return (
    <BotBubble className={compact ? 'text-xs' : undefined}>
      <div className={cn(compact && 'line-clamp-6')}>
        <ChatFormattedText text={text} />
      </div>
    </BotBubble>
  )
}

function AppointmentPreview({ content, compact }: { content: AppointmentContent; compact?: boolean }) {
  const services = content.services.filter((s) => s.name.trim())
  const shown = compact ? services.slice(0, 3) : services
  const intro = [content.title.trim(), content.intro.trim()].filter(Boolean).join('\n\n')
  return (
    <>
      {intro ? (
        <BotBubble>
          <ChatFormattedText text={intro} />
        </BotBubble>
      ) : null}
      <AnswerArea>
        <SuggestionResponseChips
          suggestions={shown.map((s) =>
            s.durationMinutes > 0 ? `${s.name} (${s.durationMinutes} min)` : s.name,
          )}
          disabled
          onSelect={noop}
        />
      </AnswerArea>
    </>
  )
}

function ConsentPreview({ content }: { content: ConsentContent }) {
  return (
    <>
      <BotBubble>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Version {content.version.trim() || '1'}
        </p>
        <p className="font-semibold text-[var(--color-ink)]">{content.title.trim() || 'Consent'}</p>
        <div className="mt-2">
          <ChatFormattedText text={content.body.trim() || '—'} />
        </div>
      </BotBubble>
      <AnswerArea>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] opacity-90"
          >
            {content.acceptLabel.trim() || 'Accept'}
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] opacity-90"
          >
            {content.declineLabel.trim() || 'Decline'}
          </button>
        </div>
        <ConfirmAnswerField
          className="mt-2"
          checked={false}
          disabled
          label={content.acceptLabel.trim() || 'I agree'}
          onCheckedChange={noop}
        />
      </AnswerArea>
    </>
  )
}

function PricingPreview({ content, compact }: { content: PricingContent; compact?: boolean }) {
  const plans = content.plans.filter((p) => p.name.trim())
  const shown = compact ? plans.slice(0, 2) : plans
  if (!content.intro.trim() && !shown.length) return <EmptyHint />
  return (
    <>
      {content.intro.trim() ? (
        <BotBubble>
          <ChatFormattedText text={content.intro.trim()} />
        </BotBubble>
      ) : null}
      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'sm:grid-cols-2')}>
        {shown.map((plan, i) => (
          <button
            key={`${plan.name}-${i}`}
            type="button"
            disabled
            className={cn(
              'rounded-2xl border bg-[var(--color-surface)] p-3 text-left shadow-sm',
              plan.highlight
                ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/25'
                : 'border-[var(--color-border)]',
            )}
          >
            <p className="text-sm font-semibold text-[var(--color-ink)]">{plan.name}</p>
            <p className="mt-1 text-lg font-bold text-[var(--color-accent)]">
              {formatTemplateMoney(plan.price, content.currency)}
              {plan.period ? (
                <span className="text-xs font-normal text-[var(--color-ink-muted)]">/{plan.period}</span>
              ) : null}
            </p>
            {!compact ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--color-ink-muted)]">
                {plan.features.filter(Boolean).slice(0, 4).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            ) : null}
          </button>
        ))}
      </div>
    </>
  )
}

function LocationPreview({ content, compact }: { content: LocationContent; compact?: boolean }) {
  const locs = content.locations.filter((l) => l.name.trim() || l.address.trim())
  const shown = compact ? locs.slice(0, 1) : locs
  if (!content.intro.trim() && !shown.length) return <EmptyHint />
  return (
    <>
      {content.intro.trim() ? (
        <BotBubble>
          <ChatFormattedText text={content.intro.trim()} />
        </BotBubble>
      ) : null}
      {shown.map((loc, i) => (
        <SurfaceCard key={i} className="max-w-sm">
          <div className="bg-[var(--color-surface-2)] px-3 py-6 text-center text-[11px] font-medium text-[var(--color-ink-muted)]">
            {loc.mapUrl.trim() ? 'Map preview' : 'Location'}
          </div>
          <div className="space-y-1 px-3 py-2.5 text-sm">
            <p className="font-semibold text-[var(--color-ink)]">{loc.name || 'Location'}</p>
            <p className="text-[var(--color-ink-muted)]">
              {[loc.address, loc.city].filter(Boolean).join(', ') || '—'}
            </p>
            {loc.phone.trim() ? (
              <p className="text-[var(--color-accent)]">{loc.phone}</p>
            ) : null}
            {loc.hoursNote.trim() ? (
              <p className="text-xs text-[var(--color-ink-muted)]">{loc.hoursNote}</p>
            ) : null}
          </div>
        </SurfaceCard>
      ))}
    </>
  )
}

function MapPreview({ content, compact }: { content: MapContent; compact?: boolean }) {
  const pins = content.pins.filter((p) => p.label.trim() || (p.lat.trim() && p.lng.trim()))
  const shown = compact ? pins.slice(0, 2) : pins
  const embedUrl = mapEmbedUrlFromContent(content)
  if (!content.title.trim() && !content.intro.trim() && !shown.length && !embedUrl) {
    return <EmptyHint />
  }
  return (
    <>
      {content.title.trim() || content.intro.trim() ? (
        <BotBubble>
          <ChatFormattedText
            text={[content.title.trim(), content.intro.trim()].filter(Boolean).join('\n\n')}
          />
        </BotBubble>
      ) : null}
      <SurfaceCard className="max-w-md overflow-hidden p-0">
        <div className={compact ? 'h-28' : 'h-44'}>
          <iframe
            title={content.title.trim() || 'Map'}
            src={embedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        {shown.length ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {shown.map((pin, i) => (
              <li key={i} className="px-3 py-2 text-sm">
                <p className="font-semibold text-[var(--color-ink)]">{pin.label || `Pin ${i + 1}`}</p>
                {pin.description.trim() ? (
                  <p className="text-xs text-[var(--color-ink-muted)]">{pin.description}</p>
                ) : null}
                {pin.lat.trim() && pin.lng.trim() ? (
                  <p className="font-mono text-[10px] text-[var(--color-ink-muted)]">
                    {pin.lat}, {pin.lng}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </SurfaceCard>
    </>
  )
}

function QrPreview({ content, compact }: { content: QrContent; compact?: boolean }) {
  if (!content.payload.trim() && !content.title.trim() && !content.caption.trim()) {
    return <EmptyHint />
  }
  const samplePayload =
    content.payload.trim() ||
    'https://example.com'
  const qr: QrEmbedPayload = {
    title: content.title,
    caption: content.caption,
    payload: samplePayload
      .replace(/\{\{\s*inputs\.([A-Za-z0-9_]+)\s*\}\}/g, (_, key: string) =>
        key === 'url' ? 'https://example.com/invite' : `sample-${key}`,
      )
      .replace(/\{\{[^}]+\}\}/g, '…'),
    size: content.size,
    errorCorrection: content.errorCorrection,
    foreground: content.foreground,
    background: content.background,
    filename: content.filename,
  }
  return <QrCodeCard qr={qr} compact={compact} className="max-w-sm" />
}

function TeamPreview({ content, compact }: { content: TeamContent; compact?: boolean }) {
  const members = content.members.filter((m) => m.name.trim())
  const shown = compact ? members.slice(0, 2) : members
  if (!content.intro.trim() && !shown.length) return <EmptyHint />
  return (
    <>
      {content.intro.trim() ? (
        <BotBubble>
          <ChatFormattedText text={content.intro.trim()} />
        </BotBubble>
      ) : null}
      <AnswerArea>
        <div className="space-y-1.5">
          {shown.map((m, i) => (
            <button
              key={i}
              type="button"
              disabled
              className="flex w-full items-start gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left shadow-sm"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]">
                {m.name.trim().slice(0, 1).toUpperCase() || '?'}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--color-ink)]">{m.name}</span>
                <span className="block text-xs text-[var(--color-ink-muted)]">
                  {m.role || 'Team member'}
                </span>
                {m.skills.trim() ? (
                  <span className="mt-0.5 block text-[11px] text-[var(--color-ink-muted)]">{m.skills}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </AnswerArea>
    </>
  )
}

function AnnouncementPreview({ content }: { content: AnnouncementContent }) {
  const toneStyle =
    content.severity === 'warning'
      ? {
          borderColor: 'color-mix(in srgb, var(--color-warning) 40%, var(--color-border))',
          background: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))',
        }
      : content.severity === 'promo'
        ? {
            borderColor: 'color-mix(in srgb, var(--color-accent) 40%, var(--color-border))',
            background: 'var(--color-accent-soft)',
          }
        : {
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface-2)',
          }
  return (
    <BotBubble style={toneStyle}>
      <p className="font-semibold text-[var(--color-ink)]">{content.title.trim() || 'Announcement'}</p>
      <div className="mt-1">
        <ChatFormattedText text={content.body.trim() || '—'} />
      </div>
      {content.ctaLabel.trim() ? (
        <span className="mt-2 inline-flex rounded-full bg-[var(--color-surface)]/80 px-3 py-1 text-xs font-medium text-[var(--color-ink)] ring-1 ring-[var(--color-border)]">
          {content.ctaLabel}
        </span>
      ) : null}
    </BotBubble>
  )
}

function SmsPreview({ content }: { content: SmsContent }) {
  const body = content.body.trim()
  const max = content.maxChars > 0 ? content.maxChars : content.channel === 'whatsapp' ? 4096 : 160
  return (
    <div className="mx-auto max-w-[240px]">
      <div className="rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-ink)] p-2 shadow-md">
        <div className="rounded-[1rem] bg-[var(--color-surface)] px-3 py-4">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            <Smartphone className="h-3 w-3" />
            {content.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
          </div>
          <div className="rounded-2xl rounded-bl-md bg-[var(--color-accent)] px-3 py-2 text-[12px] leading-snug text-[var(--color-accent-fg)]">
            {body || <span className="opacity-70">Message body…</span>}
          </div>
          <p className="mt-2 text-right text-[10px] text-[var(--color-ink-muted)]">
            {body.length}/{max}
          </p>
        </div>
      </div>
    </div>
  )
}

function PushPreview({ content }: { content: PushContent }) {
  return (
    <SurfaceCard className="p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-ink)] text-[var(--color-surface)]">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
            {content.title.trim() || 'Notification title'}
          </p>
          <p className="mt-0.5 line-clamp-3 text-xs text-[var(--color-ink-muted)]">
            {content.body.trim() || 'Notification body…'}
          </p>
        </div>
      </div>
    </SurfaceCard>
  )
}

function TicketPreview({ content }: { content: TicketContent }) {
  const fields = content.fields.filter((f) => f.label.trim() || f.value.trim())
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-2 bg-[var(--color-accent-soft)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          {content.title.trim() || 'Case note'}
        </p>
        <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
          {content.priority}
        </span>
      </div>
      <div className="space-y-2 px-3 py-2.5 text-sm text-[var(--color-ink)]">
        {content.summary.trim() ? <ChatFormattedText text={content.summary.trim()} /> : null}
        {fields.length ? (
          <dl className="space-y-1 border-t border-[var(--color-border)] pt-2 text-xs">
            {fields.slice(0, 6).map((f, i) => (
              <div key={`${f.label}-${i}`} className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-[var(--color-ink-muted)]">
                  {f.label || 'Field'}
                </dt>
                <dd className="truncate text-[var(--color-ink)]">{f.value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </SurfaceCard>
  )
}

function FilePreview({ kind, content, compact }: { kind: TemplateKind; content: DocumentContent; compact?: boolean }) {
  return (
    <>
      {!compact ? (
        <BotBubble>
          <ChatFormattedText
            text={[
              `Here's your ${TEMPLATE_KIND_META[kind].label.toLowerCase()}.`,
              content.title.trim() || content.filename || '',
            ]
              .filter(Boolean)
              .join('\n\n')}
          />
        </BotBubble>
      ) : null}
      <DocumentOutputPreview kind={kind} content={content} compact={compact} />
    </>
  )
}

function WebhookPreview({ content }: { content: WebhookContent }) {
  let pretty = content.bodyJson.trim()
  try {
    if (pretty) pretty = JSON.stringify(JSON.parse(pretty), null, 2)
  } catch {
    /* keep raw */
  }
  return (
    <SurfaceCard className="bg-[var(--color-ink)] text-[var(--color-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-surface)]/15 px-3 py-1.5 text-[11px]">
        <span className="rounded bg-[var(--color-accent)]/25 px-1.5 py-0.5 font-semibold text-[var(--color-accent-soft)]">
          {content.method || 'POST'}
        </span>
        <span className="truncate opacity-80">{content.name.trim() || 'Webhook payload'}</span>
      </div>
      <pre className="max-h-48 overflow-auto p-3 font-mono text-[11px] leading-relaxed opacity-90">
        {pretty || '// JSON body'}
      </pre>
    </SurfaceCard>
  )
}

function KindPreviewBody({
  kind,
  content,
  name,
  compact,
  media,
}: {
  kind: TemplateKind
  content: TemplateContent
  name?: string
  compact?: boolean
  media?: ChatbotMediaFile[]
}) {
  if (kind === 'email') return <EmailPreview content={content as EmailContent} compact={compact} />
  if (kind === 'sms') return <SmsPreview content={content as SmsContent} />
  if (kind === 'push') return <PushPreview content={content as PushContent} />
  if (kind === 'webhook') return <WebhookPreview content={content as WebhookContent} />
  if (kind === 'sso') {
    const c = content as { buttonLabel?: string; providerName?: string }
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center shadow-sm">
        <p className="text-xs text-[var(--color-ink-muted)]">Sign-in</p>
        <button
          type="button"
          className="mt-2 inline-flex rounded-xl bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-[var(--color-surface)]"
          disabled
        >
          {c.buttonLabel?.trim() || 'Continue with SSO'}
        </button>
        {c.providerName?.trim() ? (
          <p className="mt-2 text-[11px] text-[var(--color-ink-muted)]">{c.providerName.trim()}</p>
        ) : null}
      </div>
    )
  }

  if (kind === 'cart') {
    return (
      <div className={cn('pointer-events-none', compact && 'origin-top scale-[0.92]')}>
        <ShopAnswerField catalog={content as CartContent} media={media} preview />
      </div>
    )
  }

  if (kind === 'hours') {
    return (
      <OpeningHoursCard
        hours={hoursEmbedFromTemplate({
          ...(content as HoursContent),
          name: name || 'Opening hours',
        })}
      />
    )
  }

  if (kind === 'survey') return <SurveyPreview content={content as SurveyContent} compact={compact} />
  if (kind === 'menu') return <MenuPreview content={content as MenuContent} compact={compact} />
  if (kind === 'faq') return <FaqPreview content={content as FaqContent} compact={compact} />
  if (kind === 'appointment') {
    return <AppointmentPreview content={content as AppointmentContent} compact={compact} />
  }
  if (kind === 'consent') return <ConsentPreview content={content as ConsentContent} />
  if (kind === 'pricing') return <PricingPreview content={content as PricingContent} compact={compact} />
  if (kind === 'location') return <LocationPreview content={content as LocationContent} compact={compact} />
  if (kind === 'map') return <MapPreview content={content as MapContent} compact={compact} />
  if (kind === 'qr') return <QrPreview content={content as QrContent} compact={compact} />
  if (kind === 'team') return <TeamPreview content={content as TeamContent} compact={compact} />
  if (kind === 'announcement') return <AnnouncementPreview content={content as AnnouncementContent} />
  if (kind === 'ticket') return <TicketPreview content={content as TicketContent} />
  if (isFileTemplateKind(kind)) {
    return <FilePreview kind={kind} content={content as DocumentContent} compact={compact} />
  }

  if (kind === 'message') {
    return <TextBubble text={(content as MessageContent).text} compact={compact} />
  }
  if (kind === 'legal' || kind === 'receipt') {
    return <TextBubble text={renderTemplateText(kind, content as ReceiptContent)} compact={compact} />
  }

  return <TextBubble text={renderTemplateText(kind, content)} compact={compact} />
}

export function TemplatePreview({
  kind,
  content,
  name,
  compact = false,
  media,
  className,
}: {
  kind: TemplateKind
  content: TemplateContent
  name?: string
  compact?: boolean
  media?: ChatbotMediaFile[]
  className?: string
}) {
  return (
    <div className={className}>
      <VisitorChatFrame label={TEMPLATE_KIND_META[kind].label} compact={compact}>
        <KindPreviewBody kind={kind} content={content} name={name} compact={compact} media={media} />
      </VisitorChatFrame>
    </div>
  )
}
