# Scaling Procedures Runbook

## Overview

This runbook provides procedures for scaling the Hospeda platform to handle increased load, whether planned (marketing campaigns, events) or unexpected (viral traffic, DDoS). It covers frontend, backend, database, and cache scaling strategies.

**When to Use**:

- Traffic spike detected
- Planned high-traffic event
- Performance degradation under load
- Resource utilization high (CPU/memory > 80%)
- Database connection pool exhaustion

**Expected Outcomes**:

- Platform handles increased traffic
- Response times remain acceptable
- Error rates stay low (< 0.1%)
- User experience maintained
- System stability preserved

**Time Estimate**:

- Emergency scaling: 5-15 minutes
- Planned scaling: 30-60 minutes
- Database scaling: 15-30 minutes
- Load testing: 1-2 hours

## Prerequisites

### Required Access

- [ ] Vercel Admin access (frontend scaling)
- [ ] Vercel Admin access (backend/API scaling)
- [ ] Neon Console access (database scaling)
- [ ] Monitoring dashboards access
- [ ] Team communication channels

### Required Tools

- [ ] Browser (for dashboards)
- [ ] Terminal with CLI tools (vercel, psql)
- [ ] Load testing tools (k6, autocannon)
- [ ] Monitoring access (metrics dashboards)

### Knowledge Requirements

- Understanding of Hospeda architecture
- Familiarity with scaling concepts
- Knowledge of bottleneck identification
- Understanding of cost implications
- Monitoring and metrics interpretation

## Scaling Triggers

### Automatic Triggers

Monitor these metrics continuously:

| Metric | Warning (Scale Soon) | Critical (Scale Now) | Measurement |
|--------|---------------------|---------------------|-------------|
| **CPU Usage** | > 70% for 5+ min | > 85% for 2+ min | Per instance |
| **Memory Usage** | > 75% for 5+ min | > 90% for 2+ min | Per instance |
| **API Response Time (p95)** | > 500ms | > 1000ms | Rolling 5 min |
| **Error Rate** | > 0.5% | > 2% | Rolling 5 min |
| **Database Connections** | > 70% of pool | > 90% of pool | Current count |
| **Database Query Time (p95)** | > 200ms | > 500ms | Rolling 5 min |

### Planned Scaling Events

**When to scale proactively**:

- Marketing campaign launch (known traffic increase)
- Special event or holiday (booking surge expected)
- Media coverage (potential viral traffic)
- Feature launch (new users expected)
- Partner promotion (traffic spike anticipated)

**Lead time**: 24-48 hours before event

## Scaling Decision Tree

```text
Is there a performance issue or anticipated traffic spike?
├─ YES → What component is bottlenecked?
│        │
│        ├─ Frontend (slow page loads, high LCP/FID)
│        │  → Follow "Frontend Scaling" section
│        │
│        ├─ Backend (slow API responses, high CPU/memory)
│        │  → Follow "Backend Scaling" section
│        │
│        ├─ Database (slow queries, connection exhaustion)
│        │  → Follow "Database Scaling" section
│        │
│        └─ Multiple components
│           → Scale in order: Database → Backend → Frontend
│
└─ NO → Is this planned scaling for upcoming event?
         ├─ YES → Follow "Planned Scaling" section
         │        - Scale ahead of time
         │        - Load test
         │        - Monitor and adjust
         │
         └─ NO → Continue monitoring
                  No action needed
```

## Emergency Scaling (< 15 Minutes)

**Use when**: Critical performance issues, system at risk

### Step 1: Assess Urgency

**Quick checks**:

```bash
# Check API health
curl -f https://api.hospeda.com/health

# Check error rates (from monitoring)
# Expected: < 0.1%, Critical: > 2%

# Check response times (from monitoring)
# Expected: < 200ms (p95), Critical: > 1s (p95)
```

**Severity**:

- **Critical**: Error rate > 2%, responses > 1s, site barely usable
- **High**: Error rate > 0.5%, responses > 500ms, degraded performance
- **Medium**: Metrics trending up but not critical yet

### Step 2: Identify Bottleneck

**Check in order**:

1. **Database** (most common bottleneck)

   ```bash
   # Check connection count (via Neon Console)
   # Monitoring → Connections
   # Critical: > 90% of max
   ```

1. **Backend** (CPU/memory)

   ```bash
   # Check via Vercel Dashboard
   # Functions tab → Duration / Error rate
   # Critical: p95 duration > 5s or error rate > 5%
   ```

