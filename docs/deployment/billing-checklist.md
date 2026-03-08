# Billing System Deployment Checklist

This checklist ensures safe deployment of the Hospeda billing/monetization system powered by QZPay and MercadoPago.

## Pre-Deployment Checklist

### 1. Environment Variables

Verify all required environment variables are configured in production:

#### QZPay Configuration

- [ ] `HOSPEDA_DATABASE_URL` - PostgreSQL connection string (must include billing tables)

#### MercadoPago Configuration

- [ ] `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` - MercadoPago access token
  - **Sandbox**: Starts with `TEST-`
  - **Production**: Starts with `APP_USR-`
- [ ] `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` - Webhook signature verification secret (recommended)
- [ ] `HOSPEDA_MERCADO_PAGO_SANDBOX` - Set to `false` for production
- [ ] `HOSPEDA_MERCADO_PAGO_TIMEOUT` - Request timeout in ms (default: 5000)
- [ ] `HOSPEDA_MERCADO_PAGO_PLATFORM_ID` - (Optional) Platform ID for marketplace tracking
- [ ] `HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID` - (Optional) Integrator ID for tracking

#### Email Notifications (Resend)

- [ ] `HOSPEDA_RESEND_API_KEY` - Resend API key for email delivery
- [ ] `HOSPEDA_RESEND_FROM_EMAIL` - Default sender email (e.g., `noreply@hospeda.com.ar`)
- [ ] `HOSPEDA_RESEND_FROM_NAME` - Default sender name (e.g., `Hospeda`)
- [ ] `HOSPEDA_RESEND_REPLY_TO` - Reply-to email address (e.g., `soporte@hospeda.com.ar`)
- [ ] `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` - Comma-separated admin emails for notifications

#### Cron/Scheduler

- [ ] `HOSPEDA_CRON_SECRET` - Secret for authenticating cron requests (REQUIRED)
- [ ] `HOSPEDA_CRON_ADAPTER` - Set to `vercel` for Vercel, `node-cron` for VPS, or `manual` (default)

#### API Configuration

- [ ] `HOSPEDA_API_URL` - API base URL (e.g., `https://api.hospeda.com.ar`)
- [ ] `HOSPEDA_SITE_URL` - Frontend site URL (e.g., `https://hospeda.com.ar`)
- [ ] `API_CORS_ORIGINS` - Allowed CORS origins (must include frontend URLs)

#### Security

- [ ] `API_RATE_LIMIT_ENABLED` - Set to `true` (required for billing endpoints)
- [ ] `API_SECURITY_ENABLED` - Set to `true`
- [ ] `API_SECURITY_HEADERS_ENABLED` - Set to `true`

### 2. Database Migrations

Run all billing-related migrations:

```bash
# From project root
pnpm db:migrate
```

Verify these tables exist:

- [ ] `billing_customers` - Customer records
- [ ] `billing_plans` - Subscription plans (owner, complex, tourist)
- [ ] `billing_subscriptions` - Active subscriptions
- [ ] `billing_payments` - Payment records
- [ ] `billing_addons` - Available add-ons
- [ ] `billing_addon_purchases` - Add-on purchase records
- [ ] `billing_promo_codes` - Promotional codes
- [ ] `billing_promo_code_usage` - Promo code redemptions
- [ ] `billing_webhook_events` - Webhook event log (idempotency)
- [ ] `billing_notification_log` - Email notification tracking

### 3. Database Indexes

Verify critical indexes are created:

```sql
-- Check billing indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename LIKE 'billing_%'
ORDER BY tablename, indexname;
```

Critical indexes to verify:

- [ ] `billing_customers` - Index on `userId`, `email`
- [ ] `billing_subscriptions` - Index on `customerId`, `status`, `currentPeriodEnd`
- [ ] `billing_payments` - Index on `customerId`, `subscriptionId`, `status`
- [ ] `billing_addon_purchases` - Index on `customerId`, `status`, `expiresAt`
- [ ] `billing_promo_codes` - Index on `code`, `isActive`, `expiresAt`
- [ ] `billing_webhook_events` - Index on `providerEventId`, `status`

### 4. MercadoPago Configuration

#### Webhook URL Setup

1. Log into MercadoPago developer dashboard
2. Navigate to "Webhooks" or "IPN Configuration"
3. Configure webhook URL:

```text
https://api.hospeda.com.ar/api/v1/webhooks/mercadopago
```

4. Select events to receive:
   - [ ] `payment.created`
   - [ ] `payment.updated`
   - [ ] `subscription_preapproval.created`
   - [ ] `subscription_preapproval.updated`

