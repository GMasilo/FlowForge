import { useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export function LocationAnswerField({
  disabled,
  className,
  onSubmit,
}: {
  disabled?: boolean
  className?: string
  onSubmit: (value: { lat: number; lng: number; accuracy?: number; label?: string }) => void
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function locate() {
    if (!navigator.geolocation) {
      setError('This browser cannot share location.')
      return
    }
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setBusy(false)
      },
      (err) => {
        setError(err.message || 'Could not read location.')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}>
      <Button
        type="button"
        variant="secondary"
        className="h-11 rounded-2xl"
        disabled={disabled || busy}
        onClick={locate}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {coords ? 'Update location' : 'Use my location'}
      </Button>
      {coords ? (
        <p className="text-[12px] text-[var(--color-ink-muted)]">
          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {coords.accuracy != null ? ` · ±${Math.round(coords.accuracy)}m` : ''}
        </p>
      ) : null}
      <input
        type="text"
        disabled={disabled}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (optional, e.g. office)"
        className="h-11 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm outline-none focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-accent)]/15"
      />
      <Button
        type="button"
        className="h-11 self-end rounded-2xl"
        disabled={disabled || !coords}
        onClick={() => {
          if (!coords) return
          onSubmit({ ...coords, ...(label.trim() ? { label: label.trim() } : {}) })
        }}
      >
        Send
      </Button>
      {error ? <p className="text-[11px] text-[var(--color-danger)]">{error}</p> : null}
    </div>
  )
}
