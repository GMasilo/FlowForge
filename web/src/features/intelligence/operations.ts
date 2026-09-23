export type WorkItem = { id: string; priority: number; created_at: string; sla_due_at: string | null; assigned_to: string | null; queue_id: string | null }
export type AvailableAgent = { user_id: string; status: string; last_seen_at: string }
export function planOperations(items: WorkItem[], agents: AvailableAgent[], now: number, serviceMinutes: number, arrivalsPerHour: number, capacity: number) {
  const online = agents.filter(a => a.status === 'online' && now - Date.parse(a.last_seen_at) >= 0 && now - Date.parse(a.last_seen_at) <= 90_000)
  const load = new Map(online.map(a => [a.user_id, items.filter(i => i.assigned_to === a.user_id).length]))
  const ranked = [...items].filter(i => !i.assigned_to).map(item => {
    const age = Math.max(0, (now - Date.parse(item.created_at)) / 60_000) || 0
    const due = item.sla_due_at ? Date.parse(item.sla_due_at) : NaN
    const slack = (due - now) / 60_000
    const score = Math.max(0, item.priority) * 100 + Math.min(age, 240) + (Number.isFinite(slack) ? (slack <= 0 ? 1000 : Math.max(0, 120 - slack) * 4) : 0)
    return { ...item, score, slack }
  }).sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const recommendations = ranked.map(item => {
    const candidate = [...load].filter(([, count]) => count < capacity).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]
    if (candidate) load.set(candidate[0], candidate[1] + 1)
    const wait = candidate ? candidate[1] * serviceMinutes : null
    return { ...item, agent: candidate?.[0] ?? null, wait, slaRisk: Number.isFinite(item.slack) && (item.slack <= 0 || wait == null || wait + serviceMinutes > item.slack) }
  })
  const throughput = serviceMinutes > 0 ? online.length * 60 / serviceMinutes : 0
  return { recommendations, online: online.length, throughput,
    forecastQueue: Math.max(0, Math.ceil(items.length + arrivalsPerHour - throughput)),
    drainMinutes: items.length === 0 ? 0 : throughput > arrivalsPerHour ? items.length / (throughput - arrivalsPerHour) * 60 : null }
}
