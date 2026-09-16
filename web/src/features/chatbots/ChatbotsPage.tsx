import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CalendarClock,
  CalendarHeart,
  ClipboardList,
  Headphones,
  LayoutGrid,
  LayoutList,
  LayoutTemplate,
  LifeBuoy,
  MessageCircleQuestion,
  Plus,
  Recycle,
  Rows3,
  ShoppingBag,
  SquareDashed,
  Star,
  Ticket,
  Trash2,
  Upload,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatQuotaCap } from '@/features/billing/planCatalog'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { canAdmin, canEdit } from '@/shared/types/database'
import { supabase } from '@/shared/lib/supabase'
import { pickJsonFile } from '@/shared/lib/downloadJson'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { FieldError } from '@/shared/ui/field-error'
import { PAGE_HELP } from '@/shared/help/pageHelp'
import { PageHeader } from '@/shared/ui/page-header'
import { Badge } from '@/shared/ui/badge'
import { InitialsAvatar } from '@/shared/ui/initials-avatar'
import {
  BulkActionBar,
  PaginationBar,
  clampPage,
  matchesQuery,
  pageCountFor,
  RowCheckbox,
  SearchField,
  slicePage,
  toggleId,
} from '@/shared/ui/list-controls'
import { Select } from '@/shared/ui/select'
import { getPublishStatus } from '@/features/designer/utils/flowPublish'
import { parseFlowExport } from '@/features/designer/utils/flowTransfer'
import type { DesignerEdge, DesignerNode } from '@/features/designer/model/flowSchema'
import type { FlowEntityDefExport, FlowGlobalExport, FlowTemplateExport, FlowTestScenarioExport } from '@/features/designer/utils/flowTransfer'
import {
  loadFlowBundle,
  replaceFlowInDb,
  applyImportedBundleData,
  versionCompareHint,
} from '@/features/chatbots/chatbotFlowTransfer'
import { listChatbotConnections } from '@/features/connections/connectionApi'
import { reconcileStepConnections } from '@/features/connections/bindMissingStepConnections'
import {
  CHATBOT_STARTER_PACKS,
  getChatbotStarterPack,
  type ChatbotStarterPackId,
} from '@/features/chatbots/starterPacks'
import { fetchDeletedChatbots, recycleBinQueryKey } from '@/features/chatbots/RecycleBinPage'
import { cn } from '@/shared/lib/utils'

function formatEditedAgo(iso: string | null | undefined): string {
  if (!iso) return 'recently'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  return formatDistanceToNow(date, { addSuffix: true })
}

const STARTER_PACK_ICONS: Record<ChatbotStarterPackId, LucideIcon> = {
  blank: SquareDashed,
  essentials: LayoutTemplate,
  customer_support: Headphones,
  lead_capture: UserPlus,
  appointment: CalendarClock,
  shop: ShoppingBag,
  feedback: Star,
  contact_form: ClipboardList,
  faq_menu: MessageCircleQuestion,
  agent_handoff: LifeBuoy,
  event_rsvp: CalendarHeart,
  job_application: Briefcase,
  it_helpdesk: Ticket,
  product_onboarding: Bot,
}

type AccessProfile = {
  id: string
  display_name: string | null
  email: string | null
}

type BotRow = {
  id: string
  name: string
  description: string | null
  updated_at: string | null
  deleted_at: string | null
  created_by: string | null
  chatbot_flows:
    | { version: number | null; published_at: string | null; has_draft_changes: boolean | null; published_graph: unknown }
    | { version: number | null; published_at: string | null; has_draft_changes: boolean | null; published_graph: unknown }[]
    | null
  chatbot_shares: { user_id: string }[] | null
}

type ParsedImport = {
  nodes: DesignerNode[]
  edges: DesignerEdge[]
  globals: FlowGlobalExport[]
  entities?: { id: string; key: string }[]
  entityDefs?: FlowEntityDefExport[]
  templates?: FlowTemplateExport[]
  testScenarios?: FlowTestScenarioExport[]
  meta: {
    chatbotId?: string
    chatbotName?: string
    chatbotDescription?: string | null
    flowName?: string
    flowVersion?: number
    exportedAt?: string
  }
}

type ImportDialog = {
  parsed: ParsedImport
  idMatch: BotRow | null
  nameMatches: BotRow[]
  /** selected existing target, or 'new' */
  choice: string
}

function flowVersionOf(bot: BotRow): number {
  const flowRaw = Array.isArray(bot.chatbot_flows) ? bot.chatbot_flows[0] : bot.chatbot_flows
  return flowRaw?.version ?? 1
}

type ChatbotsDisplayMode = 'grid' | 'details' | 'compact'

