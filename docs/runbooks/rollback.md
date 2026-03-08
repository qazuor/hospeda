# Deployment Rollback Runbook

## Overview

This runbook provides procedures for safely rolling back deployments when issues are detected in production. It covers frontend (Vercel), backend (Vercel serverless), and database migration rollbacks.

**When to Use**:

- Critical bugs detected after deployment
- Performance degradation after release
- Data corruption risk
- Security vulnerabilities introduced
- Feature breaking core functionality

**Expected Outcomes**:

- System restored to last known good state
- Service stability recovered
- Users can access core functionality
- Incident documented for analysis

**Time Estimate**:

- Frontend rollback: 2-5 minutes
- Backend rollback: 5-15 minutes
- Database migration rollback: 10-30 minutes (if possible)
- Full system rollback: 15-45 minutes

## Prerequisites

### Required Access

- [ ] Vercel Admin access (frontend rollback)
- [ ] Vercel Admin access (backend rollback via Vercel dashboard)
- [ ] GitHub repository write access
- [ ] Production database access (for migration rollback)
- [ ] Team communication channels

### Required Tools

- [ ] Browser (for Vercel Dashboard)
- [ ] Terminal with CLI tools (vercel, gh, psql)
- [ ] Git configured with repository access
- [ ] VPN/secure connection (for database access)

### Knowledge Requirements

- Understanding of deployment architecture
- Familiarity with Vercel dashboard
- Basic Git operations
- Database migration concepts
- Understanding of service dependencies

## Rollback Decision Criteria

Use this criteria to determine if rollback is the right action:

### When to Rollback Immediately

**Critical Issues** (rollback within 5 minutes):

- **Complete outage**: Site or API completely down
- **Data loss**: Active data deletion or corruption
- **Security breach**: Vulnerability being actively exploited
- **Critical feature broken**: Payment, booking, or auth completely non-functional
- **Database corruption**: Data integrity compromised

### When to Rollback Soon

**High Priority Issues** (rollback within 30 minutes):

- **Major feature broken**: Important feature unavailable but system functional
- **Severe performance degradation**: Response times > 3x normal
- **Error rate spike**: Error rate > 5%
- **Memory/resource leak**: System resources exhausting

### When to Hotfix Instead

**Consider hotfix if**:

- Issue is **isolated** to single feature
- Root cause is **known and simple**
- Fix can be **implemented and tested in < 1 hour**
- Fix is **low risk** (simple, well-understood)
- Rollback would cause **more disruption** than fix

### When to Monitor

**Consider monitoring if**:

- Issue is **low impact** (< 1% of users affected)
- Issue is **non-critical** (cosmetic, minor feature)
- Cause is **unclear** and rollback won't help
- Already have **fix in progress**

## Rollback Decision Tree

```text
Is the issue critical? (outage, data loss, security)
├─ YES → ROLLBACK IMMEDIATELY
│         ↓
│         Follow appropriate procedure:
│         - Frontend: Section "Frontend Rollback"
│         - Backend: Section "Backend Rollback"
│         - Database: Section "Database Rollback"
│
└─ NO → Is the issue high priority? (major feature broken, severe degradation)
        ├─ YES → Can you hotfix in < 1 hour?
        │        ├─ YES → Implement hotfix
        │        │         - Create fix
        │        │         - Test thoroughly
        │        │         - Deploy via normal process
        │        │         - Monitor closely
        │        │
        │        └─ NO → ROLLBACK within 30 minutes
        │                 Follow appropriate procedure
        │
        └─ NO → Is the issue low impact?
                ├─ YES → MONITOR and fix normally
                │         - Document issue
                │         - Plan fix
                │         - Deploy in next cycle
                │
                └─ NO → Assess specific situation
                         Consider:
                         - User impact
                         - Business impact
                         - Fix complexity
                         - Rollback risk
```

## Pre-Rollback Checklist

Complete before rolling back:

