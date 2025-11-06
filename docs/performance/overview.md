# Performance Overview

This document outlines Hospeda's comprehensive performance strategy, including philosophy, targets, architecture decisions, budgets, and optimization workflows.

## Performance Philosophy

Hospeda's approach to performance is guided by four core principles:

### 1. User-First Optimization

**Focus on perceived performance over technical metrics.**

- Prioritize what users experience (loading states, interactivity)
- Optimize critical rendering path (above-the-fold content)
- Use optimistic updates to mask network latency
- Implement skeleton loaders and progressive enhancement

**Example**: Even if total page load is 3s, ensuring First Contentful Paint < 1.8s makes the page feel faster.

### 2. Data-Driven Decisions

**Measure everything, optimize bottlenecks systematically.**

- Establish baseline metrics before optimization
- Use Real User Monitoring (RUM) for production insights
- Profile with actual user devices and network conditions
- Focus optimization efforts on high-impact areas (80/20 rule)

**Example**: Profiling revealed 70% of API time spent on a single unindexed query. Adding an index reduced response time from 500ms to 20ms.

### 3. Proactive Performance Management

**Build performance into the development process from day one.**

- Set performance budgets for bundle size and timing
- Run automated Lighthouse audits in CI/CD
- Review performance impact in code reviews
- Monitor production metrics continuously

**Example**: CI fails if bundle size exceeds 100KB or Lighthouse score drops below 95, preventing performance regressions.

### 4. Continuous Improvement

**Performance is not a one-time effort but an ongoing practice.**

- Regular performance audits (weekly automated, quarterly manual)
- Monitor performance trends over time
- Set and review SLOs (Service Level Objectives)
- Learn from performance incidents

**Example**: Weekly Lighthouse reports track performance trends. Quarterly reviews update targets and strategies.

## Performance Targets

### Frontend Performance Targets

#### Lighthouse Scores (Minimum)

All pages must meet these minimum scores:

| Metric | Minimum | Target | Notes |
|--------|---------|--------|-------|
| **Performance** | 90 | 95+ | Core Web Vitals composite |
| **Accessibility** | 95 | 100 | WCAG 2.1 AA compliance |
| **Best Practices** | 95 | 100 | Security, HTTPS, console errors |
| **SEO** | 95 | 100 | Meta tags, structured data |

#### Core Web Vitals

| Metric | Good | Needs Improvement | Poor | Description |
|--------|------|-------------------|------|-------------|
| **LCP** | < 2.5s | 2.5s - 4.0s | > 4.0s | Largest Contentful Paint - When main content loads |
| **FID** | < 100ms | 100ms - 300ms | > 300ms | First Input Delay - Time to first user interaction |
| **CLS** | < 0.1 | 0.1 - 0.25 | > 0.25 | Cumulative Layout Shift - Visual stability score |
| **FCP** | < 1.8s | 1.8s - 3.0s | > 3.0s | First Contentful Paint - First visual element |
| **TTI** | < 3.8s | 3.8s - 7.3s | > 7.3s | Time to Interactive - Page fully interactive |
| **TBT** | < 200ms | 200ms - 600ms | > 600ms | Total Blocking Time - Main thread blocking |

**Target**: 75% of page loads should be in "Good" category for all metrics.

#### Bundle Size Targets

**Web App** (Public Site):

| Asset Type | Target | Maximum | Notes |
|------------|--------|---------|-------|
| **Initial JS** | < 80KB | 100KB | First page load JavaScript |
| **Route JS** | < 30KB | 50KB | Per-route JavaScript bundles |
| **Initial CSS** | < 40KB | 50KB | Critical CSS only |
| **Images (Above-Fold)** | < 150KB | 200KB | Optimized WebP format |
| **Fonts** | < 40KB | 50KB | woff2 format, subset |
| **Total Initial** | < 300KB | 400KB | All assets for first render |

**Admin App** (Dashboard):

| Asset Type | Target | Maximum | Notes |
|------------|--------|---------|-------|
| **Initial JS** | < 150KB | 200KB | Includes dashboard framework |
| **Route JS** | < 50KB | 75KB | Per-route bundles |
| **Initial CSS** | < 60KB | 75KB | Tailwind + Shadcn UI |
| **Vendor JS** | < 120KB | 150KB | React, TanStack libraries |
| **Total Initial** | < 400KB | 500KB | Complete dashboard initial load |

