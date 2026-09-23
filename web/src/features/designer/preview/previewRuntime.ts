import { runtimeResilience } from '@/features/intelligence/runtimeResilience'
import { resolvePaymentQuestionConfig } from '@/features/templates/paymentTemplate'
import {
  nodeTypeLabel,
  chatAnimationFromConfig,
  chatBubbleFromConfig,
  readDelaySeconds,
  readOnRun,
  readRunAfter,
  readTimeoutSeconds,
  isAnswerRequired,
  resolveQuestionChoices,
  resolveSuggestedResponses,
  readSetVariableAssignments,
  getStepOutputVariables,
  type DesignerEdge,
  type DesignerNode,
  type RunAfterKey,
} from '@/features/designer/model/flowSchema'
import {
  listenerAdvancesFlow,
  listenersForEvent,
  resolveButtonOptions,
  type ButtonListenerEvent,
  type ResolvedButtonOption,
} from '@/features/designer/model/buttonStep'
import {
  coerceFunctionParamValue,
  expressionCallArgs,
  getFlowFunction,
} from '@/features/designer/model/flowFunctions'
import {
  evaluateExpression,
  interpolateTemplate,
  interpolateTemplateForKey,
  invokeExpressionFunction,
  looksLikeExpression,
  parseJsonValue,
  resolveExpressionValue,
  setExpressionChatbotId,
} from '@/features/designer/preview/expressionEval'
import { clearChatCookie, writeChatCookie } from '@/features/chat/chatCookies'
import { conversationFilesToMedia } from '@/features/designer/model/conversationFiles'
import { validateQuestionAnswer } from '@/features/designer/model/answerValidation'
import { captchaAnswersMatch, generateCaptchaPuzzle } from '@/features/designer/model/captchaChallenge'
import { resolveMediaAttachments, mediaExprMap, stripFileEmbeds } from '@/features/designer/model/chatbotMedia'
import { nodesBypassedBySkipJump, readSkipToTargetKey, readSkipVariableDefaults } from '@/features/designer/model/skipToStep'
import { readRestartClearCookies } from '@/features/designer/model/restartStep'
import { parseTemplateBindingMap, type TemplateBindingMap } from '@/features/templates/templateModel'
import { findContinueRootIds } from '@/features/designer/utils/conditionGraph'
import type { FlowNodeType } from '@/shared/types/database'

export type ChatRole = 'bot' | 'user' | 'system' | 'agent'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  createdAt: string
  /** Present for URL answers — description loaded asynchronously via /api/url/preview. */
  link?: {
    url: string
    title?: string | null
    description?: string | null
    siteName?: string | null
    icon?: string | null
    loading?: boolean
    error?: string | null
  }
  /** Present for phone answers — rendered as a tel: hyperlink. */
  tel?: string
  /** Designer media shown with a bot message / question prompt. */
  media?: Array<{ filename: string; url: string; key: string; mime: string }>
  /** Quick-reply chips under a bot message (message steps with suggested responses). */
  suggestions?: string[]
  /** Action buttons under a bot message (button steps). */
  buttons?: ResolvedButtonOption[]
  /** Step-level animation overrides (falls back to chatbot branding when omitted). */
  animation?: {
    entrance?: 'none' | 'fade' | 'rise' | 'slide'
    emphasis?: 'pulse'
  }
  /** Step-level bubble colour / shading (falls back to chatbot branding when omitted). */
  bubble?: {
    color?: string
    shading?: 'soft' | 'strong'
  }
}

export type PreviewPhase =
  | { kind: 'idle' }
  | {
      kind: 'waiting_input'
      nodeId: string
      prompt: string
      answerType: string
      choices?: string[]
      allowMultiple?: boolean
      validationError?: string
      startedAt: string
      /** OTP email delivery status for this wait (code itself stays on otpChallenge). */
      otpDelivery?: 'pending' | 'sent' | 'mocked' | 'failed'
      otpDeliveryError?: string | null
      otpSentTo?: string | null
      /** Interpolated pay link for payment questions (URL is not re-resolved in the UI). */
      payment?: {
        url: string
        amount: string
        currency: string
        payLabel: string
        paidLabel: string
        connectionId?: string
        itemName?: string
        buyerEmail?: string
        buyerName?: string
        nodeKey?: string
        verify?: boolean
      }
      /** Captcha prompt shown to the visitor (solution stays on captchaChallenge). */
      captchaPrompt?: string
    }
  | { kind: 'waiting_handoff'; nodeId: string; message: string; startedAt: string }
  | {
      kind: 'waiting_suggestion'
      nodeId: string
      suggestions: string[]
      startedAt: string
    }
  | {
      kind: 'waiting_button'
      nodeId: string
      buttons: ResolvedButtonOption[]
      startedAt: string
    }
  | { kind: 'typing' }
  | { kind: 'finished' }
  /** Host should clear the conversation and start again from the first step. */
  | { kind: 'restart'; nodeId: string; clearCookies: boolean }

/** In-memory OTP challenge for preview (never exposed in messages/vars). */
export type PreviewOtpChallenge = {
  nodeId: string
  code: string
  expiresAt: string
  attempts: number
  maxAttempts: number
  sentAt: string
  to: string
  delivery: 'sent' | 'mocked' | 'failed'
  error?: string | null
}

/** In-memory captcha solution (never exposed in messages/vars). */
export type PreviewCaptchaChallenge = {
  nodeId: string
  answer: string
  attempts: number
  maxAttempts: number
  kind: 'math' | 'text'
}

/** Failed password/HTTP/entity sign-in attempts for the active Sign-in step. */
export type PreviewSignInAttempts = {
  nodeId: string
  attempts: number
  maxAttempts: number
}

export type PreviewRunStatus = 'Succeeded' | 'Failed' | 'Skipped' | 'TimedOut'

/** Per-step run card data collected during Preview. */
export interface PreviewStepRun {
  id: string
  nodeId: string
  nodeKey: string
  nodeLabel: string
  type: FlowNodeType
  typeLabel: string
  status: PreviewRunStatus
  startedAt: string
  finishedAt: string
  durationMs: number
  /** Raw / configured values resolved at runtime. */
  inputs: Record<string, unknown>
  /** Intermediate work (branch choice, operation math, request built, …). */
  processed: Record<string, unknown>
  /** Value produced by the step (often mirrors stepOutputs[key]). */
  outputs: Record<string, unknown>
  /** Where the result was stored, e.g. `{{vars.items}}` or `{{steps.http_1}}`. */
  savedAs: string | null
}

