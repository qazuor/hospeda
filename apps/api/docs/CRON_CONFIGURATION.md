# Cron Configuration Guide

This guide explains how to configure and use the cron job system in the Hospeda API.

## Environment Variables

The cron system requires the following environment variables:

```bash
# REQUIRED - Secret for authenticating cron requests
CRON_SECRET=change-me-to-a-random-secret

# OPTIONAL - Cron adapter type (default: manual)
# Options: 'manual', 'node-cron', 'vercel'
CRON_ADAPTER=manual

# OPTIONAL - Disable auth in development ONLY (default: false)
# WARNING: NEVER set to true in production
CRON_AUTH_DISABLED=false
```

## Adapter Types

### 1. `manual` (Default)

No automatic scheduling. Jobs must be triggered manually via HTTP requests.

**Use case:** Local development when you don't need automated scheduling.

```bash
CRON_ADAPTER=manual
# or simply omit CRON_ADAPTER (defaults to 'manual')
```

### 2. `node-cron` (VPS/Self-hosted)

Uses the `node-cron` library for in-process scheduling. Jobs run automatically on the server.

**Use case:** When hosting on a VPS or self-managed server.

**Requirements:**

- Install node-cron: `pnpm add -D node-cron @types/node-cron`
- Set CRON_SECRET for authentication

**Configuration:**

```bash
CRON_ADAPTER=node-cron
CRON_SECRET=your-secure-random-secret
```

**Behavior:**

- Schedules all enabled jobs when the server starts
- Jobs trigger HTTP requests to `/api/v1/cron/:jobName`
- Only runs in non-test environments

### 3. `vercel` (Vercel Deployment)

Jobs are triggered externally by Vercel Cron. Requires `vercel.json` configuration.

**Use case:** When deploying to Vercel.

**Configuration:**

```bash
CRON_ADAPTER=vercel
CRON_SECRET=your-secure-random-secret
```

**Vercel Configuration Example:**

Create a `vercel.json` file in the API root:

```json
{
  "crons": [
    {
      "path": "/api/v1/cron/check-trial-expiry",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/v1/cron/retry-failed-webhooks",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/v1/cron/send-scheduled-notifications",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/v1/cron/check-addon-expiry",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**Required Headers:**

All Vercel cron requests must include:

```
X-Cron-Secret: your-cron-secret
```

## Server Integration

The cron scheduler is automatically initialized when the API server starts:

```typescript
// src/index.ts
const server = serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    apiLogger.info(`🚀 Server running on port ${info.port}`);

    // Start cron scheduler (only in non-test environments)
    if (process.env.NODE_ENV !== 'test') {
      startCronScheduler(port).catch((error) => {
        apiLogger.error(
          'Failed to start cron scheduler:',
          error instanceof Error ? error.message : String(error)
        );
      });
    }
  }
);
```

## Job Configuration

Jobs are configured in `src/cron/jobs/` and registered in `src/cron/registry.ts`.

**Example Job:**

```typescript
import type { CronJobDefinition } from '../types';

export const myJob: CronJobDefinition = {
  name: 'my-job',
  description: 'Does something important',
  schedule: '0 * * * *', // Every hour
  enabled: true,
  timeoutMs: 30000,
  handler: async (ctx) => {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      // Job logic here
      processed = 42;
    } catch (error) {
      errors++;
      ctx.logger.error('Job failed', { error });
    }

    return {
      success: errors === 0,
      message: `Processed ${processed} items`,
      processed,
      errors,
      durationMs: Date.now() - startTime
    };
  }
};
```

**Register in registry.ts:**

```typescript
import { myJob } from './jobs/my-job';

export const cronJobs: CronJobDefinition[] = [
  myJob,
  // ... other jobs
];
```

## Cron Schedule Syntax

Cron expressions use the following format:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Common Examples:**

```bash
*/5 * * * *      # Every 5 minutes
0 * * * *        # Every hour
0 0 * * *        # Every day at midnight
0 0 * * 0        # Every Sunday at midnight
*/15 * * * *     # Every 15 minutes
0 */2 * * *      # Every 2 hours
0 1 * * *        # Every day at 1 AM
```

## Manual Job Triggering

You can manually trigger any job via HTTP POST:

```bash
curl -X POST http://localhost:3001/api/v1/cron/check-trial-expiry \
  -H "X-Cron-Secret: your-cron-secret"
```

**Query Parameters:**

- `dryRun=true` - Run in dry-run mode (no actual changes)

```bash
curl -X POST "http://localhost:3001/api/v1/cron/check-trial-expiry?dryRun=true" \
  -H "X-Cron-Secret: your-cron-secret"
```

## Security

### Authentication

All cron endpoints require the `X-Cron-Secret` header:

```typescript
// Automatically verified by cron middleware
if (req.header('X-Cron-Secret') !== process.env.CRON_SECRET) {
  return c.json({ error: 'Unauthorized' }, 401);
}
```

### Development Mode

For local development, you can disable authentication:

```bash
CRON_AUTH_DISABLED=true  # Development ONLY
```

**WARNING:** NEVER disable authentication in production.

## Logging

All cron operations are logged with the `[CRON]` prefix:

```
[CRON] Initializing cron scheduler (adapter: node-cron)
[CRON] Scheduled job: check-trial-expiry (schedule: 0 0 * * *)
[CRON] Scheduler started with 4 jobs
[CRON] Triggering scheduled job: check-trial-expiry
[CRON] Job completed: check-trial-expiry (processed: 10, errors: 0)
```

## Troubleshooting

### node-cron Not Found

If using `CRON_ADAPTER=node-cron` and seeing errors:

```bash
pnpm add -D node-cron @types/node-cron
```

### Jobs Not Running

1. Check `CRON_ADAPTER` is set correctly
2. Verify `CRON_SECRET` is configured
3. Check job is enabled in registry
4. Verify `NODE_ENV !== 'test'`
5. Check server logs for errors

### Authentication Failures

1. Verify `CRON_SECRET` matches in both server and request
2. Check `X-Cron-Secret` header is included
3. Ensure `CRON_AUTH_DISABLED` is not set in production

### Vercel Cron Not Triggering

1. Verify `vercel.json` is in the API root
2. Check cron paths match registered job names
3. Verify schedule syntax is correct
4. Check Vercel dashboard for cron logs

## Best Practices

1. **Always set CRON_SECRET** - Use a strong random value
2. **Never commit secrets** - Use environment variables
3. **Test in dry-run mode** - Verify job logic before enabling
4. **Monitor job execution** - Check logs and metrics
5. **Handle errors gracefully** - Jobs should never crash the server
6. **Use appropriate schedules** - Don't run too frequently
7. **Implement timeouts** - Prevent long-running jobs from blocking
8. **Log all operations** - Makes debugging easier

## Current Registered Jobs

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `check-trial-expiry` | `0 0 * * *` | Check and expire trial subscriptions (daily at midnight) |
| `retry-failed-webhooks` | `*/15 * * * *` | Retry failed webhook deliveries (every 15 minutes) |
| `send-scheduled-notifications` | `*/5 * * * *` | Send scheduled email notifications (every 5 minutes) |
| `check-addon-expiry` | `0 1 * * *` | Check and expire one-time addons (daily at 1 AM) |

See `src/cron/registry.ts` for the complete list.

## References

- [Cron Expression Syntax](https://crontab.guru/)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [node-cron Documentation](https://github.com/node-cron/node-cron)
- [Job Types Documentation](./types.ts)
- [Job Registry](../src/cron/registry.ts)
