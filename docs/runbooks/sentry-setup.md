# Sentry Setup Guide

## Overview

Complete guide for configuring Sentry in production for the Hospeda platform. Covers project structure, DSN configuration, alert setup, post-deploy verification, dashboards, and troubleshooting.

**Last Updated**: 2026-03-04
**Status**: Base configuration complete, alerts pending

## Configuration Summary

| Component | Value | Status |
|-----------|-------|--------|
| **Organization** | `qazuor` | Done |
| **Team** | `hospeda` | Done |
| **API Project** | `hospeda-api` (Node.js) | Done |
| **Web Project** | `hospeda-web` (Astro) | Done |
| **Admin Project** | `hospeda-admin` (React) | Done |
| **Region** | US (`us.sentry.io`) | Done |

### Access URLs

- **Dashboard**: <https://qazuor.sentry.io>
- **Issues**: <https://qazuor.sentry.io/issues/>
- **Projects**: <https://qazuor.sentry.io/projects/>
- **Alerts**: <https://qazuor.sentry.io/alerts/rules/>
- **Team Hospeda**: <https://qazuor.sentry.io/settings/teams/hospeda/>

## Project Structure in Sentry

```
Organization: qazuor
  Team: hospeda
    hospeda-api      (Node.js backend)
    hospeda-web      (Astro frontend)
    hospeda-admin    (React admin dashboard)
```

### Configured Tags

All errors automatically include the following tags:

| Tag | Description | Values |
|-----|-------------|--------|
| `project` | Project name | `hospeda` |
| `app_type` | Application type | `api`, `web`, `admin` |
| `module` | Source module (billing) | `billing` |
| `event_type` | Billing event type | `payment_failure`, `webhook_failure`, `trial_expiration` |

### Useful Filters in Sentry

```
# All Hospeda errors
project:hospeda

# API errors only
project:hospeda app_type:api

# Billing errors
module:billing

# Payment failures
event_type:payment_failure

# Combined filters
project:hospeda app_type:api event_type:webhook_failure
```

## DSNs and Environment Variables

### Production (.env)

```bash
# =============================================================================
# SENTRY CONFIGURATION - PRODUCTION
# =============================================================================

# API - hospeda-api project
SENTRY_DSN=https://31c6b2d7db0789020567a65cb20bf796@o4508855548313600.ingest.us.sentry.io/4510829690028032
SENTRY_PROJECT=hospeda
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_DEBUG=false

# Web App - hospeda-web project
PUBLIC_SENTRY_DSN=https://f2e64d188706860ecff62b23ff2fb8d6@o4508855548313600.ingest.us.sentry.io/4510829690486784
PUBLIC_SENTRY_PROJECT=hospeda

# Admin App - hospeda-admin project
VITE_SENTRY_DSN=https://1bd1f0f8e4bfc2aa0bd2b64fcd13db97@o4508855548313600.ingest.us.sentry.io/4510829690814464
VITE_SENTRY_PROJECT=hospeda
```

### Staging

```bash
SENTRY_ENVIRONMENT=staging
SENTRY_TRACES_SAMPLE_RATE=1.0    # 100% in staging for debugging
SENTRY_DEBUG=true
```

### Values by Environment

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `SENTRY_ENVIRONMENT` | `development` | `staging` | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | `1.0` | `1.0` | `0.1` |
| `SENTRY_PROFILES_SAMPLE_RATE` | `1.0` | `1.0` | `0.1` |
| `SENTRY_DEBUG` | `true` | `true` | `false` |

## Alert Configuration

### Access

**URL to create alerts**: <https://qazuor.sentry.io/alerts/rules/>

### Alert 1: High Payment Failure Rate

Detects spikes in payment failures.

**Project**: `hospeda-api`

| Field | Value |
|-------|-------|
| Alert Name | `[Billing] High Payment Failure Rate` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Conditions (When)**:

```
An event's tags match: event_type equals payment_failure
```

**Trigger (If)**:

```
The issue is seen more than 5 times in 5 minutes
```

