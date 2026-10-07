import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Plus, Pause, Play } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import type { InstalledEntity } from './entityApi'
import type { EntityJob } from './entityJobTypes'

export function EntityJobsPanel({ entity, canManage }: { entity: InstalledEntity; canManage: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<EntityJob> | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const jobs = useQuery({ queryKey: ['entity-jobs', entity.id], queryFn: async () => {
    const { data, error } = await supabase.from('entity_jobs').select('*').eq('entity_id', entity.id).order('created_at', { ascending: false })
    if (error) throw error
    return data
  } })
  const connections = useQuery({ queryKey: ['entity-job-connections', entity.chatbot_id], queryFn: async () => {
    const { data: links, error: linkError } = await supabase.from('chatbot_connections').select('connection_id').eq('chatbot_id', entity.chatbot_id)
    if (linkError) throw linkError
    const { data, error } = await supabase.from('connections').select('id,name,kind,chatbot_id').is('deleted_at', null).in('kind', ['http', 'database'])
    if (error) throw error
    return (data ?? []).filter(c => c.chatbot_id === entity.chatbot_id || links?.some(l => l.connection_id === c.id))
  } })
  const history = useQuery({ queryKey: ['entity-job-runs', historyId], enabled: !!historyId, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await supabase.from('entity_job_runs').select('*').eq('job_id', historyId!).order('started_at', { ascending: false }).limit(20)
    if (error) throw error
    return data
  } })
  const refresh = () => qc.invalidateQueries({ queryKey: ['entity-jobs', entity.id] })
  const save = useMutation({ mutationFn: async () => {
    if (!editing) return
    const values = {
      entity_id: entity.id, name: editing.name?.trim() || '', action: editing.action ?? 'csv_s3',
      daily_time: editing.daily_time ?? '01:00', timezone: editing.timezone ?? 'Africa/Johannesburg',
      destination: editing.destination?.trim() || null, columns: editing.columns ?? [],
      stale_days: editing.stale_days ?? 90, filter_key: editing.filter_key || null, filter_value: editing.filter_value || null,
      connection_id: ['http_api', 'database'].includes(editing.action ?? '') ? editing.connection_id || null : null,
      http_path: editing.action === 'http_api' ? editing.http_path?.trim() || '' : '',
      http_method: editing.http_method ?? 'POST', target_table: editing.action === 'database' ? editing.target_table?.trim() || null : null,
      enabled: false,
    }
    const { error } = editing.id ? await supabase.from('entity_jobs').update(values).eq('id', editing.id) : await supabase.from('entity_jobs').insert(values)
    if (error) throw error
  }, onSuccess: async () => { setEditing(null); setNotice('Saved paused. Review the settings, then enable when ready.'); await refresh() } })
  const preview = useMutation({ mutationFn: async (job: EntityJob) => {
    const { data, error } = await supabase.rpc('preview_entity_cleanup', { p_job_id: job.id })
    if (error) throw error
    setNotice(`${job.name}: ${data} matching records now. Each scheduled run deletes at most 1,000 records. Counts can change before the run.`)
  } })
  const toggle = useMutation({ mutationFn: async (job: EntityJob) => {
    if (!job.enabled && job.action === 'cleanup') {
      const { data, error } = await supabase.rpc('preview_entity_cleanup', { p_job_id: job.id })
      if (error) throw error
      if (!window.confirm(`Enable daily deletion for ${job.name}? Currently ${data} records match: ${job.filter_key} = ${job.filter_value}, unchanged for more than ${job.stale_days} days. Up to 1,000 will be permanently deleted per run.`)) return
    }
    const { error } = await supabase.from('entity_jobs').update({ enabled: !job.enabled }).eq('id', job.id)
    if (error) throw error
  }, onSuccess: refresh })
  const error = jobs.error ?? connections.error ?? save.error ?? toggle.error ?? preview.error ?? history.error
  const fieldClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'
  const change = (values: Partial<EntityJob>) => setEditing(e => ({ ...e, ...values }))
  return <details className="mt-4 rounded-xl border border-[var(--color-border)] p-4">
    <summary className="cursor-pointer font-semibold"><Clock className="mr-2 inline h-4 w-4" />Scheduled jobs {jobs.data?.length ? `(${jobs.data.length})` : ''}</summary>
    <p className="my-3 text-sm text-[var(--color-ink-muted)]">Export this entity to S3, an API or your own database each day, or remove stale records. Jobs run on the server even when the app is closed. An administrator must configure the job runner first.</p>
    {error && <p role="alert" className="my-2 text-sm text-red-600">{error.message}</p>}
    {notice && <p role="status" className="my-2 text-sm">{notice}</p>}
    {jobs.isLoading && <p>Loading schedules…</p>}
    {!jobs.isLoading && !jobs.data?.length && !jobs.error && <p className="mb-3 text-sm">No scheduled jobs yet.</p>}
    {jobs.data?.map(job => <div key={job.id} className="my-2 rounded-lg bg-[var(--color-surface-2)] p-3 text-sm">
      <p className="font-semibold">{job.name} · {job.enabled ? 'Enabled' : 'Paused'}</p>
      <p>{job.action === 'csv_s3' ? `CSV to ${job.destination}` : job.action === 'http_api' ? `JSON to API · ${job.http_method} ${job.http_path || '/'}` : job.action === 'database' ? `Insert into ${job.target_table}` : `Delete ${job.filter_key} = ${job.filter_value}, unchanged for ${job.stale_days} days`}</p>
      <p>Daily at {job.daily_time.slice(0,5)} ({job.timezone})</p>
      {job.enabled && <p>Next scheduled: {new Date(job.next_run_at).toLocaleString()}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {canManage && <><Button size="sm" variant="secondary" disabled={toggle.isPending} onClick={() => toggle.mutate(job)}>{job.enabled ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{job.enabled ? 'Pause' : 'Enable'}</Button><Button size="sm" variant="secondary" onClick={() => setEditing(job)}>Edit</Button></>}
        {job.action === 'cleanup' && <Button size="sm" variant="secondary" disabled={preview.isPending} onClick={() => preview.mutate(job)}>Preview matching count</Button>}
        <Button size="sm" variant="secondary" onClick={() => setHistoryId(historyId === job.id ? null : job.id)}>Run history</Button>
      </div>
      {historyId === job.id && <div className="mt-3 space-y-2">{history.isLoading ? <p>Loading runs…</p> : !history.data?.length ? <p>No runs yet. Enabled jobs wait for the server scheduler.</p> : history.data.map(run => <div key={run.id} className="border-t border-[var(--color-border)] pt-2"><p>{new Date(run.started_at).toLocaleString()} · {run.status}{run.row_count !== null ? ` · ${run.row_count} rows` : ''}</p>{run.object_key && <p className="break-all">{run.object_key}</p>}{run.error && <p className="text-red-600">{run.error}</p>}</div>)}<p className="text-xs text-[var(--color-ink-muted)]">Latest 20 runs</p></div>}
    </div>)}
    {canManage && !editing && <Button size="sm" variant="secondary" onClick={() => setEditing({ action: 'csv_s3', name: `${entity.name} daily export`, daily_time: '01:00', timezone: 'Africa/Johannesburg', columns: entity.attributes.filter(a => a.value_type !== 'password').map(a => a.key), stale_days: 90 })}><Plus className="h-4 w-4" />Add scheduled job</Button>}
    {!canManage && <p className="text-xs text-[var(--color-ink-muted)]">An owner or administrator can manage these schedules.</p>}
    {editing && <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate() }}>
      <label className="block text-sm">Job name<input required maxLength={100} className={fieldClass} value={editing.name ?? ''} onChange={e => change({ name: e.target.value })} /></label>
      <label className="block text-sm">Action<select className={fieldClass} value={editing.action} onChange={e => change({ action: e.target.value as EntityJob['action'], connection_id: null })}><option value="csv_s3">Export CSV to S3</option><option value="http_api">Send JSON to an API</option><option value="database">Insert into a database</option><option value="cleanup" disabled={entity.kind !== 'dynamic'}>Delete stale records</option></select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Every day at<input type="time" required className={fieldClass} value={editing.daily_time?.slice(0,5)} onChange={e => change({ daily_time: e.target.value })} /></label><label className="block text-sm">Timezone<input required className={fieldClass} value={editing.timezone ?? ''} placeholder="Africa/Johannesburg" onChange={e => change({ timezone: e.target.value })} /></label></div>
      {editing.action !== 'cleanup' ? <>
        {editing.action === 'csv_s3' && <>
        <label className="block text-sm">S3 destination name<input required pattern="[A-Za-z0-9_-]+" maxLength={80} className={fieldClass} value={editing.destination ?? ''} onChange={e => change({ destination: e.target.value })} /></label>
        <p className="text-xs text-[var(--color-ink-muted)]">Use the destination name configured by your server administrator. AWS credentials stay on the server. Exports are limited to 10,000 rows / 20 MB and exclude password fields.</p>
        </>}
        {(editing.action === 'http_api' || editing.action === 'database') && <>
          <label className="block text-sm">Destination connection<select required className={fieldClass} value={editing.connection_id ?? ''} onChange={e => change({ connection_id: e.target.value })}><option value="">Choose a connection</option>{connections.data?.filter(c => c.kind === (editing.action === 'http_api' ? 'http' : 'database')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <p className="text-xs text-[var(--color-ink-muted)]">Create or install a connection in this chatbot’s Connections section first. Its saved authentication is used on the server.</p>
          {editing.action === 'http_api' ? <>
            <label className="block text-sm">Method<select className={fieldClass} value={editing.http_method ?? 'POST'} onChange={e => change({ http_method: e.target.value as EntityJob['http_method'] })}>{['POST','PUT','PATCH'].map(m => <option key={m}>{m}</option>)}</select></label>
            <label className="block text-sm">Path after the connection’s base URL<input className={fieldClass} value={editing.http_path ?? ''} placeholder="/imports/contacts" onChange={e => change({ http_path: e.target.value })} /></label>
            <p className="text-xs text-[var(--color-ink-muted)]">Sends JSON with job_id, run_id, entity_id, columns and records. Use an API that accepts this batch format, including an API that writes to your database. Only a 2xx response counts as success.</p>
          </> : <>
            <label className="block text-sm">Destination table<input required pattern="[A-Za-z_][A-Za-z0-9_]*([.][A-Za-z_][A-Za-z0-9_]*)?" className={fieldClass} value={editing.target_table ?? ''} placeholder="public.contacts" onChange={e => change({ target_table: e.target.value })} /></label>
            <p className="text-xs text-[var(--color-ink-muted)]">The table must already exist. Selected entity keys must match its column names. Each run appends every record; it does not update or remove existing rows. Use a transactional table. Database batches are limited to 1,000 records.</p>
          </>}
          <p className="text-xs text-[var(--color-ink-muted)]">Every run sends a full snapshot. Include a stable key and handle duplicates at the destination. Password fields are excluded. API exports are limited to 10,000 records / 20 MB.</p>
        </>}
        <fieldset><legend className="text-sm font-semibold">Columns to export</legend><div className="mt-1 flex flex-wrap gap-3">{entity.attributes.filter(a => a.value_type !== 'password').map(a => <label key={a.key} className="text-sm"><input type="checkbox" checked={editing.columns?.includes(a.key) ?? false} onChange={e => change({ columns: e.target.checked ? [...(editing.columns ?? []), a.key] : editing.columns?.filter(k => k !== a.key) })} /> {a.label || a.key}</label>)}</div></fieldset>
      </> : <>
        <label className="block text-sm">Unchanged for more than this many days<input required min={1} max={3650} type="number" className={fieldClass} value={editing.stale_days ?? 90} onChange={e => change({ stale_days: Number(e.target.value) })} /></label>
        <label className="block text-sm">Only when this field<select required className={fieldClass} value={editing.filter_key ?? ''} onChange={e => change({ filter_key: e.target.value })}><option value="">Choose a field</option>{entity.attributes.filter(a => a.value_type !== 'password').map(a => <option key={a.key} value={a.key}>{a.label || a.key}</option>)}</select></label>
        <label className="block text-sm">Equals exactly<input required className={fieldClass} value={editing.filter_value ?? ''} placeholder="e.g. stale" onChange={e => change({ filter_value: e.target.value })} /></label>
        <p className="text-xs text-[var(--color-ink-muted)]">Cleanup uses the record’s last-updated time and deletes up to 1,000 matching records per day. Save first to preview the count.</p>
      </>}
      <div className="flex gap-2"><Button type="submit" disabled={save.isPending || (editing.action !== 'cleanup' && !editing.columns?.length)}>{save.isPending ? 'Saving…' : 'Save paused'}</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button></div>
    </form>}
  </details>
}
