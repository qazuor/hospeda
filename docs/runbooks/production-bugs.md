# Production Bug Investigation Runbook

## Overview

This runbook provides step-by-step procedures for investigating and resolving production issues. It covers initial response, investigation methodology, common issues, and post-incident procedures.

**When to Use**:

- Production outage or partial outage
- Error rate spike (> 1%)
- Performance degradation
- User-reported issues
- Unexpected system behavior
- Data inconsistencies

**Expected Outcomes**:

- Issue identified and categorized
- Root cause determined
- Problem resolved or mitigated
- Incident documented for future reference

**Time Estimate**:

- Initial response: 5 minutes
- Investigation: 15-60 minutes (varies by complexity)
- Resolution: 15 minutes - 4 hours (varies by issue)

## Prerequisites

### Required Access

- [ ] Vercel Dashboard access (frontend monitoring)
- [ ] Neon Console access (database monitoring)
- [ ] GitHub repository access (code, Actions)
- [ ] Production database read-only access
- [ ] Team communication channels

### Required Tools

- [ ] Browser (for dashboards)
- [ ] Terminal with CLI tools (psql, gh, vercel)
- [ ] Text editor for notes
- [ ] Access to runbooks and documentation

### Knowledge Requirements

- Understanding of Hospeda architecture
- Familiarity with monitoring dashboards
- Basic PostgreSQL query skills
- Git and deployment workflows
- Escalation procedures

## Initial Response (First 5 Minutes)

**Critical**: Complete these steps within 5 minutes of incident detection.

### Step 1: Acknowledge and Communicate

**Action**: Post in team channel

```text
🚨 [SEVERITY] [COMPONENT] [BRIEF DESCRIPTION]

Status: Investigating
Impact: [Brief user-facing impact]
Started: [Timestamp]
Assigned: @[your-username]
Runbook: Production Bug Investigation
```

**Severity Assessment**:

| Severity | Criteria | Example |
|----------|----------|---------|
| **Critical** | Complete outage, data loss, security breach | Site down, all API requests failing |
| **High** | Major feature broken, affecting many users | Booking system down, payments failing |
| **Medium** | Minor feature broken, affecting some users | Search slow, email delays |
| **Low** | Cosmetic issues, no user impact | UI glitch, typo |

### Step 2: Check Service Health

Run basic health checks:

```bash
# API health
curl -f https://api.hospeda.com/health || echo "❌ API DOWN"

# Web app health
curl -sI https://hospeda.com | grep "200 OK" || echo "❌ WEB DOWN"

# Admin app health
curl -sI https://admin.hospeda.com | grep "200 OK" || echo "❌ ADMIN DOWN"

# Database connection (production)
psql $DATABASE_URL -c "SELECT 1" || echo "❌ DB DOWN"
```

**Expected Output**:

```text
✅ API responding
✅ Web app responding
✅ Admin app responding
✅ Database connected
```

**If any service is down**:

- **Critical severity**: Escalate immediately
- Document which services are affected
- Proceed to Step 3 for quick diagnostics

### Step 3: Review Recent Deployments

**Check for recent changes** (last 24 hours):

```bash
# List recent deployments via GitHub API
gh api repos/:owner/hospeda/deployments \
  --jq '.[:5] | .[] | {created_at, environment, sha: .sha[0:7]}'

# Or check Vercel deployments
vercel list --limit 10
```

**Questions to Answer**:

- Was there a deployment in the last 2 hours?
- Did the issue start immediately after deployment?
- Were there any database migrations?
- Were configuration changes made?

**If recent deployment found**:

- Note deployment time vs issue start time
- Identify what changed (review PR/commit)
- Consider rollback (see [Rollback Runbook](./rollback.md))

### Step 4: Check Monitoring Dashboards

**Vercel Dashboard**:

1. Go to <https://vercel.com/[team]/[project>]
2. Check **Logs** tab for errors
3. Check **Analytics** for traffic patterns
4. Note any error spikes or anomalies

**Neon Console**:

1. Go to <https://console.neon.tech>
2. Select project
3. Check **Monitoring** tab
4. Look for:
   - Connection count spikes
   - Query duration increases
   - CPU/memory usage

