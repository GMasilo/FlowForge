import type { DesignerNode, DesignerEdge } from '@/features/designer/model/flowSchema'
export type GraphChange = { kind: 'added' | 'removed' | 'changed'; key: string; label: string; fields: string[] }
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + stable(v)).join(',') + '}'
  return JSON.stringify(value) ?? 'null'
}
/** Match by stable step key; canvas positions and generated edge IDs are deliberately ignored. */
export function compareGraphs(before: { nodes: DesignerNode[]; edges: DesignerEdge[] }, after: { nodes: DesignerNode[]; edges: DesignerEdge[] }): GraphChange[] {
  const old = new Map(before.nodes.map(n => [n.key, n]))
  const next = new Map(after.nodes.map(n => [n.key, n]))
  const routes = (graph: typeof before, node: DesignerNode) => graph.edges.filter(e => e.source === node.id).map(e => ({ target: graph.nodes.find(n => n.id === e.target)?.key ?? e.target, handle: e.sourceHandle ?? '', label: e.label ?? '' })).sort((a,b) => stable(a).localeCompare(stable(b)))
  const changes: GraphChange[] = []
  for (const [key, node] of old) {
    const newer = next.get(key)
    if (!newer) { changes.push({kind:'removed', key, label:node.label, fields:[]}); continue }
    const fields = ['type','label','config'].filter(f => stable(node[f as keyof DesignerNode]) !== stable(newer[f as keyof DesignerNode]))
    if (stable(routes(before,node)) !== stable(routes(after,newer))) fields.push('routes')
    if (fields.length) changes.push({kind:'changed',key,label:newer.label,fields})
  }
  for (const [key,node] of next) if (!old.has(key)) changes.push({kind:'added',key,label:node.label,fields:[]})
  return changes
}
export function contrastRatio(a: string, b: string): number | null {
  const luminance = (hex: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null
    const c = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4)
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
  }
  const x=luminance(a), y=luminance(b)
  return x === null || y === null ? null : (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
}
export function checkContentQuality(nodes: DesignerNode[]): { nodeId: string; message: string }[] {
  const issues: {nodeId:string;message:string}[]=[]
  for (const node of nodes) {
    const c=node.config
    const add=(message:string)=>issues.push({nodeId:node.id,message})
    if (node.type === 'button' && Array.isArray(c.buttons) && c.buttons.some(b => !b || typeof b !== 'object' || !String(b.label ?? '').trim())) add('Give every button a visible label.')
    if (node.type === 'question' && !String(c.prompt ?? '').trim()) add('Add a question prompt so the response field has context.')
    if (c.bubbleColor && c.bubbleTextColor) { const ratio=contrastRatio(String(c.bubbleColor),String(c.bubbleTextColor)); if (ratio !== null && ratio < 4.5) add(`Text contrast is ${ratio.toFixed(2)}:1; aim for at least 4.5:1.`) }
    if (c.localizedText && typeof c.localizedText === 'object') for (const [locale,text] of Object.entries(c.localizedText)) {
      if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) || typeof text !== 'string' || !text.trim()) add(`Check translation "${locale}": use a language code and non-empty text.`)
      const source=String(c.text ?? c.prompt ?? c.message ?? '')
      const refs=(s:string)=>s.match(/\{\{[^}]+\}\}/g)?.sort().join('|') ?? ''
      if (typeof text === 'string' && refs(text)!==refs(source)) add(`Translation "${locale}" changes the original variable placeholders.`)
    }
  }
  return issues
}
