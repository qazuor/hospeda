# Database Backup & Recovery Runbook

## Overview

This runbook provides comprehensive procedures for backing up and recovering the Hospeda database. It covers automated and manual backups on Neon (production) and Docker PostgreSQL (local development), as well as recovery procedures for various scenarios.

**When to Use**:

- **Backup**: Before major migrations, before risky operations, regular scheduled backups
- **Recovery**: Data loss, data corruption, accidental deletion, disaster recovery

**Expected Outcomes**:

- Database backed up securely
- Data recoverable to specific point in time
- Business continuity maintained
- Data integrity preserved

**Time Estimate**:

- Manual backup: 2-5 minutes
- Point-in-time recovery: 15-30 minutes
- Full disaster recovery: 30-60 minutes
- Backup verification: 10-15 minutes

## Prerequisites

### Required Access

- [ ] Neon Console access (production backups)
- [ ] PostgreSQL admin access (local backups)
- [ ] Docker access (local environment)
- [ ] Cloud storage access (backup storage if applicable)
- [ ] Team communication channels

### Required Tools

- [ ] Browser (for Neon Console)
- [ ] Terminal with psql client
- [ ] Docker CLI
- [ ] Sufficient disk space for backups
- [ ] Secure backup storage location

### Knowledge Requirements

- Understanding of database schema
- Familiarity with PostgreSQL
- Understanding of backup types (full, incremental, point-in-time)
- Recovery procedures and risks
- Data validation techniques

## Backup Strategy Overview

### Backup Types

| Type | Frequency | Retention | Purpose |
|------|-----------|-----------|---------|
| **Automated (Neon)** | Daily | 30 days | Continuous protection |
| **Manual (Pre-migration)** | As needed | 90 days | Before risky operations |
| **Point-in-time** | Continuous (WAL) | 30 days | Granular recovery |
| **Local Dev** | Weekly | 4 weeks | Development safety net |

### Backup Locations

**Production (Neon)**:

- **Primary**: Neon automated backups (daily)
- **Storage**: Neon-managed cloud storage
- **Access**: Via Neon Console
- **Retention**: 30 days (configurable)

**Local Development (Docker)**:

- **Primary**: Manual pg_dump backups
- **Storage**: Local filesystem or mounted volume
- **Access**: Docker exec commands
- **Retention**: 4 weeks (manual cleanup)

### Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 1 hour | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |
| **Backup Success Rate** | 99.9% | Percentage of successful backups |
| **Recovery Success Rate** | 100% | Verified recovery capability |

## Production Backups (Neon)

### Automated Backups

Neon provides automated daily backups with no configuration required.

**Verification**:

1. Go to <https://console.neon.tech>
2. Select Hospeda project
3. Navigate to **Backups** tab
4. Verify recent backups listed

**Expected**:

- Daily backup within last 24 hours
- Backup size reasonable (increases over time)
- Status: "Completed"

**If backups missing**:

- Check Neon service status
- Contact Neon support
- Verify project not suspended

### Manual Backup (Pre-Migration)

**When to create manual backup**:

- Before database migrations
- Before major data transformations
- Before risky operations (bulk updates, deletions)
- Before schema changes

**Procedure**:

**Step 1**: Access Neon Console

1. Navigate to <https://console.neon.tech>
2. Select Hospeda project
3. Go to **Backups** tab

**Step 2**: Create Backup

1. Click **"Create Backup"** button
2. Add descriptive name:

   ```text
   Pre-migration: [Migration Name]
   Date: 2024-11-06
   Reason: [Brief reason]
   ```

3. Click **"Create"**

**Step 3**: Verify Backup

1. Wait for backup to complete (usually < 2 minutes)
2. Verify backup appears in list
3. Note backup timestamp
4. Note backup size

**Expected output**:

```text
Backup Name: Pre-migration: Add featured column
Created: 2024-11-06 14:30:00 UTC
Size: 150 MB
Status: Completed
```

**Step 4**: Document Backup

Record in team channel or issue:

