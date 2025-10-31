---
name: performance-testing
category: testing
description: Performance testing methodology for database queries, API endpoints, and frontend rendering with benchmarks and optimization
usage: Use to identify performance bottlenecks, validate performance targets, and optimize slow operations
input: Application components (database, API, frontend), performance budgets, baseline metrics
output: Performance test reports, bottleneck analysis, optimization recommendations
---

# Performance Testing

## Overview

**Purpose**: Systematic performance testing and optimization across database, API, and frontend layers

**Category**: Testing
**Primary Users**: performance-engineer, tech-lead, qa-engineer

## When to Use This Skill

- Before production deployment
- When adding performance-critical features
- After database schema changes
- When users report slowness
- As part of regular performance reviews
- When optimizing Core Web Vitals

## Prerequisites

**Required:**

- Application deployed or running locally
- Performance testing tools configured
- Baseline metrics established
- Performance budgets defined

**Optional:**

- Production-like data volume
- Load testing tools (Artillery, K6)
- APM tool (Sentry, DataDog)
- Lighthouse CI

## Input

**What the skill needs:**

- Application endpoints and pages
- Expected load (users, requests/second)
- Performance budgets
- Baseline metrics for comparison

## Workflow

### Step 1: Database Performance Testing

**Objective**: Identify and optimize slow database queries

**Actions:**

1. Enable query logging in development
2. Identify slow queries (> 100ms)
3. Run EXPLAIN on slow queries
4. Check for:
   - N+1 query problems
   - Missing indexes
   - Full table scans
   - Unnecessary SELECT *
   - Lack of pagination
5. Optimize queries:
   - Add indexes where needed
   - Use eager loading
   - Implement pagination
   - Select only needed columns

**Validation:**

- [ ] All queries < 100ms (p95)
- [ ] No N+1 patterns detected
- [ ] Indexes used effectively
- [ ] Pagination implemented on large datasets

**Output**: Database performance report with optimization recommendations

**Example Test:**

```typescript
import { describe, it, expect } from 'vitest';
import { db } from '@repo/db';
import { measureQueryTime } from '../helpers/performance';

describe('Database Performance', () => {
  it('should fetch bookings in < 100ms', async () => {
    const startTime = performance.now();

    await db.bookings.findMany({
      limit: 100,
      with: {
        user: true,
        accommodation: true
      }
    });

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100);
  });

  it('should not have N+1 query problems', async () => {
    const queryCount = await measureQueryTime(async () => {
      const bookings = await db.bookings.findMany({ limit: 10 });

      // This should NOT trigger 10 additional queries
      for (const booking of bookings) {
        await booking.user; // Should be eager loaded
      }
    });

    expect(queryCount.queries).toBe(1); // Only 1 query expected
  });
});
```

### Step 2: API Performance Testing

**Objective**: Ensure API endpoints meet response time targets

**Actions:**

1. Test API response times:
   - GET requests < 200ms
   - POST/PUT requests < 300ms
   - Complex queries < 500ms
2. Test under load:
   - Concurrent requests
   - Sustained load
   - Spike testing
3. Monitor:
   - Response time (p50, p95, p99)
   - Throughput (requests/second)
   - Error rate
   - Resource usage (CPU, memory)
4. Identify bottlenecks:
   - Slow database queries
   - Blocking operations
   - Inefficient algorithms
   - Missing caching

**Validation:**

- [ ] API response time < 200ms (p95)
- [ ] Throughput > 1000 req/s
- [ ] Error rate < 0.1%
- [ ] No memory leaks under load

**Output**: API performance report with load test results

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
  ensure:
    p95: 200
    p99: 500

scenarios:
  - name: Browse and book
    flow:
      - get:
          url: '/api/accommodations'
      - think: 2
      - get:
          url: '/api/accommodations/{{ $randomString() }}'
      - think: 3
      - post:
          url: '/api/bookings'
          json:
            accommodationId: '{{ $randomString() }}'
            checkIn: '2024-02-01'
            checkOut: '2024-02-05'
```

### Step 3: Frontend Performance Testing

**Objective**: Validate Core Web Vitals and rendering performance

**Actions:**

1. Measure Core Web Vitals:
   - LCP (Largest Contentful Paint) < 2.5s
   - FID (First Input Delay) < 100ms
   - CLS (Cumulative Layout Shift) < 0.1
   - INP (Interaction to Next Paint) < 200ms
2. Test page load performance:
   - Time to First Byte (TTFB) < 600ms
   - First Contentful Paint (FCP) < 1.8s
   - Time to Interactive (TTI) < 3.5s
3. Analyze bundle sizes:
   - Main bundle < 200KB gzipped
   - Total JS < 500KB gzipped
4. Test rendering performance:
   - Component render time < 16ms (60fps)
   - Scroll performance smooth
   - Animation 60fps

**Validation:**

- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Bundle sizes within budget

**Output**: Frontend performance report with Lighthouse scores

**Example Test:**

```typescript
import { test, expect } from '@playwright/test';

