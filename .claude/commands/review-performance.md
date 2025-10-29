# Review Performance Command

## Purpose

Comprehensive performance analysis examining database optimization, API response times, frontend bundle size, and resource utilization. REPORTS all performance findings and optimization opportunities.

## Usage

```bash
/review-performance
```text

## Description

Performs thorough performance analysis using the `performance-engineer` agent. Uses **REPORT all findings** strategy to provide complete performance assessment including bottlenecks, optimization opportunities, and performance benchmarks.

---

## Execution Flow

### Step 1: Performance Analysis

**Agent**: `performance-engineer`

**Process**:

- Comprehensive performance assessment across all layers
- Bottleneck identification and analysis
- Resource utilization evaluation
- Performance benchmark validation
- Optimization recommendation generation

---

## Performance Assessment Areas

### Database Performance

**Review Scope**:

- Query optimization analysis
- Index effectiveness review
- Connection pool configuration
- Transaction performance
- Data model efficiency

**Performance Checks**:

- ✅ **Query Efficiency**: Queries execute under 50ms
- ✅ **Index Usage**: Proper indexes for frequent queries
- ✅ **Connection Pooling**: Efficient connection management
- ✅ **Transaction Scope**: Minimal transaction duration
- ✅ **N+1 Prevention**: No N+1 query problems

**Common Issues**:

- Missing indexes on frequently queried columns
- Inefficient query patterns
- Over-fetching data
- Long-running transactions
- Inadequate connection pooling

**Optimization Opportunities**:

- Query optimization with proper indexes
- Database query result caching
- Connection pool tuning
- Query batching strategies
- Data model normalization

### API Performance

**Review Scope**:

- Endpoint response times
- Request processing efficiency
- Middleware performance impact
- Caching strategy effectiveness
- Rate limiting configuration

**Performance Checks**:

- ✅ **Response Times**: API responses under 200ms
- ✅ **Throughput**: Handles expected concurrent requests
- ✅ **Middleware Efficiency**: Minimal processing overhead
- ✅ **Caching Strategy**: Appropriate response caching
- ✅ **Resource Usage**: CPU and memory within limits

**Common Issues**:

- Slow database queries in endpoints
- Inefficient data serialization
- Missing response caching
- Heavy middleware processing
- Memory leaks in request handling

**Optimization Opportunities**:

- Response caching implementation
- Database query optimization
- Middleware optimization
- Request/response compression
- Async processing for heavy operations

### Frontend Performance

**Review Scope**:

- Bundle size analysis
- Loading performance
- Runtime performance
- Resource optimization
- Rendering efficiency

**Performance Checks**:

- ✅ **Bundle Size**: Main bundle under 300KB gzipped
- ✅ **Load Times**: First contentful paint under 1.5s
- ✅ **Runtime Performance**: Smooth 60fps interactions
- ✅ **Resource Optimization**: Images and assets optimized
- ✅ **Caching Strategy**: Proper browser caching headers

**Common Issues**:

- Large JavaScript bundles
- Unoptimized images and assets
- Unnecessary re-renders
- Memory leaks in components
- Poor caching strategies

**Optimization Opportunities**:

- Code splitting and lazy loading
- Image optimization and modern formats
- Component memoization
- Bundle analysis and tree shaking
- Service worker implementation

### Memory Performance

**Review Scope**:

- Memory usage patterns
- Memory leak detection
- Garbage collection efficiency
- Cache memory management
- Resource cleanup

**Performance Checks**:

- ✅ **Memory Usage**: Stable memory consumption
- ✅ **Leak Prevention**: No memory leaks detected
- ✅ **Cache Management**: Efficient cache memory usage
- ✅ **Resource Cleanup**: Proper resource disposal
- ✅ **GC Efficiency**: Minimal garbage collection impact

**Common Issues**:

- Memory leaks in event listeners
- Unclosed database connections
- Growing cache without eviction
- Retained object references
- Large object allocations

### Network Performance

**Review Scope**:

- Network request optimization
- Data transfer efficiency
- CDN utilization
- Compression effectiveness
- HTTP/2 optimization

**Performance Checks**:

