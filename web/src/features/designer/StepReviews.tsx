import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Reply, Check, AtSign } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { Button } from '@/shared/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'

type Member = { id: string; name: string }
export function StepReviews({ flowId, nodeKey, editable }: { flowId: string; nodeKey: string; editable: boolean }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [mentions, setMentions] = useState<Member[]>([])
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const [page, setPage] = useState(0)
  const [replyLimit, setReplyLimit] = useState(100)
  const queryKey = ['step-reviews', flowId, nodeKey, resolved, page]
  const members = useQuery({ queryKey: ['step-review-members', flowId], queryFn: async () => {
    const { data, error } = await supabase.rpc('step_review_members', { p_flow_id: flowId })
    if (error) throw error
    return (data ?? []) as Member[]
  } })
  const threads = useQuery({ queryKey, refetchInterval: 15000, queryFn: async () => {
    let query = supabase.from('flow_comments').select('*', { count: 'exact' }).eq('flow_id', flowId).eq('node_key', nodeKey).is('parent_id', null)
    query = resolved ? query.not('resolved_at', 'is', null) : query.is('resolved_at', null)
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(page * 10, page * 10 + 9)
    if (error) throw error
    return { rows: data ?? [], count: count ?? 0 }
  } })
  const ids = threads.data?.rows.map(c => c.id) ?? []
  const replies = useQuery({ queryKey: ['step-review-replies', flowId, ids, replyLimit], enabled: !!ids.length, refetchInterval: 15000, queryFn: async () => {
    const { data, error, count } = await supabase.from('flow_comments').select('*', { count: 'exact' }).eq('flow_id', flowId).in('parent_id', ids).order('created_at').limit(replyLimit)
    if (error) throw error
    return { rows: data ?? [], count: count ?? 0 }
  } })
  const refresh = async () => { await Promise.all([
    qc.invalidateQueries({ queryKey: ['step-reviews', flowId] }), qc.invalidateQueries({ queryKey: ['step-review-replies', flowId] }), qc.invalidateQueries({ queryKey: ['flow-comments', flowId] }),
  ]) }
  const add = useMutation({ mutationFn: async () => {
    const { error } = await supabase.rpc('add_step_review', { p_flow_id: flowId, p_node_key: nodeKey, p_parent_id: replyTo, p_body: body.trim(), p_mentions: mentions.filter(m => body.includes(`@${m.name}`)).map(m => m.id) })
    if (error) throw error
  }, onSuccess: async () => { setBody(''); setMentions([]); setReplyTo(null); await refresh() } })
  const resolve = useMutation({ mutationFn: async (id: string) => {
    const { error } = await supabase.rpc('set_step_review_resolved', { p_comment_id: id, p_resolved: !resolved })
    if (error) throw error
  }, onSuccess: refresh })
  const search = /(?:^|\s)@([^\s@]*)$/.exec(body)?.[1]
  const candidates = search === undefined ? [] : (members.data ?? []).filter(m => m.name.toLowerCase().includes(search.toLowerCase()) && m.id !== user?.id).slice(0, 8)
  const error = threads.error ?? replies.error ?? add.error ?? resolve.error ?? members.error
  const name = (id: string) => members.data?.find(m => m.id === id)?.name ?? 'Former collaborator'
  return <details className="mb-4 rounded-xl border border-[var(--color-border)] p-3">
    <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" />Step comments {threads.data ? `(${threads.data.count})` : ''}</summary>
    <div className="mt-3 space-y-3 text-xs">
      <div className="flex gap-2">{[false, true].map(value => <button key={String(value)} className={resolved === value ? 'font-bold underline' : ''} onClick={() => { setResolved(value); setPage(0); setReplyTo(null) }}>{value ? 'Resolved' : 'Open'}</button>)}</div>
      {error && <p role="alert" className="text-red-600">{error.message}</p>}
      {threads.isLoading ? <p>Loading comments…</p> : !threads.data?.count && <p className="text-[var(--color-ink-muted)]">No {resolved ? 'resolved' : 'open'} comments on this step.</p>}
      {threads.data?.rows.map(comment => <article key={comment.id} className="space-y-2 rounded-lg bg-[var(--color-surface-2)] p-2">
        <p className="break-all font-semibold">{name(comment.author_id)}</p><time className="text-[var(--color-ink-muted)]">{new Date(comment.created_at).toLocaleString()}</time>
        <p className="whitespace-pre-wrap break-words">{comment.body}</p>
        {(replies.data?.rows ?? []).filter(r => r.parent_id === comment.id).map(r => <div key={r.id} className="ml-2 border-l-2 pl-2"><p className="break-all font-semibold">{name(r.author_id)}</p><p className="whitespace-pre-wrap break-words">{r.body}</p></div>)}
        <div className="flex gap-3">{!resolved && <button onClick={() => setReplyTo(comment.id)} className="flex items-center gap-1"><Reply className="h-3 w-3" />Reply</button>}{(editable || comment.author_id === user?.id) && <button disabled={resolve.isPending} onClick={() => resolve.mutate(comment.id)} className="flex items-center gap-1"><Check className="h-3 w-3" />{resolved ? 'Reopen' : 'Resolve'}</button>}</div>
      </article>)}
      {!!replies.data && replies.data.rows.length < replies.data.count && <button className="underline" onClick={() => setReplyLimit(limit => limit + 100)}>Load more replies</button>}
      {!!threads.data?.count && <div className="flex items-center justify-between"><button disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={(page + 1) * 10 >= threads.data.count} onClick={() => setPage(p => p + 1)}>Next</button></div>}
      {!resolved && <form onSubmit={e => { e.preventDefault(); add.mutate() }} className="space-y-2">
        {replyTo && <p>Replying to thread <button type="button" onClick={() => setReplyTo(null)} className="underline">Cancel reply</button></p>}
        <textarea aria-label="Step comment" maxLength={5000} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="Write a review. Type @ to mention a collaborator." className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2" />
        {!!candidates.length && <ul aria-label="Mention suggestions" className="rounded-lg border border-[var(--color-border)] p-1">{candidates.map(m => <li key={m.id}><button type="button" className="w-full break-all p-1 text-left hover:underline" onClick={() => { setBody(b => b.replace(/@[^\s@]*$/, `@${m.name} `)); setMentions(ms => [...ms.filter(x => x.id !== m.id), m]) }}><AtSign className="mr-1 inline h-3 w-3" />{m.name}</button></li>)}</ul>}
        <Button size="sm" type="submit" disabled={!body.trim() || add.isPending}>{add.isPending ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}</Button>
        <p className="text-[var(--color-ink-muted)]">Selected @mentions receive an in-app notification. Save new steps before commenting.</p>
      </form>}
    </div>
  </details>
}
