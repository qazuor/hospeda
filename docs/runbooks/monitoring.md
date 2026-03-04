# Monitoring & Alerting Runbook

## Overview

This runbook provides comprehensive procedures for monitoring the Hospeda platform, configuring alerts, analyzing metrics, and maintaining observability. It covers frontend (Web Vitals), backend (API metrics), database (query performance), and infrastructure monitoring.

**When to Use**:

- Setting up monitoring for new components
- Configuring alerts for proactive issue detection
- Analyzing performance trends
- Troubleshooting based on metrics
- Regular health checks and reviews

**Expected Outcomes**:

- Comprehensive monitoring coverage
- Timely alerts for issues
- Clear visibility into system health
- Data-driven optimization decisions
- Proactive issue detection

**Time Estimate**:

- Initial setup: 2-4 hours
- Alert configuration: 30-60 minutes
- Daily health check: 10-15 minutes
- Weekly review: 30-45 minutes
- Monthly review: 1-2 hours

## Prerequisites

### Required Access

- [ ] Vercel Dashboard access (frontend monitoring)
- [ ] Neon Console access (database monitoring)
- [ ] Vercel Dashboard access (backend/API monitoring)
- [ ] GitHub Actions access (CI/CD monitoring)
- [ ] Team communication channels (for alerts)

### Required Tools

- [ ] Browser (for dashboards)
- [ ] Terminal with CLI tools
- [ ] Access to monitoring dashboards
- [ ] Spreadsheet or notebook (for tracking metrics)

### Knowledge Requirements

- Understanding of key metrics (response time, error rate, etc.)
- Familiarity with monitoring concepts
- Knowledge of system architecture
- Understanding of alert fatigue and thresholds
- Basic statistics (percentiles, averages)

## Monitoring Stack

### Current Monitoring Tools

| Component | Tool | Purpose | Access |
|-----------|------|---------|--------|
| **Frontend** | Vercel Analytics | Page performance, Web Vitals | Vercel Dashboard |
| **Backend** | Vercel Analytics | Function duration, error rates | Vercel Dashboard |
| **Database** | Neon Monitoring | Query performance, connections | Neon Console |
| **Logs** | @repo/logger | Structured logging | Platform logs |
| **CI/CD** | GitHub Actions | Build/deploy monitoring | GitHub Actions |

### Planned/Future Monitoring

| Component | Tool | Purpose | Status |
|-----------|------|---------|--------|
| **Error Tracking** | Sentry | Error monitoring, stack traces | Configured (see [Sentry Setup](./sentry-setup.md)) |
| **APM** | Prometheus + Grafana | Advanced metrics, dashboards | Planned |
| **Uptime** | UptimeRobot | External uptime monitoring | Planned |
| **Alerts** | PagerDuty/Slack | Alerting system | Planned |

## Key Metrics to Monitor

### Frontend Metrics (Web Vitals)

| Metric | Target | Warning | Critical | Measurement |
|--------|--------|---------|----------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | > 2.5s | > 4.0s | 75th percentile |
| **FID** (First Input Delay) | < 100ms | > 100ms | > 300ms | 75th percentile |
| **CLS** (Cumulative Layout Shift) | < 0.1 | > 0.1 | > 0.25 | 75th percentile |
| **TTFB** (Time to First Byte) | < 800ms | > 800ms | > 1800ms | 75th percentile |
| **FCP** (First Contentful Paint) | < 1.8s | > 1.8s | > 3.0s | 75th percentile |

**Why these matter**:

- **LCP**: Measures loading performance (when main content loads)
- **FID**: Measures interactivity (how quickly page responds to input)
- **CLS**: Measures visual stability (unexpected layout shifts)
- **TTFB**: Measures server responsiveness
- **FCP**: Measures when first content appears

### Backend Metrics (API)

| Metric | Target | Warning | Critical | Measurement |
|--------|--------|---------|----------|-------------|
| **Response Time (p50)** | < 100ms | > 200ms | > 500ms | 50th percentile |
| **Response Time (p95)** | < 200ms | > 500ms | > 1000ms | 95th percentile |
| **Response Time (p99)** | < 500ms | > 1000ms | > 2000ms | 99th percentile |
| **Error Rate** | < 0.1% | > 0.5% | > 2% | Per minute |
| **Request Rate** | Varies | N/A | Sudden 10x | Requests/minute |
| **CPU Usage** | < 60% | > 75% | > 90% | Per instance |
| **Memory Usage** | < 70% | > 80% | > 95% | Per instance |

