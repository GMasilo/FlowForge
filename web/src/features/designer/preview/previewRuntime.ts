import {
  nodeTypeLabel,
  readDelaySeconds,
  readRunAfter,
  readTimeoutSeconds,
  isAnswerRequired,
  resolveQuestionChoices,
  type DesignerEdge,
  type DesignerNode,
  type RunAfterKey,
} from '@/features/designer/model/flowSchema'
import { conversationFilesToMedia } from '@/features/designer/model/conversationFiles'
import { validateQuestionAnswer } from '@/features/designer/model/answerValidation'
import { captchaAnswersMatch, generateCaptchaPuzzle } from '@/features/designer/model/captchaChallenge'
import { resolveMediaAttachments, mediaExprMap, stripFileEmbeds } from '@/features/designer/model/chatbotMedia'
import {
  interpolateTemplate,
  parseJsonValue,
  resolveExpressionValue,
} from '@/features/designer/preview/expressionEval'
import { parseTemplateBindingMap, type TemplateBindingMap } from '@/features/templates/templateModel'
import { findContinueRootIds } from '@/features/designer/utils/conditionGraph'
import type { FlowNodeType } from '@/shared/types/database'

export type ChatRole = 'bot' | 'user' | 'system'

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
  | { kind: 'typing' }
  | { kind: 'finished' }

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
): string {
  return interpolateTemplate(template, {
    vars,
    steps: stepOutputs,
    media,
    templates,
    embedMedia,
    templateBindings,
  })
}

function interpolateChat(
  template: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
  media: Record<string, unknown> = {},
  templates: Record<string, unknown> = {},
  templateBindings: TemplateBindingMap = {},
): string {
  return interpolate(template, vars, stepOutputs, media, true, templates, templateBindings)
}

function bindingsOf(config: Record<string, unknown>): TemplateBindingMap {
  return parseTemplateBindingMap(config.templateBindings)
}