test('Homepage meets Core Web Vitals', async ({ page }) => {
  await page.goto('/');

  // Measure LCP
  const lcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry.renderTime || lastEntry.loadTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    });
  });

  expect(lcp).toBeLessThan(2500);

  // Measure CLS
  const cls = await page.evaluate(() => {
    return new Promise((resolve) => {
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        resolve(clsValue);
      }).observe({ entryTypes: ['layout-shift'] });

      setTimeout(() => resolve(clsValue), 5000);
    });
  });

  expect(cls).toBeLessThan(0.1);
});
```

### Step 4: Bottleneck Identification

**Objective**: Find and prioritize performance issues

**Actions:**

1. Analyze performance profiles
2. Identify slow operations
3. Categorize bottlenecks:
   - Database (slow queries, N+1)
   - API (blocking operations, inefficient code)
   - Frontend (large bundles, unnecessary re-renders)
   - Network (large payloads, missing caching)
4. Prioritize by impact:
   - High: Affects > 50% users, > 1s delay
   - Medium: Affects 20-50% users, 500ms-1s delay
   - Low: < 20% users, < 500ms delay

**Validation:**

- [ ] All bottlenecks identified
- [ ] Impact assessed
- [ ] Prioritization clear

**Output**: Bottleneck analysis with priority matrix

### Step 5: Optimization Implementation

**Objective**: Apply optimizations and measure impact

**Actions:**

1. **Database Optimizations**:
   - Add indexes
   - Optimize queries
   - Implement caching
   - Add pagination

2. **API Optimizations**:
   - Enable compression
   - Implement caching
   - Use async operations
   - Optimize algorithms

3. **Frontend Optimizations**:
   - Code splitting
   - Lazy loading
   - Image optimization
   - Tree shaking
   - Memoization

**Validation:**

- [ ] Optimizations implemented
- [ ] Tests passing
- [ ] Performance improved

**Output**: Optimized code with performance gains

### Step 6: Regression Testing

**Objective**: Ensure optimizations don't break functionality

**Actions:**

1. Run full test suite
2. Verify functionality unchanged
3. Re-measure performance
4. Compare before/after metrics
5. Document improvements

**Validation:**

- [ ] All tests passing
- [ ] Performance improved
- [ ] No regressions introduced
- [ ] Gains documented

**Output**: Performance comparison report

## Output

**Produces:**

- Performance test reports
- Bottleneck analysis
- Optimization recommendations
- Before/after comparisons
- Performance budgets validation

**Success Criteria:**

- All performance targets met
- Bottlenecks identified and prioritized
- Optimizations implemented and validated
- Performance budgets enforced

## Performance Budgets

```javascript
{
  "database": {
    "queryTime": { "p95": 100, "unit": "ms" },
    "n1Queries": 0
  },
  "api": {
    "responseTime": { "p95": 200, "unit": "ms" },
    "throughput": { "min": 1000, "unit": "req/s" }
  },
  "frontend": {
    "lcp": { "max": 2500, "unit": "ms" },
    "fid": { "max": 100, "unit": "ms" },
    "cls": { "max": 0.1 },
    "bundleSize": { "max": 500, "unit": "KB" }
  }
}
```

## Tools

### Database

- Drizzle query logging
- EXPLAIN / EXPLAIN ANALYZE
- PostgreSQL pg_stat_statements

### API

- Artillery (load testing)
- K6 (performance testing)
- autocannon (HTTP benchmarking)

### Frontend

- Lighthouse
- Chrome DevTools Performance
- WebPageTest
- Bundle Analyzer

## Best Practices

1. **Establish Baselines**: Measure before optimizing
2. **Set Budgets**: Define acceptable performance levels
3. **Test Regularly**: Include in CI/CD pipeline
4. **Optimize Strategically**: Focus on high-impact areas
5. **Measure Impact**: Quantify improvements
6. **Avoid Premature Optimization**: Profile before optimizing
7. **Test Realistically**: Use production-like data
8. **Monitor Trends**: Track performance over time

## Related Skills

- `api-app-testing` - API integration testing
- `security-testing` - Security performance impact

## Notes

- Performance testing should be continuous, not one-time
- Always measure before and after optimizations
- Use production-like data volumes for realistic tests
- Performance budgets should be enforced in CI/CD
- Core Web Vitals directly impact SEO and user experience
- Small improvements accumulate to significant gains
