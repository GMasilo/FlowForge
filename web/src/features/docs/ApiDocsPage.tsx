import { Download, ExternalLink, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AUTH_LABEL,
  PLATFORM_API_GROUPS,
  platformApiBaseUrl,
  publicSpecUrl,
  type PlatformApiAuth,
} from '@/features/docs/platformApi'
import { PlatformApiTokenCard } from '@/features/docs/PlatformApiTokenCard'
import { buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

function authClass(auth: PlatformApiAuth): string {
  return auth === 'none' ? 'bg-slate-100 text-slate-700' : 'bg-teal-500/10 text-teal-900'
}

export function ApiDocsPage() {
  const apiBase = platformApiBaseUrl()
  const openapiHref = apiBase ? `${apiBase}/openapi.json` : publicSpecUrl('openapi.json')
  const collectionHref = apiBase
    ? `${apiBase}/postman.json`
    : publicSpecUrl('postman/FlowForge-Platform-API.postman_collection.json')
  const envHref = apiBase
    ? `${apiBase}/postman-environment.json`
    : publicSpecUrl('postman/FlowForge-Platform-API.postman_environment.json')
  const redocHref = apiBase ? `${apiBase}/docs` : null

  return (
    <div className="ff-page-enter">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700/80">Platform API</p>
        <h1 className="mt-2 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-800 bg-clip-text text-3xl font-semibold text-transparent sm:text-4xl">
          HTTP API reference
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-ink-muted)]">
          FlowForge’s Platform API is a REST read API for chatbot-rich data: organisations, chatbots,
          published flow JSON, export packs, media, templates, entities, conversations (with transcripts),
          and analytics. Import the OpenAPI spec into Postman to explore it.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-3">
        <a className={cn(buttonVariants({ size: 'md' }), 'gap-2')} href={openapiHref} download>
          <Download className="h-4 w-4" />
          OpenAPI JSON
        </a>
        <a className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'gap-2')} href={collectionHref}>
          <Download className="h-4 w-4" />
          Postman collection
        </a>
        <a className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), 'gap-2')} href={envHref}>
          <Download className="h-4 w-4" />
          Postman environment
        </a>
        {redocHref ? (
          <a
            className={cn(buttonVariants({ variant: 'ghost', size: 'md' }), 'gap-2')}
            href={redocHref}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Live docs
          </a>
        ) : null}
      </div>

      <section className="mt-10 max-w-3xl space-y-3 rounded-2xl border border-[var(--color-border)]/70 bg-[var(--color-surface)]/60 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-800">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Authentication</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-700">
              Service accounts use a long-lived organisation token (<code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">ffpat_…</code>)
              from Admin → Security. Send <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">Authorization: Bearer &lt;token&gt;</code>.
              Never send the anon or service_role key from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">config.php</code> —
              the API uses those server-side after it verifies your token. Session JWTs still work for interactive tests but expire.
            </p>
            <div className="mt-4">
              <PlatformApiTokenCard />
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-700">
              <li>Start with <code>GET /v1/me</code> then list chatbots for an organisation id.</li>
              <li>
                Published runtime graph: <code>GET /v1/chatbots/&#123;id&#125;/flow</code>. Designer pack:{' '}
                <code>/export</code>.
              </li>
              <li>Transcripts: <code>GET /v1/conversations/&#123;id&#125;/events</code>.</li>
              <li>Default rate limit: 60 requests per 60 seconds. HTTP 429 includes <code>retry_after</code>.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900">Import into Postman</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700">
          <li>Download the OpenAPI JSON or the Postman collection and environment files above.</li>
          <li>In Postman: File → Import, then select the file(s).</li>
          <li>
            Set collection/environment variables: <code>baseUrl</code> (for example{' '}
            <code>{apiBase || 'https://gkjtt.co.za/flowforge/api'}</code>), paste a Platform API token
            (<code>ffpat_…</code>) or a session JWT into <code>accessToken</code>, then{' '}
            <code>organisationId</code> / <code>chatbotId</code> from <code>GET /v1/me</code>.
          </li>
          <li>Fill organisation IDs (<code>instanceId</code>, <code>chatbotId</code>, …) from the app as needed.</li>
        </ol>
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
          Product docs for flows, templates, and admin live on the{' '}
          <Link to="/docs" className="font-medium text-teal-800 hover:underline">
            Documentation
          </Link>{' '}
          page. This page is the HTTP contract.
        </p>
      </section>

      <div className="mt-12 space-y-10">
        {PLATFORM_API_GROUPS.map((group) => (
          <section key={group.id} id={group.id} className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{group.title}</h2>
            <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{group.blurb}</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)]/70">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Method</th>
                    <th className="px-3 py-2 font-semibold">Path</th>
                    <th className="px-3 py-2 font-semibold">Auth</th>
                    <th className="px-3 py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {group.endpoints.map((ep) => (
                    <tr key={`${ep.method}-${ep.path}`} className="border-t border-[var(--color-border)]/50">
                      <td className="px-3 py-2 align-top">
                        <code className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-teal-100">
                          {ep.method}
                        </code>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <code className="break-all text-[13px] text-slate-800">{ep.path}</code>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', authClass(ep.auth))}>
                          {AUTH_LABEL[ep.auth]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{ep.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
