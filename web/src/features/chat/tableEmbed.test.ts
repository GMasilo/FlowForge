import { describe, expect, it } from 'vitest'
import { tabulate, encodeTable, decodeTable } from './tableEmbed'
import { interpolateTemplate } from '../designer/preview/expressionEval'
import { parseChatSegments, stripFileEmbeds, collectMediaFilenamesFromNodes } from '../designer/model/chatbotMedia'

describe('tabulate', () => {
  it('accepts a single flat record and retains falsy cells', () => {
    expect(tabulate({ name: 'Ada', count: 0, active: false, blank: null })).toEqual({ columns: ['name', 'count', 'active', 'blank'], rows: [['Ada', '0', 'false', '']] })
  })
  it('unions columns without reading inherited keys', () => {
    expect(tabulate([{ name: 'A' }, { count: 2 }])).toEqual({ columns: ['name', 'count'], rows: [['A', ''], ['', '2']] })
  })
  it('handles empty datasets and rejects nesting and oversized data', () => {
    expect(tabulate([]).rows).toEqual([])
    expect(() => tabulate([{ nested: {} }])).toThrow(/nested/)
    expect(() => tabulate(Array(1001).fill({ a: 1 }))).toThrow(/1,000/)
    expect(() => tabulate('https://example.com/data.xlsx')).toThrow(/Import/)
  })
  it('round trips Unicode and markup as text', () => {
    const encoded = encodeTable([{ name: '??? <script> " )' }])
    expect(decodeTable(encoded.slice(11, -2))).toEqual(tabulate([{ name: '??? <script> " )' }]))
    expect(decodeTable('bad')).toBeNull()
  })
  it('interpolates both function forms and Excel records into table segments', () => {
    const ctx = { vars: { records: [{ name: 'Ada' }], excel: { records: [{ name: 'Grace' }] } }, steps: {} }
    for (const source of ['tabulate({{vars.records}})', '{{tabulate(vars.records)}}', 'tabulate({{vars.excel.records}})']) {
      const text = interpolateTemplate(source, ctx)
      expect(parseChatSegments(text)[0]?.kind).toBe('table')
      expect(stripFileEmbeds(text)).toMatch(/name\n(Ada|Grace)/)
    }
  })
  it('renders the exact tourRecords expression and wrapped entity results', () => {
    for (const tourRecords of [[{ id: '1', visitor: 'Ada' }], { records: [{ id: '1', visitor: 'Ada' }], count: 1 }]) {
      const result = interpolateTemplate('{{tabulate(vars.tourRecords)}}', { vars: { tourRecords }, steps: {} })
      expect(parseChatSegments(result)[0]?.kind).toBe('table')
    }
  })
  it('shows actionable errors instead of silently retaining the function', () => {
    const missing = interpolateTemplate('{{tabulate(vars.tourRecords)}}', { vars: {}, steps: {} })
    expect(missing).toContain('Table unavailable: No records')
    const nested = interpolateTemplate('{{tabulate(vars.tourRecords)}}', { vars: { tourRecords: [{ details: { date: 'today' } }] }, steps: {} })
    expect(nested).toContain('Column "details"')
    expect(nested).not.toContain('{{tabulate')
  })
  it('matches the case-insensitive expression function convention', () => {
    expect(parseChatSegments(interpolateTemplate('{{TABULATE(vars.records)}}', { vars: { records: [{ a: 1 }] }, steps: {} }))[0]?.kind).toBe('table')
  })
  it('preserves surrounding text and existing media parsing', () => {
    const segments = parseChatSegments('Before ' + encodeTable({ a: 1 }) + ' After https://example.com/photo.jpg')
    expect(segments.map(s => s.kind)).toEqual(['text', 'table', 'text', 'file'])
    expect(collectMediaFilenamesFromNodes([{ config: { text: '{{media.photo_jpg}}' } }])).toBeDefined()
  })
})