5. Save webhook secret to `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` environment variable

#### Test Webhook Delivery

```bash
# Send test webhook from MercadoPago dashboard
# Verify in logs:
tail -f /var/log/hospeda-api.log | grep "MercadoPago webhook"

# Or check webhook events table:
psql $DATABASE_URL -c "SELECT * FROM billing_webhook_events ORDER BY created_at DESC LIMIT 5;"
```

### 5. Feature Flags & Plan Configuration

Verify plan configurations in code:

- [ ] `/home/qazuor/projects/WEBS/hospeda/packages/billing/src/config/plans.config.ts`
  - Owner plans: Basico, Pro, Premium
  - Complex plans: Basico, Pro, Premium
  - Tourist plans: Free, Plus, VIP
- [ ] `/home/qazuor/projects/WEBS/hospeda/packages/billing/src/config/entitlements.config.ts`
  - All entitlements properly configured
- [ ] `/home/qazuor/projects/WEBS/hospeda/packages/billing/src/config/limits.config.ts`
  - Limits properly configured

### 6. Security Checks

#### Webhook Signature Verification

- [ ] `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is set (enables signature verification)
- [ ] Webhook route uses `createWebhookRouter` with `signatureHeader: 'x-signature'`
- [ ] Test signature verification with invalid signature (should reject)

#### Rate Limiting

Verify rate limiting is enabled for billing endpoints:

```typescript
// apps/api/src/routes/billing/index.ts
// Should have rate limiting middleware
```

- [ ] General API rate limit: 100 requests/15min (default)
- [ ] Admin endpoints: More restrictive (200 requests/10min)
- [ ] Public endpoints: 1000 requests/hour

#### HMAC Secrets

- [ ] Webhook secrets are stored in environment variables (NOT in code)
- [ ] Secrets are rotated periodically (recommended: every 90 days)

### 7. Email Templates

Verify notification templates are configured:

- [ ] Trial reminder notifications (`TRIAL_REMINDER_3_DAYS`, `TRIAL_REMINDER_1_DAY`)
- [ ] Trial expiry notification (`TRIAL_EXPIRED`)
- [ ] Payment success notification (`PAYMENT_SUCCESS`)
- [ ] Payment failure notification (`PAYMENT_FAILURE`)
- [ ] Subscription activated (`SUBSCRIPTION_ACTIVATED`)
- [ ] Subscription cancelled (`SUBSCRIPTION_CANCELLED`)
- [ ] Add-on purchase (`ADDON_PURCHASE`)
- [ ] Admin notifications (payment failures, system errors)

Test email delivery:

```bash
# Send test notification
curl -X POST https://api.hospeda.com.ar/api/v1/protected/billing/test-notification \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "PAYMENT_SUCCESS", "email": "test@example.com"}'
```

### 8. Monitoring & Logging

Configure monitoring for billing operations:

#### Application Logs

- [ ] API logs include billing operations
- [ ] Webhook events are logged with request IDs
- [ ] Payment processing is logged with transaction IDs

#### Metrics

- [ ] `/api/v1/protected/billing/metrics` endpoint is accessible
- [ ] Metrics include:
  - Active subscriptions by plan
  - Trial conversion rate
  - Monthly recurring revenue (MRR)
  - Payment success/failure rate
  - Add-on purchases

#### Alerts

Set up alerts for:

- [ ] Webhook processing failures (>5% error rate)
- [ ] Payment failures (>10% failure rate)
- [ ] Subscription cancellations (spike detection)
- [ ] Trial expirations without conversion (daily summary)

### 9. Backup & Recovery

- [ ] Database backups include all billing tables
- [ ] Backup frequency: At least daily
- [ ] Test database restore procedure
- [ ] Document rollback plan (see [Billing Incidents Runbook](/docs/runbooks/billing-incidents.md))

### 10. Pre-Production Testing

#### Test Scenarios

Run these tests in staging/sandbox environment:

- [ ] **Create subscription** - Owner/Complex/Tourist plans
- [ ] **Trial activation** - New user gets 14-day trial
- [ ] **Trial expiry** - User blocked after trial ends
- [ ] **Payment processing** - Successful payment via MercadoPago
- [ ] **Payment failure** - Simulate failed payment, verify retry
- [ ] **Webhook delivery** - Verify webhooks are received and processed
- [ ] **Webhook idempotency** - Send duplicate webhook, verify not reprocessed
- [ ] **Add-on purchase** - Purchase add-on, verify entitlements applied
- [ ] **Promo code** - Apply promo code, verify discount
- [ ] **Subscription upgrade** - Upgrade from Basico to Pro
- [ ] **Subscription cancellation** - Cancel subscription, verify access revoked
- [ ] **Notification delivery** - Verify all email notifications sent

#### Load Testing

- [ ] Simulate 100 concurrent webhook deliveries
- [ ] Simulate 50 concurrent subscription creations
- [ ] Verify no race conditions or duplicate processing

#### Security Testing

- [ ] Test webhook signature verification with invalid signatures
- [ ] Test rate limiting enforcement
- [ ] Test unauthorized access to billing endpoints
- [ ] Test SQL injection on promo code validation

## Deployment Steps

### 1. Deploy Database Migrations

```bash
# Production database
DATABASE_URL="postgresql://..." pnpm db:migrate
```

### 2. Deploy API Application

```bash
# Build and deploy API
cd apps/api
pnpm build
pnpm start