- ✅ **Request Optimization**: Minimal network requests
- ✅ **Data Efficiency**: Optimized payload sizes
- ✅ **Compression**: Gzip/Brotli compression enabled
- ✅ **CDN Usage**: Static assets served from CDN
- ✅ **HTTP/2**: Modern protocol optimization

---

## Output Format

### Success Case

```text
✅ PERFORMANCE REVIEW COMPLETE - OPTIMAL

Database Performance:
✅ Query Performance: Average 35ms response time
✅ Index Usage: All frequent queries properly indexed
✅ Connection Pool: Efficiently configured (10-50 connections)
✅ Transaction Performance: Average 12ms duration
✅ No N+1 queries detected

API Performance:
✅ Response Times: Average 145ms (target: <200ms)
✅ Throughput: Handles 1000 concurrent requests
✅ Middleware Efficiency: 5ms average overhead
✅ Caching Strategy: 85% cache hit rate
✅ Memory Usage: Stable 120MB average

Frontend Performance:
✅ Bundle Size: 245KB gzipped (target: <300KB)
✅ Load Performance: 1.2s first contentful paint
✅ Runtime Performance: Consistent 60fps
✅ Resource Optimization: 95% assets optimized
✅ Caching: 7-day browser cache configured

Memory Performance:
✅ Memory Usage: Stable consumption pattern
✅ No memory leaks detected
✅ Cache Management: Efficient LRU eviction
✅ Resource Cleanup: Proper disposal implemented

Network Performance:
✅ Request Optimization: 15 average requests per page
✅ Data Efficiency: Optimized JSON payloads
✅ Compression: Brotli enabled (65% reduction)
✅ CDN Usage: 98% static assets from CDN

🚀 Performance exceeds benchmarks across all metrics
```text

### Performance Issues Found Case

```text
⚠️ PERFORMANCE REVIEW - OPTIMIZATION OPPORTUNITIES

Database Performance:
❌ CRITICAL: Slow query in accommodation search
   File: packages/db/src/models/accommodation.model.ts:89
   Issue: Table scan on 50k+ records (850ms average)
   Fix: Add composite index on (location, price, availability)

⚠️ MEDIUM: N+1 query in booking list
   File: packages/service-core/src/services/booking/booking.service.ts:45
   Issue: Individual queries for each accommodation (15 queries)
   Fix: Use JOIN or batch loading with DataLoader

API Performance:
❌ HIGH: Slow endpoint response in search
   Endpoint: GET /api/accommodations/search
   Issue: 1.2s average response time (target: <200ms)
   Cause: Database query optimization needed
   Fix: Implement search indexing and caching

⚠️ MEDIUM: Missing response caching
   Endpoints: Static data endpoints (/api/locations, /api/amenities)
   Issue: No caching headers set
   Fix: Add 1-hour cache headers for static data

Frontend Performance:
❌ HIGH: Large bundle size
   Bundle: main.js - 485KB gzipped (target: <300KB)
   Cause: Entire UI library imported
   Fix: Use tree shaking and import specific components

⚠️ MEDIUM: Unoptimized images
   Location: apps/web/public/images/
   Issue: Large JPEG files (average 2.5MB)
   Fix: Convert to WebP format and add responsive images

ℹ️ LOW: Excessive re-renders
   Component: AccommodationList
   Issue: Re-renders on every filter change
   Fix: Implement React.memo and useMemo

Memory Performance:
⚠️ MEDIUM: Growing cache without eviction
   Location: packages/service-core/src/cache/
   Issue: Cache size grows indefinitely
   Fix: Implement LRU cache with size limits

Network Performance:
⚠️ MEDIUM: Too many API requests
   Page: Accommodation detail page
   Issue: 25 individual requests for related data
   Fix: Implement GraphQL or batch API endpoints

Performance Summary:

- Critical Issues: 1 (major performance impact)
- High Priority: 2 (significant improvement potential)
- Medium Priority: 4 (moderate optimization value)
- Low Priority: 1 (nice to have)

🔧 Address critical and high-priority issues for optimal performance
```text

---

## Performance Benchmarks

### Database Performance Targets