**Why these matter**:

- **Response Time**: User experience, performance
- **Error Rate**: Reliability, bugs
- **Request Rate**: Traffic patterns, anomalies
- **CPU/Memory**: Resource utilization, scaling needs

### Database Metrics

| Metric | Target | Warning | Critical | Measurement |
|--------|--------|---------|----------|-------------|
| **Query Time (p50)** | < 20ms | > 50ms | > 100ms | 50th percentile |
| **Query Time (p95)** | < 50ms | > 100ms | > 200ms | 95th percentile |
| **Query Time (p99)** | < 100ms | > 200ms | > 500ms | 99th percentile |
| **Connections** | < 50 | > 70% max | > 90% max | Current count |
| **Connection Pool Usage** | < 60% | > 80% | > 95% | Percentage |
| **Cache Hit Rate** | > 80% | < 70% | < 50% | Percentage |
| **Active Queries** | < 10 | > 20 | > 50 | Current count |
| **Long Queries** | 0 | > 2 | > 5 | > 5s duration |

**Why these matter**:

- **Query Time**: Performance bottleneck identification
- **Connections**: Connection pool health
- **Cache Hit Rate**: Query optimization effectiveness
- **Long Queries**: Potential blocking operations

### Infrastructure Metrics

| Metric | Target | Warning | Critical | Measurement |
|--------|--------|---------|----------|-------------|
| **Uptime** | 99.9% | < 99.9% | < 99.5% | Monthly |
| **Deployment Success** | 100% | < 100% | < 95% | Per deployment |
| **Build Time** | < 5 min | > 10 min | > 20 min | Per build |
| **Disk Usage** | < 70% | > 80% | > 95% | Percentage |

## Frontend Monitoring Setup

### Web Vitals Collection

**Automatic collection** via Vercel Analytics:

- Enabled by default on Vercel
- No code changes required
- Data available in Vercel Dashboard

**Manual implementation** (if not using Vercel Analytics):

**Install web-vitals**:

```bash
cd apps/web
pnpm add web-vitals
```

**Collect metrics**:

```typescript
// apps/web/src/lib/web-vitals.ts

import { onCLS, onFCP, onFID, onLCP, onTTFB } from 'web-vitals';

interface WebVitalsMetric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function sendToAnalytics(metric: WebVitalsMetric) {
  // Send to backend for storage/analysis
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metric),
  });
}

// Collect all Web Vitals
export function initWebVitals() {
  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
```

**Initialize in app**:

```astro
---
// apps/web/src/layouts/Layout.astro
---

<script>
  import { initWebVitals } from '../lib/web-vitals';

  // Initialize Web Vitals collection
  initWebVitals();
</script>
```

### Viewing Frontend Metrics

**Via Vercel Dashboard**:

1. Go to <https://vercel.com/[team]/hospeda-web>
2. Click **"Analytics"** tab
3. View Web Vitals data

**Expected data**:

- LCP: 2.1s (p75)
- FID: 45ms (p75)
- CLS: 0.05 (p75)
- Trend graphs (last 7/30 days)

### Frontend Performance Budgets

**Set performance budgets** in `vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "performance": {
    "budgets": [
      {
        "path": "/_next/static/**",
        "maxSize": "100kb"
      },
      {
        "path": "/",
        "maxSize": "300kb",
        "maxTime": 3000
      }
    ]
  }
}
```

**Benefits**:

- Automatic warnings if budgets exceeded
- Prevents performance regression
- Enforces performance standards

## Backend Monitoring Setup

### Platform Metrics (Vercel)

**Via Dashboard**:

1. Go to Vercel Dashboard
2. Select the `hospeda-api` project
3. View **Analytics** and **Functions** tabs

**Available metrics**:

- Function invocation count
- Function duration (p50, p95, p99)
- Error rate per function
- Cold start frequency

**Via CLI**:

```bash
# View logs in real-time
vercel logs --prod --follow

# List recent deployments
vercel ls

# Inspect a specific deployment
vercel inspect <deployment-url>
```

### Custom API Metrics

**Add metrics middleware** (Hono):

