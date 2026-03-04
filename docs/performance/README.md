# Performance Documentation

## Performance Philosophy

Hospeda's approach to performance is guided by four core principles:

### 1. User-First Optimization

Focus on perceived performance over technical metrics:

- Prioritize what users experience (loading states, interactivity)
- Optimize critical rendering path (above-the-fold content)
- Use optimistic updates to mask network latency
- Implement skeleton loaders and progressive enhancement

### 2. Data-Driven Decisions

Measure everything, optimize bottlenecks systematically:

- Establish baseline metrics before optimization
- Use Real User Monitoring (RUM) for production insights
- Profile with actual user devices and network conditions
- Focus optimization efforts on high-impact areas (80/20 rule)

### 3. Proactive Performance Management

Build performance into the development process from day one:

- Set performance budgets for bundle size and timing
- Run automated Lighthouse audits in CI/CD
- Review performance impact in code reviews
- Monitor production metrics continuously

### 4. Continuous Improvement

Performance is not a one-time effort but an ongoing practice:

- Regular performance audits (weekly automated, quarterly manual)
- Monitor performance trends over time
- Set and review SLOs (Service Level Objectives)
- Learn from performance incidents

---

## Performance Targets

### Frontend - Core Web Vitals

| Metric | Good | Needs Improvement | Poor | Description |
|--------|------|-------------------|------|-------------|
| **LCP** | < 2.5s | 2.5s - 4.0s | > 4.0s | Largest Contentful Paint |
| **FID** | < 100ms | 100ms - 300ms | > 300ms | First Input Delay |
| **CLS** | < 0.1 | 0.1 - 0.25 | > 0.25 | Cumulative Layout Shift |
| **FCP** | < 1.8s | 1.8s - 3.0s | > 3.0s | First Contentful Paint |
| **TTI** | < 3.8s | 3.8s - 7.3s | > 7.3s | Time to Interactive |
| **TBT** | < 200ms | 200ms - 600ms | > 600ms | Total Blocking Time |

Target: 75% of page loads in "Good" category for all metrics.

### Frontend - Lighthouse Scores

| Metric | Minimum | Target |
|--------|---------|--------|
| Performance | 90 | 95+ |
| Accessibility | 95 | 100 |
| Best Practices | 95 | 100 |
| SEO | 95 | 100 |

### Frontend - Bundle Size Budgets

**Web App** (Public Site):

| Asset | Target | Maximum |
|-------|--------|---------|
| Initial JS | < 80KB | 100KB |
| Route JS | < 30KB | 50KB |
| Initial CSS | < 40KB | 50KB |
| Images (above-fold) | < 150KB | 200KB |
| Fonts | < 40KB | 50KB |
| Total Initial | < 300KB | 400KB |

**Admin App** (Dashboard):

| Asset | Target | Maximum |
|-------|--------|---------|
| Initial JS | < 150KB | 200KB |
| Route JS | < 50KB | 75KB |
| Initial CSS | < 60KB | 75KB |
| Vendor JS | < 120KB | 150KB |
| Total Initial | < 400KB | 500KB |

### Backend - API Response Times (p95)

| Endpoint Type | Target | Maximum | Example |
|---------------|--------|---------|---------|
| Simple GET | < 50ms | 100ms | `GET /api/v1/health` |
| List Endpoint | < 100ms | 200ms | `GET /api/v1/accommodations` (paginated) |
| Detail Endpoint | < 75ms | 150ms | `GET /api/v1/accommodations/:id` |
| POST/PUT | < 150ms | 300ms | `POST /api/v1/accommodations` |
| Complex Query | < 200ms | 500ms | Search with filters, joins |
| File Upload | < 1000ms | 2000ms | Image upload to Cloudinary |

### Backend - Availability

| SLO | Target | Downtime/Month |
|-----|--------|----------------|
| API Uptime | 99.9% | 43 minutes |
| Database Uptime | 99.95% | 21 minutes |
| Overall System | 99.5% | 3.6 hours |

### Database - Query Performance (p95)

| Query Type | Target | Maximum |
|------------|--------|---------|
| Primary Key Lookup | < 5ms | 10ms |
| Indexed Query | < 20ms | 50ms |
| Complex Join | < 50ms | 100ms |
| Aggregation | < 100ms | 200ms |
| Full-Text Search | < 75ms | 150ms |

### Database - Connection Pool

| Metric | Target | Maximum |
|--------|--------|---------|
| Pool Size | 20-30 | 50 |
| Connection Acquisition | < 50ms | 100ms |
| Cache Hit Rate | > 80% | - |
| Index Scan Rate | > 95% | - |

---

## Performance Budgets

Performance budgets are hard limits enforced in CI/CD. Exceeding budgets blocks PR merges.

### Enforcement Levels

- **Strict**: CI fails, blocks PR merge
- **Warn**: CI passes with warning, requires manual review
- **Monitor**: Tracked but does not block

**Web App** enforcement: Strict
**Admin App** enforcement: Warn

---

## Architecture Decisions

### Edge Computing (Vercel)

```
User Request
     |
Vercel Edge (Cloudflare)
     |
Edge Function (Middleware) .. Geo-distributed, < 50ms latency
     |
SSR/ISR (Astro/React)
     |
API (Hono) .. Vercel serverless
     |
Database (Neon) .. Primary region
```

**Benefits**: Low latency at edge, automatic scaling, built-in CDN, DDoS protection.
**Trade-offs**: Cold starts (~500ms), execution time limits, regional database latency from edge.

### Database Connection Pooling

Serverless functions create many short-lived connections. Neon serverless pooling + PgBouncer transaction pooling manages this:

