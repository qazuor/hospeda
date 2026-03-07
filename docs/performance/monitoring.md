# Performance Monitoring

## Overview

Hospeda's performance monitoring strategy ensures optimal system performance through comprehensive observability across all layers:

1. **Real User Monitoring (RUM)** - Web Vitals tracking from actual users
2. **API Monitoring** - Hono metrics + response times
3. **Database Monitoring** - Neon dashboard + pg_stat_statements
4. **Synthetic Monitoring** - Lighthouse CI + uptime checks
5. **Alerting** - Threshold-based alerts via Slack/email

**Monitoring Stack**:

- **Frontend**: Web Vitals API + Vercel Analytics
- **Backend**: Custom Hono middleware + Prometheus metrics
- **Database**: Neon built-in monitoring + PostgreSQL extensions
- **Synthetic**: Lighthouse CI + GitHub Actions
- **Dashboards**: Custom React dashboards + Grafana (optional)

## Real User Monitoring (RUM)

### Web Vitals Tracking

**Implementation** (`apps/web/src/utils/analytics.ts`):

```typescript
import { onCLS, onFID, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

export interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

function sendToAnalytics(metric: Metric) {
  const body: WebVitalMetric = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType
  };

  // Add page context
  const payload = {
    ...body,
    page: window.location.pathname,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    connectionType: (navigator as any).connection?.effectiveType
  };

  // Use sendBeacon for reliability (survives page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json'
    });
    navigator.sendBeacon('/api/analytics/web-vitals', blob);
  } else {
    // Fallback to fetch with keepalive
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(console.error);
  }
}

// Track all Core Web Vitals
export function initWebVitals() {
  onCLS(sendToAnalytics);  // Cumulative Layout Shift
  onFID(sendToAnalytics);  // First Input Delay
  onLCP(sendToAnalytics);  // Largest Contentful Paint
  onFCP(sendToAnalytics);  // First Contentful Paint
  onTTFB(sendToAnalytics); // Time to First Byte
}
```

**Inject in Layout** (`apps/web/src/layouts/Layout.astro`):

```astro
---
// src/layouts/Layout.astro
import { ViewTransitions } from 'astro:transitions';
---

<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <ViewTransitions />
  </head>
  <body>
    <slot />

    <script>
      import { initWebVitals } from '@/utils/analytics';

      // Track Web Vitals in production only
      if (import.meta.env.PROD) {
        initWebVitals();
      }
    </script>
  </body>
</html>
```

**API Endpoint** (`apps/api/src/routes/analytics.ts`):

```typescript
import { z } from 'zod';
import { createOpenApiRoute } from '../utils/route-factory';
import { db } from '@repo/db';
import { webVitalsTable } from '@repo/db/schemas';

const webVitalSchema = z.object({
  name: z.enum(['CLS', 'FID', 'LCP', 'FCP', 'TTFB']),
  value: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  delta: z.number(),
  id: z.string(),
  navigationType: z.string(),
  page: z.string(),
  timestamp: z.number(),
  userAgent: z.string().optional(),
  connectionType: z.string().optional()
});

export const recordWebVitalRoute = createOpenApiRoute({
  method: 'post',
  path: '/analytics/web-vitals',
  summary: 'Record Web Vital metric',
  tags: ['Analytics'],
  requestSchema: webVitalSchema,
  responseSchema: z.object({ success: z.boolean() }),
  handler: async (c, _params, body) => {
    // Store in database
    await db.insert(webVitalsTable).values({
      metricName: body.name,
      value: body.value,
      rating: body.rating,
      page: body.page,
      userAgent: body.userAgent,
      connectionType: body.connectionType,
      recordedAt: new Date(body.timestamp)
    });

    return { success: true };
  },
  options: {
    skipAuth: true // Public endpoint
  }
});
```

### Custom Performance Marks

