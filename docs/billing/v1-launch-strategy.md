# Billing v1 Launch Strategy

## Overview

This document defines the billing features included in the v1 launch of Hospeda,
deferred features for v2, known limitations, and the launch checklist.

## v1 Scope (Included)

### Trial Management

- 14-day trial for all HOST users on `owner-basico` plan
- Auto-start on registration (via Better Auth user.create hook)
- Trial expiry cron job runs daily at 02:00 UTC
- Reminder notifications at 3 days and 1 day before expiry
- Expired trials are cancelled. Dashboard blocked, listings hidden, data preserved
- Admin can extend trials via `PATCH /api/v1/admin/billing/trial/:subscriptionId/extend`

### Trial Expiry Lifecycle

1. **Trial starts**: User registers as HOST. 14-day trial begins on `owner-basico` plan
2. **Reminders sent**: At 3 days and 1 day before expiry, TRIAL_ENDING_REMINDER notifications are sent
3. **Trial expires**: Subscription status changes from `trialing` to `canceled`
4. **Grace period begins**: There is no additional grace period after trial expiry. The trial IS the grace period
5. **User blocked**: Dashboard is blocked. Accommodation listings are unpublished (hidden from search)
6. **Data retained**: All accommodation data, images, and configuration are preserved. Nothing is deleted
7. **Reactivation**: User can upgrade to a paid plan at any time to restore access and republish listings

### Plan Changes

- Upgrade/downgrade between `owner-basico`, `owner-pro`, `owner-premium`
- Proration handled by QZPay/MercadoPago
- Interval changes (monthly, quarterly, semi-annual, annual)

### Subscription Lifecycle

- Active subscription management
- Cancellation with immediate effect
- Reactivation from canceled state (creates new subscription)
- Reactivation from expired trial (converts to paid plan)

### Payment Processing

- MercadoPago integration via QZPay adapter
- ARS currency (Argentine pesos) as default
- Integer-based monetary values (centavos)
- Webhook processing for payment events (`payment.created`, `subscription_preapproval.updated`)

### Dunning (Payment Failure Recovery)

- 3-day initial grace period on payment failure (`past_due` status)
- Automatic retry schedule: days 1, 3, 5, 7 after failure
- Subscription cancelled after all retries exhausted (day 7)
- Past-due banner shown in frontend with countdown

### Notifications

- Trial ending reminders (3 days, 1 day)
- Trial expired notification
- Renewal reminders (7, 3, 1 days before renewal)
- Add-on expiration warnings (3, 1 days)
- Redis-based retry queue with database fallback
- Idempotency keys prevent duplicate sends
- Notification log retention: 90-day active, 30-day expired grace, then purged

### Promo Codes

- Percentage and fixed-amount discounts
- Usage limits and expiration dates
- Admin CRUD via `/api/v1/admin/billing/promo-codes`

### Add-ons

- Customer add-on subscriptions (e.g., extra listings, featured placement)
- Add-on expiry detection and warnings
- Admin management via `/api/v1/admin/billing/customer-addons`

### Admin Features

- Billing dashboard with metrics
- Subscription event timeline
- Manual trial extension
- Promo code management
- Exchange rate configuration
- Cron job monitoring and manual triggers

## v2 Scope (Deferred)

### Add-on Entitlements Architecture (SPEC-038)

- Formal entitlement system mapping add-ons to feature flags
- Currently using simple plan-based checks. Fine for v1 with 3 plans

### Advanced Dispute Handling

- v1 uses manual dispute resolution (see `docs/billing/dispute-handling-v1.md`)
- v2 will add automated dispute workflows and MercadoPago chargeback integration

### Multi-Currency Support

- v1 is ARS-only (target market is Argentina)
- v2 may add USD/BRL for cross-border hosts

### AFIP Tax Integration (SPEC-028)

- v1 uses manual invoicing
- Hard deadline: 100 active subscribers or Q4 2026, whichever comes first
- See `docs/decisions/ADR-008-afip-deferred-v2.md`

### Properties/Staff Limit Enforcement

- Stubs exist in `apps/api/src/middlewares/limit-enforcement.ts`
- Plan-based limits are defined but not enforced at runtime
- v2 will add hard enforcement with upgrade prompts

### Advanced Analytics

- Revenue forecasting
- Churn prediction
- Cohort analysis

## Known Limitations and Accepted Risks

### Limitation: No Real-Time Webhook Delivery Guarantee

- **Risk**: Webhook delivery from MercadoPago can be delayed
- **Mitigation**: Retry job runs every 30 minutes. Manual sync available via admin panel

### Limitation: Single-Currency Only

- **Risk**: Cannot serve hosts outside Argentina
- **Mitigation**: ARS is sufficient for the Litoral region target market

### Limitation: Manual Invoicing

- **Risk**: AFIP compliance requires electronic invoicing at scale
- **Mitigation**: Manual process viable up to ~100 subscribers. Monitoring threshold in place

### Limitation: No Plan Limit Enforcement

- **Risk**: Users on lower plans could theoretically exceed their quota
- **Mitigation**: Low risk at launch scale. Stubs ready for activation

### Limitation: In-Memory Fallback for Notification Idempotency

- **Risk**: If Redis is unavailable and the server restarts, duplicate notifications could be sent
- **Mitigation**: Database notification log provides secondary dedup. Low impact (extra email)

### Limitation: Trial Has No Grace Period

- **Risk**: Users lose access immediately when trial expires
- **Mitigation**: 3-day and 1-day advance warnings give users time to upgrade. Data is never deleted

## Launch Checklist

### Pre-Launch (Required)

- [ ] MercadoPago production credentials configured (`HOSPEDA_MERCADOPAGO_*`)
- [ ] Webhook endpoint registered in MercadoPago dashboard
- [ ] Redis configured and connected (`HOSPEDA_REDIS_URL`)
- [ ] Billing plans seeded in production (`owner-basico`, `owner-pro`, `owner-premium`)
- [ ] `billing_settings` table populated with production values
- [ ] Cron jobs verified running (trial-expiry, notification-schedule, dunning, webhook-retry, addon-expiry, notification-log-purge)
- [ ] Better Auth secret set (`HOSPEDA_BETTER_AUTH_SECRET`, min 32 chars)
- [ ] Sentry configured for error monitoring
- [ ] Database backups configured
- [ ] Rate limiting configured for billing endpoints
- [ ] CORS origins set for production domains

### Pre-Launch (Recommended)

- [ ] Manual QA checklist completed (see `docs/testing/billing-qa-checklist.md`)
- [ ] E2E test suite passing (see `docs/testing/billing-e2e-checklist.md`)
- [ ] Load testing on billing endpoints
- [ ] Runbook reviewed (see `docs/runbooks/billing-incidents.md`)

### Post-Launch Monitoring

- [ ] Webhook delivery success rate > 99%
- [ ] Trial conversion rate tracking
- [ ] Dunning recovery rate tracking
- [ ] Notification delivery confirmation
- [ ] Error rate < 1% on billing endpoints
- [ ] Monthly review of deferred v2 features priority
