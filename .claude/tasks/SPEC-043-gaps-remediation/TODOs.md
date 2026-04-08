# SPEC-043-GAPS — Addon Lifecycle Events: Gaps Remediation

**Spec**: SPEC-043-GAPS | **Status**: pending | **Total tasks**: 65 | **Avg complexity**: 1.8

---

## Phase Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| `p1-quick-wins` | T-001 to T-006 | Trivial one-line fixes, no deps |
| `p1-code-fixes` | T-007 to T-010 | Half-day fixes (transactions, middleware, notifications) |
| `p1-timeout-tests` | T-011 to T-017 | Timeout, concurrency tests, payment failure lifecycle |
| `p2-notifications` | T-018 to T-022 | Centralized event dispatcher, logger category, notification wiring |
| `p2-code-quality` | T-023 to T-031 | State transitions, constants, locks, feature flags, Result pattern |
| `p2-tests` | T-032 to T-038 | Cache races, graceful degradation, E2E, recovery, audit trail |
| `p2-cron-data` | T-039 to T-045 | Retry backoff, advisory locks, SKIP LOCKED, account deletion |
| `p2-schema-i18n` | T-046 to T-048 | Schema pending status, i18n keys, metrics endpoint |
| `p3-cleanup` | T-049 to T-065 | DB constraints, file splits, template polish, dedup, reconciliation |

---

## Dependency Graph

```
Phase 1 (all parallel — no blockers):
  T-001, T-002, T-003, T-004, T-005, T-006      [p1-quick-wins]
  T-009, T-010, T-011, T-012, T-013, T-014      [p1-code-fixes / p1-timeout-tests]
  T-015                                           [p1-timeout-tests: notification infra]

Phase 1 sequential chains:
  T-001 → T-007                                  [cache clear before transaction work]
  T-004 → T-036, T-042                           [error discrimination fix before tests]
  T-015 → T-016 → T-017                          [payment failure: infra → handler → wire]

Phase 2 (can start after relevant P1):
  T-018                                           [emitLifecycleEvent, no P1 deps]
  T-018 → T-019, T-020, T-021, T-022             [notifications depend on event dispatcher]
  T-008 → T-033                                   [billingLoadFailed → degradation tests]
  T-023 → T-024                                   [transitions → constants]
  T-029 → T-030 → T-034, T-038                   [Result type → refactor → E2E/coverage]
  T-007 → T-032                                   [transaction → cache race tests]
  T-007 + T-008 + T-030 → T-038                  [coverage needs stable implementations]
  T-018 → T-048                                   [metrics depend on event dispatcher]

Phase 3 (after P2 completes relevant tasks):
  T-050 → T-051                                   [batch limit → load test]
  All P3 tasks are otherwise independent of each other
```

---

## Critical Path

The longest sequential dependency chain:

```
T-001 (cache fix)
  → T-007 (transaction)
    → T-032 (cache race tests)
      → T-038 (coverage thresholds)
```

And in parallel:

```
T-029 (Result type definition)
  → T-030 (Result pattern refactor)
    → T-034 (E2E tests with real DB)
```

And for payment failure:

```
T-015 (notification infra)
  → T-016 (webhook handler)
    → T-017 (dispatch wiring)
```

**Start these first** to unblock the longest chains.

---

## Parallel Tracks

### Track A — Backend Fixes (P1, no deps, start immediately)
- [ ] T-001 — clearEntitlementCache in cancel route
- [ ] T-002 — clearEntitlementCache in confirmAddonPurchase
- [ ] T-003 — Subscription status re-check guard
- [ ] T-004 — Fix catch-all customer existence check
- [ ] T-009 — ADDON_EXPIRED notification in expiry cron
- [ ] T-010 — Sentry captures in missing paths
- [ ] T-011 — Promise.race 20s timeout for webhook

### Track B — Tests (P1, no deps, start immediately)
- [ ] T-012 — Concurrent webhook + admin cancellation tests
- [ ] T-013 — Partial failure retry tests
- [ ] T-014 — Reconciliation cron for DB-QZPay split

### Track C — Metadata (trivial, start immediately)
- [ ] T-005 — Update metadata.json status to completed
- [ ] T-006 — Update test count in metadata and state

### Track D — Payment Failure (sequential)
- [ ] T-015 — PAYMENT_RETRY_WARNING notification infrastructure
- [ ] T-016 — payment.failed webhook handler (depends on T-015)
- [ ] T-017 — Wire PAYMENT_RETRY_WARNING dispatch (depends on T-016)

