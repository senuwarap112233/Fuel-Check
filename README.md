# Fuel-Check
Fuel stock and availability check

## Restock Notification Process (Real-Time Event-Driven)

1. A shed updates its fuel stock in the database.
2. A database trigger fires and:
   - Enqueues the event into `restock_events` (queue table for retries)
   - **Immediately invokes the Edge Function** (real-time, not scheduled)
3. The Edge Function `process-restocks` processes the event:
   - Looks up eligible users with `get_users_for_restock_fcm` (users whose nearest shed matches)
   - Sends an FCM HTTP v1 push notification to each saved token
   - Marks the queue row as processed
4. If the immediate invocation fails, the queue row remains unprocessed and will be retried later

## Manual Test Flow

1. Create or update a stock row so a new `restock_events` record exists.
2. Confirm the target profile has a non-null `fcm_token`.
3. Invoke the Edge Function manually with an empty JSON body.
4. Check that the queue row becomes `processed = true`.
5. Confirm the notification arrives on the device.

## Next Todo

- Add retries, exponential backoff, and richer logging for failed sends.
- ~~Schedule the Edge Function so it runs automatically after restocks.~~ ✅ **Done: Now triggered in real-time via database trigger**
- Document the deployment and rollback steps once the flow is stable.

## Deployment & Setup

### 1. Deploy the Edge Function

```bash
supabase functions deploy process-restocks --project-ref dssipdkvbdiffplqcept
```

### 2. Set Up Edge Function Secrets in Supabase Dashboard

Go to **Project Settings → Configuration → Secrets** and add:

- Key: `SUPABASE_URL` | Value: `https://dssipdkvbdiffplqcept.supabase.co`
- Key: `SUPABASE_SERVICE_ROLE_KEY` | Value: `<your-service-role-key>`
- Key: `FIREBASE_SERVICE_ACCOUNT` | Value: `<your-firebase-service-account-json>`
- Key: `MAX_ATTEMPTS` | Value: `3` (optional, default is 3)
- Key: `BATCH_SIZE` | Value: `10` (optional, default is 10)

### 3. Run the Real-Time Trigger Migration

Go to **Supabase Dashboard → SQL Editor** and run:
[supabase/migrations/trigger_edge_function_on_restock.sql](supabase/migrations/trigger_edge_function_on_restock.sql)

This migration:
- Enables the `http` extension
- Creates `invoke_process_restocks_edge_function()` function
- Modifies the `notify_restock_enqueue` trigger to call the Edge Function immediately

### 4. Configure Postgres Settings for Trigger

The trigger reads `current_setting('app.settings.edge_function_url', true)` and `current_setting('app.settings.edge_function_key', true)`, so these values must be set as Postgres database settings, not only as Edge Function secrets.

Run this in **Supabase SQL Editor**:

```sql
ALTER DATABASE postgres SET app.settings.edge_function_url = 'https://dssipdkvbdiffplqcept.supabase.co/functions/v1/process-restocks';
ALTER DATABASE postgres SET app.settings.edge_function_key = '<your-service-role-key>';
```

If `postgres` is not the database name in your project, use the database name from your connection string.

### 5. Test the Pipeline

1. Create a test `restock_events` row:
   ```sql
   INSERT INTO public.restock_events (shed_id, fuel_type, processed, attempts)
   VALUES ('2119243f-67a3-4b7a-9abc-43f485977f07', 'Petrol', false, 0);
   ```

2. Check the Edge Function logs:
   - Go to **Supabase Dashboard → Edge Functions → process-restocks → Invocations**
   - Confirm the function was invoked within seconds

3. Verify notification on device or check the database:
   ```sql
   SELECT id, processed, processed_at FROM public.restock_events ORDER BY created_at DESC LIMIT 1;
   ```
   Should show `processed=true` and a recent `processed_at` timestamp.
