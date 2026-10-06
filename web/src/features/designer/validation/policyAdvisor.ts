import { extractTemplateRefs, type DesignerNode, type DesignerEdge } from '@/features/designer/model/flowSchema'
import { collectSkipTargetKeys } from '@/features/designer/model/skipToStep'
import type { ValidationIssue } from './referenceValidator'

const collection: Record<string, string> = {
  email: 'contact details', phone: 'contact details', address: 'postal addresses',
  location: 'precise location', national_id: 'government identity information',
  signature: 'signatures', file: 'uploaded documents or files', image: 'uploaded images',
  audio: 'audio recordings', video: 'video recordings', date_of_birth: 'dates of birth',
}

/** Local, deterministic advice. Never sends config or visitor data to a model. */
export function policyWarnings(nodes: DesignerNode[], edges: DesignerEdge[] = [], templates: Record<string, unknown> | null = null): ValidationIssue[] {
  const covered = consentCoveredSteps(nodes, edges, templates)
  const issues: ValidationIssue[] = []
  for (const node of nodes) {
    const seen = new Set<string>()
    const warn = (code: string, field: string, message: string) => {
      // A notice and confirmation resolve declaration reminders, not card security risks.
      if (covered.has(node.id) && code !== 'card_data') return
      if (seen.has(code)) return
      seen.add(code)
      issues.push({ severity: 'warning', nodeId: node.id, field, code: `policy_${code}`, message: `Policy review: ${message}` })
    }
    const collect = (type: string, field: string) => {
      if (type === 'credit_card') {
        warn('card_data', field, 'Card response collects number, expiry and CVV. Use test data only in generic chat fields; use provider checkout for real payments. Masking the display is not secure deletion or payment compliance.')
      } else if (collection[type]) {
        warn('collection_' + type, field, `This step can collect ${collection[type]}. Before collection, explain the purpose, required/optional status, recipients, retention and how visitors can contact the organisation about their data.`)
      }
    }
    if (node.type === 'question') {
      collect(String(node.config.answerType ?? ''), 'answerType')
      if (node.config.answerType === 'form' && Array.isArray(node.config.formFields)) {
        for (const item of node.config.formFields) {
          if (item && typeof item === 'object') collect(String(item.type ?? item.answerType ?? ''), 'formFields')
        }
      }
      // Only inspect collection labels/prompts, not example answers or connection secrets.
      const fields = Array.isArray(node.config.formFields) ? node.config.formFields : []
      const wording = [node.label, node.config.prompt, node.config.outputVariable,
        ...fields.flatMap(f => f && typeof f === 'object' ? [f.label, f.key] : [])]
        .filter((v): v is string => typeof v === 'string')
        .map(v => v.slice(0, 12000).replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
          .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' '))
      if (wording.some(value => /\b(?:(?:id|identity|identification)\s*(?:number|no\b)|(?:national|government|south african|sa)\s+id)\b/i.test(value))) {
        collect('national_id', node.config.answerType === 'form' ? 'formFields' : 'prompt')
      }
      const text = wording.join(' ')
      if (/\b(health|medical|diagnosis|disability|religion|ethnicity|race|biometric|passport|salary|bank account|date of birth|dob|child|children|minor)\b/i.test(text)) {
        warn('sensitive', 'prompt', 'The question wording suggests sensitive, financial, identity or children’s information. Review necessity, applicable safeguards and the visitor notice. This is a wording heuristic, not a legal classification.')
      }
      if (node.config.answerType === 'payment') warn('payment', 'answerType', 'Payment can share information with a payment provider. Identify the provider and explain payment references/status returned to the organisation. A visitor confirmation alone does not verify settlement.')
    }
    if (['http', 'database', 'email', 'integration'].includes(node.type)) {
      warn('external_service', node.type === 'integration' ? 'action' : 'connectionId', 'This step can collect data from or send data to a connected service. Review mapped fields and declare the organisation’s purpose, recipients and retention. Explain that FlowForge processes organisation-collected data to provide the configured service, not for independent use. Preview may contact live services.')
    }
    const action = String(node.config.action ?? '')
    if (node.type === 'integration' && action.startsWith('ml.') && action !== 'ml.health_check') {
      warn('model', 'action', 'This action sends input to a model service and produces inferred information. Explain the input, endpoint operator, purpose and use of results. Check provider retention/training terms and provide review or fallback for consequential decisions; scores may be wrong.')
    }
    if (node.type === 'entity') warn('entity', 'operation', 'Entity records may retain collected information separately from conversations or combine it through joins. Review selected columns, query/sharing permissions and record retention; deleting a conversation may not delete these records.')
    if (node.type === 'handoff' || node.type === 'transfer') warn('handoff', 'targetChatbotId', 'Conversation data may become available to another support team or chatbot. Explain who receives it and why, and review destination access.')
    const authoredText = [node.config.text, node.config.prompt, node.config.onRun].filter(v => typeof v === 'string').join(' ')
    if (/\bsetCookie\s*\(/i.test(authoredText)) warn('cookie', 'onRun', 'This step may remember visitor values in a cookie. Explain what is stored, its purpose and lifetime, and obtain consent where required. Do not store sensitive values in cookies.')
    if (/templates\.[\w]+\.file\b/.test(authoredText)) warn('document', 'text', 'This step generates a downloadable document. Review bound personal data, intended recipients and document retention. Downloaded or externally shared copies are not removed by deleting the chat.')
  }
  return issues
}

