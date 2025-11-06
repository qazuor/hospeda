# Database Migrations Guide

## Overview

This guide covers the complete workflow for managing database schema changes using Drizzle ORM in the Hospeda project. Migrations ensure that database schema changes are tracked, versioned, and safely applied across all environments.

**What You'll Learn**:

- Creating and applying migrations
- Managing schema changes safely
- Handling complex migration scenarios
- Best practices for production migrations
- Troubleshooting migration issues

**Prerequisites**:

- Understanding of PostgreSQL basics
- Familiarity with Drizzle ORM (see [Database Package CLAUDE.md](../../packages/db/CLAUDE.md))
- Local development environment set up

## Quick Start

### Creating Your First Migration

**Scenario**: Add a `rating` column to the `accommodations` table.

#### Step 1: Modify Schema

Edit the schema file:

```typescript
// packages/db/src/schemas/accommodation/table.ts
import { pgTable, uuid, varchar, decimal } from 'drizzle-orm/pg-core';

export const accommodationTable = pgTable('accommodations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  city: varchar('city', { length: 100 }).notNull(),

  // New column
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

#### Step 2: Generate Migration

```bash
cd packages/db
pnpm db:generate
```

**Output**:

```text
Drizzle Kit: Generating migration...
✔ Migration generated successfully!

📦 Migration: 0001_add_rating_to_accommodations.sql
📁 Location: packages/db/src/migrations/
```

#### Step 3: Review Generated SQL

```bash
# Open the generated migration file
cat src/migrations/0001_add_rating_to_accommodations.sql
```

**Generated SQL**:

```sql
-- Migration: 0001_add_rating_to_accommodations
-- Created at: 2024-11-06 10:30:00

ALTER TABLE "accommodations"
ADD COLUMN "rating" NUMERIC(3,2) DEFAULT '0.00';
```

#### Step 4: Apply Migration

```bash
pnpm db:migrate
```

**Output**:

```text
Drizzle Kit: Applying migrations...
✔ Migration 0001_add_rating_to_accommodations applied successfully!
```

#### Step 5: Verify Changes

```bash
# Open Drizzle Studio
pnpm db:studio

# Or use psql
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev \
  -c "\d accommodations"
```

**Success!** The `rating` column is now added to your database.

## Migration Workflow

### Complete Development Workflow

```mermaid
graph TD
    A[Identify Schema Change] --> B[Modify Schema File]
    B --> C[Run db:generate]
    C --> D[Review Generated SQL]
    D --> E{SQL Correct?}
    E -->|No| F[Edit Schema/Create Custom SQL]
    F --> C
    E -->|Yes| G[Run db:migrate locally]
    G --> H[Test Changes]
    H --> I{Tests Pass?}
    I -->|No| J[Fix Issues]
    J --> B
    I -->|Yes| K[Commit Migration]
    K --> L[Create Pull Request]
    L --> M[Review & Approve]
    M --> N[Merge to Main]
    N --> O[Deploy to Production]
    O --> P[Migration Runs Automatically]
```

### Step-by-Step Workflow

#### 1. Identify Schema Change

Determine what needs to change:

- Adding a new table
- Adding columns to existing table
- Modifying column types
- Adding indexes
- Adding foreign keys
- Renaming columns/tables

#### 2. Modify Schema File

Edit the appropriate schema file in `packages/db/src/schemas/`:

```typescript
// Example: Adding a new table
// packages/db/src/schemas/review/table.ts

