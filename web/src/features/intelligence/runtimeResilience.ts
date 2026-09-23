type Result = { status: number; headers?: Record<string, string> }
type State = { failures: number; openUntil: number; probe: boolean; tokens: number; at: number }
/** Per-browser protection for read-only HTTP steps. Server quotas remain authoritative. */
export class RuntimeResilience {
  private states = new Map<string, State>()
  private now: () => number
  private sleep: (ms: number, signal?: AbortSignal) => Promise<void>
  private random: () => number
  constructor(now = () => Date.now(), sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true })
  }), random = Math.random) { this.now = now; this.sleep = sleep; this.random = random }

  async run<T extends Result>(key: string, method: string, invoke: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    // Writes are never replayed or blocked by a read-only circuit.
    if (!['GET', 'HEAD'].includes(method.toUpperCase())) return invoke()
    const now = this.now()
    for (const [id, state] of this.states) if (now - state.at > 300_000 && !state.probe) this.states.delete(id)
    const state = this.states.get(key) ?? { failures: 0, openUntil: 0, probe: false, tokens: 10, at: now }
    this.states.set(key, state)
    if (state.openUntil > now || state.probe) throw new Error('Connection temporarily paused after repeated failures. Retry shortly.')
    const probing = state.openUntil > 0
    if (probing) state.probe = true
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
        const time = this.now()
        state.tokens = Math.min(10, state.tokens + Math.max(0, time - state.at) / 1000); state.at = time
        if (state.tokens < 1) throw new Error('Read request limit reached. Wait a moment before trying again.')
        state.tokens--
        // Transport exceptions are not retried: the API may have processed a request.
        const result = await invoke()
        const transient = [408, 429, 500, 502, 503, 504].includes(result.status)
        if (!transient) { state.failures = 0; state.openUntil = 0; return result }
        state.failures++
        if (state.failures >= 5 || probing) state.openUntil = this.now() + 30_000
        if (attempt === 2 || state.openUntil > this.now()) return result
        const retryAfter = Object.entries(result.headers ?? {}).find(([h]) => h.toLowerCase() === 'retry-after')?.[1]
        const retryMs = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - this.now()) : 0
        // Never retry earlier than a long server-directed delay; return control instead.
        if (retryMs > 5000) return result
        await this.sleep(Math.max(Number.isFinite(retryMs) ? retryMs : 0, 250 * 2 ** attempt * (0.5 + this.random())), signal)
      }
      throw new Error('Read request failed')
    } finally { state.probe = false }
  }
}
export const runtimeResilience = new RuntimeResilience()
