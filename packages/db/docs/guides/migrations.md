# Migrations

Complete guide to database migration workflow with Drizzle ORM in the Hospeda project.

## Introduction

Database migrations are version-controlled changes to your database schema. They allow you to:

- **Track schema changes** over time in version control
- **Apply changes** consistently across environments (dev, staging, production)
- **Rollback** changes if needed (with manual SQL)
- **Collaborate** with team members on schema evolution
- **Document** schema decisions and changes

## Migration Basics

### What Are Migrations

Migrations are SQL files that modify your database schema:

```sql
-- Migration: Add products table
CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX "products_name_idx" ON "products" ("name");
```

Each migration:

- Has a unique timestamp and name
- Runs exactly once per database
- Is tracked in a migrations table
- Cannot be modified once applied

### Why Use Migrations

**Without migrations:**

```typescript
// Developer A adds a column
await db.execute(sql`ALTER TABLE products ADD COLUMN stock INTEGER`);

// Developer B doesn't know about this change
// Production database is out of sync
// Manual coordination required
```

**With migrations:**

```typescript
// Developer A generates migration
pnpm db:generate
// Migration: 0001_add_stock_column.sql is created

// Developer B pulls changes
git pull

// Developer B applies migration
pnpm db:migrate
// Database is automatically updated
```

### When to Create Migrations

Create a new migration when you:

- ✅ Add a new table
- ✅ Add/remove columns
- ✅ Change column types
- ✅ Add/remove constraints
- ✅ Add/remove indexes
- ✅ Add/remove enum values
- ✅ Rename tables or columns

Don't create migrations for:

- ❌ Changes to application code
- ❌ Seed data (use seed scripts instead)
- ❌ Temporary development experiments

## Generating Migrations

### Basic Generation

After modifying a Drizzle schema, generate a migration:

```bash
cd packages/db
pnpm db:generate
```

This command:

1. Reads your Drizzle schemas
2. Compares them to the current database state
3. Generates SQL for the differences
4. Creates a timestamped migration file

### Migration File Location

Migrations are stored in:

```text
packages/db/drizzle/migrations/
├── 0000_initial_schema.sql
├── 0001_add_products.sql
├── 0002_add_categories.sql
└── meta/
    ├── _journal.json
    └── 0002_snapshot.json
```

### Migration Naming

Drizzle auto-generates names like:

```text
0001_create_products_table.sql
0002_add_stock_column.sql
0003_remove_old_index.sql
```

Format: `{number}_{description}.sql`

- Number: Auto-incremented sequence
- Description: Generated from your changes

### Example: Adding a Table

**1. Create schema:**

```typescript
// packages/db/src/schemas/catalog/product.dbschema.ts
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
```

**2. Generate migration:**

```bash
pnpm db:generate
```

**3. Review generated SQL:**

```sql
-- drizzle/migrations/0001_create_products.sql
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "price" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

## Applying Migrations

### Apply All Pending Migrations

```bash
cd packages/db
pnpm db:migrate
```

This command:

1. Checks which migrations have been applied
2. Runs any new migrations in order
3. Records them in the `__drizzle_migrations` table

### Migration Tracking

Drizzle tracks applied migrations in a special table:

```sql
-- Auto-created by Drizzle
CREATE TABLE __drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
```

### Apply Migrations in CI/CD

In your deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Run database migrations
  run: |
    cd packages/db
    pnpm db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

> **Important**: Always run migrations before deploying application code to ensure schema is up-to-date.

## Migration Files

### File Structure

```sql
-- Migration file: 0001_create_products.sql

-- Create table
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "price" integer NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" ("name");
CREATE INDEX IF NOT EXISTS "products_price_idx" ON "products" ("price");

-- Add constraints
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive"
  CHECK ("price" > 0);
```

### SQL Syntax Guidelines

**Use IF NOT EXISTS:**

```sql
-- ✅ Safe: won't fail if table exists
CREATE TABLE IF NOT EXISTS "products" ( /* ... */ );

-- ❌ Unsafe: fails if table exists
CREATE TABLE "products" ( /* ... */ );
```

**Use IF EXISTS:**

```sql
-- ✅ Safe: won't fail if index doesn't exist
DROP INDEX IF EXISTS "old_index";

-- ❌ Unsafe: fails if index doesn't exist
DROP INDEX "old_index";
```

**Quote identifiers:**

```sql
-- ✅ Correct: quoted identifiers
CREATE TABLE "products" ( "id" uuid, "name" text );

