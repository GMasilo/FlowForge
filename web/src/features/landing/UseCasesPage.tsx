import {
  ArrowRight,
  Building2,
  ContactRound,
  Download,
  GraduationCap,
  HeartPulse,
  Landmark,
  MessageCircle,
  Pickaxe,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LandingChatWidget } from '@/features/landing/LandingChatWidget'
import { USE_CASES, type UseCaseIndustry } from '@/features/landing/useCases'
import { usePublicPlatformSettings } from '@/features/platform/platformSettings'
import { buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { cn } from '@/shared/lib/utils'

const ICONS = {
  health: HeartPulse,
  education: GraduationCap,
  mining: Pickaxe,
  banking: Landmark,
  retail: ShoppingBag,
  government: Building2,
  crm: ContactRound,
} as const

function sampleHref(file: string) {
  const base = (import.meta.env.BASE_URL as string).replace(/\/$/, '')
  return `${base}/samples/${file}`
}

export function UseCasesPage() {
  const settings = usePublicPlatformSettings()
  const demoOrgSlug = settings.data?.landing_org_slug?.trim() || null
  const usecaseSlugs = settings.data?.usecase_slugs ?? {}
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [demoOpen, setDemoOpen] = useState(false)

  function publicSlugFor(industry: UseCaseIndustry) {
    return usecaseSlugs[industry.id]?.trim() || industry.suggestedSlug
  }

  function tryDemo(industry: UseCaseIndustry) {
    setActiveSlug(publicSlugFor(industry))
    setDemoOpen(true)
  }

  return (
    <>
      <div className="ff-page-enter space-y-16 pb-8 sm:space-y-20">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/80 px-6 py-12 shadow-[var(--shadow-soft)] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-0 ff-mesh opacity-70" />
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-[var(--color-accent)]/15 blur-3xl" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/60 px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Industry scenarios
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              See FlowForge in{' '}
              <span className="ff-gradient-text">your industry</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-ink-muted)] sm:text-lg">
              Each scenario is a friendly service assistant for that industry — open an account, book
              induction, lodge a civic request, and more. Try the live demo, or import a pack from Platform
              settings when you are ready to host your own.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-6')}>
                Sign in to import
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'px-6')}>
                Back to home
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Seven verticals
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
              Pick a journey and walk the demo
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-[15px]">
              Tap <strong className="text-[var(--color-ink)]">Try demo</strong> to open the live assistant for
              that industry. Superadmins configure hosting under Platform settings.
            </p>
          </div>

          <ul className="ff-stagger grid gap-5 sm:grid-cols-2">
            {USE_CASES.map((industry) => {
              const Icon = ICONS[industry.id]
              return (
                <li key={industry.id} id={industry.id}>
                  <Card className="ff-hover-lift flex h-full flex-col gap-4 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex shrink-0 rounded-xl bg-[var(--color-accent-soft)] p-2.5 text-[var(--color-accent)]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
                          {industry.brand}
                        </p>
                        <h3 className="mt-0.5 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug">
                          {industry.title}
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      {industry.summary}
                    </p>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                        Scenario
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{industry.scenario}</p>
                    </div>

                    <ul className="flex flex-wrap gap-1.5">
                      {industry.highlights.map((h) => (
                        <li
                          key={h}
                          className="rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface-2)]/60 px-2 py-0.5 text-[11px] text-[var(--color-ink-muted)]"
                        >
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => tryDemo(industry)}
                        disabled={!demoOrgSlug}
                        title={
                          demoOrgSlug
                            ? undefined
                            : 'Configure a host organisation in Platform settings first'
                        }
                        className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        Try demo
                      </button>
                      <a
                        href={sampleHref(industry.sampleFile)}
                        download={industry.sampleFile}
                        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-1.5')}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Download JSON
                      </a>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <LandingChatWidget
        publicSlug={activeSlug}
        orgSlug={demoOrgSlug}
        open={demoOpen}
        switchOnSlugChange
      />
    </>
  )
}
