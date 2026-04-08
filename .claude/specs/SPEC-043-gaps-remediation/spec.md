# SPEC-043 Gaps Remediation

> **Spec ID**: SPEC-043-GAPS
> **Status**: in-progress
> **Created**: 2026-03-17
> **Source**: specs-gaps-043.md (6 audit passes, 71 gaps, 55 to implement)

## Overview

Remediation of gaps found in SPEC-043 (Addon Lifecycle Events) post-implementation audit. 55 gaps marked as HACER, organized into 9 implementation phases by priority and dependency.

## Phase 1: P1 Quick Wins (< 2 hours)

### 1.1 GAP-043-39: clearEntitlementCache in cancelUserAddon route
- Add `clearEntitlementCache(customerId)` in route handler `apps/api/src/routes/billing/addons.ts` after `cancelAddon()` returns
- Complexity: 1/10

### 1.2 GAP-043-61: clearEntitlementCache in confirmAddonPurchase
- Add `clearEntitlementCache(customerId)` in `apps/api/src/services/addon.checkout.ts` after successful insert in `confirmAddonPurchase()`
- Complexity: 1/10

### 1.3 GAP-043-57: Subscription status re-check in confirmAddonPurchase
- Before confirming addon purchase, re-verify `subscription.status !== 'cancelled'`
- Add guard in `confirmAddonPurchase()` in `apps/api/src/services/addon.checkout.ts`
- Complexity: 1.5/10

### 1.4 GAP-043-40: Fix catch-all customer existence check
- In `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` lines 424-450
- Discriminate error type: only 404 = not found, rest propagates as 500
- Complexity: 1.5/10

### 1.5 GAP-043-28: Update metadata.json status
- Update `.claude/specs/SPEC-043-addon-lifecycle-events/metadata.json` status from "draft" to "completed"
- Complexity: 0.5/10

### 1.6 GAP-043-48: Update test count in metadata
- Update metadata.json and state.json with actual test count (~356 tests)
- Complexity: 0.5/10

## Phase 2: P1 Code Fixes (half-day)

### 2.1 GAP-043-29: cancelUserAddon atomicity
- Wrap DB update + recalculation in transaction in `apps/api/src/services/addon.user-addons.ts`
- If recalc fails, rollback the cancel
- Add Sentry capture on recalc failure
- Complexity: 2.5/10

### 2.2 GAP-043-43: billingLoadFailed flag + 503
- Add `billingLoadFailed` flag to entitlement context in `apps/api/src/middlewares/entitlement.ts`
- `requireLimit` middleware returns 503 when `billingLoadFailed` is true
- Complexity: 2.5/10

### 2.3 GAP-043-52: ADDON_EXPIRED notification dispatch
- Add `sendNotification()` with `ADDON_EXPIRED` type in cron expiry loop `apps/api/src/cron/jobs/addon-expiry.job.ts`
- Use idempotency key: `addon_expired:${customerId}:${addonSlug}:${YYYY-MM-DD}`
- Complexity: 2/10

### 2.4 GAP-043-30: Sentry capture in missing paths
- Add `Sentry.captureException()` in `addon-limit-recalculation.service.ts` catch block
- Add `Sentry.captureException()` in `cancelUserAddon()` recalc error path
- Complexity: 1/10

## Phase 3: P1 Timeout & Tests (1-2 days)

### 3.1 GAP-043-03: Promise.race 20s timeout for webhook
- Add Promise.race with 20s timeout in webhook handler for addon lifecycle calls
- If timeout, return 200 and let cron Phase 4 complete
- Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`
- Complexity: 2.5/10

### 3.2 GAP-043-04: Concurrent webhook+admin tests
- Add integration test with Promise.all() for concurrent cancellation
- Verify exactly one succeeds, other detects already-cancelled
- Verify no double-revocation (idempotency)
- Files: `apps/api/test/integration/`
- Complexity: 2.5/10

### 3.3 GAP-043-05: Partial failure retry tests
- Test: 3 addons, #2 fails, verify #1=canceled, #2/#3=active
- Simulate retry: verify #1 skipped, #2 retried, #3 processed
- Files: `apps/api/test/services/addon-lifecycle-cancellation.service.test.ts`
- Complexity: 2/10

### 3.4 GAP-043-42: Reconciliation cron for DB-QZPay split
- Add check in cron job: find subscriptions cancelled in DB but active in QZPay
- Retry QZPay cancel for mismatched subscriptions
- Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`
- Complexity: 2.5/10

### 3.5 GAP-043-17: Payment failure lifecycle handler
- Add webhook handler for `payment.failed` events
- Track failure count in subscription metadata
- After 2nd failure: send PAYMENT_RETRY_WARNING notification
- Create notification type, payload, template
- Complexity: 2.5/10 (per subtask)

