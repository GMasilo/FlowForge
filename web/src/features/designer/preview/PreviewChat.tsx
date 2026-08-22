import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { MessageCircle, Minimize2, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import {
  createInitialPreviewState,
  runConnectionStep,
  runEntityStep,
  sendOtpEmailChallenge,
  skipPreviewQuestion,
  submitPreviewAnswer,
  refreshCaptchaChallenge,
  tickPreview,
  timeoutPreviewQuestion,
  type PreviewEngineState,
  type PreviewStepRun,
} from '@/features/designer/preview/previewRuntime'
import {
  isAnswerRequired,
  normalizeAllowedEmailDomains,
  readDelaySeconds,
  readTimeoutSeconds,
  DEFAULT_LIKERT_CHOICES,
  readImageChoiceLayout,
} from '@/features/designer/model/flowSchema'
import { listChatbotConnections, loadEmailConnectionConfig } from '@/features/connections/connectionApi'
import {
  TemporalAnswerField,
  dateTimeModeForAnswerType,
} from '@/features/chat/TemporalAnswerField'
import { ChoiceAnswerField } from '@/features/chat/ChoiceAnswerField'
import { CountryAnswerField } from '@/features/chat/CountryAnswerField'
import { PhoneAnswerField } from '@/features/chat/PhoneAnswerField'
import { SliderAnswerField } from '@/features/chat/SliderAnswerField'
import { StarsAnswerField } from '@/features/chat/StarsAnswerField'
import { NpsAnswerField } from '@/features/chat/NpsAnswerField'
import { ColorAnswerField } from '@/features/chat/ColorAnswerField'
import { ThumbsAnswerField } from '@/features/chat/ThumbsAnswerField'
import { MoodAnswerField } from '@/features/chat/MoodAnswerField'
import { LikertAnswerField } from '@/features/chat/LikertAnswerField'
import { NumberedChoiceAnswerField } from '@/features/chat/NumberedChoiceAnswerField'
import { StepperAnswerField } from '@/features/chat/StepperAnswerField'
import { CurrencyAnswerField } from '@/features/chat/CurrencyAnswerField'
import { OtpAnswerField } from '@/features/chat/OtpAnswerField'
import { ConfirmAnswerField } from '@/features/chat/ConfirmAnswerField'
import { FileAnswerField } from '@/features/chat/FileAnswerField'
import { SignatureAnswerField } from '@/features/chat/SignatureAnswerField'
import { ImageChoiceAnswerField, imageChoiceCardsFromCatalog, imageChoicePayloadFromSelection } from '@/features/chat/ImageChoiceAnswerField'
import { ExtendedAnswerPanel, isExtendedAnswerType } from '@/features/chat/ExtendedAnswerPanel'
import { UserMessageBubble } from '@/features/chat/UserMessageBubble'
import { ChatMessageBody } from '@/features/chat/ChatMessageBody'
import { ChatMediaPlayerProvider } from '@/features/chat/ChatMediaPlayer'
import { useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { mediaKeyFromFilename } from '@/features/designer/model/chatbotMedia'
import { chatbotTemplatesQueryKey, fetchChatbotTemplates } from '@/features/templates/templateApi'
import {
  chatbotTestScenariosQueryKey,
  fetchChatbotTestScenarios,
} from '@/features/designer/preview/testScenarioApi'
import { evaluateScenario, parseScenarioGlobals, type ScenarioResult } from '@/features/designer/preview/scenarioEval'
import { templatesExprMap } from '@/features/templates/templateModel'
import {
  constraintAttr,
  resolveAnswerInputConstraints,
} from '@/features/chat/answerInputConstraints'
import {
  normalizeFileAccept,
  normalizeMaxFiles,
} from '@/features/designer/model/conversationFiles'
import { fetchUrlPreview, getPaymentStatus, isFlowForgeApiConfigured, startPaymentIntent } from '@/shared/lib/flowforgeApi'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface PreviewChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRunsChange?: (runs: PreviewStepRun[]) => void
  onScenarioResult?: (result: ScenarioResult | null) => void
}

function prettyTimestamp(iso: string): string {
  const date = new Date(iso)
  const time = format(date, 'h:mm a')
  if (isToday(date)) {
    const rel = formatDistanceToNow(date, { addSuffix: true })
    // Prefer clock time under bubbles; include soft relative when very recent
    const secs = (Date.now() - date.getTime()) / 1000
    if (secs < 60) return 'Just now'
    if (secs < 60 * 60) return `${time} · ${rel}`
    return time
  }
  if (isYesterday(date)) return `Yesterday · ${time}`
  return format(date, 'MMM d · h:mm a')
}

export function PreviewChat({ open, onOpenChange, onRunsChange, onScenarioResult }: PreviewChatProps) {
  const { chatbotId, instanceId } = useParams()
  const connectionCtx = useMemo(
    () => ({
      chatbotId: chatbotId || undefined,
      instanceId: instanceId || undefined,
    }),
    [chatbotId, instanceId],
  )
  const nodes = useDesignerStore((s) => s.nodes)
  const edges = useDesignerStore((s) => s.edges)
  const templateContents = useDesignerStore((s) => s.templateContents)
  const botName = useQuery({
    queryKey: ['chatbot-name', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase.from('chatbots').select('name').eq('id', chatbotId!).single()
      if (error) throw error
      return data.name as string
    },
  })

  const globals = useQuery({
    queryKey: ['chatbot-variables', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_variables')
        .select('key, default_value')
        .eq('chatbot_id', chatbotId!)
        .eq('scope', 'global')
      if (error) throw error
      const map: Record<string, unknown> = {}
      for (const row of data ?? []) map[row.key] = row.default_value
      return map
    },
  })

  const connections = useQuery({
    queryKey: ['connections-for-preview', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const rows = await listChatbotConnections(chatbotId!)
      const map: Record<string, Record<string, unknown>> = {}
      for (const row of rows) {
        if (
          row.config &&
          typeof row.config === 'object' &&
          !Array.isArray(row.config) &&
          String((row.config as Record<string, unknown>).smtpHost ?? (row.config as Record<string, unknown>).baseUrl ?? '').trim()
        ) {
          map[row.id] = row.config as Record<string, unknown>
          continue
        }
        if (row.kind === 'email') {
          const cfg = await loadEmailConnectionConfig(row.id, chatbotId!)
          if (cfg) map[row.id] = cfg
        } else {
          const { loadConnectionConfigForUse } = await import('@/features/connections/connectionApi')
          const cfg = await loadConnectionConfigForUse(row.id, chatbotId!)
          if (cfg) map[row.id] = cfg
        }
      }
      return map
    },
  })

  const connectionsById = connections.data ?? {}
  const mediaQuery = useChatbotMedia(instanceId, chatbotId)
  const mediaCatalog = useMemo(
    () =>
      (mediaQuery.data ?? []).map((f) => ({
        filename: f.filename,
        key: f.key || mediaKeyFromFilename(f.filename),
        url: f.url,
        mime: f.mime,
      })),
    [mediaQuery.data],
  )
  const templatesQuery = useQuery({
    queryKey: chatbotId ? chatbotTemplatesQueryKey(chatbotId) : ['chatbot-templates', 'none'],
    enabled: !!chatbotId,
    queryFn: () => fetchChatbotTemplates(chatbotId!),
  })
  const templatesMap = useMemo(
    () => ({ ...(templateContents ?? {}), ...templatesExprMap(templatesQuery.data ?? []) }),
    [templateContents, templatesQuery.data],
  )
  const scenariosQuery = useQuery({
    queryKey: chatbotId ? chatbotTestScenariosQueryKey(chatbotId) : ['chatbot-test-scenarios', 'none'],
    enabled: !!chatbotId,
    queryFn: () => fetchChatbotTestScenarios(chatbotId!),
  })
  const scenarios = scenariosQuery.data ?? []
  const [scenarioId, setScenarioId] = useState('')

  const [state, setState] = useState<PreviewEngineState | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedChoices, setSelectedChoices] = useState<string[]>([])
  const [sessionKey, setSessionKey] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const connectionBusy = useRef(false)
  const otpSendBusy = useRef(false)
  const otpSentForWait = useRef<string | null>(null)
  const [otpSending, setOtpSending] = useState(false)

  const ready = !!globals.data
  const selectedScenario = scenarios.find((s) => s.id === scenarioId) ?? null

  function mergedGlobals(): Record<string, unknown> {
    return {
      ...(globals.data ?? {}),
      ...(selectedScenario ? parseScenarioGlobals(selectedScenario.globals) : {}),
    }
  }

  function restart() {
    if (!globals.data) return
    setSessionKey((k) => k + 1)
    onScenarioResult?.(null)
    setState(createInitialPreviewState(nodes, edges, mergedGlobals(), mediaCatalog, templatesMap))
    setDraft('')
    setSelectedChoices([])
    otpSentForWait.current = null
  }

  useEffect(() => {
    if (!ready || !open) return
    onScenarioResult?.(null)
    setState(createInitialPreviewState(nodes, edges, mergedGlobals(), mediaCatalog, templatesMap))
    setDraft('')
    setSelectedChoices([])
    otpSentForWait.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionKey / open / scenario intentionally restarts preview
  }, [ready, open, sessionKey, scenarioId])

  useEffect(() => {
    if (!open) return
    setState((s) => (s ? { ...s, templates: templatesMap } : s))
  }, [open, templatesMap])

  useEffect(() => {
    onRunsChange?.(state?.runs ?? [])
  }, [state?.runs, onRunsChange])

  useEffect(() => {
    if (!open || !state || state.phase.kind !== 'finished' || !selectedScenario) return
    onScenarioResult?.(
      evaluateScenario({
        name: selectedScenario.name,
        expected: selectedScenario.expected,
        vars: state.vars,
        runs: state.runs,
      }),
    )
  }, [open, state, selectedScenario, onScenarioResult])

  useEffect(() => {
    if (!open || !state || state.phase.kind !== 'typing' || !state.currentId) return
    const node = nodes.find((n) => n.id === state.currentId)
    const delaySeconds = node ? readDelaySeconds(node.config) : 0
    // Cosmetics when delay is 0; otherwise honor configured delay before the step runs
    const waitMs = delaySeconds > 0 ? Math.round(delaySeconds * 1000) : 480

    if (node?.type === 'http' || node?.type === 'email' || node?.type === 'entity') {
      if (connectionBusy.current) return
      let started = false
      const timer = window.setTimeout(() => {
        if (connectionBusy.current) return
        started = true
        connectionBusy.current = true
        const run =
          node.type === 'entity'
            ? runEntityStep(state, nodes, edges)
            : runConnectionStep(state, nodes, edges, connectionsById, connectionCtx)
        void run
          .then((next) => setState(next))
          .finally(() => {
            connectionBusy.current = false
          })
      }, waitMs)
      return () => {
        window.clearTimeout(timer)
        if (!started) {
          // delay cancelled before the connection ran
        }
      }
    }

    const wallStart = performance.now()
    const wallStartedAt = new Date().toISOString()
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (!prev) return prev
        const beforeCount = prev.runs.length
        let next = tickPreview(prev, nodes, edges)
        if (next.runs.length > beforeCount) {
          const durationMs = Math.round(performance.now() - wallStart)
          const finishedAt = new Date().toISOString()
          next = {
            ...next,
            runs: next.runs.map((run, index) =>
              index === next.runs.length - 1
                ? { ...run, startedAt: wallStartedAt, finishedAt, durationMs }
                : run,
            ),
          }
        }
        return next
      })
    }, waitMs)
    return () => window.clearTimeout(timer)
  }, [open, state, nodes, edges, connectionsById, connectionCtx])

  useEffect(() => {
    if (!open || !state) return
    const phase = state.phase
    if (phase.kind !== 'waiting_input') return
    const node = nodes.find((n) => n.id === phase.nodeId)
    if (!node || isAnswerRequired(node.config)) return
    const timeoutSeconds = readTimeoutSeconds(node.config)
    if (timeoutSeconds <= 0) return

    const started = Date.parse(phase.startedAt)
    const remaining = Math.max(0, timeoutSeconds * 1000 - (Date.now() - started))
    const timer = window.setTimeout(() => {
      setState((prev) => (prev ? timeoutPreviewQuestion(prev, nodes, edges) : prev))
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [open, state, nodes, edges])

  // Send OTP email when an OTP question with a connection becomes active
  useEffect(() => {
    if (!open || !state) return
    const phase = state.phase
    if (phase.kind !== 'waiting_input' || phase.answerType !== 'otp') return
    const node = nodes.find((n) => n.id === phase.nodeId)
    if (!node) return
    const connectionId = String(node.config.otpConnectionId ?? '').trim()
    if (!connectionId) return
    // Wait until connection configs have been fetched (or failed) so we don't race.
    if (connections.isLoading) return

    const waitKey = `${phase.nodeId}:${phase.startedAt}`
    if (otpSentForWait.current === waitKey) return
    if (otpSendBusy.current) return

    otpSentForWait.current = waitKey
    otpSendBusy.current = true
    setOtpSending(true)
    void (async () => {
      let map = { ...connectionsById }
      try {
        if (!String(map[connectionId]?.smtpHost ?? '').trim() && chatbotId) {
          const cfg = await loadEmailConnectionConfig(connectionId, chatbotId)
          if (cfg) map = { ...map, [connectionId]: cfg }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load email connection'
        setState((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'system',
                    text: `OTP email error: ${message}`,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : prev,
        )
        return state
      }
      return sendOtpEmailChallenge(state, nodes, map, connectionCtx)
    })()
      .then((next) => setState(next))
      .finally(() => {
        otpSendBusy.current = false
        setOtpSending(false)
      })
  }, [open, state, nodes, connectionsById, connections.isLoading, connectionCtx, chatbotId])

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' })
  }, [state?.messages, state?.phase])

  useEffect(() => {
    if (open && state?.phase.kind === 'waiting_input') inputRef.current?.focus()
  }, [open, state?.phase])

  useEffect(() => {
    if (!state || state.phase.kind !== 'waiting_input') return
    const phase = state.phase
    setSelectedChoices([])
    const answerType = phase.answerType
    const node = nodes.find((n) => n.id === phase.nodeId)
    const constraints = resolveAnswerInputConstraints(
      answerType,
      (node?.config ?? {}) as Record<string, unknown>,
    )
    if (answerType === 'percentage' || answerType === 'slider' || answerType === 'stepper') {
      const lo = constraints.min ?? 0
      const hi = constraints.max ?? 100
      setDraft(String(Math.round((lo + hi) / 2)))
    } else if (answerType === 'color') {
      setDraft('#14b8a6')
    } else {
      setDraft('')
    }
    // Reset answer draft when the waiting question changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase.kind === 'waiting_input' ? state.phase.nodeId : null])

  useEffect(() => {
    if (!open || !state?.messages.length) return
    const pending = state.messages.filter((m) => m.link?.loading && m.link.url)
    if (!pending.length) return

    if (!isFlowForgeApiConfigured()) {
      setState((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.link?.loading
              ? {
                  ...m,
                  link: {
                    ...m.link,
                    loading: false,
                    error: 'Link preview API is not configured',
                  },
                }
              : m,
          ),
        }
      })
      return
    }

    let cancelled = false
    const controllers = pending.map((m) => {
      const controller = new AbortController()
      const url = m.link!.url
      void fetchUrlPreview({ url, signal: controller.signal })
        .then((preview) => {
          if (cancelled) return
          setState((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              messages: prev.messages.map((row) => {
                if (row.id !== m.id || !row.link) return row
                return {
                  ...row,
                  link: {
                    ...row.link,
                    loading: false,
                    title: preview.title ?? null,
                    description: preview.description ?? null,
                    siteName: preview.site_name ?? null,
                    icon: preview.icon ?? null,
                    error: preview.ok ? null : preview.error ?? 'Could not load description',
                  },
                }
              }),
            }
          })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const message = err instanceof Error ? err.message : 'Could not load description'
          setState((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              messages: prev.messages.map((row) => {
                if (row.id !== m.id || !row.link) return row
                return {
                  ...row,
                  link: { ...row.link, loading: false, error: message },
                }
              }),
            }
          })
        })
      return controller
    })

    return () => {
      cancelled = true
      for (const c of controllers) c.abort()
    }
  }, [open, state?.messages])

  const waiting = state?.phase.kind === 'waiting_input' ? state.phase : null
  const waitingNode = waiting ? nodes.find((n) => n.id === waiting.nodeId) : null
  const waitingOptional = !!waitingNode && !isAnswerRequired(waitingNode.config)
  const waitingTimeoutSec = waitingNode ? readTimeoutSeconds(waitingNode.config) : 0
  const waitingCfg = waitingNode?.config ?? {}
  const varEntries = useMemo(() => Object.entries(state?.vars ?? {}), [state?.vars])
  const isChoiceType = waiting?.answerType === 'choice' || waiting?.answerType === 'gender'
  const isRating = waiting?.answerType === 'rating'
  const isStars = waiting?.answerType === 'stars'
  const isNps = waiting?.answerType === 'nps'
  const isSlider = waiting?.answerType === 'slider'
  const isPercentage = waiting?.answerType === 'percentage'
  const isColor = waiting?.answerType === 'color'
  const isThumbs = waiting?.answerType === 'thumbs'
  const isMood = waiting?.answerType === 'mood'
  const isLikert = waiting?.answerType === 'likert'
  const isNumberedChoice = waiting?.answerType === 'numbered_choice'
  const isStepper = waiting?.answerType === 'stepper'
  const isCurrency = waiting?.answerType === 'currency'
  const isOtp = waiting?.answerType === 'otp'
  const otpHasEmailConnection =
    isOtp && !!String(waitingCfg.otpConnectionId ?? '').trim()
  const isConfirm = waiting?.answerType === 'confirm'
  const isFile = waiting?.answerType === 'file'
  const isSignature = waiting?.answerType === 'signature'
  const isImageChoice = waiting?.answerType === 'image_choice'
  const isExtended = isExtendedAnswerType(waiting?.answerType ?? '')
  const inputConstraints = resolveAnswerInputConstraints(
    waiting?.answerType ?? 'text',
    (waitingNode?.config ?? {}) as Record<string, unknown>,
  )
  const ratingMin = inputConstraints.min ?? 1
  const ratingMax = inputConstraints.max ?? 5
  const sliderMin = inputConstraints.min ?? 0
  const sliderMax = inputConstraints.max ?? 100
  const sliderStep =
    typeof inputConstraints.step === 'number' && inputConstraints.step > 0
      ? inputConstraints.step
      : 1
  const starsMin = inputConstraints.min ?? 1
  const starsMax = inputConstraints.max ?? 5
  const npsMin = inputConstraints.min ?? 0
  const npsMax = inputConstraints.max ?? 10
  const otpLength =
    typeof waitingCfg.otpLength === 'number'
      ? waitingCfg.otpLength
      : inputConstraints.maxLength ?? 6
  const currencyCode =
    typeof waitingCfg.currencyCode === 'string' && waitingCfg.currencyCode.trim()
      ? waitingCfg.currencyCode.trim().toUpperCase()
      : 'ZAR'
  const confirmLabel =
    typeof waitingCfg.confirmLabel === 'string' && waitingCfg.confirmLabel.trim()
      ? waitingCfg.confirmLabel
      : 'I agree'
  const likertChoices =
    waiting?.choices?.length ? waiting.choices : [...DEFAULT_LIKERT_CHOICES]
  const numberedChoices = waiting?.choices?.length ? waiting.choices : []
  const ratingOptions = useMemo(() => {
    const lo = Math.min(ratingMin, ratingMax)
    const hi = Math.max(ratingMin, ratingMax)
    const out: number[] = []
    for (let i = lo; i <= hi; i++) out.push(i)
    return out.length <= 20 ? out : []
  }, [ratingMin, ratingMax])
  const usesDedicatedAnswerUi =
    (isRating && ratingOptions.length > 0) ||
    isStars ||
    isNps ||
    isThumbs ||
    isMood ||
    isLikert ||
    isNumberedChoice ||
    isFile ||
    isSignature ||
    isImageChoice ||
    isExtended
  const answerStoreCtx = {
    instanceId,
    chatbotId,
    nodeKey: waitingNode?.key ?? 'question',
  }
  const imageChoiceCards = imageChoiceCardsFromCatalog(waitingCfg, mediaCatalog)
  const imageChoiceLayout = readImageChoiceLayout(waitingCfg)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!state || !waiting) return

    if (isChoiceType) {
      if (waiting.allowMultiple) {
        if (!selectedChoices.length) return
        setState(submitPreviewAnswer(state, nodes, edges, selectedChoices))
      } else {
        const one = selectedChoices[0]
        if (!one) return
        setState(submitPreviewAnswer(state, nodes, edges, one))
      }
      setSelectedChoices([])
      return
    }

    if (!draft.trim()) return
    const answer = draft.trim()
    setDraft('')
    setState(submitPreviewAnswer(state, nodes, edges, answer))
  }

  function onSkipOptional() {
    if (!state || !waitingOptional) return
    setDraft('')
    setSelectedChoices([])
    setState(skipPreviewQuestion(state, nodes, edges))
  }

  function onChoiceChange(next: string | string[]) {
    if (waiting?.allowMultiple) {
      setSelectedChoices(Array.isArray(next) ? next.map(String) : next ? [String(next)] : [])
      return
    }
    setSelectedChoices(typeof next === 'string' && next ? [next] : [])
  }

  function inputTypeForAnswer(answerType: string): string {
    switch (answerType) {
      case 'number':
      case 'rating':
        return 'number'
      case 'email':
        return 'email'
      case 'phone':
        return 'tel'
      // Use text so bare hosts like google.com are allowed (HTML url type requires a scheme).
      case 'url':
        return 'text'
      default:
        return 'text'
    }
  }

  function placeholderForAnswer(answerType: string, optional: boolean): string {
    switch (answerType) {
      case 'email': {
        const domains = normalizeAllowedEmailDomains(waitingCfg.allowedEmailDomains)
        return domains[0] ? `you@${domains[0]}` : 'you@example.com'
      }
      case 'phone':
        return waitingCfg.phoneFormat === 'e164' ? '+15551234567' : 'Enter a phone number'
      case 'url':
        return 'google.com or https://…'
      case 'number':
        return 'Enter a number'
      case 'date':
        return 'YYYY-MM-DD'
      case 'time':
        return 'HH:MM'
      case 'datetime':
        return 'Date and time'
      case 'name':
        return 'Full name'
      case 'address':
        return optional ? 'Street, city, postal code… (optional)' : 'Street, city, postal code…'
      case 'postal_code':
        return 'Digits only (e.g. 12345)'
      case 'country':
        return 'Select a country'
      case 'long_text':
        return optional ? 'Type your reply (optional)…' : 'Type your reply…'
      default:
        return optional ? 'Type your reply (optional)…' : 'Type your reply…'
    }
  }

  return createPortal(
    <div
      data-designer-skip-undo
      className="pointer-events-none fixed right-5 bottom-5 z-[100] flex flex-col items-end gap-3"
    >
      {open ? (
        <div
          className={cn(
            'pointer-events-auto relative flex h-[min(640px,72vh)] w-[min(100vw-2.5rem,380px)] flex-col overflow-hidden',
            'rounded-[1.75rem] border border-[var(--color-border)]/70 bg-[var(--color-surface)]/95 shadow-[0_25px_80px_-20px_rgb(15_23_42_/_0.45)] backdrop-blur-2xl',
            'animate-[ff-rise_0.4s_var(--ease-spring)]',
          )}
        >
          <ChatMediaPlayerProvider>
          <div className="relative overflow-hidden rounded-t-[1.75rem] border-b border-[var(--color-border)]/40 px-4 py-3.5">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-accent)] to-[var(--color-accent-2)]" />
            <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[var(--color-accent-fg)]/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-[var(--color-accent-2)]/30 blur-2xl" />
            <div className="relative flex items-center justify-between gap-3 text-[var(--color-accent-fg)]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-accent-fg)]/15 shadow-inner ring-1 ring-[var(--color-accent-fg)]/25 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-fg)]/75">
                    Preview
                  </p>
                  <h2 className="truncate font-[family-name:var(--font-display)] text-base font-semibold leading-tight">
                    {botName.data ?? 'Chatbot'}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {scenarios.length ? (
                  <select
                    value={scenarioId}
                    onChange={(e) => setScenarioId(e.target.value)}
                    aria-label="Test scenario"
                    className="mr-1 max-w-[9.5rem] rounded-lg border-0 bg-[var(--color-accent-fg)]/15 px-2 py-1 text-[11px] font-semibold text-[var(--color-accent-fg)] outline-none ring-1 ring-[var(--color-accent-fg)]/25"
                  >
                    <option value="" className="text-[var(--color-ink)]">
                      Live globals
                    </option>
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id} className="text-[var(--color-ink)]">
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl p-2 text-[var(--color-accent-fg)]/85 transition hover:bg-[var(--color-accent-fg)]/15 hover:text-[var(--color-accent-fg)]"
                  onClick={restart}
                  aria-label="Restart conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-[var(--color-accent-fg)]/85 transition hover:bg-[var(--color-accent-fg)]/15 hover:text-[var(--color-accent-fg)]"
                  onClick={() => onOpenChange(false)}
                  aria-label="Minimize"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-[var(--color-accent-fg)]/85 transition hover:bg-[var(--color-accent-fg)]/15 hover:text-[var(--color-accent-fg)]"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="ff-hide-scrollbar relative flex-1 space-y-3.5 overflow-y-auto bg-gradient-to-b from-[var(--color-surface-2)]/80 via-[var(--color-surface)] to-[var(--color-accent-2)]/40 px-3.5 py-4"
          >
            {!state?.messages.length && state?.phase.kind === 'typing' ? (
              <p className="text-center text-xs text-[var(--color-ink-muted)]">Starting conversation…</p>
            ) : null}

            {state?.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col gap-1',
                  m.role === 'user' ? 'items-end' : m.role === 'system' ? 'items-center' : 'items-start',
                )}
              >
                {m.role === 'system' ? (
                  <div className="max-w-[92%] rounded-full bg-[var(--color-surface-2)]/70 px-3 py-1 text-center text-[11px] text-[var(--color-ink-muted)]">
                    {m.text}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                      m.role === 'user'
                        ? 'rounded-[1.25rem] rounded-br-md bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] text-[var(--color-accent-fg)]'
                        : 'rounded-[1.25rem] rounded-bl-md border border-[var(--color-border)]/80 bg-[var(--color-surface)] text-[var(--color-ink)]',
                    )}
                  >
                    {m.role === 'user' ? (
                      <UserMessageBubble message={m} />
                    ) : (
                      <>
                        <ChatMessageBody text={m.text} attachments={m.media} />
                      </>
                    )}
                  </div>
                )}
                <time
                  dateTime={m.createdAt}
                  className={cn(
                    'px-1 text-[10px] font-medium tracking-wide text-[var(--color-ink-muted)]',
                    m.role === 'user' ? 'text-right' : m.role === 'system' ? 'text-center' : 'text-left',
                  )}
                >
                  {prettyTimestamp(m.createdAt)}
                </time>
              </div>
            ))}

            {state?.phase.kind === 'typing' ? (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-1.5 rounded-[1.25rem] rounded-bl-md border border-[var(--color-border)]/80 bg-[var(--color-surface)] px-3.5 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent)] [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent-2)] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-accent-2)]/100 [animation-delay:300ms]" />
                </div>
              </div>
            ) : null}

            {state?.phase.kind === 'finished' ? (
              <p className="pt-1 text-center text-xs text-[var(--color-ink-muted)]">Conversation ended</p>
            ) : null}
          </div>

          {waiting && waiting.answerType === 'boolean' ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <div className="flex gap-2">
                <Button className="flex-1 rounded-2xl" onClick={() => setState(submitPreviewAnswer(state!, nodes, edges, 'true'))}>
                  Yes
                </Button>
                <Button
                  className="flex-1 rounded-2xl"
                  variant="secondary"
                  onClick={() => setState(submitPreviewAnswer(state!, nodes, edges, 'false'))}
                >
                  No
                </Button>
              </div>
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isThumbs ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <ThumbsAnswerField
                onSelect={(v) => setState(submitPreviewAnswer(state!, nodes, edges, v))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isMood ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <MoodAnswerField
                onSelect={(v) => setState(submitPreviewAnswer(state!, nodes, edges, v))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isLikert ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <LikertAnswerField
                choices={likertChoices}
                onSelect={(v) => setState(submitPreviewAnswer(state!, nodes, edges, v))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isNumberedChoice ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <NumberedChoiceAnswerField
                choices={numberedChoices}
                onSelect={(v) => setState(submitPreviewAnswer(state!, nodes, edges, v))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isRating && ratingOptions.length ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <div className="flex flex-wrap gap-2">
                {ratingOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/80 text-sm font-semibold text-[var(--color-accent)] transition hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent-soft)]"
                    onClick={() => setState(submitPreviewAnswer(state!, nodes, edges, String(n)))}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isStars ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <StarsAnswerField
                min={starsMin}
                max={starsMax}
                onSelect={(n) => setState(submitPreviewAnswer(state!, nodes, edges, String(n)))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isNps ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <NpsAnswerField
                min={npsMin}
                max={npsMax}
                minLabel={
                  typeof waitingCfg.minLabel === 'string' && waitingCfg.minLabel.trim()
                    ? waitingCfg.minLabel
                    : 'Not at all likely'
                }
                maxLabel={
                  typeof waitingCfg.maxLabel === 'string' && waitingCfg.maxLabel.trim()
                    ? waitingCfg.maxLabel
                    : 'Extremely likely'
                }
                onSelect={(n) => setState(submitPreviewAnswer(state!, nodes, edges, String(n)))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isFile ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <FileAnswerField
                accept={normalizeFileAccept(waitingCfg.fileAccept)}
                maxFiles={normalizeMaxFiles(waitingCfg.maxFiles)}
                storeCtx={answerStoreCtx}
                onSubmit={(value) => setState(submitPreviewAnswer(state!, nodes, edges, value))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isSignature ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <SignatureAnswerField
                storeCtx={answerStoreCtx}
                onSubmit={(value) => setState(submitPreviewAnswer(state!, nodes, edges, value))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isImageChoice ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <ImageChoiceAnswerField
                className={imageChoiceLayout === 'gallery' ? '-mx-3.5' : undefined}
                layout={imageChoiceLayout}
                options={imageChoiceCards}
                allowMultiple={waiting.allowMultiple === true}
                value={waiting.allowMultiple ? selectedChoices : (selectedChoices[0] ?? '')}
                onChange={(next) => {
                  if (waiting.allowMultiple) {
                    setSelectedChoices(Array.isArray(next) ? next.map(String) : next ? [String(next)] : [])
                    return
                  }
                  const label = Array.isArray(next) ? next[0] : next
                  if (!label) return
                  setSelectedChoices([])
                  setState(
                    submitPreviewAnswer(
                      state!,
                      nodes,
                      edges,
                      imageChoicePayloadFromSelection(imageChoiceCards, String(label)),
                    ),
                  )
                }}
              />
              {waiting.allowMultiple ? (
                <Button
                  className="self-end rounded-2xl"
                  disabled={!selectedChoices.length}
                  onClick={() => {
                    if (!selectedChoices.length) return
                    setState(
                      submitPreviewAnswer(
                        state!,
                        nodes,
                        edges,
                        imageChoicePayloadFromSelection(imageChoiceCards, selectedChoices),
                      ),
                    )
                    setSelectedChoices([])
                  }}
                >
                  Send
                </Button>
              ) : null}
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isExtended ? (
            <div className="ff-hide-scrollbar flex min-h-0 max-h-[min(32rem,70%)] flex-col overflow-y-auto border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/90 px-3.5 py-3">
              <ExtendedAnswerPanel
                answerType={waiting.answerType}
                config={waitingCfg}
                choices={waiting.choices ?? []}
                allowMultiple={waiting.allowMultiple === true}
                storeCtx={answerStoreCtx}
                onSubmit={(value) => setState(submitPreviewAnswer(state!, nodes, edges, value))}
                optional={waitingOptional}
                onSkip={onSkipOptional}
                validationError={waiting.validationError}
                payment={waiting.payment}
                captchaPrompt={waiting.captchaPrompt}
                templates={{ ...(state?.templates ?? {}), ...templatesMap }}
                mediaCatalog={mediaCatalog}
                onRefreshCaptcha={() => setState(refreshCaptchaChallenge(state!, nodes))}
                onStartPayment={
                  waiting.payment?.verify && waiting.payment.connectionId && chatbotId && instanceId
                    ? async () => {
                        const started = await startPaymentIntent({
                          connectionId: waiting.payment!.connectionId!,
                          chatbotId,
                          instanceId,
                          nodeKey: waiting.payment!.nodeKey,
                          amount: waiting.payment!.amount,
                          currency: waiting.payment!.currency,
                          itemName: waiting.payment!.itemName,
                          buyerEmail: waiting.payment!.buyerEmail,
                          buyerName: waiting.payment!.buyerName,
                          payUrl: waiting.payment!.url,
                          returnUrl: window.location.href,
                        })
                        return {
                          reference: started.reference,
                          checkoutUrl: started.checkout_url,
                          fields: started.fields,
                        }
                      }
                    : undefined
                }
                onCheckPayment={
                  waiting.payment?.verify && chatbotId
                    ? async (reference) => {
                        const result = await getPaymentStatus({ reference, chatbotId })
                        return {
                          status: result.status,
                          providerPaymentId: result.provider_payment_id,
                        }
                      }
                    : undefined
                }
              />
            </div>
          ) : null}

          {waiting &&
          waiting.answerType !== 'boolean' &&
          !usesDedicatedAnswerUi ? (
            <div className="rounded-b-[1.75rem] border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/95 px-3 py-3">
              <form onSubmit={onSubmit} className="flex items-end gap-2">
                {isChoiceType ? (
                  <ChoiceAnswerField
                    className="flex-1"
                    variant="chat"
                    choices={waiting.choices ?? []}
                    allowMultiple={waiting.allowMultiple === true}
                    value={waiting.allowMultiple ? selectedChoices : (selectedChoices[0] ?? '')}
                    onChange={onChoiceChange}
                  />
                ) : isSlider || isPercentage ? (
                  <SliderAnswerField
                    className="flex-1"
                    value={draft}
                    onChange={setDraft}
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    required={inputConstraints.required && !waitingOptional}
                    suffix={isPercentage ? '%' : undefined}
                    minLabel={
                      typeof waitingCfg.minLabel === 'string' && waitingCfg.minLabel.trim()
                        ? waitingCfg.minLabel
                        : isPercentage
                          ? `${sliderMin}%`
                          : undefined
                    }
                    maxLabel={
                      typeof waitingCfg.maxLabel === 'string' && waitingCfg.maxLabel.trim()
                        ? waitingCfg.maxLabel
                        : isPercentage
                          ? `${sliderMax}%`
                          : undefined
                    }
                  />
                ) : isStepper ? (
                  <StepperAnswerField
                    className="flex-1"
                    value={draft}
                    onChange={setDraft}
                    min={sliderMin}
                    max={sliderMax}
                    step={sliderStep}
                    required={inputConstraints.required && !waitingOptional}
                  />
                ) : isCurrency ? (
                  <CurrencyAnswerField
                    className="flex-1"
                    value={draft}
                    onChange={setDraft}
                    currencyCode={currencyCode}
                    min={inputConstraints.min}
                    max={inputConstraints.max}
                    step={
                      typeof inputConstraints.step === 'number' ? inputConstraints.step : 0.01
                    }
                    required={inputConstraints.required && !waitingOptional}
                  />
                ) : isOtp ? (
                  <OtpAnswerField
                    className="flex-1"
                    value={draft}
                    onChange={setDraft}
                    length={otpLength}
                  />
                ) : isConfirm ? (
                  <ConfirmAnswerField
                    className="flex-1"
                    checked={draft === 'true'}
                    onCheckedChange={(on) => setDraft(on ? 'true' : '')}
                    label={confirmLabel}
                    required={inputConstraints.required && !waitingOptional}
                  />
                ) : isColor ? (
                  <ColorAnswerField
                    className="flex-1"
                    value={draft}
                    onChange={setDraft}
                    required={inputConstraints.required && !waitingOptional}
                    pattern={inputConstraints.pattern}
                  />
                ) : waiting.answerType === 'long_text' || waiting.answerType === 'address' ? (
                  <textarea
                    ref={inputRef as RefObject<HTMLTextAreaElement>}
                    className={cn(
                      'flex-1 resize-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15',
                      waiting.answerType === 'address' ? 'min-h-[108px]' : 'min-h-[88px]',
                    )}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={placeholderForAnswer(waiting.answerType, waitingOptional)}
                    required={inputConstraints.required && !waitingOptional}
                    minLength={inputConstraints.minLength}
                    maxLength={inputConstraints.maxLength}
                  />
                ) : waiting.answerType === 'country' ? (
                  <CountryAnswerField
                    className="flex-1"
                    variant="chat"
                    value={draft}
                    onChange={setDraft}
                    allowCustom
                  />
                ) : waiting.answerType === 'phone' ? (
                  <PhoneAnswerField
                    className="flex-1"
                    variant="chat"
                    value={draft}
                    onChange={setDraft}
                    minLength={inputConstraints.minLength}
                    maxLength={inputConstraints.maxLength}
                    pattern={inputConstraints.pattern}
                    required={inputConstraints.required && !waitingOptional}
                  />
                ) : dateTimeModeForAnswerType(waiting.answerType) ? (
                  <TemporalAnswerField
                    className="flex-1"
                    variant="chat"
                    answerType={waiting.answerType}
                    value={draft}
                    onChange={setDraft}
                    min={inputConstraints.minDate}
                    max={inputConstraints.maxDate}
                  />
                ) : (
                  <input
                    ref={inputRef as RefObject<HTMLInputElement>}
                    className="h-11 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm outline-none transition focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15"
                    value={draft}
                    onChange={(e) => {
                      const next = e.target.value
                      setDraft(
                        waiting.answerType === 'postal_code' ? next.replace(/\D/g, '') : next,
                      )
                    }}
                    placeholder={placeholderForAnswer(waiting.answerType, waitingOptional)}
                    type={inputTypeForAnswer(waiting.answerType)}
                    required={inputConstraints.required && !waitingOptional}
                    inputMode={inputConstraints.inputMode}
                    autoCapitalize={inputConstraints.autoCapitalize}
                    spellCheck={inputConstraints.spellCheck}
                    autoComplete={inputConstraints.autoComplete}
                    min={constraintAttr(inputConstraints.min)}
                    max={constraintAttr(inputConstraints.max)}
                    step={constraintAttr(inputConstraints.step)}
                    minLength={inputConstraints.minLength}
                    maxLength={inputConstraints.maxLength}
                    pattern={inputConstraints.pattern}
                  />
                )}
                <Button
                  type="submit"
                  size="md"
                  disabled={
                    isChoiceType
                      ? !selectedChoices.length
                      : isConfirm
                        ? draft !== 'true'
                        : isOtp
                          ? draft.replace(/\D/g, '').length !== otpLength
                          : !draft.trim()
                  }
                  aria-label="Send"
                  className="h-11 w-11 shrink-0 rounded-2xl !px-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              {waiting.validationError ? (
                <p className="mt-2 px-1 text-[11px] text-[var(--color-danger)]">{waiting.validationError}</p>
              ) : null}
              {otpHasEmailConnection ? (
                <div className="mt-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] text-[var(--color-ink-muted)]">
                    {waiting.otpDelivery === 'pending' || !state?.otpChallenge
                      ? 'Sending verification code…'
                      : waiting.otpDelivery === 'failed'
                        ? 'Could not send code'
                        : waiting.otpSentTo
                          ? `Code sent to ${waiting.otpSentTo}`
                          : 'Code sent'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={otpSending}
                    onClick={() => {
                      if (!state || otpSendBusy.current) return
                      const otpConnId = String(waitingCfg.otpConnectionId ?? '').trim()
                      otpSendBusy.current = true
                      setOtpSending(true)
                      void (async () => {
                        let map = connectionsById
                        if (otpConnId && !map[otpConnId]?.smtpHost && chatbotId) {
                          const cfg = await loadEmailConnectionConfig(otpConnId, chatbotId)
                          if (cfg) map = { ...map, [otpConnId]: cfg }
                        }
                        return sendOtpEmailChallenge(state, nodes, map, {
                          ...connectionCtx,
                          resend: true,
                        })
                      })()
                        .then((next) => setState(next))
                        .finally(() => {
                          otpSendBusy.current = false
                          setOtpSending(false)
                        })
                    }}
                  >
                    {otpSending ? 'Sending…' : 'Resend code'}
                  </Button>
                </div>
              ) : null}
              {waitingOptional ? (
                <div className="mt-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] text-[var(--color-ink-muted)]">
                    {waitingTimeoutSec > 0
                      ? `Optional · times out after ${waitingTimeoutSec}s`
                      : 'Optional — you can skip'}
                  </p>
                  <Button type="button" size="sm" variant="ghost" onClick={onSkipOptional}>
                    Skip
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!waiting && state?.phase.kind !== 'finished' && state?.phase.kind !== 'waiting_input' ? (
            <div className="border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/80 px-4 py-2.5 text-center text-[11px] text-[var(--color-ink-muted)]">
              Flow is running…
            </div>
          ) : null}

          {varEntries.length ? (
            <details className="border-t border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/90 px-4 py-2 text-xs">
              <summary className="cursor-pointer font-medium text-[var(--color-ink-muted)]">Variables ({varEntries.length})</summary>
              <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto font-mono text-[11px]">
                {varEntries.map(([k, v]) => (
                  <li key={k} className="truncate">
                    <span className="text-[var(--color-accent)]">{k}</span> = {JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          </ChatMediaPlayerProvider>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'Close chat preview' : 'Open chat preview'}
        className={cn(
          'pointer-events-auto group relative grid h-14 w-14 place-items-center rounded-[1.35rem] text-[var(--color-accent-fg)] transition-all duration-300',
          'bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-accent)] to-[var(--color-accent-2)]',
          'shadow-[0_16px_40px_-12px_rgb(15_118_110_/_0.7)]',
          'hover:scale-105 hover:shadow-[0_20px_48px_-12px_rgb(8_145_178_/_0.75)] active:scale-95',
          open && 'rotate-0',
        )}
      >
        <span className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-[var(--color-accent-fg)]/10 opacity-0 transition group-hover:opacity-100" />
        <span className="pointer-events-none absolute -inset-1 animate-[ff-pulse-soft_2.4s_ease-in-out_infinite] rounded-[1.55rem] bg-[var(--color-accent)]/25 blur-md" />
        {open ? <Minimize2 className="relative h-5 w-5" /> : <MessageCircle className="relative h-6 w-6" />}
      </button>
    </div>,
    document.body,
  )
}