```text
✅ Database backup created

Name: Pre-migration: [Migration Name]
Time: [Timestamp]
Size: [Size]
Backup ID: [ID from Neon Console]
Reason: [Why backup created]
```

### Point-in-Time Recovery (PITR)

Neon supports point-in-time recovery using Write-Ahead Logs (WAL).

**Available Recovery Window**: Last 30 days (Neon default)

**When to use**:

- Recover to specific moment before issue
- More precise than daily backup
- Useful for recent data corruption

**Procedure** (see Point-in-Time Recovery section)

### Backup Verification

**Monthly verification** (required):

**Step 1**: Select random backup

Choose backup from last 30 days:

```text
Selected: Backup from 2024-10-15 03:00:00 UTC
```

**Step 2**: Create test branch from backup

In Neon Console:

1. Go to **Branches** tab
2. Click **"Create Branch"**
3. Select **"From backup"**
4. Choose backup to test
5. Name branch: `test-backup-verification-[date]`
6. Click **"Create"**

**Step 3**: Connect to test branch

```bash
# Get connection string from Neon Console
# Branch → Connection String

psql "postgresql://user:pass@test-branch.neon.tech/dbname"
```

**Step 4**: Verify data integrity

```sql
-- Check row counts
SELECT
  'accommodations' as table_name,
  count(*) as row_count
FROM accommodations
UNION ALL
SELECT 'bookings', count(*) FROM bookings
UNION ALL
SELECT 'users', count(*) FROM users;

-- Verify critical data
SELECT * FROM accommodations ORDER BY created_at DESC LIMIT 5;
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5;

-- Check for corruption
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Expected**:

- Row counts match expected ranges
- Data looks correct
- No corruption indicators
- Tables accessible

**Step 5**: Document verification

```text
✅ Backup verification successful

Date: 2024-11-06
Backup tested: 2024-10-15 03:00:00 UTC
Tables verified: accommodations, bookings, users
Row counts: [counts]
Data integrity: ✅ Passed
Corruption checks: ✅ Passed
```

**Step 6**: Delete test branch

1. Go to Neon Console → Branches
2. Select test branch
3. Click **"Delete"**
4. Confirm deletion

## Local Development Backups (Docker PostgreSQL)

### Manual Backup

**When to backup locally**:

- Before major schema changes in development
- Before testing risky migrations
- Before bulk data imports
- Weekly routine backup

**Procedure**:

**Step 1**: Ensure database is running

```bash
# Check Docker container status
docker compose ps | grep postgres

# Expected: hospeda_postgres   running
```

**Step 2**: Create backup directory

```bash
# Create backups directory if not exists
mkdir -p ~/hospeda-backups

# Or inside project
mkdir -p ./backups
# (Add to .gitignore)
```

**Step 3**: Create backup

```bash
# Full database backup
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev \
  > ~/hospeda-backups/hospeda_dev_$(date +%Y%m%d_%H%M%S).sql

# Expected output: (none - writes to file)
```

**Step 4**: Compress backup (optional but recommended)

```bash
# Compress backup to save space
gzip ~/hospeda-backups/hospeda_dev_$(date +%Y%m%d_%H%M%S).sql

# Or compress during dump
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev \
  | gzip > ~/hospeda-backups/hospeda_dev_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Step 5**: Verify backup created

```bash
# List backups
ls -lh ~/hospeda-backups/

# Expected:
# hospeda_dev_20241106_143000.sql.gz  (size varies, e.g., 15M)
```

**Step 6**: Test backup (optional but recommended)

```bash
# Extract and check first few lines
zcat ~/hospeda-backups/hospeda_dev_20241106_143000.sql.gz | head -20

# Should see:
# -- PostgreSQL database dump
# -- Dumped from database version 15.x
# -- Tables and data definitions
```

### Automated Local Backup Script

**Create backup script**:

