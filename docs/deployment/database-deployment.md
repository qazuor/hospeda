# Database Deployment Guide (Neon PostgreSQL)

**Last Updated**: 2024-01-15
**Platform**: Neon (Serverless PostgreSQL)
**ORM**: Drizzle
**Status**: Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Database Schema Management](#database-schema-management)
5. [Branching Strategy](#branching-strategy)
6. [Migrations](#migrations)
7. Backup & Recovery
8. Performance & Scaling
9. [Security](#security)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)
12. [Database Operations](#database-operations)

---

## Overview

### Neon PostgreSQL Architecture

**Neon** is a serverless PostgreSQL platform designed for modern applications:

- **Serverless**: Auto-scaling compute and storage
- **PostgreSQL**: Full PostgreSQL 15 compatibility
- **Branching**: Git-like database branching for development
- **Auto-Scaling**: Automatic scale to zero when idle
- **Connection Pooling**: Built-in connection pooling (pgbouncer)
- **Global Deployment**: Data stored in AWS regions

### Serverless Benefits

**Auto-Scaling**:

- Compute scales automatically based on load
- Scales to zero during inactivity (saves costs)
- Instant scale-up on traffic spikes

**Branching**:

- Create database branches for features/testing
- Isolated data for each branch
- Merge branches like Git

**Cost Efficiency**:

- Pay only for what you use
- No idle compute costs
- Automatic storage optimization

**Developer Experience**:

- Instant database provisioning
- No infrastructure management
- Built-in backups and monitoring

### Integration with Hospeda

The Hospeda project uses Neon for:

- **Development**: Local development with Neon dev branches
- **Staging**: Preview branches for pull request testing
- **Production**: Main branch for production database

**Tech Stack**:

- **ORM**: Drizzle ORM
- **Migration Tool**: Drizzle Kit
- **Connection**: PostgreSQL driver (node-postgres)
- **Pooling**: PgBouncer (built into Neon)

### Prerequisites Summary

Before setup, ensure you have:

1. **Neon Account**: Free or paid tier
2. **Neon CLI**: Installed globally
3. **Database Credentials**: Connection string ready
4. **Drizzle ORM**: Configured in project
5. **Environment Variables**: DATABASE_URL set
6. **PostgreSQL Client**: psql for direct access (optional)

---

## Prerequisites

### 1. Neon Account Setup

#### Create Account

1. Go to [neon.tech](https://neon.tech)
2. Sign up with:
   - GitHub (recommended)
   - Google
   - Email
3. Verify email address
4. Complete onboarding

#### Choose Plan

**Free Tier**:

- 10 GB storage
- 1 project
- Multiple branches
- Auto-scaling (with limits)
- **Good for**: Development, testing, small projects

**Pro Tier** ($19/month):

- 50 GB included storage
- Unlimited projects
- Unlimited branches
- Higher auto-scaling limits
- Point-in-time recovery (7 days)
- **Good for**: Production workloads

**Select Plan**:

1. Go to Billing
2. Choose plan based on needs
3. Add payment method (for Pro)

### 2. Neon CLI Installation

Install the Neon CLI for command-line management.

**Using npm**:

```bash
npm install -g neonctl
```

**Using pnpm**:

```bash
pnpm add -g neonctl
```

**Using Homebrew (macOS/Linux)**:

```bash
brew install neonctl
```

**Verify Installation**:

```bash
neonctl --version
# Output: neonctl 1.20.0
```

#### Authenticate CLI

```bash
neonctl auth
```

This opens a browser for authentication. After logging in, CLI is authenticated.

**Verify Authentication**:

```bash
neonctl projects list
# Shows your Neon projects
```

### 3. Database Credentials

After creating a Neon project, you'll need:

**Connection String** (main credential):

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

Example:

```
postgresql://hospeda_user:abc123xyz@ep-cool-sky-12345.us-east-1.aws.neon.tech/hospeda_db?sslmode=require
```

**Components**:

- **User**: Database user (e.g., `hospeda_user`)
- **Password**: Auto-generated password
- **Host**: Neon endpoint (e.g., `ep-cool-sky-12345.us-east-1.aws.neon.tech`)
- **Database**: Database name (e.g., `hospeda_db`)
- **SSL Mode**: Always `require` for security

**Get Connection String**:

1. Go to Neon Dashboard
2. Select project
3. Click "Connection Details"
4. Copy "Connection string"

### 4. Drizzle ORM Setup

Hospeda uses Drizzle ORM for database access.

**Already configured** in `packages/db/`:

```typescript
// packages/db/drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schemas/*',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.HOSPEDA_DATABASE_URL!,
  },
} satisfies Config;
```

**Environment Variable**:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

**Drizzle Commands** (in `packages/db/package.json`):

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 5. PostgreSQL Client (Optional)

For direct database access:

**Install psql**:

**macOS**:

```bash
brew install postgresql
```

**Ubuntu/Debian**:

```bash
sudo apt-get install postgresql-client
```

**Windows**:

Download from [postgresql.org](https://www.postgresql.org/download/windows/)

**Verify Installation**:

```bash
psql --version
# psql (PostgreSQL) 15.0
```

**Connect to Neon**:

```bash
psql "postgresql://user:pass@host/db?sslmode=require"
```

---

## Initial Setup

### Create Neon Project

#### Create Neon Using Dashboard

1. **Go to Dashboard**:
   - Visit [console.neon.tech](https://console.neon.tech)
   - Click "New Project"

1. **Configure Project**:
   - **Name**: `hospeda-production`
   - **Region**: `US East (N. Virginia)` (or closest to users)
   - **PostgreSQL Version**: `15` (latest stable)
   - **Compute Size**: Auto (starts at 0.25 vCPU)

1. **Create Project**:
   - Click "Create Project"
   - Wait ~30 seconds for provisioning

1. **Save Credentials**:
   - Copy connection string immediately
   - Save to password manager

#### Create Neon Using CLI

```bash
neonctl projects create \
  --name hospeda-production \
  --region aws-us-east-1 \
  --pg-version 15
```

**Output**:

```
Project created successfully!
ID: proj-cool-sky-12345
Connection string: postgresql://...
```

### Create Database

Neon creates a default database (`neondb`), but we'll create a custom one.

#### Create Database Using Dashboard

1. Go to project dashboard
2. Click "Databases" tab
3. Click "New Database"
4. Enter name: `hospeda_db`
5. Click "Create"

#### Create Database Using CLI

```bash
neonctl databases create \
  --project-id proj-cool-sky-12345 \
  --name hospeda_db
```

#### Using SQL (via psql)

```bash
# Connect to default database
psql "postgresql://user:pass@host/neondb?sslmode=require"

# Create database
CREATE DATABASE hospeda_db;

# Exit
\q

# Reconnect to new database
psql "postgresql://user:pass@host/hospeda_db?sslmode=require"
```

### Get Connection String

#### Dashboard Method

1. Go to project dashboard
2. Click "Connection Details"
3. Select:
   - **Database**: `hospeda_db`
   - **Role**: `hospeda_user` (default)
   - **Connection type**: Connection string
4. Copy string

#### Format

```
postgresql://[user]:[password]@[host]/hospeda_db?sslmode=require
```

**With Connection Pooling** (recommended for serverless):

```
postgresql://[user]:[password]@[host]/hospeda_db?sslmode=require&pgbouncer=true
```

The `pgbouncer=true` parameter enables connection pooling.

### Configure DATABASE_URL

#### Local Development

Create `.env.local` in project root:

```bash
# .env.local
HOSPEDA_DATABASE_URL=postgresql://user:pass@host/hospeda_db?sslmode=require&pgbouncer=true
```

**Note**: This file is gitignored.

#### Vercel (Production)

1. Go to Vercel project settings
2. Environment Variables
3. Add new variable:
   - **Name**: `HOSPEDA_DATABASE_URL`
   - **Value**: Connection string
   - **Environments**: Production, Preview, Development
4. Save

#### GitHub Actions (CI/CD)

1. Go to repository Settings → Secrets
2. Click "New repository secret"
3. Name: `HOSPEDA_DATABASE_URL`
4. Value: Connection string
5. Add secret

**Use in workflow**:

```yaml
jobs:
  test:
    env:
      HOSPEDA_DATABASE_URL: ${{ secrets.HOSPEDA_DATABASE_URL }}
```

### Connection Pooling

Neon includes built-in connection pooling via PgBouncer.

**Enable Pooling**:

Add `pgbouncer=true` to connection string:

```
postgresql://user:pass@host/db?sslmode=require&pgbouncer=true
```

**Benefits**:

- Reduced connection overhead
- Better performance for serverless functions
- Handles connection spikes

**Pooling Modes**:

Neon uses **transaction mode**:

- Each transaction gets a connection
- Connection released after transaction
- Best for serverless/stateless apps

**Max Connections**:

- **Free Tier**: 100 connections
- **Pro Tier**: 1000 connections

**Monitoring**:

View active connections in Neon dashboard:

1. Go to project
2. Click "Monitoring"
3. View "Active Connections" graph

---

## Database Schema Management

### Drizzle Schema Files

Database schema is defined in TypeScript using Drizzle ORM.

**Location**: `packages/db/src/schemas/`

**Example Schema**:

```typescript
// packages/db/src/schemas/accommodations.schema.ts
import { pgTable, uuid, varchar, decimal, integer, timestamp } from 'drizzle-orm/pg-core';

export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }),
  city: varchar('city', { length: 100 }).notNull(),
  pricePerNight: decimal('price_per_night', { precision: 10, scale: 2 }).notNull(),
  maxGuests: integer('max_guests').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Schema Organization**:

```
packages/db/src/schemas/
├── accommodations.schema.ts
├── bookings.schema.ts
├── users.schema.ts
├── reviews.schema.ts
└── index.ts  # Exports all schemas
```

### Generate Migrations

When schema changes, generate a migration:

**Command**:

```bash
cd packages/db
pnpm db:generate
```

**What It Does**:

1. Reads schema files from `src/schemas/`
2. Compares with current database state
3. Generates SQL migration file
4. Saves to `drizzle/` directory

**Output**:

```
drizzle/
├── 0000_initial.sql
├── 0001_add_reviews.sql
├── 0002_add_bookings.sql
└── meta/
    ├── _journal.json
    └── 0002_snapshot.json
```

**Migration File Example**:

```sql
-- drizzle/0000_initial.sql
CREATE TABLE IF NOT EXISTS "accommodations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" varchar(2000),
  "city" varchar(100) NOT NULL,
  "price_per_night" decimal(10, 2) NOT NULL,
  "max_guests" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

### Run Migrations

Apply migrations to database:

**Development/Staging**:

```bash
cd packages/db
pnpm db:migrate
```

**What It Does**:

1. Connects to database (using `HOSPEDA_DATABASE_URL`)
2. Checks migration history
3. Runs pending migrations
4. Updates migration history table

**Output**:

```
Applying migrations...
✓ 0000_initial.sql
✓ 0001_add_reviews.sql
✓ 0002_add_bookings.sql
Migrations complete!
```

**Production**:

Migrations should run automatically in CI/CD pipeline (see [Migrations](#migrations) section).

### Push Schema (Development Only)

For rapid development, push schema directly without migrations:

**Command**:

```bash
cd packages/db
pnpm db:push
```

**What It Does**:

1. Reads schema files
2. Compares with database
3. Applies changes directly (no migration file)

**⚠️ WARNING**:

- **Only use in development**
- Skips migration history
- Can cause data loss
- **Never use in production**

**Use Case**:

Prototyping schema changes during development:

```bash
# 1. Modify schema
# Edit packages/db/src/schemas/accommodations.schema.ts

# 2. Push to dev database
pnpm db:push

# 3. Test application

# 4. When satisfied, generate proper migration
pnpm db:generate
```

### Schema Versioning

**Migration Naming**:

Drizzle auto-generates sequential names:

```
0000_initial.sql
0001_add_reviews_table.sql
0002_add_booking_status_enum.sql
```

**Version Control**:

- **Commit migrations**: Always commit migration files
- **Never modify**: Never modify existing migrations
- **Rollback**: Create new migration to undo changes

**Example Workflow**:

```bash
# 1. Make schema change
# Edit packages/db/src/schemas/accommodations.schema.ts

# 2. Generate migration
pnpm db:generate
# Creates: drizzle/0003_add_amenities.sql

# 3. Review migration
cat drizzle/0003_add_amenities.sql

# 4. Test locally
pnpm db:migrate

# 5. Commit
git add drizzle/0003_add_amenities.sql
git add drizzle/meta/
git commit -m "feat(db): add amenities to accommodations"

# 6. Push to GitHub (triggers CI/CD)
git push origin main
```

---

## Branching Strategy

One of Neon's most powerful features is **database branching**.

### Database Branches Overview

Think of database branches like Git branches:

- **Main Branch**: Production database
- **Feature Branches**: Isolated databases for development
- **Preview Branches**: Databases for PR deployments

**Benefits**:

- Isolated testing environment
- No risk to production data
- Fast branch creation (seconds)
- Cost-efficient (share storage)

### Branch Types

#### 1. Main Branch

**Purpose**: Production database

**Characteristics**:

- Created with project
- Always exists
- Connected to production app
- Protected (no direct schema changes)

**Connection String**:

```
postgresql://user:pass@ep-cool-sky-12345.us-east-1.aws.neon.tech/hospeda_db
```

#### 2. Development Branch

**Purpose**: Local development and testing

**Characteristics**:

- Created from main branch
- Independent data
- Can be reset/recreated
- Used for `pnpm db:push`

**Create**:

```bash
neonctl branches create \
  --project-id proj-cool-sky-12345 \
  --name dev \
  --parent main
```

**Connection String**:

```
postgresql://user:pass@ep-dev-branch-12345.us-east-1.aws.neon.tech/hospeda_db
```

**Use in .env.local**:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:pass@ep-dev-branch-12345.../hospeda_db
```

#### 3. Preview Branches (for PRs)

**Purpose**: Database for pull request previews

**Characteristics**:

- Created automatically for each PR
- Isolated test data
- Deleted when PR closes
- Connected to Vercel preview deployment

**Automated Creation** (via GitHub Actions):

```yaml
# .github/workflows/preview-db.yml
name: Create Preview Database
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  create-preview-db:
    runs-on: ubuntu-latest
    steps:
      - name: Create Neon Branch
        run: |
          neonctl branches create \
            --project-id ${{ secrets.NEON_PROJECT_ID }} \
            --name pr-${{ github.event.pull_request.number }} \
            --parent main

      - name: Get Connection String
        id: db
        run: |
          CONN_STRING=$(neonctl connection-string \
            --project-id ${{ secrets.NEON_PROJECT_ID }} \
            --branch pr-${{ github.event.pull_request.number }})
          echo "::set-output name=url::$CONN_STRING"

      - name: Update Vercel Env
        run: |
          vercel env add HOSPEDA_DATABASE_URL preview \
            --value "${{ steps.db.outputs.url }}"
```

### Create Branch for Feature Development

**Workflow**:

1. **Create Git Branch**:

```bash
git checkout -b feature/add-amenities
```

1. **Create Database Branch**:

```bash
neonctl branches create \
  --name feature-add-amenities \
  --parent main
```

1. **Get Connection String**:

```bash
neonctl connection-string feature-add-amenities
# Copy output
```

1. **Update .env.local**:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:pass@ep-feature-add-amenities.../hospeda_db
```

1. **Make Schema Changes**:

```typescript
// packages/db/src/schemas/accommodations.schema.ts
export const accommodations = pgTable('accommodations', {
  // ... existing fields
  amenities: varchar('amenities', { length: 1000 }), // New field
});
```

1. **Push Schema**:

```bash
pnpm db:push  # Direct push to feature branch
```

1. **Test Application**:

```bash
pnpm dev
# Test new amenities feature
```

1. **Generate Migration** (when satisfied):

```bash
pnpm db:generate
# Creates migration file
```

1. **Commit & Push**:

```bash
git add .
git commit -m "feat(db): add amenities field"
git push origin feature/add-amenities
```

### Branch Connection Strings

Each branch has a unique connection string.

**Get Connection String**:

```bash
# List all branches
neonctl branches list --project-id proj-cool-sky-12345

# Get connection string for specific branch
neonctl connection-string feature-add-amenities
```

**Format**:

```
postgresql://user:pass@ep-[branch-slug]-[project-id].region.aws.neon.tech/db
```

**Example**:

```
Main:    postgresql://...@ep-cool-sky-12345.us-east-1.aws.neon.tech/hospeda_db
Dev:     postgresql://...@ep-dev-branch-12345.us-east-1.aws.neon.tech/hospeda_db
Feature: postgresql://...@ep-feature-add-amenities-12345.us-east-1.aws.neon.tech/hospeda_db
```

### Merge Branches

Unlike Git, Neon branches don't merge data—you migrate schema changes.

**Workflow**:

1. **Feature development complete** on `feature-add-amenities` branch
2. **Migration generated** (via `pnpm db:generate`)
3. **Migration committed** to Git
4. **Pull request merged** to main
5. **CI/CD runs migration** on main database branch

**Migration Application**:

```bash
# CI/CD runs this after merge
cd packages/db
HOSPEDA_DATABASE_URL=<main-branch-connection-string> pnpm db:migrate
```

**Result**: Main database now has the new schema.

### Delete Branches

Clean up unused branches.

**Using CLI**:

```bash
neonctl branches delete feature-add-amenities
```

**Using Dashboard**:

1. Go to project
2. Click "Branches"
3. Find branch
4. Click "⋯" → "Delete"

**Auto-Delete** (for preview branches):

Configure in GitHub Actions:

```yaml
# .github/workflows/cleanup-preview-db.yml
name: Cleanup Preview Database
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete Neon Branch
        run: |
          neonctl branches delete \
            --project-id ${{ secrets.NEON_PROJECT_ID }} \
            pr-${{ github.event.pull_request.number }}
```

---

## Migrations

### Migration Workflow

Migrations are the safe way to change database schema in production.

**Development Workflow**:

1. **Modify Schema**: Edit Drizzle schema files
2. **Generate Migration**: `pnpm db:generate`
3. **Review SQL**: Check generated SQL file
4. **Test Locally**: `pnpm db:migrate` on dev branch
5. **Commit Migration**: Add to Git
6. **Deploy**: CI/CD runs migration in production

### Development Migrations

**Local Development**:

```bash
# 1. Make schema change
# Edit packages/db/src/schemas/accommodations.schema.ts

# 2. Generate migration
cd packages/db
pnpm db:generate

# Output:
# Generated drizzle/0003_add_amenities.sql

# 3. Review migration
cat drizzle/0003_add_amenities.sql

# 4. Run migration on dev database
pnpm db:migrate

# Output:
# ✓ Applying 0003_add_amenities.sql
# Migration complete!

# 5. Test application
cd ../../
pnpm dev
```

**Using db:push** (faster but no migration history):

```bash
# Skip migration generation, push directly
cd packages/db
pnpm db:push

# Use only for rapid prototyping
# Generate proper migration when feature is stable
```

### Production Migrations

**Manual Approach**:

```bash
# 1. Set production DATABASE_URL
export HOSPEDA_DATABASE_URL=postgresql://...main-branch.../hospeda_db

# 2. Run migrations
cd packages/db
pnpm db:migrate

# 3. Verify
psql "$HOSPEDA_DATABASE_URL" -c "\dt"
# Should show updated tables
```

**Automated Approach (CI/CD)**:

**GitHub Actions**:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Run migrations
        env:
          HOSPEDA_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          cd packages/db
          pnpm db:migrate

      - name: Verify migration
        env:
          HOSPEDA_DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          cd packages/db
          pnpm db:status
```

**Vercel Deploy Hook**:

Run migrations before app deployment:

```json
// vercel.json
{
  "buildCommand": "pnpm db:migrate && pnpm build"
}
```

### Migration Rollback

Drizzle doesn't support automatic rollback, but you can manually revert.

**Approach 1: Create Reverse Migration**

```bash
# 1. Create new migration that reverses changes
cd packages/db
pnpm db:generate

# 2. Edit generated migration
# Manually add reverse operations

# Example: If 0003_add_amenities.sql added a column:
# ALTER TABLE accommodations ADD COLUMN amenities VARCHAR(1000);

# Create 0004_remove_amenities.sql:
# ALTER TABLE accommodations DROP COLUMN amenities;

# 3. Run rollback migration
pnpm db:migrate
```

**Approach 2: Restore from Backup**

```bash
# 1. Identify backup point (before migration)
neonctl backups list --project-id proj-cool-sky-12345

# 2. Restore from backup (see Backup & Recovery section)
```

**Approach 3: Manual SQL**

```bash
# Connect to database
psql "$HOSPEDA_DATABASE_URL"

# Run reverse SQL manually
ALTER TABLE accommodations DROP COLUMN amenities;

# Update migration history
DELETE FROM drizzle_migrations WHERE name = '0003_add_amenities';

# Exit
\q
```

### Migration Testing

**Test Before Production**:

1. **Test on Dev Branch**:

```bash
# Use dev branch connection string
export HOSPEDA_DATABASE_URL=postgresql://...dev-branch.../hospeda_db
pnpm db:migrate
```

1. **Test on Preview Branch** (for PRs):

Create preview branch, run migration, test in preview environment.

1. **Dry Run** (manual):

```bash
# Generate migration but don't apply
pnpm db:generate

# Review SQL
cat drizzle/0003_add_amenities.sql

# Manually test SQL in dev database
psql "$HOSPEDA_DATABASE_URL" < drizzle/0003_add_amenities.sql
```

**Automated Testing**:

```yaml
# .github/workflows/test-migrations.yml
name: Test Migrations

on:
  pull_request:
    paths:
      - 'packages/db/drizzle/**'

jobs:
  test-migration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create test database branch
        run: |
          neonctl branches create \
            --name test-migration-${{ github.sha }} \
            --parent main

      - name: Run migrations
        env:
          HOSPEDA_DATABASE_URL: ${{ steps.test-db.outputs.url }}
        run: |
          cd packages/db
          pnpm db:migrate

      - name: Run tests
        env:
          HOSPEDA_DATABASE_URL: ${{ steps.test-db.outputs.url }}
        run: pnpm test

      - name: Cleanup
        if: always()
        run: |
          neonctl branches delete test-migration-${{ github.sha }}
```

---

## Backup & Recovery

### Automatic Backups

Neon provides automatic backups (point-in-time recovery).

**Free Tier**:

- **Retention**: 7 days
- **Frequency**: Continuous (every change tracked)
- **Recovery Point**: Any point in last 7 days

**Pro Tier**:

- **Retention**: 7-30 days (configurable)
- **Frequency**: Continuous
- **Recovery Point**: Any point within retention period

**How It Works**:

Neon uses Write-Ahead Log (WAL) for continuous backup:

1. Every database change written to WAL
2. WAL archived to object storage
3. Can restore to any point in time

**No Configuration Needed**: Backups are automatic.

### Point-in-Time Recovery

Restore database to a specific point in time.

#### Point-in-Time Recovery Using Dashboard

1. Go to Neon project
2. Click "Backups" or "Branches"
3. Click "Restore to Point in Time"
4. Select:
   - **Date**: Choose date
   - **Time**: Choose time (to the second)
   - **Target**: New branch or overwrite existing
5. Click "Restore"

**Result**: New database branch created at that point in time.

#### Point-in-Time Recovery Using CLI

```bash
# Restore to specific timestamp
neonctl branches create \
  --name restore-2024-01-15 \
  --parent main \
  --timestamp "2024-01-15T10:30:00Z"
```

**Timestamp Format**: ISO 8601 (UTC)

**Example Scenario**:

```bash
# Bad migration ran at 10:45 AM
# Restore to 10:30 AM (before migration)

neonctl branches create \
  --name recovery-branch \
  --parent main \
  --timestamp "2024-01-15T10:30:00Z"

# Get connection string
neonctl connection-string recovery-branch

# Verify data
psql "<connection-string>" -c "SELECT * FROM accommodations LIMIT 5;"

# If good, promote to main (see below)
```

### Manual Backups

Create manual backups for extra safety.

**Using pg_dump**:

```bash
# Export entire database
pg_dump "$HOSPEDA_DATABASE_URL" > backup-$(date +%Y%m%d).sql

# Export specific tables
pg_dump "$HOSPEDA_DATABASE_URL" \
  --table=accommodations \
  --table=bookings \
  > backup-core-tables-$(date +%Y%m%d).sql

# Compressed backup
pg_dump "$HOSPEDA_DATABASE_URL" | gzip > backup-$(date +%Y%m%d).sql.gz
```

**Store Backups**:

- S3 bucket
- GitHub repository (for small DBs)
- Local storage (for development)

**Automated Backup Script**:

```bash
#!/bin/bash
# scripts/backup-database.sh

DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="backups/db-backup-$DATE.sql.gz"

# Create backup
pg_dump "$HOSPEDA_DATABASE_URL" | gzip > "$BACKUP_FILE"

# Upload to S3
aws s3 cp "$BACKUP_FILE" s3://hospeda-backups/

# Keep only last 30 backups locally
ls -t backups/*.sql.gz | tail -n +31 | xargs rm -f

echo "Backup complete: $BACKUP_FILE"
```

**Schedule** (via cron):

```cron
# Daily backup at 2 AM
0 2 * * * /path/to/scripts/backup-database.sh
```

### Restore Procedures

#### Restore from Point-in-Time

**Scenario**: Bad migration/data corruption

**Steps**:

1. **Identify Recovery Point**:

```bash
# Check migration history
psql "$HOSPEDA_DATABASE_URL" -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5;"

# Note timestamp before bad migration
```

1. **Create Recovery Branch**:

```bash
neonctl branches create \
  --name recovery \
  --parent main \
  --timestamp "2024-01-15T10:30:00Z"
```

1. **Verify Data**:

```bash
# Get connection string
RECOVERY_URL=$(neonctl connection-string recovery)

# Check data
psql "$RECOVERY_URL" -c "SELECT COUNT(*) FROM accommodations;"
```

1. **Promote Recovery Branch** (if good):

```bash
# Option A: Rename branches (swap main and recovery)
neonctl branches rename main main-backup
neonctl branches rename recovery main

# Option B: Manually migrate data
pg_dump "$RECOVERY_URL" | psql "$MAIN_URL"
```

1. **Update Applications**:

If using connection string with branch name, update environment variables.

#### Restore from Manual Backup

**Scenario**: Need to restore from pg_dump backup

**Steps**:

1. **Create New Database Branch**:

```bash
neonctl branches create --name restore-from-backup
```

1. **Get Connection String**:

```bash
RESTORE_URL=$(neonctl connection-string restore-from-backup)
```

1. **Restore Backup**:

```bash
# From uncompressed SQL
psql "$RESTORE_URL" < backups/db-backup-20240115.sql

# From gzipped SQL
gunzip -c backups/db-backup-20240115.sql.gz | psql "$RESTORE_URL"
```

1. **Verify Data**:

```bash
psql "$RESTORE_URL" -c "SELECT COUNT(*) FROM accommodations;"
```

1. **Promote to Main** (if good):

```bash
# Promote restore-from-backup to main
# (see Promote Recovery Branch above)
```

### Backup Retention

**Configure Retention** (Pro tier only):

1. Go to Neon project settings
2. Navigate to "Backups"
3. Set retention period: 7-30 days
4. Save

**Free Tier**: Fixed at 7 days

**Cost**: Included in Pro plan pricing

**Best Practice**:

- **Production**: 30 days retention
- **Staging**: 7 days retention
- **Development**: 7 days retention (or create manual backups)

---

## Performance & Scaling

### Auto-Scaling

Neon automatically scales compute based on load.

**How It Works**:

1. **Baseline**: Starts at minimum compute (e.g., 0.25 vCPU)
2. **Scale Up**: Increases compute when load increases
3. **Scale Down**: Decreases when load decreases
4. **Scale to Zero**: Pauses compute when idle (after 5 minutes)

**Benefits**:

- Pay only for active usage
- No manual intervention
- Instant scaling (no downtime)
- Cost-efficient for variable workloads

**Configure Auto-Scaling**:

1. Go to project settings
2. Click "Compute"
3. Set:
   - **Minimum**: 0.25 vCPU (or higher)
   - **Maximum**: 4 vCPU (or higher, Pro tier)
   - **Scale to Zero**: Enabled/Disabled
4. Save

**Scaling Limits**:

- **Free Tier**: 0.25-1 vCPU
- **Pro Tier**: 0.25-8 vCPU

**Scale to Zero**:

- **Enabled**: Pauses compute after 5 minutes idle
- **Disabled**: Always keeps minimum compute active
- **Trade-off**: Enabled saves cost but adds cold start (~1-2 seconds)

**Recommendation**:

- **Production**: Disable scale to zero (avoid cold starts)
- **Staging/Dev**: Enable scale to zero (save costs)

### Connection Pooling

Neon includes built-in connection pooling via PgBouncer.

**Enable Pooling**:

Add `pgbouncer=true` to connection string:

```
postgresql://user:pass@host/db?sslmode=require&pgbouncer=true
```

**Benefits**:

- Reuses database connections
- Reduces connection overhead
- Handles connection spikes
- Essential for serverless apps (Vercel, AWS Lambda)

**Pooling Mode**:

Neon uses **transaction mode**:

- Connection released after each transaction
- Multiple clients share connections
- Ideal for stateless applications

**Pool Size**:

- **Free Tier**: 100 connections
- **Pro Tier**: 1000 connections

**Configure in Code**:

```typescript
// packages/db/src/connection.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.HOSPEDA_DATABASE_URL,
  max: 20, // Max connections in app pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool);
```

**Best Practices**:

- Use pooling for all serverless deployments
- Set reasonable `max` in app pool (10-20)
- Monitor active connections
- Close connections properly

### Query Optimization

Optimize queries for better performance.

#### Indexes

**Add Indexes**:

```typescript
// packages/db/src/schemas/accommodations.schema.ts
import { index } from 'drizzle-orm/pg-core';

export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey().defaultRandom(),
  city: varchar('city', { length: 100 }).notNull(),
  pricePerNight: decimal('price_per_night', { precision: 10, scale: 2 }).notNull(),
  // ... other fields
}, (table) => ({
  // Indexes
  cityIdx: index('city_idx').on(table.city),
  priceIdx: index('price_idx').on(table.pricePerNight),
  cityPriceIdx: index('city_price_idx').on(table.city, table.pricePerNight),
}));
```

**Generate Migration**:

```bash
pnpm db:generate
# Creates migration with CREATE INDEX statements
```

#### Analyze Queries

Use `EXPLAIN ANALYZE` to understand query performance:

```bash
psql "$HOSPEDA_DATABASE_URL"

# Analyze query
EXPLAIN ANALYZE SELECT * FROM accommodations WHERE city = 'Concepción';

# Output shows:
# - Execution time
# - Index usage
# - Rows scanned
```

**Slow Query Log**:

Monitor slow queries in Neon dashboard:

1. Go to project
2. Click "Monitoring"
3. Click "Query Performance"
4. View slowest queries

**Optimize Common Queries**:

```typescript
// ❌ Bad: Full table scan
const accommodations = await db
  .select()
  .from(accommodationsTable)
  .where(eq(accommodationsTable.city, 'Concepción'));

// ✅ Good: Uses index (if city_idx exists)
// Same query, but index makes it fast
```

### Performance Monitoring

**Neon Dashboard Metrics**:

1. **Active Connections**: Current connections
2. **CPU Usage**: Compute utilization
3. **Query Performance**: Slowest queries
4. **Database Size**: Storage usage

**Access**:

1. Go to Neon project
2. Click "Monitoring"
3. View real-time metrics

**Set Up Alerts**:

1. Go to Settings → Alerts
2. Create alert:
   - **Metric**: CPU usage, connections, storage
   - **Threshold**: e.g., 80% CPU
   - **Notification**: Email, Slack
3. Save

**Custom Monitoring** (with APM tools):

Integrate with Sentry, Datadog, or New Relic:

```typescript
// packages/db/src/connection.ts
import * as Sentry from '@sentry/node';

pool.on('error', (err) => {
  Sentry.captureException(err);
  console.error('Database pool error:', err);
});
```

---

## Security

### Connection Security (SSL)

Neon enforces SSL for all connections.

**Connection String**:

Always includes `sslmode=require`:

```
postgresql://user:pass@host/db?sslmode=require
```

**Verify SSL**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SHOW ssl;"
# Output: on
```

**SSL Modes**:

- `require`: Encrypt connection (default)
- `verify-ca`: Verify server certificate
- `verify-full`: Verify server certificate and hostname

**Recommendation**: Use `require` (default) for simplicity.

### IP Allowlisting

Restrict database access to specific IPs (Pro tier only).

**Configure**:

1. Go to project settings
2. Click "Security"
3. Enable "IP Allow"
4. Add allowed IPs:
   - Vercel IPs (for production)
   - Office IP (for admin access)
   - CI/CD IPs (GitHub Actions)
5. Save

**Get Vercel IPs**:

```bash
# Vercel doesn't publish static IPs
# Alternatives:
# 1. Use Vercel's database proxy
# 2. Allow all IPs (rely on password security)
# 3. Use private networking (Enterprise)
```

**GitHub Actions IPs**:

GitHub Actions uses dynamic IPs. Options:

1. Allow all IPs (secure with strong password)
2. Use self-hosted runner with static IP

### Role Management

Create database roles with limited permissions.

**Default Role**:

Neon creates a default role (e.g., `hospeda_user`) with full permissions.

**Create Read-Only Role** (for analytics):

```bash
psql "$HOSPEDA_DATABASE_URL"

# Create role
CREATE ROLE analytics_readonly WITH LOGIN PASSWORD 'secure_password';

# Grant read-only access
GRANT CONNECT ON DATABASE hospeda_db TO analytics_readonly;
GRANT USAGE ON SCHEMA public TO analytics_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_readonly;

# Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO analytics_readonly;

\q
```

**Use Read-Only Role**:

```
postgresql://analytics_readonly:secure_password@host/hospeda_db
```

**Best Practices**:

- **App**: Use full-permission role (for CRUD)
- **Analytics**: Use read-only role
- **Admin**: Use separate admin role
- **Rotate**: Change passwords regularly

### Secret Rotation

Regularly rotate database passwords.

**Rotate Password**:

1. **Generate New Password**:

```bash
# Use password manager or:
openssl rand -base64 32
```

1. **Update Neon**:

```bash
psql "$HOSPEDA_DATABASE_URL"

# Change password
ALTER ROLE hospeda_user WITH PASSWORD 'new_password_here';

\q
```

1. **Update Connection Strings**:

Update everywhere:

- `.env.local` (local development)
- Vercel environment variables
- GitHub Actions secrets
- CI/CD pipelines

1. **Redeploy Applications**:

```bash
# Redeploy to pick up new connection string
vercel --prod
```

**Rotation Schedule**:

- **Production**: Every 90 days
- **Staging**: Every 180 days
- **Development**: Every 365 days

**Automated Rotation** (advanced):

Use secret management services:

- AWS Secrets Manager
- HashiCorp Vault
- Doppler

### Audit Logs

Track database access and changes (Pro tier feature).

**Enable Audit Logging**:

1. Go to project settings
2. Click "Security" → "Audit Logs"
3. Enable logging
4. Configure:
   - Log connections
   - Log queries (slow queries only)
   - Retention: 30 days
5. Save

**View Logs**:

1. Go to "Monitoring" → "Audit Logs"
2. Filter by:
   - User
   - Action (SELECT, INSERT, UPDATE, DELETE)
   - Date range
3. Export logs (CSV)

**Use Cases**:

- Security investigations
- Compliance audits
- Debugging access issues
- Performance analysis

---

## Monitoring

### Neon Dashboard

Primary monitoring interface.

**Access**:

1. Go to [console.neon.tech](https://console.neon.tech)
2. Select project
3. Click "Monitoring"

**Available Metrics**:

**Overview**:

- Active connections
- CPU usage
- Storage usage
- Query count

**Detailed Metrics**:

- Query performance (slowest queries)
- Connection history
- Auto-scaling events
- Branch activity

**Refresh**: Real-time (updates every 10 seconds)

### Query Performance

Identify and optimize slow queries.

**View Slow Queries**:

1. Go to Monitoring → Query Performance
2. See list of queries sorted by:
   - Total time
   - Average time
   - Execution count
3. Click query to see details:
   - Query text
   - Execution plan
   - Sample parameters

**Optimize Slow Queries**:

1. **Add Indexes**:

```sql
CREATE INDEX ON accommodations(city);
```

1. **Rewrite Query**:

```typescript
// ❌ Slow: N+1 query
const accommodations = await db.select().from(accommodationsTable);
for (const acc of accommodations) {
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.accommodationId, acc.id));
}

// ✅ Fast: Join
const accommodationsWithReviews = await db
  .select()
  .from(accommodationsTable)
  .leftJoin(reviewsTable, eq(accommodationsTable.id, reviewsTable.accommodationId));
```

1. **Cache Results**:

```typescript
// Cache expensive queries
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
```

### Connection Stats

Monitor database connections.

**View Stats**:

1. Go to Monitoring → Connections
2. See:
   - Active connections (current)
   - Connection history (graph)
   - Peak connections
   - Connection errors

**Identify Issues**:

- **Too Many Connections**: Increase pool size or enable connection pooling
- **Connection Spikes**: Auto-scaling working correctly
- **Connection Errors**: Check app connection handling

**Query Connection Info**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT
  datname,
  usename,
  application_name,
  client_addr,
  state,
  query
FROM pg_stat_activity
WHERE datname = 'hospeda_db';
"
```

### Alerts

Set up alerts for critical events.

**Create Alert**:

1. Go to Settings → Alerts
2. Click "New Alert"
3. Configure:
   - **Name**: "High CPU Usage"
   - **Metric**: CPU usage
   - **Condition**: Greater than 80%
   - **Duration**: For 5 minutes
   - **Notification**: Email/Slack
4. Save

**Alert Types**:

- **CPU Usage**: High compute utilization
- **Storage Usage**: Running out of storage
- **Connection Count**: Too many connections
- **Query Performance**: Slow queries detected

**Notification Channels**:

- Email
- Slack (via webhook)
- PagerDuty (Pro tier)

**Example Slack Webhook**:

1. Create Slack webhook in Slack workspace
2. Add webhook URL to Neon alert
3. Test alert

---

## Troubleshooting

### Connection Errors

#### Error: "Connection timeout"

**Symptom**:

```
Error: connect ETIMEDOUT
```

**Cause**: Network connectivity issue or incorrect host

**Solution**:

1. **Verify Connection String**:

```bash
echo $HOSPEDA_DATABASE_URL
# Check host, port, user, password
```

1. **Test Network**:

```bash
ping ep-cool-sky-12345.us-east-1.aws.neon.tech
# Should respond
```

1. **Check Firewall**:

Ensure outbound connections to port 5432 are allowed.

1. **Try with psql**:

```bash
psql "$HOSPEDA_DATABASE_URL"
# If works, issue is in app
# If fails, issue is network/credentials
```

#### Error: "Too many connections"

**Symptom**:

```
Error: sorry, too many clients already
```

**Cause**: Exceeded connection limit

**Solution**:

1. **Enable Connection Pooling**:

Add `pgbouncer=true` to connection string:

```
postgresql://user:pass@host/db?sslmode=require&pgbouncer=true
```

1. **Close Idle Connections**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < now() - interval '5 minutes';
"
```

1. **Reduce App Pool Size**:

```typescript
// packages/db/src/connection.ts
const pool = new Pool({
  connectionString: process.env.HOSPEDA_DATABASE_URL,
  max: 10, // Reduce from 20 to 10
});
```

1. **Upgrade Plan**:

Free tier: 100 connections → Pro tier: 1000 connections

### Migration Failures

#### Error: "Migration already applied"

**Symptom**:

```
Error: Migration 0003_add_amenities has already been applied
```

**Cause**: Migration ran twice or migration history corrupted

**Solution**:

1. **Check Migration History**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT * FROM drizzle_migrations;"
```

1. **Remove Duplicate**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
DELETE FROM drizzle_migrations
WHERE name = '0003_add_amenities'
  AND created_at = (SELECT MAX(created_at) FROM drizzle_migrations WHERE name = '0003_add_amenities');
"
```

1. **Re-run Migration**:

```bash
pnpm db:migrate
```

#### Error: "Column already exists"

**Symptom**:

```
ERROR: column "amenities" of relation "accommodations" already exists
```

**Cause**: Migration partially applied or run manually before

**Solution**:

1. **Check Table Schema**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "\d accommodations"
# See current columns
```

1. **Skip Failed Migration** (if column exists):

```bash
# Manually mark migration as applied
psql "$HOSPEDA_DATABASE_URL" -c "
INSERT INTO drizzle_migrations (name, hash, created_at)
VALUES ('0003_add_amenities', 'hash_here', NOW());
"
```

1. **Or Drop Column and Re-run**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "ALTER TABLE accommodations DROP COLUMN amenities;"
pnpm db:migrate
```

### Performance Issues

#### Issue: "Slow queries"

**Symptom**: Queries taking > 1 second

**Diagnosis**:

1. **Identify Slow Queries**:

Go to Neon Dashboard → Monitoring → Query Performance

1. **Analyze Query**:

```bash
psql "$HOSPEDA_DATABASE_URL"

EXPLAIN ANALYZE SELECT * FROM accommodations WHERE city = 'Concepción';
# Check if using index
```

**Solution**:

1. **Add Index**:

```typescript
// packages/db/src/schemas/accommodations.schema.ts
export const accommodations = pgTable('accommodations', {
  // ... fields
}, (table) => ({
  cityIdx: index('city_idx').on(table.city),
}));
```

1. **Generate and Apply Migration**:

```bash
pnpm db:generate
pnpm db:migrate
```

1. **Verify Improvement**:

```bash
EXPLAIN ANALYZE SELECT * FROM accommodations WHERE city = 'Concepción';
# Should now use Index Scan instead of Seq Scan
```

#### Issue: "Out of storage"

**Symptom**:

```
ERROR: could not extend file "base/16384/16385": No space left on device
```

**Cause**: Exceeded storage limit

**Solution**:

1. **Check Storage Usage**:

Go to Neon Dashboard → Overview → Storage

1. **Upgrade Plan**:

Free tier: 10 GB → Pro tier: 50+ GB

1. **Clean Up Data** (temporary):

```bash
# Delete old records
psql "$HOSPEDA_DATABASE_URL" -c "
DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';
"

# Vacuum to reclaim space
psql "$HOSPEDA_DATABASE_URL" -c "VACUUM FULL;"
```

### Debug Commands

**Check Database Size**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT pg_size_pretty(pg_database_size('hospeda_db'));
"
```

**Check Table Sizes**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

**Check Active Queries**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT
  pid,
  usename,
  application_name,
  state,
  query,
  now() - query_start AS duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
"
```

**Kill Long-Running Query**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT pg_terminate_backend(12345);"
# Replace 12345 with pid from above query
```

**Check Indexes**:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"
```

---

## Database Operations

### Seeding

Populate database with initial data.

**Seed Script**:

`packages/seed/src/index.ts`:

```typescript
import { db } from '@repo/db';
import { accommodations } from '@repo/db/schemas';

async function seed() {
  console.log('Seeding database...');

  // Insert sample accommodations
  await db.insert(accommodations).values([
    {
      title: 'Beach House',
      description: 'Beautiful beach house with ocean view',
      city: 'Concepción del Uruguay',
      pricePerNight: '150.00',
      maxGuests: 6,
    },
    {
      title: 'Downtown Apartment',
      description: 'Modern apartment in city center',
      city: 'Concepción del Uruguay',
      pricePerNight: '80.00',
      maxGuests: 4,
    },
  ]);

  console.log('Seeding complete!');
}

seed()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
```

**Run Seed**:

```bash
# From project root
pnpm seed

# Or from seed package
cd packages/seed
pnpm start
```

**When to Seed**:

- Initial database setup
- After reset in development
- Setting up test data
- After restore from backup (if needed)

**Idempotent Seeding**:

Ensure seed can run multiple times safely:

```typescript
async function seed() {
  // Delete existing data (dev only!)
  if (process.env.NODE_ENV === 'development') {
    await db.delete(accommodations);
  }

  // Insert data (with conflict handling)
  await db.insert(accommodations).values([...]).onConflictDoNothing();
}
```

### Reset

Reset database to clean state (development only).

**Reset Command**:

`packages/db/package.json`:

```json
{
  "scripts": {
    "db:reset": "drizzle-kit drop && drizzle-kit push:pg && pnpm seed"
  }
}
```

**Run Reset**:

```bash
cd packages/db
pnpm db:reset
```

**What It Does**:

1. **Drop all tables**: `drizzle-kit drop`
2. **Push schema**: `drizzle-kit push:pg`
3. **Seed data**: `pnpm seed`

**⚠️ WARNING**:

- **Only use in development**
- Deletes all data
- Cannot be undone
- **Never run in production**

**Safe Reset** (with confirmation):

```bash
#!/bin/bash
# scripts/reset-database.sh

read -p "This will DELETE all data. Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

cd packages/db
pnpm db:reset
```

### Studio

Open Drizzle Studio for visual database management.

**Start Studio**:

```bash
cd packages/db
pnpm db:studio
```

**Opens in Browser**:

```
http://localhost:4983
```

**Features**:

- **Browse Tables**: View all tables and data
- **Run Queries**: Execute SQL queries
- **Edit Data**: Add/update/delete records
- **View Relationships**: See foreign keys
- **Schema Viewer**: Visual schema diagram

**Use Cases**:

- Quickly inspect data
- Debug database issues
- Manual data entry
- Testing queries

**Security**:

- Only run locally (development)
- Requires `HOSPEDA_DATABASE_URL` in environment
- Never expose publicly

### Common Operations

#### Add Test Data

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
INSERT INTO accommodations (title, city, price_per_night, max_guests)
VALUES
  ('Test House', 'Concepción', 100.00, 4),
  ('Test Apartment', 'Concepción', 75.00, 2);
"
```

#### Clear Table

```bash
# Development only!
psql "$HOSPEDA_DATABASE_URL" -c "TRUNCATE accommodations CASCADE;"
```

#### Export Data

```bash
# Export to CSV
psql "$HOSPEDA_DATABASE_URL" -c "
COPY accommodations TO STDOUT WITH CSV HEADER
" > accommodations.csv

# Export specific columns
psql "$HOSPEDA_DATABASE_URL" -c "
COPY (SELECT id, title, city FROM accommodations) TO STDOUT WITH CSV HEADER
" > accommodations-summary.csv
```

#### Import Data

```bash
# Import from CSV
psql "$HOSPEDA_DATABASE_URL" -c "
COPY accommodations FROM STDIN WITH CSV HEADER
" < accommodations.csv
```

#### Count Records

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT
  'accommodations' AS table,
  COUNT(*) AS count
FROM accommodations
UNION ALL
SELECT
  'bookings',
  COUNT(*)
FROM bookings
UNION ALL
SELECT
  'reviews',
  COUNT(*)
FROM reviews;
"
```

#### Find Duplicate Records

```bash
psql "$HOSPEDA_DATABASE_URL" -c "
SELECT title, city, COUNT(*)
FROM accommodations
GROUP BY title, city
HAVING COUNT(*) > 1;
"
```

---

## Summary

This guide covered deploying and managing the Neon PostgreSQL database:

**Key Points**:

1. **Platform**: Neon serverless PostgreSQL
2. **ORM**: Drizzle with migrations
3. **Branching**: Git-like database branches for development
4. **Auto-Scaling**: Automatic compute scaling
5. **Backups**: Point-in-time recovery (7-30 days)
6. **Connection Pooling**: Built-in PgBouncer
7. **Security**: SSL, IP allowlisting, role management
8. **Monitoring**: Dashboard metrics and alerts

**Best Practices**:

1. **Development**:
   - Use separate database branch
   - Enable scale to zero
   - Use `db:push` for rapid prototyping
   - Generate migrations when feature is stable

1. **Staging**:
   - Create preview branches for PRs
   - Run migrations in CI/CD
   - Test migrations before production

1. **Production**:
   - Disable scale to zero
   - Enable connection pooling
   - Set up monitoring and alerts
   - Regular backups (point-in-time + manual)
   - 30-day retention period
   - Test migrations on preview branches first

**Workflows**:

**Feature Development**:

```bash
# 1. Create database branch
neonctl branches create --name feature-xyz

# 2. Update .env.local with branch connection string

# 3. Develop and test with db:push
pnpm db:push

# 4. Generate migration when stable
pnpm db:generate

# 5. Commit migration
git add drizzle/
git commit -m "feat(db): add xyz"

# 6. Merge to main (CI/CD runs migration)
```

**Production Deployment**:

```bash
# 1. Merge PR to main

# 2. CI/CD runs migration
# (Automated in GitHub Actions)

# 3. Verify migration
psql "$PROD_DATABASE_URL" -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 1;"

# 4. Monitor for issues
# (Neon dashboard)

# 5. Rollback if needed
neonctl branches create --name recovery --timestamp "2024-01-15T10:30:00Z"
```

**Next Steps**:

1. Create Neon project
2. Set up connection pooling
3. Configure branching strategy
4. Set up automated backups
5. Configure monitoring and alerts
6. Document recovery procedures

For API and admin deployment, see respective deployment guides.

---

**Document Version**: 1.0.0
**Last Reviewed**: 2024-01-15
**Maintained By**: DevOps Team