## Phase 4: P2 Notifications & Orchestration

### 4.1 GAP-043-54: emitLifecycleEvent centralized function
- Create `emitLifecycleEvent()` with discriminated union for event types
- Dispatches to notification + logging + metrics
- Files: `apps/api/src/services/addon-lifecycle-events.ts` (new)
- Complexity: 2.5/10

### 4.2 GAP-043-55: addon-lifecycle logger category
- Register `addon-lifecycle` category in `packages/logger/src/categories.ts`
- Create `addonLogger = createLogger('addon-lifecycle')`
- Replace apiLogger in 6 addon lifecycle service files
- Complexity: 2/10

### 4.3 GAP-043-01: ADDON_CANCELLATION notification
- Add `ADDON_CANCELLATION` to NotificationType enum
- Create payload interface, React Email template, subject line
- Wire into selectTemplate() and dispatch from cancelUserAddon()
- Complexity: 2.5/10

### 4.4 GAP-043-02: ADDON_PURCHASE dispatch
- Add sendNotification(ADDON_PURCHASE) in confirmAddonPurchase()
- Template already exists, just add dispatch call
- Complexity: 1/10

### 4.5 GAP-043-53: Wire ADDON_RENEWAL_CONFIRMATION
- Identify renewal trigger in webhook (MercadoPago recurring payment)
- Add dispatch call with existing template
- Complexity: 2/10

## Phase 5: P2 Code Quality & Safety

### 5.1 GAP-043-07: State transition validation
- Create `validateAddonStatusTransition(current, target): boolean`
- Valid: pending->active, active->canceled, active->expired, pending->canceled
- Apply before every status update
- Complexity: 2/10

### 5.2 GAP-043-09: canceled/cancelled constants
- Create typed constants: ADDON_STATUS_CANCELED, SUBSCRIPTION_STATUS_CANCELLED
- Replace string literals throughout addon lifecycle code
- Complexity: 1.5/10

### 5.3 GAP-043-10: Advisory lock in cron job
- Add `pg_try_advisory_lock(43001)` at start of addon-expiry.job.ts
- Skip with warning if lock not acquired
- Complexity: 1.5/10

### 5.4 GAP-043-32: Feature flag for addon lifecycle
- Add HOSPEDA_ADDON_LIFECYCLE_ENABLED env var (default: true)
- Guard addon lifecycle calls per phase
- Complexity: 2/10

### 5.5 GAP-043-34: Zod validation on JSONB read
- Add Zod safeParse when reading limitAdjustments from DB
- Log warning and skip on malformed data
- Add tests with null and malformed data
- Complexity: 2/10

### 5.6 GAP-043-45: resolvePlanBaseLimit warning for old plan
- Add apiLogger.warn + Sentry when old plan not found in config
- Complexity: 1/10

### 5.7 GAP-043-33: Standardize Result pattern
- Refactor all 5 lifecycle services to use Result pattern consistently
- Remove throw patterns, always return typed results
- Complexity: 2.5/10

### 5.8 GAP-043-63: Promise.allSettled in admin cancel
- Replace Promise.all() with Promise.allSettled() in subscription-cancel.ts Phase 1
- Map results to expected format
- Complexity: 1.5/10

### 5.9 GAP-043-43 (continued): Verify billingLoadFailed implementation
- (Already in Phase 2, this is the test portion)

## Phase 6: P2 Tests

### 6.1 GAP-043-11: Cache race condition tests
- Test concurrent read+clear race
- Verify behavior between DB update and cache clear
- Complexity: 2.5/10

### 6.2 GAP-043-16: Graceful degradation tests
- 4 tests: billing fails -> plan entitlements only, no addon entitlements, shouldCache=false, retry
- Complexity: 2/10

### 6.3 GAP-043-18: E2E tests with real PostgreSQL
- Create E2E tests for cancellation flow, plan change flow, concurrent operations
- Use vitest.config.e2e.ts
- Complexity: 2.5/10

### 6.4 GAP-043-19: Transient failure recovery tests
- Test primary-fail-fallback-succeed for revoke and removeBySource
- Complexity: 2/10

### 6.5 GAP-043-27: Customer-not-found test
- Test webhook with customer lookup returning null -> 200, log warning
- Test with transient error -> should differ from not-found (linked to GAP-043-40)
- Complexity: 1.5/10

### 6.6 GAP-043-47: AC-5.x audit trail tests
- Add assertions for apiLogger.info and Sentry.captureException in existing tests
- Add test for billingSubscriptionEvents insert
- Complexity: 2/10

### 6.7 GAP-043-46: Coverage thresholds
- Verify current coverage, raise thresholds gradually toward 90%
- Add thresholds to e2e config
- Complexity: 1.5/10

## Phase 7: P2 Cron & Data

