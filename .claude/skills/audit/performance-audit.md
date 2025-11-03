---
name: performance-audit
category: audit
description: Comprehensive performance audit for database queries, API endpoints, frontend rendering, bundle size, and Core Web Vitals
usage: Use for performance optimization analysis, bottleneck identification, and validation against performance budgets
input: Application (database, API, frontend), performance budgets, baseline metrics, user scenarios
output: Performance audit report with metrics, bottlenecks, optimization recommendations, and trend analysis
---

# Performance Audit

## Overview

**Purpose**: Comprehensive performance audit analyzing database, API, frontend, and identifying optimization opportunities

**Category**: Audit
**Primary Users**: tech-lead
**Coordinates**: Performance optimization and monitoring

## When to Use This Skill

- Before production deployment
- After major feature additions
- When users report slowness
- As part of regular performance reviews (monthly)
- After database schema changes
- When Core Web Vitals scores degrade
- Before scaling infrastructure

## Prerequisites

**Required:**

- Running application (dev/staging/production)
- Access to performance monitoring tools
- Database query logs
- API endpoint documentation
- Frontend bundle analysis

**Optional:**

- Production-like data volume
- Load testing tools (Artillery, K6)
- APM tool (Sentry, DataDog)
- Lighthouse CI
- Real user monitoring (RUM) data

## Input

**What the skill needs:**

- Application URLs and endpoints
- Expected load (concurrent users, requests/sec)
- Performance budgets and SLAs
- Database schema and indexes
- API documentation
- Frontend bundle composition
- Historical performance data

## Audit Areas (8 Comprehensive Checks)

### 1. Database Performance

**Checks:**

- N+1 query detection
- Missing indexes identification
- Query execution time (< 100ms p95)
- Connection pool configuration
- Database size and growth rate
- Slow query log analysis
- JOIN complexity and optimization
- Pagination efficiency

**Metrics:**

- Query time percentiles (p50, p95, p99)
- Queries per second (QPS)
- Connection pool usage
- Cache hit ratio
- Index usage statistics

**Output:** Database performance score, slow queries list, index recommendations

### 2. API Performance

**Checks:**

- Response time per endpoint (< 200ms p95)
- Throughput (requests/second)
- Payload size (request/response)
- HTTP caching headers
- Compression (gzip/brotli)
- Rate limiting effectiveness
- Error rates and timeouts
- API versioning overhead

**Metrics:**

- Response time (p50, p95, p99)
- Request rate (req/sec)
- Error rate (%)
- Payload size (KB)
- Cache hit ratio

**Output:** API performance score, slow endpoints, optimization suggestions

### 3. Frontend Performance (Core Web Vitals)

**Checks:**

- **LCP** - Largest Contentful Paint (< 2.5s)
- **FID** - First Input Delay (< 100ms)
- **CLS** - Cumulative Layout Shift (< 0.1)
- **TTI** - Time to Interactive
- **TBT** - Total Blocking Time
- **FCP** - First Contentful Paint
- Resource loading waterfall
- Critical rendering path

**Metrics:**

- Core Web Vitals scores (good/needs improvement/poor)
- Page load time
- Time to interactive
- Resource count and size
- Render-blocking resources

**Output:** Frontend performance score, Web Vitals status, rendering optimizations

### 4. Bundle Size & Assets

**Checks:**

- JavaScript bundle size (< 500KB gzipped)
- CSS bundle size (< 100KB gzipped)
- Code splitting effectiveness
- Tree shaking optimization
- Unused code detection
- Third-party library impact
- Image optimization
- Font loading strategy

**Metrics:**

- Total bundle size (KB gzipped)
- First-party vs third-party code ratio
- Code coverage (% used vs shipped)
- Asset count and size

**Output:** Bundle analysis, bloat detection, splitting recommendations

### 5. Rendering Performance

**Checks:**

- React component re-renders
- Unnecessary reconciliation
- Virtual DOM performance
- Memo/useMemo/useCallback usage
- List virtualization (for long lists)
- Lazy loading implementation
- Suspense boundaries
- Server-side rendering (SSR) time

**Metrics:**

- Re-render count
- Component render time
- Paint time
- Layout shift count

**Output:** Rendering performance score, inefficient components, optimization tips

### 6. Network Performance

**Checks:**

- HTTP/2 or HTTP/3 usage
- CDN configuration
- Resource prioritization (preload, prefetch)
- Service worker caching
- Asset compression
- DNS lookup time
- TLS handshake time
- Connection reuse

**Metrics:**

- DNS lookup time
- Connection time
- TLS time
- Time to first byte (TTFB)
- Transfer time

**Output:** Network performance score, CDN effectiveness, connection optimizations

### 7. Memory & Resource Usage

**Checks:**

