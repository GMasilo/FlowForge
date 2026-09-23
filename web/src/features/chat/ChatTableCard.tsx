import { useEffect, useRef, useState } from 'react'
import type { ChatTable } from './tableEmbed'

export function ChatTableCard({ table }: { table: ChatTable }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [page, setPage] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef('')
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source === window.parent && event.data?.source === 'flowforge.embed' && event.data?.type === 'table-opened' && event.data?.requestId === requestId.current) {
        if (timer.current) clearTimeout(timer.current)
        dialog.current?.close()
      }
    }
    window.addEventListener('message', receive)
    return () => { window.removeEventListener('message', receive); if (timer.current) clearTimeout(timer.current) }
  }, [])
  function expand() {
    if (timer.current) clearTimeout(timer.current)
    if (window.parent !== window) {
      requestId.current = crypto.randomUUID()
      window.parent.postMessage({ source: 'flowforge.embed', type: 'table-open', requestId: requestId.current, table }, '*')
      timer.current = setTimeout(() => dialog.current?.showModal(), 400)
    } else dialog.current?.showModal()
  }
  function renderTable(expanded: boolean) {
    const rows = expanded ? table.rows : table.rows.slice(page * 10, page * 10 + 10)
    return <div className="overflow-auto" style={{ maxHeight: expanded ? '70vh' : '20rem' }}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Records</caption>
        <thead><tr>{table.columns.map((column, i) => <th key={i} scope="col" className="sticky top-0 border-b px-3 py-2 font-semibold" style={{ background: 'var(--ff-chat-bubble-bot, #ffffff)' }}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-current/10 even:bg-black/5">{row.map((cell, j) => <td key={j} className="max-w-xs whitespace-pre-wrap break-words px-3 py-2 align-top">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  }
  return <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-current/20" aria-label="Table">
    <div className="flex items-center justify-between gap-3 p-2 text-xs"><span>{table.rows.length} records</span><button type="button" onClick={expand} className="rounded-lg border border-current/25 px-3 py-2 font-semibold">Maximise table</button></div>
    {table.rows.length ? renderTable(false) : <p className="p-3">No records to display.</p>}
    {table.rows.length > 10 && <div className="flex items-center justify-between gap-2 p-2 text-xs"><button type="button" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(table.rows.length / 10)}</span><button type="button" disabled={(page + 1) * 10 >= table.rows.length} onClick={() => setPage(page + 1)}>Next</button></div>}
    <dialog ref={dialog} aria-label="Expanded table" className="m-auto w-[95vw] max-w-6xl rounded-2xl p-4 shadow-2xl backdrop:bg-black/60" style={{ zIndex: 2147483647, background: 'var(--ff-chat-bubble-bot, #fff)', color: 'var(--ff-chat-bubble-bot-fg, #172033)' }}>
      <div className="mb-3 flex items-center justify-between"><strong>Table ? {table.rows.length} records</strong><button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border px-3 py-2">Close table</button></div>
      {renderTable(true)}
    </dialog>
  </section>
}