```bash
#!/bin/bash
# File: scripts/backup-local-db.sh

set -e

BACKUP_DIR=~/hospeda-backups
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hospeda_dev_$DATE.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
echo "Creating backup..."
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev \
  | gzip > "$BACKUP_FILE"

# Verify backup created
if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup created: $BACKUP_FILE ($SIZE)"
else
  echo "❌ Backup failed"
  exit 1
fi

# Cleanup old backups (keep last 4 weeks)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "hospeda_dev_*.sql.gz" -mtime +28 -delete
echo "✅ Cleanup complete"
```

**Make script executable**:

```bash
chmod +x scripts/backup-local-db.sh
```

**Run backup**:

```bash
./scripts/backup-local-db.sh

# Expected:
# Creating backup...
# ✅ Backup created: ~/hospeda-backups/hospeda_dev_20241106_143000.sql.gz (15M)
# Cleaning up old backups...
# ✅ Cleanup complete
```

### Schema-Only Backup

**When to use**:

- Documenting database schema
- Comparing schema versions
- Lightweight backup for testing

**Procedure**:

```bash
# Schema only (no data)
docker exec hospeda_postgres pg_dump -U hospeda_user -s hospeda_dev \
  > ~/hospeda-backups/schema_$(date +%Y%m%d).sql

# Verify
head -50 ~/hospeda-backups/schema_$(date +%Y%m%d).sql
```

### Data-Only Backup

**When to use**:

- Backing up data without schema
- Exporting data for analysis
- Migrating data to different schema

**Procedure**:

```bash
# Data only (no schema)
docker exec hospeda_postgres pg_dump -U hospeda_user -a hospeda_dev \
  > ~/hospeda-backups/data_$(date +%Y%m%d).sql

# Or specific table
docker exec hospeda_postgres pg_dump -U hospeda_user -a -t accommodations hospeda_dev \
  > ~/hospeda-backups/accommodations_data_$(date +%Y%m%d).sql
```

## Recovery Procedures

### Point-in-Time Recovery (PITR)

**Scenario**: Recover database to specific point in time (e.g., before data corruption)

**Available for**: Neon production database (last 30 days)

**Procedure**:

**Step 1**: Identify recovery point

Determine exact time to recover to:

```text
Issue detected: 2024-11-06 14:30:00 UTC
Last known good: 2024-11-06 14:00:00 UTC
Recovery target: 2024-11-06 14:00:00 UTC
```

**Step 2**: Create branch from recovery point

In Neon Console:

1. Go to **Branches** tab
2. Click **"Create Branch"**
3. Select **"Point in time"**
4. Enter date/time: `2024-11-06 14:00:00`
5. Name branch: `recovery-[date]-[brief-reason]`
6. Click **"Create"**

**Expected**: Branch created with database state at specified time

**Step 3**: Verify recovered data

```bash
# Get connection string for recovery branch
# From Neon Console → Branch → Connection String

# Connect to recovery branch
psql "postgresql://user:pass@recovery-branch.neon.tech/dbname"
```

**Verify data**:

```sql
-- Check if corrupted/deleted data is restored
SELECT * FROM accommodations WHERE id = 'affected-record-id';

-- Verify data timestamp
SELECT max(created_at) FROM bookings;
-- Should be <= recovery point time

-- Check row counts
SELECT count(*) FROM accommodations;
SELECT count(*) FROM bookings;
```

**Expected**:

- Deleted data is present
- Corrupted data is correct
- Data is from before issue occurred

**Step 4**: Extract specific data (if needed)

If only specific data needs recovery:

```sql
-- Export affected records
COPY (
  SELECT * FROM accommodations WHERE id IN ('id1', 'id2', 'id3')
) TO '/tmp/recovered_accommodations.csv' CSV HEADER;
```

**Download from recovery branch and import to main**:

```bash
# From recovery branch
psql "recovery-branch-url" -c "COPY (...) TO STDOUT CSV HEADER" > recovered_data.csv

# To main branch
psql "$DATABASE_URL" -c "COPY accommodations FROM STDIN CSV HEADER" < recovered_data.csv
```

**Step 5**: Full database recovery (if needed)