#### Time Budget

**Web App**:

| Metric | 3G | 4G | WiFi | Notes |
|--------|-----|-----|------|-------|
| **TTFB** | < 600ms | < 200ms | < 100ms | Time to First Byte |
| **FCP** | < 3.0s | < 1.8s | < 1.0s | First Contentful Paint |
| **LCP** | < 5.0s | < 2.5s | < 1.5s | Largest Contentful Paint |
| **TTI** | < 8.0s | < 3.8s | < 2.5s | Time to Interactive |
| **Route Transition** | < 500ms | < 300ms | < 200ms | Client-side navigation |

**Admin App**:

| Metric | Target | Maximum | Notes |
|--------|--------|---------|-------|
| **Initial Load** | < 2.5s | 3.0s | First dashboard load (WiFi) |
| **Route Transition** | < 400ms | 500ms | Between pages |
| **Table Render (100 rows)** | < 150ms | 200ms | TanStack Table |
| **Table Render (1000 rows)** | < 500ms | 1000ms | Virtualized |
| **Form Validation** | < 50ms | 100ms | Zod schema validation |
| **Optimistic Update** | < 16ms | 50ms | Perceived instant |

### Backend Performance Targets

#### API Response Times (p95)

| Endpoint Type | Target | Maximum | Example |
|---------------|--------|---------|---------|
| **Simple GET** | < 50ms | 100ms | `GET /api/v1/health` |
| **List Endpoint** | < 100ms | 200ms | `GET /api/v1/accommodations` (paginated) |
| **Detail Endpoint** | < 75ms | 150ms | `GET /api/v1/accommodations/:id` |
| **POST/PUT** | < 150ms | 300ms | `POST /api/v1/accommodations` |
| **Complex Query** | < 200ms | 500ms | Search with filters, joins |
| **File Upload** | < 1000ms | 2000ms | Image upload to Cloudinary |

**Note**: p95 = 95th percentile (95% of requests faster than this)

#### Throughput

| Metric | Target | Burst | Notes |
|--------|--------|-------|-------|
| **Sustained RPS** | > 500 req/s | > 2000 req/s | Requests per second |
| **Peak RPS** | > 1000 req/s | > 5000 req/s | Short-term spike handling |
| **Concurrent Connections** | > 1000 | > 5000 | WebSocket + HTTP |

#### Error Rates

| Error Type | Target | Maximum | Action Threshold |
|------------|--------|---------|------------------|
| **5xx Errors** | < 0.01% | 0.1% | Alert immediately |
| **4xx Errors** | < 0.5% | 1.0% | Investigate if trending up |
| **Timeout Rate** | < 0.001% | 0.01% | Alert immediately |
| **Circuit Breaker Trips** | < 0.1% | 0.5% | Review dependencies |

#### Availability

| SLO | Target | Downtime/Month | Notes |
|-----|--------|----------------|-------|
| **API Uptime** | 99.9% | 43 minutes | Excluding planned maintenance |
| **Database Uptime** | 99.95% | 21 minutes | Neon SLA |
| **Overall System** | 99.5% | 3.6 hours | End-to-end availability |

### Database Performance Targets

#### Query Performance (p95)

| Query Type | Target | Maximum | Example |
|------------|--------|---------|---------|
| **Primary Key Lookup** | < 5ms | 10ms | `WHERE id = ?` |
| **Indexed Query** | < 20ms | 50ms | `WHERE destination_id = ?` |
| **Complex Join** | < 50ms | 100ms | Multiple table joins |
| **Aggregation** | < 100ms | 200ms | `COUNT`, `AVG`, `GROUP BY` |
| **Full-Text Search** | < 75ms | 150ms | `tsvector` search |

#### Connection Pool

| Metric | Minimum | Target | Maximum | Notes |
|--------|---------|--------|---------|-------|
| **Pool Size** | 10 | 20-30 | 50 | Active connections |
| **Idle Timeout** | 15s | 30s | 60s | Close idle connections |
| **Connection Acquisition** | < 10ms | < 50ms | < 100ms | Time to get connection |
| **Queue Wait Time** | < 50ms | < 100ms | < 500ms | When pool exhausted |

#### Cache Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **Cache Hit Rate** | > 80% | Frequently accessed data |
| **Cache Eviction Rate** | < 10% | Premature evictions |
| **Cache Latency** | < 5ms | In-memory cache (Redis) |