```typescript
// apps/web/src/utils/performance.ts

export class PerformanceTracker {
  private marks = new Map<string, number>();

  mark(name: string) {
    performance.mark(name);
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string) {
    const end = endMark || `${name}-end`;
    performance.mark(end);

    try {
      performance.measure(name, startMark, end);

      const measure = performance.getEntriesByName(name, 'measure')[0];

      // Send to analytics
      this.sendMeasure({
        name,
        duration: measure.duration,
        startTime: measure.startTime
      });

      return measure.duration;
    } catch (error) {
      console.error('Performance measure failed:', error);
      return 0;
    }
  }

  private sendMeasure(measure: {
    name: string;
    duration: number;
    startTime: number;
  }) {
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...measure,
        page: window.location.pathname,
        timestamp: Date.now()
      }),
      keepalive: true
    }).catch(console.error);
  }
}

// Global instance
export const tracker = new PerformanceTracker();
```

**Usage**:

```tsx
import { tracker } from '@/utils/performance';

export function SearchResults() {
  const [results, setResults] = useState([]);

  const handleSearch = async (query: string) => {
    // Mark start
    tracker.mark('search-start');

    const data = await fetchSearchResults(query);
    setResults(data);

    // Mark end and measure
    tracker.mark('search-end');
    tracker.measure('search-duration', 'search-start', 'search-end');
  };

  return <SearchInput onSearch={handleSearch} />;
}
```

### Navigation Timing

```typescript
// apps/web/src/utils/navigation-timing.ts

export function recordNavigationTiming() {
  // Wait for page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      const navTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;

      if (!navTiming) return;

      const metrics = {
        dns: navTiming.domainLookupEnd - navTiming.domainLookupStart,
        tcp: navTiming.connectEnd - navTiming.connectStart,
        request: navTiming.responseStart - navTiming.requestStart,
        response: navTiming.responseEnd - navTiming.responseStart,
        domProcessing: navTiming.domComplete - navTiming.domLoading,
        loadComplete: navTiming.loadEventEnd - navTiming.loadEventStart,
        totalTime: navTiming.loadEventEnd - navTiming.fetchStart
      };

      // Send to analytics
      fetch('/api/analytics/navigation-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metrics,
          page: window.location.pathname,
          timestamp: Date.now()
        }),
        keepalive: true
      }).catch(console.error);
    }, 0);
  });
}
```

## API Monitoring

### Hono Metrics Middleware

**Implementation** (`apps/api/src/middlewares/metrics.ts`):

```typescript
import type { Context, Next } from 'hono';

export interface ApiMetrics {
  requestCount: Map<string, number>;
  requestDuration: Map<string, number[]>;
  errorCount: Map<string, number>;
  activeConnections: number;
  statusCodes: Map<number, number>;
}

const metrics: ApiMetrics = {
  requestCount: new Map(),
  requestDuration: new Map(),
  errorCount: new Map(),
  activeConnections: 0,
  statusCodes: new Map()
};

export const metricsMiddleware = async (c: Context, next: Next) => {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;
  const endpoint = `${method} ${path}`;

  // Increment active connections
  metrics.activeConnections++;

  try {
    await next();

    // Record successful request
    recordMetrics(endpoint, startTime, c.res.status);
  } catch (error) {
    // Record error
    recordMetrics(endpoint, startTime, 500);
    throw error;
  } finally {
    // Decrement active connections
    metrics.activeConnections--;
  }
};

function recordMetrics(endpoint: string, startTime: number, statusCode: number) {
  const duration = Date.now() - startTime;

  // Request count
  metrics.requestCount.set(
    endpoint,
    (metrics.requestCount.get(endpoint) || 0) + 1
  );

  // Request duration
  const durations = metrics.requestDuration.get(endpoint) || [];
  durations.push(duration);
  metrics.requestDuration.set(endpoint, durations);

  // Error count
  if (statusCode >= 400) {
    metrics.errorCount.set(
      endpoint,
      (metrics.errorCount.get(endpoint) || 0) + 1
    );
  }

  // Status codes
  metrics.statusCodes.set(
    statusCode,
    (metrics.statusCodes.get(statusCode) || 0) + 1
  );
}

// Metrics endpoint
export function getMetrics(c: Context) {
  const metricsData = Array.from(metrics.requestCount.entries()).map(
    ([endpoint, count]) => {
      const durations = metrics.requestDuration.get(endpoint) || [];
      const errors = metrics.errorCount.get(endpoint) || 0;

      return {
        endpoint,
        count,
        errors,
        errorRate: count > 0 ? (errors / count) * 100 : 0,
        avgDuration:
          durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0,
        p50Duration: calculatePercentile(durations, 50),
        p95Duration: calculatePercentile(durations, 95),
        p99Duration: calculatePercentile(durations, 99),
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0
      };
    }
  );

  const statusCodesData = Array.from(metrics.statusCodes.entries()).map(
    ([code, count]) => ({
      code,
      count
    })
  );

  return c.json({
    metrics: metricsData,
    statusCodes: statusCodesData,
    activeConnections: metrics.activeConnections,
    timestamp: new Date().toISOString()
  });
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Reset metrics (useful for testing)
export function resetMetrics() {
  metrics.requestCount.clear();
  metrics.requestDuration.clear();
  metrics.errorCount.clear();
  metrics.statusCodes.clear();
  metrics.activeConnections = 0;
}
```

