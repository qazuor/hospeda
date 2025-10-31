---
name: performance-audit
type: audit
category: quality
description: Comprehensive performance audit analyzing backend queries, frontend rendering, bundle sizes, and identifying optimization opportunities
---

# Performance Audit Command

## Purpose

Performs a comprehensive performance audit of the application, analyzing database queries, API response times, frontend rendering performance, bundle sizes, and identifying optimization opportunities. This command replaces the deprecated `/review-performance` command with enhanced metrics and actionable insights.

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

- Drizzle query analysis
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
- Hono performance metrics

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
- [ ] Missing React.memo/useMemo

**Tools:**

- Lighthouse audit
- React DevTools Profiler
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

- React Profiler
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

```
⚡ Performance Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overall Score: 78/100 (Good)

🔴 Critical Issues (2)
  1. N+1 Query in Accommodation Listing
     Location: services/accommodation.service.ts:145
     Impact: 50+ extra queries per request
     Fix: Add eager loading with relations

  2. Large Bundle Size (850KB gzipped)
     Location: apps/web build output
     Impact: 4.2s load time on 3G
     Fix: Implement code splitting

🟠 Performance Warnings (5)
  1. Missing database index on bookings.user_id
     Impact: 350ms query time
     Fix: CREATE INDEX idx_bookings_user_id

  2. Unused dependencies in bundle
     Impact: +120KB bundle size
     Fix: Remove unused: lodash, moment

  [...]

📈 Metrics

Database:
  ✓ Avg query time: 45ms (target: <100ms)
  ✗ N+1 queries detected: 3 locations
  ✓ Index coverage: 92%
  ✗ Missing indexes: 2

API:
  ✓ Avg response time: 180ms (target: <200ms)
  ✓ Throughput: 1,200 req/s
  ✗ Large payloads: /api/accommodations (250KB)
  ✓ Compression enabled

Frontend:
  ✗ LCP: 3.2s (target: <2.5s)
  ✓ FID: 45ms (target: <100ms)
  ✓ CLS: 0.05 (target: <0.1)
  ✗ Bundle size: 850KB (target: <500KB)

💡 Top Recommendations
  1. Fix N+1 queries (-50 queries per request)
  2. Implement code splitting (-350KB bundle)
  3. Add missing database indexes (-300ms query time)
  4. Optimize images with WebP (-40% size reduction)
  5. Enable service worker caching (+80% cache hits)

📊 Trends (vs last audit)
  Database queries: -12% ↓
  API response time: +8% ↑
  Bundle size: +15% ↑
  LCP: +0.4s ↑

📄 Detailed report: .claude/reports/performance-audit-report.md
```

### Report File Structure

```markdown
# Performance Audit Report

**Date**: 2024-01-15T10:30:00Z
**Scope**: Full Application
**Profile**: Enabled
**Auditor**: Claude Code Performance Audit

## Executive Summary

Overall Performance Score: 78/100 (Good)

**Key Findings:**
- 2 critical performance issues identified
- 5 optimization opportunities
- 3 areas exceeding targets
- Estimated improvement potential: 45% faster

## Critical Issues

### PERF-001: N+1 Query in Accommodation Listing
- **Severity**: Critical
- **Location**: services/accommodation.service.ts:145
- **Impact**:
  - 50+ extra database queries per request
  - 2.5s additional response time
  - Database connection pool saturation
- **Current Performance**: 3.2s response time
- **Expected After Fix**: 0.7s response time
- **Fix**:
  ```typescript
  // Before
  const accommodations = await this.model.findAll();
  // After
  const accommodations = await this.model.findAll({
    with: {
      owner: true,
      images: true,
      amenities: true
    }
  });
  ```

### PERF-002: Large Bundle Size

[Similar detailed structure]

## Performance Metrics

### Database Performance

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Avg Query Time | 45ms | <100ms | ✓ Pass |
| P95 Query Time | 180ms | <200ms | ✓ Pass |
| N+1 Queries | 3 found | 0 | ✗ Fail |
| Index Coverage | 92% | >90% | ✓ Pass |

### API Performance

[Similar metrics table]

### Frontend Performance

[Similar metrics table]

## Optimization Opportunities

### Database Optimizations

1. Add eager loading for related data
2. Create missing indexes
3. Implement query result caching

### API Optimizations

1. Enable response compression
2. Implement request batching
3. Add pagination to large responses

### Frontend Optimizations

1. Code splitting at route level
2. Lazy load non-critical components
3. Optimize image loading

## Benchmarks Comparison

[Performance trends over time]

## Recommendations

### Immediate Actions (This Sprint)

1. Fix N+1 queries
2. Add missing database indexes
3. Enable Gzip compression

### Short Term (Next Sprint)

1. Implement code splitting
2. Optimize images
3. Add service worker

### Long Term (Next Quarter)

1. Implement CDN
2. Database query optimization
3. Performance monitoring

## Testing Methodology

[Detailed explanation of testing approach]

## Next Steps

1. Address critical issues immediately
2. Implement high-impact optimizations
3. Re-audit after fixes
4. Establish performance monitoring

## Appendix

### Tools Used

- Lighthouse 10.0
- React Profiler
- Chrome DevTools
- Drizzle Studio

### Test Environment

- Node.js: 20.10.0
- Database: PostgreSQL 15
- Network: Simulated 3G

```

## Integration with Workflow

### Phase 3 - Validation

Run during Phase 3 (Validation):

1. After implementation complete
2. Before deployment
3. As part of `/quality-check`

### Continuous Monitoring

Set up automated performance tracking:

```yaml
- name: Performance Audit
  run: claude /performance-audit --benchmarks --report
  schedule:
    - cron: '0 0 * * 1'  # Weekly
```

## Best Practices

1. **Establish Baselines**: Create performance budgets
2. **Track Trends**: Monitor performance over time
3. **Fix High-Impact Issues First**: Prioritize by improvement potential
4. **Test Under Load**: Simulate real-world conditions
5. **Profile in Production**: Use RUM (Real User Monitoring)
6. **Document Optimizations**: Track what worked

## Common Performance Issues

### Database

- N+1 query problems
- Missing indexes
- Inefficient queries
- Large result sets

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

## Performance Budget

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
    "fid": "100ms"
  }
}
```

## Related Commands

- `/quality-check` - Comprehensive quality validation
- `/security-audit` - Security-specific audits
- `/accessibility-audit` - Accessibility compliance
- `/code-check` - Code quality and standards

## Notes

This command replaces the deprecated `/review-performance` command with enhanced:

- Automated performance measurement
- Trend analysis
- Fix suggestions with code examples
- Integration with performance budgets

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