const CHATBOTS_DISPLAY_STORAGE_KEY = 'ff-chatbots-display-mode'
const CHATBOTS_DISPLAY_MODES: {
  id: ChatbotsDisplayMode
  label: string
  icon: LucideIcon
}[] = [
  { id: 'grid', label: 'Grid', icon: LayoutGrid },
  { id: 'details', label: 'Details', icon: LayoutList },
  { id: 'compact', label: 'Compact', icon: Rows3 },
]

function readChatbotsDisplayMode(): ChatbotsDisplayMode {
  try {
    const raw = localStorage.getItem(CHATBOTS_DISPLAY_STORAGE_KEY)
    if (raw === 'grid' || raw === 'details' || raw === 'compact') return raw
  } catch {
    // ignore
  }
  return 'grid'
}

function publishStatusOf(bot: BotRow) {
  const flowRaw = Array.isArray(bot.chatbot_flows) ? bot.chatbot_flows[0] : bot.chatbot_flows
  return flowRaw
    ? getPublishStatus({
        version: flowRaw.version ?? 1,
        published_at: flowRaw.published_at ?? null,
        has_draft_changes: flowRaw.has_draft_changes ?? true,
        published_graph: flowRaw.published_graph ?? null,
      })
    : getPublishStatus({
        version: 1,
        published_at: null,
        has_draft_changes: true,
        published_graph: null,
      })
}

function PublishBadge({ bot }: { bot: BotRow }) {
  const publishStatus = publishStatusOf(bot)
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
        publishStatus.kind === 'live' && 'bg-emerald-50 text-emerald-800',
        publishStatus.kind === 'draft' && 'bg-amber-50 text-amber-800',
        publishStatus.kind === 'never' && 'bg-slate-100 text-slate-600',
      )}
    >
      {publishStatus.label}
    </span>
  )
}

