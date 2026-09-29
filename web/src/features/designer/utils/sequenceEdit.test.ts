import { describe, expect, it } from 'vitest'
import { findSiblingContext } from './sequenceEdit'
import type { DesignerNode, DesignerEdge } from '../model/flowSchema'
const nodes: DesignerNode[] = ['a','b','c'].map(id=>({id,key:id,label:id,type:'message',config:{},position:{x:0,y:0}}))
const edges: DesignerEdge[] = [{id:'ab',source:'a',target:'b'},{id:'bc',source:'b',target:'c'}]
describe('sibling lookup snapshots',()=>{
 it('reuses the index for repeated row rendering',()=>{
  const context=findSiblingContext(nodes,edges,'b')
  expect(context).toEqual({sequenceIds:['a','b','c'],index:1})
  expect(findSiblingContext(nodes,edges,'b')).toBe(context)
  expect(findSiblingContext(nodes,edges,'c')?.sequenceIds).toBe(context?.sequenceIds)
 })
 it('rebuilds on edge edits and retains the old undo snapshot',()=>{
  const reordered=[{id:'ac',source:'a',target:'c'},{id:'cb',source:'c',target:'b'}]
  expect(findSiblingContext(nodes,reordered,'b')).toEqual({sequenceIds:['a','c','b'],index:2})
  expect(findSiblingContext(nodes,edges,'b')?.index).toBe(1)
 })
 it('rebuilds on node edits and does not retain removed nodes',()=>{
  const reduced=nodes.slice(0,2)
  expect(findSiblingContext(reduced,edges,'c')).toBeNull()
  expect(findSiblingContext(reduced,edges,'b')?.sequenceIds).toEqual(['a','b'])
 })
})