**Action (Then)**:

```
Send a notification to: [your email]
```

**Steps**:

1. Go to <https://qazuor.sentry.io/alerts/rules/>
2. Click "Create Alert" then "Issue Alert"
3. Select project: `hospeda-api`
4. In "Set conditions":
   - Add condition then "The event's tags match"
   - Key: `event_type`, Value: `payment_failure`
5. In "Set action interval":
   - "More than 5 times in 5 minutes"
6. In "Perform actions":
   - Add action then "Send a notification"
   - Select email
7. Name: `[Billing] High Payment Failure Rate`
8. Save Rule

### Alert 2: Webhook Processing Failures

Detects issues with MercadoPago webhooks.

**Project**: `hospeda-api`

| Field | Value |
|-------|-------|
| Alert Name | `[Billing] Webhook Processing Failures` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Conditions**:

```
An event's tags match: event_type equals webhook_failure
```

**Trigger**:

```
The issue is seen more than 3 times in 10 minutes
```

**Action**:

```
Send a notification to: [your email]
```

### Alert 3: Critical Error Spike

Detects general error spikes in any app.

**Project**: Create in EACH project (`hospeda-api`, `hospeda-web`, `hospeda-admin`)

| Field | Value |
|-------|-------|
| Alert Name | `[Critical] High Error Rate - {app}` |
| Alert Type | Metric Alert |
| Environment | `production` |

**Metric**:

```
count() > 50 in the last 5 minutes
```

**Action**:

```
Send a notification to: [your email]
```

**Steps**:

1. Go to <https://qazuor.sentry.io/alerts/rules/>
2. Click "Create Alert" then "Metric Alert"
3. Select project
4. Metric: `Number of Errors`
5. Threshold: `Above 50`
6. Time window: `5 minutes`
7. Save

### Alert 4: Trial Conversion Issues

Detects users who do not convert after their trial.

**Project**: `hospeda-api`

| Field | Value |
|-------|-------|
| Alert Name | `[Billing] Low Trial Conversion` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Conditions**:

```
An event's tags match: event_type equals trial_expiration
AND
An event's tags match: converted equals no
```

**Trigger**:

```
The issue is seen more than 10 times in 1 hour
```

### Alert 5: New Issue Detection

Notifies when a new error appears for the first time.

**Project**: Create in EACH project

| Field | Value |
|-------|-------|
| Alert Name | `[New] First Seen Error - {app}` |
| Alert Type | Issue Alert |
| Environment | `production` |

**Conditions**:

```
A new issue is created
```

**Action**:

```
Send a notification to: [your email]
```

### Alert 6: Subscription State Errors

Detects errors in subscription state transitions.

**Project**: `hospeda-api`

| Field | Value |
|-------|-------|
| Alert Name | `[Billing] Subscription State Errors` |
| Alert Type | Issue Alert |

**Conditions**:

```
The event's message contains: subscription
AND
The event's level equals: error
```

**Trigger**:

```
The issue is seen more than 5 times in 15 minutes
```

### Alert Summary

| # | Name | Project | Type | Priority |
|---|------|---------|------|----------|
| 1 | High Payment Failure Rate | hospeda-api | Issue | Critical |
| 2 | Webhook Processing Failures | hospeda-api | Issue | Critical |
| 3 | High Error Rate - API | hospeda-api | Metric | High |
| 4 | High Error Rate - Web | hospeda-web | Metric | High |
| 5 | High Error Rate - Admin | hospeda-admin | Metric | High |
| 6 | Low Trial Conversion | hospeda-api | Issue | Medium |
| 7 | New Error - API | hospeda-api | Issue | Medium |
| 8 | New Error - Web | hospeda-web | Issue | Medium |
| 9 | New Error - Admin | hospeda-admin | Issue | Medium |
| 10 | Subscription State Errors | hospeda-api | Issue | High |

## Alert Operations

### Alert Message Templates

**Payment Failure:**

