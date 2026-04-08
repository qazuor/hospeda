# SPEC-027: Webhook Subscription Sync - Progress Report

## Status: COMPLETED

All 20 tasks completed across 5 phases.

## Quality Gate Results

| Check | Result |
|-------|--------|
| Admin typecheck | PASS |
| Notifications typecheck | PASS |
| Schemas typecheck | PASS |
| Admin lint (biome) | PASS |
| Notifications lint | PASS |
| Schemas lint | PASS |
| DB lint | PASS |
| Subscription logic tests | 26/26 PASS |
| Notification tests | 304/304 PASS |
| Schema tests | 1770/1770 PASS |
| i18n types regenerated | 4120 keys |

## Files Created

| File | Purpose |
|------|---------|
| `packages/db/src/schemas/billing/billing_subscription_event.dbschema.ts` | Audit trail table schema |
| `packages/db/src/migrations/0018_perfect_the_fallen.sql` | Migration SQL |
| `packages/schemas/src/api/billing/subscription-event.schema.ts` | Zod schemas for admin API |
| `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` | Status mapping + processSubscriptionUpdated |
| `apps/api/src/routes/billing/admin/subscription-events.ts` | Admin API events endpoint |
| `apps/api/src/schemas/subscription-events.schema.ts` | Route-level Zod schemas |
| `apps/api/test/webhooks/subscription-logic.test.ts` | 26 unit tests |
| `packages/notifications/src/templates/subscription/subscription-cancelled.tsx` | Cancellation email |
| `packages/notifications/src/templates/subscription/subscription-paused.tsx` | Pause email |
| `packages/notifications/src/templates/subscription/subscription-reactivated.tsx` | Reactivation email |
| `packages/notifications/src/templates/subscription/index.ts` | Barrel export |
| `packages/notifications/test/templates/subscription-templates.test.tsx` | 25 template tests |

## Files Modified

| File | Changes |
|------|---------|
| `packages/db/src/schemas/billing/index.ts` | Added subscription event export |
| `packages/schemas/src/api/billing/index.ts` | Added subscription event schema export |
| `packages/notifications/src/types/notification.types.ts` | 3 new notification types + SubscriptionLifecyclePayload |
| `packages/notifications/src/utils/subject-builder.ts` | 3 subject patterns |
| `packages/notifications/src/config/notification-categories.ts` | 3 category mappings |
| `packages/notifications/src/templates/index.ts` | Subscription barrel export |
| `packages/notifications/src/services/notification.service.ts` | 3 selectTemplate cases |
| `apps/api/src/routes/webhooks/mercadopago/subscription-handler.ts` | Rewritten to use processSubscriptionUpdated |
| `apps/api/src/routes/webhooks/mercadopago/notifications.ts` | 3 notification dispatch functions |
| `apps/api/src/cron/jobs/webhook-retry.job.ts` | Split retry logic for subscription events |
| `apps/api/src/routes/billing/admin/index.ts` | Mounted subscription events route |
| `apps/api/src/schemas/index.ts` | Re-exported subscription event schemas |
| `apps/admin/src/features/billing-subscriptions/types.ts` | Added 'paused' status |
| `apps/admin/src/features/billing-subscriptions/utils.ts` | Paused variant + label |
| `apps/admin/src/features/billing-subscriptions/hooks.ts` | useSubscriptionEventsQuery hook |
| `apps/admin/src/features/billing-subscriptions/SubscriptionDetailsDialog.tsx` | Tabs with history timeline |
| `packages/i18n/src/locales/es/admin-billing.json` | Paused + history i18n keys |
| `packages/i18n/src/locales/en/admin-billing.json` | Paused + history i18n keys |
| `packages/i18n/src/locales/pt/admin-billing.json` | Paused + history i18n keys |
| `packages/i18n/src/types.ts` | Regenerated (4120 keys) |

## Key Decisions

1. **Status mapping**: QZPay "canceled" (1L) maps to Hospeda "cancelled" (2L SubscriptionStatusEnum)
2. **Pending status**: Mapped to null (skip processing) since pending is an initial state
3. **Notification pattern**: Fire-and-forget with .catch() for non-blocking delivery
4. **Audit log**: Non-blocking try/catch, failure does not affect main flow
5. **Admin alerts**: Only sent on cancellation (not pause/reactivation)
6. **Lazy loading**: Events query only fires when history tab is active
7. **Template literal i18n**: Cast as TranslationKey for dynamic source keys

## Pending (out of scope)

- DB migration not applied (`pnpm db:migrate`) - requires running database
- 31 pre-existing API test failures unrelated to SPEC-027
