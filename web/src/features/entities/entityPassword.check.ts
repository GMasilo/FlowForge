/**
 * Manual check: npx vite-node src/features/entities/entityPassword.check.ts
 */
import {
  applyPasswordHashesToValues,
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from '@/features/entities/entityPassword'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

{
  const hash = await hashPassword('secret-pass')
  assert(isPasswordHash(hash), 'hash format')
  assert(await verifyPassword('secret-pass', hash), 'verify ok')
  assert(!(await verifyPassword('wrong', hash)), 'verify reject')
  assert(hash === (await hashPassword(hash)), 'idempotent hash')
}

{
  assert(await verifyPassword('legacy', 'legacy'), 'legacy plaintext')
  assert(!(await verifyPassword('legacy', 'other')), 'legacy mismatch')
}

{
  const prev = { password: await hashPassword('old') }
  const kept = await applyPasswordHashesToValues({ password: '' }, [{ key: 'password', value_type: 'password' }], prev)
  assert(kept.password === prev.password, 'blank keeps previous hash')

  const changed = await applyPasswordHashesToValues(
    { password: 'new-secret' },
    [{ key: 'password', value_type: 'password' }],
    prev,
  )
  assert(isPasswordHash(String(changed.password)), 'new value hashed')
  assert(await verifyPassword('new-secret', changed.password), 'new hash verifies')
  assert(!(await verifyPassword('old', changed.password)), 'old password no longer works')
}

console.log('entityPassword.check.ts: all passed')
