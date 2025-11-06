# Performance Documentation

Welcome to the Hospeda performance documentation. This guide covers performance optimization strategies, best practices, and monitoring approaches for the entire platform.

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | Performance philosophy, targets, and architecture decisions |
| [Database Optimization](./database-optimization.md) | Query optimization, indexing, N+1 prevention, connection pooling |
| [Caching Strategies](./caching.md) | Backend cache (Hono), frontend cache (TanStack Query), cache warming |
| [Frontend Optimization](./frontend-optimization.md) | Bundle size, code splitting, Lighthouse optimization, image optimization |
| [Performance Monitoring](./monitoring.md) | Real User Monitoring (RUM), API metrics, database profiling, alerting |

## 🎯 Performance Targets

### Web Vitals (Lighthouse 100)

Core Web Vitals targets for optimal user experience:

| Metric | Target | Maximum | Description |
|--------|--------|---------|-------------|
| **LCP** | < 2.5s | 4.0s | Largest Contentful Paint - Main content load time |
| **FID** | < 100ms | 300ms | First Input Delay - Interactivity responsiveness |
| **CLS** | < 0.1 | 0.25 | Cumulative Layout Shift - Visual stability |
| **FCP** | < 1.8s | 3.0s | First Contentful Paint - First visual element |
| **TTI** | < 3.8s | 7.3s | Time to Interactive - Fully interactive page |

### API Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| **Response Time** (p95) | < 200ms | 500ms |
| **Throughput** | > 1000 req/s | - |
| **Error Rate** | < 0.1% | 1% |
| **Availability** | > 99.9% | - |

### Database Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| **Query Time** (p95) | < 50ms | 100ms |
| **Connection Pool** | 10-50 connections | - |
| **Cache Hit Rate** | > 80% | - |
| **Index Usage** | > 95% of queries | - |

## ✅ Optimization Checklist

### Pre-Deployment Checklist

Use this checklist before deploying any feature:

#### Database

- [ ] Database indexes created for all WHERE/JOIN clauses
- [ ] No N+1 queries (verified with query analysis)
- [ ] All queries use pagination (LIMIT/OFFSET or cursor-based)
- [ ] EXPLAIN ANALYZE run on all new queries
- [ ] Query execution time < 50ms (p95)
- [ ] Connection pooling configured (10-50 connections)
- [ ] Foreign keys indexed

#### Backend API

- [ ] API responses cached where appropriate
- [ ] Cache-Control headers configured
- [ ] Response time < 200ms (p95)
- [ ] Input validation with Zod
- [ ] Error handling implemented
- [ ] Rate limiting configured
- [ ] API endpoint tested with load testing (k6)

#### Frontend

- [ ] Bundle size < 100KB initial (Web app)
- [ ] Route-based code splitting implemented
- [ ] Images optimized (WebP format, lazy loading)
- [ ] Fonts optimized (woff2 format, preloaded)
- [ ] Critical CSS inlined
- [ ] Non-critical JavaScript deferred
- [ ] Lighthouse score > 95 for all metrics

#### Monitoring

- [ ] Performance metrics collection configured
- [ ] Error tracking enabled (Sentry)
- [ ] Database query monitoring active
- [ ] API endpoint monitoring configured
- [ ] Alerts configured for SLO violations

### Post-Deployment Checklist

Verify production performance:

#### Verification

- [ ] Real User Monitoring (RUM) data collected
- [ ] Production Lighthouse audit passed (score > 95)
- [ ] API response times within targets (< 200ms p95)
- [ ] Database query times within targets (< 50ms p95)
- [ ] No errors in error tracking system
- [ ] Cache hit rate > 80%

#### Monitoring Setup

- [ ] Performance alerts configured
- [ ] SLO dashboards created
- [ ] Weekly Lighthouse audits scheduled
- [ ] Database slow query alerts active
- [ ] API error rate alerts configured
- [ ] On-call rotation documented

#### Documentation

- [ ] Performance metrics documented
- [ ] Optimization decisions recorded (ADRs)
- [ ] Known performance issues tracked
- [ ] Runbook for performance incidents created

