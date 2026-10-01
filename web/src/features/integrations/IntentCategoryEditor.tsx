import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'
type Category = { name: string; examples: string[] }
export function IntentCategoryEditor({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  let categories: Category[] = [], error = ''
  try {
    const parsed = value.trim() ? JSON.parse(value) : []
    if (!Array.isArray(parsed) || parsed.some(c => !c || typeof c.name !== 'string' || !Array.isArray(c.examples) || c.examples.some((s: unknown) => typeof s !== 'string'))) throw new Error()
    categories = parsed
  } catch { error = 'Use a JSON array of categories with a name and example phrases, or clear the JSON to use starter examples.' }
  const save = (items: Category[]) => onChange(JSON.stringify(items, null, 2))
  const sample = [{ name: 'billing', examples: ['How do I pay my fees?', 'I need a refund'] }, { name: 'admissions', examples: ['I want to apply to study', 'What are the entry requirements?'] }]
  return <div className="space-y-3 rounded-lg border border-[var(--color-border)] p-3">
    <p className="text-xs text-[var(--color-ink-muted)]">Give each category a lowercase key and examples of what visitors might say. Add a Switch after this step using the saved result’s data.intent; route unknown to a clarification question. Service errors use the step’s failed run-after path.</p>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    {!error && categories.map((category, index) => <fieldset key={index} className="space-y-2 rounded border border-[var(--color-border)] p-2"><legend>Category {index + 1}</legend>
      <label className="block text-xs">Category key<Input disabled={disabled} value={category.name} placeholder="billing" onChange={e => save(categories.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /></label>
      <label className="block text-xs">Example phrases (one per line)<Textarea disabled={disabled} value={category.examples.join('\n')} onChange={e => save(categories.map((item, i) => i === index ? { ...item, examples: e.target.value.split('\n') } : item))} /></label>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => save(categories.filter((_, i) => i !== index))}>Remove category</Button>
    </fieldset>)}
    <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" disabled={disabled || !!error || categories.length >= 10} onClick={() => save([...categories, { name: '', examples: [''] }])}>Add category</Button>
    {!value.trim() && <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => save(sample)}>Use starter examples</Button>}</div>
  </div>
}
