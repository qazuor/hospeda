# CLAUDE.md - Database Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Database package (`@repo/db`).

## Overview

Database layer using Drizzle ORM with PostgreSQL. Provides type-safe models, schemas, migrations, and utilities for all database operations. Implements the repository pattern with BaseModel abstraction.

## Key Commands

```bash
# Database Operations
pnpm db:migrate        # Apply pending migrations
pnpm db:generate       # Generate migration from schema changes
pnpm db:studio         # Open Drizzle Studio (visual DB tool)

# Testing
pnpm test                       # Run unit tests (mocked DB)
pnpm test:watch                 # Watch mode (unit)
pnpm test:coverage              # Coverage report (unit)
pnpm test:integration           # Integration tests against real PostgreSQL (SPEC-061)
pnpm test:integration:watch     # Watch mode (integration)

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
```

## Package Structure

```
src/
├── models/            # Entity models extending BaseModel
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   └── index.ts
├── schemas/           # Drizzle table schemas
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── enums/
│   └── index.ts
├── base/              # Base classes and abstractions
│   └── BaseModel.ts
├── utils/             # Database utilities
│   ├── query-builder.ts
│   ├── error-handler.ts
│   └── enum-helpers.ts
├── client.ts          # Drizzle client initialization
└── index.ts           # Main exports
```

## Initializing the Database

```ts
import { Pool } from 'pg';
import { initializeDb } from '@repo/db';

const pool = new Pool({
  connectionString: process.env.HOSPEDA_DATABASE_URL,
});

// Must be called before using any models
initializeDb(pool);
```

## BaseModel

All models extend `BaseModel<T>` which provides standard CRUD operations:

```ts
import { BaseModel } from '@repo/db/base';
import { accommodationTable } from '@repo/db/schemas';
import type { Accommodation } from '@repo/types';

export class AccommodationModel extends BaseModel<Accommodation> {
  protected table = accommodationTable;
  protected entityName = 'accommodation';

  // Override methods for custom logic
  async findAll(filters?: SearchAccommodation): Promise<Accommodation[]> {
    // Custom search logic (e.g., full-text search)
    if (filters?.q) {
      return this.searchByText(filters.q);
    }

    return super.findAll(filters);
  }
}
```

### BaseModel Methods

**Read Operations:**

- `findById(id: string): Promise<T | null>` - Find by ID
- `findOne(filters: Partial<T>): Promise<T | null>` - Find single record
- `findAll(filters?: Partial<T>): Promise<T[]>` - Find all matching
- `findWithRelations(filters, relations): Promise<T | null>` - Find with related data
- `count(filters?: Partial<T>): Promise<number>` - Count records
- `exists(filters: Partial<T>): Promise<boolean>` - Check existence

**Write Operations:**

- `create(data: Partial<T>): Promise<T>` - Create new record
- `update(id: string, data: Partial<T>): Promise<T>` - Update by ID
- `updateMany(filters, data): Promise<number>` - Bulk update

**Delete Operations:**

- `softDelete(filters: Partial<T>): Promise<void>` - Soft delete (set deletedAt)
- `hardDelete(filters: Partial<T>): Promise<void>` - Permanent delete
- `restore(filters: Partial<T>): Promise<void>` - Restore soft-deleted

## Drizzle Schemas

Define table schemas using Drizzle ORM:

```ts
// schemas/accommodation/table.ts
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const accommodationTable = pgTable('accommodations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description').notNull(),
  address: varchar('address', { length: 500 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

### Relations

```ts
// schemas/accommodation/relations.ts
import { relations } from 'drizzle-orm';
import { accommodationTable } from './table';
import { reviewTable } from '../review/table';
import { amenityTable } from '../amenity/table';

export const accommodationRelations = relations(accommodationTable, ({ many }) => ({
  reviews: many(reviewTable),
  amenities: many(amenityTable),
}));
```

## Using Models

### Basic CRUD

```ts
import { AccommodationModel } from '@repo/db';

const accommodationModel = new AccommodationModel();

// Create
const newAccommodation = await accommodationModel.create({
  name: 'Hotel Paradise',
  slug: 'hotel-paradise',
  description: 'A beautiful hotel',
  address: '123 Main St',
  city: 'Buenos Aires',
});

// Read
const accommodation = await accommodationModel.findById('uuid-here');
const allAccommodations = await accommodationModel.findAll({ isActive: true });