#### Index Usage

| Metric | Target | Notes |
|--------|--------|-------|
| **Index Scan Rate** | > 95% | Queries using indexes |
| **Sequential Scan Rate** | < 5% | Should be minimal |
| **Index Hit Rate** | > 99% | Index in shared_buffers |
| **Unused Indexes** | 0 | Drop unused indexes |

## Performance Budgets

Performance budgets are hard limits enforced in CI/CD. Exceeding budgets blocks PR merges.

### Bundle Size Budget

**Web App** (`apps/web`):

```json
{
  "budget": {
    "js/initial": { "max": "100 KB", "target": "80 KB" },
    "js/route": { "max": "50 KB", "target": "30 KB" },
    "css/initial": { "max": "50 KB", "target": "40 KB" },
    "images/above-fold": { "max": "200 KB", "target": "150 KB" },
    "fonts": { "max": "50 KB", "target": "40 KB" },
    "total/initial": { "max": "400 KB", "target": "300 KB" }
  },
  "enforcement": "strict",
  "exceptions": [
    "Initial map component can exceed by 50KB"
  ]
}
```

**Admin App** (`apps/admin`):

```json
{
  "budget": {
    "js/initial": { "max": "200 KB", "target": "150 KB" },
    "js/route": { "max": "75 KB", "target": "50 KB" },
    "css/initial": { "max": "75 KB", "target": "60 KB" },
    "vendor": { "max": "150 KB", "target": "120 KB" },
    "total/initial": { "max": "500 KB", "target": "400 KB" }
  },
  "enforcement": "warn",
  "exceptions": [
    "Data visualization routes can exceed route budget by 25KB"
  ]
}
```

### Time Budget

**Web App**:

```json
{
  "budget": {
    "ttfb": { "max": "200ms", "target": "100ms", "network": "4G" },
    "fcp": { "max": "1.8s", "target": "1.2s", "network": "4G" },
    "lcp": { "max": "2.5s", "target": "2.0s", "network": "4G" },
    "tti": { "max": "3.8s", "target": "3.0s", "network": "4G" },
    "cls": { "max": 0.1, "target": 0.05 },
    "route-transition": { "max": "300ms", "target": "200ms" }
  },
  "enforcement": "strict"
}
```

**Admin App**:

```json
{
  "budget": {
    "initial-load": { "max": "3.0s", "target": "2.5s" },
    "route-transition": { "max": "500ms", "target": "400ms" },
    "table-render-100": { "max": "200ms", "target": "150ms" },
    "form-validation": { "max": "100ms", "target": "50ms" }
  },
  "enforcement": "warn"
}
```

**API**:

```json
{
  "budget": {
    "simple-get": { "max": "100ms", "target": "50ms", "percentile": "p95" },
    "list-endpoint": { "max": "200ms", "target": "100ms", "percentile": "p95" },
    "complex-query": { "max": "500ms", "target": "200ms", "percentile": "p95" },
    "mutation": { "max": "300ms", "target": "150ms", "percentile": "p95" }
  },
  "enforcement": "strict"
}
```

### Enforcement Levels

- **Strict**: CI fails, blocks PR merge
- **Warn**: CI passes with warning, requires manual review
- **Monitor**: Tracked but doesn't block (for new metrics)

## Architecture Decisions

### Edge Computing Strategy

#### Vercel Edge Network

**Deployment Architecture**:

```
User Request
     ↓
Vercel Edge (Cloudflare)
     ↓
┌────────────────┐
│  Edge Function │ ← Geo-distributed, < 50ms latency
│  (Middleware)  │
└────────────────┘
     ↓
┌────────────────┐
│  SSR/ISR       │ ← Server-Side Rendering / Incremental Static Regeneration
│  (Astro/React) │
└────────────────┘
     ↓
┌────────────────┐
│  API (Hono)    │ ← Fly.io (closest region)
└────────────────┘
     ↓
┌────────────────┐
│  Database      │ ← Neon (primary region)
└────────────────┘
```

**Benefits**:

- **Low Latency**: Edge locations < 50ms from users globally
- **Automatic Scaling**: Scales to zero and infinitely
- **Built-in CDN**: Static assets cached at edge
- **DDoS Protection**: Cloudflare network security

**Trade-offs**:

- **Cold Starts**: First request after idle period slower (~500ms)
- **Limited Runtime**: Edge functions have execution time limits
- **Regional Database**: Database calls from edge add latency