### Track E — Phase 2 Notifications (depends on T-018)
- [ ] T-018 — Create emitLifecycleEvent centralized dispatcher
- [ ] T-019 — addon-lifecycle logger category (depends on T-018)
- [ ] T-020 — ADDON_CANCELLATION notification (depends on T-018)
- [ ] T-021 — ADDON_PURCHASE dispatch (depends on T-018)
- [ ] T-022 — ADDON_RENEWAL_CONFIRMATION wiring (depends on T-018)

### Track F — Code Quality (mostly independent)
- [ ] T-023 — validateAddonStatusTransition function
- [ ] T-024 — Typed status constants (depends on T-023)
- [ ] T-025 — Advisory lock in addon-expiry cron
- [ ] T-026 — HOSPEDA_ADDON_LIFECYCLE_ENABLED feature flag
- [ ] T-027 — Zod safeParse for JSONB reads
- [ ] T-028 — Warning log in resolvePlanBaseLimit
- [ ] T-029 — Define unified LifecycleResult type
- [ ] T-030 — Refactor services to Result pattern (depends on T-029)
- [ ] T-031 — Promise.allSettled in admin cancel

### Track G — Phase 2 Tests
- [ ] T-032 — Cache race condition tests (depends on T-007)
- [ ] T-033 — Graceful degradation tests (depends on T-008)
- [ ] T-034 — E2E tests with real PostgreSQL (depends on T-030)
- [ ] T-035 — Transient failure recovery tests
- [ ] T-036 — Customer-not-found webhook tests (depends on T-004)
- [ ] T-037 — AC-5.x audit trail test assertions
- [ ] T-038 — Coverage thresholds (depends on T-007, T-008, T-030)

### Track H — Cron & Data
- [ ] T-039 — Retry backoff and error classification
- [ ] T-040 — Advisory lock per customer in recalc
- [ ] T-041 — LIMIT 100 and SKIP LOCKED in Phase 4 query
- [ ] T-042 — Verify QZPay status before revoking (depends on T-004)
- [ ] T-043 — One-time addon revocation on account delete
- [ ] T-044 — Fix userId resolution in downgrade notification
- [ ] T-045 — Dedup flag for double recalculation

### Track I — Schema & i18n (independent)
- [ ] T-046 — Add 'pending' to UserAddonResponseSchema
- [ ] T-047 — Add canceled/pending i18n keys
- [ ] T-048 — Lifecycle metrics + admin endpoint (depends on T-018)

### Track J — Phase 3 Cleanup
- [ ] T-049 — Reflect DB CHECK constraint in Drizzle schema
- [ ] T-050 — Batch size limit for expiry query
- [ ] T-051 — Load test with 1000+ addons (depends on T-050)
- [ ] T-052 — CHECK constraint for limitAdjustments JSONB
- [ ] T-053 — Debug logging in clearEntitlementCache
- [ ] T-054 — Grace period CTA in downgrade template
- [ ] T-055 — Extract and map webhook cancel reason
- [ ] T-056 — Verify billing_notification_log schema
- [ ] T-057 — Split addon-plan-change.service.ts
- [ ] T-058 — expect.objectContaining in critical tests
- [ ] T-059 — HTTP 409 for concurrent admin cancel
- [ ] T-060 — Add TRIALING to webhook safety net
- [ ] T-061 — Move promo code usage to confirmAddonPurchase
- [ ] T-062 — Wrap sendNotification in try-catch
- [ ] T-063 — Idempotency key for downgrade warning
- [ ] T-064 — Phase 5 entitlement reconciliation in cron
- [ ] T-065 — Split addon-expiration.service.ts

---

## Full Task Checklist

### p1-quick-wins

- [ ] **T-001** `[1.0]` Add clearEntitlementCache after cancelAddon in route
  - Files: `apps/api/src/routes/billing/addons.ts`
  - Blocks: T-007

- [ ] **T-002** `[1.0]` Add clearEntitlementCache after confirmAddonPurchase insert
  - Files: `apps/api/src/services/addon.checkout.ts`

- [ ] **T-003** `[1.5]` Add subscription status re-check guard in confirmAddonPurchase
  - Files: `apps/api/src/services/addon.checkout.ts`