```
Serverless Functions (100s of instances)
    |
PgBouncer (Transaction Pooling)
    |
Connection Pool (10-50 connections)
    |
PostgreSQL (Neon)
```

### Multi-Layer Caching

```
1. Browser Cache (Static Assets)    .. max-age headers, immutable hashes
2. CDN Cache (Vercel Edge)          .. stale-while-revalidate
3. Server Cache (Hono Middleware)    .. cache-control per endpoint
4. Application Cache (TanStack Query) .. staleTime per query
5. Database Cache (PostgreSQL)       .. shared_buffers, prepared statements
```

### Code Splitting

- **Web App (Astro)**: Automatic route-based splitting, component islands for selective hydration
- **Admin App (TanStack Start)**: Lazy-loaded route components, vendor chunk splitting

---

## Optimization Checklist

### Pre-Deployment

#### Database

- [ ] Indexes created for all WHERE/JOIN clauses
- [ ] No N+1 queries (verified with query analysis)
- [ ] All queries use pagination
- [ ] EXPLAIN ANALYZE run on new queries
- [ ] Query execution time < 50ms (p95)
- [ ] Foreign keys indexed

#### Backend API

- [ ] API responses cached where appropriate
- [ ] Cache-Control headers configured
- [ ] Response time < 200ms (p95)
- [ ] Input validation with Zod
- [ ] Error handling implemented
- [ ] Rate limiting configured

#### Frontend

- [ ] Bundle size < 100KB initial (Web app)
- [ ] Route-based code splitting implemented
- [ ] Images optimized (WebP format, lazy loading)
- [ ] Fonts optimized (woff2, preloaded)
- [ ] Non-critical JavaScript deferred
- [ ] Lighthouse score > 95

#### Monitoring

- [ ] Performance metrics collection configured
- [ ] Error tracking enabled (Sentry)
- [ ] Database query monitoring active
- [ ] Alerts configured for SLO violations

### Post-Deployment

- [ ] Real User Monitoring data collected
- [ ] Production Lighthouse audit passed
- [ ] API response times within targets
- [ ] Database query times within targets
- [ ] Cache hit rate > 80%

---

## Quick Wins

### 1. Add Database Indexes

10-100x query speedup. Index foreign keys and WHERE clause columns.

```sql
CREATE INDEX idx_accommodations_city_active ON accommodations(city, is_active);
```

### 2. API Response Caching

5-10x faster for cached endpoints.

```typescript
app.get('/api/v1/accommodations', cache({ cacheControl: 'max-age=300' }), handler);
```

### 3. Image Optimization

50-80% reduction in image size using Astro's Image component with WebP format and lazy loading.

### 4. Code Splitting

30-50% reduction in initial bundle via lazy-loaded routes and dynamic imports.

### 5. Data Prefetching

Instant navigation via TanStack Query prefetching on hover.

---

## Common Pitfalls

### N+1 Queries

Use JOINs instead of iterating queries in a loop:

```typescript
// Use single query with JOIN instead of N separate queries
const results = await db
  .select({ accommodation: accommodationsTable, destination: destinationsTable })
  .from(accommodationsTable)
  .leftJoin(destinationsTable, eq(accommodationsTable.destinationId, destinationsTable.id));
```

### Unbounded Queries

Always paginate. Never `SELECT *` without `LIMIT`.

### Large Bundle Sizes

Import only what you need. Use `import debounce from 'lodash/debounce'` instead of `import * as _ from 'lodash'`.

### Blocking Main Thread

Use Web Workers for heavy computations to avoid freezing the UI.

---

## Performance Testing

### Lighthouse CI

```bash
npm install -g @lhci/cli
lhci autorun --config=lighthouserc.json
```

### Load Testing (k6)

```bash
k6 run scripts/load-test.js
k6 run scripts/load-test.js -e BASE_URL=https://staging-api.hospeda.com
```

### Database Profiling

```sql
-- Find slow queries
SELECT query, mean_exec_time FROM pg_stat_statements
WHERE mean_exec_time > 50 ORDER BY mean_exec_time DESC;

-- Find sequential scans
SELECT tablename, seq_scan, seq_tup_read FROM pg_stat_user_tables
WHERE seq_scan > 0 ORDER BY seq_tup_read DESC;
```

---

## Monitoring Tools

### Frontend

- **Lighthouse CI**: Automated performance audits in CI/CD
- **Web Vitals**: Real User Monitoring for Core Web Vitals
- **Vercel Analytics**: Production performance metrics
- **Chrome DevTools**: Performance profiling and debugging

### Backend

- **Sentry**: Error tracking and performance monitoring
- **Hono Metrics**: Request duration, error rates, throughput
- **Vercel Analytics**: Function duration and error rate

### Database

- **Neon Dashboard**: Query performance, connection pool, storage
- **pg_stat_statements**: Slow query analysis
- **EXPLAIN ANALYZE**: Query execution plan analysis

---

## Detailed Documentation

| Document | Description |
|----------|-------------|
| [Database Optimization](../../packages/db/docs/guides/optimization.md) | Query optimization, indexing, N+1 prevention, connection pooling |
| [Caching Strategies](./caching.md) | Backend cache, frontend cache, cache warming |
| [Frontend Optimization](./frontend-optimization.md) | Bundle size, code splitting, Lighthouse optimization |
| [Performance Monitoring](./monitoring.md) | RUM, API metrics, database profiling, alerting |

## External Resources

- [Web.dev - Performance](https://web.dev/performance/)
- [Web.dev - Core Web Vitals](https://web.dev/vitals/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Drizzle ORM Best Practices](https://orm.drizzle.team/docs/performance)
- [k6 Load Testing](https://k6.io/docs/)
