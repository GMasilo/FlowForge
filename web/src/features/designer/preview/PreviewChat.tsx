import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { MessageCircle, Minimize2, RotateCcw, Send, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useDesignerStore } from '@/features/designer/store/designerStore'
import {
  createInitialPreviewState,
  runConnectionStep,
  runEntityStep,
  runIntegrationStep,
  sendOtpEmailChallenge,
  skipPreviewQuestion,
  submitPreviewAnswer,
  submitPreviewSuggestion,
  handlePreviewButtonInteract,
  refreshCaptchaChallenge,
  tickPreview,
  timeoutPreviewQuestion,
  type PreviewEngineState,
  type PreviewStepRun,
} from '@/features/designer/preview/previewRuntime'
import { clearAllChatCookies } from '@/features/chat/chatCookies'
import { executeChatbotTransfer } from '@/features/designer/model/chatbotTransfer'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
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
import { SignInAnswerField } from '@/features/chat/SignInAnswerField'
import { completeSignInStep, parseSignInConfig, sendSignInOtpChallenge } from '@/features/designer/model/signInStep'
import { UserMessageBubble } from '@/features/chat/UserMessageBubble'
import { ChatMessageBody } from '@/features/chat/ChatMessageBody'
import { SuggestionResponseChips } from '@/features/chat/SuggestionResponseChips'
import { ButtonStepChips } from '@/features/chat/ButtonStepChips'
import {
  emitFlowEvent,
  emitRunFunction,
  parseListenerPayload,
} from '@/features/chat/flowEvents'
import {
  type ButtonListenerEvent,
  type ResolvedButtonOption,
} from '@/features/designer/model/buttonStep'
import { ChatBubbleMeta, messageCopyText } from '@/features/chat/ChatBubbleMeta'
import { ChatMediaPlayerProvider } from '@/features/chat/ChatMediaPlayer'
import { useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { mediaKeyFromFilename, chatTextHasSocialEmbed, chatTextHasMapEmbed, chatTextHasQrEmbed } from '@/features/designer/model/chatbotMedia'
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
import {
  TYPEWRITER_CPS,
  chatAppearanceThemeClass,
  chatMessageEmphasisClass,
  chatMessageEntranceClass,
  chatRootStyle,
  ensureChatFontFace,
  resolveChatBranding,
  resolveChatBubblePaint,
} from '@/features/chatbots/chatbotBranding'
import { ChatLogoGlyph } from '@/features/chatbots/chatbotLogoIcons'
import { ChatStoriesRing } from '@/features/chat/ChatStoriesRing'
import { useChatBubbleEntrance } from '@/features/chat/useChatBubbleEntrance'
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
  const storeNodes = useDesignerStore((s) => s.nodes)
  const storeEdges = useDesignerStore((s) => s.edges)
  const [graphOverride, setGraphOverride] = useState<{
    nodes: DesignerNode[]
    edges: DesignerEdge[]
    chatbotId: string
    name: string
  } | null>(null)
  const nodes = graphOverride?.nodes ?? storeNodes
  const edges = graphOverride?.edges ?? storeEdges
  const activeChatbotId = graphOverride?.chatbotId ?? chatbotId ?? ''
  const connectionCtx = useMemo(
    () => ({
      chatbotId: activeChatbotId || undefined,
      instanceId: instanceId || undefined,
    }),
    [activeChatbotId, instanceId],
  )
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
  const chatbotBranding = useQuery({
    queryKey: ['chatbot-branding', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error } = await supabase.from('chatbots').select('settings').eq('id', chatbotId!).single()
      if (error) throw error
      return data.settings
    },
  })
  const displayBotName = graphOverride?.name ?? botName.data ?? 'Preview'
  const branding = useMemo(
    () =>
      resolveChatBranding({
        settings: chatbotBranding.data,
        instanceId: instanceId || null,
        chatbotId: chatbotId || null,
      }),
    [chatbotBranding.data, instanceId, chatbotId],
  )

  useEffect(() => {
    if (branding.resolvedFontFamily && branding.resolvedFontUrl) {
      ensureChatFontFace(branding.resolvedFontFamily, branding.resolvedFontUrl)
    }
  }, [branding.resolvedFontFamily, branding.resolvedFontUrl])

  const globals = useQuery({
    // Distinct from ChatbotSettingsPage's ['chatbot-variables'] which caches the row array.
    queryKey: ['chatbot-variable-defaults', chatbotId],
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
        let cfg: Record<string, unknown> | null = null
        if (
          row.config &&
          typeof row.config === 'object' &&
          !Array.isArray(row.config) &&
          String((row.config as Record<string, unknown>).smtpHost ?? (row.config as Record<string, unknown>).baseUrl ?? '').trim()
        ) {
          cfg = row.config as Record<string, unknown>
        } else if (row.kind === 'email') {
          const loaded = await loadEmailConnectionConfig(row.id, chatbotId!)
          if (loaded) cfg = loaded as Record<string, unknown>
        } else {
          const { loadConnectionConfigForUse } = await import('@/features/connections/connectionApi')
          const loaded = await loadConnectionConfigForUse(row.id, chatbotId!)
          if (loaded) cfg = loaded as Record<string, unknown>
        }
        if (cfg) map[row.id] = { ...cfg, name: row.name }
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
  const shouldAnimateBubble = useChatBubbleEntrance(state?.messages)
  const typewriterCps = TYPEWRITER_CPS[branding.typewriterSpeed]

  const ready = !!globals.data
  const selectedScenario = scenarios.find((s) => s.id === scenarioId) ?? null

  function mergedGlobals(): Record<string, unknown> {
    return {
      ...(globals.data ?? {}),
      ...(selectedScenario ? parseScenarioGlobals(selectedScenario.globals) : {}),
    }
  }

  function restart(opts?: { clearCookies?: boolean }) {
    if (!globals.data) return
    if (opts?.clearCookies) clearAllChatCookies(chatbotId)
    setGraphOverride(null)
    setSessionKey((k) => k + 1)
    onScenarioResult?.(null)
    setState(createInitialPreviewState(storeNodes, storeEdges, mergedGlobals(), mediaCatalog, templatesMap, chatbotId))
    setDraft('')
    setSelectedChoices([])
    otpSentForWait.current = null
  }

  useEffect(() => {
    if (!ready || !open) return
    setGraphOverride(null)
    onScenarioResult?.(null)
    setState(createInitialPreviewState(storeNodes, storeEdges, mergedGlobals(), mediaCatalog, templatesMap, chatbotId))
    setDraft('')
    setSelectedChoices([])
    otpSentForWait.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessionKey / open / scenario intentionally restarts preview
  }, [ready, open, sessionKey, scenarioId])

  useEffect(() => {
    if (!open || !state || state.phase.kind !== 'restart') return
    restart({ clearCookies: state.phase.clearCookies })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to restart phase
  }, [open, state?.phase])

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

    if (
      node?.type === 'http' ||
      node?.type === 'email' ||
      node?.type === 'database' ||
      node?.type === 'entity' ||
      node?.type === 'integration' ||
      node?.type === 'transfer'
    ) {
      if (connectionBusy.current) return
      let started = false
      const timer = window.setTimeout(() => {
        if (connectionBusy.current) return
        started = true
        connectionBusy.current = true
        const run =
          node.type === 'transfer'
            ? executeChatbotTransfer({
                state,
                node,
                mode: 'preview',
                environment: 'production',
                fromChatbotId: activeChatbotId,
                fromChatbotName: displayBotName,
                instanceId: instanceId ?? '',
              }).then((result) => {
                setGraphOverride({
                  nodes: result.graph.nodes,
                  edges: result.graph.edges,
                  chatbotId: result.chatbotId,
                  name: result.name,
                })
                return result.state
              })
            : node.type === 'entity'
              ? runEntityStep(state, nodes, edges, connectionCtx)
              : node.type === 'integration'
                ? runIntegrationStep(state, nodes, edges, connectionCtx)
                : runConnectionStep(state, nodes, edges, connectionsById, connectionCtx)
        void run
          .then((next) => setState(next))
          .catch((err) => {
            console.error('Preview step failed', err)
            setState((prev) =>
              prev
                ? {
                    ...prev,
                    messages: [
                      ...prev.messages,
                      {
                        id: crypto.randomUUID(),
                        role: 'bot',
                        text: err instanceof Error ? err.message : 'Transfer failed',
                        createdAt: new Date().toISOString(),
                      },
                    ],
                    phase: { kind: 'finished' },
                    currentId: null,
                  }
                : prev,
            )
          })
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

  function scrollChatToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  useEffect(() => {
    if (open && (state?.phase.kind === 'waiting_input' || state?.phase.kind === 'waiting_suggestion')) inputRef.current?.focus()
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
  const waitingSuggestion = state?.phase.kind === 'waiting_suggestion' ? state.phase : null
  const waitingButton = state?.phase.kind === 'waiting_button' ? state.phase : null
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
  const isSignIn = waiting?.answerType === 'sign_in' || waitingNode?.type === 'sign_in'
  const isExtended = isExtendedAnswerType(waiting?.answerType ?? '')
  const signInMode = parseSignInConfig(waitingNode?.config).mode
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
    isSignIn ||
    isExtended
  const answerStoreCtx = {
    instanceId,
    chatbotId,
    nodeKey: waitingNode?.key ?? 'question',
  }
  const imageChoiceCards = imageChoiceCardsFromCatalog(waitingCfg, mediaCatalog)
  const imageChoiceLayout = readImageChoiceLayout(waitingCfg)

  function onSuggestionPick(text: string) {
    if (!state) return
    setDraft('')
    setState(submitPreviewSuggestion(state, nodes, edges, text))
  }

  function onButtonInteract(event: ButtonListenerEvent, button: ResolvedButtonOption) {
    if (!state || state.phase.kind !== 'waiting_button') return
    const { state: next, sideEffects } = handlePreviewButtonInteract(
      state,
      nodes,
      edges,
      event,
      button,
    )
    for (const effect of sideEffects) {
      if (effect.type === 'emit_event') {
        emitFlowEvent({
          eventName: effect.eventName,
          value: effect.value,
          payload: effect.payload,
          nodeKey: effect.nodeKey,
        })
      } else if (effect.type === 'run_function_host') {
        emitRunFunction({
          name: effect.name,
          args:
            typeof effect.args === 'string'
              ? parseListenerPayload(effect.args)
              : effect.args,
          value: effect.value,
          nodeKey: effect.nodeKey,
        })
      } else if (effect.type === 'restart_chat') {
        // Phase is already `restart`; the effect below calls restart().
      }
    }
    setState(next)
  }

  function onSubmitSuggestion(e: FormEvent) {
    e.preventDefault()
    if (!state || !waitingSuggestion) return
    if (!draft.trim()) return
    const answer = draft.trim()
    setDraft('')
    setState(submitPreviewSuggestion(state, nodes, edges, answer))
  }

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
      style={chatRootStyle(branding)}
    >
      {open ? (
        <div
          className={cn(
            'pointer-events-auto relative flex h-[min(640px,72vh)] w-[min(100vw-2.5rem,380px)] flex-col overflow-hidden',
            'rounded-[1.75rem] border border-[var(--color-border)]/70 shadow-[0_25px_80px_-20px_rgb(15_23_42_/_0.45)]',
            'animate-[ff-rise_0.4s_var(--ease-spring)]',
            chatAppearanceThemeClass(branding.appearanceTheme),
          )}
          style={{
            ...chatRootStyle(branding),
            background: 'var(--ff-chat-page-gradient)',
          }}
        >
          <ChatMediaPlayerProvider>
          <div
            data-ff-chat-header
            className="relative overflow-hidden rounded-t-[1.75rem] border-b border-white/40 px-4 py-3.5"
            style={{ background: 'var(--ff-chat-header-gradient)' }}
          >
            <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
            <div
              data-ff-chat-header-content
              className="relative flex items-center justify-between gap-3"
              style={{ color: 'var(--ff-chat-header-fg)' }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChatStoriesRing
                  stories={branding.resolvedStories}
                  chatbotId={activeChatbotId || chatbotId || 'preview'}
                  size="md"
                  viewerMode="absolute"
                >
                  <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/20 shadow-inner ring-1 ring-white/30 backdrop-blur">
                    {branding.resolvedLogoUrl ? (
                      <img src={branding.resolvedLogoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ChatLogoGlyph id={branding.resolvedLogoIcon} className="h-4 w-4" />
                    )}
                  </span>
                </ChatStoriesRing>
                <div className="min-w-0">
                  {branding.showEyebrow ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
                      Preview
                    </p>
                  ) : null}
                  <h2
                    className={cn(
                      'truncate text-base font-semibold leading-tight',
                      branding.resolvedFontFamily
                        ? undefined
                        : 'font-[family-name:var(--font-display)]',
                    )}
                  >
                    {displayBotName}
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {scenarios.length ? (
                  <select
                    value={scenarioId}
                    onChange={(e) => setScenarioId(e.target.value)}
                    aria-label="Test scenario"
                    className="mr-1 max-w-[9.5rem] rounded-lg border-0 bg-white/20 px-2 py-1 text-[11px] font-semibold text-white outline-none ring-1 ring-white/30"
                  >
                    <option value="" className="text-slate-800">
                      Live globals
                    </option>
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id} className="text-slate-800">
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl p-2 text-white/85 transition hover:bg-white/15 hover:text-white"
                  onClick={() => restart()}
                  aria-label="Restart conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-white/85 transition hover:bg-white/15 hover:text-white"
                  onClick={() => onOpenChange(false)}
                  aria-label="Minimize"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-white/85 transition hover:bg-white/15 hover:text-white"
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
            className="ff-hide-scrollbar relative flex-1 space-y-3.5 overflow-y-auto px-3.5 py-4"
          >
            {!state?.messages.length && state?.phase.kind === 'typing' ? (
              <p className="text-center text-xs text-[var(--color-ink-muted)]">Starting conversation…</p>
            ) : null}

            {state?.messages.map((m, msgIndex) => {
              const animate = shouldAnimateBubble(m.id)
              const entranceClass = chatMessageEntranceClass(
                m.animation?.entrance ?? branding.messageEntrance,
                animate,
              )
              const emphasisClass = chatMessageEmphasisClass(m.animation?.emphasis, animate)
              const bubblePaint =
                m.role === 'bot' || m.role === 'agent'
                  ? resolveChatBubblePaint({
                      color: m.bubble?.color,
                      shading: m.bubble?.shading,
                    })
                  : null
              return (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col gap-1',
                  m.role === 'user' ? 'items-end' : m.role === 'system' ? 'items-center' : 'items-start',
                  entranceClass,
                )}
              >
                {m.role === 'system' ? (
                  <div className="max-w-[92%] rounded-full bg-[var(--color-surface-2)]/70 px-3 py-1 text-center text-[11px] text-[var(--color-ink-muted)]">
                    {m.text}
                  </div>
                ) : (
                  <div
                    className={cn(
                      'px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                      emphasisClass,
                      m.role === 'user' ? 'ff-chat-bubble-user' : 'ff-chat-bubble-bot',
                      m.role !== 'user' && (chatTextHasSocialEmbed(m.text) || chatTextHasMapEmbed(m.text) || chatTextHasQrEmbed(m.text))
                        ? 'w-full max-w-xl sm:max-w-2xl'
                        : 'max-w-[88%]',
                    )}
                    style={
                      m.role === 'user'
                        ? {
                            background:
                              'linear-gradient(to bottom right, var(--ff-chat-bubble-user), var(--ff-chat-bubble-user-2))',
                            color: 'var(--ff-chat-bubble-user-fg)',
                            borderRadius: 'var(--ff-chat-bubble-radius)',
                            borderBottomRightRadius: '0.35rem',
                          }
                        : {
                            background: bubblePaint?.background ?? 'var(--ff-chat-bubble-bot)',
                            color: bubblePaint?.color ?? 'var(--ff-chat-bubble-bot-fg)',
                            borderRadius: 'var(--ff-chat-bubble-radius)',
                            borderBottomLeftRadius: '0.35rem',
                            border: '1px solid color-mix(in srgb, var(--ff-chat-bubble-bot-fg) 12%, transparent)',
                          }
                    }
                  >
                    {m.role === 'user' ? (
                      <UserMessageBubble message={m} />
                    ) : (
                      <>
                        <ChatMessageBody
                          text={m.text}
                          attachments={m.media}
                          typingStyle={branding.typingStyle}
                          typewriterCps={typewriterCps}
                          animateTypewriter={
                            branding.typingStyle === 'typewriter' &&
                            m.role === 'bot' &&
                            msgIndex === (state?.messages.length ?? 0) - 1
                          }
                          onTypewriterProgress={() => scrollChatToBottom('auto')}
                          onTypewriterComplete={() => scrollChatToBottom('smooth')}
                        />
                        {m.suggestions?.length ? (
                          <SuggestionResponseChips
                            suggestions={m.suggestions}
                            disabled={!waitingSuggestion}
                            onSelect={onSuggestionPick}
                          />
                        ) : null}
                        {m.buttons?.length ? (
                          <ButtonStepChips
                            buttons={m.buttons}
                            disabled={!waitingButton}
                            onInteract={onButtonInteract}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                )}
                {m.role !== 'system' ? (
                  <ChatBubbleMeta
                    createdAt={m.createdAt}
                    copyText={messageCopyText(m)}
                    align={m.role === 'user' ? 'end' : 'start'}
                    formatTime={prettyTimestamp}
                  />
                ) : (
                  <time
                    dateTime={m.createdAt}
                    className="px-1 text-center text-[10px] font-medium tracking-wide text-slate-400"
                  >
                    {prettyTimestamp(m.createdAt)}
                  </time>
                )}
              </div>
              )
            })}

            {state?.phase.kind === 'typing' ? (
              <div
                className={cn(
                  'flex flex-col items-start gap-1',
                  chatMessageEntranceClass(branding.messageEntrance, true),
                )}
              >
                <div
                  className="flex items-center gap-1.5 px-3.5 py-3 shadow-sm ring-1 ring-black/5"
                  style={{
                    background: 'var(--ff-chat-bubble-bot)',
                    borderRadius: 'var(--ff-chat-bubble-radius)',
                    borderBottomLeftRadius: '0.35rem',
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]"
                    style={{ background: 'var(--ff-chat-accent)' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]"
                    style={{ background: 'var(--ff-chat-accent)' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]"
                    style={{ background: 'var(--ff-chat-accent)' }}
                  />
                </div>
              </div>
            ) : null}

            {state?.phase.kind === 'finished' ? (
              <p className="pt-1 text-center text-xs text-slate-400">Conversation ended</p>
            ) : null}
          </div>

          {waiting && waiting.answerType === 'boolean' ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isThumbs ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
              <ThumbsAnswerField
                onSelect={(v) => setState(submitPreviewAnswer(state!, nodes, edges, v))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isMood ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
              <MoodAnswerField
                onSelect={(v) => setState(submitPreviewAnswer(state!, nodes, edges, v))}
              />
              {waitingOptional ? (
                <Button variant="ghost" className="rounded-2xl self-start" onClick={onSkipOptional}>
                  Skip
                </Button>
              ) : null}
              {waiting.validationError ? (
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isLikert ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isNumberedChoice ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isRating && ratingOptions.length ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
              <div className="flex flex-wrap gap-2">
                {ratingOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full border border-teal-200 bg-teal-50/80 text-sm font-semibold text-teal-800 transition hover:border-teal-400 hover:bg-teal-100"
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isStars ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isNps ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isFile ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isSignature ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isImageChoice ? (
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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
                <p className="text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
            </div>
          ) : null}

          {waiting && isSignIn && waitingNode ? (
            <div className="border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3 py-3">
              <SignInAnswerField
                key={`${waitingNode.id}-${state?.signInAttempts?.attempts ?? 0}-${state?.otpChallenge?.attempts ?? 0}-${waiting.validationError ?? ''}`}
                mode={signInMode}
                error={waiting.validationError}
                nodeConfig={waitingNode.config}
                templatesByKey={{ ...(state?.templates ?? {}), ...templatesMap }}
                chatbotId={chatbotId || undefined}
                nodeId={waitingNode.id}
                ssoLaunch="simulate"
                otpSent={
                  !!state?.otpChallenge &&
                  state.otpChallenge.nodeId === waitingNode.id &&
                  (state.otpChallenge.delivery === 'sent' || state.otpChallenge.delivery === 'mocked')
                }
                otpSending={otpSending}
                onChangeEmail={() =>
                  setState((prev) =>
                    prev
                      ? {
                          ...prev,
                          otpChallenge: null,
                          phase:
                            prev.phase.kind === 'waiting_input'
                              ? { ...prev.phase, validationError: undefined }
                              : prev.phase,
                        }
                      : prev,
                  )
                }
                onSendCode={(email) => {
                  if (!state) return
                  if (otpSendBusy.current) return
                  otpSendBusy.current = true
                  setOtpSending(true)
                  void (async () => {
                    let map = { ...connectionsById }
                    const connectionId = String(waitingNode.config.connectionId ?? '').trim()
                    try {
                      if (connectionId && !String(map[connectionId]?.smtpHost ?? '').trim() && chatbotId) {
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
                              phase:
                                prev.phase.kind === 'waiting_input'
                                  ? { ...prev.phase, validationError: message }
                                  : prev.phase,
                            }
                          : prev,
                      )
                      return
                    }
                    try {
                      const next = await sendSignInOtpChallenge({
                        state,
                        node: waitingNode,
                        email,
                        connectionsById: map,
                        chatbotId: chatbotId || undefined,
                        instanceId: instanceId || undefined,
                        resend: true,
                      })
                      setState(next)
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Failed to send code'
                      setState((prev) =>
                        prev
                          ? {
                              ...prev,
                              phase:
                                prev.phase.kind === 'waiting_input'
                                  ? { ...prev.phase, validationError: message }
                                  : prev.phase,
                            }
                          : prev,
                      )
                    }
                  })().finally(() => {
                    otpSendBusy.current = false
                    setOtpSending(false)
                  })
                }}
                onSubmit={(payload) => {
                  if (!state) return
                  return completeSignInStep({
                    state,
                    node: waitingNode,
                    edges,
                    nodes,
                    credentials: payload,
                    otpExpected: state.otpChallenge?.code ?? null,
                    chatbotId: chatbotId || undefined,
                    instanceId: instanceId || undefined,
                    sessionId: null,
                    httpPath: String(waitingNode.config.path ?? '/'),
                    templatesByKey: { ...(state.templates ?? {}), ...templatesMap },
                  })
                    .then((next) => setState(next))
                    .catch((err) => {
                      setState((prev) =>
                        prev
                          ? {
                              ...prev,
                              messages: [
                                ...prev.messages,
                                {
                                  id: crypto.randomUUID(),
                                  role: 'system',
                                  text: err instanceof Error ? err.message : 'Sign-in failed',
                                  createdAt: new Date().toISOString(),
                                },
                              ],
                              phase:
                                prev.phase.kind === 'waiting_input'
                                  ? {
                                      ...prev.phase,
                                      validationError:
                                        err instanceof Error ? err.message : 'Sign-in failed',
                                    }
                                  : prev.phase,
                            }
                          : prev,
                      )
                      throw err
                    })
                }}
              />
            </div>
          ) : null}

          {waiting && isExtended ? (
            <div className="ff-hide-scrollbar flex min-h-0 max-h-[min(32rem,70%)] flex-col overflow-y-auto border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3.5 py-3">
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

          {waitingSuggestion ? (
            <div className="rounded-b-[1.75rem] border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3 py-3">
              <form onSubmit={onSubmitSuggestion} className="flex items-end gap-2">
                <input
                  className="h-11 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm outline-none transition focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Or type your own reply…"
                />
                <Button
                  type="submit"
                  size="md"
                  disabled={!draft.trim()}
                  aria-label="Send"
                  className="h-11 w-11 shrink-0 rounded-2xl !px-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : null}

          {waiting &&
          waiting.answerType !== 'boolean' &&
          !usesDedicatedAnswerUi ? (
            <div className="rounded-b-[1.75rem] border-t border-[var(--color-border)] bg-[var(--ff-chat-composer-surface)] px-3 py-3">
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
                <p className="mt-2 px-1 text-[11px] text-rose-600">{waiting.validationError}</p>
              ) : null}
              {otpHasEmailConnection ? (
                <div className="mt-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] text-slate-400">
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
                  <p className="text-[11px] text-slate-400">
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

          {!waiting && !waitingSuggestion && !waitingButton && state?.phase.kind !== 'finished' && state?.phase.kind !== 'waiting_input' ? (
            <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/80 px-4 py-2.5 text-center text-[11px] text-[var(--color-ink-muted)]">
              Flow is running…
            </div>
          ) : null}

          {varEntries.length ? (
            <details className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/90 px-4 py-2 text-xs">
              <summary className="cursor-pointer font-medium text-[var(--color-ink-muted)]">Variables ({varEntries.length})</summary>
              <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto font-mono text-[11px]">
                {varEntries.map(([k, v]) => (
                  <li key={k} className="truncate">
                    <span className="text-teal-700">{k}</span> = {JSON.stringify(v)}
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
          'pointer-events-auto group relative grid h-14 w-14 place-items-center rounded-[1.35rem] text-white transition-all duration-300',
          'shadow-[0_16px_40px_-12px_rgb(15_23_42_/_0.45)]',
          'hover:scale-105 active:scale-95',
          open && 'rotate-0',
        )}
        style={{
          background:
            'linear-gradient(to bottom right, var(--ff-chat-header, #14b8a6), var(--ff-chat-header-2, #0891b2))',
          color: 'var(--ff-chat-header-fg, #ffffff)',
        }}
      >
        <span className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-white/10 opacity-0 transition group-hover:opacity-100" />
        <span
          className="pointer-events-none absolute -inset-1 animate-[ff-pulse-soft_2.4s_ease-in-out_infinite] rounded-[1.55rem] blur-md opacity-40"
          style={{ background: 'var(--ff-chat-accent, #2dd4bf)' }}
        />
        {open ? <Minimize2 className="relative h-5 w-5" /> : <MessageCircle className="relative h-6 w-6" />}
      </button>
    </div>,
    document.body,
  )
}
