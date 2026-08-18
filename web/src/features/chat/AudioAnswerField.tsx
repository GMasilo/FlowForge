import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import {
  storeAnswerFiles,
  type AnswerFileStoreCtx,
} from '@/features/designer/model/conversationFiles'

function pickMime(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

function extensionFor(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

export function AudioAnswerField({
  maxDurationSeconds = 60,
  disabled,
  className,
  storeCtx,
  onSubmit,
}: {
  maxDurationSeconds?: number
  disabled?: boolean
  className?: string
  storeCtx: AnswerFileStoreCtx
  onSubmit: (value: Record<string, unknown>) => void
}) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const limit = Math.min(180, Math.max(5, maxDurationSeconds))

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [blobUrl])

  async function start() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickMime()
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = recorder.mimeType || 'audio/webm'
        const next = new Blob(chunksRef.current, { type })
        if (blobUrl) URL.revokeObjectURL(blobUrl)
        setBlob(next)
        setBlobUrl(URL.createObjectURL(next))
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setElapsed(0)
      timerRef.current = window.setInterval(() => {
        setElapsed((n) => {
          if (n + 1 >= limit) {
            stop()
            return limit
          }
          return n + 1
        })
      }, 1000)
    } catch {
      setError('Microphone permission was denied.')
    }
  }

  function stop() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    recorderRef.current = null
    setRecording(false)
  }

  async function send() {
    if (!blob || busy) return
    setBusy(true)
    setError(null)
    try {
      const ext = extensionFor(blob.type)
      const file = new File([blob], `voice.${ext}`, { type: blob.type || 'audio/webm' })
      const [stored] = await storeAnswerFiles([file], storeCtx)
      if (!stored) throw new Error('Could not store recording')
      onSubmit(stored)
      setBlob(null)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
      setElapsed(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send recording')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        {recording ? (
          <Button type="button" variant="danger" className="h-11 rounded-2xl" disabled={disabled} onClick={stop}>
            <Square className="h-4 w-4" />
            Stop · {elapsed}s
          </Button>
        ) : (
          <Button type="button" variant="secondary" className="h-11 rounded-2xl" disabled={disabled || busy} onClick={() => void start()}>
            <Mic className="h-4 w-4" />
            Record
          </Button>
        )}
        <Button type="button" className="h-11 rounded-2xl" disabled={disabled || busy || !blob} onClick={() => void send()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </Button>
      </div>
      {blobUrl ? <audio src={blobUrl} controls className="w-full" /> : null}
      <p className="text-[11px] text-slate-400">Up to {limit} seconds. Stored in this chatbot’s conversation folder.</p>
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  )
}