function getByPath(value: unknown, path: string[]): unknown {
  let cur: unknown = value
  for (const part of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function interpolate(
  template: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
  media: Record<string, unknown> = {},
  embedMedia = false,
  templates: Record<string, unknown> = {},
  templateBindings: TemplateBindingMap = {},
  chatbotId?: string | null,
): string {
  if (chatbotId !== undefined) setExpressionChatbotId(chatbotId)
  return interpolateTemplate(template, {
    vars,
    steps: stepOutputs,
    media,
    templates,
    embedMedia,
    templateBindings,
    chatbotId,
  })
}

function interpolateChat(
  template: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
  media: Record<string, unknown> = {},
  templates: Record<string, unknown> = {},
  templateBindings: TemplateBindingMap = {},
  chatbotId?: string | null,
): string {
  return interpolate(template, vars, stepOutputs, media, true, templates, templateBindings, chatbotId)
}

function bindingsOf(config: Record<string, unknown>): TemplateBindingMap {
  return parseTemplateBindingMap(config.templateBindings)
}

/**
 * Evaluate silent On run expressions (setCookie, setVar, …) without adding chat bubbles.
 * Supports `{{expr}}` templates or one bare expression per line.
 */
export function applyOnRunExpressions(
  state: PreviewEngineState,
  node: DesignerNode,
): PreviewEngineState {
  const raw = readOnRun(node.config)
  if (!raw) return state

  bindCookieScope(state)
  const vars = { ...state.vars }
  const ctx = {
    vars,
    steps: state.stepOutputs,
    media: state.media,
    templates: state.templates,
    templateBindings: bindingsOf(node.config),
    embedMedia: false,
    chatbotId: state.chatbotId,
  }

  const errors: string[] = []
  try {
    if (/\{\{[\s\S]*?\}\}/.test(raw)) {
      interpolateTemplate(raw, ctx)
    } else {
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue
        if (!looksLikeExpression(trimmed) && !/^[A-Za-z_]/.test(trimmed)) continue
        evaluateExpression(trimmed, ctx)
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  // Keep side-effect results in vars; never render On run output as a chat bubble.
  void errors
  return { ...state, vars: ctx.vars }
}

function resolveValue(
  raw: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
  media: Record<string, unknown> = {},
  templates: Record<string, unknown> = {},
  templateBindings: TemplateBindingMap = {},
  chatbotId?: string | null,
): unknown {
  if (chatbotId !== undefined) setExpressionChatbotId(chatbotId)
  return resolveExpressionValue(raw, {
    vars,
    steps: stepOutputs,
    media,
    templates,
    templateBindings,
    chatbotId,
  })
}

function bindCookieScope(state: PreviewEngineState): void {
  setExpressionChatbotId(state.chatbotId)
}

function coerceCompare(left: unknown, right: unknown, operator: string): boolean {
  const l = left
  const r = right
  switch (operator) {
    case 'eq':
      return String(l) === String(r)
    case 'neq':
      return String(l) !== String(r)
    case 'gt':
      return Number(l) > Number(r)
    case 'gte':
      return Number(l) >= Number(r)
    case 'lt':
      return Number(l) < Number(r)
    case 'lte':
      return Number(l) <= Number(r)
    case 'contains':
      return String(l).includes(String(r))
    case 'exists':
      return l !== undefined && l !== null && l !== ''
    default:
      return false
  }
}

function findRoot(nodes: DesignerNode[], edges: DesignerEdge[]): DesignerNode | null {
  const incoming = new Map<string, number>()
  for (const n of nodes) incoming.set(n.id, 0)
  for (const e of edges) incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
  return nodes.find((n) => (incoming.get(n.id) ?? 0) === 0) ?? nodes[0] ?? null
}

function nextNodeId(
  edges: DesignerEdge[],
  fromId: string,
  handle?: string | null,
): string | null {
  const match =
    edges.find((e) => e.source === fromId && (handle ? e.sourceHandle === handle : !e.sourceHandle)) ??
    edges.find((e) => e.source === fromId && (!handle || e.sourceHandle === handle)) ??
    edges.find((e) => e.source === fromId)
  return match?.target ?? null
}

/**
 * Mark jumped-over steps as skipped and ensure their output variables exist as null
 * when they were never set (so later steps can use empty()/coalesce safely).
 * Preserves values already written by an earlier Succeeded step.
 */
function applyBypassedSkipOutputs(
  state: PreviewEngineState,
  fromId: string,
  targetId: string | null,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  extraSkipped: DesignerNode[] = [],
): PreviewEngineState {
  if (!targetId && !extraSkipped.length) return state

  const bypassed = targetId ? nodesBypassedBySkipJump(fromId, targetId, nodes, edges) : []
  const seen = new Set<string>()
  const toSkip: DesignerNode[] = []
  for (const node of [...extraSkipped, ...bypassed]) {
    if (seen.has(node.id)) continue
    seen.add(node.id)
    toSkip.push(node)
  }
  if (!toSkip.length) return state

  const succeededIds = new Set(
    state.runs.filter((r) => r.status === 'Succeeded').map((r) => r.nodeId),
  )
  const vars = { ...state.vars }
  const stepOutputs = { ...state.stepOutputs }
  let runs = state.runs
  let changed = false

  for (const node of toSkip) {
    if (succeededIds.has(node.id)) continue
    changed = true
    for (const key of getStepOutputVariables(node)) {
      if (!(key in vars)) vars[key] = null
    }
    stepOutputs[node.key] = {
      response: null,
      data: null,
      skipped: true,
      reason: 'bypassed_by_skip',
    }
    const alreadyLogged = runs.some((r) => r.nodeId === node.id && r.status === 'Skipped')
    if (!alreadyLogged) {
      runs = [
        ...runs,
        {
          id: crypto.randomUUID(),
          nodeId: node.id,
          nodeKey: node.key,
          nodeLabel: node.label || node.key,
          type: node.type,
          typeLabel: nodeTypeLabel(node.type),
          status: 'Skipped',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          inputs: {},
          processed: { reason: 'bypassed_by_skip' },
          outputs: { skipped: true },
          savedAs: null,
        },
      ]
    }
  }

  return changed ? { ...state, vars, stepOutputs, runs } : state
}

export interface LoopFrame {
  loopId: string
  items: unknown[]
  index: number
  itemVariable: string
  indexVariable: string
  bodyStartId: string
}

export interface PreviewEngineState {
  currentId: string | null
  vars: Record<string, unknown>
  stepOutputs: Record<string, unknown>
  messages: ChatMessage[]
  phase: PreviewPhase
  loopStack: LoopFrame[]
  runs: PreviewStepRun[]
  /** Active emailed OTP challenge, if any. */
  otpChallenge?: PreviewOtpChallenge | null
  /** Failed credential attempts on the current Sign-in step (HTTP / entity / password+HTTP). */
  signInAttempts?: PreviewSignInAttempts | null
  /** Active captcha solution, if any. */
  captchaChallenge?: PreviewCaptchaChallenge | null
  /** {{media.key}} → public file URL */
  media: Record<string, unknown>
  mediaCatalog: Array<{ filename: string; url: string; key: string; mime: string }>
  /** {{templates.key.text}} / .html / .subject */
  templates: Record<string, unknown>
  /** Scopes cookie()/setCookie()/clearCookie() to this chatbot. */
  chatbotId?: string | null
  /** Seed globals used when restarting (answers / setVar from this run are not included). */
  globalDefaults?: Record<string, unknown>
  /**
   * When true, Restart steps are skipped until the visitor hits a waiting step
   * (prevents Message → Restart auto-loops after a restart / cold start).
   */
  suppressRestart?: boolean
  /** Node ids visited during the current auto-advance streak (cycle guard). */
  autoAdvanceSeenIds?: string[]
}

function appendRun(
  state: PreviewEngineState,
  node: DesignerNode,
  details: {
    status?: PreviewRunStatus
    inputs: Record<string, unknown>
    processed?: Record<string, unknown>
    outputs?: Record<string, unknown>
    savedAs?: string | null
    startedAt?: string
    durationMs?: number
  },
): PreviewEngineState {
  const finishedAt = new Date().toISOString()
  const startedAt = details.startedAt ?? finishedAt
  const durationMs =
    details.durationMs ?? Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt))
  const run: PreviewStepRun = {
    id: crypto.randomUUID(),
    nodeId: node.id,
    nodeKey: node.key,
    nodeLabel: node.label || node.key,
    type: node.type,
    typeLabel: nodeTypeLabel(node.type),
    status: details.status ?? 'Succeeded',
    startedAt,
    finishedAt,
    durationMs,
    inputs: details.inputs,
    processed: details.processed ?? {},
    outputs: details.outputs ?? {},
    savedAs: details.savedAs ?? null,
  }
  return { ...state, runs: [...state.runs, run] }
}

function savedAsVar(key: string | null | undefined): string | null {
  const k = String(key ?? '').trim()
  return k ? `{{vars.${k}}}` : null
}

function savedAsStep(stepKey: string): string {
  return `{{steps.${stepKey}}}`
}

function toArrayValue(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/** If next step would leave a loop body via After (or end of body), advance or finish the loop. */
function resolveAfterStep(
  state: PreviewEngineState,
  edges: DesignerEdge[],
  nodes: DesignerNode[],
  proposedNextId: string | null,
): PreviewEngineState {
  let next: PreviewEngineState = { ...state, loopStack: [...state.loopStack] }
  let target = proposedNextId

  while (next.loopStack.length) {
    const frame = next.loopStack[next.loopStack.length - 1]!
    const afterIds = findContinueRootIds(frame.loopId, edges, nodes)
    // Leave body when: no next edge, or next is this loop's After path
    const leavingBody = !target || afterIds.has(target)
    if (!leavingBody) break

    const nextIndex = frame.index + 1
    if (nextIndex < frame.items.length) {
      return {
        ...next,
        vars: {
          ...next.vars,
          [frame.itemVariable]: frame.items[nextIndex],
          [frame.indexVariable]: nextIndex,
        },
        loopStack: [...next.loopStack.slice(0, -1), { ...frame, index: nextIndex }],
        currentId: frame.bodyStartId,
        phase: { kind: 'typing' },
      }
    }

    // Finished this loop — continue toward After (or keep an explicit after target)
    next = { ...next, loopStack: next.loopStack.slice(0, -1) }
    if (!target) {
      target = [...afterIds][0] ?? null
    }
  }

  return {
    ...next,
    currentId: target,
    phase: target ? { kind: 'typing' } : { kind: 'finished' },
  }
}

function attachmentsFor(node: DesignerNode, catalog: PreviewEngineState['mediaCatalog']): ChatMessage['media'] {
  const items = resolveMediaAttachments(node.config, catalog)
  return items.length ? items : undefined
}

export function createInitialPreviewState(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  globalDefaults: Record<string, unknown>,
  mediaCatalog: PreviewEngineState['mediaCatalog'] = [],
  templates: Record<string, unknown> = {},
  chatbotId?: string | null,
): PreviewEngineState {
  const root = findRoot(nodes, edges)
  const media = mediaExprMap(mediaCatalog)
  return {
    currentId: root?.id ?? null,
    vars: { ...globalDefaults },
    stepOutputs: {},
    messages: [],
    phase: root ? { kind: 'typing' } : { kind: 'finished' },
    loopStack: [],
    runs: [],
    otpChallenge: null,
    signInAttempts: null,
    captchaChallenge: null,
    media,
    mediaCatalog,
    templates,
    chatbotId: chatbotId?.trim() || null,
    globalDefaults: { ...globalDefaults },
    suppressRestart: true,
    autoAdvanceSeenIds: [],
  }
}

function generateOtpCode(length: number): string {
  const n = Math.max(4, Math.min(12, Math.round(length)))
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < n; i++) out += String(bytes[i]! % 10)
  return out
}

function codesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!
  return diff === 0
}

/** Inject OTP code first, then interpolate vars/steps (so {{otp.code}} is not blanked). */
export function applyOtpEmailTemplate(
  template: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
  code: string,
  media: Record<string, unknown> = {},
  templates: Record<string, unknown> = {},
  templateBindings: TemplateBindingMap = {},
): string {
  const withCode = template
    .replace(/\{\{\s*otp\.code\s*\}\}/gi, code)
    .replace(/\{\{\s*otpCode\s*\}\}/gi, code)
  return interpolate(withCode, vars, stepOutputs, media, false, templates, templateBindings)
}

function otpConfigOf(config: Record<string, unknown>) {
  const length = typeof config.otpLength === 'number' ? config.otpLength : 6
  const expiresSeconds =
    typeof config.otpExpiresSeconds === 'number' && config.otpExpiresSeconds > 0
      ? config.otpExpiresSeconds
      : 300
  const maxAttempts =
    typeof config.otpMaxAttempts === 'number' && config.otpMaxAttempts > 0
      ? config.otpMaxAttempts
      : 5
  return {
    connectionId: String(config.otpConnectionId ?? '').trim(),
    toTemplate: String(config.otpTo ?? '').trim(),
    subjectTemplate: String(config.otpSubject ?? 'Your verification code'),
    bodyTemplate: String(
      config.otpBody ?? 'Your verification code is {{otp.code}}.',
    ),
    length,
    expiresSeconds,
    maxAttempts,
  }
}

export type ConnectionStepContext = {
  chatbotId?: string
  instanceId?: string
  sessionId?: string
}

/** Public chat sessions should not surface HTTP/entity/debug status lines in the transcript. */
function isPublicChatRuntime(options?: ConnectionStepContext): boolean {
  return !!options?.sessionId?.trim()
}

function appendTechSystemMessage(
  messages: ChatMessage[],
  options: ConnectionStepContext | undefined,
  text: string,
): ChatMessage[] {
  if (isPublicChatRuntime(options)) return messages
  return [...messages, msg('system', text)]
}

/**
 * Generate + email an OTP for the current waiting OTP question.
 * No-ops if the question has no email connection configured.
 */
export async function sendOtpEmailChallenge(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  connectionsById: Record<string, Record<string, unknown>>,
  options?: { resend?: boolean; signal?: AbortSignal } & ConnectionStepContext,
): Promise<PreviewEngineState> {
  const waiting = state.phase
  if (waiting.kind !== 'waiting_input' || waiting.answerType !== 'otp') return state
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node) return state

  const cfg = otpConfigOf(node.config)
  if (!cfg.connectionId) return state

  // Avoid duplicate sends for the same wait (unless resend)
  if (
    !options?.resend &&
    state.otpChallenge?.nodeId === node.id &&
    (state.otpChallenge.delivery === 'sent' || state.otpChallenge.delivery === 'mocked')
  ) {
    return state
  }

  const code = generateOtpCode(cfg.length)
  const otpBindings = bindingsOf(node.config)
  const to = applyOtpEmailTemplate(
    cfg.toTemplate,
    state.vars,
    state.stepOutputs,
    code,
    state.media,
    state.templates,
    otpBindings,
  ).trim()
  const subject = applyOtpEmailTemplate(
    cfg.subjectTemplate,
    state.vars,
    state.stepOutputs,
    code,
    state.media,
    state.templates,
    otpBindings,
  )
  const body = applyOtpEmailTemplate(
    cfg.bodyTemplate,
    state.vars,
    state.stepOutputs,
    code,
    state.media,
    state.templates,
    otpBindings,
  )
  const expiresAt = new Date(Date.now() + cfg.expiresSeconds * 1000).toISOString()
  const sentAt = new Date().toISOString()
  const connection = connectionsById[cfg.connectionId]

  const { isFlowForgeApiConfigured, sendEmailConnection } = await import(
    '@/shared/lib/flowforgeApi'
  )

  let delivery: PreviewOtpChallenge['delivery'] = 'failed'
  let error: string | null = null
  let messages = state.messages

  if (!to) {
    error = 'OTP recipient (To) is empty — set otpTo, e.g. {{vars.email}}'
    messages = [...messages, msg('system', error)]
  } else if (!isFlowForgeApiConfigured()) {
    delivery = 'mocked'
    messages = [
      ...messages,
      msg(
        'system',
        `OTP emailed to ${to} (mocked — VITE_FLOWFORGE_API_URL not set). Preview code: ${code}`,
      ),
    ]
  } else {
    try {
      const isPublicSession = !!options?.sessionId
      let result: { ok: boolean; error?: string | null }

      if (isPublicSession) {
        if (!options?.chatbotId || !cfg.connectionId) {
          throw new Error('Missing connection for public chat OTP')
        }
        result = await sendEmailConnection({
          connectionId: cfg.connectionId,
          chatbotId: options.chatbotId,
          instanceId: options.instanceId,
          sessionId: options.sessionId,
          to,
          subject,
          body,
          signal: options?.signal,
        })
      } else {
        const host = String(connection?.smtpHost ?? '').trim()
        const fromEmail = String(connection?.fromEmail ?? '').trim()
        if (!connection || !host || !fromEmail) {
          throw new Error(
            'Could not load email connection secrets (SMTP host/from). Open Data → Connections, edit the email connection, confirm SMTP Host and From Email are saved, then reopen Preview.',
          )
        }
        // Designer preview: send full SMTP config (required by current production API).
        result = await sendEmailConnection({
          connection,
          to,
          subject,
          body,
          signal: options?.signal,
        })
      }

      if (result.ok) {
        delivery = 'sent'
        messages = [...messages, msg('system', `Verification code sent to ${to}`)]
      } else {
        error = result.error ?? 'Failed to send OTP email'
        messages = [...messages, msg('system', `OTP email failed: ${error}`)]
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send OTP email'
      messages = [...messages, msg('system', `OTP email error: ${error}`)]
    }
  }

  const challenge: PreviewOtpChallenge = {
    nodeId: node.id,
    code,
    expiresAt,
    attempts: options?.resend && state.otpChallenge?.nodeId === node.id
      ? state.otpChallenge.attempts
      : 0,
    maxAttempts: cfg.maxAttempts,
    sentAt,
    to,
    delivery,
    error,
  }

  return {
    ...state,
    messages,
    otpChallenge: challenge,
    phase: {
      ...waiting,
      otpDelivery: delivery === 'failed' ? ('failed' as const) : delivery,
      otpDeliveryError: error,
      otpSentTo: to || null,
      validationError: undefined,
    },
  }
}

function captchaConfigOf(config: Record<string, unknown>) {
  const kind = config.captchaKind === 'text' ? ('text' as const) : ('math' as const)
  const maxAttempts =
    typeof config.captchaMaxAttempts === 'number' && config.captchaMaxAttempts > 0
      ? config.captchaMaxAttempts
      : 5
  return { kind, maxAttempts }
}

/** Issue a new captcha puzzle for the current wait (solution stays on captchaChallenge). */
export function refreshCaptchaChallenge(
  state: PreviewEngineState,
  nodes: DesignerNode[],
): PreviewEngineState {
  const waiting = state.phase
  if (waiting.kind !== 'waiting_input' || waiting.answerType !== 'captcha') return state
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node) return state
  const cfg = captchaConfigOf(node.config)
  const puzzle = generateCaptchaPuzzle(cfg.kind)
  const prev = state.captchaChallenge?.nodeId === node.id ? state.captchaChallenge : null
  return {
    ...state,
    captchaChallenge: {
      nodeId: node.id,
      answer: puzzle.answer,
      attempts: prev?.attempts ?? 0,
      maxAttempts: prev?.maxAttempts ?? cfg.maxAttempts,
      kind: puzzle.kind,
    },
    phase: {
      ...waiting,
      captchaPrompt: puzzle.prompt,
      validationError: undefined,
    },
  }
}

