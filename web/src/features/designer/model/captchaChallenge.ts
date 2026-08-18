export type CaptchaKind = 'math' | 'text'

export type CaptchaPuzzle = {
  kind: CaptchaKind
  /** Shown to the visitor (never store as the answer). */
  prompt: string
  answer: string
}

const TEXT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randInt(max: number): number {
  const bytes = new Uint8Array(1)
  crypto.getRandomValues(bytes)
  return bytes[0]! % max
}

export function generateCaptchaPuzzle(kind: CaptchaKind = 'math'): CaptchaPuzzle {
  if (kind === 'text') {
    let prompt = ''
    for (let i = 0; i < 5; i++) prompt += TEXT_ALPHABET[randInt(TEXT_ALPHABET.length)]
    return { kind: 'text', prompt, answer: prompt }
  }
  const a = 2 + randInt(11)
  const b = 2 + randInt(11)
  if (randInt(2) === 0) {
    return { kind: 'math', prompt: `${a} + ${b}`, answer: String(a + b) }
  }
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return { kind: 'math', prompt: `${hi} − ${lo}`, answer: String(hi - lo) }
}

export function captchaAnswersMatch(expected: string, entered: string, kind: CaptchaKind): boolean {
  const a = expected.trim()
  const b = entered.trim()
  if (!a || !b) return false
  if (kind === 'text') return a.toUpperCase() === b.toUpperCase().replace(/\s+/g, '')
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
}
