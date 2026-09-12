import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bot,
  GitBranch,
  Inbox,
  Layers,
  Mail,
  Phone,
  Plug,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import { usePublicPlatformSettings } from '@/features/platform/platformSettings'
import { LandingChatWidget } from '@/features/landing/LandingChatWidget'
import { buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { cn } from '@/shared/lib/utils'

const DEFAULT_TAGLINE = 'Conversational automation platform'
const DEFAULT_HERO =
  'FlowForge helps organisations design, preview, and publish conversational experiences — from self-service bots to live agent handoff, analytics, and reusable marketplace packs.'

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Visual flow designer',
    description:
      'Design conversational journeys step by step — messages, questions, logic, transfers, and rich answer types.',
  },
  {
    icon: Bot,
    title: 'Chatbots & templates',
    description:
      'Start from starter templates or build from scratch. Reuse content packs, entities, and media across flows.',
  },
  {
    icon: Inbox,
    title: 'Live agent handoff',
    description:
      'Escalate to human agents from the Inbox and Agent console when conversations need a personal touch.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & insights',
    description:
      'Track session volume, completion rates, drop-off, and shop conversion with filters by chatbot and date.',
  },
  {
    icon: Plug,
    title: 'Connections & integrations',
    description:
      'Wire HTTP, email, payments, and enterprise integrations without exposing credentials in your flows.',
  },
  {
    icon: Store,
    title: 'Marketplace',
    description:
      'Publish flow packs to your organisation or install ready-made bots from the shared catalog.',
  },
] as const

const HIGHLIGHTS = [
  { icon: Layers, label: 'Multi-organisation workspaces' },
  { icon: Users, label: 'Role-based access for admins, editors, and agents' },
] as const

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)
  const settings = usePublicPlatformSettings()
  const platform = settings.data
  const tagline = platform?.hero_tagline?.trim() || DEFAULT_TAGLINE
  const heroDescription = platform?.hero_description?.trim() || DEFAULT_HERO
  const demoSlug = platform?.landing_public_slug?.trim() || null
  const demoOrgSlug = platform?.landing_org_slug?.trim() || null
  const hasDemo = !!demoSlug && !!demoOrgSlug
  const hasContact =
    !!platform?.contact_email?.trim() ||
    !!platform?.contact_phone?.trim() ||
    !!platform?.contact_url?.trim()
  const hasAbout = !!platform?.about_text?.trim()

  return (
    <>
      <div className="ff-page-enter space-y-20 pb-8 sm:space-y-28">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/80 px-6 py-14 shadow-[var(--shadow-soft)] sm:px-10 sm:py-20">
        <div className="pointer-events-none absolute inset-0 ff-mesh opacity-80" />
        <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[var(--color-accent)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[var(--color-accent-2)]/15 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/60 px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {tagline}
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Build chatbot flows your team can{' '}
            <span className="ff-gradient-text">ship with confidence</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-ink-muted)] sm:text-lg">
            {heroDescription}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-6')}>
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/pricing"
              className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'px-6')}
            >
              View pricing
            </Link>
            <Link
              to="/use-cases"
              className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'px-6')}
            >
              Explore use cases
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            Need access? Ask your organisation admin for an invite.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Platform
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to run conversational experiences
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
            From visual design to production chat, agent workflows, and operational visibility — in one workspace per
            organisation.
          </p>
        </div>

        <ul className="ff-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title}>
              <Card className="ff-hover-lift h-full space-y-3 p-5">
                <span className="inline-flex rounded-xl bg-[var(--color-accent-soft)] p-2.5 text-[var(--color-accent)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">{description}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/50 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">
              Built for teams at scale
            </h2>
            <ul className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <Icon className="h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link to="/use-cases" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Use cases
            </Link>
            <Link to="/pricing" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Pricing
            </Link>
            <Link to="/faq" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              FAQ
            </Link>
            <Link to="/help" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Get help
            </Link>
            <Link to="/terms" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Terms
            </Link>
            <Link to="/privacy" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Privacy
            </Link>
          </div>
        </div>
      </section>

      {hasAbout || hasContact ? (
        <section className="grid gap-6 lg:grid-cols-2">
          {hasAbout ? (
            <Card className="space-y-3 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">About FlowForge</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {platform!.about_text!.trim()}
              </p>
            </Card>
          ) : null}
          {hasContact ? (
            <Card className="space-y-4 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Contact</h2>
              <ul className="space-y-3 text-sm text-[var(--color-ink-muted)]">
                {platform?.contact_email?.trim() ? (
                  <li>
                    <a
                      className="inline-flex items-center gap-2 hover:text-[var(--color-accent)]"
                      href={`mailto:${platform.contact_email.trim()}`}
                    >
                      <Mail className="h-4 w-4 shrink-0" aria-hidden />
                      {platform.contact_email.trim()}
                    </a>
                  </li>
                ) : null}
                {platform?.contact_phone?.trim() ? (
                  <li>
                    <a
                      className="inline-flex items-center gap-2 hover:text-[var(--color-accent)]"
                      href={`tel:${platform.contact_phone.trim().replace(/\s+/g, '')}`}
                    >
                      <Phone className="h-4 w-4 shrink-0" aria-hidden />
                      {platform.contact_phone.trim()}
                    </a>
                  </li>
                ) : null}
                {platform?.contact_url?.trim() ? (
                  <li>
                    <a
                      className="inline-flex items-center gap-2 hover:text-[var(--color-accent)]"
                      href={platform.contact_url.trim()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {platform.contact_url.trim()}
                    </a>
                  </li>
                ) : null}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent-soft)]/80 via-[var(--color-surface)] to-[var(--color-surface)] px-6 py-12 text-center sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-accent)_12%,transparent),transparent_70%)]" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
            Ready to open your workspace?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)] sm:text-base">
            Sign in with your organisation account to design chatbots, manage live conversations, and monitor
            performance.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-8')}>
              Sign in to FlowForge
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {hasDemo ? (
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className={buttonVariants({ variant: 'secondary', size: 'lg' })}
              >
                Try the demo
              </button>
            ) : null}
          </div>
        </div>
      </section>
      </div>

      <LandingChatWidget publicSlug={demoSlug} orgSlug={demoOrgSlug} open={demoOpen} />
    </>
  )
}