# Or deploy to Vercel
vercel --prod
```

### 3. Configure MercadoPago Webhooks

1. Update webhook URL in MercadoPago dashboard to production URL
2. Verify webhook secret matches `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
3. Send test webhook to verify connectivity

### 4. Seed Initial Data (if needed)

```bash
# Seed plans, add-ons, and initial promo codes
pnpm db:seed:billing
```

### 5. Start Cron Jobs

Configure trial expiry check (runs daily):

```bash
# Vercel Cron (vercel.json)
{
  "crons": [{
    "path": "/api/v1/protected/billing/trial/check-expiry",
    "schedule": "0 0 * * *"
  }]
}

# Or VPS cron (crontab)
0 0 * * * curl -H "Authorization: Bearer $HOSPEDA_CRON_SECRET" https://api.hospeda.com.ar/api/v1/protected/billing/trial/check-expiry
```

### 6. Enable Monitoring

- [ ] Configure Sentry DSN for error tracking
- [ ] Set up dashboard for billing metrics
- [ ] Configure alerts for critical failures

## Post-Deployment Verification

### Smoke Tests

Run these tests immediately after deployment:

1. **Health Check**

```bash
curl https://api.hospeda.com.ar/health
# Expected: {"status":"ok"}
```

2. **Billing Health Check**

```bash
curl https://api.hospeda.com.ar/api/v1/protected/billing/health
# Expected: {"billing":true,"paymentProvider":"mercadopago"}
```

3. **Create Test Subscription**

```bash
# Use test credit card in sandbox mode
# Verify subscription created successfully
```

4. **Send Test Webhook**

```bash
# From MercadoPago dashboard
# Verify webhook received and processed
```

5. **Check Metrics**

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.hospeda.com.ar/api/v1/protected/billing/metrics
# Verify metrics returned
```

### Monitor for 24 Hours

- [ ] Monitor webhook delivery success rate (target: >95%)
- [ ] Monitor payment processing (no errors)
- [ ] Monitor email notifications (delivery rate >90%)
- [ ] Monitor trial expirations (processed correctly)
- [ ] Check error logs for unexpected issues

## Rollback Plan

If critical issues are detected, follow the [Billing Incidents Runbook](/docs/runbooks/billing-incidents.md) for rollback procedures.

Quick rollback steps:

1. Revert API deployment to previous version
2. Disable billing endpoints via feature flag (if available)
3. Pause MercadoPago webhooks in dashboard
4. Notify users of temporary service interruption
5. Investigate and fix issues
6. Redeploy when ready

## Success Criteria

Deployment is successful when:

- [ ] All environment variables configured correctly
- [ ] All database tables and indexes created
- [ ] MercadoPago webhooks receiving and processing events
- [ ] Email notifications being sent successfully
- [ ] Trial system creating and expiring trials correctly
- [ ] Payment processing working end-to-end
- [ ] Metrics endpoint showing accurate data
- [ ] No critical errors in logs for 24 hours
- [ ] Rollback plan tested and documented

## Support Contacts

- **Technical Lead**: [Contact info]
- **DevOps**: [Contact info]
- **MercadoPago Support**: [Partner support link]
- **Resend Support**: [Email support]

## Related Documentation

- [Billing Incidents Runbook](/docs/runbooks/billing-incidents.md)
- [Billing System Architecture](/packages/billing/README.md)
- [QZPay Documentation](https://github.com/qazuor/qzpay)
- [MercadoPago API Docs](https://www.mercadopago.com.ar/developers/es/docs)

---

**Last Updated**: 2026-02-03
**Version**: 1.0.0