**Optimizations**:

```typescript
// Edge function with caching
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  // Cache GET requests at edge for 5 minutes
  const cacheKey = new URL(req.url).pathname;
  const cached = await caches.default.match(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetch(API_URL);
  const clone = response.clone();

  // Store in edge cache
  await caches.default.put(
    cacheKey,
    clone,
    { expirationTtl: 300 } // 5 minutes
  );

  return response;
}
```

### Database Strategy

#### Connection Pooling

**Problem**: Serverless functions create many short-lived database connections.

**Solution**: Neon serverless pooling + PgBouncer transaction pooling.

**Architecture**:

```
Serverless Functions (100s of instances)
          ↓
    PgBouncer (Transaction Pooling)
          ↓
    Connection Pool (10-50 connections)
          ↓
    PostgreSQL (Neon)
```

**Configuration**:

```typescript
// packages/db/src/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!, {
  // Enable connection pooling
  poolQueryViaFetch: true,

  // Cache connections in serverless environment
  fetchConnectionCache: true,

  // Connection pool configuration
  poolConfig: {
    min: 10,          // Minimum connections
    max: 50,          // Maximum connections
    idleTimeoutMillis: 30000, // 30 seconds
  },
});

export const db = drizzle(sql);
```

**Benefits**:

- Reuses connections across requests
- Reduces connection overhead (~50ms per new connection)
- Handles connection spikes gracefully
- Automatic connection cleanup

#### Query Optimization

**Automatic Prepared Statements**:

Drizzle ORM automatically uses prepared statements for all queries, preventing SQL injection and improving performance.

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

// Execute multiple times efficiently
const acc1 = await getAccommodationById.execute({ id: 'id1' });
const acc2 = await getAccommodationById.execute({ id: 'id2' });
```

**Query Batching**:

```typescript
// Batch multiple queries in single roundtrip
const [accommodations, destinations, amenities] = await db.batch([
  db.select().from(accommodationsTable).limit(10),
  db.select().from(destinationsTable).limit(10),
  db.select().from(amenitiesTable),
]);
```

#### Indexing Strategy

**Automatic Indexes**:

1. **Primary Keys**: Automatically indexed
2. **Unique Constraints**: Automatically indexed
3. **Foreign Keys**: Must be manually indexed

**Manual Indexes**:

```typescript
// packages/db/src/schema/accommodations.ts
import { pgTable, varchar, boolean, index } from 'drizzle-orm/pg-core';

export const accommodationsTable = pgTable(
  'accommodations',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    isActive: boolean('is_active').default(true),
    destinationId: varchar('destination_id', { length: 255 }),
  },
  (table) => ({
    // Index for WHERE clauses
    cityIdx: index('idx_accommodations_city').on(table.city),

    // Composite index for multiple columns
    cityActiveIdx: index('idx_accommodations_city_active')
      .on(table.city, table.isActive),

    // Foreign key index
    destinationIdx: index('idx_accommodations_destination')
      .on(table.destinationId),

    // Partial index for common query
    activeAccommodationsIdx: index('idx_active_accommodations')
      .on(table.city)
      .where(sql`${table.isActive} = true`),
  })
);
```

**Index Selection Strategy**:

1. **Analyze Query Patterns**: Use pg_stat_statements
2. **Index WHERE Clauses**: Columns frequently filtered
3. **Index JOIN Columns**: Foreign keys and join conditions
4. **Composite Indexes**: Multiple columns in same query
5. **Partial Indexes**: Frequently filtered subsets

### Caching Strategy

#### Multi-Layer Caching

Hospeda implements a 5-layer caching strategy:

```
1. Browser Cache (Static Assets)
   ↓ miss
2. CDN Cache (Vercel Edge)
   ↓ miss
3. Server Cache (Hono Middleware - Cloudflare Workers KV)
   ↓ miss
4. Application Cache (TanStack Query - Client State)
   ↓ miss
