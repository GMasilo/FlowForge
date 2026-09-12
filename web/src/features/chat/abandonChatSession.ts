/** Best-effort abandon when the visitor closes the tab (keepalive fetch survives unload). */

export function abandonChatSessionOnUnload(
  sessionId: string,
  variables?: Record<string, unknown> | null,
): void {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey || !sessionId) return

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Prefer: 'return=minimal',
  }

  void fetch(`${url}/rest/v1/rpc/complete_conversation_session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_session_id: sessionId,
      p_status: 'abandoned',
      p_error_summary: 'Visitor left',
      p_variables: variables ?? null,
    }),
    keepalive: true,
  }).catch(() => {
    // Unload paths cannot surface errors to the UI.
  })
}
