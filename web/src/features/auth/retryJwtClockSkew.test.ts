import { afterEach, describe, expect, test, vi } from 'vitest'
import { retryJwtClockSkew } from './retryJwtClockSkew'

afterEach(() => vi.useRealTimers())
describe('temporary JWT issue-time rejection', () => {
  test('waits and retries a token not yet accepted by the server', async () => {
    vi.useFakeTimers()
    const operation = vi.fn().mockResolvedValueOnce({ error: { message: 'JWT issued at future' } }).mockResolvedValue({ error: null, data: 'ok' })
    const pending = retryJwtClockSkew(operation)
    await vi.advanceTimersByTimeAsync(999)
    expect(operation).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ error: null, data: 'ok' })
  })
  test('stops after two retries and preserves the server error', async () => {
    vi.useFakeTimers()
    const failure = { error: { message: 'JWT issued at future' } }
    const operation = vi.fn().mockResolvedValue(failure)
    const pending = retryJwtClockSkew(operation)
    await vi.runAllTimersAsync()
    expect(await pending).toBe(failure)
    expect(operation).toHaveBeenCalledTimes(3)
  })
  test('does not retry expired tokens or permission failures', async () => {
    const operation = vi.fn().mockResolvedValue({ error: { message: 'JWT expired' } })
    await retryJwtClockSkew(operation)
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