**Register Middleware** (`apps/api/src/app.ts`):

```typescript
import { Hono } from 'hono';
import { metricsMiddleware, getMetrics } from './middlewares/metrics';

const app = new Hono();

// Apply metrics middleware globally
app.use('*', metricsMiddleware);

// Metrics endpoint
app.get('/metrics', getMetrics);

export default app;
```

### Prometheus Metrics

**Prometheus Format** (`apps/api/src/middlewares/prometheus.ts`):

```typescript
import type { Context } from 'hono';
import type { ApiMetrics } from './metrics';

export function formatPrometheusMetrics(metrics: ApiMetrics): string {
  const lines: string[] = [];

  // Request count
  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');

  for (const [endpoint, count] of metrics.requestCount.entries()) {
    const [method, path] = endpoint.split(' ');
    lines.push(
      `http_requests_total{method="${method}",route="${path}"} ${count}`
    );
  }

  // Request duration
  lines.push('# HELP http_request_duration_seconds HTTP request duration');
  lines.push('# TYPE http_request_duration_seconds histogram');

  for (const [endpoint, durations] of metrics.requestDuration.entries()) {
    const [method, path] = endpoint.split(' ');
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

    lines.push(
      `http_request_duration_seconds{method="${method}",route="${path}"} ${
        avg / 1000
      }`
    );
  }

  // Error count
  lines.push('# HELP http_errors_total Total HTTP errors (4xx, 5xx)');
  lines.push('# TYPE http_errors_total counter');

  for (const [endpoint, errors] of metrics.errorCount.entries()) {
    const [method, path] = endpoint.split(' ');
    lines.push(
      `http_errors_total{method="${method}",route="${path}"} ${errors}`
    );
  }

  // Active connections
  lines.push('# HELP http_active_connections Current active connections');
  lines.push('# TYPE http_active_connections gauge');
  lines.push(`http_active_connections ${metrics.activeConnections}`);

  // Status codes
  lines.push('# HELP http_responses_total Total HTTP responses by status');
  lines.push('# TYPE http_responses_total counter');

  for (const [code, count] of metrics.statusCodes.entries()) {
    lines.push(`http_responses_total{status="${code}"} ${count}`);
  }

  return lines.join('\n');
}

export function getPrometheusMetrics(c: Context) {
  // Get metrics from middleware
  const metricsData = c.get('metrics') as ApiMetrics;
  const formatted = formatPrometheusMetrics(metricsData);

  return c.text(formatted, 200, {
    'Content-Type': 'text/plain; version=0.0.4'
  });
}
```