If full database recovery needed:

**Option A: Promote branch to production**

**⚠️  WARNING**: This replaces current production database

1. Stop application (to prevent new data)
2. In Neon Console, go to recovery branch
3. Click **"Set as Primary"**
4. Confirm promotion
5. Update application connection string (if changed)
6. Restart application
7. Verify functionality

**Option B: Export/Import data**

For more control:

```bash
# Export from recovery branch
pg_dump "recovery-branch-url" > recovery.sql

# Import to main (after backing up main!)
psql "$DATABASE_URL" < recovery.sql
```

**Step 6**: Verify recovery

Run comprehensive checks:

```sql
-- Verify row counts
SELECT 'accommodations' as table, count(*) FROM accommodations
UNION ALL SELECT 'bookings', count(*) FROM bookings
UNION ALL SELECT 'users', count(*) FROM users;

-- Verify recent data
SELECT * FROM bookings ORDER BY created_at DESC LIMIT 10;

-- Check data integrity
SELECT * FROM accommodations WHERE city IS NULL;  -- Should be empty
SELECT * FROM bookings WHERE accommodation_id NOT IN (SELECT id FROM accommodations);  -- Should be empty
```

**Step 7**: Clean up recovery branch

After successful recovery:

1. Document recovery in incident report
2. Delete recovery branch (if no longer needed)
3. Resume normal operations

### Full Database Restore (Local)

**Scenario**: Restore local development database from backup

**When to use**:

- Local database corrupted
- Need to reset to known state
- Testing backup restore procedure

**Procedure**:

**Step 1**: Stop application

```bash
# Stop dev server
# Ctrl+C in terminal running pnpm dev

# Or stop all services
docker compose down
```

**Step 2**: Identify backup to restore

```bash
# List available backups
ls -lh ~/hospeda-backups/

# Expected:
# hospeda_dev_20241106_143000.sql.gz
# hospeda_dev_20241105_090000.sql.gz
# ...

# Choose backup to restore
BACKUP_FILE=~/hospeda-backups/hospeda_dev_20241106_143000.sql.gz
```

**Step 3**: Start database (if stopped)

```bash
# Start only database
docker compose up -d postgres

# Wait for database to be ready
sleep 5
```

**Step 4**: Drop and recreate database

**⚠️  WARNING**: This deletes all current data

```bash
# Drop existing database
docker exec hospeda_postgres psql -U hospeda_user -c "DROP DATABASE hospeda_dev"

# Recreate database
docker exec hospeda_postgres psql -U hospeda_user -c "CREATE DATABASE hospeda_dev"
```

**Step 5**: Restore from backup

```bash
# Restore from compressed backup
zcat "$BACKUP_FILE" | docker exec -i hospeda_postgres psql -U hospeda_user -d hospeda_dev

# Expected: SQL statements executing
# CREATE TABLE
# ALTER TABLE
# COPY xxx
# ...
```

**Alternative** (if uncompressed):

```bash
# Restore from uncompressed backup
cat ~/hospeda-backups/hospeda_dev_20241106_143000.sql \
  | docker exec -i hospeda_postgres psql -U hospeda_user -d hospeda_dev
```

**Step 6**: Verify restore

```bash
# Connect to database
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev

# Verify tables exist
\dt

# Verify data
SELECT count(*) FROM accommodations;
SELECT count(*) FROM bookings;

# Exit
\q
```

**Step 7**: Restart application

```bash
# Start all services
docker compose up -d

# Or start dev server
pnpm dev
```

**Step 8**: Test application

1. Open <http://localhost:4321> (web)
2. Test critical functionality
3. Verify data displays correctly

### Partial Data Recovery

**Scenario**: Recover specific table or records (not entire database)

**When to use**:

- Accidental deletion of specific records
- Corruption in single table
- Need to restore historical data

**Procedure**:

**Step 1**: Create recovery environment