## 🚀 Quick Wins

Common optimizations that provide immediate performance improvements:

### 1. Add Database Indexes

**Problem**: Sequential scans on large tables

**Solution**:

```sql
-- Index foreign keys
CREATE INDEX idx_accommodations_destination_id
ON accommodations(destination_id);

-- Index WHERE clause columns
CREATE INDEX idx_accommodations_is_active
ON accommodations(is_active);

-- Composite indexes for multiple columns
CREATE INDEX idx_accommodations_city_active
ON accommodations(city, is_active);
```

**Impact**: 10-100x query speedup

**Time**: 5-15 minutes

### 2. Implement API Response Caching

**Problem**: Repeated expensive computations

**Solution**:

```typescript
import { cache } from 'hono/cache';

app.get(
  '/api/v1/accommodations',
  cache({
    cacheName: 'hospeda-api',
    cacheControl: 'max-age=300', // 5 minutes
  }),
  async (c) => {
    // Handler logic
  }
);
```

**Impact**: 5-10x faster response time for cached endpoints

**Time**: 10-20 minutes

### 3. Enable Image Optimization

**Problem**: Large unoptimized images slow page load

**Solution**:

```astro
---
import { Image } from 'astro:assets';
import accommodationImage from '../assets/accommodation.jpg';
---

<Image
  src={accommodationImage}
  alt="Accommodation"
  width={800}
  height={600}
  format="webp"
  loading="lazy"
/>
```

**Impact**: 50-80% reduction in image size

**Time**: 15-30 minutes

### 4. Use Route-Based Code Splitting

**Problem**: Large JavaScript bundles slow initial load

**Solution**:

```typescript
// Lazy load heavy components
const AdminDashboard = lazy(() => import('./AdminDashboard'));

// Lazy load routes
const routes = [
  {
    path: '/admin',
    component: lazy(() => import('./routes/admin')),
  },
];
```

**Impact**: 30-50% reduction in initial bundle size

**Time**: 20-40 minutes

### 5. Prefetch Critical Data

**Problem**: Waterfalls and loading states

**Solution**:

```typescript
import { queryOptions, useQuery } from '@tanstack/react-query';

// Define query options
const accommodationOptions = (id: string) => queryOptions({
  queryKey: ['accommodation', id],
  queryFn: () => fetchAccommodation(id),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Prefetch on hover
const handleMouseEnter = () => {
  queryClient.prefetchQuery(accommodationOptions(id));
};
```

**Impact**: Instant navigation, improved perceived performance

**Time**: 10-20 minutes per feature

## 📊 Monitoring Tools

### Frontend Monitoring

- **Lighthouse CI**: Automated performance audits in CI/CD
- **Web Vitals**: Real User Monitoring (RUM) for Core Web Vitals
- **Vercel Analytics**: Production performance metrics
- **Chrome DevTools**: Performance profiling and debugging

### Backend Monitoring

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Dashboards and visualizations
- **Sentry**: Error tracking and performance monitoring
- **Hono Metrics**: Request duration, error rates, throughput

### Database Monitoring

- **Neon Dashboard**: Query performance, connection pool, storage
- **pg_stat_statements**: Slow query analysis
- **EXPLAIN ANALYZE**: Query execution plan analysis
- **PgHero**: Database performance insights

See [Performance Monitoring](./monitoring.md) for detailed setup instructions.

## 📈 Performance Budget

### Bundle Size Budget

**Web App** (Public Site):

```json
{
  "js/initial": "100 KB",
  "js/route": "50 KB",
  "css/initial": "50 KB",
  "images/above-fold": "200 KB",
  "fonts": "50 KB",
  "total/initial": "400 KB"
}
```

**Admin App** (Dashboard):

```json
{
  "js/initial": "200 KB",
  "js/route": "75 KB",
  "css/initial": "75 KB",
  "vendor": "150 KB",
  "total/initial": "500 KB"
}
```

**API** (Response Size):

