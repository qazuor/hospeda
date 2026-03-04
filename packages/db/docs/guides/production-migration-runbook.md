# Production Migration Runbook

## Table of Contents

1. [Overview](#overview)
2. [Drizzle ORM Migration Approaches](#drizzle-orm-migration-approaches)
3. [Development Workflow](#development-workflow)
4. [Production Migration Strategy](#production-migration-strategy)
5. [Pre-Migration Checklist](#pre-migration-checklist)
6. [Production Migration Procedure](#production-migration-procedure)
7. [Rollback Strategy](#rollback-strategy)
8. [Emergency Procedures](#emergency-procedures)
9. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)

---

## Overview

Hospeda uses **Drizzle ORM** with **PostgreSQL** for database management. The database package lives at `packages/db/` and contains:

- **Schema definitions**: `packages/db/src/schemas/` and `packages/db/src/billing/schemas.ts`
- **Generated migrations**: `packages/db/src/migrations/` (SQL files + meta snapshots)
- **Drizzle config**: `packages/db/drizzle.config.ts`
- **Custom scripts**: `packages/db/scripts/` (enum migrations, search view refresh)

The database URL is read from `HOSPEDA_DATABASE_URL` in the root `.env.local` file.

### Current State

The project currently uses `drizzle-kit push` for applying schema changes (the `db:migrate` script at both root and package level maps to `push`). For production, this should transition to `drizzle-kit migrate` for safer, versioned deployments. This runbook covers both approaches.

---

## Drizzle ORM Migration Approaches

Drizzle provides three ways to sync your schema with the database:

### 1. `drizzle-kit generate` (Generate Migration Files)

- Compares TypeScript schema definitions against the last snapshot in `migrations/meta/`
- Produces a numbered `.sql` file and a corresponding snapshot JSON
- Does **not** touch the database
- **When to use**: Always, as the first step after changing schema code

```bash
pnpm db:generate
```

Output location: `packages/db/src/migrations/NNNN_<name>.sql`

### 2. `drizzle-kit push` (Direct Schema Push)

- Reads TypeScript schema definitions and applies changes directly to the database
- Does **not** use migration files or track migration history
- Compares live database state against schema and applies diffs
- **When to use**: Local development only. Fast iteration without migration file clutter.

```bash
pnpm db:push                   # package-level
pnpm --filter @repo/db db:push # from root
```

### 3. `drizzle-kit migrate` (Apply Migration Files)

- Applies generated `.sql` migration files sequentially
- Tracks applied migrations in a `__drizzle_migrations` table
- Deterministic and reproducible
- **When to use**: Staging and production environments

```bash
# Package-level (currently aliased to push -- see note below)
pnpm --filter @repo/db drizzle-kit migrate --config drizzle.config.ts
```

> **Important**: The current `db:migrate` script in `packages/db/package.json` runs `push`, not `migrate`. For production deployments, invoke `drizzle-kit migrate` directly or update the script.

### Comparison

| Aspect | `push` | `migrate` |
|--------|--------|-----------|
| Uses migration files | No | Yes |
| Tracks history | No | Yes (`__drizzle_migrations`) |
| Reproducible | No (state-based) | Yes (sequential files) |
| Safe for production | No | Yes |
| Supports review | No | Yes (review SQL before applying) |
| Rollback support | Manual | Via reverse migration files |

---

## Development Workflow

### Making Schema Changes

1. **Modify the schema** in `packages/db/src/schemas/` or `packages/db/src/billing/schemas.ts`.

2. **Generate the migration file**:

   ```bash
   pnpm db:generate
   ```

   This creates a new SQL file (e.g., `0015_<random_name>.sql`) and a snapshot in `migrations/meta/`.

3. **Review the generated SQL**:

   ```bash
   cat packages/db/src/migrations/0015_*.sql
   ```

   Verify the SQL does what you expect. Check for:
   - Unintended `DROP` statements
   - Missing `IF NOT EXISTS` / `IF EXISTS` guards
   - Correct column types and constraints
   - Proper index creation

4. **Apply locally** using push for fast iteration:

   ```bash
   pnpm db:push
   ```

   Or reset everything from scratch:

   ```bash
   pnpm db:fresh-dev   # Drops containers, pushes schema, seeds
   ```

5. **Test the migration file** by running `drizzle-kit migrate` against a clean local database:

   ```bash
   pnpm db:fresh   # Uses generate + migrate + seed (not push)
   ```

6. **Run tests** to confirm nothing is broken:

   ```bash
   pnpm test
   pnpm typecheck
   ```

7. **Commit** the migration file, snapshot, and journal together with the schema change.

### Custom Migrations

For changes that Drizzle cannot auto-generate (triggers, functions, views, GIN indexes), write custom SQL files:

- Naming: `YYYYMMDD_<description>.sql` (e.g., `20250513_create_search_index.sql`)
- Location: `packages/db/src/migrations/`
- These must be applied manually or via custom scripts

Existing custom migrations:

- `20250513_add_delete_entity_bookmarks_trigger.sql`
- `20250513_add_generic_updated_at_trigger.sql`
- `20250513_create_search_index_gin.sql`
- `20250513_create_search_index.sql`
- `20250513_refresh_search_index_function.sql`

### Enum Migrations

Enum changes require special handling due to PostgreSQL limitations:

```bash
pnpm --filter @repo/db db:enum-migration
```

This runs:

1. `scripts/generate-enum-migrations.ts` -- generates the enum alteration SQL
2. `scripts/apply-latest-enum-migration.ts` -- applies it to the database

---

## Production Migration Strategy

### Why `migrate` Over `push` for Production

- **Deterministic**: The exact same SQL runs in staging and production
- **Auditable**: Every change is a committed SQL file that can be code-reviewed
- **Trackable**: The `__drizzle_migrations` table records what has been applied
- **Safe**: No surprise schema diffs based on live database state
- **Reversible**: You know exactly what was applied and can write a reverse migration

### Migration Flow

```
Developer workstation          Staging              Production
       |                         |                      |
  1. Edit schema                 |                      |
  2. pnpm db:generate            |                      |
  3. Review SQL                  |                      |
  4. Test locally                |                      |
  5. Commit + Push               |                      |
       |                         |                      |
       +--- PR merged ---------> |                      |
                            6. Deploy to staging        |
                            7. Run migrate              |
                            8. Verify                   |
                                 |                      |
                                 +--- Approved -------> |
                                                   9. Backup DB
                                                  10. Run migrate
                                                  11. Verify
                                                  12. Deploy apps
```

---

## Pre-Migration Checklist

Complete every item before running migrations on production.

### Before Generating

- [ ] Schema changes are complete and tested locally
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes

### Before Applying to Production

- [ ] Migration SQL has been reviewed by at least one other developer
- [ ] Migration has been applied and verified on staging
- [ ] Application code is compatible with both old and new schema (for zero-downtime deploys)
- [ ] Database backup has been created and verified
- [ ] Maintenance window scheduled if migration requires downtime
- [ ] Team notified of upcoming migration
- [ ] Rollback plan documented and ready
- [ ] Connection string for production is confirmed correct
- [ ] Estimated migration duration is known (test on staging with production-like data volume)

### Destructive Change Checklist (Extra)

For migrations that drop columns, tables, or modify data types:

- [ ] Confirm no application code references dropped columns/tables
- [ ] Data has been migrated or archived if needed
- [ ] Two-phase approach considered (deprecate first, remove later)
- [ ] Rollback SQL has been written and tested

---

## Production Migration Procedure

### Step 1: Create a Database Backup

```bash
# Using pg_dump
pg_dump \
  --format=custom \
  --file="hospeda_backup_$(date +%Y%m%d_%H%M%S).dump" \
  --verbose \
  "$HOSPEDA_DATABASE_URL"

# Verify the backup is valid
pg_restore --list "hospeda_backup_*.dump" | head -20
```

The production database is hosted on Neon. Connect directly using the connection string from
Vercel environment variables (Project Settings > Environment Variables > `HOSPEDA_DATABASE_URL`).
Use the non-pooled connection string for `pg_dump`.

### Step 2: Review the Migration SQL One More Time

```bash
# Show all pending migrations (files not yet in __drizzle_migrations)
ls packages/db/src/migrations/*.sql
```

Read through every SQL statement that will be applied.

### Step 3: Put Application in Maintenance Mode (If Required)

Only needed for migrations that:

- Lock tables for extended periods (large `ALTER TABLE` operations)
- Are incompatible with current application code
- Require data transformations

```bash
# Vercel serverless: maintenance mode is not applicable -- functions are stateless.
# For destructive migrations, deploy a maintenance-mode version of the app that
# returns 503 for non-health endpoints, then switch back after migration completes.
```

### Step 4: Apply the Migration

```bash
# Set the production database URL
export HOSPEDA_DATABASE_URL="postgresql://..."

# Run migrations from the packages/db directory
cd packages/db
pnpm drizzle-kit migrate --config drizzle.config.ts
```

If running from the monorepo root:

```bash
HOSPEDA_DATABASE_URL="postgresql://..." \
  pnpm --filter @repo/db drizzle-kit migrate --config drizzle.config.ts
```

### Step 5: Apply Custom Migrations (If Any)

Custom SQL files (triggers, functions, views) are not tracked by drizzle-kit. Apply them manually:

```bash
psql "$HOSPEDA_DATABASE_URL" -f packages/db/src/migrations/20250513_create_search_index.sql
```

### Step 6: Verify the Migration

```bash
# Connect and check schema
psql "$HOSPEDA_DATABASE_URL" -c "\dt"   # List tables
psql "$HOSPEDA_DATABASE_URL" -c "\d <table_name>"  # Describe specific table

# Check migration history
psql "$HOSPEDA_DATABASE_URL" -c "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5;"

# Quick smoke test -- count rows in key tables
psql "$HOSPEDA_DATABASE_URL" -c "
  SELECT 'accommodations' AS t, count(*) FROM accommodations
  UNION ALL SELECT 'users', count(*) FROM \"user\"
  UNION ALL SELECT 'destinations', count(*) FROM destinations;
"
```

### Step 7: Deploy Application Code

```bash
# Deploy API, Web and Admin (Vercel)
# Triggered automatically via git push, or manually:
vercel --prod  # from each app directory, or via Vercel dashboard
```

### Step 8: Post-Migration Verification

- [ ] Application starts without errors
- [ ] Key API endpoints respond correctly
- [ ] Admin panel loads and displays data
- [ ] Web frontend renders pages without errors
- [ ] Check application logs for database-related errors
- [ ] Monitor error tracking (Sentry) for new issues

---

## Rollback Strategy

### Option 1: Reverse Migration (Preferred)

Write a reverse SQL migration before deploying:

```sql
-- rollback_0015.sql
-- Reverse of 0015_<name>.sql

-- If the migration added a column:
ALTER TABLE accommodations DROP COLUMN IF EXISTS new_column;

-- If the migration added a table:
DROP TABLE IF EXISTS new_table;

-- If the migration modified a column:
ALTER TABLE accommodations ALTER COLUMN price TYPE integer;
```

Apply the reverse migration:

```bash
psql "$HOSPEDA_DATABASE_URL" -f rollback_0015.sql
```

Update the `__drizzle_migrations` table to remove the applied entry:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
  DELETE FROM __drizzle_migrations
  WHERE hash = '<migration_hash>';
"
```

### Option 2: Restore from Backup

Use this when reverse migration is too complex or data was corrupted:

```bash
# Drop the current database and restore
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname="$HOSPEDA_DATABASE_URL" \
  "hospeda_backup_YYYYMMDD_HHMMSS.dump"
```

Then redeploy the previous application version:

```bash
# Vercel -- promote a previous deployment to production
# Use the Vercel dashboard: Deployments tab → find previous → Promote to Production
# Or via CLI:
vercel promote <previous-deployment-url>
```

### Option 3: Schema Push to Revert (Development Only)

If on a development or staging environment, revert the schema code and push:

```bash
git checkout HEAD~1 -- packages/db/src/schemas/
pnpm db:push
```

This is NOT safe for production as `push` may perform unexpected destructive operations.

---

## Emergency Procedures

### Database Is Down After Migration

1. **Check connection**: `psql "$HOSPEDA_DATABASE_URL" -c "SELECT 1;"`
2. **Check Neon database status**: Open the Neon Console and verify the database endpoint is active
3. **Check for long-running locks**:

   ```sql
   SELECT pid, age(clock_timestamp(), query_start), usename, query, state
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY query_start;
   ```

4. **Kill blocking queries if necessary**:

   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```

5. **If unrecoverable, restore from backup** (see Rollback Option 2).

### Migration Is Stuck / Hanging

1. **Check for locks**:

   ```sql
   SELECT blocked_locks.pid AS blocked_pid,
          blocking_locks.pid AS blocking_pid,
          blocked_activity.query AS blocked_query,
          blocking_activity.query AS blocking_query
   FROM pg_catalog.pg_locks blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_catalog.pg_locks blocking_locks
     ON blocking_locks.locktype = blocked_locks.locktype
     AND blocking_locks.relation = blocked_locks.relation
     AND blocking_locks.pid != blocked_locks.pid
   JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
   WHERE NOT blocked_locks.granted;
   ```

2. **Terminate the blocking process** (with caution):

   ```sql
   SELECT pg_cancel_backend(<blocking_pid>);
   -- Or if cancel does not work:
   SELECT pg_terminate_backend(<blocking_pid>);
   ```

3. **Retry the migration**.

### Application Errors After Migration

1. **Check Sentry** for new error patterns
2. **Check API logs**: `fly logs -a hospeda-api`
3. **Verify schema matches expectations**: `psql "$HOSPEDA_DATABASE_URL" -c "\d <table>"`
4. **If schema is wrong, rollback** (see Rollback Strategy)
5. **If schema is correct but app code is wrong**, redeploy previous app version

### Data Corruption Detected

1. **Immediately stop the application** to prevent further damage:

   ```bash
   fly scale count 0 -a hospeda-api
   ```

2. **Do not run any more migrations**
3. **Assess the damage** using SQL queries
4. **Restore from backup** if damage is significant
5. **If partial, fix with targeted SQL** and document the fix

---

## Common Issues and Troubleshooting

### Migration file already applied but not in journal

**Symptom**: `drizzle-kit generate` creates a migration that duplicates changes already in the database.

**Cause**: Schema was applied via `push` (which does not track in `__drizzle_migrations`).

**Fix**: If the database already has the changes, manually insert the migration record:

```sql
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('<migration_file_hash>', NOW());
```

Or delete the generated migration file and regenerate after syncing snapshots.

### Enum type changes fail

**Symptom**: `ALTER TYPE ... ADD VALUE` inside a transaction fails with "cannot be executed inside a transaction block."

**Cause**: PostgreSQL does not allow adding enum values inside a transaction.

**Fix**: Use the dedicated enum migration script:

```bash
pnpm --filter @repo/db db:enum-migration
```

Or apply the enum change outside a transaction:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "ALTER TYPE my_enum ADD VALUE 'new_value';"
```

### Column type mismatch between schema and database

**Symptom**: Application errors about unexpected data types.

**Cause**: `push` may have applied a different type than what `generate` would produce.

**Fix**: Compare schema definition with actual database:

```bash
# Check actual column type
psql "$HOSPEDA_DATABASE_URL" -c "\d+ <table_name>"

# Compare with Drizzle schema
cat packages/db/src/schemas/<schema_file>.ts
```

Manually alter the column if needed, then regenerate migrations.

### Migration order conflicts

**Symptom**: Two developers generate migrations at the same sequence number.

**Cause**: Both ran `generate` from the same base snapshot before merging.

**Fix**:

1. Delete the conflicting migration file with the higher timestamp
2. Merge the other branch first
3. Pull the latest migrations
4. Run `generate` again to get the next sequential number

### `push` and `migrate` state divergence

**Symptom**: `generate` produces empty or incorrect migrations.

**Cause**: Database was modified via `push` and the snapshot files are out of sync.

**Fix**: On development, the simplest recovery is:

```bash
pnpm db:fresh-dev   # Reset everything, push schema, reseed
pnpm db:generate    # Regenerate from clean state
```

On production, never use `push`. Always use `migrate` with reviewed SQL files.

### Connection refused during migration

**Symptom**: `ECONNREFUSED` or `connection refused` error.

**Cause**: Database is not running, wrong connection string, or firewall/network issue.

**Fix**:

1. Verify `HOSPEDA_DATABASE_URL` is correct
2. Check Neon database status at the Neon Console
3. Check `.env.local` in the monorepo root is being read correctly

### Large table migrations are slow

**Symptom**: `ALTER TABLE` on a large table takes minutes or hours.

**Cause**: PostgreSQL rewrites the entire table for certain operations (changing column type, adding NOT NULL with default on older PG versions).

**Fix**:

- Add columns as nullable first, backfill data, then add the constraint
- Use `CREATE INDEX CONCURRENTLY` instead of `CREATE INDEX` (does not lock writes)
- Schedule during low-traffic periods
- Consider using `pg_repack` for table rewrites on very large tables

---

## Reference: Key Paths and Commands

| Item | Path / Command |
|------|----------------|
| Schema definitions | `packages/db/src/schemas/` |
| Billing schemas | `packages/db/src/billing/schemas.ts` |
| Migration output | `packages/db/src/migrations/` |
| Drizzle config | `packages/db/drizzle.config.ts` |
| Env file | `.env.local` (monorepo root) |
| Generate migration | `pnpm db:generate` |
| Apply via push (dev) | `pnpm db:push` or `pnpm db:fresh-dev` |
| Apply via migrate (prod) | `pnpm --filter @repo/db drizzle-kit migrate --config drizzle.config.ts` |
| Full reset + seed | `pnpm db:fresh` |
| Dev reset + seed | `pnpm db:fresh-dev` |
| Enum migration | `pnpm --filter @repo/db db:enum-migration` |
| Open Drizzle Studio | `pnpm db:studio` |
| Seed database | `pnpm db:seed` |