- Memory leaks detection
- Heap size growth
- Garbage collection frequency
- Event listener cleanup
- DOM node count
- Long-running operations
- Worker thread usage
- Resource cleanup on unmount

**Metrics:**

- Heap size (MB)
- GC frequency and duration
- DOM node count
- Event listener count
- Memory usage over time

**Output:** Memory usage report, leak detection, cleanup recommendations

### 8. Third-Party Performance Impact

**Checks:**

- Third-party script loading
- Analytics impact
- Social media widgets
- Payment provider performance
- Font loading from CDN
- External API latency
- Ad network overhead
- Chatbot/support widget impact

**Metrics:**

- Third-party script size
- Third-party execution time
- Blocking time from third-parties
- Third-party requests count

**Output:** Third-party audit, impact analysis, alternatives evaluation

## Workflow

### Phase 1: Preparation (5 minutes)

1. **Setup Tools:**
   - Configure Lighthouse
   - Setup database query logging
   - Prepare test scenarios

2. **Gather Baselines:**
   - Current Core Web Vitals
   - API response times
   - Database query metrics
   - Bundle sizes

### Phase 2: Automated Analysis (15 minutes)

1. **Lighthouse Audit:**

   ```bash
   lighthouse https://your-app.com --view --preset=desktop
   lighthouse https://your-app.com --view --preset=mobile
   ```

2. **Bundle Analysis:**

   ```bash
   pnpm run build --analyze
   # Review bundle composition
   ```

3. **Database Analysis:**

   ```sql
   -- Slow query log
   SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

   -- Missing indexes
   SELECT schemaname, tablename, attname
   FROM pg_stats
   WHERE n_distinct < -0.1 AND null_frac < 0.5;
   ```

### Phase 3: Manual Profiling (30 minutes)

1. **Frontend Profiling:**
   - React DevTools Profiler
   - Chrome Performance tab
   - Network waterfall analysis
   - Memory profiler

2. **API Profiling:**
   - Response time analysis
   - Payload size review
   - Cache effectiveness
   - Database query breakdown

3. **User Flow Testing:**
   - Critical user journeys
   - Authentication flow
   - Data-heavy operations
   - Search and filters

### Phase 4: Load Testing (20 minutes)

1. **API Load Test:**

   ```bash
   # Artillery configuration
   artillery run load-test.yml
   ```

2. **Database Load:**
   - Concurrent query testing
   - Connection pool stress test
   - Transaction throughput

3. **Frontend Under Load:**
   - Simulated concurrent users
   - Network throttling (3G, 4G)
   - CPU throttling (4x slowdown)

### Phase 5: Reporting (15 minutes)

1. **Categorize Findings:**
   - **Critical:** Performance budget violations (LCP > 4s, API > 1s)
   - **High:** Needs improvement (LCP 2.5-4s, API 200-500ms)
   - **Medium:** Optimization opportunities (bundle > 300KB)
   - **Low:** Best practice improvements (image formats, caching)

2. **Generate Report:**
   - Executive summary with scores
   - Metrics comparison (current vs baseline)
   - Bottleneck analysis with priority
   - Optimization recommendations
   - Performance budget status

## Output

**Performance Audit Report** (saved as `performance-audit-report.md`):