```bash
# Create recovery branch (Neon) or restore to separate database (local)

# Neon: Create branch from backup
# Local: Restore backup to temporary database

# For local temporary database:
docker exec hospeda_postgres psql -U hospeda_user -c "CREATE DATABASE hospeda_recovery"

# Restore backup to temporary database
zcat ~/hospeda-backups/hospeda_dev_20241106_143000.sql.gz \
  | docker exec -i hospeda_postgres psql -U hospeda_user -d hospeda_recovery
```

**Step 2**: Export specific data

```sql
-- Connect to recovery database
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_recovery

-- Export specific records to CSV
COPY (
  SELECT * FROM accommodations
  WHERE id IN ('acc-1', 'acc-2', 'acc-3')
) TO '/tmp/recovered_accommodations.csv' CSV HEADER;

-- Exit
\q
```

**Step 3**: Copy export from container

```bash
# Copy file from container to host
docker cp hospeda_postgres:/tmp/recovered_accommodations.csv ./recovered_accommodations.csv
```

**Step 4**: Import to production/main database

```bash
# Connect to main database
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev

-- Import data
\copy accommodations FROM '/path/to/recovered_accommodations.csv' CSV HEADER

-- Or use COPY with stdin:
\q

cat recovered_accommodations.csv \
  | docker exec -i hospeda_postgres psql -U hospeda_user -d hospeda_dev \
    -c "COPY accommodations FROM STDIN CSV HEADER"
```

**Step 5**: Verify imported data

```sql
-- Check recovered records
SELECT * FROM accommodations WHERE id IN ('acc-1', 'acc-2', 'acc-3');

-- Verify data integrity
-- (check foreign keys, constraints, etc.)
```

**Step 6**: Clean up

```bash
# Drop temporary database (local)
docker exec hospeda_postgres psql -U hospeda_user -c "DROP DATABASE hospeda_recovery"

# Or delete recovery branch (Neon)

# Delete temporary files
rm recovered_accommodations.csv
```

### Data Corruption Recovery

**Scenario**: Data corrupted but database structure intact

**When to use**:

- Invalid data values
- Broken relationships
- Data transformation errors

**Procedure**:

**Step 1**: Assess corruption extent

```sql
-- Find corrupted records
SELECT * FROM accommodations WHERE price_per_night < 0;  -- Invalid prices
SELECT * FROM bookings WHERE check_in > check_out;  -- Invalid dates
SELECT * FROM bookings WHERE accommodation_id NOT IN (SELECT id FROM accommodations);  -- Broken FK

-- Count affected records
SELECT count(*) FROM accommodations WHERE [corruption-condition];
```

**Step 2**: Backup current state (before fix)

```bash
# Backup before attempting fix
# Neon: Create manual backup via Console
# Local: Run backup script
./scripts/backup-local-db.sh
```

**Step 3**: Identify recovery method

**Option A: Fix data in place**

If corruption is simple:

```sql
-- Fix invalid prices
UPDATE accommodations SET price_per_night = 100
WHERE price_per_night < 0;

-- Fix invalid dates
DELETE FROM bookings WHERE check_in > check_out;
```

**Option B: Restore from backup**

If corruption is complex:

1. Create recovery branch/database from backup
2. Export correct data
3. Replace corrupted data in main database

**Step 4**: Execute recovery

```bash
# Example: Replace corrupted table data

# From recovery database
docker exec hospeda_postgres pg_dump -U hospeda_user -d hospeda_recovery -t accommodations \
  > /tmp/accommodations_good.sql

# To main database (after backup!)
docker exec -i hospeda_postgres psql -U hospeda_user -d hospeda_dev <<EOF
TRUNCATE accommodations CASCADE;  -- WARNING: Deletes all data
EOF

cat /tmp/accommodations_good.sql \
  | docker exec -i hospeda_postgres psql -U hospeda_user -d hospeda_dev
```

**Step 5**: Verify data integrity

