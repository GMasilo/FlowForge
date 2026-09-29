import type { DesignerNode } from '@/features/designer/model/flowSchema'
import { scenarioSuggestions, addScenarioName, addScenarioEntry, addScenarioAnswer } from './scenarioSuggestions'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  chatbotTestScenariosQueryKey,
  createChatbotTestScenario,
  deleteChatbotTestScenario,
  updateChatbotTestScenario,
  fetchChatbotTestScenarios,
} from '@/features/designer/preview/testScenarioApi'
import { parseScenarioExpected, parseScenarioGlobals } from '@/features/designer/preview/scenarioEval'
import { canEdit, type Json } from '@/shared/types/database'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { SECTION_HELP } from '@/shared/help/pageHelp'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function FlowSuggestion({label,options,onPick}:{label:string;options:{key:string;label:string}[];onPick:(key:string)=>void}) {
  return <label className="block text-xs text-[var(--color-ink-muted)]">{label}<select aria-label={label} value="" disabled={!options.length} onChange={e=>{if(e.target.value)onPick(e.target.value)}} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm text-[var(--color-ink)]"><option value="">{options.length?'Choose from the flow…':'No matching items in this flow'}</option>{options.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
}

export function TestScenariosPanel({ chatbotId, nodes, globals = {}, flowLoading = false, flowError }: { chatbotId: string; nodes: DesignerNode[]; globals?: Record<string, unknown>; flowLoading?: boolean; flowError?: string }) {
  const { role } = useRequiredInstance()
  const { user } = useAuth()
  const editable = canEdit(role)
  const qc = useQueryClient()
  const suggestions = scenarioSuggestions(nodes, globals)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mocksText, setMocksText] = useState('{}')
  const [answersText, setAnswersText] = useState('[]')
  const [valuesText, setValuesText] = useState('{}')
  const [name, setName] = useState('')
  const [globalsText, setGlobalsText] = useState('{\n  \n}')
  const [variablesText, setVariablesText] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function addSuggestion(action:()=>void) { try { action();setError(null) } catch(e) {setError(e instanceof Error?e.message:String(e))} }

  const list = useQuery({
    queryKey: chatbotTestScenariosQueryKey(chatbotId),
    queryFn: () => fetchChatbotTestScenarios(chatbotId),
  })

  const save = useMutation({
    mutationFn: async () => {
      let globals: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(globalsText || '{}') as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
        globals = parseScenarioGlobals(parsed)
      } catch {
        throw new Error('Globals must be a JSON object')
      }
      let answers: unknown
      let values: unknown
      try {
        answers = JSON.parse(answersText)
        values = JSON.parse(valuesText)
      } catch { throw new Error('Answers and expected values must be valid JSON') }
      if (!Array.isArray(answers) || answers.some(a => !a || typeof a !== 'object' || typeof a.step !== 'string' || !Object.prototype.hasOwnProperty.call(a, 'value'))) throw new Error('Answers must be an array of { "step": "step_key", "value": "answer" } objects')
      if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Expected values must be a JSON object')
      const mocks = JSON.parse(mocksText)
      if (!mocks || typeof mocks !== 'object' || Array.isArray(mocks)) throw new Error('Mocks must be an object keyed by step key')
      const expected = {
        mocks,
        answers,
        values,
        variables: variablesText.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean),
        stepKeys: stepsText.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean),
      }
      if (editingId) {
        await updateChatbotTestScenario(editingId, { name: name.trim() || 'Untitled scenario', globals: globals as Json, expected: expected as Json })
        return
      }
      await createChatbotTestScenario({
        chatbotId,
        name: name.trim() || 'Untitled scenario',
        globals,
        expected,
        createdBy: user?.id ?? null,
      })
    },
    onSuccess: async () => {
      setError(null)
      setEditingId(null)
      setMocksText('{}')
      setAnswersText('[]')
      setValuesText('{}')
      setName('')
      setGlobalsText('{\n  \n}')
      setVariablesText('')
      setStepsText('')
      await qc.invalidateQueries({ queryKey: chatbotTestScenariosQueryKey(chatbotId) })
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: deleteChatbotTestScenario,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chatbotTestScenariosQueryKey(chatbotId) })
    },
  })

  return (
    <CollapsibleSection
      title="Test scenarios"
      description="Save starting variables, scripted answers and expected results. Run automatic checks in Design, or use fixtures in Preview."
      help={SECTION_HELP.testScenarios}
      defaultOpen={false}
      badge={
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {list.data?.length ?? 0}
        </span>
      }
    >
      <div className="space-y-4">
        {list.isPending ? <p role="status">Loading scenarios…</p> : null}
        {list.error ? <FieldError>{list.error.message}</FieldError> : null}
        {remove.error ? <FieldError>{remove.error.message}</FieldError> : null}
        {(list.data ?? []).map((row) => {
          const expected = parseScenarioExpected(row.expected)
          return (
            <Card key={row.id} className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                {editable ? <Button size="sm" variant="ghost" onClick={() => {
                  setEditingId(row.id); setName(row.name); setGlobalsText(prettyJson(row.globals))
                  setVariablesText(expected.variables?.join(', ') ?? ''); setStepsText(expected.stepKeys?.join(', ') ?? '')
                  const raw = parseScenarioGlobals(row.expected)
                  setMocksText(prettyJson(raw.mocks ?? {}))
                  setAnswersText(prettyJson(raw.answers ?? [])); setValuesText(prettyJson(raw.values ?? {})); setError(null)
                }}>Edit</Button> : null}
                {editable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(row.id)}
                    aria-label={`Delete ${row.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <pre className="overflow-x-auto font-mono text-[11px] text-slate-600">{prettyJson(row.globals)}</pre>
              <p className="text-[11px] text-slate-500">
                Vars: {expected.variables?.join(', ') || '—'} · Steps: {expected.stepKeys?.join(', ') || '—'}
              </p>
            </Card>
          )
        })}

        {editable ? (
          <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-3">
            <Label>{editingId ? 'Edit scenario' : 'New scenario'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP customer" />
            <p className="text-xs text-[var(--color-ink-muted)]">Suggestions come from this chatbot’s flow. Choose the variables and steps your scenario should reach; different branches may produce different outputs. Expected values are yours to define.</p>
            {flowLoading?<p role="status" className="text-xs">Loading flow suggestions…</p>:null}
            {flowError?<FieldError>Could not load flow suggestions: {flowError}</FieldError>:null}
            <FlowSuggestion label="Add a starting global with its configured default" options={Object.keys(globals).map(key=>({key,label:key}))} onPick={key=>addSuggestion(()=>setGlobalsText(addScenarioEntry(globalsText,key,globals[key])))}/>
            <Label>Globals JSON</Label>
            <Textarea
              value={globalsText}
              onChange={(e) => setGlobalsText(e.target.value)}
              className="min-h-[88px] font-mono text-[12px]"
              spellCheck={false}
            />
            <FlowSuggestion label="Add an expected variable from the flow" options={suggestions.variables} onPick={key=>setVariablesText(addScenarioName(variablesText,key))}/>
            <Input
              aria-label="Expected variables"
              value={variablesText}
              onChange={(e) => setVariablesText(e.target.value)}
              placeholder="Expected variables, e.g. name, cart"
            />
            <FlowSuggestion label="Add an expected succeeding step" options={suggestions.steps} onPick={key=>setStepsText(addScenarioName(stepsText,key))}/>
            <Input
              aria-label="Expected succeeding steps"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder="Expected succeeding step keys, e.g. ask_name, pay"
            />
            <FlowSuggestion label="Append a question or button answer" options={suggestions.answers} onPick={key=>addSuggestion(()=>setAnswersText(addScenarioAnswer(answersText,key)))}/>
            <p className="text-xs text-[var(--color-ink-muted)]">Fill in the added answer and arrange answers in conversation order. Repeated steps are allowed for loops.</p>
            <Label>Scripted answers (in conversation order)</Label>
            <p className="text-xs text-[var(--color-ink-muted)]">Use step keys. Repeat a step for repeated questions. Example: [{'{"step":"ask_name","value":"Alex"}'}]</p>
            <Textarea value={answersText} onChange={e => setAnswersText(e.target.value)} className="font-mono text-xs" spellCheck={false} />
            <FlowSuggestion label="Add a mocked connection step" options={suggestions.mocks} onPick={key=>addSuggestion(()=>setMocksText(addScenarioEntry(mocksText,key,{value:null,status:'Succeeded'})))}/>
            <p className="text-xs text-[var(--color-ink-muted)]">Replace the null mock value with the test response you want the connection to return.</p>
            <Label>Mocked connection results</Label><p className="text-xs text-[var(--color-ink-muted)]">Optional fixtures keyed by step: {'{"lookup":{"value":{"name":"Alex"},"status":"Succeeded"}}'}. A mocked pass does not verify the real service.</p><Textarea value={mocksText} onChange={e=>setMocksText(e.target.value)} className="font-mono text-xs" spellCheck={false}/>
            <FlowSuggestion label="Add a variable value assertion" options={suggestions.variables} onPick={key=>addSuggestion(()=>setValuesText(addScenarioEntry(valuesText,key,null)))}/>
            <p className="text-xs text-[var(--color-ink-muted)]">Replace null with your expected result, or keep it only when null is the intended result. Runtime results are not inferred from defaults.</p>
            <Label>Expected variable values</Label>
            <Textarea value={valuesText} onChange={e => setValuesText(e.target.value)} placeholder={'{"name":"Alex"}'} className="font-mono text-xs" spellCheck={false} />
            {error ? <FieldError>{error}</FieldError> : null}
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {editingId ? 'Save scenario' : 'Add scenario'}
            </Button>
            {editingId ? <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setMocksText('{}'); setName(''); setGlobalsText('{}'); setAnswersText('[]'); setValuesText('{}'); setVariablesText(''); setStepsText(''); setError(null) }}>Cancel editing</Button> : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">Editors can add preview fixtures here.</p>
        )}
      </div>
    </CollapsibleSection>
  )
}
