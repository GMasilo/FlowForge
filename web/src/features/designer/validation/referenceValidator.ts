import {
  extractTemplateRefs,
  getStepOutputVariables,
  QUESTION_ANSWER_TYPE_OPTIONS,
  validateQuestionDateBounds,
  type DesignerEdge,
  type DesignerNode,
} from '@/features/designer/model/flowSchema'
import type { ConnectionValidationInfo } from '@/features/connections/connectionValidation'
import { resolvePaymentQuestionConfig } from '@/features/templates/paymentTemplate'
import { isTemplateKindAllowedForAnswerType, templateContentLooksLikeCart } from '@/features/templates/templateKindCompatibility'
import { parseTemplateBindingMap, parseTemplateInputs } from '@/features/templates/templateModel'
import {
  findContinueRootIds,
  loopBodyStart,
  outgoingMap,
  reachableIds,
} from '@/features/designer/utils/conditionGraph'
import { collectSkipTargetKeys, canReachNode, stepsSkippedByJump, variablesProvidedBySkipJump } from '@/features/designer/model/skipToStep'

/** Item/index vars from Every For each whose Each-item body contains this node. */
function availableLoopLocals(
  nodeId: string,
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): Set<string> {
  const locals = new Set<string>()
  const edgeOut = outgoingMap(edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const loop of nodes) {
    if (loop.type !== 'loop') continue
    const bodyStart = loopBodyStart(loop.id, edges)
    const continues = findContinueRootIds(loop.id, edges, byId)
    const bodyIds = reachableIds(bodyStart, edgeOut, continues)
    if (!bodyIds.has(nodeId)) continue
    const itemVar = String(loop.config.itemVariable ?? 'item').trim() || 'item'
    const indexVar = String(loop.config.indexVariable ?? 'index').trim() || 'index'
    locals.add(itemVar)
    locals.add(indexVar)
  }
  return locals
}

export interface ValidationIssue {
  severity: 'error' | 'warning'
  nodeId?: string
  field?: string
  message: string
  code: string
}

export interface ValidationContext {
  globalVariables: string[]
  connectionsById?: Record<string, ConnectionValidationInfo>
  mediaKeys?: string[] | null
  templateKeys?: string[] | null
  /** Template JSON content by key. null = not loaded yet. */
  templateContents?: Record<string, unknown> | null
  /** Entity ids installed on the current chatbot. null = not loaded yet. */
  installedEntityIds?: string[] | null
  /** Integration ids installed on the current chatbot. null = not loaded yet. */
  installedIntegrationIds?: string[] | null
}

function buildAdjacency(nodes: DesignerNode[], edges: DesignerEdge[]) {
  const outgoing = new Map<string, Array<{ target: string; handle: string | null }>>()
  const incoming = new Map<string, string[]>()
  for (const node of nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }
  for (const edge of edges) {
    outgoing.get(edge.source)?.push({ target: edge.target, handle: edge.sourceHandle ?? null })
    incoming.get(edge.target)?.push(edge.source)
  }
  // Treat skip jumps as alternate edges so variables on bypassed paths are not
  // considered guaranteed at the skip target. Only model jumps that follow an
  // existing edge path (same reachability as runtime bypass accounting).
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  for (const node of nodes) {
    for (const targetKey of collectSkipTargetKeys(node)) {
      if (!targetKey || targetKey === node.key) continue
      const target = byKey.get(targetKey)
      if (!target) continue
      if (!canReachNode(node.id, target.id, nodes, edges)) continue
      const already = (outgoing.get(node.id) ?? []).some((o) => o.target === target.id)
      if (already) continue
      outgoing.get(node.id)?.push({ target: target.id, handle: null })
      incoming.get(target.id)?.push(node.id)
    }
  }
  return { outgoing, incoming }
}

function findRoots(nodes: DesignerNode[], incoming: Map<string, string[]>) {
  const roots = nodes.filter((n) => (incoming.get(n.id) ?? []).length === 0)
  return roots.length ? roots : nodes.slice(0, 1)
}

/**
 * Guaranteed predecessors: nodes that appear on EVERY path from a root to `nodeId`.
 * Approximated via intersection of reachability sets inverted from BFS forward ancestors.
 */
