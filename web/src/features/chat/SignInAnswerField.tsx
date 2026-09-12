import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  buildSignInSsoAuthorizeUrl,
  buildSignInSsoPreviewClaims,
  parseSignInConfig,
  resolveSignInSsoTemplate,
  type SignInMode,
} from '@/features/designer/model/signInStep'
import {
  chatSsoCallbackUrl,
  clearPendingSsoLaunch,
  isSsoMessage,
  packSsoRelayState,
  storePendingSsoLaunch,
  type ChatSsoSnapshot,
  type SsoCallbackResult,
} from '@/features/chat/chatSsoSession'

export type SignInSubmitPayload = {
  email: string
  password?: string
  otpCode?: string
  ssoClaims?: Record<string, unknown>
}

function newSsoNonce(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `sso_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function SignInAnswerField({
  mode,
  disabled,
  error,
  otpSent = false,
  otpSending = false,
  nodeConfig,
  templatesByKey,
  chatbotId,
  nodeId,
  /** Designer preview simulates IdP claims; live chat opens the IdP (popup preferred). */
  ssoLaunch = 'simulate',
  /** Live chat snapshot so a full-page return can resume the same conversation. */
  ssoSnapshot = null,
  onSendCode,
  onChangeEmail,
  onSubmit,
}: {
  mode: SignInMode
  disabled?: boolean
  error?: string | null
  otpSent?: boolean
  otpSending?: boolean
  nodeConfig?: Record<string, unknown>
  templatesByKey?: Record<string, unknown> | null
  chatbotId?: string
  nodeId?: string
  ssoLaunch?: 'simulate' | 'redirect'
  ssoSnapshot?: ChatSsoSnapshot | null
  onSendCode?: (email: string) => void | Promise<void>
  onChangeEmail?: () => void
  onSubmit: (payload: SignInSubmitPayload) => void | Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [ssoBusy, setSsoBusy] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const pendingNonceRef = useRef<string | null>(null)

  const needsPassword = mode === 'password' || mode === 'http' || mode === 'entity'
  const needsOtp = mode === 'otp'
  const otpAwaitingCode = needsOtp && otpSent
  const busy = !!disabled || otpSending || ssoBusy

  const signInCfg = parseSignInConfig(nodeConfig ?? { mode })
  const sso = mode === 'sso' ? resolveSignInSsoTemplate(signInCfg.ssoTemplateKey, templatesByKey) : null
  const displayError = localError || error
  const authorizePreviewUrl = sso
    ? buildSignInSsoAuthorizeUrl(sso, {
        redirectUri: typeof window !== 'undefined' ? chatSsoCallbackUrl() : 'https://example.com/callback',
        state: 'preview',
      })
    : null

  useEffect(() => {
    if (ssoLaunch !== 'redirect') return

    function onMessage(event: MessageEvent) {
      if (!isSsoMessage(event.data)) return
      const result = event.data as SsoCallbackResult
      if (!pendingNonceRef.current || result.state !== pendingNonceRef.current) return
      pendingNonceRef.current = null
      try {
        popupRef.current?.close()
      } catch {
        // ignore
      }
      popupRef.current = null
      void finishSsoResult(result)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [ssoLaunch, sso, onSubmit])

  if (mode === 'sign_out') return null

  async function finishSsoResult(result: SsoCallbackResult) {
    clearPendingSsoLaunch()
    if (!result.ok || !result.claims) {
      setLocalError(result.error || 'SSO sign-in failed')
      setSsoBusy(false)
      return
    }
    setLocalError(null)
    setSsoBusy(true)
    try {
      const claims = result.claims
      const claimEmail = String(claims.email ?? claims[sso?.emailClaim ?? 'email'] ?? '').trim()
      await onSubmit({
        email: claimEmail || 'sso.user@example.com',
        ssoClaims: claims,
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'SSO sign-in failed')
    } finally {
      setSsoBusy(false)
    }
  }

  async function submitSimulatedSso() {
    if (!sso) return
    setLocalError(null)
    setSsoBusy(true)
    try {
      const claims = buildSignInSsoPreviewClaims(sso)
      const claimEmail = String(claims[sso.emailClaim] ?? sso.previewEmail ?? '').trim()
      await onSubmit({
        email: claimEmail || sso.previewEmail || 'sso.user@example.com',
        ssoClaims: claims,
      })
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'SSO sign-in failed')
    } finally {
      setSsoBusy(false)
    }
  }

  function launchSsoRedirect() {
    if (!sso) return
    setLocalError(null)
    if (!chatbotId || !signInCfg.ssoTemplateKey) {
      setLocalError('SSO template / chatbot is not ready.')
      return
    }

    const nonce = newSsoNonce()
    const returnPath = `${window.location.pathname}${window.location.search}`
    const packedState = packSsoRelayState({
      nonce,
      chatbotId,
      templateKey: signInCfg.ssoTemplateKey,
      returnPath,
      protocol: sso.protocol,
    })
    const redirectUri = chatSsoCallbackUrl()
    const url = buildSignInSsoAuthorizeUrl(sso, { redirectUri, state: packedState })
    if (!url) {
      setLocalError(
        sso.protocol === 'saml'
          ? 'SAML needs SSO URL and Entity ID on the template.'
          : 'OIDC authorization URL and client ID are required on the SSO template.',
      )
      return
    }

    pendingNonceRef.current = nonce
    storePendingSsoLaunch({
      state: nonce,
      chatbotId,
      nodeId: nodeId || '',
      templateKey: signInCfg.ssoTemplateKey,
      returnPath,
      createdAt: Date.now(),
      protocol: sso.protocol,
      snapshot: ssoSnapshot,
    })

    setSsoBusy(true)
    // Prefer a popup so the chat page (and conversation) stay mounted.
    const popup = window.open(url, 'flowforge-sso', 'width=520,height=720,menubar=no,toolbar=no')
    if (popup) {
      popupRef.current = popup
      const timer = window.setInterval(() => {
        if (!popup.closed) return
        window.clearInterval(timer)
        if (pendingNonceRef.current === nonce) {
          pendingNonceRef.current = null
          setSsoBusy(false)
          setLocalError((prev) => prev || 'SSO window closed before sign-in finished')
        }
      }, 500)
      return
    }

    // Popup blocked — full-page navigation (snapshot restores conversation on return).
    const target = window.top && window.top !== window ? window.top : window
    try {
      target.location.assign(url)
    } catch {
      window.location.assign(url)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <p className="text-sm font-medium text-[var(--color-ink)]">Sign in</p>
      {mode === 'sso' ? (
        <>
          {!signInCfg.ssoTemplateKey ? (
            <p className="text-xs text-rose-600">
              No SSO template selected on this step. Open the inspector and pick a Templates → SSO /
              IdP template.
            </p>
          ) : !sso ? (
            <p className="text-xs text-rose-600">
              SSO template &quot;{signInCfg.ssoTemplateKey}&quot; was not found. Create it under
              Templates, then republish if you are on the live chat.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--color-ink-muted)]">
                Sign in with {sso.providerName || signInCfg.ssoTemplateKey} (
                {sso.protocol.toUpperCase()}).
              </p>
              {displayError ? <p className="text-xs text-rose-600">{displayError}</p> : null}
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  if (ssoLaunch === 'redirect') launchSsoRedirect()
                  else void submitSimulatedSso()
                }}
              >
                {ssoBusy
                  ? ssoLaunch === 'redirect'
                    ? 'Waiting for SSO…'
                    : 'Signing in…'
                  : sso.buttonLabel || 'Continue with SSO'}
              </Button>
              {ssoLaunch === 'simulate' ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--color-ink-muted)]">
                    Designer preview simulates IdP success as {sso.previewEmail}. Live chat opens the
                    identity provider in a popup and keeps this conversation.
                  </p>
                  {authorizePreviewUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={busy}
                      onClick={() => launchSsoRedirect()}
                    >
                      Open IdP (test)
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-ink-muted)]">
                  A sign-in window opens with {sso.providerName || 'your identity provider'}. Your
                  chat progress is kept.
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              autoComplete="username"
              disabled={busy || otpAwaitingCode}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {needsPassword ? (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="current-password"
                disabled={busy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : null}
          {otpAwaitingCode ? (
            <div>
              <Label>Verification code</Label>
              <Input
                inputMode="numeric"
                disabled={busy}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Code from your email"
                autoFocus
              />
              <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
                We emailed a code to {email.trim() || 'your inbox'}.
              </p>
            </div>
          ) : null}
          {displayError ? <p className="text-xs text-rose-600">{displayError}</p> : null}

          {needsOtp && !otpAwaitingCode ? (
            <Button
              type="button"
              size="sm"
              disabled={busy || !email.trim()}
              onClick={() => void onSendCode?.(email.trim())}
            >
              {otpSending ? 'Sending…' : 'Send code'}
            </Button>
          ) : null}

          {needsOtp && otpAwaitingCode ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !otpCode.trim()}
                onClick={() =>
                  onSubmit({
                    email: email.trim(),
                    otpCode: otpCode.trim(),
                  })
                }
              >
                Verify
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOtpCode('')
                  void onSendCode?.(email.trim())
                }}
              >
                Resend
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setOtpCode('')
                  onChangeEmail?.()
                }}
              >
                Change email
              </Button>
            </div>
          ) : null}

          {!needsOtp ? (
            <Button
              type="button"
              size="sm"
              disabled={busy || !email.trim() || (needsPassword && !password)}
              onClick={() =>
                onSubmit({
                  email: email.trim(),
                  password: needsPassword ? password : undefined,
                })
              }
            >
              Continue
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