**Prometheus Scraping** (`prometheus.yml`):

```yaml
# Prometheus configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'hospeda-api'
    static_configs:
      - targets: ['api.hospeda.com:3000']
    metrics_path: '/metrics/prometheus'
    scheme: https
```

## Database Monitoring

### Neon Dashboard

**Access Built-in Metrics**:

1. Go to Neon Console → Your Project → Metrics
2. View:
   - **Query Performance**: p50, p95, p99 latencies
   - **Connection Count**: Active connections over time
   - **Database Size**: Storage usage
   - **Cache Hit Rate**: Buffer cache effectiveness
   - **Replication Lag**: For read replicas

**Neon API** (programmatic access):

```typescript
// packages/db/src/monitoring/neon.ts

export interface NeonMetrics {
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  connectionCount: number;
  queryLatencyP95: number;
}

export async function getNeonMetrics(
  projectId: string
): Promise<NeonMetrics> {
  const response = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/metrics`,
    {
      headers: {
        Authorization: `Bearer ${process.env.NEON_API_KEY}`
      }
    }
  );

  const data = await response.json();

  return {
    cpuUsage: data.cpu_usage_percent,
    memoryUsage: data.memory_usage_percent,
    storageUsage: data.storage_usage_bytes,
    connectionCount: data.connection_count,
    queryLatencyP95: data.query_latency_p95_ms
  };
}
```

### pg_stat_statements

**Enable Extension**:

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';
```

**Query Monitoring** (`scripts/monitor-queries.sql`):

```sql
-- Top 20 slowest queries by mean execution time
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time,
  rows,
  100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS cache_hit_ratio
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_sleep%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Queries with high execution time variance (unpredictable)
SELECT
  query,
  calls,
  mean_exec_time,
  stddev_exec_time,
  stddev_exec_time / NULLIF(mean_exec_time, 0) AS coefficient_of_variation
FROM pg_stat_statements
WHERE calls > 100
  AND mean_exec_time > 10
ORDER BY coefficient_of_variation DESC
LIMIT 10;

-- Low cache hit rate queries (needs optimization)
SELECT
  query,
  calls,
  100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_rate
FROM pg_stat_statements
WHERE shared_blks_hit + shared_blks_read > 0
ORDER BY hit_rate ASC
LIMIT 10;

-- Most frequently called queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Total database statistics
SELECT
  sum(calls) as total_calls,
  sum(total_exec_time) as total_time,
  avg(mean_exec_time) as avg_query_time
FROM pg_stat_statements;
```

**Automated Monitoring** (`scripts/monitor-db.sh`):

```bash
#!/bin/bash
# scripts/monitor-db.sh

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=== Database Performance Monitor ==="
echo "Timestamp: $(date)"
echo ""

# Run monitoring queries
echo "Running performance checks..."
psql $DATABASE_URL -f scripts/monitor-queries.sql > /tmp/db-metrics.log

# Check for slow queries (> 100ms average)
SLOW_QUERIES=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*)
  FROM pg_stat_statements
  WHERE mean_exec_time > 100
    AND calls > 10;
")

if [ "$SLOW_QUERIES" -gt 0 ]; then
  echo -e "${YELLOW}WARNING: $SLOW_QUERIES slow queries detected (>100ms avg)${NC}"
else
  echo -e "${GREEN}OK: No slow queries detected${NC}"
fi

# Check cache hit rate
CACHE_HIT_RATE=$(psql $DATABASE_URL -t -c "
  SELECT round(
    100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0),
    2
  )
  FROM pg_stat_database
  WHERE datname = current_database();
")

if (( $(echo "$CACHE_HIT_RATE < 99" | bc -l) )); then
  echo -e "${YELLOW}WARNING: Cache hit rate is ${CACHE_HIT_RATE}% (target: >99%)${NC}"
else
  echo -e "${GREEN}OK: Cache hit rate is ${CACHE_HIT_RATE}%${NC}"
fi

# Send metrics to monitoring system
node scripts/send-db-metrics.js /tmp/db-metrics.log

echo ""
echo "=== Monitor Complete ==="
```

