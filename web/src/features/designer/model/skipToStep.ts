/** Skip-to step: jump to another step by key (same target model as Button → Skip to step). */

export function readSkipToTargetKey(config: Record<string, unknown> | undefined | null): string {
  return String(config?.targetNodeKey ?? '').trim()
}