1. **Frontend** (CDN, edge)

   ```bash
   # Check Vercel Analytics
   # Should auto-scale, rarely bottleneck
   ```

### Step 3: Scale Immediately

**Based on bottleneck**, jump to:

- [Database Emergency Scaling](#database-emergency-scaling)
- [Backend Emergency Scaling](#backend-emergency-scaling)
- Frontend Emergency Scaling

### Step 4: Communicate

```text
🚨 EMERGENCY SCALING IN PROGRESS

Component: [Database/Backend/Frontend]
Trigger: [Metric] reached [value]
Action: Scaling [component] from [X] to [Y]
ETA: [time]
Assigned: @[username]
```

### Step 5: Monitor Impact

**Watch for** (5-15 minutes):

- Error rate decreasing
- Response times improving
- Resource utilization dropping
- No new errors introduced

### Step 6: Update Team

```text
✅ EMERGENCY SCALING COMPLETE

Component: [Database/Backend/Frontend]
Scaled: [before] → [after]
Status: Performance stabilized
Metrics:
- Error rate: [rate]
- Response time (p95): [time]
- Resource usage: [%]

Next steps: Monitor for 1 hour, plan cost optimization
```

## Frontend Scaling (Vercel)

Vercel provides automatic scaling, but configuration and optimization are important.

### Automatic Scaling

**Default behavior**:

- Automatic horizontal scaling
- Global edge network (CDN)
- Static assets cached at edge
- Serverless functions scale automatically

#### No manual intervention usually needed

### Optimization for High Traffic

**Step 1**: Review caching strategy

**Check cache headers**:

```bash
# Check cache headers on static assets
curl -I https://hospeda.com/image.jpg | grep -i cache

# Expected: cache-control: public, max-age=31536000, immutable
```

**Optimize**:

- Static assets: Long cache times (1 year)
- HTML pages: Short cache or no-cache (if dynamic)
- API responses: Cache if appropriate

**Step 2**: Enable static generation where possible

**For Astro pages**:

```typescript
// pages/accommodations/[id].astro

export const prerender = true;  // Enable static generation

// Or hybrid (some static, some SSR)
export const prerender = 'auto';
```

**Benefits**:

- Faster page loads
- Reduced server load
- Better caching

**Step 3**: Optimize bundle size

```bash
# Analyze bundle
cd apps/web
pnpm build
pnpm analyze  # If analyze script exists

# Look for:
# - Large dependencies
# - Unused code
# - Duplicate code
```

**Optimize**:

- Code splitting
- Lazy loading components
- Remove unused dependencies
- Tree-shaking

**Step 4**: Configure edge caching (if needed)

**Vercel config** (`vercel.json`):

```json
{
  "headers": [
    {
      "source": "/api/accommodations",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate=300"
        }
      ]
    }
  ]
}
```

### Frontend Monitoring

**Metrics to watch**:

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTFB** (Time to First Byte): < 800ms

**Via Vercel Analytics**:

1. Go to Vercel Dashboard
2. Select project
3. Go to **Analytics** tab
4. Review Web Vitals

## Backend Scaling (Vercel)

Vercel serverless functions auto-scale horizontally per request. Manual scaling is not
required. Instead, tuning involves adjusting function memory and duration limits.

### Backend Emergency Scaling

**When**: API function timeouts or high error rates

**Step 1**: Check current function performance

```bash
# View function logs and durations
vercel logs --prod --follow

# Or check in Vercel Dashboard → Functions tab
```

**Step 2**: Increase function resources (if hitting limits)

Edit `apps/api/vercel.json`:

```json
{
  "functions": {
    "api/index.ts": {
      "memory": 2048,
      "maxDuration": 30
    }
  }
}
```

Then redeploy:

```bash
cd apps/api && vercel --prod
```

**Step 3**: Monitor impact

```bash
# Watch logs
vercel logs --prod --follow
```

**Look for**:

- Function duration decreasing
- Error rate dropping
- Response times stabilizing

### Backend Configuration Tuning

**When**: Consistent slow responses or memory pressure

**Step 1**: Check current function metrics in Vercel Dashboard

**Step 2**: Tune configuration in `apps/api/vercel.json`

```json
{
  "functions": {
    "api/index.ts": {
      "memory": 3008,
      "maxDuration": 60
    }
  }
}
```

**Cost consideration**: Higher memory and duration limits increase cost on Vercel Pro.

**Step 3**: Redeploy

```bash
# Trigger new deployment
fly deploy --app hospeda-api
```

**Step 4**: Verify

```bash
# Check new configuration
fly status --app hospeda-api

# Monitor performance
fly logs --app hospeda-api
```

### Backend Scaling Strategy

Vercel serverless auto-scales horizontally with no instance management required.

**Tuning order** (most to least impactful):

1. Increase function memory (`"memory"` in `vercel.json`)
2. Increase max duration (`"maxDuration"` in `vercel.json`)
3. Optimize database connection pooling for serverless

**Maximum recommended**:

- Memory: 3008 MB (Vercel Pro limit)
- Max duration: 300s (Vercel Pro limit)

**Beyond that**: Consider architecture changes (edge functions, caching, queue-based processing)

### Backend Optimization

**Before scaling further**, optimize:

1. **Database queries** (see Database Scaling)
2. **Caching** (add Redis if not using)
3. **Connection pooling** (verify configured)
4. **Code optimization** (profiling, bottlenecks)

## Database Scaling (Neon)

### Database Emergency Scaling

**When**: Connections > 90%, query times > 500ms

**Step 1**: Check current state

**Via Neon Console**:

1. Go to <https://console.neon.tech>
2. Select Hospeda project
3. Go to **Monitoring** tab

**Check**:

- **Connections**: Current vs. max
- **CPU**: Percentage used
- **Memory**: Percentage used
- **Query duration**: p50, p95, p99

**Step 2**: Identify bottleneck

**Common bottlenecks**:

1. **Connection pool exhaustion** (most common)
2. **Slow queries** (missing indexes)
3. **High query volume**
4. **Compute size insufficient**

**Check slow queries**:

```bash
# Connect to database
psql $HOSPEDA_DATABASE_URL

# Top slow queries
SELECT
  substring(query, 1, 60) as short_query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Scaling Option 1: Connection Pooling

**If**: High connection count (> 70% of max)

#### Neon has built-in connection pooling (PgBouncer)

**Verify configuration**:

```typescript
// packages/db/src/client.ts

import { neon } from '@neondatabase/serverless';

// Should use connection pooling
export const db = neon(process.env.HOSPEDA_DATABASE_URL, {
  // Connection pooling enabled by default
});
```

**Increase pool size** (if needed):

**Via Neon Console**:

1. Go to **Settings** → **Compute**
2. Adjust connection limit (if option available)
3. Or upgrade compute tier

**Code-side pooling** (if not using Neon pooling):

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.HOSPEDA_DATABASE_URL,
  max: 20,  // Increase from default (10)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Scaling Option 2: Add Indexes

**If**: Slow queries (> 200ms average)

**Identify missing indexes**:

```sql
-- Find slow queries
SELECT
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- > 100ms
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check query plan
EXPLAIN ANALYZE
SELECT * FROM accommodations WHERE city = 'Concepción';

-- If shows "Seq Scan", add index
CREATE INDEX idx_accommodations_city ON accommodations(city);
```

**Common indexes to add**:

```sql
-- City search
CREATE INDEX idx_accommodations_city ON accommodations(city);

-- Price range filter
CREATE INDEX idx_accommodations_price ON accommodations(price_per_night);

-- User bookings
CREATE INDEX idx_bookings_user_id ON bookings(user_id);

-- Accommodation bookings
CREATE INDEX idx_bookings_accommodation_id ON bookings(accommodation_id);

-- Composite index for common query
CREATE INDEX idx_accommodations_city_price
  ON accommodations(city, price_per_night);
```

**Deploy via migration**:

```bash
cd packages/db
pnpm migration:create add_performance_indexes

# Edit migration file, add CREATE INDEX statements

pnpm db:migrate
```

### Scaling Option 3: Upgrade Compute

**If**: CPU/memory high, queries optimized

**Via Neon Console**:

1. Go to **Settings** → **Compute**
2. Current tier: e.g., "Free" or "Starter"
3. Upgrade to higher tier (e.g., "Pro")

**Compute tiers** (example):

| Tier | vCPU | Memory | Connections | Cost |
|------|------|--------|-------------|------|
| Free | 0.25 | 1 GB | 100 | $0 |
| Starter | 1 | 4 GB | 500 | ~$20/mo |
| Pro | 2 | 8 GB | 1000 | ~$50/mo |
| Business | 4+ | 16+ GB | 2000+ | Custom |

**Enable Autoscaling** (Neon Pro+):

- Automatically scales compute based on load
- Scales down when idle (cost savings)
- Scales up during traffic spikes

**Configuration**:

1. Go to **Settings** → **Compute**
2. Enable **Autoscaling**
3. Set min/max compute units

### Scaling Option 4: Read Replicas

**If**: Read-heavy workload, writes are small percentage

**Create read replica** (Neon Pro+):

1. Go to **Branches** tab
2. Click **"Create Branch"**
3. Select **"Read Replica"**
4. Choose region (same or different)

**Update application code**:

```typescript
// packages/db/src/client.ts

import { neon } from '@neondatabase/serverless';

// Write database (primary)
export const dbWrite = neon(process.env.DATABASE_URL);

// Read database (replica)
export const dbRead = neon(process.env.DATABASE_READ_REPLICA_URL);

// In services, use appropriate connection
// Reads: use dbRead
// Writes: use dbWrite
```

**Routing strategy**:

- **Reads**: Route to replica (searches, listings, views)
- **Writes**: Route to primary (create, update, delete)

**Benefits**:

- Offload read traffic from primary
- Faster reads if replica is geographically closer
- High availability

### Database Scaling Checklist

- [ ] Identified bottleneck (connections/queries/compute)
- [ ] Optimized queries (added indexes if needed)
- [ ] Configured connection pooling
- [ ] Upgraded compute tier (if needed)
- [ ] Enabled autoscaling (if available)
- [ ] Created read replicas (if read-heavy)
- [ ] Monitored performance improvement
- [ ] Documented changes

## Planned Scaling

**Use for**: Known upcoming high-traffic events

### Timeline: 1 Week Before Event

**Step 1**: Estimate traffic increase

**Questions**:

- Current traffic: X requests/minute
- Expected traffic: Y requests/minute
- Increase factor: Y/X (e.g., 5x, 10x)

**Step 2**: Identify components to scale

**Based on increase factor**:

- **2x**: Monitor closely, may not need scaling
- **5x**: Scale database and backend
- **10x**: Scale all components, add caching

**Step 3**: Review current capacity

```bash
# Current backend instances
fly status --app hospeda-api

# Current database tier
# Via Neon Console

# Current caching
# Redis configured? If not, consider adding
```

### Timeline: 2-3 Days Before Event

**Step 4**: Scale components proactively

**Backend**:

```bash
# Scale to handle expected load
fly scale count 5 --app hospeda-api
```

**Database**:

- Upgrade compute tier (if needed)
- Enable autoscaling
- Add indexes for expected queries

**Caching** (if not configured):

- Deploy Redis
- Configure caching for common queries
- Cache API responses

**Step 5**: Load test

**Run load test** to verify capacity:

```bash
# Install k6 (if not installed)
brew install k6  # macOS
# or: https://k6.io/docs/getting-started/installation/

# Create load test script
# tests/load/accommodation-list.js
```

**Load test script**:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  const res = http.get('https://api.hospeda.com/api/accommodations');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Run load test**:

```bash
k6 run tests/load/accommodation-list.js
```

**Analyze results**:

```text
checks.........................: 99.95% ✓ 1999  ✗ 1
http_req_duration..............: avg=245ms p(95)=450ms
http_req_failed................: 0.05%
```

**If thresholds fail**:

- Identify bottleneck
- Scale further
- Optimize
- Re-test

### Timeline: 1 Day Before Event

**Step 6**: Final verification

**Checklist**:

- [ ] All components scaled
- [ ] Load test passed
- [ ] Monitoring alerts configured
- [ ] Team briefed on event
- [ ] Rollback plan documented
- [ ] On-call rotation confirmed

**Step 7**: Pre-scale monitoring

**Set up additional monitoring**:

- Error rate alerts (> 0.5%)
- Response time alerts (> 500ms p95)
- Database connection alerts (> 80%)
- Resource usage alerts (CPU/memory > 80%)

### During Event

**Step 8**: Active monitoring

**Monitor continuously** (every 15-30 minutes):

- Error rates
- Response times
- Resource usage
- Database performance
- User reports

**Be ready to**:

- Scale further if needed
- Investigate issues immediately
- Communicate status to team

### After Event

**Step 9**: De-scale

**After traffic returns to normal** (wait 2-4 hours):

```bash
# Reduce backend instances
fly scale count 2 --app hospeda-api  # Back to normal

# Downgrade database (if upgraded)
# Via Neon Console
```

**Step 10**: Post-event review

**Document**:

- Peak traffic achieved
- Issues encountered
- Scaling actions taken
- Lessons learned
- Cost impact

## Load Testing

### Local Load Testing

**Install k6**:

```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

### Basic Load Test

```javascript
// tests/load/basic-api.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,  // 50 virtual users
  duration: '5m',  // Run for 5 minutes
};

export default function () {
  const res = http.get('https://api.hospeda.com/api/accommodations');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

**Run**:

```bash
k6 run tests/load/basic-api.js
```

### Realistic Load Test

**Simulate user behavior**:

```javascript
// tests/load/user-journey.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up
    { duration: '3m', target: 20 },   // Stay
    { duration: '1m', target: 50 },   // Ramp up more
    { duration: '5m', target: 50 },   // Stay
    { duration: '1m', target: 0 },    // Ramp down
  ],
};