function AccessAvatars({
  bot,
  profiles,
  compact = false,
}: {
  bot: BotRow
  profiles: Record<string, AccessProfile>
  compact?: boolean
}) {
  const owner = bot.created_by ? profiles[bot.created_by] : null
  const sharedIds = (bot.chatbot_shares ?? [])
    .map((s) => s.user_id)
    .filter((id) => id && id !== bot.created_by)
  const shared = sharedIds.map((id) => profiles[id]).filter(Boolean) as AccessProfile[]
  if (!owner && !shared.length) return null

  if (compact) {
    const people = [owner, ...shared].filter(Boolean) as AccessProfile[]
    return (
      <div className="flex items-center gap-1">
        <div className="flex -space-x-1.5">
          {people.slice(0, 4).map((p) => (
            <InitialsAvatar
              key={p.id}
              size="sm"
              className="h-5 w-5 text-[8px]"
              name={p.display_name}
              email={p.email}
              seed={p.id}
              title={p.display_name || p.email || 'Access'}
            />
          ))}
        </div>
        {people.length > 4 ? (
          <span className="text-[10px] text-[var(--color-ink-muted)]">+{people.length - 4}</span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {owner ? (
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)]/80 py-0.5 pl-0.5 pr-2">
          <InitialsAvatar
            size="sm"
            className="h-6 w-6 text-[9px]"
            name={owner.display_name}
            email={owner.email}
            seed={owner.id}
            title={`${owner.display_name || owner.email || 'Owner'} (owner)`}
          />
          <span className="max-w-[7rem] truncate text-[11px] font-medium text-[var(--color-ink)]">
            {owner.display_name || owner.email || 'Owner'}
          </span>
          <Badge className="px-1.5 py-0 text-[9px]">Owner</Badge>
        </div>
      ) : null}
      {shared.length ? (
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1.5">
            {shared.slice(0, 5).map((p) => (
              <InitialsAvatar
                key={p.id}
                size="sm"
                className="h-6 w-6 text-[9px]"
                name={p.display_name}
                email={p.email}
                seed={p.id}
                title={p.display_name || p.email || 'Shared'}
              />
            ))}
          </div>
          <span className="text-[11px] text-[var(--color-ink-muted)]">
            {shared.length === 1 ? '1 shared' : `${shared.length} shared`}
            {shared.length > 5 ? ` (+${shared.length - 5})` : ''}
          </span>
        </div>
      ) : null}
    </div>
  )
}

export function ChatbotsPage() {
  const { instance, role } = useRequiredInstance()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [starterPackId, setStarterPackId] = useState<ChatbotStarterPackId>('essentials')
  const [error, setError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importDialog, setImportDialog] = useState<ImportDialog | null>(null)
  const [displayMode, setDisplayMode] = useState<ChatbotsDisplayMode>(() => readChatbotsDisplayMode())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'draft' | 'never'>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const importBusyRef = useRef(false)
  const editable = canEdit(role)
  const isAdmin = canAdmin(role)
  const selectedPack = getChatbotStarterPack(starterPackId)

  useEffect(() => {
    try {
      localStorage.setItem(CHATBOTS_DISPLAY_STORAGE_KEY, displayMode)
    } catch {
      // ignore
    }
  }, [displayMode])

  const chatbots = useQuery({
    queryKey: ['chatbots', instance.id],
    queryFn: async () => {
      const { data, error: qError } = await supabase
        .from('chatbots')
        .select(
          'id, name, description, updated_at, deleted_at, created_by, chatbot_flows(version, published_at, has_draft_changes, published_graph), chatbot_shares(user_id)',
        )
        .eq('instance_id', instance.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
      if (qError) throw qError
      return (data ?? []) as BotRow[]
    },
  })

  const maxChatbots = instance.quota_max_chatbots ?? -1
  const chatbotCount = chatbots.data?.length ?? 0
  const atChatbotLimit = maxChatbots >= 0 && chatbotCount >= maxChatbots

  const accessProfiles = useQuery({
    queryKey: ['chatbot-access-profiles', instance.id, chatbots.data?.map((b) => b.id).join(',') ?? ''],
    enabled: !!chatbots.data?.length,
    queryFn: async () => {
      const ids = new Set<string>()
      for (const bot of chatbots.data ?? []) {
        if (bot.created_by) ids.add(bot.created_by)
        for (const share of bot.chatbot_shares ?? []) {
          if (share.user_id) ids.add(share.user_id)
        }
      }
      if (!ids.size) return {} as Record<string, AccessProfile>
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', [...ids])
      if (error) throw error
      const map: Record<string, AccessProfile> = {}
      for (const row of data ?? []) {
        map[row.id] = row as AccessProfile
      }
      return map
    },
  })

  const recycleCount = useQuery({
    queryKey: recycleBinQueryKey(instance.id),
    enabled: isAdmin,
    queryFn: () => fetchDeletedChatbots(instance.id),
    select: (rows) => rows.length,
  })

  const profiles = accessProfiles.data ?? {}

  const filteredBots = useMemo(() => {
    const rows = chatbots.data ?? []
    return rows.filter((bot) => {
      const status = publishStatusOf(bot)
      if (statusFilter !== 'all' && status.kind !== statusFilter) return false
      const owner = bot.created_by ? profiles[bot.created_by] : null
      return matchesQuery(search, [
        bot.name,
        bot.description,
        status.label,
        owner?.display_name,
        owner?.email,
      ])
    })
  }, [chatbots.data, search, statusFilter, profiles])

  const filterResetKey = `${search}\0${statusFilter}`
  useEffect(() => {
    setPage(1)
  }, [filterResetKey])

  const pageCount = pageCountFor(filteredBots.length, pageSize)
  const safePage = clampPage(page, pageCount)
  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const visibleBots = useMemo(
    () => slicePage(filteredBots, safePage, pageSize),
    [filteredBots, safePage, pageSize],
  )
  const visibleIds = useMemo(() => visibleBots.map((b) => b.id), [visibleBots])
  const allVisibleSelected =
    isAdmin && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set((chatbots.data ?? []).map((b) => b.id))
      const next = new Set<string>()
      for (const id of prev) if (valid.has(id)) next.add(id)
      return next.size === prev.size ? prev : next
    })
  }, [chatbots.data])

  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const chatbotId of ids) {
        const { error } = await supabase.rpc('soft_delete_chatbot', { p_chatbot_id: chatbotId })
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setSelectedIds(new Set())
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['chatbots-recycle-bin', instance.id] })
    },
  })

  function confirmDelete(ids: string[], label: string) {
    if (
      !window.confirm(
        `Move ${label} to the recycle bin? You can restore ${ids.length === 1 ? 'it' : 'them'} later, or delete forever from the recycle bin.`,
      )
    ) {
      return
    }
    softDelete.mutate(ids)
  }

  function botActions(bot: BotRow, size: 'sm' | 'xs' = 'sm') {
    return (
      <div className={cn('flex flex-wrap gap-2', size === 'xs' && 'gap-1.5')}>
        <Link to={`/instances/${instance.id}/chatbots/${bot.id}/design`}>
          <Button size="sm" className={size === 'xs' ? 'h-7 px-2 text-xs' : undefined}>
            Open designer
          </Button>
        </Link>
        <Link to={`/instances/${instance.id}/chatbots/${bot.id}`}>
          <Button size="sm" variant="secondary" className={size === 'xs' ? 'h-7 px-2 text-xs' : undefined}>
            Settings
          </Button>
        </Link>
        {isAdmin ? (
          <Button
            size="sm"
            variant="ghost"
            className={size === 'xs' ? 'h-7 px-2 text-xs' : undefined}
            disabled={softDelete.isPending}
            onClick={() => confirmDelete([bot.id], `“${bot.name}”`)}
          >
            <Trash2 className="h-4 w-4" />
            {size === 'xs' ? null : 'Delete'}
          </Button>
        ) : null}
      </div>
    )
  }

  const create = useMutation({
    mutationFn: async () => {
      const pack = getChatbotStarterPack(starterPackId)
      const finalName =
        name.trim() || pack.suggestedName.trim() || 'Untitled chatbot'
      const finalDescription =
        description.trim() || pack.suggestedDescription.trim() || null

      const { data, error: insertError } = await supabase
        .from('chatbots')
        .insert({
          instance_id: instance.id,
          name: finalName,
          description: finalDescription,
          created_by: user!.id,
        })
        .select('*')
        .single()
      if (insertError) throw insertError

      if (!pack.keepDefaultFlow) {
        const bundleData = pack.build()
        const flowBundle = await loadFlowBundle(data.id)
        await applyImportedBundleData({
          chatbotId: data.id,
          templates: bundleData.templates,
          entityDefs: bundleData.entityDefs,
          testScenarios: bundleData.testScenarios,
          createdBy: user!.id,
        })
        const entitiesExport = bundleData.entityDefs.length
          ? bundleData.entityDefs.map((e) => ({ id: e.id, key: e.key }))
          : bundleData.entities
        await replaceFlowInDb({
          chatbotId: data.id,
          flowId: flowBundle.flow.id,
          nodes: bundleData.nodes,
          edges: bundleData.edges,
          globals: bundleData.globals,
          entitiesExport,
        })
      }

      return { chatbot: data, packId: pack.id }
    },
    onSuccess: async (result) => {
      setName('')
      setDescription('')
      setStarterPackId('essentials')
      setOpen(false)
      setError(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['flow-bundle', result.chatbot.id] })
      await qc.invalidateQueries({ queryKey: ['chatbot', result.chatbot.id] })
      await qc.invalidateQueries({ queryKey: ['chatbot-templates', result.chatbot.id] })
      await qc.invalidateQueries({ queryKey: ['chatbot-entities', result.chatbot.id] })
      await qc.invalidateQueries({ queryKey: ['chatbot-test-scenarios', result.chatbot.id] })
      navigate(`/instances/${instance.id}/chatbots/${result.chatbot.id}/design`)
    },
    onError: (err: Error) => setError(err.message),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editable) return
    if (!name.trim() && !selectedPack.suggestedName.trim()) {
      setError('Enter a name for the chatbot')
      return
    }
    create.mutate()
  }

  function selectStarterPack(id: ChatbotStarterPackId) {
    const pack = getChatbotStarterPack(id)
    const previous = getChatbotStarterPack(starterPackId)
    setStarterPackId(id)
    setError(null)
    const nameBlankOrFromPrev = !name.trim() || name.trim() === previous.suggestedName
    const descBlankOrFromPrev =
      !description.trim() || description.trim() === previous.suggestedDescription
    if (nameBlankOrFromPrev) setName(pack.suggestedName)
    if (descBlankOrFromPrev) setDescription(pack.suggestedDescription)
  }

  const versionHint = useMemo(() => {
    if (!importDialog) return null
    const targetId = importDialog.choice === 'new' ? null : importDialog.choice
    const target =
      (targetId &&
        (importDialog.idMatch?.id === targetId
          ? importDialog.idMatch
          : importDialog.nameMatches.find((b) => b.id === targetId))) ||
      null
    if (!target) return null
    return versionCompareHint(importDialog.parsed.meta.flowVersion, flowVersionOf(target))
  }, [importDialog])

  async function startImport() {
    if (!editable || importBusyRef.current) return
    setImportError(null)
    try {
      const raw = await pickJsonFile()
      const parsed = parseFlowExport(raw)
      const bots = chatbots.data ?? []

      const idMatch =
        parsed.meta.chatbotId != null ? (bots.find((b) => b.id === parsed.meta.chatbotId) ?? null) : null
      const nameKey = (parsed.meta.chatbotName ?? '').trim().toLowerCase()
      const nameMatches = nameKey
        ? bots.filter((b) => b.name.trim().toLowerCase() === nameKey && b.id !== idMatch?.id)
        : []

      const defaultChoice = idMatch?.id ?? (nameMatches.length === 1 ? nameMatches[0]!.id : 'new')

      setImportDialog({
        parsed,
        idMatch,
        nameMatches,
        choice: defaultChoice,
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'No file selected') return
      setImportError(e instanceof Error ? e.message : 'Import failed')
    }
  }

  async function confirmImport() {
    if (!importDialog || !editable || importBusyRef.current || !user) return
    importBusyRef.current = true
    setImportBusy(true)
    setImportError(null)
    try {
      const { parsed, choice } = importDialog
      const label = parsed.meta.chatbotName || parsed.meta.flowName || 'Imported chatbot'
      let chatbotId = choice

      if (choice === 'new') {
        const { data: created, error: insertError } = await supabase
          .from('chatbots')
          .insert({
            instance_id: instance.id,
            name: label,
            description: parsed.meta.chatbotDescription ?? null,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (insertError) throw insertError
        chatbotId = created.id
      }

      const bundle = await loadFlowBundle(chatbotId)
      await applyImportedBundleData({
        chatbotId,
        templates: parsed.templates,
        entityDefs: parsed.entityDefs,
        testScenarios: parsed.testScenarios,
        createdBy: user.id,
      })
      const entitiesExport =
        parsed.entityDefs?.map((e) => ({ id: e.id, key: e.key })) ?? parsed.entities

      // Prefer matching installed connections (e.g. Demo Lab HTTP) over empty connectionIds.
      const usable = await listChatbotConnections(chatbotId)
      const reconciled = reconcileStepConnections(
        parsed.nodes,
        parsed.edges,
        usable.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
      )

      await replaceFlowInDb({
        chatbotId,
        flowId: bundle.flow.id,
        nodes: reconciled.nodes,
        edges: reconciled.edges,
        globals: parsed.globals,
        entitiesExport,
        chatbotMeta:
          choice === 'new'
            ? undefined
            : {
                name: parsed.meta.chatbotName,
                description: parsed.meta.chatbotDescription,
              },
      })

      setImportDialog(null)
      await qc.invalidateQueries({ queryKey: ['chatbots', instance.id] })
      await qc.invalidateQueries({ queryKey: ['flow-bundle', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-templates', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-entities', chatbotId] })
      await qc.invalidateQueries({ queryKey: ['chatbot-test-scenarios', chatbotId] })
      navigate(`/instances/${instance.id}/chatbots/${chatbotId}/design`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      importBusyRef.current = false
      setImportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chatbots"
        description={`Design conversational flows for ${instance.name}.`}
        help={PAGE_HELP.chatbots}
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Link to={`/instances/${instance.id}/recycle-bin`}>
                <Button variant="secondary">
                  <Recycle className="h-4 w-4" />
                  Recycle bin
                  {recycleCount.data ? (
                    <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink)]">
                      {recycleCount.data}
                    </span>
                  ) : null}
                </Button>
              </Link>
            ) : null}
            {editable ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void startImport()}
                  disabled={importBusy || atChatbotLimit}
                  title={
                    atChatbotLimit
                      ? `Plan limit: ${formatQuotaCap(maxChatbots)} chatbot${maxChatbots === 1 ? '' : 's'}`
                      : undefined
                  }
                >
                  <Upload className="h-4 w-4" />
                  Import
                </Button>
                <Button
                  disabled={atChatbotLimit}
                  title={
                    atChatbotLimit
                      ? `Plan limit: ${formatQuotaCap(maxChatbots)} chatbot${maxChatbots === 1 ? '' : 's'}`
                      : undefined
                  }
                  onClick={() => {
                    setOpen((v) => !v)
                    setError(null)
                    if (!open) {
                      setStarterPackId('essentials')
                      const pack = getChatbotStarterPack('essentials')
                      if (!name.trim()) setName(pack.suggestedName)
                      if (!description.trim()) setDescription(pack.suggestedDescription)
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New chatbot
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {importError ? <FieldError>{importError}</FieldError> : null}
      {atChatbotLimit ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          This organisation has reached its plan limit of {formatQuotaCap(maxChatbots)} live chatbot
          {maxChatbots === 1 ? '' : 's'}.{' '}
          <Link to="/pricing" className="font-medium text-teal-800 underline-offset-2 hover:underline">
            View pricing
          </Link>{' '}
          or delete unused bots.
        </p>
      ) : null}

      {importDialog ? (
        <Card className="ff-page-enter border-teal-200/60">
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Import flow</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {importDialog.parsed.meta.chatbotName || importDialog.parsed.meta.flowName || 'Untitled'}
                {' · '}
                {importDialog.parsed.nodes.length} steps · {importDialog.parsed.edges.length} connections
                {importDialog.parsed.globals.length
                  ? ` · ${importDialog.parsed.globals.length} globals`
                  : ''}
                {importDialog.parsed.meta.flowVersion != null
                  ? ` · file v${importDialog.parsed.meta.flowVersion}`
                  : ''}
                {importDialog.parsed.meta.exportedAt
                  ? ` · exported ${new Date(importDialog.parsed.meta.exportedAt).toLocaleString()}`
                  : ''}
              </p>
            </div>

            {importDialog.idMatch ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
                Matched existing chatbot by id: <strong>{importDialog.idMatch.name}</strong>
                {` (local v${flowVersionOf(importDialog.idMatch)})`}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Destination</Label>
              <div className="space-y-2">
                {importDialog.idMatch ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name="import-target"
                      checked={importDialog.choice === importDialog.idMatch.id}
                      onChange={() =>
                        setImportDialog({ ...importDialog, choice: importDialog.idMatch!.id })
                      }
                    />
                    <span>
                      <span className="font-medium">Replace “{importDialog.idMatch.name}”</span>
                      <span className="block text-[11px] text-slate-500">Same id as in the file</span>
                    </span>
                  </label>
                ) : null}

                {importDialog.nameMatches.map((bot) => (
                  <label
                    key={bot.id}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      name="import-target"
                      checked={importDialog.choice === bot.id}
                      onChange={() => setImportDialog({ ...importDialog, choice: bot.id })}
                    />
                    <span>
                      <span className="font-medium">Replace “{bot.name}”</span>
                      <span className="block text-[11px] text-slate-500">
                        Same name · local v{flowVersionOf(bot)} · edited {formatEditedAgo(bot.updated_at)}
                      </span>
                    </span>
                  </label>
                ))}

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    name="import-target"
                    checked={importDialog.choice === 'new'}
                    onChange={() => setImportDialog({ ...importDialog, choice: 'new' })}
                  />
                  <span>
                    <span className="font-medium">Create a new chatbot</span>
                    <span className="block text-[11px] text-slate-500">
                      Uses “{importDialog.parsed.meta.chatbotName || importDialog.parsed.meta.flowName || 'Imported chatbot'}”
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {importDialog.choice !== 'new' && versionHint ? (
              <div
                className={cn(
                  'flex gap-2 rounded-xl border px-3 py-2 text-sm',
                  (() => {
                    const target =
                      importDialog.idMatch?.id === importDialog.choice
                        ? importDialog.idMatch
                        : importDialog.nameMatches.find((b) => b.id === importDialog.choice)
                    const localV = target ? flowVersionOf(target) : undefined
                    const fileV = importDialog.parsed.meta.flowVersion
                    const older = fileV != null && localV != null && fileV < localV
                    return older
                      ? 'border-rose-200 bg-rose-50 text-rose-900'
                      : 'border-sky-200 bg-sky-50 text-sky-950'
                  })(),
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{versionHint}</span>
              </div>
            ) : null}

            {importDialog.choice !== 'new' ? (
              <p className="text-[11px] text-slate-500">
                Replacing overwrites the draft flow and cannot be undone from the UI. Export first if unsure.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={importBusy}
                onClick={() => void confirmImport()}
              >
                {importBusy
                  ? 'Importing…'
                  : importDialog.choice === 'new'
                    ? 'Create & import'
                    : 'Replace & import'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={importBusy}
                onClick={() => setImportDialog(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {open ? (
        <Card className="ff-page-enter border-teal-200/60">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <h2 className="text-base font-semibold text-slate-800">New chatbot</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Start blank or from a template with flows and content organisations commonly need.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Start from</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {CHATBOT_STARTER_PACKS.map((pack) => {
                  const selected = starterPackId === pack.id
                  const Icon = STARTER_PACK_ICONS[pack.id]
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => selectStarterPack(pack.id)}
                      aria-pressed={selected}
                      aria-label={`${pack.name}. ${pack.summary}`}
                      className={cn(
                        'relative flex w-full flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition',
                        selected
                          ? 'border-teal-400 bg-teal-50/80 ring-1 ring-teal-500/30'
                          : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50/80',
                      )}
                    >
                      {pack.id === 'essentials' ? (
                        <span className="absolute right-1 top-1">
                          <Badge className="px-1.5 py-0 text-[9px] normal-case tracking-normal">
                            Recommended
                          </Badge>
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
                          selected
                            ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-700 ring-teal-600/20'
                            : 'bg-slate-50 text-slate-600 ring-slate-200',
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-xs font-semibold leading-tight text-slate-800">
                        {pack.name}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div
                key={selectedPack.id}
                className="ff-page-enter rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-slate-800">{selectedPack.name}</p>
                <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{selectedPack.summary}</p>
                {selectedPack.includes.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {selectedPack.includes.map((item) => (
                      <li
                        key={item}
                        className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="bot-name">Name</Label>
              <Input
                id="bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selectedPack.suggestedName || 'My chatbot'}
                required={!selectedPack.suggestedName}
              />
            </div>
            <div>
              <Label htmlFor="bot-desc">Description</Label>
              <Textarea
                id="bot-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={selectedPack.suggestedDescription || 'Optional'}
              />
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create chatbot'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={create.isPending}
                onClick={() => {
                  setOpen(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {chatbots.isLoading ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
      ) : chatbots.data?.length ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <SearchField
                id="chatbots-search"
                value={search}
                onChange={setSearch}
                placeholder="Search chatbots…"
                className="sm:max-w-sm"
              />
              <Select
                id="chatbots-status-filter"
                aria-label="Filter by status"
                className="h-10 w-full sm:w-44"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'live' | 'draft' | 'never')
                }
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="draft">Draft changes</option>
                <option value="never">Never published</option>
              </Select>
              {isAdmin && filteredBots.length ? (
                <label className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <RowCheckbox
                    checked={allVisibleSelected}
                    onChange={(on) =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (on) for (const id of visibleIds) next.add(id)
                        else for (const id of visibleIds) next.delete(id)
                        return next
                      })
                    }
                    label="Select all chatbots on this page"
                    className="mt-0"
                  />
                  Select page
                </label>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
              <p className="text-xs font-medium text-[var(--color-ink-muted)]">
                {filteredBots.length === chatbots.data.length
                  ? `${filteredBots.length} chatbot${filteredBots.length === 1 ? '' : 's'}`
                  : `${filteredBots.length} of ${chatbots.data.length}`}
              </p>
              <div
                className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
                role="group"
                aria-label="Display type"
              >
                {CHATBOTS_DISPLAY_MODES.map((mode) => {
                  const Icon = mode.icon
                  const modeSelected = displayMode === mode.id
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      aria-pressed={modeSelected}
                      title={mode.label}
                      onClick={() => setDisplayMode(mode.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                        modeSelected
                          ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                          : 'text-[var(--color-ink-muted)] hover:bg-slate-50 hover:text-[var(--color-ink)]',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {isAdmin ? (
            <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={softDelete.isPending}
                onClick={() =>
                  confirmDelete(
                    [...selectedIds],
                    `${selectedIds.size} chatbot${selectedIds.size === 1 ? '' : 's'}`,
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
                Move to recycle bin
              </Button>
            </BulkActionBar>
          ) : null}

          {!filteredBots.length ? (
            <Card className="border-dashed text-center">
              <p className="text-sm text-[var(--color-ink-muted)]">
                No chatbots match your search{statusFilter !== 'all' ? ' or status filter' : ''}.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                }}
              >
                Clear filters
              </Button>
            </Card>
          ) : null}

          {filteredBots.length && displayMode === 'grid' ? (
            <div className="ff-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {visibleBots.map((bot) => {
                const isSelected = selectedIds.has(bot.id)
                return (
                  <Card
                    key={bot.id}
                    className={cn(
                      'ff-hover-lift group relative flex aspect-square flex-col overflow-hidden p-3',
                      isSelected && 'ring-2 ring-[var(--color-accent)]/50',
                    )}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 opacity-80" />
                    {isAdmin ? (
                      <div className="absolute left-2 top-2 z-10">
                        <RowCheckbox
                          checked={isSelected}
                          onChange={(on) => setSelectedIds((prev) => toggleId(prev, bot.id, on))}
                          label={`Select ${bot.name}`}
                          className="mt-0 rounded border-[var(--color-border)] bg-[var(--color-surface)]"
                        />
                      </div>
                    ) : null}
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
                      <div className="rounded-2xl bg-gradient-to-br from-teal-500/15 to-cyan-500/20 p-3 text-teal-700 ring-1 ring-teal-600/10">
                        <Bot className="h-7 w-7" />
                      </div>
                      <div className="w-full min-w-0 space-y-1">
                        <h2 className="truncate text-sm font-semibold leading-tight" title={bot.name}>
                          {bot.name}
                        </h2>
                        <div className="flex justify-center">
                          <PublishBadge bot={bot} />
                        </div>
                        <p className="line-clamp-2 text-[11px] text-[var(--color-ink-muted)]">
                          {bot.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t border-[var(--color-border)]/60 pt-2">
                      <Link to={`/instances/${instance.id}/chatbots/${bot.id}/design`}>
                        <Button size="sm" className="h-7 px-2 text-xs">
                          Design
                        </Button>
                      </Link>
                      <Link to={`/instances/${instance.id}/chatbots/${bot.id}`}>
                        <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                          Settings
                        </Button>
                      </Link>
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          disabled={softDelete.isPending}
                          title="Delete"
                          aria-label={`Delete ${bot.name}`}
                          onClick={() => confirmDelete([bot.id], `“${bot.name}”`)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : null}

          {filteredBots.length && displayMode === 'details' ? (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] table-fixed border-collapse text-left text-sm">
                  <colgroup>
                    {isAdmin ? <col className="w-10" /> : null}
                    <col className="w-[38%]" />
                    <col className="w-[7.5rem]" />
                    <col className="hidden w-[5.5rem] md:table-column" />
                    <col className="w-[9rem]" />
                    <col className="hidden w-[11rem] lg:table-column" />
                    <col className="w-[13rem]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/70 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                      {isAdmin ? <th className="px-3 py-2.5" /> : null}
                      <th className="px-3 py-2.5 font-semibold">Name</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Version</th>
                      <th className="px-3 py-2.5 font-semibold">Date modified</th>
                      <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">Access</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBots.map((bot) => {
                      const owner = bot.created_by ? profiles[bot.created_by] : null
                      return (
                        <tr
                          key={bot.id}
                          className={cn(
                            'border-b border-[var(--color-border)]/70 transition last:border-b-0 hover:bg-slate-50/80',
                            selectedIds.has(bot.id) && 'bg-[var(--color-accent-soft)]/40',
                          )}
                        >
                          {isAdmin ? (
                            <td className="px-3 py-2 align-middle">
                              <RowCheckbox
                                checked={selectedIds.has(bot.id)}
                                onChange={(on) => setSelectedIds((prev) => toggleId(prev, bot.id, on))}
                                label={`Select ${bot.name}`}
                              />
                            </td>
                          ) : null}
                          <td className="max-w-0 px-3 py-2 align-middle">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-600/10">
                                <Bot className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <Link
                                  to={`/instances/${instance.id}/chatbots/${bot.id}/design`}
                                  className="block truncate font-medium text-[var(--color-ink)] hover:underline"
                                  title={bot.name}
                                >
                                  {bot.name}
                                </Link>
                                <p
                                  className="truncate text-[11px] text-[var(--color-ink-muted)]"
                                  title={bot.description || 'No description'}
                                >
                                  {bot.description || 'No description'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 align-middle">
                            <PublishBadge bot={bot} />
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-2 align-middle tabular-nums text-[var(--color-ink-muted)] md:table-cell">
                            v{flowVersionOf(bot)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 align-middle text-[var(--color-ink-muted)]">
                            {formatEditedAgo(bot.updated_at)}
                          </td>
                          <td className="hidden px-3 py-2 align-middle lg:table-cell">
                            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                              <AccessAvatars bot={bot} profiles={profiles} compact />
                              {owner ? (
                                <span
                                  className="min-w-0 truncate text-[11px] text-[var(--color-ink-muted)]"
                                  title={owner.display_name || owner.email || 'Owner'}
                                >
                                  {owner.display_name || owner.email || 'Owner'}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 align-middle">
                            <div className="flex justify-end">{botActions(bot, 'xs')}</div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {filteredBots.length && displayMode === 'compact' ? (
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-[var(--color-border)]/70">
                {visibleBots.map((bot) => (
                  <li
                    key={bot.id}
                    className={cn(
                      'flex flex-wrap items-center gap-2 px-3 py-2 transition hover:bg-slate-50/70 sm:flex-nowrap sm:gap-3',
                      selectedIds.has(bot.id) && 'bg-[var(--color-accent-soft)]/40',
                    )}
                  >
                    {isAdmin ? (
                      <RowCheckbox
                        checked={selectedIds.has(bot.id)}
                        onChange={(on) => setSelectedIds((prev) => toggleId(prev, bot.id, on))}
                        label={`Select ${bot.name}`}
                        className="mt-0"
                      />
                    ) : null}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-600/10">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Link
                          to={`/instances/${instance.id}/chatbots/${bot.id}/design`}
                          className="truncate text-sm font-semibold text-[var(--color-ink)] hover:underline"
                        >
                          {bot.name}
                        </Link>
                        <PublishBadge bot={bot} />
                      </div>
                      <p className="truncate text-[11px] text-[var(--color-ink-muted)]">
                        {bot.description || 'No description'} · Edited {formatEditedAgo(bot.updated_at)}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <AccessAvatars bot={bot} profiles={profiles} compact />
                    </div>
                    {botActions(bot, 'xs')}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {filteredBots.length ? (
            <PaginationBar
              page={safePage}
              pageSize={pageSize}
              total={filteredBots.length}
              label="chatbots"
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n)
                setPage(1)
              }}
            />
          ) : null}
        </div>
      ) : (
        <Card className="border-dashed border-teal-300/50 bg-teal-50/30 text-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            No chatbots yet.
          </p>
        </Card>
      )}
    </div>
  )
}
