import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { RankingAnswerField } from '@/features/chat/RankingAnswerField'
import { LocationAnswerField } from '@/features/chat/LocationAnswerField'
import { AppointmentAnswerField } from '@/features/chat/AppointmentAnswerField'
import { MatrixAnswerField } from '@/features/chat/MatrixAnswerField'
import { NationalIdAnswerField } from '@/features/chat/NationalIdAnswerField'
import { PasswordAnswerField } from '@/features/chat/PasswordAnswerField'
import { AutocompleteAnswerField } from '@/features/chat/AutocompleteAnswerField'
import { AudioAnswerField } from '@/features/chat/AudioAnswerField'
import { PaymentAnswerField, type PaymentPhase, type PaymentCheckout } from '@/features/chat/PaymentAnswerField'
import { CaptchaAnswerField } from '@/features/chat/CaptchaAnswerField'
import { FormAnswerField } from '@/features/chat/FormAnswerField'
import { ShopAnswerField } from '@/features/chat/ShopAnswerField'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { readScaleChoices } from '@/features/designer/model/flowSchema'
import type { AnswerFileStoreCtx } from '@/features/designer/model/conversationFiles'
import { cartCatalogFromTemplates } from '@/features/templates/templateModel'
import type { ChatbotMediaFile } from '@/features/designer/model/chatbotMedia'

export const EXTENDED_ANSWER_TYPES = [
  'ranking',
  'location',
  'appointment',
  'matrix',
  'national_id',
  'password',
  'autocomplete',
  'audio',
  'payment',
  'captcha',
  'form',
  'shop',
] as const

export function isExtendedAnswerType(answerType: string): boolean {
  return (EXTENDED_ANSWER_TYPES as readonly string[]).includes(answerType)
}

export function ExtendedAnswerPanel({
  answerType,
  config,
  choices,
  allowMultiple,
  storeCtx,
  onSubmit,
  optional,
  onSkip,
  validationError,
  className,
  payment,
  captchaPrompt,
  onRefreshCaptcha,
  onStartPayment,
  onCheckPayment,
  templates,
  mediaCatalog,
}: {
  answerType: string
  config: Record<string, unknown>
  choices: string[]
  allowMultiple?: boolean
  storeCtx: AnswerFileStoreCtx
  onSubmit: (value: string | string[] | Record<string, unknown>) => void
  optional?: boolean
  onSkip?: () => void
  validationError?: string
  className?: string
  payment?: PaymentPhase
  captchaPrompt?: string
  onRefreshCaptcha?: () => void
  onStartPayment?: () => Promise<PaymentCheckout>
  onCheckPayment?: (
    reference: string,
  ) => Promise<{ status: string; providerPaymentId?: string | null }>
  templates?: Record<string, unknown>
  mediaCatalog?: ChatbotMediaFile[]
}) {
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const scale = readScaleChoices(config)
  const idFormat = String(config.idFormat ?? 'za') === 'any' ? 'any' : 'za'
  const maxDuration =
    typeof config.maxDurationSeconds === 'number' ? config.maxDurationSeconds : 60
  const shopCatalog =
    answerType === 'shop'
      ? cartCatalogFromTemplates(templates, String(config.shopTemplateKey ?? ''))
      : null

  function submitText() {
    const value = draft.trim()
    if (!value) return
    onSubmit(value)
    setDraft('')
  }

  function submitAutocomplete() {
    if (allowMultiple) {
      if (!selected.length) return
      onSubmit(selected)
    } else {
      const one = selected[0]
      if (!one) return
      onSubmit(one)
    }
    setSelected([])
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {answerType === 'ranking' ? (
        <RankingAnswerField items={choices} onSubmit={(order) => onSubmit(order)} />
      ) : null}
      {answerType === 'location' ? (
        <LocationAnswerField onSubmit={(value) => onSubmit(value)} />
      ) : null}
      {answerType === 'appointment' ? (
        <AppointmentAnswerField
          minDate={typeof config.minDate === 'string' ? config.minDate : undefined}
          maxDate={typeof config.maxDate === 'string' ? config.maxDate : undefined}
          onSubmit={(value) => onSubmit(value)}
        />
      ) : null}
      {answerType === 'matrix' ? (
        <MatrixAnswerField rows={choices} scale={scale} onSubmit={(value) => onSubmit(value)} />
      ) : null}
      {answerType === 'national_id' ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submitText()
          }}
        >
          <NationalIdAnswerField value={draft} onChange={setDraft} format={idFormat} required={!optional} />
          <Button type="submit" className="h-11 w-11 shrink-0 rounded-2xl !px-0" disabled={!draft.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : null}
      {answerType === 'password' ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submitText()
          }}
        >
          <PasswordAnswerField
            value={draft}
            onChange={setDraft}
            required={!optional}
            minLength={typeof config.minLength === 'number' ? config.minLength : 4}
            maxLength={typeof config.maxLength === 'number' ? config.maxLength : undefined}
          />
          <Button type="submit" className="h-11 w-11 shrink-0 rounded-2xl !px-0" disabled={!draft.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      ) : null}
      {answerType === 'autocomplete' ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submitAutocomplete()
          }}
        >
          <AutocompleteAnswerField
            choices={choices}
            allowMultiple={allowMultiple}
            value={allowMultiple ? selected : (selected[0] ?? '')}
            onChange={(next) => {
              if (allowMultiple) {
                setSelected(Array.isArray(next) ? next.map(String) : next ? [String(next)] : [])
                return
              }
              const one = Array.isArray(next) ? next[0] : next
              if (one) {
                setSelected([])
                onSubmit(String(one))
              }
            }}
          />
          {allowMultiple ? (
            <Button type="submit" className="h-11 self-end rounded-2xl" disabled={!selected.length}>
              Send
            </Button>
          ) : null}
        </form>
      ) : null}
      {answerType === 'audio' ? (
        <AudioAnswerField
          maxDurationSeconds={maxDuration}
          storeCtx={storeCtx}
          onSubmit={(value) => onSubmit(value)}
        />
      ) : null}
      {answerType === 'payment' ? (
        <PaymentAnswerField
          payment={
            payment ?? {
              url: '',
              amount: '',
              currency: 'ZAR',
              payLabel: 'Pay now',
              paidLabel: "I've paid",
            }
          }
          onSubmit={(value) => onSubmit(value)}
          onStartPayment={onStartPayment}
          onCheckPayment={onCheckPayment}
        />
      ) : null}
      {answerType === 'captcha' ? (
        <CaptchaAnswerField
          prompt={captchaPrompt ?? ''}
          onSubmit={(value) => onSubmit(value)}
          onRefresh={onRefreshCaptcha}
        />
      ) : null}
      {answerType === 'form' ? (
        <FormAnswerField config={config} onSubmit={(value) => onSubmit(value)} />
      ) : null}
      {answerType === 'shop' ? (
        shopCatalog ? (
          <ShopAnswerField
            catalog={shopCatalog}
            media={mediaCatalog}
            onSubmit={(value) => onSubmit(value as unknown as Record<string, unknown>)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            {String(config.shopTemplateKey ?? '').trim()
              ? `Store catalog “${String(config.shopTemplateKey).trim()}” is not loaded. Restart preview, or publish if this is public chat.`
              : 'Link a Store catalog template on this Shop question.'}
          </p>
        )
      ) : null}
      {optional && onSkip ? (
        <Button type="button" variant="ghost" className="self-start rounded-2xl" onClick={onSkip}>
          Skip
        </Button>
      ) : null}
      {validationError ? <p className="text-[11px] text-rose-600">{validationError}</p> : null}
    </div>
  )
}
