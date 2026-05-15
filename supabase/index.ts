// Supabase Edge Function: process-restocks
// Processes rows in restock_events and sends Firebase Cloud Messaging notifications
// using the HTTP v1 API with a Firebase service account.
// Features: Event locking, notification deduplication, parallel FCM, retry safety

import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BATCH_SIZE = Number(Deno.env.get("BATCH_SIZE") || "10");
const MAX_ATTEMPTS = Number(Deno.env.get("MAX_ATTEMPTS") || "3");
const FCM_BATCH_SIZE = Number(Deno.env.get("FCM_BATCH_SIZE") || "15");
const LOCK_TIMEOUT_SECONDS = Number(Deno.env.get("LOCK_TIMEOUT_SECONDS") || "300");

const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "";
const FIREBASE_CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "";
const FIREBASE_PRIVATE_KEY = Deno.env.get("FIREBASE_PRIVATE_KEY") || "";

// Type definitions
interface RestockEvent {
  id: string;
  shed_id: string;
  fuel_type: string;
  created_at: string;
  processed: boolean;
  processed_at: string | null;
  attempts: number;
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  event_type: string;
}

interface User {
  id: string;
  fcm_token: string;
}

function getServiceAccount() {
  if (FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON", error);
    }
  }

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      project_id: FIREBASE_PROJECT_ID,
      client_email: FIREBASE_CLIENT_EMAIL,
      private_key: FIREBASE_PRIVATE_KEY,
    };
  }

  return null;
}

const SERVICE_ACCOUNT = getServiceAccount();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!SERVICE_ACCOUNT) {
  console.error("Missing Firebase service account credentials");
}

function base64UrlEncode(input: Uint8Array | string) {
  const value = typeof input === "string"
    ? input
    : String.fromCharCode(...Array.from(input));

  return btoa(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function utf8ToUint8(text: string) {
  return new TextEncoder().encode(text);
}

async function importPrivateKey(privateKeyPem: string) {
  // CRITICAL FIX: Handle newlines safely - normalize both \\n and literal \n
  // Also handle environment variable string encoding issues
  const cleanedPem = privateKeyPem
    .split("\\\\n").join("\n")  // Convert \\n (double-escaped) to \n
    .split("\\n").join("\n")    // Convert \n (escaped) to \n
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const binaryDer = Uint8Array.from(atob(cleanedPem), (char) => char.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedAccessToken: { token: string; expiry: number } | null = null;

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiry - 60_000 > Date.now()) {
    return cachedAccessToken.token;
  }

  if (!SERVICE_ACCOUNT) {
    throw new Error("Missing Firebase service account credentials");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const privateKey = await importPrivateKey(SERVICE_ACCOUNT.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    utf8ToUint8(unsignedJwt),
  );
  const signedJwt = `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get OAuth access token: ${tokenResponse.status} ${errorText}`);
  }

  const tokenJson = await tokenResponse.json();
  cachedAccessToken = {
    token: tokenJson.access_token,
    expiry: Date.now() + (Number(tokenJson.expires_in || 3600) * 1000),
  };

  return cachedAccessToken.token;
}

// CRITICAL FIX: Fetch events with locking to prevent duplicate processing
async function fetchUnprocessedEventsWithLock() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fetch_unprocessed_events_with_lock`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        batch_size: BATCH_SIZE,
        lock_timeout_seconds: LOCK_TIMEOUT_SECONDS,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch restock events with lock: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as RestockEvent[];
}

// CRITICAL FIX: Check if user was already notified for this event
async function checkNotificationSent(eventId: string, userId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/check_notification_sent`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        p_event_id: eventId,
        p_user_id: userId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to check notification sent: ${response.status}`);
  }

  return await response.json();
}

// CRITICAL FIX: Record sent notification for deduplication
async function recordNotificationSent(
  eventId: string,
  userId: string,
  status: "sent" | "failed" | "skipped" = "sent",
  failureReason?: string,
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/record_notification_sent`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        p_event_id: eventId,
        p_user_id: userId,
        p_status: status,
        p_failure_reason: failureReason || null,
      }),
    },
  );

  if (!response.ok) {
    console.warn(
      `[record-notification] Failed to record notification: ${response.status}`,
    );
  }
}