import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const reviewTable = pgTable('reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  accommodationId: uuid('accommodation_id').notNull().references(() => accommodationTable.id),
  userId: varchar('user_id', { length: 255 }).notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

#### 3. Generate Migration

```bash
cd packages/db
pnpm db:generate
```

Drizzle Kit will:

- Compare your schema with current database state
- Generate SQL to apply changes
- Create a migration file with timestamp

#### 4. Review Generated SQL

**IMPORTANT**: Always review the generated SQL before applying!

```bash
# View the latest migration
ls -lt src/migrations/*.sql | head -1 | awk '{print $NF}' | xargs cat
```

Check for:

- Correct table names
- Correct column names and types
- Proper constraints (NOT NULL, DEFAULT, etc.)
- Foreign key relationships
- Index creation
- Data preservation

#### 5. Test Locally

```bash
# Apply migration
pnpm db:migrate

# Run tests to verify schema works
pnpm test

# Test manually with Drizzle Studio
pnpm db:studio
```

#### 6. Commit and Deploy

```bash
# Add migration files
git add src/migrations/
git add src/schemas/

# Commit with descriptive message
git commit -m "feat(db): add reviews table with ratings"

# Push to GitHub
git push origin feature/add-reviews
```

## Schema Changes

### Adding Tables

**When**: Creating a new entity type (e.g., reviews, bookings, amenities)

**Example**: Add a `bookings` table

```typescript
// packages/db/src/schemas/booking/table.ts
import { pgTable, uuid, varchar, timestamp, decimal } from 'drizzle-orm/pg-core';
import { accommodationTable } from '../accommodation/table';

export const bookingTable = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  accommodationId: uuid('accommodation_id')
    .notNull()
    .references(() => accommodationTable.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).notNull(),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Generate and Apply**:

```bash
pnpm db:generate  # Creates migration
pnpm db:migrate   # Applies migration
```

**Generated SQL**:

```sql
CREATE TABLE "bookings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "accommodation_id" UUID NOT NULL,
  "user_id" VARCHAR(255) NOT NULL,
  "check_in" TIMESTAMP NOT NULL,
  "check_out" TIMESTAMP NOT NULL,
  "total_price" NUMERIC(10,2) NOT NULL,
  "status" VARCHAR(50) DEFAULT 'pending' NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  FOREIGN KEY ("accommodation_id") REFERENCES "accommodations"("id") ON DELETE CASCADE
);
```

### Adding Columns

**When**: Adding new attributes to existing entities

**Example**: Add `phone` column to accommodations

```typescript
// packages/db/src/schemas/accommodation/table.ts
export const accommodationTable = pgTable('accommodations', {
  // ... existing columns
  phone: varchar('phone', { length: 20 }),  // Add this line
  // ... rest of columns
});
```

**Generate and Apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

**Generated SQL**:

```sql
ALTER TABLE "accommodations"
ADD COLUMN "phone" VARCHAR(20);
```

#### Adding Non-Nullable Columns (Safe Pattern)

**Problem**: Adding a non-nullable column to a table with existing data will fail.

**Solution**: Two-step process

#### Step 1: Add Column as Nullable with Default

```typescript
export const accommodationTable = pgTable('accommodations', {
  // ... existing columns
  email: varchar('email', { length: 255 }).default('noreply@hospeda.com'),
});
```

**Generate and apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

#### Step 2: Populate Data and Make Non-Nullable

After data is populated:

```typescript
export const accommodationTable = pgTable('accommodations', {
  // ... existing columns
  email: varchar('email', { length: 255 }).notNull(),
});
```

**Generate and apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

### Modifying Columns

**When**: Changing column types, constraints, or defaults

**Example**: Change `rating` from DECIMAL to INTEGER

```typescript
// Before
rating: decimal('rating', { precision: 3, scale: 2 })

// After
rating: integer('rating')
```

**Generate**:

```bash
pnpm db:generate
```

**Review Generated SQL**:

```sql
-- Drizzle generates ALTER TABLE statements
ALTER TABLE "accommodations"
ALTER COLUMN "rating" TYPE INTEGER;
```

**⚠️ WARNING**: Type changes can cause data loss! Always:

1. Test with production data sample
2. Create backup before applying
3. Consider creating new column instead

### Adding Indexes

**When**: Optimizing query performance for frequently filtered/sorted columns

**Example**: Add index for city lookups

```typescript
// packages/db/src/schemas/accommodation/table.ts
import { pgTable, uuid, varchar, index } from 'drizzle-orm/pg-core';

