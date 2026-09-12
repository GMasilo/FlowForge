import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  Clock3,
  Copy,
  Download,
  FileDown,
  FilePenLine,
  KeyRound,
  LayoutList,
  Mail,
  MessageSquare,
  Receipt,
  Scale,
  Search,
  ShoppingCart,
  CircleHelp,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { mediaKeyFromFilename } from '@/features/designer/model/chatbotMedia'
import { absoluteInstanceFileUrl } from '@/shared/lib/flowforgeApi'
import { supabase } from '@/shared/lib/supabase'
import { canEdit, type ChatbotTemplate } from '@/shared/types/database'
import { useTemplateActions } from '@/features/templates/useTemplateActions'
import {
  getTemplatePreview,
  sortTemplates,
  readTemplateFromFile,
} from '@/features/templates/templateHelpers'
import {
  chatbotTemplatesQueryKey,
  createChatbotTemplate,
  deleteChatbotTemplate,
  fetchChatbotTemplates,
  updateChatbotTemplate,
} from '@/features/templates/templateApi'
import { TemplateContentEditor } from '@/features/templates/TemplateContentEditor'
import {
  emptyTemplateContent,
  insertSnippet,
  inputSuggestionsFromTemplate,
  isTemplateKind,
  keyFromTemplateName,
  parseTemplateContent,
  starterTemplateContent,
  templateInputsOf,
  TEMPLATE_KIND_META,
  TEMPLATE_KINDS,
  type TemplateContent,
  type TemplateKind,
} from '@/features/templates/templateModel'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { cn } from '@/shared/lib/utils'

const KIND_ICONS: Record<TemplateKind, typeof Mail> = {
  email: Mail,
  faq: CircleHelp,
  cart: ShoppingCart,
  menu: LayoutList,
  message: MessageSquare,
  hours: Clock3,
  legal: Scale,
  receipt: Receipt,
  document: FileDown,
  agreement: FilePenLine,
  sso: KeyRound,
}

type EditorState = {
  id?: string
  kind: TemplateKind
  name: string
  key: string
  description: string
  content: TemplateContent
}

function snippetPreview(row: ChatbotTemplate): string {
  if (!isTemplateKind(row.kind)) return ''
  return getTemplatePreview(row, 120)
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy insert snippet"
      className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[var(--color-accent-soft)] px-2 py-0.5 font-mono text-[12px] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20 transition hover:opacity-90"
    >
      <span className="truncate">{value}</span>
      {copied ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  )
}