// CRITICAL FIX: Unlock event after processing (success or final retry)
async function unlockEvent(
  eventId: string,
  processed: boolean = false,
  workerId?: string,
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/unlock_event`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        p_event_id: eventId,
        p_processed: processed,
        p_worker_id: workerId || null,
      }),
    },
  );

  if (!response.ok) {
    console.error(`Failed to unlock event: ${response.status}`);
  }
}

async function fetchUsersForShed(shedId: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_users_for_restock_fcm`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ shed_uuid: shedId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users for shed: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function fetchShedName(shedId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/sheds?id=eq.${shedId}&select=station_name&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch shed name: ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  return rows?.[0]?.station_name || "A nearby shed";
}

async function sendFcmNotification(token: string, title: string, body: string, data: Record<string, string>) {
  const accessToken = await getAccessToken();
  const projectId = SERVICE_ACCOUNT?.project_id;

  if (!projectId) {
    throw new Error("Firebase service account missing project_id");
  }

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title,
          body,
        },
        data,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM send failed: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function incrementAttempt(eventId: string, currentAttempts: number) {
  const newAttempts = currentAttempts + 1;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/restock_events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attempts: newAttempts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to increment attempts: ${response.status} ${await response.text()}`);
  }
}

// CRITICAL FIX: Send notifications in parallel with batching to avoid sequential delays
async function sendNotificationsBatch(
  eventId: string,
  users: User[],
  title: string,
  body: string,
  data: Record<string, string>,
) {
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failureReasons: Record<string, string> = {};

  // Process in batches to avoid overwhelming FCM API
  for (let i = 0; i < users.length; i += FCM_BATCH_SIZE) {
    const batch = users.slice(i, i + FCM_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (user) => {
        // Check if already notified
        const alreadySent = await checkNotificationSent(eventId, user.id);
        if (alreadySent) {
          console.log(
            `[event:${eventId}] User ${user.id} already notified, skipping`,
          );
          await recordNotificationSent(eventId, user.id, "skipped");
          return { status: "skipped", userId: user.id };
        }

        if (!user.fcm_token) {
          console.warn(
            `[event:${eventId}] User ${user.id} has no fcm_token, skipping`,
          );
          await recordNotificationSent(eventId, user.id, "skipped", "no_fcm_token");
          return { status: "skipped", userId: user.id };
        }

        try {
          await sendFcmNotification(user.fcm_token, title, body, data);
          await recordNotificationSent(eventId, user.id, "sent");
          return { status: "sent", userId: user.id };
        } catch (error) {
          const errorMsg = String(error);
          await recordNotificationSent(eventId, user.id, "failed", errorMsg);
          return { status: "failed", userId: user.id, error: errorMsg };
        }
      }),
    );

    // Process results
    for (const result of results) {
      if (result.status === "fulfilled") {
        const value = result.value as {
          status: string;
          userId: string;
          error?: string;
        };
        if (value.status === "sent") {
          sentCount++;
          console.log(`[event:${eventId}] FCM sent to user ${value.userId}`);
        } else if (value.status === "skipped") {
          skippedCount++;
        } else if (value.status === "failed") {
          failedCount++;
          failureReasons[value.userId] = value.error || "unknown";
          console.error(
            `[event:${eventId}] FCM failed for user ${value.userId}: ${value.error}`,
          );
        }
      } else {
        failedCount++;
        console.error(
          `[event:${eventId}] Promise rejected: ${result.reason}`,
        );
      }
    }
  }

  return {
    sentCount,
    skippedCount,
    failedCount,
    failureReasons,
  };
}

serve(async () => {
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalFailed = 0;

  try {
    console.log(
      `[process-restocks] Starting batch processing (batch_size=${BATCH_SIZE}, max_attempts=${MAX_ATTEMPTS})`,
    );

    // CRITICAL FIX: Fetch events with locking to prevent duplicate processing
    const events = await fetchUnprocessedEventsWithLock();
    console.log(`[process-restocks] Fetched ${events.length} locked events for processing`);

    const batchStartTime = Date.now();

    for (const event of events) {
      const eventStartTime = Date.now();

      try {
        // Skip events that have exceeded max retry attempts
        if (event.attempts >= MAX_ATTEMPTS) {
          console.warn(
            `[event:${event.id}] Skipping: max attempts (${event.attempts}/${MAX_ATTEMPTS}) exceeded`,
          );
          await unlockEvent(String(event.id), true, event.locked_by || undefined);
          totalFailed++;
          continue;
        }

        console.log(
          `[event:${event.id}] Processing: shed_id=${event.shed_id}, fuel_type=${event.fuel_type}, attempts=${event.attempts}`,
        );

        const users = await fetchUsersForShed(event.shed_id);
        console.log(`[event:${event.id}] Found ${users.length} eligible users for shed`);

        if (users.length === 0) {
          console.log(
            `[event:${event.id}] No eligible users, marking as processed`,
          );
          await unlockEvent(String(event.id), true, event.locked_by || undefined);
          totalProcessed++;
          continue;
        }

        const shedName = await fetchShedName(event.shed_id);
        const fuelType = event.fuel_type || "fuel";
        const title = "Fuel Restocked";
        const body = `${shedName} has restocked ${fuelType}.`;

        // CRITICAL FIX: Parallel FCM sending with batching
        const notificationResult = await sendNotificationsBatch(
          String(event.id),
          users,
          title,
          body,
          {
            shed_id: String(event.shed_id),
            fuel_type: String(fuelType),
            shed_name: String(shedName),
          },
        );

        const totalUsers = users.length;
        console.log(
          `[event:${event.id}] Summary: sent=${notificationResult.sentCount}, skipped=${notificationResult.skippedCount}, failed=${notificationResult.failedCount}, total=${totalUsers}`,
        );

        // CRITICAL FIX: Only mark as processed if at least one notification was sent
        // If all failed, this will be retried in the next execution
        if (notificationResult.sentCount > 0 || users.length === 0) {
          await unlockEvent(String(event.id), true, event.locked_by || undefined);
          totalProcessed++;
          console.log(
            `[event:${event.id}] Marked as processed (sent=${notificationResult.sentCount})`,
          );
        } else {
          // All notifications failed or skipped - retry next time
          await unlockEvent(String(event.id), false, event.locked_by || undefined);
          await incrementAttempt(String(event.id), event.attempts);
          totalFailed++;
          console.warn(
            `[event:${event.id}] No notifications sent, will retry (attempts=${event.attempts + 1}/${MAX_ATTEMPTS})`,
          );
        }

        const eventDuration = Date.now() - eventStartTime;
        console.log(`[event:${event.id}] Completed in ${eventDuration}ms`);
      } catch (eventError) {
        console.error(`[event:${event.id}] Failed to process: ${eventError}`);

        try {
          // Unlock and increment attempts
          await unlockEvent(String(event.id), false, event.locked_by || undefined);
          await incrementAttempt(String(event.id), event.attempts);
          console.log(
            `[event:${event.id}] Incremented attempts to ${event.attempts + 1}/${MAX_ATTEMPTS}`,
          );
        } catch (unlockError) {
          console.error(`[event:${event.id}] Failed to unlock/increment: ${unlockError}`);
        }

        totalFailed++;
      }
    }

    const batchDuration = Date.now() - batchStartTime;
    const summary = {
      ok: true,
      processed: totalProcessed,
      failed: totalFailed,
      total: events.length,
      duration_ms: batchDuration,
    };

    console.log(`[process-restocks] Batch complete: ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[process-restocks] Fatal error: " + String(error));
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(error),
        duration_ms: duration,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
