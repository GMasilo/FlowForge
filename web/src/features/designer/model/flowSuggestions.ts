import type { FlowNodeType, QuestionAnswerType } from '@/shared/types/database'
import {
  QUESTION_ANSWER_TYPE_OPTIONS,
  getStepOutputVariable,
  readFormFields,
  slugFormFieldKey,
  type DesignerEdge,
  type DesignerNode,
} from '@/features/designer/model/flowSchema'
import { buildQuestionAnswerTypePatch } from '@/features/designer/model/questionAnswerTypePatch'

export type AnswerTypeSuggestion = {
  answerType: QuestionAnswerType
  label: string
  reason: string
  score: number
  /** Attribute overrides inferred from the prompt (output variable, choices, bounds, …). */
  attributes: Record<string, unknown>
}

export type NextStepSeed = {
  label?: string
  config?: Record<string, unknown>
}

export type NextStepSuggestion = {
  type: FlowNodeType
  label: string
  reason: string
  score: number
  seed?: NextStepSeed
}

const TYPE_LABEL = new Map(QUESTION_ANSWER_TYPE_OPTIONS.map((o) => [o.value, o.label]))

function typeLabel(answerType: QuestionAnswerType): string {
  return TYPE_LABEL.get(answerType) ?? answerType
}

function stripTemplates(raw: string): string {
  return raw.replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizePrompt(raw: string): string {
  return stripTemplates(raw).toLowerCase()
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return !value.trim()
  if (Array.isArray(value)) return value.length === 0
  return false
}

function uniqueVariable(base: string, taken: Iterable<string>): string {
  const slug = slugFormFieldKey(base)
  const used = new Set(
    [...taken]
      .map((k) => k.trim())
      .filter(Boolean),
  )
  if (!used.has(slug)) return slug
  let i = 2
  while (used.has(`${slug}_${i}`)) i += 1
  return `${slug}_${i}`
}

function takenVariables(nodes: DesignerNode[], exceptNodeId?: string): Set<string> {
  const taken = new Set<string>()
  for (const n of nodes) {
    if (n.id === exceptNodeId) continue
    const key = getStepOutputVariable(n)
    if (key) taken.add(key)
    if (n.type === 'question' && String(n.config.answerType ?? '') === 'form') {
      for (const field of readFormFields(n.config)) taken.add(field.key)
    }
  }
  return taken
}

function questionAnswerType(node: DesignerNode | null | undefined): string {
  if (!node || node.type !== 'question') return ''
  return String(node.config.answerType ?? '')
}

function varRef(node: DesignerNode): string {
  const key = getStepOutputVariable(node)
  if (key) return `{{vars.${key}}}`
  if (node.type === 'question') return `{{steps.${node.key}.response}}`
  return `{{steps.${node.key}}}`
}

function findQuestionByType(nodes: DesignerNode[], answerType: string): DesignerNode | undefined {
  return nodes.find((n) => n.type === 'question' && String(n.config.answerType ?? '') === answerType)
}

function extractEmailDomains(text: string): string[] {
  const found: string[] = []
  const re = /@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const domain = m[1]!.toLowerCase()
    if (!found.includes(domain)) found.push(domain)
  }
  return found
}

function extractRange(text: string): { min: number; max: number } | null {
  const between = text.match(/\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)/i)
  if (between) {
    const min = Number(between[1])
    const max = Number(between[2])
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) return { min, max }
  }
  const fromTo = text.match(/\b(?:from\s+)?(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\b/i)
  if (fromTo) {
    const min = Number(fromTo[1])
    const max = Number(fromTo[2])
    if (Number.isFinite(min) && Number.isFinite(max) && max > min && max - min <= 1000) return { min, max }
  }
  return null
}