// Update
const updated = await accommodationModel.update('uuid-here', {
  name: 'Hotel Paradise Updated',
});

// Soft Delete
await accommodationModel.softDelete({ id: 'uuid-here' });

// Restore
await accommodationModel.restore({ id: 'uuid-here' });

// Hard Delete (permanent)
await accommodationModel.hardDelete({ id: 'uuid-here' });
```

### With Relations

```ts
const accommodationWithReviews = await accommodationModel.findWithRelations(
  { id: 'uuid-here' },
  { reviews: true, amenities: true }
);

console.log(accommodationWithReviews.reviews); // Array of reviews
console.log(accommodationWithReviews.amenities); // Array of amenities
```

### Pagination

```ts
const results = await accommodationModel.findAll({
  page: 1,
  pageSize: 10,
  city: 'Buenos Aires',
});
```

## Transactions

```ts
import { withTransaction } from '@repo/db';

await withTransaction(async (tx) => {
  // All operations within this transaction use model methods with tx
  const accommodation = await accommodationModel.create({
    name: 'Hotel',
  }, tx);

  await reviewModel.create({
    accommodationId: accommodation.id,
    rating: 5,
  }, tx);

  // If any operation fails, entire transaction rolls back
});
```

## Custom Queries

### Using Drizzle Query Builder

```ts
import { getDb } from '@repo/db';
import { accommodationTable } from '@repo/db/schemas';
import { eq, and, gte, like } from 'drizzle-orm';

const db = getDb();

// Simple query
const accommodations = await db
  .select()
  .from(accommodationTable)
  .where(eq(accommodationTable.city, 'Buenos Aires'));

// Complex query
const filtered = await db
  .select()
  .from(accommodationTable)
  .where(
    and(
      eq(accommodationTable.isActive, true),
      gte(accommodationTable.rating, 4),
      like(accommodationTable.name, '%Hotel%')
    )
  )
  .limit(10);
```

### Raw SQL (Use Sparingly)

```ts
import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';

const db = getDb();

const result = await db.execute(
  sql`SELECT COUNT(*) FROM accommodations WHERE is_active = true`
);
```

## Migrations

The project uses **two physically separate migration carriles** enforced by directory. Every
schema change must land in exactly one of them — the golden rule below decides which.

### Golden Rule: which carril?

| Question | Answer | Carril |
|----------|--------|--------|
| Can Drizzle declare it in the TS schema (table / column / normal index / FK / enum)? | Yes | `src/migrations/` — run `db:generate` |
| Is it a Drizzle-invisible object (trigger / matview / CHECK / special index / role)? | Yes | `src/migrations/extras/` — hand-written, idempotent |
| Is it a data transformation of existing rows (type-cast USING / backfill UPDATE)? | Yes | `src/migrations/` — hand-edit the generated file to add the `USING` |

`push` and `generate` **never** convert data. Conversions are always explicit with `USING`.

### Carril 1 — `src/migrations/` (Drizzle-generated, versioned)

Drizzle-generated structural migrations (tables, columns, normal indexes, FKs, enums) plus
any hand-edited data conversions tied to a structural change. Numbered automatically by
drizzle-kit, journal-tracked in `src/migrations/meta/`, applied once each by `db:migrate`.

The baseline is `src/migrations/0000_baseline.sql`.

```bash
pnpm db:generate      # Generate .sql from TS schema diff (review before committing)
pnpm db:migrate       # Apply all pending migrations to the DB (real drizzle-kit migrate)
```

### Carril 2 — `src/migrations/extras/` (hand-written, idempotent)

PostgreSQL objects Drizzle cannot declare: materialized views, triggers, CHECK constraints,
GIN/partial/functional indexes. Files are:

- Hand-written SQL
- Named `NNN-name.kind.sql` (3-digit prefix for ordering, e.g. `001-search-index.matview.sql`)
- **Idempotent** — use `IF NOT EXISTS` / `CREATE OR REPLACE` throughout
- Re-applied on every `pnpm db:apply-extras` call (not just once)

```bash
pnpm db:apply-extras   # Re-apply every extras/*.sql in lexical order
```

Always run `db:apply-extras` after `db:migrate` on a fresh environment.

### Dev vs VPS comparison

| | Dev (local) | CI + VPS (staging = prod) |
|---|---|---|
| Structure | `push` (fast, disposable DB) | versioned `migrate` |
| Data conversion | irrelevant (fresh DB every time) | explicit migration with `USING` |
| Source of truth | the TS schema | the migrations in git |

### Development workflow

Iterate freely in dev — push resets the DB to match the TS schema immediately:

```bash
pnpm db:push          # Push schema directly to local DB (no migration file — DEV ONLY)
pnpm db:fresh-dev     # Reset + push + seed (the normal local dev loop)
```

`push` is **dev-only** and must NEVER be run against a VPS. It drops objects the migration
history depends on and cannot be rolled back.

### Close-of-work workflow (mandatory before a schema PR)

1. Iterate freely in dev with `push` / `db:fresh-dev`.
2. Run `pnpm --filter @repo/db db:generate` and review the generated file.
3. If the column type change requires a data conversion, hand-edit the generated `.sql` to add
   the `USING` expression (Drizzle won't invent it).
4. Never run `push` against the VPS. Ever.
5. CI's drift guard (`scripts/check-schema-drift.sh`) blocks a PR if a committed schema
   change has no matching migration — it is not optional.

### Migration File Example

```sql
-- src/migrations/0001_add_display_order.sql
ALTER TABLE "accommodation_faqs" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;
```

Data conversion example (hand-edited after `db:generate`):

```sql
-- Drizzle generated the ALTER TABLE; we hand-add USING for the cast:
ALTER TABLE "some_table"
  ALTER COLUMN "status" TYPE new_status_enum
  USING status::text::new_status_enum;
