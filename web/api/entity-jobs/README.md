# Scheduled entity jobs

Deploy `supabase/migrations/20261006142132_entity_jobs_step_reviews.sql`, then
`supabase/migrations/20261006144529_step_review_private_helpers.sql`, then
`supabase/migrations/20261007082817_entity_job_destinations.sql` and the PHP API
changes. These migrations add no jobs and do not enable a scheduler.

## Server configuration

Use PHP 8.1+ with cURL/OpenSSL, a valid CA certificate bundle, the existing Supabase
service-role configuration, and an execution limit of at least 120 seconds.
Set a unique random `entity_jobs_cron_secret` of at least 32 characters in `config.php`.
Configure `entity_job_s3_destinations` as shown in `config.example.php`:
organisation UUID → destination name → bucket, region, prefix, access key, secret,
optional session token. Use a private AWS S3 bucket and an IAM identity restricted
to `s3:PutObject` on that destination prefix. No bucket-list or delete permission is needed.
Credentials never belong in entity values, browser forms or job rows.

Only standard AWS commercial/GovCloud region hostnames and bucket names without
dots are supported. Custom S3-compatible endpoints and China regions are not supported.
TLS verification is mandatory; HTTP redirects are not followed. Configure the
correct region. Requests use AWS Signature V4.

Call once per minute from your hosting scheduler (secret provided through its
secure environment, not a URL parameter):

```sh
curl --fail --silent --show-error --max-time 120 -X POST \
  -H "Authorization: Bearer $ENTITY_JOBS_CRON_SECRET" \
  https://YOUR_HOST/flowforge/api/entity-jobs/run
```

Each invocation processes one due job; concurrent invocations atomically claim
different jobs. Increase invocation frequency for large numbers of jobs.
Daily times use the saved IANA timezone, including daylight-saving conversion.
The next slot is calculated after claiming. Downtime yields one catch-up run.

## Behaviour and limits

- Jobs are created/edited paused. Only organisation owners/admins with access to
  the owning chatbot can manage them. Installed/shared entities are managed at
  their source chatbot.
- Export: a transaction reads up to 10,001 rows to enforce the 10,000-row cap;
  JSON and CSV are capped at 20 MB. Oversized exports fail, never truncate.
  Only selected declared non-password columns are exported. CSV formula prefixes
  are neutralised. CSV and source values are not stored in run logs.
- S3 keys: `<prefix>/<instance>/<entity>/<run UUID>.csv`. A failed status after
  upload may still mean an object exists; inspect it before any manual retry.
- Cleanup: dynamic records only, exact field match AND last-updated age. It
  deletes at most 1,000 per run. Deletion and successful run status are committed
  together. The preview counts current matches without deleting them.
- Disabled/deleted entities are not newly claimed. Running jobs cannot be edited
  or deleted. Workers older than 15 minutes are marked failed by the next poll.
- Failed jobs wait for the next daily slot, avoiding immediate repeated deletes
  or duplicate exports. No automatic same-run retry is performed.
- Browser run history shows the last 20 runs. Historical database rows have no
  automatic purge in this version; include them in your operational retention plan.

## Verification

```sh
php web/api/test/entity-job-export.php
```

The isolated database harness uses PGlite (no hosted records or real notifications):

```sh
npm install --prefix tmp/verification --no-audit --no-fund @electric-sql/pglite@0.3.14
# Set PGLITE_PATH to the absolute file URL of that installation's dist/index.js.
node web/scripts/test-entity-jobs.mjs
```

For an end-to-end deployment check, configure a dedicated test bucket and a small
disposable entity, create an export job, enable it, and wait for its daily slot.
Confirm the run history and CSV object. Do not test cleanup against production
records. This repository's automated tests do not perform an AWS upload.

## Permission review

The public step-review RPCs use `SECURITY INVOKER` wrappers. Privileged helpers
live in the non-exposed `flowforge_private` schema and check chatbot access before
reading member names, posting a comment/mention notification, or resolving a
thread. Do not add this private schema to the Data API's exposed schemas.
Anonymous execution is revoked; direct comment writes are revoked.
The worker RPCs use `SECURITY INVOKER` and are executable only by `service_role`.
See the [Supabase privileged-function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## API and external database destinations

Create/install the destination connection on the owning chatbot first. Choose
**Send JSON to an API** or **Insert into a database** under Scheduled jobs. Jobs
remain paused until enabled. Connections must be live, installed (or owned) and in
the same organisation; the runner rechecks this before resolving secrets. The
picker loads connection metadata only.

### API batch

Use an HTTP connection with an HTTPS base URL and saved Basic, Bearer, API-key or
custom-header authentication. Choose POST, PUT or PATCH and a relative path. The
existing HTTP host policy applies; private addresses and redirects are rejected.
Responses are not stored in logs. The request has `Content-Type: application/json`
and `Idempotency-Key: <run UUID>`:

```json
{
  "job_id": "job UUID",
  "run_id": "run UUID",
  "entity_id": "entity UUID",
  "columns": ["student_id", "email"],
  "records": [{"student_id": "S001", "email": "student@example.com"}]
}
```

The endpoint must accept this envelope. It can upsert into your own database,
forward to another API, or transform and store the batch. Third-party APIs with
different schemas need an adapter. Only 2xx is successful (202 confirms acceptance,
not downstream completion). Limit: 10,000 records / 20 MB, 60-second timeout.

### Database inserts

Use PostgreSQL, MySQL, SQL Server or allowlisted SQLite with the matching PDO
driver. Enter an existing table or `schema.table`; selected entity field keys must
match its column names (letters, digits, underscores). Values are bound parameters.
Tables are not created or altered. Batches append every source record, at most
1,000 per run, in a transaction with rollback on statement failure. Use transactional
tables (InnoDB for MySQL); nontransactional engines cannot roll back. SQLite paths
must be permitted by `sqlite_path_allowlist`. A batch has a 60-second loop deadline
plus any in-flight database statement timeout.

Both modes export a full snapshot per run. Schedule only when repeated inserts are
intended, or use an API implementing upserts based on a stable selected key. There
is no distributed transaction between the destination and run history: a connection
loss or status-write failure can report failure after data was accepted. Inspect the
destination before retrying. The run ID deduplicates one API run only, not snapshots
on subsequent days.

Local tests cover URL confinement, actual SQLite parameterised inserts and rollback,
connection scope/retirement, password exclusion and worker permissions. They do not
contact production APIs or external databases.