**Cron Schedule**:

```cron
# Run every 5 minutes
*/5 * * * * /app/scripts/monitor-db.sh

# Reset pg_stat_statements weekly (Sunday midnight)
0 0 * * 0 psql $DATABASE_URL -c "SELECT pg_stat_statements_reset();"
```

### Connection Pool Monitoring

```typescript
// packages/db/src/monitoring/pool.ts

export async function getConnectionPoolStats() {
  const result = await db.execute(sql`
    SELECT
      count(*) as total_connections,
      count(*) FILTER (WHERE state = 'active') as active,
      count(*) FILTER (WHERE state = 'idle') as idle,
      count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
      max(now() - state_change) as max_idle_time
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);

  return result.rows[0];
}
```

## Synthetic Monitoring

### Lighthouse CI

**Configuration** (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:4321/",
        "http://localhost:4321/accommodations",
        "http://localhost:4321/accommodations/acc-123",
        "http://localhost:4321/destinations",
        "http://localhost:4321/about"
      ],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop",
        "throttlingMethod": "simulate",
        "throttling": {
          "cpuSlowdownMultiplier": 4
        }
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:seo": ["error", { "minScore": 1 }],

        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "speed-index": ["error", { "maxNumericValue": 3000 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

**GitHub Action** (`.github/workflows/lighthouse.yml`):

```yaml
name: Lighthouse CI

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    # Run weekly on Sunday at midnight
    - cron: '0 0 * * 0'

jobs:
  lighthouse:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build Web app
        run: pnpm --filter web build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: lighthouse-results
          path: .lighthouseci
          retention-days: 30

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: treosh/lighthouse-ci-action@v9
        with:
          uploadArtifacts: true
          temporaryPublicStorage: true
```

### Uptime Monitoring

**UptimeRobot Configuration**:

```yaml
# uptimerobot-config.yml
monitors:
  - name: 'API Health Check'
    url: 'https://api.hospeda.com/health'
    type: 'http'
    interval: 300 # 5 minutes
    timeout: 30
    expected_status: 200

  - name: 'Web App Homepage'
    url: 'https://hospeda.com'
    type: 'http'
    interval: 300
    timeout: 30
    expected_status: 200

  - name: 'Admin Dashboard'
    url: 'https://admin.hospeda.com'
    type: 'http'
    interval: 300
    timeout: 30
    expected_status: 200

  - name: 'Database Connection'
    url: 'https://api.hospeda.com/health/db'
    type: 'http'
    interval: 600 # 10 minutes
    timeout: 30
    expected_status: 200

alert_contacts:
  - type: 'slack'
    value: ${{ secrets.SLACK_WEBHOOK_URL }}

  - type: 'email'
    value: 'alerts@hospeda.com'
```

### Load Testing

**k6 Performance Test** (`scripts/load-test.js`):

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const accommodationListDuration = new Trend('accommodation_list_duration');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users for 3 minutes
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users for 3 minutes
    { duration: '1m', target: 200 },  // Spike to 200 users
    { duration: '2m', target: 200 },  // Stay at 200 users for 2 minutes
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Error rate under 1%
    errors: ['rate<0.05'],            // Custom error rate under 5%
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.hospeda.com';

export default function () {
  group('Accommodation API', function () {
    // Test 1: List accommodations
    const listRes = http.get(`${BASE_URL}/api/v1/accommodations`);

    check(listRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
      'has accommodations': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.success && Array.isArray(data.data);
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);

    accommodationListDuration.add(listRes.timings.duration);

    // Test 2: Get single accommodation
    const detailRes = http.get(`${BASE_URL}/api/v1/accommodations/acc-123`);

    check(detailRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 300ms': (r) => r.timings.duration < 300,
    }) || errorRate.add(1);

    // Test 3: Search accommodations
    const searchRes = http.get(
      `${BASE_URL}/api/v1/accommodations?q=beach&city=concepcion`
    );

    check(searchRes, {
      'status is 200': (r) => r.status === 200,
      'response time < 600ms': (r) => r.timings.duration < 600,
    }) || errorRate.add(1);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

**Run Load Test**:

```bash
# Install k6
brew install k6  # macOS
# or
curl -L https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar xvz