```

## Enums

### Database Enums

```ts
// schemas/enums/lifecycle.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const lifecycleStatusEnum = pgEnum('lifecycle_status', [
  'draft',
  'published',
  'archived',
]);

// Use in table
export const postTable = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: lifecycleStatusEnum('status').default('draft').notNull(),
});
```

### Enum Helpers

```ts
import { getEnumValues, enumToArray } from '@repo/db/utils';

const statusValues = getEnumValues('LifecycleStatusEnum');
// ['draft', 'published', 'archived']

const statusArray = enumToArray(LifecycleStatusEnum);
// [{ value: 'draft', label: 'Draft' }, ...]
```

## Error Handling

```ts
import { DbError } from '@repo/db/utils';

try {
  await accommodationModel.create(data);
} catch (error) {
  if (error instanceof DbError) {
    console.error('Database error:', error.message);
    console.error('Code:', error.code);
  }
  throw error;
}
```

## Testing Models

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBaseModelMock } from '@repo/db/test-utils';
import { AccommodationModel } from './accommodation.model';

describe('AccommodationModel', () => {
  let model: AccommodationModel;

  beforeAll(() => {
    // Initialize test database
    model = new AccommodationModel();
  });

  it('should create accommodation', async () => {
    const data = {
      name: 'Test Hotel',
      slug: 'test-hotel',
      // ...
    };

    const result = await model.create(data);

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Hotel');
  });

  it('should find by id', async () => {
    const created = await model.create({ /* data */ });
    const found = await model.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });
});
```

## Integration Tests (SPEC-061)

Integration tests run against a real PostgreSQL instance to verify transaction
propagation, constraint enforcement, and query correctness. They live under
`packages/db/test/integration/` and never run as part of `pnpm test`.

### Prerequisites

- Docker running with PostgreSQL: `pnpm db:start`
- The infrastructure creates and drops its own database
  (`hospeda_integration_test`) and never touches your dev or E2E DB.

### Commands

```bash
pnpm test:integration          # Run all integration tests
pnpm test:integration:watch    # Watch mode for development
```

### How it works

1. **Global setup** (`test/integration/global-setup.ts`) creates
   `hospeda_integration_test`, pushes the Drizzle schema, installs
   `uuid-ossp`/`pgcrypto`/`unaccent`, then runs `apply-postgres-extras.sh`
   for triggers and materialized views (non-fatal).
2. The connection string is exported as `HOSPEDA_TEST_DATABASE_URL` and
   inherited by Vitest worker forks.
3. Each test wraps its body in `withTestTransaction(async (tx) => { ... })`
   from `test/integration/helpers.ts`. The transaction is **always rolled
   back**, so state stays clean without TRUNCATE overhead.