/** Follow both protected and unprotected paths, including configured jumps.
 * A displayed notice alone is insufficient: visitors must pass a Confirm question.
 * Cycles terminate because each node has only four possible review states.
 */
function consentCoveredSteps(nodes: DesignerNode[], edges: DesignerEdge[], templates: Record<string, unknown> | null): Set<string> {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const byKey = new Map(nodes.map(node => [node.key, node.id]))
  const outgoing = new Map(nodes.map(node => [node.id, new Set<string>()]))
  const incoming = new Set<string>()
  const link = (source: string, target: string) => {
    if (!byId.has(source) || !byId.has(target)) return
    outgoing.get(source)!.add(target)
    incoming.add(target)
  }
  for (const edge of edges) link(edge.source, edge.target)
  for (const node of nodes) for (const key of collectSkipTargetKeys(node)) {
    const target = byKey.get(key)
    if (target) link(node.id, target)
  }
  const displaysNotice = (node: DesignerNode) => {
    const text = node.type === 'question' ? node.config.prompt : node.type === 'message' ? node.config.text : null
    if (typeof text !== 'string') return false
    return extractTemplateRefs(text).some(ref => {
      const key = /^templates\.([\w-]+)(?:\.|$)/.exec(ref)?.[1]
      const content = key ? templates?.[key] : null
      if (!content || typeof content !== 'object') return false
      const record = content as Record<string, unknown>
      return typeof record.body === 'string' && !!record.body.trim() &&
        /\b(privacy|consent|personal data|data processing|terms|legal)\b/i.test(`${record.title ?? ''} ${record.body}`)
    })
  }
  const notices = new Set(nodes.filter(displaysNotice).map(node => node.id))
  if (!notices.size) return new Set()
  const roots = nodes.filter(node => !incoming.has(node.id))
  // Runtime starts from the first node when a graph has no root.
  if (!roots.length && nodes[0]) roots.push(nodes[0])
  const queue = roots.map(node => ({ id: node.id, notice: false, consent: false }))
  const seen = new Set<string>()
  const reached = new Set<string>()
  const unprotected = new Set<string>()
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index]
    const key = `${state.id}:${state.notice}:${state.consent}`
    if (seen.has(key)) continue
    seen.add(key)
    reached.add(state.id)
    if (!state.consent) unprotected.add(state.id)
    const node = byId.get(state.id)!
    const notice = state.notice || notices.has(state.id)
    const consent = state.consent || (notice && node.type === 'question' && node.config.answerType === 'confirm')
    for (const id of outgoing.get(state.id)!) queue.push({ id, notice, consent })
  }
  return new Set([...reached].filter(id => !unprotected.has(id)))
}
