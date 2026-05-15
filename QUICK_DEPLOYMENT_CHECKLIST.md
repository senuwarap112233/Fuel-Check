# ✅ Quick Deployment Checklist

## Pre-Deployment (Complete before running)

- [ ] Have Supabase project URL ready
- [ ] Have Firebase service account JSON file downloaded
- [ ] Have `supabase` CLI installed (`npm i -g supabase`)
- [ ] Are logged into Supabase CLI (`supabase login`)
- [ ] Have sufficient Firebase quota for FCM
- [ ] Have tested your network allows outbound HTTPS to Firebase

---

## Step 1: Deploy SQL Migration (5 min)

**Option A: Via Supabase CLI**
```bash
cd c:\Users\Thamidu Keshan\Desktop\fuelcheck_final
supabase migration up
```

**Option B: Via Supabase Dashboard**
1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Create new query
3. Copy entire contents of: `supabase/migrations/add_restock_notification_dedup_and_locking.sql`
4. Paste into SQL Editor
5. Click "Run"
6. Verify: Check "Tables" sidebar → Should see:
   - `restock_events` (modified)
   - `restock_notifications_log` (new)
   - `restock_processing_logs` (new)

**Verification Query:**
```sql
SELECT * FROM pg_proc WHERE proname IN (
  'fetch_unprocessed_events_with_lock',
  'check_notification_sent',
  'record_notification_sent',
  'unlock_event'
);
```
Should return 4 rows.

---

## Step 2: Set Environment Secrets (5 min)

1. Go to https://app.supabase.com → Your Project → Functions → Settings
2. Add these environment variables:

| Key | Value | Source |
|-----|-------|--------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | API Settings → URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | API Settings → Service Role Key |
| `FIREBASE_PROJECT_ID` | `your-project-id` | Firebase Console → Project Settings |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com` | Firebase Service Account JSON |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` | Firebase Service Account JSON |
| `BATCH_SIZE` | `10` | Default is fine |
| `MAX_ATTEMPTS` | `3` | Default is fine |
| `FCM_BATCH_SIZE` | `15` | Default is fine |
| `LOCK_TIMEOUT_SECONDS` | `300` | Default is fine |

**Getting Firebase Private Key:**
1. Go to https://console.firebase.google.com → Your Project
2. Settings (⚙️) → Service Accounts
3. Click "Generate New Private Key"
4. Open the downloaded JSON file
5. Copy the value of `private_key` field (includes `-----BEGIN...-----END-----`)

---

## Step 3: Deploy Edge Function (3 min)

```bash
cd c:\Users\Thamidu Keshan\Desktop\fuelcheck_final
supabase functions deploy process-restocks
```

**Verify deployment:**
```bash
supabase functions list
```

Should show `process-restocks` in the list with status deployed.

Or go to Dashboard → Functions → process-restocks → Should show code

---

## Step 4: Test Locally (2 min)

Insert a test restock event:
```sql
INSERT INTO public.restock_events (shed_id, fuel_type, processed, attempts, event_type)
VALUES (
  'your-shed-uuid-here',  -- Replace with real shed ID
  'Diesel',
  false,
  0,
  'restock'
);
```

Get the event ID from the response or query:
```sql
SELECT id FROM restock_events WHERE processed = false ORDER BY created_at DESC LIMIT 1;
```

---

## Step 5: Invoke Function Manually (1 min)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-restocks \
  -H "Authorization: Bearer your_service_role_key" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response:**
```json
{
  "ok": true,
  "processed": 1,
  "failed": 0,
  "total": 1,
  "duration_ms": 1234
}
```

**Check function logs:**
- Dashboard → Functions → process-restocks → Logs (scroll down)
- Should see:
  ```
  [process-restocks] Starting batch processing
  [event:123] Processing: shed_id=...
  [event:123] Found N eligible users for shed
  [event:123] FCM sent to user xxx
  [event:123] Summary: sent=1, skipped=0, failed=0
  [event:123] Marked as processed
  [process-restocks] Batch complete
  ```

**Verify notification was logged:**
```sql
SELECT * FROM restock_notifications_log 
WHERE event_id = 123
ORDER BY sent_at DESC;
```

Should have one row per user with `status = 'sent'`.

---

## Step 6: Schedule Periodic Execution (5 min)

**Option A: Google Cloud Scheduler (if using GCP)**

```bash
gcloud scheduler jobs create http invoke-fuel-restock \
  --location=us-central1 \
  --schedule="*/2 * * * *" \
  --uri="https://your-project.supabase.co/functions/v1/process-restocks" \
  --http-method=POST \
  --headers="Authorization=Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --message-body='{}' \
  --oidc-service-account-email="your-service-account@your-project.iam.gserviceaccount.com"
```

