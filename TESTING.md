# Testing Guide: Ops Cron Observability

This document describes how to test the ops cron observability and retention purge features locally.

## Prerequisites

1. PHP 8.1+ with curl and OpenSSL extensions
2. Running Supabase instance (local or hosted)
3. Apply the migration: `supabase/migrations/20260912120000_cron_observability.sql`
4. Configure `web/api/config.php` with:
   - `supabase_url`, `supabase_service_role_key`
   - `alerts_cron_secret` (or `retention_cron_secret`)

## Test 1: Retention Purge Endpoint

### Setup
1. Create a test instance with a retention policy:
   ```sql
   INSERT INTO public.data_retention_policies (instance_id, sessions_ttl_days, legal_hold)
   VALUES ('YOUR_INSTANCE_ID', 7, false);
   ```

2. Create some expired test sessions:
   ```sql
   INSERT INTO public.conversation_sessions (id, instance_id, chatbot_id, status, created_at)
   VALUES 
     (gen_random_uuid(), 'YOUR_INSTANCE_ID', 'YOUR_CHATBOT_ID', 'completed', NOW() - INTERVAL '10 days'),
     (gen_random_uuid(), 'YOUR_INSTANCE_ID', 'YOUR_CHATBOT_ID', 'completed', NOW() - INTERVAL '8 days');
   ```

### Test the endpoint
```bash
# Start PHP dev server
cd web/api
php -S localhost:8000

# In another terminal, call the retention purge endpoint
SECRET="your_retention_cron_secret_from_config"
curl -v -X POST -H "Authorization: Bearer $SECRET" \
  http://localhost:8000/retention/purge

# Expected response:
{
  "ok": true,
  "summary": {
    "policies_checked": 1,
    "instances_purged": 1,
    "total_sessions_purged": 2,
    "skipped_legal_hold": 0,
    "errors": []
  }
}
```

### Verify database
```sql
-- Check cron_runs table
SELECT * FROM public.cron_runs WHERE job_name = 'retention.purge' ORDER BY created_at DESC LIMIT 1;

-- Verify sessions were deleted
SELECT COUNT(*) FROM public.conversation_sessions 
WHERE instance_id = 'YOUR_INSTANCE_ID' AND created_at < NOW() - INTERVAL '7 days';
-- Should return 0
```

## Test 2: Alerts Cron Observability

### Test the alerts endpoint
```bash
SECRET="your_alerts_cron_secret_from_config"
curl -v -X POST -H "Authorization: Bearer $SECRET" \
  http://localhost:8000/alerts/run

# Expected response includes summary:
{
  "ok": true,
  "summary": {
    "instances": 2,
    "rules_checked": 5,
    "triggered": 1,
    "notified": 1,
    "digests": 0,
    "errors": []
  }
}
```

### Verify database
```sql
-- Check cron_runs table
SELECT * FROM public.cron_runs WHERE job_name = 'alerts.run' ORDER BY created_at DESC LIMIT 1;

-- Verify the summary JSON contains expected keys
SELECT summary FROM public.cron_runs WHERE job_name = 'alerts.run' ORDER BY created_at DESC LIMIT 1;
```

## Test 3: Admin UI Observability

### Setup
1. Build and run the web app:
   ```bash
   cd web
   npm install
   npm run dev
   ```

2. Sign in as an instance owner/admin

### Verify UI
1. Navigate to `/instances/{YOUR_INSTANCE_ID}/alerts`
2. Scroll to the "Cron jobs" card (appears before "Recent deliveries")
3. Verify you see:
   - ✅ Latest run for "Alerts evaluation" (if you ran `/alerts/run`)
   - ✅ Latest run for "Retention purge" (if you ran `/retention/purge`)
   - ✅ Status badge (success/failed/running)
   - ✅ Completion time (relative, e.g. "Completed 5 minutes ago")
   - ✅ Summary counts:
     - Alerts: instances, rules checked, triggered, notified, digests
     - Retention: policies, instances purged, sessions purged, skipped (legal hold)
   - ✅ Error message if status is 'failed'

### Expected UI behavior
- **Success** — Green badge, summary counts visible, no error text
- **Failed** — Red badge, error text visible, summary may be partial
- **Running** — Amber badge, started time shown (completed_at is null)
- **No runs yet** — "No cron runs yet." placeholder text

## Test 4: Authentication & Security

