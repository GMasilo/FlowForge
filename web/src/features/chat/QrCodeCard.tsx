import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, QrCode } from 'lucide-react'
import type { QrEmbedPayload } from '@/features/templates/qrEmbed'
import { cn } from '@/shared/lib/utils'

async function buildQrDataUrl(payload: QrEmbedPayload): Promise<string> {
  return QRCode.toDataURL(payload.payload, {
    errorCorrectionLevel: payload.errorCorrection,
    margin: 2,
    width: payload.size,
    color: {
      dark: payload.foreground || '#0f172a',
      light: payload.background || '#ffffff',
    },
  })
}

export function QrCodeCard({
  qr,
  className,
  compact,
}: {
  qr: QrEmbedPayload
  className?: string
  compact?: boolean
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (!qr.payload.trim()) {
      setDataUrl(null)
      setError('No payload')
      return
    }
    void buildQrDataUrl(qr)
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null)
          setError('Could not generate QR')
        }
      })
    return () => {
      cancelled = true
    }
  }, [qr])

  const size = compact ? Math.min(120, qr.size) : qr.size

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        className,
      )}
    >
      {(qr.title.trim() || qr.caption.trim()) && (
        <div className="border-b border-[var(--color-border)] px-3 py-2.5">
          {qr.title.trim() ? (
            <p className="text-sm font-semibold text-[var(--color-ink)]">{qr.title}</p>
          ) : null}
          {qr.caption.trim() ? (
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{qr.caption}</p>
          ) : null}
        </div>
      )}
      <div className="flex flex-col items-center gap-2 bg-[var(--color-surface-2)] px-4 py-4">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={qr.title.trim() || 'QR code'}
            width={size}
            height={size}
            className="rounded-lg bg-white shadow-sm"
          />
        ) : (
          <div
            className="grid place-items-center rounded-lg bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
            style={{ width: size, height: size }}
          >
            <QrCode className="h-8 w-8 opacity-50" aria-hidden />
            {error ? <span className="mt-1 text-[10px]">{error}</span> : null}
          </div>
        )}
        {!compact && qr.payload.trim() ? (
          <p className="max-w-full truncate font-mono text-[10px] text-[var(--color-ink-muted)]" title={qr.payload}>
            {qr.payload}
          </p>
        ) : null}
        {!compact && dataUrl ? (
          <a
            href={dataUrl}
            download={qr.filename || 'qr.png'}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download PNG
          </a>
        ) : null}
      </div>
    </div>
  )
}