- [ ] **T-004** `[1.5]` Fix catch-all customer existence check in webhook subscription-logic
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`
  - Blocks: T-036, T-042

- [ ] **T-005** `[0.5]` Update SPEC-043 metadata.json status to completed
  - Files: `.claude/specs/SPEC-043-addon-lifecycle-events/metadata.json`

- [ ] **T-006** `[0.5]` Update test count in SPEC-043 metadata and state
  - Files: `.claude/specs/SPEC-043-addon-lifecycle-events/metadata.json`, `.claude/tasks/SPEC-043-addon-lifecycle-events/state.json`

### p1-code-fixes

- [ ] **T-007** `[2.5]` Wrap cancelUserAddon DB update + recalculation in transaction
  - Files: `apps/api/src/services/addon.user-addons.ts`
  - Blocked by: T-001
  - Blocks: T-032, T-038

- [ ] **T-008** `[2.5]` Add billingLoadFailed flag and 503 response to entitlement middleware
  - Files: `apps/api/src/middlewares/entitlement.ts`
  - Blocks: T-033, T-038

- [ ] **T-009** `[2.0]` Add ADDON_EXPIRED notification dispatch in expiry cron
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`

- [ ] **T-010** `[1.0]` Add Sentry captures in missing error paths
  - Files: `apps/api/src/services/addon-limit-recalculation.service.ts`, `apps/api/src/services/addon.user-addons.ts`

### p1-timeout-tests

- [ ] **T-011** `[2.5]` Add Promise.race 20s timeout for webhook addon lifecycle calls
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`

- [ ] **T-012** `[2.5]` Add concurrent webhook + admin cancellation integration tests
  - Files: `apps/api/test/integration/addon-lifecycle-concurrency.test.ts` (new)

- [ ] **T-013** `[2.0]` Add partial failure retry tests for addon lifecycle cancellation
  - Files: `apps/api/test/services/addon-lifecycle-cancellation.service.test.ts`

- [ ] **T-014** `[2.5]` Add reconciliation cron for DB-QZPay subscription split
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`

- [ ] **T-015** `[2.0]` Add PAYMENT_RETRY_WARNING notification infrastructure
  - Files: `packages/notifications/src/types/notification.types.ts`, `packages/notifications/src/templates/billing/payment-retry-warning.tsx` (new)
  - Blocks: T-016, T-017

- [ ] **T-016** `[2.0]` Add payment.failed webhook handler with failure count tracking
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`
  - Blocked by: T-015
  - Blocks: T-017

- [ ] **T-017** `[1.5]` Wire PAYMENT_RETRY_WARNING dispatch from payment failure handler
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`
  - Blocked by: T-016

### p2-notifications

- [ ] **T-018** `[2.5]` Create emitLifecycleEvent centralized event dispatcher
  - Files: `apps/api/src/services/addon-lifecycle-events.ts` (new)
  - Blocks: T-019, T-020, T-021, T-022, T-048

- [ ] **T-019** `[2.0]` Register addon-lifecycle logger category and replace apiLogger
  - Files: `packages/logger/src/categories.ts`, 6 lifecycle service files
  - Blocked by: T-018

- [ ] **T-020** `[2.5]` Add ADDON_CANCELLATION notification type, template, and dispatch
  - Files: `packages/notifications/src/types/notification.types.ts`, `packages/notifications/src/templates/addon/addon-cancellation.tsx` (new)
  - Blocked by: T-018

- [ ] **T-021** `[1.0]` Add ADDON_PURCHASE notification dispatch in confirmAddonPurchase
  - Files: `apps/api/src/services/addon.checkout.ts`
  - Blocked by: T-018

- [ ] **T-022** `[2.0]` Wire ADDON_RENEWAL_CONFIRMATION dispatch for recurring webhook payments
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`
  - Blocked by: T-018

### p2-code-quality

- [ ] **T-023** `[2.0]` Create validateAddonStatusTransition function
  - Files: `apps/api/src/services/addon-lifecycle.constants.ts` or new `addon-lifecycle.transitions.ts`
  - Blocks: T-024

- [ ] **T-024** `[1.5]` Create typed constants for addon status strings
  - Files: `apps/api/src/services/addon-lifecycle.constants.ts`
  - Blocked by: T-023

- [ ] **T-025** `[1.5]` Add advisory lock in addon-expiry cron job
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`

- [ ] **T-026** `[2.0]` Add HOSPEDA_ADDON_LIFECYCLE_ENABLED feature flag
  - Files: `packages/config/`, `apps/api/src/env.ts`, `apps/api/.env.example`