function splitOptionChunk(chunk: string): string[] {
  return chunk
    .split(/\s*(?:,|\bor\b|\/|;|\||\n)\s*/i)
    .map((s) =>
      s
        .replace(/^[-•*\d.)\s]+/, '')
        .replace(/[?.!:]+$/g, '')
        .replace(/^["'`“”]+|["'`“”]+$/g, '')
        .trim(),
    )
    .filter((s) => s.length >= 1 && s.length <= 48)
}

const YES_NO = /^(yes|no|yeah|nope|y|n)$/i

function extractChoices(raw: string): string[] | null {
  const text = stripTemplates(raw)
  if (!text) return null

  const numbered: string[] = []
  const numRe = /(?:^|\n)\s*(?:\d+[.)]|[-•*])\s+([^\n]+)/g
  let m: RegExpExecArray | null
  while ((m = numRe.exec(text)) !== null) {
    const item = m[1]!.replace(/[?.!]+$/g, '').trim()
    if (item && item.length <= 48) numbered.push(item)
  }
  if (numbered.length >= 2) return numbered

  const labeled = text.match(
    /(?:choose|pick|select|options?|one of)(?:\s+\w+){0,4}\s*[:-]\s*([^.?!]+)/i,
  )
  if (labeled) {
    const opts = splitOptionChunk(labeled[1]!)
    if (opts.length >= 2) return opts
  }

  const orList = text.match(
    /((?:[A-Za-z0-9][\w '&/+.-]{0,30},\s*){1,12}or\s+[A-Za-z0-9][\w '&/+.-]{0,30})/i,
  )
  if (orList) {
    const opts = splitOptionChunk(orList[1]!)
    if (opts.length >= 2) return opts
  }

  const slash = text.match(
    /((?:[A-Za-z0-9][\w '&+-]{0,24}\s*\/\s*){1,8}[A-Za-z0-9][\w '&+-]{0,24})/,
  )
  if (slash) {
    const opts = splitOptionChunk(slash[1]!)
    if (opts.length >= 2 && opts.every((o) => o.split(/\s+/).length <= 4)) return opts
  }

  return null
}

function looksYesNo(choices: string[]): boolean {
  return choices.length === 2 && choices.every((c) => YES_NO.test(c))
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'your', 'you', 'please', 'what', 'whats', "what's", 'which',
  'who', 'when', 'where', 'why', 'how', 'is', 'are', 'do', 'does', 'did', 'can',
  'could', 'would', 'will', 'to', 'of', 'for', 'in', 'on', 'at', 'and', 'or',
  'me', 'us', 'we', 'this', 'that', 'these', 'those', 'enter', 'type', 'tell',
  'give', 'share', 'provide', 'with', 'from', 'into',
])

function inferVariableName(raw: string, answerType: QuestionAnswerType): string {
  const byType: Partial<Record<QuestionAnswerType, string>> = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    otp: 'otp',
    url: 'url',
    address: 'address',
    postal_code: 'postal_code',
    country: 'country',
    date: 'date',
    time: 'time',
    datetime: 'datetime',
    gender: 'gender',
    boolean: 'confirmed',
    confirm: 'agreed',
    rating: 'rating',
    stars: 'stars',
    nps: 'nps',
    likert: 'agreement',
    mood: 'mood',
    thumbs: 'thumbs',
    percentage: 'percentage',
    currency: 'amount',
    slider: 'value',
    stepper: 'count',
    number: 'number',
    color: 'color',
    file: 'file',
    signature: 'signature',
    location: 'location',
    national_id: 'national_id',
    password: 'password',
    audio: 'voice_note',
    payment: 'payment',
    captcha: 'captcha',
    form: 'details',
    shop: 'cart',
    appointment: 'appointment',
    ranking: 'ranking',
    matrix: 'ratings',
    image_choice: 'choice',
    choice: 'choice',
    autocomplete: 'selection',
  }

  const typed = byType[answerType]
  const generic = answerType === 'text' || answerType === 'long_text' || answerType === 'choice' || answerType === 'autocomplete'

  const text = normalizePrompt(raw)
  const your = text.match(/\byour\s+([a-z][a-z0-9]+(?:\s+[a-z][a-z0-9]+)?)/)
  if (your) {
    const slug = slugFormFieldKey(your[1]!)
    if (slug && !STOP_WORDS.has(slug) && slug.length >= 2) {
      if (generic) return slug
      if (typed && slug !== typed && !slug.endsWith(`_${typed}`) && !slug.startsWith(`${typed}_`) && slug !== `${typed}_address` && slug !== `${typed}_number`) {
        if (slug.includes(typed)) return slug
      }
    }
  }

  const named = text.match(
    /\b(?:as|into|store(?:d)? as|save(?:d)? as|variable)\s+[`'"]?([a-z][a-z0-9_]{1,40})[`'"]?/i,
  )
  if (named) return slugFormFieldKey(named[1]!)

  if (typed) return typed
  return slugFormFieldKey(
    text
      .split(/\s+/)
      .filter((w) => !STOP_WORDS.has(w))
      .slice(0, 3)
      .join('_') || 'answer',
  )
}

type RuleHit = {
  answerType: QuestionAnswerType
  score: number
  reason: string
  attributes?: Record<string, unknown>
}

function ruleHits(raw: string): RuleHit[] {
  const text = normalizePrompt(raw)
  if (text.length < 2) return []
  const hits: RuleHit[] = []
  const choices = extractChoices(raw)
  const range = extractRange(text)
  const domains = extractEmailDomains(raw)

  const add = (
    answerType: QuestionAnswerType,
    score: number,
    reason: string,
    attributes?: Record<string, unknown>,
  ) => {
    hits.push({ answerType, score, reason, attributes })
  }

  if (/\b(e-?mail\s+address|e-?mail|mail address)\b/.test(text) || /\bwhat(?:'s| is) your e-?mail\b/.test(text)) {
    add('email', 0.96, 'Prompt asks for an email address', domains.length ? { allowedEmailDomains: domains } : undefined)
  }
  if (/\b(phone|mobile|cell\s*phone|whatsapp|contact number|telephone)\b/.test(text)) {
    add('phone', 0.94, 'Prompt asks for a phone number')
  }
  if (/\b(full name|first name|last name|surname|your name)\b/.test(text) || /\bwhat(?:'s| is) your name\b/.test(text)) {
    add('name', 0.95, 'Prompt asks for a name')
  }
  if (/\b(otp|one[ -]?time(?:\s+pass(?:word|code))?|verification code|pin code|6[ -]?digit|verify (?:your )?e-?mail)\b/.test(text)) {
    add('otp', 0.93, 'Prompt asks for a verification code')
  }
  if (/\b(website|web address|homepage|url|web site)\b/.test(text) && !/\bemail\b/.test(text)) {
    add('url', 0.88, 'Prompt asks for a web address')
  }
  if (/\b(street address|mailing address|home address|postal address|your address|where do you live)\b/.test(text)) {
    add('address', 0.9, 'Prompt asks for an address')
  }
  if (/\b(postal code|postcode|zip code|zipcode)\b/.test(text)) {
    add('postal_code', 0.94, 'Prompt asks for a postal / ZIP code')
  }
  if (/\b(which country|your country|country of (?:birth|residence)|nationality)\b/.test(text)) {
    add('country', 0.9, 'Prompt asks for a country')
  }
  if (/\b(date of birth|birthday|d\.?o\.?b\.?|birth date)\b/.test(text)) {
    add('date', 0.94, 'Prompt asks for a date of birth', { outputVariable: 'date_of_birth' })
  } else if (/\b(what date|which date|start date|end date|on what day)\b/.test(text) && !/\btime\b/.test(text)) {
    add('date', 0.86, 'Prompt asks for a date')
  }
  if (/\b(what time|preferred time|at what time|time of day)\b/.test(text) && !/\bdate\b/.test(text)) {
    add('time', 0.86, 'Prompt asks for a time of day')
  }
  if (/\b(date and time|date & time|when should we|date\/time)\b/.test(text)) {
    add('datetime', 0.9, 'Prompt asks for a date and time')
  }
  if (/\b(book|schedule|appointment|pick a slot|reserve a)\b/.test(text) && /\b(date|time|day|slot)\b/.test(text)) {
    add('appointment', 0.92, 'Prompt looks like booking a slot')
  }
  if (/\b(gender|male or female|man or woman)\b/.test(text)) {
    add('gender', 0.94, 'Prompt asks for gender')
  }
  if (/\b(i agree|terms and conditions|privacy policy|accept the (?:terms|policy)|consent to|by continuing you agree)\b/.test(text)) {
    const quoted = raw.match(/["“']([^"”']{4,80})["”']/)
    add('confirm', 0.94, 'Prompt is an agreement / consent', quoted ? { confirmLabel: quoted[1]!.trim() } : undefined)
  }
  if (/\b(yes or no|yes\/no|y\/n)\b/.test(text) || /^(do you|would you|are you|have you|is this|can you|shall we|want to|should we)\b/.test(text)) {
    add('boolean', 0.8, 'Prompt reads as a yes / no question')
  }
  if (/\b(how many stars|star rating|stars out of)\b/.test(text) || /\bstars?\b/.test(text) && /\b(rate|rating)\b/.test(text)) {
    add('stars', 0.92, 'Prompt asks for a star rating', range ? { min: range.min, max: range.max } : undefined)
  }
  if (/\b(nps|net promoter|how likely.{0,40}recommend)\b/.test(text)) {
    add('nps', 0.95, 'Prompt matches a Net Promoter Score')
  }
  if (/\b(how satisfied|satisfaction|agree or disagree|strongly (?:dis)?agree)\b/.test(text)) {
    add('likert', 0.9, 'Prompt matches an agreement / satisfaction scale')
  }
  if (/\b(how (?:are|do) you feel|your mood|feeling today)\b/.test(text)) {
    add('mood', 0.88, 'Prompt asks for mood / sentiment')
  }
  if (/\b(thumbs up|thumbs down|thumb)\b/.test(text)) {
    add('thumbs', 0.92, 'Prompt asks for thumbs up / down')
  }
  if (/\b(rate|rating|how would you rate|score (?:us|this|it))\b/.test(text) && !/\bstars?\b/.test(text) && !/\bnps\b/.test(text)) {
    add('rating', 0.86, 'Prompt asks for a numeric rating', range ? { min: range.min, max: range.max } : undefined)
  }
  if (/\bpercent(?:age)?\b/.test(text) || /\b0\s*(?:-|to)\s*100\s*%/.test(text)) {
    add('percentage', 0.9, 'Prompt asks for a percentage')
  }
  if (/\b(price|amount|cost|budget|fee|how much (?:does|is|should|would))\b/.test(text) && !/\bpay(?:ment| now)?\b/.test(text)) {
    add('currency', 0.84, 'Prompt asks for a money amount')
  }
  if (/\b(slider|drag (?:the|a) (?:slider|value))\b/.test(text)) {
    add('slider', 0.9, 'Prompt mentions a slider', range ? { min: range.min, max: range.max } : undefined)
  }
  if (/\b(stepper|\+ \/ −|\+\/−)\b/.test(text)) {
    add('stepper', 0.86, 'Prompt mentions a stepper')
  }
  if (/\b(how many|how much|quantity|count|number of)\b/.test(text) && !/\bstars?\b/.test(text)) {
    add('number', 0.78, 'Prompt asks for a number', range ? { min: range.min, max: range.max } : undefined)
  }
  if (/\b(colour|color|hex(?:\s*code)?|pick a colo(?:u)?r)\b/.test(text)) {
    add('color', 0.9, 'Prompt asks for a color')
  }
  if (/\b(location|gps|share your (?:location|position)|where are you(?: now)?)\b/.test(text)) {
    add('location', 0.9, 'Prompt asks to share a location')
  }
  if (/\b(id number|national id|sa id|south african id|identity number|passport number)\b/.test(text)) {
    add('national_id', 0.93, 'Prompt asks for a national ID', /\b(sa|south african|za)\b/.test(text) ? { idFormat: 'za' } : undefined)
  }
  if (/\b(password|passcode|secret(?:\s+word)?)\b/.test(text) && !/\bone[ -]?time\b/.test(text)) {
    add('password', 0.9, 'Prompt asks for a password')
  }
  if (/\b(voice note|record (?:a |your )?voice|audio (?:message|reply)|speak your)\b/.test(text)) {
    add('audio', 0.9, 'Prompt asks for a voice note')
  }
  if (/\b(pay now|make a payment|pay for|checkout|payfast|pay with)\b/.test(text)) {
    add('payment', 0.93, 'Prompt asks the visitor to pay')
  }
  if (/\b(captcha|prove you(?:'re| are) human|not a robot)\b/.test(text)) {
    add('captcha', 0.94, 'Prompt is a human check')
  }
  if (/\b(browse (?:the )?(?:store|shop|catalog)|add to cart|shop now|our products)\b/.test(text)) {
    add('shop', 0.94, 'Prompt looks like a store / cart step', { outputVariable: 'cart' })
  }
  if (/\b(fill in (?:this |the )?form|registration form|your details|contact details)\b/.test(text)) {
    add('form', 0.82, 'Prompt asks for several details at once')
  }
  if (/\b(sign(?:ature)? here|draw your signature|please sign|e-?sign)\b/.test(text)) {
    add('signature', 0.94, 'Prompt asks for a signature')
  }
  if (/\b(upload|attach (?:a |your )?(?:file|document|cv|resume|photo|image|pdf))\b/.test(text)) {
    const fileAccept = /\b(photo|image|picture|png|jpe?g)\b/.test(text)
      ? 'image'
      : /\bpdf\b/.test(text)
        ? 'pdf'
        : /\b(cv|resume|document|docx?)\b/.test(text)
          ? 'document'
          : 'any'
    add('file', 0.9, 'Prompt asks to upload a file', { fileAccept })
  }
  if (/\b(which (?:photo|image|picture)|pick (?:an? )?(?:image|photo|picture)|choose (?:an? )?image)\b/.test(text)) {
    add('image_choice', 0.9, 'Prompt asks to pick from pictures')
  }
  if (/\b(rank|order these|put these in order|priority|most (?:to least|important))\b/.test(text)) {
    add('ranking', 0.88, 'Prompt asks to rank items', choices && !looksYesNo(choices) ? { choices } : undefined)
  }
  if (/\b(rate each|for each of the following|on the same scale)\b/.test(text)) {
    add('matrix', 0.88, 'Prompt looks like a matrix / grid rating')
  }
  if (/\b(search (?:for|and (?:select|pick))|type to search|start typing)\b/.test(text)) {
    add('autocomplete', 0.84, 'Prompt looks like a searchable list', choices ? { choices } : undefined)
  }
  if (/\b(describe|tell us (?:more )?about|comments?|feedback|anything else|in your own words)\b/.test(text)) {
    add('long_text', 0.8, 'Prompt asks for a longer written answer')
  }

  if (choices && choices.length >= 2) {
    if (looksYesNo(choices)) {
      add('boolean', 0.92, 'Options are Yes / No')
    } else {
      add('choice', Math.min(0.97, 0.78 + choices.length * 0.04), 'Prompt lists options to pick from', { choices })
    }
  }

  return hits
}

function resolveConflicts(hits: RuleHit[]): RuleHit[] {
  const byType = new Map<QuestionAnswerType, RuleHit>()
  for (const hit of hits) {
    const prev = byType.get(hit.answerType)
    if (!prev || hit.score > prev.score) byType.set(hit.answerType, hit)
  }
  const list = [...byType.values()]

  const has = (t: QuestionAnswerType) => list.some((h) => h.answerType === t)
  const bump = (winner: QuestionAnswerType, losers: QuestionAnswerType[], extra = 0.04) => {
    const w = byType.get(winner)
    if (!w) return
    w.score = Math.min(0.99, w.score + extra)
    for (const l of losers) {
      const h = byType.get(l)
      if (h) h.score *= 0.55
    }
  }

  if (has('confirm')) bump('confirm', ['boolean'])
  if (has('choice')) bump('choice', ['boolean', 'text', 'long_text'])
  if (has('otp')) bump('otp', ['number', 'password'])
  if (has('stars')) bump('stars', ['rating', 'number'])
  if (has('nps')) bump('nps', ['rating', 'number', 'stars'])
  if (has('appointment')) bump('appointment', ['date', 'time', 'datetime'])
  if (has('datetime')) bump('datetime', ['date', 'time'])
  if (has('payment')) bump('payment', ['currency', 'number'])
  if (has('shop')) bump('shop', ['payment'])
  if (has('signature')) bump('signature', ['file'])
  if (has('image_choice')) bump('image_choice', ['choice', 'file'])
  if (has('email')) bump('email', ['text', 'url'])
  if (has('name')) bump('name', ['text'])
  if (has('national_id')) bump('national_id', ['number', 'text'])

  return [...byType.values()].filter((h) => h.score >= 0.45).sort((a, b) => b.score - a.score)
}

export function suggestAnswerTypes(args: {
  prompt: string
  nodes?: DesignerNode[]
  currentNodeId?: string
  currentConfig?: Record<string, unknown>
  limit?: number
}): AnswerTypeSuggestion[] {
  const { prompt, nodes = [], currentNodeId, currentConfig, limit = 3 } = args
  const hits = resolveConflicts(ruleHits(prompt))
  if (!hits.length) return []

  const taken = takenVariables(nodes, currentNodeId)
  const currentVar = String(currentConfig?.outputVariable ?? '').trim()

  return hits.slice(0, limit).map((hit) => {
    const attributes: Record<string, unknown> = { ...(hit.attributes ?? {}) }
    if (isEmptyValue(currentVar) && isEmptyValue(attributes.outputVariable)) {
      attributes.outputVariable = uniqueVariable(inferVariableName(prompt, hit.answerType), taken)
    } else if (isEmptyValue(attributes.outputVariable) && currentVar) {
      // keep existing
    } else if (typeof attributes.outputVariable === 'string') {
      attributes.outputVariable = uniqueVariable(String(attributes.outputVariable), taken)
    }
    const existingChoices = Array.isArray(currentConfig?.choices)
      ? (currentConfig!.choices as unknown[]).map(String).filter(Boolean)
      : []
    if (existingChoices.length && attributes.choices) delete attributes.choices

    return {
      answerType: hit.answerType,
      label: typeLabel(hit.answerType),
      reason: hit.reason,
      score: hit.score,
      attributes,
    }
  })
}

/** Patch to apply a suggestion onto the current question config (merge with patchConfig). */
export function applyAnswerTypeSuggestion(
  config: Record<string, unknown>,
  suggestion: AnswerTypeSuggestion,
): Record<string, unknown> {
  const typePatch = buildQuestionAnswerTypePatch(config, suggestion.answerType)
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(suggestion.attributes)) {
    if (value == null) continue
    if (key === 'outputVariable' && !isEmptyValue(config.outputVariable)) continue
    if (key === 'choices') {
      const existing = Array.isArray(config.choices) ? (config.choices as unknown[]).filter(Boolean) : []
      if (existing.length) continue
    }
    extra[key] = value
  }
  return { ...typePatch, ...extra }
}

export function shouldAutoApplyAnswerType(args: {
  currentAnswerType: string
  suggestion: AnswerTypeSuggestion | undefined
}): boolean {
  const { currentAnswerType, suggestion } = args
  if (!suggestion) return false
  if (currentAnswerType !== 'text') return false
  return suggestion.score >= 0.88
}

function walkAncestors(
  fromId: string | null | undefined,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  limit = 16,
): DesignerNode[] {
  if (!fromId) return []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, string[]>()
  for (const e of edges) {
    const list = incoming.get(e.target) ?? []
    list.push(e.source)
    incoming.set(e.target, list)
  }
  const out: DesignerNode[] = []
  const seen = new Set<string>()
  let cur: string | null = fromId
  while (cur && !seen.has(cur) && out.length < limit) {
    seen.add(cur)
    const n = byId.get(cur)
    if (n) out.push(n)
    const preds: string[] = incoming.get(cur) ?? []
    cur = preds[0] ?? null
  }
  return out
}

function immediateNextIds(fromId: string | null | undefined, edges: DesignerEdge[]): string[] {
  if (!fromId) return []
  return [...new Set(edges.filter((e) => e.source === fromId).map((e) => e.target))]
}

const PROFILE_STEPS: Array<{
  answerType: QuestionAnswerType
  prompt: string
  variable: string
  label: string
  reason: string
}> = [
  {
    answerType: 'name',
    prompt: 'What is your name?',
    variable: 'name',
    label: 'Ask name',
    reason: 'Start by collecting a name',
  },
  {
    answerType: 'email',
    prompt: 'What is your email address?',
    variable: 'email',
    label: 'Ask email',
    reason: 'Collect an email after the name',
  },
  {
    answerType: 'phone',
    prompt: 'What is your phone number?',
    variable: 'phone',
    label: 'Ask phone',
    reason: 'Collect a phone number next',
  },
]

function askedTypes(nodes: DesignerNode[]): Set<string> {
  const set = new Set<string>()
  for (const n of nodes) {
    if (n.type !== 'question') continue
    const t = String(n.config.answerType ?? '')
    if (t) set.add(t)
    if (t === 'form') {
      for (const field of readFormFields(n.config)) set.add(field.type)
    }
  }
  return set
}

function looksLikeClosingMessage(node: DesignerNode | null): boolean {
  if (!node || node.type !== 'message') return false
  const text = normalizePrompt(String(node.config.text ?? ''))
  return /\b(thank you|thanks|goodbye|bye|all done|you're all set|you are all set|see you)\b/.test(text)
}

function looksLikeGreeting(node: DesignerNode | null): boolean {
  if (!node || node.type !== 'message') return false
  const text = normalizePrompt(String(node.config.text ?? ''))
  return /\b(welcome|hello|hi\b|hey|good (?:morning|afternoon|evening)|let(?:'s| us) (?:get )?start)\b/.test(text) || text.length > 0
}

function httpLooksLikeCollection(node: DesignerNode): boolean {
  if (node.type !== 'http') return false
  const method = String(node.config.method ?? 'GET').toUpperCase()
  const url = String(node.config.url ?? node.config.path ?? '').toLowerCase()
  return method === 'GET' && /\b(list|search|items|products|records|results|users)\b/.test(url)
}

function flowTails(nodes: DesignerNode[], edges: DesignerEdge[]): DesignerNode[] {
  const hasOut = new Set(edges.map((e) => e.source))
  const tails = nodes.filter((n) => !hasOut.has(n.id) && n.type !== 'end')
  return tails.length ? tails : nodes.filter((n) => n.type !== 'end')
}

export function suggestNextSteps(args: {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  afterNodeId?: string | null
  limit?: number
}): NextStepSuggestion[] {
  const { nodes, edges, afterNodeId = null, limit = 3 } = args
  const resolvedAfter = afterNodeId ?? flowTails(nodes, edges)[0]?.id ?? null
  const ancestors = walkAncestors(resolvedAfter, nodes, edges)
  const previous = ancestors[0] ?? null
  const asked = askedTypes(nodes)
  const taken = takenVariables(nodes)
  const nextIds = new Set(immediateNextIds(resolvedAfter, edges))
  const nextTypes = new Set(
    nodes.filter((n) => nextIds.has(n.id)).map((n) => n.type),
  )
  const hasEnd = nodes.some((n) => n.type === 'end')
  const hasPersist = nodes.some((n) => n.type === 'http' || n.type === 'entity' || n.type === 'email')
  const questionCount = nodes.filter((n) => n.type === 'question').length
  const emptyFlow = nodes.length === 0

  const nextNodes = nodes.filter((n) => nextIds.has(n.id))
  const scored: NextStepSuggestion[] = []

  const push = (s: NextStepSuggestion) => {
    const alreadyNext = nextNodes.some((n) => {
      if (n.type !== s.type) return false
      if (s.type === 'question' && s.seed?.config?.answerType) {
        return String(n.config.answerType ?? '') === String(s.seed.config.answerType)
      }
      return true
    })
    if (alreadyNext) return
    if (s.type === 'end' && (nextTypes.has('end') || (hasEnd && previous?.type === 'end'))) return
    scored.push(s)
  }

  if (emptyFlow || !previous) {
    if (emptyFlow || nodes.length === 0) {
      push({
        type: 'message',
        label: 'Welcome message',
        reason: 'Start with a greeting',
        score: 0.96,
        seed: { label: 'Welcome', config: { text: 'Hi! I can help you get started.' } },
      })
      push({
        type: 'question',
        label: 'Ask name',
        reason: 'Or jump straight into a question',
        score: 0.7,
        seed: {
          label: 'Ask name',
          config: { prompt: 'What is your name?', answerType: 'name', outputVariable: uniqueVariable('name', taken) },
        },
      })
    } else if (!questionCount && nodes.every((n) => n.type === 'message' || n.type === 'end')) {
      push({
        type: 'question',
        label: 'Ask name',
        reason: 'Collect the first answer',
        score: 0.88,
        seed: {
          label: 'Ask name',
          config: { prompt: 'What is your name?', answerType: 'name', outputVariable: uniqueVariable('name', taken) },
        },
      })
    }
  }

  if (previous?.type === 'message' && questionCount === 0 && looksLikeGreeting(previous)) {
    const nextProfile = PROFILE_STEPS.find((p) => !asked.has(p.answerType))
    if (nextProfile) {
      push({
        type: 'question',
        label: nextProfile.label,
        reason: nextProfile.reason,
        score: 0.9,
        seed: {
          label: nextProfile.label,
          config: {
            prompt: nextProfile.prompt,
            answerType: nextProfile.answerType,
            outputVariable: uniqueVariable(nextProfile.variable, taken),
          },
        },
      })
    }
  }

  if (previous?.type === 'question') {
    const prevType = questionAnswerType(previous)
    const nextProfile = PROFILE_STEPS.find((p) => !asked.has(p.answerType))
    if (nextProfile && (prevType === 'name' || prevType === 'email' || prevType === 'phone' || prevType === 'text')) {
      const boost = prevType === 'name' && nextProfile.answerType === 'email' ? 0.92 : 0.78
      push({
        type: 'question',
        label: nextProfile.label,
        reason: nextProfile.reason,
        score: boost,
        seed: {
          label: nextProfile.label,
          config: {
            prompt: nextProfile.prompt,
            answerType: nextProfile.answerType,
            outputVariable: uniqueVariable(nextProfile.variable, taken),
          },
        },
      })
    }

    if (prevType === 'email' && !asked.has('otp')) {
      const emailRef = varRef(previous)
      push({
        type: 'question',
        label: 'Verify with OTP',
        reason: 'Confirm the email with a one-time code',
        score: 0.72,
        seed: {
          label: 'Verify email',
          config: {
            prompt: `Enter the code we sent to ${emailRef}`,
            answerType: 'otp',
            outputVariable: uniqueVariable('otp', taken),
            otpTo: emailRef,
          },
        },
      })
    }

    if (prevType === 'otp') {
      push({
        type: 'message',
        label: 'Verified',
        reason: 'Confirm that the code was accepted',
        score: 0.74,
        seed: { label: 'Verified', config: { text: 'Thanks — your email is verified.' } },
      })
    }

    if (prevType === 'boolean' || prevType === 'thumbs' || prevType === 'confirm') {
      const right = prevType === 'confirm' ? 'true' : prevType === 'thumbs' ? 'up' : 'true'
      push({
        type: 'condition',
        label: 'Branch on answer',
        reason: 'Yes / no answers usually need a Yes and No path',
        score: 0.94,
        seed: {
          label: 'If yes',
          config: { left: varRef(previous), operator: 'eq', right },
        },
      })
    }

    if (prevType === 'choice' || prevType === 'gender' || prevType === 'image_choice') {
      const choices = Array.isArray(previous.config.choices)
        ? (previous.config.choices as unknown[]).map(String).filter(Boolean)
        : []
      push({
        type: 'condition',
        label: 'Branch on choice',
        reason: 'Route the conversation from the selected option',
        score: choices.length >= 2 ? 0.86 : 0.7,
        seed: {
          label: 'If choice',
          config: {
            left: varRef(previous),
            operator: 'eq',
            right: choices[0] ?? '',
          },
        },
      })
    }

    if (prevType === 'shop') {
      const cartVar = getStepOutputVariable(previous) || 'cart'
      const emailQ = findQuestionByType(nodes, 'email')
      const nameQ = findQuestionByType(nodes, 'name')
      push({
        type: 'question',
        label: 'Take payment',
        reason: 'A shop cart is usually followed by checkout',
        score: 0.94,
        seed: {
          label: 'Payment',
          config: {
            prompt: 'Pay for your order to continue.',
            answerType: 'payment',
            outputVariable: uniqueVariable('payment', taken),
            paymentAmount: `{{vars.${cartVar}.total}}`,
            paymentItemName: 'Order',
            ...(emailQ ? { paymentBuyerEmail: varRef(emailQ) } : {}),
            ...(nameQ ? { paymentBuyerName: varRef(nameQ) } : {}),
          },
        },
      })
    }

    if (prevType === 'payment') {
      const emailQ = findQuestionByType(nodes, 'email')
      const shopQ = findQuestionByType(nodes, 'shop')
      const cartVar = (shopQ && getStepOutputVariable(shopQ)) || 'cart'
      const payRef = `{{steps.${previous.key}.response.reference}}`
      const receiptBody = [
        '{{templates.receipt.text}}',
        shopQ ? `Items {{vars.${cartVar}.itemCount}} · Total {{vars.${cartVar}.total}}` : '',
        `Reference ${payRef}`,
      ]
        .filter(Boolean)
        .join('\n')
      if (emailQ) {
        push({
          type: 'email',
          label: 'Send receipt',
          reason: 'Email a confirmation after payment',
          score: 0.8,
          seed: {
            label: 'Receipt',
            config: {
              to: varRef(emailQ),
              subject: 'Your receipt',
              body: receiptBody.replace('{{templates.receipt.text}}', '{{templates.receipt.html}}'),
            },
          },
        })
      }
      push({
        type: 'message',
        label: 'Thank you',
        reason: 'Acknowledge a successful payment',
        score: 0.76,
        seed: {
          label: 'Thanks',
          config: { text: receiptBody },
        },
      })
    }

    if (prevType === 'form') {
      push({
        type: 'entity',
        label: 'Save record',
        reason: 'Persist the form fields on an entity',
        score: 0.78,
      })
      push({
        type: 'http',
        label: 'Submit to API',
        reason: 'Send the form payload to a connection',
        score: 0.64,
      })
    }

    if (prevType === 'file' || prevType === 'signature' || prevType === 'audio') {
      push({
        type: 'http',
        label: 'Send upload',
        reason: 'Forward the file to a backend',
        score: 0.6,
      })
    }

    if (prevType === 'nps' || prevType === 'rating' || prevType === 'stars' || prevType === 'likert' || prevType === 'mood') {
      push({
        type: 'condition',
        label: 'Branch on score',
        reason: 'Handle promoters and detractors differently',
        score: 0.7,
        seed: {
          label: 'If score',
          config: { left: varRef(previous), operator: 'gte', right: prevType === 'nps' ? '9' : '4' },
        },
      })
      push({
        type: 'message',
        label: 'Thanks for the feedback',
        reason: 'Close the survey politely',
        score: 0.62,
        seed: { label: 'Thanks', config: { text: 'Thanks for the feedback!' } },
      })
    }

    if (prevType === 'appointment') {
      const emailQ = findQuestionByType(nodes, 'email')
      push({
        type: 'email',
        label: 'Send booking email',
        reason: 'Confirm the appointment',
        score: emailQ ? 0.8 : 0.55,
        seed: emailQ
          ? { label: 'Booking email', config: { to: varRef(emailQ), subject: 'Your appointment', body: `Booked for ${varRef(previous)}.` } }
          : undefined,
      })
    }

    if (prevType === 'captcha') {
      push({
        type: 'question',
        label: 'Continue',
        reason: 'Ask the real question after the human check',
        score: 0.7,
      })
    }
  }

  if (previous?.type === 'http') {
    push({
      type: 'condition',
      label: 'If request succeeded',
      reason: 'Branch on the HTTP result',
      score: 0.88,
      seed: {
        label: 'If HTTP ok',
        config: { left: varRef(previous), operator: 'exists' },
      },
    })
    if (httpLooksLikeCollection(previous)) {
      push({
        type: 'loop',
        label: 'For each item',
        reason: 'The request looks like it returns a list',
        score: 0.72,
        seed: {
          label: 'For each',
          config: { collection: varRef(previous), itemVariable: 'item', indexVariable: 'index' },
        },
      })
    }
    push({
      type: 'message',
      label: 'Show result',
      reason: 'Tell the visitor what came back',
      score: 0.58,
      seed: { label: 'Result', config: { text: `Here is what we found: ${varRef(previous)}` } },
    })
  }

  if (previous?.type === 'email') {
    push({
      type: 'message',
      label: 'Email sent',
      reason: 'Let the visitor know the message went out',
      score: 0.74,
      seed: { label: 'Sent', config: { text: 'I have sent that email.' } },
    })
  }

  if (previous?.type === 'entity') {
    const op = String(previous.config.operation ?? 'list')
    if (op === 'list') {
      push({
        type: 'loop',
        label: 'For each record',
        reason: 'Walk the entity list',
        score: 0.8,
        seed: {
          label: 'For each',
          config: { collection: varRef(previous), itemVariable: 'item', indexVariable: 'index' },
        },
      })
    } else {
      push({
        type: 'message',
        label: 'Saved',
        reason: 'Confirm the entity change',
        score: 0.68,
        seed: { label: 'Saved', config: { text: 'Saved.' } },
      })
    }
  }

  if (previous?.type === 'loop') {
    push({
      type: 'message',
      label: 'After the loop',
      reason: 'Summarise once every item has run',
      score: 0.66,
      seed: { label: 'Done', config: { text: 'That is everything on the list.' } },
    })
  }

  if (previous?.type === 'condition') {
    push({
      type: 'message',
      label: 'Continue',
      reason: 'A shared step after both branches',
      score: 0.55,
    })
  }

  if (questionCount >= 3 && !hasPersist && previous?.type === 'question') {
    push({
      type: 'entity',
      label: 'Save answers',
      reason: 'Several answers are ready to store',
      score: 0.6,
    })
    push({
      type: 'http',
      label: 'Send answers',
      reason: 'Post the collected answers to an API',
      score: 0.52,
    })
  }

  if (looksLikeClosingMessage(previous) && !hasEnd) {
    push({
      type: 'end',
      label: 'End conversation',
      reason: 'The last message reads like a closing',
      score: 0.9,
      seed: { label: 'End' },
    })
  } else if (previous && previous.type !== 'end' && !hasEnd && (hasPersist || asked.has('payment')) && questionCount >= 1) {
    push({
      type: 'end',
      label: 'End conversation',
      reason: 'The flow has collected data — add a finish step',
      score: 0.48,
    })
  }

  const byKey = new Map<string, NextStepSuggestion>()
  for (const s of scored) {
    const key = `${s.type}:${s.label}`
    const prev = byKey.get(key)
    if (!prev || s.score > prev.score) byKey.set(key, s)
  }

  return [...byKey.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
