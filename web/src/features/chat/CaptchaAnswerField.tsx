import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Send } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

function drawCaptcha(canvas: HTMLCanvasElement, prompt: string) {
  const width = 240
  const height = 72
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#f1f5f9'
  ctx.fillRect(0, 0, width, height)

  for (let i = 0; i < 28; i++) {
    ctx.strokeStyle = `rgba(15, 118, 110, ${0.08 + Math.random() * 0.18})`
    ctx.lineWidth = 0.6 + Math.random()
    ctx.beginPath()
    ctx.moveTo(Math.random() * width, Math.random() * height)
    ctx.lineTo(Math.random() * width, Math.random() * height)
    ctx.stroke()
  }
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(15, 23, 42, ${0.08 + Math.random() * 0.2})`
    ctx.beginPath()
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  const chars = prompt.split('')
  const slot = width / (chars.length + 1)
  chars.forEach((ch, i) => {
    ctx.save()
    const x = slot * (i + 1)
    const y = height / 2 + (Math.random() * 10 - 5)
    ctx.translate(x, y)
    ctx.rotate((Math.random() - 0.5) * 0.45)
    ctx.font = `bold ${22 + Math.round(Math.random() * 6)}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = i % 2 === 0 ? '#0f766e' : '#0f172a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
}

export function CaptchaAnswerField({
  prompt,
  disabled,
  className,
  onSubmit,
  onRefresh,
}: {
  prompt: string
  disabled?: boolean
  className?: string
  onSubmit: (value: string) => void
  onRefresh?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !prompt) return
    drawCaptcha(canvas, prompt)
    setDraft('')
  }, [prompt])

  function submit() {
    const value = draft.trim()
    if (!value) return
    onSubmit(value)
    setDraft('')
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <canvas
          ref={canvasRef}
          width={240}
          height={72}
          className="h-[72px] w-[240px] max-w-full rounded-2xl border border-slate-200 bg-slate-50"
          aria-label="Captcha puzzle"
        />
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-11 shrink-0 rounded-2xl !px-0"
            disabled={disabled}
            onClick={onRefresh}
            aria-label="New captcha"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type the answer"
          aria-label="Captcha answer"
          className={cn(
            'h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition',
            'focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
        <Button type="submit" className="h-11 w-11 shrink-0 rounded-2xl !px-0" disabled={disabled || !draft.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
