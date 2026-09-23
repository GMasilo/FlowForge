import {
  answerTypeUsesChoices, answerTypeUsesMultiSelect, answerTypeUsesLengthValidation,
  answerTypeUsesPattern, answerTypeUsesNumberBounds, answerTypeUsesScaleLabels,
  answerTypeUsesDateBounds, questionConfigSchema, extractTemplateRefs, type DesignerNode,
} from './flowSchema'
import { buildQuestionAnswerTypePatch } from './questionAnswerTypePatch'

const shared = new Set(['prompt', 'answerType', 'answerRequired', 'outputVariable', 'templateBindings', 'mediaFiles'])
export const questionResponseFields = Object.keys(questionConfigSchema.shape).filter(key => !shared.has(key))

function allowedFields(type: string): Set<string> {
  const fields = new Set<string>()
  const add = (...keys: string[]) => keys.forEach(key => fields.add(key))
  if (answerTypeUsesChoices(type)) add('choices', 'choicesFrom')
  if (answerTypeUsesMultiSelect(type)) add('allowMultiple', 'minSelections', 'maxSelections')
  if (answerTypeUsesLengthValidation(type)) add('minLength', 'maxLength')
  if (answerTypeUsesPattern(type)) add('pattern', 'patternMessage')
  if (answerTypeUsesNumberBounds(type)) add('min', 'max', 'step')
  if (answerTypeUsesScaleLabels(type)) add('minLabel', 'maxLabel')
  if (answerTypeUsesDateBounds(type)) add('minDate', 'maxDate')
  if (type === 'phone') add('phoneFormat')
  if (type === 'email') add('allowedEmailDomains')
  if (type === 'currency' || type === 'payment') add('currencyCode')
  if (type === 'otp') add('otpLength', 'otpConnectionId', 'otpTemplateKey', 'otpTo', 'otpSubject', 'otpBody', 'otpExpiresSeconds', 'otpMaxAttempts')
  if (type === 'payment') add('paymentTemplateKey', 'payUrl', 'paymentAmount', 'payButtonLabel', 'paidButtonLabel', 'paymentConnectionId', 'paymentItemName', 'paymentBuyerEmail', 'paymentBuyerName')
  if (type === 'confirm') add('confirmLabel')
  if (type === 'file') add('fileAccept', 'maxFiles')
  if (type === 'image_choice') add('imageChoices', 'imageChoiceLayout')
  if (type === 'matrix') add('scaleChoices')
  if (type === 'national_id') add('idFormat')
  if (type === 'audio') add('maxDurationSeconds')
  if (type === 'captcha') add('captchaKind', 'captchaMaxAttempts')
  if (type === 'form') add('formFields')
  if (type === 'shop') add('shopTemplateKey')
  return fields
}

function removeRetiredBindings(config: Record<string, unknown>, previous: Record<string, unknown>) {
  if (!config.templateBindings || typeof config.templateBindings !== 'object') return
  const used = new Set<string>()
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const ref of extractTemplateRefs(value)) if (ref.startsWith('templates.')) used.add(ref.split('.')[1])
    } else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  for (const [key, value] of Object.entries(config)) if (key !== 'templateBindings') visit(value)
  const selectors = ['paymentTemplateKey', 'otpTemplateKey', 'shopTemplateKey']
  for (const key of selectors) if (config[key]) used.add(String(config[key]))
  const bindings = { ...config.templateBindings as Record<string, unknown> }
  for (const key of selectors) {
    const retired = String(previous[key] ?? '').trim()
    if (retired && !used.has(retired)) delete bindings[retired]
  }
  if (Object.keys(bindings).length) config.templateBindings = bindings
  else delete config.templateBindings
}

/** Preserve active settings on load; switching starts the new response with fresh defaults. */
export function cleanQuestionConfig(config: Record<string, unknown>, resetResponse = false, previous = config): Record<string, unknown> {
  const type = String(config.answerType ?? 'text')
  const allowed = allowedFields(type)
  const next = { ...config }
  for (const key of questionResponseFields) {
    if (resetResponse || !allowed.has(key) || next[key] == null) delete next[key]
  }
  if (resetResponse) Object.assign(next, buildQuestionAnswerTypePatch(next, type))
  // The legacy default builder uses null placeholders; never persist those placeholders.
  for (const key of questionResponseFields) if (!allowed.has(key) || next[key] == null) delete next[key]
  removeRetiredBindings(next, previous)
  return next
}

export function cleanQuestionNodes(nodes: DesignerNode[]): DesignerNode[] {
  return nodes.map(node => {
    if (node.type !== 'question') return node
    const config = cleanQuestionConfig(node.config)
    return JSON.stringify(config) === JSON.stringify(node.config) ? node : { ...node, config }
  })
}
