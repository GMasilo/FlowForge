/** Restart chat step helpers. */

export function readRestartClearCookies(config: Record<string, unknown> | undefined | null): boolean {
  return config?.clearCookies === true
}