### Test unauthorized access
```bash
# Missing secret
curl -X POST http://localhost:8000/retention/purge
# Expected: 401 Unauthorized

# Wrong secret
curl -X POST -H "Authorization: Bearer wrong_secret" http://localhost:8000/retention/purge
# Expected: 401 Unauthorized

# Query param secret (should work)
curl -X POST "http://localhost:8000/retention/purge?secret=your_retention_cron_secret_from_config"
# Expected: 200 OK with summary
```

### Verify secrets are not exposed
1. Check browser DevTools Network tab when viewing the Alerts page
2. Verify no API calls include `alerts_cron_secret` or `retention_cron_secret`
3. The cron_runs table is read-only for authenticated users; secrets stay server-side

## Test 5: RLS Policies

### Verify cron_runs visibility
```sql
-- As instance admin (authenticated user):
SELECT * FROM public.cron_runs WHERE instance_id = 'YOUR_INSTANCE_ID' OR instance_id IS NULL;
-- Should see platform-wide crons (instance_id = null) and instance-specific crons

-- As non-admin user:
SELECT * FROM public.cron_runs WHERE instance_id = 'DIFFERENT_INSTANCE_ID';
-- Should return empty (no access to other instances' crons)
```

### Verify cron_runs_latest view
```sql
SELECT * FROM public.cron_runs_latest WHERE job_name = 'alerts.run';
-- Should return the latest completed run for alerts.run

SELECT * FROM public.cron_runs_latest WHERE job_name = 'retention.purge';
-- Should return the latest completed run for retention.purge
```

## Test 6: Legal Hold Protection

### Setup
```sql
UPDATE public.data_retention_policies 
SET legal_hold = true 
WHERE instance_id = 'YOUR_INSTANCE_ID';
```

### Test retention purge
```bash
curl -X POST -H "Authorization: Bearer $SECRET" http://localhost:8000/retention/purge

# Expected summary:
{
  "policies_checked": 1,
  "instances_purged": 0,
  "total_sessions_purged": 0,
  "skipped_legal_hold": 1,  // <-- Instance skipped
  "errors": []
}
```

## Test 7: Error Handling

### Test with invalid instance_id in policy
```sql
-- Insert a policy with invalid instance_id (will be skipped)
INSERT INTO public.data_retention_policies (instance_id, sessions_ttl_days, legal_hold)
VALUES ('00000000-0000-0000-0000-000000000000', 30, false);
```

### Test retention purge
```bash
curl -X POST -H "Authorization: Bearer $SECRET" http://localhost:8000/retention/purge

# Check the summary.errors array in the response
# Should contain an error for the invalid instance
```

## Integration Testing

### Cron schedule verification
1. Add to crontab (or use a cron service):
   ```cron
   # Alerts every 30 minutes
   */30 * * * * curl -s -X POST -H "Authorization: Bearer $ALERTS_SECRET" https://your-domain.com/flowforge/api/alerts/run

   # Retention purge nightly at 2am UTC
   0 2 * * * curl -s -X POST -H "Authorization: Bearer $RETENTION_SECRET" https://your-domain.com/flowforge/api/retention/purge
   ```

2. Wait for the scheduled time and verify:
   - Cron job executes successfully
   - `cron_runs` table has new entries
   - Admin UI shows updated "last run" times
   - Email/Slack notifications sent (for alerts cron)

## Troubleshooting

### Cron runs not appearing in UI
1. Check RLS policies: `SELECT * FROM public.cron_runs_latest;` as the user
2. Verify the view query: `SELECT * FROM public.cron_runs WHERE status IN ('success', 'failed') ORDER BY completed_at DESC;`
3. Check browser console for React Query errors

### Retention purge not deleting sessions
1. Verify the RPC exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'purge_expired_conversation_data';`
2. Check the policy's `sessions_ttl_days` value
3. Verify `created_at` timestamps on sessions: `SELECT id, created_at, NOW() - created_at AS age FROM conversation_sessions WHERE instance_id = 'YOUR_INSTANCE_ID';`
4. Check for legal hold: `SELECT legal_hold FROM data_retention_policies WHERE instance_id = 'YOUR_INSTANCE_ID';`

### Alerts cron errors
1. Check the `summary.errors` array in the response
2. Verify `instance_alert_rules` table has enabled rules
3. Check Supabase logs for service_role authentication errors