```markdown
# Performance Audit Report

**Date:** YYYY-MM-DD
**Auditor:** tech-lead
**Application:** [App Name]
**Environment:** [dev/staging/production]

## Executive Summary

- **Overall Performance Score:** X/100
- **Core Web Vitals:** [Pass/Fail]
- **Performance Budget:** [Within/Exceeded]
- **Critical Issues:** X
- **Optimization Opportunities:** X

## Core Web Vitals

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | X.Xs | < 2.5s | ✅/❌ |
| FID | Xms | < 100ms | ✅/❌ |
| CLS | X.XX | < 0.1 | ✅/❌ |

## Performance Metrics

### Database Performance

- **Average Query Time (p95):** Xms (target: < 100ms)
- **Slow Queries:** X queries > 100ms
- **N+1 Queries:** X detected
- **Missing Indexes:** X tables

### API Performance

- **Average Response Time (p95):** Xms (target: < 200ms)
- **Slowest Endpoints:** [list with times]
- **Payload Size (avg):** XKB
- **Error Rate:** X%

### Frontend Performance

- **Bundle Size:** XKB gzipped (target: < 500KB)
- **First Contentful Paint:** X.Xs
- **Time to Interactive:** X.Xs
- **Total Blocking Time:** Xms

## Findings by Priority

### Critical (Immediate Action)

1. **[Issue Title]**
   - **Impact:** [User experience impact]
   - **Current:** [Metric value]
   - **Target:** [Goal value]
   - **Location:** [File/Endpoint]
   - **Recommendation:** [Specific fix]
   - **Effort:** [Low/Medium/High]
   - **Expected Improvement:** [Metric improvement]

### High (Fix Soon)

[...]

### Medium (Optimization Opportunities)

[...]

### Low (Best Practices)

[...]

## Bottleneck Analysis

### Top 5 Performance Bottlenecks

1. **[Bottleneck Name]** - [Impact description]
   - **Time/Size:** [Metric]
   - **Root Cause:** [Analysis]
   - **Fix:** [Solution]
   - **Priority:** Critical/High/Medium

## Performance Budget Status

| Category | Current | Budget | Status |
|----------|---------|--------|--------|
| JavaScript | XKB | 500KB | ✅/❌ |
| CSS | XKB | 100KB | ✅/❌ |
| Images | XKB | 1MB | ✅/❌ |
| API (p95) | Xms | 200ms | ✅/❌ |
| Database (p95) | Xms | 100ms | ✅/❌ |

## Optimization Recommendations

### Database Optimizations

1. **Add Indexes**
   - Tables: [list]
   - Columns: [list]
   - Expected improvement: X% faster queries

2. **Optimize Queries**
   - [Query description]
   - Current: Xms
   - After optimization: Xms (estimated)

### API Optimizations

1. **Enable Caching**
   - Endpoints: [list]
   - Expected improvement: X% faster response

2. **Reduce Payload Size**
   - Implement pagination
   - Field selection
   - Compression

### Frontend Optimizations

1. **Code Splitting**
   - Routes to split: [list]
   - Expected reduction: XKB

2. **Image Optimization**
   - Convert to WebP/AVIF
   - Implement lazy loading
   - Use responsive images

3. **Component Optimization**
   - Memoize expensive components
   - Use virtualization for lists
   - Implement Suspense boundaries

## Trend Analysis

*Compare with previous audit (if available)*

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| LCP | X.Xs | X.Xs | +X% |
| API (p95) | Xms | Xms | +X% |
| Bundle Size | XKB | XKB | +X% |

## Next Steps

1. **Immediate Actions** (Critical)
   - [Action 1 with owner and deadline]
   - [Action 2]

2. **Short-term Improvements** (High, this sprint)
   - [Action 1]
   - [Action 2]

3. **Medium-term Optimizations** (Medium, next sprint)
   - [Action 1]
   - [Action 2]

4. **Long-term Enhancements** (Low, backlog)
   - [Action 1]
   - [Action 2]

5. **Monitoring & Follow-up**
   - Setup continuous monitoring
   - Schedule next audit (monthly)
   - Track performance budgets in CI/CD
```

## Success Criteria

- All critical performance issues identified
- Core Web Vitals meet "Good" thresholds
- Performance budgets validated
- Optimization recommendations prioritized
- Trend analysis completed (if previous data exists)
- Report delivered with actionable items

## Performance Budgets

**Default Budgets:**

- **LCP:** < 2.5s (Good), < 4s (Needs Improvement), > 4s (Poor)
- **FID:** < 100ms (Good), < 300ms (Needs Improvement), > 300ms (Poor)
- **CLS:** < 0.1 (Good), < 0.25 (Needs Improvement), > 0.25 (Poor)
- **API Response (p95):** < 200ms
- **Database Query (p95):** < 100ms
- **JavaScript Bundle:** < 500KB gzipped
- **CSS Bundle:** < 100KB gzipped
- **Images per Page:** < 1MB total
- **Total Page Weight:** < 2MB

## Best Practices

1. **Monitor continuously** - Don't wait for audits
2. **Track budgets in CI/CD** - Fail builds on budget violations
3. **Prioritize user impact** - Fix critical user flows first
4. **Measure real users** - Use RUM data over synthetic
5. **Test on real devices** - Not just dev machines
6. **Compare trends** - Track improvements over time
7. **Document baselines** - Know your starting point

## Tools Integration

**Automated Tools:**

- Lighthouse - Core Web Vitals and audits
- Bundle Analyzer - JavaScript/CSS analysis
- Chrome DevTools - Profiling and debugging
- Artillery/K6 - Load testing

**Monitoring:**

- Sentry - Performance monitoring
- Vercel Analytics - Real user monitoring
- PostgreSQL pg_stat_statements - Query analysis

**CI/CD Integration:**

- Lighthouse CI - Automated audits
- Bundle size check - Budget enforcement
- Performance regression tests

## Related Skills

- [performance-testing](../testing/performance-testing.md) - For development testing
- [qa-criteria-validator](../qa/qa-criteria-validator.md) - For acceptance validation
- [vercel-specialist](../tech/vercel-specialist.md) - For deployment optimization

## Related Commands

- `/performance-audit` - Invoke this skill for comprehensive performance review
- `/quality-check` - Includes basic performance checks
