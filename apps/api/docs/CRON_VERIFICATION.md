# Cron System Verification Guide

This document provides manual verification steps to ensure the cron system is properly integrated and working as expected.

## Verification Checklist

### ✅ 1. Integration Verification

Check that `startCronScheduler` is called in the server startup:

```typescript
// apps/api/src/index.ts
if (process.env.NODE_ENV !== 'test') {
  startCronScheduler(port).catch((error) => {
    apiLogger.error(
      'Failed to start cron scheduler:',
      error instanceof Error ? error.message : String(error)
    );
  });
}
```

**Expected behavior:**

- Function is called AFTER server starts listening
- Function is NOT called when `NODE_ENV === 'test'`
- Errors are caught and logged

### ✅ 2. CRON_ADAPTER=manual (Default)

**Setup:**

```bash
# In .env or .env.local
CRON_ADAPTER=manual
# or simply omit CRON_ADAPTER
```

**Start server:**

```bash
pnpm dev
```

**Expected console output:**

```
[CRON] Initializing cron scheduler (adapter: manual)
[CRON] Using manual adapter - no in-process scheduling needed
```

**Verification:**

- ✅ No jobs are automatically scheduled
- ✅ No error messages
- ✅ Server starts successfully
- ✅ Jobs can be triggered manually via HTTP

**Test manual trigger:**

```bash
curl -X POST http://localhost:3001/api/v1/cron/check-trial-expiry \
  -H "X-Cron-Secret: your-cron-secret"
```

### ✅ 3. CRON_ADAPTER=node-cron

**Setup:**

```bash
# Install node-cron if not already installed
pnpm add -D node-cron @types/node-cron

# In .env or .env.local
CRON_ADAPTER=node-cron
CRON_SECRET=test-secret-123
```

**Start server:**

```bash
pnpm dev
```

**Expected console output:**

```
[CRON] Initializing cron scheduler (adapter: node-cron)
[CRON] Scheduled job: check-trial-expiry (schedule: 0 0 * * *)
[CRON] Scheduled job: retry-failed-webhooks (schedule: */15 * * * *)
[CRON] Scheduled job: send-scheduled-notifications (schedule: */5 * * * *)
[CRON] Scheduled job: check-addon-expiry (schedule: 0 1 * * *)
[CRON] Scheduler started with 4 jobs
```

**Verification:**

- ✅ All enabled jobs are scheduled
- ✅ Jobs trigger automatically according to schedule
- ✅ Each job execution is logged
- ✅ Job results are logged (success/failure, processed count, duration)

**Monitor job execution:**

Wait for the next scheduled time or modify a job schedule to trigger sooner:

```typescript
// Temporarily change in src/cron/jobs/trial-expiry.ts for testing
schedule: '*/1 * * * *', // Every minute (for testing only!)
```

**Expected output when job runs:**

```
[CRON] Triggering scheduled job: check-trial-expiry
[CRON] Job completed: check-trial-expiry (result: { success: true, processed: 10, ... })
```

### ✅ 4. CRON_ADAPTER=vercel

**Setup:**

```bash
# In .env or .env.local
CRON_ADAPTER=vercel
CRON_SECRET=test-secret-123
```

**Start server:**

```bash
pnpm dev
```

**Expected console output:**

```
[CRON] Initializing cron scheduler (adapter: vercel)
[CRON] Using vercel adapter - no in-process scheduling needed
```

**Verification:**

- ✅ No jobs are scheduled in-process
- ✅ Server starts successfully
- ✅ Jobs can be triggered externally (simulating Vercel)

**Test external trigger (simulating Vercel Cron):**

```bash
curl -X POST http://localhost:3001/api/v1/cron/check-trial-expiry \
  -H "X-Cron-Secret: test-secret-123"
```

### ✅ 5. Test Environment Behavior

**Setup:**

```bash
NODE_ENV=test pnpm test
```

**Verification:**

- ✅ `startCronScheduler` is NOT called
- ✅ No cron-related logs appear in test output
- ✅ Tests run without cron interference

### ✅ 6. Missing CRON_SECRET with node-cron

**Setup:**

```bash
# In .env or .env.local
CRON_ADAPTER=node-cron
# CRON_SECRET is NOT set
```

**Start server:**

```bash
pnpm dev
```

**Expected console output:**

```
[CRON] Initializing cron scheduler (adapter: node-cron)
[CRON] CRON_SECRET not configured - cannot schedule jobs
```

**Verification:**