```typescript
// apps/api/src/middleware/metrics.ts

import { Context, Next } from 'hono';

const requestDurations: number[] = [];
const errorCounts: Record<number, number> = {};

export async function metricsMiddleware(c: Context, next: Next) {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  requestDurations.push(duration);

  // Track errors
  if (c.res.status >= 400) {
    errorCounts[c.res.status] = (errorCounts[c.res.status] || 0) + 1;
  }

  // Keep last 1000 requests
  if (requestDurations.length > 1000) {
    requestDurations.shift();
  }
}

// Metrics endpoint
export function getMetrics() {
  const sorted = [...requestDurations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  return {
    requestCount: requestDurations.length,
    responseTimes: {
      p50,
      p95,
      p99,
      avg: requestDurations.reduce((a, b) => a + b, 0) / requestDurations.length,
    },
    errors: errorCounts,
    errorRate: Object.values(errorCounts).reduce((a, b) => a + b, 0) / requestDurations.length,
  };
}
```

**Add to app**:

```typescript
// apps/api/src/index.ts

import { Hono } from 'hono';
import { metricsMiddleware, getMetrics } from './middleware/metrics';

const app = new Hono();

// Add metrics middleware
app.use('*', metricsMiddleware);

// Metrics endpoint
app.get('/metrics', (c) => {
  return c.json(getMetrics());
});

export default app;
```

**View metrics**:

```bash
curl https://api.hospeda.com/metrics | jq
```

**Expected output**:

```json
{
  "requestCount": 1000,
  "responseTimes": {
    "p50": 45,
    "p95": 120,
    "p99": 250,
    "avg": 62
  },
  "errors": {
    "404": 15,
    "500": 2
  },
  "errorRate": 0.017
}
```

## Database Monitoring Setup

### Neon Built-in Monitoring

**Via Neon Console**:

1. Go to <https://console.neon.tech>
2. Select Hospeda project
3. Go to **Monitoring** tab

**Available metrics**:

- CPU usage
- Memory usage
- Connection count
- Query duration (p50, p95, p99)
- Operations per second

**Recommended views**:

- **Overview**: System health at a glance
- **Query Performance**: Identify slow queries
- **Connections**: Monitor connection pool
- **Storage**: Track database size growth

### Enable pg_stat_statements

**For advanced query analysis**:

```sql
-- Connect to database
psql $DATABASE_URL

-- Enable extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify enabled
SELECT * FROM pg_stat_statements LIMIT 1;
```

**Query performance analysis**:

```sql
-- Top 10 slowest queries by average time
SELECT
  substring(query, 1, 60) as short_query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric, 2) as total_ms,
  round((total_exec_time/sum(total_exec_time) OVER ())*100, 2) as pct_total
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Top queries by total time**:

```sql
SELECT
  substring(query, 1, 60) as short_query,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as avg_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

**Most called queries**:

```sql
SELECT
  substring(query, 1, 60) as short_query,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC
LIMIT 10;
```

### Database Connection Monitoring

```sql
-- Active connections by state
SELECT
  state,
  count(*) as connections,
  max(now() - state_change) as max_duration
FROM pg_stat_activity
GROUP BY state
ORDER BY connections DESC;
```

**Expected output**:

```text
   state    | connections | max_duration
-----------+-------------+--------------
 idle       |          15 | 00:05:23
 active     |           5 | 00:00:02
 idle in tx |           0 | NULL
```

**Unhealthy signs**:

- Many "idle in transaction" (connection leaks)
- Active connections near max (pool exhaustion)
- Very long max_duration (stuck queries)

## Alert Configuration

### Alert Severity Levels

| Severity | Response Time | Notification | Examples |
|----------|---------------|--------------|----------|
| **Critical** | Immediate | PagerDuty/Phone | Site down, error rate > 5%, database down |
| **High** | < 15 minutes | Slack/Email | Error rate > 1%, response time > 2s (p95) |
| **Medium** | < 1 hour | Slack | Error rate > 0.5%, slow queries |
| **Low** | Next business day | Email | Performance degradation < 20% |

### Critical Alerts

**Configure these immediately**:

#### 1. API Down

```yaml
Alert: API Health Check Failed
Condition: Health endpoint returning 5xx or timeout
Threshold: 3 consecutive failures
Notification: Critical
Action: Page on-call engineer
```

**Implementation** (using monitoring service):

```bash
# Using UptimeRobot or similar
# Monitor: https://api.hospeda.com/health
# Interval: 1 minute
# Alert after: 3 failures
# Contact: On-call rotation
```

#### 2. High Error Rate

```yaml
Alert: High Error Rate
Condition: Error rate > 2%
Threshold: Over 5-minute window
Notification: Critical
Action: Page on-call engineer
```

#### 3. Database Connection Exhaustion