- [ ] **Communicate**: Post in team channel with severity and plan
- [ ] **Verify**: Confirm the issue and that rollback will help
- [ ] **Identify**: Determine last known good deployment
- [ ] **Check**: Verify database compatibility (for backend/migration rollbacks)
- [ ] **Document**: Note current state for post-incident analysis
- [ ] **Notify**: Alert stakeholders if user-facing

**Communication Template**:

```text
🚨 INITIATING ROLLBACK: [COMPONENT]

Issue: [Brief description]
Severity: [Critical/High]
Impact: [User-facing impact]
Action: Rolling back to [version/deployment]
ETA: [estimated time]
Assigned: @[username]
```

## Frontend Rollback (Vercel)

Rollback frontend applications (web, admin) deployed on Vercel.

### Step 1: Access Vercel Dashboard

1. Navigate to <https://vercel.com/[team>]
2. Select project (e.g., `hospeda-web` or `hospeda-admin`)
3. Go to **Deployments** tab

**Expected**: List of recent deployments with timestamps

### Step 2: Identify Rollback Target

**Find last known good deployment**:

1. Look for deployments **before** the problematic one
2. Verify deployment was successful (green checkmark)
3. Check timestamp (when was it deployed?)
4. Note deployment URL (e.g., `hospeda-web-abc123.vercel.app`)

**Verification questions**:

- Was this deployment working correctly?
- Did it pass all checks?
- What features were different from current?

**Example**:

```text
Current (broken): hospeda-web-xyz789.vercel.app [2024-11-06 14:30]
Target (working): hospeda-web-abc123.vercel.app [2024-11-06 12:00]
```

### Step 3: Test Rollback Target

**Before promoting**, test the deployment:

1. Click on target deployment
2. Click "Visit" to open deployment URL
3. Test critical functionality:
   - Home page loads
   - Search works
   - Accommodation pages load
   - Booking flow works (if applicable)
4. Check browser console for errors

**If target deployment has issues**:

- Try previous deployment
- Identify last truly working version
- May need to go back further

### Step 4: Promote to Production

**Via Vercel Dashboard**:

1. On target deployment page, click **"⋯"** (three dots)
2. Select **"Promote to Production"**
3. Confirm promotion

**Via Vercel CLI** (alternative):

```bash
# List deployments
vercel list

# Rollback to specific deployment
vercel rollback [deployment-url]

# Or rollback to previous deployment
vercel rollback
```

**Expected**: Deployment promoted, traffic routing to rollback version

### Step 5: Verify Rollback

**Immediately after promotion** (< 2 minutes):

```bash
# Check production URL
curl -sI https://hospeda.com | grep "HTTP"
# Expected: HTTP/2 200

# Check for errors
curl https://hospeda.com 2>&1 | grep -i error
# Expected: No errors (or minimal expected errors)
```

**In browser**:

1. Navigate to production URL (<https://hospeda.com> or <https://admin.hospeda.com>)
2. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R) to bypass cache
3. Verify critical functionality works
4. Check browser console for errors

**Expected**:

- Site loads correctly
- Critical features functional
- No major JavaScript errors
- Acceptable performance

### Step 6: Monitor for 15 Minutes

**Watch for**:

- Error rate (should drop to < 0.1%)
- Response times (should normalize)
- User reports (should stop)
- Vercel analytics (traffic should be healthy)

**Monitoring checklist**:

- [ ] Error rate normalized
- [ ] Response times acceptable
- [ ] No new user reports
- [ ] Analytics show healthy traffic
- [ ] No alerts triggered

**If issues persist**:

- Verify correct deployment promoted
- Check if issue is frontend-related
- Consider backend or database issue
- May need additional rollback

### Step 7: Update Team

```text
✅ FRONTEND ROLLBACK COMPLETE: [PROJECT]

Rolled back from: [broken-deployment]
Rolled back to: [working-deployment]
Status: Monitoring
Verification: Site functional, errors dropped
Next steps: [post-rollback tasks]
```

### Frontend Rollback Checklist

- [ ] Accessed Vercel Dashboard
- [ ] Identified last known good deployment
- [ ] Tested rollback target deployment
- [ ] Promoted deployment to production
- [ ] Verified site functionality
- [ ] Monitored for 15 minutes
- [ ] Confirmed error rate normalized
- [ ] Updated team on completion

