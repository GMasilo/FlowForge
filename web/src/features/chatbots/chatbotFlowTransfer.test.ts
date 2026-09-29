import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: db }))
vi.mock('@/features/entities/entityApi', () => ({}))
import { replaceFlowInDb } from './chatbotFlowTransfer'
beforeEach(() => {
  db.from.mockReset(); db.rpc.mockReset()
  db.from.mockImplementation((table: string) => {
    const result = { data: table === 'chatbot_entities' ? [] : { updated_at: '2026-09-24T00:00:00Z' }, error: null }
    const query: any = { select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query), update: vi.fn(() => query), single: vi.fn(async () => result), then: (resolve: any) => Promise.resolve(result).then(resolve) }
    return query
  })
})
const args = { chatbotId: 'bot', flowId: 'flow', globals: [], nodes: [{id:'old',key:'sql',type:'database' as const,label:'SQL',config:{outputVariable:'rows'},position:{x:12,y:34}}], edges: [] }
describe('transactional flow import', () => {
  it('uses one draft RPC with remapped IDs and a concurrency check', async () => {
    db.rpc.mockResolvedValue({data:'2026-09-24T01:00:00Z',error:null})
    const saved = await replaceFlowInDb(args)
    expect(db.rpc).toHaveBeenCalledOnce()
    expect(db.rpc).toHaveBeenCalledWith('save_flow_draft', expect.objectContaining({p_flow_id:'flow',p_expected_updated_at:'2026-09-24T00:00:00Z',p_nodes:[expect.objectContaining({id:saved.nodes[0].id,type:'database',position_x:12,position_y:34})],p_step_vars:[{key:'rows',value_type:'string',source_node_key:'sql'}]}))
    expect(db.from.mock.calls.some(([table]) => table === 'flow_nodes' || table === 'flow_edges')).toBe(false)
  })
  it('surfaces the database error without issuing destructive REST calls', async () => {
    db.rpc.mockResolvedValue({data:null,error:{message:'invalid input value for enum flow_node_type: database',hint:'Apply migrations'}})
    await expect(replaceFlowInDb(args)).rejects.toThrow('previous graph was preserved')
    expect(db.from.mock.calls.map(([table])=>table)).toEqual(['chatbot_entities','chatbot_flows'])
  })
})
