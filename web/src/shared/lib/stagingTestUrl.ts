/** Public staging test chat URL (unique per chatbot, no production slug required). */
export function stagingTestChatUrl(token: string): string {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${typeof window !== 'undefined' ? window.location.origin : ''}${basename}/test/${token}`
}

export function stagingTestEmbedUrl(token: string): string {
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${typeof window !== 'undefined' ? window.location.origin : ''}${basename}/embed/test/${token}`
}
