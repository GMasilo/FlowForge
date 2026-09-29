import { describe, expect, it } from 'vitest'
import { buildLinearItems, findContinueRootIds } from './conditionGraph'
import type { DesignerEdge, DesignerNode } from '../model/flowSchema'
const node = (id: string, type: DesignerNode['type'] = 'condition'): DesignerNode => ({ id, key:id, type, label:id, config:{}, position:{x:0,y:0} })
const edge = (source: string, target: string, sourceHandle?: string, label?: string): DesignerEdge => ({ id:source+target, source,target,sourceHandle,label })
describe('cyclic branch analysis', () => {
  it('handles a condition pointing back to itself', () => {
    const nodes=[node('a'),node('after','message')]
    const edges=[edge('a','a','true'),edge('a','after',undefined,'Then')]
    expect([...findContinueRootIds('a',edges,nodes)]).toEqual(['after'])
    expect(buildLinearItems(nodes,edges).map(item=>item.node.id)).toEqual(['a','after'])
  })
  it('handles mutually recursive containers without stealing ancestor continuations', () => {
    const nodes=[node('a'),node('b','loop'),node('afterA','message'),node('afterB','message')]
    const edges=[edge('a','b','true'),edge('b','a','body'),edge('a','afterA',undefined,'Then'),edge('b','afterB',undefined,'Then')]
    expect([...findContinueRootIds('a',edges,nodes)]).toEqual(['afterA'])
    expect([...findContinueRootIds('b',edges,nodes)]).toEqual(['afterB'])
    expect(new Set(buildLinearItems(nodes,edges).map(item=>item.node.id)).size).toBe(4)
  })
  it('preserves nested branch joins and remains independent between calls', () => {
    const nodes=[node('a'),node('b'),node('leaf','message'),node('innerAfter','message'),node('outerAfter','message')]
    const edges=[edge('a','b','true'),edge('b','leaf','true'),edge('leaf','innerAfter',undefined,'Then'),edge('innerAfter','outerAfter',undefined,'Then')]
    expect([...findContinueRootIds('a',edges,nodes)]).toEqual(['outerAfter'])
    expect([...findContinueRootIds('b',edges,nodes)]).toEqual(['innerAfter'])
    expect([...findContinueRootIds('a',edges,nodes)]).toEqual(['outerAfter'])
  })
})
