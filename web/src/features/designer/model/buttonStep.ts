/** Helpers for the Button flow step (action buttons + interaction listeners). */

import { parseFunctionParams } from '@/features/designer/model/flowFunctions'

export const BUTTON_LISTENER_EVENTS = ['click', 'hover', 'dblclick', 'focus', 'blur'] as const
export type ButtonListenerEvent = (typeof BUTTON_LISTENER_EVENTS)[number]

export const BUTTON_LISTENER_ACTIONS = ['continue', 'emit_event', 'run_function', 'skip_to'] as const
export type ButtonListenerAction = (typeof BUTTON_LISTENER_ACTIONS)[number]

export const BUTTON_LISTENER_EVENT_OPTIONS: Array<{ value: ButtonListenerEvent; label: string }> = [
  { value: 'click', label: 'Click' },
  { value: 'hover', label: 'Hover' },
  { value: 'dblclick', label: 'Double-click' },
  { value: 'focus', label: 'Focus' },
  { value: 'blur', label: 'Blur' },
]

export const BUTTON_LISTENER_ACTION_OPTIONS: Array<{
  value: ButtonListenerAction
  label: string
  hint: string
}> = [
  { value: 'continue', label: 'Continue flow', hint: 'Store the value and advance to the next step' },
  { value: 'emit_event', label: 'Emit event', hint: 'postMessage flow_event to the embed host' },
  { value: 'run_function', label: 'Run function', hint: 'Call a built-in like setVar(varName, varValue), or a host function' },
  { value: 'skip_to', label: 'Skip to step', hint: 'Jump to a chosen step instead of the next edge' },
]

export type ButtonListener = {
  id: string
  event: ButtonListenerEvent
  action: ButtonListenerAction
  /** emit_event */
  eventName: string
  eventPayload: string
  /** run_function — catalog name, e.g. setVar */
  functionName: string
  /** @deprecated Prefer functionParams */
  functionArgs: string
  /** run_function — named parameters from the catalog */
  functionParams: Record<string, string>
  /** skip_to — target step key */
  skipToNodeKey: string
}

export type ButtonOption = {
  id: string
  label: string
  /** Stored / emitted value; defaults to label when empty. */
  value: string
  listeners: ButtonListener[]
}

export type ResolvedButtonListener = {
  event: ButtonListenerEvent
  action: ButtonListenerAction
  eventName: string
  eventPayload: string
  functionName: string
  functionArgs: string
  functionParams: Record<string, string>
  skipToNodeKey: string
}

export type ResolvedButtonOption = {
  id: string
  label: string
  value: string
  listeners: ResolvedButtonListener[]
}

export function newButtonOptionId(): string {
  return `btn_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
}

export function newButtonListenerId(): string {
  return `lst_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
}

export function emptyButtonListener(
  partial?: Partial<Omit<ButtonListener, 'id'>> & { id?: string },
): ButtonListener {
  return {
    id: partial?.id ?? newButtonListenerId(),
    event: partial?.event ?? 'click',
    action: partial?.action ?? 'continue',
    eventName: partial?.eventName ?? 'button_click',
    eventPayload: partial?.eventPayload ?? '',
    functionName: partial?.functionName ?? '',
    functionArgs: partial?.functionArgs ?? '',
    functionParams: partial?.functionParams ?? {},
    skipToNodeKey: partial?.skipToNodeKey ?? '',
  }
}

export function emptyButtonOption(label = 'Continue'): ButtonOption {
  return {
    id: newButtonOptionId(),
    label,
    value: label.toLowerCase().replace(/\s+/g, '_') || 'continue',
    listeners: [emptyButtonListener({ event: 'click', action: 'continue' })],
  }
}

function parseListenerEvent(raw: unknown): ButtonListenerEvent {
  return BUTTON_LISTENER_EVENTS.includes(raw as ButtonListenerEvent)
    ? (raw as ButtonListenerEvent)
    : 'click'
}

function parseListenerAction(raw: unknown): ButtonListenerAction {
  return BUTTON_LISTENER_ACTIONS.includes(raw as ButtonListenerAction)
    ? (raw as ButtonListenerAction)
    : 'continue'
}

export function parseButtonListeners(raw: unknown): ButtonListener[] {
  if (!Array.isArray(raw) || !raw.length) {
    return [emptyButtonListener({ event: 'click', action: 'continue' })]
  }
  const out: ButtonListener[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    out.push(
      emptyButtonListener({
        id:
          typeof row.id === 'string' && row.id.trim()
            ? row.id.trim()
            : newButtonListenerId(),
        event: parseListenerEvent(row.event),
        action: parseListenerAction(row.action),
        eventName: typeof row.eventName === 'string' ? row.eventName : 'button_click',
        eventPayload: typeof row.eventPayload === 'string' ? row.eventPayload : '',
        functionName: typeof row.functionName === 'string' ? row.functionName : '',
        functionArgs: typeof row.functionArgs === 'string' ? row.functionArgs : '',
        functionParams: parseFunctionParams(
          row.functionParams,
          typeof row.functionArgs === 'string' ? row.functionArgs : '',
        ),
        skipToNodeKey: typeof row.skipToNodeKey === 'string' ? row.skipToNodeKey : '',
      }),
    )
  }
  return out.length ? out : [emptyButtonListener({ event: 'click', action: 'continue' })]
}

