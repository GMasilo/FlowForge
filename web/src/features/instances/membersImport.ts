import type { MemberImportRow } from './membersExcel'

export type MemberImportResult = {
  row: MemberImportRow
  outcome: 'saved' | 'warning' | 'failed' | 'skipped'
  message: string
}

type InviteResult = {
  ok: boolean
  status: string
  error?: string
  email_sent?: boolean
  email_error?: string | null
}

/** Process independently so a rejected row does not hide successful additions. */
export async function importMemberRows(
  rows: MemberImportRow[],
  existingEmails: Set<string>,
  invite: (row: MemberImportRow) => Promise<InviteResult>,
  onProgress: (completed: number) => void,
): Promise<MemberImportResult[]> {
  const results: MemberImportResult[] = []
  const seen = new Set([...existingEmails].map((email) => email.trim().toLowerCase()))
  for (const row of rows) {
    const email = row.email.toLowerCase()
    if (seen.has(email)) {
      results.push({ row, outcome: 'skipped', message: 'Already a user or pending invite; left unchanged.' })
    } else {
      try {
        const result = await invite(row)
        if (!result.ok) throw new Error(result.error || 'Could not add user')
        seen.add(email)
        if (result.status === 'invited' && !result.email_sent) {
          results.push({ row, outcome: 'warning', message: `User saved, but invitation email was not sent. Use Resend invite. ${result.email_error || ''}`.trim() })
        } else {
          results.push({ row, outcome: 'saved', message: result.status === 'invited' ? 'Invitation sent.' : 'User added.' })
        }
      } catch (error) {
        results.push({ row, outcome: 'failed', message: error instanceof Error ? error.message : 'Could not add user' })
      }
    }
    onProgress(results.length)
  }
  return results
}
