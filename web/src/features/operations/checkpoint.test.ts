import { describe, it, expect, vi, beforeEach } from 'vitest'
const rpc=vi.hoisted(()=>vi.fn())
vi.mock('./operationsApi',()=>({operationsRpc:rpc}))
import { ConversationCheckpoint } from './conversationCheckpoint'
beforeEach(()=>{rpc.mockReset()})
describe('checkpoint write ordering',()=>{
 it('waits for persistence before claiming input and advances revisions',async()=>{
  const calls:string[]=[]
  rpc.mockImplementation(async(name:string,args:{p_revision:number})=>{calls.push(`${name}:${args.p_revision}`);return args.p_revision+1})
  const controller=new ConversationCheckpoint({token:'test',revision:0,expiresAt:'2099-01-01'})
  await Promise.all([controller.save({waiting:true}),controller.claim(),controller.save({next:true})])
  expect(calls).toEqual(['save_conversation_checkpoint:0','claim_conversation_input:1','save_conversation_checkpoint:2'])
  expect(controller.ticket.revision).toBe(3)
 })
 it('does not advance after an uncertain persistence failure',async()=>{
  rpc.mockRejectedValue(new Error('network unavailable'))
  const controller=new ConversationCheckpoint({token:'test',revision:0,expiresAt:'2099-01-01'})
  await expect(controller.save({})).rejects.toThrow('network unavailable')
  await expect(controller.claim()).rejects.toThrow('network unavailable')
  expect(rpc).toHaveBeenCalledTimes(1)
 })
})
