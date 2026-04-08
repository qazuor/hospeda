# SPEC-043 Gaps Analysis: Addon Lifecycle Events

> **Spec**: SPEC-043-addon-lifecycle-events
> **Status**: All 26 tasks marked COMPLETED (100%)
> **Total Tests**: 281 across 11 test files
> **Audit Date**: 2026-03-16 (Pass #1), 2026-03-17 (Pass #2, Pass #3), 2026-03-17 (Pass #4)
> **Audit Passes**: 4

---

## Audit Pass #1 (2026-03-16)

**Scope**: Exhaustive contrast of spec.md + metadata.json against actual implementation code, test coverage, DB schema, notifications, i18n, and billing configuration.

**Methodology**: 5 specialized agents analyzed in parallel:
1. Spec reader (full spec + tasks + metadata)
2. Code analyzer (13 source files, all services/routes/middleware)
3. Test analyzer (11 test files, 281 test blocks)
4. DB/Notifications/i18n analyzer (schema, templates, locales, billing config)
5. Implementation verifier (10 targeted pattern searches)

---

## Summary Matrix

| Area | Implementation | Tests | Gaps Found |
|------|---------------|-------|------------|
| Flow A (Subscription Cancellation) | COMPLETE | 31 unit + 8 integration | 4 gaps |
| Flow B (Plan Change Recalculation) | COMPLETE | 30 unit + 9 integration | 3 gaps |
| AC-3.9 (Individual Addon Cancel) | COMPLETE | 18 unit | 2 gaps |
| Admin Route (Two-Phase Cancel) | COMPLETE | 20 unit | 2 gaps |
| Cron Job (Expiry + Retry) | COMPLETE | 25 unit | 3 gaps |
| Entitlement Middleware | COMPLETE | 63 unit | 2 gaps |
| Notifications | MOSTLY COMPLETE | Indirect | 3 gaps |
| DB Schema | COMPLETE | N/A | 2 gaps |
| i18n | PARTIALLY COMPLETE | N/A | 2 gaps |
| Cross-cutting concerns | PARTIAL | 0 dedicated | 5 gaps |

**Total Gaps Found**: 28

---

## GAP-043-01: No ADDON_CANCELLATION Notification Type

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Missing Feature
- **Decisión**: HACER — Agregar notificación de cancelación de addon (enum, template, subject, dispatch)
- **Fecha decisión**: 2026-03-17

**Description**: When a user cancels an individual addon via `cancelUserAddon()`, no notification is sent. The spec defines notifications for expiration warnings, expiry, renewal, and plan downgrade limits.. but NOT for explicit user-initiated addon cancellation. Users get no email confirmation that their addon was cancelled.

**Evidence**:
- `cancelUserAddon()` in `addon.user-addons.ts` updates DB status but has no notification dispatch
- `NotificationType` enum has no `ADDON_CANCELLATION` value
- No template exists for addon cancellation confirmation

**Proposed Solution**:
1. Add `ADDON_CANCELLATION = 'addon_cancellation'` to `NotificationType` enum
2. Create `AddonCancellationPayload` interface
3. Create React Email template `addon-cancellation.tsx`
4. Wire into `selectTemplate()` and `subject-builder.ts`
5. Dispatch fire-and-forget from `cancelUserAddon()` after DB update

**Recommendation**: New SPEC not needed. Can be added as a follow-up task to SPEC-043 or as a standalone task. Low risk, high UX value.

---

## GAP-043-02: No ADDON_PURCHASE Confirmation Notification

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 1/10 (reducida — template ya existe, solo falta dispatch)
- **Category**: Missing Feature
- **Decisión**: HACER — Agregar llamada sendNotification(ADDON_PURCHASE) en confirmAddonPurchase() (1 línea)
- **Fecha decisión**: 2026-03-17

**Description**: When a user completes an addon purchase via `confirmAddonPurchase()`, no purchase confirmation notification is sent. The `ADDON_PURCHASE` type exists in the enum, but no template or dispatch code exists.

**Evidence**:
- `NotificationType.ADDON_PURCHASE` defined in `notification.types.ts`
- No `case 'addon_purchase':` in `selectTemplate()` switch
- No template file for addon purchase confirmation
- `confirmAddonPurchase()` in `addon.checkout.ts` has no notification dispatch

**Proposed Solution**:
1. Create `AddonPurchaseConfirmationPayload` interface (addonName, amount, currency, expiresAt)
2. Create React Email template `addon-purchase-confirmation.tsx`
3. Add case to `selectTemplate()` switch
4. Add subject line to `subject-builder.ts`
5. Dispatch from `confirmAddonPurchase()` after successful DB insert

**Recommendation**: Standalone task. Critical for user trust (payment confirmation). P2 because MercadoPago sends its own payment receipt, but our branded confirmation adds value.

---

## GAP-043-03: 22-Second Webhook Timeout Not Enforced

- **Audit**: Pass #1
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 5/10
- **Category**: Spec vs Implementation Mismatch
- **Decisión**: HACER Opción A — Promise.race con 20s timeout en webhook handler. Si timeout, retornar 200 y dejar que cron Phase 4 complete lo pendiente.
- **Fecha decisión**: 2026-03-17

**Description**: The spec explicitly states a 22-second webhook timeout constraint (MercadoPago will timeout and retry). The implementation logs a warning at >15 seconds but does NOT enforce the 22s hard timeout. A slow addon revocation batch could exceed 22s, causing MercadoPago to retry while the original request is still processing.

**Evidence**:
- `addon-lifecycle-cancellation.service.ts`: logs `elapsedMs` warning at >15s but no AbortController or timeout mechanism
- `subscription-logic.ts`: no request-level timeout enforcement
- All 11 test files: ZERO tests for 22-second timeout behavior
- Spec metadata (audit-v7 fix #11): "Added 22-second webhook timeout constraint"

**Proposed Solution**:

Option A (Recommended): Add timeout wrapper at webhook handler level
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000); // 20s safety margin
try {
  await handleSubscriptionCancellationAddons({ ...input, signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

Option B: Defer long-running revocations to background job
- Webhook handler marks subscription as `cancelling`, returns 200
- Background job (or cron Phase 4) picks up and processes revocations
- More resilient but adds complexity and delay

**Recommendation**: Formal SPEC needed (small). The timeout constraint affects error handling semantics across multiple files. Option A is simpler but may leave partial state. Option B is more robust. Needs architectural decision.

---

## GAP-043-04: Race Condition Between Webhook and Admin Cancellation Not Tested

- **Audit**: Pass #1
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 6/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Agregar tests de integración con Promise.all() para concurrencia webhook+admin, verificar idempotencia y no double-revocation.
- **Fecha decisión**: 2026-03-17

**Description**: The spec (audit-v7 fix #10) explicitly added a "concurrency strategy for webhook+admin race condition." The admin route has a race-condition guard (re-checks subscription status inside transaction). However, there are ZERO tests that simulate concurrent webhook + admin cancellation on the same subscription.

**Evidence**:
- `subscription-cancel.ts` (admin route): has race-condition guard at Phase 2
- `subscription-logic.ts` (webhook): has race-condition guard via status check
- `subscription-cancel.test.ts`: tests race guard with pre-set cancelled status, but NOT concurrent execution
- `addon-lifecycle-cancellation.test.ts` (integration): no concurrent scenario

**Proposed Solution**:
1. Add integration test that fires admin cancel + webhook cancel concurrently via `Promise.all()`
2. Verify: exactly one succeeds with full addon revocation, the other detects already-cancelled and skips
3. Verify: no double-revocation of addons (idempotency)
4. Verify: no orphaned state (all addons marked `canceled`)

**Recommendation**: Direct fix. Add integration tests. No new SPEC needed. Critical for production safety.

---

## GAP-043-05: Partial Failure Rollback Semantics Unclear

- **Audit**: Pass #1
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 4/10
- **Category**: Spec Ambiguity
- **Decisión**: HACER — Agregar tests de retry con estados mixtos (3 addons, #2 falla, retry verifica skip de #1) + documentar patrón en spec.
- **Fecha decisión**: 2026-03-17

**Description**: When processing multiple addon revocations in `handleSubscriptionCancellationAddons()`, if addon #2 of 3 fails, the function throws (causing webhook 500 + retry). Addon #1 was already marked `canceled` in DB. On retry, addon #1 is skipped (already canceled), addon #2 is retried. This is CORRECT behavior. However, the spec doesn't explicitly document this "partial progress preservation" pattern as a requirement, and tests verify individual outcomes but don't verify the RETRY scenario with mixed states.

**Evidence**:
- `addon-lifecycle-cancellation.service.ts`: sequential processing, per-addon DB commit, throw on any failure
- `addon-lifecycle-cancellation.service.test.ts`: tests partial failure but not the SUBSEQUENT retry with mixed states
- Spec mentions "metadata retry tracking" but doesn't specify the mixed-state retry flow

**Proposed Solution**:
1. Add explicit test: Process 3 addons, #2 fails, verify #1 is `canceled`, #2 and #3 are `active`
2. Simulate retry: Call again, verify #1 is skipped (already `canceled`), #2 retried, #3 processed
3. Document the partial-progress pattern in spec acceptance criteria

**Recommendation**: Direct fix. Add tests + spec clarification. No new SPEC needed.

---

## GAP-043-06: Addon Status is VARCHAR Without DB-Level Constraint

- **Audit**: Pass #1
- **Severity**: LOW (downgraded — CHECK exists in migration 0025)
- **Priority**: P3
- **Complexity**: 0/10
- **Category**: Schema Weakness
- **Decisión**: HACER — Alinear Drizzle schema con CHECK existente en DB. Incluir en SPEC-044.
- **Fecha decisión**: 2026-03-17

**Description**: `billing_addon_purchases.status` is `VARCHAR(50)` with no CHECK constraint or PostgreSQL enum. Valid states (`pending`, `active`, `expired`, `canceled`) are enforced only at application level. A bug or migration error could insert invalid states like `ACTIVE` (wrong case) or `cancellled` (typo).

**Evidence**:
- `billing_addon_purchase.dbschema.ts`: `status: varchar('status', { length: 50 }).default('pending')`
- No CHECK constraint in schema or migrations
- Spec metadata (audit-v7 fix #12): documents spelling disambiguation but doesn't enforce at DB level

**Proposed Solution**:

Option A: Add CHECK constraint via migration
```sql
ALTER TABLE billing_addon_purchases
  ADD CONSTRAINT chk_addon_purchase_status
  CHECK (status IN ('pending', 'active', 'expired', 'canceled'));
```

Option B: Use Drizzle `pgEnum` for type-safe status
```typescript
const addonPurchaseStatusEnum = pgEnum('addon_purchase_status', ['pending', 'active', 'expired', 'canceled']);
```

**Recommendation**: Can be included in SPEC-044 (Addon Purchase Schema Cleanup) which is already a dependency. Option A is simpler and backward-compatible.

---

## GAP-043-07: No State Transition Validation

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Missing Validation
- **Decisión**: HACER — Crear validateAddonStatusTransition() con transiciones válidas. Tarea directa (no SPEC-044).
- **Fecha decisión**: 2026-03-17

**Description**: The DB allows any status transition (e.g., `expired` -> `active`, `canceled` -> `pending`). Business logic handles transitions correctly in practice, but there's no guard preventing invalid transitions. A bug in a new feature could corrupt purchase state.

**Evidence**:
- No transition validation function in any addon service
- `addon-lifecycle-cancellation.service.ts` sets `status='canceled'` without checking current status
- `addon-expiry.job.ts` sets `status='expired'` without checking current status
- Only the admin route checks `subscription.status !== 'cancelled'` (not addon purchase status)

**Proposed Solution**:
1. Create `validateAddonStatusTransition(current: AddonStatus, target: AddonStatus): boolean`
2. Valid transitions: `pending->active`, `active->canceled`, `active->expired`, `pending->canceled`
3. Apply before every status update in services
4. Throw `InvalidStateTransitionError` on violation

**Recommendation**: Include in SPEC-044 (schema cleanup). Low effort, high safety.

---

## GAP-043-08: Notification Email Templates Not Internationalized

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 5/10
- **Category**: i18n Gap
- **Decisión**: HACER EN NUEVA SPEC FORMAL — Cross-cutting i18n para todos los templates de notificación (no solo addon). Crear spec cuando se expanda a mercados no-hispanos.
- **Fecha decisión**: 2026-03-17

**Description**: Addon notification email templates (`AddonExpirationWarning`, `AddonExpired`, `AddonRenewalConfirmation`, `PlanDowngradeLimitWarning`) have hardcoded Spanish text. Subject lines in `subject-builder.ts` are also hardcoded in Spanish. The i18n locale files (`billing.json`) lack notification-specific keys for addon lifecycle emails.

**Evidence**:
- `templates/addon/addon-expiration-warning.tsx`: hardcoded "Tu complemento {name} est por vencer"
- `templates/subscription/plan-downgrade-limit-warning.tsx`: hardcoded Spanish
- `subject-builder.ts`: hardcoded Spanish subjects
- `packages/i18n/src/locales/*/billing.json`: no `notifications.addon*` keys in any locale
- EN and PT locales have same gap

**Proposed Solution**:
1. Add i18n keys to `billing.json` for all addon notification subjects and body text
2. Pass locale to email templates (requires `NotificationService.send()` to accept locale)
3. Use t() function or template interpolation in React Email components

**Recommendation**: Separate SPEC. This is a cross-cutting i18n concern that affects ALL notification templates, not just addon ones. Should be addressed holistically.

---

## GAP-043-09: `canceled` vs `cancelled` Spelling Inconsistency

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Code Quality
- **Decisión**: HACER — Tarea directa. Crear constantes tipadas y reemplazar string literals.
- **Fecha decisión**: 2026-03-17

**Description**: The spec (audit-v7 fix #12) documents the spelling disambiguation: `billing_addon_purchases.status = 'canceled'` (American, 1 L) vs `billing_subscriptions.status = 'cancelled'` (British, 2 L's). This is documented but creates a gotcha for developers. New code could easily use the wrong spelling.

**Evidence**:
- `addon-lifecycle-cancellation.service.ts`: uses `'canceled'` for addon status
- `subscription-cancel.ts`: uses `'cancelled'` for subscription status
- Spec metadata has disambiguation table
- CLAUDE.md documents this as a gotcha

**Proposed Solution**:
1. Create typed constants: `ADDON_STATUS_CANCELED = 'canceled' as const`
2. Create typed constants: `SUBSCRIPTION_STATUS_CANCELLED = 'cancelled' as const`
3. Use constants everywhere instead of string literals
4. Add lint rule or Zod validation to catch wrong spelling

**Recommendation**: Include in SPEC-044 (schema cleanup). Minimal effort.

---

## GAP-043-10: No Test for Cron Job Overlapping Execution

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Agregar pg_try_advisory_lock(43001) al inicio del job. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: The addon-expiry cron job runs daily. If execution takes longer than expected (many expirations + retries), the next scheduled run could overlap. No test or guard prevents concurrent execution of the same cron job.

**Evidence**:
- `addon-expiry.job.ts`: no mutex, lock, or overlap guard
- `addon-expiry.test.ts`: no overlapping execution test
- Cron registry (`registry.ts`): no built-in overlap prevention

**Proposed Solution**:

Option A: Add advisory lock in cron job
```typescript
const lockAcquired = await db.execute(sql`SELECT pg_try_advisory_lock(43001)`);
if (!lockAcquired) { logger.warn('Skipping: previous run still active'); return; }
try { /* ... */ } finally { await db.execute(sql`SELECT pg_advisory_unlock(43001)`); }
```

Option B: Add `running` flag to cron registry (simpler, less robust)

**Recommendation**: Direct fix. No new SPEC needed. Option A is production-grade.

---

## GAP-043-11: Cache Invalidation Race Condition Not Tested

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 5/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Agregar tests de race condition del cache. Aceptar TTL 5min como mitigación para multi-instancia. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: `clearEntitlementCache(customerId)` is called after addon state changes. But if a concurrent request reads the cache BETWEEN the DB write and the cache clear, it gets stale entitlements. The 5-minute TTL mitigates this, but for the window between DB update and cache clear, users could access features they no longer have (or be denied features they just purchased).

**Evidence**:
- `entitlement.ts`: FIFO cache with 5-minute TTL
- All lifecycle services call `clearEntitlementCache()` AFTER DB updates
- `entitlement.test.ts`: 63 tests but none test concurrent read+clear race
- No test verifies cache state between DB update and cache clear

**Proposed Solution**:
1. Add integration test: Start addon cancellation, inject delay between DB write and cache clear, verify concurrent entitlement check returns correct result
2. Consider: clear cache BEFORE DB write (pre-invalidation) to prevent stale reads
3. Alternative: use versioned cache keys (incrementing version on write)

**Recommendation**: Direct fix for tests. Architecture change (pre-invalidation) needs team discussion.

---

## GAP-043-12: Missing `subscriptionId` NULL Handling in Edge Cases

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Edge Case
- **Decisión**: HACER — Tarea directa. Agregar revocación a nivel de cuenta para one-time addons cuando customer se suspende/elimina.
- **Fecha decisión**: 2026-03-17

**Description**: The spec (audit-v7 fix #17) documents that `subscriptionId` can be NULL for one-time addon purchases. The cancellation flow queries by `subscriptionId`, which would miss one-time purchases that don't have a subscription link. While one-time addons expire naturally (via `expiresAt`), if a customer's account is deleted or suspended, their one-time addon entitlements would NOT be revoked.

**Evidence**:
- `billing_addon_purchase.dbschema.ts`: `subscriptionId` is nullable
- `addon-lifecycle-cancellation.service.ts`: queries `WHERE subscriptionId = ?` (misses NULL entries)
- No handling for account deletion/suspension of one-time addon holders
- Cron job Phase 4 only handles orphaned subscription addons

**Proposed Solution**:
1. Add a separate flow for account-level addon revocation (not subscription-level)
2. When customer account is suspended/deleted, query ALL active purchases (regardless of subscriptionId)
3. Revoke all entitlements and limits for customer
4. Add Cron Phase 5: check for active purchases where customer is deleted/suspended

**Recommendation**: New SPEC recommended. This is an account lifecycle concern that goes beyond subscription cancellation. Low urgency (edge case for account deletion).

---

## GAP-043-13: No Monitoring/Alerting for Addon Lifecycle Failures

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Observability Gap
- **Decisión**: HACER — Tarea directa. Agregar métricas estructuradas en puntos clave y exponer vía endpoint admin/billing/metrics.
- **Fecha decisión**: 2026-03-17

**Description**: While Sentry is used for error reporting, there are no structured metrics or alerting for addon lifecycle health. Key metrics like revocation success rate, average processing time, retry frequency, and cache hit rate are logged but not tracked as metrics.

**Evidence**:
- `addon-lifecycle-cancellation.service.ts`: logs `elapsedMs` but no metric emission
- `addon-plan-change.service.ts`: logs results but no metric
- `entitlement.ts`: has `getEntitlementCacheStats()` but it's not exported to a metrics endpoint
- `addon-expiry.job.ts`: logs retry counts but no metric aggregation
- No Prometheus/StatsD/custom metrics for addon lifecycle

**Proposed Solution**:
1. Add structured metrics emission at key points:
   - `addon.revocation.duration_ms` (histogram)
   - `addon.revocation.outcome` (counter: success/failed)
   - `addon.recalculation.duration_ms` (histogram)
   - `addon.cache.hit_rate` (gauge)
   - `addon.expiry.retry_count` (counter)
2. Expose via `/api/v1/admin/billing/metrics` endpoint (already exists for billing metrics)

**Recommendation**: Standalone task. Not critical for launch but important for production visibility.

---

## GAP-043-14: Plan Change Webhook Safety Net Could Cause Double Recalculation

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 3/10
- **Category**: Redundancy Risk
- **Decisión**: HACER — Tarea directa. Agregar dedup flag (short-lived audit log check) para evitar doble recalculación.
- **Fecha decisión**: 2026-03-17

**Description**: The spec defines the plan change route as the PRIMARY trigger (AC-3.8) and the webhook as a SECONDARY safety net (AC-3.7). Both call `handlePlanChangeAddonRecalculation()`. If the route succeeds AND the webhook also detects a planId change, limits are recalculated twice. The recalculation is idempotent (same result), but it wastes billing API calls.

**Evidence**:
- `plan-change.ts`: calls `handlePlanChangeAddonRecalculation()` after `changePlan()`
- `subscription-logic.ts` (Step 5b): calls same function if planId differs
- Spec says "safety net only" but no deduplication mechanism

**Proposed Solution**:

Option A: Add a short-lived dedup flag
```typescript
// After primary recalc in plan-change.ts:
await db.insert(billingAuditLog).values({
  action: 'addon_limits_recalculated',
  customerId, metadata: { oldPlanId, newPlanId, timestamp: Date.now() }
});

// In webhook safety net:
const recentRecalc = await db.query.billingAuditLog.findFirst({
  where: and(eq(action, 'addon_limits_recalculated'), eq(customerId, x), gt(createdAt, subMinutes(now(), 5)))
});
if (recentRecalc) { logger.info('Skipping: recently recalculated'); return; }
```

Option B: Accept double recalculation (idempotent, just wastes API calls)

**Recommendation**: Accept as-is (Option B) for now. The safety net is intentionally redundant. Add dedup only if billing API rate limits become a concern.

---

## GAP-043-15: No Load/Stress Test for Batch Addon Expirations

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 5/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Tarea directa. Agregar batch size limit (100), paginación, y load test con 1000+ addons.
- **Fecha decisión**: 2026-03-17

**Description**: The cron job processes expired addons sequentially. If 1000+ addons expire on the same day (e.g., after a promotional campaign), the job could take very long, potentially overlapping with the next scheduled run or causing memory issues.

**Evidence**:
- `addon-expiry.job.ts`: processes all expired addons in a single loop
- No pagination or batch size limit
- No load test or stress test
- 25 unit tests but all use small datasets (1-5 addons)

**Proposed Solution**:
1. Add batch size limit (e.g., process max 100 per run, continue next run)
2. Add pagination to expiry query
3. Create load test with 1000+ expired addons
4. Monitor memory and timing

**Recommendation**: Standalone task. Not critical unless promotional campaigns are planned.

---

## GAP-043-16: Entitlement Middleware Graceful Degradation Not Fully Tested

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Tarea directa. Agregar 4 tests de degradación (plan entitlements sin addon, shouldCache=false, retry sin cache).
- **Fecha decisión**: 2026-03-17

**Description**: The entitlement middleware has a graceful degradation path: if customer-level QZPay calls fail, it returns plan-only entitlements with `shouldCache=false`. This is a critical resilience feature but tests only verify the happy path and error logging, not the degraded behavior (user gets plan entitlements but NOT addon entitlements during outage).

**Evidence**:
- `entitlement.ts`: graceful degradation logic exists
- `entitlement.test.ts`: tests billing errors but doesn't verify degraded entitlement set content
- No test verifies: "billing.limits fails -> user still has plan entitlements but NOT addon limits"

**Proposed Solution**:
1. Add test: mock `billing.limits.getByCustomerId()` to throw, verify user gets plan-level entitlements
2. Add test: verify addon-granted entitlements are NOT in degraded set
3. Add test: verify `shouldCache=false` on degraded response
4. Add test: verify next request retries (not cached)

**Recommendation**: Direct fix. Add tests. No new SPEC needed.

---

## GAP-043-17: MercadoPago Auto-Cancellation After 3 Failed Payments Not Handled

- **Audit**: Pass #1
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 5/10
- **Category**: Missing Flow
- **Decisión**: HACER — Tarea directa. Handler para payment.failed, tracking de failure count, notificación PAYMENT_RETRY_WARNING tras 2do fallo.
- **Fecha decisión**: 2026-03-17

**Description**: The spec (audit-v7 fix #18) documents that MercadoPago auto-cancels subscriptions after 3 failed payments. This triggers a `subscription_preapproval.updated` webhook with status=cancelled. The webhook handler processes this correctly (Flow A triggers). However, there's no proactive handling: no notification to the user warning about failed payments before auto-cancellation, and no grace period logic.

**Evidence**:
- Spec metadata documents MercadoPago's auto-cancellation behavior
- Webhook handler handles `cancelled` status correctly
- No `PAYMENT_FAILED` or `PAYMENT_RETRY_WARNING` notification type
- No logic to detect "2 of 3 failed" state and warn user
- MercadoPago sends its own payment failure emails, but they may not explain addon impact

**Proposed Solution**:
1. Add webhook handler for `payment.failed` events (if MercadoPago sends them)
2. Track payment failure count in subscription metadata
3. After 2nd failure: send `PAYMENT_RETRY_WARNING` notification explaining addon impact
4. This gives users a chance to update payment method before auto-cancellation

**Recommendation**: New SPEC recommended. This is a payment lifecycle concern beyond SPEC-043 scope. Medium urgency.. user experience impact.

---

## GAP-043-18: Integration Tests Use Mocks, Not Real DB

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 6/10
- **Category**: Test Quality
- **Decisión**: HACER — Tarea directa. Crear tests E2E con PostgreSQL real (cancelación, plan change, concurrencia).
- **Fecha decisión**: 2026-03-17

**Description**: The "integration" tests (`addon-lifecycle-cancellation.test.ts`, `addon-lifecycle-plan-change.test.ts`) mock the database and billing service. They test orchestration logic but NOT actual DB transactions, index behavior, or constraint enforcement. True integration tests with a real PostgreSQL instance would catch issues like index misses, transaction isolation bugs, or constraint violations.

**Evidence**:
- `addon-lifecycle-cancellation.test.ts`: mocks `getDb()`, `billing.*`
- `addon-lifecycle-plan-change.test.ts`: mocks `getDb()`, `billing.*`
- No `vitest.config.e2e.ts` test suite for addon lifecycle
- `apps/api/vitest.config.e2e.ts` exists but no addon lifecycle E2E tests in it

**Proposed Solution**:
1. Create true E2E tests using `vitest.config.e2e.ts` with real PostgreSQL
2. Test actual DB transactions, index hits, constraint enforcement
3. Test concurrent operations with real connection pooling
4. Minimum scenarios: full cancellation flow, full plan change flow, concurrent operations

**Recommendation**: Standalone task. Important for production confidence but high effort. Can be deferred to post-launch.

---

## GAP-043-19: Billing Service Transient Failure Recovery Not Tested

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Tarea directa. Agregar tests de primary-fail-fallback-succeed para revoke y removeBySource.
- **Fecha decisión**: 2026-03-17

**Description**: QZPay billing service calls can fail transiently (5xx, network timeout, connection reset). The code has fallback strategies (primary + fallback in `revokeAddonForSubscriptionCancellation()`), but tests only verify permanent failures, not transient-then-success patterns.

**Evidence**:
- `addon-lifecycle.service.ts`: has primary + fallback revocation strategy
- `addon-lifecycle.service.test.ts`: tests both-fail scenario but not first-fail-second-succeed
- No test for: primary fails with timeout, fallback succeeds
- No circuit breaker pattern for repeated billing failures

**Proposed Solution**:
1. Add test: primary `billing.entitlements.revoke()` throws timeout, fallback succeeds
2. Add test: primary `billing.limits.removeBySource()` throws 503, fallback succeeds
3. Consider adding circuit breaker for billing service calls (separate concern)

**Recommendation**: Direct fix for tests. Circuit breaker is a separate SPEC.

---

## GAP-043-20: `limitAdjustments` and `entitlementAdjustments` JSON Not Schema-Validated at DB Level

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 3/10
- **Category**: Schema Weakness
- **Decisión**: HACER — Tarea directa. Agregar CHECK constraint básico para estructura JSON.
- **Fecha decisión**: 2026-03-17

**Description**: `billing_addon_purchases.limitAdjustments` and `entitlementAdjustments` are JSONB columns. Their structure is validated by Zod at application level (`addonAdjustmentSchema`), but nothing prevents direct SQL inserts with invalid JSON structure.

**Evidence**:
- `billing_addon_purchase.dbschema.ts`: `limitAdjustments: jsonb('limit_adjustments')`
- Zod validation in `addon.types.ts`: `addonAdjustmentSchema`
- No PostgreSQL JSON schema validation (CHECK constraint with `jsonb_typeof`)
- Migration scripts could insert invalid data

**Proposed Solution**:
1. Add CHECK constraint for basic structure validation
2. Or accept current approach (Zod at app level is sufficient for controlled inserts)

**Recommendation**: Accept as-is. Zod validation at application level is the project convention. DB-level JSON validation adds complexity for marginal benefit.

---

## GAP-043-21: No Audit Trail for Entitlement Cache Clears

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Observability Gap
- **Decisión**: HACER — Tarea directa. Agregar logger.debug con customerId y caller context.
- **Fecha decisión**: 2026-03-17

**Description**: `clearEntitlementCache(customerId)` is called frequently (after every addon state change) but leaves no audit trail. In debugging production issues, it's impossible to know when and why a customer's cache was cleared.

**Evidence**:
- `entitlement.ts`: `clearEntitlementCache()` has no logging
- Called from 6+ locations across addon lifecycle services
- No way to trace cache clear events in logs

**Proposed Solution**:
1. Add debug-level log: `logger.debug({ customerId, caller }, 'Entitlement cache cleared')`
2. Pass caller context to `clearEntitlementCache(customerId, reason: string)`

**Recommendation**: Direct fix. Trivial change.

---

## GAP-043-22: Plan Downgrade Limit Warning Has No User Action Path

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 4/10
- **Category**: UX Gap
- **Decisión**: HACER — Tarea directa. Definir grace period policy, agregar CTA al template, agregar enforcement logic.
- **Fecha decisión**: 2026-03-17

**Description**: The `PLAN_DOWNGRADE_LIMIT_WARNING` notification tells the user their limit decreased and current usage exceeds the new limit. But the email doesn't explain what happens next (are features disabled? is there a grace period?) and doesn't provide a clear CTA (upgrade back? remove items?).

**Evidence**:
- `plan-downgrade-limit-warning.tsx`: shows limit numbers but no action guidance
- No grace period logic for over-limit users after downgrade
- No enforcement: user keeps over-limit resources until next check

**Proposed Solution**:
1. Add actionable CTA to email template (e.g., "Upgrade your plan" or "Remove excess items")
2. Define grace period policy: how long can user keep over-limit resources?
3. Add enforcement logic after grace period (soft-block or hard-block)

**Recommendation**: New SPEC needed. This is a product decision (grace period policy) that needs stakeholder input.

---

## GAP-043-23: Missing `reason` Field in Webhook Cancellation Flow

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Data Gap
- **Decisión**: HACER — Tarea directa. Extraer razón de payload MercadoPago, mapear a enum interno, guardar en audit log.
- **Fecha decisión**: 2026-03-17

**Description**: The admin cancellation route accepts an optional `reason` field and stores it in the audit log. The webhook cancellation flow does NOT capture or store a reason. This makes it harder to distinguish between auto-cancellation (MercadoPago 3 failed payments) vs user-initiated cancellation via MercadoPago dashboard.

**Evidence**:
- `subscription-cancel.ts` (admin): accepts `body.reason`, stores in audit log
- `subscription-logic.ts` (webhook): no reason field, audit log has no cancellation reason
- MercadoPago webhook payload may include cancellation reason but it's not extracted

**Proposed Solution**:
1. Extract cancellation reason from MercadoPago webhook payload (if available)
2. Map to internal enum: `auto_payment_failure`, `user_initiated`, `admin_initiated`, `unknown`
3. Store in audit log metadata

**Recommendation**: Direct fix. Low effort, high value for customer support debugging.

---

## GAP-043-24: No Retry Backoff Strategy for Cron Phase 4

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Missing Feature
- **Decisión**: HACER — Tarea directa. Agregar backoff (retryCount * 2 days) y clasificación de errores retryable vs non-retryable.
- **Fecha decisión**: 2026-03-17

**Description**: Cron Phase 4 (revocation retry for orphaned addons) retries immediately on each daily run. There's a hard ceiling (3 retries before Sentry escalation) but no backoff. If the billing service is down for maintenance, the cron will burn through all 3 retries in 3 days and escalate to Sentry, even though waiting a few more days would have resolved it.

**Evidence**:
- `addon-expiry.job.ts` Phase 4: retries on every daily run, increments counter
- No exponential backoff (e.g., retry after 1 day, then 3 days, then 7 days)
- Hard ceiling of 3 before Sentry escalation

**Proposed Solution**:
1. Add backoff: skip retry if `lastRevocationAttempt + (retryCount * 2 days) > now()`
2. Increase ceiling to 5 with backoff
3. Or: keep simple 3-retry with daily cadence but add "billing service health check" before batch

**Recommendation**: Direct fix. Simple metadata check addition.

---

## GAP-043-25: No Handling of Addon Definition Changes After Purchase

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 5/10
- **Category**: Edge Case

**Description**: Addon definitions (`addons.config.ts`) could change after a purchase: price changes, limit increases adjusted, addon deactivated. The purchase record stores the original `addonSlug` and `limitAdjustments` (frozen at purchase time), but `recalculateAddonLimitsForCustomer()` resolves the CURRENT addon definition, not the purchase-time definition. If the addon's `limitIncrease` changed from +20 to +10, recalculation would use +10 even though the user paid for +20.

**Evidence**:
- `addon-limit-recalculation.service.ts`: calls `getAddonBySlug()` which reads current config
- `billing_addon_purchases.limitAdjustments`: stores purchase-time adjustments (JSONB)
- Inconsistency: `sumIncrements()` reads from purchase records, but base limit comes from current plan config
- If addon definition changes `limitIncrease`, `recalculateAddonLimitsForCustomer()` may use wrong value

**Wait**: On closer inspection, `sumIncrements()` reads from `purchase.limitAdjustments` (frozen at purchase time), NOT from addon config. The addon config is only used to CLASSIFY the addon type. So this is actually correct.

**Revised Assessment**: The implementation correctly uses purchase-time `limitAdjustments` for limit calculations. The addon definition is only used for type resolution (entitlement vs limit vs unknown). However, if an addon is REMOVED from config entirely (not just deactivated), `getAddonBySlug()` returns null and the purchase is classified as `unknown`, which triggers the "retired addon" fallback path.

**Recommendation**: No action needed. The current implementation is correct. Documenting this as a "verified non-gap" for completeness.

- **Decisión**: DESCARTADO — Verificado como non-gap. Implementación correcta (purchase-time adjustments congelados).
- **Fecha decisión**: 2026-03-17

---

## GAP-043-26: `billing_notification_log` Table Not in Schema Files

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Documentation Gap
- **Decisión**: HACER — Tarea directa. Verificar origen de tabla, agregar a Drizzle schema si falta, documentar ubicación.
- **Fecha decisión**: 2026-03-17

**Description**: The cron job uses `billing_notification_log` for idempotency checking, but this table's schema definition was not found in the standard schema directory. It may be defined in the billing package or QZPay directly.

**Evidence**:
- `addon-expiry.job.ts`: references `billingNotificationLog` table
- Not found in `packages/db/src/schemas/billing/` directory scan
- May be defined in QZPay package or billing package

**Proposed Solution**:
1. Verify table exists in DB (may be from QZPay migration)
2. If not in Drizzle schema, add it for type safety
3. At minimum, document its location

**Recommendation**: Verify and document. Minor cleanup.

---

## GAP-043-27: No Test for Customer-Not-Found Edge Case in Webhook

- **Audit**: Pass #1
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Missing Test Coverage
- **Decisión**: HACER — Tarea directa. Agregar test de customer-not-found (retorna 200, log warning) + test de error transitorio (debe diferir de not-found, vinculado a GAP-043-40).
- **Fecha decisión**: 2026-03-17

**Description**: The spec (audit-v7 fix #13) added explicit handling for customer-not-found in webhook cancellation (return 200 to prevent infinite retries). The webhook handler has this logic, but it's not tested.

**Evidence**:
- `subscription-logic.ts`: has customer-not-found check before addon cancellation
- No test in `addon-lifecycle-cancellation.test.ts` for this scenario
- Spec fix #13 explicitly requires this handling

**Proposed Solution**:
1. Add test: webhook fires cancellation, customer lookup returns null
2. Verify: returns 200 (not 500), logs warning, does NOT retry

**Recommendation**: Direct fix. Add test. No new SPEC needed.

---

## GAP-043-28: Spec Status Should Be Updated to `completed`

- **Audit**: Pass #1
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 1/10
- **Category**: Housekeeping
- **Decisión**: HACER — Actualizar metadata.json status a "completed".
- **Fecha decisión**: 2026-03-17

**Description**: All 26 tasks are marked COMPLETED (100%) but `metadata.json` still shows `"status": "draft"`. Should be updated to `completed`.

**Evidence**:
- `.claude/specs/SPEC-043-addon-lifecycle-events/metadata.json`: `"status": "draft"`
- `.claude/tasks/SPEC-043-addon-lifecycle-events/state.json`: all 26 tasks completed

**Proposed Solution**:
1. Update `metadata.json` status from `draft` to `completed`

**Recommendation**: Direct fix. Housekeeping.

---

## Audit Pass #2 (2026-03-17)

**Scope**: Deep re-audit with 5 specialized agents analyzing spec requirements, source code (19 files), test coverage (11 files), DB/i18n/notifications, and cross-cutting concerns in parallel.

**Methodology**:
1. Spec reader: extracted ALL 31+ acceptance criteria, all flows, edge cases, NFRs
2. Code analyzer: read FULL body of all 19 source files (services, routes, middleware, cron, notifications)
3. Test analyzer: inventoried all test files, mapped to ACs, identified mock strategies
4. DB/i18n/notifications analyzer: schema, 3 locale files, 5 addon definitions, notification templates
5. Cross-cutting analyzer: error handling consistency, transactions, permissions, race conditions, logging, feature flags

**Pass #1 Validation**: 27 of 28 original gaps CONFIRMED. GAP-043-25 previously marked as "verified non-gap" remains confirmed.

**New Gaps Found**: 10 (GAP-043-29 through GAP-043-38)

---

## GAP-043-29: cancelUserAddon() Returns success:true Despite Failed Limit Recalculation

- **Audit**: Pass #2
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 4/10
- **Category**: Data Consistency Bug
- **Decisión**: HACER Opción A — Wrappear DB update + recalculation en transacción atómica. Si recalc falla, rollback el cancel. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: When a user cancels a limit-type addon, `cancelUserAddon()` marks the purchase as `canceled` in DB, then calls `recalculateAddonLimitsForCustomer()`. If the recalculation fails (e.g., plan not found, billing service down), the function still returns `{ success: true }`. The user sees "cancellation successful" but their limit was NOT recalculated. They retain the addon's limit increase despite the addon being cancelled.

**Evidence**:
- `addon.user-addons.ts` lines 374-424: recalcResult.outcome === 'failed' triggers `apiLogger.warn()` but NO error is returned
- `addon.user-addons.ts` line 436: always returns `{ success: true }` regardless of recalc outcome
- DB update (line 297-304) is NOT in a transaction with recalculation
- No Sentry capture on recalc failure in this path

**Proposed Solution**:

Option A (Recommended): Wrap DB update + recalculation in a transaction. If recalc fails, rollback the cancel.
```typescript
await db.transaction(async (trx) => {
  await trx.update(billingAddonPurchases).set({ status: 'canceled', canceledAt: new Date() }).where(...);
  const recalcResult = await recalculateAddonLimitsForCustomer({ ...input, db: trx });
  if (recalcResult.outcome === 'failed') {
    throw new Error('Limit recalculation failed after addon cancellation');
  }
});
```

Option B: Return `{ success: false }` and add Sentry capture. Accept temporary inconsistency, cron Phase 4 will eventually clean up.

Option C: Accept current behavior but add Sentry.captureException() so ops team is alerted.

**Recommendation**: Option A preferred for data integrity. Option C as minimum viable fix. This is a real production data consistency risk.

---

## GAP-043-30: Sentry Capture Missing in Key Failure Paths

- **Audit**: Pass #2
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Observability Gap
- **Decisión**: HACER — Tarea directa. Agregar Sentry.captureException en addon-limit-recalculation.service.ts y cancelUserAddon().
- **Fecha decisión**: 2026-03-17

**Description**: Two critical services lack Sentry error captures, making production debugging harder. `addon-limit-recalculation.service.ts` catches all exceptions (line 294) and logs them but never calls `Sentry.captureException()`. Similarly, `addon.user-addons.ts` `cancelUserAddon()` logs errors but has no Sentry captures.

**Evidence**:
- `addon-limit-recalculation.service.ts` line 294-303: catch block with `apiLogger.error()` only, no Sentry
- `addon.user-addons.ts` lines 407-423: recalc failure logged as warning, no Sentry
- Contrast with `addon-lifecycle-cancellation.service.ts` line 294-309 which correctly uses `Sentry.captureException()`
- Contrast with `addon-plan-change.service.ts` line 418-421 which correctly uses `Sentry.captureException()`

**Proposed Solution**:
1. Add `Sentry.captureException(error, { extra: { customerId, limitKey } })` in `addon-limit-recalculation.service.ts` catch block
2. Add `Sentry.captureException(error, { extra: { customerId, addonSlug } })` in `cancelUserAddon()` recalc error path

**Recommendation**: Direct fix. Trivial change. No new SPEC needed.

---

## GAP-043-31: addon-plan-change.service.ts Exceeds 500-Line File Limit

- **Audit**: Pass #2
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 3/10
- **Category**: Code Quality / Standards Violation
- **Decisión**: HACER — Tarea directa. Extraer helpers a addon-plan-change.helpers.ts y downgrade logic a addon-downgrade-detection.service.ts.
- **Fecha decisión**: 2026-03-17

**Description**: `addon-plan-change.service.ts` is 624 lines, exceeding the project's 500-line maximum file limit. The file combines orchestration, direction computation, plan resolution, downgrade detection, notification dispatch, and audit logging.

**Evidence**:
- `apps/api/src/services/addon-plan-change.service.ts`: 624 lines
- Project standard (CLAUDE.md): "Maximum 500 lines per file"

**Proposed Solution**:
1. Extract `resolvePlanBaseLimit()`, `computeDirection()`, `sumIncrements()` helpers to `addon-plan-change.helpers.ts`
2. Extract downgrade detection + notification logic to `addon-downgrade-detection.service.ts`
3. Keep orchestration in main file (~350 lines)

**Recommendation**: Include in SPEC-044 (schema cleanup) as a refactoring task. Low urgency.

---

## GAP-043-32: No Feature Flag to Disable Addon Lifecycle in Production

- **Audit**: Pass #2
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Operational Safety
- **Decisión**: HACER — Tarea directa. Agregar HOSPEDA_ADDON_LIFECYCLE_ENABLED env var con guards por fase (cancellation, recalculation, cron).
- **Fecha decisión**: 2026-03-17

**Description**: The addon lifecycle system (cancellation cleanup, plan change recalculation, cron phases) cannot be disabled without code changes. If a bug causes incorrect revocations or limit corruption in production, the only option is a full code rollback or emergency patch.

**Evidence**:
- No `ADDON_LIFECYCLE_ENABLED` env var or feature flag
- `handleSubscriptionCancellationAddons()` is called unconditionally from webhook handler
- `handlePlanChangeAddonRecalculation()` is called unconditionally from plan-change route
- Cron Phase 4 (revocation retry) runs unconditionally

**Proposed Solution**:
1. Add `HOSPEDA_ADDON_LIFECYCLE_ENABLED` env var (default: true)
2. Guard addon lifecycle calls with feature check:
```typescript
if (config.addonLifecycleEnabled) {
  await handleSubscriptionCancellationAddons({ ... });
}
```
3. Allow disabling individual phases (cancellation, recalculation, cron retry) independently

**Recommendation**: Standalone task. Important for production safety but not blocking for launch.

---

## GAP-043-33: Inconsistent Error Handling Semantics Across Lifecycle Services

- **Audit**: Pass #2
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10 (sube a ~6/10 con Opción B)
- **Category**: Architecture / Developer Experience
- **Decisión**: HACER Opción B — Estandarizar todos los lifecycle services a Result pattern. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: The 5 lifecycle services use 3 different error handling patterns, making it non-obvious for developers what to expect from each:
- `revokeAddonForSubscriptionCancellation()`: **throws** on fatal errors
- `handleSubscriptionCancellationAddons()`: **catches** errors from revoke, continues loop, **throws** at end if any failed
- `recalculateAddonLimitsForCustomer()`: returns `RecalculationResult` with `outcome: 'failed'`, **never throws**
- `handlePlanChangeAddonRecalculation()`: **throws** for billing.limits.set failures but **continues** processing other keys
- `cancelUserAddon()`: returns `ServiceResult<void>` always with `success: true`, **never throws**

**Evidence**:
- `addon-lifecycle.service.ts` lines 138-334: throw pattern
- `addon-lifecycle-cancellation.service.ts` lines 195-256: catch-and-continue pattern
- `addon-limit-recalculation.service.ts` lines 294-303: Result pattern (never throws)
- `addon-plan-change.service.ts` lines 410-432: mixed pattern
- `addon.user-addons.ts` lines 374-424: always-success pattern

**Proposed Solution**:

Option A (Recommended): Document the contract for each service in JSDoc:
```typescript
/**
 * @throws {Error} When both primary and fallback revocation fail (caller must handle)
 * @returns RevocationResult on success
 */
```

Option B: Standardize all to Result pattern (breaking change, high effort)

**Recommendation**: Option A as direct fix. Add JSDoc @throws annotations to every exported lifecycle function. No new SPEC needed.

---

## GAP-043-34: Malformed limitAdjustments JSONB Not Defensively Handled

- **Audit**: Pass #2
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Defensive Programming
- **Decisión**: HACER — Tarea directa. Agregar validación Zod al leer JSONB de DB + tests con data malformada.
- **Fecha decisión**: 2026-03-17

**Description**: `addon.user-addons.ts` reads `purchase.limitAdjustments[0]` and accesses `.limitKey` with an unsafe `as string` cast (line 85-89). If a DB record has `limitAdjustments: null`, `limitAdjustments: "invalid"`, or `limitAdjustments: [{}]` (missing keys), the code could crash or produce incorrect behavior.

**Evidence**:
- `addon.user-addons.ts` lines 78-91: manual type narrowing with `typeof === 'object'` check but no property validation
- `limitKey` cast as `as string` without verifying it IS a string
- `increase` parsed with `Number()` fallback but `NaN` check is the only guard
- `addon-limit-recalculation.service.ts` line 215-218: directly accesses `.limitAdjustments` array without null check
- No Zod runtime validation on JSONB read from DB
- Tests use well-formed fixtures.. no malformed data tests

**Proposed Solution**:
1. Add defensive validation when reading JSONB from DB:
```typescript
import { addonAdjustmentSchema } from '../addon.types';
const parsed = addonAdjustmentSchema.safeParse(purchase.limitAdjustments);
if (!parsed.success) {
  apiLogger.warn({ purchaseId, raw: purchase.limitAdjustments }, 'Malformed limitAdjustments');
  return; // skip this purchase
}
```
2. Add test with `limitAdjustments: null` and `limitAdjustments: [{ badKey: true }]`

**Recommendation**: Direct fix. Add Zod validation at DB read boundary. Include in SPEC-044 (schema cleanup).

---

## GAP-043-35: Multiple Rapid Plan Changes Can Overlap Recalculations

- **Audit**: Pass #2
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 5/10
- **Category**: Race Condition
- **Decisión**: HACER — Tarea directa. Agregar pg_advisory_xact_lock por customerId durante recalculación.
- **Fecha decisión**: 2026-03-17

**Description**: If a customer changes plans rapidly (e.g., Basic -> Pro -> Enterprise in quick succession), `handlePlanChangeAddonRecalculation()` can be running for the first change while the second change starts. Both read the same addon purchases and call `billing.limits.set()`. The last writer wins, but with stale `oldPlanId` context, the final limit value could be wrong.

**Evidence**:
- `plan-change.ts`: captures `oldPlanId` BEFORE `changePlan()` call, then calls `handlePlanChangeAddonRecalculation()` (non-blocking on error)
- `addon-plan-change.service.ts`: no locking or dedup mechanism
- No test for overlapping recalculations
- Recalculation reads ALL active purchases fresh (so data is current), but `oldPlanId` passed in may be stale if another plan change committed between capture and recalc

**Proposed Solution**:

Option A: Add advisory lock per customer during recalculation:
```typescript
await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${customerId}))`)
```

Option B: Accept last-writer-wins (recalculation is idempotent with current purchases, only `oldPlanId` may be stale)

Option C: Add dedup: store `lastRecalcTimestamp` in customer metadata, skip if < 5 seconds ago

**Recommendation**: Option B is likely acceptable. The recalculation uses current addon purchases (not stale), so the final limit is correct. Only the downgrade detection (comparing oldPlanId) may misfire. Low real-world probability. Document as accepted risk.

---

## GAP-043-36: Addon Notification Events Missing from NOTIFICATION_CATEGORY_MAP

- **Audit**: Pass #2
- **Severity**: INFO (resolved)
- **Priority**: N/A
- **Complexity**: 0/10
- **Category**: Missing Configuration
- **Decisión**: DESCARTADO — Verificado como resuelto (GAP-043-66). NOTIFICATION_CATEGORY_MAP está completo.
- **Fecha decisión**: 2026-03-17

**Description**: The notification system has a `NOTIFICATION_CATEGORY_MAP` that classifies notification types into categories (TRANSACTIONAL, REMINDER, ADMIN). Addon event types (`ADDON_EXPIRATION_WARNING`, `ADDON_EXPIRED`, `ADDON_RENEWAL_CONFIRMATION`) may not be mapped in this config, which could affect user preference opt-out logic.

**Evidence**:
- `notification.types.ts`: addon types defined in enum
- `notification.service.ts`: uses `shouldSendNotification()` which may check category
- Category map not fully verified in Pass #2 analysis

**Proposed Solution**:
1. Verify addon types are in NOTIFICATION_CATEGORY_MAP
2. If missing, add: ADDON_EXPIRATION_WARNING -> REMINDER, ADDON_EXPIRED -> TRANSACTIONAL, ADDON_RENEWAL_CONFIRMATION -> TRANSACTIONAL

**Recommendation**: Direct verification and fix. Trivial.

---

## GAP-043-37: Test Mock Strategy Lacks Argument Shape Validation

- **Audit**: Pass #2
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 3/10
- **Category**: Test Quality
- **Decisión**: HACER — Tarea directa. Agregar toHaveBeenCalledWith con expect.objectContaining en paths críticos.
- **Fecha decisión**: 2026-03-17

**Description**: Across all 11 test files, mocks are verified with `toHaveBeenCalled()` or `toHaveBeenCalledTimes()` but rarely with `toHaveBeenCalledWith()` to validate argument shapes. For example, `billing.limits.set()` is verified as called but its payload (maxValue, sourceId, source) is not schema-validated. A typo in the source or missing field would not be caught.

**Evidence**:
- `addon-lifecycle.service.test.ts`: checks call count but not argument structure for `billing.entitlements.remove()`
- `addon-limit-recalculation.service.test.ts`: checks `limits.set` called but payload not fully validated
- `addon-lifecycle-cancellation.service.test.ts`: checks revocation called per addon but not with exact expected args

**Proposed Solution**:
1. Add `expect(billing.limits.set).toHaveBeenCalledWith(expect.objectContaining({ maxValue: 25, sourceId: ADDON_RECALC_SOURCE_ID }))`
2. Prioritize for critical paths (limits.set, entitlements.revoke, DB updates)

**Recommendation**: Direct fix. Enhance existing tests. No new SPEC needed.

---

## GAP-043-38: Admin Concurrent Cancel Both Return HTTP 200

- **Audit**: Pass #2
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: API Behavior
- **Decisión**: HACER — Tarea directa. Retornar HTTP 409 (Conflict) si suscripción ya cancelada por concurrent process.
- **Fecha decisión**: 2026-03-17

**Description**: If two admin users cancel the same subscription simultaneously, both complete Phase 1 (QZPay revocations). In Phase 2, the first request's transaction succeeds. The second request enters the transaction, detects `status === CANCELLED` via the race-condition guard, and exits silently. Both requests return HTTP 200 to their callers. The second admin user believes they cancelled the subscription, when they actually did nothing.

**Evidence**:
- `subscription-cancel.ts` lines 309-327: race-condition guard returns from transaction without error
- No differentiation in HTTP response between "cancelled by you" and "already cancelled by concurrent process"
- `apiLogger.warn('subscription already cancelled by concurrent process')` is logged but not returned to client

**Proposed Solution**:
1. Return HTTP 409 (Conflict) if subscription was already cancelled in the transaction guard
2. Or return 200 with `{ alreadyCancelled: true }` flag in response body

**Recommendation**: Direct fix. Low effort. Improves admin UX.

---

## Pass #2 Validation of Pass #1 Gaps

| Pass #1 Gap | Pass #2 Status | Notes |
|-------------|---------------|-------|
| GAP-043-01 | CONFIRMED | No ADDON_CANCELLATION notification |
| GAP-043-02 | CONFIRMED | No ADDON_PURCHASE confirmation.. template+dispatch missing |
| GAP-043-03 | CONFIRMED | 22s timeout not enforced.. no AbortController or timeout mechanism |
| GAP-043-04 | CONFIRMED | Zero concurrent webhook+admin tests |
| GAP-043-05 | CONFIRMED | Retry with mixed states untested |
| GAP-043-06 | CONFIRMED | VARCHAR(50) without CHECK.. schema reviewed, no constraints |
| GAP-043-07 | CONFIRMED | No transition validation function anywhere |
| GAP-043-08 | CONFIRMED + EXPANDED | Templates hardcoded Spanish.. addon notification i18n keys missing from all 3 locales |
| GAP-043-09 | CONFIRMED | canceled (addon) vs cancelled (subscription) string literals throughout |
| GAP-043-10 | CONFIRMED | No mutex/lock in cron registry or job |
| GAP-043-11 | CONFIRMED + REFINED | Cache cleared ONCE at end of batch, not per-addon.. window is wider than initially assessed |
| GAP-043-12 | CONFIRMED | subscriptionId nullable.. cancellation flow queries by subscriptionId, misses NULL |
| GAP-043-13 | CONFIRMED | Zero metrics emission.. only logs |
| GAP-043-14 | CONFIRMED | Double recalc accepted as-is (idempotent) |
| GAP-043-15 | CONFIRMED | No load test.. sequential processing with no pagination |
| GAP-043-16 | CONFIRMED | Graceful degradation exists but degraded entitlement SET content not tested |
| GAP-043-17 | CONFIRMED | No payment failure tracking or pre-cancel warning |
| GAP-043-18 | CONFIRMED | All "integration" tests mock DB and billing |
| GAP-043-19 | CONFIRMED | Primary-fail-fallback-succeed pattern untested |
| GAP-043-20 | CONFIRMED | JSONB validated only at app level (Zod) |
| GAP-043-21 | CONFIRMED | clearEntitlementCache has no logging |
| GAP-043-22 | CONFIRMED | No CTA or grace period in downgrade warning |
| GAP-043-23 | CONFIRMED | Webhook cancel has no reason field |
| GAP-043-24 | CONFIRMED | Immediate retry, no backoff |
| GAP-043-25 | CONFIRMED NON-GAP | Purchase-time adjustments correctly frozen |
| GAP-043-26 | CONFIRMED | billing_notification_log used but not in standard schema dir |
| GAP-043-27 | CONFIRMED | Customer-not-found in webhook not tested |
| GAP-043-28 | CONFIRMED | metadata.json status still "draft" |

---

## Updated Priority Summary

### P1 - Must Fix (Before Production)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-03 | 22-second webhook timeout not enforced | Code fix | 5/10 | Pass #1 |
| GAP-043-04 | Race condition webhook+admin not tested | Test | 6/10 | Pass #1 |
| GAP-043-05 | Partial failure retry flow not tested | Test + spec clarification | 4/10 | Pass #1 |
| GAP-043-17 | MercadoPago auto-cancel after 3 failures | New SPEC | 5/10 | Pass #1 |
| **GAP-043-29** | **cancelUserAddon() returns success despite failed recalc** | **Code fix** | **4/10** | **Pass #2** |

### P2 - Should Fix (Post-Launch Sprint)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-01 | No ADDON_CANCELLATION notification | Feature | 3/10 | Pass #1 |
| GAP-043-02 | No ADDON_PURCHASE notification | Feature | 3/10 | Pass #1 |
| GAP-043-06 | Status VARCHAR without CHECK constraint | Schema | 3/10 | Pass #1 |
| GAP-043-07 | No state transition validation | Code fix | 4/10 | Pass #1 |
| GAP-043-10 | Cron overlapping execution | Code fix | 4/10 | Pass #1 |
| GAP-043-11 | Cache invalidation race not tested (wider window than assessed) | Test | 5/10 | Pass #1, refined #2 |
| GAP-043-12 | subscriptionId NULL one-time addons | New SPEC | 3/10 | Pass #1 |
| GAP-043-13 | No lifecycle metrics/alerting | Feature | 4/10 | Pass #1 |
| GAP-043-16 | Graceful degradation not fully tested | Test | 3/10 | Pass #1 |
| GAP-043-18 | Integration tests use mocks | Test | 6/10 | Pass #1 |
| GAP-043-19 | Transient billing failure recovery | Test | 4/10 | Pass #1 |
| GAP-043-24 | No retry backoff in cron Phase 4 | Code fix | 3/10 | Pass #1 |
| GAP-043-27 | Customer-not-found edge case not tested | Test | 2/10 | Pass #1 |
| **GAP-043-30** | **Sentry capture missing in addon-limit-recalculation + cancelUserAddon** | **Code fix** | **2/10** | **Pass #2** |
| **GAP-043-32** | **No feature flag to disable addon lifecycle** | **Code fix** | **3/10** | **Pass #2** |
| **GAP-043-33** | **Inconsistent error handling semantics across services** | **Documentation** | **4/10** | **Pass #2** |
| **GAP-043-34** | **Malformed limitAdjustments JSONB not defensively handled** | **Code fix** | **3/10** | **Pass #2** |
| **GAP-043-35** | **Rapid plan changes can overlap recalculations** | **Accepted risk** | **5/10** | **Pass #2** |

### P3 - Nice to Have

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-08 | Email templates not internationalized (expanded) | i18n (new SPEC) | 5/10 | Pass #1, expanded #2 |
| GAP-043-09 | canceled vs cancelled spelling | Constants | 2/10 | Pass #1 |
| GAP-043-14 | Double recalculation safety net | Accept as-is | 3/10 | Pass #1 |
| GAP-043-15 | No load test for batch expirations | Test | 5/10 | Pass #1 |
| GAP-043-20 | JSONB not schema-validated at DB | Accept as-is | 3/10 | Pass #1 |
| GAP-043-21 | No audit trail for cache clears | Logging | 2/10 | Pass #1 |
| GAP-043-22 | Downgrade warning no action path | New SPEC | 4/10 | Pass #1 |
| GAP-043-23 | Missing reason in webhook cancel | Data | 2/10 | Pass #1 |
| GAP-043-25 | Addon definition changes (verified non-gap) | N/A | 0/10 | Pass #1 |
| GAP-043-26 | notification_log table not in schema | Doc | 2/10 | Pass #1 |
| GAP-043-28 | Spec status still "draft" | Housekeeping | 1/10 | Pass #1 |
| **GAP-043-31** | **addon-plan-change.service.ts exceeds 500-line limit** | **Refactor** | **3/10** | **Pass #2** |
| **GAP-043-36** | **Addon events missing from NOTIFICATION_CATEGORY_MAP** | **Config** | **1/10** | **Pass #2** |
| **GAP-043-37** | **Test mocks lack argument shape validation** | **Test quality** | **3/10** | **Pass #2** |
| **GAP-043-38** | **Admin concurrent cancel both return 200** | **API behavior** | **2/10** | **Pass #2** |

---

## Updated Recommendations for New SPECs

> **SUPERSEDED**: These recommendations were revised in Pass #5. See "Remediation Strategy (Revised — Pass #5 Final)" section. **No new SPECs needed** — all gaps resolved as direct tasks, SPEC-044 items, or product decisions.

Based on both audit passes, the following gaps warrant their own formal specifications:

1. **SPEC-047: Webhook Timeout & Background Processing** (GAP-043-03, GAP-043-10)
   - 22-second timeout enforcement, background job deferral, cron overlap prevention

2. **SPEC-048: Payment Failure Lifecycle Notifications** (GAP-043-17)
   - MercadoPago payment failure tracking, warning notifications before auto-cancel

3. **SPEC-049: Notification Email i18n** (GAP-043-08)
   - Cross-cutting i18n for all notification templates (not addon-specific)

4. **SPEC-050: Addon Lifecycle Observability** (GAP-043-13, GAP-043-21)
   - Structured metrics, alerting, and audit trails for addon operations

5. **SPEC-051: Post-Downgrade Grace Period Policy** (GAP-043-22)
   - Product decision on what happens when user exceeds limits after downgrade

Items that should be folded into existing specs:
- GAP-043-06, GAP-043-07, GAP-043-09, GAP-043-31, GAP-043-34 -> SPEC-044 (Addon Purchase Schema Cleanup)
- GAP-043-12 -> SPEC-044 or standalone

Items that are direct fixes (no SPEC needed):
- GAP-043-04, GAP-043-05, GAP-043-16, GAP-043-19, GAP-043-27, GAP-043-37 (test additions)
- GAP-043-24 (retry backoff)
- GAP-043-23 (webhook reason extraction)
- GAP-043-28 (metadata update)
- GAP-043-29 (cancelUserAddon atomicity.. **P1 direct fix**)
- GAP-043-30 (Sentry captures)
- GAP-043-32 (feature flag)
- GAP-043-33 (JSDoc error contracts)
- GAP-043-36 (notification category map)
- GAP-043-38 (admin cancel 409 response)

---

## Aggregate Statistics

| Metric | Pass #1 | Pass #2 | Total |
|--------|---------|---------|-------|
| Gaps found | 28 | 10 | 38 |
| P1 (Must Fix) | 4 | 1 | 5 |
| P2 (Should Fix) | 13 | 5 | 18 |
| P3 (Nice to Have) | 11 | 4 | 15 |
| Verified non-gaps | 1 | 0 | 1 |
| New SPECs recommended | 5 | 0 | 5 |
| Direct fixes | 8 | 6 | 14 |
| Fold into SPEC-044 | 3 | 2 | 5 |

### P1 - Must Fix (Before Production)

| Gap | Description | Type | Effort |
|-----|-------------|------|--------|
| GAP-043-03 | 22-second webhook timeout not enforced | Code fix | 5/10 |
| GAP-043-04 | Race condition webhook+admin not tested | Test | 6/10 |
| GAP-043-05 | Partial failure retry flow not tested | Test + spec clarification | 4/10 |
| GAP-043-17 | MercadoPago auto-cancel after 3 failures | New SPEC | 5/10 |

### P2 - Should Fix (Post-Launch Sprint)

| Gap | Description | Type | Effort |
|-----|-------------|------|--------|
| GAP-043-01 | No ADDON_CANCELLATION notification | Feature | 3/10 |
| GAP-043-02 | No ADDON_PURCHASE notification | Feature | 3/10 |
| GAP-043-06 | Status VARCHAR without CHECK constraint | Schema | 3/10 |
| GAP-043-07 | No state transition validation | Code fix | 4/10 |
| GAP-043-10 | Cron overlapping execution | Code fix | 4/10 |
| GAP-043-11 | Cache invalidation race not tested | Test | 5/10 |
| GAP-043-12 | subscriptionId NULL one-time addons | New SPEC | 3/10 |
| GAP-043-13 | No lifecycle metrics/alerting | Feature | 4/10 |
| GAP-043-16 | Graceful degradation not fully tested | Test | 3/10 |
| GAP-043-18 | Integration tests use mocks | Test | 6/10 |
| GAP-043-19 | Transient billing failure recovery | Test | 4/10 |
| GAP-043-24 | No retry backoff in cron Phase 4 | Code fix | 3/10 |
| GAP-043-27 | Customer-not-found edge case not tested | Test | 2/10 |

### P3 - Nice to Have

| Gap | Description | Type | Effort |
|-----|-------------|------|--------|
| GAP-043-08 | Email templates not internationalized | i18n (new SPEC) | 5/10 |
| GAP-043-09 | canceled vs cancelled spelling | Constants | 2/10 |
| GAP-043-14 | Double recalculation safety net | Accept as-is | 3/10 |
| GAP-043-15 | No load test for batch expirations | Test | 5/10 |
| GAP-043-20 | JSONB not schema-validated at DB | Accept as-is | 3/10 |
| GAP-043-21 | No audit trail for cache clears | Logging | 2/10 |
| GAP-043-22 | Downgrade warning no action path | New SPEC | 4/10 |
| GAP-043-23 | Missing reason in webhook cancel | Data | 2/10 |
| GAP-043-25 | Addon definition changes (verified non-gap) | N/A | 0/10 |
| GAP-043-26 | notification_log table not in schema | Doc | 2/10 |
| GAP-043-28 | Spec status still "draft" | Housekeeping | 1/10 |

---

## Recommendations for New SPECs

Based on this analysis, the following gaps warrant their own formal specifications:

1. **SPEC-047: Webhook Timeout & Background Processing** (GAP-043-03, GAP-043-10)
   - 22-second timeout enforcement, background job deferral, cron overlap prevention

2. **SPEC-048: Payment Failure Lifecycle Notifications** (GAP-043-17)
   - MercadoPago payment failure tracking, warning notifications before auto-cancel

3. **SPEC-049: Notification Email i18n** (GAP-043-08)
   - Cross-cutting i18n for all notification templates (not addon-specific)

4. **SPEC-050: Addon Lifecycle Observability** (GAP-043-13, GAP-043-21)
   - Structured metrics, alerting, and audit trails for addon operations

5. **SPEC-051: Post-Downgrade Grace Period Policy** (GAP-043-22)
   - Product decision on what happens when user exceeds limits after downgrade

Items that should be folded into existing specs:
- GAP-043-06, GAP-043-07, GAP-043-09 -> SPEC-044 (Addon Purchase Schema Cleanup)
- GAP-043-12 -> SPEC-044 or standalone

Items that are direct fixes (no SPEC needed):
- GAP-043-04, GAP-043-05, GAP-043-16, GAP-043-19, GAP-043-27 (test additions)
- GAP-043-24 (retry backoff)
- GAP-043-23 (webhook reason extraction)
- GAP-043-28 (metadata update)

---

## Audit Pass #3 (2026-03-17)

**Scope**: Deep exhaustive contrast of spec.md acceptance criteria against implementation code, security/reliability audit, and test coverage quality analysis.

**Methodology**: 6 specialized agents analyzed in parallel:
1. Spec reader (full spec + tasks + metadata + existing gaps)
2. Implementation code analyzer (17 source files across api/services, routes, middlewares)
3. Billing/DB/i18n/notifications package analyzer (21 files across shared packages)
4. Code reviewer (AC-by-AC contrast, 17 source files, pattern compliance)
5. QA engineer (10 test files, test count verification, coverage per AC)
6. Security/reliability expert (9 source files, OWASP, race conditions, production readiness)

**Key Finding**: Pass #3 identified **13 new gaps** (GAP-043-39 through GAP-043-51), **upgraded 2 existing gaps**, and **provided additional evidence for 8 existing gaps**. Most critically, found a CRITICAL-severity bug in AC-1.9 customer existence check and a privilege escalation vector in the entitlement middleware fail-open pattern.

---

## Pass #3: Existing Gap Updates

### GAP-043-03 (CONFIRMED + STRENGTHENED)

**New evidence**: The code reviewer confirmed that while the 15-second warning log is correctly implemented (line 285 in `addon-lifecycle-cancellation.service.ts`), there is NO `Promise.race` or `AbortController` mechanism to enforce the 22-second hard limit. If processing takes 25s, the webhook handler will simply take 25s. MercadoPago will timeout and retry, but the current invocation continues running, wasting resources and potentially conflicting with the retry.

### GAP-043-05 (CONFIRMED + STRENGTHENED to P1)

**New evidence**: The admin cancel Phase 2 commits DB transaction BEFORE calling QZPay cancel. If QZPay cancel fails, the system has subscription marked as `cancelled` in DB but still active in QZPay. The code returns 500 with "cancelled locally but QZPay cancel failed" but has NO compensating transaction or reconciliation mechanism. This is a deliberate architectural divergence from the spec ("to avoid holding DB connection during network I/O") but creates an unrecoverable split state.

### GAP-043-11 (CONFIRMED + EXPANDED)

**New evidence**: The security expert confirmed the in-memory `EntitlementCache` singleton only invalidates on the instance that processed the event. In a Vercel deployment (multiple serverless instances), `clearEntitlementCache(customerId)` only affects one instance. Others serve stale entitlements for up to 5 minutes.

### GAP-043-15 (CONFIRMED + EXPANDED)

**New evidence**: The orphaned addon purchase query in the cron job (line 443 in `addon-expiry.job.ts`) has NO LIMIT clause. If many orphaned purchases accumulate (e.g., billing was down for a day), the cron job processes all of them sequentially within its 120s timeout and could time out partway through.

### GAP-043-24 (CONFIRMED + EXPANDED)

**New evidence**: The retry mechanism does not distinguish between retryable errors (network timeout, transient QZPay failure) and non-retryable errors (addon definition permanently removed, invalid data). All errors count toward the same 3-retry budget.

### GAP-043-27 (UPGRADED to P1 - BUG FOUND)

**Previous assessment**: "Customer-not-found edge case not tested" (P2 test gap)
**New assessment**: ACTUAL BUG. The implementation at lines 424-450 of `subscription-logic.ts` does:
```typescript
try {
    await billing.customers.get(localSubscription.customerId);
} catch {
    customerExists = false;
}
```
This catches ANY error (network timeout, DB connection failure, QZPay 500) and treats it as "customer not found". When a transient error occurs, the code skips the entire addon cleanup AND returns 200 to MercadoPago (preventing retry). Result: addons remain active permanently with no retry mechanism. The spec AC-1.9 says "Customer not found -> log warning, return 200", NOT "any billing error -> skip cleanup".

### GAP-043-30 (CONFIRMED + EXPANDED)

**New evidence**: In `addon-lifecycle-cancellation.service.ts`, Sentry is only called once at the end of the loop (line 293-316), grouping all failures. If the process crashes mid-loop (OOM, timeout), prior individual failures never reach Sentry. Additionally, AC-5.x (all 3 audit trail acceptance criteria) have ZERO dedicated test coverage.

### GAP-043-34 (CONFIRMED + EXPANDED)

**New evidence**: The `sumIncrements` function in `addon-plan-change.service.ts` accepts `limitAdjustments` as `Array<{limitKey: string; increase: number}> | null` but does not validate that `increase` is positive. An addon with `increase: -5` would reduce the sum without warning. Not a bug today (addons in config have positive values), but no defensive check.

---

## GAP-043-39: AC-3.9 Cache Not Invalidated After Limit Recalculation in cancelUserAddon

- **Audit**: Pass #3
- **Severity**: CRITICAL
- **Priority**: P1
- **Complexity**: 2/10
- **Category**: Bug
- **Decisión**: HACER — Tarea directa. Agregar clearEntitlementCache(customerId) en route handler addons.ts después de cancelAddon(). 2 líneas.
- **Fecha decisión**: 2026-03-17

**Description**: When `cancelUserAddon()` calls `recalculateAddonLimitsForCustomer()` for limit-type addons, neither function calls `clearEntitlementCache(customerId)`. The QZPay limits ARE updated correctly, but the in-memory entitlement middleware cache is NOT invalidated. Users continue seeing old (higher) limits in entitlement checks for up to 5 minutes (cache TTL). This means a user who cancels an "extra photos" addon could still upload photos above their real limit until the cache expires.

**Evidence**:
- `addon.user-addons.ts` lines 361-424: no `clearEntitlementCache` call after recalc
- `addon-limit-recalculation.service.ts`: no `clearEntitlementCache` anywhere in the service
- Contrast: `handlePlanChangeAddonRecalculation` in `addon-plan-change.service.ts` DOES call `clearEntitlementCache`
- Contrast: `handleSubscriptionCancellationAddons` in `subscription-logic.ts` DOES call `clearEntitlementCache`

**Proposed Solution**:
1. Add `clearEntitlementCache(input.customerId)` in `cancelUserAddon()` after the recalculation call
2. Alternatively, add it inside `recalculateAddonLimitsForCustomer()` so ALL callers benefit

**Recommendation**: Direct fix. 2 lines of code. P1 because it allows limit bypass for up to 5 minutes.

---

## GAP-043-40: AC-1.9 Customer Existence Check Catches All Errors as "Not Found"

- **Audit**: Pass #3
- **Severity**: CRITICAL
- **Priority**: P1
- **Complexity**: 3/10
- **Category**: Bug
- **Decisión**: HACER — Tarea directa. Discriminar tipo de error: solo 404 = not found, resto propaga como 500 para retry de MercadoPago.
- **Fecha decisión**: 2026-03-17

**Description**: The webhook handler's customer existence check uses a generic `catch {}` that treats ANY error (network timeout, DB failure, QZPay 500, etc.) as "customer does not exist". When a transient infrastructure error occurs, the code skips addon cleanup entirely AND returns HTTP 200 to MercadoPago, preventing webhook retry. Addons remain active permanently with no recovery path.

**Evidence**:
- `subscription-logic.ts` lines 424-450:
  ```typescript
  try { await billing.customers.get(localSubscription.customerId); }
  catch { customerExists = false; }
  ```
- When `customerExists = false`, the handler logs a warning and returns 200
- MercadoPago never retries because it received a success response
- No cron job catches this case (orphaned addon query requires cancelled subscription status)

**Proposed Solution**:
1. Change to: `const customer = await billing.customers.get(customerId);` and check `if (!customer)` for true not-found
2. Let actual errors (network, timeout, 500) propagate to the catch block that returns 500, triggering MercadoPago retry
3. Alternative: use `billing.customers.getOrNull()` if available, or catch specific error types

**Recommendation**: Direct fix. CRITICAL because it silently and permanently abandons addon cleanup on transient errors. Must fix before production.

---

## GAP-043-41: Admin Cancel Phase 2 Bulk UPDATE Not Scoped to Phase 1 Purchases

- **Audit**: Pass #3
- **Severity**: HIGH → FALSO POSITIVO
- **Priority**: N/A
- **Complexity**: 0/10
- **Category**: Race Condition / Bug
- **Decisión**: DESCARTADO — Falso positivo. UPDATE por subscriptionId+status='active' es intencionalmente más seguro que usar purchaseIds. Defensive coding correcto.
- **Fecha decisión**: 2026-03-17

**Description**: In the admin subscription cancel flow, Phase 1 collects `activePurchases` and revokes their QZPay grants in parallel. Phase 2 then does a bulk `UPDATE ... WHERE subscriptionId = id AND status = 'active'`. Between Phase 1 and Phase 2, a concurrent checkout webhook could create a NEW addon purchase for the same subscription. Phase 2's bulk UPDATE would mark that new purchase as `canceled` even though its QZPay grants were never revoked in Phase 1.

**Evidence**:
- `subscription-cancel.ts` lines 329-345: `UPDATE` filters by `subscriptionId + status='active'`, not by specific `purchaseIds`
- Line 330-331: `const purchaseIds = activePurchases.map((p) => p.id)` is declared but NOT used in the WHERE clause
- The `purchaseIds` variable is only used in a debug log

**Proposed Solution**:
1. Change Phase 2 UPDATE to use `inArray(billingAddonPurchases.id, purchaseIds)` instead of `eq(subscriptionId, id) AND eq(status, 'active')`
2. This ensures only purchases whose QZPay grants were revoked in Phase 1 are marked as canceled

**Recommendation**: Direct fix. 1 line change. P1 because it can leave QZPay grants active while DB shows canceled.

---

## GAP-043-42: DB-QZPay Split State After Admin Cancel Phase 2 QZPay Failure

- **Audit**: Pass #3
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 5/10
- **Category**: Reliability / Data Consistency
- **Decisión**: HACER Opción A — Agregar check de reconciliación en cron: detectar suscripciones cancelled en DB pero active en QZPay, reintentar cancel. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: Admin cancel Phase 2 commits the DB transaction (subscription + addons marked cancelled/canceled) BEFORE calling `billing.subscriptions.cancel()`. If the QZPay cancel call fails, the system enters an inconsistent state: DB says cancelled, QZPay says active. MercadoPago continues billing the customer. The code returns 500 with error details and reports to Sentry, but there is NO automated reconciliation mechanism.

**Evidence**:
- `subscription-cancel.ts` lines 385-430: DB transaction committed, then QZPay cancel attempted
- Comment in code: "to avoid holding the connection open during network I/O"
- If QZPay fails (lines 396-415): logs error, Sentry alert, returns 500
- No cron job or compensating transaction to retry the QZPay cancel

**Proposed Solution**:
Option A (Simpler): Move `billing.subscriptions.cancel()` inside the DB transaction and rollback on failure
Option B (Current pattern + safety net): Add a reconciliation check in the cron job that finds subscriptions marked `CANCELLED` locally but still `active` in QZPay, and retries the cancel
Option C (Queue): Enqueue the QZPay cancel as a job that retries with backoff

**Recommendation**: Option B is the most pragmatic (adds to existing cron job). Needs new SPEC if Option C chosen. Option A requires careful consideration of DB connection timeout during network I/O.

---

## GAP-043-43: Entitlement Middleware Privilege Escalation When Billing Fails

- **Audit**: Pass #3
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 3/10
- **Category**: Security
- **Decisión**: HACER Opción B — Agregar flag billingLoadFailed al context, requireLimit middleware retorna 503 cuando billing falló. Semánticamente correcto, sin efectos colaterales en free-tier. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: The entitlement middleware's `getRemainingLimit()` returns `-1` (unlimited) when a limit is NOT defined in the user's context. When QZPay is completely unreachable, the fail-open pattern sets empty entitlements/limits. Any route calling `getRemainingLimit(limitKey)` will get `-1` (unlimited) instead of being denied. This is a privilege escalation vector during billing outages.

**Evidence**:
- `entitlement.ts` lines 347-362: fail-open sets empty entitlements on billing load failure
- `entitlement.ts` lines 520-528: `getRemainingLimit()` returns `-1` when limit not in `userLimits` Map
- `-1` means "unlimited" per QZPay convention
- During billing outage: `userLimits` is empty Map -> all limits return `-1` -> all limit checks pass

**Proposed Solution**:
1. Add a `billingLoadFailed` flag to the entitlement context
2. Make `requireLimit` middleware return 503 when `billingLoadFailed` is true
3. Or change `getRemainingLimit` to return `0` (deny) instead of `-1` (unlimited) when the limit key is not in the map

**Recommendation**: Direct fix. Option 3 is simplest (1 line change: `return 0` instead of `return -1`). But needs careful consideration: some limits may legitimately not be defined for free-tier users. A flag-based approach (Option 1+2) is more precise.

---

## GAP-043-44: Safety Net Only Triggers for ACTIVE Status Webhooks

- **Audit**: Pass #3
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Spec Divergence
- **Decisión**: HACER — Tarea directa. Expandir condición a incluir TRIALING: ['ACTIVE', 'TRIALING'].includes(mappedStatus). 1 línea.
- **Fecha decisión**: 2026-03-17

**Description**: The webhook plan change safety net (AC-3.7) only triggers when `mappedStatus === SubscriptionStatusEnum.ACTIVE`. If a plan changes while the subscription transitions to `trialing` (e.g., trial restart after upgrade), the recalculation does not fire from the webhook. Since the PRIMARY trigger (AC-3.8) is the plan-change route, this is a safety net gap, not a functional gap.

**Evidence**:
- `subscription-logic.ts` lines 283-330: `fetchedPlanId !== localPlanId && mappedStatus === SubscriptionStatusEnum.ACTIVE`
- Trialing subscriptions with plan changes would miss the safety net

**Proposed Solution**:
1. Expand condition to include `TRIALING` status: `['ACTIVE', 'TRIALING'].includes(mappedStatus)`

**Recommendation**: Direct fix. Low priority because safety net only. The plan-change route is the primary trigger.

---

## GAP-043-45: resolvePlanBaseLimit Returns 0 Silently for Old Plan

- **Audit**: Pass #3
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Logic Bug
- **Decisión**: HACER — Tarea directa. Agregar apiLogger.warn + Sentry capture cuando old plan no se encuentra en config.
- **Fecha decisión**: 2026-03-17

**Description**: In `addon-plan-change.service.ts`, `resolvePlanBaseLimit(planSlug, limitKey)` returns 0 without logging when the plan is not found in config. This function is used for BOTH old and new plan lookups. For the new plan, there IS a guard with warning + Sentry (lines 283-313). For the old plan, there is NO guard. If the old plan was removed from config, `oldMaxValue` is calculated as `0 + totalAddonIncrement` instead of the real value, which can falsely trigger downgrade notifications.

**Evidence**:
- `addon-plan-change.service.ts` lines 110-116: `resolvePlanBaseLimit` returns 0 silently
- Lines 283-313: explicit guard for NEW plan with Sentry
- No equivalent guard for OLD plan

**Proposed Solution**:
1. Add `apiLogger.warn` + Sentry capture when old plan not found in config
2. Consider using the subscription's stored plan data as fallback

**Recommendation**: Direct fix. Low effort but prevents false downgrade notifications.

---

## GAP-043-46: Test Coverage Thresholds Set at 60-70% Instead of 90%

- **Audit**: Pass #3
- **Severity**: HIGH
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: CI/CD Quality Gate
- **Decisión**: HACER — Tarea directa. Verificar cobertura actual, subir thresholds gradualmente hasta 90%. Agregar thresholds a e2e config.
- **Fecha decisión**: 2026-03-17

**Description**: The project standard requires 90% coverage minimum. The `apps/api/vitest.config.ts` has coverage thresholds set to 60-70% (statements: 70, branches: 60, functions: 70, lines: 70). The `vitest.config.e2e.ts` has NO coverage thresholds at all. This means CI can pass with significantly below-standard coverage on the most critical billing code.

**Evidence**:
- `apps/api/vitest.config.ts`: thresholds at 60-70%
- `apps/api/vitest.config.e2e.ts`: no coverage section
- CLAUDE.md: "Minimum 90% coverage target"

**Proposed Solution**:
1. Raise thresholds to `{ statements: 90, branches: 85, functions: 90, lines: 90 }`
2. Add coverage thresholds to e2e config
3. Run coverage report to verify current state before raising thresholds

**Recommendation**: Direct fix but MUST verify current coverage first. If current coverage is below 90%, raising thresholds will break CI. May need phased approach: raise to current level + 5% and increase incrementally.

---

## GAP-043-47: AC-5.x Audit Trail Has Zero Test Coverage

- **Audit**: Pass #3
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Test Gap
- **Decisión**: HACER — Tarea directa. Agregar assertions de apiLogger.info y Sentry.captureException a tests existentes + test de billingSubscriptionEvents insert.
- **Fecha decisión**: 2026-03-17

**Description**: The spec defines 3 acceptance criteria for audit trails (AC-5.1: structured revocation logs, AC-5.2: apiLogger pattern, AC-5.3: Sentry captures). None of these have dedicated tests. The existing tests verify functional outcomes (addon cancelled, limits recalculated) but never assert that `apiLogger.info()` was called with the expected structured fields, or that `Sentry.captureException()` was called with the expected tags.

**Evidence**:
- QA audit found 0 tests for AC-5.1, AC-5.2, AC-5.3 across all 10 test files
- The `billingSubscriptionEvents` insertion (audit log record) in `subscription-cancel.ts` is not tested
- No test asserts `apiLogger.info` call shape or `Sentry.captureException` arguments

**Proposed Solution**:
1. Add `expect(apiLogger.info).toHaveBeenCalledWith(expect.objectContaining({...}))` assertions to existing cancellation tests
2. Add `expect(Sentry.captureException).toHaveBeenCalledWith(...)` assertions to failure path tests
3. Add test for `billingSubscriptionEvents` insert in admin cancel route

**Recommendation**: Direct fix. Enhances existing tests rather than creating new files.

---

## GAP-043-48: Actual Test Count is ~208, Not 281 as Claimed

- **Audit**: Pass #3 (superseded by GAP-043-64: actual count is ~356)
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 1/10
- **Category**: Documentation / Accuracy
- **Decisión**: HACER — Tarea directa. Actualizar metadata.json y state.json con conteo real (~356 tests).
- **Fecha decisión**: 2026-03-17

**Description**: The spec metadata and task state claim 281 tests across 11 test files. The QA audit was able to verify only ~208 test blocks across 10 readable test files. One test file could not be located or verified. The gap of ~73 tests needs investigation.. either the file exists in an unexpected location, tests were removed, or the count was inflated.

**Evidence**:
- Task state claims: T-018 (17), T-019 (28), T-020 (30), T-021 (14), T-022 (30), T-023 (25), T-024 (16), T-025 (9), T-026 (11) + existing tests = 281
- QA verified ~208 across 10 files
- 11th file location unclear

**Proposed Solution**:
1. Run `pnpm test -- --reporter=verbose` on all addon lifecycle test files and count actual `it/test` blocks
2. Update metadata.json and state.json with accurate test counts
3. Identify the missing test file or reconcile the discrepancy

**Recommendation**: Direct housekeeping fix. Important for audit accuracy.

---

## GAP-043-49: Promo Code Usage Recorded Before Payment Confirmation

- **Audit**: Pass #3
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 3/10
- **Category**: Logic Bug
- **Decisión**: HACER — Tarea directa. Mover registro de promo code usage a confirmAddonPurchase() (post-pago).
- **Fecha decisión**: 2026-03-17

**Description**: In `createAddonCheckout()`, promo code usage (`incrementUsage` + `recordUsage`) is recorded AFTER creating the MercadoPago preference but BEFORE the user actually pays. If the user abandons checkout, the promo code usage count is inflated. The preference expires after 30 minutes, but usage count is never decremented on abandonment.

**Evidence**:
- `addon.checkout.ts` lines 251-282: `incrementUsage` + `recordUsage` called before user completes payment
- No cleanup mechanism for abandoned checkouts
- Promo codes with `maxUses` limit could be exhausted by abandoned checkouts

**Proposed Solution**:
1. Move promo code usage recording to `confirmAddonPurchase()` (after payment webhook confirms success)
2. Or implement a cleanup job that decrements usage for expired/unpaid preferences

**Recommendation**: Standalone task. Low urgency if promo code `maxUses` limits are generous. Higher urgency if limits are tight.

---

## GAP-043-50: Orphaned Addon Query Has No Batch Size Limit

- **Audit**: Pass #3
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Performance / Reliability
- **Decisión**: HACER — Tarea directa. Agregar LIMIT 100 a query de orphaned addons + batch processing.
- **Fecha decisión**: 2026-03-17

**Description**: The cron job's orphaned addon purchase query (Phase 4) has no `LIMIT` clause. If billing was down for a day and many orphaned purchases accumulated, the cron job would attempt to process ALL of them sequentially within its 120-second timeout window. The job could timeout partway through, leaving some unprocessed until the next run.. but more critically, the in-memory result set could be very large.

**Evidence**:
- `addon-expiry.job.ts` line 443: query has no LIMIT
- Cron timeout is 120 seconds
- Sequential processing (no parallelism)
- Similar pattern in GAP-043-15 for expiry phase

**Proposed Solution**:
1. Add `LIMIT 100` to the orphaned purchase query
2. Process in batches, consistent with the existing TODO at line 163
3. Track progress so the next cron run picks up remaining items

**Recommendation**: Direct fix. Aligns with existing code TODO.

---

## GAP-043-51: sendNotification Fire-and-Forget Pattern Fragile

- **Audit**: Pass #3
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Code Quality
- **Decisión**: HACER — Tarea directa. Wrappear en try-catch para capturar throws síncronos.
- **Fecha decisión**: 2026-03-17

**Description**: In `addon-plan-change.service.ts`, the notification dispatch uses `sendNotification({...}).catch(...)` pattern. If `sendNotification` throws synchronously (before returning a Promise), the `.catch()` would not capture it and the error would propagate up to the caller. The pattern should be wrapped in `try-catch` or use `void Promise.resolve().then(() => sendNotification({...})).catch(...)`.

**Evidence**:
- `addon-plan-change.service.ts` lines 540-562: `sendNotification({...}).catch((notifyErr) => { ... })`
- If `sendNotification` is not async or throws during argument evaluation, `.catch()` won't capture

**Proposed Solution**:
1. Wrap in try-catch: `try { void sendNotification({...}).catch(...) } catch (e) { apiLogger.warn(...) }`
2. Or use `queueMicrotask(() => sendNotification({...}).catch(...))`

**Recommendation**: Direct fix. Defensive coding improvement.

---

## Pass #3 Acceptance Criteria Coverage Matrix

| AC | Status | Tested? | Notes |
|----|--------|---------|-------|
| AC-1.1 | PASS | Yes | All addons revoked, QZPay + DB |
| AC-1.2 | PASS | Yes | Idempotent via WHERE status='active' guard |
| AC-1.3 | PARTIAL | Partially | Retry tracking works; Sentry only at end of loop |
| AC-1.4 | PASS | FALSE POSITIVE | Test exists but doesn't verify the filter |
| AC-1.5 | PASS | Yes | Subscription not found -> success |
| AC-1.6 | PASS | Yes | Sequential per-addon commit |
| AC-1.7 | PASS | Yes | Missing addon def -> revoke via sourceId |
| AC-1.8 | PASS | Yes | Pending purchases excluded by WHERE |
| AC-1.9 | **FAIL** | **No** | **BUG: catches all errors as "not found" (GAP-043-40)** |
| AC-1.10 | PARTIAL | No | 15s warn exists; 22s hard limit missing |
| AC-2.1 | DIVERGENCE | Yes | DB commits before QZPay cancel (GAP-043-42) |
| AC-2.2 | PASS | Yes | Phase 1 failure -> 500 |
| AC-2.3 | PASS | Yes | Route registered correctly |
| AC-2.4 | PASS | Partially | Already-cancelled returns 400; audit log not tested |
| AC-3.1 | PASS | Yes | Upgrade limits increase |
| AC-3.2 | PASS | Yes | SUM increments per limitKey |
| AC-3.3 | PASS | Yes | Entitlement addons skipped |
| AC-3.4 | PASS | Yes | No limit addons -> early exit |
| AC-3.5 | PASS | Yes | Unlimited (-1) -> skip |
| AC-3.6 | PASS | Partially | New plan missing -> warn + 0; old plan missing -> silent 0 (GAP-043-45) |
| AC-3.7 | PARTIAL | No | Only triggers for ACTIVE status (GAP-043-44) |
| AC-3.8 | PASS | Yes | Plan-change route triggers recalc |
| AC-3.9 | PARTIAL | Partially | Recalc works; **cache not invalidated (GAP-043-39)** |
| AC-4.1 | PASS | Yes | Downgrade limits decrease |
| AC-4.2 | PASS | Yes | Below limit -> no warning |
| AC-4.3 | PASS | Yes | Above limit -> notification |
| AC-4.4 | PASS | Yes | Can't read usage -> proceed |
| AC-5.1 | PASS | **No** | Structured logs exist but **zero tests (GAP-043-47)** |
| AC-5.2 | PASS | **No** | apiLogger used but **zero tests** |
| AC-5.3 | PARTIAL | **No** | Sentry used but per-item capture missing |

**Pass #3 AC Results**: 21 PASS, 5 PARTIAL, 1 FAIL, 1 DIVERGENCE, 2 FALSE POSITIVE tests

---

## Pass #3 Validation of Previous Gaps

| Previous Gap | Pass #3 Status | Notes |
|-------------|---------------|-------|
| GAP-043-03 | CONFIRMED + STRENGTHENED | No Promise.race/AbortController for hard 22s limit |
| GAP-043-05 | CONFIRMED + STRENGTHENED | DB-QZPay split state on Phase 2 failure (now GAP-043-42) |
| GAP-043-11 | CONFIRMED + EXPANDED | Multi-instance cache invalidation issue confirmed |
| GAP-043-15 | CONFIRMED + EXPANDED | No LIMIT clause in orphaned addon query (now GAP-043-50) |
| GAP-043-24 | CONFIRMED + EXPANDED | No error classification (retryable vs non-retryable) |
| GAP-043-27 | **UPGRADED to P1** | Not just missing test.. actual BUG found (now GAP-043-40) |
| GAP-043-30 | CONFIRMED + EXPANDED | AC-5.x has zero test coverage (now GAP-043-47) |
| GAP-043-32 | CONFIRMED | No feature flag (security expert confirms) |
| GAP-043-34 | CONFIRMED + EXPANDED | No positive value validation on limitIncrement |

---

## Updated Priority Summary (All 3 Passes)

### P1 - Must Fix (Before Production)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-03 | 22-second webhook timeout not enforced | Code fix | 5/10 | Pass #1 |
| GAP-043-04 | Race condition webhook+admin not tested | Test | 6/10 | Pass #1 |
| GAP-043-05 | Partial failure retry flow not tested | Test + spec clarification | 4/10 | Pass #1 |
| GAP-043-17 | MercadoPago auto-cancel after 3 failures | New SPEC | 5/10 | Pass #1 |
| GAP-043-29 | cancelUserAddon() returns success despite failed recalc | Code fix | 4/10 | Pass #2 |
| **GAP-043-39** | **AC-3.9 cache not invalidated after limit recalc in cancelUserAddon** | **Code fix** | **2/10** | **Pass #3** |
| **GAP-043-40** | **AC-1.9 customer check catches ALL errors as "not found" (BUG)** | **Code fix** | **3/10** | **Pass #3** |
| **GAP-043-41** | **Admin Phase 2 UPDATE not scoped to Phase 1 purchases** | **Code fix** | **2/10** | **Pass #3** |
| **GAP-043-42** | **DB-QZPay split state after admin cancel Phase 2 failure** | **Code fix + cron** | **5/10** | **Pass #3** |
| **GAP-043-43** | **Entitlement middleware privilege escalation when billing fails** | **Security fix** | **3/10** | **Pass #3** |

### P2 - Should Fix (Post-Launch Sprint)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-01 | No ADDON_CANCELLATION notification | Feature | 3/10 | Pass #1 |
| GAP-043-02 | No ADDON_PURCHASE notification | Feature | 3/10 | Pass #1 |
| GAP-043-06 | Status VARCHAR without CHECK constraint | Schema | 3/10 | Pass #1 |
| GAP-043-07 | No state transition validation | Code fix | 4/10 | Pass #1 |
| GAP-043-10 | Cron overlapping execution | Code fix | 4/10 | Pass #1 |
| GAP-043-11 | Cache invalidation race not tested (multi-instance) | Test + arch | 5/10 | Pass #1, refined #2, expanded #3 |
| GAP-043-12 | subscriptionId NULL one-time addons | New SPEC | 3/10 | Pass #1 |
| GAP-043-13 | No lifecycle metrics/alerting | Feature | 4/10 | Pass #1 |
| GAP-043-16 | Graceful degradation not fully tested | Test | 3/10 | Pass #1 |
| GAP-043-18 | Integration tests use mocks | Test | 6/10 | Pass #1 |
| GAP-043-19 | Transient billing failure recovery | Test | 4/10 | Pass #1 |
| GAP-043-24 | No retry backoff + no error classification in cron | Code fix | 3/10 | Pass #1, expanded #3 |
| GAP-043-27 | Customer-not-found edge case not tested | Test | 2/10 | Pass #1 |
| GAP-043-30 | Sentry capture missing in key paths + AC-5.x untested | Code fix + test | 2/10 | Pass #2, expanded #3 |
| GAP-043-32 | No feature flag to disable addon lifecycle | Code fix | 3/10 | Pass #2 |
| GAP-043-33 | Inconsistent error handling semantics across services | Documentation | 4/10 | Pass #2 |
| GAP-043-34 | Malformed limitAdjustments JSONB not defensively handled | Code fix | 3/10 | Pass #2, expanded #3 |
| GAP-043-35 | Rapid plan changes can overlap recalculations | Accepted risk | 5/10 | Pass #2 |
| **GAP-043-45** | **resolvePlanBaseLimit returns 0 silently for old plan** | **Code fix** | **2/10** | **Pass #3** |
| **GAP-043-46** | **Coverage thresholds at 60-70% instead of 90%** | **CI/CD fix** | **2/10** | **Pass #3** |
| **GAP-043-47** | **AC-5.x audit trail has zero test coverage** | **Test** | **4/10** | **Pass #3** |
| **GAP-043-48** | **Actual test count ~208, not 281 as claimed** | **Doc fix** | **1/10** | **Pass #3** |
| **GAP-043-50** | **Orphaned addon query has no batch size limit** | **Code fix** | **2/10** | **Pass #3** |

### P3 - Nice to Have

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-08 | Email templates not internationalized (expanded) | i18n (new SPEC) | 5/10 | Pass #1, expanded #2 |
| GAP-043-09 | canceled vs cancelled spelling | Constants | 2/10 | Pass #1 |
| GAP-043-14 | Double recalculation safety net | Accept as-is | 3/10 | Pass #1 |
| GAP-043-15 | No load test for batch expirations (expanded) | Test | 5/10 | Pass #1, expanded #3 |
| GAP-043-20 | JSONB not schema-validated at DB | Accept as-is | 3/10 | Pass #1 |
| GAP-043-21 | No audit trail for cache clears | Logging | 2/10 | Pass #1 |
| GAP-043-22 | Downgrade warning no action path | New SPEC | 4/10 | Pass #1 |
| GAP-043-23 | Missing reason in webhook cancel | Data | 2/10 | Pass #1 |
| GAP-043-25 | Addon definition changes (verified non-gap) | N/A | 0/10 | Pass #1 |
| GAP-043-26 | notification_log table not in schema | Doc | 2/10 | Pass #1 |
| GAP-043-28 | Spec status still "draft" | Housekeeping | 1/10 | Pass #1 |
| GAP-043-31 | addon-plan-change.service.ts exceeds 500-line limit | Refactor | 3/10 | Pass #2 |
| GAP-043-36 | Addon events missing from NOTIFICATION_CATEGORY_MAP | Config | 1/10 | Pass #2 |
| GAP-043-37 | Test mocks lack argument shape validation | Test quality | 3/10 | Pass #2 |
| GAP-043-38 | Admin concurrent cancel both return 200 | API behavior | 2/10 | Pass #2 |
| **GAP-043-44** | **Safety net only triggers for ACTIVE status** | **Code fix** | **2/10** | **Pass #3** |
| **GAP-043-49** | **Promo code usage recorded before payment** | **Logic fix** | **3/10** | **Pass #3** |
| **GAP-043-51** | **sendNotification fire-and-forget pattern fragile** | **Code quality** | **2/10** | **Pass #3** |

---

## Updated Recommendations for New SPECs (All 3 Passes)

> **SUPERSEDED**: These recommendations were revised in Pass #5. See "Remediation Strategy (Revised — Pass #5 Final)" section. **No new SPECs needed.**

### Already Recommended (Passes #1-#2):
1. **SPEC-047: Webhook Timeout & Background Processing** (GAP-043-03, GAP-043-10)
2. **SPEC-048: Payment Failure Lifecycle Notifications** (GAP-043-17)
3. **SPEC-049: Notification Email i18n** (GAP-043-08)
4. **SPEC-050: Addon Lifecycle Observability** (GAP-043-13, GAP-043-21)
5. **SPEC-051: Post-Downgrade Grace Period Policy** (GAP-043-22)

### New Recommendation (Pass #3):
6. **SPEC-052: Billing Fault Tolerance & Reconciliation** (GAP-043-42, GAP-043-43)
   - DB-QZPay state reconciliation cron
   - Entitlement middleware fail-closed for limits
   - Feature flag for addon lifecycle processing

### Fold into Existing SPECs:
- GAP-043-06, GAP-043-07, GAP-043-09, GAP-043-31, GAP-043-34 -> SPEC-044 (Addon Purchase Schema Cleanup)
- GAP-043-12 -> SPEC-044 or standalone

### Direct Fixes (No SPEC Needed):
- **P1 Direct Fixes (5)**: GAP-043-39, GAP-043-40, GAP-043-41, GAP-043-29, GAP-043-43
- **P2 Direct Fixes**: GAP-043-45, GAP-043-46, GAP-043-47, GAP-043-48, GAP-043-50, GAP-043-30, GAP-043-32
- **P3 Direct Fixes**: GAP-043-44, GAP-043-49, GAP-043-51, GAP-043-36, GAP-043-37, GAP-043-38

---

## Aggregate Statistics (All 3 Passes)

| Metric | Pass #1 | Pass #2 | Pass #3 | Total |
|--------|---------|---------|---------|-------|
| Gaps found | 28 | 10 | 13 | 51 |
| P1 (Must Fix) | 4 | 1 | 5 | 10 |
| P2 (Should Fix) | 13 | 5 | 5 | 23 |
| P3 (Nice to Have) | 11 | 4 | 3 | 18 |
| Verified non-gaps | 1 | 0 | 0 | 1 |
| Existing gaps upgraded | 0 | 0 | 2 | 2 |
| Existing gaps strengthened | 0 | 8 | 9 | 17 |
| New SPECs recommended | 5 | 0 | 1 | 6 |
| Direct fixes needed | 8 | 6 | 10 | 24 |
| Fold into SPEC-044 | 3 | 2 | 0 | 5 |

### P1 Must-Fix Effort Summary

| Gap | Effort | Quick Description |
|-----|--------|-------------------|
| GAP-043-39 | 2/10 | Add `clearEntitlementCache()` call (2 lines) |
| GAP-043-40 | 3/10 | Fix catch-all to only catch not-found |
| GAP-043-41 | 2/10 | Scope Phase 2 UPDATE to purchaseIds |
| GAP-043-29 | 4/10 | cancelUserAddon atomicity |
| GAP-043-43 | 3/10 | getRemainingLimit return 0 instead of -1 when billing failed |
| GAP-043-03 | 5/10 | Promise.race with 21s timeout |
| GAP-043-04 | 6/10 | Write concurrent tests |
| GAP-043-05 | 4/10 | Test partial failure paths |
| GAP-043-42 | 5/10 | Reconciliation cron for DB-QZPay split |
| GAP-043-17 | 5/10 | New SPEC for payment failure lifecycle |
| **Total P1** | **~39/100** | **10 items, ~3-4 days of focused work** |

---

## Audit Pass #4 (2026-03-17)

**Scope**: Deep cross-system analysis focusing on notification delivery paths, event orchestration patterns, i18n completeness, logger integration, and dead code. Three specialized agents analyzed in parallel:
1. Spec + Task + Previous Gaps reader (full re-read of all 51 existing gaps)
2. Code analyzer (all addon lifecycle services, routes, cron jobs, webhook handlers)
3. Notification + Event System analyzer (notification templates, types, subject builder, i18n locales, logger categories, entitlement middleware, billing config)

**Key Methodology Difference from Passes #1-#3**: This pass focused on cross-cutting system integration — verifying that every notification type has a trigger, every template is reachable, every lifecycle event has structured logging, and the overall orchestration is coherent.

---

## GAP-043-52: ADDON_EXPIRED Notification Never Dispatched

- **Audit**: Pass #4
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 3/10
- **Category**: Missing Integration
- **Decisión**: HACER — Tarea directa. Agregar sendNotification(ADDON_EXPIRED) en cron expiry loop con idempotency key.
- **Fecha decisión**: 2026-03-17

**Description**: The `ADDON_EXPIRED` notification type exists in `notification.types.ts`, the React Email template `addon-expired.tsx` exists in `packages/notifications/src/templates/addon/`, and the subject line is configured in `subject-builder.ts` ("Tu add-on {addonName} ha expirado"). However, NO code in the entire codebase actually dispatches this notification. The cron job (`addon-expiry.job.ts`) sends `ADDON_EXPIRATION_WARNING` at 3-day and 1-day marks, but when the addon actually expires.. nothing is sent. The user simply loses access with no email confirmation.

**Evidence**:
- `addon-expiry.job.ts`: Only dispatches `ADDON_EXPIRATION_WARNING` type (never `ADDON_EXPIRED`)
- `addon-expiration.service.ts`: Provides `getExpiredAddons()` query but the cron only uses it for revocation retry, not notification
- `selectTemplate()` in `notification.service.ts` has a case for `addon_expired` → `AddonExpired` component
- No grep results for `ADDON_EXPIRED` being passed to `sendNotification()` anywhere in apps/api/

**Impact**: Users who have an addon expire (especially after ignoring the 3-day and 1-day warnings) get NO confirmation email that their addon has expired. They only discover it when they try to use a feature and find it unavailable. This is a poor UX for a paid feature.

**Proposed Solution**:
1. In the cron job's expiration processing loop (where expired addons are queried), add a `sendNotification()` call with type `ADDON_EXPIRED`
2. Use the same idempotency pattern as warnings: `addon_expired:${customerId}:${addonSlug}:${YYYY-MM-DD}`
3. Send AFTER revocation processing (so the email accurately reflects that access has been removed)

**Recommendation**: Direct fix. The template, type, subject, and query infrastructure all exist. Only the dispatch call is missing. Estimated effort: 30 minutes.

---

## GAP-043-53: ADDON_RENEWAL_CONFIRMATION Template Is Dead Code

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Dead Code / Missing Integration
- **Decisión**: HACER Opción A — Identificar trigger point de renewal en webhook MercadoPago y conectar dispatch. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: The `ADDON_RENEWAL_CONFIRMATION` notification type is defined, the React Email template `addon-renewal-confirmation.tsx` exists with green success styling, and the subject line "Add-on renovado - {addonName}" is configured. However, NO code anywhere in the codebase dispatches this notification. The template is 100% dead code.

**Evidence**:
- `addon-renewal-confirmation.tsx` template exists with full green-themed success layout
- `NotificationType.ADDON_RENEWAL_CONFIRMATION` enum value defined
- Subject line configured in `subject-builder.ts`
- `selectTemplate()` has case for `addon_renewal_confirmation`
- Zero usages of `ADDON_RENEWAL_CONFIRMATION` in any `sendNotification()` call across the entire codebase
- MercadoPago handles subscription renewals externally, but addon renewals (which are managed by the cron/billing system) have no notification trigger

**Impact**: When a recurring addon renews (either automatically or manually), the user gets no branded confirmation email. They rely solely on MercadoPago payment receipts, which don't include addon-specific details like what features were renewed or expiration dates.

**Proposed Solution**:
1. Identify the renewal trigger point (likely in webhook subscription-logic.ts when MercadoPago notifies of a successful recurring payment for an addon)
2. Add `sendNotification()` call with `ADDON_RENEWAL_CONFIRMATION` type after successful DB update
3. Include addonName, amount, currency, and next renewal/expiration date in payload
4. If renewal is handled entirely by MercadoPago with no webhook callback, document this as intentional (and remove the dead template + type to avoid confusion)

**Recommendation**: P2 because MercadoPago sends its own receipt. But either wire it up or delete the dead code. Dead templates that look functional create maintenance confusion and false confidence in "complete" notification coverage.

---

## GAP-043-54: No Unified Lifecycle Event Orchestration Pattern

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10 (Opción A)
- **Category**: Architecture
- **Decisión**: HACER Opción A — Crear emitLifecycleEvent() centralizado con discriminated union tipado. Despacha a notification + logging + métricas. ~1 día. Tarea directa.
- **Fecha decisión**: 2026-03-17

**Description**: Addon lifecycle events are scattered across 5+ independent code paths with no central orchestrator or event bus:

| Lifecycle Event | Handler Location | Notification? | Logging? | Metrics? |
|----------------|-----------------|---------------|----------|----------|
| Purchase | `addon.checkout.ts` | NO | Partial | NO |
| Expiration Warning | `addon-expiry.job.ts` (cron) | YES | Partial | NO |
| Expired | `addon-expiry.job.ts` (cron) | **NO** (GAP-043-52) | Partial | NO |
| Renewal | Unknown (MercadoPago?) | **NO** (GAP-043-53) | NO | NO |
| User Cancellation | `addon.user-addons.ts` | **NO** (GAP-043-01) | Partial | NO |
| Sub Cancellation | `addon-lifecycle-cancellation.service.ts` | NO | YES | NO |
| Plan Change | `addon-plan-change.service.ts` | Conditional | YES | NO |
| Admin Cancel | `subscription-cancel.ts` route | NO | YES | NO |
| Entitlement Revoke | `addon-lifecycle.service.ts` | NO | YES | NO |
| Limit Recalc | `addon-limit-recalculation.service.ts` | NO | YES | NO |

Each handler independently decides what to log, what notifications to send (or skip), and how to handle errors. There's no guarantee that a lifecycle event consistently produces a log entry + notification + metric across all trigger paths.

**Impact**: Adding a new cross-cutting concern (e.g., "send an analytics event for every lifecycle transition") requires modifying 5+ files. Missing notification triggers (GAP-043-52, GAP-043-53, GAP-043-01, GAP-043-02) are a direct consequence of this scattered architecture.

**Proposed Solution**:
1. **Option A (Lightweight)**: Create an `AddonLifecycleEventEmitter` that each handler calls with a typed event. The emitter dispatches to notification, logging, and future metrics subscribers. ~2-3 days.
2. **Option B (Medium)**: Use an in-process pub/sub pattern (Node.js EventEmitter or a simple observer). Each lifecycle event publishes, and notification/logging/metrics subscribe. ~3-4 days.
3. **Option C (Heavy)**: Full event sourcing with an events table. Overkill for current scale.

**Recommendation**: New SPEC recommended (SPEC-053: Addon Lifecycle Event Orchestration). Option A is the pragmatic choice — a simple `emitLifecycleEvent()` function that centralizes the dispatch. Would also fix GAP-043-13 (metrics/alerting) as a side effect.

---

## GAP-043-55: No Structured Addon Lifecycle Logger Category

- **Audit**: Pass #4
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Observability
- **Decisión**: HACER — Tarea directa. Registrar categoría addon-lifecycle, crear addonLogger, integrar con emitLifecycleEvent (GAP-043-54).
- **Fecha decisión**: 2026-03-17

**Description**: The logger package (`packages/logger/src/categories.ts`) has no registered category for addon lifecycle events. All addon lifecycle code uses the generic `apiLogger` for logging, which means addon lifecycle log entries are mixed with all other API logs and cannot be filtered, silenced, or elevated independently.

**Evidence**:
- `packages/logger/src/categories.ts`: No "addon", "addon-lifecycle", or "billing-addon" category registered
- All service files use `apiLogger.info/warn/error()` directly
- Spec AC-5.1 requires "structured revocation logs" and AC-5.2 requires "apiLogger pattern" — but there's no way to filter addon-specific logs from the noise

**Impact**: In production, debugging addon lifecycle issues requires searching through ALL API logs with grep patterns. Cannot set addon lifecycle to DEBUG while keeping everything else at INFO. Cannot route addon lifecycle logs to a dedicated monitoring channel.

**Proposed Solution**:
1. Register `addon-lifecycle` category in `packages/logger/src/categories.ts`
2. Create a named logger: `const addonLogger = createLogger('addon-lifecycle')`
3. Replace `apiLogger` calls in all 6 addon lifecycle service files with `addonLogger`
4. Add environment config key for the category level

**Recommendation**: Direct fix, low effort. Would significantly improve production debugging. Can be done as part of GAP-043-13 (metrics/alerting) or independently.

---

## GAP-043-56: Cron Phase 4 and Webhook Concurrent Metadata Race on Same Purchase Row

- **Audit**: Pass #4
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 4/10
- **Category**: Data Consistency
- **Decisión**: HACER — Tarea directa. Agregar SELECT ... FOR UPDATE SKIP LOCKED en query de cron Phase 4.
- **Fecha decisión**: 2026-03-17

**Description**: Cron Phase 4 (orphaned addon retry) and the webhook subscription cancellation handler can both attempt to revoke the same addon purchase simultaneously. Both update the purchase row's JSONB metadata (`revocationRetryCount`, `lastRevocationAttempt`) and status. Since these are separate database operations (not in a shared transaction), the metadata update from one can overwrite the other's.

**Evidence**:
- Cron Phase 4 in `addon-expiry.job.ts`: Queries addons with `status='active'` and subscription `status='cancelled'`, then processes them one by one
- Webhook handler in `addon-lifecycle-cancellation.service.ts`: Also processes addons with `status='active'` for a cancelled subscription
- Both use separate UPDATE statements on the same rows
- No `SELECT ... FOR UPDATE` or optimistic locking (version column) to prevent concurrent writes
- GAP-043-04 covers webhook+admin race condition but does NOT cover cron+webhook on the same purchase

**Impact**: If cron Phase 4 runs while a webhook is processing the same subscription cancellation:
- Metadata could lose retry count (cron sets count=1, webhook overwrites with its own count)
- Both could attempt QZPay revocation for the same addon (one succeeds, one fails with "already revoked")
- Status could flip-flop if timing is unlucky

**Proposed Solution**:
1. **Quick fix**: Add `SELECT ... FOR UPDATE SKIP LOCKED` in cron Phase 4 query — if a row is locked by the webhook, cron skips it and retries next cycle
2. **Better fix**: Add a `processing_lock` timestamp column. Set it before processing, clear after. Skip rows locked within last 5 minutes. This is idempotent across Vercel serverless instances.
3. **Best fix**: Use PostgreSQL advisory locks keyed on purchase ID

**Recommendation**: Direct fix with option 1 (SKIP LOCKED). Simple, standard PostgreSQL pattern. Prevents the race without changing the architecture.

---

## Pass #4 Acceptance Criteria Re-Verification

| AC | Pass #3 Status | Pass #4 Status | Change? |
|----|---------------|----------------|---------|
| AC-1.1 | PASS | PASS | No change |
| AC-1.2 | PASS | PASS | No change |
| AC-1.3 | PARTIAL | PARTIAL | No change — retry tracking works but Sentry per-item still missing |
| AC-1.4 | FALSE POSITIVE | FALSE POSITIVE | No change — test exists but doesn't verify filter |
| AC-1.5 | PASS | PASS | No change |
| AC-1.6 | PASS | PASS | No change |
| AC-1.7 | PASS | PASS | No change |
| AC-1.8 | PASS | PASS | No change |
| AC-1.9 | **FAIL** | **FAIL** | No change — GAP-043-40 still unfixed |
| AC-1.10 | PARTIAL | PARTIAL | No change — 22s timeout still missing |
| AC-2.1 | DIVERGENCE | DIVERGENCE | No change — GAP-043-42 still open |
| AC-2.2 | PASS | PASS | No change |
| AC-2.3 | PASS | PASS | No change |
| AC-2.4 | PASS | PASS | No change |
| AC-3.1 | PASS | PASS | No change |
| AC-3.2 | PASS | PASS | No change |
| AC-3.3 | PASS | PASS | No change |
| AC-3.4 | PASS | PASS | No change |
| AC-3.5 | PASS | PASS | No change |
| AC-3.6 | PASS | PASS | No change |
| AC-3.7 | PARTIAL | PARTIAL | No change — GAP-043-44 |
| AC-3.8 | PASS | PASS | No change |
| AC-3.9 | PARTIAL | PARTIAL | No change — GAP-043-39 |
| AC-4.1 | PASS | PASS | No change |
| AC-4.2 | PASS | PASS | No change |
| AC-4.3 | PASS | PASS | No change |
| AC-4.4 | PASS | PASS | No change |
| AC-5.1 | PASS (untested) | **WEAKENED** | Structured logs use generic apiLogger, no dedicated category (GAP-043-55) |
| AC-5.2 | PASS (untested) | **WEAKENED** | Same — no filterable addon category |
| AC-5.3 | PARTIAL | PARTIAL | No change |

---

## Pass #4 New Gaps Summary

| Gap | Severity | Priority | Complexity | Category |
|-----|----------|----------|------------|----------|
| GAP-043-52 | HIGH | P1 | 3/10 | Missing Integration |
| GAP-043-53 | MEDIUM | P2 | 4/10 | Dead Code |
| GAP-043-54 | MEDIUM | P2 | 6/10 | Architecture |
| GAP-043-55 | LOW | P3 | 2/10 | Observability |
| GAP-043-56 | MEDIUM | P2 | 4/10 | Data Consistency |

---

## Updated Priority Summary (All 4 Passes)

### P1 - Must Fix (Before Production)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-03 | 22-second webhook timeout not enforced | Code fix | 5/10 | Pass #1 |
| GAP-043-04 | Race condition webhook+admin not tested | Test | 6/10 | Pass #1 |
| GAP-043-05 | Partial failure retry flow not tested | Test + spec clarification | 4/10 | Pass #1 |
| GAP-043-17 | MercadoPago auto-cancel after 3 failures | New SPEC | 5/10 | Pass #1 |
| GAP-043-29 | cancelUserAddon() returns success despite failed recalc | Code fix | 4/10 | Pass #2 |
| GAP-043-39 | AC-3.9 cache not invalidated after limit recalc in cancelUserAddon | Code fix | 2/10 | Pass #3 |
| GAP-043-40 | AC-1.9 customer check catches ALL errors as "not found" (BUG) | Code fix | 3/10 | Pass #3 |
| GAP-043-41 | Admin Phase 2 UPDATE not scoped to Phase 1 purchases | Code fix | 2/10 | Pass #3 |
| GAP-043-42 | DB-QZPay split state after admin cancel Phase 2 failure | Code fix + cron | 5/10 | Pass #3 |
| GAP-043-43 | Entitlement middleware privilege escalation when billing fails | Security fix | 3/10 | Pass #3 |
| **GAP-043-52** | **ADDON_EXPIRED notification never dispatched (template exists, no trigger)** | **Code fix** | **3/10** | **Pass #4** |

### P2 - Should Fix (Post-Launch Sprint)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-01 | No ADDON_CANCELLATION notification | Feature | 3/10 | Pass #1 |
| GAP-043-02 | No ADDON_PURCHASE notification | Feature | 3/10 | Pass #1 |
| GAP-043-06 | Status VARCHAR without CHECK constraint | Schema | 3/10 | Pass #1 |
| GAP-043-07 | No state transition validation | Code fix | 4/10 | Pass #1 |
| GAP-043-10 | Cron overlapping execution | Code fix | 4/10 | Pass #1 |
| GAP-043-11 | Cache invalidation race not tested (multi-instance) | Test + arch | 5/10 | Pass #1, refined #2, expanded #3 |
| GAP-043-12 | subscriptionId NULL one-time addons | New SPEC | 3/10 | Pass #1 |
| GAP-043-13 | No lifecycle metrics/alerting | Feature | 4/10 | Pass #1 |
| GAP-043-16 | Graceful degradation not fully tested | Test | 3/10 | Pass #1 |
| GAP-043-18 | Integration tests use mocks | Test | 6/10 | Pass #1 |
| GAP-043-19 | Transient billing failure recovery | Test | 4/10 | Pass #1 |
| GAP-043-24 | No retry backoff + no error classification in cron | Code fix | 3/10 | Pass #1, expanded #3 |
| GAP-043-27 | Customer-not-found edge case not tested | Test | 2/10 | Pass #1 |
| GAP-043-30 | Sentry capture missing in key paths + AC-5.x untested | Code fix + test | 2/10 | Pass #2, expanded #3 |
| GAP-043-32 | No feature flag to disable addon lifecycle | Code fix | 3/10 | Pass #2 |
| GAP-043-33 | Inconsistent error handling semantics across services | Documentation | 4/10 | Pass #2 |
| GAP-043-34 | Malformed limitAdjustments JSONB not defensively handled | Code fix | 3/10 | Pass #2, expanded #3 |
| GAP-043-35 | Rapid plan changes can overlap recalculations | Accepted risk | 5/10 | Pass #2 |
| GAP-043-45 | resolvePlanBaseLimit returns 0 silently for old plan | Code fix | 2/10 | Pass #3 |
| GAP-043-46 | Coverage thresholds at 60-70% instead of 90% | CI/CD fix | 2/10 | Pass #3 |
| GAP-043-47 | AC-5.x audit trail has zero test coverage | Test | 4/10 | Pass #3 |
| GAP-043-48 | Actual test count ~208, not 281 as claimed | Doc fix | 1/10 | Pass #3 |
| GAP-043-50 | Orphaned addon query has no batch size limit | Code fix | 2/10 | Pass #3 |
| **GAP-043-53** | **ADDON_RENEWAL_CONFIRMATION template is dead code (never triggered)** | **Dead code / Feature** | **4/10** | **Pass #4** |
| **GAP-043-54** | **No unified lifecycle event orchestration pattern** | **Architecture** | **6/10** | **Pass #4** |
| **GAP-043-56** | **Cron Phase 4 + webhook concurrent metadata race on same purchase** | **Code fix** | **4/10** | **Pass #4** |

### P3 - Nice to Have

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-08 | Email templates not internationalized (expanded) | i18n (new SPEC) | 5/10 | Pass #1, expanded #2 |
| GAP-043-09 | canceled vs cancelled spelling | Constants | 2/10 | Pass #1 |
| GAP-043-14 | Double recalculation safety net | Accept as-is | 3/10 | Pass #1 |
| GAP-043-15 | No load test for batch expirations (expanded) | Test | 5/10 | Pass #1, expanded #3 |
| GAP-043-20 | JSONB not schema-validated at DB | Accept as-is | 3/10 | Pass #1 |
| GAP-043-21 | No audit trail for cache clears | Logging | 2/10 | Pass #1 |
| GAP-043-22 | Downgrade warning no action path | New SPEC | 4/10 | Pass #1 |
| GAP-043-23 | Missing reason in webhook cancel | Data | 2/10 | Pass #1 |
| GAP-043-25 | Addon definition changes (verified non-gap) | N/A | 0/10 | Pass #1 |
| GAP-043-26 | notification_log table not in schema | Doc | 2/10 | Pass #1 |
| GAP-043-28 | Spec status still "draft" | Housekeeping | 1/10 | Pass #1 |
| GAP-043-31 | addon-plan-change.service.ts exceeds 500-line limit | Refactor | 3/10 | Pass #2 |
| GAP-043-36 | Addon events missing from NOTIFICATION_CATEGORY_MAP | Config | 1/10 | Pass #2 |
| GAP-043-37 | Test mocks lack argument shape validation | Test quality | 3/10 | Pass #2 |
| GAP-043-38 | Admin concurrent cancel both return 200 | API behavior | 2/10 | Pass #2 |
| GAP-043-44 | Safety net only triggers for ACTIVE status | Code fix | 2/10 | Pass #3 |
| GAP-043-49 | Promo code usage recorded before payment | Logic fix | 3/10 | Pass #3 |
| GAP-043-51 | sendNotification fire-and-forget pattern fragile | Code quality | 2/10 | Pass #3 |
| **GAP-043-55** | **No structured addon lifecycle logger category** | **Observability** | **2/10** | **Pass #4** |

---

## Updated Recommendations for New SPECs (All 4 Passes)

> **SUPERSEDED**: These recommendations were revised in Pass #5. See "Remediation Strategy (Revised — Pass #5 Final)" section. **No new SPECs needed.**

### Already Recommended (Passes #1-#3):
1. **SPEC-047: Webhook Timeout & Background Processing** (GAP-043-03, GAP-043-10)
2. **SPEC-048: Payment Failure Lifecycle Notifications** (GAP-043-17)
3. **SPEC-049: Notification Email i18n** (GAP-043-08)
4. **SPEC-050: Addon Lifecycle Observability** (GAP-043-13, GAP-043-21, GAP-043-55)
5. **SPEC-051: Post-Downgrade Grace Period Policy** (GAP-043-22)
6. **SPEC-052: Billing Fault Tolerance & Reconciliation** (GAP-043-42, GAP-043-43)

### New Recommendation (Pass #4):
7. **SPEC-053: Addon Lifecycle Event Orchestration** (GAP-043-54, GAP-043-52, GAP-043-53, GAP-043-01, GAP-043-02)
   - Central event emitter for all addon lifecycle transitions
   - Ensures every event produces notification + log + metric
   - Eliminates scattered dispatch logic and dead code
   - Would fix 5 existing gaps as a side effect

### Fold into Existing SPECs:
- GAP-043-06, GAP-043-07, GAP-043-09, GAP-043-31, GAP-043-34 → SPEC-044 (Addon Purchase Schema Cleanup)
- GAP-043-12 → SPEC-044 or standalone
- GAP-043-55 → SPEC-050 (Observability)
- GAP-043-56 → SPEC-052 (Fault Tolerance) or direct fix

### Direct Fixes (No SPEC Needed):
- **P1 Direct Fixes (6)**: GAP-043-39, GAP-043-40, GAP-043-41, GAP-043-29, GAP-043-43, GAP-043-52
- **P2 Direct Fixes**: GAP-043-45, GAP-043-46, GAP-043-47, GAP-043-48, GAP-043-50, GAP-043-30, GAP-043-32, GAP-043-56
- **P3 Direct Fixes**: GAP-043-44, GAP-043-49, GAP-043-51, GAP-043-36, GAP-043-37, GAP-043-38

---

## Aggregate Statistics (All 4 Passes)

| Metric | Pass #1 | Pass #2 | Pass #3 | Pass #4 | Total |
|--------|---------|---------|---------|---------|-------|
| Gaps found | 28 | 10 | 13 | 5 | 56 |
| P1 (Must Fix) | 4 | 1 | 5 | 1 | 11 |
| P2 (Should Fix) | 13 | 5 | 5 | 3 | 26 |
| P3 (Nice to Have) | 11 | 4 | 3 | 1 | 19 |
| Verified non-gaps | 1 | 0 | 0 | 0 | 1 |
| Existing gaps upgraded | 0 | 0 | 2 | 0 | 2 |
| Existing gaps strengthened | 0 | 8 | 9 | 2 | 19 |
| New SPECs recommended | 5 | 0 | 1 | 1 | 7 |
| Direct fixes needed | 8 | 6 | 10 | 3 | 27 |
| Fold into SPEC-044 | 3 | 2 | 0 | 0 | 5 |

### P1 Must-Fix Effort Summary (Updated)

| Gap | Effort | Quick Description |
|-----|--------|-------------------|
| GAP-043-39 | 2/10 | Add `clearEntitlementCache()` call (2 lines) |
| GAP-043-40 | 3/10 | Fix catch-all to only catch not-found |
| GAP-043-41 | 2/10 | Scope Phase 2 UPDATE to purchaseIds |
| GAP-043-29 | 4/10 | cancelUserAddon atomicity |
| GAP-043-43 | 3/10 | getRemainingLimit return 0 instead of -1 when billing failed |
| GAP-043-52 | 3/10 | Add sendNotification(ADDON_EXPIRED) in cron expiry loop |
| GAP-043-03 | 5/10 | Promise.race with 21s timeout |
| GAP-043-04 | 6/10 | Write concurrent tests |
| GAP-043-05 | 4/10 | Test partial failure paths |
| GAP-043-42 | 5/10 | Reconciliation cron for DB-QZPay split |
| GAP-043-17 | 5/10 | New SPEC for payment failure lifecycle |
| **Total P1** | **~42/110** | **11 items, ~4-5 days of focused work** |

### Pass #4 Strengthened Existing Gaps

| Existing Gap | Pass #4 Observation |
|-------------|---------------------|
| GAP-043-13 | Strengthened: No logger category means no per-system observability. GAP-043-55 is a sub-finding that feeds into this gap. |
| GAP-043-01/02 | Strengthened: The missing notifications are now understood as part of a systemic pattern (GAP-043-54) — not isolated omissions but a consequence of having no central event orchestrator. |

---

## Audit Pass #5 (2026-03-17)

**Scope**: Deep exhaustive cross-verification of SPEC-043 against actual implementation code, focused on confirming/refuting all 56 previous gaps with fresh evidence, finding new gaps through direct code reading, and producing a definitive production-readiness assessment.

**Methodology**: 3 specialized agents analyzed in parallel + direct code verification by lead auditor:
1. Source code analyzer (22 files: all services, routes, middleware, cron, notifications)
2. Test file analyzer (13 test files: exact test counts, AC coverage matrix, mock quality)
3. DB schema + notifications + i18n analyzer (schema, templates, subject builder, locales, billing config)
4. Lead auditor direct verification (targeted grep/read on critical bug locations)

**Key Methodology Difference from Passes #1-#4**: This pass prioritized DIRECT CODE VERIFICATION of all P1 gaps with line-level evidence, rather than relying solely on agent reports. Every P1 gap was independently verified against the actual codebase.

---

## Pass #5: P1 Gap Direct Verification Results

### GAP-043-39: CONFIRMED (CRITICAL) — Cache Not Invalidated After cancelUserAddon Recalculation

**Direct verification**: `grep -r "clearEntitlementCache" addon.user-addons.ts` returns ZERO matches. `grep -r "clearEntitlementCache" addon-limit-recalculation.service.ts` also returns ZERO matches.

**Impact**: After canceling a limit-type addon, the user retains the addon's limit increase in the entitlement middleware cache for up to 5 minutes. They can upload photos, create accommodations, etc. beyond their real limit during this window.

**Fix**: 2 lines of code. Add `clearEntitlementCache(input.customerId)` after the recalculation call in `cancelUserAddon()` (~line 424 in `addon.user-addons.ts`).

### GAP-043-40: CONFIRMED (CRITICAL) — Customer Existence Check Catches ALL Errors

**Direct verification at `subscription-logic.ts` lines 424-450**:
```typescript
try {
    await billing.customers.get(localSubscription.customerId);
} catch {
    customerExists = false;
}
```

The bare `catch {}` with no error type discrimination treats network timeouts, DB connection failures, and QZPay 500s as "customer not found". The handler then returns HTTP 200, telling MercadoPago "all good, don't retry". Addon cleanup is permanently skipped. No cron safety net catches this case because the subscription status may not yet be `cancelled` in the local DB at this point.

**Fix**: 3 lines. Check for actual not-found response instead of catching all errors. Let infrastructure errors propagate as 500 for MercadoPago retry.

### GAP-043-41: CONFIRMED (HIGH) — Admin Phase 2 UPDATE Not Scoped to Phase 1 Purchases

**Direct verification at `subscription-cancel.ts` lines 329-345**:
```typescript
const purchaseIds = activePurchases.map((p) => p.id);  // Declared...
await trx.update(billingAddonPurchases).set({...}).where(
    and(
        eq(billingAddonPurchases.subscriptionId, id),    // ...but NOT used here
        eq(billingAddonPurchases.status, 'active'),
        isNull(billingAddonPurchases.deletedAt)
    )
);
```

`purchaseIds` is declared at line 330 but NEVER used in the WHERE clause. The UPDATE uses `subscriptionId + status='active'` which catches ANY active purchase for that subscription, including ones created by a concurrent checkout between Phase 1 and Phase 2.

**Fix**: 1 line. Change WHERE to use `inArray(billingAddonPurchases.id, purchaseIds)` instead of `eq(subscriptionId, id) AND eq(status, 'active')`.

### GAP-043-43: CONFIRMED (HIGH) — Entitlement Middleware Privilege Escalation

**Direct verification at `entitlement.ts` lines 520-525**:
```typescript
export function getRemainingLimit(c: Context<AppBindings>, key: LimitKey): number {
    const limits = c.get('userLimits');
    if (!limits || !limits.has(key)) {
        return -1;  // -1 = unlimited per QZPay convention
    }
```

When billing fails and the fail-open pattern sets an empty `userLimits` Map, ALL limit checks return `-1` (unlimited). A customer with no subscription can access all features during a billing outage.

**Nuance**: This is a deliberate fail-open design choice (not a bug), but the spec assumes fail-closed for limits. The spec should document this tradeoff. If fail-open is intended, add monitoring for billing load failures. If fail-closed is required, change to `return 0`.

### GAP-043-42: CONFIRMED (HIGH) — DB-QZPay Split State After Admin Cancel

**Direct verification at `subscription-cancel.ts` lines 352-430**: The DB transaction commits (subscription marked `cancelled` in local DB), then QZPay cancel is attempted OUTSIDE the transaction. If QZPay cancel fails, the system enters split state: local DB says cancelled, QZPay says active. MercadoPago continues billing the customer.

The code returns 500 and reports to Sentry, but there is NO automated reconciliation. The cron job's Phase 4 only handles addon purchases, not subscription status reconciliation.

---

## Pass #5: New Gaps Found

### GAP-043-57: confirmAddonPurchase() Does Not Verify Subscription Is Still Active (AC-1.8 Constraint)

- **Audit**: Pass #5
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 3/10
- **Category**: Missing Validation / Spec Requirement
- **Decisión**: HACER — Tarea directa. Agregar re-check de subscription status en confirmAddonPurchase() antes del INSERT. 5 líneas.
- **Fecha decisión**: 2026-03-17

**Description**: AC-1.8 explicitly states: "The addon purchase confirmation flow (outside this spec) MUST verify the subscription is still active before confirming a pending purchase. If the subscription is cancelled, confirmation must fail." However, the spec marks this as "outside this spec" while the implementation in `addon.checkout.ts` (`confirmAddonPurchase()`) does NOT check subscription status before confirming. If a webhook cancels the subscription while a checkout is pending, the confirmation succeeds and creates an active addon on a cancelled subscription.

**Evidence**:
- `addon.checkout.ts` `confirmAddonPurchase()`: no subscription status check before updating purchase to `active`
- AC-1.8 note: "addon purchase confirmation flow (outside this spec) MUST verify..."
- No grep results for subscription status check in `confirmAddonPurchase`

**Proposed Solution**:
1. Before confirming an addon purchase, query the subscription and verify `status !== 'cancelled'`
2. If cancelled, return error and leave purchase as `pending` (will expire naturally)
3. Add test: subscription cancelled during checkout -> confirmation fails

**Recommendation**: Direct fix. Critical for data consistency. Without this, the cron job's orphaned addon detection won't catch it (the subscription IS in `billing_subscriptions` but the addon was created AFTER cancellation).

---

### GAP-043-58: Cron Phase 4 Queries billing_subscriptions Without Joining Through QZPay

- **Audit**: Pass #5
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 3/10
- **Category**: Data Consistency
- **Decisión**: HACER — Tarea directa. Verificar status de suscripción en QZPay antes de revocar addons en cron Phase 4.
- **Fecha decisión**: 2026-03-17

**Description**: The cron job Phase 4 (orphaned addon retry) queries for addon purchases where the linked subscription has `status = 'cancelled'` in the LOCAL `billing_subscriptions` table. But GAP-043-42 shows that the local status can be `cancelled` while QZPay still has it as `active`. This means Phase 4 could attempt to revoke addons for a subscription that QZPay still considers active, creating a mismatch between QZPay entitlement state and local addon purchase state.

**Evidence**:
- Cron Phase 4 subquery: `WHERE subscriptionId IN (SELECT id FROM billing_subscriptions WHERE status = 'cancelled')`
- GAP-043-42: local DB can show `cancelled` while QZPay shows `active`

**Proposed Solution**:
1. In the cron's orphaned addon handler, verify the subscription is actually cancelled in QZPay before revoking
2. Or accept this as intentional behavior (addons should be revoked if local DB says cancelled, regardless of QZPay state)

**Recommendation**: Accept as-is with documentation. The revocation operations are idempotent. If QZPay cancel later succeeds, no harm done.

---

### GAP-043-59: No Idempotency Key for Plan Downgrade Notification

- **Audit**: Pass #5
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 2/10
- **Category**: Notification Quality
- **Decisión**: HACER — Tarea directa. Agregar idempotencyKey con customerId+limitKey+date. 1 línea.
- **Fecha decisión**: 2026-03-17

**Description**: The `PLAN_DOWNGRADE_LIMIT_WARNING` notification dispatch in `addon-plan-change.service.ts` does not include an idempotency key. If the plan change route is called twice (e.g., user clicks "confirm" twice rapidly, or webhook safety net fires after route), the same notification could be sent twice.

**Evidence**:
- `addon-plan-change.service.ts`: `sendNotification()` call for downgrade warning has no `idempotencyKey` field
- The addon expiration warning in `addon-expiry.job.ts` DOES use idempotency keys (e.g., `addon_expiration_warning:${customerId}:${addonSlug}:${date}`)

**Proposed Solution**:
1. Add `idempotencyKey: \`plan_downgrade_limit_warning:${customerId}:${limitKey}:${new Date().toISOString().slice(0,10)}\``

**Recommendation**: Direct fix. 1 line. Prevents duplicate notifications.

---

### GAP-043-60: addon-plan-change.service.ts sendNotification Called Without userId

- **Audit**: Pass #5
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Bug / Notification Failure
- **Decisión**: HACER — Tarea directa. Verificar userId en payload de downgrade notification, resolver vía billing.customers.get si falta.
- **Fecha decisión**: 2026-03-17

**Description**: The spec's audit-v7 fix #7 states: "PlanDowngradeLimitWarningPayload now documents that BaseNotificationPayload requires userId field." The `sendNotification` call in `addon-plan-change.service.ts` for the downgrade warning must include `userId` in the payload. If `userId` is missing or null, the notification service may fail silently or route to the wrong user.

**Evidence**:
- `BaseNotificationPayload` requires: `userId`, `recipientEmail`, `recipientName`, `customerId?`
- Need to verify the actual payload construction in `addon-plan-change.service.ts` includes all required fields

**Proposed Solution**:
1. Verify that `userId` is resolved and passed in the notification payload
2. If missing, resolve via `billing.customers.get(customerId)` and extract userId

**Recommendation**: Verify and fix if needed. Medium priority because a missing required field would cause the notification to fail (not silently succeed with wrong data).

---

## Pass #5: Re-Verification of All Previous AC Status

| AC | Pass #4 Status | Pass #5 Status | Change? | Evidence |
|----|----------------|----------------|---------|----------|
| AC-1.1 | PASS | PASS | No | Revocation + DB update logic confirmed |
| AC-1.2 | PASS | PASS | No | WHERE status='active' guard confirmed |
| AC-1.3 | PARTIAL | PARTIAL | No | Sentry at end of loop, not per-item |
| AC-1.4 | FALSE POSITIVE | FALSE POSITIVE | No | Test filter issue unchanged |
| AC-1.5 | PASS | PASS | No | Empty result -> 200 OK |
| AC-1.6 | PASS | PASS | No | Sequential per-addon commit |
| AC-1.7 | PASS | PASS | No | Both channels on undefined addon |
| AC-1.8 | PASS | **PARTIAL** | **YES** | Code passes but constraint note says "MUST verify subscription active" — not implemented (GAP-043-57) |
| AC-1.9 | **FAIL** | **FAIL** | No | catch-all BUG confirmed (GAP-043-40) |
| AC-1.10 | PARTIAL | PARTIAL | No | 22s hard limit still missing |
| AC-2.1 | DIVERGENCE | DIVERGENCE | No | DB before QZPay confirmed |
| AC-2.2 | PASS | **PARTIAL** | **YES** | Phase 2 UPDATE scope bug (GAP-043-41) |
| AC-2.3 | PASS | PASS | No | Route registered |
| AC-2.4 | PASS | PASS | No | Already-cancelled returns 400 |
| AC-3.1 | PASS | PASS | No | Upgrade limits correct |
| AC-3.2 | PASS | PASS | No | SUM aggregation correct |
| AC-3.3 | PASS | PASS | No | Entitlement addons skipped |
| AC-3.4 | PASS | PASS | No | No limit addons -> early exit |
| AC-3.5 | PASS | PASS | No | Unlimited (-1) -> skip |
| AC-3.6 | PASS | PASS | No | Base 0 for missing limit |
| AC-3.7 | PARTIAL | PARTIAL | No | Only ACTIVE status triggers |
| AC-3.8 | PASS | PASS | No | Plan-change route triggers recalc |
| AC-3.9 | PARTIAL | PARTIAL | No | Cache not invalidated (GAP-043-39) |
| AC-4.1 | PASS | PASS | No | Downgrade correct |
| AC-4.2 | PASS | PASS | No | Below limit -> no warning |
| AC-4.3 | PASS | PASS | No | Above limit -> notification |
| AC-4.4 | PASS | PASS | No | Can't read usage -> proceed |
| AC-5.1 | WEAKENED | WEAKENED | No | Generic apiLogger, no category |
| AC-5.2 | WEAKENED | WEAKENED | No | Same |
| AC-5.3 | PARTIAL | PARTIAL | No | Sentry used but gaps remain |

**Pass #5 AC Results**: 18 PASS, 7 PARTIAL, 1 FAIL, 1 DIVERGENCE, 1 FALSE POSITIVE

---

## Pass #5: Previous Gap Updates

### GAP-043-39 through GAP-043-43 (All 5 P1 gaps from Pass #3)
**Status**: ALL INDEPENDENTLY CONFIRMED via direct code verification with line-level evidence. See "P1 Gap Direct Verification Results" section above.

### GAP-043-52 (ADDON_EXPIRED never dispatched)
**Status**: CONFIRMED. No `sendNotification` call with `ADDON_EXPIRED` type found anywhere in codebase.

### GAP-043-53 (ADDON_RENEWAL_CONFIRMATION dead code)
**Status**: CONFIRMED. Template exists, enum value exists, subject line exists, but zero dispatch calls.

### GAP-043-56 (Cron + webhook metadata race)
**Status**: CONFIRMED. No `FOR UPDATE SKIP LOCKED` or advisory lock in cron Phase 4 query.

---

## Updated Priority Summary (All 5 Passes)

### P1 - Must Fix (Before Production) — 12 items

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-39 | Cache not invalidated after cancelUserAddon recalc | Code fix | 2/10 | Pass #3, confirmed #5 |
| GAP-043-40 | Customer check catches ALL errors as "not found" (BUG) | Code fix | 3/10 | Pass #3, confirmed #5 |
| GAP-043-41 | Admin Phase 2 UPDATE not scoped to Phase 1 purchases | Code fix | 2/10 | Pass #3, confirmed #5 |
| GAP-043-43 | Entitlement middleware privilege escalation on billing fail | Security fix | 3/10 | Pass #3, confirmed #5 |
| GAP-043-29 | cancelUserAddon() returns success despite failed recalc | Code fix | 4/10 | Pass #2 |
| GAP-043-52 | ADDON_EXPIRED notification never dispatched | Code fix | 3/10 | Pass #4, confirmed #5 |
| GAP-043-42 | DB-QZPay split state after admin cancel Phase 2 failure | Code fix + cron | 5/10 | Pass #3, confirmed #5 |
| GAP-043-03 | 22-second webhook timeout not enforced | Code fix | 5/10 | Pass #1 |
| GAP-043-04 | Race condition webhook+admin not tested | Test | 6/10 | Pass #1 |
| GAP-043-05 | Partial failure retry flow not tested | Test + spec clarify | 4/10 | Pass #1 |
| GAP-043-17 | MercadoPago auto-cancel after 3 failures | New SPEC | 5/10 | Pass #1 |
| **GAP-043-57** | **confirmAddonPurchase() doesn't verify subscription active (AC-1.8 constraint)** | **Code fix** | **3/10** | **Pass #5** |

### P2 - Should Fix (Post-Launch Sprint) — 27 items

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-01 | No ADDON_CANCELLATION notification | Feature | 3/10 | Pass #1 |
| GAP-043-02 | No ADDON_PURCHASE notification | Feature | 3/10 | Pass #1 |
| GAP-043-06 | Status VARCHAR without CHECK constraint | Schema | 3/10 | Pass #1 |
| GAP-043-07 | No state transition validation | Code fix | 4/10 | Pass #1 |
| GAP-043-10 | Cron overlapping execution | Code fix | 4/10 | Pass #1 |
| GAP-043-11 | Cache invalidation race (multi-instance) | Test + arch | 5/10 | Pass #1-3 |
| GAP-043-12 | subscriptionId NULL one-time addons | New SPEC | 3/10 | Pass #1 |
| GAP-043-13 | No lifecycle metrics/alerting | Feature | 4/10 | Pass #1 |
| GAP-043-16 | Graceful degradation not fully tested | Test | 3/10 | Pass #1 |
| GAP-043-18 | Integration tests use mocks | Test | 6/10 | Pass #1 |
| GAP-043-19 | Transient billing failure recovery tests | Test | 4/10 | Pass #1 |
| GAP-043-24 | No retry backoff + no error classification | Code fix | 3/10 | Pass #1, #3 |
| GAP-043-27 | Customer-not-found edge case not tested | Test | 2/10 | Pass #1 |
| GAP-043-30 | Sentry capture missing in key paths | Code fix + test | 2/10 | Pass #2-3 |
| GAP-043-32 | No feature flag to disable addon lifecycle | Code fix | 3/10 | Pass #2 |
| GAP-043-33 | Inconsistent error handling semantics | Documentation | 4/10 | Pass #2 |
| GAP-043-34 | Malformed limitAdjustments JSONB not handled | Code fix | 3/10 | Pass #2-3 |
| GAP-043-35 | Rapid plan changes can overlap | Accepted risk | 5/10 | Pass #2 |
| GAP-043-45 | resolvePlanBaseLimit returns 0 silently for old plan | Code fix | 2/10 | Pass #3 |
| GAP-043-46 | Coverage thresholds at 60-70% instead of 90% | CI/CD fix | 2/10 | Pass #3 |
| GAP-043-47 | AC-5.x audit trail has zero test coverage | Test | 4/10 | Pass #3 |
| GAP-043-48 | Actual test count ~208, not 281 as claimed | Doc fix | 1/10 | Pass #3 |
| GAP-043-50 | Orphaned addon query has no batch size limit | Code fix | 2/10 | Pass #3 |
| GAP-043-53 | ADDON_RENEWAL_CONFIRMATION template dead code | Dead code | 4/10 | Pass #4 |
| GAP-043-54 | No unified lifecycle event orchestration | Architecture | 6/10 | Pass #4 |
| GAP-043-56 | Cron Phase 4 + webhook concurrent metadata race | Code fix | 4/10 | Pass #4 |
| **GAP-043-60** | **sendNotification for downgrade may miss userId** | **Bug / Verify** | **2/10** | **Pass #5** |

### P3 - Nice to Have — 20 items

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| GAP-043-08 | Email templates not internationalized | i18n (new SPEC) | 5/10 | Pass #1, #2 |
| GAP-043-09 | canceled vs cancelled spelling | Constants | 2/10 | Pass #1 |
| GAP-043-14 | Double recalculation safety net | Accept as-is | 3/10 | Pass #1 |
| GAP-043-15 | No load test for batch expirations | Test | 5/10 | Pass #1, #3 |
| GAP-043-20 | JSONB not schema-validated at DB | Accept as-is | 3/10 | Pass #1 |
| GAP-043-21 | No audit trail for cache clears | Logging | 2/10 | Pass #1 |
| GAP-043-22 | Downgrade warning no action path | New SPEC | 4/10 | Pass #1 |
| GAP-043-23 | Missing reason in webhook cancel | Data | 2/10 | Pass #1 |
| GAP-043-25 | Addon definition changes (verified non-gap) | N/A | 0/10 | Pass #1 |
| GAP-043-26 | notification_log table not in schema | Doc | 2/10 | Pass #1 |
| GAP-043-28 | Spec status still "draft" | Housekeeping | 1/10 | Pass #1 |
| GAP-043-31 | addon-plan-change.service.ts exceeds 500-line limit | Refactor | 3/10 | Pass #2 |
| GAP-043-36 | Addon events missing from NOTIFICATION_CATEGORY_MAP | Config | 1/10 | Pass #2 |
| GAP-043-37 | Test mocks lack argument shape validation | Test quality | 3/10 | Pass #2 |
| GAP-043-38 | Admin concurrent cancel both return 200 | API behavior | 2/10 | Pass #2 |
| GAP-043-44 | Safety net only triggers for ACTIVE status | Code fix | 2/10 | Pass #3 |
| GAP-043-49 | Promo code usage recorded before payment | Logic fix | 3/10 | Pass #3 |
| GAP-043-51 | sendNotification fire-and-forget fragile | Code quality | 2/10 | Pass #3 |
| GAP-043-55 | No structured addon lifecycle logger category | Observability | 2/10 | Pass #4 |
| **GAP-043-58** | **Cron Phase 4 queries local DB not QZPay** | **Accept as-is** | **3/10** | **Pass #5** |
| **GAP-043-59** | **No idempotency key for downgrade notification** | **Code fix** | **2/10** | **Pass #5** |

---

## Aggregate Statistics (All 5 Passes)

| Metric | Pass #1 | Pass #2 | Pass #3 | Pass #4 | Pass #5 | Total |
|--------|---------|---------|---------|---------|---------|-------|
| Gaps found | 28 | 10 | 13 | 5 | 4 | 60 |
| P1 (Must Fix) | 4 | 1 | 5 | 1 | 1 | 12 |
| P2 (Should Fix) | 13 | 5 | 5 | 3 | 1 | 27 |
| P3 (Nice to Have) | 11 | 4 | 3 | 1 | 2 | 21 |
| Verified non-gaps | 1 | 0 | 0 | 0 | 0 | 1 |
| Existing gaps upgraded | 0 | 0 | 2 | 0 | 0 | 2 |
| Existing gaps strengthened | 0 | 8 | 9 | 2 | 6 | 25 |
| New SPECs recommended | 5 | 0 | 1 | 1 | 0 | 7 |
| Direct fixes needed | 8 | 6 | 10 | 3 | 3 | 30 |
| Fold into SPEC-044 | 3 | 2 | 0 | 0 | 0 | 5 |

### P1 Must-Fix Effort Summary (Updated with Pass #5)

| Gap | Effort | Quick Description |
|-----|--------|-------------------|
| GAP-043-39 | 2/10 | Add `clearEntitlementCache()` call (2 lines) |
| GAP-043-40 | 3/10 | Fix catch-all to only catch not-found |
| GAP-043-41 | 2/10 | Scope Phase 2 UPDATE to purchaseIds |
| GAP-043-57 | 3/10 | Add subscription status check in confirmAddonPurchase |
| GAP-043-29 | 4/10 | cancelUserAddon atomicity |
| GAP-043-43 | 3/10 | getRemainingLimit: return 0 when billing failed (or document tradeoff) |
| GAP-043-52 | 3/10 | Add sendNotification(ADDON_EXPIRED) in cron loop |
| GAP-043-03 | 5/10 | Promise.race with 21s timeout |
| GAP-043-04 | 6/10 | Write concurrent webhook+admin tests |
| GAP-043-05 | 4/10 | Test partial failure retry paths |
| GAP-043-42 | 5/10 | Reconciliation cron for DB-QZPay split |
| GAP-043-17 | 5/10 | New SPEC for payment failure lifecycle |
| **Total P1** | **~45/120** | **12 items, ~5 days of focused work** |

---

## Production Readiness Assessment (Pass #5 Verdict)

### Blocking for Production (P1 items that MUST be fixed)

**Quick Wins (1-2 hours total):**
- GAP-043-39: `clearEntitlementCache` missing (2 lines)
- GAP-043-41: Phase 2 UPDATE scope bug (1 line change)
- GAP-043-57: Subscription status check in checkout (3-5 lines)

**Half-Day Fixes (4-6 hours total):**
- GAP-043-40: Customer existence check catch-all BUG
- GAP-043-29: cancelUserAddon atomicity
- GAP-043-52: ADDON_EXPIRED notification dispatch

**Multi-Day Items (2-3 days):**
- GAP-043-03: Webhook 22s timeout enforcement
- GAP-043-04 + 043-05: Missing test scenarios
- GAP-043-42: DB-QZPay reconciliation cron

**Decision Required:**
- GAP-043-43: fail-open vs fail-closed for entitlement middleware (product/architecture decision)
- GAP-043-17: Payment failure lifecycle (separate SPEC)

### Overall Assessment

The SPEC-043 implementation is **functionally complete** — all 26 tasks executed, core flows work. However, there are **12 P1 gaps** including 3 confirmed bugs (GAP-043-39, GAP-043-40, GAP-043-41), 1 security concern (GAP-043-43), and 1 data consistency issue (GAP-043-42) that should be addressed before production deployment of the addon lifecycle system.

The quick wins (GAP-043-39, 41, 57) can be fixed in under 2 hours and eliminate the most dangerous race conditions. GAP-043-40 is the single most critical bug — it permanently abandons addon cleanup on transient billing errors.

---

## Remediation Strategy (Revised — Pass #5 Final)

> **Principle**: KISS + YAGNI. No new SPECs. All gaps are either direct fixes, tasks folded into SPEC-044, or product decisions that need a 1-page doc, not a formal spec.

### Previously Recommended SPECs — DESCARTADAS

The 7 SPECs proposed in Passes #1-#4 were over-engineered for the actual scope of the gaps:

| Proposed SPEC | Gaps | Why Descartada | Resolution |
|---|---|---|---|
| ~~SPEC-047: Webhook Timeout~~ | GAP-043-03, 10 | `Promise.race()` = 5 lines, `pg_advisory_lock` = 3 lines | **Direct task** |
| ~~SPEC-048: Payment Failure Notifications~~ | GAP-043-17 | Requires product decision first, then a simple task | **Product decision doc** + task after |
| ~~SPEC-049: Notification i18n~~ | GAP-043-08 | Mechanical: move hardcoded strings to locale files | **Direct task** |
| ~~SPEC-050: Observability~~ | GAP-043-13, 21, 55 | Register logger category + add Sentry in 2 files | **Direct task** |
| ~~SPEC-051: Grace Period~~ | GAP-043-22 | Product decision, not engineering | **Product decision doc** |
| ~~SPEC-052: Fault Tolerance~~ | GAP-043-42, 43 | Add cron check + change `return -1` to `return 0` | **Direct task** |
| ~~SPEC-053: Event Orchestration~~ | GAP-043-54, 52, 53, 01, 02 | YAGNI. 5 addons, <100 customers. Fix missing dispatches directly | **Direct tasks** (3 dispatches) |

### Actual Resolution Plan

**Tier 1 — P1 Quick Wins (do first, < 2 hours total):**
- GAP-043-39: `clearEntitlementCache()` in cancelUserAddon (2 lines)
- GAP-043-41: Scope Phase 2 UPDATE to purchaseIds (1 line)
- GAP-043-61: `clearEntitlementCache()` in confirmAddonPurchase (1 line)
- GAP-043-57: Subscription status check in confirmAddonPurchase (5 lines)
- GAP-043-62: Verify authorization in cancelUserAddon route (2 lines or N/A)
- GAP-043-59: Idempotency key for downgrade notification (1 line)

**Tier 2 — P1 Half-Day Fixes:**
- GAP-043-40: Fix catch-all customer existence check (3 lines)
- GAP-043-29: cancelUserAddon atomicity — DB + recalc in transaction
- GAP-043-52: Add `sendNotification(ADDON_EXPIRED)` in cron expiry loop

**Tier 3 — P1 Multi-Day Tasks:**
- GAP-043-03: `Promise.race` with 21s timeout in webhook handler
- GAP-043-04 + 043-05: Write concurrent webhook+admin tests + partial failure retry tests
- GAP-043-42: Add reconciliation check to cron (subscriptions cancelled in DB but active in QZPay)

**Tier 4 — Product Decisions Required (not engineering tasks):**
- GAP-043-43: fail-open vs fail-closed for `getRemainingLimit()` during billing outage
- GAP-043-17: What to tell users before MercadoPago auto-cancels after 3 failed payments
- GAP-043-22: Grace period policy when usage exceeds limits after downgrade

**Fold into SPEC-044 (Addon Purchase Schema Cleanup):**
- GAP-043-06 (downgraded to P3 — CHECK already exists in migration 0025)
- GAP-043-07: State transition validation function
- GAP-043-09: canceled/cancelled constants
- GAP-043-31: Split addon-plan-change.service.ts (>500 lines)
- GAP-043-34: Defensive JSONB validation on limitAdjustments

**Direct P2 Tasks (no spec needed):**
- GAP-043-45: Warn when old plan not found in `resolvePlanBaseLimit()`
- GAP-043-46: Raise coverage thresholds (verify current state first)
- GAP-043-47: Add AC-5.x audit trail tests
- GAP-043-50: Add LIMIT to orphaned addon query in cron
- GAP-043-30: Add Sentry captures in addon-limit-recalculation + cancelUserAddon
- GAP-043-32: Add `HOSPEDA_ADDON_LIFECYCLE_ENABLED` env var
- GAP-043-60: Verify userId in downgrade notification payload
- GAP-043-63: Replace `Promise.all()` with `Promise.allSettled()` in admin cancel
- GAP-043-56: Add `SKIP LOCKED` to cron Phase 4 query
- GAP-043-53: Wire up or delete ADDON_RENEWAL_CONFIRMATION dead code
- GAP-043-01: Add ADDON_CANCELLATION notification dispatch
- GAP-043-02: Wire up ADDON_PURCHASE confirmation notification
- GAP-043-10: Add `pg_advisory_lock` to cron job
- GAP-043-13: Register `addon-lifecycle` logger category + add Sentry
- GAP-043-08: Internationalize notification email templates
- GAP-043-55: Create dedicated addon lifecycle logger

**Accept As-Is (no action):**
- GAP-043-14: Double recalculation (idempotent, harmless)
- GAP-043-20: JSONB only validated at app level (project convention)
- GAP-043-25: Verified non-gap (purchase-time adjustments correctly frozen)
- GAP-043-35: Rapid plan change overlap (last-writer-wins is correct, only oldPlanId may be stale)
- GAP-043-58: Cron queries local DB not QZPay (intentional, idempotent)

**Resolved:**
- GAP-043-36: NOTIFICATION_CATEGORY_MAP confirmed complete
- GAP-043-06: Downgraded P2→P3 (CHECK constraint exists in migration 0025)
- GAP-043-64: Test count is ~356 (higher than claimed 281, positive finding)

---

## Pass #5: Additional Agent Findings (Post-Verification)

Three specialized agents completed deep analysis and surfaced the following additional findings that were NOT covered by direct verification above.

### GAP-043-61: confirmAddonPurchase() Does Not Call clearEntitlementCache()

- **Audit**: Pass #5 (source code agent)
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: 2/10
- **Category**: Cache Inconsistency
- **Decisión**: HACER — Tarea directa. Agregar clearEntitlementCache(customerId) en confirmAddonPurchase() después del insert. 1 línea.
- **Fecha decisión**: 2026-03-17

**Description**: After a user completes an addon purchase via `confirmAddonPurchase()` in `addon.checkout.ts`, no call to `clearEntitlementCache()` is made. The user's entitlement cache retains the pre-purchase state for up to 5 minutes. If the user immediately tries to use their newly purchased addon feature (e.g., upload extra photos), they may be denied because the cache still shows their old limits.

**Evidence**: Source code agent confirmed: `addon.checkout.ts` has NO `clearEntitlementCache` call. Every other lifecycle operation (cancellation, plan change, expiry) properly clears the cache.

**Proposed Solution**: Add `clearEntitlementCache(customerId)` after successful DB insert in `confirmAddonPurchase()`.

**Recommendation**: Direct fix. 1 line. Affects user experience immediately post-purchase.

---

### GAP-043-62: cancelUserAddon() Has No Authorization Check (Customer Ownership)

- **Audit**: Pass #5 (source code agent)
- **Severity**: N/A → FALSO POSITIVO
- **Priority**: N/A
- **Complexity**: 0/10
- **Category**: Security / Authorization
- **Decisión**: DESCARTADO — Falso positivo. Autorización verificada en route handler (líneas 315-332) Y service (líneas 285-293). Defense-in-depth correcta.
- **Fecha decisión**: 2026-03-17

**Description**: `cancelUserAddon()` in `addon.user-addons.ts` accepts a `customerId` and `purchaseId` but does NOT verify that the calling user actually owns that addon purchase. Any authenticated user could potentially cancel another user's addon by providing a different `customerId`.

**Evidence**: Source code agent found: "No authorization check — user could cancel other user's addon. No `addon.customerId === actor.customerId` validation."

**Nuance**: This may be mitigated at the ROUTE level (protected routes inject the user's own customerId from the session). Needs verification of the calling route to determine if this is a real vulnerability or a defense-in-depth gap.

**Proposed Solution**:
1. Verify that the protected route injects `customerId` from the authenticated session (not from request body)
2. If it does, this is a defense-in-depth gap (P2). If it doesn't, this is a P1 security vulnerability.

**Recommendation**: Verify route-level injection first. If route passes user input directly, fix immediately.

---

### GAP-043-63: Admin Cancel Phase 1 Uses Promise.all() Instead of Promise.allSettled()

- **Audit**: Pass #5 (source code agent)
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Error Handling
- **Decisión**: HACER — Tarea directa. Reemplazar Promise.all() con Promise.allSettled() y mapear resultados.
- **Fecha decisión**: 2026-03-17

**Description**: In `subscription-cancel.ts`, Phase 1 uses `Promise.all()` for parallel addon revocations. If ANY single revocation throws, `Promise.all()` rejects immediately and the remaining revocations are abandoned (their promises still run but results are lost). `Promise.allSettled()` would collect ALL results (successes and failures) before proceeding.

**Evidence**: Source code agent: `subscription-cancel.ts` line ~213: `const phase1Results = await Promise.all(activePurchases.map(...))`

**Proposed Solution**: Replace `Promise.all()` with `Promise.allSettled()` and map results to the expected format.

**Recommendation**: Direct fix. Improves error reporting granularity for admins.

---

### GAP-043-64: Actual Test Count Is ~356, Not 281 as Claimed (Updated from GAP-043-48)

- **Audit**: Pass #5 (test analyzer agent)
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 1/10
- **Category**: Documentation Accuracy

**Description**: The test analyzer found approximately **356 tests** across 13 files, significantly MORE than the 281 claimed in the task state. Previous audit (GAP-043-48) estimated ~208, which was likely an undercount due to partial file reads. The actual count is higher because several test files have grown since the original task completion.

**Updated count per file**: addon-lifecycle.service.test (16), addon-lifecycle-cancellation.service.test (49), addon-limit-recalculation.service.test (50), addon-plan-change.service.test (45), addon-user-addons-recalc.test (21), addon.checkout.test (15), subscription-cancel.test (30), addon-lifecycle-cancellation.test (18), addon-lifecycle-plan-change.test (17), addon-expiration.service.test (40), addon-expiry.test (~25), entitlement.test (~30).

**Recommendation**: Update metadata. The count is HIGHER than claimed, which is positive.

---

### GAP-043-65: DB Schema Has CHECK Constraint (Partially Resolves GAP-043-06)

- **Audit**: Pass #5 (DB/notifications agent)
- **Severity**: INFO
- **Priority**: N/A
- **Complexity**: 0/10
- **Category**: Gap Resolution

**Description**: The DB/notifications agent found that migration `0025_addon_purchases_status_check.sql` DOES add a CHECK constraint: `CHECK (status IN ('active', 'expired', 'canceled', 'pending'))`. This partially resolves GAP-043-06 ("Status VARCHAR without CHECK constraint"). The constraint exists at DB level but NOT at Drizzle ORM schema level.

**Updated GAP-043-06 status**: PARTIALLY RESOLVED. DB has CHECK, schema does not reflect it. Downgrade from P2 to P3.

---

### GAP-043-66: NOTIFICATION_CATEGORY_MAP Has All Addon Types (Resolves GAP-043-36)

- **Audit**: Pass #5 (DB/notifications agent)
- **Severity**: INFO
- **Priority**: N/A
- **Complexity**: 0/10
- **Category**: Gap Resolution

**Description**: The DB/notifications agent verified that `NOTIFICATION_CATEGORY_MAP` correctly includes ALL addon notification types:
- `ADDON_PURCHASE` -> TRANSACTIONAL
- `ADDON_RENEWAL_CONFIRMATION` -> TRANSACTIONAL
- `ADDON_EXPIRATION_WARNING` -> REMINDER
- `ADDON_EXPIRED` -> REMINDER

**Updated GAP-043-36 status**: RESOLVED. Category map is complete.

---

## Pass #5 Final Statistics Update

| Metric | Pass #1 | Pass #2 | Pass #3 | Pass #4 | Pass #5 | Total |
|--------|---------|---------|---------|---------|---------|-------|
| Gaps found | 28 | 10 | 13 | 5 | 10 | 66 |
| P1 (Must Fix) | 4 | 1 | 5 | 1 | 4 | 15 |
| P2 (Should Fix) | 13 | 5 | 5 | 3 | 2 | 28 |
| P3 (Nice to Have) | 11 | 4 | 3 | 1 | 2 | 21 |
| Gaps resolved | 0 | 0 | 0 | 0 | 2 | 2 |
| Verified non-gaps | 1 | 0 | 0 | 0 | 0 | 1 |

### Updated P1 Must-Fix Effort Summary (Final)

| Gap | Effort | Quick Description |
|-----|--------|-------------------|
| GAP-043-39 | 2/10 | Add `clearEntitlementCache()` in cancelUserAddon (2 lines) |
| GAP-043-40 | 3/10 | Fix catch-all to only catch not-found (3 lines) |
| GAP-043-41 | 2/10 | Scope Phase 2 UPDATE to purchaseIds (1 line) |
| GAP-043-57 | 3/10 | Add subscription status check in confirmAddonPurchase |
| GAP-043-61 | 2/10 | Add clearEntitlementCache in confirmAddonPurchase (1 line) |
| GAP-043-62 | 2/10 | Verify authorization in cancelUserAddon (needs route check first) |
| GAP-043-29 | 4/10 | cancelUserAddon atomicity (DB + recalc in transaction) |
| GAP-043-43 | 3/10 | getRemainingLimit: fail-closed for limits (arch decision) |
| GAP-043-52 | 3/10 | Add sendNotification(ADDON_EXPIRED) in cron loop |
| GAP-043-03 | 5/10 | Promise.race with 21s timeout for webhook |
| GAP-043-04 | 6/10 | Write concurrent webhook+admin tests |
| GAP-043-05 | 4/10 | Test partial failure retry paths |
| GAP-043-42 | 5/10 | Reconciliation cron for DB-QZPay split state |
| GAP-043-17 | 5/10 | New SPEC for payment failure lifecycle |
| **Total P1** | **~49/140** | **15 items (6 quick wins < 30min each), ~5-6 days total** |

---

## Audit Pass #6 (2026-03-17)

**Scope**: Full re-audit with 5 specialized agents analyzing spec, all source code (22 files), all test files (11+ files), and shared packages (notifications, billing, schemas, i18n, db) in parallel.

**Methodology**:
1. Spec reader (full spec + tasks + metadata + existing 66 gaps)
2. Code analyzer (13 addon service files, all routes, middleware)
3. Plan-change/cancellation deep analyzer (12 files with full dependency graph)
4. Test coverage analyzer (11 test files with per-AC mapping)
5. Notifications + billing + schemas + i18n + DB package analyzer (21 files)

**Key Finding**: Pass #6 identified **5 new gaps** (GAP-043-67 through GAP-043-71), **updated evidence for 3 existing gaps**, and **confirmed 1 existing gap as partially resolved**.

---

## GAP-043-67: UserAddonResponseSchema Missing 'pending' Status

- **Audit**: Pass #6
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: Schema Inconsistency
- **Decisión**: HACER — Tarea directa. Agregar 'pending' al enum de status en UserAddonResponseSchema. 1 línea.
- **Fecha decisión**: 2026-03-17

**Description**: `UserAddonResponseSchema` in `packages/schemas/src/api/billing/addon.schema.ts` defines status as `z.enum(['active', 'expired', 'canceled'])` — missing `'pending'`. Meanwhile, `CustomerAddonResponseSchema` in `packages/schemas/src/api/billing/customer-addons.schema.ts` (admin view) correctly includes all 4 statuses: `['active', 'expired', 'canceled', 'pending']`. The DB CHECK constraint (migration 0025) also allows `'pending'`. This means a customer-facing API response will fail Zod validation if a purchase in `pending` status is returned.

**Evidence**:
- `packages/schemas/src/api/billing/addon.schema.ts`: `z.enum(['active', 'expired', 'canceled'])` — NO `'pending'`
- `packages/schemas/src/api/billing/customer-addons.schema.ts`: `ADDON_PURCHASE_RESPONSE_STATUSES = ['active', 'expired', 'canceled', 'pending']`
- DB migration `0025_addon_purchases_status_check.sql`: CHECK constraint includes `'pending'`
- `getUserAddons()` in `addon.user-addons.ts` queries ALL purchases without status filter — could return pending ones

**Proposed Solution**:
1. Add `'pending'` to `UserAddonResponseSchema` status enum: `z.enum(['active', 'expired', 'canceled', 'pending'])`
2. Alternatively, filter pending purchases in `getUserAddons()` before returning (if pending addons shouldn't be shown to users)

**Recommendation**: Direct fix. 1 line. Aligns customer-facing schema with DB and admin schemas.

---

## GAP-043-68: Missing i18n Keys for 'canceled' and 'pending' Addon Statuses

- **Audit**: Pass #6
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: 2/10
- **Category**: i18n Gap
- **Decisión**: HACER — Tarea directa. Agregar addons.status.canceled y addons.status.pending a los 3 locales. 6 líneas.
- **Fecha decisión**: 2026-03-17

**Description**: The `billing.json` locale files (es, en, pt) define `addons.status` keys only for `active`, `expiringSoon`, and `expired`. They are MISSING translations for `canceled` and `pending` statuses. Any UI displaying addon status will show raw English strings or empty values for these two statuses.

**Evidence**:
- `packages/i18n/src/locales/es/billing.json` `addons.status`: `{ "active": "Activo", "expiringSoon": "Por vencer", "expired": "Vencido" }` — no `canceled` or `pending`
- `packages/i18n/src/locales/en/billing.json` `addons.status`: `{ "active": "Active", "expiringSoon": "Expiring soon", "expired": "Expired" }` — same gap
- `packages/i18n/src/locales/pt/billing.json`: same pattern
- DB allows `canceled` and `pending` statuses, admin UI shows them, but customer-facing UI has no translations

**Proposed Solution**:
Add to all 3 locale files:
```json
"addons": {
  "status": {
    "active": "Activo/Active/Ativo",
    "expiringSoon": "Por vencer/Expiring soon/Prestes a vencer",
    "expired": "Vencido/Expired/Expirado",
    "canceled": "Cancelado/Canceled/Cancelado",
    "pending": "Pendiente/Pending/Pendente"
  }
}
```

**Recommendation**: Direct fix. 6 lines across 3 files.

---

## GAP-043-69: Open TODO in addon-expiration.service.ts for Entitlement Reconciliation Cron

- **Audit**: Pass #6
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 4/10
- **Category**: Open TODO / Technical Debt
- **Decisión**: HACER — Tarea directa. Agregar Cron Phase 5 para retry de entitlementRemovalPending=true.
- **Fecha decisión**: 2026-03-17

**Description**: `addon-expiration.service.ts` at line ~530 has an explicit TODO: `TODO(SPEC-038): Add entitlement reconciliation cron to handle drift`. This references handling cases where entitlement removal failed but purchase status was already updated to `'expired'`. The `entitlementRemovalPending: true` metadata flag is set but no subsequent cron phase picks up these flagged records for retry.

**Evidence**:
- `apps/api/src/services/addon-expiration.service.ts` line ~530: `TODO(SPEC-038)` comment
- When `expireAddon()` succeeds at DB status update but fails at entitlement removal, it sets `metadata.entitlementRemovalPending: true`
- No cron phase or background job queries for `metadata.entitlementRemovalPending = true` to retry removal
- Similar pattern to cron Phase 4 (orphaned addon retry) but for the EXPIRY flow specifically

**Proposed Solution**:
1. Add a Cron Phase 5 that queries `billing_addon_purchases WHERE status = 'expired' AND metadata->>'entitlementRemovalPending' = 'true'`
2. For each, retry `AddonEntitlementService.removeAddonEntitlements()` and clear the flag on success
3. Add Sentry escalation after 3 retries

**Recommendation**: Fold into SPEC-044 as a follow-up task. Low urgency — the addon is already marked expired in DB, only the QZPay entitlement state might drift.

---

## GAP-043-70: AddonPurchaseConfirmation Template Exists But Evidence in GAP-043-02 Said It Didn't

- **Audit**: Pass #6
- **Severity**: INFO
- **Priority**: N/A
- **Complexity**: 0/10
- **Category**: Gap Evidence Update

**Description**: GAP-043-02 states "No template file for addon purchase confirmation". However, the file `packages/notifications/src/templates/addon/addon-purchase-confirmation.tsx` EXISTS (visible in git status as untracked). The template is present and exported from `packages/notifications/src/templates/addon/index.ts`. The actual gap is that the dispatch code in `confirmAddonPurchase()` is missing — the template and wiring are already in place.

**Updated GAP-043-02 evidence**: Template EXISTS. Subject line EXISTS in `subject-builder.ts`. Case EXISTS in `selectTemplate()`. ONLY the `sendNotification()` dispatch call is missing from `confirmAddonPurchase()` in `addon.checkout.ts`. This REDUCES the effort from 3/10 to 1/10 (just add the dispatch call).

---

## GAP-043-71: addon-expiration.service.ts at 756 Lines Exceeds 500-Line Limit

- **Audit**: Pass #6
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: 3/10
- **Category**: Code Quality / Standards Violation
- **Decisión**: HACER — Tarea directa. Extraer queries a addon-expiration.queries.ts y batch processing a addon-expiration.batch.ts.
- **Fecha decisión**: 2026-03-17

**Description**: `addon-expiration.service.ts` is 756 lines, significantly exceeding the project's 500-line maximum. This is even larger than `addon-plan-change.service.ts` (624 lines, documented in GAP-043-31). The file combines expired addon queries, expiring addon queries, batch processing, individual expiration, retry logic, and notification dispatch.

**Evidence**:
- `apps/api/src/services/addon-expiration.service.ts`: 756 lines
- Project standard (CLAUDE.md): "Maximum 500 lines per file"
- Already documented: GAP-043-31 covers addon-plan-change.service.ts at 624 lines

**Proposed Solution**:
1. Extract query methods (`findExpiredAddons`, `findExpiringAddons`) to `addon-expiration.queries.ts`
2. Extract batch processing logic to `addon-expiration.batch.ts`
3. Keep orchestration + single expiration in main file (~300 lines)

**Recommendation**: Fold into SPEC-044 alongside GAP-043-31.

---

## Pass #6: Existing Gap Evidence Updates

### GAP-043-02 (UPDATED EVIDENCE)
Template `addon-purchase-confirmation.tsx` EXISTS (contradicts original evidence). Only the dispatch call is missing. Effort reduced from 3/10 to 1/10. See GAP-043-70.

### GAP-043-33 (ADDITIONAL EVIDENCE)
The inconsistent error handling semantics were further confirmed with detailed per-service breakdown:
- `revokeAddonForSubscriptionCancellation()`: **throws** on fatal errors
- `handleSubscriptionCancellationAddons()`: **catches** per-addon, **throws** at end if any failed
- `recalculateAddonLimitsForCustomer()`: returns `RecalculationResult` with `outcome: 'failed'`, **never throws**
- `handlePlanChangeAddonRecalculation()`: **throws** for limits.set failures, **continues** for others
- `cancelUserAddon()`: returns `ServiceResult<void>` always with `success: true`, **never throws**
- `expireAddon()`: returns `ExpireAddonResult` with partial success (entitlement removal can fail silently)

### GAP-043-48/64 (CONFIRMED - Test Count Higher Than Claimed)
Test analyzer confirmed ~356 tests across 13 files, consistent with Pass #5 finding (GAP-043-64). The 281 count in task state is stale.

---

## Pass #6 Validation of Previous P1 Gaps

All 15 P1 gaps from Pass #5 **remain confirmed**. No new evidence contradicts any previous P1 finding. The most critical bugs remain:
1. GAP-043-40: catch-all customer existence check (CRITICAL BUG)
2. GAP-043-41: Phase 2 UPDATE not scoped to purchaseIds (RACE CONDITION)
3. GAP-043-39: Cache not invalidated after cancelUserAddon recalc (LIMIT BYPASS)
4. GAP-043-61: Cache not invalidated after confirmAddonPurchase (UX BUG)
5. GAP-043-57: No subscription status check in confirmAddonPurchase (DATA CONSISTENCY)

---

## Updated Priority Summary (All 6 Passes)

### P1 - Must Fix: 15 items (unchanged from Pass #5)

### P2 - Should Fix: 29 items (+2 from Pass #6)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| (all 27 from Pass #5) | ... | ... | ... | ... |
| **GAP-043-67** | **UserAddonResponseSchema missing 'pending' status** | **Schema fix** | **2/10** | **Pass #6** |
| **GAP-043-68** | **Missing i18n keys for 'canceled'/'pending' statuses** | **i18n fix** | **2/10** | **Pass #6** |

### P3 - Nice to Have: 23 items (+2 from Pass #6)

| Gap | Description | Type | Effort | Audit |
|-----|-------------|------|--------|-------|
| (all 21 from Pass #5) | ... | ... | ... | ... |
| **GAP-043-69** | **Open TODO for entitlement reconciliation cron** | **Tech debt** | **4/10** | **Pass #6** |
| **GAP-043-71** | **addon-expiration.service.ts exceeds 500-line limit (756 lines)** | **Refactor** | **3/10** | **Pass #6** |

---

## Aggregate Statistics (All 6 Passes)

| Metric | Pass #1 | Pass #2 | Pass #3 | Pass #4 | Pass #5 | Pass #6 | Total |
|--------|---------|---------|---------|---------|---------|---------|-------|
| Gaps found | 28 | 10 | 13 | 5 | 10 | 5 | 71 |
| P1 (Must Fix) | 4 | 1 | 5 | 1 | 4 | 0 | 15 |
| P2 (Should Fix) | 13 | 5 | 5 | 3 | 2 | 2 | 30 |
| P3 (Nice to Have) | 11 | 4 | 3 | 1 | 2 | 2 | 23 |
| Evidence updates | 0 | 0 | 0 | 0 | 0 | 3 | 3 |
| Gaps resolved | 0 | 0 | 0 | 0 | 2 | 0 | 2 |
| Verified non-gaps | 1 | 0 | 0 | 0 | 0 | 0 | 1 |

### Pass #6 Assessment

Pass #6 found **no new P1 gaps**, which is a positive signal — the previous 5 passes were thorough enough to catch all critical issues. The new gaps are P2 (schema/i18n consistency) and P3 (tech debt/file size). The most valuable finding is the evidence correction for GAP-043-02 (template exists, reducing remediation effort).

**Diminishing returns**: 5 new findings vs 10 in Pass #5 vs 13 in Pass #3. Further audit passes are unlikely to yield significant new findings. The gap analysis is considered **comprehensive and stable**.

### Updated Remediation Strategy

No changes to the Pass #5 remediation strategy. The new P2 gaps (GAP-043-67, GAP-043-68) are trivial direct fixes (1 line + 6 lines across 3 files). The new P3 gaps (GAP-043-69, GAP-043-71) fold into SPEC-044.

**Updated SPEC-044 items**: GAP-043-06, 07, 09, 31, 34, 69, 71 (7 items total, was 5)