-- ❌ Wrong: unquoted (can break with reserved keywords)
CREATE TABLE products ( id uuid, name text );
```

### Manual Migrations

Sometimes you need to write migrations manually:

**Example: Add column with data backfill**

```sql
-- 0005_add_slug_column.sql

-- Step 1: Add column (nullable initially)
ALTER TABLE "products" ADD COLUMN "slug" text;

-- Step 2: Backfill data
UPDATE "products" SET "slug" = lower(replace("name", ' ', '-'));

-- Step 3: Make it NOT NULL and UNIQUE
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "products_slug_unique" ON "products" ("slug");
```

**Example: Complex data migration**

```sql
-- 0006_normalize_prices.sql

-- Convert prices from dollars to cents
UPDATE "products" SET "price" = "price" * 100;

-- Change column type
ALTER TABLE "products" ALTER COLUMN "price" TYPE integer USING ("price"::integer);
```

## Common Patterns

### Adding Columns

**Non-nullable column with default:**

```sql
-- Generated by Drizzle
ALTER TABLE "products" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
```

**Nullable column:**

```sql
ALTER TABLE "products" ADD COLUMN "description" text;
```

**Column with backfill:**

```sql
-- Add nullable first
ALTER TABLE "products" ADD COLUMN "category_id" uuid;

-- Backfill data
UPDATE "products" SET "category_id" = 'default-category-uuid';

-- Make NOT NULL
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;

-- Add foreign key
ALTER TABLE "products" ADD CONSTRAINT "products_category_fk"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id");
```

### Changing Column Types

**Safe type changes:**

```sql
-- Increase varchar length
ALTER TABLE "products" ALTER COLUMN "name" TYPE varchar(500);

-- Integer to bigint
ALTER TABLE "products" ALTER COLUMN "view_count" TYPE bigint;

-- Text to varchar (if data fits)
ALTER TABLE "products" ALTER COLUMN "slug" TYPE varchar(255);
```

**Risky type changes:**

```sql
-- May lose data!
ALTER TABLE "products" ALTER COLUMN "price" TYPE integer USING ("price"::integer);

-- May fail if data doesn't fit
ALTER TABLE "products" ALTER COLUMN "name" TYPE varchar(50);
```

> **Tip**: Test type changes on a copy of production data first.

### Adding Indexes

**Simple index:**

```sql
CREATE INDEX "products_name_idx" ON "products" ("name");
```

**Composite index:**

```sql
CREATE INDEX "products_category_active_idx"
  ON "products" ("category_id", "is_active");
```

**Unique index:**

```sql
CREATE UNIQUE INDEX "products_slug_unique" ON "products" ("slug");
```

**Partial index:**

```sql
-- Index only active products
CREATE INDEX "products_active_idx"
  ON "products" ("name")
  WHERE "is_active" = true;
```

**Concurrent index (zero downtime):**

```sql
-- Won't lock table
CREATE INDEX CONCURRENTLY "products_name_idx" ON "products" ("name");
```

> **Note**: Concurrent indexes are slower to build but don't block writes. Use in production for large tables.

### Adding Foreign Keys

```sql
-- Add column first
ALTER TABLE "products" ADD COLUMN "category_id" uuid;

-- Add foreign key constraint
ALTER TABLE "products" ADD CONSTRAINT "products_category_fk"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE RESTRICT;
```

**With cascading:**

```sql
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_fk"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE;
```

### Removing Columns

```sql
-- Drop column
ALTER TABLE "products" DROP COLUMN IF EXISTS "old_field";

-- Drop multiple columns
ALTER TABLE "products"
  DROP COLUMN IF EXISTS "old_field1",
  DROP COLUMN IF EXISTS "old_field2";
```

> **Warning**: Dropping columns is irreversible. Backup data first!

### Renaming Tables/Columns

```sql
-- Rename table
ALTER TABLE "old_products" RENAME TO "products";

-- Rename column
ALTER TABLE "products" RENAME COLUMN "old_name" TO "name";
```

> **Important**: Update all references in code before applying rename migrations.

### Adding Enum Values

```sql
-- Safe: append to end
ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'super_admin';

-- Specify position
ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'moderator' AFTER 'user';
```

> **Warning**: PostgreSQL doesn't support removing enum values. Plan carefully.

## Best Practices

### 1. Always Review Generated SQL

```bash
# Generate migration
pnpm db:generate

