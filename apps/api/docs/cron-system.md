# Cron System Documentation

Comprehensive guide to the Hospeda API cron system for scheduling and managing recurring jobs across multiple deployment environments.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Configuration](#configuration)
- [Deployment Environments](#deployment-environments)
- [Security](#security)
- [Adding New Jobs](#adding-new-jobs)
- [Testing & Monitoring](#testing--monitoring)
- [Registered Jobs](#registered-jobs)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The cron system uses a flexible adapter pattern to support multiple deployment environments while maintaining a single codebase.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     API Server Startup                       │
│                    (apps/api/src/index.ts)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ if NODE_ENV !== 'test'
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cron Bootstrap                            │
│                (apps/api/src/cron/bootstrap.ts)              │
│                                                              │
│  1. Read CRON_ADAPTER from environment                      │
│  2. Load enabled jobs from registry                         │
│  3. Select and initialize adapter                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
    ┌─────────┐      ┌────────────┐     ┌─────────┐
    │ manual  │      │ node-cron  │     │ vercel  │
    └─────────┘      └────────────┘     └─────────┘
         │                  │                  │
         │                  │                  │
         ▼                  ▼                  ▼
    No scheduling    In-process         External
    (HTTP only)      scheduling      (Vercel Cron)
```

### Data Flow

#### Job Registration (Registry Pattern)

```
Job Definition Files          →    Registry         →    Bootstrap
────────────────────               ──────────            ──────────
trial-expiry.ts                    cronJobs[]           Load enabled jobs
webhook-retry.job.ts               getCronJob()         Select adapter
notification-schedule.job.ts       getEnabledCronJobs() Schedule jobs
addon-expiry.job.ts
```

#### Job Execution Flow

```
Trigger Source                     →    Authentication    →    Handler
──────────────                          ────────────           ────────
Vercel Cron (external)                  Verify X-Cron-Secret   Execute job logic
node-cron scheduler (internal)          Return 401 if invalid  Return CronJobResult
Manual HTTP request
```

#### Job Handler Pattern

Every job handler receives a `CronJobContext` and returns a `CronJobResult`:

```typescript
interface CronJobContext {
  logger: Logger;
  startedAt: Date;
  dryRun: boolean;
}

interface CronJobResult {
  success: boolean;
  message: string;
  processed: number;
  errors: number;
  durationMs: number;
  details?: Record<string, unknown>;
}
```

---

## Configuration

### Environment Variables

#### Required

```bash
# CRON_SECRET - Required for all adapters except when CRON_AUTH_DISABLED=true
# Use a strong random secret (32+ characters recommended)
CRON_SECRET=change-me-to-a-random-secret
```

**How to generate a secure secret:**

```bash
# Option 1: OpenSSL
openssl rand -hex 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Online generator (use with caution)
# https://www.random.org/strings/
```

#### Optional

```bash
# CRON_ADAPTER - Determines how jobs are scheduled
# Options: 'manual' (default), 'node-cron', 'vercel'
CRON_ADAPTER=manual

# CRON_AUTH_DISABLED - Disable authentication (DEVELOPMENT ONLY!)
# WARNING: NEVER set to true in production
# Default: false
CRON_AUTH_DISABLED=false
```

### CRON_ADAPTER Options

| Adapter | When to Use | Scheduling Behavior | Requirements |
|---------|-------------|---------------------|--------------|
| `manual` | Local development, debugging | None - manual trigger only | None |
| `node-cron` | VPS, self-hosted, Docker | In-process automatic scheduling | `node-cron` package |
| `vercel` | Vercel deployment | External via Vercel Cron | `vercel.json` config |

---

## Deployment Environments

### Local Development (manual)

**Best for:** Quick testing, debugging individual jobs

**Setup:**

```bash
# .env.local
CRON_ADAPTER=manual  # or omit (defaults to manual)
CRON_SECRET=dev-secret-123  # Use simple secret for dev

# Optional: Disable auth for easier testing
CRON_AUTH_DISABLED=true
```

**Usage:**

```bash
# Start server
pnpm dev

# Manually trigger jobs
curl -X POST http://localhost:3001/api/v1/cron/trial-expiry \
  -H "X-Cron-Secret: dev-secret-123"

# Test in dry-run mode
curl -X POST "http://localhost:3001/api/v1/cron/trial-expiry?dryRun=true" \
  -H "X-Cron-Secret: dev-secret-123"
```

**Expected logs:**

```
[CRON] Initializing cron scheduler (adapter: manual)
[CRON] Using manual adapter - no in-process scheduling needed
```

---

### VPS / Self-Hosted (node-cron)

**Best for:** Traditional VPS hosting, long-running server processes, Docker containers

**Setup:**

```bash
# 1. Install node-cron
pnpm add -D node-cron @types/node-cron

# 2. Configure environment
# .env.production
CRON_ADAPTER=node-cron
CRON_SECRET=<your-production-secret>
NODE_ENV=production
```

**Behavior:**

- Jobs automatically schedule when server starts
- Uses `node-cron` library for in-process scheduling
- Each job triggers via internal HTTP request to `/api/v1/cron/:jobName`
- Includes `X-Cron-Secret` header for authentication

**Expected logs:**

```
[CRON] Initializing cron scheduler (adapter: node-cron)
[CRON] Scheduled job: trial-expiry (schedule: 0 2 * * *)
[CRON] Scheduled job: webhook-retry (schedule: 0 */1 * * *)
[CRON] Scheduled job: notification-schedule (schedule: 0 8 * * *)
[CRON] Scheduled job: addon-expiry (schedule: 0 5 * * *)
[CRON] Scheduler started with 4 jobs
```

**Docker Example:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Copy source
COPY . .

# Build
RUN pnpm build

# Environment
ENV NODE_ENV=production
ENV CRON_ADAPTER=node-cron
ENV CRON_SECRET=will-be-overridden-by-docker-compose

# Start
CMD ["pnpm", "start"]
```

---

### Vercel (vercel)

**Best for:** Serverless deployment on Vercel platform

**Setup:**

```bash
# 1. Configure environment in Vercel dashboard
CRON_ADAPTER=vercel
CRON_SECRET=<your-vercel-secret>
```

**2. Create `vercel.json` in API root:**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": null,
  "outputDirectory": "dist",

  "crons": [
    {
      "path": "/api/v1/cron/trial-expiry",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/cron/webhook-retry",
      "schedule": "0 */1 * * *"
    },
    {
      "path": "/api/v1/cron/notification-schedule",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/v1/cron/addon-expiry",
      "schedule": "0 5 * * *"
    }
  ],

  "env": {
    "NODE_ENV": "production",
    "CRON_ADAPTER": "vercel",
    "CRON_SECRET": "@cron-secret"
  },

  "headers": [
    {
      "source": "/api/v1/cron/(.*)",
      "headers": [
        {
          "key": "X-Robots-Tag",
          "value": "noindex, nofollow"
        }
      ]
    }
  ]
}
```

**Important Notes:**

- Vercel Cron Jobs must match exactly with registered job names
- Schedule format is standard cron (5-field format)
- Vercel automatically adds `X-Cron-Secret` header from environment
- Maximum 12 cron jobs per project on Hobby plan
- See [Vercel Cron Docs](https://vercel.com/docs/cron-jobs) for limits

**Expected logs:**

```
[CRON] Initializing cron scheduler (adapter: vercel)
[CRON] Using vercel adapter - no in-process scheduling needed
```

---

## Security

### Authentication Middleware

All cron endpoints are protected by authentication middleware that validates the `X-Cron-Secret` header.

**Implementation:**

```typescript
// Automatic in apps/api/src/routes/cron/[jobName].ts
if (!process.env.CRON_AUTH_DISABLED) {
  const secret = c.req.header('X-Cron-Secret');
  if (secret !== process.env.CRON_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}
```

### Best Practices

#### DO ✅

- Use a strong random secret (32+ characters, hex or base64)
- Store secret in environment variables (never in code)
- Rotate secrets periodically (every 90 days recommended)
- Use different secrets for staging and production
- Add `X-Robots-Tag: noindex` header to cron endpoints
- Monitor failed authentication attempts

#### DON'T ❌

- Commit secrets to version control
- Use weak/predictable secrets (e.g., "secret123")
- Share secrets between environments
- Disable authentication in production (`CRON_AUTH_DISABLED=true`)
- Expose cron endpoints publicly without authentication
- Log the secret value (log "secret present" or "secret missing")

### Development Mode

For local development convenience, you can disable authentication:

```bash
# .env.local (NEVER in production!)
CRON_AUTH_DISABLED=true
```

**When disabled:**

- No `X-Cron-Secret` header required
- Jobs can be triggered without authentication
- Logs will show warning: `[CRON] Authentication disabled (development mode)`

---

## Adding New Jobs

### Step-by-Step Guide

#### 1. Create Job Definition File

Create a new file in `apps/api/src/cron/jobs/`:

```typescript
// apps/api/src/cron/jobs/cleanup-sessions.ts

/**
 * Session Cleanup Cron Job
 *
 * Removes expired user sessions from the database.
 * Runs daily at 3 AM to clean up sessions older than 30 days.
 *
 * Features:
 * - Finds sessions with last_activity > 30 days ago
 * - Deletes expired sessions in batches of 100
 * - Logs cleanup statistics for monitoring
 *
 * @module cron/jobs/cleanup-sessions
 */

import { getDb, sessions, lt } from '@repo/db';
import type { CronJobDefinition } from '../types.js';

/**
 * Session cleanup cron job definition
 *
 * Schedule: Daily at 3:00 AM UTC
 * Purpose: Remove expired sessions to maintain database health
 */
export const cleanupSessionsJob: CronJobDefinition = {
  name: 'cleanup-sessions',
  description: 'Clean up expired user sessions',
  schedule: '0 3 * * *', // Daily at 3 AM
  enabled: true,
  timeoutMs: 60000, // 1 minute timeout

  handler: async (ctx) => {
    const { logger, startedAt, dryRun } = ctx;

    logger.info('Starting session cleanup', {
      dryRun,
      startedAt: startedAt.toISOString()
    });

    let processed = 0;
    let errors = 0;

    try {
      const db = getDb();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (dryRun) {
        // Dry run: count expired sessions
        const expiredSessions = await db
          .select()
          .from(sessions)
          .where(lt(sessions.lastActivity, thirtyDaysAgo));

        processed = expiredSessions.length;

        logger.info('Dry run - would delete sessions', {
          count: processed
        });

        return {
          success: true,
          message: `Dry run - Would delete ${processed} expired sessions`,
          processed,
          errors: 0,
          durationMs: Date.now() - startedAt.getTime(),
          details: { dryRun: true }
        };
      }

      // Production: delete expired sessions
      const result = await db
        .delete(sessions)
        .where(lt(sessions.lastActivity, thirtyDaysAgo));

      processed = result.rowCount || 0;

      logger.info('Session cleanup completed', {
        deleted: processed,
        durationMs: Date.now() - startedAt.getTime()
      });

      return {
        success: true,
        message: `Successfully deleted ${processed} expired sessions`,
        processed,
        errors: 0,
        durationMs: Date.now() - startedAt.getTime(),
        details: {
          deletedSessions: processed,
          cutoffDate: thirtyDaysAgo.toISOString()
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors++;

      logger.error('Session cleanup failed', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        message: `Failed to cleanup sessions: ${errorMessage}`,
        processed,
        errors,
        durationMs: Date.now() - startedAt.getTime(),
        details: { error: errorMessage }
      };
    }
  }
};
```

#### 2. Export from Jobs Index

Add to `apps/api/src/cron/jobs/index.ts`:

```typescript
// Export all job definitions
export { trialExpiryJob } from './trial-expiry.js';
export { webhookRetryJob } from './webhook-retry.job.js';
export { notificationScheduleJob } from './notification-schedule.job.js';
export { addonExpiryJob } from './addon-expiry.job.js';
export { cleanupSessionsJob } from './cleanup-sessions.js'; // ADD THIS
```

#### 3. Register in Registry

Add to `apps/api/src/cron/registry.ts`:

```typescript
import {
  trialExpiryJob,
  webhookRetryJob,
  notificationScheduleJob,
  addonExpiryJob,
  cleanupSessionsJob // IMPORT
} from './jobs/index.js';

export const cronJobs: CronJobDefinition[] = [
  trialExpiryJob,
  webhookRetryJob,
  notificationScheduleJob,
  addonExpiryJob,
  cleanupSessionsJob // REGISTER
];
```

#### 4. Add to Vercel Configuration (if deploying to Vercel)

Update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/trial-expiry",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/cron/webhook-retry",
      "schedule": "0 */1 * * *"
    },
    {
      "path": "/api/v1/cron/notification-schedule",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/v1/cron/addon-expiry",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/v1/cron/cleanup-sessions",
      "schedule": "0 3 * * *"
    }
  ]
}
```

#### 5. Test the Job

```bash
# Test in dry-run mode
curl -X POST "http://localhost:3001/api/v1/cron/cleanup-sessions?dryRun=true" \
  -H "X-Cron-Secret: dev-secret-123"

# Test actual execution
curl -X POST http://localhost:3001/api/v1/cron/cleanup-sessions \
  -H "X-Cron-Secret: dev-secret-123"
```

### Job Definition Interface

```typescript
interface CronJobDefinition {
  /** Unique name (used in API endpoint: /api/v1/cron/:name) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Cron schedule expression (5-field format) */
  schedule: string;

  /** Whether job is enabled for scheduling */
  enabled: boolean;

  /** Maximum execution time in milliseconds (default: 30000) */
  timeoutMs?: number;

  /** Handler function to execute */
  handler: CronJobHandler;
}
```

### Cron Schedule Syntax

Cron expressions use 5 fields:

```
┌─────────── minute (0 - 59)
│ ┌───────── hour (0 - 23)
│ │ ┌─────── day of month (1 - 31)
│ │ │ ┌───── month (1 - 12)
│ │ │ │ ┌─── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
```

**Common Examples:**

| Schedule | Description | Use Case |
|----------|-------------|----------|
| `0 0 * * *` | Daily at midnight | Daily cleanup tasks |
| `0 */6 * * *` | Every 6 hours | Periodic syncs |
| `*/15 * * * *` | Every 15 minutes | Frequent checks |
| `0 2 * * *` | Daily at 2 AM | Off-peak maintenance |
| `0 8 * * 1` | Mondays at 8 AM | Weekly reports |
| `0 0 1 * *` | First day of month | Monthly aggregations |

**Tools:**

- [Crontab.guru](https://crontab.guru/) - Visual cron expression editor
- [Cron Expression Generator](https://www.freeformatter.com/cron-expression-generator-quartz.html)

---

## Testing & Monitoring

### Manual Testing

#### Dry-Run Mode

Test job logic without making actual changes:

```bash
curl -X POST "http://localhost:3001/api/v1/cron/trial-expiry?dryRun=true" \
  -H "X-Cron-Secret: your-secret" \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Dry run - Would expire 5 trial subscriptions",
  "processed": 5,
  "errors": 0,
  "durationMs": 123,
  "details": {
    "dryRun": true,
    "totalSubscriptions": 20
  }
}
```

#### Production Mode

Execute job with actual changes:

```bash
curl -X POST http://localhost:3001/api/v1/cron/trial-expiry \
  -H "X-Cron-Secret: your-secret" \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Successfully expired 5 trial subscriptions",
  "processed": 5,
  "errors": 0,
  "durationMs": 234,
  "details": {
    "blockedCount": 5
  }
}
```

### Monitoring Job Execution

#### Log Patterns

All cron operations are logged with `[CRON]` prefix:

```
# Startup
[CRON] Initializing cron scheduler (adapter: node-cron)
[CRON] Scheduled job: trial-expiry (schedule: 0 2 * * *)
[CRON] Scheduler started with 4 jobs

# Execution
[CRON] Triggering scheduled job: trial-expiry
[CRON] Job completed: trial-expiry (result: { success: true, processed: 10, ... })

# Errors
[CRON] Job failed: trial-expiry (status: 500, error: Database connection failed)
[CRON] Failed to trigger job: webhook-retry (error: Connection timeout)
```

#### Job Status Endpoint

Check job status via API:

```bash
# Get all registered jobs
curl http://localhost:3001/api/v1/cron \
  -H "X-Cron-Secret: your-secret"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "name": "trial-expiry",
      "description": "Check and expire trials that have passed their end date",
      "schedule": "0 2 * * *",
      "enabled": true
    },
    {
      "name": "webhook-retry",
      "description": "Retries failed webhook events from dead letter queue",
      "schedule": "0 */1 * * *",
      "enabled": true
    }
  ]
}
```

### Metrics Collection

Monitor job performance:

```typescript
// Custom metrics tracking (example)
const metrics = {
  jobName: 'trial-expiry',
  executionTime: result.durationMs,
  processed: result.processed,
  errors: result.errors,
  success: result.success,
  timestamp: new Date()
};

// Send to monitoring service (e.g., DataDog, Sentry)
await sendMetrics(metrics);
```

---

## Registered Jobs

### Overview

| Job Name | Schedule | Description | Timeout |
|----------|----------|-------------|---------|
| `trial-expiry` | `0 2 * * *` | Expire trials that have passed their end date | 5 min |
| `webhook-retry` | `0 */1 * * *` | Retry failed webhook events from dead letter queue | 5 min |
| `notification-schedule` | `0 8 * * *` | Send scheduled notifications for trials and renewals | 2 min |
| `addon-expiry` | `0 5 * * *` | Process expired add-ons and send warnings | 2 min |

---

### trial-expiry

**File:** `apps/api/src/cron/jobs/trial-expiry.ts`

**Schedule:** Daily at 2:00 AM UTC

**Purpose:** Automatically expire trial subscriptions that have passed their end date.

**What it does:**

1. Queries all subscriptions with `status='trialing'`
2. Filters for subscriptions where `trial_end_date <= now()`
3. Updates expired trials to `status='expired'`
4. Uses `TrialService.blockExpiredTrials()` for processing
5. Processes in batches of 100 to avoid memory issues

**Expected Results:**

- **Dry Run:** Returns count of trials that would be expired
- **Production:** Returns count of actually expired trials

**Dependencies:**

- `@repo/billing` - QZPay Billing instance
- `TrialService` - Trial management logic

**Example Output:**

```json
{
  "success": true,
  "message": "Successfully expired 10 trial subscriptions",
  "processed": 10,
  "errors": 0,
  "durationMs": 456,
  "details": {
    "blockedCount": 10
  }
}
```

---

### webhook-retry

**File:** `apps/api/src/cron/jobs/webhook-retry.job.ts`

**Schedule:** Hourly (every hour on the hour)

**Purpose:** Retry failed webhook events from the dead letter queue.

**What it does:**

1. Queries `billing_webhook_dead_letter` for unresolved events (`resolved_at IS NULL`)
2. Attempts to re-process each event (max 50 per run)
3. On success: Sets `resolved_at` timestamp
4. On failure: Increments `attempts` counter
5. After 5 failed attempts: Marks as permanently failed with admin alert

**Expected Results:**

- **Dry Run:** Returns count of events that would be retried
- **Production:** Returns stats (resolved, failed, permanently failed)

**Dependencies:**

- `@repo/db` - Database access for dead letter queue
- Webhook handler logic (TODO: implement actual retry logic)

**Example Output:**

```json
{
  "success": true,
  "message": "Processed 20 webhook events: 15 resolved, 5 failed, 2 permanently failed",
  "processed": 20,
  "errors": 5,
  "durationMs": 1234,
  "details": {
    "resolved": 15,
    "permanentlyFailed": 2,
    "remaining": 30
  }
}
```

**Important Notes:**

- TODO: Implement actual webhook processing logic (currently simulated)
- Admin alert logged when event permanently fails (5+ attempts)
- Idempotent - safe to run concurrently

---

### notification-schedule

**File:** `apps/api/src/cron/jobs/notification-schedule.job.ts`

**Schedule:** Daily at 8:00 AM UTC (5:00 AM Argentina time)

**Purpose:** Send scheduled notifications for trials and subscription renewals.

**What it does:**

1. **Trial Ending Reminders (3 days):**
   - Finds trials ending in 3 days via `TrialService.findTrialsEndingSoon({ daysAhead: 3 })`
   - Sends `TRIAL_ENDING_REMINDER` notification
   - Uses idempotency keys to prevent duplicates

2. **Trial Ending Reminders (1 day):**
   - Finds trials ending in 1 day via `TrialService.findTrialsEndingSoon({ daysAhead: 1 })`
   - Sends `TRIAL_ENDING_REMINDER` notification
   - Uses idempotency keys to prevent duplicates

3. **Renewal Reminders (TODO):**
   - Not yet implemented
   - Will send `RENEWAL_REMINDER` for subscriptions renewing in 3 days

4. **Notification Retries:**
   - Processes failed notifications from Redis retry queue
   - Re-attempts delivery via `RetryService.processRetries()`

**Expected Results:**

- **Dry Run:** Returns count of notifications that would be sent
- **Production:** Returns count of sent notifications and retry stats

**Dependencies:**

- `@repo/notifications` - Notification types and retry service
- `TrialService` - Trial lookup logic
- `sendNotification` utility - Fire-and-forget notification sending

**Example Output:**

```json
{
  "success": true,
  "message": "Processed 25 scheduled notifications (0 errors), 10 retries (8 succeeded, 2 re-queued, 0 permanently failed)",
  "processed": 25,
  "errors": 0,
  "durationMs": 890,
  "details": {
    "trialsEnding3Days": 15,
    "trialsEnding1Day": 10,
    "retries": {
      "processed": 10,
      "succeeded": 8,
      "failed": 2,
      "permanentlyFailed": 0
    },
    "dryRun": false
  }
}
```

**Important Notes:**

- Uses in-memory `sentNotifications` Set to prevent duplicates within same run
- Idempotency key format: `${type}:${customerId}:${YYYY-MM-DD}`
- Fire-and-forget pattern - failures are logged but don't stop processing

---

### addon-expiry

**File:** `apps/api/src/cron/jobs/addon-expiry.job.ts`

**Schedule:** Daily at 5:00 AM UTC (2:00 AM Argentina time)

**Purpose:** Process expired add-ons and send expiration warnings.

**What it does:**

1. **Expire Add-ons:**
   - Finds add-ons with `expires_at <= now()`
   - Updates status to expired via `AddonExpirationService.processExpiredAddons()`
   - Processes in batches of 100

2. **Expiration Warnings (3 days):**
   - Finds add-ons expiring in 3 days via `AddonExpirationService.findExpiringAddons({ daysAhead: 3 })`
   - Sends `ADDON_EXPIRATION_WARNING` notification
   - Uses idempotency keys to prevent duplicates

3. **Expiration Warnings (1 day):**
   - Finds add-ons expiring in 1 day via `AddonExpirationService.findExpiringAddons({ daysAhead: 1 })`
   - Sends `ADDON_EXPIRATION_WARNING` notification
   - Uses idempotency keys to prevent duplicates

**Expected Results:**

- **Dry Run:** Returns count of add-ons that would be expired + warnings that would be sent
- **Production:** Returns count of expired add-ons + warnings sent

**Dependencies:**

- `@repo/notifications` - Notification types
- `AddonExpirationService` - Add-on expiration logic
- `sendNotification` utility - Fire-and-forget notification sending

**Example Output:**

```json
{
  "success": true,
  "message": "Processed 8 expired add-ons, sent 12 warnings (0 errors)",
  "processed": 20,
  "errors": 0,
  "durationMs": 567,
  "details": {
    "expiredAddons": 8,
    "warningsSent": 12,
    "dryRun": false
  }
}
```

**Important Notes:**

- Uses in-memory `sentNotifications` Set to prevent duplicates within same run
- Idempotency key format: `${type}:${customerId}:${addonSlug}:${YYYY-MM-DD}`
- TODO: Populate user email/name from customer (currently empty)

---

## Troubleshooting

### Common Issues

#### 1. Jobs Not Running Automatically

**Symptoms:**

- Server starts but jobs never execute
- No `[CRON] Triggering scheduled job` logs

**Checklist:**

1. ✅ Is `CRON_ADAPTER=node-cron`?

   ```bash
   echo $CRON_ADAPTER
   ```

2. ✅ Is `CRON_SECRET` set?

   ```bash
   echo $CRON_SECRET
   ```

3. ✅ Is `NODE_ENV !== 'test'`?

   ```bash
   echo $NODE_ENV
   ```

4. ✅ Is the job enabled in registry?

   ```typescript
   // Check apps/api/src/cron/jobs/[job-name].ts
   enabled: true
   ```

5. ✅ Are there error logs?

   ```bash
   # Check server logs for [CRON] errors
   grep -i "CRON.*error" logs/api.log
   ```

**Solutions:**

- Set `CRON_ADAPTER=node-cron` in environment
- Set `CRON_SECRET` to a secure random value
- Ensure `NODE_ENV` is not `test`
- Enable job in definition file
- Check server logs for specific error messages

---

#### 2. "node-cron not installed"

**Symptoms:**

```
[CRON] node-cron not installed - in-process scheduling disabled.
Install with: pnpm add -D node-cron @types/node-cron
```

**Solution:**

```bash
pnpm add -D node-cron @types/node-cron
```

**Why this happens:**

- `node-cron` is an optional dependency (not required for `manual` or `vercel` adapters)
- Dynamic import fails if package is not installed

---

#### 3. "CRON_SECRET not configured"

**Symptoms:**

```
[CRON] CRON_SECRET not configured - cannot schedule jobs
```

**Solution:**

```bash
# Add to .env or .env.local
CRON_SECRET=$(openssl rand -hex 32)

# Or manually set
CRON_SECRET=your-secure-random-secret
```

**Why this happens:**

- `node-cron` adapter requires `CRON_SECRET` for authentication
- Jobs trigger via internal HTTP requests that need authentication

---

#### 4. Authentication Failures (401 Unauthorized)

**Symptoms:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing cron secret"
  }
}
```

**Checklist:**

1. ✅ Secret matches in environment and request?

   ```bash
   # Server
   echo $CRON_SECRET

   # Request
   curl -H "X-Cron-Secret: $CRON_SECRET" ...
   ```

2. ✅ Header name is correct?

   ```bash
   # Correct
   -H "X-Cron-Secret: your-secret"

   # Wrong
   -H "Cron-Secret: your-secret"
   -H "X-Secret: your-secret"
   ```

3. ✅ Auth is not disabled?

   ```bash
   # Check .env
   CRON_AUTH_DISABLED=false  # Should be false or unset
   ```

**Solutions:**

- Verify secret matches exactly (case-sensitive)
- Use correct header name: `X-Cron-Secret`
- Ensure `CRON_AUTH_DISABLED` is not set to `true` in production

---

#### 5. Job Not Found (404 Not Found)

**Symptoms:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Cron job not found: cleanup-sessions"
  }
}
```

**Checklist:**

1. ✅ Is job registered in registry?

   ```typescript
   // Check apps/api/src/cron/registry.ts
   export const cronJobs: CronJobDefinition[] = [
     cleanupSessionsJob // Should be here
   ];
   ```

2. ✅ Is job exported from jobs index?

   ```typescript
   // Check apps/api/src/cron/jobs/index.ts
   export { cleanupSessionsJob } from './cleanup-sessions.js';
   ```

3. ✅ Is job name correct?

   ```typescript
   // Job definition
   name: 'cleanup-sessions'

   // API request (must match exactly)
   /api/v1/cron/cleanup-sessions
   ```

**Solutions:**

- Add job to registry
- Export job from jobs index
- Verify job name matches exactly (case-sensitive, hyphen-separated)

---

#### 6. Vercel Cron Not Triggering

**Symptoms:**

- Jobs don't run on schedule in Vercel deployment
- No execution logs in Vercel dashboard

**Checklist:**

1. ✅ Is `vercel.json` in the API root?

   ```bash
   ls apps/api/vercel.json
   ```

2. ✅ Do cron paths match job names?

   ```json
   {
     "crons": [
       {
         "path": "/api/v1/cron/trial-expiry",  // Must match job name
         "schedule": "0 2 * * *"
       }
     ]
   }
   ```

3. ✅ Is schedule syntax correct?

   ```
   # Correct (5 fields)
   0 2 * * *

   # Wrong (6 fields - includes seconds)
   0 0 2 * * *
   ```

4. ✅ Is `CRON_SECRET` set in Vercel environment?

   ```bash
   # Check Vercel dashboard > Settings > Environment Variables
   CRON_SECRET=your-secret
   ```

5. ✅ Check Vercel Cron logs
   - Vercel dashboard > Deployments > [Your deployment] > Logs
   - Filter by "cron" or "/api/v1/cron"

**Solutions:**

- Add `vercel.json` to API root
- Ensure cron paths match registered job names exactly
- Use 5-field cron syntax (no seconds field)
- Set `CRON_SECRET` in Vercel environment variables
- Check Vercel logs for specific errors

---

### Debugging Tips

#### Enable Debug Logging

```typescript
// Temporarily add debug logs to job handler
handler: async (ctx) => {
  ctx.logger.debug('Job started with context', {
    dryRun: ctx.dryRun,
    startedAt: ctx.startedAt
  });

  // ... job logic ...

  ctx.logger.debug('Job completed', {
    processed,
    errors
  });
};
```

#### Test Job Isolation

```bash
# Test individual job without affecting others
curl -X POST "http://localhost:3001/api/v1/cron/trial-expiry?dryRun=true" \
  -H "X-Cron-Secret: dev-secret"
```

#### Monitor Job Performance

```bash
# Check job execution time
grep "Job completed: trial-expiry" logs/api.log | tail -10

# Example output:
[CRON] Job completed: trial-expiry (result: { success: true, durationMs: 234 })
```

#### Verify Job Registration

```bash
# List all registered jobs
curl http://localhost:3001/api/v1/cron \
  -H "X-Cron-Secret: dev-secret"
```

---

## Additional Resources

- **Cron Expression Syntax:** [Crontab.guru](https://crontab.guru/)
- **Vercel Cron Jobs:** [Vercel Docs](https://vercel.com/docs/cron-jobs)
- **node-cron Documentation:** [GitHub](https://github.com/node-cron/node-cron)
- **Related Documentation:**
  - [CRON_CONFIGURATION.md](./CRON_CONFIGURATION.md) - Detailed configuration guide
  - [CRON_VERIFICATION.md](./CRON_VERIFICATION.md) - Manual verification steps
  - [TASK_T032_SUMMARY.md](./TASK_T032_SUMMARY.md) - Implementation summary

---

## Quick Reference

### Environment Variables

| Variable | Required | Default | Values |
|----------|----------|---------|--------|
| `CRON_SECRET` | Yes* | - | Strong random string (32+ chars) |
| `CRON_ADAPTER` | No | `manual` | `manual`, `node-cron`, `vercel` |
| `CRON_AUTH_DISABLED` | No | `false` | `true` (dev only), `false` |

*Required for all adapters except when `CRON_AUTH_DISABLED=true`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/cron` | GET | List all registered jobs |
| `/api/v1/cron/:jobName` | POST | Trigger specific job |
| `/api/v1/cron/:jobName?dryRun=true` | POST | Trigger in dry-run mode |

### Common Commands

```bash
# Generate secret
openssl rand -hex 32

# Test job (dry-run)
curl -X POST "http://localhost:3001/api/v1/cron/trial-expiry?dryRun=true" \
  -H "X-Cron-Secret: $CRON_SECRET"

# Test job (production)
curl -X POST http://localhost:3001/api/v1/cron/trial-expiry \
  -H "X-Cron-Secret: $CRON_SECRET"

# List all jobs
curl http://localhost:3001/api/v1/cron \
  -H "X-Cron-Secret: $CRON_SECRET"
```

---

**Last Updated:** 2026-01-31
**Version:** 1.0.0
