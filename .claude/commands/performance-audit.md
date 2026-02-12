---
name: performance-audit
description: Comprehensive performance audit analyzing database queries, API response times, frontend rendering, bundle sizes, and identifying optimization opportunities with performance budgets
---

# Performance Audit Command

## Purpose

Performs a comprehensive performance audit of the application, analyzing
database queries, API response times, frontend rendering performance, bundle
sizes, and identifying optimization opportunities. Provides measurable metrics
and actionable optimization guidance.

## When to Use

- **Before Production Deployment**: Ensure performance meets targets
- **After Major Features**: Validate performance impact of new features
- **Performance Regression**: When users report slowness
- **Optimization Cycles**: Regular performance reviews (monthly)
- **Scalability Planning**: Before expected traffic increases

## Usage

```bash
/performance-audit [options]
```

### Options

- `--scope <area>`: Focus audit on specific area (database, api, frontend, all)
- `--profile`: Enable detailed profiling with measurements
- `--report`: Generate detailed performance-audit-report.md
- `--benchmarks`: Compare against performance baselines

### Examples

```bash
/performance-audit                        # Standard full audit
/performance-audit --scope database --profile --report
/performance-audit --scope frontend --benchmarks
```

## Audit Process

### 1. Database Performance

**Checks:**

- [ ] N+1 query detection
- [ ] Missing database indexes
- [ ] Inefficient query patterns
- [ ] Large result set queries
- [ ] Missing pagination
- [ ] Unused indexes
- [ ] Table scan operations
- [ ] Query execution time > 100ms
- [ ] Connection pool configuration
- [ ] Database query caching

**Tools:**

- ORM query analysis
- EXPLAIN query plans
- Slow query log analysis
- Index usage statistics

**Benchmarks:**

- Query execution time < 100ms (p95)
- Index hit ratio > 95%
- Connection pool utilization < 80%

### 2. API Performance

**Checks:**

- [ ] API response time targets met
- [ ] Unnecessary data serialization
- [ ] Missing response compression
- [ ] Inefficient middleware chains
- [ ] Blocking operations in request handlers
- [ ] Missing caching headers
- [ ] Large response payloads
- [ ] Unnecessary data fetching
- [ ] Async operations not optimized
- [ ] Missing request batching

**Tools:**

- Response time monitoring
- Payload size analysis
- Middleware profiling

**Benchmarks:**

- API response time < 200ms (p95)
- Payload size < 100KB (typical)
- Throughput > 1000 req/s
- Error rate < 0.1%

### 3. Frontend Performance

**Checks:**

- [ ] Initial page load time
- [ ] Time to First Byte (TTFB)
- [ ] First Contentful Paint (FCP)
- [ ] Largest Contentful Paint (LCP)
- [ ] Time to Interactive (TTI)
- [ ] Cumulative Layout Shift (CLS)
- [ ] First Input Delay (FID)
- [ ] Unnecessary re-renders
- [ ] Large component trees
- [ ] Missing memoization (React.memo, useMemo, useCallback)

**Tools:**

- Lighthouse audit
- Profiler tools (React Profiler, Vue DevTools, etc.)
- Performance API measurements
- Render time analysis

**Benchmarks:**

- LCP < 2.5s
- FID < 100ms
- CLS < 0.1
- TTI < 3.5s

### 4. Bundle Size & Assets

**Checks:**

- [ ] Total JavaScript bundle size
- [ ] Unused dependencies in bundles
- [ ] Missing code splitting
- [ ] Large vendor bundles
- [ ] Unoptimized images
- [ ] Missing lazy loading
- [ ] Unused CSS
- [ ] Missing tree shaking
- [ ] Source map size in production
- [ ] Asset compression

**Tools:**

- Bundle analyzer
- Dependency analysis
- Asset size calculator
- Compression verification

**Benchmarks:**

- Main bundle < 200KB (gzipped)
- Total JS < 500KB (gzipped)
- Image optimization > 80%
- Compression ratio > 70%

### 5. Rendering Performance

**Checks:**

- [ ] Component render time
- [ ] Unnecessary effect executions
- [ ] Missing virtualization for long lists
- [ ] Large DOM trees (> 1500 nodes)
- [ ] Expensive calculations in render
- [ ] Prop drilling causing re-renders
- [ ] Context provider optimization
- [ ] Animation performance (60fps)
- [ ] Scroll performance
- [ ] Layout thrashing

**Tools:**

- Framework profiler
- Chrome DevTools Performance
- Frame rate monitoring
- Layout shift detection

**Benchmarks:**

- Render time < 16ms (60fps)
- Re-renders minimized
- Virtual scroll for lists > 100 items
- Animation consistent 60fps

### 6. Network Performance

**Checks:**

