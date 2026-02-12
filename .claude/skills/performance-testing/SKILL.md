---
name: performance-testing
description: Performance testing methodology across all application layers. Use when benchmarking, validating performance budgets, or measuring optimization impact.
---

# Performance Testing

## Purpose

Provide a systematic performance testing and optimization methodology across database, API, and frontend layers. This skill identifies bottlenecks, validates performance budgets, and guides optimization efforts with measurable before-and-after metrics.

## When to Use

- Before production deployment
- When adding performance-critical features
- After database schema changes
- When users report slowness
- As part of regular performance reviews
- When optimizing Core Web Vitals or load times

## Process

### Step 1: Database Performance Testing

**Objective**: Identify and optimize slow database queries.

**Actions:**

1. Enable query logging in the development environment
2. Identify slow queries (> 100ms)
3. Run EXPLAIN / EXPLAIN ANALYZE on slow queries
4. Check for common issues:
   - N+1 query problems
   - Missing indexes
   - Full table scans
   - Unnecessary SELECT *
   - Lack of pagination
5. Optimize queries:
   - Add indexes where needed
   - Use eager loading to eliminate N+1
   - Implement pagination on large datasets
   - Select only required columns

**Example Test:**

```typescript
import { describe, it, expect } from 'vitest';

describe('Database Performance', () => {
  it('should fetch records with relations in < 100ms', async () => {
    const start = performance.now();

    await db.orders.findMany({
      limit: 100,
      with: { customer: true, items: true },
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should not exhibit N+1 query patterns', async () => {
    const queryLog: string[] = [];
    db.on('query', (q) => queryLog.push(q));

    const orders = await db.orders.findMany({ limit: 10, with: { customer: true } });

    // Should use a JOIN or a single additional query, not 10 extra queries
    expect(queryLog.length).toBeLessThanOrEqual(2);
  });
});
```

**Targets:**

- All queries < 100ms (p95)
- No N+1 patterns detected
- Indexes used effectively
- Pagination on datasets > 100 rows

### Step 2: API Performance Testing

**Objective**: Ensure API endpoints meet response time targets.

**Actions:**

1. Measure response times:
   - GET requests < 200ms (p95)
   - POST/PUT requests < 300ms (p95)
   - Complex queries < 500ms (p95)
2. Test under load:
   - Concurrent requests
   - Sustained load over time
   - Spike testing
3. Monitor key metrics:
   - Response time (p50, p95, p99)
   - Throughput (requests/second)
   - Error rate
   - CPU and memory usage

**Example Load Test (Artillery):**

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 20
      name: Warm up
    - duration: 120
      arrivalRate: 50
      name: Sustained load
    - duration: 30
      arrivalRate: 200
      name: Spike
  ensure:
    p95: 200
    p99: 500

scenarios:
  - name: Browse and purchase
    flow:
      - get:
          url: '/api/products'
      - think: 2
      - get:
          url: '/api/products/{{ $randomString() }}'
      - think: 3
      - post:
          url: '/api/orders'
          json:
            productId: '{{ $randomString() }}'
            quantity: 1
```

**Example K6 Test:**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/products');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Step 3: Frontend Performance Testing

**Objective**: Validate Core Web Vitals and rendering performance.

**Actions:**

1. Measure Core Web Vitals:
   - LCP (Largest Contentful Paint) < 2.5s
   - FID (First Input Delay) < 100ms
   - CLS (Cumulative Layout Shift) < 0.1
   - INP (Interaction to Next Paint) < 200ms
2. Measure page load metrics:
   - TTFB (Time to First Byte) < 600ms
   - FCP (First Contentful Paint) < 1.8s
   - TTI (Time to Interactive) < 3.5s
3. Analyze bundle sizes:
   - Main bundle < 200KB gzipped
   - Total JavaScript < 500KB gzipped
4. Test rendering performance:
   - Component render time < 16ms (60fps)
   - Smooth scrolling and animations

**Example Test:**

```typescript
import { test, expect } from '@playwright/test';

test('Homepage meets Core Web Vitals', async ({ page }) => {
  await page.goto('/');

  const lcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1].startTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    });
  });

  expect(lcp).toBeLessThan(2500);
});
```

### Step 4: Bottleneck Identification

**Objective**: Find and prioritize performance issues.

1. Analyze performance profiles from all layers
2. Categorize bottlenecks:
   - **Database**: slow queries, N+1, missing indexes
   - **API**: blocking operations, inefficient algorithms
   - **Frontend**: large bundles, unnecessary re-renders
   - **Network**: large payloads, missing caching, no compression
3. Prioritize by user impact:
   - **High**: Affects > 50% of users, > 1s delay
   - **Medium**: Affects 20-50% of users, 500ms-1s delay
   - **Low**: Affects < 20% of users, < 500ms delay

### Step 5: Optimization and Regression Testing

After implementing optimizations:

1. Re-run the full test suite to verify no regressions
2. Re-measure performance metrics
3. Compare before-and-after results
4. Document improvements with concrete numbers

## Performance Budgets

```json
{
  "database": {
    "queryTime": { "p95": 100, "unit": "ms" },
    "n1Queries": 0
  },
  "api": {
    "responseTime": { "p95": 200, "unit": "ms" },
    "throughput": { "min": 1000, "unit": "req/s" },
    "errorRate": { "max": 0.1, "unit": "%" }
  },
  "frontend": {
    "lcp": { "max": 2500, "unit": "ms" },
    "fid": { "max": 100, "unit": "ms" },
    "cls": { "max": 0.1 },
    "bundleSize": { "max": 500, "unit": "KB gzipped" }
  }
}
```

## Recommended Tools

### Database

- Query logging and EXPLAIN ANALYZE
- pg_stat_statements (PostgreSQL)
- Slow query log analysis

### API

- Artillery -- load testing
- K6 -- performance scripting
- autocannon -- HTTP benchmarking

### Frontend

- Lighthouse -- web performance audits
- Chrome DevTools Performance panel
- WebPageTest -- real-world testing
- Bundle Analyzer -- JavaScript composition

## Best Practices

1. **Establish baselines** -- measure before optimizing
2. **Set budgets** -- define acceptable performance levels
3. **Test regularly** -- include performance checks in CI/CD
4. **Optimize strategically** -- focus on high-impact bottlenecks first
5. **Measure impact** -- quantify improvements with real data
6. **Avoid premature optimization** -- profile before changing code
7. **Test realistically** -- use production-like data volumes
8. **Monitor trends** -- track performance over time, not just snapshots
9. **Test on real devices** -- not just development machines
10. **Enforce budgets in CI** -- fail builds that exceed performance thresholds