function guaranteedPredecessors(
  nodeId: string,
  roots: DesignerNode[],
  outgoing: Map<string, Array<{ target: string; handle: string | null }>>,
  incoming: Map<string, string[]>,
): Set<string> {
  // All ancestors that can reach this node
  const ancestors = new Set<string>()
  const stack = [...(incoming.get(nodeId) ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    if (ancestors.has(cur)) continue
    ancestors.add(cur)
    for (const p of incoming.get(cur) ?? []) stack.push(p)
  }

  // Nodes reachable from some root without going through nodeId
  const reachableFromRoots = new Set<string>()
  for (const root of roots) {
    const q = [root.id]
    const seen = new Set<string>()
    while (q.length) {
      const cur = q.shift()!
      if (seen.has(cur) || cur === nodeId) continue
      seen.add(cur)
      reachableFromRoots.add(cur)
      for (const next of outgoing.get(cur) ?? []) q.push(next.target)
    }
  }

  // A predecessor is guaranteed if it is an ancestor AND not bypassable:
  // every path to nodeId goes through it. We compute this via:
  // remove candidate, check if nodeId still reachable from roots.
  const guaranteed = new Set<string>()
  for (const candidate of ancestors) {
    const stillReachable = isReachableAvoiding(roots.map((r) => r.id), nodeId, candidate, outgoing)
    if (!stillReachable) guaranteed.add(candidate)
  }

  // Also treat direct linear chain approximations: all ancestors that are
  // always visited — for linear flows (no alternate paths), all ancestors qualify.
  if (guaranteed.size === 0 && ancestors.size > 0) {
    // If only one root path dominates (no branching into node), include all ancestors
    // when in-degree of every ancestor along the unique path is 1 from root.
    const onlyOneRootPath = roots.length === 1 && !hasAlternatePath(roots[0].id, nodeId, outgoing)
    if (onlyOneRootPath) {
      for (const a of ancestors) guaranteed.add(a)
    }
  }

  void reachableFromRoots
  return guaranteed
}

function isReachableAvoiding(
  roots: string[],
  target: string,
  avoid: string,
  outgoing: Map<string, Array<{ target: string; handle: string | null }>>,
): boolean {
  const q = [...roots]
  const seen = new Set<string>()
  while (q.length) {
    const cur = q.shift()!
    if (cur === avoid || seen.has(cur)) continue
    if (cur === target) return true
    seen.add(cur)
    for (const next of outgoing.get(cur) ?? []) q.push(next.target)
  }
  return false
}

function hasAlternatePath(
  rootId: string,
  targetId: string,
  outgoing: Map<string, Array<{ target: string; handle: string | null }>>,
): boolean {
  // Count distinct simple paths (bounded) — if >1, branching exists.
  let paths = 0
  function dfs(cur: string, visited: Set<string>) {
    if (paths > 1) return
    if (cur === targetId) {
      paths += 1
      return
    }
    for (const next of outgoing.get(cur) ?? []) {
      if (visited.has(next.target)) continue
      const nextVisited = new Set(visited)
      nextVisited.add(next.target)
      dfs(next.target, nextVisited)
    }
  }
  dfs(rootId, new Set([rootId]))
  return paths > 1
}

function parseRef(
  ref: string,
): { kind: 'vars' | 'steps' | 'media' | 'templates' | 'inputs'; name: string; path: string[] } | null {
  const parts = ref.split('.').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const kind = parts[0]
  if (kind !== 'vars' && kind !== 'steps' && kind !== 'media' && kind !== 'templates' && kind !== 'inputs') {
    return null
  }
  return { kind, name: parts[1]!, path: parts.slice(2) }
}

function collectJsonStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 10) return out
  if (typeof value === 'string') {
    if (value.includes('{{')) out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, out, depth + 1)
    return out
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectJsonStrings(nested, out, depth + 1)
    }
  }
  return out
}

function emailLegacyParam(node: DesignerNode, key: string): string {
  if (node.type !== 'email') return ''
  if (key === 'to') return String(node.config.to ?? '').trim()
  if (key === 'subject') return String(node.config.subject ?? '').trim()
  if (key === 'body') return String(node.config.body ?? '').trim()
  return ''
}

