/**
 * Manual check: npx vite-node src/features/designer/model/dateBounds.check.ts
 */
import {
  earliestDatePickerMin,
  latestDatePickerMin,
  validateQuestionDateBounds,
} from '@/features/designer/model/flowSchema'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const now = new Date(2026, 7, 14, 15, 30)

{
  const issues = validateQuestionDateBounds(
    { answerType: 'date', minDate: '2026-08-01' },
    now,
  )
  assert(
    issues.some((i) => i.field === 'minDate' && i.message.includes('has passed')),
    'past earliest is an error',
  )
}
{
  const issues = validateQuestionDateBounds(
    { answerType: 'appointment', minDate: '2026-08-01', maxDate: '2026-07-10' },
    now,
  )
  assert(
    issues.some((i) => i.field === 'maxDate' && i.message.includes('cannot be before earliest')),
    'latest before earliest is an error',
  )
}
{
  const issues = validateQuestionDateBounds(
    { answerType: 'date', minDate: '2026-08-14', maxDate: '2026-08-20' },
    now,
  )
  assert(issues.length === 0, 'today and later latest is valid')
}
{
  const issues = validateQuestionDateBounds(
    { answerType: 'time', minDate: '17:00', maxDate: '09:00' },
    now,
  )
  assert(
    issues.some((i) => i.field === 'maxDate'),
    'latest time before earliest is an error',
  )
}
{
  const issues = validateQuestionDateBounds({ answerType: 'time', minDate: '09:00' }, now)
  assert(
    issues.some((i) => i.field === 'minDate' && i.message.includes('has passed')),
    'past earliest time is an error',
  )
}
{
  const issues = validateQuestionDateBounds(
    { answerType: 'datetime', minDate: '2026-08-14T09:00' },
    now,
  )
  assert(
    issues.some((i) => i.field === 'minDate' && i.message.includes('has passed')),
    'earliest datetime today before now is an error',
  )
}
{
  const issues = validateQuestionDateBounds(
    { answerType: 'datetime', minDate: '2026-08-14T16:00' },
    now,
  )
  assert(issues.length === 0, 'earliest datetime later today is valid')
}
{
  const issues = validateQuestionDateBounds(
    { answerType: 'datetime', minDate: '2026-08-20T09:00' },
    now,
  )
  assert(issues.length === 0, 'earliest datetime on a future day is valid')
}
{
  assert(
    earliestDatePickerMin('time', now) === '15:30',
    'time earliest min is now',
  )
  assert(
    latestDatePickerMin('time', '09:00', now) === '15:30',
    'time latest min is now when earliest is past',
  )
  assert(
    latestDatePickerMin('time', '17:00', now) === '17:00',
    'time latest min follows future earliest',
  )
  assert(
    latestDatePickerMin('datetime', '2026-08-14T09:00', now) === '2026-08-14T15:30',
    'datetime latest min is now when earliest is earlier today',
  )
}

console.log('dateBounds.check.ts: all passed')
