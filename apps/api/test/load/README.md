# Load Testing - Billing Endpoints

Comprehensive k6 load testing for Hospeda billing API endpoints.

## Overview

This directory contains k6 load testing scripts to validate performance requirements for billing endpoints as specified in F5-001.

### Performance Requirements

- **P99 latency**: < 500ms for critical endpoints
- **P95 latency**: < 300ms for critical endpoints
- **Error rate**: < 5%
- **Success rate**: > 95%

### Critical Endpoints Tested

1. `GET /api/v1/billing/subscriptions` - List subscriptions
2. `GET /api/v1/billing/subscriptions/:id` - Get subscription details
3. `POST /api/v1/billing/checkout` - Create checkout session
4. `GET /api/v1/billing/invoices` - List invoices
5. `POST /api/v1/billing/promo-codes/apply` - Apply promo code
6. `GET /api/v1/billing/metrics` - Get billing metrics
7. `POST /api/v1/billing/trial/start` - Start trial

## Installation

### macOS

```bash
brew install k6
```

### Ubuntu/Debian

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Windows

```powershell
choco install k6
```

### Docker

```bash
docker pull grafana/k6:latest
```

### Verify Installation

```bash
k6 version
```

## Running Tests

### Basic Test

Run the default load test with configured stages:

```bash
k6 run test/load/billing.k6.js
```

### Custom VUs and Duration

Override the default configuration:

```bash
# 50 VUs for 5 minutes
k6 run --vus 50 --duration 5m test/load/billing.k6.js

# 100 VUs for 2 minutes
k6 run --vus 100 --duration 2m test/load/billing.k6.js
```

### Smoke Test (Quick Validation)

```bash
k6 run --vus 1 --duration 30s test/load/billing.k6.js
```

### Stress Test (High Load)

```bash
k6 run --vus 200 --duration 10m test/load/billing.k6.js
```

### Spike Test (Sudden Traffic Increase)

```bash
k6 run --stage 1m:10,30s:100,1m:10,1m:0 test/load/billing.k6.js
```

### Custom API URL

```bash
# Test against staging
k6 run --env API_BASE_URL=https://api-staging.hospeda.com test/load/billing.k6.js

# Test against production
k6 run --env API_BASE_URL=https://api.hospeda.com test/load/billing.k6.js
```

### With Custom Auth Token

```bash
k6 run --env AUTH_TOKEN=your-real-jwt-token test/load/billing.k6.js
```

### Export Results

#### JSON Output

```bash
k6 run --out json=results.json test/load/billing.k6.js
```

#### CSV Output

```bash
k6 run --out csv=results.csv test/load/billing.k6.js
```

#### InfluxDB (for visualization)

```bash
k6 run --out influxdb=http://localhost:8086/k6 test/load/billing.k6.js
```

#### Cloud Output (k6 Cloud)

```bash
k6 login cloud --token YOUR_K6_CLOUD_TOKEN
k6 cloud test/load/billing.k6.js
```

## Understanding Results

### Terminal Output

k6 provides real-time metrics during test execution:

```
     ✓ status is 200
     ✓ has subscriptions array
     ✓ response time < 500ms

     checks.........................: 98.50% ✓ 1970    ✗ 30
     data_received..................: 2.5 MB 42 kB/s
     data_sent......................: 120 kB 2.0 kB/s
     http_req_blocked...............: avg=1.23ms   min=0.00ms  med=0.00ms  max=124.56ms p(90)=0.00ms  p(95)=0.00ms
     http_req_connecting............: avg=0.87ms   min=0.00ms  med=0.00ms  max=89.45ms  p(90)=0.00ms  p(95)=0.00ms
     http_req_duration..............: avg=234.56ms min=45.23ms med=198.34ms max=987.65ms p(90)=398.12ms p(95)=456.78ms
       { expected_response:true }...: avg=234.56ms min=45.23ms med=198.34ms max=987.65ms p(90)=398.12ms p(95)=456.78ms
     http_req_failed................: 1.50%  ✓ 30      ✗ 1970
     http_req_receiving.............: avg=0.23ms   min=0.01ms  med=0.18ms  max=12.34ms  p(90)=0.45ms  p(95)=0.67ms
     http_req_sending...............: avg=0.12ms   min=0.01ms  med=0.08ms  max=5.67ms   p(90)=0.23ms  p(95)=0.34ms
     http_req_tls_handshaking.......: avg=0.00ms   min=0.00ms  med=0.00ms  max=0.00ms   p(90)=0.00ms  p(95)=0.00ms
     http_req_waiting...............: avg=234.21ms min=45.02ms med=198.01ms max=987.23ms p(90)=397.89ms p(95)=456.45ms
     http_reqs......................: 2000   33.33/s
     iteration_duration.............: avg=1.5s     min=1.2s    med=1.4s    max=2.8s     p(90)=1.8s    p(95)=2.1s
     iterations.....................: 2000   33.33/s
     vus............................: 50     min=10    max=100
     vus_max........................: 100    min=100   max=100
```

### Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| `checks` | Percentage of passed checks | > 95% |
| `http_req_duration` | Total request duration | P99 < 500ms |
| `http_req_failed` | Failed requests rate | < 5% |
| `http_reqs` | Total HTTP requests | - |
| `error_rate` | Custom error rate metric | < 5% |
| `subscription_list_latency` | GET /subscriptions P99 | < 500ms |
| `subscription_get_latency` | GET /subscriptions/:id P99 | < 400ms |
| `checkout_create_latency` | POST /checkout P99 | < 600ms |
| `invoice_list_latency` | GET /invoices P99 | < 500ms |

### Interpreting P-values

- **P50 (median)**: 50% of requests completed in this time or less
- **P90**: 90% of requests completed in this time or less
- **P95**: 95% of requests completed in this time or less
- **P99**: 99% of requests completed in this time or less

**Focus on P95 and P99** - these represent the worst-case scenarios for most users.

### Pass/Fail Criteria

Tests pass when **ALL** thresholds are met:

✅ **Passed**: All metrics within defined thresholds
❌ **Failed**: One or more metrics exceeded thresholds

## Test Scenarios

The load test simulates realistic user behavior with weighted scenarios:

### Scenario Distribution

- **40%** - Browse subscriptions (most common)
- **30%** - Checkout flow
- **15%** - View invoices
- **10%** - Start trial (new users)
- **5%** - View metrics (admin)

### User Flow Examples

#### Subscription Browsing

1. List all subscriptions
2. View details of first subscription
3. Wait 0.5s (think time)

#### Checkout Flow

1. Select random plan
2. Create checkout session
3. 30% chance to apply promo code
4. Wait 1s (think time for promo)

#### Invoice History

1. List invoices (paginated)
2. Check response contains invoice data

#### Trial Start

1. Select user type (owner/complex)
2. Start trial subscription
3. Handle 409 conflict (already has trial)

#### Metrics View

1. Fetch dashboard metrics
2. Validate overview data structure

## Load Stages

Default test includes 7 stages over 32 minutes:

```
Stage 1: Warm up     - 0 → 10 VUs   (2 min)
Stage 2: Ramp up     - 10 → 50 VUs  (5 min)
Stage 3: Sustained   - 50 VUs       (10 min)
Stage 4: Spike       - 50 → 100 VUs (3 min)
Stage 5: Hold spike  - 100 VUs      (5 min)
Stage 6: Ramp down   - 100 → 20 VUs (5 min)
Stage 7: Cool down   - 20 → 0 VUs   (2 min)
```

### Customize Stages

Edit `options.stages` in `billing.k6.js`:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Your custom stages
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
};
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/load-test.yml`:

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:     # Manual trigger

jobs:
  load-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run load tests
        env:
          API_BASE_URL: ${{ secrets.STAGING_API_URL }}
          AUTH_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
        run: |
          k6 run --out json=results.json apps/api/test/load/billing.k6.js

      - name: Upload results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: load-test-results
          path: results.json

      - name: Check thresholds
        run: |
          if grep -q "thresholds.*failed" results.json; then
            echo "❌ Load test failed - thresholds not met"
            exit 1
          fi
          echo "✅ Load test passed"
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
load-test:
  stage: test
  image: grafana/k6:latest
  script:
    - k6 run --out json=results.json apps/api/test/load/billing.k6.js
  artifacts:
    when: always
    paths:
      - results.json
    expire_in: 7 days
  only:
    - schedules
    - web  # Manual trigger
```

### Jenkins

```groovy
pipeline {
  agent any

  stages {
    stage('Load Test') {
      steps {
        sh '''
          k6 run \
            --env API_BASE_URL=${STAGING_API_URL} \
            --env AUTH_TOKEN=${LOAD_TEST_TOKEN} \
            --out json=results.json \
            apps/api/test/load/billing.k6.js
        '''
      }
    }

    stage('Archive Results') {
      steps {
        archiveArtifacts artifacts: 'results.json', fingerprint: true
      }
    }
  }
}
```

### Docker

Run in Docker container:

```bash
docker run --rm -i \
  -e API_BASE_URL=http://host.docker.internal:3001 \
  -e AUTH_TOKEN=mock-token \
  -v $PWD:/app \
  grafana/k6:latest \
  run /app/apps/api/test/load/billing.k6.js
```