```sql
-- Run integrity checks
SELECT count(*) FROM accommodations WHERE price_per_night < 0;  -- Should be 0
SELECT count(*) FROM bookings WHERE check_in > check_out;  -- Should be 0
SELECT count(*) FROM bookings WHERE accommodation_id NOT IN (SELECT id FROM accommodations);  -- Should be 0

-- Verify relationships
SELECT
  b.id,
  b.accommodation_id,
  a.title
FROM bookings b
LEFT JOIN accommodations a ON b.accommodation_id = a.id
WHERE a.id IS NULL;  -- Should be empty
```

**Step 6**: Test application

1. Restart application
2. Test affected features
3. Verify data displays correctly
4. Check for errors in logs

## Disaster Recovery

**Scenario**: Complete data loss (database unavailable, region failure)

**RTO (Recovery Time Objective)**: 1 hour
**RPO (Recovery Point Objective)**: 1 hour

### Disaster Recovery Procedure

**Step 1**: Assess disaster scope

**Determine**:

- Is Neon completely unavailable?
- Is it regional outage?
- Is data lost permanently?
- What is last backup available?

**Step 2**: Communicate disaster

```text
🚨 DISASTER RECOVERY INITIATED

Scope: [Complete database loss / Regional outage / etc.]
Impact: All services down
Last backup: [timestamp]
RTO: 1 hour
RPO: Up to 1 hour data loss possible

Status: Assessing recovery options
Team: [List responding team members]
```

**Step 3**: Identify recovery source

**Options** (in priority order):

1. **Neon automated backup** (if available)
2. **Neon point-in-time recovery** (if available)
3. **Manual backups** (if created recently)
4. **Replica database** (if configured)

**Step 4**: Provision new database

**If Neon unavailable**:

1. Provision new Neon project
2. Or provision PostgreSQL on alternative platform (e.g., AWS RDS)

**If using alternative platform**:

```bash
# Example: AWS RDS
# - Create PostgreSQL 15+ instance
# - Configure security groups
# - Note connection details
```

**Step 5**: Restore backup to new database

**From Neon backup**:

1. In Neon Console, create new project
2. Restore from backup
3. Note new connection string

**From manual backup**:

```bash
# Restore to new database
psql "new-database-connection-string" < backup_file.sql

# Or from compressed
zcat backup_file.sql.gz | psql "new-database-connection-string"
```

**Step 6**: Update application configuration

```bash
# Update DATABASE_URL environment variable
# In Vercel dashboard or deployment platform

# For each app:
# - web
# - admin
# - api

# Update to new connection string
DATABASE_URL=postgresql://user:pass@new-host.neon.tech/dbname
```

**Step 7**: Redeploy applications

```bash
# Trigger redeployment with new DATABASE_URL

# Via git (trigger CI/CD)
git commit --allow-empty -m "chore: trigger redeploy with new DATABASE_URL"
git push

# Or via platform (Vercel)
# Dashboard → Deployments → Redeploy
```

**Step 8**: Verify system recovery

```bash
# Health checks
curl -f https://api.hospeda.com/health

# Data verification
psql "$NEW_DATABASE_URL" -c "SELECT count(*) FROM accommodations"

# Application testing
# - Browse accommodations
# - Test search
# - Test booking flow (if appropriate)
```

**Step 9**: Assess data loss

```sql
-- Check latest data timestamps
SELECT max(created_at) as latest_accommodation FROM accommodations;
SELECT max(created_at) as latest_booking FROM bookings;
SELECT max(created_at) as latest_user FROM users;

-- Compare with known recent activity
```

**Data loss reporting**:

```text
📊 Disaster Recovery - Data Loss Assessment

Recovery point: [backup timestamp]
Current time: [current timestamp]
Data loss window: [duration]

Latest records:
- Accommodations: [timestamp]
- Bookings: [timestamp]
- Users: [timestamp]

Estimated records lost:
- Accommodations: [estimate]
- Bookings: [estimate]
- Users: [estimate]
```

**Step 10**: Post-disaster procedures

1. Document disaster and recovery
2. Post-mortem meeting
3. Improve backup procedures
4. Consider implementing:
   - Database replication
   - More frequent backups
   - Multi-region setup
   - Backup to secondary location