/** Config strings plus connection defaults used when a step leaves a param empty. */
function collectNodeTemplateStrings(node: DesignerNode, ctx: ValidationContext): string[] {
  const configForTemplates = activeTemplateConfig(node)
  const strings = collectJsonStrings(configForTemplates)
  if (node.type !== 'http' && node.type !== 'email') return strings
  const connId = typeof node.config.connectionId === 'string' ? node.config.connectionId : ''
  const info = connId ? ctx.connectionsById?.[connId] : undefined
  if (!info) return strings
  const paramValues =
    node.config.paramValues && typeof node.config.paramValues === 'object'
      ? (node.config.paramValues as Record<string, string>)
      : {}
  for (const param of info.inputParams) {
    const key = param.key.trim()
    if (!key) continue
    const fromParams = String(paramValues[key] ?? '').trim()
    const fromDefault = (param.defaultValue ?? '').trim()
    if (!fromParams && !emailLegacyParam(node, key) && fromDefault.includes('{{')) {
      strings.push(fromDefault)
    }
  }
  return strings
}

/**
 * Drop mode-inactive OTP email fields so defaults like Sign-in `otpBody`
 * (still stored when source is HTTP/entity/password) are not validated.
 */
function activeTemplateConfig(node: DesignerNode): Record<string, unknown> {
  const config = { ...node.config }
  const otpActive =
    (node.type === 'question' && String(config.answerType ?? '') === 'otp') ||
    (node.type === 'sign_in' && String(config.mode ?? '') === 'otp')
  if (!otpActive) {
    delete config.otpBody
    delete config.otpSubject
    delete config.otpTemplateKey
  }
  return config
}

function nodeAllowsOtpCodeRef(node: DesignerNode): boolean {
  return (
    (node.type === 'question' && String(node.config.answerType ?? '') === 'otp') ||
    (node.type === 'sign_in' && String(node.config.mode ?? '') === 'otp')
  )
}

/** Variable names referenced via {{vars.*}} (or bare {{name}}) anywhere in the flow. */
function collectReferencedVarNames(nodes: DesignerNode[], ctx: ValidationContext): Set<string> {
  const refs = new Set<string>()
  const note = (rawRef: string) => {
    const parsed = parseRef(normalizeRef(rawRef))
    if (parsed?.kind === 'vars' && parsed.name) refs.add(parsed.name)
  }
  for (const node of nodes) {
    const strings = collectNodeTemplateStrings(node, ctx)
    for (const text of strings) {
      for (const rawRef of extractTemplateRefs(text)) note(rawRef)
    }
    if (!ctx.templateContents) continue
    for (const tmplKey of calledTemplateKeys(node, strings)) {
      for (const inner of refsInsideTemplate(tmplKey, ctx.templateContents)) {
        note(inner.rawRef)
      }
    }
  }
  return refs
}

/** `{{userName}}` in templates is treated as `{{vars.userName}}`. */
function normalizeRef(rawRef: string): string {
  const t = rawRef.trim()
  if (/^(vars|steps|media|templates|otp|inputs)\./i.test(t)) return t
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) return `vars.${t}`
  return t
}

function calledTemplateKeys(node: DesignerNode, strings: string[]): string[] {
  const keys = new Set<string>()
  const otpActive = nodeAllowsOtpCodeRef(node)
  for (const key of [
    String(node.config.templateKey ?? '').trim(),
    String(node.config.shopTemplateKey ?? '').trim(),
    otpActive ? String(node.config.otpTemplateKey ?? '').trim() : '',
  ]) {
    if (key) keys.add(key)
  }
  for (const key of Object.keys(parseTemplateBindingMap(node.config.templateBindings))) {
    if (key.trim()) keys.add(key.trim())
  }
  for (const text of strings) {
    for (const rawRef of extractTemplateRefs(text)) {
      const parsed = parseRef(rawRef)
      if (parsed?.kind === 'templates' && parsed.name) keys.add(parsed.name)
    }
  }
  return [...keys]
}

function declaredTemplateInputs(content: unknown) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return []
  return parseTemplateInputs((content as Record<string, unknown>).inputs)
}

/** Refs inside a template (and nested {{templates.*}}), not including the outer templates.key call. */
function refsInsideTemplate(
  key: string,
  contents: Record<string, unknown>,
  seen: Set<string> = new Set(),
): Array<{ rawRef: string; templateKey: string }> {
  if (!key || seen.has(key)) return []
  seen.add(key)
  if (!(key in contents)) return []
  const refs: Array<{ rawRef: string; templateKey: string }> = []
  for (const text of collectJsonStrings(contents[key])) {
    for (const rawRef of extractTemplateRefs(text)) {
      const parsed = parseRef(rawRef)
      if (parsed?.kind === 'templates') {
        refs.push(...refsInsideTemplate(parsed.name, contents, seen))
        continue
      }
      refs.push({ rawRef, templateKey: key })
    }
  }
  return refs
}