```
HIGH PAYMENT FAILURE RATE
5+ payment failures detected in the last 5 minutes
Plan: {plan_id} | Time: {timestamp}

Action: Check MercadoPago status -> Review errors -> Verify config
```

**Webhook Failure:**

```
WEBHOOK PROCESSING FAILURES
Provider: MercadoPago | Event: {webhook_event} | Retry: {retryCount}

Action: Check signature -> Review logs -> Verify endpoint accessibility
```

**High Latency:**

```
HIGH LATENCY ON BILLING ENDPOINTS
Endpoint: {transaction} | Avg Response: {avg_duration}ms

Action: Check DB queries -> Review MercadoPago latency -> Check server load
```

**Trial Conversion:**

```
TRIAL CONVERSION ISSUES
Error Count: {count} | Window: 1 hour

Action: Review trial expiration -> Check eligibility -> Verify payment collection
```

**Subscription State:**

```
SUBSCRIPTION STATE ERRORS
Subscription: {subscriptionId} | Plan: {planId}

Action: Review state transitions -> Check webhook delays -> Verify provider sync
```

### Alert Channels

Recommended notification channels:

1. **Email** - For all critical alerts
2. **Slack** - Real-time notifications to #billing-alerts channel
3. **PagerDuty** - For production payment failures (24/7 on-call)
4. **Webhook** - Custom integrations (optional)

**Slack Integration**:

1. Go to **Settings** then **Integrations**
2. Find **Slack** and click **Add Integration**
3. Authorize Sentry to access your Slack workspace
4. Configure channel routing:
   - Critical errors: `#billing-critical`
   - Warnings: `#billing-alerts`
   - Info: `#billing-logs`

**Email Configuration**:

1. Go to **Settings** then **Teams**
2. Add team members
3. Configure notification preferences per alert rule
4. Set up email digests for non-critical alerts

### Testing Alerts

**In Development**:

```typescript
// Test file: apps/api/test/sentry-alerts.test.ts
import { captureBillingError, capturePaymentFailure } from '../src/lib/sentry';

describe('Sentry Alerts', () => {
  it('should trigger payment failure alert', async () => {
    const error = new Error('Payment declined');

    // This should trigger alert if threshold is met
    for (let i = 0; i < 6; i++) {
      capturePaymentFailure(error, {
        subscriptionId: 'sub_test',
        amount: 9900,
        currency: 'ARS',
        failureReason: 'card_declined',
      });
    }
  });

  it('should trigger webhook failure alert', async () => {
    const error = new Error('Webhook signature invalid');

    // This should trigger alert if threshold is met
    for (let i = 0; i < 4; i++) {
      captureWebhookError(error, {
        provider: 'mercadopago',
        eventType: 'payment.updated',
        retryCount: i,
      });
    }
  });
});
```

**Manual Testing**:

1. Generate a test event:

```bash
curl -X POST http://localhost:3001/api/v1/test/sentry-error \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_failure"}'
```

2. Check Sentry Dashboard:
   - Go to **Issues** then view recent events
   - Verify error appears with correct tags and context
   - Check if alert rule is triggered

3. Verify alert notification:
   - Check email/Slack for alert notification
   - Confirm message includes all required context
   - Verify alert links to correct Sentry issue

### Alert Tuning

Monitor alert frequency and adjust thresholds to reduce noise:

- **Too many alerts**: Increase threshold or time window
- **Missing issues**: Decrease threshold or time window
- **False positives**: Add more specific filters

**Common adjustments**:

```
Payment Failures:
- Development: 10 errors in 5 minutes (higher threshold for testing)
- Staging: 5 errors in 5 minutes
- Production: 3 errors in 5 minutes (most sensitive)

Webhook Failures:
- All environments: 3 errors in 10 minutes
- Consider retry count: Alert only if retries exceeded

High Latency:
- Development: > 5000ms
- Staging: > 3000ms
- Production: > 2000ms (faster response required)
```

### Runbook: When Payment Failure Alert Fires