export function TemplatesPage() {
  const { chatbotId } = useParams()
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const editable = canEdit(role)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | TemplateKind>('all')
  const [sortBy, setSortBy] = useState<'name' | 'key' | 'kind' | 'updated'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const templateActions = useTemplateActions(chatbotId)

  const chatbot = useQuery({
    queryKey: ['chatbot', chatbotId],
    enabled: !!chatbotId,
    queryFn: async () => {
      const { data, error: qError } = await supabase.from('chatbots').select('*').eq('id', chatbotId!).single()
      if (qError) throw qError
      return data
    },
  })

  const templates = useQuery({
    queryKey: chatbotId ? chatbotTemplatesQueryKey(chatbotId) : ['chatbot-templates', 'none'],
    enabled: !!chatbotId,
    queryFn: () => fetchChatbotTemplates(chatbotId!),
  })

  const mediaQuery = useChatbotMedia(instance.id, chatbotId)
  const media = useMemo(
    () =>
      (mediaQuery.data ?? []).map((f) => ({
        filename: f.filename,
        key: f.key || mediaKeyFromFilename(f.filename),
        url: absoluteInstanceFileUrl(f.url),
        mime: f.mime,
      })),
    [mediaQuery.data],
  )

  const suggestions = useMemo(() => {
    const fromTemplates = (templates.data ?? []).map((row) => ({
      insert: insertSnippet(row.key, row.kind),
      label: row.key,
      group: 'Templates',
      detail: row.name,
    }))
    const fromInputs = editor
      ? inputSuggestionsFromTemplate(templateInputsOf(editor.content)).map((row) => ({
          insert: row.insert,
          label: row.label,
          group: 'Inputs',
          detail: row.hint,
        }))
      : []
    return [...fromInputs, ...fromTemplates]
  }, [templates.data, editor])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = (templates.data ?? []).filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.key.toLowerCase().includes(q) ||
        (row.description ?? '').toLowerCase().includes(q)
      )
    })
    return sortTemplates(rows, sortBy, sortOrder)
  }, [templates.data, kindFilter, query, sortBy, sortOrder])

  const save = useMutation({
    mutationFn: async (draft: EditorState) => {
      if (!chatbotId) throw new Error('Chatbot not loaded')
      const key = draft.key.trim() || keyFromTemplateName(draft.name, draft.kind)
      if (draft.id) {
        await updateChatbotTemplate(draft.id, {
          name: draft.name.trim(),
          key,
          description: draft.description.trim() || null,
          content: draft.content as ChatbotTemplate['content'],
        })
        return
      }
      await createChatbotTemplate({
        chatbotId,
        key,
        name: draft.name.trim(),
        description: draft.description,
        kind: draft.kind,
        content: draft.content,
        createdBy: user?.id,
      })
    },
    onSuccess: async () => {
      setError(null)
      setEditor(null)
      if (chatbotId) await qc.invalidateQueries({ queryKey: chatbotTemplatesQueryKey(chatbotId) })
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: deleteChatbotTemplate,
    onSuccess: async () => {
      setEditor(null)
      if (chatbotId) await qc.invalidateQueries({ queryKey: chatbotTemplatesQueryKey(chatbotId) })
    },
    onError: (err: Error) => setError(err.message),
  })

  function startCreate(kind: TemplateKind, example: boolean) {
    const label = TEMPLATE_KIND_META[kind].label
    setError(null)
    setEditor({
      kind,
      name: example ? `Sample ${label}` : `New ${label}`,
      key: '',
      description: TEMPLATE_KIND_META[kind].hint,
      content: example ? starterTemplateContent(kind) : emptyTemplateContent(kind),
    })
  }

  function startEdit(row: ChatbotTemplate) {
    if (!isTemplateKind(row.kind)) return
    setError(null)
    setEditor({
      id: row.id,
      kind: row.kind,
      name: row.name,
      key: row.key,
      description: row.description ?? '',
      content: parseTemplateContent(row.kind, row.content),
    })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editor) return
    if (!editor.name.trim()) {
      setError('Name is required')
      return
    }
    save.mutate(editor)
  }

  async function handleDuplicate(template: ChatbotTemplate) {
    if (!chatbotId) return
    try {
      setError(null)
      await templateActions.duplicate(template.id, `${template.name} (Copy)`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate template')
    }
  }

  async function handleExport(templateIds: string[]) {
    try {
      setError(null)
      await templateActions.export(templateIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export templates')
    }
  }

  async function handleImportFile() {
    if (!chatbotId) return
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    try {
      setError(null)
      const data = await readTemplateFromFile(file)
      await templateActions.import(chatbotId, data.templates, false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import templates')
    }
  }

  function toggleSelection(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map((t) => t.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function handleBulkExport() {
    if (selected.size === 0) return
    await handleExport(Array.from(selected))
    clearSelection()
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    const confirmed = window.confirm(
      `Delete ${selected.size} template${selected.size > 1 ? 's' : ''}? Steps that insert these keys will show empty text.`,
    )
    if (!confirmed) return

    try {
      setError(null)
      await Promise.all(Array.from(selected).map((id) => deleteChatbotTemplate(id)))
      if (chatbotId) await qc.invalidateQueries({ queryKey: chatbotTemplatesQueryKey(chatbotId) })
      clearSelection()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete templates')
    }
  }

  function cycleSortOrder() {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  if (chatbot.isLoading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading templates…</p>
  }

  const bot = chatbot.data
  if (!bot) {
    return <p className="text-sm text-[var(--color-danger)]">Chatbot not found.</p>
  }

  return (
    <div className="space-y-6 ff-page-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--color-ink-muted)]">
            <Link to={`/instances/${instance.id}`} className="hover:text-[var(--color-accent)] hover:underline">
              Chatbots
            </Link>
            {' / '}
            {bot.name}
          </div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Reusable email HTML, help menus, store catalogs, and copy you can insert in flow steps as{' '}
            <code className="font-mono text-[12px]">{'{{templates.key}}'}</code>
          </p>
        </div>
        <ChatbotSubNav instanceId={instance.id} chatbotId={bot.id} />
      </div>

      {editor ? (
        <Card className="space-y-4 border-[var(--color-accent)]/35 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-accent-soft)]/35">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                {editor.id ? 'Edit template' : 'New template'} · {TEMPLATE_KIND_META[editor.kind].label}
              </p>
              <p className="text-sm text-[var(--color-ink-muted)]">{TEMPLATE_KIND_META[editor.kind].hint}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditor(null)}>
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </Button>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  disabled={!editable}
                  value={editor.name}
                  onChange={(e) =>
                    setEditor((prev) =>
                      prev
                        ? {
                            ...prev,
                            name: e.target.value,
                            key: prev.id ? prev.key : keyFromTemplateName(e.target.value, prev.kind),
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <div>
                <Label>Key</Label>
                <Input
                  disabled={!editable}
                  value={editor.key}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, key: e.target.value } : prev))}
                />
                <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                  Insert as {insertSnippet(editor.key || 'key', editor.kind)}
                </p>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                disabled={!editable}
                value={editor.description}
                onChange={(e) => setEditor((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
              />
            </div>
            <TemplateContentEditor
              kind={editor.kind}
              content={editor.content}
              suggestions={suggestions}
              readOnly={!editable}
              media={media}
              onChange={(content) => setEditor((prev) => (prev ? { ...prev, content } : prev))}
            />
            {error ? <FieldError>{error}</FieldError> : null}
            {editable ? (
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : editor.id ? 'Save template' : 'Create template'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditor(null)}>
                  Cancel
                </Button>
                {editor.id ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={remove.isPending}
                    onClick={() => {
                      const ok = window.confirm(`Delete “${editor.name}”? Steps that insert this key will show empty text.`)
                      if (!ok) return
                      remove.mutate(editor.id!)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </form>
        </Card>
      ) : (
        <>
          {editable ? (
            <Card className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-ink)]">Create a template</h2>
                <p className="text-xs text-[var(--color-ink-muted)]">Start blank or with sample content.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TEMPLATE_KINDS.map((kind) => {
                  const Icon = KIND_ICONS[kind]
                  return (
                    <div
                      key={kind}
                      className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-ink)]">{TEMPLATE_KIND_META[kind].label}</p>
                          <p className="text-[11px] text-[var(--color-ink-muted)]">{TEMPLATE_KIND_META[kind].hint}</p>
                        </div>
                      </div>
                      <div className="mt-auto flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => startCreate(kind, false)}>
                          Blank
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startCreate(kind, true)}>
                          Sample
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates…"
                  className="pl-9"
                />
              </div>
              <Select
                className="w-auto min-w-[160px]"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as 'all' | TemplateKind)}
              >
                <option value="all">All types</option>
                {TEMPLATE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {TEMPLATE_KIND_META[kind].label}
                  </option>
                ))}
              </Select>
              <Select className="w-auto min-w-[140px]" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="name">Sort by name</option>
                <option value="key">Sort by key</option>
                <option value="kind">Sort by type</option>
                <option value="updated">Sort by updated</option>
              </Select>
              <Button size="sm" variant="ghost" onClick={cycleSortOrder} title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}>
                <ArrowUpDown className="h-4 w-4" />
              </Button>
              {editable ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.txt"
                    className="hidden"
                    onChange={() => void handleImportFile()}
                  />
                  <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                </>
              ) : null}
            </div>

            {selected.size > 0 ? (
              <Card className="flex flex-wrap items-center justify-between gap-3 border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/30 p-3">
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  {selected.size} template{selected.size > 1 ? 's' : ''} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void handleBulkExport()}>
                    <Download className="h-4 w-4" />
                    Export selected
                  </Button>
                  {editable ? (
                    <Button size="sm" variant="danger" onClick={() => void handleBulkDelete()}>
                      <Trash2 className="h-4 w-4" />
                      Delete selected
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </Card>
            ) : filtered.length > 0 && editable ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                <button type="button" onClick={selectAll} className="underline hover:text-[var(--color-accent)]">
                  Select all {filtered.length}
                </button>
              </div>
            ) : null}
          </div>

          {templates.isLoading ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : templates.isError ? (
            <Card>
              <p className="text-sm text-[var(--color-danger)]">Could not load templates.</p>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-ink-muted)]">
                {templates.data?.length ? 'No templates match this filter.' : 'No templates yet. Create one above.'}
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => {
                const Icon = KIND_ICONS[row.kind]
                const isSelected = selected.has(row.id)
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'group relative rounded-2xl border bg-[var(--color-surface)]/80 p-4 text-left shadow-[var(--shadow-soft)] transition',
                      isSelected
                        ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                        : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-md',
                    )}
                  >
                    {editable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelection(row.id)
                        }}
                        className="absolute top-3 right-3 z-10 grid h-5 w-5 place-items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-accent)]"
                        aria-label={isSelected ? 'Deselect template' : 'Select template'}
                      >
                        {isSelected ? <Check className="h-3 w-3 text-[var(--color-accent)]" /> : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      aria-label={`Edit template ${row.name}`}
                      className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
                    />
                    <div className="pointer-events-none relative">
                      <div className="flex items-start justify-between gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-accent-soft)] to-[var(--color-accent)]/15 text-[var(--color-accent)]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                          {TEMPLATE_KIND_META[row.kind].label}
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-[var(--color-ink)]">{row.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-muted)]">
                        {snippetPreview(row) || row.description || 'Empty'}
                      </p>
                    </div>
                    <div className="relative mt-3 flex flex-wrap items-center gap-2">
                      <CopyChip value={insertSnippet(row.key, row.kind)} />
                      {editable ? (
                        <div className="pointer-events-auto ml-auto flex gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDuplicate(row)
                            }}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            title="Duplicate template"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleExport([row.id])
                            }}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                            title="Export template"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