4. Tests that need cross-transaction visibility (e.g. concurrent isolation)
   use `withCleanSlate(async (db) => { ... })`, which TRUNCATEs all user
   tables before invoking the callback.
5. Every file calls `closeTestPool()` in `afterAll()` to drain its worker
   pool.
6. **Global teardown** drops the test database after the last worker exits.

Tests run in parallel (`maxForks: 3`) because rollback isolation makes that
safe.

### Helpers

`test/integration/helpers.ts` exports:

- `getTestDb()`, `getTestPool()`: cached Drizzle client and pg.Pool per worker
- `withTestTransaction(fn)`: rollback-isolated test wrapper
- `withCleanSlate(fn)`: TRUNCATE-based clean slate for visibility tests
- `closeTestPool()`: tear down per-worker resources in `afterAll`
- `testData.user|destination|tag(overrides?)`: minimal NOT NULL-safe factories

### Troubleshooting

- "Cannot connect to PostgreSQL": run `pnpm db:start`.
- "drizzle-kit push failed": `packages/db/drizzle.config.ts` is invalid or the
  schema does not compile.
- Orphaned test DB: setup always drops + recreates, so killed runs self-heal
  on the next invocation.

## Query Building Utilities

```ts
import { buildWhereClause } from '@repo/db/utils';
import { accommodationTable } from '@repo/db/schemas';

const filters = {
  city: 'Buenos Aires',
  isActive: true,
  minRating: 4,
};

const whereClause = buildWhereClause(accommodationTable, filters);

const results = await db
  .select()
  .from(accommodationTable)
  .where(whereClause);
```

## Best Practices

1. **Always use models** - don't query tables directly in business logic
2. **Initialize database once** - call `initializeDb()` at app startup
3. **Use transactions** for multi-step operations
4. **Soft delete by default** - use `softDelete()` unless hard delete needed
5. **Override findAll()** for custom search (e.g., full-text search)
6. **Use TypeScript types** from `@repo/types` - don't redefine
7. **Test all model methods** - ensure CRUD operations work
8. **Use query builder** - avoid raw SQL unless necessary
9. **Handle errors properly** - catch `DbError` specifically
10. **Document complex queries** - use JSDoc for unusual patterns

## Key Dependencies

- `drizzle-orm` - ORM library
- `pg` - PostgreSQL client
- `@repo/schemas` - Zod validation schemas
- `@repo/types` - TypeScript types
- `@repo/utils` - Utility functions
- `@repo/logger` - Logging

## Destination Hierarchy

The destinations table uses a **materialized path pattern** for hierarchical geographic organization (Country > Region > Province > Department > City > Town > Neighborhood).

### Hierarchy Columns

| Column | Type | Description |
|--------|------|-------------|
| `parentDestinationId` | uuid (self-ref FK) | Parent destination, uses `AnyPgColumn` for circular reference |
| `destinationType` | enum | COUNTRY, REGION, PROVINCE, DEPARTMENT, CITY, TOWN, NEIGHBORHOOD |
| `level` | integer | 0-based depth (COUNTRY=0, NEIGHBORHOOD=6) |
| `path` | text (unique) | Materialized path: `/argentina/litoral/entre-rios` |
| `pathIds` | text | Ancestor UUID chain: `uuid1/uuid2/uuid3` |

### Hierarchy Model Methods

```ts
const model = new DestinationModel();

// Direct children of a destination
await model.findChildren(parentId);

// All descendants with optional filters
await model.findDescendants(destinationId, { maxDepth: 2, destinationType: 'CITY' });

// Ancestors ordered root-to-parent
await model.findAncestors(destinationId);

// Lookup by materialized path
await model.findByPath('/argentina/litoral/entre-rios');

// Cycle detection for reparenting
await model.isDescendant(potentialDescendantId, ancestorId);

// Cascade path updates after reparenting
await model.updateDescendantPaths(parentId, oldPath, newPath);
```

### Hierarchy Indexes

5 indexes optimize hierarchy queries: `parentDestinationId`, `destinationType`, `level`, `path` (unique), `pathIds`.

## Common Patterns

### Model with Custom Methods