export const accommodationTable = pgTable('accommodations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  // ... other columns
}, (table) => ({
  // Define indexes here
  cityIdx: index('idx_accommodations_city').on(table.city),
}));
```

**Generate and Apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

**Generated SQL**:

```sql
CREATE INDEX "idx_accommodations_city" ON "accommodations" ("city");
```

**Composite Index**:

```typescript
// Index on multiple columns
export const accommodationTable = pgTable('accommodations', {
  // ... columns
}, (table) => ({
  cityStatusIdx: index('idx_accommodations_city_status')
    .on(table.city, table.isActive),
}));
```

**Generated SQL**:

```sql
CREATE INDEX "idx_accommodations_city_status"
ON "accommodations" ("city", "is_active");
```

### Adding Foreign Keys

**When**: Establishing relationships between tables

**Example**: Link bookings to accommodations

```typescript
// packages/db/src/schemas/booking/table.ts
export const bookingTable = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Foreign key to accommodations table
  accommodationId: uuid('accommodation_id')
    .notNull()
    .references(() => accommodationTable.id, {
      onDelete: 'cascade',  // Delete bookings when accommodation deleted
      onUpdate: 'cascade',  // Update if ID changes (rare)
    }),

  // ... other columns
});
```

**Cascade Options**:

- `cascade`: Delete/update child rows when parent is deleted/updated
- `restrict`: Prevent deletion/update if child rows exist
- `set null`: Set foreign key to NULL when parent deleted
- `no action`: Default, similar to restrict

**Generate and Apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

**Generated SQL**:

```sql
ALTER TABLE "bookings"
ADD CONSTRAINT "bookings_accommodation_id_fkey"
FOREIGN KEY ("accommodation_id")
REFERENCES "accommodations"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
```

### Renaming Columns

**Problem**: Drizzle may interpret rename as "drop + add" which loses data!

**Solution**: Create custom migration

#### Step 1: Rename in Schema

```typescript
// Before
oldName: varchar('old_name', { length: 255 })

// After
newName: varchar('new_name', { length: 255 })
```

#### Step 2: Generate Migration

```bash
pnpm db:generate
```

#### Step 3: Edit Generated SQL

Drizzle generates (WRONG):

```sql
ALTER TABLE "accommodations" DROP COLUMN "old_name";
ALTER TABLE "accommodations" ADD COLUMN "new_name" VARCHAR(255);
```

Edit to (CORRECT):

```sql
-- Rename column preserving data
ALTER TABLE "accommodations"
RENAME COLUMN "old_name" TO "new_name";
```

#### Step 4: Apply Migration

```bash
pnpm db:migrate
```

### Renaming Tables

**Same issue as columns** - requires custom SQL

#### Step 1: Rename in Schema

```typescript
// Before
export const oldTable = pgTable('old_table', { /* ... */ });

// After
export const newTable = pgTable('new_table', { /* ... */ });
```

#### Step 2: Edit Generated SQL

Change from:

```sql
DROP TABLE "old_table";
CREATE TABLE "new_table" ( /* ... */ );
```

To:

```sql
ALTER TABLE "old_table" RENAME TO "new_table";
```

## Migration Best Practices

### 1. Always Review Generated SQL

**Why**: Drizzle's inference is good but not perfect

**How**:

```bash
# After generating migration
cd packages/db/src/migrations
ls -lt *.sql | head -1 | awk '{print $NF}' | xargs cat
```

**Look for**:

- Data loss risks (DROP COLUMN, DROP TABLE)
- Performance issues (adding indexes on large tables without CONCURRENTLY)
- Constraint violations (adding NOT NULL to existing data)

### 2. Test Migrations Locally First

**Always test on local database before production!**

```bash
# Test migration
pnpm db:migrate

# Run full test suite
pnpm test

# Manual testing with sample data
pnpm db:studio
```

### 3. Backwards Compatibility

**Principle**: New code should work with old schema

**Example**: Adding optional column

```typescript
// ✅ Good: Optional column (nullable)
newColumn: varchar('new_column', { length: 255 })

// ❌ Bad: Required column (breaks old code)
newColumn: varchar('new_column', { length: 255 }).notNull()
```

**Strategy**:

1. Deploy code that works with both schemas
2. Run migration
3. Deploy code that requires new schema

### 4. Data Migrations vs Schema Migrations

**Schema Migration**: Changes table structure

```sql
ALTER TABLE accommodations ADD COLUMN rating NUMERIC(3,2);
```

**Data Migration**: Changes actual data

```sql
UPDATE accommodations SET rating = 0.00 WHERE rating IS NULL;
```

**Best Practice**: Keep separate

- Schema migration: Generated by Drizzle
- Data migration: Custom script or separate migration

**Example**: Populate new column

```sql
-- 0001_add_rating_column.sql (schema)
ALTER TABLE accommodations ADD COLUMN rating NUMERIC(3,2);

-- 0002_populate_rating.sql (data)
UPDATE accommodations
SET rating = (
  SELECT AVG(rating)
  FROM reviews
  WHERE reviews.accommodation_id = accommodations.id
)
WHERE rating IS NULL;
```

### 5. Migration File Naming

**Convention**: Drizzle uses timestamps

```text
0001_add_rating_to_accommodations.sql
0002_create_reviews_table.sql
0003_add_booking_status_index.sql
```

**Tips**:

- Keep names descriptive
- Use snake_case
- Mention affected table
- One change per migration (when possible)

### 6. Never Modify Existing Migrations

**Rule**: Once a migration is in `main` branch, never modify it

**Why**: Other developers may have already applied it

**If migration has a bug**:

```bash
# ❌ DON'T edit existing migration
vim 0001_add_rating.sql  # BAD!

