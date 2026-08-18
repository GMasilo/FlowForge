import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  chatbotTestScenariosQueryKey,
  createChatbotTestScenario,
  deleteChatbotTestScenario,
  fetchChatbotTestScenarios,
} from '@/features/designer/preview/testScenarioApi'
import { parseScenarioExpected, parseScenarioGlobals } from '@/features/designer/preview/scenarioEval'
import { canEdit } from '@/shared/types/database'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { CollapsibleSection } from '@/shared/ui/collapsible-section'

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

export function TestScenariosPanel({ chatbotId }: { chatbotId: string }) {
  const { role } = useRequiredInstance()
  const { user } = useAuth()
  const editable = canEdit(role)
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [globalsText, setGlobalsText] = useState('{\n  \n}')
  const [variablesText, setVariablesText] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const list = useQuery({
    queryKey: chatbotTestScenariosQueryKey(chatbotId),
    queryFn: () => fetchChatbotTestScenarios(chatbotId),
  })

  const save = useMutation({
    mutationFn: async () => {
      let globals: Record<string, unknown> = {}
      try {
        const parsed = JSON.parse(globalsText || '{}') as unknown
        globals = parseScenarioGlobals(parsed)
      } catch {
        throw new Error('Globals must be a JSON object')
      }
      const expected = {
        variables: variablesText.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean),
        stepKeys: stepsText.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean),
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
      description="Fixture globals for Preview. After a run, Design checks that listed variables exist and step keys succeeded."
      defaultOpen={false}
      badge={
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {list.data?.length ?? 0}
        </span>
      }
    >
      <div className="space-y-4">
        {(list.data ?? []).map((row) => {
          const expected = parseScenarioExpected(row.expected)
          return (
            <Card key={row.id} className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{row.name}</p>
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
            <Label>New scenario</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VIP customer" />
            <Label>Globals JSON</Label>
            <Textarea
              value={globalsText}
              onChange={(e) => setGlobalsText(e.target.value)}
              className="min-h-[88px] font-mono text-[12px]"
              spellCheck={false}
            />
            <Input
              value={variablesText}
              onChange={(e) => setVariablesText(e.target.value)}
              placeholder="Expected variables, e.g. name, cart"
            />
            <Input
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder="Expected succeeding step keys, e.g. ask_name, pay"
            />
            {error ? <FieldError>{error}</FieldError> : null}
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add scenario
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">Editors can add preview fixtures here.</p>
        )}
      </div>
    </CollapsibleSection>
  )
}
