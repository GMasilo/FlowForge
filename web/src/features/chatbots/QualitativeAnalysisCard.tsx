import type { QualitativeAnalysis } from '@/features/chatbots/stagingQualitativeAnalysis'
import { verdictBadgeClass, verdictPanelClass } from '@/features/chatbots/stagingQualitativeAnalysis'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'

export function QualitativeAnalysisCard({
  analysis,
  title = 'Analysis',
  className,
}: {
  analysis: QualitativeAnalysis
  title?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        verdictPanelClass(analysis.verdict),
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
        <Badge className={verdictBadgeClass(analysis.verdict)}>{analysis.headline}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{analysis.summary}</p>
      {analysis.findings.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Findings
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm text-[var(--color-ink)]">
            {analysis.findings.map((finding) => (
              <li key={finding} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {analysis.recommendations.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Recommendations
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm text-[var(--color-ink)]">
            {analysis.recommendations.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[var(--color-accent)]" aria-hidden>
                  →
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