# ✅ DO create a new migration to fix it
pnpm db:generate  # Creates 0002_fix_rating.sql
```

### 7. Database Backups

**Before production migrations**:

```bash
# Manual backup (if using Docker locally)
docker exec hospeda_postgres pg_dump -U hospeda_user hospeda_dev > backup.sql

# Restore if needed
docker exec -i hospeda_postgres psql -U hospeda_user hospeda_dev < backup.sql
```

**Production** (Neon):

- Neon automatically creates point-in-time backups
- Can restore to any point in last 7 days (varies by plan)
- Manual backups via Neon Console

## Common Patterns

### Pattern 1: Adding Table with Relations

**Scenario**: Add `amenities` table linked to accommodations

```typescript
// packages/db/src/schemas/amenity/table.ts
export const amenityTable = pgTable('amenities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Join table for many-to-many relationship
export const accommodationAmenityTable = pgTable('accommodation_amenities', {
  accommodationId: uuid('accommodation_id')
    .notNull()
    .references(() => accommodationTable.id, { onDelete: 'cascade' }),
  amenityId: uuid('amenity_id')
    .notNull()
    .references(() => amenityTable.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey(table.accommodationId, table.amenityId),
}));
```

**Generate and apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

### Pattern 2: Adding Enum Column

**Scenario**: Add `status` enum to bookings

#### Step 1: Create PostgreSQL Enum

```typescript
// packages/db/src/schemas/enums.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
]);
```

#### Step 2: Use in Table

```typescript
// packages/db/src/schemas/booking/table.ts
import { bookingStatusEnum } from '../enums';

export const bookingTable = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: bookingStatusEnum('status').default('pending').notNull(),
  // ... other columns
});
```

**Generate and apply**:

```bash
pnpm db:generate
pnpm db:migrate
```

**Generated SQL**:

```sql
-- Create enum type
CREATE TYPE "booking_status" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Add column using enum
ALTER TABLE "bookings"
ADD COLUMN "status" booking_status DEFAULT 'pending' NOT NULL;
```

### Pattern 3: Adding Timestamps

**Standard pattern** for all tables:

```typescript
export const myTable = pgTable('my_table', {
  id: uuid('id').defaultRandom().primaryKey(),

  // ... other columns

  // Audit timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),  // For soft deletes
});
```

### Pattern 4: Full-Text Search

**Scenario**: Add full-text search to accommodations

```typescript
// Add tsvector column for search
export const accommodationTable = pgTable('accommodations', {
  // ... existing columns
  searchVector: tsvector('search_vector'),
}, (table) => ({
  searchIdx: index('idx_accommodations_search').using('gin', table.searchVector),
}));
```

**Custom SQL migration** (after generating):

```sql
-- Add column
ALTER TABLE accommodations
ADD COLUMN search_vector tsvector;

-- Create GIN index for fast search
CREATE INDEX idx_accommodations_search
ON accommodations USING gin(search_vector);

-- Create trigger to auto-update search vector
CREATE FUNCTION accommodations_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(NEW.city, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accommodations_search_update
BEFORE INSERT OR UPDATE ON accommodations
FOR EACH ROW EXECUTE FUNCTION accommodations_search_trigger();
```

### Pattern 5: JSON Column

**Scenario**: Store flexible metadata

```typescript
import { pgTable, uuid, jsonb } from 'drizzle-orm/pg-core';

export const accommodationTable = pgTable('accommodations', {
  id: uuid('id').defaultRandom().primaryKey(),
  // ... other columns

  // JSON column for flexible data
  metadata: jsonb('metadata').$type<{
    checkInTime?: string;
    checkOutTime?: string;
    houseRules?: string[];
    [key: string]: unknown;
  }>(),
});
```

## Troubleshooting

### Issue 1: Migration Generation Fails

**Error**:

```text
Error: Unable to connect to database
Error: Schema file not found
```

**Solutions**:

#### Solution 1: Check Database Connection

```bash
# Test connection
docker exec -it hospeda_postgres psql -U hospeda_user -d hospeda_dev

# If fails, start database
docker compose up -d postgres
```

#### Solution 2: Verify drizzle.config.ts

```typescript
// packages/db/drizzle.config.ts
export default {
  schema: './src/schemas',  // Correct path?
  out: './src/migrations',  // Output directory exists?
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.HOSPEDA_DATABASE_URL || ''
  }
} satisfies Config;
```

#### Solution 3: Check Environment Variable

```bash
echo $HOSPEDA_DATABASE_URL

