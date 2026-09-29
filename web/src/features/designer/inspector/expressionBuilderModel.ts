export type BuilderAction = 'date' | 'add' | 'subtract' | 'multiply' | 'divide' | 'join' | 'fallback' | 'condition'
export type BuilderValue = { kind: 'text' | 'number' | 'expression'; value: string }
export function builderValue(value: BuilderValue): string {
  if (value.kind === 'text') return JSON.stringify(value.value)
  if (value.kind === 'number') {
    if (!value.value.trim() || !Number.isFinite(Number(value.value))) throw new Error('Enter a valid number.')
    return String(Number(value.value))
  }
  const source = value.value.trim().replace(/^\{\{([\s\S]*)\}\}$/, '$1').trim()
  if (!source) throw new Error('Choose a variable or enter an expression.')
  return source
}
export function buildExpression(action: BuilderAction, values: BuilderValue[]): string {
  const args = values.map(builderValue)
  const operators = { add: '+', subtract: '-', multiply: '*', divide: '/' }
  if (action in operators) return `{{(${args[0]}) ${operators[action as keyof typeof operators]} (${args[1]})}}`
  const fn = { date: 'formatDate', join: 'concat', fallback: 'coalesce', condition: 'if' }[action as 'date' | 'join' | 'fallback' | 'condition']
  return `{{${fn}(${args.join(', ')})}}`
}