function msg(role: ChatRole, text: string, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

function applyAssignment(
  state: PreviewEngineState,
  key: string,
  value: unknown,
  stepKey: string,
  responsePayload?: unknown,
): PreviewEngineState {
  const vars = { ...state.vars, [key]: value }
  const stepOutputs = {
    ...state.stepOutputs,
    [stepKey]: responsePayload ?? { response: value, data: value },
  }
  return { ...state, vars, stepOutputs }
}

/** Set a flow variable without advancing the step (e.g. button setVar). */
export function setPreviewVar(
  state: PreviewEngineState,
  varName: string,
  varValue: unknown,
): PreviewEngineState {
  const key = String(varName ?? '').trim()
  if (!key) return state
  return { ...state, vars: { ...state.vars, [key]: varValue } }
}

/**
 * Execute a catalog flow function against preview state.
 * - setVar: mutates vars
 * - expression helpers: evaluate and store into resultVariable
 * - host: no-op here (caller postsMessage)
 */
export function applyFlowFunction(
  state: PreviewEngineState,
  functionName: string,
  params: Record<string, string>,
): {
  state: PreviewEngineState
  handled: boolean
  kind: 'runtime' | 'expression' | 'host' | 'unknown'
  result?: unknown
  error?: string
} {
  bindCookieScope(state)
  const def = getFlowFunction(functionName)
  if (!def) return { state, handled: false, kind: 'unknown' }
  if (def.kind === 'host') return { state, handled: true, kind: 'host' }

  if (def.name === 'setVar' || def.name === 'setCookie' || def.name === 'clearCookie' || def.kind === 'runtime') {
    if (def.name === 'setVar') {
      const varName = String(params.varName ?? '').trim()
      const rawValue = params.varValue ?? ''
      return {
        state: setPreviewVar(state, varName, coerceFunctionParamValue(rawValue)),
        handled: true,
        kind: 'runtime',
      }
    }
    if (def.name === 'setCookie') {
      const name = String(params.name ?? '').trim()
      if (!name) {
        return { state, handled: true, kind: 'runtime', error: 'setCookie: name is required' }
      }
      const rawValue = params.value ?? ''
      const coerced = coerceFunctionParamValue(rawValue)
      const value = coerced == null ? '' : String(coerced)
      const daysRaw = String(params.days ?? '').trim()
      const days = daysRaw === '' ? 365 : Number(daysRaw)
      try {
        writeChatCookie(name, value, Number.isFinite(days) ? days : 365, state.chatbotId)
        return { state, handled: true, kind: 'runtime', result: value }
      } catch (e) {
        return {
          state,
          handled: true,
          kind: 'runtime',
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }
    if (def.name === 'clearCookie') {
      const name = String(params.name ?? '').trim()
      if (!name) {
        return { state, handled: true, kind: 'runtime', error: 'clearCookie: name is required' }
      }
      try {
        clearChatCookie(name, state.chatbotId)
        return { state, handled: true, kind: 'runtime', result: null }
      } catch (e) {
        return {
          state,
          handled: true,
          kind: 'runtime',
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }
    return { state, handled: false, kind: 'runtime' }
  }

  if (def.kind === 'expression') {
    try {
      const args = expressionCallArgs(def, params)
      const result = invokeExpressionFunction(def.name, args, {
        vars: state.vars,
        steps: state.stepOutputs,
        media: state.media,
        templates: state.templates,
        chatbotId: state.chatbotId,
      })
      const resultVar = String(params.resultVariable ?? '').trim()
      if (!resultVar) {
        return {
          state,
          handled: true,
          kind: 'expression',
          result,
          error: 'Store result in is required',
        }
      }
      return {
        state: setPreviewVar(state, resultVar, result),
        handled: true,
        kind: 'expression',
        result,
      }
    } catch (e) {
      return {
        state,
        handled: true,
        kind: 'expression',
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  return { state, handled: false, kind: 'unknown' }
}

function previousRunStatus(state: PreviewEngineState): PreviewRunStatus | null {
  if (!state.runs.length) return null
  return state.runs[state.runs.length - 1]!.status
}

function statusToRunAfterKey(status: PreviewRunStatus): RunAfterKey {
  switch (status) {
    case 'Succeeded':
      return 'succeeded'
    case 'Failed':
      return 'failed'
    case 'Skipped':
      return 'skipped'
    case 'TimedOut':
      return 'timedOut'
  }
}

/** Whether this node should execute given the previous step's outcome (run after). */
export function shouldRunAfterPredecessor(
  config: Record<string, unknown>,
  previousStatus: PreviewRunStatus | null,
): boolean {
  // First step / no predecessor (trigger) always runs
  if (previousStatus == null) return true
  const runAfter = readRunAfter(config)
  return runAfter[statusToRunAfterKey(previousStatus)] === true
}

function skipDueToRunAfter(
  state: PreviewEngineState,
  node: DesignerNode,
  edges: DesignerEdge[],
  nodes: DesignerNode[],
): PreviewEngineState {
  const previousStatus = previousRunStatus(state)
  const runAfter = readRunAfter(node.config)
  const skipToKey = String(node.config.runAfterSkipTo ?? '').trim()
  const skipTarget =
    skipToKey && skipToKey !== node.key
      ? nodes.find((n) => n.key === skipToKey)?.id ?? null
      : null
  let next = appendRun(state, node, {
    status: 'Skipped',
    inputs: {
      runAfter,
      delaySeconds: readDelaySeconds(node.config),
      runAfterSkipTo: skipToKey || null,
    },
    processed: {
      previousStatus,
      reason: 'Configure run after — previous step status is not allowed',
      redirectedTo: skipTarget ? skipToKey : null,
    },
    outputs: {},
    savedAs: null,
  })
  // Null this step's outputs and any steps jumped over when redirecting.
  next = applyBypassedSkipOutputs(next, node.id, skipTarget, nodes, edges, [node])
  // Condition/loop still need a next handle; use unlabeled (then) when skipping
  return resolveAfterStep(next, edges, nodes, skipTarget ?? nextNodeId(edges, node.id))
}

/** Clear auto-advance bookkeeping when the flow pauses for the visitor. */
function withInteractionGate(state: PreviewEngineState): PreviewEngineState {
  return {
    ...state,
    suppressRestart: false,
    autoAdvanceSeenIds: [],
  }
}

/**
 * Advance one automated tick. Returns updated state.
 * For questions, transitions to waiting_input and does not auto-advance further.
 */
export function tickPreview(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): PreviewEngineState {
  bindCookieScope(state)
  if (
    !state.currentId ||
    state.phase.kind === 'waiting_input' ||
    state.phase.kind === 'waiting_suggestion' ||
    state.phase.kind === 'waiting_button' ||
    state.phase.kind === 'finished' ||
    state.phase.kind === 'restart'
  ) {
    return state
  }

  const node = nodes.find((n) => n.id === state.currentId)
  if (!node) {
    return { ...state, phase: { kind: 'finished' }, currentId: null }
  }

  const seen = state.autoAdvanceSeenIds ?? []
  if (seen.includes(node.id)) {
    return {
      ...state,
      messages: [
        ...state.messages,
        msg(
          'system',
          `Stopped: step "${node.key}" was reached again without waiting for input (possible Skip to / Restart loop).`,
        ),
      ],
      currentId: null,
      phase: { kind: 'finished' },
      autoAdvanceSeenIds: [],
    }
  }

  if (!shouldRunAfterPredecessor(node.config, previousRunStatus(state))) {
    return skipDueToRunAfter(
      { ...state, autoAdvanceSeenIds: [...seen, node.id] },
      node,
      edges,
      nodes,
    )
  }

  let next = applyOnRunExpressions(
    { ...state, autoAdvanceSeenIds: [...seen, node.id] },
    node,
  )

  if (node.type === 'message') {
    const bindings = bindingsOf(node.config)
    const template = String(node.config.text ?? '')
    const text = interpolateChat(template, next.vars, next.stepOutputs, next.media, next.templates, bindings)
    const media = attachmentsFor(node, next.mediaCatalog)
    const stored = stripFileEmbeds(text)
    const suggestions = resolveSuggestedResponses(node.config, {
      resolve: (raw) => resolveValue(raw, next.vars, next.stepOutputs, next.media, next.templates, bindings),
    })
    next = {
      ...next,
      messages: [
        ...next.messages,
        msg('bot', text || (media?.length ? '' : '?'), {
          media,
          suggestions: suggestions.length ? suggestions : undefined,
          animation: chatAnimationFromConfig(node.config),
          bubble: chatBubbleFromConfig(node.config),
        }),
      ],
      stepOutputs: { ...next.stepOutputs, [node.key]: { response: stored } },
    }
    next = appendRun(next, node, {
      inputs: { text: template },
      processed: { interpolated: stored },
      outputs: { response: stored },
      savedAs: savedAsStep(node.key),
    })
    if (suggestions.length) {
      return withInteractionGate({
        ...next,
        currentId: node.id,
        phase: {
          kind: 'waiting_suggestion',
          nodeId: node.id,
          suggestions,
          startedAt: new Date().toISOString(),
        },
      })
    }
    return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
  }

  if (node.type === 'button') {
    const bindings = bindingsOf(node.config)
    const template = String(node.config.text ?? '')
    const text = interpolateChat(template, next.vars, next.stepOutputs, next.media, next.templates, bindings)
    const buttons = resolveButtonOptions(node.config, (raw) =>
      interpolate(raw, next.vars, next.stepOutputs, next.media, false, next.templates, bindings),
    )

    next = {
      ...next,
      messages: [
        ...next.messages,
        msg('bot', text || (buttons.length ? '' : 'Choose an action'), {
          buttons,
          animation: chatAnimationFromConfig(node.config),
          bubble: chatBubbleFromConfig(node.config),
        }),
      ],
      stepOutputs: { ...next.stepOutputs, [node.key]: { response: stripFileEmbeds(text) } },
    }
    next = appendRun(next, node, {
      inputs: { text: template },
      processed: { buttons },
      outputs: { response: stripFileEmbeds(text) },
      savedAs: savedAsStep(node.key),
    })
    return withInteractionGate({
      ...next,
      currentId: node.id,
      phase: {
        kind: 'waiting_button',
        nodeId: node.id,
        buttons,
        startedAt: new Date().toISOString(),
      },
    })
  }

  if (node.type === 'question') {
    const qBindings = bindingsOf(node.config)
    const promptTemplate = String(node.config.prompt ?? '')
    const prompt = interpolateChat(promptTemplate, next.vars, next.stepOutputs, next.media, next.templates, qBindings)
    const choices = resolveQuestionChoices(node.config, {
      resolve: (raw) => resolveValue(raw, next.vars, next.stepOutputs, next.media, next.templates, qBindings),
    })
    const allowMultiple = node.config.allowMultiple === true
    const media = attachmentsFor(node, next.mediaCatalog)
    const answerType = String(node.config.answerType ?? 'text')
    let payment: Extract<PreviewPhase, { kind: 'waiting_input' }>['payment'] = undefined
    let captchaPrompt: string | undefined
    let captchaChallenge = next.captchaChallenge ?? null

    if (answerType === 'payment') {
      const paymentConfig = resolvePaymentQuestionConfig(node.config, next.templates)
      const paymentText = (value: unknown) => interpolateTemplateForKey(String(value ?? ''), {
        vars: next.vars, steps: next.stepOutputs, media: next.media,
        templates: next.templates, templateBindings: qBindings, embedMedia: false,
      }, String(node.config.paymentTemplateKey ?? '').trim()).trim()
      payment = {
        url: paymentText(paymentConfig.payUrl),
        amount: paymentText(paymentConfig.paymentAmount),
        currency: paymentText(paymentConfig.currencyCode).toUpperCase() || 'ZAR',
        payLabel: paymentText(paymentConfig.payButtonLabel) || 'Pay now',
        paidLabel: paymentText(paymentConfig.paidButtonLabel) || "I've paid",
        connectionId: String(paymentConfig.paymentConnectionId ?? '').trim() || undefined,
        itemName: paymentText(paymentConfig.paymentItemName) || undefined,
        buyerEmail: paymentText(paymentConfig.paymentBuyerEmail) || undefined,
        buyerName: paymentText(paymentConfig.paymentBuyerName) || undefined,
        nodeKey: node.key,
        verify: !!String(paymentConfig.paymentConnectionId ?? '').trim(),
      }
    }

    if (answerType === 'captcha') {
      const cfg = captchaConfigOf(node.config)
      const puzzle = generateCaptchaPuzzle(cfg.kind)
      captchaChallenge = {
        nodeId: node.id,
        answer: puzzle.answer,
        attempts: 0,
        maxAttempts: cfg.maxAttempts,
        kind: puzzle.kind,
      }
      captchaPrompt = puzzle.prompt
    } else {
      captchaChallenge = null
    }

    return withInteractionGate({
      ...next,
      captchaChallenge,
      messages: [
        ...next.messages,
        msg('bot', prompt || (media?.length ? '' : '?'), {
          media,
          animation: chatAnimationFromConfig(node.config),
          bubble: chatBubbleFromConfig(node.config),
        }),
      ],
      phase: {
        kind: 'waiting_input',
        nodeId: node.id,
        prompt,
        answerType,
        choices: choices.length ? choices : undefined,
        allowMultiple: allowMultiple || undefined,
        startedAt: new Date().toISOString(),
        ...(payment ? { payment } : {}),
        ...(captchaPrompt ? { captchaPrompt } : {}),
      },
    })
  }

  if (node.type === 'set_variable') {
    const rows = readSetVariableAssignments(node.config)
    const assigned: Record<string, unknown> = {}
    const inputs: Array<{ variableKey: string; value: string; valueType: string }> = []
    for (const row of rows) {
      const key = row.variableKey.trim()
      if (!key) continue
      const rawValue = String(row.value ?? '')
      const value = resolveValue(rawValue, next.vars, next.stepOutputs, next.media, next.templates)
      next = { ...next, vars: { ...next.vars, [key]: value } }
      assigned[key] = value
      inputs.push({ variableKey: key, value: rawValue, valueType: row.valueType })
    }
    const keys = Object.keys(assigned)
    const single = keys.length === 1 ? assigned[keys[0]!] : undefined
    next = {
      ...next,
      stepOutputs: {
        ...next.stepOutputs,
        [node.key]:
          keys.length === 1
            ? { response: single, data: single }
            : { response: assigned, data: assigned, assignments: assigned },
      },
    }
    next = appendRun(next, node, {
      inputs: {
        assignments: inputs,
        variableKey: keys[0] ?? '',
        value: inputs[0]?.value ?? '',
        valueType: inputs[0]?.valueType ?? 'string',
      },
      processed: { resolved: assigned },
      outputs: keys.length === 1 ? { value: single } : { values: assigned },
      savedAs: keys.length ? keys.map((k) => `{{vars.${k}}}`).join(', ') : savedAsStep(node.key),
    })
    return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
  }

  if (node.type === 'operation') {
    const key = String(node.config.outputVariable ?? '').trim()
    const leftRaw = String(node.config.left ?? '')
    const rightRaw = String(node.config.right ?? '')
    const replaceRaw = String(node.config.replaceWith ?? '')
    const left = resolveValue(leftRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const right = resolveValue(rightRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const replaceWith = resolveValue(replaceRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const op = String(node.config.operation ?? 'concat')
    let value: unknown = null
    switch (op) {
      case 'concat':
        value = `${left ?? ''}${right ?? ''}`
        break
      case 'add':
        value = Number(left) + Number(right)
        break
      case 'subtract':
        value = Number(left) - Number(right)
        break
      case 'multiply':
        value = Number(left) * Number(right)
        break
      case 'divide':
        value = Number(right) === 0 ? null : Number(left) / Number(right)
        break
      case 'json_path':
        value = getByPath(left, String(right ?? '').split('.').filter(Boolean))
        break
      case 'uppercase':
        value = String(left ?? '').toUpperCase()
        break
      case 'lowercase':
        value = String(left ?? '').toLowerCase()
        break
      case 'sentence_case': {
        const t = String(left ?? '').trim()
        value = t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t
        break
      }
      case 'trim':
        value = String(left ?? '').trim()
        break
      case 'length':
        if (Array.isArray(left)) value = left.length
        else if (left && typeof left === 'object') value = Object.keys(left as object).length
        else value = String(left ?? '').length
        break
      case 'parse_json': {
        const parsed = parseJsonValue(left)
        value = parsed.value
        if (!parsed.ok) {
          next = appendRun(next, node, {
            status: 'Failed',
            inputs: { operation: op, left: leftRaw },
            processed: { left, error: parsed.error },
            outputs: { result: null },
            savedAs: savedAsVar(key) ?? savedAsStep(node.key),
          })
          if (key) next = applyAssignment(next, key, null, node.key)
          else
            next = {
              ...next,
              stepOutputs: { ...next.stepOutputs, [node.key]: { response: null, data: null } },
            }
          return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
        }
        break
      }
      case 'stringify_json':
        try {
          value = typeof left === 'string' ? left : JSON.stringify(left ?? null)
        } catch {
          value = null
        }
        break
      case 'replace':
        value = String(left ?? '').split(String(right ?? '')).join(String(replaceWith ?? ''))
        break
      default:
        value = left
    }
    if (key) next = applyAssignment(next, key, value, node.key)
    else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: { response: value, data: value } } }
    next = appendRun(next, node, {
      inputs: { operation: op, left: leftRaw, right: rightRaw, replaceWith: replaceRaw || undefined },
      processed: { left, right, replaceWith: replaceRaw ? replaceWith : undefined, result: value },
      outputs: { result: value },
      savedAs: savedAsVar(key) ?? savedAsStep(node.key),
    })
    return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
  }

  if (
    node.type === 'http' ||
    node.type === 'email' ||
    node.type === 'database' ||
    node.type === 'integration' ||
    node.type === 'entity' ||
    node.type === 'transfer'
  ) {
    // Handled asynchronously by PreviewChat / PublicChat
    return state
  }

  if (node.type === 'condition') {
    const leftRaw = String(node.config.left ?? '')
    const rightRaw = String(node.config.right ?? '')
    const operator = String(node.config.operator ?? 'eq')
    const left = resolveValue(leftRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const right = resolveValue(rightRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const pass = coerceCompare(left, right, operator)
    next = appendRun(next, node, {
      inputs: { left: leftRaw, operator, right: rightRaw },
      processed: { left, right, operator, branch: pass ? 'Yes' : 'No' },
      outputs: { result: pass, branch: pass ? 'Yes' : 'No' },
      savedAs: null,
    })
    return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id, pass ? 'true' : 'false'))
  }

  if (node.type === 'switch') {
    const valueRaw = String(node.config.value ?? '')
    const cases = Array.isArray(node.config.cases) ? node.config.cases : []
    const value = resolveValue(valueRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const valueStr = value == null ? '' : String(value)
    let matchedHandle = 'default'
    let matchedLabel = 'Default'
    let matchedMatch = ''
    for (let i = 0; i < cases.length; i += 1) {
      const row = cases[i]
      if (!row || typeof row !== 'object') continue
      const c = row as Record<string, unknown>
      const id = typeof c.id === 'string' ? c.id : ''
      if (!id) continue
      const matchRaw = typeof c.match === 'string' ? c.match : ''
      const matchVal = resolveValue(matchRaw, next.vars, next.stepOutputs, next.media, next.templates)
      const matchStr = matchVal == null ? '' : String(matchVal)
      if (valueStr === matchStr) {
        matchedHandle = id
        matchedMatch = matchRaw
        matchedLabel =
          typeof c.label === 'string' && c.label.trim()
            ? c.label.trim()
            : matchRaw.trim() || `Case ${i + 1}`
        break
      }
    }
    next = appendRun(next, node, {
      inputs: { value: valueRaw, cases },
      processed: { value: valueStr, branch: matchedLabel, handle: matchedHandle, match: matchedMatch },
      outputs: { result: matchedHandle, branch: matchedLabel },
      savedAs: null,
    })
    return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id, matchedHandle))
  }

  if (node.type === 'loop') {
    const collectionRaw = String(node.config.collection ?? '')
    const collection = resolveValue(collectionRaw, next.vars, next.stepOutputs, next.media, next.templates)
    const items = toArrayValue(collection) ?? []
    const itemVariable = String(node.config.itemVariable ?? 'item').trim() || 'item'
    const indexVariable = String(node.config.indexVariable ?? 'index').trim() || 'index'
    const continueRoots = findContinueRootIds(node.id, edges, nodes)
    const bodyTarget = nextNodeId(edges, node.id, 'body')
    const hasBody = !!bodyTarget && !continueRoots.has(bodyTarget)
    const afterId = [...continueRoots][0] ?? null

    next = {
      ...next,
      stepOutputs: {
        ...next.stepOutputs,
        [node.key]: { count: items.length, items },
      },
    }
    next = appendRun(next, node, {
      inputs: { collection: collectionRaw, itemVariable, indexVariable },
      processed: { itemCount: items.length, hasBody },
      outputs: { count: items.length, items },
      savedAs: savedAsStep(node.key),
    })

    if (!items.length || !hasBody || !bodyTarget) {
      return resolveAfterStep(next, edges, nodes, afterId)
    }

    const frame: LoopFrame = {
      loopId: node.id,
      items,
      index: 0,
      itemVariable,
      indexVariable,
      bodyStartId: bodyTarget,
    }

    return {
      ...next,
      vars: {
        ...next.vars,
        [itemVariable]: items[0],
        [indexVariable]: 0,
      },
      loopStack: [...next.loopStack, frame],
      currentId: bodyTarget,
      phase: { kind: 'typing' },
    }
  }

  if (node.type === 'sign_in') {
    const mode = String(node.config.mode ?? 'http')
    const skipIfSignedIn = node.config.skipIfSignedIn !== false
    const emailVariable = String(node.config.emailVariable ?? 'email').trim() || 'email'
    const userIdVariable = String(node.config.userIdVariable ?? 'user_id').trim() || 'user_id'
    const tokenVariable = String(node.config.tokenVariable ?? 'auth_token').trim() || 'auth_token'
    const profileVariable = String(node.config.profileVariable ?? 'user').trim() || 'user'
    const signedInFlag = next.vars._signed_in
    const alreadySignedIn =
      signedInFlag === true || signedInFlag === 'true' || signedInFlag === 1 || signedInFlag === '1'

    if (mode === 'sign_out') {
      const vars: Record<string, unknown> = { ...next.vars, _signed_in: false }
      delete vars[emailVariable]
      delete vars[userIdVariable]
      delete vars[tokenVariable]
      delete vars[profileVariable]
      const now = new Date().toISOString()
      next = {
        ...next,
        vars,
        messages: [
          ...next.messages,
          msg('system', 'Signed out', { createdAt: now }),
        ],
        stepOutputs: {
          ...next.stepOutputs,
          [node.key]: { ok: true, signedOut: true },
        },
      }
      next = appendRun(next, node, {
        inputs: { mode: 'sign_out' },
        processed: { signedOut: true },
        outputs: { ok: true, _signed_in: false },
        savedAs: null,
      })
      const nextId =
        nextNodeId(edges, node.id, 'success') ?? nextNodeId(edges, node.id)
      return resolveAfterStep(next, edges, nodes, nextId)
    }

    if (skipIfSignedIn && alreadySignedIn) {
      next = {
        ...next,
        stepOutputs: {
          ...next.stepOutputs,
          [node.key]: { ok: true, skipped: true, reason: 'already_signed_in' },
        },
      }
      next = appendRun(next, node, {
        inputs: { mode, skipIfSignedIn: true },
        processed: { skipped: true, reason: 'already_signed_in' },
        outputs: { ok: true, skipped: true },
        savedAs: null,
      })
      const nextId =
        nextNodeId(edges, node.id, 'success') ?? nextNodeId(edges, node.id)
      return resolveAfterStep(next, edges, nodes, nextId)
    }

    const prompt = String(node.config.prompt ?? 'Sign in to continue')
    const text = interpolateChat(prompt, next.vars, next.stepOutputs, next.media, next.templates, bindingsOf(node.config))
    const media = attachmentsFor(node, next.mediaCatalog)
    return withInteractionGate({
      ...next,
      messages: [
        ...next.messages,
        msg('bot', text, {
          media,
          animation: chatAnimationFromConfig(node.config),
          bubble: chatBubbleFromConfig(node.config),
        }),
      ],
      currentId: node.id,
      phase: {
        kind: 'waiting_input',
        nodeId: node.id,
        prompt: text,
        answerType: 'sign_in',
        startedAt: new Date().toISOString(),
      },
    })
  }

  if (node.type === 'handoff') {
    const template = String(node.config.message ?? 'Connecting you with an agent…')
    const text = interpolateChat(template, next.vars, next.stepOutputs, next.media, next.templates, bindingsOf(node.config))
    const media = attachmentsFor(node, next.mediaCatalog)
    next = appendRun(next, node, {
      inputs: { message: template },
      processed: { interpolated: text },
      outputs: { message: text, escalated: true },
      savedAs: null,
    })
    return withInteractionGate({
      ...next,
      messages: [
        ...next.messages,
        msg('bot', text, {
          media,
          animation: chatAnimationFromConfig(node.config),
          bubble: chatBubbleFromConfig(node.config),
        }),
      ],
      currentId: node.id,
      phase: {
        kind: 'waiting_handoff',
        nodeId: node.id,
        message: text,
        startedAt: new Date().toISOString(),
      },
    })
  }

  if (node.type === 'end') {
    const template = String(node.config.message ?? 'Thanks — conversation complete.')
    const text = interpolateChat(template, next.vars, next.stepOutputs, next.media, next.templates, bindingsOf(node.config))
    const media = attachmentsFor(node, next.mediaCatalog)
    next = appendRun(next, node, {
      inputs: { message: template },
      processed: { interpolated: text },
      outputs: { message: text },
      savedAs: null,
    })
    return {
      ...next,
      messages: [
        ...next.messages,
        msg('bot', text, {
          media,
          animation: chatAnimationFromConfig(node.config),
          bubble: chatBubbleFromConfig(node.config),
        }),
      ],
      currentId: null,
      loopStack: [],
      phase: { kind: 'finished' },
    }
  }

  if (node.type === 'skip_to') {
    const skipKey = readSkipToTargetKey(node.config)
    const skipTarget =
      skipKey && skipKey !== node.key ? nodes.find((n) => n.key === skipKey)?.id ?? null : null
    next = {
      ...next,
      stepOutputs: {
        ...next.stepOutputs,
        [node.key]: { redirectedTo: skipTarget ? skipKey : null },
      },
    }
    next = appendRun(next, node, {
      inputs: {
        targetNodeKey: skipKey || null,
        variableDefaults: readSkipVariableDefaults(node.config),
      },
      processed: {
        redirectedTo: skipTarget ? skipKey : null,
        fallback: skipTarget ? null : 'next',
      },
      outputs: { redirectedTo: skipTarget ? skipKey : null },
      savedAs: null,
    })
    if (skipTarget) {
      next = applyBypassedSkipOutputs(next, node.id, skipTarget, nodes, edges)
      const defaults = readSkipVariableDefaults(node.config)
      if (defaults.length) {
        const vars = { ...next.vars }
        const applied: Record<string, unknown> = {}
        for (const row of defaults) {
          const key = row.variableKey.trim()
          if (!key) continue
          const trimmed = row.value.trim()
          // Blank inspector value → null (matches “leave blank for null”).
          const value =
            trimmed === ''
              ? null
              : resolveValue(
                  row.value,
                  vars,
                  next.stepOutputs,
                  next.media,
                  next.templates,
                  bindingsOf(node.config),
                  next.chatbotId,
                )
          vars[key] = value
          applied[key] = value
        }
        next = {
          ...next,
          vars,
          stepOutputs: {
            ...next.stepOutputs,
            [node.key]: {
              ...(typeof next.stepOutputs[node.key] === 'object' && next.stepOutputs[node.key]
                ? (next.stepOutputs[node.key] as Record<string, unknown>)
                : {}),
              redirectedTo: skipKey,
              variableDefaults: applied,
            },
          },
        }
      }
    }
    return resolveAfterStep(next, edges, nodes, skipTarget ?? nextNodeId(edges, node.id))
  }

  if (node.type === 'restart') {
    const clearCookies = readRestartClearCookies(node.config)
    if (next.suppressRestart) {
      // Treat as Succeeded so the next step's default "run after succeeded" still fires.
      // (Status Skipped would cascade-skip everything after a leading Restart.)
      next = appendRun(next, node, {
        status: 'Succeeded',
        inputs: { clearCookies },
        processed: {
          restart: false,
          suppressed: true,
          reason: 'suppressed_until_interaction',
          note: 'Restart is ignored until the visitor answers a question or clicks a button',
        },
        outputs: { restarted: false, suppressed: true },
        savedAs: null,
      })
      return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
    }
    next = appendRun(next, node, {
      inputs: { clearCookies },
      processed: { restart: true },
      outputs: { restarted: true, clearCookies },
      savedAs: null,
    })
    return {
      ...next,
      currentId: node.id,
      phase: { kind: 'restart', nodeId: node.id, clearCookies },
      autoAdvanceSeenIds: [],
    }
  }

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

export function submitPreviewButton(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  value: string,
  opts?: {
    label?: string
    source?: string
    payload?: unknown
    skipToNodeKey?: string
  },
): PreviewEngineState {
  bindCookieScope(state)
  if (state.phase.kind !== 'waiting_button') return state
  const waiting = state.phase
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node || node.type !== 'button') return state

  const trimmed = String(value ?? '').trim()
  if (!trimmed) return state
  const picked = trimmed
  const label =
    opts?.label?.trim() ||
    waiting.buttons.find((b) => b.value === picked)?.label ||
    picked

  const priorOutput = state.stepOutputs[node.key]
  const botResponse =
    priorOutput && typeof priorOutput === 'object' && priorOutput !== null && 'response' in priorOutput
      ? (priorOutput as { response: unknown }).response
      : priorOutput

  const outputs = {
    response: botResponse,
    value: picked,
    label,
    source: opts?.source ?? 'click',
    payload: opts?.payload ?? null,
    skipToNodeKey: opts?.skipToNodeKey?.trim() || null,
  }
  const outputVar = String(node.config.outputVariable ?? '').trim()

  let next: PreviewEngineState = {
    ...state,
    messages: [
      ...state.messages.map((m) => (m.buttons?.length ? { ...m, buttons: undefined } : m)),
      msg('user', label),
    ],
    stepOutputs: { ...state.stepOutputs, [node.key]: outputs },
    phase: { kind: 'typing' },
  }

  if (outputVar) {
    next = applyAssignment(next, outputVar, picked, node.key, outputs)
  }

  if (next.runs.length) {
    const last = next.runs[next.runs.length - 1]!
    if (last.nodeId === node.id) {
      next = {
        ...next,
        runs: [
          ...next.runs.slice(0, -1),
          {
            ...last,
            outputs: { ...last.outputs, ...outputs },
            savedAs: savedAsVar(outputVar) ?? last.savedAs,
          },
        ],
      }
    }
  }

  const skipKey = opts?.skipToNodeKey?.trim()
  const skipTarget =
    skipKey && skipKey !== node.key ? nodes.find((n) => n.key === skipKey)?.id ?? null : null

  if (skipTarget) {
    next = applyBypassedSkipOutputs(next, node.id, skipTarget, nodes, edges)
  }

  return resolveAfterStep(next, edges, nodes, skipTarget ?? nextNodeId(edges, node.id))
}

/**
 * Handle a button interaction (click / hover / …): run functions, skip, or continue.
 * Click with only side-effect listeners still advances the flow after those run.
 * Embed emits are returned as sideEffects for the UI to postMessage.
 */
export type ButtonInteractSideEffect =
  | {
      type: 'emit_event'
      eventName: string
      value: string
      payload?: unknown
      nodeKey?: string
    }
  | {
      type: 'run_function_host'
      name: string
      args: unknown
      value: string
      nodeKey?: string
    }
  | {
      type: 'restart_chat'
      nodeKey?: string
      clearCookies: boolean
    }

export function handlePreviewButtonInteract(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  event: ButtonListenerEvent,
  button: ResolvedButtonOption,
): { state: PreviewEngineState; sideEffects: ButtonInteractSideEffect[] } {
  bindCookieScope(state)
  if (state.phase.kind !== 'waiting_button') return { state, sideEffects: [] }
  const phase = state.phase
  const node = nodes.find((n) => n.id === phase.nodeId)
  const fromPhase =
    phase.buttons.find((b) => b.id && b.id === button.id) ||
    phase.buttons.find((b) => b.value === button.value && b.label === button.label) ||
    button

  let matched = listenersForEvent(fromPhase, event)
  if (!matched.length && event === 'click') {
    matched = [
      {
        event: 'click',
        action: 'continue',
        eventName: 'button_click',
        eventPayload: '',
        functionName: '',
        functionArgs: '',
        functionParams: {},
        skipToNodeKey: '',
      },
    ]
  }
  if (!matched.length) return { state, sideEffects: [] }

  let current = state
  let advanced = false
  const errors: string[] = []
  const sideEffects: ButtonInteractSideEffect[] = []

  for (const lst of matched) {
    if (lst.action === 'emit_event') {
      let payload: unknown
      const raw = lst.eventPayload.trim()
      if (raw) {
        try {
          payload = JSON.parse(raw) as unknown
        } catch {
          payload = raw
        }
      }
      sideEffects.push({
        type: 'emit_event',
        eventName: lst.eventName || 'button_click',
        value: fromPhase.value,
        payload,
        nodeKey: node?.key,
      })
      continue
    }
    if (lst.action === 'run_function') {
      if (!lst.functionName.trim()) {
        errors.push('Run function has no function selected')
        continue
      }
      const result = applyFlowFunction(current, lst.functionName, lst.functionParams ?? {})
      current = result.state
      if (result.error) errors.push(`${lst.functionName}: ${result.error}`)
      if (result.kind === 'host' || result.kind === 'unknown') {
        sideEffects.push({
          type: 'run_function_host',
          name: lst.functionName,
          args: Object.keys(lst.functionParams ?? {}).length
            ? lst.functionParams
            : lst.functionArgs,
          value: fromPhase.value,
          nodeKey: node?.key,
        })
      }
      continue
    }
    if (lst.action === 'restart') {
      advanced = true
      sideEffects.push({
        type: 'restart_chat',
        nodeKey: node?.key,
        clearCookies: false,
      })
      current = {
        ...current,
        phase: {
          kind: 'restart',
          nodeId: node?.id ?? phase.nodeId,
          clearCookies: false,
        },
      }
      continue
    }
    if (!listenerAdvancesFlow(lst.action) || advanced) continue
    advanced = true
    current = submitPreviewButton(current, nodes, edges, fromPhase.value, {
      label: fromPhase.label,
      source: event,
      skipToNodeKey: lst.action === 'skip_to' ? lst.skipToNodeKey : undefined,
    })
  }

  // Click should progress after side effects when no continue/skip listener ran.
  if (event === 'click' && !advanced && current.phase.kind === 'waiting_button') {
    current = submitPreviewButton(current, nodes, edges, fromPhase.value, {
      label: fromPhase.label,
      source: event,
    })
  }

  if (errors.length) {
    current = {
      ...current,
      messages: [...current.messages, msg('system', errors.join(' · '))],
    }
  }

  return { state: current, sideEffects }
}

export function submitPreviewSuggestion(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  text: string,
): PreviewEngineState {
  bindCookieScope(state)
  if (state.phase.kind !== 'waiting_suggestion') return state
  const waiting = state.phase
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node || node.type !== 'message') return state

  const trimmed = text.trim()
  if (!trimmed) return state

  const priorOutput = state.stepOutputs[node.key]
  const botResponse =
    priorOutput && typeof priorOutput === 'object' && priorOutput !== null && 'response' in priorOutput
      ? (priorOutput as { response: unknown }).response
      : priorOutput
  const outputs = { response: botResponse, suggestion: trimmed }
  const suggestionVar = String(node.config.suggestionVariable ?? '').trim()

  let next: PreviewEngineState = {
    ...state,
    messages: [
      ...state.messages.map((m) => (m.suggestions?.length ? { ...m, suggestions: undefined } : m)),
      msg('user', trimmed),
    ],
    stepOutputs: { ...state.stepOutputs, [node.key]: outputs },
    phase: { kind: 'typing' },
  }

  if (suggestionVar) {
    next = applyAssignment(next, suggestionVar, trimmed, node.key, outputs)
  }

  if (next.runs.length) {
    const last = next.runs[next.runs.length - 1]!
    if (last.nodeId === node.id) {
      next = {
        ...next,
        runs: [
          ...next.runs.slice(0, -1),
          {
            ...last,
            outputs: { ...last.outputs, suggestion: trimmed },
            savedAs: savedAsVar(suggestionVar) ?? last.savedAs,
          },
        ],
      }
    }
  }

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

export function submitPreviewAnswer(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  answer: string | string[] | Record<string, unknown> | Record<string, unknown>[],
): PreviewEngineState {
  bindCookieScope(state)
  if (state.phase.kind !== 'waiting_input') return state
  const waiting = state.phase
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node) return { ...state, phase: { kind: 'finished' } }

  const validated = validateQuestionAnswer(node.config, answer, {
    choices: waiting.choices,
    templates: state.templates,
  })
  const answerType = String(node.config.answerType ?? 'text')
  if (!validated.ok) {
    const failedText =
      answerType === 'password' || answerType === 'credit_card'
        ? '••••••'
        : Array.isArray(answer)
          ? answer
              .map((item) =>
                typeof item === 'string'
                  ? item
                  : String(
                      (item as { label?: unknown }).label ??
                        (item as { originalName?: unknown }).originalName ??
                        '',
                    ),
              )
              .join(', ')
          : typeof answer === 'object' && answer
            ? String(
                (answer as { label?: unknown }).label ??
                  (answer as { originalName?: unknown }).originalName ??
                  (answer as { filename?: unknown }).filename ??
                  '',
              )
            : String(answer)
    return {
      ...state,
      messages: [
        ...state.messages,
        msg('user', failedText || 'Invalid answer'),
        msg('system', validated.error),
      ],
      phase: { ...waiting, validationError: validated.error },
    }
  }

  const otpCfg = otpConfigOf(node.config)
  let challenge = state.otpChallenge

  // When an email connection is configured, require a matching live challenge
  if (answerType === 'otp' && otpCfg.connectionId) {
    const entered = String(validated.value ?? '').replace(/\D/g, '')
    if (!challenge || challenge.nodeId !== node.id) {
      return {
        ...state,
        messages: [
          ...state.messages,
          msg('user', entered),
          msg('system', 'Verification code has not been sent yet. Use Resend code.'),
        ],
        phase: { ...waiting, validationError: 'Code not sent yet' },
      }
    }
    if (Date.now() > Date.parse(challenge.expiresAt)) {
      return {
        ...state,
        messages: [
          ...state.messages,
          msg('user', entered),
          msg('system', 'That code has expired. Resend a new code.'),
        ],
        phase: { ...waiting, validationError: 'Code expired' },
      }
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      return {
        ...state,
        messages: [
          ...state.messages,
          msg('user', entered),
          msg('system', 'Too many incorrect attempts. Resend a new code.'),
        ],
        phase: { ...waiting, validationError: 'Too many attempts' },
      }
    }
    if (!codesEqual(entered, challenge.code)) {
      const attempts = challenge.attempts + 1
      challenge = { ...challenge, attempts }
      const remaining = Math.max(0, challenge.maxAttempts - attempts)
      const error =
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Incorrect code. Too many attempts — resend a new code.'
      return {
        ...state,
        otpChallenge: challenge,
        messages: [...state.messages, msg('user', entered), msg('system', error)],
        phase: { ...waiting, validationError: error },
      }
    }
  }

  if (answerType === 'captcha') {
    const entered =
      typeof answer === 'string'
        ? answer
        : Array.isArray(answer)
          ? String(answer[0] ?? '')
          : ''
    const cap = state.captchaChallenge
    if (!cap || cap.nodeId !== node.id) {
      return {
        ...state,
        messages: [
          ...state.messages,
          msg('user', entered || 'Captcha'),
          msg('system', 'Captcha is not ready. Refresh and try again.'),
        ],
        phase: { ...waiting, validationError: 'Captcha is not ready' },
      }
    }
    if (cap.attempts >= cap.maxAttempts) {
      return {
        ...state,
        messages: [
          ...state.messages,
          msg('user', entered || 'Captcha'),
          msg('system', 'Too many incorrect attempts. Refresh for a new puzzle or restart the chat.'),
        ],
        phase: { ...waiting, validationError: 'Too many attempts' },
      }
    }
    if (!captchaAnswersMatch(cap.answer, entered, cap.kind)) {
      const attempts = cap.attempts + 1
      const remaining = Math.max(0, cap.maxAttempts - attempts)
      const error =
        remaining > 0
          ? `Incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
          : 'Incorrect. Too many attempts.'
      return {
        ...state,
        captchaChallenge: { ...cap, attempts },
        messages: [...state.messages, msg('user', entered || 'Captcha'), msg('system', error)],
        phase: { ...waiting, validationError: error },
      }
    }
  }

  const value = validated.value
  const key = String(node.config.outputVariable ?? '').trim()
  const fileMedia = conversationFilesToMedia(value)
  const paymentUrl =
    answerType === 'payment' &&
    value &&
    typeof value === 'object' &&
    typeof (value as { url?: unknown }).url === 'string'
      ? String((value as { url: string }).url).trim()
      : ''
  const userMessage =
    answerType === 'url' && typeof value === 'string' && value
      ? msg('user', validated.displayText, {
          link: { url: value, loading: true },
        })
      : answerType === 'payment' && paymentUrl
        ? msg('user', validated.displayText, {
            link: { url: paymentUrl, loading: true },
          })
      : answerType === 'phone' && typeof value === 'string' && value
        ? msg('user', validated.displayText, { tel: value })
        : fileMedia.length
          ? msg('user', validated.displayText, { media: fileMedia })
          : msg('user', validated.displayText)
  let next: PreviewEngineState = {
    ...state,
    messages: [...state.messages, userMessage],
    phase: { kind: 'typing' },
    otpChallenge: null,
    signInAttempts: null,
    captchaChallenge: null,
  }
  if (key) {
    next = applyAssignment(next, key, value, node.key, { response: value })
  } else {
    next = {
      ...next,
      stepOutputs: { ...next.stepOutputs, [node.key]: { response: value } },
    }
  }

  next = appendRun(next, node, {
    startedAt: waiting.startedAt,
    inputs: {
      prompt: waiting.prompt,
      answerType,
      choices: waiting.choices,
      allowMultiple: waiting.allowMultiple,
      outputVariable: key || undefined,
      answerRequired: isAnswerRequired(node.config),
    },
    processed: { rawAnswer: answerType === 'credit_card' ? validated.displayText : answer, coercedValue: value },
    outputs: { response: value },
    savedAs: savedAsVar(key) ?? savedAsStep(node.key),
  })

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

/** Optional question: user skipped without answering (Succeeded with empty response). */
export function skipPreviewQuestion(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): PreviewEngineState {
  bindCookieScope(state)
  if (state.phase.kind !== 'waiting_input') return state
  const waiting = state.phase
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node || isAnswerRequired(node.config)) return state

  const key = String(node.config.outputVariable ?? '').trim()
  let next: PreviewEngineState = {
    ...state,
    messages: [...state.messages, msg('system', 'Skipped (optional)')],
    phase: { kind: 'typing' },
    otpChallenge: null,
    signInAttempts: null,
    captchaChallenge: null,
  }
  if (key) next = applyAssignment(next, key, null, node.key, { response: null, skipped: true })
  else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: { response: null, skipped: true } } }

  next = appendRun(next, node, {
    status: 'Succeeded',
    startedAt: waiting.startedAt,
    inputs: {
      prompt: waiting.prompt,
      answerType: waiting.answerType,
      answerRequired: false,
    },
    processed: { skipped: true },
    outputs: { response: null },
    savedAs: savedAsVar(key) ?? savedAsStep(node.key),
  })
  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

/**
 * Optional question timed out while waiting for an answer → TimedOut
 * (so the next step can configure run after “has timed out”).
 */
export function timeoutPreviewQuestion(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): PreviewEngineState {
  bindCookieScope(state)
  if (state.phase.kind !== 'waiting_input') return state
  const waiting = state.phase
  const node = nodes.find((n) => n.id === waiting.nodeId)
  if (!node || isAnswerRequired(node.config)) return state

  const timeoutSeconds = readTimeoutSeconds(node.config)
  if (timeoutSeconds <= 0) return state

  const key = String(node.config.outputVariable ?? '').trim()
  let next: PreviewEngineState = {
    ...state,
    messages: [...state.messages, msg('system', `Question timed out after ${timeoutSeconds}s`)],
    phase: { kind: 'typing' },
    otpChallenge: null,
    signInAttempts: null,
    captchaChallenge: null,
  }
  if (key) next = applyAssignment(next, key, null, node.key, { response: null, timedOut: true })
  else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: { response: null, timedOut: true } } }

  next = appendRun(next, node, {
    status: 'TimedOut',
    startedAt: waiting.startedAt,
    durationMs: Math.max(0, Date.now() - Date.parse(waiting.startedAt)),
    inputs: {
      prompt: waiting.prompt,
      answerType: waiting.answerType,
      answerRequired: false,
      timeoutSeconds,
    },
    processed: { timedOut: true },
    outputs: { response: null },
    savedAs: savedAsVar(key) ?? savedAsStep(node.key),
  })
  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

function isAbortOrTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'AbortError' || err.name === 'TimeoutError' || /aborted|timed?\s*out/i.test(err.message)
}

export async function runConnectionStep(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  connectionsById: Record<string, Record<string, unknown>>,
  options?: ConnectionStepContext,
): Promise<PreviewEngineState> {
  bindCookieScope(state)
  if (!state.currentId) return state
  const node = nodes.find((n) => n.id === state.currentId)
  if (!node || (node.type !== 'http' && node.type !== 'email' && node.type !== 'database')) return state

  if (!shouldRunAfterPredecessor(node.config, previousRunStatus(state))) {
    return skipDueToRunAfter(state, node, edges, nodes)
  }

  const wallStart = performance.now()
  const startedAt = new Date().toISOString()
  const timeoutSeconds = readTimeoutSeconds(node.config)
  const abortSignal =
    timeoutSeconds > 0 && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(timeoutSeconds * 1000)
      : undefined

  const { executeHttpConnection, sendEmailConnection, executeDatabaseConnection, isFlowForgeApiConfigured } =
    await import('@/shared/lib/flowforgeApi')

  let next = { ...state }
  let runStatus: PreviewRunStatus = 'Succeeded'
  let inputs: Record<string, unknown> = {}
  let processed: Record<string, unknown> = {}
  let outputs: Record<string, unknown> = {}
  let savedAs: string | null = null
  let connectionInvokeMs: number | undefined

  const useServerSecrets = !!(options?.chatbotId && String(node.config.connectionId ?? '').trim())

  if (node.type === 'http') {
    const connectionId = String(node.config.connectionId ?? '')
    const connection = connectionsById[connectionId]
    const { parseHttpConfig } = await import('@/features/connections/connectionConfig')
    const { buildHttpRequest } = await import('@/features/connections/buildHttpRequest')
    const { validateValueAgainstSchema } = await import('@/features/connections/responseSchema')

    const httpCfg = connection ? parseHttpConfig(connection as never) : null
    const rawParams =
      node.config.paramValues && typeof node.config.paramValues === 'object'
        ? (node.config.paramValues as Record<string, string>)
        : {}
    const interpolatedParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawParams)) {
      interpolatedParams[k] = interpolate(String(v ?? ''), next.vars, next.stepOutputs, next.media, false, next.templates)
    }

    const methodOverride = String(node.config.method ?? httpCfg?.defaultMethod ?? 'GET')
    const pathOverride = interpolate(String(node.config.path ?? ''), next.vars, next.stepOutputs, next.media, false, next.templates)
    const rawBody = String(node.config.body ?? '')
    const bodyText = rawBody ? interpolate(rawBody, next.vars, next.stepOutputs, next.media, false, next.templates) : ''

    // When local connection config is missing (public chat), build from node fields only;
    // PHP merges auth headers from server-side secrets via connection_id.
    const built = httpCfg
      ? buildHttpRequest(httpCfg, {
          method: methodOverride,
          path: pathOverride || undefined,
          paramValues: interpolatedParams,
          bodyOverride: bodyText || undefined,
        })
      : {
          method: methodOverride,
          path: pathOverride || '/',
          query: { ...interpolatedParams } as Record<string, string>,
          headers: [] as Array<{ key: string; value: string }>,
          body: bodyText || undefined,
        }

    const baseUrl = httpCfg?.baseUrl?.replace(/\/$/, '') ?? ''
    const pathForUrl = built.path?.startsWith('/') ? built.path : `/${built.path || ''}`
    let fullUrl = baseUrl ? `${baseUrl}${pathForUrl || '/'}` : pathForUrl || '/'
    if (built.query && Object.keys(built.query).length) {
      const qs = new URLSearchParams(built.query).toString()
      if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
    }
    const requestHeaders = [...(httpCfg?.headers ?? []), ...built.headers].map((h) => ({
      key: h.key,
      value: /^(authorization|proxy-authorization|x-api-key)$/i.test(h.key) ? '***' : h.value,
    }))

    inputs = {
      connectionId: connectionId || null,
      connectionName:
        connection && typeof connection === 'object' && String((connection as { name?: unknown }).name ?? '').trim()
          ? String((connection as { name?: unknown }).name).trim()
          : undefined,
      method: built.method,
      path: node.config.path ?? '',
      baseUrl: baseUrl || (useServerSecrets ? '(resolved server-side)' : null),
      url: fullUrl,
      body: rawBody || undefined,
      paramValues: rawParams,
    }
    processed = {
      method: built.method,
      path: built.path,
      url: fullUrl,
      query: built.query,
      headers: requestHeaders,
      body: built.body,
      paramValues: interpolatedParams,
    }

    let result: Record<string, unknown>
    const canCallApi =
      isFlowForgeApiConfigured() && (!!connection || (useServerSecrets && !!connectionId))
    if (!canCallApi) {
      connectionInvokeMs = 0
      result = {
        ok: true,
        status: 200,
        path: built.path,
        url: fullUrl,
        data: { mock: true, reason: !connection && !useServerSecrets ? 'missing_connection' : 'api_not_configured' },
      }
      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          `HTTP ${built.method} ${fullUrl} (mocked - configure API URL and connection)`,
        ),
      }
    } else {
      try {
        const invokeStart = performance.now()
        const apiResult = await runtimeResilience.run([options?.instanceId, options?.chatbotId, options?.sessionId, connectionId || node.id].join(':'), built.method, () => executeHttpConnection({
          ...(useServerSecrets
            ? {
                connectionId,
                chatbotId: options!.chatbotId,
                instanceId: options?.instanceId,
                sessionId: options?.sessionId,
              }
            : {}),
          ...(connection ? { connection } : {}),
          method: built.method,
          path: built.path || '/',
          query: built.query,
          headers: [...(httpCfg?.headers ?? []), ...built.headers],
          body: built.body,
          signal: abortSignal,
        }), abortSignal)
        connectionInvokeMs = Math.round(performance.now() - invokeStart)

        let schemaErrors: string[] = []
        if (httpCfg) {
          schemaErrors = validateValueAgainstSchema(
            apiResult.data,
            httpCfg.expectedResponse.dataType,
            httpCfg.expectedResponse.schema,
            httpCfg.expectedResponse.itemSchema ?? [],
          )
        }

        const failed = !apiResult.ok || schemaErrors.length > 0
        result = {
          ok: !failed,
          status: apiResult.status,
          url: fullUrl,
          headers: apiResult.headers,
          data: apiResult.data,
          error: apiResult.error ?? (schemaErrors.length ? 'Response did not match expected schema' : null),
          schemaErrors: schemaErrors.length ? schemaErrors : undefined,
        }
        processed = {
          ...processed,
          responseStatus: apiResult.status,
          responseError: apiResult.error ?? null,
          schemaErrors: schemaErrors.length ? schemaErrors : undefined,
          failureReason: !apiResult.ok
            ? apiResult.error || `Upstream returned HTTP ${apiResult.status}`
            : schemaErrors.length
              ? 'schema_mismatch'
              : undefined,
        }
        if (failed) runStatus = 'Failed'
        next = {
          ...next,
          messages: appendTechSystemMessage(
            next.messages,
            options,
            `HTTP ${built.method} ${fullUrl} -> ${apiResult.status}${
              !apiResult.ok
                ? ` (failed${apiResult.error ? `: ${apiResult.error}` : ''})`
                : schemaErrors.length
                  ? ' (schema mismatch)'
                  : ''
            }`,
          ),
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'HTTP request failed'
        const timedOut = isAbortOrTimeoutError(err)
        if (connectionInvokeMs == null) {
          connectionInvokeMs = Math.round(performance.now() - wallStart)
        }
        result = {
          ok: false,
          status: 0,
          url: fullUrl,
          data: null,
          error: message,
          timedOut,
        }
        processed = {
          ...processed,
          responseStatus: 0,
          responseError: message,
          failureReason: timedOut ? 'timeout' : message,
        }
        runStatus = timedOut ? 'TimedOut' : 'Failed'
        next = {
          ...next,
          messages: appendTechSystemMessage(
            next.messages,
            options,
            timedOut
              ? `HTTP timed out after ${timeoutSeconds}s (${fullUrl})`
              : `HTTP error: ${message} (${built.method} ${fullUrl})`,
          ),
        }
      }
    }

    const key = String(node.config.outputVariable ?? '').trim()
    if (key) next = applyAssignment(next, key, result, node.key, result)
    else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: result } }
    outputs = result
    savedAs = savedAsVar(key) ?? savedAsStep(node.key)
  }

  if (node.type === 'database') {
    const connectionId = String(node.config.connectionId ?? '')
    const connection = connectionsById[connectionId]
    const operation = String(node.config.operation ?? 'query') === 'execute' ? 'execute' : 'query'
    const sql = String(node.config.sql ?? '').trim()
    const rawParams =
      node.config.paramValues && typeof node.config.paramValues === 'object'
        ? (node.config.paramValues as Record<string, string>)
        : {}
    const interpolatedParams: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rawParams)) {
      const name = k.trim().replace(/^:/, '')
      if (!name) continue
      interpolatedParams[name] = interpolate(
        String(v ?? ''),
        next.vars,
        next.stepOutputs,
        next.media,
        false,
        next.templates,
      )
    }

    inputs = {
      connectionId: connectionId || null,
      connectionName:
        connection && typeof connection === 'object' && String((connection as { name?: unknown }).name ?? '').trim()
          ? String((connection as { name?: unknown }).name).trim()
          : undefined,
      operation,
      sql,
      paramValues: rawParams,
    }
    processed = {
      operation,
      sql,
      paramValues: interpolatedParams,
    }

    let result: Record<string, unknown>
    const canCallApi =
      isFlowForgeApiConfigured() && (!!connection || (useServerSecrets && !!connectionId))
    if (!canCallApi) {
      connectionInvokeMs = 0
      result = {
        ok: true,
        rows: [],
        rowCount: 0,
        mock: true,
        reason: !connection && !useServerSecrets ? 'missing_connection' : 'api_not_configured',
      }
      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          `Database ${operation} (mocked — configure API URL and connection)`,
        ),
      }
    } else {
      try {
        const invokeStart = performance.now()
        const apiResult = await executeDatabaseConnection({
          ...(useServerSecrets
            ? {
                connectionId,
                chatbotId: options!.chatbotId,
                instanceId: options?.instanceId,
                sessionId: options?.sessionId,
              }
            : {}),
          ...(connection ? { connection } : {}),
          sql,
          params: interpolatedParams,
          operation,
          signal: abortSignal,
        })
        connectionInvokeMs = Math.round(performance.now() - invokeStart)
        const failed = !apiResult.ok
        result = {
          ok: !failed,
          rows: apiResult.rows ?? [],
          rowCount: apiResult.rowCount ?? 0,
          error: apiResult.error ?? null,
        }
        processed = {
          ...processed,
          responseError: apiResult.error ?? null,
          failureReason: failed ? apiResult.error || 'Database query failed' : undefined,
        }
        if (failed) runStatus = 'Failed'
        next = {
          ...next,
          messages: appendTechSystemMessage(
            next.messages,
            options,
            failed
              ? `Database ${operation} failed${apiResult.error ? `: ${apiResult.error}` : ''}`
              : `Database ${operation} → ${apiResult.rowCount ?? 0} row(s)`,
          ),
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Database query failed'
        const timedOut = isAbortOrTimeoutError(err)
        if (connectionInvokeMs == null) {
          connectionInvokeMs = Math.round(performance.now() - wallStart)
        }
        result = {
          ok: false,
          rows: [],
          rowCount: 0,
          error: message,
          timedOut,
        }
        processed = {
          ...processed,
          responseError: message,
          failureReason: timedOut ? 'timeout' : message,
        }
        runStatus = timedOut ? 'TimedOut' : 'Failed'
        next = {
          ...next,
          messages: appendTechSystemMessage(
            next.messages,
            options,
            timedOut
              ? `Database timed out after ${timeoutSeconds}s`
              : `Database error: ${message}`,
          ),
        }
      }
    }

    const key = String(node.config.outputVariable ?? '').trim()
    if (key) next = applyAssignment(next, key, result, node.key, result)
    else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: result } }
    outputs = result
    savedAs = savedAsVar(key) ?? savedAsStep(node.key)
  }

  if (node.type === 'email') {
    const connectionId = String(node.config.connectionId ?? '')
    const connection = connectionsById[connectionId]
    const { parseEmailConfig } = await import('@/features/connections/connectionConfig')
    const { resolveParamValues } = await import('@/features/connections/buildHttpRequest')
    const { validateValueAgainstSchema } = await import('@/features/connections/responseSchema')

    const emailCfg = connection ? parseEmailConfig(connection as never) : null
    const rawParams =
      node.config.paramValues && typeof node.config.paramValues === 'object'
        ? (node.config.paramValues as Record<string, string>)
        : {}
    const interpolatedParams: Record<string, string> = {}
    const emailBindings = bindingsOf(node.config)
    for (const [k, v] of Object.entries(rawParams)) {
      interpolatedParams[k] = interpolate(
        String(v ?? ''),
        next.vars,
        next.stepOutputs,
        next.media,
        false,
        next.templates,
        emailBindings,
      )
    }
    if (emailCfg) {
      const resolved = resolveParamValues(emailCfg.inputParams, interpolatedParams)
      Object.assign(interpolatedParams, resolved.values)
    }

    const to = interpolate(
      String(interpolatedParams.to ?? node.config.to ?? ''),
      next.vars,
      next.stepOutputs,
      next.media,
      false,
      next.templates,
      emailBindings,
    )
    const subject = interpolate(
      String(interpolatedParams.subject ?? node.config.subject ?? ''),
      next.vars,
      next.stepOutputs,
      next.media,
      false,
      next.templates,
      emailBindings,
    )
    const body = interpolate(
      String(interpolatedParams.body ?? node.config.body ?? ''),
      next.vars,
      next.stepOutputs,
      next.media,
      false,
      next.templates,
      emailBindings,
    )

    inputs = {
      connectionId: connectionId || null,
      to: interpolatedParams.to ?? node.config.to ?? '',
      subject: interpolatedParams.subject ?? node.config.subject ?? '',
      body: interpolatedParams.body ?? node.config.body ?? '',
      paramValues: rawParams,
    }
    processed = { to, subject, body, paramValues: interpolatedParams }

    let result: Record<string, unknown> = {
      ...interpolatedParams,
      to,
      subject,
      body,
    }
    const canCallApi =
      isFlowForgeApiConfigured() && (!!connection || (useServerSecrets && !!connectionId))
    if (!canCallApi) {
      connectionInvokeMs = 0
      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          `Email to ${to || '(missing)'} - ${subject || '(no subject)'} (mocked)`,
        ),
      }
      result = { ...result, ok: true, mocked: true }
    } else {
      try {
        const invokeStart = performance.now()
        const apiResult = await sendEmailConnection({
          ...(useServerSecrets
            ? {
                connectionId,
                chatbotId: options!.chatbotId,
                instanceId: options?.instanceId,
                sessionId: options?.sessionId,
              }
            : {}),
          ...(connection ? { connection } : {}),
          to,
          subject,
          body,
          signal: abortSignal,
        })
        connectionInvokeMs = Math.round(performance.now() - invokeStart)
        result = {
          ...result,
          ok: apiResult.ok,
          message_id: apiResult.message_id ?? null,
          error: apiResult.error ?? null,
        }
        if (emailCfg) {
          const schemaErrors = validateValueAgainstSchema(
            result,
            emailCfg.expectedResponse.dataType,
            emailCfg.expectedResponse.schema,
            emailCfg.expectedResponse.itemSchema ?? [],
          )
          if (schemaErrors.length) {
            result = { ...result, ok: false, schemaErrors }
          }
        }
        if (!result.ok) runStatus = 'Failed'
        next = {
          ...next,
          messages: appendTechSystemMessage(
            next.messages,
            options,
            apiResult.ok
              ? `Email sent to ${to}${result.schemaErrors ? ' (schema mismatch)' : ''}`
              : `Email failed: ${apiResult.error ?? 'unknown'}`,
          ),
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Email failed'
        const timedOut = isAbortOrTimeoutError(err)
        if (connectionInvokeMs == null) {
          connectionInvokeMs = Math.round(performance.now() - wallStart)
        }
        result = { ...result, ok: false, error: message, timedOut }
        runStatus = timedOut ? 'TimedOut' : 'Failed'
        next = {
          ...next,
          messages: appendTechSystemMessage(
            next.messages,
            options,
            timedOut ? `Email timed out after ${timeoutSeconds}s` : `Email error: ${message}`,
          ),
        }
      }
    }

    next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: result } }
    outputs = result
    savedAs = savedAsStep(node.key)
  }

  next = appendRun(next, node, {
    status: runStatus,
    startedAt,
    durationMs: Math.round(performance.now() - wallStart),
    inputs: { ...inputs, timeoutSeconds: timeoutSeconds || undefined },
    processed: {
      ...processed,
      ...(connectionInvokeMs != null ? { invokeMs: connectionInvokeMs } : {}),
      ...(runStatus === 'TimedOut' ? { timedOut: true } : {}),
    },
    outputs,
    savedAs,
  })

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

export async function runIntegrationStep(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  options?: ConnectionStepContext,
): Promise<PreviewEngineState> {
  bindCookieScope(state)
  if (!state.currentId) return state
  const node = nodes.find((n) => n.id === state.currentId)
  if (!node || node.type !== 'integration') return state

  if (!shouldRunAfterPredecessor(node.config, previousRunStatus(state))) {
    return skipDueToRunAfter(state, node, edges, nodes)
  }

  const wallStart = performance.now()
  const startedAt = new Date().toISOString()
  const timeoutSeconds = readTimeoutSeconds(node.config)
  const abortSignal =
    timeoutSeconds > 0 && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(timeoutSeconds * 1000)
      : undefined

  const { executeIntegrationAction, isFlowForgeApiConfigured } = await import('@/shared/lib/flowforgeApi')

  let next = { ...state }
  let runStatus: PreviewRunStatus = 'Succeeded'
  const integrationId = String(node.config.integrationId ?? '').trim()
  const action = String(node.config.action ?? '').trim()
  const rawFieldsSource =
    node.config.fieldValues && typeof node.config.fieldValues === 'object'
      ? (node.config.fieldValues as Record<string, unknown>)
      : node.config.params && typeof node.config.params === 'object'
        ? (node.config.params as Record<string, unknown>)
        : {}
  const rawFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawFieldsSource)) {
    rawFields[k] = String(v ?? '')
  }
  const interpolatedFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawFields)) {
    interpolatedFields[k] = interpolate(String(v ?? ''), next.vars, next.stepOutputs, next.media, false, next.templates)
  }

  const inputs: Record<string, unknown> = {
    integrationId: integrationId || null,
    action: action || null,
    fieldValues: rawFields,
  }
  const processed: Record<string, unknown> = {
    action,
    fieldValues: interpolatedFields,
  }

  let result: Record<string, unknown> = {
    ok: false,
    action,
    fields: interpolatedFields,
  }
  let connectionInvokeMs: number | undefined

  const canCallApi =
    isFlowForgeApiConfigured() &&
    !!integrationId &&
    !!action &&
    !!(options?.instanceId || options?.sessionId)

  if (!canCallApi) {
    connectionInvokeMs = 0
    result = { ...result, ok: true, mocked: true }
    next = {
      ...next,
      messages: appendTechSystemMessage(
        next.messages,
        options,
        `Integration ${action || '(no action)'} (mocked)`,
      ),
    }
  } else {
    try {
      const invokeStart = performance.now()
      const apiResult = await executeIntegrationAction({
        integrationId,
        instanceId: options!.instanceId ?? '',
        action,
        fields: interpolatedFields,
        chatbotId: options?.chatbotId,
        sessionId: options?.sessionId,
        signal: abortSignal,
      })
      connectionInvokeMs = Math.round(performance.now() - invokeStart)
      result = {
        ok: apiResult.ok,
        status: apiResult.status,
        data: apiResult.data,
        error: apiResult.error,
        action,
        fields: interpolatedFields,
      }
      if (!apiResult.ok) runStatus = 'Failed'
      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          apiResult.ok
            ? `Integration ${action} succeeded`
            : `Integration failed: ${apiResult.error ?? 'unknown'}`,
        ),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Integration failed'
      const timedOut = isAbortOrTimeoutError(err)
      if (connectionInvokeMs == null) {
        connectionInvokeMs = Math.round(performance.now() - wallStart)
      }
      result = { ...result, ok: false, error: message, timedOut }
      runStatus = timedOut ? 'TimedOut' : 'Failed'
      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          timedOut ? `Integration timed out after ${timeoutSeconds}s` : `Integration error: ${message}`,
        ),
      }
    }
  }

  const key = String(node.config.outputVariable ?? node.config.resultVariable ?? '').trim()
  if (key) next = applyAssignment(next, key, result, node.key, result)
  else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: result } }

  next = appendRun(next, node, {
    status: runStatus,
    startedAt,
    durationMs: Math.round(performance.now() - wallStart),
    inputs: { ...inputs, timeoutSeconds: timeoutSeconds || undefined },
    processed: {
      ...processed,
      ...(connectionInvokeMs != null ? { invokeMs: connectionInvokeMs } : {}),
      ...(runStatus === 'TimedOut' ? { timedOut: true } : {}),
    },
    outputs: result,
    savedAs: savedAsVar(key) ?? savedAsStep(node.key),
  })

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

export async function runEntityStep(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  options?: ConnectionStepContext,
): Promise<PreviewEngineState> {
  bindCookieScope(state)
  if (!state.currentId) return state
  const node = nodes.find((n) => n.id === state.currentId)
  if (!node || node.type !== 'entity') return state

  if (!shouldRunAfterPredecessor(node.config, previousRunStatus(state))) {
    return skipDueToRunAfter(state, node, edges, nodes)
  }

  const wallStart = performance.now()
  const startedAt = new Date().toISOString()
  const operation = String(node.config.operation ?? 'list')
  const entityId = String(node.config.entityId ?? '').trim()
  const outputKey = String(node.config.outputVariable ?? '').trim()
  const recordIdRaw = String(node.config.recordId ?? '')
  const filterAttribute = String(node.config.filterAttribute ?? '').trim()
  const filterEqualsRaw = String(node.config.filterEquals ?? '')
  const filtersRaw =
    node.config.filters && typeof node.config.filters === 'object' && !Array.isArray(node.config.filters)
      ? (node.config.filters as { logic?: string; clauses?: Array<{ attribute?: string; operator?: string; value?: string }> })
      : undefined
  const fieldMap =
    node.config.fieldMap && typeof node.config.fieldMap === 'object' && !Array.isArray(node.config.fieldMap)
      ? (node.config.fieldMap as Record<string, string>)
      : {}

  let next = { ...state }
  let runStatus: PreviewRunStatus = 'Succeeded'
  let outputs: Record<string, unknown> = {}
  let processed: Record<string, unknown> = {}

  const inputs = {
    operation,
    entityId,
    recordId: recordIdRaw || undefined,
    filterAttribute: filterAttribute || undefined,
    filterEquals: filterEqualsRaw || undefined,
    filters: filtersRaw,
    fieldMap: Object.keys(fieldMap).length ? fieldMap : undefined,
  }

  try {
    if (!entityId) throw new Error('Select an entity')
    const chatbotId = options?.chatbotId?.trim()
    if (!chatbotId) throw new Error('Chatbot context is required for entity steps')
    const sessionId = options?.sessionId?.trim()

    const entityOpStart = performance.now()
    const { coalesceEntityFilters, queryEntityRecords } = await import('@/features/entities/entityQuery')
    const resolveEntityValue = (raw: string) =>
      resolveValue(raw, next.vars, next.stepOutputs, next.media, next.templates)

    const recordId = recordIdRaw ? String(resolveEntityValue(recordIdRaw) ?? '') : ''
    const filters = coalesceEntityFilters({
      filters: filtersRaw as import('@/features/entities/entityQuery').EntityFilters | undefined,
      filterAttribute,
      filterEquals: filterEqualsRaw,
    })
    const resolvedFilters = {
      logic: filters.logic,
      clauses: filters.clauses.map((clause) => ({
        attribute: clause.attribute,
        operator: clause.operator,
        value:
          clause.operator === 'exists' ? undefined : resolveEntityValue(String(clause.value ?? '')),
        valueTemplate: String(clause.value ?? '') || undefined,
      })),
    }
    const filterEquals = filterEqualsRaw ? resolveEntityValue(filterEqualsRaw) : undefined

    const incomingFields: Record<string, unknown> = {}
    for (const [k, tmpl] of Object.entries(fieldMap)) {
      const resolved = resolveEntityValue(String(tmpl ?? ''))
      if (resolved === undefined || resolved === null || (typeof resolved === 'string' && resolved.trim() === '')) {
        continue
      }
      incomingFields[k] = resolved
    }

    // Public / anon chat: RLS blocks direct table writes — use session-scoped RPC.
    if (sessionId) {
      const { publicChatEntityOp } = await import('@/features/entities/entityApi')
      const { ensurePrimaryKeyValue } = await import('@/features/entities/entityPrimaryKey')

      let rpcValues = incomingFields
      if (operation === 'create') {
        rpcValues = ensurePrimaryKeyValue(incomingFields)
      }

      const result = await publicChatEntityOp({
        sessionId,
        chatbotId,
        entityId,
        operation: operation === 'get' ? 'list' : operation,
        values: rpcValues,
        recordId: recordId || undefined,
      })
      const entityKey = result.entity?.key ?? 'entity'

      processed = {
        entityKey,
        entityKind: result.entity?.kind ?? 'dynamic',
        recordId: recordId || undefined,
        filters: resolvedFilters,
        filterEquals,
        fieldMap: Object.keys(fieldMap).length ? fieldMap : undefined,
        resolvedFields: Object.keys(rpcValues).length ? rpcValues : undefined,
        invokeMs: Math.round(performance.now() - entityOpStart),
        via: 'public_chat_entity_op',
      }

      if (operation === 'list' || operation === 'get') {
        const normalized = (result.records ?? []).map((raw) => {
          const row = raw as { id?: string; values?: Record<string, unknown> } & Record<string, unknown>
          if (row.values && typeof row.values === 'object' && !Array.isArray(row.values)) {
            return { id: String(row.id ?? ''), values: row.values }
          }
          const { id: rid, created_at: _c, updated_at: _u, sort_order: _s, ...rest } = row
          void _c
          void _u
          void _s
          return { id: String(rid ?? ''), values: rest }
        })
        let filtered = queryEntityRecords(normalized, filters, resolveEntityValue)
        if (operation === 'get' && recordId) filtered = filtered.filter(row => row.id === recordId)
        const { entityQueryOutput } = await import('@/features/entities/entityQueryOutput')
        const queried = await entityQueryOutput({ records: filtered.map(row => ({ id: row.id, ...row.values })) }, { ...node.config, operation: 'list' }, chatbotId, sessionId)
        const list = queried.records as Record<string, unknown>[]
        outputs = operation === 'get' ? { record: list[0] ?? null, found: list.length > 0 } : { records: list, count: list.length }
      } else if (operation === 'create' || operation === 'update') {
        const rec = (result.record ?? {}) as Record<string, unknown>
        outputs = { record: rec, id: result.id ?? rec.id }
      } else if (operation === 'delete') {
        outputs = { deleted: true, id: result.id ?? recordId }
      } else {
        throw new Error(`Unknown entity operation "${operation}"`)
      }

      const value =
        operation === 'list'
          ? outputs.records
          : operation === 'get' || operation === 'create' || operation === 'update'
            ? outputs.record
            : outputs

      if (outputKey) next = applyAssignment(next, outputKey, value, node.key, outputs)
      else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: outputs } }

      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          `Entity ${entityKey}.${operation}${
            operation === 'list' ? ` → ${(outputs.count as number) ?? 0} rows` : ''
          }`,
        ),
      }
    } else {
      const { assertEntityLinkAllows, entityOpToLinkOp } = await import('@/features/entities/entityApi')
      await assertEntityLinkAllows(entityId, chatbotId, entityOpToLinkOp(operation))

      const { supabase } = await import('@/shared/lib/supabase')
      const { data: entity, error: entityError } = await supabase
        .from('chatbot_entities')
        .select('*')
        .eq('id', entityId)
        .maybeSingle()
      if (entityError || !entity) throw new Error(entityError?.message ?? 'Entity not found')

      const {
        createDynamicRecord,
        deleteDynamicRecord,
        listEntityRecords,
        toRecordPayload,
        updateDynamicRecord,
      } = await import('@/features/entities/entityApi')

      let resolvedFields: Record<string, unknown> = incomingFields
      if (operation === 'create' || operation === 'update') {
        const { data: attrs, error: attrsError } = await supabase
          .from('entity_attributes')
          .select('*')
          .eq('entity_id', entityId)
          .order('sort_order')
        if (attrsError) throw new Error(attrsError.message)
        const { ensurePrimaryKeyValue } = await import('@/features/entities/entityPrimaryKey')
        const { validateAndCoerceEntityValues } = await import('@/features/entities/entityValueValidation')
        const fieldsForValidate =
          operation === 'create' ? ensurePrimaryKeyValue(incomingFields) : incomingFields
        resolvedFields = validateAndCoerceEntityValues(fieldsForValidate, attrs ?? [], {
          partial: operation === 'update',
        })
      }

      processed = {
        entityKey: entity.key,
        entityKind: entity.kind,
        recordId: recordId || undefined,
        filters: resolvedFilters,
        filterEquals,
        fieldMap: Object.keys(fieldMap).length ? fieldMap : undefined,
        resolvedFields: Object.keys(resolvedFields).length ? resolvedFields : undefined,
        invokeMs: Math.round(performance.now() - entityOpStart),
      }

      if (entity.kind === 'static' && (operation === 'create' || operation === 'update' || operation === 'delete')) {
        throw new Error('Static entities are read-only in flows (use List/Get)')
      }

      if (operation === 'list' || operation === 'get') {
        let rows = await listEntityRecords(entity)
        rows = queryEntityRecords(rows, filters, resolveEntityValue)
        if (operation === 'get' && recordId) rows = rows.filter(row => row.id === recordId)
        const { entityQueryOutput } = await import('@/features/entities/entityQueryOutput')
        const queried = await entityQueryOutput({ records: rows.map(toRecordPayload) }, { ...node.config, operation: 'list' }, chatbotId)
        const list = queried.records as Record<string, unknown>[]
        outputs = operation === 'get' ? { record: list[0] ?? null, found: list.length > 0 } : { records: list, count: list.length }
      } else if (operation === 'create') {
        const created = await createDynamicRecord(entityId, resolvedFields)
        const values =
          created.values && typeof created.values === 'object' && !Array.isArray(created.values)
            ? (created.values as Record<string, unknown>)
            : {}
        outputs = { record: { id: created.id, ...values }, id: created.id }
      } else if (operation === 'update') {
        if (!recordId) throw new Error('Record id is required for update')
        const updated = await updateDynamicRecord(recordId, resolvedFields, {
          entityId,
          merge: true,
        })
        const values =
          updated.values && typeof updated.values === 'object' && !Array.isArray(updated.values)
            ? (updated.values as Record<string, unknown>)
            : {}
        outputs = { record: { id: updated.id, ...values }, id: updated.id }
      } else if (operation === 'delete') {
        if (!recordId) throw new Error('Record id is required for delete')
        await deleteDynamicRecord(recordId)
        outputs = { deleted: true, id: recordId }
      } else {
        throw new Error(`Unknown entity operation "${operation}"`)
      }

      const value =
        operation === 'list'
          ? outputs.records
          : operation === 'get' || operation === 'create' || operation === 'update'
            ? outputs.record
            : outputs

      if (outputKey) next = applyAssignment(next, outputKey, value, node.key, outputs)
      else next = { ...next, stepOutputs: { ...next.stepOutputs, [node.key]: outputs } }

      next = {
        ...next,
        messages: appendTechSystemMessage(
          next.messages,
          options,
          `Entity ${entity.key}.${operation}${
            operation === 'list' ? ` → ${(outputs.count as number) ?? 0} rows` : ''
          }`,
        ),
      }
    }
  } catch (err) {
    runStatus = 'Failed'
    const message = err instanceof Error ? err.message : 'Entity step failed'
    outputs = { ok: false, error: message }
    next = {
      ...next,
      messages: appendTechSystemMessage(next.messages, options, `Entity error: ${message}`),
      stepOutputs: { ...next.stepOutputs, [node.key]: outputs },
    }
  }

  next = appendRun(next, node, {
    status: runStatus,
    startedAt,
    durationMs: Math.round(performance.now() - wallStart),
    inputs,
    processed,
    outputs,
    savedAs: savedAsVar(outputKey) ?? savedAsStep(node.key),
  })

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}