## Backup Best Practices

### Backup Schedule

**Production (Neon)**:

- **Automated daily backups**: Enabled by default
- **Manual pre-migration backups**: Before every migration
- **Manual pre-operation backups**: Before risky operations

**Local Development**:

- **Weekly automated backups**: Via cron job
- **Pre-migration backups**: Before testing migrations
- **Ad-hoc backups**: Before risky operations

### Backup Verification

**Required frequency**: Monthly

**Procedure**:

1. Select random backup
2. Restore to test environment
3. Verify data integrity
4. Document verification
5. Delete test environment

### Backup Retention

| Type | Retention | Reason |
|------|-----------|--------|
| **Neon automated** | 30 days | Neon default, sufficient for most scenarios |
| **Manual (pre-migration)** | 90 days | Keep longer for major changes |
| **Local development** | 28 days | Balance storage vs. utility |
| **Disaster recovery** | 1 year | Long-term safety net |

### Backup Security

**Encryption**:

- Neon backups: Encrypted at rest (Neon-managed)
- Local backups: Store in encrypted volume (recommended)

**Access Control**:

- Limit access to production backups
- Use read-only access where possible
- Audit backup access regularly

**Storage**:

- Local backups: Do NOT commit to git
- Add to .gitignore: `*.sql`, `*.sql.gz`, `/backups/`
- Consider encrypted cloud storage for critical backups

## Troubleshooting

### Backup Failed (Neon)

**Symptom**: Backup not appearing in Neon Console

**Solutions**:

1. Check Neon service status: <https://neonstatus.com>
2. Verify project not suspended
3. Check storage quota
4. Contact Neon support

### Restore Failed - Schema Mismatch

**Symptom**: Restore fails with errors like "column does not exist"

**Cause**: Backup schema doesn't match current schema (usually after migrations)

**Solution**:

1. Restore to empty database (not over existing)
2. Or restore data-only backup (without schema)
3. Or restore to specific schema version

### Backup File Too Large (Local)

**Symptom**: Backup file is very large, slow to create/restore

**Solutions**:

```bash
# Compress with higher compression
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev \
  | gzip -9 > backup.sql.gz

# Custom format (smaller, faster)
docker exec hospeda_postgres pg_dump -U hospeda_user -Fc hospeda_dev \
  > backup.dump

# Restore custom format
docker exec -i hospeda_postgres pg_restore -U hospeda_user -d hospeda_dev \
  < backup.dump
```

### Recovery Point Not Available

**Symptom**: Desired recovery point is outside retention window

**Cause**: Trying to recover to point > 30 days ago (Neon)

**Solution**:

- Use oldest available backup
- Restore data from alternative source
- Implement longer retention if needed

## Related Documentation

- [Rollback Procedures](./rollback.md) - Rolling back deployments
- [Production Bugs](./production-bugs.md) - Investigating production issues
- [Monitoring](./monitoring.md) - Database monitoring setup
- [Architecture - Database](../architecture/database.md) - Database architecture
- [Development - Migrations](../development/migrations.md) - Database migration guide

## Backup & Recovery Checklist

### Backup Checklist

- [ ] Neon automated backups enabled
- [ ] Manual backup before migration
- [ ] Backup descriptive name added
- [ ] Backup creation verified
- [ ] Backup size reasonable
- [ ] Backup documented

### Recovery Checklist

- [ ] Recovery point identified
- [ ] Recovery method chosen
- [ ] Current database backed up (before recovery)
- [ ] Recovery branch/environment created
- [ ] Data verified in recovery environment
- [ ] Recovery executed
- [ ] Data integrity verified
- [ ] Application tested
- [ ] Recovery documented

### Monthly Verification Checklist

- [ ] Random backup selected
- [ ] Test recovery environment created
- [ ] Backup restored successfully
- [ ] Data integrity verified
- [ ] Verification documented
- [ ] Test environment cleaned up

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial backup & recovery runbook | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