# Run test
k6 run scripts/load-test.js

# Run with custom parameters
k6 run --vus 50 --duration 30s scripts/load-test.js

# Run against staging
API_URL=https://staging-api.hospeda.com k6 run scripts/load-test.js
```

## Alerting

### Performance Thresholds

**Alert Rules** (`monitoring/alert-rules.yml`):

```yaml
alerts:
  # API Performance
  - name: api_slow_response
    condition: p95_response_time > 500ms
    for: 5m
    severity: warning
    message: 'API p95 response time is {{value}}ms (threshold: 500ms)'
    channels: ['slack', 'email']

  - name: api_very_slow_response
    condition: p95_response_time > 1000ms
    for: 2m
    severity: critical
    message: 'API p95 response time is {{value}}ms (threshold: 1000ms)'
    channels: ['slack', 'pagerduty']

  # Error Rate
  - name: api_high_error_rate
    condition: error_rate > 5%
    for: 5m
    severity: critical
    message: 'API error rate is {{value}}% (threshold: 5%)'
    channels: ['slack', 'pagerduty']

  - name: api_elevated_error_rate
    condition: error_rate > 1%
    for: 10m
    severity: warning
    message: 'API error rate is {{value}}% (threshold: 1%)'
    channels: ['slack']

  # Database
  - name: db_slow_queries
    condition: mean_query_time > 100ms
    for: 10m
    severity: warning
    message: 'Database mean query time is {{value}}ms (threshold: 100ms)'
    channels: ['slack']

  - name: db_low_cache_hit_rate
    condition: cache_hit_rate < 99%
    for: 15m
    severity: warning
    message: 'Database cache hit rate is {{value}}% (threshold: 99%)'
    channels: ['slack']

  - name: db_connection_pool_exhausted
    condition: active_connections > 90% of max_connections
    for: 5m
    severity: critical
    message: 'Database connection pool at {{value}}% capacity'
    channels: ['slack', 'pagerduty']

  # Web Vitals
  - name: poor_lcp
    condition: lcp_p75 > 4s
    for: 1h
    severity: warning
    message: 'LCP p75 is {{value}}s (threshold: 4s)'
    channels: ['slack']

  - name: poor_fid
    condition: fid_p75 > 300ms
    for: 1h
    severity: warning
    message: 'FID p75 is {{value}}ms (threshold: 300ms)'
    channels: ['slack']

  - name: poor_cls
    condition: cls_p75 > 0.25
    for: 1h
    severity: warning
    message: 'CLS p75 is {{value}} (threshold: 0.25)'
    channels: ['slack']

  # Uptime
  - name: api_down
    condition: uptime_check_failed
    for: 1m
    severity: critical
    message: 'API is DOWN'
    channels: ['slack', 'pagerduty', 'sms']

  - name: web_app_down
    condition: uptime_check_failed
    for: 1m
    severity: critical
    message: 'Web app is DOWN'
    channels: ['slack', 'pagerduty', 'sms']
```

### Notification Channels

**Slack Webhook**:

```typescript
// packages/utils/src/alerts/slack.ts

export interface SlackAlert {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  value?: string | number;
  threshold?: string | number;
  timestamp: number;
}

