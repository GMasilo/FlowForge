/**
 * Manual check: npx vite-node src/features/designer/model/captchaChallenge.check.ts
 */
import { captchaAnswersMatch, generateCaptchaPuzzle } from '@/features/designer/model/captchaChallenge'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

{
  const p = generateCaptchaPuzzle('math')
  assert(p.kind === 'math' && p.prompt.includes(' ') && /^\d+$/.test(p.answer), 'math puzzle')
  assert(captchaAnswersMatch(p.answer, ` ${p.answer} `, 'math'), 'math match ignores spaces')
  assert(!captchaAnswersMatch(p.answer, String(Number(p.answer) + 1), 'math'), 'math rejects wrong')
}
{
  const p = generateCaptchaPuzzle('text')
  assert(p.kind === 'text' && p.prompt.length === 5 && p.answer === p.prompt, 'text puzzle')
  assert(captchaAnswersMatch(p.answer, p.answer.toLowerCase(), 'text'), 'text match is case-insensitive')
}

console.log('captchaChallenge.check.ts: all passed')