# Should output: postgresql://user:password@host:port/database
```

### Issue 2: Migration Conflicts

**Error**:

```text
Error: Migration 0001_xxx already applied
Error: Duplicate column name
```

#### Solution 1: Check Migration History

```sql
-- See applied migrations
SELECT * FROM drizzle_migrations;
```

#### Solution 2: Reset Local Database

```bash
# ⚠️ WARNING: Deletes all data!
docker compose down -v
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
```

#### Solution 3: Manual Fix

If duplicate column:

```sql
-- Check if column exists
\d accommodations

-- Drop duplicate if safe
ALTER TABLE accommodations DROP COLUMN duplicate_column;
```

### Issue 3: Migration Fails to Apply

**Error**:

```text
Error: constraint violation
Error: null value in column "xxx" violates not-null constraint
```

#### Solution 1: Check Existing Data

```sql
-- Check for null values
SELECT COUNT(*) FROM accommodations WHERE email IS NULL;
```

#### Solution 2: Populate Nulls Before Migration

```sql
-- Add default value first
UPDATE accommodations SET email = 'noreply@hospeda.com' WHERE email IS NULL;
```

#### Solution 3: Modify Migration

```sql
-- Instead of adding NOT NULL directly
ALTER TABLE accommodations ADD COLUMN email VARCHAR(255);
UPDATE accommodations SET email = 'noreply@hospeda.com' WHERE email IS NULL;
ALTER TABLE accommodations ALTER COLUMN email SET NOT NULL;
```

### Issue 4: Rollback Needed

#### Drizzle Doesn't Support Automatic Rollback

**Manual rollback**:

#### Option 1: Restore from Backup

```bash
# Restore database from backup
docker exec -i hospeda_postgres psql -U hospeda_user hospeda_dev < backup.sql
```

#### Option 2: Write Reverse Migration

```sql
-- If migration added column
ALTER TABLE accommodations DROP COLUMN rating;

-- If migration created table
DROP TABLE reviews;

-- If migration added index
DROP INDEX idx_accommodations_city;
```

#### Option 3: Reset and Replay

```bash
# Last resort: reset and replay all migrations except problematic one
docker compose down -v
docker compose up -d postgres
# Manually remove problematic migration from src/migrations/
pnpm db:migrate
```

### Issue 5: Slow Migration

**Problem**: Migration takes too long (> 1 minute)

**Common causes**:

1. Adding index on large table without CONCURRENTLY
2. Updating all rows in large table
3. Complex data transformation

**Solutions**:

**Solution 1: Use CONCURRENTLY for indexes** (PostgreSQL 11+)

```sql
-- Instead of
CREATE INDEX idx_accommodations_city ON accommodations(city);

-- Use
CREATE INDEX CONCURRENTLY idx_accommodations_city ON accommodations(city);
```

**Note**: Can't use inside transaction, requires separate migration

#### Solution 2: Batch Updates

```sql
-- Instead of updating all at once
UPDATE accommodations SET rating = 0.00;

-- Update in batches
DO $$
DECLARE
  batch_size INTEGER := 1000;
  rows_updated INTEGER;
BEGIN
  LOOP
    UPDATE accommodations
    SET rating = 0.00
    WHERE id IN (
      SELECT id FROM accommodations
      WHERE rating IS NULL
      LIMIT batch_size
    );

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;

    COMMIT;
  END LOOP;
END $$;
```

## Production Migrations

### Zero-Downtime Migrations

**Principles**:

1. Deploy compatible code before schema change
2. Run migration
3. Deploy code that requires new schema

**Example**: Adding required column

#### Step 1: Deploy Code with Optional Handling

```typescript
// Code works with OR without new column
function getAccommodation(id: string) {
  const accommodation = await db.query.accommodations.findFirst({
    where: eq(accommodations.id, id),
  });

  // Handle missing column gracefully
  const rating = accommodation.rating ?? 0;

  return { ...accommodation, rating };
}
```

#### Step 2: Run Migration

```bash
# Add column as nullable first
ALTER TABLE accommodations ADD COLUMN rating NUMERIC(3,2);
```

#### Step 3: Deploy Code Requiring Column

```typescript
// Now assume column always exists
function getAccommodation(id: string) {
  const accommodation = await db.query.accommodations.findFirst({
    where: eq(accommodations.id, id),
  });

  return accommodation; // rating always present
}
```

### Backup Before Migration

**Local** (Docker):

```bash
# Backup
docker exec hospeda_postgres pg_dump -U hospeda_user -Fc hospeda_dev > backup.dump