/** Runtime-only placeholders injected when sending OTP email (see applyOtpEmailTemplate). */
function isOtpSpecialRef(ref: string): boolean {
  const t = ref.trim().toLowerCase().replace(/\s+/g, '')
  return t === 'otp.code' || t === 'otpcode'
}

export function validateFlow(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  ctx: ValidationContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const keySet = new Set<string>()
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const nodeByKey = new Map(nodes.map((n) => [n.key, n]))

  for (const node of nodes) {
    if (!node.key.trim()) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        code: 'empty_key',
        message: 'Step key is required',
      })
    } else if (keySet.has(node.key)) {
      issues.push({
        severity: 'error',
        nodeId: node.id,
        code: 'duplicate_key',
        message: `Duplicate step key "${node.key}"`,
      })
    } else {
      keySet.add(node.key)
    }
  }

  const { outgoing, incoming } = buildAdjacency(nodes, edges)
  const roots = findRoots(nodes, incoming)
  const globalSet = new Set(ctx.globalVariables)
  const referencedVars = collectReferencedVarNames(nodes, ctx)

  // All writers of each variable key (globals conceptually written at flow start)
  const writersByVar = new Map<string, DesignerNode[]>()
  for (const node of nodes) {
    for (const out of getStepOutputVariables(node)) {
      const list = writersByVar.get(out) ?? []
      list.push(node)
      writersByVar.set(out, list)
    }
  }

  for (const node of nodes) {
    const guaranteed = guaranteedPredecessors(node.id, roots, outgoing, incoming)
    const availableStepKeys = new Set<string>()
    const availableStepOutputs = new Set<string>()
    const loopLocals = availableLoopLocals(node.id, nodes, edges)

    for (const predId of guaranteed) {
      const pred = nodeById.get(predId)
      if (!pred) continue
      availableStepKeys.add(pred.key)
      for (const out of getStepOutputVariables(pred)) {
        availableStepOutputs.add(out)
      }
      // Skip jumps null bypassed outputs at runtime — treat them as available here too.
      for (const out of variablesProvidedBySkipJump(pred, nodes, edges)) {
        availableStepOutputs.add(out)
      }
      for (const skippedKey of stepsSkippedByJump(pred, nodes, edges)) {
        availableStepKeys.add(skippedKey)
      }
    }

    // Overwrite is allowed: assigning a key that already exists is intentional.
    // Only warn when something in the flow actually reads the variable — and skip
    // Sign-in → Sign-in session rebinds (same default auth outputs by design).
    for (const writtenHere of getStepOutputVariables(node)) {
      if (!referencedVars.has(writtenHere) && !globalSet.has(writtenHere)) continue
      const priorWriters = (writersByVar.get(writtenHere) ?? []).filter(
        (w) => w.id !== node.id && guaranteed.has(w.id),
      )
      if (node.type === 'sign_in' && priorWriters.length && priorWriters.every((w) => w.type === 'sign_in')) {
        continue
      }
      // Skip-to defaults / virtual nulls are fallbacks for when this step is bypassed —
      // not a real prior write that this step "overwrites".
      const realPriors = priorWriters.filter((w) => w.type !== 'skip_to')
      if (globalSet.has(writtenHere) || realPriors.length) {
        issues.push({
          severity: 'warning',
          nodeId: node.id,
          field: 'outputVariable',
          code: 'variable_overwrite',
          message: globalSet.has(writtenHere)
            ? `Reassigns global variable "{{vars.${writtenHere}}}"`
            : `Overwrites "{{vars.${writtenHere}}}" previously set by ${realPriors.map((w) => w.key).join(', ')}`,
        })
      }
    }

    const strings = collectNodeTemplateStrings(node, ctx)
    const allowsOtpCode = nodeAllowsOtpCodeRef(node)

    const checkRef = (rawRef: string, templateKey?: string) => {
      const normalized = normalizeRef(rawRef)
      const via = templateKey ? `Template "${templateKey}" uses ` : ''
      if (isOtpSpecialRef(normalized) || isOtpSpecialRef(rawRef)) {
        if (!allowsOtpCode) {
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            code: 'otp_ref_outside_otp',
            message: `${via}"{{${rawRef.trim()}}}" only works in OTP email subject/body (question OTP or Sign-in OTP)`,
          })
        }
        return
      }
      const parsed = parseRef(normalized)
      if (!parsed) {
        if (templateKey) return
        issues.push({
          severity: 'error',
          nodeId: node.id,
          code: 'invalid_ref',
          message: `Invalid reference "{{${rawRef}}}". Use {{vars.name}}, {{steps.key.path}}, {{media.key}}, {{templates.key}}, {{inputs.key}}, {{otp.code}}, or expressions like {{embed("https://…")}} / parseJson(vars.jsonStr)`,
        })
        return
      }

      if (parsed.kind === 'vars') {
        if (
          !globalSet.has(parsed.name) &&
          !availableStepOutputs.has(parsed.name) &&
          !loopLocals.has(parsed.name)
        ) {
          const writers = writersByVar.get(parsed.name) ?? []
          const futureWriters = writers.filter((w) => w.id !== node.id && !guaranteed.has(w.id))
          if (futureWriters.length && writers.every((w) => !guaranteed.has(w.id))) {
            issues.push({
              severity: 'error',
              nodeId: node.id,
              code: 'forward_var_ref',
              message: templateKey
                ? `Template "${templateKey}" uses "{{vars.${parsed.name}}}" which is set by step "${futureWriters[0]!.key}" — that step is not guaranteed to have run yet`
                : `Variable "{{vars.${parsed.name}}}" is set by step "${futureWriters[0]!.key}" which is not guaranteed to have run yet`,
            })
          } else {
            issues.push({
              severity: 'error',
              nodeId: node.id,
              code: 'unknown_var',
              message: templateKey
                ? `Template "${templateKey}" uses "{{vars.${parsed.name}}}" which is not set before this step`
                : `Unknown variable "{{vars.${parsed.name}}}"`,
            })
          }
        }
        return
      }

      if (parsed.kind === 'media') {
        const keys = ctx.mediaKeys
        if (keys && !keys.includes(parsed.name)) {
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            code: 'unknown_media',
            message: templateKey
              ? `Template "${templateKey}" uses unknown media "{{media.${parsed.name}}}". Upload it in the Media library or attach it on a step.`
              : `Unknown media "{{media.${parsed.name}}}". Upload it in the Media library or attach it on a step.`,
          })
        }
        return
      }

      if (parsed.kind === 'templates') {
        const keys = ctx.templateKeys
        if (keys && !keys.includes(parsed.name)) {
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            code: 'unknown_template',
            message: `Unknown template "{{templates.${parsed.name}}}". Create it on the Templates tab.`,
          })
        }
        return
      }

      if (parsed.kind === 'inputs') {
        if (!templateKey) {
          issues.push({
            severity: 'error',
            nodeId: node.id,
            code: 'invalid_ref',
            message: `"{{inputs.${parsed.name}}}" only works inside a template. Declare the input on the template, then bind it on this step.`,
          })
          return
        }
        const declared = declaredTemplateInputs(ctx.templateContents?.[templateKey])
        if (!declared.some((input) => input.key === parsed.name)) {
          issues.push({
            severity: 'error',
            nodeId: node.id,
            code: 'unknown_template_input',
            message: `Template "${templateKey}" uses "{{inputs.${parsed.name}}}" which is not a declared input`,
          })
        }
        return
      }

      const target = nodeByKey.get(parsed.name)
      if (!target) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          code: 'unknown_step',
          message: templateKey
            ? `Template "${templateKey}" uses unknown step "{{steps.${parsed.name}}}"`
            : `Unknown step "{{steps.${parsed.name}}}"`,
        })
      } else if (target.id === node.id) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          code: 'self_ref',
          message: `Step "${node.key}" cannot reference itself`,
        })
      } else if (!availableStepKeys.has(parsed.name)) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          code: 'forward_step_ref',
          message: templateKey
            ? `Template "${templateKey}" uses "{{steps.${parsed.name}}}" before that step is guaranteed to run`
            : `Cannot reference step "{{steps.${parsed.name}}}" before it is guaranteed to run`,
        })
      } else if (parsed.path.length && (target.type === 'http' || target.type === 'email')) {
        const connId = typeof target.config.connectionId === 'string' ? target.config.connectionId : ''
        const info = connId ? ctx.connectionsById?.[connId] : undefined
        if (info?.responsePaths.length) {
          const pathStr = parsed.path.join('.')
          const known = info.responsePaths.some(
            (p) => p.path === pathStr || pathStr.startsWith(`${p.path}.`) || p.path.startsWith(`${pathStr}.`),
          )
          if (!known) {
            issues.push({
              severity: 'warning',
              nodeId: node.id,
              code: 'unknown_response_path',
              message: templateKey
                ? `Template "${templateKey}" uses "{{steps.${parsed.name}.${pathStr}}}" which is not in the connection’s expected response schema`
                : `"{{steps.${parsed.name}.${pathStr}}}" is not in the connection’s expected response schema`,
            })
          }
        }
      }
    }

    for (const text of strings) {
      for (const rawRef of extractTemplateRefs(text)) {
        checkRef(rawRef)
      }
    }

    if (ctx.templateContents) {
      const seenInner = new Set<string>()
      const bindings = parseTemplateBindingMap(node.config.templateBindings)
      for (const tmplKey of calledTemplateKeys(node, strings)) {
        for (const inner of refsInsideTemplate(tmplKey, ctx.templateContents)) {
          const dedupe = `${inner.templateKey}:${inner.rawRef}`
          if (seenInner.has(dedupe)) continue
          seenInner.add(dedupe)
          checkRef(inner.rawRef, inner.templateKey)
        }
        if (
          node.type === 'message' ||
          node.type === 'question' ||
          node.type === 'end' ||
          node.type === 'email'
        ) {
          for (const input of declaredTemplateInputs(ctx.templateContents[tmplKey])) {
            if (!input.required) continue
            const bound = (bindings[tmplKey]?.[input.key] ?? '').trim()
            if (bound) continue
            issues.push({
              severity: 'error',
              nodeId: node.id,
              field: `templateBindings.${tmplKey}.${input.key}`,
              code: 'unbound_template_input',
              message: `Template "${tmplKey}" requires input "${input.label || input.key}"`,
            })
          }
        }
      }
    }

    if (node.type === 'question') {
      if (String(node.config.answerType ?? '') === 'payment') {
        const paymentConfig = resolvePaymentQuestionConfig(node.config, ctx.templateContents)
        const templateKey = String(node.config.paymentTemplateKey ?? '').trim()
        if (templateKey && ctx.templateKeys && !ctx.templateKeys.includes(templateKey)) {
          issues.push({ severity: 'error', nodeId: node.id, field: 'paymentTemplateKey', code: 'unknown_payment_template', message: `Payment template "${templateKey}" was not found.` })
        }
        const connectionId = String(paymentConfig.paymentConnectionId ?? '').trim()
        const connection = ctx.connectionsById?.[connectionId]
        if (!connectionId || (ctx.connectionsById && (!connection || connection.kind !== 'payment'))) {
          issues.push({
            severity: 'error', nodeId: node.id, field: 'paymentConnectionId',
            code: 'payment_verification_required',
            message: 'Payment question requires a valid Payment connection to verify payment before continuing.',
          })
        }
      }
      const out = node.config.outputVariable
      if (typeof out !== 'string' || !out.trim()) {
        issues.push({
          severity: 'warning',
          nodeId: node.id,
          field: 'outputVariable',
          code: 'missing_output',
          message: 'Question should bind an output variable',
        })
      }
      if (String(node.config.answerType ?? '') === 'shop') {
        const shopKey = String(node.config.shopTemplateKey ?? '').trim()
        if (!shopKey) {
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            field: 'shopTemplateKey',
            code: 'missing_shop_catalog',
            message: 'Shop question needs a store catalog template',
          })
        } else if (ctx.templateKeys && !ctx.templateKeys.includes(shopKey)) {
          issues.push({
            severity: 'warning',
            nodeId: node.id,
            field: 'shopTemplateKey',
            code: 'unknown_template',
            message: `Unknown store catalog “${shopKey}”. Create it on the Templates tab.`,
          })
        }
      } else if (ctx.templateContents) {
        const answerType = String(node.config.answerType ?? 'text')
        const typeLabel =
          QUESTION_ANSWER_TYPE_OPTIONS.find((o) => o.value === answerType)?.label ?? answerType
        const seenCart = new Set<string>()
        for (const text of strings) {
          for (const rawRef of extractTemplateRefs(text)) {
            const parsed = parseRef(rawRef)
            if (parsed?.kind !== 'templates' || !parsed.name || seenCart.has(parsed.name)) continue
            if (!templateContentLooksLikeCart(ctx.templateContents[parsed.name])) continue
            if (isTemplateKindAllowedForAnswerType('cart', answerType)) continue
            seenCart.add(parsed.name)
            issues.push({
              severity: 'warning',
              nodeId: node.id,
              field: 'prompt',
              code: 'incompatible_template',
              message: `Store catalog “${parsed.name}” belongs on a Shop question, not ${typeLabel}. Using it here can loop between cart and checkout.`,
            })
          }
        }
      }
      for (const bound of validateQuestionDateBounds(node.config)) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: bound.field,
          code: bound.field === 'minDate' ? 'earliest_date_invalid' : 'latest_date_invalid',
          message: bound.message,
        })
      }
    }

    if (node.type === 'http' || node.type === 'email' || node.type === 'database') {
      const conn = node.config.connectionId
      const kindLabel =
        node.type === 'http' ? 'HTTP' : node.type === 'email' ? 'Email' : 'Database'
      if (typeof conn !== 'string' || !conn) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: 'connectionId',
          code: 'missing_connection',
          message: `${kindLabel} step requires a connection`,
        })
      } else {
        const info = ctx.connectionsById?.[conn]
        if (!info) {
          issues.push({
            severity: 'error',
            nodeId: node.id,
            field: 'connectionId',
            code: 'unknown_connection',
            message: 'Selected connection was not found',
          })
        } else if (info.kind !== node.type) {
          issues.push({
            severity: 'error',
            nodeId: node.id,
            field: 'connectionId',
            code: 'wrong_connection_kind',
            message: `Step expects a ${node.type} connection`,
          })
        } else if (node.type === 'database') {
          const sql = String(node.config.sql ?? '').trim()
          if (!sql) {
            issues.push({
              severity: 'error',
              nodeId: node.id,
              field: 'sql',
              code: 'missing_sql',
              message: 'Database step requires SQL',
            })
          }
        } else {
          const paramValues =
            node.config.paramValues && typeof node.config.paramValues === 'object'
              ? (node.config.paramValues as Record<string, string>)
              : {}
          for (const param of info.inputParams) {
            if (!param.key.trim() || !param.required) continue
            const key = param.key.trim()
            const fromParams = (paramValues[key] ?? '').trim()
            const legacy = emailLegacyParam(node, key)
            const fromDefault = (param.defaultValue ?? '').trim()
            if (!fromParams && !legacy && !fromDefault) {
              issues.push({
                severity: 'error',
                nodeId: node.id,
                field: `paramValues.${key}`,
                code: 'missing_param',
                message: `Required connection parameter "${param.label || key}" is empty`,
              })
            }
          }

          // Object responses may omit a declared schema (opaque JSON); no warning.
        }
      }
    }

    if (node.type === 'entity') {
      const entityId = typeof node.config.entityId === 'string' ? node.config.entityId.trim() : ''
      if (!entityId) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: 'entityId',
          code: 'missing_entity',
          message: 'Entity step requires an entity',
        })
      } else if (ctx.installedEntityIds && !ctx.installedEntityIds.includes(entityId)) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: 'entityId',
          code: 'entity_not_installed',
          message: 'Selected entity is not installed on this chatbot — install it from the Data tab',
        })
      }
    }

    if (node.type === 'integration') {
      const integrationId = node.config.integrationId
      if (typeof integrationId !== 'string' || !integrationId.trim()) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: 'integrationId',
          code: 'missing_integration',
          message: 'Integration step requires an integration',
        })
      } else if (
        ctx.installedIntegrationIds &&
        !ctx.installedIntegrationIds.includes(integrationId.trim())
      ) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: 'integrationId',
          code: 'integration_not_installed',
          message:
            'Selected integration is not installed on this chatbot — install it from the Data tab',
        })
      }
      const action = node.config.action
      if (typeof action !== 'string' || !action.trim()) {
        issues.push({
          severity: 'error',
          nodeId: node.id,
          field: 'action',
          code: 'missing_integration_action',
          message: 'Integration step requires an action',
        })
      }
    }
  }

  const endNodes = nodes.filter((n) => n.type === 'end')
  if (!endNodes.length) {
    issues.push({
      severity: 'warning',
      code: 'no_end',
      message: 'Flow has no End step',
    })
  }

  return issues
}