```yaml
Alert: Database Connections Critical
Condition: Active connections > 90% of max
Threshold: For 2+ minutes
Notification: Critical
Action: Scale database or restart app
```

### High Priority Alerts

#### 4. Elevated Error Rate

```yaml
Alert: Elevated Error Rate
Condition: Error rate > 0.5%
Threshold: Over 10-minute window
Notification: High
Action: Investigate within 15 minutes
```

#### 5. Slow API Responses

```yaml
Alert: Slow API Response Times
Condition: p95 response time > 500ms
Threshold: Over 10-minute window
Notification: High
Action: Investigate performance
```

#### 6. Database Query Performance

```yaml
Alert: Slow Database Queries
Condition: p95 query time > 200ms
Threshold: Over 15-minute window
Notification: High
Action: Check for missing indexes
```

### Medium Priority Alerts

#### 7. Increased Response Times

```yaml
Alert: Response Time Degradation
Condition: p95 > 300ms (but < 500ms)
Threshold: Over 30-minute window
Notification: Medium
Action: Monitor and investigate if persists
```

#### 8. Database Connection Pool High

```yaml
Alert: Database Connection Pool High
Condition: Connections > 70% of max
Threshold: Over 10-minute window
Notification: Medium
Action: Monitor for scaling need
```

### Low Priority Alerts

#### 9. Web Vitals Degradation

```yaml
Alert: LCP Degraded
Condition: LCP > 3s (p75)
Threshold: Daily average
Notification: Low
Action: Review and optimize
```

### Alert Implementation Examples

**GitHub Actions** (for deployment monitoring):

```yaml
# .github/workflows/monitor-deployment.yml

name: Monitor Deployment

on:
  deployment_status:

jobs:
  check-deployment:
    runs-on: ubuntu-latest
    if: github.event.deployment_status.state == 'success'
    steps:
      - name: Wait for app to be ready
        run: sleep 30

      - name: Health check
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://api.hospeda.com/health)
          if [ $response -ne 200 ]; then
            echo "Health check failed: $response"
            exit 1
          fi

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment health check failed!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Dashboard Setup

### Creating Custom Dashboards

**Recommended dashboard layout**:

```text
┌─────────────────────────────────────────────┐
│ System Health Overview                       │
├─────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ API     │ │ Database│ │ Frontend │        │
│ │ Status  │ │ Status  │ │ Status   │        │
│ │ ✓ OK    │ │ ✓ OK    │ │ ✓ OK     │        │
│ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────┤
│ Response Times (Last Hour)                   │
│ ┌─────────────────────────────────────────┐ │
│ │ p50: 45ms  p95: 120ms  p99: 250ms      │ │
│ │ [Graph showing trend]                   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Error Rate (Last Hour)                       │
│ ┌─────────────────────────────────────────┐ │
│ │ 0.03% (3 errors out of 10,000 requests)│ │
│ │ [Graph showing trend]                   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Database Performance                         │
│ ┌─────────────────────────────────────────┐ │
│ │ Connections: 25/100 (25%)              │ │
│ │ Query time (p95): 35ms                 │ │
│ │ Cache hit rate: 92%                    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Using Grafana (Planned)

**Setup steps** (when implementing):

1. **Install Prometheus** (metrics collection)
2. **Configure exporters** (Node.js, PostgreSQL)
3. **Install Grafana** (visualization)
4. **Import dashboards** (pre-built templates)
5. **Configure alerts** (in Grafana)

**Example Grafana dashboard panels**:

- API request rate (requests/sec)
- Response time percentiles (p50, p95, p99)
- Error rate (%)
- CPU usage by instance
- Memory usage by instance
- Database query time
- Database connections
- Cache hit rate

## Monitoring Procedures

### Daily Health Check

**Time**: 10-15 minutes
**Frequency**: Every business day

**Procedure**:

**Step 1**: Check service status

```bash
# API health
curl -f https://api.hospeda.com/health

# Expected: {"status":"ok","version":"..."}
```

**Step 2**: Review error logs (last 24 hours)

**Via Vercel** (frontend/admin):

1. Vercel Dashboard → Logs
2. Filter by "error" or "5xx"
3. Review any unusual errors

**Via Backend** (API):

```bash
fly logs --app hospeda-api | grep -i error | tail -50
```

**Look for**:

- Repeated errors (potential bug)
- New error types (recent regression)
- Error rate spikes (investigate)

**Step 3**: Check key metrics

**Vercel Analytics** (frontend):

- LCP, FID, CLS within targets?
- Any sudden degradation?

**Backend metrics**:

