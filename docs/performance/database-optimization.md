# Database Optimization

This guide covers comprehensive database optimization strategies for Hospeda, including query optimization, indexing, N+1 query prevention, connection pooling, and monitoring.

## Table of Contents

- [Query Optimization](#query-optimization)
- [Indexing Strategy](#indexing-strategy)
- [Connection Pooling](#connection-pooling)
- [Query Performance Patterns](#query-performance-patterns)
- [Database Denormalization](#database-denormalization)
- [Materialized Views](#materialized-views)
- [Monitoring Queries](#monitoring-queries)
- [Best Practices Checklist](#best-practices-checklist)
- [Troubleshooting](#troubleshooting)

## Query Optimization

### EXPLAIN ANALYZE

Always use `EXPLAIN ANALYZE` to understand query execution plans and identify bottlenecks.

**Basic Usage**:

```sql
EXPLAIN ANALYZE
SELECT a.*, d.name as destination_name
FROM accommodations a
JOIN destinations d ON a.destination_id = d.id
WHERE a.is_active = true
ORDER BY a.created_at DESC
LIMIT 10;
```

**Output Example**:

```
Limit  (cost=0.42..25.67 rows=10 width=1234) (actual time=0.123..0.456 rows=10 loops=1)
  ->  Nested Loop  (cost=0.42..2567.89 rows=1018 width=1234) (actual time=0.122..0.453 rows=10 loops=1)
        ->  Index Scan using idx_accommodations_created_at on accommodations a  (cost=0.42..1234.56 rows=1018 width=1000)
              Filter: (is_active = true)
              Rows Removed by Filter: 5
        ->  Index Scan using destinations_pkey on destinations d  (cost=0.15..1.31 rows=1 width=234)
              Index Cond: (id = a.destination_id)
Planning Time: 0.234 ms
Execution Time: 0.567 ms
```

**Understanding Output**:

| Term | Meaning | Good/Bad |
|------|---------|----------|
| **Seq Scan** | Sequential scan (full table) | ❌ Bad (add index) |
| **Index Scan** | Using index | ✅ Good |
| **Bitmap Index Scan** | Multiple index lookups | ✅ Good for OR queries |
| **Nested Loop** | Join algorithm (small datasets) | ✅ Good for small joins |
| **Hash Join** | Join algorithm (large datasets) | ✅ Good for large joins |
| **Merge Join** | Join on sorted data | ✅ Good for sorted joins |
| **Cost** | Query planner estimate | Lower is better |
| **Actual Time** | Real execution time | This is the important metric |
| **Rows** | Rows processed | Should match estimates |
| **Buffers** | Memory usage | shared hit = cache hit ✅ |

**Advanced EXPLAIN Options**:

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, COSTS, TIMING)
SELECT /* your query */;
```

- **ANALYZE**: Run query and show actual times
- **BUFFERS**: Show buffer usage (cache hits/misses)
- **VERBOSE**: Show output columns
- **COSTS**: Show planner cost estimates (default)
- **TIMING**: Show timing information (default with ANALYZE)

### N+1 Query Prevention

The N+1 query problem occurs when you fetch a list of entities (1 query), then fetch related data for each entity (N queries). This is a major performance killer.

#### Problem: N+1 Anti-Pattern

❌ **Bad**: 1 query for accommodations + N queries for destinations

```typescript
// Query 1: Get all accommodations
const accommodations = await db
  .select()
  .from(accommodationsTable);

// N queries: One query per accommodation
for (const acc of accommodations) {
  const destination = await db
    .select()
    .from(destinationsTable)
    .where(eq(destinationsTable.id, acc.destinationId));

  console.log(`${acc.name} in ${destination.name}`);
}
```

**Performance Impact**:

- 100 accommodations = 101 queries
- Each query: ~10ms roundtrip
- Total time: 1010ms (1+ second!)

#### Solution 1: JOIN

✅ **Good**: Single query with JOIN

```typescript
const accommodationsWithDestinations = await db
  .select({
    accommodation: accommodationsTable,
    destination: destinationsTable,
  })
  .from(accommodationsTable)
  .leftJoin(
    destinationsTable,
    eq(accommodationsTable.destinationId, destinationsTable.id)
  );

accommodationsWithDestinations.forEach(({ accommodation, destination }) => {
  console.log(`${accommodation.name} in ${destination.name}`);
});
```

**Performance Impact**:

- 1 query
- Query time: ~15ms (with proper indexes)
- Total time: 15ms (67x faster!)

#### Solution 2: IN Query

✅ **Good**: 2 queries with IN clause

```typescript
// Query 1: Get all accommodations
const accommodations = await db
  .select()
  .from(accommodationsTable);

// Extract destination IDs
const destinationIds = [...new Set(
  accommodations.map(a => a.destinationId).filter(Boolean)
)];

// Query 2: Get all destinations in one query
const destinations = await db
  .select()
  .from(destinationsTable)
  .where(inArray(destinationsTable.id, destinationIds));

// Create lookup map
const destinationMap = new Map(
  destinations.map(d => [d.id, d])
);

// Combine data in memory
const results = accommodations.map(acc => ({
  ...acc,
  destination: destinationMap.get(acc.destinationId),
}));
```

**Performance Impact**:

- 2 queries
- Query time: ~10ms + ~8ms
- Total time: 18ms (56x faster!)

**When to Use**:

- When JOIN is too expensive
- When you need different caching strategies
- When destinations are shared across accommodations

#### Solution 3: DataLoader Pattern

✅ **Good**: Automatic batching with DataLoader

```typescript
import DataLoader from 'dataloader';

// Create DataLoader
const destinationLoader = new DataLoader(
  async (ids: readonly string[]) => {
    const destinations = await db
      .select()
      .from(destinationsTable)
      .where(inArray(destinationsTable.id, ids as string[]));

    // Return in same order as requested IDs
    const destinationMap = new Map(
      destinations.map(d => [d.id, d])
    );

    return ids.map(id => destinationMap.get(id) ?? null);
  },
  {
    // Batch multiple requests within 10ms window
    batchScheduleFn: (callback) => setTimeout(callback, 10),
  }
);

// Usage: Automatically batches and caches
const accommodations = await db.select().from(accommodationsTable);

const results = await Promise.all(
  accommodations.map(async (acc) => ({
    ...acc,
    destination: await destinationLoader.load(acc.destinationId),
  }))
);
```

**Benefits**:

- Automatic request batching
- Built-in caching (per-request)
- Deduplication of identical requests
- Maintains request order

**When to Use**:

- GraphQL APIs
- Complex nested data fetching
- When you want automatic batching

#### Detection: Finding N+1 Queries

**Method 1: Query Logging**

```typescript
// packages/db/src/index.ts
import { drizzle } from 'drizzle-orm/neon-http';

export const db = drizzle(sql, {
  logger: {
    logQuery(query: string, params: unknown[]) {
      console.log('Query:', query);
      console.log('Params:', params);
      console.trace('Called from:'); // Shows call stack
    },
  },
});
```

**Method 2: pg_stat_statements**

```sql
-- Find queries called many times
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time
FROM pg_stat_statements
WHERE calls > 100
ORDER BY calls DESC
LIMIT 20;
```

**Method 3: Request Tracing**

```typescript
// Count queries per request
let queryCount = 0;

export const queryCounterMiddleware = async (c, next) => {
  queryCount = 0;

  // Wrap db with counter
  const originalQuery = db.select;
  db.select = (...args) => {
    queryCount++;
    return originalQuery(...args);
  };

  await next();

  // Warn if too many queries
  if (queryCount > 10) {
    console.warn(`⚠️  ${queryCount} queries in single request!`);
  }
};
```

### Query Pagination

Always paginate large result sets to avoid memory issues and slow response times.

#### Offset-Based Pagination

❌ **Bad**: No pagination

```typescript
// Returns ALL rows (could be millions)
const allAccommodations = await db
  .select()
  .from(accommodationsTable);
```

✅ **Good**: Offset-based pagination

```typescript
const PAGE_SIZE = 20;

interface PaginationInput {
  page: number; // 1-based
  pageSize?: number;
}

async function getAccommodations({ page, pageSize = PAGE_SIZE }: PaginationInput) {
  const offset = (page - 1) * pageSize;

  const [accommodations, totalCountResult] = await Promise.all([
    // Get page of results
    db
      .select()
      .from(accommodationsTable)
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(accommodationsTable.createdAt)),

    // Get total count for pagination
    db
      .select({ count: sql<number>`count(*)` })
      .from(accommodationsTable),
  ]);

  const totalCount = totalCountResult[0].count;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data: accommodations,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
```

**Pros**:

- Simple to implement
- Easy to jump to arbitrary page
- Total count available

**Cons**:

- Slow for large offsets (OFFSET 10000)
- Inconsistent results if data changes between pages

#### Cursor-Based Pagination

✅ **Better**: Cursor-based pagination for large datasets

```typescript
interface CursorPaginationInput {
  cursor?: string; // ID of last item from previous page
  pageSize?: number;
}

async function getAccommodationsCursor({
  cursor,
  pageSize = 20
}: CursorPaginationInput) {
  const query = db
    .select()
    .from(accommodationsTable)
    .orderBy(desc(accommodationsTable.createdAt), desc(accommodationsTable.id))
    .limit(pageSize + 1); // Fetch one extra to know if more exist

  if (cursor) {
    // Decode cursor (base64 encoded ID)
    const decodedCursor = Buffer.from(cursor, 'base64').toString();

    // Get items after cursor
    query.where(
      or(
        lt(accommodationsTable.createdAt, decodedCursor),
        and(
          eq(accommodationsTable.createdAt, decodedCursor),
          lt(accommodationsTable.id, decodedCursor)
        )
      )
    );
  }

  const results = await query;
  const hasNextPage = results.length > pageSize;
  const accommodations = hasNextPage ? results.slice(0, -1) : results;

  const nextCursor = hasNextPage
    ? Buffer.from(accommodations[accommodations.length - 1].id).toString('base64')
    : null;

  return {
    data: accommodations,
    pagination: {
      nextCursor,
      hasNextPage,
      pageSize,
    },
  };
}
```

**Pros**:

- Consistent results (no skipped/duplicate items)
- Fast for any position (uses index)
- Works well with infinite scroll

**Cons**:

- Can't jump to arbitrary page
- No total count (requires separate query)

**When to Use Cursor Pagination**:

- Large datasets (> 10,000 rows)
- Real-time data (frequently changing)
- Infinite scroll UI
- Mobile apps

**When to Use Offset Pagination**:

- Small to medium datasets (< 10,000 rows)
- Admin panels with page numbers
- Need total count for UI

### SELECT Only Needed Columns

Avoid `SELECT *` in production code. Always specify needed columns to reduce data transfer and improve performance.

❌ **Bad**: SELECT *

```typescript
// Fetches all columns (including large text fields, JSON, etc.)
const users = await db.select().from(usersTable);
```

✅ **Good**: SELECT specific columns

```typescript
// Only fetch needed columns
const users = await db
  .select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    avatarUrl: usersTable.avatarUrl,
  })
  .from(usersTable);
```

**Benefits**:

- **Reduced network transfer**: Smaller response size
- **Faster queries**: Less data to read from disk
- **Better cache utilization**: More rows fit in cache
- **Clearer intent**: Shows what data is actually used

**Example Impact**:

```
Full user row: ~5KB (with bio, preferences JSON, etc.)
Needed columns: ~200B (id, name, email, avatar)

1000 users:
- SELECT *: 5MB transfer
- SELECT specific: 200KB transfer (25x smaller!)
```

### Avoid SELECT DISTINCT When Possible

`SELECT DISTINCT` requires sorting all results, which is expensive. Use `GROUP BY` or fix the underlying query instead.

❌ **Slow**: SELECT DISTINCT

```sql
-- Requires sorting all results
SELECT DISTINCT city FROM accommodations;
```

✅ **Faster**: GROUP BY

```sql
-- Uses index, no sorting needed
SELECT city FROM accommodations GROUP BY city;
```

✅ **Even Better**: Subquery

```sql
-- If you have a normalized cities table
SELECT DISTINCT d.city
FROM destinations d
WHERE EXISTS (
  SELECT 1 FROM accommodations a
  WHERE a.destination_id = d.id
);
```

**When DISTINCT is OK**:

- Small result sets (< 1000 rows)
- Already sorted data
- No alternative (complex joins with duplicates)

## Indexing Strategy

Indexes are critical for query performance. Proper indexing can improve query speed by 10-100x.

### When to Create Indexes

Create indexes for:

1. **Primary Keys** ✅ (Automatic)
2. **Foreign Keys** ✅ (Always create manually)
3. **WHERE Clause Columns** ✅ (Frequently filtered)
4. **JOIN Conditions** ✅ (Join columns)
5. **ORDER BY Columns** ✅ (Sorted columns)
6. **Unique Constraints** ✅ (Unique columns)
7. **Frequently Queried Columns** ✅

**Don't Create Indexes For**:

1. **Small Tables** ❌ (< 1000 rows, seq scan is faster)
2. **Rarely Queried Columns** ❌
3. **High Write, Low Read Tables** ❌ (index maintenance cost)
4. **Low Cardinality Columns** ❌ (e.g., boolean with 50/50 split)

### Index Types

#### B-Tree Index (Default)

Most common index type. Good for:

- Equality comparisons (`=`)
- Range queries (`<`, `>`, `BETWEEN`)
- Sorting (`ORDER BY`)
- Prefix matching (`LIKE 'prefix%'`)

```sql
-- Create B-Tree index (default)
CREATE INDEX idx_accommodations_city ON accommodations(city);

-- Query using index
SELECT * FROM accommodations WHERE city = 'Concepción del Uruguay';
```

**Drizzle ORM**:

```typescript
import { pgTable, varchar, index } from 'drizzle-orm/pg-core';

export const accommodationsTable = pgTable(
  'accommodations',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    city: varchar('city', { length: 100 }).notNull(),
  },
  (table) => ({
    cityIdx: index('idx_accommodations_city').on(table.city),
  })
);
```

#### Composite Index (Multi-Column)

Index on multiple columns. Column order matters!

```sql
-- Composite index on (city, is_active)
CREATE INDEX idx_accommodations_city_active
ON accommodations(city, is_active);
```

**Can Be Used For**:

```sql
-- ✅ Uses index (leftmost column)
SELECT * FROM accommodations WHERE city = 'Concepción';

-- ✅ Uses index (both columns)
SELECT * FROM accommodations
WHERE city = 'Concepción' AND is_active = true;

-- ❌ CANNOT use index (doesn't start with leftmost)
SELECT * FROM accommodations WHERE is_active = true;
```

**Rule**: Index `(A, B, C)` can be used for queries on:

- `A`
- `A, B`
- `A, B, C`

But NOT for:

- `B`
- `C`
- `B, C`

**Drizzle ORM**:

```typescript
export const accommodationsTable = pgTable(
  'accommodations',
  {
    city: varchar('city', { length: 100 }).notNull(),
    isActive: boolean('is_active').default(true),
  },
  (table) => ({
    // Composite index: city first (more selective)
    cityActiveIdx: index('idx_accommodations_city_active')
      .on(table.city, table.isActive),
  })
);
```

#### Partial Index (Filtered)

Index only rows matching a condition. Smaller, faster indexes for common queries.

```sql
-- Index only active accommodations
CREATE INDEX idx_active_accommodations
ON accommodations(city)
WHERE is_active = true;
```

**Benefits**:

- Smaller index size (faster scans)
- Faster inserts/updates (fewer rows to index)
- Better cache utilization

**When to Use**:

- Queries filter on same condition (e.g., `WHERE is_active = true`)
- Condition filters out significant portion (> 25%)

**Drizzle ORM**:

```typescript
import { sql } from 'drizzle-orm';

export const accommodationsTable = pgTable(
  'accommodations',
  { /* ... */ },
  (table) => ({
    activeAccommodationsIdx: index('idx_active_accommodations')
      .on(table.city)
      .where(sql`${table.isActive} = true`),
  })
);
```

#### Unique Index

Enforces uniqueness and creates an index.

```sql
-- Unique email
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

**Drizzle ORM**:

```typescript
export const usersTable = pgTable(
  'users',
  {
    email: varchar('email', { length: 255 }).notNull().unique(),
  }
);
// unique() automatically creates unique index
```

#### GIN Index (Full-Text Search & JSONB)

Generalized Inverted Index for:

- Full-text search (`tsvector`)
- JSONB columns
- Arrays

**Full-Text Search**:

```sql
-- Add tsvector column
ALTER TABLE accommodations
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('spanish',
    coalesce(name, '') || ' ' ||
    coalesce(description, '')
  )
) STORED;

-- Create GIN index
CREATE INDEX idx_accommodations_search
ON accommodations USING GIN (search_vector);

-- Query with full-text search
SELECT * FROM accommodations
WHERE search_vector @@ to_tsquery('spanish', 'playa');
```

**JSONB Index**:

```sql
-- Index on JSONB column
CREATE INDEX idx_accommodations_amenities
ON accommodations USING GIN (amenities jsonb_path_ops);

-- Query JSONB
SELECT * FROM accommodations
WHERE amenities @> '{"wifi": true}';
```

**Drizzle ORM**:

```typescript
import { pgTable, text, jsonb, sql } from 'drizzle-orm/pg-core';

export const accommodationsTable = pgTable(
  'accommodations',
  {
    name: text('name').notNull(),
    description: text('description'),
    amenities: jsonb('amenities'),
  },
  (table) => ({
    // Full-text search index
    searchIdx: sql`CREATE INDEX idx_accommodations_search
      ON ${table} USING GIN (
        to_tsvector('spanish',
          coalesce(${table.name}, '') || ' ' ||
          coalesce(${table.description}, '')
        )
      )`,

    // JSONB index
    amenitiesIdx: sql`CREATE INDEX idx_accommodations_amenities
      ON ${table} USING GIN (${table.amenities} jsonb_path_ops)`,
  })
);
```

### Index Maintenance

#### Check Index Usage

```sql
-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### Find Most Used Indexes

```sql
-- Find most frequently used indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
```

#### Check Index Bloat

```sql
-- Estimate index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size,
  idx_scan,
  CASE
    WHEN idx_scan = 0 THEN 'Unused'
    WHEN idx_scan < 50 THEN 'Rarely used'
    ELSE 'Active'
  END as usage
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### Drop Unused Indexes

```sql
-- Drop unused index
DROP INDEX IF EXISTS idx_unused_index;

-- Drop concurrently (doesn't block writes)
DROP INDEX CONCURRENTLY IF EXISTS idx_unused_index;
```

#### Rebuild Bloated Indexes

```sql
-- Rebuild index (locks table)
REINDEX INDEX idx_accommodations_city;

-- Rebuild concurrently (PostgreSQL 12+, doesn't block)
REINDEX INDEX CONCURRENTLY idx_accommodations_city;

-- Rebuild all indexes on table
REINDEX TABLE accommodations;
```

### Indexing Best Practices

#### 1. Index Foreign Keys

✅ **Always index foreign keys**:

```typescript
export const accommodationsTable = pgTable(
  'accommodations',
  {
    destinationId: varchar('destination_id', { length: 255 }),
    hostId: varchar('host_id', { length: 255 }),
  },
  (table) => ({
    // Index all foreign keys
    destinationIdx: index('idx_accommodations_destination')
      .on(table.destinationId),
    hostIdx: index('idx_accommodations_host')
      .on(table.hostId),
  })
);
```

#### 2. Index WHERE Clause Columns

✅ **Index frequently filtered columns**:

```typescript
export const accommodationsTable = pgTable(
  'accommodations',
  {
    city: varchar('city', { length: 100 }),
    isActive: boolean('is_active').default(true),
    pricePerNight: decimal('price_per_night', { precision: 10, scale: 2 }),
  },
  (table) => ({
    // Index for WHERE city = ?
    cityIdx: index('idx_accommodations_city').on(table.city),

    // Partial index for WHERE is_active = true
    activeIdx: index('idx_active_accommodations')
      .on(table.city)
      .where(sql`${table.isActive} = true`),

    // Index for price range queries
    priceIdx: index('idx_accommodations_price')
      .on(table.pricePerNight),
  })
);
```

#### 3. Consider Column Order in Composite Indexes

✅ **Most selective column first**:

```typescript
// GOOD: city more selective than isActive
cityActiveIdx: index('idx_city_active').on(table.city, table.isActive)

// BAD: isActive less selective (only true/false)
activeCityIdx: index('idx_active_city').on(table.isActive, table.city)
```

**Selectivity Formula**:

```sql
-- Check column selectivity (higher = more selective)
SELECT
  COUNT(DISTINCT city)::float / COUNT(*) as city_selectivity,
  COUNT(DISTINCT is_active)::float / COUNT(*) as active_selectivity
FROM accommodations;
```

#### 4. Don't Over-Index

❌ **Too many indexes hurt write performance**:

```typescript
// BAD: Too many indexes
export const accommodationsTable = pgTable(
  'accommodations',
  {
    name: varchar('name', { length: 255 }),
    city: varchar('city', { length: 100 }),
    address: varchar('address', { length: 255 }),
    isActive: boolean('is_active'),
  },
  (table) => ({
    nameIdx: index('idx_name').on(table.name), // ❌ Rarely queried
    cityIdx: index('idx_city').on(table.city), // ✅ OK
    addressIdx: index('idx_address').on(table.address), // ❌ Rarely queried
    activeIdx: index('idx_active').on(table.isActive), // ❌ Low selectivity
    cityActiveIdx: index('idx_city_active').on(table.city, table.isActive), // ✅ OK
  })
);
```

**Rule of Thumb**:

- Read-heavy tables: More indexes OK
- Write-heavy tables: Fewer indexes better
- Monitor index usage, drop unused

## Connection Pooling

### The Problem

Serverless functions create many short-lived connections:

```
Request 1 → Function 1 → New DB Connection (50ms overhead)
Request 2 → Function 2 → New DB Connection (50ms overhead)
Request 3 → Function 3 → New DB Connection (50ms overhead)
...
Request 100 → Function 100 → New DB Connection (50ms overhead)
```

**Impact**:

- Connection creation: ~50ms per connection
- Database connection limit: 100-200 connections
- Connection exhaustion → failed requests

### The Solution: Connection Pooling

Connection pooling reuses connections:

```
Requests → PgBouncer → Connection Pool (10-50) → PostgreSQL
```

### Neon Serverless Pooling

Neon provides built-in serverless pooling via PgBouncer.

**Configuration**:

```env
# Pooled connection (use this for queries)
DATABASE_URL=postgres://user:pass@host.neon.tech/db?sslmode=require&pgbouncer=true

# Direct connection (use this for migrations only)
DIRECT_DATABASE_URL=postgres://user:pass@host.neon.tech/db?sslmode=require
```

**Setup** (`packages/db/src/index.ts`):

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Create SQL client with connection pooling
const sql = neon(process.env.DATABASE_URL!, {
  // Enable connection pooling
  poolQueryViaFetch: true,

  // Cache connections in serverless environment
  fetchConnectionCache: true,
});

export const db = drizzle(sql);
```

### PgBouncer Modes

PgBouncer supports three pooling modes:

#### 1. Transaction Mode (Recommended)

Connection released after transaction completes.

```typescript
// Transaction mode: connection returned after commit
await db.transaction(async (tx) => {
  await tx.insert(accommodationsTable).values(newAccommodation);
  await tx.insert(imagesTable).values(images);
  // Connection returned to pool here
});
```

**Pros**:

- Efficient connection reuse
- Safe for most queries
- Good for serverless

**Cons**:

- Cannot use prepared statements across transactions
- Cannot use temporary tables
- Session-level settings not preserved

#### 2. Session Mode

Connection held for entire session (client connection).

```sql
-- Set pooling mode
ALTER DATABASE mydatabase SET pgbouncer.pool_mode = 'session';
```

**Pros**:

- Full PostgreSQL feature support
- Prepared statements work
- Session settings preserved

**Cons**:

- Less efficient (fewer connections reused)
- Not ideal for serverless (many sessions)

**When to Use**:

- Migrations (need session-level commands)
- Complex queries with prepared statements
- Need SET LOCAL commands

#### 3. Statement Mode

Connection released after each statement.

**Pros**:

- Maximum connection reuse

**Cons**:

- Cannot use transactions
- Very limited use cases

**When to Use**:

- Rarely (transaction mode is better)

### Connection Pool Configuration

**Optimal Pool Size**:

```typescript
const POOL_CONFIG = {
  // Minimum connections (always open)
  min: 10,

  // Maximum connections
  max: 50,

  // Close idle connections after 30s
  idleTimeoutMillis: 30000,

  // Reject requests after 5s wait
  connectionTimeoutMillis: 5000,

  // Maximum connection lifetime
  maxLifetimeSeconds: 3600, // 1 hour
};
```

**Formula for Max Connections**:

```
max_connections = (num_serverless_instances * 0.1) + 10

Example:
- 100 instances running concurrently
- max_connections = (100 * 0.1) + 10 = 20
```

### Connection Pool Monitoring

```sql
-- View current connections
SELECT
  COUNT(*) as total_connections,
  COUNT(*) FILTER (WHERE state = 'active') as active,
  COUNT(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = current_database();

-- View pool stats (PgBouncer)
SHOW POOLS;

-- View connection wait times
SELECT
  datname,
  usename,
  state,
  wait_event_type,
  wait_event,
  state_change
FROM pg_stat_activity
WHERE wait_event IS NOT NULL;
```

### Handling Connection Issues

#### Connection Pool Exhausted

**Symptoms**:

- `connection pool exhausted` errors
- Increased response times
- Timeouts

**Solutions**:

```typescript
// 1. Increase pool size
const POOL_CONFIG = {
  max: 100, // Increase from 50
};

// 2. Reduce idle timeout
const POOL_CONFIG = {
  idleTimeoutMillis: 10000, // 10s instead of 30s
};

// 3. Add retry logic
async function queryWithRetry(queryFn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      if (error.message.includes('pool exhausted') && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

#### Connection Leaks

**Detection**:

```sql
-- Find long-running queries
SELECT
  pid,
  now() - query_start as duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Kill long-running query
SELECT pg_terminate_backend(pid);
```

**Prevention**:

```typescript
// Always use transactions with timeout
await db.transaction(async (tx) => {
  // Set statement timeout
  await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);

  // Your queries here
  await tx.insert(accommodationsTable).values(data);
}, {
  timeout: 30000, // 30 second timeout
});
```

## Query Performance Patterns

### Batch Inserts

Inserting multiple rows in a single query is much faster than individual inserts.

❌ **Slow**: Individual inserts

```typescript
// 100 queries, 100 roundtrips
for (const item of items) {
  await db.insert(accommodationsTable).values(item);
}
// Time: ~1000ms (10ms per query)
```

✅ **Fast**: Batch insert

```typescript
// 1 query, 1 roundtrip
await db.insert(accommodationsTable).values(items);
// Time: ~50ms (50x faster!)
```

**Limits**:

- PostgreSQL: ~65,535 parameters per query
- Each row with 10 columns = 10 parameters
- Max rows per batch: ~6,500

**Large Batches**:

```typescript
// Insert in batches of 1000
async function batchInsert(items: Accommodation[], batchSize = 1000) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await db.insert(accommodationsTable).values(batch);
  }
}
```

### Batch Updates

❌ **Slow**: Individual updates

```typescript
// N queries
for (const id of ids) {
  await db
    .update(accommodationsTable)
    .set({ isActive: false })
    .where(eq(accommodationsTable.id, id));
}
```

✅ **Fast**: Single update with IN

```typescript
// 1 query
await db
  .update(accommodationsTable)
  .set({ isActive: false })
  .where(inArray(accommodationsTable.id, ids));
```

### Transactions

Use transactions to ensure atomicity and improve performance for related operations.

**Basic Transaction**:

```typescript
await db.transaction(async (tx) => {
  // Insert accommodation
  const [accommodation] = await tx
    .insert(accommodationsTable)
    .values(newAccommodation)
    .returning();

  // Insert related images
  await tx
    .insert(accommodationImagesTable)
    .values(
      images.map(img => ({
        ...img,
        accommodationId: accommodation.id,
      }))
    );

  // Both succeed or both fail (rollback)
});
```

**Transaction with Error Handling**:

```typescript
try {
  const result = await db.transaction(async (tx) => {
    const accommodation = await tx
      .insert(accommodationsTable)
      .values(data)
      .returning();

    const images = await tx
      .insert(imagesTable)
      .values(imageData)
      .returning();

    return { accommodation, images };
  });

  return result;
} catch (error) {
  // Transaction automatically rolled back
  console.error('Transaction failed:', error);
  throw error;
}
```

**Nested Transactions** (Savepoints):

```typescript
await db.transaction(async (tx) => {
  // Main transaction

  try {
    // Savepoint (nested transaction)
    await tx.transaction(async (nested) => {
      await nested.insert(accommodationsTable).values(data);
    });
  } catch (error) {
    // Nested transaction rolled back, main continues
    console.error('Nested transaction failed');
  }

  // Main transaction continues
  await tx.insert(auditLogTable).values(logEntry);
});
```

### Prepared Statements

Drizzle automatically uses prepared statements for security and performance.

**Automatic Prepared Statements**:

```typescript
// Automatically prepared and cached
const accommodation = await db
  .select()
  .from(accommodationsTable)
  .where(eq(accommodationsTable.id, id));
```

**Explicit Prepared Statements** (for repeated queries):

```typescript
// Define prepared statement once
const getAccommodationById = db
  .select()
  .from(accommodationsTable)
  .where(eq(accommodationsTable.id, sql.placeholder('id')))
  .prepare('get_accommodation_by_id');

// Execute multiple times efficiently (no re-parsing)
const acc1 = await getAccommodationById.execute({ id: 'id1' });
const acc2 = await getAccommodationById.execute({ id: 'id2' });
const acc3 = await getAccommodationById.execute({ id: 'id3' });
```

**Benefits**:

- Query plan cached (no re-planning)
- Protection against SQL injection
- Faster execution (~20% faster)

### Query Batching

Execute multiple independent queries in parallel:

```typescript
// Sequential (slow)
const accommodations = await db.select().from(accommodationsTable).limit(10);
const destinations = await db.select().from(destinationsTable).limit(10);
const amenities = await db.select().from(amenitiesTable);
// Total time: 30ms + 25ms + 20ms = 75ms

// Parallel (fast)
const [accommodations, destinations, amenities] = await Promise.all([
  db.select().from(accommodationsTable).limit(10),
  db.select().from(destinationsTable).limit(10),
  db.select().from(amenitiesTable),
]);
// Total time: max(30ms, 25ms, 20ms) = 30ms (2.5x faster!)
```

**Drizzle Batch API**:

```typescript
// Execute in single roundtrip
const results = await db.batch([
  db.select().from(accommodationsTable).limit(10),
  db.select().from(destinationsTable).limit(10),
  db.select().from(amenitiesTable),
]);

const [accommodations, destinations, amenities] = results;
```

## Database Denormalization

Denormalization means duplicating data to avoid expensive JOINs. Use sparingly and only when necessary.

### When to Denormalize

**Good Use Cases**:

1. **Read-Heavy Data**: Data read much more than written
2. **Expensive JOINs**: Complex multi-table joins
3. **Reporting**: Aggregate data for dashboards
4. **Performance Critical**: Absolute performance requirement

**Bad Use Cases**:

1. **Frequently Updated**: Data changes often (sync overhead)
2. **Simple Queries**: Single JOIN is fast enough
3. **Storage Concerns**: Duplicated data uses more space

### Example: Denormalized Destination Name

**Normalized (Default)**:

```typescript
// Two tables, requires JOIN
export const accommodationsTable = pgTable('accommodations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  destinationId: varchar('destination_id', { length: 255 }),
});

export const destinationsTable = pgTable('destinations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
});

// Query requires JOIN
const results = await db
  .select({
    accommodation: accommodationsTable,
    destination: destinationsTable,
  })
  .from(accommodationsTable)
  .leftJoin(
    destinationsTable,
    eq(accommodationsTable.destinationId, destinationsTable.id)
  );
```

**Denormalized**:

```typescript
// Single table, no JOIN needed
export const accommodationsTable = pgTable('accommodations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }),
  destinationId: varchar('destination_id', { length: 255 }),
  destinationName: varchar('destination_name', { length: 255 }), // Denormalized!
});

// Query is simple and fast
const results = await db
  .select()
  .from(accommodationsTable);
```

**Keep in Sync**:

```typescript
// Update destination name everywhere
await db.transaction(async (tx) => {
  // Update destinations table
  await tx
    .update(destinationsTable)
    .set({ name: newName })
    .where(eq(destinationsTable.id, destinationId));

  // Update denormalized field in accommodations
  await tx
    .update(accommodationsTable)
    .set({ destinationName: newName })
    .where(eq(accommodationsTable.destinationId, destinationId));
});
```

**Trade-offs**:

- ✅ Faster reads (no JOIN)
- ✅ Simpler queries
- ❌ More storage
- ❌ Update complexity
- ❌ Potential inconsistency

## Materialized Views

Materialized views are pre-computed query results stored as tables. Perfect for expensive aggregate queries.

### Creating Materialized Views

**SQL**:

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW accommodation_stats AS
SELECT
  d.id as destination_id,
  d.name as destination_name,
  COUNT(a.id) as accommodation_count,
  AVG(a.rating) as avg_rating,
  MIN(a.price_per_night) as min_price,
  MAX(a.price_per_night) as max_price,
  COUNT(CASE WHEN a.is_active THEN 1 END) as active_count
FROM destinations d
LEFT JOIN accommodations a ON a.destination_id = d.id
GROUP BY d.id, d.name;

-- Create index on materialized view
CREATE INDEX idx_accommodation_stats_destination
ON accommodation_stats(destination_id);
```

**Drizzle Migration**:

```typescript
// packages/db/src/migrations/0010_create_accommodation_stats.ts
import { sql } from 'drizzle-orm';

export async function up(db) {
  await db.execute(sql`
    CREATE MATERIALIZED VIEW accommodation_stats AS
    SELECT
      d.id as destination_id,
      d.name as destination_name,
      COUNT(a.id) as accommodation_count,
      AVG(a.rating) as avg_rating,
      MIN(a.price_per_night) as min_price,
      MAX(a.price_per_night) as max_price,
      COUNT(CASE WHEN a.is_active THEN 1 END) as active_count
    FROM destinations d
    LEFT JOIN accommodations a ON a.destination_id = d.id
    GROUP BY d.id, d.name
  `);

  await db.execute(sql`
    CREATE INDEX idx_accommodation_stats_destination
    ON accommodation_stats(destination_id)
  `);
}

export async function down(db) {
  await db.execute(sql`DROP MATERIALIZED VIEW IF EXISTS accommodation_stats`);
}
```

### Querying Materialized Views

```typescript
// Query materialized view (fast!)
const stats = await db.execute(sql`
  SELECT * FROM accommodation_stats
  WHERE destination_id = ${destinationId}
`);
```

### Refreshing Materialized Views

**Manual Refresh**:

```sql
-- Refresh (blocks reads)
REFRESH MATERIALIZED VIEW accommodation_stats;

-- Refresh concurrently (doesn't block, requires unique index)
REFRESH MATERIALIZED VIEW CONCURRENTLY accommodation_stats;
```

**Automated Refresh** (GitHub Actions):

```yaml
# .github/workflows/refresh-materialized-views.yml
name: Refresh Materialized Views

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh accommodation_stats
        run: |
          psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW CONCURRENTLY accommodation_stats"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Application-Level Refresh**:

```typescript
// Refresh after relevant changes
async function createAccommodation(data: CreateAccommodationInput) {
  const accommodation = await db
    .insert(accommodationsTable)
    .values(data)
    .returning();

  // Refresh stats view in background
  queueMicrotask(async () => {
    await db.execute(
      sql`REFRESH MATERIALIZED VIEW CONCURRENTLY accommodation_stats`
    );
  });

  return accommodation;
}
```

### When to Use Materialized Views

**Good Use Cases**:

- Expensive aggregations (GROUP BY, COUNT, AVG)
- Complex multi-table joins
- Dashboard statistics
- Reporting queries
- Data that updates infrequently

**Bad Use Cases**:

- Real-time data (use regular views)
- Frequently updated data
- Simple queries (not worth complexity)
- Data must be always fresh

## Monitoring Queries

### Enable Query Logging

**Slow Query Log**:

```sql
-- Log queries taking > 100ms
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- Verify setting
SHOW log_min_duration_statement;
```

**Query Logging** (all queries):

```sql
-- Log all queries (use in development only!)
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Disable logging
ALTER SYSTEM SET log_statement = 'none';
SELECT pg_reload_conf();
```

### pg_stat_statements

Essential extension for query performance monitoring.

**Install**:

```sql
-- Install extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**View Slowest Queries**:

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**View Most Frequent Queries**:

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
```

**View by Total Time**:

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  (total_exec_time / sum(total_exec_time) OVER ()) * 100 as percentage
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

**Reset Statistics**:

```sql
-- Reset all stats
SELECT pg_stat_statements_reset();
```

### Query Performance Analysis

**Find Sequential Scans**:

```sql
-- Find tables with sequential scans
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / NULLIF(seq_scan, 0) as avg_seq_tup_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 20;
```

**Find Missing Indexes**:

```sql
-- Find tables that would benefit from indexes
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / NULLIF(seq_scan, 0) as avg_tuples_per_seq_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
  AND seq_tup_read / NULLIF(seq_scan, 0) > 10000
ORDER BY seq_tup_read DESC;
```

**Check Table Sizes**:

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) -
    pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Best Practices Checklist

Use this checklist for every new feature or optimization:

### Pre-Deployment

- [ ] All foreign keys have indexes
- [ ] WHERE clause columns indexed
- [ ] No N+1 queries (verified with query logging)
- [ ] All queries use pagination (LIMIT/OFFSET)
- [ ] SELECT only needed columns (no `SELECT *`)
- [ ] EXPLAIN ANALYZE run on new queries
- [ ] Query execution time < 50ms (p95)
- [ ] Connection pooling configured (10-50 connections)
- [ ] Transactions used for related operations
- [ ] Prepared statements for repeated queries

### Post-Deployment

- [ ] Monitor query performance (pg_stat_statements)
- [ ] Check for slow queries (> 100ms)
- [ ] Review sequential scans
- [ ] Monitor connection pool utilization
- [ ] Check index usage statistics
- [ ] Review and drop unused indexes
- [ ] Monitor database cache hit rate (> 99%)
- [ ] Set up alerts for slow queries

### Regular Maintenance

- [ ] Weekly: Review pg_stat_statements for slow queries
- [ ] Monthly: Check for unused indexes
- [ ] Monthly: Analyze table/index bloat
- [ ] Quarterly: Review and optimize top queries
- [ ] Quarterly: Update table statistics (ANALYZE)
- [ ] Yearly: Review denormalization opportunities

## Troubleshooting

### Query Too Slow

**Symptoms**: Query taking > 100ms

**Diagnosis**:

1. Run EXPLAIN ANALYZE
2. Check for sequential scans
3. Verify indexes exist
4. Check index selectivity

**Solutions**:

```sql
-- 1. Check execution plan
EXPLAIN ANALYZE SELECT /* your query */;

-- 2. Add missing indexes
CREATE INDEX idx_column_name ON table_name(column_name);

-- 3. Update statistics
ANALYZE table_name;

-- 4. Consider denormalization for complex JOINs
```

### High Connection Count

**Symptoms**: "too many connections" errors

**Diagnosis**:

```sql
-- Check current connections
SELECT COUNT(*) FROM pg_stat_activity;

-- Check connection by state
SELECT state, COUNT(*)
FROM pg_stat_activity
GROUP BY state;
```

**Solutions**:

1. Increase connection pool size
2. Reduce idle timeout
3. Use PgBouncer transaction pooling
4. Fix connection leaks

### Index Not Being Used

**Symptoms**: Sequential scan despite index existing

**Diagnosis**:

```sql
-- Check if index exists
SELECT * FROM pg_indexes
WHERE tablename = 'accommodations';

-- Check index statistics
SELECT * FROM pg_stat_user_indexes
WHERE tablename = 'accommodations';

-- Run EXPLAIN to see if index used
EXPLAIN SELECT * FROM accommodations WHERE city = 'Concepción';
```

**Common Causes**:

1. **Wrong column order** (composite index)
2. **Function on column** (`LOWER(city)` won't use index on `city`)
3. **Type mismatch** (varchar vs text)
4. **Table too small** (PostgreSQL chooses seq scan)
5. **Outdated statistics** (run `ANALYZE table_name`)

**Solutions**:

```sql
-- Update statistics
ANALYZE accommodations;

-- Create functional index
CREATE INDEX idx_city_lower ON accommodations(LOWER(city));

-- Verify column types match
\d accommodations
```

### Deadlocks

**Symptoms**: "deadlock detected" errors

**Diagnosis**:

```sql
-- View recent deadlocks
SELECT * FROM pg_stat_database WHERE datname = current_database();
```

**Prevention**:

1. **Consistent lock order**: Always acquire locks in same order
2. **Short transactions**: Keep transactions as short as possible
3. **Explicit locking**: Use `FOR UPDATE` when needed
4. **Retry logic**: Implement automatic retry with exponential backoff

```typescript
async function updateWithRetry(fn: () => Promise<void>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fn();
      return;
    } catch (error) {
      if (error.message.includes('deadlock') && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 100; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### High Database CPU

**Symptoms**: Database CPU > 80%

**Diagnosis**:

```sql
-- Find expensive queries
SELECT
  pid,
  query,
  state,
  query_start,
  now() - query_start as duration
FROM pg_stat_activity
WHERE state = 'active'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
```

**Solutions**:

1. Optimize slow queries (EXPLAIN ANALYZE)
2. Add missing indexes
3. Use connection pooling
4. Scale database (vertical/horizontal)

## Next Steps

Continue to other performance topics:

- **[Caching Strategies](./caching.md)**: Backend cache, frontend cache, cache warming
- **[Frontend Optimization](./frontend-optimization.md)**: Bundle size, code splitting, Lighthouse
- **[Performance Monitoring](./monitoring.md)**: Real User Monitoring, API metrics, alerting

---

**Last Updated**: 2025-01-05

**Maintained By**: Tech Lead, Database Team

**Review Cycle**: Quarterly

**Next Review**: 2025-04-01
