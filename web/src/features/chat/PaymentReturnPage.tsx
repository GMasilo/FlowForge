import { Button } from '@/shared/ui/button'

export function PaymentReturnPage() {
  const cancelled = new URLSearchParams(window.location.search).get('cancelled') === '1'
  return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6 text-[var(--color-ink)]">
    <section className="max-w-md space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <h1 className="text-xl font-semibold">{cancelled ? 'Checkout cancelled' : 'Return to your chat'}</h1>
      <p>{cancelled ? 'You can return to the original chat tab to check the payment status.' : 'Your original chat is still open in the previous tab. It will continue once your payment provider confirms the payment.'}</p>
      <Button onClick={() => window.close()}>Close this tab</Button>
      <p className="text-sm text-[var(--color-ink-muted)]">If this tab does not close, switch to your original chat tab. You do not need to start a new conversation.</p>
    </section>
  </main>
}