- **Query Response Time**: < 50ms for simple queries
- **Complex Query Time**: < 200ms for complex searches
- **Transaction Duration**: < 20ms average
- **Connection Pool**: 10-50 connections based on load
- **Index Usage**: > 90% queries use indexes

### API Performance Targets

- **Response Time**: < 200ms for standard endpoints
- **Throughput**: Handle 1000+ concurrent requests
- **Memory Usage**: < 512MB under normal load
- **CPU Usage**: < 70% under peak load
- **Cache Hit Rate**: > 80% for cacheable responses

### Frontend Performance Targets

- **Bundle Size**: < 300KB gzipped for main bundle
- **First Contentful Paint**: < 1.5s on 3G
- **Largest Contentful Paint**: < 2.5s on 3G
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### Memory Performance Targets

- **Memory Growth**: < 10MB per hour of operation
- **Memory Leaks**: Zero detected leaks
- **Garbage Collection**: < 10ms average GC pause
- **Cache Memory**: < 100MB for application cache
- **Memory Efficiency**: > 85% useful memory usage

---

## Performance Testing Tools

### Database Testing

**Tools Used**:

- Database query execution plans
- PostgreSQL pg_stat_statements
- Connection pool monitoring
- Transaction log analysis

**Metrics Collected**:

- Query execution times
- Index usage statistics
- Connection pool utilization
- Lock contention analysis

### API Testing

**Tools Used**:

- Load testing with Artillery/K6
- API response time monitoring
- Memory profiling tools
- CPU usage analysis

**Metrics Collected**:

- Response time percentiles
- Throughput measurements
- Error rate analysis
- Resource utilization

### Frontend Testing

**Tools Used**:

- Lighthouse performance audits
- Bundle analyzer tools
- React DevTools Profiler
- Network performance monitoring

**Metrics Collected**:

- Core Web Vitals
- Bundle size analysis
- Component render performance
- Network resource analysis

---

## Optimization Strategies

### Database Optimization

**Query Optimization**:

- Add appropriate indexes
- Optimize JOIN operations
- Implement query result caching
- Use database query planning

**Data Model Optimization**:

- Normalize frequently queried data
- Implement read replicas
- Use materialized views
- Optimize data types

### API Optimization

**Response Optimization**:

- Implement response caching
- Add compression (Gzip/Brotli)
- Optimize JSON serialization
- Use pagination for large datasets

**Processing Optimization**:

- Implement async processing
- Use connection pooling
- Optimize middleware stack
- Add request deduplication

### Frontend Optimization

**Bundle Optimization**:

- Implement code splitting
- Use tree shaking
- Add lazy loading
- Optimize dependencies

**Runtime Optimization**:

- Implement component memoization
- Optimize re-render patterns
- Use virtual scrolling
- Add image optimization

---

## Performance Monitoring

### Real-Time Monitoring

**Metrics to Track**:

- API response times
- Database query performance
- Memory usage patterns
- Error rates and types

**Alerting Thresholds**:

- Response time > 500ms
- Error rate > 1%
- Memory usage > 80%
- Database connections > 90%

### Performance Regression Detection

**Automated Testing**:

- Performance test suite in CI/CD
- Bundle size monitoring
- Lighthouse CI integration
- Database query performance tracking

---

## Related Commands

- `/quality-check` - Includes performance review
- `/review-code` - Code quality affecting performance
- `/pen-test` - Security testing with performance impact

---

## When to Use

- **Part of**: `/quality-check` comprehensive validation
- **Before Production**: Pre-deployment performance validation
- **Regular Monitoring**: Periodic performance assessment
- **After Major Changes**: Performance impact analysis

---

## Prerequisites

- Application functionality complete
- Realistic test data available
- Performance testing environment configured

---

## Post-Command Actions

**If Performance Good**: Deploy with confidence

**If Issues Found**:

1. **Critical**: Fix immediately (major performance impact)
2. **High Priority**: Fix before production (significant improvement)
3. **Medium Priority**: Plan optimization sprint
4. **Low Priority**: Address during regular maintenance

**Monitoring**: Implement performance monitoring in production

**Documentation**: Update performance guidelines and benchmarks

