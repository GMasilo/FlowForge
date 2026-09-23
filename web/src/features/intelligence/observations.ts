export type Observation = { session: string; bot: string; version: string; environment: string; node: string; seq: number; duration: number | null; failed: boolean }
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]! : null
}
export function analyzeObservations(events: Observation[]) {
  const groups = new Map<string, Observation[]>()
  const journeys = new Map<string, Observation[]>()
  for (const e of events) {
    const key = JSON.stringify([e.bot, e.environment, e.node])
    const group = groups.get(key) ?? []; group.push(e); groups.set(key, group)
    const journey = journeys.get(e.session) ?? []; journey.push(e); journeys.set(e.session, journey)
  }
  const steps = [...groups.values()].map(list => {
    const durations = list.flatMap(e => e.duration != null && e.duration >= 0 ? [e.duration] : [])
    const median = percentile(durations, .5), p95 = percentile(durations, .95)
    const mad = median == null ? null : percentile(durations.map(d => Math.abs(d - median)), .5)
    const anomalies = durations.length >= 10 && median != null && mad != null
      ? durations.filter(d => d > median + Math.max(100, 3 * 1.4826 * mad)).length : null
    const versions = [...new Set(list.map(e => e.version))].filter(v => /^\d+$/.test(v)).sort((a, b) => Number(a) - Number(b))
    const previous = versions.at(-2), latest = versions.at(-1)
    const baseline = list.filter(e => e.version === previous), current = list.filter(e => e.version === latest)
    const oldTimes = baseline.flatMap(e => e.duration != null ? [e.duration] : []), newTimes = current.flatMap(e => e.duration != null ? [e.duration] : [])
    const oldMedian = percentile(oldTimes, .5), newMedian = percentile(newTimes, .5)
    const latencyRegression = oldTimes.length >= 10 && newTimes.length >= 10 && oldMedian != null && newMedian != null && newMedian > oldMedian * 1.25 && newMedian - oldMedian > 100
    const failureRegression = baseline.length >= 20 && current.length >= 20 && current.filter(e => e.failed).length / current.length - baseline.filter(e => e.failed).length / baseline.length >= .1
    return { bot: list[0]!.bot, environment: list[0]!.environment, node: list[0]!.node, count: list.length,
      failures: list.filter(e => e.failed).length, median, p95, anomalies,
      totalMs: durations.reduce((a, b) => a + b, 0), regression: latencyRegression || failureRegression,
      comparison: previous && latest ? `${previous} → ${latest}` : null }
  }).sort((a, b) => b.totalMs - a.totalMs)
  const transitions = new Map<string, { from: string; to: string; bot: string; count: number }>()
  for (const list of journeys.values()) {
    const sorted = [...list].sort((a, b) => a.seq - b.seq)
    for (let i = 1; i < sorted.length; i++) {
      const from = sorted[i - 1]!, to = sorted[i]!
      if (to.seq !== from.seq + 1) continue // Do not invent journeys across missing events.
      const key = JSON.stringify([from.bot, from.environment, from.node, to.node])
      const row = transitions.get(key) ?? { bot: from.bot, from: from.node, to: to.node, count: 0 }
      row.count++; transitions.set(key, row)
    }
  }
  return { steps, transitions: [...transitions.values()].sort((a, b) => b.count - a.count), sessions: journeys.size }
}
