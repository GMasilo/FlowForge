export type EntityJoin = { entityId: string; alias: string; localColumn: string; foreignColumn: string; kind: 'left' | 'inner' }
type Row = Record<string, unknown>
const safeKey = (key: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !['__proto__', 'prototype', 'constructor'].includes(key)
export function validateEntityJoins(joins: EntityJoin[]): void {
  const aliases = new Set<string>()
  for (const join of joins) {
    if (!join.entityId || !safeKey(join.alias) || aliases.has(join.alias) || !safeKey(join.localColumn) || !safeKey(join.foreignColumn) || !['left', 'inner'].includes(join.kind)) throw new Error('Complete each entity join with a unique alias and valid matching columns.')
    aliases.add(join.alias)
  }
}
function matchKey(value: unknown): string | null {
  if (value === null || value === undefined || value === '' || typeof value === 'object') return null
  return String(value)
}
export async function joinEntityRows(rows: Row[], joins: EntityJoin[], load: (entityId: string) => Promise<Row[]>): Promise<Row[]> {
  validateEntityJoins(joins)
  const baseKeys = new Set(rows.flatMap(row => Object.keys(row)))
  for (const join of joins) if (baseKeys.has(join.alias)) throw new Error(`Join alias "${join.alias}" conflicts with a base column.`)
  let result = rows
  const cache = new Map<string, Row[]>()
  for (const join of joins) {
    const foreign = cache.get(join.entityId) ?? await load(join.entityId)
    cache.set(join.entityId, foreign)
    const index = new Map<string, Row[]>()
    for (const row of foreign) {
      const key = matchKey(row[join.foreignColumn])
      if (key !== null) index.set(key, [...(index.get(key) ?? []), row])
    }
    const next: Row[] = []
    for (const row of result) {
      const key = matchKey(row[join.localColumn])
      const matches = key === null ? [] : index.get(key) ?? []
      for (const match of matches) next.push({ ...row, [join.alias]: match })
      if (!matches.length && join.kind === 'left') next.push({ ...row, [join.alias]: null })
      if (next.length > 5000) throw new Error('Entity join returned more than 5,000 rows. Narrow the base filters or matching columns.')
    }
    result = next
  }
  return result
}
export function selectEntityColumns(rows: Row[], columns: string[]): Row[] {
  if (!columns.length) throw new Error('Select at least one output column or choose All columns.')
  for (const column of columns) if (column.split('.').length > 2 || !column.split('.').every(safeKey)) throw new Error('Invalid selected entity column.')
  return rows.map(row => {
    const output: Row = {}
    for (const column of columns) {
      const [alias, field] = column.split('.')
      if (!field) output[alias] = row[alias] ?? null
      else if (row[alias] == null) output[alias] = null
      else {
        const nested = output[alias] as Row | undefined
        output[alias] = { ...nested, [field]: (row[alias] as Row)[field] ?? null }
      }
    }
    return output
  })
}