- [ ] HTTP/2 or HTTP/3 usage
- [ ] Resource prioritization
- [ ] Preload/prefetch strategies
- [ ] CDN usage for static assets
- [ ] Missing resource hints
- [ ] Waterfall optimization
- [ ] Connection pooling
- [ ] DNS prefetch
- [ ] Service worker caching
- [ ] Offline support

**Tools:**

- Network waterfall analysis
- Resource timing API
- Cache hit rate monitoring
- CDN performance metrics

**Benchmarks:**

- Critical resources preloaded
- Static assets on CDN
- Cache hit rate > 80%
- Parallel requests optimized

### 7. Memory & Resource Usage

**Checks:**

- [ ] Memory leaks detection
- [ ] Large object allocations
- [ ] Detached DOM nodes
- [ ] Event listener cleanup
- [ ] Unbounded cache growth
- [ ] Worker thread usage
- [ ] Web Worker optimization
- [ ] IndexedDB usage
- [ ] LocalStorage size
- [ ] Resource cleanup on unmount

**Tools:**

- Memory profiler
- Heap snapshot analysis
- Performance monitor
- Resource tracking

**Benchmarks:**

- Memory usage stable over time
- No memory leaks
- Heap size < 100MB (typical)
- GC pauses < 50ms

### 8. Third-Party Performance

**Checks:**

- [ ] Third-party script impact
- [ ] Analytics overhead
- [ ] Social media widget performance
- [ ] Chat widget loading
- [ ] Ad network impact
- [ ] Font loading optimization
- [ ] External API latency
- [ ] CDN performance
- [ ] DNS resolution time
- [ ] Third-party request count

**Tools:**

- Third-party script analyzer
- Request blocking simulation
- Performance budget tracking
- External dependency audit

**Benchmarks:**

- Third-party impact < 500ms
- Font loading < 300ms
- Analytics async loaded
- External requests < 10

## Output Format

### Terminal Output

```text
Performance Audit Report

Overall Score: 78/100 (Good)

Critical Issues (2)
  1. N+1 Query in Item Listing
     Location: src/services/item.service.ts:145
     Impact: 50+ extra queries per request
     Fix: Add eager loading with relations

  2. Large Bundle Size (850KB gzipped)
     Location: build output
     Impact: 4.2s load time on 3G
     Fix: Implement code splitting

Performance Warnings (5)
  1. Missing database index on bookings.user_id
     Impact: 350ms query time
     Fix: CREATE INDEX idx_bookings_user_id

  2. Unused dependencies in bundle
     Impact: +120KB bundle size
     Fix: Remove unused packages

  [...]

Metrics

Database:
  Avg query time: 45ms (target: <100ms)
  N+1 queries detected: 3 locations
  Index coverage: 92%
  Missing indexes: 2

API:
  Avg response time: 180ms (target: <200ms)
  Throughput: 1,200 req/s
  Large payloads: /api/items (250KB)
  Compression enabled

Frontend:
  LCP: 3.2s (target: <2.5s)
  FID: 45ms (target: <100ms)
  CLS: 0.05 (target: <0.1)
  Bundle size: 850KB (target: <500KB)

Top Recommendations
  1. Fix N+1 queries (-50 queries per request)
  2. Implement code splitting (-350KB bundle)
  3. Add missing database indexes (-300ms query time)
  4. Optimize images with WebP (-40% size reduction)
  5. Enable service worker caching (+80% cache hits)
```

## Performance Budget

Define and track performance budgets for your project:

```javascript
{
  "database": {
    "queryTime": "100ms",
    "indexCoverage": "90%"
  },
  "api": {
    "responseTime": "200ms",
    "payloadSize": "100KB"
  },
  "frontend": {
    "bundleSize": "500KB",
    "lcp": "2.5s",
    "fid": "100ms",
    "cls": "0.1"
  },
  "network": {
    "thirdPartyImpact": "500ms",
    "cacheHitRate": "80%"
  }
}
```

## Best Practices

1. **Establish Baselines**: Create performance budgets before auditing
2. **Track Trends**: Monitor performance over time
3. **Fix High-Impact Issues First**: Prioritize by improvement potential
4. **Test Under Load**: Simulate real-world conditions
5. **Profile in Production**: Use Real User Monitoring (RUM)
6. **Document Optimizations**: Track what worked and what did not

## Common Performance Issues

### Database

- N+1 query problems
- Missing indexes
- Inefficient queries
- Large result sets without pagination

### API

- Blocking operations
- Missing caching
- Large payloads
- Synchronous processing

### Frontend

- Large bundles
- Unnecessary re-renders
- Missing code splitting
- Unoptimized images

### Network

- Missing compression
- No resource prioritization
- Inefficient caching
- Too many requests

## Related Commands

- `/quality-check` - Comprehensive quality validation (includes performance)
- `/security-audit` - Security-specific audits
- `/accessibility-audit` - Accessibility compliance checks
- `/code-check` - Code quality and standards