1. **Check Sentry Issue**:
   - Review error details and stack trace
   - Check affected customer count
   - Identify common failure pattern

2. **Check Payment Provider**:
   - Visit MercadoPago status page
   - Review recent API changes
   - Check for service disruptions

3. **Verify Configuration**:
   - Confirm API credentials are valid
   - Check webhook endpoint accessibility
   - Verify SSL certificate validity

4. **Customer Communication**:
   - If widespread: Post status update
   - If isolated: Contact affected customers
   - Provide ETA for resolution

### Runbook: When Webhook Failure Alert Fires

1. **Check Webhook Logs**:
   - Review recent webhook deliveries
   - Check signature verification logs
   - Identify failure pattern

2. **Test Webhook Endpoint**:
   - Verify endpoint is accessible
   - Check firewall/security rules
   - Test signature verification manually

3. **Re-process Failed Webhooks**:
   - Manually trigger webhook processing
   - Update subscription states if needed
   - Verify data consistency

4. **Update Monitoring**:
   - Adjust alert threshold if needed
   - Add additional logging
   - Document resolution steps

## Post-Deploy Verification

### Verification Checklist

```bash
# 1. Verify Sentry initializes (check logs)
grep -i "sentry" /var/log/hospeda-api.log

# Expected output:
# "Sentry Logger [log]: Initializing Sentry..."
# "Sentry initialized successfully"
```

### Manual Error Test

To verify errors reach Sentry:

```typescript
// In any test endpoint (NOT in real production)
import { Sentry } from '../lib/sentry';

// Capture a test error
Sentry.captureMessage('Test error from Hospeda API', 'error');

// Or throw an exception
throw new Error('Test exception for Sentry verification');
```

### Verify on Dashboard

1. Go to <https://qazuor.sentry.io/issues/>
2. Filter by project: `hospeda-api`
3. The test error should appear

### Sentry Health Check

```bash
# Verify connection from the server
curl -I https://o4508855548313600.ingest.us.sentry.io/
# Should return 200 OK
```

## Recommended Dashboards

### Dashboard: Billing System Health

Create at: <https://qazuor.sentry.io/dashboards/>

**Recommended widgets**:

1. **Error Count by App Type** (Bar Chart)

   ```
   count() by app_type
   ```

2. **Payment Failures (24h)** (Big Number)

   ```
   count() where event_type:payment_failure
   ```

3. **Webhook Errors (24h)** (Big Number)

   ```
   count() where event_type:webhook_failure
   ```

4. **Error Trend (7 days)** (Line Chart)

   ```
   count() by day
   ```

5. **Top 5 Errors** (Table)

   ```
   count() by issue order by count desc limit 5
   ```

6. **P99 Response Time** (Line Chart)

   ```
   p99(transaction.duration) where transaction:"/api/v1/protected/billing/*"
   ```

### Additional Dashboard Widgets

```
1. Error Rate by Billing Operation
   - Type: Bar Chart
   - Query: Count of errors grouped by billing_operation tag

2. Payment Provider Health
   - Type: Line Chart
   - Query: Error rate over time filtered by payment-related events

3. Webhook Processing Time
   - Type: Line Chart
   - Query: Avg transaction.duration for webhook endpoints

4. Subscription State Distribution
   - Type: Pie Chart
   - Query: Count of subscriptions by status tag
```

## Code Integration

### Capturing Billing Errors

```typescript
import { captureBillingError, capturePaymentFailure } from '@/lib/sentry';

// Capture subscription error
try {
  await subscriptionService.create(data);
} catch (error) {
  captureBillingError(error, {
    subscriptionId: data.subscriptionId,
    planId: data.planId,
    customerEmail: data.email,
  });
  throw error;
}

// Capture payment failure
try {
  await processPayment(data);
} catch (error) {
  capturePaymentFailure(error, {
    subscriptionId: data.subscriptionId,
    amount: data.amount,
    currency: 'ARS',
    failureReason: 'card_declined',
  });
  throw error;
}
```

### Capturing Webhook Errors