```ts
export class AccommodationModel extends BaseModel<Accommodation> {
  protected table = accommodationTable;
  protected entityName = 'accommodation';

  async findBySlug(slug: string): Promise<Accommodation | null> {
    return this.findOne({ slug });
  }

  async findByCity(city: string): Promise<Accommodation[]> {
    return this.findAll({ city, isActive: true });
  }

  async incrementViewCount(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(accommodationTable)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(accommodationTable.id, id));
  }
}
```

### Repository Pattern

Models follow the repository pattern - they encapsulate all database access for an entity.

## User Bookmark Tables (SPEC-098)

Two tables support the Favorites/Wishlists feature:

- **`user_bookmarks`**: polymorphic favorites (`entityId` + `entityType`). Optional `collectionId` FK (SET NULL on collection soft-delete). Index on `(entityId, entityType, deletedAt)` for "Most saved" sorts. Soft-delete via `deletedAt`.
- **`user_bookmark_collections`**: user-created wishlists. Max 10 per user (env-configurable). Soft-delete only; hard deletes are not exposed.

## displayWeight Column Pattern

Entities that need user-controlled display ordering (amenities, features, attractions) use a `displayWeight` column:

```ts
displayWeight: integer('display_weight'),  // nullable, higher = shown first
```

Used for sorting in public-facing lists. Seed data includes displayWeight values (e.g., WiFi = 95, Pool = 80).

## buildOrderByClause Parameter Order

**WARNING**: The `buildOrderByClause` utility in `utils/drizzle-helpers.ts` has this signature:

```ts
buildOrderByClause(sortBy: string, table: unknown, sortOrder: 'asc' | 'desc' = 'asc')
```

The `table` parameter comes BEFORE the default `sortOrder` parameter. Biome's `useDefaultParameterLast` rule enforces this ordering. If you swap them, the pre-commit hook will fail.

## Lean append-only tables (approved deviation from BaseModel)

Most tables extend `BaseModel` and carry full audit columns (`createdById`,
`updatedById`, `deletedAt`, `adminInfo`) plus soft-delete. A small set of
**append-only telemetry tables** deliberately omit these columns:

| Table | Precedent spec | Reason |
|---|---|---|
| `app_log_entries` | SPEC-??? | Structured log sink; never edited, never user-owned |
| `entity_views` | SPEC-159 | High-write view capture; audit/FK overhead would bloat the hottest-write table |

These tables use **TTL purge crons** (nightly `DELETE WHERE <time_col> < now() - interval
'N days'`) instead of soft-delete, and they do NOT extend `BaseModel`. This is an approved,
documented convention deviation — do not "fix" them by adding BaseModel columns.

Apply this pattern only for tables that are: (a) append-only, (b) never user-owned or
role-scoped for CRUD, and (c) high-write enough that audit column overhead is measurable.

## Notes

- Models are stateless - create new instances as needed
- Connection pooling is automatic via Drizzle
- Migrations are forward-only - no rollback support
- Use Drizzle Studio for visual database management

## PostgreSQL Extras: Features Drizzle Cannot Declare

These objects live in **Carril 2** (`src/migrations/extras/`). They are applied by
`pnpm db:apply-extras` and must be idempotent (re-run safely after any schema reset).

| File | Category | Objects |
|------|----------|---------|
| `001-search-index.matview.sql` | Materialized view | `search_index` + GIN + UNIQUE index + `refresh_search_index()` |
| `002-set-updated-at.trigger.sql` | Trigger | `set_updated_at` on all tables with `updated_at` |
| `003-delete-entity-bookmarks.trigger.sql` | Trigger | `delete_entity_bookmarks` on 5 tables |
| `004-billing.constraints.sql` | CHECK constraints | `billing_addon_purchases` status / JSONB checks |
| `005-media.constraints.sql` | CHECK constraints | media-related column constraints |
| `006-conversation.indexes.sql` | Special indexes | conversation functional/partial indexes |
| `007-messages.constraints.sql` | CHECK constraints | messages column constraints |
| `008-bookmark.indexes.sql` | Special indexes | bookmark partial/functional indexes |
| `009-newsletter.indexes.sql` | Special indexes | newsletter functional indexes |
| `010-abandoned-status.data-migration.sql` | Data migration | Canonicalises `incomplete_expired` → `abandoned` in billing_subscriptions |
| `011-entity-views.indexes.sql` | Special indexes | entity_views partial/functional indexes |
| `012-content-moderation-thresholds.check.sql` | CHECK constraints | Cross-column CHECK `pending < reject` on content_moderation_thresholds |
| `013-moderation-role-grants.data.sql` | Bootstrap data | MODERATION_* permission grants for `admin` + `super_admin` roles (SPEC-195) |

