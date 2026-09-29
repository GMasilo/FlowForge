import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocumentOutputPreview } from '@/features/templates/DocumentOutputPreview'
import { starterTemplateContent, type DocumentContent } from '@/features/templates/templateModel'
import { describe, expect, it } from 'vitest'
import { interpolateTemplate, resolveExpressionValue } from './expressionEval'
import { createInitialPreviewState, tickPreview } from './previewRuntime'

const ctx = { vars: { name: 'Alex' }, steps: {} }
describe('expression errors', () => {
  it.each([
    '{{formatDate(uctNow(), "yyyy-MM-dd")}}',
    '{{vars.name + }}',
    '{{parseJson("invalid")}}',
    '{{utcNow()}',
    '{{}}',
    'tabulate({{uctNow()}})',
  ])('rejects invalid interpolation %s', source => {
    expect(() => interpolateTemplate(source, ctx)).toThrow()
    expect(() => resolveExpressionValue(source, ctx)).toThrow()
  })
  it('rejects invalid bare expressions without treating them as text', () => {
    expect(() => resolveExpressionValue('uctNow()', ctx)).toThrow('Unknown function')
    expect(() => resolveExpressionValue('formatDate(', ctx)).toThrow()
  })
  it('keeps prose and valid mixed, nested and quoted interpolations working', () => {
    expect(resolveExpressionValue('Hello Alex', ctx)).toBe('Hello Alex')
    expect(resolveExpressionValue('{{vars.name}} says hello!', ctx)).toBe('Alex says hello!')
    expect(interpolateTemplate('{{concat({{vars.name}}, "!")}}', ctx)).toBe('Alex!')
    expect(interpolateTemplate('{{concat("}}", "!")}}', ctx)).toBe('}}!')
    expect(resolveExpressionValue('{{1 + 2}}', ctx)).toBe(3)
  })
  it.each([{ text: '{{uctNow()}}' }, { text: 'Hello', onRun: 'uctNow()' }])(
    'shows the failed step in chat and stops execution', config => {
      const nodes = [{ id: 'n1', key: 'certificate', type: 'message' as const, label: 'Certificate', config, position: { x: 0, y: 0 } }]
      const state = tickPreview(createInitialPreviewState(nodes, [], {}), nodes, [])
      expect(state.phase.kind).toBe('finished')
      expect(state.messages.at(-1)?.text).toContain('Step "certificate" failed: Unknown function "uctNow"')
    },
  )
})

it('displays unknown functions as document preview errors', () => {
  const content = starterTemplateContent('document') as DocumentContent
  content.body = '{{formatDate(uctNow(), "yyyy-MM-dd")}}'
  const html = renderToStaticMarkup(createElement(DocumentOutputPreview, { kind: 'document', content }))
  expect(html).toContain('role="alert"')
  expect(html).toContain('uctNow')
})
it('sample evaluation cannot change visitor variables', () => {
  const vars = { name: 'Alex' }
  interpolateTemplate('{{setVar("name", "Changed")}}', { vars, steps: {}, previewOnly: true })
  expect(vars.name).toBe('Alex')
})