export default function () {
  // User journey: Browse → View → Search

  group('Browse accommodations', () => {
    const res = http.get('https://hospeda.com/accommodations');
    check(res, { 'browse status 200': (r) => r.status === 200 });
    sleep(2);
  });

  group('View accommodation', () => {
    const res = http.get('https://hospeda.com/accommodations/sample-id');
    check(res, { 'view status 200': (r) => r.status === 200 });
    sleep(3);
  });

  group('Search accommodations', () => {
    const res = http.get('https://api.hospeda.com/api/accommodations?city=Concepción');
    check(res, { 'search status 200': (r) => r.status === 200 });
    sleep(2);
  });
}
```

### Load Test Thresholds

```javascript
export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // Response times
    http_req_failed: ['rate<0.01'],                   // Error rate < 1%
    checks: ['rate>0.99'],                            // Check pass rate > 99%
  },
};
```

## Cost Optimization

### After Scaling Event

**Review costs**:

- Backend instances running
- Database tier
- Additional services (Redis, etc.)

**Optimize**:

1. **Scale down** components to baseline
2. **Disable** temporary services
3. **Downgrade** database tier if upgraded
4. **Review** metrics to set new baseline

### Ongoing Optimization

**Monthly review**:

- Current resource usage vs. capacity
- Cost vs. performance tradeoff
- Scaling events and their cost impact

**Optimizations**:

- Use autoscaling where available
- Schedule non-critical tasks during off-peak
- Cache aggressively
- Optimize database queries (cheaper than scaling)

## Troubleshooting

### Scaling Doesn't Improve Performance

**Possible causes**:

1. **Wrong component scaled**
   - Verify bottleneck identification
   - Check all metrics

1. **Database bottleneck**
   - Slow queries (missing indexes)
   - Connection pool exhaustion
   - Scale database, not just backend

1. **External dependency**
   - Third-party API slow (Better Auth, Mercado Pago)
   - Check external service status

1. **Code-level bottleneck**
   - Inefficient algorithm
   - Memory leak
   - Requires code optimization

### Scaling Causes New Issues

**Possible causes**:

1. **Database connection limit hit**
   - More instances = more connections
   - Configure connection pooling
   - Upgrade database tier

1. **State consistency issues**
   - Multiple instances, no shared state
   - Use database or Redis for session storage

1. **Cost spike**
   - Over-scaled
   - De-scale unnecessary components

## Related Documentation

- [Production Bugs](./production-bugs.md) - Investigating performance issues
- [Monitoring](./monitoring.md) - Setting up monitoring and alerts
- [Performance Guide](../performance/README.md) - Performance optimization strategies
- [Architecture](../architecture/README.md) - System architecture and components

## Scaling Checklist

### Emergency Scaling

- [ ] Identified bottleneck component
- [ ] Scaled appropriate component
- [ ] Monitored impact (5-15 minutes)
- [ ] Verified performance improvement
- [ ] Updated team
- [ ] Documented action

### Planned Scaling

- [ ] Estimated traffic increase
- [ ] Identified components to scale
- [ ] Scaled components proactively (2-3 days before)
- [ ] Load tested at expected capacity
- [ ] Configured additional monitoring
- [ ] Briefed team on event
- [ ] Monitored during event
- [ ] De-scaled after event
- [ ] Documented learnings

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-06 | Initial scaling procedures runbook | @tech-writer |

---

**Last Updated**: 2025-11-06
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