## Monitoring & Visualization

### k6 Cloud

Upload results to k6 Cloud for visualization:

```bash
k6 login cloud --token YOUR_TOKEN
k6 cloud test/load/billing.k6.js
```

View results at: <https://app.k6.io/>

### Grafana + InfluxDB

1. Start InfluxDB:

```bash
docker run -d -p 8086:8086 influxdb:1.8
```

2. Run k6 with InfluxDB output:

```bash
k6 run --out influxdb=http://localhost:8086/k6 test/load/billing.k6.js
```

3. Configure Grafana dashboard:
   - Import k6 dashboard: <https://grafana.com/grafana/dashboards/2587>
   - Add InfluxDB data source

### Custom Dashboard

Use the JSON output to build custom dashboards:

```bash
k6 run --out json=results.json test/load/billing.k6.js

# Parse with jq
cat results.json | jq -r '.metrics | to_entries[] | "\(.key): \(.value)"'
```

## Troubleshooting

### High Error Rates

**Problem**: Error rate > 5%

**Solutions**:

1. Check API is running: `curl http://localhost:3001/health`
2. Verify authentication token is valid
3. Review API logs for errors
4. Reduce VU count if overwhelming API
5. Check database connection pool settings

### Slow Response Times

**Problem**: P99 > 500ms

**Solutions**:

1. Profile API with `DEBUG=* pnpm dev`
2. Check database query performance
3. Review API logs for slow operations
4. Consider adding caching
5. Optimize database indexes
6. Scale API horizontally

### Connection Errors

**Problem**: `ECONNREFUSED` or timeout errors

**Solutions**:

1. Verify API URL is correct
2. Check firewall/network settings
3. Ensure API accepts connections from test machine
4. Increase `http_req_timeout` in k6 options

### Authentication Failures

**Problem**: 401/403 errors

**Solutions**:

1. Update `AUTH_TOKEN` environment variable
2. Generate new auth JWT token
3. Check token expiration
4. Verify Better Auth configuration in API

### Memory Issues

**Problem**: k6 crashes or runs out of memory

**Solutions**:

1. Reduce VU count
2. Reduce test duration
3. Use `--no-connection-reuse` flag
4. Disable unnecessary metrics
5. Run on machine with more RAM

## Best Practices

### Before Running Tests

- ✅ Test against staging/test environment first
- ✅ Ensure API has adequate resources
- ✅ Notify team before load testing production
- ✅ Have monitoring/alerts configured
- ✅ Backup database before testing
- ✅ Verify baseline performance

### During Tests

- 📊 Monitor system resources (CPU, memory, network)
- 📊 Watch API logs in real-time
- 📊 Check database connection count
- 📊 Monitor error rates
- 🔴 Be ready to stop test if issues occur

### After Tests

- 📈 Analyze P95/P99 latencies
- 📈 Review error distribution
- 📈 Identify bottlenecks
- 📈 Document findings
- 📈 Create improvement tasks
- 📈 Archive results

## Advanced Usage

### Custom Thresholds

Modify thresholds in `billing.k6.js`:

```javascript
thresholds: {
  'http_req_duration': ['p(95)<300', 'p(99)<500'],
  'subscription_list_latency': ['p(99)<400'],
  'error_rate': ['rate<0.01'],  // Stricter: 1%
}
```

### Environment-Specific Configs

Create separate config files:

```javascript
// config/staging.js
export const config = {
  baseUrl: 'https://api-staging.hospeda.com',
  vus: 50,
  duration: '5m',
};

// config/production.js
export const config = {
  baseUrl: 'https://api.hospeda.com',
  vus: 100,
  duration: '10m',
};
```

Import in test:

```javascript
import { config } from './config/staging.js';

export const options = {
  vus: config.vus,
  duration: config.duration,
};
```

### Custom Scenarios

Add new scenarios to `billing.k6.js`:

```javascript
function customScenario() {
  group('Custom Scenario', () => {
    // Your test logic
  });
}

export default function() {
  if (random < 0.10) {
    customScenario();
  }
  // ... existing scenarios
}
```

## Resources

- **k6 Documentation**: <https://k6.io/docs/>
- **k6 Examples**: <https://k6.io/docs/examples/>
- **Performance Testing Guide**: <https://k6.io/docs/testing-guides/>
- **k6 Cloud**: <https://app.k6.io/>
- **Grafana k6 Dashboard**: <https://grafana.com/grafana/dashboards/2587>

## Support

For issues or questions:

1. Check k6 documentation
2. Review API logs
3. Consult team lead
4. Create issue in project repository

## License

Internal use only - Hospeda project
