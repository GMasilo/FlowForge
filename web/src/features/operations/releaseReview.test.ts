import { describe, expect, it } from 'vitest'
import { releaseReviewBlockReason } from './releaseReview'
const pending={requested_by:'requester',status:'pending'}
describe('release review eligibility',()=>{
 it('blocks self-review even for administrators',()=>expect(releaseReviewBlockReason(pending,'requester',true)).toContain('You requested'))
 it('allows another administrator to review a pending release',()=>expect(releaseReviewBlockReason(pending,'reviewer',true)).toBeNull())
 it('blocks non-administrators and signed-out users',()=>{expect(releaseReviewBlockReason(pending,'reviewer',false)).toContain('administrator');expect(releaseReviewBlockReason(pending,undefined,true)).toContain('Sign in')})
 it('blocks unavailable and already decided reviews',()=>{expect(releaseReviewBlockReason(undefined,'reviewer',true)).toContain('unavailable');for(const status of ['approved','rejected','used'])expect(releaseReviewBlockReason({...pending,status},'reviewer',true)).toContain('already been decided')})
})