# Restore if needed
docker exec -i hospeda_postgres pg_restore -U hospeda_user -d hospeda_dev < backup.dump
```

**Production** (Neon):

1. Go to Neon Console
2. Select project and branch
3. Click "Restore" to create point-in-time restore point
4. Note timestamp for rollback reference

### Monitoring During Migration

**Watch for**:

- Long-running queries (> 30 seconds)
- Lock contention
- Error rate increases
- Response time degradation

**PostgreSQL monitoring**:

```sql
-- Check active queries
SELECT pid, usename, state, query, now() - query_start as duration
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;

-- Check locks
SELECT
  locktype,
  relation::regclass,
  mode,
  granted
FROM pg_locks
WHERE NOT granted;
```

**If issues detected**:

1. Monitor error rates
2. Check application logs
3. Verify migration progress
4. Be ready to rollback if necessary

## Migration Checklist

### Before Creating Migration

- [ ] Identified specific schema change needed
- [ ] Reviewed existing schema structure
- [ ] Planned backwards compatibility approach
- [ ] Considered data migration needs
- [ ] Checked for dependent tables/columns

### Creating Migration

- [ ] Modified schema file correctly
- [ ] Ran `pnpm db:generate`
- [ ] Reviewed generated SQL carefully
- [ ] Verified no data loss risks
- [ ] Checked for performance implications
- [ ] Edited custom SQL if needed (renames, etc.)

### Testing Migration

- [ ] Applied migration locally: `pnpm db:migrate`
- [ ] Verified schema change with Drizzle Studio
- [ ] Ran full test suite: `pnpm test`
- [ ] Manually tested affected features
- [ ] Verified backwards compatibility
- [ ] Tested rollback procedure (if applicable)

### Before Production

- [ ] Migration reviewed by team
- [ ] Created database backup
- [ ] Planned deployment window (if needed)
- [ ] Notified stakeholders (if downtime expected)
- [ ] Prepared rollback plan
- [ ] Documented breaking changes (if any)

### Production Deployment

- [ ] Deployed compatible code first (if needed)
- [ ] Ran migration (automatically or manually)
- [ ] Monitored error rates and performance
- [ ] Verified migration completed successfully
- [ ] Deployed code requiring new schema (if needed)
- [ ] Checked application health

### After Deployment

- [ ] Verified feature works in production
- [ ] Monitored for 24 hours
- [ ] Updated documentation if needed
- [ ] Closed related tickets/issues

## Related Documentation

- [Database Package CLAUDE.md](../../packages/db/CLAUDE.md) - DB package overview
- [Drizzle ORM Documentation](https://orm.drizzle.team) - Official Drizzle docs
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - PostgreSQL reference
- [Adding New Entity](./adding-new-entity.md) - Entity creation guide
- [Architecture Overview](../architecture/README.md) - System architecture

## Quick Reference

### Commands

```bash
# Generate migration from schema changes
cd packages/db && pnpm db:generate

# Apply pending migrations
cd packages/db && pnpm db:migrate

# Open Drizzle Studio (visual DB tool)
cd packages/db && pnpm db:studio

# Reset database (⚠️ deletes data!)
docker compose down -v && docker compose up -d
cd packages/db && pnpm db:migrate && pnpm db:seed
```

### Common SQL Patterns

```sql
-- Add column with default
ALTER TABLE table_name ADD COLUMN column_name TYPE DEFAULT value;

-- Add NOT NULL constraint
ALTER TABLE table_name ALTER COLUMN column_name SET NOT NULL;

-- Remove NOT NULL constraint
ALTER TABLE table_name ALTER COLUMN column_name DROP NOT NULL;

-- Rename column
ALTER TABLE table_name RENAME COLUMN old_name TO new_name;

-- Add index
CREATE INDEX idx_table_column ON table_name(column_name);

-- Add foreign key
ALTER TABLE table_name ADD CONSTRAINT fk_name
FOREIGN KEY (column_name) REFERENCES other_table(id);

-- Drop column
ALTER TABLE table_name DROP COLUMN column_name;
```

---

**Last Updated**: 2025-11-06
**Maintained By**: Tech Writer Agent