5. Database Cache (PostgreSQL Query Cache)
```

#### Layer 1: Browser Cache

**Static Assets** (images, fonts, CSS, JS):

```typescript
// astro.config.mjs
export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },
  },
});
```

**Response Headers**:

```typescript
// apps/web/src/middleware.ts
export async function onRequest(context, next) {
  const response = await next();

  // Static assets: cache for 1 year
  if (context.url.pathname.startsWith('/assets/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // HTML pages: revalidate
  if (context.url.pathname.endsWith('.html')) {
    response.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  }

  return response;
}
```

#### Layer 2: CDN Cache (Vercel Edge)

**ISR (Incremental Static Regeneration)**:

```astro
---
// apps/web/src/pages/accommodations/[id].astro
export const prerender = false; // SSR

export async function getStaticPaths() {
  // Generate static paths for popular accommodations
  const popular = await getPopularAccommodations();
  return popular.map(acc => ({ params: { id: acc.id } }));
}

// Revalidate every 5 minutes
export const revalidate = 300;
---
```

**Stale-While-Revalidate**:

```typescript
// Serve stale content immediately while revalidating in background
response.headers.set(
  'Cache-Control',
  's-maxage=300, stale-while-revalidate=600'
);
```

#### Layer 3: Server Cache (Hono API)

**Implementation**:

```typescript
// apps/api/src/middlewares/cache.ts
import { cache } from 'hono/cache';

// Public endpoint caching
app.get(
  '/api/v1/accommodations',
  cache({
    cacheName: 'hospeda-api',
    cacheControl: 'max-age=300, stale-while-revalidate=600',
  }),
  async (c) => {
    // Handler
  }
);

// Private endpoint caching (per-user)
app.get(
  '/api/v1/bookings',
  cache({
    cacheName: 'hospeda-api',
    cacheControl: 'private, max-age=60',
    vary: ['Authorization'],
  }),
  async (c) => {
    // Handler
  }
);
```

**Cache Key Generation**:

```typescript
function generateCacheKey(req: Request): string {
  const url = new URL(req.url);
  const auth = req.headers.get('Authorization');

  // Include auth in key for private endpoints
  if (auth && isPrivateEndpoint(url.pathname)) {
    return `${url.pathname}${url.search}:${auth}`;
  }

  return `${url.pathname}${url.search}`;
}
```

#### Layer 4: Application Cache (TanStack Query)

**Client-Side State Cache**:

```typescript
// apps/admin/src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Keep in cache for 10 minutes
      gcTime: 10 * 60 * 1000,

      // Refetch on window focus
      refetchOnWindowFocus: true,

      // Retry failed requests
      retry: 3,
    },
  },
});
```

**Query Configuration**:

```typescript
// Frequently changing data: short staleTime
const { data: bookings } = useQuery({
  queryKey: ['bookings'],
  queryFn: fetchBookings,
  staleTime: 1 * 60 * 1000, // 1 minute
});

// Rarely changing data: long staleTime
const { data: destinations } = useQuery({
  queryKey: ['destinations'],
  queryFn: fetchDestinations,
  staleTime: 60 * 60 * 1000, // 1 hour
});

// Never cache: staleTime = 0
const { data: currentUser } = useQuery({
  queryKey: ['currentUser'],
  queryFn: fetchCurrentUser,
  staleTime: 0, // Always fresh
});
```

**Optimistic Updates**:

```typescript
const mutation = useMutation({
  mutationFn: updateAccommodation,

  onMutate: async (updatedAccommodation) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['accommodations'] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['accommodations']);

    // Optimistically update
    queryClient.setQueryData(['accommodations'], (old) => {
      return old.map(acc =>
        acc.id === updatedAccommodation.id ? updatedAccommodation : acc
      );
    });

    return { previous };
  },

  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['accommodations'], context.previous);
  },

  onSettled: () => {
    // Refetch after mutation
    queryClient.invalidateQueries({ queryKey: ['accommodations'] });
  },
});
```

#### Layer 5: Database Cache

**PostgreSQL Query Cache**:

```sql
-- Enable query result cache
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Check cache hit rate
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

**Prepared Statement Cache**:

```sql
-- PostgreSQL automatically caches prepared statements
-- View prepared statement stats
SELECT * FROM pg_prepared_statements;
```

### Code Splitting Strategy

#### Web App (Astro)

**Route-Based Splitting** (Automatic):

Astro automatically splits code by route:

```
apps/web/
  └── src/pages/
      ├── index.astro           → chunk-index.[hash].js
      ├── accommodations/
      │   ├── index.astro       → chunk-accommodations.[hash].js
      │   └── [id].astro        → chunk-accommodation-detail.[hash].js
      └── about.astro           → chunk-about.[hash].js
```

