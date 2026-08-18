import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CircleHelp, Compass, MessageSquareText } from 'lucide-react'
import { HELP_TOPICS } from '@/features/docs/content'
import { buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'

export function HelpPage() {
  const { session, loading } = useAuth()
  const signedIn = !loading && !!session

  return (
    <div className="ff-page-enter">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700/80">Help</p>
        <h1 className="mt-2 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
          How can we help?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          Pick a task below, browse the docs, or jump into the app to try it yourself.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/docs" className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'gap-2')}>
          <BookOpen className="h-4 w-4" />
          Documentation
        </Link>
        <Link to="/faq" className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'gap-2')}>
          <CircleHelp className="h-4 w-4" />
          FAQ
        </Link>
        <Link
          to={signedIn ? '/' : '/login'}
          className={cn(buttonVariants({ size: 'md' }), 'gap-2')}
        >
          <Compass className="h-4 w-4" />
          {signedIn ? 'Open app' : 'Sign in'}
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-slate-900">Guided topics</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Jump straight into the relevant docs section.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {HELP_TOPICS.map((topic) => (
            <li key={topic.title}>
              <Link
                to={topic.to}
                className="group flex h-full flex-col rounded-2xl border border-transparent px-1 py-1 transition hover:border-teal-200/60 hover:bg-white/50"
              >
                <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-slate-900 group-hover:text-teal-900">
                  {topic.title}
                </span>
                <span className="mt-1 flex-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {topic.description}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-800">
                  Read more <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 max-w-2xl border-t border-[var(--color-border)]/60 pt-10">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-800">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tips when something fails</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
              <li>Check the Problems panel in the designer for missing variables or broken references.</li>
              <li>Confirm the step’s Run after rules match the previous step’s outcome.</li>
              <li>For HTTP/email, verify the connection is selected and required params are filled.</li>
              <li>In Preview, expand Variables at the bottom to see what was actually stored.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