**GitHub Actions**:

1. Go to <https://github.com/[org]/hospeda/actions>
2. Check recent workflow runs
3. Look for failed deployments or tests

### Step 5: Initial Assessment

Based on steps 1-4, answer:

- **What is broken?** (specific feature/component)
- **How many users affected?** (all/many/few/one)
- **When did it start?** (exact time if known)
- **Recent changes?** (deployments, migrations, config)
- **Error messages?** (if any)

**Update team**:

```text
📊 UPDATE: [COMPONENT]

Progress: Completed initial assessment
Findings:
- Component: [specific feature/service]
- Started: [time]
- Affected: [user scope]
- Recent changes: [yes/no - what]
Current: Beginning detailed investigation
ETA: [estimate or "Unknown"]
```

## Detailed Investigation

Based on initial assessment, choose investigation path:

- **API Errors** → [API Error Investigation](#api-error-investigation)
- **Frontend Issues** → [Frontend Issue Investigation](#frontend-issue-investigation)
- **Database Problems** → [Database Issue Investigation](#database-issue-investigation)
- **Performance Issues** → [Performance Investigation](#performance-investigation)
- **Authentication Issues** → [Auth Issue Investigation](#auth-issue-investigation)

### API Error Investigation

**Symptoms**:

- 500/502/503 errors
- API timeouts
- Error rate > 1%
- Failed requests

**Investigation Steps**:

**Step 1**: Check API logs (Vercel/Fly.io)

```bash
# Vercel logs (if API on Vercel)
vercel logs https://api.hospeda.com --since 1h

# Or check deployment logs
vercel logs [deployment-url]
```

**Look for**:

- Unhandled exceptions
- Database connection errors
- External service failures (Clerk, Mercado Pago)
- Timeout errors

**Step 2**: Identify failing endpoints

From logs, identify:

- Which endpoints are failing? (e.g., `/api/bookings`, `/api/accommodations`)
- What HTTP status codes? (500, 502, 503, etc.)
- Error messages? (exception details)
- Frequency? (all requests or intermittent)

**Step 3**: Check database connections

```bash
# Check active connections (local test)
docker exec hospeda_postgres psql -U hospeda_user -d hospeda_dev -c \
  "SELECT count(*) as connections FROM pg_stat_activity"

# Check for connection pool exhaustion
# Expected: < 80% of max connections
```

**For Neon (production)**:

1. Go to Neon Console
2. Check **Monitoring** → **Connections**
3. Look for connection count spikes

**Step 4**: Review error handling

Check if error is:

- **Handled**: Error response with proper status code and message
- **Unhandled**: 500 error with stack trace

**Example handled error**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { "field": "email" }
  }
}
```

**Example unhandled error** (in logs):

```text
TypeError: Cannot read property 'id' of undefined
  at BookingService.create (booking.service.ts:45)
```

**Step 5**: Reproduce locally (if possible)

```bash
# Start local environment
docker compose up -d
pnpm dev

# Test endpoint
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{ "accommodationId": "test-123", ... }'
```

**If reproducible locally**:

- Debug with breakpoints
- Check error message
- Identify root cause
- Fix and test

**If NOT reproducible locally**:

- Likely environment-specific (production data, config, external services)
- Check production vs local differences
- Review environment variables
- Check external service status

### Frontend Issue Investigation

**Symptoms**:

- Pages not loading
- UI not rendering correctly
- JavaScript errors in console
- Slow page loads

**Investigation Steps**:

**Step 1**: Open browser DevTools

1. Navigate to affected page
2. Open DevTools (F12)
3. Check **Console** tab for errors
4. Check **Network** tab for failed requests

**Step 2**: Check for JavaScript errors

**Common errors**:

```text
Uncaught TypeError: Cannot read property 'X' of undefined
Uncaught ReferenceError: X is not defined
Failed to fetch
```

**Note**:

- Error message
- File and line number
- Stack trace

**Step 3**: Check network requests

In DevTools **Network** tab:

- Look for failed requests (red status)
- Check request/response headers
- Verify response data format
- Note slow requests (> 1s)

**Step 4**: Check Vercel deployment

```bash
# List recent deployments
vercel list

# Check specific deployment logs
vercel logs [deployment-url]
```

**Look for**:

- Build errors
- Runtime errors
- Missing environment variables

**Step 5**: Check for hydration errors (Astro/React)

**Hydration mismatch symptoms**:

- Content flashing
- Elements disappearing
- Console warnings about hydration

**In browser console**:

```text
Warning: Text content did not match. Server: "X" Client: "Y"
Warning: Expected server HTML to contain a matching <div>
```

**Common causes**:

- Date/time rendering (server vs client timezone)
- Conditional rendering based on client-only data
- Third-party scripts modifying DOM

**Step 6**: Reproduce in different browsers/devices

Test in:

- Chrome
- Firefox
- Safari (if available)
- Mobile browser (Chrome mobile)

**If browser-specific**:

- Note which browsers affected
- Check for browser compatibility issues
- Review polyfills and feature detection

### Database Issue Investigation

**Symptoms**:

- Database connection errors
- Slow queries
- Timeouts
- Data inconsistencies

**Investigation Steps**:

**Step 1**: Check database health (Neon)

1. Go to Neon Console
2. Check **Monitoring** dashboard
3. Look for:
   - High CPU usage (> 80%)
   - High connection count (> 80% of max)
   - Long-running queries
   - Disk space issues

**Step 2**: Identify slow queries

**Using Neon Console**:

1. Go to **Monitoring** → **Query Performance**
2. Sort by duration
3. Identify slow queries (> 500ms)

**Using pg_stat_statements** (if enabled):

```sql
-- Top 10 slowest queries by mean time
SELECT
  substring(query, 1, 50) as short_query,
  round(mean_exec_time::numeric, 2) as avg_ms,
  calls,
  round(total_exec_time::numeric, 2) as total_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Step 3**: Check for missing indexes

If slow query identified, check execution plan:

```sql
EXPLAIN ANALYZE
SELECT * FROM accommodations
WHERE city = 'Concepción del Uruguay';
```

**Look for**:

- **Seq Scan** (table scan - bad for large tables)
- **Index Scan** (good)
- **Bitmap Heap Scan** (acceptable)

**If Seq Scan on large table**:

- Missing index is likely cause
- Consider adding index (requires migration)
- Temporary: optimize query if possible

**Step 4**: Check for lock contention

```sql
-- Active locks
SELECT
  pid,
  usename,
  pg_blocking_pids(pid) as blocked_by,
  query as waiting_query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

**If locks found**:

- Identify blocking query
- Check if long-running transaction
- Consider killing blocking process (careful!)

**Step 5**: Check connection pool

```sql
-- Current connections by state
SELECT
  state,
  count(*) as connections
FROM pg_stat_activity
GROUP BY state;
```

**Healthy output**:

```text
state  | connections
-------+------------
active | 5
idle   | 10
```

**Unhealthy (connection pool exhausted)**:

```text
state  | connections
-------+------------
active | 95
idle   | 5
```

**If pool exhausted**:

- Check for connection leaks in code
- Verify connection pool settings
- Consider scaling database

### Performance Investigation

**Symptoms**:

- Slow page loads (LCP > 2.5s)
- Slow API responses (p95 > 500ms)
- High server CPU/memory
- Timeout errors

**Investigation Steps**:

**Step 1**: Measure performance

**Frontend**:

1. Open DevTools
2. Go to **Performance** tab
3. Record page load
4. Analyze:
   - Largest Contentful Paint (LCP)
   - First Input Delay (FID)
   - Cumulative Layout Shift (CLS)
   - Time to First Byte (TTFB)

**API**:

```bash
# Test API response time
time curl -s https://api.hospeda.com/api/accommodations > /dev/null

# Expected: < 200ms for list endpoints
```

**Step 2**: Identify bottleneck

**Common bottlenecks**:

- **Database queries**: Check query times (see [Database Investigation](#database-issue-investigation))
- **External API calls**: Check Clerk, Mercado Pago response times
- **Large payloads**: Check response size
- **N+1 queries**: Multiple DB queries for single request

**Step 3**: Check for N+1 query problems

**Symptom**: Many similar queries in logs

**Example** (bad):

```sql
SELECT * FROM accommodations WHERE id = 'acc-1';
SELECT * FROM accommodations WHERE id = 'acc-2';
SELECT * FROM accommodations WHERE id = 'acc-3';
-- repeated 100 times
```

**Solution**: Use batch query

```sql
SELECT * FROM accommodations WHERE id IN ('acc-1', 'acc-2', 'acc-3', ...);
```

**Step 4**: Check response payload size

```bash
# Check response size
curl -s https://api.hospeda.com/api/accommodations | wc -c

# Check with compression
curl -s -H "Accept-Encoding: gzip" https://api.hospeda.com/api/accommodations \
  --output /tmp/response.gz && ls -lh /tmp/response.gz
```

**If large** (> 1MB):

- Consider pagination
- Remove unnecessary fields
- Implement field filtering

**Step 5**: Profile code (locally)

For slow endpoint:

1. Add timing logs

   ```typescript
   console.time('db-query');
   const result = await db.select().from(accommodations);
   console.timeEnd('db-query');
   ```

1. Run locally and analyze
1. Identify slow operations
1. Optimize (add indexes, cache, reduce queries)

### Auth Issue Investigation

**Symptoms**:

- Authentication failures
- 401 Unauthorized errors
- Session not persisting
- User can't log in

**Investigation Steps**:

**Step 1**: Check Clerk status

1. Go to <https://status.clerk.com>
2. Verify no ongoing incidents

**Step 2**: Check Clerk configuration

In Clerk Dashboard:

1. Verify application settings
2. Check allowed redirect URLs
3. Verify JWT template (if custom)
4. Check environment (development vs production)

**Step 3**: Check environment variables

**Required variables**:

```bash
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
```

**Verify**:

```bash
# Check if set (don't print values)
[ -n "$CLERK_SECRET_KEY" ] && echo "✅ CLERK_SECRET_KEY set" || echo "❌ CLERK_SECRET_KEY missing"
```

**Step 4**: Test authentication flow

1. Open incognito/private window
2. Navigate to login page
3. Open DevTools → Network
4. Attempt login
5. Check requests:
   - Request to Clerk
   - Response status
   - Cookies set
   - Redirect behavior

**Step 5**: Check middleware (API)

Verify auth middleware is:

- Correctly validating JWT
- Extracting user information
- Handling errors appropriately

**Test endpoint with curl**:

```bash
# Without auth (should get 401)
curl https://api.hospeda.com/api/bookings
# Expected: {"error": "Unauthorized"}

# With auth token
curl https://api.hospeda.com/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"success": true, "data": [...]}
```

## Common Issues and Solutions

### Issue 1: API Returning 500 Errors

**Symptoms**:

- All or most API requests return 500
- Error in logs: "Database connection failed"

**Root Cause**: Database connection string incorrect or database down

**Solution**:

**Step 1**: Verify DATABASE_URL environment variable

```bash
# Check if set (in production environment)
# Via Vercel dashboard → Settings → Environment Variables
# or Fly.io dashboard → Secrets
```

**Step 2**: Test database connection

```bash
psql $DATABASE_URL -c "SELECT version()"
```

**If connection fails**:

- Check Neon database status
- Verify connection string format
- Check IP allowlist (if configured)
- Verify database exists

**Step 3**: Restart application

```bash
# Trigger redeploy
git commit --allow-empty -m "chore: trigger redeploy"
git push
```

**Prevention**:

- Add database connection health check to startup
- Implement retry logic with exponential backoff
- Add monitoring alert for database connection failures

### Issue 2: Slow Query Performance

**Symptoms**:

- API responses slow (> 1s)
- Database CPU high
- Timeout errors

**Root Cause**: Missing database index or inefficient query

**Solution**:

**Step 1**: Identify slow query (see [Database Investigation](#database-issue-investigation))

**Step 2**: Analyze query plan

```sql
EXPLAIN ANALYZE
SELECT * FROM accommodations WHERE city = 'Concepción';
```

**Step 3**: Add index (if missing)

```typescript
// Create migration
// packages/db/migrations/0XXX_add_city_index.sql

CREATE INDEX idx_accommodations_city ON accommodations(city);
```

**Step 4**: Deploy migration

```bash
cd packages/db
pnpm db:migrate

# Or in production (via GitHub Actions or manual)
```

**Step 5**: Verify improvement

```sql
EXPLAIN ANALYZE
SELECT * FROM accommodations WHERE city = 'Concepción';
-- Should now show "Index Scan using idx_accommodations_city"
```

**Prevention**:

- Review query performance before deploying
- Add indexes for commonly filtered fields
- Monitor slow query log regularly

### Issue 3: Memory Leak

**Symptoms**:

- Memory usage increasing over time
- Eventually leads to crashes or restarts
- "Out of memory" errors

**Root Cause**: Unclosed connections, event listeners, or large object retention

**Solution**:

**Step 1**: Monitor memory usage

```bash
# Check container memory (Docker)
docker stats hospeda_api

# Check Node.js heap
# Add to code: console.log(process.memoryUsage())
```

**Step 2**: Check for connection leaks

**Common causes**:

- Database connections not closed
- Event listeners not removed
- Timers not cleared

**Review code for**:

```typescript
// ❌ BAD: Connection not closed
const db = await getDb();
const result = await db.query(...);
// Connection leaked!

// ✅ GOOD: Connection properly closed
const db = await getDb();
try {
  const result = await db.query(...);
  return result;
} finally {
  await db.close();
}
```

**Step 3**: Use connection pooling

Verify Drizzle ORM is using connection pool:

```typescript
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

**Step 4**: Profile memory (locally)

```bash
# Run with --inspect
node --inspect dist/index.js

# Open Chrome DevTools
# Navigate to chrome://inspect
# Take heap snapshots and compare
```

**Prevention**:

- Use connection pooling
- Clean up resources in finally blocks
- Review code for leaks in PR reviews
- Monitor memory usage in production

### Issue 4: Authentication Failures After Deployment

**Symptoms**:

- Users getting logged out
- 401 errors on protected endpoints
- "Session expired" messages

**Root Cause**: Clerk environment mismatch or JWT configuration change

**Solution**:

**Step 1**: Verify environment variables

Check that production environment has:

- `CLERK_SECRET_KEY` (correct for production)
- `CLERK_PUBLISHABLE_KEY` (correct for production)
- Not using development keys in production

**Step 2**: Check Clerk Dashboard

1. Go to Clerk Dashboard
2. Verify application is in correct environment
3. Check JWT template hasn't changed
4. Verify allowed origins include production URL

**Step 3**: Clear sessions

If keys changed:

- All existing sessions invalidated
- Users must log in again
- This is expected behavior

**Step 4**: Communicate to users

If widespread logout:

```text
⚠️ NOTICE: Authentication System Maintenance

We've updated our authentication system. You may need to log in again.
This is a one-time occurrence.

We apologize for the inconvenience.
```

**Prevention**:

- Never change Clerk keys without planning
- Test auth in staging before production deploy
- Document environment variable changes
- Add auth health check to deployment pipeline

### Issue 5: Payment Processing Errors

**Symptoms**:

- Payments failing
- Mercado Pago webhook errors
- Users reporting payment not processing

**Root Cause**: Mercado Pago API issues or webhook configuration

**Solution**:

**Step 1**: Check Mercado Pago status

1. Check Mercado Pago service status
2. Review Mercado Pago dashboard for errors
3. Check recent API changes or deprecations

**Step 2**: Verify webhook configuration

In Mercado Pago dashboard:

- Webhook URL correct (<https://api.hospeda.com/api/webhooks/mercado-pago>)
- Webhook events subscribed (payment, refund)
- Webhook secret configured

**Step 3**: Check webhook logs

```bash
# Check API logs for webhook requests
vercel logs --filter="/api/webhooks/mercado-pago"

# Look for:
# - 401/403 (authentication issues)
# - 400 (payload validation issues)
# - 500 (processing errors)
```

**Step 4**: Test webhook manually

```bash
# Simulate webhook request
curl -X POST https://api.hospeda.com/api/webhooks/mercado-pago \
  -H "Content-Type: application/json" \
  -H "x-signature: YOUR_TEST_SIGNATURE" \
  -d '{
    "action": "payment.created",
    "data": { "id": "12345" }
  }'
```

**Step 5**: Verify API credentials

Check environment variables:

- `MERCADO_PAGO_ACCESS_TOKEN` (correct environment)
- `MERCADO_PAGO_WEBHOOK_SECRET`

**Prevention**:

- Monitor Mercado Pago API for deprecations
- Test payment flow in staging regularly
- Implement retry logic for failed webhooks
- Add monitoring for payment failures

### Issue 6: Email Delivery Failures

**Symptoms**:

- Confirmation emails not sent
- Users not receiving notifications
- No errors in logs

**Root Cause**: Email service issues or configuration

**Solution**:

**Step 1**: Check email service status

If using SendGrid/similar:

1. Check service status page
2. Review dashboard for delivery failures
3. Check sending rate limits

**Step 2**: Verify email configuration

Check environment variables:

```bash
EMAIL_FROM=noreply@hospeda.com
SENDGRID_API_KEY=SG.xxx
```

**Step 3**: Check logs for email sending

```bash
# Search for email-related logs
vercel logs | grep -i "email\|sendgrid"

# Look for:
# - "Email sent successfully" (good)
# - "Email failed" (bad)
# - API errors
```

**Step 4**: Test email sending

```typescript
// Test endpoint or script
import { sendEmail } from '@repo/email';

await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<p>Test</p>',
});
```

**Step 5**: Check spam filters

- Send test email to various providers (Gmail, Outlook)
- Check spam folder
- Review SPF/DKIM configuration

**Prevention**:

- Implement email sending monitoring
- Add retry logic for failed sends
- Queue emails for reliability
- Regular deliverability testing

## Rollback Decision Tree

Use this decision tree to determine if rollback is necessary:

```text
Is the issue critical? (site down, data loss, security breach)
├─ YES → ROLLBACK IMMEDIATELY
│         Follow: rollback.md
│
└─ NO → Is the issue affecting many users?
        ├─ YES → Can you hotfix in < 1 hour?
        │        ├─ YES → Hotfix and deploy
        │        └─ NO → ROLLBACK
        │                 Follow: rollback.md
        │
        └─ NO → Is the issue easy to fix?
                ├─ YES → Fix and deploy normally
                └─ NO → ROLLBACK or monitor
                         Assess based on:
                         - User impact
                         - Fix complexity
                         - Risk of waiting
```

### When to Rollback Immediately

- **Complete outage**: No users can access the system
- **Data loss risk**: Active data corruption or deletion
- **Security breach**: Active vulnerability being exploited
- **Critical feature broken**: Payment, booking, auth completely broken
- **Cannot determine cause**: Unknown issue, no clear path to fix

### When to Hotfix

- **Single feature broken**: Other features working
- **Clear root cause**: You know exactly what's wrong
- **Quick fix**: Can fix and test in < 1 hour
- **Low risk**: Fix is simple and well-understood

### When to Monitor

- **Low impact**: Few users affected
- **Non-critical**: Feature is minor or optional
- **Unclear**: Need more data to understand issue
- **Fix in progress**: Team is actively working on fix

## Post-Incident Procedures

After resolving the incident, follow these procedures:

### Step 1: Verify Resolution

**Checklist**:

- [ ] Issue is completely resolved
- [ ] All systems operational
- [ ] No related errors in logs
- [ ] Performance metrics normal
- [ ] User reports stopped

**Verification**:

```bash
# Run health checks
curl -f https://api.hospeda.com/health
curl -sI https://hospeda.com | grep "200 OK"

# Check error rates (should be < 0.1%)
# Via monitoring dashboard

# Check performance metrics
# Via Vercel Analytics, Neon Console
```

### Step 2: Communicate Resolution

**Internal**:

```text
✅ RESOLVED: [COMPONENT]

Issue: [Brief description]
Cause: [Root cause]
Fix: [What was done]
Duration: [Total time from detection to resolution]
Follow-up: [Link to post-mortem if needed]
```

**External** (if user-facing):

Update status page or send notification:

```text
✅ Issue Resolved

The issue with [component] has been resolved.
We apologize for any inconvenience.

Duration: [time]
Affected: [what was affected]

Thank you for your patience.
```

### Step 3: Create Post-Mortem

For **Critical** or **High** severity incidents:

**Post-Mortem Template**:

```markdown
# Post-Mortem: [Brief Title]

**Date**: [Date]
**Duration**: [Total time]
**Severity**: [Critical/High/Medium/Low]
**Author**: [Name]

## Summary

Brief summary of what happened.

## Timeline

- **[Time]**: Issue detected
- **[Time]**: Initial investigation started
- **[Time]**: Root cause identified
- **[Time]**: Fix deployed
- **[Time]**: Issue resolved

## Impact

- **Users Affected**: [Number or percentage]
- **Services Affected**: [Which services]
- **Duration**: [How long]
- **Revenue Impact**: [If applicable]

## Root Cause

Detailed explanation of what caused the issue.

## Resolution

What was done to resolve the issue.

## Prevention

What will be done to prevent this in the future:

- [ ] Action item 1 (assigned to: @person, due: date)
- [ ] Action item 2 (assigned to: @person, due: date)
- [ ] Action item 3 (assigned to: @person, due: date)

## Lessons Learned

What did we learn from this incident?

## Related Documents

- GitHub Issue: #XXX
- Slack thread: [link]
- Runbooks updated: [which ones]
```

**Store post-mortem in**: `docs/postmortems/YYYY-MM-DD-brief-title.md`

### Step 4: Update Documentation

**Update Runbooks**:

If this runbook was:

- Missing steps → Add them
- Incorrect → Fix them
- Unclear → Clarify them

**Commit changes**:

```bash
git add docs/runbooks/production-bugs.md
git commit -m "docs(runbooks): add resolution for [issue type]"
git push
```

**Update Related Docs**:

- Architecture docs (if design flaw found)
- API docs (if API behavior unclear)
- Deployment docs (if deployment issue)

### Step 5: Create Preventive Actions

**For each incident**, create tasks to prevent recurrence:

**Examples**:

```markdown
- [ ] Add monitoring alert for [metric]
- [ ] Add integration test for [scenario]
- [ ] Refactor [component] to handle [edge case]
- [ ] Add validation for [input]
- [ ] Improve error message for [error]
- [ ] Add documentation for [feature]
```

**Create GitHub issues** for each action item

**Assign** to appropriate team members

**Track** in project board

### Step 6: Review with Team

**Schedule** incident review meeting (within 48 hours)

**Attendees**: Everyone involved + key stakeholders

**Agenda**:

1. Walk through timeline
2. Discuss root cause
3. Review resolution
4. Discuss prevention measures
5. Assign action items

**Duration**: 30-60 minutes

**Document** decisions and action items

## Troubleshooting Tips

### When Logs Are Unhelpful

**If logs don't show error**:

1. **Increase log level** (set LOG_LEVEL=debug)
2. **Add more logging** to suspected code paths
3. **Check browser console** for client-side errors
4. **Use debugger** in local environment
5. **Reproduce with minimal test case**

### When Issue is Intermittent

**For intermittent issues**:

1. **Collect data** over time (multiple occurrences)
2. **Look for patterns**:
   - Time of day?
   - Specific users?
   - Specific data?
   - Load-related?
3. **Add detailed logging** around suspected area
4. **Monitor continuously** until pattern emerges

### When Multiple Systems Affected

**If multiple systems failing**:

1. **Check shared dependencies** first:
   - Database
   - Authentication service
   - Network/DNS
   - External APIs
2. **Look for recent infrastructure changes**
3. **Check for cascading failures** (one failure causing others)

### When You're Stuck

**If you've tried everything**:

1. **Take a break** (5-10 minutes) - fresh perspective helps
2. **Explain problem to someone** (rubber duck debugging)
3. **Review assumptions** - what are you assuming that might be wrong?
4. **Simplify** - remove complexity, test in isolation
5. **Escalate** - don't waste hours, ask for help

## Tools Reference

### Quick Commands

```bash
# === Health Checks ===
curl -f https://api.hospeda.com/health
curl -sI https://hospeda.com | grep "200 OK"
psql $DATABASE_URL -c "SELECT 1"

# === Logs ===
vercel logs [deployment-url] --since 1h
docker compose logs -f api
gh run view [run-id] --log

# === Database ===
# Connect (read-only)
psql $DATABASE_URL_REPLICA

# Check connections
docker exec hospeda_postgres psql -U hospeda_user -d hospeda_dev \
  -c "SELECT count(*) FROM pg_stat_activity"

# Slow queries
docker exec hospeda_postgres psql -U hospeda_user -d hospeda_dev \
  -c "SELECT substring(query, 1, 50), mean_exec_time, calls
      FROM pg_stat_statements
      ORDER BY mean_exec_time DESC LIMIT 10"

# === Deployments ===
vercel list --limit 10
gh api repos/:owner/hospeda/deployments --jq '.[:5]'

# === Performance ===
time curl -s https://api.hospeda.com/api/accommodations > /dev/null
```

### Environment-Specific Checks

**Local**:

```bash
# Start services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Access database
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev
```

**Production**:

```bash
# Check Vercel deployment
vercel list
vercel logs [deployment-url]

# Check GitHub Actions
gh run list --limit 10
gh run view [run-id] --log

# Check database (Neon Console)
# Use web UI: https://console.neon.tech
```

## Escalation

### When to Escalate

**Escalate immediately if**:

- Issue is Critical severity and you can't resolve in 15 minutes
- You don't have required access or permissions
- Issue is outside your area of expertise
- Multiple systems affected and cause unknown
- Data loss or security risk identified

### How to Escalate

**Step 1**: Gather information

- What is the issue? (be specific)
- What have you tried?
- What are the symptoms?
- What is the impact?

**Step 2**: Contact next level

1. **First**: Team lead (see team roster)
2. **Second**: On-call manager (see emergency contacts)
3. **Third**: CTO (critical issues only)

**Step 3**: Handoff

When handing off:

- Share all investigation notes
- Explain what's been tried
- Provide access to logs/dashboards
- Stay available for questions

**Example escalation message**:

```text
🚨 ESCALATING: [COMPONENT]

Severity: Critical
Duration: 30 minutes
Impact: All users unable to book accommodations

Investigation:
✅ Checked API health - returning 500 errors
✅ Checked database - connections normal
✅ Checked recent deployments - none in last 24h
✅ Reviewed logs - seeing "External API timeout" errors
❌ Unable to identify which external API or why timing out

Need help identifying root cause and resolution path.

Logs: [link]
Dashboard: [link]
```

## Related Documentation

- [Rollback Procedures](./rollback.md) - How to rollback deployments
- [Monitoring Setup](./monitoring.md) - Monitoring and alerting configuration
- [Backup & Recovery](./backup-recovery.md) - Database backup and recovery
- [Architecture Overview](../architecture/README.md) - System architecture
- [Performance Guide](../performance/README.md) - Performance optimization
- [Security Guide](../security/README.md) - Security best practices

## Checklist

### Pre-Investigation

- [ ] Incident acknowledged in team channel
- [ ] Severity assessed using matrix
- [ ] Service health checks completed
- [ ] Recent deployments reviewed
- [ ] Monitoring dashboards checked

### Investigation

- [ ] Initial assessment completed
- [ ] Investigation path chosen
- [ ] Detailed investigation performed
- [ ] Root cause identified
- [ ] Solution determined

### Resolution

- [ ] Fix implemented and tested
- [ ] Solution deployed to production
- [ ] Service health verified
- [ ] Performance metrics normal
- [ ] Error rates back to normal

### Post-Incident

- [ ] Resolution communicated to team
- [ ] Post-mortem created (if Critical/High)
- [ ] Runbooks updated with learnings
- [ ] Preventive actions identified
- [ ] GitHub issues created for follow-up
- [ ] Incident review scheduled

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial production bug investigation runbook | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
