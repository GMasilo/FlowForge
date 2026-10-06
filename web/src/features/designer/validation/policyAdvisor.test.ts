import { expect, it } from 'vitest'
import { policyWarnings } from './policyAdvisor'
import type { DesignerNode, DesignerEdge } from '../model/flowSchema'

const node = (type: DesignerNode['type'], config: Record<string, unknown>): DesignerNode => ({ id: 'n', key: 'n', label: 'Step', type, config, position: { x: 0, y: 0 } })
const named = (id: string, type: DesignerNode['type'], config: Record<string, unknown>): DesignerNode => ({ ...node(type, config), id, key: id })
const edge = (source: string, target: string): DesignerEdge => ({ id: `${source}-${target}`, source, target })
const legalTemplates = { privacy: { title: 'Privacy notice', body: 'We collect personal data for your application.' } }
it('clears downstream declaration warnings after a legal template and confirmation', () => {
  const consent = named('consent', 'question', { answerType: 'confirm', prompt: '{{templates.privacy}}' })
  const id = named('id', 'question', { answerType: 'text', prompt: 'Your ID number' })
  expect(policyWarnings([consent, id], [edge('consent', 'id')], legalTemplates)).toEqual([])
  expect(policyWarnings([consent, id], [edge('consent', 'id')], {}).map(w => w.code)).toContain('policy_collection_national_id')
  expect(policyWarnings([consent, id], [edge('id', 'consent')], legalTemplates).map(w => w.code)).toContain('policy_collection_national_id')
})
it('recognises a separate prior notice but not a notice without confirmation', () => {
  const notice = named('notice', 'message', { text: '{{templates.privacy}}' })
  const consent = named('consent', 'question', { answerType: 'confirm' })
  const id = named('id', 'question', { answerType: 'national_id' })
  expect(policyWarnings([notice, consent, id], [edge('notice', 'consent'), edge('consent', 'id')], legalTemplates)).toEqual([])
  expect(policyWarnings([notice, id], [edge('notice', 'id')], legalTemplates)).toHaveLength(1)
})
it('retains warnings on bypass paths, jumps and cycles that collect before confirmation', () => {
  const start = named('start', 'skip_to', { targetNodeKey: 'id' })
  const consent = named('consent', 'question', { answerType: 'confirm', prompt: '{{templates.privacy}}' })
  const id = named('id', 'question', { answerType: 'national_id' })
  for (const edges of [
    [edge('start', 'consent'), edge('consent', 'id')],
    [edge('start', 'consent'), edge('start', 'id'), edge('consent', 'id')],
    [edge('id', 'consent'), edge('consent', 'id')],
  ]) expect(policyWarnings([start, consent, id], edges, legalTemplates).map(w => w.code)).toContain('policy_collection_national_id')
})
it('keeps card security warnings after confirmation', () => {
  const consent = named('consent', 'question', { answerType: 'confirm', prompt: '{{templates.privacy}}' })
  expect(policyWarnings([consent, named('card', 'question', { answerType: 'credit_card' })], [edge('consent', 'card')], legalTemplates).map(w => w.code)).toEqual(['policy_card_data'])
})
it.each(['Please enter your ID number', 'Identity number', 'Identification no.', 'Your SA ID', 'National ID', 'idNumber', 'IDNumber', 'id_number'])('flags identity collection in ordinary questions: %s', prompt => {
  expect(policyWarnings([node('question', { answerType: 'text', prompt })]).map(w => w.code)).toContain('policy_collection_national_id')
})
it('detects identity variable names and form labels and avoids duplicate typed warnings', () => {
  for (const config of [
    { answerType: 'number', outputVariable: 'vars.IDNumber' },
    { answerType: 'form', formFields: [{ type: 'text', label: 'ID number' }] },
    { answerType: 'form', formFields: [{ type: 'text', key: 'identityNumber' }] },
    { answerType: 'national_id', prompt: 'ID number' },
  ]) {
    expect(policyWarnings([node('question', config)]).filter(w => w.code === 'policy_collection_national_id')).toHaveLength(1)
  }
})
it('does not infer government identity from a bare record identifier', () => {
  expect(policyWarnings([node('question', { answerType: 'text', prompt: 'Enter order ID', outputVariable: 'orderId' })])).toEqual([])
})
it('flags contact collection and sensitive wording, including nested form fields', () => {
  expect(policyWarnings([node('question', { answerType: 'email' })])[0]?.code).toBe('policy_collection_email')
  const warnings = policyWarnings([node('question', { answerType: 'form', formFields: [{ type: 'email', label: 'Email' }, { type: 'text', key: 'medicalDiagnosis' }] })])
  expect(warnings.map(w => w.code)).toEqual(['policy_collection_email', 'policy_sensitive'])
  expect(warnings.every(w => w.severity === 'warning' && w.nodeId === 'n')).toBe(true)
})
it('distinguishes inference from a health check and never echoes secrets', () => {
  const warnings = policyWarnings([node('integration', { action: 'ml.classify_intent', token: 'private-secret' })])
  expect(warnings.map(w => w.code)).toContain('policy_model')
  expect(JSON.stringify(warnings)).not.toContain('private-secret')
  expect(policyWarnings([node('integration', { action: 'ml.health_check' })]).some(w => w.code === 'policy_model')).toBe(false)
})
it('does not treat a privacy notice as proof of compliance or flag ordinary copy', () => {
  expect(policyWarnings([node('message', { text: 'Hello! We discuss medical services.' })])).toEqual([])
  expect(policyWarnings([node('question', { answerType: 'credit_card', prompt: 'See our privacy notice' })])[0]?.code).toBe('policy_card_data')
})
it('flags cookies and generated documents without mutating the flow', () => {
  const n = node('message', { text: '{{templates.invoice.file}}', onRun: '{{setCookie("email", vars.email)}}' })
  const before = JSON.stringify(n)
  expect(policyWarnings([n]).map(w => w.code)).toEqual(['policy_cookie', 'policy_document'])
  expect(JSON.stringify(n)).toBe(before)
})
