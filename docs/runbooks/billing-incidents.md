# Billing System Incident Response Runbook

This runbook provides troubleshooting procedures for common billing/monetization system issues in Hospeda.

## Quick Reference

| Issue | Severity | Page |
|-------|----------|------|
| Failed Payments | 🔴 High | [Failed Payments](#failed-payments) |
| Webhook Delivery Failures | 🟠 Medium | [Webhook Failures](#webhook-delivery-failures) |
| Subscription Sync Issues | 🟠 Medium | [Subscription Sync](#subscription-sync-issues) |
| Promo Code Problems | 🟡 Low | [Promo Codes](#promo-code-problems) |
| Trial Expiry Issues | 🟠 Medium | [Trial Expiry](#trial-expiry-issues) |
| Email Notification Failures | 🟡 Low | [Email Notifications](#email-notification-failures) |

## Incident Response Process

### 1. Assess Severity

- **Critical (🔴)**: System down, payment processing broken, data loss
- **High (🟠)**: Major feature broken, affecting multiple users
- **Medium (🟡)**: Minor feature broken, workaround available
- **Low (🔵)**: Cosmetic issue, no user impact

### 2. Initial Response

1. **Acknowledge incident** - Notify team in Slack/Discord
2. **Check monitoring** - Review logs, metrics, error tracking (Sentry)
3. **Assess impact** - How many users affected? Revenue impact?
4. **Communicate** - Update status page if customer-facing

### 3. Investigation

1. Check recent deployments
2. Review error logs
3. Check external service status (MercadoPago, Resend)
4. Verify database connectivity and migrations

### 4. Resolution

1. Apply fix (temporary or permanent)
2. Verify fix in production
3. Monitor for 1 hour after fix
4. Document incident and resolution

## Common Incidents

### Failed Payments

#### Symptoms

- Users reporting payment failures
- High rejection rate in metrics
- Payment failure notifications being sent
- Admin notifications about payment failures

#### Diagnosis

1. **Check payment failure rate**

```bash
# Get recent failed payments
psql $DATABASE_URL -c "
  SELECT status, status_detail, COUNT(*)
  FROM billing_payments
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND status IN ('rejected', 'cancelled', 'refunded')
  GROUP BY status, status_detail
  ORDER BY COUNT(*) DESC;
"
```

2. **Review MercadoPago status**

- Check MercadoPago status page: [https://status.mercadopago.com](https://status.mercadopago.com)
- Verify API credentials are valid
- Check for rate limiting or API quota issues

3. **Check webhook logs**

```bash
# Check recent webhook events
psql $DATABASE_URL -c "
  SELECT id, type, status, error, created_at
  FROM billing_webhook_events
  WHERE created_at > NOW() - INTERVAL '1 hour'
    AND status = 'failed'
  ORDER BY created_at DESC
  LIMIT 20;
"
```

4. **Review application logs**

```bash
# Search for payment processing errors
tail -f /var/log/hospeda-api.log | grep "payment"

# Or using grep on production logs
grep "payment.*error" /var/log/hospeda-api.log | tail -50
```

#### Common Causes

| Cause | Solution |
|-------|----------|
| **Invalid card details** | User error - instruct user to verify card info |
| **Insufficient funds** | User error - instruct user to use different payment method |
| **MercadoPago API down** | Wait for service restoration, enable retry logic |
| **Invalid API credentials** | Verify `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is correct |
| **Rate limiting** | Implement exponential backoff, request rate limit increase |
| **Webhook signature mismatch** | Verify `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` matches MercadoPago settings |

#### Resolution Steps

1. **If MercadoPago service issue**

```bash
# Check MercadoPago status
curl https://status.mercadopago.com/api/v2/status.json

# If down, notify users and enable retry logic
```

2. **If credential issue**

```bash
# Verify credentials
curl -H "Authorization: Bearer $HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN" \
  https://api.mercadopago.com/v1/payment_methods

# If invalid, update credentials and redeploy
```

3. **If webhook processing issue**

```bash
# Retry failed webhook events
psql $DATABASE_URL -c "
  UPDATE billing_webhook_events
  SET status = 'pending', error = NULL, processed_at = NULL
  WHERE status = 'failed'
    AND created_at > NOW() - INTERVAL '1 hour';
"

# Webhooks will be reprocessed on next delivery attempt
```

4. **If database issue**

```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check for table locks
psql $DATABASE_URL -c "
  SELECT pid, usename, query, state
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND query LIKE '%billing_%';
"
```

#### Prevention

- Monitor payment success rate (alert if <90%)
- Set up automatic retry for transient failures
- Test payment flow in staging before each release
- Keep MercadoPago credentials up to date

### Webhook Delivery Failures

#### Symptoms

- Webhooks not being processed
- Subscriptions not updating after payment
- `billing_webhook_events` table shows `failed` status
- Missing webhook events in database

#### Diagnosis

1. **Check webhook event status**

```bash
# Get webhook failure rate
psql $DATABASE_URL -c "
  SELECT status, COUNT(*), COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() AS percentage
  FROM billing_webhook_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY status;
"
```

2. **Check MercadoPago webhook configuration**

- Log into MercadoPago dashboard
- Navigate to Webhooks section
- Verify webhook URL is correct: `https://api.hospeda.com.ar/api/v1/webhooks/mercadopago`
- Check webhook delivery attempts and errors

3. **Check webhook endpoint accessibility**

```bash
# Test webhook endpoint
curl -X POST https://api.hospeda.com.ar/api/v1/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: test" \
  -d '{"id":"test","type":"payment","action":"payment.created","data":{"id":"test"}}'

# Should return 200 OK (or 401 if signature invalid)
```

#### Common Causes

| Cause | Solution |
|-------|----------|
| **Incorrect webhook URL** | Update URL in MercadoPago dashboard |
| **API endpoint down** | Check API health, restart if needed |
| **Signature verification failing** | Verify `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` |
| **Database connection timeout** | Check database health, increase connection pool |
| **Rate limiting** | Increase rate limits for webhook endpoint |
| **Firewall blocking MercadoPago IPs** | Whitelist MercadoPago IP ranges |

#### Resolution Steps

1. **If webhook URL incorrect**

- Update webhook URL in MercadoPago dashboard
- Test with webhook delivery test
- Verify events start flowing

2. **If signature verification failing**

```bash
# Get webhook secret from MercadoPago dashboard
# Update environment variable
# Restart API application
```

3. **If endpoint unreachable**

```bash
# Check API health
curl https://api.hospeda.com.ar/health

# Check webhook route specifically
curl -X OPTIONS https://api.hospeda.com.ar/api/v1/webhooks/mercadopago

# Restart API if needed
pm2 restart hospeda-api  # Or equivalent for your deployment
```

4. **If database issue**

```bash
# Check database connectivity from API server
psql $DATABASE_URL -c "SELECT NOW();"

# Check connection pool exhaustion
psql $DATABASE_URL -c "
  SELECT count(*) as total_connections,
         sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) as active,
         sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) as idle
  FROM pg_stat_activity
  WHERE datname = current_database();
"
```

#### Prevention

- Monitor webhook success rate (alert if <95%)
- Set up webhook retry logic (automatic in MercadoPago)
- Test webhook delivery after each deployment
- Use idempotency keys to prevent duplicate processing

### Subscription Sync Issues

#### Symptoms

- User has active subscription but system shows inactive
- User billed but subscription not updated
- Entitlements not reflecting subscription status
- Trial ended but user still has access

#### Diagnosis

1. **Check subscription status mismatch**

```bash
# Find subscriptions with status mismatch
psql $DATABASE_URL -c "
  SELECT
    s.id,
    s.customer_id,
    s.status,
    s.current_period_end,
    s.updated_at,
    c.email
  FROM billing_subscriptions s
  JOIN billing_customers c ON s.customer_id = c.id
  WHERE s.status = 'active'
    AND s.current_period_end < NOW()
  ORDER BY s.current_period_end DESC
  LIMIT 20;
"
```

2. **Check for missed webhook events**

```bash
# Check for gaps in webhook event IDs
psql $DATABASE_URL -c "
  SELECT type, COUNT(*) as events, MAX(created_at) as last_event
  FROM billing_webhook_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY type;
"
```

3. **Verify subscription in MercadoPago**

- Log into MercadoPago dashboard
- Search for subscription by ID
- Compare status with database

#### Common Causes

| Cause | Solution |
|-------|----------|
| **Missed webhook** | Manually sync subscription from MercadoPago API |
| **Webhook processing failure** | Retry failed webhooks, check error logs |
| **Database update failure** | Check transaction logs, manually update if needed |
| **Cron job not running** | Verify cron configuration, restart scheduler |
| **Entitlement cache not cleared** | Clear entitlement cache for affected users |

#### Resolution Steps

1. **Manually sync subscription**

```typescript
// From API console or admin tool
import { getQZPayBilling } from '@/middlewares/billing';

const billing = getQZPayBilling();
const subscription = await billing.subscriptions.get('sub_xxx');

// Update database with latest status
await billing.subscriptions.syncFromProvider('sub_xxx');
```

2. **Force entitlement refresh**

```typescript
// Clear entitlement cache for user
import { clearEntitlementCache } from '@/middlewares/entitlement';

clearEntitlementCache('customer_xxx');
```

3. **Retry trial expiry check**

```bash
# Manually trigger trial expiry check
curl -X POST https://api.hospeda.com.ar/api/v1/protected/billing/trial/check-expiry \
  -H "Authorization: Bearer $HOSPEDA_CRON_SECRET"
```

4. **Database fix for specific subscription**

```sql
-- CAUTION: Only use after verifying with MercadoPago dashboard
UPDATE billing_subscriptions
SET status = 'cancelled',
    cancelled_at = NOW()
WHERE id = 'sub_xxx'
  AND status != 'cancelled';

-- Clear entitlement cache after manual update
-- (use API endpoint or clear Redis cache if using Redis)
```

#### Prevention

- Monitor subscription sync lag (alert if >5 minutes)
- Run daily reconciliation job between Hospeda DB and MercadoPago
- Log all subscription status changes
- Implement automatic sync retry for failed updates

### Promo Code Problems

#### Symptoms

- Valid promo codes not being accepted
- Expired promo codes still working
- Discount amount incorrect
- Promo code usage limit not enforced

#### Diagnosis

1. **Check promo code status**

```bash
# Get promo code details
psql $DATABASE_URL -c "
  SELECT
    code,
    is_active,
    discount_type,
    discount_value,
    max_uses,
    current_uses,
    expires_at
  FROM billing_promo_codes
  WHERE code = 'PROMO_CODE_HERE';
"
```

2. **Check usage count**

```bash
# Verify usage count
psql $DATABASE_URL -c "
  SELECT code, COUNT(*) as actual_uses
  FROM billing_promo_code_usage
  WHERE code = 'PROMO_CODE_HERE'
  GROUP BY code;
"
```

3. **Check validation logic**

```typescript
// File: apps/api/src/services/promo-code.service.ts
// Review PromoCodeService.validate() method
```

#### Common Causes

| Cause | Solution |
|-------|----------|
| **Expired promo code** | Update `expires_at` or create new code |
| **Usage limit reached** | Increase `max_uses` or create new code |
| **Case sensitivity issue** | Normalize code to uppercase before validation |
| **Database sync delay** | Check for database replication lag |
| **Validation logic bug** | Review and fix validation code |

#### Resolution Steps

1. **Extend promo code expiry**

```sql
UPDATE billing_promo_codes
SET expires_at = NOW() + INTERVAL '30 days'
WHERE code = 'PROMO_CODE_HERE'
  AND is_active = true;
```

2. **Increase usage limit**

```sql
UPDATE billing_promo_codes
SET max_uses = max_uses + 100
WHERE code = 'PROMO_CODE_HERE';
```

3. **Reset usage count (use with caution)**

```sql
-- Only if usage count is incorrect due to bug
UPDATE billing_promo_codes
SET current_uses = (
  SELECT COUNT(*)
  FROM billing_promo_code_usage
  WHERE code = 'PROMO_CODE_HERE'
)
WHERE code = 'PROMO_CODE_HERE';
```

4. **Reactivate promo code**

```sql
UPDATE billing_promo_codes
SET is_active = true
WHERE code = 'PROMO_CODE_HERE';
```

#### Prevention

- Add expiry date buffer (extend by 1 day to avoid timezone issues)
- Log all promo code validation attempts
- Add admin UI for promo code management
- Send alerts when popular codes near usage limit

### Trial Expiry Issues

#### Symptoms

- Trials not expiring after 14 days
- Users blocked before trial ends
- Trial reminder emails not sent
- Trial expiry cron job failing

#### Diagnosis

1. **Check trial status for user**

```bash
# Get trial info
psql $DATABASE_URL -c "
  SELECT
    c.id as customer_id,
    c.email,
    s.id as subscription_id,
    s.status,
    s.trial_start,
    s.trial_end,
    s.current_period_end
  FROM billing_customers c
  JOIN billing_subscriptions s ON c.id = s.customer_id
  WHERE c.email = 'user@example.com';
"
```

2. **Check cron job execution**

```bash
# Check cron job logs
grep "check-expiry" /var/log/hospeda-api.log | tail -20

# Or check last execution time
psql $DATABASE_URL -c "
  SELECT MAX(updated_at)
  FROM billing_subscriptions
  WHERE status = 'expired';
"
```

3. **Verify trial calculation**

```typescript
// File: apps/api/src/services/trial.service.ts
// Review TrialService.checkStatus() method

// Trial period constants:
// Owner: 14 days (OWNER_TRIAL_DAYS)
// Complex: 14 days (COMPLEX_TRIAL_DAYS)
```

#### Common Causes

| Cause | Solution |
|-------|----------|
| **Cron job not running** | Verify cron configuration and restart |
| **Trial end date miscalculated** | Fix calculation logic, update affected trials |
| **Timezone issues** | Use UTC consistently, avoid local time |
| **Database lock during update** | Optimize query, add timeout handling |
| **Email notification failure** | Check Resend API status and credentials |

#### Resolution Steps

1. **Manually expire trial**

```sql
-- CAUTION: Verify trial period has actually ended
UPDATE billing_subscriptions
SET status = 'expired',
    cancelled_at = NOW()
WHERE id = 'sub_xxx'
  AND status = 'trialing'
  AND trial_end < NOW();
```

2. **Manually trigger trial expiry check**

```bash
curl -X POST https://api.hospeda.com.ar/api/v1/protected/billing/trial/check-expiry \
  -H "Authorization: Bearer $HOSPEDA_CRON_SECRET"
```

3. **Fix trial end date**

```sql
-- Recalculate trial end date (14 days from start)
UPDATE billing_subscriptions
SET trial_end = trial_start + INTERVAL '14 days'
WHERE trial_start IS NOT NULL
  AND trial_end IS NULL;
```

4. **Send missed trial reminder**

```typescript
// Manually send trial reminder
import { sendNotification } from '@/utils/notification-helper';

sendNotification({
  type: 'TRIAL_REMINDER_3_DAYS',
  recipientEmail: 'user@example.com',
  // ... other fields
});
```

#### Prevention

- Monitor cron job execution (alert if not run in 25 hours)
- Add database indexes on `trial_end` and `status` columns
- Log all trial status transitions
- Test trial expiry flow in staging before production

### Email Notification Failures

#### Symptoms

- Users not receiving billing emails
- Admin not receiving failure notifications
- High bounce/rejection rate
- Notifications stuck in `pending` status

#### Diagnosis

1. **Check notification log**

```bash
# Get recent notification failures
psql $DATABASE_URL -c "
  SELECT
    id,
    notification_type,
    recipient_email,
    status,
    error,
    created_at
  FROM billing_notification_log
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND status IN ('failed', 'pending')
  ORDER BY created_at DESC
  LIMIT 20;
"
```

2. **Check Resend API status**

```bash
# Test Resend API connectivity
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $HOSPEDA_RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@hospeda.com.ar",
    "to": "test@example.com",
    "subject": "Test",
    "text": "Test email"
  }'
```

3. **Check retry attempts**

```bash
# Check notification retry count
psql $DATABASE_URL -c "
  SELECT retry_count, COUNT(*)
  FROM billing_notification_log
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY retry_count
  ORDER BY retry_count;
"
```

#### Common Causes

| Cause | Solution |
|-------|----------|
| **Invalid Resend API key** | Verify `HOSPEDA_RESEND_API_KEY` is correct |
| **Invalid sender email** | Verify `HOSPEDA_RESEND_FROM_EMAIL` is verified in Resend |
| **Recipient email bounce** | Remove invalid emails from database |
| **Rate limiting** | Implement exponential backoff, request increase |
| **Template rendering error** | Fix email template syntax |
| **Network timeout** | Increase timeout, implement retry logic |

#### Resolution Steps

1. **Retry failed notifications**

```bash
# Manually retry failed notifications
psql $DATABASE_URL -c "
  UPDATE billing_notification_log
  SET status = 'pending',
      retry_count = 0,
      error = NULL
  WHERE status = 'failed'
    AND retry_count < 3
    AND created_at > NOW() - INTERVAL '24 hours';
"
```

2. **Verify Resend configuration**

```bash
# Check sender email verification
curl https://api.resend.com/domains \
  -H "Authorization: Bearer $HOSPEDA_RESEND_API_KEY"

# Verify domain DNS records if needed
```

3. **Fix invalid recipient emails**

```sql
-- Mark invalid emails
UPDATE billing_notification_log
SET status = 'invalid_email'
WHERE status = 'failed'
  AND error LIKE '%invalid email%';

-- Optionally update customer email status
UPDATE billing_customers
SET email_verified = false
WHERE email IN (
  SELECT DISTINCT recipient_email
  FROM billing_notification_log
  WHERE status = 'invalid_email'
);
```

4. **Purge old notification logs**

```sql
-- Archive notifications older than 90 days
DELETE FROM billing_notification_log
WHERE created_at < NOW() - INTERVAL '90 days'
  AND status IN ('sent', 'invalid_email');
```

#### Prevention

- Monitor notification delivery rate (alert if <90%)
- Implement exponential backoff for retries
- Validate email addresses before sending
- Keep notification templates tested and up to date

## Rollback Procedures

### Emergency API Rollback

If billing system is causing critical issues:

```bash
# 1. Revert to previous deployment
git revert HEAD
pnpm build
pm2 restart hospeda-api

# Or for Vercel
vercel rollback

# 2. Disable billing features temporarily
# Set feature flag or comment out billing routes

# 3. Notify users
# Post status page update
```

### Database Rollback

If database migration caused issues:

```bash
# 1. Restore from backup
pg_restore -d $DATABASE_URL backup_file.dump

# 2. Or manually revert migration
psql $DATABASE_URL < revert_migration.sql

# 3. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM billing_subscriptions;"
```

### MercadoPago Webhook Pause

If webhooks causing issues:

1. Log into MercadoPago dashboard
2. Navigate to Webhooks
3. Disable webhook temporarily
4. Fix issues
5. Re-enable webhook
6. Manually sync missed events

## Escalation Paths

### Level 1: Developer On-Call

- Handle common incidents using this runbook
- Access to production logs and database
- Can apply quick fixes and restarts

### Level 2: Tech Lead

Escalate if:

- Issue requires code changes
- Multiple components affected
- Data integrity concerns
- Security implications

### Level 3: External Support

Contact when:

- **MercadoPago Issues**: [partner-support@mercadopago.com](mailto:partner-support@mercadopago.com)
- **Resend Issues**: [support@resend.com](mailto:support@resend.com)
- **Database Issues**: Database provider support

## Emergency Contacts

- **Tech Lead**: [Contact info]
- **DevOps Lead**: [Contact info]
- **Product Manager**: [Contact info]
- **24/7 On-Call**: [PagerDuty/Opsgenie link]

## Post-Incident Review

After resolving any incident:

1. **Document incident**
   - What happened
   - When it happened
   - Who was affected
   - How it was resolved

2. **Root cause analysis**
   - Why did it happen?
   - Why wasn't it prevented?
   - What failed in our systems?

3. **Action items**
   - Preventive measures
   - Monitoring improvements
   - Documentation updates

4. **Share learnings**
   - Team retrospective
   - Update runbook
   - Update deployment checklist

## Related Documentation

- [Billing Deployment Checklist](/docs/deployment/billing-checklist.md)
- [Billing System Architecture](/packages/billing/README.md)
- [QZPay Documentation](https://github.com/qazuor/qzpay)
- [MercadoPago API Docs](https://www.mercadopago.com.ar/developers/es/docs)
- [Resend API Docs](https://resend.com/docs)

---

**Last Updated**: 2026-02-03
**Version**: 1.0.0
