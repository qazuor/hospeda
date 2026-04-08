# SPEC-038 Gaps Analysis: Addon Entitlements Architecture Fix

**Spec**: SPEC-038-addon-entitlements-architecture
**Created**: 2026-03-10
**Last Updated**: 2026-03-16
**Audit Passes**: 8
**Auditors**:
- Pass #1 (2026-03-10): Tech Lead (coordinator) + Service Expert + Middleware Expert + Test Expert + DB/Migration Expert + Edge Case Expert
- Pass #2 (2026-03-11): Tech Lead (coordinator) + 6 parallel expert agents (Service, Middleware, Cron/Expiration, Checkout/Cancel, Migration/DB, Config/Types)
- Pass #3 (2026-03-11): Tech Lead + 2 focused expert agents (Cancel Route Bug Verification, Cache/Migration Test Gaps)
- Pass #4 (2026-03-13): Tech Lead + 3 parallel expert agents (Services Deep-Dive, Middleware/Routes/Migration/Schema, Test Coverage Analysis) + 1 focused QZPay package verification agent
- Pass #5 (2026-03-16): Senior Tech Lead exhaustive cross-layer audit (Admin HTTP adapter, types/spelling, ServiceResult DRY, cron notification idempotency, migration fragility, test quality, checkout redundancy)
- Pass #6 (2026-03-16): Full exhaustive re-audit (4 parallel agents: core services deep-dive, middleware/cron/routes/tests, migration/schema/DB, critical findings verification) — 10 new gaps discovered
- Pass #7 (2026-03-16): Senior Tech Lead + 4 deep-dive expert agents (Core Services line-by-line, Middleware/Routes/Cron line-by-line, Test Coverage complete enumeration, DB/Schema/Migration/Types/Admin adapter) — 7 new gaps discovered, all 45 prior gaps re-confirmed
- Pass #8 (2026-03-16): Senior Architect + 5 parallel expert agents (Service Audit, Middleware Audit, Cron/DB/Migration Audit, Test Coverage Enumeration, Config/Routes Audit) + 1 focused verification agent — **RESOLVED GAP-038-21** (removeBySource confirmed in QZPay v1.2.0 types), all 51 remaining gaps re-confirmed, 0 new gaps discovered

---

## Executive Summary

All 22 tasks in state.json are marked `completed`. The core architecture fix is **correctly implemented**: no more `@ts-expect-error` in addon code, no more `billing.plans.update()`, proper per-customer entitlements/limits via QZPay APIs, purchaseId tracking, unique partial index, and middleware merge. The implementation is solid and production-ready for the primary bugs (1-6).

**Pass #2 findings**: Confirmed all 11 original gaps from pass #1. Found **6 NEW gaps** (GAP-038-12 through GAP-038-17) through deeper code analysis, including test coverage blind spots, metadata state inconsistencies, and spec/metadata status drift.

**Pass #3 findings**: **CRITICAL severity upgrade** for GAP-038-03 (cancel route passes UUID as slug.. entire cancellation flow fails silently). Found **3 NEW gaps** (GAP-038-18 through GAP-038-20). Total: **20 gaps**.

**Pass #4 findings**: Deep cross-verification of services, middleware, tests, routes, migration, and QZPay package internals. Confirmed all 20 prior gaps. Found **2 NEW gaps** (GAP-038-21 through GAP-038-22). One finding from the QZPay package inspection introduces a **potential second CRITICAL** (GAP-038-21): the `billing.limits.removeBySource()` method may not exist at the service interface level (the underlying drizzle repo exposes `deleteBySource`, not `removeBySource`). Also flagged that the "Verified" list entry for `removeBySource` is at risk and needs re-verification against the actually installed package. Total: **22 gaps**.

**Pass #5 findings**: Exhaustive cross-layer audit covering admin HTTP adapter, type system consistency, DRY violations, cron idempotency edge cases, migration fragility, and test quality defects. Confirmed all 22 prior gaps. Found **13 NEW gaps** (GAP-038-23 through GAP-038-35). Most critical new finding: **GAP-038-23** (admin HTTP adapter missing `revokeBySource`/`removeBySource` — runtime crash if admin triggers addon cancellation), **GAP-038-25** (American vs. British spelling inconsistency in `UserAddon.status` causes silent comparison failures at runtime), and **GAP-038-27** (notification idempotency check ignores `addonSlug`, suppressing legitimate second notifications). Total: **35 gaps**.

**Pass #6 findings**: Full exhaustive re-audit using 4 parallel deep-analysis agents (core services, middleware/cron/routes/tests, migration/schema/DB, critical verification). Confirmed all 35 prior gaps. Found **10 NEW gaps** (GAP-038-36 through GAP-038-45). Most critical new finding: **GAP-038-45** (unique index deviates from spec — missing `AND deleted_at IS NULL` clause AND missing `deletedAt` column on `billing_addon_purchases` table; both schema and migration 0021 deviate from the spec requirement that explicitly mandated `deleted_at IS NULL` in the WHERE clause). Other significant new findings: **GAP-038-36** (expiry idempotent path returns current time instead of actual expiration timestamp — misleads callers and logs), **GAP-038-39** (migration idempotency check includes `subscriptionId` making it too strict — re-runs across subscription changes create duplicate rows), **GAP-038-43** (unsafe `as number` cast on plan limits lookup silently succeeds with wrong types). Total: **45 gaps**.

**Pass #7 findings**: Exhaustive cross-layer audit using 4 specialized expert agents performing line-by-line code analysis (Core Services 654+612+529+138+413 lines, Middleware/Routes/Cron complete analysis, ALL test files ~280+ test cases enumerated, DB schema/migration/types/admin adapter complete). Confirmed all 45 prior gaps. Found **7 NEW gaps** (GAP-038-46 through GAP-038-52). Key new findings: **GAP-038-46** (subscription metadata race condition on concurrent addon purchases — read-modify-write without lock on `addonAdjustments` JSON), **GAP-038-47** (cron job errors not reported to Sentry — only uses `apiLogger.error`, no `Sentry.captureException`), **GAP-038-48** (cancel route re-fetches all user addons in service after route already verified ownership — redundant DB work), **GAP-038-49** (unmapped error codes in addon routes default to HTTP 500), **GAP-038-50** (no test for cascading fallback failure: revokeBySource throws AND revoke() also throws), **GAP-038-51** (no test for multiple addons expiring on same day for same customer — notification scheduling coverage), **GAP-038-52** (`getDb()` has no null check in `AddonExpirationService` — potential uncaught crash). Total: **52 gaps**.

**Pass #8 findings**: Full-stack exhaustive audit using 5 parallel expert agents (Service Deep-Audit, Middleware Audit, Cron/DB/Migration Audit, Test Coverage Complete Enumeration, Config/Routes/Types Audit) + 1 focused verification agent for critical GAPs. **RESOLVED GAP-038-21**: `QZPayLimitService.removeBySource()` confirmed present in `@qazuor/qzpay-core/dist/index.d.ts` with correct signature `(source: QZPaySourceType, sourceId: string) => Promise<number>`. Re-confirmed all 51 remaining open gaps. Confirmed GAP-038-03 (CRITICAL cancel route UUID-as-slug) still present. Confirmed GAP-038-25 (cancelledAt/canceledAt spelling mismatch) still present. **0 new gaps discovered** — the gap registry has stabilized after 8 passes. Total: **52 gaps (1 resolved, 2 accepted, 49 open)**.

---

## Gap Registry

### GAP-038-01: Subscription cancellation does NOT revoke addon entitlements/limits

- **Audit Pass**: #1
- **Severity**: HIGH
- **Priority**: HIGH
- **Complexity**: Medium (3-4)
- **Category**: Design gap (not in spec)
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Implementar como tarea standalone. Webhook handler para cancelación de suscripción que revoque entitlements/limits de addons activos.

**Description**: When a customer's subscription is cancelled, active addon entitlements and limits in `billing_customer_entitlements` and `billing_customer_limits` are NOT revoked. The per-customer QZPay rows remain in the database.

**Impact**: A customer who cancels their subscription but later resubscribes will still have old addon entitlements/limits active, even though the addon purchase was tied to the old subscription. `billing_addon_purchases` rows may still have `status='active'` with no corresponding active subscription.

**Pass #2 update**: The spec explicitly marks this as out of scope (spec line 1649: "Cleanup of customer-level addon rows on full subscription cancellation... This is acceptable because...the entitlement middleware only loads customer-level data when an active subscription exists"). The middleware DOES check for active subscription first (lines 147-158), so orphaned rows are invisible. However, **if the customer resubscribes**, the middleware loads them again.. the old addon rows resurface without a corresponding paid addon purchase. This is a real bug path.

**Evidence**:
- No handler found in codebase that revokes addon entitlements on subscription cancellation
- `addon-expiry.job.ts` only handles time-based expiration, not subscription-event-based cleanup
- Spec acknowledges this as out of scope but the resubscription scenario creates incorrect behavior

**Proposed Solutions**:

1. **Add subscription cancellation webhook handler** that iterates all active `billing_addon_purchases` for that customer and calls `removeAddonEntitlements()` + updates status to `'cancelled'`.
   - Pros: Clean, complete cleanup
   - Cons: Requires new webhook event listener

2. **Add subscription status check in entitlement middleware** - before merging addon entitlements, verify corresponding `billing_addon_purchases` has `status='active'`.
   - Pros: Simple, defensive
   - Cons: Orphaned rows remain, more queries per request

3. **Add periodic reconciliation cron** that detects addon purchases with `status='active'` but no corresponding active subscription.
   - Pros: Batch processing, catches all edge cases
   - Cons: Delayed cleanup

**Recommendation**: **New SPEC** combining solutions 1+3. The resubscription path creates real user-visible incorrect behavior.

---

### GAP-038-02: No reconciliation cron for orphaned addon purchases

- **Audit Pass**: #1
- **Severity**: MEDIUM
- **Priority**: MEDIUM
- **Complexity**: Medium (3)
- **Category**: Missing feature (mentioned in spec UX section line 1241 as "future", not tracked)
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Extender cron existente `addon-expiry.job.ts` con fase de reconciliación para detectar y reparar purchases huérfanos.

**Description**: The spec mentions (line 1241): *"Until the reconciliation cron is built, an admin can manually trigger applyAddonEntitlements()"*. No tracked task, TODO, or implementation exists. If `billing.entitlements.grant()` or `billing.limits.set()` fails after the purchase INSERT succeeds (Scenario 1h), the purchase is "orphaned" with no automated repair.

**Impact**: Orphaned purchases persist until manually detected. The migration script can repair them but is a one-time tool.

**Pass #2 update**: Confirmed no reconciliation mechanism exists anywhere in the codebase. The migration script (`migrate-addon-purchases.ts`) CAN be re-run safely (idempotent), but is not designed for production cron execution.

**Proposed Solutions**:
1. New cron job (`addon-reconciliation.job.ts`): daily, checks for orphaned purchases
2. Extend `addon-expiry.job.ts` with reconciliation phase
3. Defer: accept risk

**Recommendation**: Solution 2 (extend existing cron). Can be a standalone task.

---

### GAP-038-03: Cancel route passes UUID as addon slug.. entire cancellation flow fails silently

- **Audit Pass**: #1 (identified as naming issue), **#3 (UPGRADED to CRITICAL)**
- **Severity**: **CRITICAL**
- **Priority**: **CRITICAL**
- **Complexity**: Medium (2-3)
- **Category**: **Functional bug - silent failure**
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Fix en la ruta: query selecciona `addonSlug`, lo pasa al servicio. Agregar test integración route→service.

**Description**: The cancel addon route (`POST /api/v1/protected/billing/addons/{id}/cancel`) receives a UUID purchase ID as `:id`, but passes it to `cancelUserAddon()` as `addonId`. The service then treats this UUID as an addon slug, causing ALL slug-based lookups to fail silently. **No addon cancellation actually works in production.**