**Component Islands** (Hydration):

```astro
---
// Only ship JavaScript for interactive components
import SearchForm from '../components/SearchForm.tsx';
import StaticMap from '../components/StaticMap.astro';
---

<!-- Interactive island: ships JS -->
<SearchForm client:load />

<!-- Static component: no JS -->
<StaticMap />

<!-- Lazy-loaded island: ships JS on viewport -->
<HeavyComponent client:visible />
```

**Dynamic Imports**:

```typescript
// Lazy load heavy libraries
const mapLibrary = lazy(() => import('mapbox-gl'));

// Conditional loading
if (needsMap) {
  const { Map } = await import('mapbox-gl');
  new Map({ container: 'map' });
}
```

#### Admin App (TanStack Start)

**Route-Based Splitting**:

```typescript
// apps/admin/src/routes/__root.tsx
import { createRootRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootComponent,
});

// Lazy-loaded route components
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: lazyRouteComponent(() => import('./dashboard')),
});

const accommodationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accommodations',
  component: lazyRouteComponent(() => import('./accommodations')),
});
```

**Component-Level Splitting**:

```typescript
import { lazy, Suspense } from 'react';

// Lazy-load heavy components
const DataVisualization = lazy(() => import('./DataVisualization'));
const AdvancedFilters = lazy(() => import('./AdvancedFilters'));

function DashboardPage() {
  return (
    <>
      <Suspense fallback={<Skeleton />}>
        <DataVisualization />
      </Suspense>

      <Suspense fallback={<LoadingSpinner />}>
        <AdvancedFilters />
      </Suspense>
    </>
  );
}
```

**Vendor Splitting**:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],

          // Feature chunks
          'feature-tables': ['@tanstack/react-table'],
          'feature-forms': ['@tanstack/react-form', 'zod'],
        },
      },
    },
  },
});
```

## Performance Testing

### Lighthouse CI

**Configuration** (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:4321/",
        "http://localhost:4321/accommodations",
        "http://localhost:4321/about"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop",
        "throttling": {
          "rttMs": 40,
          "throughputKbps": 10240,
          "cpuSlowdownMultiplier": 1
        }
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 1.0 }],
        "categories:best-practices": ["error", { "minScore": 1.0 }],
        "categories:seo": ["error", { "minScore": 1.0 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**CI Integration** (`.github/workflows/lighthouse.yml`):

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build apps
        run: pnpm build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

### Load Testing (k6)

**Basic Load Test** (`scripts/load-test.js`):

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<200'], // 95% of requests under 200ms
    'http_req_failed': ['rate<0.01'],   // Less than 1% errors
    'errors': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.hospeda.com';

export default function() {
  // Test scenarios
  const scenarios = [
    testHealthCheck,
    testListAccommodations,
    testAccommodationDetail,
  ];

  // Randomly execute scenario
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();

  sleep(1);
}

function testHealthCheck() {
  const res = http.get(`${BASE_URL}/health`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 50ms': (r) => r.timings.duration < 50,
  }) || errorRate.add(1);
}

function testListAccommodations() {
  const res = http.get(`${BASE_URL}/api/v1/accommodations?page=1&pageSize=10`);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has data': (r) => JSON.parse(r.body).data.length > 0,
  }) || errorRate.add(1);
}

function testAccommodationDetail() {
  // First get list to get IDs
  const listRes = http.get(`${BASE_URL}/api/v1/accommodations?page=1&pageSize=5`);
  const accommodations = JSON.parse(listRes.body).data;

  if (accommodations.length === 0) return;

  // Get random accommodation detail
  const randomId = accommodations[Math.floor(Math.random() * accommodations.length)].id;
  const detailRes = http.get(`${BASE_URL}/api/v1/accommodations/${randomId}`);

  check(detailRes, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);
}
```

**Run Load Test**:

```bash
# Local test
k6 run scripts/load-test.js

# Against staging
k6 run scripts/load-test.js -e BASE_URL=https://staging-api.hospeda.com

# With more load
k6 run scripts/load-test.js --vus 500 --duration 10m

# Cloud test (k6 Cloud)
k6 cloud scripts/load-test.js
```

### Database Profiling

#### EXPLAIN ANALYZE