/** Migrate legacy emitEvent / listen* step config into per-button listeners when missing. */
function legacyListenersFromConfig(config: Record<string, unknown> | undefined): ButtonListener[] | null {
  if (!config) return null
  if (Array.isArray(config.buttons)) {
    const first = config.buttons[0]
    if (first && typeof first === 'object' && !Array.isArray(first) && 'listeners' in first) {
      return null
    }
  }
  const listeners: ButtonListener[] = [
    emptyButtonListener({ event: 'click', action: 'continue' }),
  ]
  if (config.emitEvent !== false) {
    listeners.push(
      emptyButtonListener({
        event: 'click',
        action: 'emit_event',
        eventName: typeof config.eventName === 'string' ? config.eventName : 'button_click',
        eventPayload: typeof config.eventPayload === 'string' ? config.eventPayload : '',
      }),
    )
  }
  return listeners
}

export function parseButtonOptions(
  raw: unknown,
  legacyConfig?: Record<string, unknown>,
): ButtonOption[] {
  const legacy = legacyListenersFromConfig(legacyConfig)
  if (!Array.isArray(raw) || !raw.length) {
    const opt = emptyButtonOption()
    if (legacy) opt.listeners = legacy
    return [opt]
  }
  const out: ButtonOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label : ''
    const value = typeof row.value === 'string' ? row.value : ''
    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id.trim()
        : newButtonOptionId()
    const hasOwnListeners = Array.isArray(row.listeners)
    out.push({
      id,
      label,
      value,
      listeners: hasOwnListeners
        ? parseButtonListeners(row.listeners)
        : legacy ?? [emptyButtonListener({ event: 'click', action: 'continue' })],
    })
  }
  return out.length ? out : [emptyButtonOption()]
}

/** Resolved buttons ready for chat UI (label required). */
export function resolveButtonOptions(
  config: Record<string, unknown>,
  interpolate: (raw: string) => string,
): ResolvedButtonOption[] {
  const rows = parseButtonOptions(config.buttons, config)
  const out: ResolvedButtonOption[] = []
  for (const row of rows) {
    const label = interpolate(row.label).trim()
    if (!label) continue
    const valueRaw = row.value.trim() ? interpolate(row.value).trim() : label
    const listeners: ResolvedButtonListener[] = row.listeners.map((lst) => {
      const params: Record<string, string> = {}
      for (const [k, v] of Object.entries(lst.functionParams ?? {})) {
        params[k] = interpolate(v)
      }
      // Legacy: single JSON blob in functionArgs
      if (!Object.keys(params).length && lst.functionArgs.trim()) {
        const legacy = parseFunctionParams(undefined, interpolate(lst.functionArgs))
        for (const [k, v] of Object.entries(legacy)) params[k] = interpolate(v)
      }
      return {
        event: lst.event,
        action: lst.action,
        eventName: interpolate(lst.eventName).trim() || 'button_click',
        eventPayload: interpolate(lst.eventPayload),
        functionName: interpolate(lst.functionName).trim(),
        functionArgs: interpolate(lst.functionArgs),
        functionParams: params,
        skipToNodeKey: interpolate(lst.skipToNodeKey).trim(),
      }
    })
    out.push({
      id: row.id,
      label,
      value: valueRaw || label,
      listeners: listeners.length
        ? listeners
        : [
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
          ],
    })
  }
  if (!out.length) {
    return [
      {
        id: 'fallback',
        label: 'Continue',
        value: 'continue',
        listeners: [
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
        ],
      },
    ]
  }
  return out
}

export function buttonValueOf(option: { label: string; value: string }): string {
  return option.value.trim() || option.label
}

/** Variable keys a Button step may write (outputVariable + Run function assignments). */
export function buttonAssignedVariableKeys(config: Record<string, unknown>): string[] {
  const keys = new Set<string>()
  const output = String(config.outputVariable ?? '').trim()
  if (output) keys.add(output)

  for (const btn of parseButtonOptions(config.buttons, config)) {
    for (const lst of btn.listeners) {
      if (lst.action !== 'run_function') continue
      const name = lst.functionName.trim()
      if (!name) continue
      const params = lst.functionParams ?? {}
      if (name === 'setVar') {
        const varName = String(params.varName ?? '').trim()
        if (varName) keys.add(varName)
        continue
      }
      const resultVar = String(params.resultVariable ?? '').trim()
      if (resultVar) keys.add(resultVar)
    }
  }
  return [...keys]
}

export function listenersForEvent(
  button: ResolvedButtonOption,
  event: ButtonListenerEvent,
): ResolvedButtonListener[] {
  return button.listeners.filter((l) => l.event === event)
}

/** True when the action advances the flow (continue or skip_to). */
export function listenerAdvancesFlow(action: ButtonListenerAction): boolean {
  return action === 'continue' || action === 'skip_to'
}
