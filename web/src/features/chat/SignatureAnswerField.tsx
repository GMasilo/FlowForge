import { useEffect, useRef, useState } from 'react'
import { Eraser, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import {
  storeAnswerFiles,
  type AnswerFileStoreCtx,
} from '@/features/designer/model/conversationFiles'

export function SignatureAnswerField({
  disabled,
  className,
  storeCtx,
  onSubmit,
}: {
  disabled?: boolean
  className?: string
  storeCtx: AnswerFileStoreCtx
  onSubmit: (value: Record<string, unknown>) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const width = Math.max(280, Math.floor(parent?.clientWidth ?? 320))
    const height = 160
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.25
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || busy) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    setHasStroke(true)
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    setHasStroke(false)
    setError(null)
  }

  async function submit() {
    const canvas = canvasRef.current
    if (!canvas || !hasStroke || busy) return
    setBusy(true)
    setError(null)
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((next) => (next ? resolve(next) : reject(new Error('Could not capture signature'))), 'image/png')
      })
      const file = new File([blob], 'signature.png', { type: 'image/png' })
      const [stored] = await storeAnswerFiles([file], storeCtx)
      if (!stored) throw new Error('Could not store signature')
      onSubmit(stored)
      clear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save signature')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          'h-40 w-full touch-none rounded-2xl border border-slate-200 bg-white shadow-inner',
          disabled && 'opacity-60',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 rounded-2xl"
          disabled={disabled || busy || !hasStroke}
          onClick={clear}
        >
          <Eraser className="h-4 w-4" />
          Clear
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 rounded-2xl"
          disabled={disabled || busy || !hasStroke}
          onClick={() => void submit()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
        </Button>
      </div>
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  )
}