```sql
-- Profile query execution
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  a.id,
  a.name,
  a.city,
  d.name as destination_name,
  COUNT(b.id) as booking_count
FROM accommodations a
LEFT JOIN destinations d ON a.destination_id = d.id
LEFT JOIN bookings b ON a.id = b.accommodation_id
WHERE a.is_active = true
  AND d.city = 'Concepción del Uruguay'
GROUP BY a.id, a.name, a.city, d.name
ORDER BY booking_count DESC
LIMIT 10;
```

**Output Analysis**:

- **Seq Scan**: Sequential scan (bad, add index)
- **Index Scan**: Using index (good)
- **Nested Loop**: Join algorithm for small datasets
- **Hash Join**: Join algorithm for larger datasets
- **Buffers**: How many buffers read (shared hit = cached)
- **Actual Time**: Real execution time

#### Slow Query Log

```sql
-- Enable slow query logging (queries > 100ms)
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- View configuration
SHOW log_min_duration_statement;

-- Queries are logged to Neon dashboard
```

#### pg_stat_statements

```sql
-- Install extension (if not installed)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slowest queries
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

-- View most called queries
SELECT
  query,
  calls,
  mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();
```

## Performance Monitoring

### Real User Monitoring (RUM)

**Web Vitals Tracking**:

```typescript
// apps/web/src/lib/analytics.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  // Send to analytics endpoint
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      delta: metric.delta,
      rating: metric.rating,
      navigationType: metric.navigationType,
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
    keepalive: true, // Send even if user navigates away
  });
}

// Track all Web Vitals
onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

### API Monitoring

**Hono Metrics Middleware**:

```typescript
// apps/api/src/middlewares/metrics.ts
import { Hono } from 'hono';

const requestDuration = new Map<string, number>();

export const metricsMiddleware = async (c, next) => {
  const start = Date.now();
  const path = c.req.path;
  const method = c.req.method;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Record metrics
  recordMetric('http_request_duration_ms', duration, {
    method,
    path,
    status,
  });

  recordMetric('http_requests_total', 1, {
    method,
    path,
    status,
  });

  if (status >= 500) {
    recordMetric('http_errors_total', 1, {
      method,
      path,
      status,
    });
  }
};

function recordMetric(name: string, value: number, labels: Record<string, any>) {
  // Send to Prometheus, Grafana Cloud, or similar
  // Implementation depends on monitoring backend
}
```

## Optimization Workflow

### 1. Measure (Baseline)

Establish baseline metrics before optimization:

```bash
# Frontend
pnpm run lighthouse

# Backend
k6 run scripts/load-test.js

# Database
psql $DATABASE_URL -f scripts/analyze-queries.sql
```

**Document Baseline**:

```markdown
## Baseline Metrics (2025-01-05)

### Lighthouse Scores
- Performance: 87
- LCP: 3.2s
- FID: 120ms
- CLS: 0.15

### API Performance (p95)
- List accommodations: 350ms
- Accommodation detail: 180ms

### Database Performance (p95)
- Accommodation list query: 120ms
```

### 2. Identify (Bottlenecks)

Use profiling tools to identify bottlenecks:

**Frontend**:

```bash
# Chrome DevTools Performance tab
# - Record page load
# - Identify long tasks (> 50ms)
# - Check bundle sizes in Network tab
```

**Backend**:

```bash
# Profile API endpoints
k6 run scripts/profile-endpoints.js

# Identify slow endpoints
# - Response time > 200ms
# - High error rate
```

**Database**:

```sql
-- Find slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 50
ORDER BY mean_exec_time DESC;

-- Find sequential scans
SELECT schemaname, tablename, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;
```

### 3. Optimize (Implement)

Implement optimizations based on findings:

**Add Database Indexes**:

```typescript
// packages/db/src/schema/accommodations.ts
export const accommodationsTable = pgTable(
  'accommodations',
  { /* ... */ },
  (table) => ({
    // Add index for slow query
    cityActiveIdx: index('idx_city_active').on(table.city, table.isActive),
  })
);
```

**Implement Caching**:

```typescript
// apps/api/src/routes/accommodations.ts
app.get(
  '/api/v1/accommodations',
  cache({ cacheControl: 'max-age=300' }), // Add caching
  handler
);
```

**Code Splitting**:

```typescript
// Lazy load heavy component
const Map = lazy(() => import('./Map'));
```

### 4. Validate (Verify)

Re-run tests to verify improvements:

```bash
# Re-run Lighthouse
pnpm run lighthouse

