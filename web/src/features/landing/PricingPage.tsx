import { Link } from 'react-router-dom'
import { ArrowRight, Check, Minus, Sparkles } from 'lucide-react'
import {
  PRICING_COMPARE,
  PRICING_FAQS,
  PRICING_PLANS,
  type PricingPlan,
} from '@/features/landing/pricingPlans'
import { buttonVariants } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { cn } from '@/shared/lib/utils'

function CellValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-[var(--color-accent)]" aria-label="Included" />
  }
  if (value === false) {
    return <Minus className="mx-auto h-4 w-4 text-[var(--color-ink-muted)]/40" aria-label="Not included" />
  }
  return <span className="text-[var(--color-ink-muted)]">{value}</span>
}

function PlanCard({ plan }: { plan: PricingPlan }) {
  return (
    <Card
      className={cn(
        'ff-hover-lift relative flex h-full flex-col gap-5 p-5 sm:p-6',
        plan.highlighted &&
          'border-[var(--color-accent)]/40 bg-gradient-to-b from-[var(--color-accent-soft)]/50 to-[var(--color-surface)] shadow-[var(--shadow-soft)]',
      )}
    >
      {plan.highlighted ? (
        <span className="absolute -top-2.5 left-5 rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent-fg)]">
          Most popular
        </span>
      ) : null}
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{plan.name}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">{plan.tagline}</p>
      </div>
      <div>
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          {plan.priceLabel}
          {plan.priceLabel.startsWith('$') ? (
            <span className="text-base font-medium text-[var(--color-ink-muted)]">/mo</span>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{plan.priceHint}</p>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm text-[var(--color-ink-muted)]">
        {plan.features.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        to={plan.ctaTo}
        className={cn(
          buttonVariants({ variant: plan.highlighted ? 'primary' : 'secondary', size: 'lg' }),
          'w-full justify-center gap-2',
        )}
      >
        {plan.ctaLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  )
}

export function PricingPage() {
  return (
    <div className="ff-page-enter space-y-14 pb-6 sm:space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/80 px-6 py-12 text-center shadow-[var(--shadow-soft)] sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 ff-mesh opacity-70" />
        <div className="relative mx-auto max-w-2xl">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent-soft)]/60 px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Pricing
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Plans that match how FlowForge is built
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--color-ink-muted)]">
            From a first public chatbot to staging, agent handoff, compliance, SSO, and the Platform API —
            choose capacity for the capabilities your organisation actually uses.
          </p>
        </div>
      </section>

      <section>
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PRICING_PLANS.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} />
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-[var(--color-ink-muted)]">
          * Fair-use chatbot counts apply on shared infrastructure. Conversation, email, and HTTP quotas are
          enforced per organisation under Admin → Usage.
        </p>
      </section>

      <section>
        <div className="mb-6 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
            Compare capabilities
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            Mapped to FlowForge features: designer, staging, agents, analytics, webhooks, compliance, and
            enterprise identity.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/70 shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]/60 bg-[var(--color-surface-2)]/40">
                <th className="px-4 py-3 font-semibold">Capability</th>
                <th className="px-3 py-3 text-center font-semibold">Starter</th>
                <th className="px-3 py-3 text-center font-semibold text-[var(--color-accent)]">Pro</th>
                <th className="px-3 py-3 text-center font-semibold">Business</th>
                <th className="px-3 py-3 text-center font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_COMPARE.map((row) => (
                <tr key={row.feature} className="border-b border-[var(--color-border)]/40 last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {row.feature}
                  </th>
                  <td className="px-3 py-3 text-center">
                    <CellValue value={row.starter} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CellValue value={row.pro} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CellValue value={row.business} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CellValue value={row.enterprise} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {PRICING_FAQS.map((item) => (
          <Card key={item.q} className="p-5">
            <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">{item.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{item.a}</p>
          </Card>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent-soft)]/70 via-[var(--color-surface)] to-[var(--color-surface)] px-6 py-10 text-center sm:px-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">
          See the product before you commit
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Walk industry journeys, read the docs, or sign in to design in your own organisation.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/use-cases" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
            Try use cases
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/docs" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Documentation
          </Link>
          <Link to="/login" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Sign in
          </Link>
        </div>
      </section>
    </div>
  )
}
