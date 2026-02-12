---
name: performance-audit
description: Performance audit patterns for database, API, frontend, and Core Web Vitals. Use when identifying bottlenecks or optimizing application performance.
---

# Performance Audit

## Purpose

Conduct a comprehensive performance audit analyzing database queries, API response times, frontend rendering, bundle sizes, Core Web Vitals, memory usage, and network efficiency. This skill identifies bottlenecks, validates performance budgets, and produces an actionable optimization report with prioritized recommendations.

## When to Use

- Before production deployment
- After major feature additions
- When users report slowness
- As part of regular performance reviews (monthly recommended)
- After database schema changes
- When Core Web Vitals scores degrade
- Before scaling infrastructure

## Audit Areas

### 1. Database Performance

**Checks:**

- N+1 query detection
- Missing index identification
- Query execution time (target: < 100ms p95)
- Connection pool configuration
- Slow query log analysis
- JOIN complexity and optimization
- Pagination efficiency

**Metrics:**

- Query time percentiles (p50, p95, p99)
- Queries per second (QPS)
- Connection pool utilization
- Cache hit ratio
- Index usage statistics

**Example Analysis:**

```sql
-- Find slow queries
SELECT query, total_exec_time, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Identify missing indexes
SELECT schemaname, tablename, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_scan DESC;
```

### 2. API Performance

**Checks:**

- Response time per endpoint (target: < 200ms p95)
- Throughput under load (requests/second)
- Payload sizes (request and response)
- HTTP caching headers (Cache-Control, ETag)
- Compression (gzip/brotli)
- Rate limiting effectiveness
- Error rates and timeout frequency

**Metrics:**

- Response time (p50, p95, p99)
- Request rate (req/sec)
- Error rate (%)
- Payload size (KB)
- Cache hit ratio

### 3. Frontend Performance (Core Web Vitals)

**Checks:**

- LCP (Largest Contentful Paint) -- target: < 2.5s
- FID (First Input Delay) -- target: < 100ms
- CLS (Cumulative Layout Shift) -- target: < 0.1
- INP (Interaction to Next Paint) -- target: < 200ms
- TTI (Time to Interactive)
- TBT (Total Blocking Time)
- FCP (First Contentful Paint)
- Resource loading waterfall
- Critical rendering path

**Automated measurement:**

```bash
# Desktop audit
lighthouse https://your-app.com --preset=desktop --view

# Mobile audit
lighthouse https://your-app.com --preset=mobile --view
```

### 4. Bundle Size and Assets

**Checks:**

- JavaScript bundle size (target: < 500KB gzipped)
- CSS bundle size (target: < 100KB gzipped)
- Code splitting effectiveness
- Tree shaking optimization
- Unused code detection
- Third-party library impact
- Image optimization (format, compression, dimensions)
- Font loading strategy

**Metrics:**

- Total bundle size (KB gzipped)
- First-party vs. third-party code ratio
- Code coverage (% used vs. shipped)
- Asset count and total size

**Analysis:**

```bash
# Analyze bundle composition
npm run build -- --analyze
# or
npx webpack-bundle-analyzer dist/stats.json
```

### 5. Rendering Performance

**Checks:**

- Unnecessary component re-renders
- Expensive computations during render
- Memo/useMemo/useCallback usage
- List virtualization for long lists
- Lazy loading implementation
- Suspense boundaries for code splitting
- Server-side rendering (SSR) time

### 6. Network Performance

**Checks:**

- HTTP/2 or HTTP/3 usage
- CDN configuration
- Resource prioritization (preload, prefetch, preconnect)
- Service worker caching strategy
- Asset compression
- DNS lookup time
- TLS handshake time
- Connection reuse

### 7. Memory and Resource Usage

**Checks:**

- Memory leaks over time
- Heap size growth patterns
- Garbage collection frequency
- Event listener cleanup on unmount
- DOM node count
- Long-running operations
- Worker thread utilization

### 8. Third-Party Performance Impact

**Checks:**

- Third-party script loading time
- Analytics library overhead
- External API latency
- Font loading from CDN
- Third-party execution time
- Blocking time from external scripts

## Workflow

### Phase 1: Preparation

1. Configure monitoring and profiling tools
2. Gather current baseline metrics
3. Prepare test scenarios and user flows
4. Set up production-like data volume

### Phase 2: Automated Analysis

1. Run Lighthouse audits (desktop and mobile)
2. Analyze bundle composition
3. Query database performance statistics
4. Run load tests against API endpoints

### Phase 3: Manual Profiling

1. Profile frontend with React DevTools and Chrome Performance panel
2. Analyze API response times with request tracing
3. Review database query plans with EXPLAIN ANALYZE
4. Test critical user journeys under simulated network conditions