```typescript
import { captureWebhookError } from '@/lib/sentry';

try {
  await processWebhook(event);
} catch (error) {
  captureWebhookError(error, {
    provider: 'mercadopago',
    eventType: event.type,
    eventId: event.id,
    retryCount: 2,
  });
  throw error;
}
```

### Performance Tracking

```typescript
import { startTransaction } from '@/lib/sentry';

const transaction = startTransaction('billing.checkout', 'billing.operation');

try {
  await processCheckout(data);
} finally {
  transaction?.finish();
}
```

## Automatic Context

The Sentry middleware automatically adds:

- **Request Context**: Method, URL, headers (sanitized)
- **User Context**: User ID, email (anonymized), role
- **Billing Context**: Subscription, plan, payment info
- **Tags**: module, operation type, plan ID

## Sensitive Data Filtering

Sentry is configured to automatically filter:

- Authentication tokens
- Passwords
- API keys
- Credit card information
- Emails (anonymized: `***@domain.com`)

## Release Tracking (Optional)

To track errors by release/version:

### 1. Add version variable

```bash
# In .env or CI/CD
SENTRY_RELEASE=hospeda-api@1.2.3
```

### 2. Configure in code

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.SENTRY_RELEASE || `hospeda-api@${process.env.npm_package_version}`,
});
```

### 3. Create release during deploy

```bash
# In CI/CD pipeline
sentry-cli releases new hospeda-api@1.2.3
sentry-cli releases set-commits hospeda-api@1.2.3 --auto
sentry-cli releases finalize hospeda-api@1.2.3
```

## Source Maps (For Web and Admin)

For better stack traces on the frontend:

### 1. Build with source maps

```bash
# astro.config.mjs
export default defineConfig({
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
```

### 2. Upload source maps

```bash
# In CI/CD after the build
sentry-cli sourcemaps upload \
  --org qazuor \
  --project hospeda-web \
  ./dist
```

## Troubleshooting

### Sentry Does Not Initialize

**Symptom**: No Sentry logs appear at startup

**Solution**:

```bash
# Verify DSN is configured
echo $SENTRY_DSN

# If empty, Sentry silently disables itself
```

### Errors Do Not Appear on Dashboard

**Symptom**: The app works but no errors are visible

**Possible causes**:

1. Incorrect DSN
2. Environment filtered (check filter in Issues)
3. Sample rate set to 0

**Solution**:

```bash
# Temporarily increase sample rate
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_DEBUG=true

# Restart app and check logs
```

### Too Many Errors (Noise)

**Symptom**: Many irrelevant errors

**Solution**:

1. Configure `beforeSend` to filter known errors
2. Use `ignoreErrors` in Sentry config
3. Mark issues as "Ignored" on the dashboard

### Rate Limiting from Sentry

**Symptom**: "rate limited" errors in logs

**Solution**:

1. Reduce `tracesSampleRate`
2. Implement client-side filtering
3. Upgrade plan if necessary

## Maintenance

- **Monthly review** of alerts and thresholds
- **Quarterly cleanup** of old events
- **Biannual update** of SDK versions

## Contact and Support

- **Sentry Status**: <https://status.sentry.io/>
- **Documentation**: <https://docs.sentry.io/>
- **Support**: <https://sentry.io/support/>

## Related Documentation

- [Monitoring and Alerting Runbook](./monitoring.md) - General monitoring procedures and metrics
- [Production Bugs](./production-bugs.md) - Using metrics to investigate issues
- [MercadoPago Webhook Guide](https://www.mercadopago.com.ar/developers/es/docs/webhooks)

## Changelog

| Date | Change |
|------|--------|
| 2026-03-04 | Consolidated sentry-setup-guide and sentry-alerts into single English document |
| 2026-02-04 | Initial configuration: org, team, 3 projects, DSNs |
| 2026-02-04 | Alert recommendations documented |

---

**Last Updated**: 2026-03-04
**Maintained By**: DevOps Team
**Review Frequency**: Monthly
