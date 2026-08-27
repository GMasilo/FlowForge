import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { Send, Sparkles } from 'lucide-react'
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
} from '@/features/designer/preview/previewRuntime'
import {
  isAnswerRequired,
  normalizeAllowedEmailDomains,
  readDelaySeconds,
  readTimeoutSeconds,
  DEFAULT_LIKERT_CHOICES,
  readImageChoiceLayout,
} from '@/features/designer/model/flowSchema'
import { parsePublishedGraph } from '@/features/designer/utils/flowPublish'
import { executeChatbotTransfer } from '@/features/designer/model/chatbotTransfer'
import { collectStoreImageFilenames, templatesExprMap } from '@/features/templates/templateModel'
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
import { ChatMessageBody } from '@/features/chat/ChatMessageBody'
import { ChatMediaPlayerProvider } from '@/features/chat/ChatMediaPlayer'
import { UserMessageBubble } from '@/features/chat/UserMessageBubble'
import {
  constraintAttr,
  resolveAnswerInputConstraints,
} from '@/features/chat/answerInputConstraints'
import { FLOWFORGE_EMBED_SOURCE, postToEmbedParent } from '@/features/chat/embedBridge'
import {
  normalizeFileAccept,
  normalizeMaxFiles,
} from '@/features/designer/model/conversationFiles'
import { supabase } from '@/shared/lib/supabase'
import { getPaymentStatus, instanceFileUrl, isFlowForgeApiConfigured, startPaymentIntent } from '@/shared/lib/flowforgeApi'
import {
  catalogFromFilenames,
  collectMediaFilenamesFromNodes,
} from '@/features/designer/model/chatbotMedia'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { parseChatEnvironment } from '@/shared/types/database'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type { Json } from '@/shared/types/database'

function prettyTimestamp(iso: string): string {
  const date = new Date(iso)
  const time = format(date, 'h:mm a')
  if (isToday(date)) {
    const secs = (Date.now() - date.getTime()) / 1000
    if (secs < 60) return 'Just now'
    if (secs < 60 * 60) return `${time} · ${formatDistanceToNow(date, { addSuffix: true })}`
    return time
  }
  if (isYesterday(date)) return `Yesterday · ${time}`
  return format(date, 'MMM d · h:mm a')
}

function visitorKey(): string {
  const storageKey = 'flowforge.visitor_key'
  try {
    const existing = localStorage.getItem(storageKey)
    if (existing) return existing
    const next = crypto.randomUUID()
    localStorage.setItem(storageKey, next)
    return next
  } catch {
    return crypto.randomUUID()
  }
}

function rpcErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return 'Could not start conversation'
}

async function appendEvent(
  sessionId: string,
  kind: string,
  nodeKey?: string | null,
  payload?: Record<string, unknown>,
) {
  await supabase.rpc('append_conversation_event', {
    p_session_id: sessionId,
    p_kind: kind,
    p_node_key: nodeKey ?? null,
    p_payload: (payload ?? {}) as Json,
  })
}

async function escalateSession(sessionId: string, nodeKey?: string | null) {
  const { error } = await supabase.rpc('escalate_conversation_session', {
    p_session_id: sessionId,
    p_node_key: nodeKey ?? null,
  })
  if (error) throw error
}

function eventPayloadText(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''
  const o = payload as Record<string, unknown>
  if (typeof o.text === 'string') return o.text
  if (typeof o.message === 'string') return o.message
  return ''
}

async function completeSession(
  sessionId: string,
  status: 'completed' | 'failed' | 'abandoned',
  errorSummary?: string | null,
  variables?: Record<string, unknown>,
) {
  await supabase.rpc('complete_conversation_session', {
    p_session_id: sessionId,
    p_status: status,
    p_error_summary: errorSummary ?? null,
    p_variables: (variables ?? null) as Json | null,
  })
  try {
    const { emitSessionWebhooks, isFlowForgeApiConfigured } = await import('@/shared/lib/flowforgeApi')
    if (isFlowForgeApiConfigured()) {
      await emitSessionWebhooks({ sessionId })
    }
  } catch {
    // Webhook emit is best-effort for public chat
  }
}

