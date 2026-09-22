# Users spreadsheet import

Organisation owners and admins can use **Users → Template** to download an Excel
template, replace the sample rows, then choose **Import Excel**. Excel `.xlsx`
and comma-separated `.csv` files are supported (5 MB and 1,000 users per import).

Only `email` is required. Optional columns are `display_name`, `role`, `job_title`,
`phone`, `department`, and `notes`. Blank roles default to `editor`. Roles can be
`admin`, `editor`, `viewer`, or `agent` when the organisation has agent access.
The owner role cannot be imported. Store phone numbers as text to preserve `+`
and leading zeros.

The entire file is validated before any users are saved. Missing or invalid
emails, duplicate emails, and invalid roles report the spreadsheet row to fix.
Review the preview before choosing **Import users & send invites**. Existing users
and pending invites are skipped without changing their details. The preview
checks available seats, and the existing server endpoint enforces permissions,
roles, and quotas for each request.

Existing accounts are added to the organisation. New accounts receive invitation
emails through the configured FlowForge API. Each row gets a result, and failures
do not prevent later rows from being attempted. A saved user whose email failed
is reported separately; use **Resend invite** for that user. Correct failed rows
and import again: users already saved will be skipped. Keep the page open until
the import completes.

## Validation

Run `npm run test:users-import` from `web`. This covers Excel text escaping,
shared strings and worksheet relationships, CSV fields and validation, role
restrictions, duplicate handling, row limits, and partial invitation failures.

For a manual check in a test organisation, import a file containing an existing
user, a new email, and an existing account outside the organisation. Confirm the
preview counts, invitation delivery, resulting user statuses, and safe re-import.
Also check insufficient seats, cancelling the file picker, and an invitation
email failure. These checks send real invitations; use test addresses.