```json
{
  "list-endpoint": "50 KB",
  "detail-endpoint": "20 KB",
  "search-endpoint": "100 KB"
}
```

### Time Budget

**Web App**:

```json
{
  "ttfb": "200ms",
  "fcp": "1.8s",
  "lcp": "2.5s",
  "tti": "3.8s",
  "route-transition": "300ms"
}
```

**Admin App**:

```json
{
  "initial-load": "3.0s",
  "route-transition": "500ms",
  "table-render-100-rows": "200ms"
}
```

**API**:

```json
{
  "simple-get": "50ms",
  "list-endpoint": "100ms",
  "complex-query": "200ms",
  "mutation": "150ms"
}
```

## 🔍 Performance Testing

### Lighthouse Audit

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run audit
lhci autorun --collect.url=https://hospeda.com

# Run with budget
lhci autorun --config=lighthouserc.json
```

### Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run scripts/load-test.js

# Run with thresholds
k6 run --vus 100 --duration 5m scripts/load-test.js
```

### Database Profiling

```sql
-- Enable slow query log
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();

-- View slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## 🎓 Learning Resources

### Official Documentation

- [Web.dev - Performance](https://web.dev/performance/)
- [Web.dev - Core Web Vitals](https://web.dev/vitals/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Drizzle ORM Best Practices](https://orm.drizzle.team/docs/performance)

### Performance Guides

- [Frontend Performance Checklist](https://www.smashingmagazine.com/2021/01/front-end-performance-2021-free-pdf-checklist/)
- [Backend Performance Best Practices](https://github.com/goldbergyoni/nodebestpractices#performance-best-practices)
- [Database Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

### Tools and Libraries

- [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [k6 Load Testing](https://k6.io/docs/)
- [Web Vitals Library](https://github.com/GoogleChrome/web-vitals)
- [TanStack Query](https://tanstack.com/query/latest)

## 🔗 Related Documentation

### Architecture

- [System Architecture](../architecture/overview.md)
- [Database Schema](../architecture/database-schema.md)
- [API Design](../architecture/api-design.md)
- [Caching Strategy](../architecture/caching-strategy.md)

### Development

- [Development Setup](../development/setup.md)
- [Testing Guide](../development/testing.md)
- [Deployment Guide](../deployment/README.md)

### Operations

- [Monitoring Setup](../operations/monitoring.md)
- [Alerting Configuration](../operations/alerting.md)
- [Incident Response](../operations/incident-response.md)

## 📞 Support

### Performance Issues

If you encounter performance issues:

1. **Document the issue**: Include metrics, screenshots, and reproduction steps
2. **Check monitoring**: Review dashboards for anomalies
3. **Profile the code**: Use Chrome DevTools or database EXPLAIN ANALYZE
4. **Create GitHub issue**: Use performance issue template
5. **Contact on-call**: For production critical issues

### Performance Questions

For questions about performance optimization:

- Check this documentation first
- Review related documentation
- Ask in #performance Slack channel
- Consult with Performance Team

## 🗺️ Roadmap

### Q1 2025

- [ ] Implement Redis caching layer
- [ ] Set up Prometheus + Grafana monitoring
- [ ] Configure Real User Monitoring (RUM)
- [ ] Establish performance SLOs

### Q2 2025

- [ ] Optimize database queries (target < 50ms p95)
- [ ] Implement CDN for static assets
- [ ] Set up automated performance regression testing
- [ ] Create performance runbooks

### Q3 2025

- [ ] Implement edge caching with Vercel
- [ ] Optimize images with Cloudinary
- [ ] Set up performance budgets in CI
- [ ] Conduct performance audit with external vendor

### Q4 2025

- [ ] Implement HTTP/3 and QUIC
- [ ] Optimize database with read replicas
- [ ] Set up predictive scaling
- [ ] Review and update performance targets

---

**Last Updated**: 2025-01-05

**Maintained By**: Tech Lead, Performance Team

**Review Cycle**: Quarterly

**Next Review**: 2025-04-01