**Bug trace** (confirmed in pass #3 with full code verification):

1. **Route** (`addons.ts:266-274`): `id: z.string().uuid()` - receives UUID
2. **Route query** (`addons.ts:298-314`): Fetches purchase but only selects `{ id }`, does NOT extract `addonSlug`
3. **Route call** (`addons.ts:326`): `addonId: params.id as string` - passes UUID as "addonId"
4. **Service** (`addon.user-addons.ts:235`): `const addonSlug = input.addonId` - UUID assigned to slug variable
5. **Lookup** (`addon.user-addons.ts:258-260`): `userAddons.some(a => a.addonSlug === addonSlug)` - compares `'extra-photos-20'` against UUID → **NO MATCH** → returns `NOT_FOUND`
6. **DB update** (`addon.user-addons.ts:288`): `eq(billingAddonPurchases.addonSlug, addonSlug)` - searches slug column for UUID → **ZERO ROWS UPDATED**
7. **Entitlement removal**: `getAddonBySlug(UUID)` → `undefined` → entitlements/limits NOT revoked

**Impact**: **Complete failure of addon cancellation**. Customers cannot cancel addons. Entitlements and limits are never revoked on cancellation. The error is silent (returns NOT_FOUND to the user, no crash).

**Evidence**:
- `addons.ts:298-314`: Only selects `{ id: billingAddonPurchases.id }`, never `addonSlug`
- `addons.ts:326`: `addonId: params.id as string` (UUID, not slug)
- `addon.user-addons.ts:235`: `const addonSlug = input.addonId` (UUID → slug variable)
- `addon.user-addons.ts:258-260`: Slug comparison against UUID always fails
- No test catches this because tests mock the service layer, not the route-to-service data flow

**Proposed Solutions**:

1. **Fix the route to extract addonSlug from the purchase query** (RECOMMENDED):
   ```typescript
   // addons.ts: Change the ownership query to also select addonSlug
   const [ownedAddon] = await db
       .select({
           id: billingAddonPurchases.id,
           addonSlug: billingAddonPurchases.addonSlug  // ADD THIS
       })
       .from(billingAddonPurchases)
       .where(...)

   // Then pass the slug, not the UUID:
   const result = await service.cancelAddon({
       customerId: billingCustomerId,
       addonId: ownedAddon.addonSlug,  // FIX: slug, not UUID
       purchaseId: ownedAddon.id,
       ...
   });
   ```
   - Pros: Minimal change, fixes root cause, backward compatible
   - Cons: None significant

2. **Fix the service to accept purchaseId and fetch slug from DB**:
   - Pros: More defensive
   - Cons: Extra DB query, more invasive change

3. **Rename the entire chain to use consistent naming** (addonSlug everywhere):
   - Pros: Prevents future confusion
   - Cons: Larger change, needs more testing

**Recommendation**: **Fix IMMEDIATELY** with Solution 1. This is a **production-blocking bug**. Add an integration test that verifies the full cancel flow from route to service.

---

### GAP-038-04: Plan upgrade/downgrade does NOT recalculate addon limit values

- **Audit Pass**: #1
- **Severity**: MEDIUM
- **Priority**: LOW (v2 enhancement)
- **Complexity**: High (4)
- **Category**: Known limitation (documented in spec Scenario 2g, line 1003-1018)
- **Status**: **HACER** (decidido 2026-03-16, cambiado de Accepted v1)
- **Decisión**: Implementar recálculo de addon limits cuando el plan cambia. Tarea standalone.

**Description**: When upgrading plans, addon limit rows retain the old computed value. Resolved limit = max(new_plan, old_addon_value). Customer gets a net benefit but not the full expected increase.

**Pass #2 update**: Confirmed as explicitly accepted in spec Scenario 2g. No code change needed for v1.

**Recommendation**: Track as **future SPEC** when plan changes become frequent.

---

### GAP-038-05: TODOs.md out of sync with state.json

- **Audit Pass**: #1
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Documentation inconsistency
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Actualizar TODOs.md para reflejar estado real 22/22.

**Description**: `TODOs.md` shows `1/22 tasks (4.5%)` completed while `state.json` shows 22/22 completed.

**Pass #2 update**: Still out of sync. All task checkboxes remain unchecked `[ ]`.

**Recommendation**: Fix directly. Trivial.

---

### GAP-038-06: Drizzle relations incomplete for billing_addon_purchases

- **Audit Pass**: #1
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Low (1)
- **Category**: Schema quality
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar relaciones faltantes a billingSubscriptions y billingAddons en el schema Drizzle.

**Description**: `billingAddonPurchasesRelations` only defines relation to `billingCustomers`. Missing: `billingSubscriptions` (via `subscriptionId` FK) and `billingAddons` (via `addonId` FK).

**Pass #2 update**: Confirmed at lines 82-87. Only `customer` relation defined.

**Recommendation**: Fix directly. Add the missing relations.

---

### GAP-038-07: Multiple different addon slugs affecting same limit key - not explicitly tested

- **Audit Pass**: #1
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Low (2)
- **Category**: Test coverage gap / design constraint
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar validación en config-validator.ts que prevenga overlapping limit keys entre addons. Agregar test.

**Description**: If two different addons target the same limit key, `billing.limits.set()` (upsert) means last write wins. Currently impossible with defined addons (each targets a unique key), but a future addon addition could silently break this.

**Pass #2 update**: Confirmed. The addon config validator (`config-validator.ts:141-152`) validates `limitIncrease > 0 when affectsLimitKey is set` and checks `grantsEntitlement` references, but does NOT validate that no two active addons share the same `affectsLimitKey`.

**Recommendation**: Add config-level validation that prevents overlapping limit keys. Document as constraint.

---

### GAP-038-08: Cache race condition between invalidation and concurrent requests

- **Audit Pass**: #1
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Low (2)
- **Category**: Known limitation (inherent to in-memory cache design)
- **Status**: Accepted

**Description**: Race condition window between `clearEntitlementCache()` and concurrent `loadEntitlements()` that may write stale data to cache. Max 5-min stale window.

**Pass #2 update**: Confirmed. Accepted risk. Single-instance deployment mitigates impact.

**Recommendation**: Accept risk. Document in code comments.

---

### GAP-038-09: Redundant getQZPayBilling() calls in cron job loops

- **Audit Pass**: #1
- **Severity**: TRIVIAL
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Code quality
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Eliminar llamadas redundantes en líneas 219 y 330. Usar variable billing del scope externo. Se hace junto con GAP-038-17.

**Description**: `getQZPayBilling()` called at lines 219 and 330 inside notification loops, despite being captured at line 122.

**Pass #2 update**: Confirmed. Lines 219 and 330 are in notification loop blocks (3-day and 1-day warning respectively). The calls create a new local `billing` variable that shadows the outer scope variable. Functionally identical (singleton) but creates scope confusion and unnecessary calls.

**Recommendation**: Fix directly. Use outer `billing` variable.

---

### GAP-038-10: FIFO vs LRU cache naming inconsistency

- **Audit Pass**: #1
- **Severity**: TRIVIAL
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Documentation inconsistency
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Corregir comentarios para usar "FIFO" consistentemente.

**Description**: Spec and code comments use "FIFO" and "LRU" interchangeably. Implementation is FIFO (`Map.keys().next().value` for eviction).

**Recommendation**: Clarify terminology. Trivial.

---

### GAP-038-11: No admin UI to view per-customer entitlements/limits from QZPay

- **Audit Pass**: #1
- **Severity**: MEDIUM
- **Priority**: MEDIUM
- **Complexity**: Medium (3)
- **Category**: Feature gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Crear endpoint admin + página para visualizar entitlements y limits por customer. Tarea standalone.

**Description**: Spec UX section (lines 1243-1248) describes admin visibility of `source` and `sourceId` columns, but no admin panel page or endpoint exposes `billing_customer_entitlements` or `billing_customer_limits` data.

**Pass #2 update**: Confirmed. No admin API endpoint for customer entitlements/limits exists.

**Recommendation**: Track as standalone task or billing admin SPEC.

---

### GAP-038-12: Missing test for entitlement addon without durationDays (permanent grant)

- **Audit Pass**: #2
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Test coverage gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar 1 test case con mock addon durationDays: null, verificar grant() sin expiresAt.

**Description**: All current entitlement addons (`visibility-boost-7d`, `visibility-boost-30d`) have `durationDays` set. The code at `addon-entitlement.service.ts` correctly handles `durationDays === null` (sets `expiresAt` to `undefined`), but there is **no test** verifying that a hypothetical permanent entitlement addon (with `durationDays: null`) results in `grant()` being called WITHOUT an `expiresAt` parameter.

**Evidence**:
- `addon-entitlement.service.ts`: `if (addon.durationDays !== null && addon.durationDays > 0) { expiresAt = new Date(...) }` - correctly conditional
- Test file: grep for `durationDays.*null`, `expiresAt.*undefined`, `permanent.*entitle` = **zero matches**
- All test cases use `visibility-boost-7d` or `visibility-boost-30d` which have `durationDays: 7` and `durationDays: 30`

**Impact**: If the `durationDays` check logic is ever broken (e.g., refactor removes the null guard), no test would catch it. Edge case coverage gap.

**Proposed Solution**: Add a test that creates a mock addon with `grantsEntitlement: FEATURED_LISTING` and `durationDays: null`, verifies `billing.entitlements.grant()` is called WITHOUT `expiresAt` (or with `expiresAt: undefined`).

**Recommendation**: Fix directly. Add 1 test case.

---

### GAP-038-13: Metadata status drift - spec status is "draft" but all tasks completed

- **Audit Pass**: #2
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Project management / state inconsistency
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Actualizar metadata.json y spec.md status a "completed".

**Description**: `metadata.json` has `"status": "draft"` (line 4) while `state.json` shows all 22/22 tasks completed. The spec should have been updated to `"in-progress"` when work started and `"completed"` when all tasks passed quality gate.

**Evidence**:
- `metadata.json:4`: `"status": "draft"`
- `state.json:263`: `"completed": 22`
- `spec.md:3`: `**Status**: draft`

**Impact**: Task dashboard and reporting tools show incorrect spec status. The `/tasks` command will not reflect this spec's actual completion state.

**Proposed Solution**: Update `metadata.json` and `spec.md` status to `completed`.

**Recommendation**: Fix directly. Trivial.

---

### GAP-038-14: No test for concurrent addon purchase (race condition with unique constraint)

- **Audit Pass**: #2
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Low (2)
- **Category**: Test coverage gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar test de integración que simule purchase concurrente y verifique manejo de error 23505.

**Description**: The spec explicitly describes handling concurrent addon purchases (Risk 4, spec line 1703-1709) and the code correctly handles Postgres error code 23505 (`addon.checkout.ts:458-466`). However, there is no **integration-level** test that simulates two concurrent purchase confirmations for the same addon and verifies that only one succeeds while the other gets a 409 (or graceful failure).

**Evidence**:
- `addon.checkout.ts:458-462`: Correct 23505 handling present
- `addon.checkout.test.ts`: Tests verify purchaseId propagation and constraint handling, but as unit tests with mocked DB
- No integration test with actual Postgres that triggers the partial unique index collision

**Impact**: The unique constraint handling works in theory but has never been tested against a real database. If the partial index syntax is subtly wrong or the error code matching fails, it would only be caught in production.

**Proposed Solution**: Add an integration test (or at minimum, a more realistic unit test) that:
1. Inserts an active purchase for (customer, addon)
2. Attempts a second INSERT for the same (customer, addon)
3. Verifies 23505 error is caught and handled gracefully

**Recommendation**: Track as standalone task. Low risk since the unit test does cover the code path.

---

### GAP-038-15: `removeAddonEntitlements` error resilience has inconsistent logging

- **Audit Pass**: #2
- **Severity**: TRIVIAL
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Code quality / observability
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Asegurar que catch blocks incluyan { customerId, addonSlug, purchaseId, operation } en logs.

**Description**: In `addon-entitlement.service.ts`, the `removeAddonEntitlements()` method catches errors from `revokeBySource` and `removeBySource` and continues with metadata cleanup (resilient design, per test cases at lines 722 and 762). However, the error logging inside these catch blocks may not include sufficient context (e.g., the `purchaseId`, `addonSlug`, and which specific operation failed).

**Evidence**:
- Test at line 722: `should continue with metadata cleanup even if revokeBySource throws (resilience)`
- Test at line 762: `should continue with metadata cleanup even if removeBySource throws (resilience)`
- The catch blocks log but the log message content was not verified to include purchaseId context

**Impact**: When debugging a failed revocation in production logs, the operator may not have enough context to identify which specific purchase/addon/customer had the failure.

**Proposed Solution**: Verify and ensure that catch blocks in `removeAddonEntitlements()` include `{ customerId, addonSlug, purchaseId, operation: 'revokeBySource'|'removeBySource' }` in the log payload.

**Recommendation**: Fix directly if missing. Trivial.

---

### GAP-038-16: No test verifying `clearEntitlementCache()` is NOT called on apply/remove failure

- **Audit Pass**: #2
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Test coverage gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar 2-3 assertions not.toHaveBeenCalled() en test cases de error existentes.

**Description**: The tests verify that `clearEntitlementCache()` IS called on successful apply/remove (test lines 324, 800). They also verify that the method returns error codes on failure (e.g., `INTERNAL_ERROR`). But there is **no explicit test** verifying that `clearEntitlementCache()` is NOT called when `applyAddonEntitlements()` fails entirely (e.g., when `billing.entitlements.grant()` throws).

**Evidence**:
- Test at line 420: `should return INTERNAL_ERROR when billing.entitlements.grant throws` - checks return value but doesn't assert `clearEntitlementCache` was NOT called
- Test at line 445: `should return INTERNAL_ERROR when billing.limits.set throws` - same
- Looking at the service code: `clearEntitlementCache()` is called at line 227 (inside apply, after successful operations) and line 433 (inside remove, after operations). On error, the function returns early before reaching the cache clear.

**Impact**: Low. The code flow naturally prevents cache clearing on error (early return). But without a test, a refactor could move the `clearEntitlementCache()` call to a wrong position.

**Proposed Solution**: Add assertions to existing error test cases: `expect(clearEntitlementCache).not.toHaveBeenCalled()` in the `INTERNAL_ERROR` scenarios.

**Recommendation**: Fix directly. Add 2-3 assertions to existing tests.

---

### GAP-038-17: Scoped `billing` variable shadowing in cron notification loops

- **Audit Pass**: #2
- **Severity**: TRIVIAL
- **Priority**: LOW
- **Complexity**: Trivial (1)
- **Category**: Code quality
- **Status**: **HACER** (decidido 2026-03-16) — se resuelve junto con GAP-038-09

**Description**: Beyond the redundancy noted in GAP-038-09, the `const billing = getQZPayBilling()` at lines 219 and 330 creates **new** `const` declarations that shadow the outer-scope `billing` variable (line 122). Each inner scope also re-adds its own null guard (`if (!billing)`), which is redundant since the outer scope already validated and would have returned early if null.

**Evidence**:
- Line 122: `const billing = getQZPayBilling(); if (!billing) { ... return; }`
- Line 219: `const billing = getQZPayBilling(); if (!billing) { ... continue; }`
- Line 330: `const billing = getQZPayBilling(); if (!billing) { ... continue; }`

**Impact**: Functionally harmless (singleton). But the variable shadowing could confuse maintainers into thinking the billing instance might change between the outer scope and the loop iteration.

**Proposed Solution**: Remove lines 219-224 and 330-335. Use the outer `billing` variable directly.

**Recommendation**: Fix directly with GAP-038-09. Trivial.

---

### GAP-038-18: Cache TTL and FIFO eviction behavior not tested in middleware

- **Audit Pass**: #3
- **Severity**: MEDIUM
- **Priority**: MEDIUM
- **Complexity**: Low (2)
- **Category**: Test coverage gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar 2 tests: TTL expiration con vi.setSystemTime() y FIFO eviction con 500+ entries.

**Description**: The entitlement middleware uses a `Map`-based in-memory cache (`entitlementCache`) with two key behaviors that are completely untested:
1. **TTL expiration**: Entries expire after `CACHE_TTL_MS` (5 minutes). No test verifies that expired entries are re-fetched from QZPay.
2. **FIFO eviction**: When cache exceeds `CACHE_MAX_SIZE` (500 entries), the oldest entry is evicted (`Map.keys().next().value`). No test verifies that the 501st entry causes the 1st to be evicted.

**Evidence**:
- `entitlement.ts`: `const entitlementCache = new Map<string, CachedEntitlements>()`
- `entitlement.ts`: `if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS)` - TTL check present but never tested
- `entitlement.ts`: `if (entitlementCache.size >= CACHE_MAX_SIZE) { entitlementCache.delete(...) }` - eviction present but never tested
- Test file: grep for `CACHE_TTL`, `CACHE_MAX_SIZE`, `evict`, `expire`, `stale` = **zero matches**

**Impact**: If TTL logic is inverted (e.g., `>` vs `<`) or eviction has an off-by-one error, stale entitlements serve production traffic for up to 5 minutes silently. Eviction failure means unbounded memory growth.

**Proposed Solution**:
```typescript
// Test TTL expiration
it('should re-fetch when cache entry is stale', async () => {
    // Prime the cache
    await request(app).get('/protected/test').set(authHeaders);
    // Fast-forward time past TTL
    vi.setSystemTime(Date.now() + CACHE_TTL_MS + 1);
    // Second request should re-fetch, not use cache
    const spy = vi.spyOn(billing.entitlements, 'getByCustomerId');
    await request(app).get('/protected/test').set(authHeaders);
    expect(spy).toHaveBeenCalledTimes(1); // would be 0 if cache hit
});

// Test FIFO eviction (unit level)
it('should evict oldest entry when cache is full', () => {
    for (let i = 0; i < CACHE_MAX_SIZE; i++) {
        entitlementCache.set(`customer-${i}`, { ... });
    }
    // Add one more - should evict customer-0
    entitlementCache.set('customer-overflow', { ... });
    expect(entitlementCache.has('customer-0')).toBe(false);
    expect(entitlementCache.size).toBe(CACHE_MAX_SIZE);
});
```

**Recommendation**: Fix directly. Add 2 tests. The cache is a critical performance component - these behaviors must be verified.

---

### GAP-038-19: Migration plan restoration limited to 100 plans (hardcoded pagination ceiling)

- **Audit Pass**: #3
- **Severity**: MEDIUM
- **Priority**: MEDIUM
- **Complexity**: Low (2)
- **Category**: Migration correctness bug
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Usar fetch-all explícito sin paginación en plan restoration phase.

**Description**: The migration script (`migrate-addon-purchases.ts`) Phase 4 (plan restoration) fetches plans to restore using a query that is likely limited to the default page size (100). If the database has more than 100 billing plans that need restoration, the excess plans will NOT be processed, leaving some plans permanently mutated with addon-inflated values.

**Evidence**:
- `migrate-addon-purchases.ts`: Plan restoration phase fetches plans for cleanup
- Standard Drizzle queries without explicit `.limit()` still have database-level limits
- If `createAdminListRoute` is used internally with default pageSize=20 or 100, only first page is processed
- No pagination loop found in migration script for the plan restoration phase
- Current data: 9 plans in `ALL_PLANS` config, so this is safe NOW, but not future-proof

**Impact**: In its current state (9 plans), no data loss occurs. But if a project runs the migration after adding more plans, or if `billing_plans` has historical entries beyond the query limit, some plan rows won't be restored to their canonical values. Addon-inflated limit values would persist in `billing_plans`.

**Proposed Solution**:

1. **Explicit fetch-all without pagination** (RECOMMENDED for migrations):
   ```typescript
   // In plan restoration phase:
   const allPlans = await db.select().from(billingPlans).where(isNotNull(billingPlans.id));
   // Process ALL plans, no limit
   ```

2. **Pagination loop**:
   ```typescript
   let page = 0;
   let hasMore = true;
   while (hasMore) {
       const plans = await db.select().from(billingPlans).limit(100).offset(page * 100);
       hasMore = plans.length === 100;
       page++;
       // process plans...
   }
   ```

**Recommendation**: Fix directly with Solution 1. Migrations must be exhaustive by design - never paginate implicitly.

---

### GAP-038-20: Incomplete `billingEnabled` mock in entitlement middleware tests

- **Audit Pass**: #3
- **Severity**: LOW
- **Priority**: LOW
- **Complexity**: Low (2)
- **Category**: Test quality gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar env setup explícito HOSPEDA_BILLING_ENABLED=true en beforeAll + grupo de tests para billing disabled.

**Description**: The entitlement middleware test suite mocks `getQZPayBilling()` but the `billingEnabled` flag check (which gates ALL entitlement middleware logic) may not be consistently mocked across all test cases. If `billingEnabled` defaults to `false` in the test environment, tests that assert entitlement behavior are actually testing a no-op code path.

**Evidence**:
- `entitlement.ts`: `if (!billingEnabled || !billing) { return next(); }` - early return if billing disabled
- Test file: search for `billingEnabled`, `HOSPEDA_BILLING_ENABLED`, mock env setup = sparse results
- If env var is not set in test setup, the middleware skips all entitlement logic, making positive assertions meaningless

**Impact**: Tests may be passing not because the entitlement logic is correct, but because the middleware exits early due to `billingEnabled=false`. False confidence in test coverage.

**Proposed Solution**:
1. Add explicit `billingEnabled = true` env setup in all entitlement middleware test cases that test positive paths
2. Add a dedicated test group for `billingEnabled = false` behavior (should call `next()` immediately, no QZPay calls)
3. Ensure test setup explicitly sets `process.env.HOSPEDA_BILLING_ENABLED = 'true'` in `beforeAll`

**Recommendation**: Fix directly. Verify the current test setup and add explicit env control.

---

### GAP-038-21: `billing.limits.removeBySource()` may not exist — potential runtime TypeError on all limit addon cancellations

- **Audit Pass**: #4
- **Severity**: **CRITICAL** (needs immediate verification, likely production-blocking)
- **Priority**: **CRITICAL**
- **Complexity**: Low (1-2)
- **Category**: Potential functional bug — QZPay service interface wiring
- **Status**: **RESOLVED** (Pass #8 — verified `removeBySource` exists in `@qazuor/qzpay-core/dist/index.d.ts` QZPayLimitService interface)

**Description**: The `addon-entitlement.service.ts` calls `this.billing.limits.removeBySource('addon', input.purchaseId)` at line 383 for limit-type addon removals. The SPEC-038 Q7 requirement specifies that `QZPayLimitService` must expose a `removeBySource()` method. The underlying qzpay-drizzle repository method is named `deleteBySource()`. During pass #4, inspection of the installed `@qazuor/qzpay-drizzle` package internals found `LimitRepo.deleteBySource()` exists at the repo level — but could not confirm the service adapter wires it as `removeBySource` in the public `QZPayLimitService` interface.

**Bug surface**: If `QZPayLimitService.removeBySource()` was NOT wired in the service adapter (qzpay-core) during the v1.2.0 update, every call to `billing.limits.removeBySource()` throws:
```
TypeError: this.billing.limits.removeBySource is not a function
```

**Affected operations** (all limit addon cleanup paths):
- `removeAddonEntitlements()` when addon has `affectsLimitKey` (extra-photos-20, extra-accommodations-5, extra-properties-5)
- Called from: addon cancel route → `cancelUserAddon()` → `removeAddonEntitlements()`
- Called from: expiry cron → `expireAddon()` → `removeAddonEntitlements()`

**Why tests did NOT catch this** (if it exists): Tests use `createMockBilling()` which mocks the billing object. The mock includes `limits.removeBySource` as a mock function regardless of whether the real package has it. Unit tests pass even if the real implementation doesn't have the method.

**Pass #4 conflicting evidence**:
- ❌ QZPay drizzle package inspection: `deleteBySource()` found at repo level, `removeBySource()` NOT explicitly found
- ✅ Existing verified list (from pass #2): marks `removeBySource` as "correctly implemented"
- The discrepancy suggests pass #2 may have only verified the Hospeda code calls `removeBySource`, not that the real QZPay package exposes it

**Impact**: If confirmed: All limit addon cancellations/expirations silently fail with a runtime error. Customers who cancel `extra-photos-20`, `extra-accommodations-5`, or `extra-properties-5` will keep their limit increase indefinitely. The fallback to `remove()` would also never be reached.

**Verification steps**:
```bash
# Check if removeBySource is in the installed QZPay limit service interface
grep -n "removeBySource" node_modules/@qazuor/qzpay-core/dist/index.d.ts
grep -n "removeBySource" node_modules/@qazuor/qzpay-core/dist/index.js
grep -n "removeBySource" node_modules/@qazuor/qzpay-drizzle/dist/index.js
```

**Proposed Solutions**:

1. **If method exists in installed package** (best case): No action needed on Hospeda side. Update verified list, add a test that calls the real method (not mocked) to prevent regression.

2. **If method does NOT exist in installed package**:
   - **Option A**: Fix qzpay-drizzle service adapter to expose `removeBySource(source, sourceId)` wrapping `deleteBySource(source, sourceId)`. Bump package version. Update deps.
   - **Option B** (temporary): Replace `billing.limits.removeBySource()` in `addon-entitlement.service.ts` with a direct call to the underlying storage adapter via `billing.getStorage().limits.deleteBySource()` (if `getStorage()` is available — risky, couples to internals).
   - **Option A is the correct fix.**

3. **Add a non-mock integration test** that exercises the full flow with the real billing package (not mocked) to catch this class of interface mismatch in CI.

**Recommendation**: **Verify IMMEDIATELY** with the grep commands above. If the method is missing, fix in QZPay and update Hospeda deps. Also add a type-level guard to prevent future silent failures: the Hospeda code should import `QZPayLimitService` type and assert `billing.limits satisfies QZPayLimitService` so TypeScript catches missing methods.

---

### GAP-038-22: `CancelAddonInput.purchaseId` is optional with unsafe slug fallback — all direct programmatic cancellations fail silently

- **Audit Pass**: #4
- **Severity**: HIGH
- **Priority**: HIGH
- **Complexity**: Low (2)
- **Category**: Functional bug — API design flaw
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Hacer purchaseId required en CancelAddonInput. Se implementa junto con GAP-038-03.

**Description**: `CancelAddonInput.purchaseId` is typed as `optional` (`purchaseId?: string`). In `cancelUserAddon()` at `addon.user-addons.ts:331`, when `purchaseId` is undefined, the code falls back to `input.addonId` as the purchaseId:

```typescript
// addon.user-addons.ts:328-332
const result = await entitlementService.removeAddonEntitlements({
    customerId: input.customerId,
    addonSlug,
    purchaseId: input.purchaseId ?? input.addonId  // BUG: addonId is the SLUG, not a UUID
});
```

`input.addonId` holds the addon **slug** (e.g., `"extra-photos-20"`), not a purchase UUID. If any caller omits `purchaseId`, `removeAddonEntitlements` receives a slug as `sourceId`, causing:
- `revokeBySource('addon', 'extra-photos-20')` → finds 0 rows (correct sourceId would be a UUID)
- Fallback `revoke(customerId, entitlementKey)` runs but `getAddonBySlug(slug)` — wait, this uses the REAL addonSlug variable from `const addonSlug = input.addonId` — this part actually IS the slug, so the fallback works.

**Revised assessment**: The fallback to `revoke()` and `remove()` (individual by customer+key) would still work even with the wrong purchaseId, because those fallbacks use `customerId` and `addon.affectsLimitKey`/`addon.grantsEntitlement` from the addon definition (not from purchaseId). The REAL issue is that `revokeBySource`/`removeBySource` silently find 0 rows and the cleanup is done by the less-specific fallback.

**Actual impact**:
1. `revokeBySource` fails silently (0 rows found with sourceId=slug)
2. Fallback `revoke(customerId, key)` removes the entitlement/limit correctly
3. BUT: if a customer has TWO entitlement rows from different sources (e.g., a manual grant + an addon grant), `revoke()` removes ALL active entitlements for that key, not just the addon one. This over-revokes.
4. Future stacking (multiple addons affecting same limit) would also break.

**Evidence**:
- `addon.user-addons.ts:331`: `purchaseId: input.purchaseId ?? input.addonId`
- `addon.types.ts:94`: `purchaseId?: string` (optional)
- The cancel ROUTE (`addons.ts`) DOES pass `purchaseId: ownedAddon.id` (correct), but this relies on the route working correctly (which is broken per GAP-038-03 — when GAP-038-03 is fixed, the route will correctly pass purchaseId)
- Any code that calls `cancelUserAddon()` programmatically without `purchaseId` will use the fallback

**Proposed Solutions**:

1. **Make `purchaseId` required in `CancelAddonInput`** (RECOMMENDED):
   ```typescript
   interface CancelAddonInput {
       customerId: string;
       addonId: string;      // slug
       purchaseId: string;   // REQUIRED: UUID from billing_addon_purchases.id
       reason?: string;
       userId: string;
   }
   ```
   - Pros: Eliminates ambiguity, fails loudly at compile time
   - Cons: Breaking change (any callers must update)

2. **Keep optional but extract purchaseId from DB if missing**:
   ```typescript
   // If purchaseId not provided, look it up from DB
   const resolvedPurchaseId = input.purchaseId ?? (
       await db.select({ id: billingAddonPurchases.id })
           .from(billingAddonPurchases)
           .where(and(eq(billingAddonPurchases.customerId, input.customerId),
                      eq(billingAddonPurchases.addonSlug, addonSlug),
                      eq(billingAddonPurchases.status, 'active')))
           .limit(1)
   )[0]?.id;
   ```
   - Pros: Backward compatible, robust
   - Cons: Extra DB query in uncommon path

3. **Remove fallback to `input.addonId` entirely — fail if purchaseId missing**:
   ```typescript
   if (!input.purchaseId) {
       return { success: false, error: { code: 'MISSING_PURCHASE_ID' } };
   }
   ```
   - Pros: Explicit, no silent failures
   - Cons: Breaking for any callers without purchaseId

**Recommendation**: Fix with Solution 1 (make required) as part of fixing GAP-038-03. The cancel route fix will always provide `purchaseId`. Any other callers (e.g., tests, admin tools) need updating. This is the correct API design.

**Relationship to GAP-038-03**: GAP-038-03 (UUID-as-slug bug in cancel route) means the cancel route currently passes the UUID as `addonId` (wrong) and `purchaseId` as the UUID (from `ownedAddon.id`). Once GAP-038-03 is fixed (route passes slug as `addonId` and UUID as `purchaseId`), the `purchaseId` will always be present from the route. This gap (GAP-038-22) matters for any other entry points to `cancelUserAddon()`.

---

---

### GAP-038-23: Admin HTTP Adapter Missing `revokeBySource` and `removeBySource`

- **Audit Pass**: #5
- **Severity**: CRITICAL
- **Priority**: P0
- **Complexity**: Low (1)
- **Category**: Functional bug — admin-side runtime crash path
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar 3 métodos faltantes (revokeBySource, delete, deleteBySource) + strict interface typing en el adapter.

**Description**: The admin app's billing HTTP adapter (`apps/admin/src/lib/billing-http-adapter/vendor-entitlement-limit-addon-storage.ts`) does NOT implement `revokeBySource()` on `createEntitlementStorage()` nor `removeBySource()` on `createLimitStorage()`. These methods were introduced in QZPay v1.2.0 as part of SPEC-038's Q5/Q7 requirements, and the production service code now calls them in `removeAddonEntitlements()`.

**Evidence**:
- `createEntitlementStorage()` implements: `createDefinition`, `findDefinitionByKey`, `listDefinitions`, `grant`, `revoke`, `findByCustomerId`, `check`. Missing: `revokeBySource`.
- `createLimitStorage()` implements: `set`, `increment`, `findByCustomerId`, `check`, `recordUsage`. Missing: `removeBySource`.
- The `QZPayEntitlementStorage` interface (v1.2.0) now includes `revokeBySource` — this file fails to satisfy the interface at TypeScript compile time (type error).
- If any admin-initiated flow triggers addon cancellation/expiration that flows through this HTTP adapter, it throws `TypeError: billing.entitlements.revokeBySource is not a function` at runtime.

**Impact**: TypeScript compilation should fail for the admin app right now (unless the interface check is loose). If not caught at compile time, any admin cancellation of an addon that routes through this adapter crashes the admin app.

**Proposed Solutions**:

1. **Add the missing method stubs calling the API** (RECOMMENDED):
   ```typescript
   // In createEntitlementStorage():
   revokeBySource: async (source: string, sourceId: string) => {
       await billingFetch('/api/v1/protected/billing/entitlements/revoke-by-source', 'DELETE', { source, sourceId });
   },

   // In createLimitStorage():
   removeBySource: async (source: string, sourceId: string) => {
       await billingFetch('/api/v1/protected/billing/limits/remove-by-source', 'DELETE', { source, sourceId });
   },
   ```
   Note: Verify that the API endpoints `/api/v1/protected/billing/entitlements/revoke-by-source` and `/api/v1/protected/billing/limits/remove-by-source` exist (from QZPay Hono integration).

2. **Add TypeScript strict interface enforcement** to catch future missing methods:
   ```typescript
   const storage: QZPayEntitlementStorage = { ... };
   ```
   Instead of returning the object untyped.

**Recommendation**: **Fix immediately** with Solution 1 + 2. Verify that the admin app typechecks (`pnpm typecheck --filter admin`). If it already fails to typecheck, this is a deploy blocker.

---

### GAP-038-24: `cancelUserAddon` WHERE Clause Ignores `purchaseId`

- **Audit Pass**: #5
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: Low (1)
- **Category**: Functional bug — over-cancellation risk
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar purchaseId al WHERE clause. Se implementa junto con GAP-038-03.

**Description**: In `addon.user-addons.ts:285-291`, the DB update in `cancelUserAddon` filters by `(customerId, addonSlug, status='active')` but does NOT include `purchaseId` in the WHERE clause, even though `input.purchaseId` is available. This is semantically incorrect: the cancel operation should target exactly the identified purchase, not all active purchases of that addon type for the customer.

**Evidence**:
```typescript
// addon.user-addons.ts lines 285-291:
.where(
    and(
        eq(billingAddonPurchases.customerId, input.customerId),
        eq(billingAddonPurchases.addonSlug, addonSlug),
        eq(billingAddonPurchases.status, 'active')
        // MISSING: eq(billingAddonPurchases.id, input.purchaseId)
    )
)
```
The code logs "Multiple billing_addon_purchase records were cancelled" as an error but does NOT abort — it cancels ALL matching rows.

**Impact**: The unique partial index `idx_addon_purchases_active_unique` prevents multiple active rows under normal operation. However: (1) pre-migration data may have had duplicates, (2) a race window during migration, (3) any future removal of the unique index would silently cause over-cancellation. Also a correctness principle issue: if `purchaseId` is available, it MUST be used.

**Proposed Solutions**:

1. **Add `purchaseId` to WHERE clause unconditionally** (RECOMMENDED):
   ```typescript
   .where(
       and(
           eq(billingAddonPurchases.customerId, input.customerId),
           eq(billingAddonPurchases.addonSlug, addonSlug),
           eq(billingAddonPurchases.status, 'active'),
           eq(billingAddonPurchases.id, input.purchaseId)
       )
   )
   ```

2. **Keep as is but remove the multi-row cancel error logging and abort instead**:
   - Less ideal because it doesn't fix the root cause

**Recommendation**: Fix with Solution 1. Low-risk change, high correctness gain. Can be part of the GAP-038-03 fix PR.

---

### GAP-038-25: `UserAddon` Type Uses American Spelling Inconsistent With DB Column and Service Code

- **Audit Pass**: #5
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: Low (1)
- **Category**: Type system bug — silent comparison failure at runtime
- **Status**: **POSTERGAR** (decidido 2026-03-16)
- **Decisión**: Postergar. Requiere migración de DB column, más invasivo de lo justificable ahora.

**Description**: `addon.types.ts` defines `UserAddon.status` as `'active' | 'expired' | 'canceled' | 'pending'` (American: `canceled`). The DB column `cancelled_at` maps to Drizzle as `cancelledAt` (British). The service code at `addon.user-addons.ts` uses `status: 'cancelled'` (British) for DB updates. This creates a permanent mismatch: any code comparing `UserAddon.status === 'canceled'` will never match because the DB stores and returns `'cancelled'`.

**Evidence**:
- `addon.types.ts:75`: `status: 'active' | 'expired' | 'canceled' | 'pending'` (American)
- `addon.types.ts:78`: `canceledAt: Date | null` (American)
- `billing_addon_purchase.dbschema.ts:43`: `cancelledAt: timestamp('cancelled_at', ...)` (British)
- `addon.user-addons.ts:282`: `status: 'cancelled'` (British, used in DB update)
- If `addon.user-addons.ts` maps `purchase.cancelledAt` to `UserAddon.canceledAt`, the field name mismatch means it may be `undefined` at runtime (TypeScript won't catch this because both are `Date | null`).

**Impact**: Any consumer of `UserAddon` that checks `addon.status === 'canceled'` silently never matches (runtime comparison fails). The UI showing "cancelled" addons would be broken. The `canceledAt` field would always be `undefined` or `null` incorrectly.

**Proposed Solutions**:

1. **Standardize on British spelling throughout** (RECOMMENDED — matches DB):
   ```typescript
   // addon.types.ts:
   status: 'active' | 'expired' | 'cancelled' | 'pending';
   cancelledAt: Date | null;
   ```
   Update all consumers of `UserAddon`.

2. **Standardize on American spelling** — update DB column, schema, and all service code. More invasive, requires migration.

**Recommendation**: Fix immediately with Solution 1. The DB column is the canonical source; match it. Search for all usages of `canceled` (American) in the codebase and update.

---

### GAP-038-26: `ServiceResult<T>` Defined Three Times — DRY Violation

- **Audit Pass**: #5
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Low (1)
- **Category**: Code quality — Single Source of Truth violation
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Eliminar definiciones locales en ambos services e importar desde addon.types.ts.

**Description**: `addon.types.ts` defines the canonical `ServiceResult<T>`. Both `addon-entitlement.service.ts` (lines 27-34) and `addon-expiration.service.ts` define their own local copies instead of importing from `addon.types.ts`. This violates the Single Source of Truth principle documented in `CLAUDE.md`.

**Evidence**:
- `addon.types.ts`: canonical `ServiceResult<T>` definition
- `addon-entitlement.service.ts:27-34`: local copy
- `addon-expiration.service.ts`: local copy

**Impact**: Future changes to `ServiceResult<T>` (e.g., adding `errorCode`, `requestId`) must be applied in 3+ places. Divergence risk increases with every refactor. Not a runtime bug currently.

**Proposed Solution**: Remove local definitions and import from `addon.types.ts`:
```typescript
import type { ServiceResult } from './addon.types.js';
```

**Recommendation**: Fix directly. Trivial — 2 files, 1 import each.

---

### GAP-038-27: Cron Job `wasNotificationSent` Does Not Filter by `addonSlug`

- **Audit Pass**: #5
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Medium (2)
- **Category**: Logic bug — notification suppression for second addon
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar addonSlug al check de idempotencia en wasNotificationSent. Almacenar addonSlug en metadata del notification log.

**Description**: The `wasNotificationSent` function in `addon-expiry.job.ts` queries `billing_notification_log` by `(type, customerId, createdAt >= todayStart)` WITHOUT filtering by `addonSlug`. If a customer has two different addons expiring on the same day, the second notification is incorrectly suppressed: `wasNotificationSent` returns `true` after finding the first notification of type `TYPE_ADDON_EXPIRING_SOON` for that customer today, regardless of which addon triggered it.

**Evidence**:
- `addon-expiry.job.ts`: `wasNotificationSent(type, customerId)` — no `addonSlug` parameter
- Query likely: `WHERE type = ? AND customerId = ? AND createdAt >= todayStart`
- Customer with addons `visibility-boost-7d` AND `extra-photos-20` both expiring today → only the first gets a notification email

**Impact**: Silent data loss in notification delivery. Severity escalates if customers with multiple addons are common. The system cannot guarantee notification delivery for all expiring addons.

**Proposed Solutions**:

1. **Add `addonSlug` to the idempotency check** (RECOMMENDED):
   ```typescript
   // wasNotificationSent(type, customerId, addonSlug)
   // WHERE type = ? AND customerId = ? AND addonSlug = ? AND createdAt >= todayStart
   ```
   Requires `billing_notification_log` table to store `addonSlug` in metadata or as a dedicated column.

2. **Use a composite unique key** in the notification log: `(type, customerId, addonSlug, date)`.

3. **Accept risk**: Current addon config makes this unlikely (few customers with 2+ addons of types that both expire on same day).

**Recommendation**: Fix directly with Solution 1. Low-medium complexity. The notification log table likely has a `metadata` JSON column where `addonSlug` can be stored.

---

### GAP-038-28: Migration Idempotency Check Uses Fragile Timestamp String Comparison

- **Audit Pass**: #5
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Medium (2)
- **Category**: Migration correctness — potential duplicate rows on re-run
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Normalizar timestamps a UTC ISO 8601 con new Date(ts).toISOString() antes de comparar.

**Description**: The migration script's idempotency check in `migrate-addon-purchases.ts` matches existing records by comparing `purchasedAt` as a timestamp string. PostgreSQL returns timestamps with timezone and microsecond precision; depending on how the source data was stored vs. how Drizzle serializes it for comparison, timezone offset representation or precision may differ, causing string equality to fail even for semantically identical timestamps.

**Evidence**:
- `migrate-addon-purchases.ts`: idempotency check on `(customerId, subscriptionId, addonSlug, purchasedAt)` tuple
- PostgreSQL timestamp examples: `2024-03-01T12:00:00.000000+00:00` vs. `2024-03-01T12:00:00.000Z` — same instant, different string representation
- No normalization code found before the comparison

**Impact**: Re-running the migration (which should be safe and idempotent) could insert duplicate `billing_addon_purchases` rows. The unique partial index only prevents duplicates with `status='active'` for the same `(customerId, addonSlug)`, so historical `'expired'` rows could be duplicated without hitting the constraint.

**Proposed Solutions**:

1. **Normalize timestamps to UTC ISO 8601 before comparison** (RECOMMENDED):
   ```typescript
   const normalizedExisting = new Date(existing.purchasedAt).toISOString();
   const normalizedNew = new Date(newPurchase.purchasedAt).toISOString();
   if (normalizedExisting === normalizedNew) { /* idempotent skip */ }
   ```

2. **Use a dedicated migration tracking column** (`migrated_at`, `migration_batch_id`) instead of comparing business data fields.

3. **Use integer epoch comparison** instead of string: `existing.purchasedAt.getTime() === newPurchase.purchasedAt.getTime()`.

**Recommendation**: Fix with Solution 1 or 3. Both are trivial changes. The migration must be run in production; fragile idempotency is unacceptable.

---

### GAP-038-29: Migration Silently Skips Entitlement Backfill on Empty INSERT `.returning()`

- **Audit Pass**: #5
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Low (1)
- **Category**: Migration correctness — silent partial state
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar throw cuando inserted?.id es falsy. Nunca skipear silenciosamente entitlement backfill.

**Description**: After `db.insert(billingAddonPurchases).values(...).returning({ id: billingAddonPurchases.id })`, the result is destructured as `const [inserted] = result`. The code guards `if (inserted !== undefined)` before calling the entitlement backfill. If the insert succeeds but `.returning()` returns an empty array (a Drizzle edge case or a future Drizzle version change), `inserted` is `undefined` and the backfill is silently skipped with no error thrown.

**Evidence**:
- `migrate-addon-purchases.ts`: `const [inserted] = await db.insert(...).returning({ id: ... })`
- Code: `if (inserted !== undefined) { await backfillEntitlements(inserted.id); }` (or equivalent guard)
- No `throw` on the `undefined` path — silent continuation

**Impact**: Partial migration state: `billing_addon_purchases` row exists but no entitlements applied in QZPay. The migration logs may show "migrated" but the customer has no entitlements. Requires manual detection and repair.

**Proposed Solution**:
```typescript
const [inserted] = await db.insert(billingAddonPurchases).values(...).returning({ id: billingAddonPurchases.id });
if (!inserted?.id) {
    throw new Error(
        `Migration: INSERT returned no row for customer=${customerId} addon=${addonSlug}. ` +
        'Manual intervention required.'
    );
}
await backfillEntitlements(inserted.id);
```

**Recommendation**: Fix directly. Add the throw. Never silently skip entitlement application in a migration.

---

### GAP-038-30: Test Files Use Prohibited `any` Types — Will Block Biome Lint Gate

- **Audit Pass**: #5
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (1)
- **Category**: Test quality — lint gate blocker
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Reemplazar any con tipos correctos (ReturnType, Partial, Mocked, etc).

**Description**: `apps/api/test/services/addon-expiration.service.test.ts` uses `any` types at multiple locations, violating the `noExplicitAny` Biome rule and the project's TypeScript strict mode requirement.

**Evidence**:
```typescript
// addon-expiration.service.test.ts:
let mockDb: any;                            // line ~71
let mockEntitlementService: any;            // line ~73
const createMockAddonPurchase = (overrides: any = {}) => { ... }  // line ~79
```

**Impact**: If Biome runs on test files (which it should, per project config), these `any` types will fail the pre-commit lint hook and the CI lint check. Commits including this file will be blocked.

**Proposed Solution**:
```typescript
import type { AddonEntitlementService } from '../../src/services/addon-entitlement.service.js';
import type { BillingAddonPurchase } from '@repo/db';

let mockDb: ReturnType<typeof vi.fn>;
let mockEntitlementService: jest.Mocked<AddonEntitlementService>;
const createMockAddonPurchase = (overrides: Partial<BillingAddonPurchase> = {}): BillingAddonPurchase => {
```

**Recommendation**: Fix directly. Add proper types. Low effort, required for quality gate (T-015).

---

### GAP-038-31: Test for "Skip `limits.set()` When Base Plan Limit is -1" Does NOT Test the -1 Value

- **Audit Pass**: #5
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (1)
- **Category**: Test quality — misleading test coverage
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar test case dedicado que mockee ALL_PLANS con -1 y verifique set() NOT called.

**Description**: A test in `addon-entitlement.service.test.ts` is titled "should skip limits.set() when base plan limit is -1 (unlimited)". However, the mock setup does NOT configure any plan to return `-1` for the target limit key. Instead, `basePlanLimit` defaults to `0` (key not found in plan config). The `-1` unlimited sentinel value code path is never exercised.

**Evidence**:
- Test mock: `ALL_PLANS.find()` returns a plan where the addon's `affectsLimitKey` is NOT present → `basePlanLimit = 0`
- Service code: `if (basePlanLimit === -1) { /* skip set() */ }` — this branch is never reached
- Test passes because `basePlanLimit = 0` may also skip `set()` by different logic (or the test assertion only checks that `set()` was not called, regardless of which code path prevented it)

**Impact**: If the `-1` check in the service has a bug (e.g., `basePlanLimit <= 0` instead of `basePlanLimit === -1`), the test would pass incorrectly. The unlimited path is effectively untested.

**Proposed Solution**: Add a dedicated test case that explicitly mocks `ALL_PLANS` to return `-1` for the addon's `affectsLimitKey`, then asserts `billing.limits.set` was NOT called:
```typescript
it('should skip limits.set() when base plan limit is truly -1', () => {
    vi.mocked(ALL_PLANS.find).mockReturnValue({
        limits: { 'photo-count': -1 },
        // ...other plan fields
    });
    // Run applyAddonEntitlements for an addon with affectsLimitKey: 'photo-count'
    // Assert billing.limits.set was NOT called
});
```

**Recommendation**: Fix directly. Add 1 test case. Essential for coverage of the unlimited plan scenario.

---

### GAP-038-32: `getUserAddons` Returns Only Active Addons — No Purchase History Available

- **Audit Pass**: #5
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Medium (2)
- **Category**: Feature gap / UX gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar parámetro optional statuses a getUserAddons() con default ['active'].

**Description**: `getUserAddons()` in `addon.user-addons.ts` filters with `WHERE status = 'active'` exclusively. Expired and cancelled addon purchases are invisible to the service layer. This means: (1) the UI cannot show addon purchase history, (2) the cancel flow makes a redundant extra DB call to verify the addon is active (when the route already queried for it), (3) there is no programmatic way to retrieve past addon activity for a customer without writing new queries.

**Evidence**:
- `addon.user-addons.ts:60-63`: `WHERE status = 'active'` — hardcoded
- The cancel route at `addons.ts:298-314` already fetches the purchase for ownership verification, yet `cancelUserAddon` calls `getUserAddons()` again internally for a second active-status check
- No `getAddonHistory()` or `getAddonsByStatus()` method exists

**Impact**: Pure UX gap — customer cannot see cancelled/expired addon history. Also minor inefficiency in the cancel flow (2 DB queries for what could be 1).

**Proposed Solutions**:

1. **Add optional `statuses` filter parameter** to `getUserAddons`:
   ```typescript
   getUserAddons({ customerId, statuses = ['active'] })
   ```

2. **Add a separate `getAddonHistory()` method** returning all statuses.

3. **Pass the already-fetched purchase into `cancelUserAddon`** to eliminate the duplicate DB call.

**Recommendation**: Track as standalone task. Not urgent, but needed before shipping an addon history UI.

---

### GAP-038-33: Notification Send Failures Logged at `debug` Level — Invisible in Production

- **Audit Pass**: #5
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (1)
- **Category**: Observability — silent failures in production
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Cambiar debug a warn con contexto completo { addonSlug, customerId, purchaseId, error, notificationType }.

**Description**: In `addon-expiry.job.ts`, when `sendNotification()` throws, the error is caught but logged at `debug` level. In production deployments, debug logs are typically suppressed (log level `info` or higher). This means notification delivery failures are completely invisible in production monitoring and alerting.

**Evidence**:
- `addon-expiry.job.ts`: notification send catch block uses `apiLogger.debug(...)` or equivalent low-level logging
- The cron job continues processing (correct for resilience), but operators have no visibility into notification failures
- No metric or alert is triggered on notification failures

**Impact**: Silent failure in customer communication. Expired addon notifications may not be delivered with no operator awareness. Could be caught by customer complaints rather than proactive monitoring.

**Proposed Solution**:
```typescript
apiLogger.warn(
    { addonSlug, customerId, purchaseId, error: err.message, notificationType },
    'Failed to send addon expiry notification — customer may not receive warning'
);
```

**Recommendation**: Fix directly. One-line change per notification send catch block. Critical for production observability.

---

### GAP-038-34: `confirmAddonPurchase` Calls `billing.plans.get()` When `ALL_PLANS` Config Suffices

- **Audit Pass**: #5
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: Medium (2)
- **Category**: Code quality — unnecessary billing API call
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Reemplazar billing.plans.get() con ALL_PLANS.find() para consistencia y eliminar llamada de red.

**Description**: In `addon.checkout.ts`, `confirmAddonPurchase` calls `billing.plans.get(activeSubscription.planId)` to compute `limitAdjustments` metadata stored in `billing_addon_purchases`. This is a read-only billing API call for data that already exists in the `ALL_PLANS` canonical config, which `applyAddonEntitlements` already reads for the same purpose.

**Evidence**:
- `addon.checkout.ts:~370-380`: `const plan = await billing.plans.get(activeSubscription.planId)` for metadata computation
- `addon-entitlement.service.ts`: `ALL_PLANS.find(p => p.slug === planSlug)` — same data, no billing API call
- Two different sources for the same data within the same addon purchase flow

**Impact**: Minor performance issue (extra network/DB call). More importantly: if QZPay's plan storage is restructured or removed in the future, this creates an independent failure point in the checkout flow that's unrelated to the actual entitlement fix.

**Proposed Solution**: Replace `billing.plans.get(activeSubscription.planId)` with `ALL_PLANS.find(p => p.slug === activeSubscription.planId)` for consistency:
```typescript
const planConfig = ALL_PLANS.find(p => p.slug === activeSubscription.planId);
const limitAdjustments = planConfig ? computeLimitAdjustments(planConfig, addon) : {};
```

**Recommendation**: Fix directly — low complexity. Adds consistency with `applyAddonEntitlements` pattern and removes coupling to billing plan storage.

---

### GAP-038-35: `restoreAllPlans` Uses Private Storage Access Without Documentation of Intent

- **Audit Pass**: #5
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: Low (1)
- **Category**: Code quality / documentation — dangerous pattern without guardrails
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar JSDoc prominente explicando excepción intencional + referencia a SPEC-038. No copiar patrón.

**Description**: The migration script's `restoreAllPlans()` function calls `billing.getStorage().plans.update()` — the exact private API access pattern that SPEC-038 designated as the root bug (the old `@ts-expect-error billing.getStorage()` anti-pattern). In the migration context this is intentional (one-time script to reset plans corrupted by the old pattern), but:
1. It's not documented as a deliberate exception
2. There's no `--force` flag requirement to prevent accidental re-runs
3. Future developers may copy this pattern as a "precedent"

**Evidence**:
- `migrate-addon-purchases.ts`: `restoreAllPlans()` uses `billing.getStorage().plans.update()`
- No comment explaining why this is an intentional exception to the SPEC-038 fix
- A dry-run mode exists but doesn't require explicit confirmation for the storage access itself

**Impact**: Low immediate risk (migration is a one-time script). Risk is precedent-setting: if a developer sees this pattern in the codebase and copies it in production code, it re-introduces the exact bug SPEC-038 fixed.

**Proposed Solution**: Add prominent warning comments:
```typescript
/**
 * MIGRATION-ONLY: Uses private storage API intentionally.
 * This is the exact pattern that SPEC-038 fixed in production code.
 * This exception exists ONLY to restore plans corrupted by the old pattern.
 * DO NOT copy this pattern into application code.
 * @see SPEC-038-addon-entitlements-architecture
 */
```

Also consider adding a runtime check: `if (process.env.NODE_ENV === 'production' && !process.env.FORCE_MIGRATION_RESTORE)`.

**Recommendation**: Fix directly. Documentation-only change. Prevents future anti-pattern propagation.

---

## Summary Table

| ID | Gap | Severity | Priority | Complexity | In Spec? | Audit | Action |
|----|-----|----------|----------|------------|----------|-------|--------|
| GAP-038-01 | Subscription cancellation no addon cleanup | HIGH | HIGH | Medium | Out of scope | #1 | New SPEC |
| GAP-038-02 | No reconciliation cron for orphaned purchases | MEDIUM | MEDIUM | Medium | Mentioned as future | #1 | Standalone task |
| **GAP-038-03** | **Cancel route passes UUID as slug - cancellation broken** | **CRITICAL** | **CRITICAL** | Medium | No | #1/#3 | **Fix immediately** |
| GAP-038-04 | Plan change no addon limit recalculation | MEDIUM | LOW | High | v1 limitation | #1 | Future SPEC |
| GAP-038-05 | TODOs.md out of sync with state.json | LOW | LOW | Trivial | N/A | #1 | Fix directly |
| GAP-038-06 | Drizzle relations incomplete | LOW | LOW | Low | No | #1 | Fix directly |
| GAP-038-07 | Multiple addons same limit key untested | LOW | LOW | Low | No | #1 | Add constraint + test |
| GAP-038-08 | Cache race condition | LOW | LOW | Low | Known | #1 | Accept risk |
| GAP-038-09 | Redundant getQZPayBilling() calls | TRIVIAL | LOW | Trivial | No | #1 | Fix directly |
| GAP-038-10 | FIFO vs LRU naming inconsistency | TRIVIAL | LOW | Trivial | No | #1 | Clarify docs |
| GAP-038-11 | No admin UI for customer entitlements | MEDIUM | MEDIUM | Medium | Mentioned | #1 | Standalone task |
| GAP-038-12 | Missing test: permanent entitlement (no expiry) | LOW | LOW | Trivial | No | #2 | Fix directly |
| GAP-038-13 | Spec status "draft" but all tasks completed | LOW | LOW | Trivial | N/A | #2 | Fix directly |
| GAP-038-14 | No integration test for concurrent purchase | LOW | LOW | Low | Risk 4 | #2 | Standalone task |
| GAP-038-15 | Inconsistent error logging in remove resilience | TRIVIAL | LOW | Trivial | No | #2 | Fix directly |
| GAP-038-16 | No test for cache NOT cleared on failure | LOW | LOW | Trivial | No | #2 | Fix directly |
| GAP-038-17 | Variable shadowing in cron loops | TRIVIAL | LOW | Trivial | No | #2 | Fix directly (with 09) |
| GAP-038-18 | Cache TTL and FIFO eviction not tested | MEDIUM | MEDIUM | Low | No | #3 | Fix directly |
| GAP-038-19 | Migration plan restoration: 100-plan pagination ceiling | MEDIUM | MEDIUM | Low | No | #3 | Fix directly |
| GAP-038-20 | Incomplete billingEnabled mock in middleware tests | LOW | LOW | Low | No | #3 | Fix directly |
| **GAP-038-21** | **`billing.limits.removeBySource()` may not exist — runtime TypeError** | **CRITICAL** | **CRITICAL** | Low | Spec Q7 | #4 | **Verify + fix immediately** |
| GAP-038-22 | `CancelAddonInput.purchaseId` optional with slug fallback | HIGH | HIGH | Low | No | #4 | Fix with GAP-038-03 |
| **GAP-038-23** | **Admin HTTP adapter missing `revokeBySource`/`removeBySource`** | **CRITICAL** | **P0** | Low | No | #5 | **Fix immediately (typecheck blocker)** |
| **GAP-038-24** | **`cancelUserAddon` WHERE clause ignores `purchaseId`** | HIGH | P1 | Low | No | #5 | **Fix with GAP-038-03** |
| **GAP-038-25** | **`UserAddon.status` American vs. British spelling — silent comparison failure** | HIGH | P1 | Low | No | #5 | **Fix immediately** |
| GAP-038-26 | `ServiceResult<T>` defined 3 times — DRY violation | MEDIUM | P2 | Low | No | #5 | Fix directly |
| GAP-038-27 | Cron `wasNotificationSent` ignores `addonSlug` — second addon suppressed | MEDIUM | P2 | Medium | No | #5 | Fix directly |
| GAP-038-28 | Migration idempotency timestamp string comparison fragility | MEDIUM | P2 | Medium | No | #5 | Fix directly |
| GAP-038-29 | Migration silently skips entitlement backfill on empty INSERT `.returning()` | MEDIUM | P2 | Low | No | #5 | Fix directly |
| GAP-038-30 | Test files use `any` types — Biome lint gate blocker | LOW | P3 | Low | No | #5 | Fix directly |
| GAP-038-31 | Test "skip limits.set() when -1" does not test the -1 value | LOW | P3 | Low | No | #5 | Fix directly |
| GAP-038-32 | `getUserAddons` returns only active — no purchase history | LOW | P3 | Medium | No | #5 | Standalone task |
| GAP-038-33 | Notification failures logged at `debug` — invisible in production | LOW | P3 | Low | No | #5 | Fix directly |
| GAP-038-34 | `confirmAddonPurchase` calls `billing.plans.get()` unnecessarily | LOW | P4 | Medium | No | #5 | Fix directly |
| GAP-038-35 | `restoreAllPlans` uses private storage without documentation | LOW | P4 | Low | No | #5 | Fix directly |
| GAP-038-36 | expireAddon idempotent path returns `new Date()` not actual expiry | HIGH | P1 | Low | No | #6 | Fix directly |
| GAP-038-37 | No bounds validation on `daysAhead` | MEDIUM | P2 | Low | No | #6 | Fix directly |
| GAP-038-38 | `appliedAt` Zod schema accepts any string | MEDIUM | P2 | Low | No | #6 | Fix directly |
| GAP-038-39 | Migration idempotency includes `subscriptionId` — broken re-runs | HIGH | P1 | Medium | No | #6 | Fix directly |
| GAP-038-40 | Test hardcoded `ALL_PLANS.length === 9` | LOW | P3 | Trivial | No | #6 | Fix directly |
| GAP-038-41 | Transaction rollback not simulated in checkout test | MEDIUM | P2 | Medium | No | #6 | Fix directly |
| GAP-038-42 | Sequential cron processing risks timeout at scale | LOW | P3 | Medium | No | #6 | Monitor |
| GAP-038-43 | Unsafe `as number` cast on plan limits | MEDIUM | P2 | Low | No | #6 | Fix directly |
| GAP-038-44 | Checkout metadata duplicate keys undocumented | LOW | P3 | Low | No | #6 | Fix directly |
| GAP-038-45 | Unique index missing `deleted_at IS NULL` + no `deletedAt` column | HIGH | P1 | Medium | No | #6 | New SPEC |
| **GAP-038-46** | **Metadata race on concurrent addon purchases** | **MEDIUM** | **P2** | **Medium** | **No** | **#7** | **HACER** |
| **GAP-038-47** | **Cron job errors not reported to Sentry** | **MEDIUM** | **P2** | **Low** | **No** | **#7** | **HACER** |
| **GAP-038-48** | **Cancel route redundant ownership re-fetch** | **LOW** | **P3** | **Medium** | **No** | **#7** | **HACER** |
| **GAP-038-49** | **Unmapped error codes default to HTTP 500** | **LOW** | **P3** | **Low** | **No** | **#7** | **HACER** |
| **GAP-038-50** | **No test: cascading fallback failure in remove** | **LOW** | **P3** | **Low** | **No** | **#7** | **HACER** |
| **GAP-038-51** | **No test: multiple addons expire same day same customer** | **LOW** | **P3** | **Low** | **No** | **#7** | **HACER** |
| **GAP-038-52** | **`getDb()` no null check in expiration service** | **LOW** | **P4** | **Trivial** | **No** | **#7** | **HACER** |

---

### GAP-038-36: `expireAddon` Idempotent Path Returns `new Date()` Instead of Actual Expiration Timestamp

- **Audit Pass**: #6
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: Low (1)
- **Category**: Logic bug — misleading return value
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Cambiar a purchase.expiresAt ?? purchase.updatedAt ?? new Date(). Fix de 1 línea.

**Description**: In `addon-expiration.service.ts`, the `expireAddon()` method has an idempotency branch for when the addon is already expired or not in `'active'` status. In this branch, the function returns `expiredAt: new Date()` (current time at the moment of the idempotency check), NOT the actual recorded expiration timestamp from the database.

**Evidence**:
```typescript
// addon-expiration.service.ts (idempotent branch, lines ~358-379)
if (purchase.status !== 'active') {
    return {
        success: true,
        data: {
            purchaseId: purchase.id,
            addonSlug: purchase.addonSlug,
            customerId: purchase.customerId,
            expiredAt: new Date()    // ← BUG: returns NOW, not the actual expiration time
        }
    };
}
```

The correct value should be `purchase.expiresAt ?? purchase.updatedAt ?? new Date()`.

**Impact**:
1. The cron job log records the wrong expiration timestamp for idempotent re-processing runs.
2. Any caller (admin tool, reconciliation job) that uses `expiredAt` from the response to determine when an addon actually expired gets a misleading timestamp.
3. If `processExpiredAddons()` processes the same addon twice in quick succession (e.g., due to a race in two cron instances), the second call returns "expired just now" instead of the actual expiration time.
4. Admin dashboards showing "expired at" would display the last cron run time, not the real expiry.

**Proposed Solutions**:

1. **Return the actual recorded expiration timestamp** (RECOMMENDED):
   ```typescript
   expiredAt: purchase.expiresAt ?? purchase.updatedAt ?? new Date()
   ```
   - Pros: Semantically correct, consistent with DB record
   - Cons: None

2. **Accept the current behavior as "last processed at"** and rename the field:
   - Not recommended — violates the principle of least surprise and breaks callers expecting the actual expiry time.

**Recommendation**: Fix immediately. Single-line change, zero risk.

---

### GAP-038-37: No Bounds Validation on `daysAhead` in `findExpiringAddons`

- **Audit Pass**: #6
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Low (1)
- **Category**: Validation gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar Zod validation z.number().int().min(1).max(365) al input.

**Description**: The `findExpiringAddons()` method in `addon-expiration.service.ts` accepts a `daysAhead: number` parameter with no validation:

```typescript
async findExpiringAddons(input: { daysAhead: number }): Promise<...> {
    const futureDate = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);
    // No check: what if daysAhead is 0? -5? 99999?
```

- If `daysAhead < 0`: query window is in the past, will return already-expired addons (wrong semantic — those are processed by `findExpiredAddons()`)
- If `daysAhead === 0`: `futureDate === now`, query returns nothing (empty set, silently wrong)
- If `daysAhead > ~36500` (100 years): `Date.getTime() + daysAhead * 86400000` overflows JavaScript's max safe integer (`Number.MAX_SAFE_INTEGER / 86400000 ≈ 285616415`)

The cron job currently calls this with `daysAhead: 3` and `daysAhead: 1`, so in practice the bug never triggers. But the method is a public service method that could be called by admin endpoints or test code with invalid inputs.

**Impact**:
- Silent incorrect results (no error thrown, just wrong dataset)
- Potential integer overflow with extreme values (though unlikely)
- Method has no contract — callers cannot rely on consistent behavior

**Proposed Solutions**:

1. **Add Zod input validation** (RECOMMENDED — consistent with platform conventions):
   ```typescript
   const FindExpiringAddonsInputSchema = z.object({
       daysAhead: z.number().int().min(1).max(365)
   });
   // Validate at method entry: FindExpiringAddonsInputSchema.parse(input)
   ```
   - Pros: Standard platform pattern, throws descriptive error on invalid input
   - Cons: Adds Zod import if not already present

2. **Add manual guard**:
   ```typescript
   if (input.daysAhead <= 0 || input.daysAhead > 365) {
       return { success: false, error: { code: 'INVALID_DAYS_AHEAD', message: 'daysAhead must be 1-365' } };
   }
   ```

**Recommendation**: Fix directly with Solution 1. No new SPEC needed.

---

### GAP-038-38: `appliedAt` in `addonAdjustmentSchema` Accepts Any String (Not Validated as ISO Datetime)

- **Audit Pass**: #6
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Low (1)
- **Category**: Validation gap — schema correctness
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Cambiar a z.string().datetime({ offset: true }) con union para backward compat si es necesario.

**Description**: In `apps/api/src/services/addon.types.ts`, the `addonAdjustmentSchema` Zod schema defines `appliedAt` as a plain `z.string()`:

```typescript
export const addonAdjustmentSchema = z.object({
    addonSlug: z.string(),
    limitKey: z.string().nullable().optional(),
    limitIncrease: z.number().nullable().optional(),
    entitlement: z.string().nullable().optional(),
    appliedAt: z.string(),   // ← Accepts "banana", "not-a-date", ""
});
```

`appliedAt` is stored in subscription metadata JSON and later used in the migration script to construct `new Date(adjustment.appliedAt)` for `purchasedAt`. If `appliedAt` contains a non-parseable value, `new Date("banana")` returns `Invalid Date`, which is stored as NULL or causes a silent Drizzle insert failure.

**Impact**:
1. Corrupted subscription metadata (e.g., from a bug in a previous version or external mutation) with invalid `appliedAt` would silently produce `Invalid Date` objects.
2. Migration script would store `Invalid Date` as `purchasedAt`, corrupting the `billing_addon_purchases` row.
3. The schema is the first line of defense against malformed metadata — it should reject invalid dates.

**Proposed Solution**:
```typescript
appliedAt: z.string().datetime({ offset: true }),   // ISO 8601 with timezone
```

If backward compatibility is a concern (some stored values might not include timezone offset):
```typescript
appliedAt: z.union([
    z.string().datetime({ offset: true }),
    z.string().datetime()  // without offset (UTC assumed)
]),
```

**Recommendation**: Fix directly. Single-line change. Verify against existing stored metadata format in the DB before changing, to ensure compatibility.

---

### GAP-038-39: Migration Idempotency Check Includes `subscriptionId` — Breaks Re-Runs Across Subscription Changes

- **Audit Pass**: #6
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: Medium (2)
- **Category**: Migration correctness — broken idempotency
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Remover subscriptionId del check de idempotencia. Usar (customerId, addonSlug, purchasedAt).

**Description**: The migration script's existing-record duplicate check uses 4 columns including `subscriptionId`:

```typescript
// migrate-addon-purchases.ts (lines ~602-626)
.where(
    sql`${billingAddonPurchases.customerId} = ${subscription.customerId}
        AND ${billingAddonPurchases.subscriptionId} = ${subscription.id}
        AND ${billingAddonPurchases.addonSlug} = ${adjustment.addonSlug}
        AND ${billingAddonPurchases.purchasedAt} = ${adjustment.appliedAt}`
)
```

**Note**: This is DIFFERENT from GAP-038-28 (which covers timestamp string comparison fragility). This gap covers the semantic correctness of using `subscriptionId` in the idempotency check.

**Why this is wrong**: The source of migration data is subscription metadata (`addonAdjustments` array). If a customer's subscription ID changes between migration runs (e.g., subscription renewed, plan changed, subscription recreated), the same `(customerId, addonSlug, appliedAt)` tuple would NOT match the existing record (because `subscriptionId` differs), causing a duplicate insert that:
1. Violates the unique partial index (if status='active') → 23505 error
2. Silently creates a second historical record (if status is different)

**Scenario that triggers this**:
1. Migration runs at T1 → inserts record for `(customer-A, visibility-boost-7d, sub-001, 2024-01-01)`
2. Customer's subscription is renewed → new subscription `sub-002` created
3. Old subscription `sub-001` still has `addonAdjustments` in metadata
4. Migration re-runs at T2 (e.g., after fixing GAP-038-28) → reads `sub-001` metadata again → queries for `(customer-A, visibility-boost-7d, sub-001, 2024-01-01)` → FINDS existing record → skips (OK)
5. ALSO reads `sub-002` metadata which ALSO has the adjustment carried over → queries for `(customer-A, visibility-boost-7d, sub-002, 2024-01-01)` → NOT FOUND (different subscriptionId) → INSERTS DUPLICATE

**Impact**:
- Duplicate `billing_addon_purchases` rows if migration runs multiple times and subscriptions changed between runs
- Potential 23505 constraint violation if both records would be `status='active'`
- Silently creates historical duplicates otherwise

**Proposed Solutions**:

1. **Remove `subscriptionId` from the idempotency check** (RECOMMENDED):
   ```typescript
   .where(
       sql`${billingAddonPurchases.customerId} = ${subscription.customerId}
           AND ${billingAddonPurchases.addonSlug} = ${adjustment.addonSlug}
           AND ${billingAddonPurchases.purchasedAt} = ${adjustment.appliedAt}`
   )
   ```
   The tuple `(customerId, addonSlug, purchasedAt)` uniquely identifies a historical addon purchase without needing subscription context.

2. **Add a `migration_source_subscription_id` metadata field** to the inserted records:
   - Store which subscription originated the migration
   - Use this for deduplication instead of relying on `billingAddonPurchases.subscriptionId`
   - More complex, not recommended

**Recommendation**: Fix with Solution 1. Critical for production migration safety. No new SPEC needed — small targeted fix.

---

### GAP-038-40: Migration Test Hardcoded to `ALL_PLANS.length === 9`

- **Audit Pass**: #6
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Trivial (1)
- **Category**: Test fragility
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Cambiar a ALL_PLANS.length dinámico. 1 línea.

**Description**: In `packages/db/test/billing/migrate-addon-purchases.test.ts`, the plan restoration test contains a hardcoded expectation tied to the current plan count:

```typescript
// migrate-addon-purchases.test.ts (line ~482)
expect(stats.plansRestored).toBe(9);   // ← Hardcoded to current ALL_PLANS.length
```

If a 10th plan is added to `ALL_PLANS` in `packages/billing/src/config/plans.config.ts`, this test immediately fails with no obvious reason (adding a plan breaks the migration test).

**Impact**: Minor — test maintenance friction. Not a production correctness issue.

**Proposed Solution**:
```typescript
import { ALL_PLANS } from '@repo/billing';
expect(stats.plansRestored).toBe(ALL_PLANS.length);  // Dynamic, not hardcoded
```

**Recommendation**: Fix directly. Single-line change, no new SPEC needed.

---

### GAP-038-41: Transaction Rollback Not Simulated in `addon.checkout.test.ts`

- **Audit Pass**: #6
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Medium (2)
- **Category**: Test quality gap — false confidence in transaction atomicity
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar 2-3 test cases para DB errors en transacción (mockRejectedValueOnce).

**Description**: In `apps/api/test/services/addon.checkout.test.ts`, the Drizzle transaction mock does not simulate rollback behavior:

```typescript
// addon.checkout.test.ts (lines ~40-44)
const mockDbTransaction = vi.fn(
    async (callback: (tx: { insert: typeof mockDbInsert }) => Promise<unknown>) => {
        return callback({ insert: mockDbInsert });
        // ↑ If callback() throws, the mock returns the error up.
        // In real Drizzle: the transaction would ROLLBACK automatically.
        // The mock has NO rollback simulation.
    }
);
```

**What's NOT tested**:
1. That the DB insert is rolled back when the callback throws (the `applyAddonEntitlements` runs AFTER the transaction, so its failure doesn't affect the insert atomicity — but any error inside the transaction callback would)
2. That the outer error is correctly propagated when the transaction function throws (e.g., DB connection drops mid-transaction)
3. That idempotency key generation doesn't create partial state on transaction failure

**Note**: The current architecture intentionally separates the DB insert (transactional) from entitlement grant (non-transactional, non-fatal). So the most critical failure mode is NOT about rollback per se, but about verifying that errors from the transaction itself are correctly handled.

**Impact**: A bug in error handling inside the transaction callback would not be caught by these tests. For example, if `billingAddonPurchases` insert throws a non-23505 DB error, the current tests don't verify the error is properly returned to the caller.

**Proposed Solutions**:

1. **Add test case for transaction-level DB error**:
   ```typescript
   it('should return INTERNAL_ERROR if DB transaction throws', async () => {
       mockDbTransaction.mockRejectedValueOnce(new Error('DB connection lost'));
       const result = await confirmAddonPurchase({ ... });
       expect(result.success).toBe(false);
       expect(result.error.code).toBe('INTERNAL_ERROR');
   });
   ```

2. **Add integration test against real DB** that exercises actual Drizzle transaction semantics.

**Recommendation**: Solution 1 is a direct fix. Add 2-3 test cases covering non-constraint DB errors.

---

### GAP-038-42: `processExpiredAddons` Sequential Processing Risks Cron Timeout at Scale

- **Audit Pass**: #6
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Medium (3)
- **Category**: Performance — cron timeout risk
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar monitoring/alerting de duración del cron. Documentar limitación. Implementar p-limit si hay timeouts.

**Description**: In `addon-expiration.service.ts`, `processExpiredAddons()` processes expired addons sequentially using `for...of`:

```typescript
for (const expiredAddon of toProcess) {  // toProcess: max 100 items
    await expireAddon({ purchaseId: expiredAddon.purchaseId, ... });
}
```

Each `expireAddon()` call involves:
1. DB query (find purchase)
2. QZPay `entitlements.revokeBySource()` (HTTP call)
3. QZPay `limits.removeBySource()` (HTTP call, if applicable)
4. DB update (update purchase status)

At ~200-500ms per addon (network latency to QZPay), 100 addons = 20-50 seconds per cron run. The job has a `timeoutMs: 120000` (2 minutes). If QZPay is slow or there are 100 limit-type addons expiring simultaneously, the job could timeout before completing the batch.

**Note**: For the current addon config (only 2 visibility-boost addons and 3 limit addons), this is unlikely to be a real problem in the short term. But as the platform scales, this will become a bottleneck.

**Impact**: Cron timeout → some expired addons NOT processed → entitlements/limits not revoked on time → users retain access past expiry.

**Proposed Solutions**:

1. **Accept current behavior** and monitor cron execution time in production (RECOMMENDED for now):
   - Set up alerting if cron runs > 60 seconds
   - If timeouts occur, implement Solution 2

2. **Process in parallel with concurrency limit** (when needed):
   ```typescript
   import pLimit from 'p-limit';
   const limit = pLimit(10);  // 10 concurrent, limits QZPay load
   const results = await Promise.allSettled(
       toProcess.map((addon) => limit(() => expireAddon(addon)))
   );
   // Collect failures from settled results
   ```

3. **Reduce batch size and rely on frequent cron schedule** (alternative to parallelism):
   - Change from 100 items/run to 25 items/run
   - Increase cron frequency: `0 5 * * *` → `0 */4 * * *` (every 4 hours)

**Recommendation**: Monitor first (Solution 1). Document as known limitation with a performance threshold. No new SPEC needed yet.

---

### GAP-038-43: Unsafe `as number` Type Cast on `plan.limits[addon.affectsLimitKey]`

- **Audit Pass**: #6
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Low (1)
- **Category**: Type safety — silent incorrect computation
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Reemplazar as number con typeof rawValue === 'number' check. Buscar todas las ocurrencias en plan/limit objects.

**Description**: In `apps/api/src/services/addon.checkout.ts` (line ~390), the base plan limit value is accessed with an unsafe type cast:

```typescript
// addon.checkout.ts (~line 390)
const previousValue = (plan.limits?.[addon.affectsLimitKey] as number) || 0;
const newValue = previousValue + addon.limitIncrease;
```

The `as number` cast will succeed even if `plan.limits[addon.affectsLimitKey]` is:
- `null` → cast produces `null`, `|| 0` gives `0`, then `0 + limitIncrease` computes a wrong value
- `undefined` → same problem
- `{ min: 0, max: 10 }` (object) → cast produces the object, arithmetic fails silently with `NaN`
- `"unlimited"` (string) → `NaN + limitIncrease = NaN`

The correct pattern (used elsewhere in the codebase) is:
```typescript
const rawValue = plan.limits?.[addon.affectsLimitKey];
const previousValue = typeof rawValue === 'number' ? rawValue : 0;
```

**Note**: A similar unsafe cast exists in `addon-entitlement.service.ts` at the limit computation path.

**Impact**:
- If plan limits use a structure other than plain numbers (which they currently don't, but the type system doesn't enforce this), `limitAdjustments` stored in the purchase record would contain incorrect values.
- `NaN` propagating through `newValue` would result in `NaN` stored as `limitAdjustments[0].limitIncrease`, which then fails when used in QZPay `limits.set()`.
- Silent data corruption with no error thrown.

**Proposed Solution**:
```typescript
const rawValue = plan.limits?.[addon.affectsLimitKey];
const previousValue = typeof rawValue === 'number' ? rawValue : 0;
```

**Recommendation**: Fix directly. Single-line change per occurrence. Search for all `as number` casts on plan/limit objects.

---

### GAP-038-44: Checkout Preference Metadata Contains Undocumented Duplicate Keys (snake_case + camelCase)

- **Audit Pass**: #6
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (1)
- **Category**: Code quality — maintainability
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar comentarios explicando dual format (snake_case para webhook IPN, camelCase para handler interno).

**Description**: In `apps/api/src/services/addon.checkout.ts` (lines ~193-205), the MercadoPago checkout preference metadata object contains both snake_case and camelCase versions of the same fields:

```typescript
metadata: {
    addon_slug: addon.slug,          // snake_case
    addonSlug: addon.slug,           // camelCase — DUPLICATE
    customer_id: customerId,         // snake_case
    customerId: customerId,          // camelCase — DUPLICATE
    user_id: userId,                 // snake_case
    userId: userId,                  // camelCase — DUPLICATE
    promo_code: input.promoCode || null,
    orderId: orderId,
    subscriptionId: activeSubscription.id,
}
```

No comment explains WHY both formats exist simultaneously. This suggests backward compatibility with different webhook handler versions — but without documentation, future developers may:
1. Remove the snake_case versions thinking they're redundant (breaking webhook processing)
2. Remove the camelCase versions thinking they're redundant (breaking `confirmAddonPurchase()` which reads camelCase)
3. Add new fields in only one format

**Impact**: No current runtime impact. But the code is a future maintainability trap.

**Proposed Solution**:

1. **Add a comment explaining the dual format** (RECOMMENDED — minimal change):
   ```typescript
   metadata: {
       // snake_case for MercadoPago IPN webhook normalization (external consumers)
       addon_slug: addon.slug,
       customer_id: customerId,
       user_id: userId,
       // camelCase for internal confirmAddonPurchase() handler (reads from payment notification)
       addonSlug: addon.slug,
       customerId: customerId,
       userId: userId,
       // ...
   }
   ```

2. **Standardize to snake_case only** and update all internal consumers:
   - More correct but requires auditing all webhook handlers

**Recommendation**: Solution 1 — add a comment. No new SPEC needed. Document the intentional design.

---

### GAP-038-45: Unique Index Deviates from Spec — Missing `deleted_at IS NULL` AND Missing `deletedAt` Column

- **Audit Pass**: #6
- **Severity**: HIGH
- **Priority**: P1
- **Complexity**: Medium (3)
- **Category**: Schema deviation from spec — potential future data integrity issue
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar columna deletedAt + recrear unique index con AND deleted_at IS NULL. Nueva migración.

**Description**: The spec (SPEC-038 spec.md, Task T-008 description, Changesets section) explicitly requires:

> `UNIQUE(customer_id, addon_slug) WHERE status='active' AND deleted_at IS NULL`

The implementation deviates in TWO ways:

1. **Migration 0021 SQL** (`packages/db/src/migrations/0021_dazzling_zzzax.sql`):
   ```sql
   -- ACTUAL (missing AND deleted_at IS NULL):
   CREATE UNIQUE INDEX "idx_addon_purchases_active_unique"
     ON "billing_addon_purchases" USING btree ("customer_id","addon_slug")
     WHERE status = 'active';
   ```

2. **Drizzle schema** (`packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`):
   ```typescript
   // ACTUAL (missing AND deleted_at IS NULL):
   addonPurchasesActiveUnique: uniqueIndex('idx_addon_purchases_active_unique')
       .on(table.customerId, table.addonSlug)
       .where(sql`status = 'active'`),
   ```

3. **No `deletedAt` column exists** on `billing_addon_purchases`. The table cannot implement soft-delete, making the `deleted_at IS NULL` clause impossible to add without a migration. All other billing tables in the platform use soft-delete with `deleted_at`.

**Why previous passes marked this as "correctly implemented"**: The Verified list entry says "[x] Unique partial index on (customer_id, addon_slug) WHERE status='active' (migration 0021)" — this confirms the partial index exists, but did NOT verify the `AND deleted_at IS NULL` clause was included. The pass audited the presence of the index, not its exact specification.

**Current practical impact**: NONE — because `billing_addon_purchases` has no `deleted_at` column, and cancel/expire operations change `status` to `'cancelled'`/`'expired'` (removing the record from the unique constraint scope). The index works correctly for current behavior.

**Future/potential impact**:
1. If soft-delete is ever added to this table (consistent with platform conventions), the unique constraint WILL prevent customers from repurchasing a previously soft-deleted addon (the soft-deleted record with `status='active', deleted_at=NOW` would still hold the constraint slot).
2. The schema deviates from the spec, creating documentation drift.
3. If any code performs a hard status reset (e.g., admin sets `status` back to `'active'` on an already-cancelled purchase), the constraint would NOT prevent duplicates when combined with soft-delete.

**Proposed Solutions**:

1. **Add `deletedAt` column + fix unique index** in a new migration (RECOMMENDED — aligns with spec and platform conventions):
   ```sql
   ALTER TABLE "billing_addon_purchases"
     ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE;

   DROP INDEX "idx_addon_purchases_active_unique";

   CREATE UNIQUE INDEX "idx_addon_purchases_active_unique"
     ON "billing_addon_purchases" USING btree ("customer_id","addon_slug")
     WHERE status = 'active' AND deleted_at IS NULL;
   ```
   Also update the Drizzle schema and all queries that need soft-delete awareness.

2. **Accept current deviation and document it explicitly** (if soft-delete will never be added to this table):
   - Update the Verified list to accurately reflect the constraint spec says one thing, implementation does another, and this is intentional
   - Add a code comment in the schema explaining `deleted_at IS NULL` was intentionally omitted

**Recommendation**: Requires a new **formal SPEC** combining GAP-038-45 with a comprehensive soft-delete review of `billing_addon_purchases`. Medium complexity (new column + migration + Drizzle schema update + query updates). HIGH priority because the spec explicitly mandated this and the deviation creates silent technical debt. Recommend creating the SPEC before production deploy.

---

### GAP-038-46: Subscription Metadata Race Condition on Concurrent Addon Purchases

- **Audit Pass**: #7
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Medium (3)
- **Category**: Concurrency bug — data loss on concurrent writes
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar SELECT...FOR UPDATE transaction al read-modify-write del metadata.

**Description**: In `addon-entitlement.service.ts`, both `applyAddonEntitlements()` (lines 219-224) and `removeAddonEntitlements()` (lines 425-430) perform a read-modify-write cycle on `subscription.metadata.addonAdjustments` without any locking. If two concurrent `applyAddonEntitlements` calls occur for the same customer (e.g., two different addon purchases processed simultaneously):

1. Thread A: reads subscription with `addonAdjustments = [addon1]`
2. Thread B: reads subscription with `addonAdjustments = [addon1]`
3. Thread A: writes `addonAdjustments = [addon1, addon2]`
4. Thread B: writes `addonAdjustments = [addon1, addon3]` .. **addon2 lost**

**Mitigating factor**: The `addonAdjustments` metadata is the DEPRECATED backward compatibility path. The PRIMARY source of truth is the `billing_customer_entitlements` and `billing_customer_limits` tables (which use QZPay's upsert-based APIs, naturally handling concurrency). The metadata is a shadow copy for legacy consumers.

**Evidence**:
- `addon-entitlement.service.ts:219-224`: `billing.subscriptions.update(subscriptionId, { metadata: { addonAdjustments: [...existing, newEntry] } })`
- No database transaction, no optimistic locking, no CAS (compare-and-swap)
- The same pattern in `removeAddonEntitlements()` at lines 425-430

**Impact**: LOW in practice (metadata is deprecated). But if any consumer still reads `addonAdjustments` from metadata for display or reconciliation, they could see stale data.

**Proposed Solutions**:
1. **Accept risk and document** (RECOMMENDED for now) — metadata is deprecated, primary source works correctly
2. **Wrap metadata update in a SELECT...FOR UPDATE transaction** — correct but over-engineered for deprecated path
3. **Remove metadata writes entirely** once all consumers are migrated to the QZPay tables

**Recommendation**: Accept risk. Document the limitation in code comments. Plan removal of metadata writes as part of a future deprecation cleanup.

---

### GAP-038-47: Cron Job Does Not Report Errors to Sentry

- **Audit Pass**: #7
- **Severity**: MEDIUM
- **Priority**: P2
- **Complexity**: Low (1)
- **Category**: Observability gap — silent production failures
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar Sentry.captureException() con tags y extra context en los 4-5 catch blocks del cron.

**Description**: The addon expiry cron job (`addon-expiry.job.ts`) logs errors via `apiLogger.error()` but does NOT call `Sentry.captureException()` anywhere in the error handling paths. This means cron job failures (DB connection issues, billing service errors, unhandled exceptions during addon processing) are only visible in application logs, not in Sentry's error tracking dashboard.

**Evidence**:
- `addon-expiry.job.ts`: grep for `Sentry` = **zero matches**
- Error handling at lines 149-160, 173-181, 279-282, 387-393, 430-433: all use `apiLogger.error()` only
- Contrast with `entitlement.ts` middleware which DOES call `Sentry.captureException()` (lines 230-236)

**Impact**: Cron job failures are not included in Sentry alerting. The team would only discover expiration processing issues by:
1. Manually checking application logs (often missed)
2. Customer complaint (too late)
3. Orphaned addon purchases accumulating (detected much later)

**Proposed Solution**:
```typescript
import * as Sentry from '@sentry/node';

// In each error catch block:
Sentry.captureException(error, {
    tags: { subsystem: 'billing-cron', job: 'addon-expiry', action: 'process-expired' },
    extra: { purchaseId, addonSlug, customerId }
});
```

**Recommendation**: Fix directly. Add `Sentry.captureException()` to the 4-5 error catch blocks in the cron job. Low effort, high observability value.

---

### GAP-038-48: Cancel Route Redundantly Re-Fetches All User Addons After Ownership Already Verified

- **Audit Pass**: #7
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Medium (2)
- **Category**: Performance — redundant DB queries
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Refactorear para pasar datos ya verificados al servicio y evitar re-fetch redundante.

**Description**: The cancel addon flow performs TWO redundant ownership/active-status verifications:

1. **Route** (`addons.ts:292-314`): Queries `billing_addon_purchases` by `(id, customerId, status='active')` to verify ownership and active status. Returns `ownedAddon.id`.
2. **Service** (`addon.user-addons.ts:248-260`): Calls `getUserAddons(billing, userId)` which re-fetches ALL active addon purchases for the customer, then loops through them to verify the addon slug is active.

The route already proved the purchase exists, belongs to the customer, and is active. The service then re-does this work using a different query pattern (by userId instead of customerId, fetching ALL addons instead of just the target).

**Evidence**:
- `addons.ts:298-314`: `SELECT id FROM billing_addon_purchases WHERE id=? AND customerId=? AND status='active'`
- `addon.user-addons.ts:248-260`: `getUserAddons()` fetches ALL active addons, then `userAddons.some(a => a.addonSlug === addonSlug)`
- This adds 1-2 unnecessary DB queries per cancel operation

**Impact**: Minor performance degradation on cancel. Not a correctness bug. Each cancel does ~3-4 DB queries when 2 would suffice.

**Proposed Solutions**:
1. **Refactor `cancelUserAddon` to accept a `skipOwnershipCheck` flag** when the caller already verified:
   ```typescript
   cancelUserAddon({ ..., ownershipVerified: true })
   ```
2. **Pass the already-fetched purchase data into the service** to avoid re-fetching
3. **Accept as-is** — cancel is a low-frequency operation

**Recommendation**: Track as future improvement. Not urgent. Can be addressed when optimizing the cancel flow for GAP-038-03 fix.

---

### GAP-038-49: Unmapped Error Codes in Addon Routes Default to HTTP 500

- **Audit Pass**: #7
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (1)
- **Category**: Error handling — incorrect HTTP status codes
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Expandir status map con todos los error codes conocidos (NOT_FOUND, CUSTOMER_NOT_FOUND, etc).

**Description**: In `addons.ts`, error code to HTTP status mapping uses a static map:

```typescript
const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    PERMISSION_DENIED: 403,
    INTERNAL_ERROR: 500
};
const status = statusMap[result.error?.code ?? ''] ?? 500;
```

Service error codes like `SERVICE_UNAVAILABLE`, `NO_SUBSCRIPTION`, `NO_ACTIVE_SUBSCRIPTION`, `ADDON_INACTIVE`, `ADDON_ALREADY_ACTIVE`, `CUSTOMER_NOT_FOUND`, `CHECKOUT_ERROR`, `PLAN_NOT_FOUND`, `PAYMENT_NOT_CONFIGURED`, `INVALID_PROMO_CODE`, `ENTITLEMENT_REMOVAL_FAILED`, `MISSING_PURCHASE_ID`, `INVALID_STATUS` are NOT in the status map. All default to 500.

**Evidence**:
- `addon.types.ts` and services define many error codes beyond the 4 mapped ones
- Any unmapped code returns HTTP 500 (Internal Server Error) to the client
- Example: `NO_ACTIVE_SUBSCRIPTION` should be 422 (Unprocessable Entity), not 500
- Example: `ADDON_ALREADY_ACTIVE` should be 409 (Conflict), not 500

**Impact**: Client receives misleading HTTP status codes. 500 suggests server error when the actual issue is client-side (no subscription, addon inactive, etc.). This makes debugging harder for frontend developers and pollutes 5xx error metrics.

**Proposed Solution**:
```typescript
const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    CUSTOMER_NOT_FOUND: 404,
    PLAN_NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    INVALID_PROMO_CODE: 400,
    INVALID_STATUS: 400,
    PERMISSION_DENIED: 403,
    NO_SUBSCRIPTION: 422,
    NO_ACTIVE_SUBSCRIPTION: 422,
    ADDON_INACTIVE: 422,
    ADDON_ALREADY_ACTIVE: 409,
    SERVICE_UNAVAILABLE: 503,
    PAYMENT_NOT_CONFIGURED: 503,
    CHECKOUT_ERROR: 502,
    ENTITLEMENT_REMOVAL_FAILED: 500,
    INTERNAL_ERROR: 500,
};
```

**Recommendation**: Fix directly. Expand the status map with all known error codes. Consider moving the mapping to a shared utility if used across multiple route files.

---

### GAP-038-50: No Test for Cascading Fallback Failure (revokeBySource Throws AND Fallback revoke() Also Throws)

- **Audit Pass**: #7
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (1)
- **Category**: Test coverage gap — cascading failure path untested
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Reestructurar try/catch para intentar revoke() como fallback dentro del catch + agregar test de cascading failure.

**Description**: Tests verify that `removeAddonEntitlements()` continues with metadata cleanup when `revokeBySource` throws (test at line 722) and when `removeBySource` throws (test at line 762). But there is NO test for the scenario where `revokeBySource` throws AND the fallback `revoke()` ALSO throws (double failure).

**Evidence**:
- `addon-entitlement.service.ts:365-379`: Inner try/catch wraps `revokeBySource`; on failure, logs warning and continues
- Lines 349-352: Fallback `revoke()` is called only when `revokedCount === 0` (not when exception was thrown in catch block)
- Wait — re-checking the code flow: when `revokeBySource` throws, the catch block sets a flag or logs, and execution continues to the next block (limits). The fallback `revoke()` is in the TRY block (before the catch), only called when revokedCount===0. So if `revokeBySource` THROWS, the fallback `revoke()` is NOT called (execution jumps to catch).
- This means: if `revokeBySource` throws, the entitlement is NOT revoked at all (no fallback attempted). Only metadata cleanup happens.

**Impact**: If `revokeBySource` throws (e.g., QZPay service error), the individual `revoke()` fallback is never attempted. The customer keeps the entitlement. The error is logged as a warning but the operation reports success (continues to metadata cleanup).

**Proposed Solutions**:
1. **Add a test that mocks both `revokeBySource` throwing and `revoke()` also throwing** to verify the service still returns success (resilient design) and logs both errors
2. **Restructure the try/catch to attempt the fallback INSIDE the catch block**:
   ```typescript
   try {
       const result = await billing.entitlements.revokeBySource('addon', purchaseId);
       if (result === 0) {
           await billing.entitlements.revoke(customerId, entitlementKey);
       }
   } catch (primaryError) {
       logger.warn({ error: primaryError }, 'revokeBySource failed, attempting fallback');
       try {
           await billing.entitlements.revoke(customerId, entitlementKey);
       } catch (fallbackError) {
           logger.warn({ error: fallbackError }, 'Fallback revoke also failed');
       }
   }
   ```

**Recommendation**: Fix with Solution 2 (restructure to attempt fallback in catch) AND add corresponding test. This is a correctness improvement — the current code silently skips the fallback when `revokeBySource` throws.

---

### GAP-038-51: No Test for Multiple Addons Expiring on Same Day for Same Customer

- **Audit Pass**: #7
- **Severity**: LOW
- **Priority**: P3
- **Complexity**: Low (2)
- **Category**: Test coverage gap
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar 1-2 test cases con mismo customer y 2 addons expirados el mismo día.

**Description**: The test suite does not exercise the scenario where a single customer has multiple different addons (e.g., `visibility-boost-7d` AND `extra-photos-20`) both expiring on the same day. This scenario interacts with:
1. `processExpiredAddons()` processing multiple items for the same customer sequentially
2. `wasNotificationSent()` idempotency check (GAP-038-27 — only checks type+customerId, not addonSlug)
3. Multiple `clearEntitlementCache()` calls for the same customerId (second call is a no-op)

**Evidence**:
- `addon-expiry.test.ts`: Test for batch processing uses different customers, not multiple addons for the same customer
- No test validates that all addons for a customer are processed and all notifications sent

**Impact**: Low — unlikely current scenario given the addon config (visibility-boost has durationDays, photos/accommodations are recurring with null expiry). But as addons grow, this will become a real scenario.

**Proposed Solution**: Add a test case in `addon-expiry.test.ts`:
```typescript
it('should process multiple expired addons for the same customer', async () => {
    mockFindExpired.mockResolvedValue({
        success: true,
        data: [
            { id: 'purchase-1', customerId: 'cust-1', addonSlug: 'visibility-boost-7d' },
            { id: 'purchase-2', customerId: 'cust-1', addonSlug: 'extra-photos-20' }
        ]
    });
    // Verify both are processed, both notifications sent
});
```

**Recommendation**: Fix directly. Add 1-2 test cases. Low effort.

---

### GAP-038-52: `getDb()` Has No Null Check in `AddonExpirationService`

- **Audit Pass**: #7
- **Severity**: LOW
- **Priority**: P4
- **Complexity**: Trivial (1)
- **Category**: Defensive programming — potential uncaught crash
- **Status**: **HACER** (decidido 2026-03-16)
- **Decisión**: Agregar null check defensivo con return error code DB_NOT_INITIALIZED.

**Description**: In `addon-expiration.service.ts` (line ~149), `getDb()` is called without a null check:

```typescript
const db = getDb();
// No: if (!db) { return { success: false, ... }; }
```

If the database connection is not initialized when the cron job runs, `getDb()` returns `null`/`undefined`, and any subsequent `db.select(...)` call throws a `TypeError: Cannot read properties of null (reading 'select')`.

**Mitigating factor**: `getDb()` in practice always returns a valid instance after application startup. The billing instance null check (line 123) would catch a broader initialization failure. But `getDb()` and `getQZPayBilling()` could fail independently (e.g., billing is initialized but DB connection was lost).

**Evidence**:
- `addon-expiration.service.ts:~149`: `const db = getDb()` — no guard
- Other files in the codebase DO have `getDb()` guards (inconsistent)

**Impact**: Very low probability. If it happens, the error would be an unhandled TypeError rather than a clean error response.

**Proposed Solution**:
```typescript
const db = getDb();
if (!db) {
    return { success: false, error: { code: 'DB_NOT_INITIALIZED', message: 'Database connection unavailable' } };
}
```

**Recommendation**: Fix directly. One-line defensive check. Trivial effort.

---

## Pass #8 Audit Summary (2026-03-16)

**Methodology**: 5 parallel expert agents (Service Audit, Middleware Audit, Cron/DB/Migration Audit, Test Coverage Enumeration, Config/Routes/Types Audit) + 1 focused verification agent for critical GAPs.

**Key Findings**:

| GAP ID | Action | Description |
|--------|--------|-------------|
| GAP-038-21 | **RESOLVED** | `QZPayLimitService.removeBySource()` confirmed present in `@qazuor/qzpay-core/dist/index.d.ts` with signature `(source: QZPaySourceType, sourceId: string) => Promise<number>` |
| GAP-038-03 | Re-confirmed CRITICAL | Cancel route still passes UUID as slug at `addon.user-addons.ts:235` — `const addonSlug = input.addonId` where `addonId` is a UUID |
| GAP-038-25 | Re-confirmed MEDIUM | DB column `cancelled_at` (British) vs type property `canceledAt` (American) mismatch still present |

**Implementation Quality Assessment (all 8 spec requirements)**:

| Requirement | Status | Evidence |
|---|---|---|
| No `@ts-expect-error` in addon code | ✅ PASS | 0 matches across all 5 service files |
| No `billing.plans.update()` calls | ✅ PASS | 0 matches in production code |
| `billing.entitlements.grant()` with source/sourceId | ✅ PASS | Line 142-148 in addon-entitlement.service.ts |
| `billing.limits.set()` with canonical config | ✅ PASS | Line 162-192, ALL_PLANS import confirmed |
| `revokeBySource`/`removeBySource` with fallbacks | ✅ PASS | Lines 342-391 + QZPay interface verified |
| purchaseId propagation end-to-end | ✅ PASS | checkout:443 → service:146,191 → remove:383 |
| Middleware merge (union entitlements, override limits) | ✅ PASS | entitlement.ts:195-222, Set.add + Map.set |
| Graceful degradation with no-cache | ✅ PASS | entitlement.ts:211-240, shouldCache=false |

**Conclusion**: The gap registry has **stabilized**. 8 audit passes with 0 new gaps in the last pass indicates convergence. The 52 documented gaps represent the complete set of issues. No further audit passes recommended unless new code changes are made.

---

## Pass #7 New Gaps Summary

| GAP ID | Severity | New? | Description |
|--------|----------|------|-------------|
| GAP-038-46 | MEDIUM | NEW | Subscription metadata race condition on concurrent addon purchases (read-modify-write without lock) |
| GAP-038-47 | MEDIUM | NEW | Cron job errors not reported to Sentry — only `apiLogger.error`, no `Sentry.captureException` |
| GAP-038-48 | LOW | NEW | Cancel route redundantly re-fetches all user addons after route already verified ownership |
| GAP-038-49 | LOW | NEW | Unmapped error codes in addon routes default to HTTP 500 |
| GAP-038-50 | LOW | NEW | No test for cascading fallback failure (revokeBySource throws AND fallback revoke() also throws) |
| GAP-038-51 | LOW | NEW | No test for multiple addons expiring on same day for same customer |
| GAP-038-52 | LOW | NEW | `getDb()` has no null check in AddonExpirationService |

---

## Pass #6 New Gaps Summary

| GAP ID | Severity | New? | Description |
|--------|----------|------|-------------|
| GAP-038-36 | HIGH | ✅ NEW | expireAddon idempotent path returns `new Date()` instead of actual expiry timestamp |
| GAP-038-37 | MEDIUM | ✅ NEW | No bounds validation on `daysAhead` in findExpiringAddons |
| GAP-038-38 | MEDIUM | ✅ NEW | `appliedAt` Zod schema accepts any string (not validated as ISO datetime) |
| GAP-038-39 | HIGH | ✅ NEW | Migration idempotency check includes `subscriptionId` — breaks re-runs across subscription changes |
| GAP-038-40 | LOW | ✅ NEW | Test hardcoded to `ALL_PLANS.length === 9` |
| GAP-038-41 | MEDIUM | ✅ NEW | Transaction rollback not simulated in addon.checkout.test.ts |
| GAP-038-42 | LOW | ✅ NEW | processExpiredAddons sequential processing risks cron timeout at scale |
| GAP-038-43 | MEDIUM | ✅ NEW | Unsafe `as number` type cast on plan.limits access |
| GAP-038-44 | LOW | ✅ NEW | Checkout metadata has undocumented duplicate keys (snake_case + camelCase) |
| GAP-038-45 | HIGH | ✅ NEW | Unique index deviates from spec — missing `AND deleted_at IS NULL` + no `deletedAt` column |

---

## Priority Recommendations

### CRITICAL — Fix Immediately (production-blocking):
- **GAP-038-23** 🆕: Admin HTTP adapter missing `revokeBySource`/`removeBySource` — TypeScript compile error + runtime crash. Run `pnpm typecheck --filter admin` to verify.
- ~~**GAP-038-21** ⚠️~~ **RESOLVED in Pass #8**: `removeBySource` confirmed present in QZPay v1.2.0 types.
- **GAP-038-03**: Cancel route passes UUID as slug → addon cancellation completely broken. Fix route query + add integration test. Fix together with GAP-038-22 + GAP-038-24.

### Fix Immediately (must accompany GAP-038-03 fix):
- **GAP-038-22**: Make `purchaseId` required in `CancelAddonInput`. Fix simultaneously with GAP-038-03.
- **GAP-038-24** 🆕: Add `purchaseId` to `cancelUserAddon` WHERE clause. Fix in the same PR as GAP-038-03.
- **GAP-038-25** 🆕: Fix American vs. British `canceled`/`cancelled` spelling inconsistency in `UserAddon` type. Silent runtime comparison failure.

### Fix Now (trivial, no SPEC needed):
- **GAP-038-05**: Update TODOs.md to match state.json
- **GAP-038-09 + GAP-038-17**: Remove redundant billing calls + variable shadowing in cron
- **GAP-038-10**: Fix FIFO/LRU cache naming
- **GAP-038-13**: Update metadata.json + spec.md status to `completed`
- **GAP-038-12**: Add test for permanent entitlement (1 test case)
- **GAP-038-15**: Add purchaseId context to error logs in remove
- **GAP-038-16**: Add `clearEntitlementCache` NOT-called assertions to error tests
- **GAP-038-26** 🆕: Import `ServiceResult<T>` from `addon.types.ts` instead of duplicating (2 files)
- **GAP-038-30** 🆕: Fix `any` types in `addon-expiration.service.test.ts` — Biome lint blocker
- **GAP-038-31** 🆕: Fix misleading test — actually exercise the `-1` unlimited code path
- **GAP-038-33** 🆕: Change notification failure log level from `debug` to `warn`
- **GAP-038-35** 🆕: Add documentation comments to `restoreAllPlans` private storage usage
- **GAP-038-36** 🆕🆕: Fix `expiredAt: new Date()` in idempotent expiry branch — return `purchase.expiresAt` instead
- **GAP-038-37** 🆕🆕: Add Zod bounds validation on `daysAhead` (min: 1, max: 365) in `findExpiringAddons`
- **GAP-038-38** 🆕🆕: Change `appliedAt: z.string()` to `z.string().datetime()` in `addonAdjustmentSchema`
- **GAP-038-40** 🆕🆕: Replace `toBe(9)` with `toBe(ALL_PLANS.length)` in migration test
- **GAP-038-43** 🆕🆕: Replace unsafe `as number` cast with `typeof rawValue === 'number' ? rawValue : 0` type guard
- **GAP-038-44** 🆕🆕: Add comment explaining why checkout metadata has both snake_case and camelCase keys
- **GAP-038-47** 🆕🆕🆕: Add `Sentry.captureException()` to cron job error catch blocks (4-5 locations)
- **GAP-038-49** 🆕🆕🆕: Expand error code to HTTP status mapping in addon routes (add ~12 missing codes)
- **GAP-038-50** 🆕🆕🆕: Add test for cascading fallback failure + restructure try/catch to attempt fallback in catch block
- **GAP-038-51** 🆕🆕🆕: Add test for multiple addons expiring same day for same customer
- **GAP-038-52** 🆕🆕🆕: Add `getDb()` null check in `AddonExpirationService`

### Fix Soon (low-medium complexity, no SPEC needed):
- **GAP-038-06**: Add missing Drizzle relations (subscription, addon)
- **GAP-038-07**: Add config validation preventing overlapping limit keys
- **GAP-038-18**: Add cache TTL expiration and FIFO eviction tests to middleware test suite
- **GAP-038-19**: Fix migration plan restoration to fetch ALL plans without pagination ceiling
- **GAP-038-20**: Add explicit `billingEnabled=true` env setup to middleware tests; add disabled-path test group
- **GAP-038-27** 🆕: Add `addonSlug` to notification idempotency check
- **GAP-038-28** 🆕: Normalize timestamps before idempotency comparison in migration
- **GAP-038-29** 🆕: Throw on empty INSERT `.returning()` in migration instead of silently skipping
- **GAP-038-34** 🆕: Replace `billing.plans.get()` in checkout with `ALL_PLANS.find()` for consistency
- **GAP-038-39** 🆕🆕: Remove `subscriptionId` from migration idempotency check — use `(customerId, addonSlug, purchasedAt)` only
- **GAP-038-41** 🆕🆕: Add test cases for transaction-level DB errors in `addon.checkout.test.ts`

### Track as Standalone Task:
- **GAP-038-02**: Reconciliation cron for orphaned purchases
- **GAP-038-11**: Admin UI/API for customer entitlements
- **GAP-038-14**: Integration test for concurrent purchase constraint
- **GAP-038-32** 🆕: Add `getAddonHistory()` or `statuses` filter to `getUserAddons`
- **GAP-038-42** 🆕🆕: Monitor cron execution time; implement `pLimit` parallel processing if timeouts occur
- **GAP-038-48** 🆕🆕🆕: Refactor cancel route to skip redundant ownership re-fetch in service

### Requires New SPEC:
- **GAP-038-01**: Subscription cancellation addon cleanup (HIGH priority — resubscription path creates incorrect behavior)
- **GAP-038-04**: Plan change addon limit recalculation (LOW priority, v2)
- **GAP-038-45** 🆕🆕: Add `deletedAt` column to `billing_addon_purchases` + fix unique index to include `AND deleted_at IS NULL` (align schema with spec requirement, add soft-delete to align with platform conventions)

### Accept as Known Limitation:
- **GAP-038-08**: Cache race condition (inherent to single-process design, minimal impact)
- **GAP-038-46** 🆕🆕🆕: Metadata race condition on concurrent addon purchases (metadata is deprecated; primary QZPay tables handle concurrency correctly)

---

## Verified as Correctly Implemented (No Gaps)

The following spec requirements were verified in **both audit passes** as correctly implemented:

- [x] Zero `@ts-expect-error` comments in addon code (`apps/api/src/services/`) and addon tests
- [x] Zero `billing.plans.update()` calls in production code (only test assertion names reference it)
- [x] `billing.entitlements.grant()` with `source='addon'` and `sourceId=purchaseId` (service line 146)
- [x] `billing.limits.set()` with canonical config lookup and source tracking (service line 191)
- [x] `revokeBySource`/`removeBySource` with fallback to individual `revoke`/`remove` (service lines 342, 383) — **VERIFIED** (pass #8): Both `revokeBySource` in QZPayEntitlementService and `removeBySource` in QZPayLimitService confirmed present in `@qazuor/qzpay-core/dist/index.d.ts` with correct signatures. GAP-038-21 RESOLVED.
- [x] `purchaseId` captured from INSERT `.returning({ id })` (checkout line 443) and propagated through entire flow
- [x] No double INSERT in `billing_addon_purchases` (service does NOT insert, checkout owns it)
- [x] Unique partial index on `(customer_id, addon_slug) WHERE status='active'` (migration 0021)
- [x] Cron job passes billing instance with null guard (cron lines 122-127, `new AddonExpirationService(billing)` at line 136)
- [x] Middleware merges plan + customer entitlements (Set union, line 213-215) and limits (Map override, line 219-221)
- [x] Graceful degradation with `shouldCache=false` on customer-level fetch failure (middleware lines 209, 239)
- [x] `clearEntitlementCache(customerId)` called after addon apply (line 227) and remove (line 433)
- [x] Migration script with entitlement backfill, limit backfill, plan restoration
- [x] Migration idempotency and dry-run mode
- [x] Unlimited (-1) limit handling: skip addon limit increase (service code confirmed)
- [x] Subscription metadata backward compatibility (deprecated but maintained)
- [x] QZPay dependencies at correct versions: core ^1.2.0 (api, billing), drizzle ^1.2.0 (db), hono ^1.1.1, mercadopago ^1.1.0
- [x] 23505 unique constraint handling in checkout (line 458-462)
- [x] Canonical addon config (5 addons) and plans config (9 plans) complete and aligned
- [x] 5 addon definitions correct: visibility-boost-7d, visibility-boost-30d, extra-photos-20, extra-accommodations-5, extra-properties-5
- [x] `expiresAt` computed from `addon.durationDays` (conditional, handles null)
- [x] `removeAddonEntitlements` does NOT update `billing_addon_purchases` status (spec line 281 confirmed)
- [x] Error resilience: `removeAddonEntitlements` continues with metadata cleanup even if revokeBySource/removeBySource throws

---

## Pass #4 Deep-Dive Findings

### Services Analysis (pass #4)

All 5 service files analyzed exhaustively. Confirmed clean implementation of the primary SPEC-038 fix:

| File | @ts-expect-error | billing.plans.update() | grant() sourceId | set() sourceId | Status |
|------|-----------------|----------------------|------------------|-----------------|--------|
| addon-entitlement.service.ts | 0 | 0 | ✅ line 146 | ✅ line 191 | CLEAN |
| addon-expiration.service.ts | 0 | 0 | N/A | N/A | CLEAN |
| addon.checkout.ts | 0 | 0 | N/A | N/A | CLEAN |
| addon.types.ts | 0 | 0 | N/A | N/A | CLEAN |
| addon.user-addons.ts | 0 | 0 | N/A | N/A | BUG (GAP-038-22) |

**New finding**: `addon.user-addons.ts:331` has unsafe fallback `purchaseId: input.purchaseId ?? input.addonId` where `addonId` is a slug, not a UUID. Documented as GAP-038-22.

### QZPay Package Inspection (pass #4)

Verified installed versions and API shapes:

| Package | Installed | grant() signature | set() signature | QZPaySourceType |
|---------|-----------|-------------------|-----------------|-----------------|
| qzpay-core | ^1.2.0 | `grant(input: QZPayGrantEntitlementInput)` ✅ | `set(input: QZPaySetLimitInput)` ✅ | Includes 'addon' ✅ |
| qzpay-drizzle | ^1.2.0 | Fixed mapper ✅ | Fixed mapper ✅ | — |

**Critical discrepancy found**: `QZPayLimitService.removeBySource()` — the drizzle repo exposes `deleteBySource()`. Whether the service adapter wraps it as `removeBySource()` in the public interface could NOT be confirmed from package file inspection alone. This is documented as GAP-038-21 and requires immediate grep verification.

### Middleware Analysis (pass #4)

`entitlement.ts` fully implements SPEC-038 requirements:
- Plan base entitlements loaded ✅
- `billing.entitlements.getByCustomerId()` called for customer-level merge ✅
- Set UNION for entitlements ✅
- Map OVERRIDE for limits ✅
- Graceful degradation on failure ✅
- `shouldCache=false` on degraded result ✅
- `clearEntitlementCache(customerId)` exported ✅

### Routes Analysis (pass #4)

`addons.ts` cancel route:
- Ownership check atomic (3-condition single query) ✅
- All throws use HTTPException ✅
- `purchaseId: ownedAddon.id` passed correctly ✅
- `clearEntitlementCache` NOT called directly in route — but IS called internally from `removeAddonEntitlements()` in the service ✅ (previously flagged as gap, now confirmed correct)
- Bug: `addonId: params.id` passes UUID as slug — this is GAP-038-03, still open

### Test Coverage Analysis (pass #4)

150+ test cases across all test files. Zero `@ts-expect-error`. Mock API correctly uses object-based signatures. All SPEC-038 acceptance criteria have corresponding test cases. Key test gap confirmed from prior passes: tests mock `billing` object, so a missing method on the real package would not be detected by unit tests.

---

## QZPay Dependency Verification (Pass #2)

| Package | Required | apps/api | packages/billing | packages/db | Status |
|---------|----------|----------|-----------------|-------------|--------|
| `@qazuor/qzpay-core` | ^1.2.0 | ^1.2.0 | ^1.2.0 | - | OK |
| `@qazuor/qzpay-drizzle` | ^1.2.0 | - | - | ^1.2.0 | OK |
| `@qazuor/qzpay-hono` | ^1.1.1 | ^1.1.1 | - | - | OK |
| `@qazuor/qzpay-mercadopago` | ^1.1.0 | ^1.1.0 | ^1.1.0 | - | OK |
| `@qazuor/qzpay-react` | ^1.1.0 | - | - | - | Not in API/billing (admin only, OK) |

---

## Residual @ts-expect-error Audit (Pass #2)

| Location | Count | Addon-related? | Notes |
|----------|-------|----------------|-------|
| `apps/api/src/services/` | 0 | N/A | Clean |
| `apps/api/test/services/addon-*.test.ts` | 0 | N/A | Clean |
| `apps/api/test/routes/billing-admin-notifications.test.ts` | 7 | No | drizzle-orm mocking, unrelated to SPEC-038 |
| Total addon-related | **0** | - | **SPEC-038 success metric MET** |