**Option B: AWS EventBridge**
1. Go to EventBridge → Create Rule
2. Name: `fuel-restock-processor`
3. Schedule: `rate(2 minutes)`
4. Target: HTTPS endpoint
5. Endpoint URL: `https://your-project.supabase.co/functions/v1/process-restocks`
6. HTTP method: `POST`
7. Auth: API Key (add header `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`)
8. Create

**Option C: Supabase PostgreSQL Cron (simplest)**
1. Go to SQL Editor
2. Run:
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create job to invoke function every 2 minutes
SELECT cron.schedule(
  'invoke_process_restocks',
  '*/2 * * * *',
  'SELECT 
     net.http_post(
       url => ''https://your-project.supabase.co/functions/v1/process-restocks'',
       headers => jsonb_build_object(
         ''Authorization'', ''Bearer your_service_role_key'',
         ''Content-Type'', ''application/json''
       ),
       body => jsonb_build_object()
     ) 
   AS request_id;'
);
```

**Verify scheduler is running:**
```bash
# For Cloud Scheduler
gcloud scheduler jobs list

# For Supabase Cron
SELECT * FROM cron.job WHERE jobname = 'invoke_process_restocks';
```

---

## Step 7: Monitor & Alert (5 min)

Set up monitoring for these signals:

**Good signs (check logs):**
- ✅ Function returns status 200
- ✅ `[process-restocks] Batch complete` with `ok: true`
- ✅ Events processed in < 10 seconds (for < 100 users)
- ✅ No locked events older than 5 min

**Bad signs (set up alerts):**
- ❌ Function returns 500 error
- ❌ Events stuck in `processed = false` for > 30 min
- ❌ `restock_notifications_log` has many `status = 'failed'`
- ❌ Locked events older than 10 minutes

**Query for health check:**
```sql
-- Check stuck events
SELECT id, created_at, attempts, locked 
FROM restock_events 
WHERE processed = false AND attempts > 0
ORDER BY created_at DESC
LIMIT 10;

-- Check delivery rate (last hour)
SELECT 
  status, 
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM restock_notifications_log 
                            WHERE created_at > now() - interval '1 hour'), 2) as percentage
FROM restock_notifications_log
WHERE created_at > now() - interval '1 hour'
GROUP BY status;
```

---

## Troubleshooting During Deploy

**Error: "Missing FIREBASE_SERVICE_ACCOUNT"**
- Solution: Set all 4 Firebase env vars (PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY) OR set single FIREBASE_SERVICE_ACCOUNT

**Error: "Invalid key" or "Failed to get OAuth token"**
- Solution: Check FIREBASE_PRIVATE_KEY format (should start with `-----BEGIN PRIVATE KEY-----`)

**Error: "Failed to fetch users for shed"**
- Solution: Verify RPC exists: `SELECT * FROM public.get_users_for_restock_fcm('shed-uuid')`

**Function invoked but no notifications sent**
- Check: Do users have `notification_enabled = true`?
- Check: Do users have `fcm_token` value?
- Check: Is `nearest_shed_id` correctly set for users?

**Locked events not unlocking**
- Check: Wait 300 seconds (or set shorter LOCK_TIMEOUT_SECONDS)
- Or manually: `UPDATE restock_events SET locked = false WHERE id = 123`

---

## Success Criteria ✅

Function is ready for production when:

- [ ] Migration deployed (4 new RPCs visible)
- [ ] All 8 env secrets set
- [ ] Function deployed (visible in dashboard)
- [ ] Manual invocation returns 200 status
- [ ] Notification logged in `restock_notifications_log`
- [ ] No locked events older than 5 minutes
- [ ] Scheduler running (check via Cloud Scheduler / EventBridge / Cron)
- [ ] No errors in last hour of logs

---

## Quick Reference Commands

```bash
# Check function exists
curl -s https://your-project.supabase.co/functions/v1/process-restocks -H "Authorization: Bearer ${KEY}" -I

# Redeploy after code changes
cd fuelcheck_final && supabase functions deploy process-restocks

# View live logs
supabase functions logs process-restocks --limit 50

# Query function health
SELECT COUNT(*) as pending_events FROM restock_events WHERE processed = false;
SELECT COUNT(*) as delivery_success FROM restock_notifications_log WHERE status = 'sent' AND created_at > now() - interval '1 hour';
```

---

**Estimated Total Setup Time: 20-30 minutes**

Once deployed, system will:
- ✅ Check for new restocks every 2 minutes
- ✅ Send notifications in parallel (15 users/batch)
- ✅ Prevent duplicates automatically
- ✅ Retry failed events up to 3 times
- ✅ Log every delivery for audit trail

**You're ready! 🚀**