## Backend Rollback (Vercel)

Rollback backend API deployed on Vercel serverless.

### Step 1: Identify Current Deployment

```bash
# List recent deployments for the API project
vercel ls hospeda-api

# Or view in the Vercel dashboard
# https://vercel.com/dashboard > hospeda-api > Deployments
```

**Expected output**:

```text
Age    Deployment                                    Status
2m     https://hospeda-api-abc123.vercel.app         READY (broken)
2h     https://hospeda-api-xyz789.vercel.app         READY  <- Target
1d     https://hospeda-api-def456.vercel.app         READY
```

### Step 2: Verify Database Compatibility

**Critical**: Before rolling back backend, verify database compatibility.

**Questions to answer**:

1. Did the broken deployment include database migrations?
2. Are migrations reversible?
3. Will rolled-back code work with current database schema?

**Check recent migrations**:

```bash
# In repository
git log --oneline --since="2.days.ago" packages/db/migrations/

# Check for migration files
ls -lt packages/db/migrations/ | head -5
```

**If migrations were applied**:

- See [Database Migration Rollback](#database-migration-rollback)
- May need to rollback database first
- Or migrations may need to stay (if additive)

**Decision matrix**:

| Migration Type | Backend Rollback Safe? | Action |
|---------------|----------------------|---------|
| Added column | Yes (if nullable) | Rollback backend, keep migration |
| Added table | Yes (if not used by old code) | Rollback backend, keep migration |
| Modified column | Maybe | Check if old code compatible |
| Dropped column | No | Must rollback migration first |
| Dropped table | No | Must rollback migration first |

### Step 3: Promote Previous Deployment

**Via Vercel Dashboard**:

1. Open the Vercel dashboard for `hospeda-api`
2. Go to the **Deployments** tab
3. Find the last known-good deployment
4. Click `...` > **Promote to Production**

**Via Vercel CLI**:

```bash
# Promote a specific deployment URL to production
vercel promote https://hospeda-api-xyz789.vercel.app --scope <team>
```

**Expected**: Production traffic switches to the promoted deployment instantly.

### Step 4: Verify Deployment

```bash
# Check API health
curl https://api.hospeda.com.ar/health

# View function logs
vercel logs --prod
```

**Look for**:

- Successful health check response
- No error spikes in Sentry
- Expected response times in Vercel Analytics

**Expected health response**:

```text
[info] Starting application...
[info] Database connected
[info] Server listening on port 3001
[info] Health check passed
```

### Step 5: Verify API Functionality

**Health check**:

```bash
# Check API health endpoint
curl -f https://api.hospeda.com/health

# Expected: {"status":"ok","version":"..."}
```

**Test critical endpoints**:

```bash
# Test public endpoint
curl https://api.hospeda.com/api/accommodations | jq '.success'
# Expected: true

# Test authenticated endpoint (with valid token)
curl https://api.hospeda.com/api/bookings \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.success'
# Expected: true
```

**Check error rates**:

```bash
# Via Vercel logs
vercel logs --prod | grep -E '"status":(4|5)[0-9]{2}' | wc -l
# Expected: < 5 (< 5% error rate)
```

### Step 6: Verify Database Connection

```bash
# Check database connectivity
psql $HOSPEDA_DATABASE_URL -c "SELECT count(*) FROM accommodations"

# Check for connection errors in Vercel logs
vercel logs --prod | grep -i "database\|connection" | tail -20
```

**Expected**:

- Database queries successful
- No connection pool exhaustion
- No timeout errors

### Step 7: Monitor Performance

**Watch for** (15 minutes):

- Response times (should be < 200ms p95)
- Error rate (should be < 0.1%)
- Database query times (should be < 50ms p95)
- Memory usage (should be stable)

**Monitoring locations**:

- Vercel dashboard → Functions tab (duration, errors)
- Neon Console → Monitoring
- Sentry → Issues and Performance

### Step 8: Update Team

```text
✅ BACKEND ROLLBACK COMPLETE: API

Rolled back from: v12 (commit 2a3b4c5)
Rolled back to: v11 (commit 1a2b3c4)
Database: No migration changes / Migrations compatible
Status: Monitoring
Verification: API functional, errors dropped, performance normal
Next steps: [post-rollback tasks]
```

### Backend Rollback Checklist

- [ ] Identified current and target versions
- [ ] Verified database compatibility
- [ ] Deployed previous version
- [ ] Monitored deployment progress
- [ ] Verified API health endpoint
- [ ] Tested critical endpoints
- [ ] Verified database connection
- [ ] Monitored performance for 15 minutes
- [ ] Confirmed error rate normalized
- [ ] Updated team on completion

## Database Migration Rollback

**⚠️  WARNING**: Database rollback is risky and not always possible.

### Understanding Migration Reversibility

**Safe to Rollback** (non-destructive):

- **Added columns** (nullable or with defaults)
- **Added tables** (not yet used)
- **Added indexes**
- **Added constraints** (that don't affect existing data)

**Unsafe to Rollback** (destructive):

- **Dropped columns** (data lost)
- **Dropped tables** (data lost)
- **Modified column types** (data may be incompatible)
- **Data transformations** (may not be reversible)

**Rule of Thumb**: If data was deleted or transformed, rollback may not be possible.

### Step 1: Assess Migration Impact

**Review migration file**:

```bash
# Find recent migrations
ls -lt packages/db/migrations/ | head -5

# Review migration content
cat packages/db/migrations/0XXX_recent_migration.sql
```

**Determine migration type**:

```sql
-- ✅ SAFE: Added column
ALTER TABLE accommodations ADD COLUMN featured BOOLEAN DEFAULT false;

-- ✅ SAFE: Added index
CREATE INDEX idx_accommodations_city ON accommodations(city);

-- ✅ SAFE: Added table
CREATE TABLE reviews (...);

-- ⚠️  MAYBE: Modified column (check data compatibility)
ALTER TABLE accommodations ALTER COLUMN price TYPE DECIMAL(10,2);

-- ❌ UNSAFE: Dropped column
ALTER TABLE accommodations DROP COLUMN old_field;

-- ❌ UNSAFE: Data transformation
UPDATE accommodations SET status = 'active' WHERE status IS NULL;
```

### Step 2: Decision - Rollback or Forward Fix

**If migration is SAFE (non-destructive)**:

- Can rollback migration
- Follow steps below

**If migration is UNSAFE (destructive)**:

- **Cannot rollback** - data lost
- Must create **forward fix** migration
- Example: Re-add dropped column with default values

**If migration is MAYBE (data transformation)**:

- Assess if transformation is reversible
- Check if data can be restored from backup
- Consider forward fix if rollback risky

### Step 3: Create Rollback Migration (Safe Migrations Only)

**For safe migrations**, create reverse migration:

```bash
# Create new migration file
cd packages/db
npm run migration:create rollback_feature_name
```

**Write reverse migration**:

```sql
-- Example: Rollback added column
-- Original: ALTER TABLE accommodations ADD COLUMN featured BOOLEAN;
-- Rollback:
ALTER TABLE accommodations DROP COLUMN featured;

-- Example: Rollback added index
-- Original: CREATE INDEX idx_accommodations_city ON accommodations(city);
-- Rollback:
DROP INDEX idx_accommodations_city;

-- Example: Rollback added table
-- Original: CREATE TABLE reviews (...);
-- Rollback:
DROP TABLE reviews;
```

### Step 4: Test Rollback Migration Locally

**Critical**: Always test migration rollback locally first.

```bash
# Backup local database
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev > backup_local.sql

# Run rollback migration
cd packages/db
pnpm db:migrate

# Verify schema
pnpm db:studio
# Check that changes are reverted

# Test application
cd ../../
pnpm dev
# Verify app still works
```

**If rollback fails locally**:

- Do NOT apply to production
- Fix rollback migration
- Re-test until successful

### Step 5: Backup Production Database

**Before rolling back production**, create backup:

**Via Neon Console**:

1. Go to <https://console.neon.tech>
2. Select project
3. Go to **Backups** tab
4. Click **"Create Backup"**
5. Add description: "Before migration rollback - [date]"
6. Wait for backup completion

**Verify backup created**:

- Check backup appears in list
- Note backup timestamp
- Confirm backup size reasonable

### Step 6: Apply Rollback Migration to Production

**Via CI/CD** (recommended):

```bash
# Commit rollback migration
git add packages/db/migrations/0XXX_rollback_feature.sql
git commit -m "chore(db): rollback migration - [reason]"
git push

# Trigger deployment
# Migration runs automatically via GitHub Actions
```

**Via manual execution** (if urgent):

```bash
# Connect to production database (with appropriate credentials)
psql $HOSPEDA_DATABASE_URL

# Run migration manually
\i packages/db/migrations/0XXX_rollback_feature.sql

# Verify
\d accommodations  -- Check table schema
```

**Monitor migration execution**:

```bash
# Watch logs
# Via GitHub Actions (if automated)
gh run view [run-id] --log

# Or monitor database (if manual)
psql $HOSPEDA_DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active'"
```

### Step 7: Verify Database State

**After migration rollback**:

```sql
-- Verify schema changes reverted
\d accommodations

-- Check data integrity
SELECT count(*) FROM accommodations;
-- Should match expected count

-- Test queries
SELECT * FROM accommodations LIMIT 5;
-- Should return data correctly
```

**In application**:

```bash
# Test API endpoint
curl https://api.hospeda.com/api/accommodations | jq '.success'
# Expected: true

# Check for database errors in logs
fly logs --app hospeda-api | grep -i "database\|query" | tail -20
```

### Step 8: Update Application Code

**If migration rollback requires code changes**:

1. Identify code that depends on reverted schema
2. Create hotfix to remove/update that code
3. Test thoroughly locally
4. Deploy hotfix
5. Monitor for errors

**Example**:

```typescript
// If rolled back column "featured", remove code using it

// Before (broken after rollback)
const featured = await db.select()
  .from(accommodations)
  .where(eq(accommodations.featured, true));

// After (fixed)
// Remove or replace logic
```

### Database Rollback Checklist

- [ ] Assessed migration impact (safe/unsafe)
- [ ] Determined rollback is possible
- [ ] Created rollback migration
- [ ] Tested rollback locally
- [ ] Backed up production database
- [ ] Applied rollback migration to production
- [ ] Verified database state
- [ ] Updated application code if needed
- [ ] Monitored for errors
- [ ] Documented rollback in changelog

## Forward Fix (When Rollback Not Possible)

If rollback is not possible (destructive migration, data loss), create forward fix.

### Step 1: Assess Damage

**Determine**:

- What data was lost/changed?
- Can data be restored from backup?
- What functionality is broken?
- What's the minimum fix needed?

### Step 2: Restore Data (If Possible)

**From backup**:

```bash
# List available backups (Neon Console)
# Select backup before destructive migration

# Restore to new branch (Neon)
# 1. Go to Neon Console
# 2. Create new branch from backup
# 3. Test data in branch
# 4. Export missing data
```

**Export missing data from backup**:

```sql
-- In backup branch
COPY (SELECT * FROM accommodations WHERE column_name IS NOT NULL)
TO '/tmp/missing_data.csv' CSV HEADER;
```

### Step 3: Create Forward Fix Migration

**Example scenarios**:

Scenario 1 - Dropped column (data lost):

```sql
-- Cannot restore data, add column with defaults
ALTER TABLE accommodations ADD COLUMN dropped_field TEXT DEFAULT 'unknown';

-- Optionally: Restore from backup
-- UPDATE accommodations SET dropped_field = backup.value FROM backup_table ...
```

Scenario 2 - Invalid data transformation:

```sql
-- Reverse transformation if possible
UPDATE accommodations
SET status = CASE
  WHEN status = 'active' THEN 'published'
  WHEN status = 'inactive' THEN 'draft'
  ELSE status
END;
```

### Step 4: Deploy Forward Fix

```bash
# Commit fix migration
git add packages/db/migrations/0XXX_fix_migration.sql
git commit -m "fix(db): forward fix for [issue]"
git push

# Monitor deployment
gh run view --log
```

### Step 5: Verify Fix

- Test application functionality
- Verify data integrity
- Check for missing data
- Monitor error rates

## Post-Rollback Procedures

After any rollback, complete these procedures:

### Step 1: Verify Full System Functionality

**Run comprehensive checks**:

- [ ] Frontend loading correctly
- [ ] API responding normally
- [ ] Database queries working
- [ ] Authentication functioning
- [ ] Critical features operational (search, booking, payment)
- [ ] Error rates < 0.1%
- [ ] Performance metrics normal

**Test user flows**:

1. User can browse accommodations
2. User can search accommodations
3. User can view accommodation details
4. User can log in
5. User can create booking (test mode)

### Step 2: Monitor Extended Period

**Monitor for 1-2 hours**:

- Error rates
- Response times
- Database performance
- User reports
- Analytics

**Set up alerts** (if not already):

- Error rate > 1%
- Response time > 500ms (p95)
- Database connections > 80%

### Step 3: Communicate Resolution

**Internal**:

```text
✅ ROLLBACK COMPLETE: [SYSTEM]

Components rolled back:
- Frontend: [version]
- Backend: [version]
- Database: [migration status]

Status: Stable and monitoring
Metrics:
- Error rate: < 0.1%
- Response time: [p95 time]
- Uptime: [time since rollback]

Next steps:
- Continue monitoring for 2 hours
- Post-mortem scheduled for [date/time]
- Fix implementation planned
```

**External** (if user-facing impact):

```text
✅ Service Restored

We've resolved the issue with [feature/service].
The service is now stable and functioning normally.

We apologize for any inconvenience.

Duration: [total downtime]
Impact: [what was affected]

Thank you for your patience.
```

### Step 4: Create Post-Incident Issue

**Create GitHub issue**:

```markdown
# Post-Incident: [Brief Title]

**Date**: 2024-11-06
**Duration**: [time from issue detection to resolution]
**Severity**: [Critical/High/Medium/Low]

## Summary

Brief summary of what happened and why rollback was necessary.

## What Was Rolled Back

- Frontend: [deployment ID/version]
- Backend: [version/commit]
- Database: [migrations rolled back or forward fix applied]

## Root Cause

Explain what caused the issue that necessitated rollback.

## Why Rollback Was Chosen

Why rollback instead of hotfix or forward fix?

## Lessons Learned

What could prevent this in the future?

## Action Items

- [ ] Fix underlying issue (assigned to: @person, due: date)
- [ ] Add test coverage for scenario (assigned to: @person, due: date)
- [ ] Update deployment checklist (assigned to: @person, due: date)
- [ ] Improve monitoring/alerts (assigned to: @person, due: date)

## Related

- Runbooks updated: [which ones]
- Documentation updated: [which docs]
```

### Step 5: Update Runbooks and Documentation

**If rollback procedure had issues**:

- Update this runbook with corrections
- Add missing steps
- Clarify unclear sections
- Add new scenarios

**Commit changes**:

```bash
git add docs/runbooks/rollback.md
git commit -m "docs(runbooks): update rollback procedure with learnings from [date]"
git push
```

### Step 6: Plan Fix Implementation

**Create fix plan**:

1. **Identify root cause** (from post-incident analysis)
2. **Design fix** (architecture, code changes)
3. **Create implementation plan** (tasks, timeline)
4. **Add testing requirements** (unit, integration, E2E)
5. **Plan deployment strategy** (gradual rollout, feature flags)

**Schedule fix work**:

- Create GitHub issues for fix tasks
- Assign to appropriate developers
- Set realistic deadlines
- Add to sprint/project board

### Step 7: Prevent Future Occurrences

**Preventive measures**:

**Testing**:

- [ ] Add test coverage for scenario that caused rollback
- [ ] Enhance integration tests
- [ ] Add E2E test for critical flows
- [ ] Improve staging environment parity with production

**Monitoring**:

- [ ] Add alerts for early detection
- [ ] Enhance logging for better debugging
- [ ] Improve dashboards
- [ ] Set up canary deployments

**Process**:

- [ ] Update deployment checklist
- [ ] Enhance code review guidelines
- [ ] Improve staging testing procedures
- [ ] Add rollback rehearsals to schedule

## Rollback Time Estimates

| Component | Preparation | Execution | Verification | Total |
|-----------|------------|-----------|--------------|-------|
| **Frontend only** | 2 min | 2 min | 5 min | **~10 min** |
| **Backend only** | 5 min | 5 min | 10 min | **~20 min** |
| **Database migration (safe)** | 10 min | 5 min | 15 min | **~30 min** |
| **Full system** | 10 min | 10 min | 20 min | **~40 min** |

**Note**: Times assume:

- Operator familiar with procedures
- No complications or unexpected issues
- Clear rollback target identified
- Database compatibility verified

## Common Rollback Scenarios

### Scenario 1: Bad Frontend Deployment

**Issue**: JavaScript error breaking site

**Rollback**:

1. Vercel Dashboard → Select project
2. Find last working deployment (< 2 hours ago)
3. Promote to production
4. Verify site loads

**Time**: ~5 minutes

### Scenario 2: API Performance Regression

**Issue**: API response times 10x slower after deployment

**Rollback**:

1. Identify backend version before regression
2. Check database compatibility
3. Rollback backend via Vercel dashboard (promote previous deployment)
4. Monitor performance recovery

**Time**: ~15 minutes

### Scenario 3: Breaking Database Migration

**Issue**: Migration broke API, can't query table

**Rollback**:

1. Assess if migration is reversible
2. If yes: Create rollback migration
3. Test locally first
4. Apply to production
5. Verify API recovery

**Time**: ~30 minutes (if reversible)

### Scenario 4: Multiple Components Failed

**Issue**: Frontend + Backend both broken after deployment

**Rollback**:

1. Identify last working versions of both
2. Rollback frontend first (fastest)
3. Rollback backend second
4. Verify database compatibility
5. Test full user flow

**Time**: ~30-40 minutes

## Troubleshooting Rollback Issues

### Rollback Doesn't Fix Issue

**If issue persists after rollback**:

1. **Verify correct version deployed**

   ```bash
   # Check current version
   curl https://api.hospeda.com/health | jq '.version'
   ```

1. **Check if issue is elsewhere**
   - External service down? (Better Auth, Mercado Pago)
   - Database issue unrelated to deployment?
   - Network/DNS issue?

1. **Review rollback target**
   - Was rollback target actually working?
   - Go back further in version history

1. **Check for data issues**
   - Data state may be incompatible
   - May need data fix in addition to code rollback

### Database Compatibility Issues

**If backend rollback causes database errors**:

1. **Identify incompatibility**

   ```bash
   # Check error logs
   fly logs --app hospeda-api | grep -i "database\|query"
   ```

1. **Options**:
   - Rollback database migration too
   - Roll forward backend
   - Create compatibility shim (temporary)

1. **Temporary fix**:
   - Add try/catch for missing fields
   - Use feature flags to disable new features
   - Deploy hotfix

### Cannot Find Last Known Good Version

**If unsure which version to rollback to**:

1. **Check deployment history**

   ```bash
   gh api repos/:owner/hospeda/deployments --jq '.[:20]'
   ```

1. **Check git history**

   ```bash
   git log --oneline --since="1.week.ago"
   ```

1. **Ask team**
   - When was last known good state?
   - What changed recently?

1. **Test multiple versions**
   - Deploy to staging
   - Test each candidate
   - Promote working version

## Related Documentation

- [Production Bug Investigation](./production-bugs.md) - Diagnosing issues before rollback
- [Backup & Recovery](./backup-recovery.md) - Database backup and recovery
- [Monitoring](./monitoring.md) - Setting up alerts and monitoring
- [Deployment Guide](../development/deployment.md) - Normal deployment procedures
- [Architecture Overview](../architecture/README.md) - Understanding system components

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial rollback runbook creation | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