export async function sendSlackAlert(alert: SlackAlert) {
  const color = {
    info: '#36a64f',
    warning: '#ff9800',
    critical: '#f44336'
  }[alert.severity];

  const emoji = {
    info: ':information_source:',
    warning: ':warning:',
    critical: ':rotating_light:'
  }[alert.severity];

  const payload = {
    username: 'Hospeda Monitoring',
    icon_emoji: ':bar_chart:',
    attachments: [
      {
        color,
        title: `${emoji} ${alert.title}`,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          ...(alert.value
            ? [
                {
                  title: 'Current Value',
                  value: String(alert.value),
                  short: true
                }
              ]
            : []),
          ...(alert.threshold
            ? [
                {
                  title: 'Threshold',
                  value: String(alert.threshold),
                  short: true
                }
              ]
            : []),
          {
            title: 'Timestamp',
            value: new Date(alert.timestamp).toISOString(),
            short: true
          }
        ],
        footer: 'Hospeda Performance Monitoring',
        ts: Math.floor(alert.timestamp / 1000)
      }
    ]
  };

  const response = await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Slack alert failed: ${response.statusText}`);
  }
}
```

**Email Alerts** (using Resend):

```typescript
// packages/utils/src/alerts/email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.HOSPEDA_RESEND_API_KEY);

export async function sendEmailAlert(alert: SlackAlert) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .alert { padding: 20px; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; }
          .critical { background: #f8d7da; border: 1px solid #f44336; }
          .info { background: #d1ecf1; border: 1px solid #0dcaf0; }
        </style>
      </head>
      <body>
        <div class="alert ${alert.severity}">
          <h2>${alert.title}</h2>
          <p>${alert.message}</p>
          ${alert.value ? `<p><strong>Current Value:</strong> ${alert.value}</p>` : ''}
          ${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
          <p><strong>Time:</strong> ${new Date(alert.timestamp).toISOString()}</p>
        </div>
      </body>
    </html>
  `;

  await resend.emails.send({
    from: 'alerts@hospeda.com',
    to: ['team@hospeda.com'],
    subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
    html
  });
}
```

## Dashboards

### Custom Performance Dashboard

**React Component** (`apps/admin/src/features/analytics/PerformanceDashboard.tsx`):

```tsx
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function PerformanceDashboard() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: fetchPerformanceMetrics,
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Performance Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="API Response Time (p95)"
          value={`${metrics.apiP95}ms`}
          trend={metrics.apiTrend}
          threshold={500}
          status={metrics.apiP95 < 500 ? 'good' : 'warning'}
        />

        <MetricCard
          title="Error Rate"
          value={`${metrics.errorRate}%`}
          trend={metrics.errorTrend}
          threshold={1}
          status={metrics.errorRate < 1 ? 'good' : 'critical'}
        />

        <MetricCard
          title="LCP (p75)"
          value={`${metrics.lcpP75}s`}
          trend={metrics.lcpTrend}
          threshold={2.5}
          status={metrics.lcpP75 < 2.5 ? 'good' : 'warning'}
        />

        <MetricCard
          title="Active Connections"
          value={metrics.activeConnections}
          trend={metrics.connectionsTrend}
          threshold={80}
          status={metrics.activeConnections < 80 ? 'good' : 'warning'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            API Response Time (Last 24h)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.apiHistory}>
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="p95" stroke="#8884d8" />
              <Line type="monotone" dataKey="p99" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">
            Error Rate (Last 24h)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.errorHistory}>
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#f44336" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  trend: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

function MetricCard({ title, value, trend, threshold, status }: MetricCardProps) {
  const statusColor = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600'
  }[status];

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className={`text-3xl font-semibold ${statusColor}`}>{value}</p>
        <p className="ml-2 text-sm text-gray-500">
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500">Threshold: {threshold}</p>
    </Card>
  );
}
```

## Performance Reports

### Weekly Performance Report

**Automated Report** (`scripts/generate-performance-report.ts`):

```typescript
import { sendEmail } from '@repo/utils/email';

interface PerformanceReport {
  period: string;
  metrics: {
    api: {
      p95ResponseTime: number;
      p99ResponseTime: number;
      errorRate: number;
      throughput: number;
    };
    webVitals: {
      lcp: number;
      fid: number;
      cls: number;
    };
    database: {
      avgQueryTime: number;
      slowQueries: number;
      cacheHitRate: number;
    };
  };
  recommendations: string[];
  alerts: number;
}

