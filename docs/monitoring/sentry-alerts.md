# Sentry Alert Operations Guide

> **Para configuración inicial y creación de alertas, ver [sentry-setup-guide.md](./sentry-setup-guide.md)**

Este documento proporciona runbooks operacionales, testing de alertas, y ajuste de thresholds para el sistema de monitoreo de billing en Hospeda.

## Table of Contents

- [Alert Reference](#alert-reference)
- [Alert Channels](#alert-channels)
- [Testing Alerts](#testing-alerts)
- [Alert Tuning](#alert-tuning)
- [Runbook for Alerts](#runbook-for-alerts)

---

## Alert Reference

> **Configuración completa con pasos detallados en [sentry-setup-guide.md](./sentry-setup-guide.md#configuración-de-alertas)**

### Resumen de Alertas Configuradas

| Alerta | Proyecto | Threshold | Prioridad |
|--------|----------|-----------|-----------|
| High Payment Failure Rate | hospeda-api | 5 en 5 min | 🔴 Critical |
| Webhook Processing Failures | hospeda-api | 3 en 10 min | 🔴 Critical |
| High Error Rate | api/web/admin | 50 en 5 min | 🟠 High |
| Low Trial Conversion | hospeda-api | 10 en 1 hora | 🟡 Medium |
| New First Seen Error | api/web/admin | Inmediato | 🟡 Medium |
| Subscription State Errors | hospeda-api | 5 en 15 min | 🟠 High |

---

## Alert Rules Detail

### Alert Messages Templates

**Payment Failure:**

```
🚨 HIGH PAYMENT FAILURE RATE
5+ payment failures detected in the last 5 minutes
Plan: {plan_id} | Time: {timestamp}

Action: Check MercadoPago status → Review errors → Verify config
```

**Webhook Failure:**

```
⚠️ WEBHOOK PROCESSING FAILURES
Provider: MercadoPago | Event: {webhook_event} | Retry: {retryCount}

Action: Check signature → Review logs → Verify endpoint accessibility
```

**High Latency:**

```
🐌 HIGH LATENCY ON BILLING ENDPOINTS
Endpoint: {transaction} | Avg Response: {avg_duration}ms

Action: Check DB queries → Review MercadoPago latency → Check server load
```

**Trial Conversion:**

```
📊 TRIAL CONVERSION ISSUES
Error Count: {count} | Window: 1 hour

Action: Review trial expiration → Check eligibility → Verify payment collection
```

**Subscription State:**

```
🔄 SUBSCRIPTION STATE ERRORS
Subscription: {subscriptionId} | Plan: {planId}

Action: Review state transitions → Check webhook delays → Verify provider sync
```

---

## Alert Channels

### Recommended Notification Channels

1. **Email** - For all critical alerts
2. **Slack** - Real-time notifications to #billing-alerts channel
3. **PagerDuty** - For production payment failures (24/7 on-call)
4. **Webhook** - Custom integrations (optional)

### Slack Integration

1. Go to **Settings** → **Integrations**
2. Find **Slack** and click **Add Integration**
3. Authorize Sentry to access your Slack workspace
4. Configure channel routing:
   - Critical errors → `#billing-critical`
   - Warnings → `#billing-alerts`
   - Info → `#billing-logs`

### Email Configuration

1. Go to **Settings** → **Teams**
2. Add team members
3. Configure notification preferences per alert rule
4. Set up email digests for non-critical alerts

---

## Testing Alerts

### Test in Development

Before deploying to production, test alert triggers in development:

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

### Manual Testing

1. **Generate Test Event**:

```bash
# Trigger a test error
curl -X POST http://localhost:3001/api/v1/test/sentry-error \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_failure"}'
```

2. **Check Sentry Dashboard**:
   - Go to **Issues** → View recent events
   - Verify error appears with correct tags and context
   - Check if alert rule is triggered

3. **Verify Alert Notification**:
   - Check email/Slack for alert notification
   - Confirm message includes all required context
   - Verify alert links to correct Sentry issue

---

## Alert Tuning

### Adjusting Thresholds

Monitor alert frequency and adjust thresholds to reduce noise:

- **Too many alerts**: Increase threshold or time window
- **Missing issues**: Decrease threshold or time window
- **False positives**: Add more specific filters

### Common Adjustments

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

---

## Monitoring Dashboard

### Create Custom Dashboard in Sentry

1. Go to **Dashboards** → **Create Dashboard**
2. Name it "Billing System Health"
3. Add widgets:
   - **Payment Failures (24h)** - Count of payment errors
   - **Webhook Success Rate** - Percentage of successful webhooks
   - **Avg Response Time** - P95 latency for billing endpoints
   - **Trial Conversions** - Trial → Active conversion rate
   - **Active Subscriptions** - Current active subscription count

### Recommended Widgets

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

---

## Runbook for Alerts

### When Payment Failure Alert Fires

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

### When Webhook Failure Alert Fires

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

---

## Additional Resources

- [Sentry Setup Guide](./sentry-setup-guide.md) - Configuración inicial completa
- [Sentry Documentation](https://docs.sentry.io/)
- [MercadoPago Webhook Guide](https://www.mercadopago.com.ar/developers/es/docs/webhooks)
- [Hospeda Billing Architecture](../architecture/billing-system.md)

---

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.1.0   | 2026-02-04 | Refactored to operations guide, moved setup to sentry-setup-guide.md | Tech Team |
| 1.0.0   | 2026-02-04 | Initial alert configuration | Tech Team |

---

**Last Updated:** 2026-02-04
**Next Review:** 2026-03-04