- Response times normal?
- Error rate < 0.1%?

**Database** (Neon Console):

- Connections normal (< 50% of max)?
- Query times normal (p95 < 50ms)?

**Step 4**: Document findings

```text
Daily Health Check - 2024-11-06

✓ API: Healthy
✓ Frontend: Healthy
✓ Database: Healthy

Metrics (24h):
- Error rate: 0.02%
- Response time p95: 85ms
- Database connections: 15-30 (avg 22)

Issues: None

Notes: Normal traffic day, no incidents.
```

### Weekly Review

**Time**: 30-45 minutes
**Frequency**: Weekly

**Procedure**:

**Step 1**: Review error trends

**Questions**:

- Are errors increasing or decreasing?
- Any new error types this week?
- Any patterns (time of day, specific endpoints)?

**Step 2**: Review performance trends

**Compare to previous week**:

- Response times: Improving/degrading/stable?
- Error rates: Improving/degrading/stable?
- Resource usage: Increasing/decreasing/stable?

**Step 3**: Check for anomalies

**Look for**:

- Traffic spikes (why?)
- Error spikes (what happened?)
- Performance degradation (investigate)
- Resource usage trends (plan scaling?)

**Step 4**: Review slow queries

```sql
-- Top 10 slowest queries this week
SELECT
  substring(query, 1, 60),
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Action items**:

- Add indexes for slow queries
- Optimize queries
- Cache frequently-called queries

**Step 5**: Document and share

```markdown
# Weekly Monitoring Review - Week of 2024-11-04

## Summary

Stable week with normal traffic patterns. One minor performance degradation on Nov 6 (resolved).

## Metrics

- Avg error rate: 0.03% (down from 0.05% previous week) ✓
- Avg response time (p95): 92ms (up from 85ms) ⚠️
- Database connections: 20-35 (stable)

## Issues

- Nov 6: Response time spike to 150ms (p95) at 14:00
  - Cause: Database query without index
  - Resolution: Added index on `accommodations(city)`
  - Impact: Response times back to normal

## Action Items

- [ ] Monitor response times next week (ensure stable)
- [ ] Review remaining slow queries from pg_stat_statements
- [ ] Consider adding cache for accommodation searches
```

### Monthly Review

**Time**: 1-2 hours
**Frequency**: Monthly

**Procedure**:

**Step 1**: Review SLA compliance

**Target SLAs**:

- Uptime: 99.9% (< 43 minutes downtime/month)
- Error rate: < 0.1% (monthly average)
- Response time (p95): < 200ms (monthly average)

**Calculate actual**:

```text
November 2024 SLA Report

Uptime: 99.95% ✓ (21 minutes downtime)
- Incident on Nov 12: 15 minutes (database migration)
- Incident on Nov 18: 6 minutes (deployment issue)

Error rate: 0.04% ✓ (monthly average)

Response time (p95): 105ms ✓ (monthly average)
```

**Step 2**: Analyze incidents

**For each incident**:

- What happened?
- What was the impact?
- What was the resolution?
- How can we prevent it?

**Step 3**: Review resource utilization trends

**Questions**:

- Is database growing as expected?
- Are we approaching capacity limits?
- Do we need to scale any components?

**Step 4**: Cost analysis

**Review**:

- Hosting costs (Vercel, Neon)
- Scaling events and their cost impact
- Opportunities for optimization

**Step 5**: Improvement planning

**Identify**:

- Monitoring gaps
- Alert tuning needs
- Dashboard improvements
- New metrics to track

**Step 6**: Document and present

```markdown
# Monthly Monitoring Report - November 2024

## Executive Summary

Stable month with 99.95% uptime. Two minor incidents, both resolved quickly. Performance within targets.

## SLA Compliance

✓ Uptime: 99.95% (target: 99.9%)
✓ Error rate: 0.04% (target: < 0.1%)
✓ Response time: 105ms p95 (target: < 200ms)

## Traffic Growth

- Requests: 2.5M (up 15% from October)
- Users: 12,000 (up 10% from October)
- Accommodations viewed: 45,000 (up 18%)

## Incidents

1. Nov 12 - Database migration downtime (15 min)
2. Nov 18 - Deployment rollback (6 min)

[Details in incident reports]

## Performance Improvements

- Added indexes for city search (40% faster)
- Optimized accommodation listing query (25% faster)
- Enabled CDN caching for images (50% faster loads)

## Recommendations