- [ ] **T-027** `[2.0]` Add Zod safeParse for limitAdjustments JSONB reads
  - Files: `apps/api/src/services/addon-limit-recalculation.service.ts`, `apps/api/src/services/addon-entitlement.service.ts`

- [ ] **T-028** `[1.0]` Add warning log and Sentry when old plan not found in resolvePlanBaseLimit
  - Files: `apps/api/src/services/addon-plan-change.service.ts` or `addon-limit-recalculation.service.ts`

- [ ] **T-029** `[1.5]` Define unified LifecycleResult type
  - Files: `apps/api/src/services/addon-lifecycle.types.ts`
  - Blocks: T-030

- [ ] **T-030** `[2.5]` Refactor lifecycle services to use unified Result pattern
  - Files: 5 lifecycle service files + all callers
  - Blocked by: T-029
  - Blocks: T-034, T-038

- [ ] **T-031** `[1.5]` Replace Promise.all with Promise.allSettled in admin subscription cancel
  - Files: `apps/api/src/routes/billing/admin/subscription-cancel.ts`

### p2-tests

- [ ] **T-032** `[2.5]` Add cache race condition tests for entitlement cache
  - Files: `apps/api/test/services/addon-entitlement.service.test.ts`
  - Blocked by: T-007

- [ ] **T-033** `[2.0]` Add graceful degradation tests for billing service failure
  - Files: `apps/api/test/middlewares/entitlement.test.ts`
  - Blocked by: T-008

- [ ] **T-034** `[2.5]` Create E2E tests with real PostgreSQL for lifecycle flows
  - Files: `apps/api/test/e2e/addon-lifecycle.e2e.test.ts` (new)
  - Blocked by: T-030

- [ ] **T-035** `[2.0]` Add transient failure recovery tests for revoke and removeBySource
  - Files: `apps/api/test/services/addon-entitlement.service.test.ts`

- [ ] **T-036** `[1.5]` Add customer-not-found webhook test with error type discrimination
  - Files: `apps/api/test/webhooks/mercadopago.test.ts`
  - Blocked by: T-004

- [ ] **T-037** `[2.0]` Add AC-5.x audit trail test assertions
  - Files: `apps/api/test/services/addon-lifecycle.service.test.ts`, `apps/api/test/integration/real-user-scenarios.test.ts`

- [ ] **T-038** `[1.5]` Verify and raise coverage thresholds toward 90%
  - Files: `apps/api/vitest.config.ts`, `apps/api/vitest.config.e2e.ts`
  - Blocked by: T-007, T-008, T-030

### p2-cron-data

- [ ] **T-039** `[2.0]` Add retry backoff and error classification in cron
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`, `apps/api/src/services/addon-expiration.service.ts`

- [ ] **T-040** `[1.5]` Add advisory lock per customer in limit recalculation
  - Files: `apps/api/src/services/addon-limit-recalculation.service.ts`

- [ ] **T-041** `[1.5]` Add LIMIT 100 and SKIP LOCKED to cron Phase 4 orphaned addon query
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`

- [ ] **T-042** `[2.0]` Verify QZPay subscription status before revoking addons in Phase 4
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`
  - Blocked by: T-004

- [ ] **T-043** `[2.5]` Add one-time addon revocation flow for account deletion/suspension
  - Files: `apps/api/src/services/addon-lifecycle-cancellation.service.ts`, `apps/api/src/routes/billing/admin/`

- [ ] **T-044** `[1.5]` Fix userId resolution in downgrade notification payload
  - Files: `apps/api/src/services/addon-plan-change.service.ts`

- [ ] **T-045** `[2.0]` Add dedup flag for double limit recalculation prevention
  - Files: `apps/api/src/services/addon-limit-recalculation.service.ts`

### p2-schema-i18n

- [ ] **T-046** `[0.5]` Add 'pending' status to UserAddonResponseSchema
  - Files: `packages/schemas/src/api/billing/customer-addons.schema.ts`

- [ ] **T-047** `[0.5]` Add canceled and pending i18n keys for addon status
  - Files: `packages/i18n/src/locales/es/billing.json`, `en/billing.json`, `pt/billing.json`

- [ ] **T-048** `[2.5]` Add lifecycle metrics emission and admin endpoint
  - Files: `apps/api/src/services/addon-lifecycle-events.ts`, `apps/api/src/services/billing-metrics.service.ts`
  - Blocked by: T-018

### p3-cleanup

- [ ] **T-049** `[1.0]` Reflect DB CHECK constraint in Drizzle schema for addon status
  - Files: `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`

- [ ] **T-050** `[1.5]` Add batch size limit to addon expiry query
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts` or `apps/api/src/services/addon-expiration.service.ts`
  - Blocks: T-051

