# Deployment Rollback Runbook

## Overview

This runbook covers rolling back a deployment when something breaks in
production. All three apps (api, web, admin) run as Coolify-managed Docker
containers on the VPS, so **they all roll back the same way** — there is no
separate frontend and backend procedure. Database migration rollback is a
different problem and has its own section below.

For a wider incident (VPS down, Postgres corrupt, Coolify itself broken) this is
the wrong document — go to
[`docs/migration/disaster-recovery.md`](../migration/disaster-recovery.md).

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

- [ ] SSH to the VPS (`ssh -p 2222 qazuor@216.238.103.219`)
- [ ] Coolify dashboard (<https://coolify.hospeda.com.ar>)
- [ ] GitHub repository write access
- [ ] Team communication channels

### Required Tools

- [ ] `hops` on the VPS — see [`scripts/server-tools/README.md`](../../scripts/server-tools/README.md)
- [ ] Browser, for the Coolify dashboard
- [ ] Git configured with repository access

Database access does not need its own credentials or a VPN: `hops psql` reaches
Postgres from inside the VPS.

### Knowledge Requirements

- Understanding of deployment architecture
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

## Rolling Back an App

The same procedure for `api`, `web` and `admin`. Estimated 2-5 minutes.

### Step 1: Confirm it is a deploy, not something else

A rollback only helps if a deploy caused the problem. Check that the failure
started when the deploy landed:

```bash
hops health prod                 # which apps are actually down
hops logs api -n 200             # or web / admin
```

Read the **FIRST** error trace, not the last. The last is usually a downstream
effect of the first.

If the cause is a missing or wrong env var rather than code, rolling back the
image will not fix it — go to [Forward Fix](#forward-fix-when-rollback-not-possible)
and use `hops env-set <kind> KEY VALUE` followed by `hops redeploy <kind>`.

### Step 2: Pick the target deploy

Open <https://coolify.hospeda.com.ar> → the app's resource → **Deployments**.
The list is chronological with the commit each one built. Pick the most recent
one that was green **before** the incident started.

There are no deployment URLs to compare: every deploy serves the same domain.
The commit SHA is what identifies a build.

### Step 3: Redeploy it

Press **Redeploy** on that entry. Coolify rebuilds and swaps the container.

If the app is merely wedged rather than running bad code — stuck process,
exhausted connection pool — a restart is cheaper than a rebuild and keeps the
current image:

```bash
hops --target=prod app-restart api
```

Use a full redeploy when you need a different commit:

```bash
hops --target=prod redeploy api
```

`--target=` is mandatory on writes and goes BEFORE the subcommand.

### Step 4: Watch the first 60 seconds

```bash
hops --target=prod logs api -f
```

If it crashes again with the same error, the diagnosis in Step 1 was wrong — the
deploy was not the cause. Stop rolling back and go back to reading logs.

### Step 5: Verify

```bash
hops health prod                 # all three apps green
hops free-mem                    # restart count stopped incrementing
```

Then, from outside the VPS:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://api.hospeda.com.ar/health/live
curl -sS -o /dev/null -w '%{http_code}\n' https://hospeda.com.ar/es/
```

Confirm in Sentry that no new error spike is coming from the app, and give it 10
minutes before declaring the incident over.

### When the previous deploy is not in the list

Coolify keeps a bounded history. If the last good build has aged out but you
know its SHA from `git log`, push that SHA and redeploy:

```bash
git push origin <sha>:main --force
hops --target=prod redeploy api
```

This rewrites the production branch — do it only during an incident, and tell
the team, because everyone else's `main` diverges the moment you do.

### Rollback Checklist

- [ ] Confirmed the failure correlates with a deploy, not a config change
- [ ] Identified the target commit in Coolify → Deployments
- [ ] Redeployed it (or restarted, if the image was fine)
- [ ] Watched the first 60 seconds of logs
- [ ] `hops health prod` green
- [ ] Public endpoints answering 200 from outside the VPS
- [ ] Sentry quiet for 10 minutes
- [ ] Team updated

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

### Scenario 1: Bad Web Deployment

**Issue**: JavaScript error breaking the site

**Rollback**:

1. Coolify → `hospeda-web-prod` → Deployments
2. Find the last green deploy from before the incident
3. Redeploy it
4. `hops health prod`, then load the site

**Time**: ~5 minutes

### Scenario 2: API Performance Regression

**Issue**: API response times 10x slower after deployment

**Rollback**:

1. Identify the commit before the regression in Coolify → Deployments
2. Check database compatibility — a rolled-back API against a migrated
   database is its own outage
3. Redeploy that commit
4. Watch `hops logs api -f` and confirm response times recover

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
- [Deployment Guide](../deployment/README.md) - Normal deployment procedures
- [Architecture Overview](../architecture/README.md) - Understanding system components

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial rollback runbook creation | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
