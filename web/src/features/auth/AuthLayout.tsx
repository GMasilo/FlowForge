import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { Card } from '@/shared/ui/card'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 ff-mesh" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />

      <div className="ff-page-enter relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl ff-brand-mark text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
            <span className="ff-gradient-text">FlowForge</span>
          </p>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">{subtitle}</p>
          <p className="mt-1 text-base font-medium text-slate-700">{title}</p>
        </div>
        <Card className="border-white/70 p-6 shadow-[var(--shadow-lift)]">{children}</Card>
        {footer ? (
          <div className="mt-5 text-center text-sm text-[var(--color-ink-muted)]">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}