### Phase 4: Load Testing

```yaml
# Artillery load test configuration
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
```

### Phase 5: Reporting

Categorize findings by impact:

- **Critical**: Performance budget violations (LCP > 4s, API > 1s)
- **High**: Needs improvement (LCP 2.5-4s, API 200-500ms)
- **Medium**: Optimization opportunities (bundle > 300KB)
- **Low**: Best practice improvements (image formats, caching headers)

## Report Template

```markdown
# Performance Audit Report

**Date:** YYYY-MM-DD
**Application:** [App Name]
**Environment:** [dev/staging/production]

## Executive Summary
- **Overall Performance Score:** X/100
- **Core Web Vitals:** Pass/Fail
- **Performance Budget:** Within/Exceeded
- **Critical Issues:** X
- **Optimization Opportunities:** X

## Core Web Vitals
| Metric | Current | Target  | Status |
|--------|---------|---------|--------|
| LCP    | X.Xs    | < 2.5s  | PASS/FAIL |
| FID    | Xms     | < 100ms | PASS/FAIL |
| CLS    | X.XX    | < 0.1   | PASS/FAIL |
| INP    | Xms     | < 200ms | PASS/FAIL |

## Database Performance
- Average Query Time (p95): Xms (target: < 100ms)
- Slow Queries: X queries > 100ms
- N+1 Queries: X detected
- Missing Indexes: X tables

## API Performance
- Average Response Time (p95): Xms (target: < 200ms)
- Slowest Endpoints: [list with times]
- Error Rate: X%

## Frontend Performance
- Bundle Size: XKB gzipped (target: < 500KB)
- First Contentful Paint: X.Xs
- Time to Interactive: X.Xs

## Performance Budget Status
| Category   | Current | Budget | Status    |
|------------|---------|--------|-----------|
| JavaScript | XKB     | 500KB  | PASS/FAIL |
| CSS        | XKB     | 100KB  | PASS/FAIL |
| Images     | XKB     | 1MB    | PASS/FAIL |
| API (p95)  | Xms     | 200ms  | PASS/FAIL |
| DB (p95)   | Xms     | 100ms  | PASS/FAIL |

## Optimization Recommendations

### Database
1. Add indexes: [tables and columns]
2. Optimize queries: [specific queries]
3. Implement caching: [strategy]

### API
1. Enable response compression
2. Implement HTTP caching headers
3. Optimize slow endpoints

### Frontend
1. Code splitting: [routes to split]
2. Image optimization: [format and compression]
3. Lazy loading: [components and routes]
4. Memoization: [expensive components]

## Trend Analysis
| Metric      | Previous | Current | Change |
|-------------|----------|---------|--------|
| LCP         | X.Xs     | X.Xs    | +/-X%  |
| API (p95)   | Xms      | Xms     | +/-X%  |
| Bundle Size | XKB      | XKB     | +/-X%  |
```

## Performance Budgets

| Category       | Good      | Needs Improvement | Poor     |
|----------------|-----------|-------------------|----------|
| LCP            | < 2.5s    | 2.5s - 4s        | > 4s     |
| FID            | < 100ms   | 100ms - 300ms     | > 300ms  |
| CLS            | < 0.1     | 0.1 - 0.25       | > 0.25   |
| API (p95)      | < 200ms   | 200ms - 500ms     | > 500ms  |
| DB Query (p95) | < 100ms   | 100ms - 500ms     | > 500ms  |
| JS Bundle      | < 200KB   | 200KB - 500KB     | > 500KB  |
| Total Page     | < 1MB     | 1MB - 2MB         | > 2MB    |

## Best Practices

1. **Monitor continuously** -- do not wait for audits to find issues
2. **Enforce budgets in CI/CD** -- fail builds on budget violations
3. **Prioritize user impact** -- fix critical user flows first
4. **Measure real users** -- prefer RUM data over synthetic tests
5. **Test on real devices** -- not just high-end development machines
6. **Compare trends** -- track improvements over releases
7. **Document baselines** -- always know the starting point before optimizing
8. **Profile before optimizing** -- avoid premature optimization
9. **Use production-like data** -- realistic volumes for meaningful results
10. **Automate reporting** -- integrate Lighthouse CI and bundle checks

## Recommended Tools

- **Lighthouse** -- Core Web Vitals and web audits
- **Chrome DevTools** -- performance profiling and debugging
- **Bundle Analyzer** -- JavaScript/CSS composition
- **Artillery / K6** -- API load testing
- **pg_stat_statements** -- PostgreSQL query analysis
- **React DevTools Profiler** -- component render analysis
- **WebPageTest** -- real-world multi-location testing