- ✅ Error is logged
- ✅ Jobs are NOT scheduled
- ✅ Server continues to run

### ✅ 7. node-cron Not Installed

**Setup:**

```bash
# Remove node-cron
pnpm remove node-cron @types/node-cron

# In .env or .env.local
CRON_ADAPTER=node-cron
CRON_SECRET=test-secret-123
```

**Start server:**

```bash
pnpm dev
```

**Expected console output:**

```
[CRON] Initializing cron scheduler (adapter: node-cron)
[CRON] node-cron not installed - in-process scheduling disabled. Install with: pnpm add -D node-cron @types/node-cron
```

**Verification:**

- ✅ Warning is logged with installation instructions
- ✅ Jobs are NOT scheduled
- ✅ Server continues to run

## Manual Testing Scenarios

### Scenario 1: Successful Job Execution

**Setup:**

```bash
CRON_ADAPTER=manual
CRON_SECRET=test-secret
```

**Test:**

```bash
curl -X POST http://localhost:3001/api/v1/cron/check-trial-expiry \
  -H "X-Cron-Secret: test-secret" \
  -H "Content-Type: application/json"
```

**Expected response:**

```json
{
  "success": true,
  "message": "Checked 10 trial subscriptions, expired 2",
  "processed": 10,
  "errors": 0,
  "durationMs": 234
}
```

### Scenario 2: Authentication Failure

**Test:**

```bash
curl -X POST http://localhost:3001/api/v1/cron/check-trial-expiry \
  -H "X-Cron-Secret: wrong-secret"
```

**Expected response:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing cron secret"
  }
}
```

**Status code:** `401 Unauthorized`

### Scenario 3: Missing Secret Header

**Test:**

```bash
curl -X POST http://localhost:3001/api/v1/cron/check-trial-expiry
```

**Expected response:**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing cron secret"
  }
}
```

**Status code:** `401 Unauthorized`

### Scenario 4: Job Not Found

**Test:**

```bash
curl -X POST http://localhost:3001/api/v1/cron/non-existent-job \
  -H "X-Cron-Secret: test-secret"
```

**Expected response:**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Cron job not found: non-existent-job"
  }
}
```

**Status code:** `404 Not Found`

### Scenario 5: Dry Run Mode

**Test:**

```bash
curl -X POST "http://localhost:3001/api/v1/cron/check-trial-expiry?dryRun=true" \
  -H "X-Cron-Secret: test-secret"
```

**Expected response:**

```json
{
  "success": true,
  "message": "[DRY RUN] Would have checked 10 trial subscriptions",
  "processed": 10,
  "errors": 0,
  "durationMs": 123,
  "details": {
    "dryRun": true
  }
}
```

## Verification Summary Table

| Test Case | CRON_ADAPTER | CRON_SECRET | Expected Behavior |
|-----------|--------------|-------------|-------------------|
| Default config | (unset/manual) | (any) | No auto-scheduling, manual triggers work |
| node-cron + secret | node-cron | set | Jobs auto-schedule, run on schedule |
| node-cron no secret | node-cron | (unset) | Error logged, no scheduling |
| node-cron not installed | node-cron | set | Warning logged, no scheduling |
| vercel mode | vercel | set | No auto-scheduling, external triggers work |
| Test environment | (any) | (any) | No cron initialization at all |

## Common Issues

### Issue: "node-cron not found"

**Solution:** Install the dependency

```bash
pnpm add -D node-cron @types/node-cron
```

### Issue: Jobs not running automatically

**Checklist:**

1. ✅ Is `CRON_ADAPTER=node-cron`?
2. ✅ Is `CRON_SECRET` set?
3. ✅ Is `NODE_ENV !== 'test'`?
4. ✅ Is the job enabled in registry?
5. ✅ Are there any error logs?

### Issue: "CRON_SECRET not configured"

**Solution:** Set the environment variable

```bash
# In .env or .env.local
CRON_SECRET=your-secure-random-secret
```

### Issue: Authentication failures

**Solution:** Verify secret matches

```bash
# Server .env
CRON_SECRET=test-secret

# Request header
X-Cron-Secret: test-secret
```

## Next Steps

After verifying the integration:

1. ✅ Review [CRON_CONFIGURATION.md](./CRON_CONFIGURATION.md) for detailed configuration
2. ✅ Check [jobs/README.md](../src/cron/jobs/README.md) for creating new jobs
3. ✅ Configure production environment variables
4. ✅ Set up Vercel cron (if deploying to Vercel)
5. ✅ Monitor cron execution in production logs
