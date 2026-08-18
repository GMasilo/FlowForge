import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils'

export function OtpAnswerField({
  value,
  onChange,
  length = 6,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  className?: string
}) {
  const count = Math.max(4, Math.min(12, Math.round(length)))
  const digits = value.replace(/\D/g, '').slice(0, count).split('')
  while (digits.length < count) digits.push('')
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [count])

  function setAt(index: number, char: string) {
    const next = digits.map((d, i) => (i === index ? char : d))
    onChange(next.join('').replace(/\D/g, '').slice(0, count))
  }

  return (
    <div className={cn('flex flex-1 justify-center gap-1.5', className)} role="group" aria-label="One-time code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          maxLength={1}
          value={digit}
          aria-label={`Digit ${index + 1}`}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (!raw) {
              setAt(index, '')
              return
            }
            const chars = raw.split('')
            let cursor = index
            const next = [...digits]
            for (const ch of chars) {
              if (cursor >= count) break
              next[cursor] = ch
              cursor += 1
            }
            onChange(next.join('').replace(/\D/g, '').slice(0, count))
            refs.current[Math.min(cursor, count - 1)]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus()
            }
            if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
            if (e.key === 'ArrowRight' && index < count - 1) refs.current[index + 1]?.focus()
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, count)
            if (!pasted) return
            onChange(pasted)
            refs.current[Math.min(pasted.length, count - 1)]?.focus()
          }}
          className={cn(
            'h-11 w-9 rounded-xl border border-slate-200 bg-slate-50 text-center font-mono text-sm font-semibold outline-none transition',
            'focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/15',
            disabled && 'opacity-50',
          )}
        />
      ))}
    </div>
  )
}
