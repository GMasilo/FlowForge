/** Helpers for the switch / case flow step. */

export type SwitchCase = {
  id: string
  /** Literal or template compared to the switch value (string equality). */
  match: string
  /** Optional lane label in linear / canvas UI. */
  label?: string
}

export function newSwitchCaseId(): string {
  return `case_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
}

export function defaultSwitchCases(): SwitchCase[] {
  return [
    { id: newSwitchCaseId(), match: '', label: 'Case 1' },
    { id: newSwitchCaseId(), match: '', label: 'Case 2' },
  ]
}

export function parseSwitchCases(raw: unknown): SwitchCase[] {
  if (!Array.isArray(raw)) return defaultSwitchCases()
  const out: SwitchCase[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newSwitchCaseId()
    const match = typeof row.match === 'string' ? row.match : ''
    const label = typeof row.label === 'string' ? row.label : undefined
    out.push({ id, match, label })
  }
  return out.length ? out : defaultSwitchCases()
}

export function switchCaseLabel(c: SwitchCase, index: number): string {
  const named = c.label?.trim()
  if (named) return named
  const match = c.match.trim()
  if (match) return match.length > 28 ? `${match.slice(0, 27)}…` : match
  return `Case ${index + 1}`
}

/** Branch handles for a switch node: each case id, then `default`. */
export function switchBranchHandles(cases: SwitchCase[]): string[] {
  return [...cases.map((c) => c.id), 'default']
}

export function isSwitchBranchHandle(handle: string | null | undefined, cases: SwitchCase[]): boolean {
  if (!handle) return false
  if (handle === 'default') return true
  return cases.some((c) => c.id === handle)
}
