# Performance Standards

This document defines performance targets, optimization strategies, and monitoring practices for web applications.

---

## Table of Contents

1. [Core Web Vitals](#core-web-vitals)
2. [API Performance](#api-performance)
3. [Database Optimization](#database-optimization)
4. [Caching Strategies](#caching-strategies)
5. [Bundle Optimization](#bundle-optimization)
6. [Rendering Performance](#rendering-performance)
7. [Monitoring and Measurement](#monitoring-and-measurement)
8. [Performance Checklist](#performance-checklist)

---

## Core Web Vitals

### Target Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time to render largest visible element |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness to user interactions |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability during loading |
| **FCP** (First Contentful Paint) | < 1.8s | Time to first meaningful content |
| **TTFB** (Time to First Byte) | < 800ms | Server response time |

### Optimization Strategies for Core Web Vitals

**LCP Optimization:**

- Preload critical resources (fonts, hero images)
- Use responsive images with `srcset` and `sizes`
- Implement server-side rendering for above-the-fold content
- Optimize server response time
- Use CDN for static assets

**INP Optimization:**

- Keep JavaScript execution under 50ms per task
- Use `requestIdleCallback` for non-critical work
- Debounce user input handlers
- Minimize main thread blocking
- Use Web Workers for heavy computation

**CLS Optimization:**

- Set explicit dimensions on images and videos
- Reserve space for dynamic content
- Avoid injecting content above existing content
- Use CSS `contain` property where appropriate

---

## API Performance

### Response Time Targets

| Endpoint Type | Target | Maximum |
|---------------|--------|---------|
| Health check | < 50ms | 100ms |
| Simple read (by ID) | < 100ms | 200ms |
| List with pagination | < 200ms | 500ms |
| Search with filters | < 300ms | 1s |
| Write operations | < 200ms | 500ms |
| Complex aggregations | < 500ms | 2s |

### API Optimization Techniques

```typescript
// 1. Pagination: Never return unbounded results
const listUsers = async ({ page = 1, pageSize = 20 }: ListInput) => {
  const limit = Math.min(pageSize, 100); // Cap maximum
  const offset = (page - 1) * limit;
  return db.query.users.findMany({ limit, offset });
};

// 2. Select only needed fields
const getUserSummary = async (id: string) => {
  return db.query.users.findFirst({
    columns: { id: true, name: true, email: true },
    where: eq(users.id, id),
  });
};

// 3. Parallel execution for independent queries
const getUserProfile = async (userId: string) => {
  const [user, orders, reviews] = await Promise.all([
    fetchUser(userId),
    fetchOrders(userId),
    fetchReviews(userId),
  ]);
  return { user, orders, reviews };
};

// 4. Early return for validation failures
const createOrder = async (input: OrderInput) => {
  const validation = orderSchema.safeParse(input);
  if (!validation.success) {
    throw new ValidationError(validation.error);
  }
  // Continue only if valid
};
```

---

## Database Optimization

### Query Performance Targets

| Query Type | Target | Action if Exceeded |
|------------|--------|--------------------|
| Simple lookup (indexed) | < 5ms | Check index usage |
| Filtered list | < 50ms | Add composite index |
| Full-text search | < 100ms | Use search engine |
| Complex join | < 200ms | Denormalize or cache |
| Aggregation | < 500ms | Use materialized views |

### Index Strategy

```sql
-- Always index foreign keys
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Index frequently filtered columns
CREATE INDEX idx_products_category ON products(category);

-- Composite indexes for common query patterns
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Partial indexes for filtered queries
CREATE INDEX idx_orders_active ON orders(created_at) WHERE status = 'active';
```

### Query Optimization Rules

1. **Use EXPLAIN ANALYZE** to verify query plans
2. **Avoid N+1 queries** - use eager loading or batch fetching
3. **Limit result sets** - always paginate
4. **Select specific columns** - avoid `SELECT *`
5. **Use connection pooling** - reuse database connections

### N+1 Query Prevention

```typescript
// BAD: N+1 queries
const users = await db.query.users.findMany();
for (const user of users) {
  user.orders = await db.query.orders.findMany({ where: eq(orders.userId, user.id) });
}

// GOOD: Eager loading
const users = await db.query.users.findMany({
  with: { orders: true },
});

// GOOD: Batch loading
const users = await db.query.users.findMany();
const userIds = users.map(u => u.id);
const allOrders = await db.query.orders.findMany({
  where: inArray(orders.userId, userIds),
});
```

---

## Caching Strategies

### Cache Layers

| Layer | Technology | TTL | Use Case |
|-------|-----------|-----|----------|
| **Browser** | HTTP Cache-Control | Varies | Static assets, API responses |
| **CDN** | Edge cache | 1-24h | Static assets, public pages |
| **Application** | In-memory (Map/LRU) | 1-60min | Computed results, config |
| **Distributed** | Redis/Memcached | 5-60min | Session data, API responses |
| **Database** | Query cache | Auto | Repeated query results |

### HTTP Caching Headers

```typescript
// Static assets (immutable, long cache)
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

// API responses (short cache, revalidate)
res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

// Private data (no shared cache)
res.setHeader('Cache-Control', 'private, max-age=300');

// No cache (sensitive data)
res.setHeader('Cache-Control', 'no-store');
```

### Cache Invalidation Patterns

1. **Time-based (TTL):** Set expiration time, simplest approach
2. **Event-based:** Invalidate on data mutations
3. **Version-based:** Append version/hash to cache keys
4. **Stale-while-revalidate:** Serve stale data while fetching fresh data

---

## Bundle Optimization

### Bundle Size Budgets

| Asset Type | Budget | Critical |
|------------|--------|----------|
| Initial JavaScript | < 200 KB (gzipped) | Yes |
| Initial CSS | < 50 KB (gzipped) | Yes |
| Per-route chunk | < 100 KB (gzipped) | No |
| Total JavaScript | < 500 KB (gzipped) | No |
| Individual images | < 200 KB | No |

### Optimization Techniques

```typescript
// 1. Dynamic imports for code splitting
const AdminPanel = lazy(() => import('./AdminPanel'));

// 2. Tree shaking: Use named exports
import { debounce } from 'lodash-es'; // GOOD: tree-shakeable
import _ from 'lodash';               // BAD: imports entire library

// 3. Analyze bundle size
// Use tools: webpack-bundle-analyzer, source-map-explorer, or bundlephobia
```

### Asset Optimization

- Compress images: Use WebP/AVIF format
- Use responsive images with `srcset`
- Lazy load below-the-fold images
- Inline critical CSS
- Preconnect to third-party origins
- Use font-display: swap for web fonts

---

## Rendering Performance

### React/Component Performance

```typescript
// 1. Memoize expensive computations
const expensiveResult = useMemo(() => computeExpensive(data), [data]);

// 2. Memoize callbacks to prevent re-renders
const handleClick = useCallback(() => doSomething(id), [id]);

// 3. Virtualize long lists
import { useVirtualizer } from '@tanstack/react-virtual';

// 4. Avoid unnecessary re-renders
const MemoizedComponent = React.memo(ExpensiveComponent);
```

### Server-Side Rendering

- Use SSR for above-the-fold content
- Stream HTML for faster TTFB
- Use partial hydration (Islands architecture) where supported
- Cache rendered HTML for static/semi-static content

---

## Monitoring and Measurement

### Tools

| Tool | Purpose | When |
|------|---------|------|
| Lighthouse | Core Web Vitals audit | Development, CI/CD |
| Web Vitals library | Real user monitoring | Production |
| DevTools Performance | Profiling | Development |
| APM (Datadog, etc.) | Server-side monitoring | Production |

### Performance Testing

```bash
# Run Lighthouse in CI
npx lighthouse https://your-app.com --output=json --output-path=./report.json

# Set performance budget thresholds
# Fail CI if budget exceeded
```

### Key Metrics to Monitor

- API response times (p50, p95, p99)
- Database query duration
- Error rates
- Memory usage
- CPU utilization
- Cache hit ratios

---

## Performance Checklist

Before deploying, verify:

- [ ] Core Web Vitals meet targets (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- [ ] API endpoints meet response time targets
- [ ] Database queries have appropriate indexes
- [ ] No N+1 query issues
- [ ] Bundle size within budget
- [ ] Images optimized and lazy loaded
- [ ] Caching strategy implemented
- [ ] Rate limiting configured
- [ ] Performance monitoring in place
- [ ] Load tested for expected traffic

---

**Performance is a feature. Applications that do not meet performance targets will require optimization before release.**