function resolveValue(
  raw: string,
  vars: Record<string, unknown>,
  stepOutputs: Record<string, unknown>,
  media: Record<string, unknown> = {},
  templates: Record<string, unknown> = {},
  templateBindings: TemplateBindingMap = {},
): unknown {
  return resolveExpressionValue(raw, { vars, steps: stepOutputs, media, templates, templateBindings })
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
  /** Active captcha solution, if any. */
  captchaChallenge?: PreviewCaptchaChallenge | null
  /** {{media.key}} → public file URL */
  media: Record<string, unknown>
  mediaCatalog: Array<{ filename: string; url: string; key: string; mime: string }>
  /** {{templates.key.text}} / .html / .subject */
  templates: Record<string, unknown>
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
    captchaChallenge: null,
    media,
    mediaCatalog,
    templates,
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
  let next = appendRun(state, node, {
    status: 'Skipped',
    inputs: {
      runAfter,
      delaySeconds: readDelaySeconds(node.config),
    },
    processed: {
      previousStatus,
      reason: 'Configure run after — previous step status is not allowed',
    },
    outputs: {},
    savedAs: null,
  })
  // Condition/loop still need a next handle; use unlabeled (then) when skipping
  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
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
  if (!state.currentId || state.phase.kind === 'waiting_input' || state.phase.kind === 'finished') {
    return state
  }

  const node = nodes.find((n) => n.id === state.currentId)
  if (!node) {
    return { ...state, phase: { kind: 'finished' }, currentId: null }
  }

  if (!shouldRunAfterPredecessor(node.config, previousRunStatus(state))) {
    return skipDueToRunAfter(state, node, edges, nodes)
  }

  let next = { ...state }

  if (node.type === 'message') {
    const template = String(node.config.text ?? '')
    const text = interpolateChat(template, next.vars, next.stepOutputs, next.media, next.templates, bindingsOf(node.config))
    const media = attachmentsFor(node, next.mediaCatalog)
    const stored = stripFileEmbeds(text)
    next = {
      ...next,
      messages: [...next.messages, msg('bot', text || (media?.length ? '' : '?'), { media })],
      stepOutputs: { ...next.stepOutputs, [node.key]: { response: stored } },
    }
    next = appendRun(next, node, {
      inputs: { text: template },
      processed: { interpolated: stored },
      outputs: { response: stored },
      savedAs: savedAsStep(node.key),
    })
    return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
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
      const url = interpolate(
        String(node.config.payUrl ?? ''),
        next.vars,
        next.stepOutputs,
        next.media,
        false,
        next.templates,
        qBindings,
      ).trim()
      const amount = interpolate(
        String(node.config.paymentAmount ?? ''),
        next.vars,
        next.stepOutputs,
        next.media,
        false,
        next.templates,
        qBindings,
      ).trim()
      const currency =
        String(node.config.currencyCode ?? 'ZAR').trim().toUpperCase() || 'ZAR'
      payment = {
        url,
        amount,
        currency,
        payLabel: String(node.config.payButtonLabel ?? '').trim() || 'Pay now',
        paidLabel: String(node.config.paidButtonLabel ?? '').trim() || "I've paid",
        connectionId: String(node.config.paymentConnectionId ?? '').trim() || undefined,
        itemName: interpolate(
          String(node.config.paymentItemName ?? ''),
          next.vars,
          next.stepOutputs,
          next.media,
          false,
          next.templates,
          qBindings,
        ).trim() || undefined,
        buyerEmail: interpolate(
          String(node.config.paymentBuyerEmail ?? ''),
          next.vars,
          next.stepOutputs,
          next.media,
          false,
          next.templates,
          qBindings,
        ).trim() || undefined,
        buyerName: interpolate(
          String(node.config.paymentBuyerName ?? ''),
          next.vars,
          next.stepOutputs,
          next.media,
          false,
          next.templates,
          qBindings,
        ).trim() || undefined,
        nodeKey: node.key,
        verify: !!String(node.config.paymentConnectionId ?? '').trim(),
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

    return {
      ...next,
      captchaChallenge,
      messages: [...next.messages, msg('bot', prompt || (media?.length ? '' : '?'), { media })],
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
    }
  }

  if (node.type === 'set_variable') {
    const key = String(node.config.variableKey ?? '').trim()
    const rawValue = String(node.config.value ?? '')
    const value = resolveValue(rawValue, next.vars, next.stepOutputs, next.media, next.templates)
    if (key) next = applyAssignment(next, key, value, node.key)
    next = appendRun(next, node, {
      inputs: { variableKey: key, value: rawValue, valueType: node.config.valueType ?? 'string' },
      processed: { resolvedValue: value },
      outputs: { value },
      savedAs: savedAsVar(key) ?? savedAsStep(node.key),
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

  if (node.type === 'http' || node.type === 'email' || node.type === 'entity') {
    // Handled asynchronously by PreviewChat via runConnectionStep / runEntityStep
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
      messages: [...next.messages, msg('bot', text, { media })],
      currentId: null,
      loopStack: [],
      phase: { kind: 'finished' },
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
      answerType === 'password'
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
    processed: { rawAnswer: answer, coercedValue: value },
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
  if (!state.currentId) return state
  const node = nodes.find((n) => n.id === state.currentId)
  if (!node || (node.type !== 'http' && node.type !== 'email')) return state

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

  const { executeHttpConnection, sendEmailConnection, isFlowForgeApiConfigured } = await import(
    '@/shared/lib/flowforgeApi',
  )

  let next = { ...state }
  let runStatus: PreviewRunStatus = 'Succeeded'
  let inputs: Record<string, unknown> = {}
  let processed: Record<string, unknown> = {}
  let outputs: Record<string, unknown> = {}
  let savedAs: string | null = null

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

    inputs = {
      connectionId: connectionId || null,
      method: built.method,
      path: node.config.path ?? '',
      body: rawBody || undefined,
      paramValues: rawParams,
    }
    processed = {
      method: built.method,
      path: built.path,
      query: built.query,
      body: built.body,
      paramValues: interpolatedParams,
    }

    let result: Record<string, unknown>
    const canCallApi =
      isFlowForgeApiConfigured() && (!!connection || (useServerSecrets && !!connectionId))
    if (!canCallApi) {
      result = {
        ok: true,
        status: 200,
        path: built.path,
        data: { mock: true, reason: !connection && !useServerSecrets ? 'missing_connection' : 'api_not_configured' },
      }
      next = {
        ...next,
        messages: [
          ...next.messages,
          msg('system', `HTTP ${built.method} ${built.path || '/'} (mocked - configure API URL and connection)`),
        ],
      }
    } else {
      try {
        const apiResult = await executeHttpConnection({
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
        })

        let schemaErrors: string[] = []
        if (httpCfg) {
          schemaErrors = validateValueAgainstSchema(
            apiResult.data,
            httpCfg.expectedResponse.dataType,
            httpCfg.expectedResponse.schema,
            httpCfg.expectedResponse.itemSchema ?? [],
          )
        }

        result = {
          ok: apiResult.ok && schemaErrors.length === 0,
          status: apiResult.status,
          headers: apiResult.headers,
          data: apiResult.data,
          error: apiResult.error ?? null,
          schemaErrors: schemaErrors.length ? schemaErrors : undefined,
        }
        if (!result.ok) runStatus = 'Failed'
        next = {
          ...next,
          messages: [
            ...next.messages,
            msg(
              'system',
              `HTTP ${built.method} ${built.path || '/'} -> ${apiResult.status}${
                !apiResult.ok ? ' (failed)' : schemaErrors.length ? ' (schema mismatch)' : ''
              }`,
            ),
          ],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'HTTP request failed'
        const timedOut = isAbortOrTimeoutError(err)
        result = { ok: false, status: 0, data: null, error: message, timedOut }
        runStatus = timedOut ? 'TimedOut' : 'Failed'
        next = {
          ...next,
          messages: [
            ...next.messages,
            msg('system', timedOut ? `HTTP timed out after ${timeoutSeconds}s` : `HTTP error: ${message}`),
          ],
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
      next = {
        ...next,
        messages: [
          ...next.messages,
          msg('system', `Email to ${to || '(missing)'} - ${subject || '(no subject)'} (mocked)`),
        ],
      }
      result = { ...result, ok: true, mocked: true }
    } else {
      try {
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
          messages: [
            ...next.messages,
            msg(
              'system',
              apiResult.ok
                ? `Email sent to ${to}${result.schemaErrors ? ' (schema mismatch)' : ''}`
                : `Email failed: ${apiResult.error ?? 'unknown'}`,
            ),
          ],
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Email failed'
        const timedOut = isAbortOrTimeoutError(err)
        result = { ...result, ok: false, error: message, timedOut }
        runStatus = timedOut ? 'TimedOut' : 'Failed'
        next = {
          ...next,
          messages: [
            ...next.messages,
            msg('system', timedOut ? `Email timed out after ${timeoutSeconds}s` : `Email error: ${message}`),
          ],
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
      ...(runStatus === 'TimedOut' ? { timedOut: true } : {}),
    },
    outputs,
    savedAs,
  })

  return resolveAfterStep(next, edges, nodes, nextNodeId(edges, node.id))
}

export async function runEntityStep(
  state: PreviewEngineState,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): Promise<PreviewEngineState> {
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
  const fieldMap =
    node.config.fieldMap && typeof node.config.fieldMap === 'object' && !Array.isArray(node.config.fieldMap)
      ? (node.config.fieldMap as Record<string, string>)
      : {}

  let next = { ...state }
  let runStatus: PreviewRunStatus = 'Succeeded'
  let outputs: Record<string, unknown> = {}
  let processed: Record<string, unknown> = {}

  const { normalizeEntityQuery } = await import('@/features/entities/entityQuery')
  const querySpec = normalizeEntityQuery(node.config)

  const inputs = {
    operation,
    entityId,
    recordId: recordIdRaw || undefined,
    filters: querySpec.filters.length ? querySpec.filters : undefined,
    filterLogic: querySpec.filters.length ? querySpec.filterLogic : undefined,
    sortAttribute: querySpec.sortAttribute || undefined,
    sortDirection: querySpec.sortAttribute ? querySpec.sortDirection : undefined,
    limit: querySpec.limit || undefined,
    // legacy echo for older run logs
    filterAttribute: String(node.config.filterAttribute ?? '').trim() || undefined,
    filterEquals: String(node.config.filterEquals ?? '') || undefined,
    fieldMap: Object.keys(fieldMap).length ? fieldMap : undefined,
  }

  try {
    if (!entityId) throw new Error('Select an entity')

    const { supabase } = await import('@/shared/lib/supabase')
    const { data: entity, error: entityError } = await supabase
      .from('chatbot_entities')
      .select('*')
      .eq('id', entityId)
      .single()
    if (entityError || !entity) throw new Error(entityError?.message ?? 'Entity not found')

    const {
      createDynamicRecord,
      deleteDynamicRecord,
      listEntityRecords,
      toRecordPayload,
      updateDynamicRecord,
    } = await import('@/features/entities/entityApi')
    const { queryEntityRecords } = await import('@/features/entities/entityQuery')

    const recordId = recordIdRaw ? String(resolveValue(recordIdRaw, next.vars, next.stepOutputs, next.media, next.templates) ?? '') : ''

    const resolvedFilterValues = querySpec.filters.map((clause) =>
      clause.operator === 'exists'
        ? undefined
        : resolveValue(clause.value, next.vars, next.stepOutputs, next.media, next.templates),
    )
    const resolvedLimitRaw = querySpec.limit
      ? resolveValue(querySpec.limit, next.vars, next.stepOutputs, next.media, next.templates)
      : ''
    const resolvedQuery = {
      ...querySpec,
      limit: resolvedLimitRaw == null || resolvedLimitRaw === '' ? '' : String(resolvedLimitRaw),
    }

    const incomingFields: Record<string, unknown> = {}
    for (const [k, tmpl] of Object.entries(fieldMap)) {
      const resolved = resolveValue(String(tmpl ?? ''), next.vars, next.stepOutputs, next.media, next.templates)
      if (resolved === undefined || resolved === null || (typeof resolved === 'string' && resolved.trim() === '')) {
        continue
      }
      incomingFields[k] = resolved
    }

    let resolvedFields: Record<string, unknown> = incomingFields
    if (operation === 'create' || operation === 'update') {
      const { data: attrs, error: attrsError } = await supabase
        .from('entity_attributes')
        .select('*')
        .eq('entity_id', entityId)
        .order('sort_order')
      if (attrsError) throw new Error(attrsError.message)
      const { validateAndCoerceEntityValues } = await import('@/features/entities/entityValueValidation')
      resolvedFields = validateAndCoerceEntityValues(incomingFields, attrs ?? [], {
        partial: operation === 'update',
      })
    }

    processed = {
      entityKey: entity.key,
      entityKind: entity.kind,
      recordId: recordId || undefined,
      query: resolvedQuery,
      resolvedFilterValues,
      resolvedFields: Object.keys(resolvedFields).length ? resolvedFields : undefined,
    }

    if (entity.kind === 'static' && (operation === 'create' || operation === 'update' || operation === 'delete')) {
      throw new Error('Static entities are read-only in flows (use List/Get)')
    }

    if (operation === 'list' || operation === 'get') {
      let rows = await listEntityRecords(entity)
      rows = queryEntityRecords(rows, resolvedQuery, {
        resolveValue: (_clause, index) => resolvedFilterValues[index],
      })
      if (operation === 'get') {
        if (recordId) rows = rows.filter((r) => r.id === recordId)
        const one = rows[0] ?? null
        outputs = { record: one ? toRecordPayload(one) : null, found: !!one }
      } else {
        const list = rows.map(toRecordPayload)
        outputs = { records: list, count: list.length }
      }
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
      messages: [
        ...next.messages,
        msg(
          'system',
          `Entity ${entity.key}.${operation}${
            operation === 'list' ? ` → ${(outputs.count as number) ?? 0} rows` : ''
          }`,
        ),
      ],
    }
  } catch (err) {
    runStatus = 'Failed'
    const message = err instanceof Error ? err.message : 'Entity step failed'
    outputs = { ok: false, error: message }
    next = {
      ...next,
      messages: [...next.messages, msg('system', `Entity error: ${message}`)],
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