# Re-run load test
k6 run scripts/load-test.js

# Compare results
scripts/compare-metrics.sh baseline.json current.json
```

**Document Improvements**:

```markdown
## Optimization Results (2025-01-06)

### Changes
1. Added index on (city, is_active)
2. Implemented API caching (5min TTL)
3. Lazy-loaded map component

### Impact
- Lighthouse Performance: 87 → 95 (+8)
- LCP: 3.2s → 2.1s (-34%)
- API response time: 350ms → 120ms (-66%)
- Database query time: 120ms → 15ms (-88%)
```

### 5. Monitor (Continuous)

Set up monitoring and alerts:

**Performance Alerts**:

```yaml
# alerts.yml
alerts:
  - name: High API Response Time
    condition: p95(http_request_duration) > 500ms
    duration: 5m
    severity: warning

  - name: Lighthouse Score Drop
    condition: lighthouse_performance < 90
    severity: warning

  - name: Database Query Slow
    condition: p95(db_query_duration) > 100ms
    duration: 5m
    severity: warning
```

**Weekly Reports**:

```bash
# Generate weekly performance report
pnpm run performance:report --week 2025-W01

# Compare with previous week
pnpm run performance:compare --week1 2025-W01 --week2 2024-W52
```

## Common Pitfalls

### N+1 Queries

❌ **Bad**:

```typescript
// 1 query for accommodations
const accommodations = await db.select().from(accommodationsTable);

// N queries for destinations (one per accommodation)
for (const acc of accommodations) {
  const destination = await db
    .select()
    .from(destinationsTable)
    .where(eq(destinationsTable.id, acc.destinationId));

  console.log(acc.name, destination.name);
}
```

✅ **Good**:

```typescript
// Single query with JOIN
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
```

### Unbounded Queries

❌ **Bad**:

```typescript
// Returns ALL rows (could be millions)
const allAccommodations = await db.select().from(accommodationsTable);
```

✅ **Good**:

```typescript
// Always paginate
const accommodations = await db
  .select()
  .from(accommodationsTable)
  .limit(pageSize)
  .offset(page * pageSize);
```

### Missing Indexes

❌ **Bad**:

```sql
-- No index on email column
SELECT * FROM users WHERE email = 'user@example.com';
-- Result: Sequential scan (slow)
```

✅ **Good**:

```sql
-- Create index
CREATE INDEX idx_users_email ON users(email);

-- Same query now uses index (fast)
SELECT * FROM users WHERE email = 'user@example.com';
-- Result: Index scan
```

### Large Bundle Sizes

❌ **Bad**:

```typescript
// Imports entire library (300KB)
import * as _ from 'lodash';

const debounced = _.debounce(fn, 300);
```

✅ **Good**:

```typescript
// Import only what you need (5KB)
import debounce from 'lodash/debounce';

const debounced = debounce(fn, 300);
```

### Blocking Main Thread

❌ **Bad**:

```typescript
// Heavy computation blocks UI (50ms+)
function processLargeDataset(data) {
  return data.map(item => expensiveTransform(item));
}

// User clicks button → UI freezes → poor UX
```

✅ **Good**:

```typescript
// Use Web Worker for heavy computation
const worker = new Worker('/workers/process-data.js');

worker.postMessage(data);

worker.onmessage = (e) => {
  const results = e.data;
  updateUI(results);
};
```

### No Error Handling

❌ **Bad**:

```typescript
// Unhandled promise rejection crashes app
const data = await fetch('/api/data').then(r => r.json());
```

✅ **Good**:

```typescript
try {
  const response = await fetch('/api/data');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
} catch (error) {
  console.error('Failed to fetch data:', error);
  // Show user-friendly error message
  return { error: 'Failed to load data' };
}
```

## Next Steps

Continue to specific performance topics:

- **[Database Optimization](./database-optimization.md)**: Query optimization, indexing, N+1 prevention, connection pooling
- **[Caching Strategies](./caching.md)**: Backend cache, frontend cache, cache warming
- **[Frontend Optimization](./frontend-optimization.md)**: Bundle size, code splitting, Lighthouse optimization
- **[Performance Monitoring](./monitoring.md)**: Real User Monitoring, API metrics, database profiling, alerting

---

**Last Updated**: 2025-01-05

**Maintained By**: Tech Lead, Performance Team

**Review Cycle**: Quarterly

**Next Review**: 2025-04-01
