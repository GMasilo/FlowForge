/** Mirror server eligibility so unavailable decisions are explained before submission. */
export function releaseReviewBlockReason(
  review: { requested_by: string; status: string } | undefined,
  userId: string | undefined,
  isAdmin: boolean,
): string | null {
  if (!userId) return 'Sign in to review this release.'
  if (!review) return 'This review is unavailable. Refresh the list and try again.'
  if (review.status !== 'pending') return 'This review has already been decided. Refresh the list to see its status.'
  if (!isAdmin) return 'An organisation owner or administrator must review this release.'
  if (review.requested_by === userId) return 'You requested this release. Another organisation owner or administrator must approve or reject it from Operations.'
  return null
}