export function PublicChatPage({ embed = false }: { embed?: boolean }) {
  const { publicSlug } = useParams()
  const [searchParams] = useSearchParams()
  const chatEnvironment = parseChatEnvironment(searchParams.get('env'))
  const [bootError, setBootError] = useState<string | null>(null)
  const [botName, setBotName] = useState('Chat')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatbotId, setChatbotId] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<DesignerNode[]>([])
  const [edges, setEdges] = useState<DesignerEdge[]>([])
  const [state, setState] = useState<PreviewEngineState | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedChoices, setSelectedChoices] = useState<string[]>([])
  const [otpSending, setOtpSending] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const connectionBusy = useRef(false)
  const otpSendBusy = useRef(false)
  const otpSentForWait = useRef<string | null>(null)
  const completedRef = useRef(false)
  const lastLoggedRunCount = useRef(0)
  const lastLoggedMsgCount = useRef(0)
  const escalatedForSession = useRef<string | null>(null)
  const handoffEventSeq = useRef(0)
  const seenAgentEventIds = useRef(new Set<string>())

  useEffect(() => {
    if (!embed) return
    document.documentElement.classList.add('ff-embed')
    document.body.classList.add('ff-embed')
    return () => {
      document.documentElement.classList.remove('ff-embed')
      document.body.classList.remove('ff-embed')
    }
  }, [embed])

  useEffect(() => {
    if (!embed || !rootRef.current) return
    const el = rootRef.current
    const publishHeight = () => {
      const height = Math.ceil(Math.max(el.scrollHeight, el.getBoundingClientRect().height))
      postToEmbedParent({ source: FLOWFORGE_EMBED_SOURCE, type: 'resize', height })
    }
    publishHeight()
    const ro = new ResizeObserver(() => publishHeight())
    ro.observe(el)
    return () => ro.disconnect()
  }, [embed, state, bootError])

  const connectionCtx = useMemo(
    () => ({
      chatbotId: chatbotId || undefined,
      instanceId: instanceId || undefined,
      sessionId: sessionId || undefined,
    }),
    [chatbotId, instanceId, sessionId],
  )
  const connectionsById = useMemo(() => ({} as Record<string, Record<string, unknown>>), [])

  useEffect(() => {
    if (!publicSlug) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('start_public_conversation_env', {
          p_slug: publicSlug,
          p_visitor_key: visitorKey(),
          p_environment: chatEnvironment,
        })
        if (error) throw error
        if (!data || typeof data !== 'object') throw new Error('Invalid session response')
        const row = data as Record<string, unknown>
        const graph = parsePublishedGraph(row.published_graph)
        const globalsMap: Record<string, unknown> = {}
        for (const g of graph.globals) globalsMap[g.key] = g.default_value
        if (cancelled) return
        setBotName(typeof row.name === 'string' ? row.name : 'Chat')
        setSessionId(String(row.session_id))
        setChatbotId(String(row.chatbot_id))
        setInstanceId(String(row.instance_id))
        setNodes(graph.nodes)
        setEdges(graph.edges)
        const mediaCatalog =
          isFlowForgeApiConfigured()
            ? catalogFromFilenames(
                [
                  ...new Set([
                    ...collectMediaFilenamesFromNodes(graph.nodes),
                    ...collectStoreImageFilenames(graph.templates ?? []),
                  ]),
                ],
                (filename) =>
                  instanceFileUrl({
                    kind: 'media',
                    instanceId: String(row.instance_id),
                    chatbotId: String(row.chatbot_id),
                    filename,
                  }),
              )
            : []
        setState(createInitialPreviewState(graph.nodes, graph.edges, globalsMap, mediaCatalog, templatesExprMap(graph.templates ?? [])))
        void appendEvent(String(row.session_id), 'session.started', null, {
          publish_version: row.publish_version ?? null,
          environment: chatEnvironment,
          embed: embed || null,
        })
        if (embed) {
          postToEmbedParent({
            source: FLOWFORGE_EMBED_SOURCE,
            type: 'ready',
            slug: publicSlug,
            sessionId: String(row.session_id),
          })
        }
      } catch (err) {
        if (!cancelled) {
          const message = rpcErrorMessage(err)
          setBootError(message)
          if (embed) {
            postToEmbedParent({ source: FLOWFORGE_EMBED_SOURCE, type: 'error', message })
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [publicSlug, embed, chatEnvironment])

  // Tick / connection steps
  useEffect(() => {
    if (!state || state.phase.kind !== 'typing' || !state.currentId) return
    const node = nodes.find((n) => n.id === state.currentId)
    const delaySeconds = node ? readDelaySeconds(node.config) : 0
    const waitMs = delaySeconds > 0 ? Math.round(delaySeconds * 1000) : 480

    if (node?.type === 'http' || node?.type === 'email' || node?.type === 'entity' || node?.type === 'transfer') {
      if (connectionBusy.current) return
      const timer = window.setTimeout(() => {
        if (connectionBusy.current) return
        connectionBusy.current = true
        const run =
          node.type === 'transfer'
            ? !chatbotId || !instanceId
              ? Promise.reject(new Error('Chat session is not ready for transfer'))
              : executeChatbotTransfer({
                  state,
                  node,
                  mode: 'public',
                  sessionId,
                  environment: chatEnvironment,
                  fromChatbotId: chatbotId,
                  fromChatbotName: botName,
                  instanceId,
                }).then((result) => {
                  setNodes(result.graph.nodes)
                  setEdges(result.graph.edges)
                  setChatbotId(result.chatbotId)
                  setBotName(result.name)
                  return result.state
                })
            : node.type === 'entity'
              ? runEntityStep(state, nodes, edges)
              : runConnectionStep(state, nodes, edges, connectionsById, connectionCtx)
        void run
          .then((next) => setState(next))
          .catch((err) => {
            console.error('Step failed', err)
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
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      setState((prev) => (prev ? tickPreview(prev, nodes, edges) : prev))
    }, waitMs)
    return () => window.clearTimeout(timer)
  }, [state, nodes, edges, connectionsById, connectionCtx, sessionId, chatbotId, botName, instanceId, chatEnvironment])

  // Optional question timeout
  useEffect(() => {
    if (!state) return
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
  }, [state, nodes, edges])

  // OTP send
  useEffect(() => {
    if (!state) return
    const phase = state.phase
    if (phase.kind !== 'waiting_input' || phase.answerType !== 'otp') return
    const node = nodes.find((n) => n.id === phase.nodeId)
    if (!node) return
    if (!String(node.config.otpConnectionId ?? '').trim()) return
    const waitKey = `${phase.nodeId}:${phase.startedAt}`
    if (otpSentForWait.current === waitKey || otpSendBusy.current) return
    otpSentForWait.current = waitKey
    otpSendBusy.current = true
    setOtpSending(true)
    void sendOtpEmailChallenge(state, nodes, connectionsById, connectionCtx)
      .then((next) => setState(next))
      .finally(() => {
        otpSendBusy.current = false
        setOtpSending(false)
      })
  }, [state, nodes, connectionsById, connectionCtx])

  // Log new messages / runs
  useEffect(() => {
    if (!sessionId || !state) return
    if (state.messages.length > lastLoggedMsgCount.current) {
      const fresh = state.messages.slice(lastLoggedMsgCount.current)
      lastLoggedMsgCount.current = state.messages.length
      for (const m of fresh) {
        // Agent messages are already persisted by agent_reply_to_conversation.
        if (m.role === 'agent' || m.role === 'system') continue
        void appendEvent(sessionId, `message.${m.role}`, null, { text: m.text, id: m.id })
      }
    }
    if (state.runs.length > lastLoggedRunCount.current) {
      const fresh = state.runs.slice(lastLoggedRunCount.current)
      lastLoggedRunCount.current = state.runs.length
      for (const run of fresh) {
        void appendEvent(sessionId, 'step.run', run.nodeKey, {
          type: run.type,
          status: run.status,
          outputs: run.outputs,
        })
      }
    }
  }, [sessionId, state])

  // Complete session
  useEffect(() => {
    if (!sessionId || !state || completedRef.current) return
    if (state.phase.kind === 'finished') {
      completedRef.current = true
      const failed = state.runs.some((r) => r.status === 'Failed' || r.status === 'TimedOut')
      const status = failed ? 'failed' : 'completed'
      void completeSession(
        sessionId,
        status,
        failed ? 'One or more steps failed' : null,
        state.vars,
      )
      void appendEvent(sessionId, failed ? 'session.failed' : 'session.completed')
      if (embed) {
        postToEmbedParent({
          source: FLOWFORGE_EMBED_SOURCE,
          type: 'complete',
          status,
          sessionId,
        })
      }
    }
  }, [sessionId, state, embed])

  // Escalate to agent inbox when the flow reaches a handoff step.
  useEffect(() => {
    if (!sessionId || !state) return
    const phase = state.phase
    if (phase.kind !== 'waiting_handoff') return
    if (escalatedForSession.current === sessionId) return
    escalatedForSession.current = sessionId
    const node = nodes.find((n) => n.id === phase.nodeId)
    void escalateSession(sessionId, node?.key ?? phase.nodeId).catch((err) => {
      console.error('Failed to escalate conversation for handoff', err)
      // Allow a retry on the next render if escalate failed.
      if (escalatedForSession.current === sessionId) escalatedForSession.current = null
    })
  }, [sessionId, state, nodes])

  // While waiting for an agent, pull agent replies (and handoff resolution).
  useEffect(() => {
    if (!sessionId || !state || state.phase.kind !== 'waiting_handoff') return
    let cancelled = false

    async function pullAgentEvents() {
      const { data, error } = await supabase.rpc('list_conversation_events_after', {
        p_session_id: sessionId!,
        p_after_seq: handoffEventSeq.current,
      })
      if (cancelled || error || !data?.length) return

      for (const ev of data) {
        handoffEventSeq.current = Math.max(handoffEventSeq.current, ev.seq)
        if (ev.kind === 'message.agent') {
          if (seenAgentEventIds.current.has(ev.id)) continue
          seenAgentEventIds.current.add(ev.id)
          const text = eventPayloadText(ev.payload).trim()
          if (!text) continue
          setState((prev) => {
            if (!prev) return prev
            if (prev.messages.some((m) => m.id === ev.id)) return prev
            return {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: ev.id,
                  role: 'agent',
                  text,
                  createdAt: ev.created_at,
                },
              ],
            }
          })
        } else if (ev.kind === 'session.completed') {
          setState((prev) =>
            prev && prev.phase.kind === 'waiting_handoff'
              ? {
                  ...prev,
                  messages: [
                    ...prev.messages,
                    {
                      id: crypto.randomUUID(),
                      role: 'system',
                      text: 'An agent has resolved this conversation.',
                      createdAt: new Date().toISOString(),
                    },
                  ],
                  phase: { kind: 'finished' },
                }
              : prev,
          )
        }
      }
    }

    void pullAgentEvents()
    const timer = window.setInterval(() => void pullAgentEvents(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId, state?.phase.kind === 'waiting_handoff'])

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' })
  }, [state?.messages, state?.phase])

  useEffect(() => {
    if (state?.phase.kind === 'waiting_input') inputRef.current?.focus()
  }, [state?.phase])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase.kind === 'waiting_input' ? state.phase.nodeId : null])

  const waiting = state?.phase.kind === 'waiting_input' ? state.phase : null
  const waitingHandoff = state?.phase.kind === 'waiting_handoff' ? state.phase : null
  const waitingNode = waiting ? nodes.find((n) => n.id === waiting.nodeId) : null
  const waitingOptional = !!waitingNode && !isAnswerRequired(waitingNode.config)
  const waitingCfg = waitingNode?.config ?? {}
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
  const likertChoices = waiting?.choices?.length ? waiting.choices : [...DEFAULT_LIKERT_CHOICES]
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
    instanceId: instanceId || undefined,
    chatbotId: chatbotId || undefined,
    sessionId: sessionId || undefined,
    nodeKey: waitingNode?.key ?? 'question',
  }
  const imageChoiceCards = imageChoiceCardsFromCatalog(waitingCfg, state?.mediaCatalog ?? [])
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

  function onHandoffSubmit(e: FormEvent) {
    e.preventDefault()
    if (!state || state.phase.kind !== 'waiting_handoff') return
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setState((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: crypto.randomUUID(),
                role: 'user',
                text,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : prev,
    )
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
      case 'long_text':
        return optional ? 'Type your reply (optional)…' : 'Type your reply…'
      default:
        return optional ? 'Type your reply (optional)…' : 'Type your reply…'
    }
  }

  if (bootError) {
    return (
      <div
        ref={rootRef}
        className={cn(
          'flex items-center justify-center px-4',
          embed
            ? 'min-h-[240px] bg-white'
            : 'min-h-full bg-gradient-to-br from-slate-50 via-teal-50/40 to-cyan-50/50',
        )}
      >
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Unavailable</h1>
          <p className="mt-2 text-sm text-rose-700">{bootError}</p>
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div
        ref={rootRef}
        className={cn(
          'flex items-center justify-center',
          embed
            ? 'min-h-[240px] bg-white'
            : 'min-h-full bg-gradient-to-br from-slate-50 via-teal-50/40 to-cyan-50/50',
        )}
      >
        <p className="text-sm text-slate-500">Starting conversation…</p>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex flex-col',
        embed
          ? 'h-full min-h-[320px] overflow-hidden bg-white'
          : 'h-full min-h-full overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/40',
      )}
    >
      <ChatMediaPlayerProvider>
      <header
        className={cn(
          'text-white shadow-sm',
          embed
            ? 'border-b border-teal-700/20 bg-teal-700 px-3 py-2.5'
            : 'border-b border-white/60 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 px-4 py-4',
        )}
      >
        <div className={cn('flex items-center gap-3', embed ? '' : 'mx-auto max-w-2xl')}>
          <span
            className={cn(
              'grid place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30',
              embed ? 'h-8 w-8' : 'h-10 w-10',
            )}
          >
            <Sparkles className={embed ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </span>
          <div className="min-w-0">
            {!embed ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                {chatEnvironment === 'staging' ? 'Staging' : 'FlowForge'}
              </p>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <h1
                className={cn(
                  'truncate font-[family-name:var(--font-display)] font-semibold',
                  embed ? 'text-sm' : 'text-lg',
                )}
              >
                {botName}
              </h1>
              {chatEnvironment === 'staging' ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full bg-white/20 px-2 py-0.5 font-semibold uppercase tracking-wide text-white ring-1 ring-white/30',
                    embed ? 'text-[9px]' : 'text-[10px]',
                  )}
                >
                  Staging
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div
        ref={scrollerRef}
        className={cn(
          'ff-hide-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-5',
          embed ? 'w-full' : 'mx-auto w-full max-w-2xl',
        )}
      >
        {state.messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-[1.25rem] rounded-br-md bg-gradient-to-br from-teal-600 to-cyan-600 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                <UserMessageBubble message={m} />
              </div>
            </div>
          ) : m.role === 'system' ? (
            <p key={m.id} className="text-center text-xs text-slate-400">
              {m.text}
            </p>
          ) : (
            <div
              key={m.id}
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                m.role === 'agent'
                  ? 'bg-violet-50 text-violet-950 ring-1 ring-violet-200/80'
                  : 'bg-white text-slate-800 ring-1 ring-slate-200/80',
              )}
            >
              {m.role === 'agent' ? (
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  Agent
                </p>
              ) : null}
              <ChatMessageBody text={m.text} attachments={m.media} />
              <p className="mt-1 text-[10px] text-slate-400">{prettyTimestamp(m.createdAt)}</p>
            </div>
          ),
        )}
        {state.phase.kind === 'typing' ? (
          <div className="inline-flex items-center gap-1 rounded-2xl bg-white px-3 py-2 text-slate-400 ring-1 ring-slate-200/80">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:240ms]" />
          </div>
        ) : null}
        {waitingHandoff ? (
          <p className="rounded-xl bg-violet-50 px-3 py-2 text-center text-xs text-violet-800 ring-1 ring-violet-200/70">
            Waiting for an agent… You can keep sending messages below.
          </p>
        ) : null}
        {state.phase.kind === 'finished' ? (
          <p className="text-center text-xs text-slate-400">Conversation complete</p>
        ) : null}
      </div>

      {waiting && isThumbs ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >          <ThumbsAnswerField
            onSelect={(v) => setState(submitPreviewAnswer(state, nodes, edges, v))}
          />
        </div>
      ) : null}
      {waiting && isMood ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >          <MoodAnswerField
            onSelect={(v) => setState(submitPreviewAnswer(state, nodes, edges, v))}
          />
        </div>
      ) : null}
      {waiting && isLikert ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >          <LikertAnswerField
            choices={likertChoices}
            onSelect={(v) => setState(submitPreviewAnswer(state, nodes, edges, v))}
          />
        </div>
      ) : null}
      {waiting && isNumberedChoice ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <NumberedChoiceAnswerField
            choices={numberedChoices}
            onSelect={(v) => setState(submitPreviewAnswer(state, nodes, edges, v))}
          />
        </div>
      ) : null}
      {waiting && isRating && ratingOptions.length ? (
        <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2 border-t border-slate-100 bg-white/90 px-4 py-3">
          {ratingOptions.map((n) => (
            <button
              key={n}
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-teal-200 bg-teal-50/80 text-sm font-semibold text-teal-800"
              onClick={() => setState(submitPreviewAnswer(state, nodes, edges, String(n)))}
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}
      {waiting && isStars ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >          <StarsAnswerField
            min={starsMin}
            max={starsMax}
            onSelect={(n) => setState(submitPreviewAnswer(state, nodes, edges, String(n)))}
          />
        </div>
      ) : null}
      {waiting && isNps ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <NpsAnswerField
            min={npsMin}
            max={npsMax}
            minLabel="Not at all likely"
            maxLabel="Extremely likely"
            onSelect={(n) => setState(submitPreviewAnswer(state, nodes, edges, String(n)))}
          />
        </div>
      ) : null}

      {waiting && isFile ? (
        <div
          className={cn(
            'flex w-full flex-col gap-2 border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <FileAnswerField
            accept={normalizeFileAccept(waitingCfg.fileAccept)}
            maxFiles={normalizeMaxFiles(waitingCfg.maxFiles)}
            storeCtx={answerStoreCtx}
            onSubmit={(value) => setState(submitPreviewAnswer(state, nodes, edges, value))}
          />
          {waitingOptional ? (
            <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onSkipOptional}>
              Skip
            </Button>
          ) : null}
        </div>
      ) : null}

      {waiting && isSignature ? (
        <div
          className={cn(
            'flex w-full flex-col gap-2 border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <SignatureAnswerField
            storeCtx={answerStoreCtx}
            onSubmit={(value) => setState(submitPreviewAnswer(state, nodes, edges, value))}
          />
          {waitingOptional ? (
            <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onSkipOptional}>
              Skip
            </Button>
          ) : null}
        </div>
      ) : null}

      {waiting && isImageChoice ? (
        <div
          className={cn(
            'flex w-full flex-col gap-2 border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <ImageChoiceAnswerField
            className={imageChoiceLayout === 'gallery' ? '-mx-4' : undefined}
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
                  state,
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
                    state,
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
            <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onSkipOptional}>
              Skip
            </Button>
          ) : null}
        </div>
      ) : null}

      {waiting && isExtended ? (
        <div
          className={cn(
            'ff-hide-scrollbar flex w-full min-h-0 max-h-[min(36rem,70vh)] flex-col gap-2 overflow-y-auto border-t border-slate-100 bg-white/90 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <ExtendedAnswerPanel
            answerType={waiting.answerType}
            config={waitingCfg}
            choices={waiting.choices ?? []}
            allowMultiple={waiting.allowMultiple === true}
            storeCtx={answerStoreCtx}
            onSubmit={(value) => setState(submitPreviewAnswer(state, nodes, edges, value))}
            optional={waitingOptional}
            onSkip={onSkipOptional}
            validationError={waiting.validationError}
            payment={waiting.payment}
            captchaPrompt={waiting.captchaPrompt}
            templates={state.templates}
            mediaCatalog={state.mediaCatalog}
            onRefreshCaptcha={() => setState(refreshCaptchaChallenge(state, nodes))}
            onStartPayment={
              waiting.payment?.verify && waiting.payment.connectionId && chatbotId && instanceId
                ? async () => {
                    const started = await startPaymentIntent({
                      connectionId: waiting.payment!.connectionId!,
                      chatbotId,
                      instanceId,
                      sessionId: sessionId || undefined,
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
                    const result = await getPaymentStatus({
                      reference,
                      chatbotId,
                      sessionId: sessionId || undefined,
                    })
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
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/95 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >          <form onSubmit={onSubmit} className="flex items-end gap-2">
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
                step={typeof inputConstraints.step === 'number' ? inputConstraints.step : 0.01}
                required={inputConstraints.required && !waitingOptional}
              />
            ) : isOtp ? (
              <OtpAnswerField className="flex-1" value={draft} onChange={setDraft} length={otpLength} />
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
                className="min-h-[88px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholderForAnswer(waiting.answerType, waitingOptional)}
                required={inputConstraints.required && !waitingOptional}
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
                className="h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholderForAnswer(waiting.answerType, waitingOptional)}
                type={inputTypeForAnswer(waiting.answerType)}
                required={inputConstraints.required && !waitingOptional}
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
            <p className="mt-2 text-[11px] text-rose-600">{waiting.validationError}</p>
          ) : null}
          {isOtp ? (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={otpSending}
                onClick={() => {
                  if (!state || otpSendBusy.current) return
                  otpSendBusy.current = true
                  setOtpSending(true)
                  void sendOtpEmailChallenge(state, nodes, connectionsById, {
                    ...connectionCtx,
                    resend: true,
                  })
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
            <div className="mt-2 flex justify-end">
              <Button type="button" size="sm" variant="ghost" onClick={onSkipOptional}>
                Skip
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {waiting?.answerType === 'boolean' ? (
        <div className="mx-auto flex w-full max-w-2xl gap-2 border-t border-slate-100 bg-white/90 px-4 py-3">
          <Button onClick={() => setState(submitPreviewAnswer(state, nodes, edges, 'true'))}>
            Yes
          </Button>
          <Button
            variant="secondary"
            onClick={() => setState(submitPreviewAnswer(state, nodes, edges, 'false'))}
          >
            No
          </Button>
        </div>
      ) : null}

      {waitingHandoff ? (
        <div
          className={cn(
            'w-full border-t border-slate-100 bg-white/95 px-4 py-3',
            embed ? '' : 'mx-auto max-w-2xl',
          )}
        >
          <form onSubmit={onHandoffSubmit} className="flex items-end gap-2">
            <input
              className="h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-500/15"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the agent…"
            />
            <Button type="submit" size="md" disabled={!draft.trim()} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : null}
      </ChatMediaPlayerProvider>
    </div>
  )
}