- [ ] **T-051** `[2.0]` Create load test for addon expiry with 1000+ addons
  - Files: `apps/api/test/load/addon-expiry-load.test.ts` (new)
  - Blocked by: T-050

- [ ] **T-052** `[2.0]` Add CHECK constraint for limitAdjustments JSONB structure
  - Files: `packages/db/src/migrations/` (new migration), `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`

- [ ] **T-053** `[1.0]` Add debug logging to clearEntitlementCache with caller context
  - Files: wherever `clearEntitlementCache` is defined

- [ ] **T-054** `[2.5]` Define grace period policy and add CTA to downgrade warning template
  - Files: `packages/notifications/src/templates/subscription/plan-downgrade-limit-warning.tsx`, `apps/api/src/services/addon-plan-change.service.ts`

- [ ] **T-055** `[2.0]` Extract and map webhook cancel reason to internal enum
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`, `apps/api/src/services/addon-lifecycle.constants.ts`

- [ ] **T-056** `[1.5]` Verify billing_notification_log schema and add to Drizzle if missing
  - Files: `packages/db/src/schemas/billing/` (possibly new file)

- [ ] **T-057** `[2.5]` Split addon-plan-change.service.ts into helpers and downgrade detection
  - Files: `apps/api/src/services/addon-plan-change.helpers.ts` (new), `apps/api/src/services/addon-downgrade-detection.service.ts` (new)

- [ ] **T-058** `[2.0]` Add expect.objectContaining assertions in critical test paths
  - Files: 3 existing test files in `apps/api/test/`

- [ ] **T-059** `[1.0]` Return HTTP 409 for concurrent admin subscription cancel
  - Files: `apps/api/src/routes/billing/admin/subscription-cancel.ts`

- [ ] **T-060** `[0.5]` Add TRIALING status to webhook safety net condition
  - Files: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`

- [ ] **T-061** `[2.0]` Move promo code usage recording to confirmAddonPurchase
  - Files: `apps/api/src/services/addon.checkout.ts`

- [ ] **T-062** `[0.5]` Wrap fire-and-forget sendNotification calls in try-catch
  - Files: audit all sendNotification call sites in `apps/api/`

- [ ] **T-063** `[0.5]` Add idempotency key to downgrade limit warning notification
  - Files: downgrade notification dispatch code in `apps/api/src/services/`

- [ ] **T-064** `[2.5]` Add Phase 5 entitlement reconciliation to cron job
  - Files: `apps/api/src/cron/jobs/addon-expiry.job.ts`

- [ ] **T-065** `[2.5]` Split addon-expiration.service.ts into queries and batch processing files
  - Files: `apps/api/src/services/addon-expiration.queries.ts` (new), `apps/api/src/services/addon-expiration.batch.ts` (new)

---

## Complexity Distribution

| Range | Count | Tasks |
|-------|-------|-------|
| 0.5 | 7 | T-005, T-006, T-046, T-047, T-060, T-062, T-063 |
| 1.0 | 7 | T-001, T-002, T-010, T-021, T-028, T-049, T-053, T-059 |
| 1.5 | 10 | T-003, T-004, T-017, T-024, T-025, T-029, T-031, T-036, T-038, T-040, T-041, T-044, T-050, T-056 |
| 2.0 | 18 | T-009, T-013, T-015, T-016, T-019, T-022, T-023, T-026, T-027, T-033, T-035, T-037, T-039, T-042, T-045, T-051, T-052, T-055, T-058, T-061 |
| 2.5 | 16 | T-007, T-008, T-011, T-012, T-014, T-018, T-020, T-030, T-032, T-034, T-043, T-048, T-054, T-057, T-064, T-065 |

All tasks are at or below the maximum complexity of 2.5.

---

## Notes

- **GAP-043-17 split**: T-015 (infra) + T-016 (handler) + T-017 (dispatch wiring) — max 2.0 each
- **GAP-043-33 split**: T-029 (define type) + T-030 (refactor services) — max 2.5 each
- **GAP-043-15 split**: T-050 (batch limit) + T-051 (load test) — max 2.0 each
- Tasks with no `blockedBy` can all start in parallel from day one
- P3 cleanup tasks are independent of each other and can be distributed across developers
