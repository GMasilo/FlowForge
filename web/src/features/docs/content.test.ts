import { expect, it } from 'vitest'
import { DOC_SECTIONS, EXPRESSION_FUNCTIONS, FAQ_ITEMS, HELP_TOPICS } from './content'
import { getFlowFunction } from '@/features/designer/model/flowFunctions'

it('exports the documentation and designer function catalog together', () => {
  expect(FAQ_ITEMS.length).toBeGreaterThan(0)
  expect(EXPRESSION_FUNCTIONS.find(fn => fn.name === 'formatDate')?.signature).toContain('(')
  expect(getFlowFunction('formatDate')?.params.length).toBeGreaterThan(0)
  expect(getFlowFunction('uctNow')).toBeUndefined()
})

it('keeps help links pointing to unique documentation sections', () => {
  const ids = DOC_SECTIONS.map(section => section.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const topic of HELP_TOPICS) {
    if (topic.to.startsWith('/docs#')) expect(ids).toContain(topic.to.slice('/docs#'.length))
  }
})
