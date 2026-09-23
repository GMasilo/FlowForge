/** Retry only a token rejected before execution because its issue time is ahead of the server. */
export async function retryJwtClockSkew<T extends { error: { message: string } | null }>(
  operation: () => PromiseLike<T>,
): Promise<T> {
  let result = await operation()
  for (const delay of [1000, 2000]) {
    if (!result.error || !/JWT issued at future/i.test(result.error.message)) return result
    await new Promise(resolve => setTimeout(resolve, delay))
    result = await operation()
  }
  return result
}