async function generateWeeklyReport(): Promise<PerformanceReport> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const report: PerformanceReport = {
    period: `${startDate.toISOString()} - ${endDate.toISOString()}`,
    metrics: {
      api: {
        p95ResponseTime: await getApiP95(startDate, endDate),
        p99ResponseTime: await getApiP99(startDate, endDate),
        errorRate: await getApiErrorRate(startDate, endDate),
        throughput: await getApiThroughput(startDate, endDate)
      },
      webVitals: {
        lcp: await getLCPP75(startDate, endDate),
        fid: await getFIDP75(startDate, endDate),
        cls: await getCLSP75(startDate, endDate)
      },
      database: {
        avgQueryTime: await getAvgQueryTime(startDate, endDate),
        slowQueries: await getSlowQueriesCount(startDate, endDate),
        cacheHitRate: await getCacheHitRate(startDate, endDate)
      }
    },
    recommendations: generateRecommendations(),
    alerts: await getAlertCount(startDate, endDate)
  };

  // Send via email
  await sendEmail({
    to: 'team@hospeda.com',
    subject: `Weekly Performance Report - ${startDate.toLocaleDateString()}`,
    template: 'performance-report',
    data: report
  });

  return report;
}

function generateRecommendations(): string[] {
  const recommendations: string[] = [];

  // Add recommendations based on metrics
  // This is a simplified example
  recommendations.push('Consider enabling Brotli compression for API responses');
  recommendations.push('Review slow queries identified in database monitoring');

  return recommendations;
}

// Schedule weekly (using cron or similar)
// Run every Monday at 9 AM
// cron.schedule('0 9 * * 1', generateWeeklyReport);
```

## Best Practices

### DO ✅

- **Track all Core Web Vitals** from real users
- **Monitor API response times** (p50, p95, p99)
- **Set up alerts** for critical thresholds
- **Review metrics weekly** and act on trends
- **Run load tests** before major releases
- **Keep historical data** for at least 3 months
- **Document baselines** and targets
- **Use percentiles** (not just averages)
- **Monitor database** query performance
- **Track error rates** and investigate spikes

### DON'T ❌

- **Ignore warning alerts** (they escalate)
- **Monitor only averages** (use p95, p99)
- **Skip synthetic monitoring**
- **Set unrealistic thresholds**
- **Forget to update baselines** after optimizations
- **Alert on everything** (causes alert fatigue)
- **Ignore user-reported issues**
- **Monitor without acting** on insights

## Troubleshooting

### High API Response Times

**Diagnosis**:

1. Check `/metrics` endpoint for slowest routes
2. Review database slow queries
3. Check cache hit rate
4. Profile specific endpoints
5. Review recent deployments

**Solutions**:

- Add database indexes
- Implement caching
- Optimize queries
- Add pagination
- Scale infrastructure

### Poor Web Vitals

**Diagnosis**:

1. Run Lighthouse audit
2. Check bundle sizes
3. Review image optimization
4. Analyze network waterfall
5. Check server response times

**Solutions**:

- Reduce bundle size
- Optimize images
- Implement code splitting
- Add lazy loading
- Improve caching

### Database Performance Issues

**Diagnosis**:

1. Check `pg_stat_statements`
2. Review slow query log
3. Analyze `EXPLAIN` plans
4. Check index usage
5. Monitor connection pool

**Solutions**:

- Add missing indexes
- Optimize queries
- Increase connection pool
- Use read replicas
- Implement query caching

## Next Steps

- [Performance Overview](./overview.md) - Introduction and targets
- [Database Optimization](./database-optimization.md) - Query optimization and indexing
- [Frontend Optimization](./frontend-optimization.md) - Bundle size and loading performance
- [Caching Strategies](./caching.md) - Multi-layer caching implementation