### 7.1 GAP-043-24: Retry backoff + error classification
- Add backoff: skip retry if lastAttempt + (retryCount * 2 days) > now()
- Classify errors: retryable vs non-retryable
- Complexity: 2/10

### 7.2 GAP-043-35: Advisory lock per customer in recalc
- Add pg_advisory_xact_lock(hashtext(customerId)) during recalculation
- Complexity: 1.5/10

### 7.3 GAP-043-50: LIMIT 100 in orphaned addon query
- Add LIMIT 100 to cron Phase 4 orphaned purchase query
- Complexity: 1/10

### 7.4 GAP-043-56: SKIP LOCKED in Phase 4
- Add SELECT ... FOR UPDATE SKIP LOCKED in cron Phase 4 query
- Complexity: 1.5/10

### 7.5 GAP-043-58: Verify QZPay status in Phase 4
- Before revoking addons, verify subscription is cancelled in QZPay
- Complexity: 2/10

### 7.6 GAP-043-12: One-time addon revocation on account delete
- Add flow to revoke ALL active purchases when customer suspended/deleted
- Query by customerId regardless of subscriptionId
- Complexity: 2.5/10

### 7.7 GAP-043-60: Verify userId in downgrade notification
- Verify userId resolved in payload, resolve via billing.customers.get if missing
- Complexity: 1.5/10

### 7.8 GAP-043-14: Dedup flag for double recalculation
- Add short-lived dedup via audit log check (< 5 min)
- Complexity: 2/10

## Phase 8: P2/P3 Schema & i18n

### 8.1 GAP-043-67: UserAddonResponseSchema pending
- Add 'pending' to status enum in UserAddonResponseSchema
- Complexity: 0.5/10

### 8.2 GAP-043-68: i18n canceled/pending keys
- Add addons.status.canceled and addons.status.pending to es/en/pt billing.json
- Complexity: 0.5/10

### 8.3 GAP-043-13: Lifecycle metrics
- Add structured metrics emission at key lifecycle points
- Expose via admin/billing/metrics endpoint
- Complexity: 2.5/10

## Phase 9: P3 Cleanup & Polish

### 9.1 GAP-043-06: Drizzle schema align with CHECK
- Reflect existing DB CHECK constraint in Drizzle schema
- Complexity: 1/10

### 9.2 GAP-043-15: Batch size limit + load test
- Add batch size limit (100) and pagination to expiry query
- Create load test with 1000+ addons
- Complexity: 2.5/10

### 9.3 GAP-043-20: CHECK constraint for JSONB
- Add basic CHECK constraint for limitAdjustments/entitlementAdjustments structure
- Complexity: 2/10

### 9.4 GAP-043-21: Cache clear logging
- Add logger.debug with customerId and caller context to clearEntitlementCache
- Complexity: 1/10

### 9.5 GAP-043-22: Downgrade warning CTA + grace period
- Define grace period policy, add CTA to template, add enforcement logic
- Complexity: 2.5/10

### 9.6 GAP-043-23: Webhook cancel reason
- Extract reason from MercadoPago payload, map to internal enum, store in audit log
- Complexity: 2/10

### 9.7 GAP-043-26: billing_notification_log schema
- Verify table origin, add to Drizzle schema if missing, document location
- Complexity: 1.5/10

### 9.8 GAP-043-31: Split addon-plan-change.service.ts
- Extract helpers to addon-plan-change.helpers.ts
- Extract downgrade logic to addon-downgrade-detection.service.ts
- Complexity: 2.5/10

### 9.9 GAP-043-37: toHaveBeenCalledWith in mocks
- Add expect.objectContaining assertions in critical test paths
- Complexity: 2/10

### 9.10 GAP-043-38: HTTP 409 for concurrent admin cancel
- Return 409 Conflict if subscription already cancelled in transaction guard
- Complexity: 1/10

### 9.11 GAP-043-44: TRIALING in safety net
- Expand webhook condition to include TRIALING status
- Complexity: 0.5/10

### 9.12 GAP-043-49: Promo code usage to confirm
- Move promo code usage recording from createAddonCheckout to confirmAddonPurchase
- Complexity: 2/10

### 9.13 GAP-043-51: try-catch for sendNotification
- Wrap fire-and-forget sendNotification in try-catch
- Complexity: 0.5/10

### 9.14 GAP-043-59: Idempotency key for downgrade notification
- Add idempotencyKey with customerId+limitKey+date
- Complexity: 0.5/10

### 9.15 GAP-043-69: Cron Phase 5 entitlement reconciliation
- Add Phase 5 to query entitlementRemovalPending=true and retry removal
- Complexity: 2.5/10

### 9.16 GAP-043-71: Split addon-expiration.service.ts
- Extract queries to addon-expiration.queries.ts
- Extract batch processing to addon-expiration.batch.ts
- Complexity: 2.5/10
