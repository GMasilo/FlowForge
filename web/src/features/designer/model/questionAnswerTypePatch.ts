import {
  DEFAULT_FORM_FIELDS,
  DEFAULT_GENDER_CHOICES,
  DEFAULT_LIKERT_CHOICES,
  DEFAULT_MATRIX_ROWS,
  DEFAULT_NUMBERED_CHOICES,
  DEFAULT_RANKING_ITEMS,
  answerTypeUsesChoices,
  answerTypeUsesScaleLabels,
  defaultOtpEmailConfig,
  defaultScaleBounds,
  readFormFields,
  readImageChoiceDrafts,
} from '@/features/designer/model/flowSchema'

/** Defaults + cleanup applied when switching a question's expected answer type. */
export function buildQuestionAnswerTypePatch(
  config: Record<string, unknown>,
  answerType: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { answerType }
  if (answerType === 'gender' || answerType === 'likert') {
    const existing = Array.isArray(config.choices) ? (config.choices as string[]).filter(Boolean) : []
    if (!existing.length) {
      patch.choices = answerType === 'likert' ? [...DEFAULT_LIKERT_CHOICES] : [...DEFAULT_GENDER_CHOICES]
    }
  }
  if (answerType === 'numbered_choice') {
    patch.allowMultiple = false
    patch.minSelections = null
    patch.maxSelections = null
    const existing = Array.isArray(config.choices) ? (config.choices as string[]).filter(Boolean) : []
    if (!existing.length) patch.choices = [...DEFAULT_NUMBERED_CHOICES]
  }
  if (answerType === 'likert' || answerType === 'ranking' || answerType === 'matrix') {
    patch.allowMultiple = false
    patch.minSelections = null
    patch.maxSelections = null
  }
  if (answerType === 'appointment') {
    patch.allowMultiple = false
    patch.minSelections = null
    patch.maxSelections = null
    patch.choicesFrom = ''
  }
  if (answerType === 'ranking') {
    const existing = Array.isArray(config.choices) ? (config.choices as string[]).filter(Boolean) : []
    if (!existing.length) patch.choices = [...DEFAULT_RANKING_ITEMS]
  }
  if (answerType === 'matrix') {
    const existing = Array.isArray(config.choices) ? (config.choices as string[]).filter(Boolean) : []
    if (!existing.length) patch.choices = [...DEFAULT_MATRIX_ROWS]
    if (!Array.isArray(config.scaleChoices) || !(config.scaleChoices as unknown[]).length) {
      patch.scaleChoices = [...DEFAULT_LIKERT_CHOICES]
    }
  }
  if (answerType === 'national_id' && !config.idFormat) patch.idFormat = 'za'
  if (answerType === 'audio' && config.maxDurationSeconds == null) {
    patch.maxDurationSeconds = 60
  }
  if (answerType === 'payment') {
    if (!config.payButtonLabel) patch.payButtonLabel = 'Pay now'
    if (!config.paidButtonLabel) patch.paidButtonLabel = "I've paid"
  }
  if (answerType === 'captcha') {
    if (!config.captchaKind) patch.captchaKind = 'math'
    if (config.captchaMaxAttempts == null) patch.captchaMaxAttempts = 5
  }
  if (answerType === 'form') {
    const existing = readFormFields(config)
    if (!Array.isArray(config.formFields) || !existing.length) {
      patch.formFields = DEFAULT_FORM_FIELDS
    }
  }
  if (answerType === 'shop') {
    if (!String(config.prompt ?? '').trim()) {
      patch.prompt = 'Browse the store and add items to your cart.'
    }
    if (!String(config.outputVariable ?? '').trim()) {
      patch.outputVariable = 'cart'
    }
  }
  if (answerType === 'password' && config.minLength == null) patch.minLength = 4
  const scaleDefaults = defaultScaleBounds(answerType)
  if (scaleDefaults.min != null && config.min == null) patch.min = scaleDefaults.min
  if (scaleDefaults.max != null && config.max == null) patch.max = scaleDefaults.max
  if (scaleDefaults.step != null && config.step == null) patch.step = scaleDefaults.step
  if (answerType === 'nps') {
    if (!config.minLabel) patch.minLabel = 'Not at all likely'
    if (!config.maxLabel) patch.maxLabel = 'Extremely likely'
  }
  if (answerType === 'otp') {
    const otpDefaults = defaultOtpEmailConfig()
    if (config.otpLength == null) patch.otpLength = otpDefaults.otpLength
    if (!config.otpSubject) patch.otpSubject = otpDefaults.otpSubject
    if (!config.otpBody) patch.otpBody = otpDefaults.otpBody
    if (config.otpExpiresSeconds == null) patch.otpExpiresSeconds = otpDefaults.otpExpiresSeconds
    if (config.otpMaxAttempts == null) patch.otpMaxAttempts = otpDefaults.otpMaxAttempts
  }
  if (answerType === 'currency' || answerType === 'payment') {
    if (!config.currencyCode) patch.currencyCode = 'ZAR'
  }
  if (answerType === 'confirm' && !config.confirmLabel) {
    patch.confirmLabel = 'I agree'
  }
  if (!answerTypeUsesScaleLabels(answerType)) {
    patch.minLabel = null
    patch.maxLabel = null
  }
  if (!answerTypeUsesChoices(answerType) && answerType !== 'image_choice') {
    patch.allowMultiple = false
    patch.minSelections = null
    patch.maxSelections = null
    patch.choicesFrom = ''
  }
  if (answerType === 'file') {
    if (!config.fileAccept) patch.fileAccept = 'any'
    if (config.maxFiles == null) patch.maxFiles = 1
  }
  if (answerType !== 'file') {
    patch.fileAccept = null
    patch.maxFiles = null
  }
  if (answerType === 'image_choice') {
    const existing = readImageChoiceDrafts(config)
    if (!existing.length) {
      patch.imageChoices = [
        { label: '', filename: '' },
        { label: '', filename: '' },
      ]
    }
    if (!config.imageChoiceLayout) patch.imageChoiceLayout = 'gallery'
  } else {
    patch.imageChoices = null
    patch.imageChoiceLayout = null
  }
  if (answerType !== 'matrix') patch.scaleChoices = null
  if (answerType !== 'national_id') patch.idFormat = null
  if (answerType !== 'audio') patch.maxDurationSeconds = null
  if (answerType !== 'email') patch.allowedEmailDomains = null
  if (answerType !== 'currency' && answerType !== 'payment') patch.currencyCode = null
  if (answerType !== 'payment') {
    patch.payUrl = null
    patch.paymentAmount = null
    patch.payButtonLabel = null
    patch.paidButtonLabel = null
    patch.paymentConnectionId = null
    patch.paymentItemName = null
    patch.paymentBuyerEmail = null
    patch.paymentBuyerName = null
  }
  if (answerType !== 'captcha') {
    patch.captchaKind = null
    patch.captchaMaxAttempts = null
  }
  if (answerType !== 'form') patch.formFields = null
  if (answerType !== 'shop') patch.shopTemplateKey = null
  if (answerType !== 'otp') {
    patch.otpLength = null
    patch.otpConnectionId = null
    patch.otpTo = null
    patch.otpSubject = null
    patch.otpBody = null
    patch.otpExpiresSeconds = null
    patch.otpMaxAttempts = null
  }
  if (answerType !== 'confirm') patch.confirmLabel = null
  return patch
}