### Applying after migrate

After `pnpm db:migrate` or on a fresh environment, always run:

```bash
pnpm db:apply-extras
# or directly:
node packages/db/scripts/apply-postgres-extras.mjs
# or with an explicit URL:
node packages/db/scripts/apply-postgres-extras.mjs "postgresql://user:pass@host:5432/hospeda"
```

The implementation uses the `pg` driver (no `psql` dependency) so it works on hosts that do
not have postgres client tools installed (e.g. the VPS host where `hops db-seed` runs).
The thin `apply-postgres-extras.sh` wrapper is kept for backwards compatibility.

### Extensions preflight (MANDATORY on a fresh/reset VPS)

`000-reset-schema.sql` uses `DROP SCHEMA public CASCADE`, which removes all extensions'
objects. Before running `migrate` on a wiped VPS, restore the extensions:

```bash
psql "$URL" -f packages/db/scripts/reset/001-extensions.sql
# then:
pnpm db:migrate
pnpm db:apply-extras
```

The baseline uses `gen_random_uuid()` (pgcrypto) — the migrate step will fail without this.

For full details, constraint definitions, and verification queries see:
[packages/db/docs/triggers-manifest.md](docs/triggers-manifest.md)

## Common Gotchas

- `billing_subscription_addons` has no `livemode` or `deleted_at` columns
- `billing_plans.id` is UUID but `billing_subscriptions.plan_id` is varchar. Despite the varchar type, `plan_id` stores the plan **UUID** (`billing_plans.id`), NOT the slug — verified against real data (SPEC-168 D1). Plan mutations therefore target the `id` (UUID), and the slug (`billing_plans.name`) is **immutable** after creation (config/web/entitlements resolve by slug). Plans are now **runtime-editable** from the admin (SPEC-168); the `@repo/billing` config is seed-only.
- `billing_customers` uses `segment` column, not `category`
- `numeric()` columns use `mode: 'number'` for runtime JS number coercion (SPEC-056). For monetary values, prefer `integer` storage in centavos (see ADR-006)
- Always use soft delete (deletedAt timestamp) by default
- **`drizzle-kit push` is dev-only** — NEVER run it against a VPS. Use `db:migrate` (real
  `drizzle-kit migrate`) for CI and VPS. See [docs/guides/migrations.md](../../docs/guides/migrations.md).
- **Always run `apply-extras` after `migrate`** — triggers, materialized views, and JSONB
  CHECK constraints live in `src/migrations/extras/` and are invisible to Drizzle's migrate
  command. Run `pnpm db:apply-extras` after every `db:migrate` on a fresh environment.
- **`db:generate` is mandatory before a schema PR** — the drift guard (`scripts/check-schema-drift.sh`)
  blocks CI if the TS schema changed without a committed migration. Run `db:generate` and
  review the generated file before opening a PR.
- **Two carriles, never mix** — structural changes go to `src/migrations/` (Drizzle-generated),
  Drizzle-invisible objects go to `src/migrations/extras/` (hand-written, idempotent, NNN prefix).
- **LIKE wildcard injection**: NEVER use raw `ilike()` from `drizzle-orm`. Always use `safeIlike(col, term)` from `@repo/db`, which automatically escapes `%`, `_`, and `\` before calling `ilike()`. The only file that may import `ilike` directly is `src/utils/drizzle-helpers.ts`. CI enforces this.

## Related Documentation

- [ADR-006: Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-017: PostgreSQL-Specific Features via Manual Migrations](../../docs/decisions/ADR-017-postgres-specific-features.md)
- [Triggers and Constraints Manifest](docs/triggers-manifest.md)
- [Database Migrations Guide](docs/guides/migrations.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Feb 11, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #5968 | 8:57 PM | 🔵 | Drizzle configuration uses environment variables for database connection | ~283 |
| #5969 | " | 🔵 | Drizzle database commands defined in package.json | ~256 |
| #5964 | " | 🔴 | Database migration failed due to SQL syntax error | ~228 |
| #5959 | 8:56 PM | ✅ | Database schema migration generated | ~276 |

</claude-mem-context>