1. Implement error tracking (Sentry) for better debugging
2. Add more granular database monitoring
3. Set up uptime monitoring (UptimeRobot)
4. Scale database tier (approaching 60% connection usage)

## Cost Analysis

- Hosting: $75 (within budget)
- Bandwidth: $12 (normal)
- Total: $87

No cost concerns.
```

## Log Analysis

### Structured Logging

**Using @repo/logger**:

```typescript
// apps/api/src/routes/accommodations.ts

import { logger } from '@repo/logger';

app.get('/api/accommodations', async (c) => {
  logger.info('Listing accommodations', {
    userId: c.get('userId'),
    query: c.req.query(),
  });

  try {
    const result = await service.list(c.req.query());

    logger.info('Accommodations listed', {
      count: result.data.length,
      duration: performance.now(),
    });

    return c.json(result);
  } catch (error) {
    logger.error('Failed to list accommodations', {
      error: error.message,
      stack: error.stack,
      userId: c.get('userId'),
    });

    throw error;
  }
});
```

**Benefits**:

- Structured data (JSON)
- Easy to search and filter
- Contextual information
- Error tracking

### Log Aggregation

**Current**: Platform-specific logs (Vercel for all apps)

**Future**: Centralized logging (e.g., Datadog, LogDNA)

**Benefits**:

- Single place to search all logs
- Cross-component correlation
- Advanced querying
- Long-term retention

### Common Log Queries

**Find errors in last hour**:

```bash
fly logs --app hospeda-api --since 1h | grep -i error
```

**Find slow requests** (if logging duration):

```bash
fly logs --app hospeda-api | grep "duration" | awk '$NF > 1000'
# Finds requests > 1000ms
```

**Find specific user's requests**:

```bash
fly logs --app hospeda-api | grep "userId.*user-123"
```

## Troubleshooting

### High False Positive Alert Rate

**Problem**: Too many alerts that aren't real issues

**Solutions**:

1. **Adjust thresholds**
   - Increase from 0.5% to 1% if normal fluctuation
   - Lengthen time window (5 min → 10 min)

1. **Add filters**
   - Ignore expected errors (404s for crawlers)
   - Ignore low-impact endpoints

1. **Use anomaly detection**
   - Alert on deviation from normal, not absolute threshold

### Missing Important Issues

**Problem**: Issues not detected by monitoring

**Solutions**:

1. **Add more coverage**
   - Monitor all critical paths
   - Add synthetic monitoring (automated tests)

1. **Lower thresholds** (carefully)
   - May increase false positives

1. **Add more alert types**
   - Error type based (not just rate)
   - Business metric based (bookings/hour)

### Dashboard Overload

**Problem**: Too many metrics, unclear what to focus on

**Solutions**:

1. **Create focused dashboards**
   - Executive summary (high-level)
   - Developer deep-dive (detailed)
   - On-call quick view (critical only)

1. **Use hierarchy**
   - Start with summary
   - Drill down for details

## Related Documentation

- [Sentry Setup](./sentry-setup.md) - Error tracking configuration, alerts, and dashboards
- [Production Bugs](./production-bugs.md) - Using metrics to investigate issues
- [Scaling](./scaling.md) - Using metrics to make scaling decisions
- [Performance Guide](../performance/README.md) - Performance optimization based on metrics
- [Architecture](../architecture/README.md) - System components to monitor

## Monitoring Checklist

### Setup Checklist

- [ ] Frontend monitoring configured (Vercel Analytics or custom)
- [ ] Backend metrics tracking (platform + custom)
- [ ] Database monitoring enabled (Neon Console + pg_stat_statements)
- [ ] Critical alerts configured (API down, high error rate)
- [ ] High priority alerts configured (slow responses, connection pool)
- [ ] Log aggregation set up (or using platform logs)
- [ ] Dashboards created (overview + detailed)

### Daily Health Check Checklist

- [ ] Check service status (API, frontend, database)
- [ ] Review error logs (last 24 hours)
- [ ] Check key metrics (response times, error rates)
- [ ] Document findings

### Weekly Review Checklist

- [ ] Review error trends
- [ ] Review performance trends
- [ ] Check for anomalies
- [ ] Review slow queries
- [ ] Document and share findings
- [ ] Create action items

### Monthly Review Checklist

- [ ] Calculate SLA compliance
- [ ] Analyze all incidents
- [ ] Review resource utilization trends
- [ ] Analyze costs
- [ ] Identify improvement opportunities
- [ ] Document monthly report
- [ ] Present to team

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial monitoring & alerting runbook | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
