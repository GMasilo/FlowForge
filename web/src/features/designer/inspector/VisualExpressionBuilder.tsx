import { useId, useState } from 'react'
import { buildExpression, type BuilderAction, type BuilderValue } from './expressionBuilderModel'
import { validateExpressionText } from '../preview/expressionEval'
import type { TemplateSuggestion } from './TemplateField'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
const actions: [BuilderAction, string][] = [['date', 'Format a date'], ['add', 'Add numbers'], ['subtract', 'Subtract numbers'], ['multiply', 'Multiply numbers'], ['divide', 'Divide numbers'], ['join', 'Join text'], ['fallback', 'Use a fallback value'], ['condition', 'Choose a value with a condition']]
export function ExpressionBuilder({ onInsert, suggestions }: { onInsert: (expression: string) => void; suggestions: TemplateSuggestion[] }) {
  const id = useId()
  const [action, setAction] = useState<BuilderAction>('date')
  const [values, setValues] = useState<BuilderValue[]>([{ kind: 'expression', value: 'utcNow()' }, { kind: 'text', value: 'yyyy-MM-dd' }, { kind: 'text', value: '' }])
  const count = action === 'condition' ? 3 : 2
  let expression = '', error = ''
  try { expression = buildExpression(action, values.slice(0, count)); error = validateExpressionText(expression) ?? '' } catch (e) { error = e instanceof Error ? e.message : String(e) }
  const labels = action === 'date' ? ['Date', 'Date format'] : action === 'condition' ? ['Condition', 'Value if true', 'Value if false'] : action === 'fallback' ? ['Value to check', 'Fallback value'] : ['First value', 'Second value']
  return <details className="mt-2 rounded-lg border border-[var(--color-border)] p-2 text-xs">
    <summary className="cursor-pointer font-medium">Build an expression</summary>
    <div className="mt-3 space-y-3">
      <label className="block">What would you like to do?<Select value={action} onChange={e => { const next = e.target.value as BuilderAction; setAction(next); setValues(next === 'date' ? [{ kind: 'expression', value: 'utcNow()' }, { kind: 'text', value: 'yyyy-MM-dd' }, { kind: 'text', value: '' }] : next === 'condition' ? [{ kind: 'expression', value: 'vars.approved == true' }, { kind: 'text', value: 'Approved' }, { kind: 'text', value: 'Pending' }] : ['add', 'subtract', 'multiply', 'divide'].includes(next) ? [{ kind: 'number', value: '10' }, { kind: 'number', value: '2' }, { kind: 'text', value: '' }] : [{ kind: 'text', value: 'Hello' }, { kind: 'text', value: ' there' }, { kind: 'text', value: '' }]) }}>{actions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>
      {values.slice(0, count).map((value, index) => <fieldset key={index} className="space-y-1"><legend>{labels[index]}</legend>
        <Select aria-label={`${labels[index]} type`} value={value.kind} onChange={e => setValues(items => items.map((item, i) => i === index ? { ...item, kind: e.target.value as BuilderValue['kind'] } : item))}><option value="text">Text</option><option value="number">Number</option><option value="expression">Variable or expression</option></Select>
        <Input aria-label={labels[index]} list={value.kind === 'expression' ? id : undefined} value={value.value} onChange={e => setValues(items => items.map((item, i) => i === index ? { ...item, value: e.target.value } : item))} />
      </fieldset>)}
      <datalist id={id}>{suggestions.map((item, index) => <option key={index} value={item.insert}>{item.label}</option>)}</datalist>
      <p className="text-[var(--color-ink-muted)]">Use Text for fixed words, Number for calculations, or choose a variable. Values are resolved when the step runs.</p>
      {error ? <p role="alert" className="text-red-500">{error}</p> : <code className="block break-all">{expression}</code>}
      <Button type="button" size="sm" disabled={!!error} onClick={() => onInsert(expression)}>Insert expression</Button>
    </div>
  </details>
}