# Review the SQL file before applying
cat drizzle/migrations/0003_new_migration.sql
```

### 2. One Logical Change Per Migration

**✅ Good:**

```sql
-- 0001_add_products_table.sql
CREATE TABLE "products" ( /* ... */ );
CREATE INDEX "products_name_idx" ON "products" ("name");
```

```sql
-- 0002_add_categories_table.sql
CREATE TABLE "categories" ( /* ... */ );
```

**❌ Bad:**

```sql
-- 0001_add_everything.sql
CREATE TABLE "products" ( /* ... */ );
CREATE TABLE "categories" ( /* ... */ );
CREATE TABLE "orders" ( /* ... */ );
-- Too many changes in one migration!
```

### 3. Test Migrations on Copy of Production

```bash
# Backup production database
pg_dump $PROD_DATABASE_URL > backup.sql

# Restore to local
psql $LOCAL_DATABASE_URL < backup.sql

# Test migration
pnpm db:migrate

# Verify data integrity
pnpm db:studio
```

### 4. Make Migrations Idempotent

```sql
-- ✅ Idempotent: can run multiple times safely
CREATE TABLE IF NOT EXISTS "products" ( /* ... */ );
DROP TABLE IF EXISTS "old_products";

-- ❌ Not idempotent: fails on second run
CREATE TABLE "products" ( /* ... */ );
DROP TABLE "old_products";
```

### 5. Add Comments for Complex Migrations

```sql
-- 0005_complex_price_migration.sql

-- Convert prices from dollars to cents
-- Rationale: Avoid floating point precision issues
-- Impact: All products, approximately 10,000 rows
UPDATE "products" SET "price" = "price" * 100;

-- Change type to integer
ALTER TABLE "products" ALTER COLUMN "price" TYPE integer USING ("price"::integer);
```

### 6. Coordinate Schema and Code Changes

**Migration order for breaking changes:**

1. **Phase 1**: Add new column (nullable)
2. **Phase 2**: Deploy code that writes to both old and new columns
3. **Phase 3**: Backfill data from old to new column
4. **Phase 4**: Make new column NOT NULL
5. **Phase 5**: Deploy code that only uses new column
6. **Phase 6**: Drop old column

**Example:**

```sql
-- Phase 1: Add new column
ALTER TABLE "products" ADD COLUMN "slug" text;

-- (Deploy code that writes slug on create/update)

-- Phase 3: Backfill
UPDATE "products" SET "slug" = lower(replace("name", ' ', '-'))
WHERE "slug" IS NULL;

-- Phase 4: Make NOT NULL
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;

-- (Deploy code that only uses slug)

-- Phase 6: Drop old column if needed
-- ALTER TABLE "products" DROP COLUMN "name_slug";
```

### 7. Keep Migrations Atomic

```sql
-- ✅ Good: Use transaction (Drizzle does this automatically)
BEGIN;
  CREATE TABLE "products" ( /* ... */ );
  CREATE INDEX "products_name_idx" ON "products" ("name");
COMMIT;

-- ❌ Bad: No transaction (partial failure leaves inconsistent state)
CREATE TABLE "products" ( /* ... */ );
-- If this fails, table exists but index doesn't
CREATE INDEX "products_name_idx" ON "products" ("name");
```

> **Note**: Some DDL statements in PostgreSQL can't be rolled back (e.g., `CREATE INDEX CONCURRENTLY`).

### 8. Version Control Migrations

```bash
# Always commit migrations
git add packages/db/drizzle/migrations/
git commit -m "feat(db): add products table migration"
```

## Rollback Strategies

Drizzle doesn't support automatic rollbacks. To rollback:

### Option 1: Manual Rollback SQL

Create a corresponding down migration:

```sql
-- 0003_add_products.sql (up migration)
CREATE TABLE "products" ( /* ... */ );

-- 0003_add_products_rollback.sql (down migration)
DROP TABLE IF EXISTS "products";
```

Apply manually:

```bash
psql $DATABASE_URL < 0003_add_products_rollback.sql
```

### Option 2: Restore from Backup

```bash
# Restore database from backup
pg_restore -d $DATABASE_URL backup.dump

# Re-apply migrations up to desired point
pnpm db:migrate
```

### Option 3: Forward-Fix

Create a new migration to undo the change:

```sql
-- 0004_remove_products.sql
DROP TABLE IF EXISTS "products";
```

> **Best practice**: Always backup before applying migrations in production.

## Advanced Topics

### Zero-Downtime Migrations

For large tables in production:

**1. Add column as nullable:**

```sql
-- Won't lock table for long
ALTER TABLE "products" ADD COLUMN "new_field" text;
```

**2. Backfill in batches:**

```sql
-- Process in chunks to avoid long locks
UPDATE "products" SET "new_field" = 'default'
WHERE "id" IN (
  SELECT "id" FROM "products"
  WHERE "new_field" IS NULL
  LIMIT 1000
);
-- Repeat until done
```

**3. Add constraint:**

```sql
ALTER TABLE "products" ALTER COLUMN "new_field" SET NOT NULL;
```

### Handling Large Datasets

```sql
-- ❌ Bad: Locks table for entire update
UPDATE "products" SET "price" = "price" * 100;

-- ✅ Good: Batch updates
DO $$
DECLARE
  batch_size INTEGER := 1000;
  affected INTEGER;
BEGIN
  LOOP
    UPDATE "products" SET "price" = "price" * 100
    WHERE "id" IN (
      SELECT "id" FROM "products"
      WHERE "price" < 1000  -- Identify unprocessed rows
      LIMIT batch_size
    );

    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected = 0;

    -- Small delay to allow other queries
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;
```

### Multi-Schema Migrations

If you use multiple PostgreSQL schemas:

```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS "audit";

-- Create table in schema
CREATE TABLE "audit"."logs" ( /* ... */ );
```

### Seed Data in Migrations

```sql
-- 0010_seed_default_categories.sql
INSERT INTO "categories" ("id", "name", "slug") VALUES
  (gen_random_uuid(), 'Electronics', 'electronics'),
  (gen_random_uuid(), 'Books', 'books'),
  (gen_random_uuid(), 'Clothing', 'clothing')
ON CONFLICT ("slug") DO NOTHING;
```

> **Note**: Use `ON CONFLICT DO NOTHING` to make it idempotent.

## Troubleshooting

### Error: "relation already exists"

**Cause**: Migration already applied or table created manually.

**Fix**: Use `IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS "products" ( /* ... */ );
```

### Error: "column already exists"

**Cause**: Column already added.

**Fix**: Use `IF NOT EXISTS` (PostgreSQL 9.6+):

```sql
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock" integer;
```

### Error: "migration file not found"

**Cause**: Generated migration wasn't committed.

**Fix**: Generate migration and commit:

```bash
pnpm db:generate
git add drizzle/migrations/
git commit -m "feat(db): add migration"
```

### Migration Hangs

**Cause**: Table locked by other connection.

**Fix**: Check locks:

```sql
-- Find blocking queries
SELECT
  pid,
  usename,
  pg_blocking_pids(pid) as blocked_by,
  query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0;
```

Terminate blocking connection:

```sql
SELECT pg_terminate_backend(pid);
```

### Data Loss After Migration

**Prevention**:

1. ✅ Always backup before migration
2. ✅ Test on copy of production data
3. ✅ Review migration SQL carefully
4. ✅ Use transactions when possible

**Recovery**:

```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup.dump
```

## Workflow Summary

### Development Workflow

```bash
# 1. Modify schema
vim packages/db/src/schemas/product.dbschema.ts

# 2. Generate migration
cd packages/db
pnpm db:generate

# 3. Review migration
cat drizzle/migrations/0005_new_migration.sql

# 4. Apply migration
pnpm db:migrate

# 5. Verify in database
pnpm db:studio

# 6. Commit migration
git add drizzle/migrations/
git commit -m "feat(db): add new migration"
```

### Production Deployment

```bash
# 1. Backup database
pg_dump $PROD_DATABASE_URL > backup.sql

# 2. Pull latest code
git pull origin main

# 3. Run migrations
cd packages/db
DATABASE_URL=$PROD_DATABASE_URL pnpm db:migrate

# 4. Verify
DATABASE_URL=$PROD_DATABASE_URL pnpm db:studio

# 5. Deploy application
pnpm deploy
```

## Related Guides

- [Drizzle Schemas](./drizzle-schemas.md) - Define schemas
- [Creating Models](./creating-models.md) - Build models
- [Testing](./testing.md) - Test migrations

## Additional Resources

- [Drizzle Migrations Documentation](https://orm.drizzle.team/docs/migrations)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Zero-Downtime Migrations](https://www.braintreepayments.com/blog/safe-operations-for-high-volume-postgresql/)
