# SPEC-038: Addon Entitlements Architecture Fix

**Status**: completed
**Created**: 2026-03-08
**Updated**: 2026-03-09 (audit pass #5: corrected HTTPException count 12->16, clarified Bug #5 title, resolved breaking change policy for Q2/Q3, decided on mapper fix strategy, added cancel route purchaseId handling, added migration billing init reference, documented existing partial index, fixed revokeBySource/removeBySource type signatures, completed increment/recordUsage audit, added middleware fallback cache policy)
**Priority**: CRITICAL
**Complexity**: high
**Template**: spec-full

---

## Overview

The current addon entitlements system contains multiple critical bugs:

1. **Global plan mutation (PRIMARY BUG)**: When a customer purchases an addon, the system mutates the **global QZPay billing plan** (`billing_plans` table) instead of recording the entitlement or limit adjustment against the specific customer. Every customer on the same plan instantly receives the entitlement or limit boost that one customer paid for, and when the addon expires or is cancelled, all customers lose those entitlements.

2. **Double INSERT in `billing_addon_purchases`**: The checkout flow (`addon.checkout.ts:426`) inserts a purchase record inside a transaction, then calls `applyAddonEntitlements()` which inserts **another** purchase record (addon-entitlement.service.ts:207). Without a unique constraint, this creates duplicate rows.

3. **Cron job missing billing instance**: `AddonExpirationService` is instantiated without the billing instance in the cron job, causing all addon expiration processing to silently fail.

4. **`sourceId` silently dropped by QZPay mappers**: Both `mapCoreGrantEntitlementToDrizzle` and `mapCoreSetLimitToDrizzle` hardcode `sourceId: null`, making it impossible to track which purchase granted an entitlement or limit.

5. **Service layer silently discards `source`/`sourceId` parameters**: The `grant()` service method accepts `source` and `sourceId` as positional parameters but ignores them, hardcoding `source: "manual"` and never passing `sourceId` to the storage adapter. The `set()` service method does not accept `source`/`sourceId` at all. Note: the `.d.ts` types and service JS both use positional params (they match). The bug is that the service layer discards the values, not a type/implementation mismatch.

The fix requires coordinated changes in two codebases:
1. **QZPay** (the billing library): Fix type declarations, fix `sourceId` mapper bugs, add missing service methods (`remove`, `revokeBySource`, `removeBySource`), extend `source` enum.
2. **Hospeda** (this codebase): Rewrite the addon entitlement flow to use QZPay's per-customer entitlement and limit APIs instead of mutating global plan rows. Fix the double INSERT, the cron job bug, and incorporate billing error handling improvements from SPEC-037 gaps.

---

## Goals

1. Eliminate the global-plan mutation side effect when any customer buys an addon.
2. Guarantee that addon entitlements and limit increases are scoped exclusively to the purchasing customer.
3. Guarantee that addon expiry or cancellation removes only the purchasing customer's entitlement, not the base plan's entitlement.
4. Remove all `@ts-expect-error` workarounds that access private QZPay storage adapters directly.
5. Ensure the entitlement loading middleware merges base-plan entitlements/limits with per-customer addon grants at read time.
6. Provide a migration path for existing active addon purchases that were applied to the global plan.
7. Fix the cron job so it passes the billing instance to `AddonExpirationService`.
8. Fix the double INSERT in `billing_addon_purchases` by clarifying responsibility between `addon.checkout.ts` and `applyAddonEntitlements()`.
9. ~~Replace `throw new Error()` with `HTTPException` in addon billing routes (GAP-037-06/25 from SPEC-037).~~ **ALREADY RESOLVED** - verified 2026-03-09: `addons.ts` already uses `HTTPException` (16 instances) and the cancel route already uses an atomic ownership query (lines 292-308).

---

## Success Metrics

- Zero `@ts-expect-error` comments referencing `billing.plans.update` in the Hospeda codebase (currently 2 in service file + 12 in test file = 14 total).
- All test scenarios for addon purchase, expiry, and cancellation pass without modifying any row in `billing_plans`.
- Customers on the same plan who have not purchased an addon report the base plan entitlements only.
- Customers on the same plan who have purchased an addon report base plan entitlements plus addon entitlements.
- Existing active addon purchases visible in `billing_addon_purchases` are backfilled into `billing_customer_entitlements` / `billing_customer_limits` during migration.
- The addon expiry cron job successfully processes expired addons (currently broken due to missing billing instance).
- Zero duplicate rows in `billing_addon_purchases` for the same `(customer_id, addon_slug)` with `status='active'`.
- ~~Zero `throw new Error()` in addon-related route files (replaced with `HTTPException`).~~ **ALREADY MET** - verified 2026-03-09: `addons.ts` has zero `throw new Error()`, all 16 throws already use `HTTPException` with correct status codes.

---

## Actors

| Actor | Description |
|-------|-------------|
| Customer | An accommodation owner with an active QZPay subscription who purchases addons |
| Platform operator | Admin managing billing plans and addon definitions |
| QZPay billing engine | The external package (`@qazuor/qzpay-core` v1.2.0, `@qazuor/qzpay-drizzle` v1.2.0, `@qazuor/qzpay-hono` v1.1.1, `@qazuor/qzpay-mercadopago` v1.1.0, `@qazuor/qzpay-react` v1.1.0) providing per-customer entitlement and limit tables |
| Entitlement middleware | `apps/api/src/middlewares/entitlement.ts` - loads and caches customer entitlements at request time. Also exports `clearEntitlementCache(customerId)` (line 536-539) for cache invalidation. |
| Addon expiry cron | `apps/api/src/cron/jobs/addon-expiry.job.ts` - daily at 5:00 UTC, detects expired addon purchases |
| Billing instance factory | `apps/api/src/middlewares/billing.ts` - exports `getQZPayBilling(): QZPayBilling | null` (line 200-202), lazy-initialized singleton |
| AddonExpirationService | `apps/api/src/services/addon-expiration.service.ts` - processes expired addons, calls `removeAddonEntitlements()` |
| AddonCheckoutService | `apps/api/src/services/addon.checkout.ts` - handles addon purchase confirmation, inserts purchase record |

---

## The Bug (Root Cause Analysis)

### Bug #1: Global Plan Mutation (PRIMARY)

**Current (broken) flow:**

1. Customer A on Plan "Basic" buys addon "extra-photos-20".
2. `AddonEntitlementService.applyAddonEntitlements()` (line 67) fetches the "Basic" plan record via `billing.plans.get(planId)`.
3. It reads `plan.entitlements` and `plan.limits`, appends the addon's grants to those arrays.
4. It calls `billing.plans.update(plan.id, { entitlements, limits })` (line 244) using `@ts-expect-error` to bypass TypeScript, since `QZPayPlanService` does not expose `update()` (only the storage adapter `QZPayPlanStorage` has it). **Note:** the code has a misleading comment at line 242: `"Note: This modifies the plan for the subscription, not globally"` .. this is FALSE. The call modifies the global `billing_plans` row. This comment must be removed during the rewrite.
5. The `billing_plans` row for "Basic" is now permanently mutated. **Every** customer subscribed to "Basic" now has the extra-photos entitlement and the limit increase.
6. When addon expires, `removeAddonEntitlements()` (line 470) calls `billing.plans.update()` again, stripping the entitlement from the global plan for **all** "Basic" customers.

**Why the primary bug exists:**

`QZPayPlanService` (in `@qazuor/qzpay-core` types at interface line 2656) intentionally does not expose an `update` method. The service interface only has: `get`, `getActive`, `getPrices`, `list`. The Hospeda code bypasses this by using `@ts-expect-error` to access the underlying `QZPayPlanStorage.update()` method directly.

Meanwhile, `QZPayEntitlementService` (line 2708) and `QZPayLimitService` (line 2729) already have public `grant`, `revoke`, `set`, `check`, and `getByCustomerId` methods that operate on `billing_customer_entitlements` and `billing_customer_limits` tables. **Hospeda never calls them.** These are the correct APIs for per-customer operations.

The `QZPayBilling` interface (line 2889) confirms both services are exposed:
- `readonly entitlements: QZPayEntitlementService` (line 2917)
- `readonly limits: QZPayLimitService` (line 2921)

### Bug #2: Double INSERT in `billing_addon_purchases`

**Current (broken) flow:**

1. `addon.checkout.ts:confirmAddonPurchase()` inserts into `billing_addon_purchases` inside a DB transaction (line 426).
2. Then calls `applyAddonEntitlements()` (line 455).
3. `applyAddonEntitlements()` (addon-entitlement.service.ts:207) inserts **again** into `billing_addon_purchases` outside any transaction.
4. Without a unique constraint, this creates duplicate rows.
5. The second insert's error is swallowed (catch at line 229 logs and continues).

**Fix**: Clarify responsibility. `addon.checkout.ts` owns the INSERT (already has transaction). `applyAddonEntitlements()` must NOT insert.. it only grants entitlements/limits.

### Bug #3: Cron Job Missing Billing Instance

The addon expiry cron job (`addon-expiry.job.ts` line 122) creates `new AddonExpirationService()` without passing the billing instance. The constructor defaults `billing` to `null` (addon-expiration.service.ts:132), which means `AddonEntitlementService(null)` is created internally. When `expireAddon()` calls `removeAddonEntitlements()`, it checks `if (!this.billing)` and returns `{ success: false, error: { code: 'SERVICE_UNAVAILABLE' } }`. Every addon expiration attempt fails silently.

**Fix**: `new AddonExpirationService(getQZPayBilling())` on line 122.

### Bug #4: `sourceId` Silently Dropped by QZPay Mappers

Two mapper functions in `@qazuor/qzpay-drizzle` v1.1.0 hardcode `sourceId: null`:

**`mapCoreGrantEntitlementToDrizzle`** (qzpay-drizzle dist/index.js lines 463-473):
```js
function mapCoreGrantEntitlementToDrizzle(input, livemode) {
    return {
        customerId: input.customerId,
        entitlementKey: input.entitlementKey,
        grantedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        source: input.source ?? "manual",
        sourceId: null,          // BUG: always null, ignores input.sourceId
        livemode
    };
}
```

**`mapCoreSetLimitToDrizzle`** (qzpay-drizzle dist/index.js lines 619-630):
```js
function mapCoreSetLimitToDrizzle(input, livemode) {
    return {
        customerId: input.customerId,
        limitKey: input.limitKey,
        maxValue: input.maxValue,
        currentValue: 0,
        resetAt: input.resetAt ?? null,
        source: input.source ?? "manual",
        sourceId: null,          // BUG: always null, ignores input.sourceId
        livemode
    };
}
```

Both bugs must be fixed to `input.sourceId ?? null`.

### Bug #5: Service Layer Silently Discards `source`/`sourceId` + API Design Flaw

**There are THREE layers involved, and bugs exist in two of them.**

QZPay has three distinct layers for entitlements and limits:

| Layer | Location | `grant()` signature | `set()` signature |
|-------|----------|--------------------|--------------------|
| **1. Public service API** | qzpay-core `.d.ts` (line 2720/2745) + qzpay-core `index.js` (~line 2740) | Positional: `(customerId, entitlementKey, source?, sourceId?)` | Positional: `(customerId, limitKey, maxValue)` |
| **2. Storage adapter** | qzpay-drizzle `index.js` (line 6043/6079) | Object: `grant(input)` | Object: `set(input)` |
| **3. Storage mapper** | qzpay-drizzle `index.js` (line 463/619) | `mapCoreGrantEntitlementToDrizzle(input)` | `mapCoreSetLimitToDrizzle(input)` |

The `.d.ts` type declarations are **technically correct** for the public service API.. both `.d.ts` and the compiled service JS use positional parameters. The storage adapter (layer 2) takes objects, but that is an internal detail.

**Bug 5a: Service `grant()` ignores `source` and `sourceId` parameters.**

The service implementation (qzpay-core `index.js` ~line 2740) receives positional params but **discards** them:
```js
// qzpay-core service layer (~line 2740)
grant(customerId, entitlementKey, _source, _sourceId) {
    // BUG: _source and _sourceId are IGNORED, always passes "manual"
    return storage.entitlements.grant({
        customerId,
        entitlementKey,
        source: "manual"    // ← hardcoded, ignores the _source parameter
        // sourceId not passed at all
    });
}
```

Even if someone correctly called `billing.entitlements.grant("cust-123", "featured_listing", "addon", "purchase-id")`, the storage would receive `source: "manual"` and no `sourceId`.

**Bug 5b: Service `set()` does not accept `source` or `sourceId` at all.**

```js
// qzpay-core service layer
set(customerId, limitKey, maxValue) {
    return storage.limits.set({ customerId, limitKey, maxValue });
    // No source, no sourceId passed
}
```

**Bug 5c: Mapper hardcodes `sourceId: null`** (same as Bug #4, but at a different layer).

Even if the service DID pass `sourceId` to the storage adapter, the mapper would discard it (Bug #4). So there are two independent barriers preventing `sourceId` from reaching the database.

**This has not been caught because Hospeda never calls these methods** (it bypasses them via `@ts-expect-error` to use `billing.plans.update()` instead).

**Fix in QZPay (all three layers):**
1. **Service layer**: Change `grant()` and `set()` from positional params to input objects, passing all fields (including `source` and `sourceId`) through to the storage adapter.
2. **Type declarations** (`.d.ts`): Change signatures to match the new object-based API.
3. **Storage mapper**: Fix `sourceId: null` to `input.sourceId ?? null` (Bug #4).

**Breaking change policy:** Changing from positional params to input objects IS a breaking change for any code calling `grant(customerId, key)` or `set(customerId, key, value)`. However, QZPay is an internal library owned by the same team, and Hospeda is the only consumer. Hospeda currently does NOT call `grant()` or `set()` at all (it bypasses them via `@ts-expect-error` to use `billing.plans.update()`). Therefore, the breaking change is safe. The version bump to 1.2.0 (minor) is acceptable given the single-consumer context. If QZPay ever gains external consumers, this decision should be revisited with proper semver (major bump).

### Bug #6: Double Status Update on Expiration

In `addon-expiration.service.ts:393`, `expireAddon()` calls `removeAddonEntitlements()` first, then updates status to `'expired'`. But `removeAddonEntitlements()` (addon-entitlement.service.ts:384-397) also updates the `billing_addon_purchases` status to `'cancelled'`. The flow is:

1. `expireAddon()` calls `removeAddonEntitlements({customerId, addonSlug})`
2. `removeAddonEntitlements()` sets `status='cancelled'` (line 387)
3. `expireAddon()` then sets `status='expired'` (line 423)

Result: status goes `'active'` -> `'cancelled'` -> `'expired'` in two sequential updates.

**Fix**: After rewrite, `removeAddonEntitlements()` should NOT update `billing_addon_purchases` status. It should only revoke entitlements/limits from QZPay tables. The caller (`expireAddon()` or cancel route) owns the status update.

### Files Containing Bugs

| File | Bug | Lines |
|------|-----|-------|
| `apps/api/src/services/addon-entitlement.service.ts` | `@ts-expect-error` (2), double INSERT, global plan mutation | 207, 243, 469 |
| `apps/api/test/services/addon-entitlement.service.test.ts` | `@ts-expect-error` (12) | 131, 144, 177, 190, 224, 305, 317, 359, 371, 418, 460, 472 |
| `apps/api/src/cron/jobs/addon-expiry.job.ts` | Missing billing instance | 122 |
| `apps/api/src/services/addon-expiration.service.ts` | Double status update via removeAddonEntitlements | 393 |
| `apps/api/src/services/addon.checkout.ts` | Double INSERT (first of two) | 426 |
| `@qazuor/qzpay-drizzle` dist/index.js | sourceId hardcoded null (2 mappers), type mismatch | 470, 627 |

---

## Complete Call Flow (Current vs Fixed)

### Current Flow: Addon Purchase

```
1. MercadoPago webhook fires
2. addon.checkout.ts:confirmAddonPurchase()
   a. Validates customer, subscription, addon
   b. INSERT billing_addon_purchases (inside DB transaction)  ← First INSERT
   c. Calls applyAddonEntitlements({customerId, addonSlug})
      i.   Gets addon definition
      ii.  Gets customer subscription
      iii. Gets plan from subscription
      iv.  Reads plan.entitlements and plan.limits
      v.   Adds addon grants to the SET/object
      vi.  INSERT billing_addon_purchases                     ← DUPLICATE INSERT (Bug #2)
      vii. billing.plans.update(planId, {entitlements, limits}) ← GLOBAL MUTATION (Bug #1)
      viii.billing.subscriptions.update(metadata)              ← backward compat
      ix.  clearEntitlementCache(customerId)
```

### Fixed Flow: Addon Purchase

```
1. MercadoPago webhook fires
2. addon.checkout.ts:confirmAddonPurchase()
   a. Validates customer, subscription, addon
   b. INSERT billing_addon_purchases (inside DB transaction)  ← ONLY INSERT, owns purchase record
   c. Calls applyAddonEntitlements({customerId, addonSlug, purchaseId})
      i.   Gets addon definition
      ii.  Gets customer subscription + plan
      iii. IF addon.grantsEntitlement:
           billing.entitlements.grant(customerId, entitlementKey, {
             source: 'addon', sourceId: purchaseId, expiresAt
           })                                                  ← PER-CUSTOMER grant
      iv.  IF addon.affectsLimitKey:
           basePlanLimit = lookupCanonicalPlanLimit(planSlug, limitKey)
           billing.limits.set(customerId, limitKey, basePlanLimit + addon.limitIncrease, {
             source: 'addon', sourceId: purchaseId
           })                                                  ← PER-CUSTOMER limit
      v.   billing.subscriptions.update(metadata)              ← backward compat (deprecated)
      vi.  clearEntitlementCache(customerId)
   d. NO billing.plans.update() anywhere
```

### Current Flow: Addon Expiry

```
1. Cron job fires (daily 5:00 UTC)
2. addon-expiry.job.ts:handler()
   a. new AddonExpirationService()                             ← BUG: no billing (Bug #3)
   b. processExpiredAddons()
      i.  findExpiredAddons() -> list of expired purchases
      ii. For each: expireAddon({purchaseId})
          1. Calls removeAddonEntitlements({customerId, addonSlug})
             a. removeAddonEntitlements() returns SERVICE_UNAVAILABLE  ← FAILS (Bug #3)
          2. Never reaches status update
```

### Fixed Flow: Addon Expiry

```
1. Cron job fires (daily 5:00 UTC)
2. addon-expiry.job.ts:handler()
   a. new AddonExpirationService(getQZPayBilling())            ← FIXED: passes billing
   b. processExpiredAddons()
      i.  findExpiredAddons() -> list of expired purchases
      ii. For each: expireAddon({purchaseId})
          1. Calls removeAddonEntitlements({customerId, addonSlug, purchaseId})
             a. billing.entitlements.revokeBySource('addon', purchaseId)
                FALLBACK: if 0 rows, billing.entitlements.revoke(customerId, entitlementKey)
             b. billing.limits.removeBySource('addon', purchaseId)
                FALLBACK: if 0 rows, billing.limits.remove(customerId, limitKey)
             c. clearEntitlementCache(customerId)
             d. Does NOT update billing_addon_purchases status  ← FIXED: caller owns status
          2. Updates billing_addon_purchases status='expired'
```

### Current Flow: Entitlement Loading (per request)

```
1. Request arrives
2. entitlement.ts:entitlementMiddleware()
   a. Gets billingCustomerId from context
   b. Checks cache (5-min TTL FIFO, max 1000)
   c. On cache miss: loadEntitlements(customerId)
      i.   Gets active subscription
      ii.  Gets plan from subscription
      iii. Reads plan.entitlements -> Set<EntitlementKey>       ← READS FROM (POSSIBLY MUTATED) PLAN
      iv.  Reads plan.limits -> Map<LimitKey, number>           ← READS FROM (POSSIBLY MUTATED) PLAN
      v.   Returns {entitlements, limits}
   d. Caches and sets in context
```

### Fixed Flow: Entitlement Loading (per request)

```
1. Request arrives
2. entitlement.ts:entitlementMiddleware()
   a. Gets billingCustomerId from context
   b. Checks cache (5-min TTL FIFO, max 1000)
   c. On cache miss: loadEntitlements(customerId)
      i.   Gets active subscription
      ii.  Gets plan from subscription
      iii. Reads plan.entitlements -> Set<EntitlementKey>        ← Base plan entitlements
      iv.  Reads plan.limits -> Map<LimitKey, number>            ← Base plan limits
      v.   billing.entitlements.getByCustomerId(customerId)      ← NEW: customer-level entitlements
      vi.  billing.limits.getByCustomerId(customerId)            ← NEW: customer-level limits
      vii. UNION entitlements: base plan + customer-level keys
      viii.OVERRIDE limits: for each customer-level limit, replace plan-level value
      ix.  Returns {entitlements, limits}
   d. Caches and sets in context
```

---

## Addon Definitions Reference

All addons defined in `packages/billing/src/config/addons.config.ts`:

| Addon Slug | Name | billingType | grantsEntitlement | affectsLimitKey | limitIncrease | durationDays | targetCategories |
|-----------|------|-------------|-------------------|-----------------|---------------|-------------|-----------------|
| `visibility-boost-7d` | Visibility Boost (7 days) | `one_time` | `EntitlementKey.FEATURED_LISTING` | `null` | `null` | `7` | `['owner','complex']` |
| `visibility-boost-30d` | Visibility Boost (30 days) | `one_time` | `EntitlementKey.FEATURED_LISTING` | `null` | `null` | `30` | `['owner','complex']` |
| `extra-photos-20` | Extra Photos Pack (+20) | `recurring` | `null` | `LimitKey.MAX_PHOTOS_PER_ACCOMMODATION` | `20` | `null` | `['owner','complex']` |
| `extra-accommodations-5` | Extra Accommodations (+5) | `recurring` | `null` | `LimitKey.MAX_ACCOMMODATIONS` | `5` | `null` | `['owner']` |
| `extra-properties-5` | Extra Properties (+5) | `recurring` | `null` | `LimitKey.MAX_PROPERTIES` | `5` | `null` | `['complex']` |

**`AddonDefinition` key fields** (from `packages/billing/src/config/addons.config.ts`):
- `grantsEntitlement: EntitlementKey | null` .. if non-null, the addon grants this entitlement to the customer
- `affectsLimitKey: LimitKey | null` .. if non-null, the addon increases this limit
- `limitIncrease: number | null` .. the amount to add to the base plan limit
- `durationDays: number | null` .. null means recurring (persists until cancelled), number means one-time with expiration
- `billingType: 'one_time' | 'recurring'` .. note: field is called `billingType`, NOT `type`
- `targetCategories: string[]` .. which plan categories this addon applies to (e.g., `['owner']` means only owner plans)

**Target category constraints:**
- `extra-accommodations-5` only applies to `owner` plans (which use `MAX_ACCOMMODATIONS`)
- `extra-properties-5` only applies to `complex` plans (which use `MAX_PROPERTIES`)
- The canonical plan limit lookup must use the correct `limitKey` for the customer's plan category

---

## QZPay Changes Required (Prerequisite)

The following changes must be made to the `@qazuor/qzpay-core`, `@qazuor/qzpay-drizzle`, and related packages **before** the Hospeda changes can be implemented.

**IMPORTANT context**: Both the `.d.ts` types and the service JS currently use positional parameters for `grant()` and `set()`. The storage adapter (internal) uses input objects. The changes below convert the service layer from positional to object params, matching the storage adapter pattern and enabling `source`/`sourceId` passthrough. **Breaking change note:** This changes the public API from positional to object params. See "Breaking change policy" in Bug #5 section for justification (single-consumer library, Hospeda does not currently call these methods).

### Change Q1: Extend `source` enum to include `'addon'`

**Current types:**
```ts
// QZPayCustomerEntitlement.source (line 590)
source: 'subscription' | 'purchase' | 'manual';

// QZPayCustomerLimit.source (line 1024)
source: 'subscription' | 'purchase' | 'manual';
```

**Required change:** Extract a shared type alias and add `'addon'`:
```ts
// NEW: extracted type alias (single source of truth for all source fields)
type QZPaySourceType = 'subscription' | 'purchase' | 'manual' | 'addon';
```

**Affected types (all must use `QZPaySourceType`):**
- `QZPayCustomerEntitlement.source` (line 590 in index.d.ts) - change from inline union to `QZPaySourceType`
- `QZPayCustomerLimit.source` (line 1024 in index.d.ts) - change from inline union to `QZPaySourceType`
- `QZPayGrantEntitlementInput.source` (line 603 - currently `'manual'` only, change to `QZPaySourceType`)
- `QZPaySetLimitInput.source` (line 1045 - currently `'manual'` only, change to `QZPaySourceType`)
- `revokeBySource` parameter (Q7) - use `QZPaySourceType`
- `removeBySource` parameter (Q7) - use `QZPaySourceType`

**Generic consideration**: The `'addon'` source value is generic enough for any billing system. It represents any add-on purchase granting entitlements/limits to a customer. QZPay should not include Hospeda-specific values. The `QZPaySourceType` alias makes it trivial to extend with new source types in the future.

### Change Q2: Fix `grant()` across all three layers (service JS + types + mapper)

**The fix must touch THREE layers.** Fixing only the `.d.ts` or only the mapper is insufficient.

**Layer 1 - Current service JS (qzpay-core `index.js` ~line 2740) - DISCARDS source/sourceId:**
```js
// qzpay-core service layer - CURRENT (BUG)
grant(customerId, entitlementKey, _source, _sourceId) {
    return storage.entitlements.grant({
        customerId,
        entitlementKey,
        source: "manual"    // ← BUG: ignores _source parameter
        // sourceId not passed at all  ← BUG: ignores _sourceId parameter
    });
}
```

**Layer 2 - Current `.d.ts` signature (positional params, matches current JS but unusable for source/sourceId):**
```ts
// Line 2720
grant: (customerId: string, entitlementKey: string, source?: string, sourceId?: string)
    => Promise<QZPayCustomerEntitlement>;
```

**Layer 3 - Current storage adapter (qzpay-drizzle `index.js` line 6043 - takes object, works correctly):**
```js
async grant(input) {
    const drizzleInput = mapCoreGrantEntitlementToDrizzle(input, livemode);
    const result = await repo.grant(drizzleInput);
    return mapDrizzleCustomerEntitlementToCore(result);
}
```

**Required changes:**

**(a)** Fix **service JS** (qzpay-core) to accept input object and pass ALL fields through:
```js
// qzpay-core service layer - FIXED
grant(input) {
    return storage.entitlements.grant(input);
}
```

**(b)** Fix `.d.ts` to use input object:
```ts
grant: (input: QZPayGrantEntitlementInput) => Promise<QZPayCustomerEntitlement>;
```

**(c)** Add `sourceId` to `QZPayGrantEntitlementInput`:
```ts
interface QZPayGrantEntitlementInput {
    customerId: string;
    entitlementKey: string;
    expiresAt?: Date;        // already exists
    source?: 'subscription' | 'purchase' | 'manual' | 'addon';  // expand from 'manual' only
    sourceId?: string;       // NEW - currently missing from type
}
```

**(d)** Fix `mapCoreGrantEntitlementToDrizzle` (qzpay-drizzle line 470) to use `input.sourceId`:
```js
// CURRENT (BUG):
sourceId: null,
// FIXED:
sourceId: input.sourceId ?? null,
```

**Decision on mapper strategy:** Fix the base mapper directly (option d above). Do NOT use the `WithSource` variant because: (1) having two variants of the same mapper is confusing and error-prone, (2) the `WithSource` variant uses positional params which is inconsistent with the migration to input objects, (3) it is a one-line change. After fixing the base mapper, **delete** `mapCoreGrantEntitlementWithSourceToDrizzle()` (line 474) as it becomes redundant dead code.

**(e)** See "Breaking change policy" in Bug #5 section above. QZPay is single-consumer (Hospeda only), and Hospeda does not currently call these methods, so the API change is safe.

**Drizzle adapter `grant()` upsert behavior (already implemented, document only):**
The Drizzle adapter's `grant()` (repo level, line 2890-2905) does upsert:
- If an active grant exists for `(customerId, entitlementKey)`: updates `expiresAt` only if the new value is null (no expiration) or later than the existing one. Also updates `source` and `sourceId`.
- If no active grant exists: inserts a new row.
This means re-purchasing a visibility-boost while one is active will extend the expiration if the new date is later.

### Change Q3: Fix `set()` across all three layers (service JS + types + mapper)

**Same three-layer fix pattern as Q2.**

**Layer 1 - Current service JS (qzpay-core `index.js`) - does NOT accept source/sourceId:**
```js
// qzpay-core service layer - CURRENT
set(customerId, limitKey, maxValue) {
    return storage.limits.set({ customerId, limitKey, maxValue });
    // No source, no sourceId passed to storage
}
```

**Layer 2 - Current `.d.ts` signature (positional params, no source/sourceId):**
```ts
// Line 2745
set: (customerId: string, limitKey: string, maxValue: number)
    => Promise<QZPayCustomerLimit>;
```

**Layer 3 - Current storage adapter (qzpay-drizzle `index.js` line 6079 - takes object):**
```js
async set(input) {
    const drizzleInput = mapCoreSetLimitToDrizzle(input, livemode);
    const result = await repo.set(drizzleInput);
    return mapDrizzleCustomerLimitToCore(result);
}
```

**Required changes:**

**(a)** Fix **service JS** (qzpay-core) to accept input object and pass ALL fields through:
```js
// qzpay-core service layer - FIXED
set(input) {
    return storage.limits.set(input);
}
```

**(b)** Fix `.d.ts` to use input object:
```ts
set: (input: QZPaySetLimitInput) => Promise<QZPayCustomerLimit>;
```

**(c)** Add `sourceId` to `QZPaySetLimitInput`:
```ts
interface QZPaySetLimitInput {
    customerId: string;
    limitKey: string;
    maxValue: number;
    resetAt?: Date;
    source?: 'subscription' | 'purchase' | 'manual' | 'addon';  // expand from 'manual' only
    sourceId?: string;       // NEW - currently missing from type
}
```

**(d)** Fix `mapCoreSetLimitToDrizzle` (qzpay-drizzle line 619-630) to use `input.sourceId`:
```js
// CURRENT (BUG):
sourceId: null,
// FIXED:
sourceId: input.sourceId ?? null,
```

**Decision on mapper strategy:** Same as Q2.. fix the base mapper directly and **delete** `mapCoreSetLimitWithSourceToDrizzle()` (line 631) as redundant dead code.

**(e)** See "Breaking change policy" in Bug #5 section. Same reasoning as Q2.

**Drizzle adapter `set()` upsert behavior (already implemented, document only):**
The Drizzle adapter's `set()` (repo level, line 3424-3438) does upsert:
- If a row exists for `(customerId, limitKey)`: updates `maxValue`, `resetAt`, `source`, `sourceId`.
- If no row exists: inserts a new row.
This means `set()` is safe to call multiple times for the same customer+limitKey.

### Change Q4: Add `remove()` method to `QZPayLimitService`

**Current `QZPayLimitService` interface (complete, line 2729-2750):**
```ts
interface QZPayLimitService {
    check: (customerId: string, limitKey: string) => Promise<QZPayLimitCheckResult>;
    getByCustomerId: (customerId: string) => Promise<QZPayCustomerLimit[]>;
    increment: (customerId: string, limitKey: string, amount?: number) => Promise<QZPayCustomerLimit>;
    set: (input: QZPaySetLimitInput) => Promise<QZPayCustomerLimit>;
    recordUsage: (customerId: string, limitKey: string, quantity: number, action?: 'set' | 'increment') => Promise<void>;
}
```

**Required addition:**
```ts
remove: (customerId: string, limitKey: string) => Promise<void>;
```

**Why:** When an addon that increases a limit is cancelled or expires, we need to delete the per-customer limit row entirely so the customer falls back to the base plan limit. Using `set(customerId, limitKey, 0)` would be incorrect because 0 means "explicitly disabled", not "fall back to plan default".

**Implementation:** Modify `LimitStorage.delete()` (qzpay-drizzle line 3506-3511) to be **idempotent** (not throw when row doesn't exist). Currently it throws:
```js
async delete(customerId, limitKey) {
    const result = await this.db.delete(billingCustomerLimits)
        .where(and(eq(...customerId), eq(...limitKey)))
        .returning();
    if (result.length === 0) {
        throw new Error(`Customer limit not found...`);  // REMOVE THIS
    }
}
```

Change to:
```js
async delete(customerId, limitKey) {
    await this.db.delete(billingCustomerLimits)
        .where(and(eq(...customerId), eq(...limitKey)));
    // No .returning(), no length check, no throw - matches revoke() pattern
}
```

This is consistent with how `EntitlementStorage.revoke()` (line 2909-2913) already works (DELETE without throw).

### Change Q5: Verify `getByCustomerId()` filters expired entitlements

**Status: ALREADY IMPLEMENTED in qzpay-drizzle v1.1.0.** No code changes needed.

The Drizzle adapter's `findByCustomerId` for entitlements (line 2945-2953) already filters expired rows by default:
```js
async findByCustomerId(customerId, includeExpired = false) {
    if (!includeExpired) {
        const now = new Date();
        const notExpiredCondition = or(
            isNull(billingCustomerEntitlements.expiresAt),
            gt(billingCustomerEntitlements.expiresAt, now)
        );
        return this.db.select().from(billingCustomerEntitlements)
            .where(and(customerCondition, notExpiredCondition))...
    }
    return this.db.select().from(billingCustomerEntitlements)
        .where(customerCondition)...
}
```

The service adapter (line 6051-6053) calls `repo.findByCustomerId(customerId)` without passing `includeExpired`, so it defaults to `false` (filters expired).

**Action:** Add a test that explicitly verifies expired entitlements are excluded from `getByCustomerId()` results. No production code change needed.

### Change Q6: Verify `revoke()` idempotency

**Status: ALREADY IDEMPOTENT in qzpay-drizzle v1.1.0.** No code changes needed.

The Drizzle adapter's `revoke()` (line 2909-2913) does a simple DELETE without checking row count:
```js
async revoke(customerId, entitlementKey) {
    await this.db.delete(billingCustomerEntitlements).where(
        and(eq(...customerId), eq(...entitlementKey))
    );
    // No .returning(), no length check, no throw
}
```

This is idempotent.. calling `revoke()` for a non-existent row completes successfully.

**Action:** Add a test that verifies `revoke()` does not throw when the row doesn't exist. No production code change needed.

### Change Q7: Expose `revokeBySource` and `removeBySource` in service interfaces

**Current state:** The Drizzle adapter repository already has these methods:
- `EntitlementRepo.revokeBySource(source, sourceId)` (line 2917) - deletes all entitlements matching source+sourceId, returns count
- `LimitRepo.deleteBySource(source, sourceId)` (line 3515) - deletes all limits matching source+sourceId, returns count

But they are NOT exposed through the `QZPayEntitlementService` or `QZPayLimitService` interfaces. They are only available at the storage/repo level.

**Required additions:**
```ts
// Define source type (reuse across all entitlement/limit types)
type QZPaySourceType = 'subscription' | 'purchase' | 'manual' | 'addon';

interface QZPayEntitlementService {
    // ... existing methods
    revokeBySource: (source: QZPaySourceType, sourceId: string) => Promise<number>;
}

interface QZPayLimitService {
    // ... existing methods
    removeBySource: (source: QZPaySourceType, sourceId: string) => Promise<number>;
}
```

**Note:** Use the typed `QZPaySourceType` union instead of generic `string` for type safety. This type should be extracted and reused across `QZPayCustomerEntitlement.source`, `QZPayCustomerLimit.source`, `QZPayGrantEntitlementInput.source`, `QZPaySetLimitInput.source`, `revokeBySource`, and `removeBySource`.

**Why:** These are more robust for addon cleanup than individual `revoke(customerId, key)` / `remove(customerId, key)` because:
- No need to know which specific entitlement/limit key was affected by the addon
- Cleans up everything associated with a single `purchaseId` at once
- Future-proof if addons ever grant multiple entitlements/limits
- Simpler code in `removeAddonEntitlements()`

**Service adapter wiring (in qzpay-drizzle):**
```js
// Add to the entitlements service adapter (around line 6043)
async revokeBySource(source, sourceId) {
    return repo.revokeBySource(source, sourceId);
}

// Add to the limits service adapter (around line 6079)
async removeBySource(source, sourceId) {
    return repo.deleteBySource(source, sourceId);
}
```

### Change Q8: Systematic audit of ALL service method signatures across all three layers

Beyond `grant()` and `set()`, verify that ALL service method signatures are consistent across the **three layers**: (1) `.d.ts` types, (2) qzpay-core service JS, and (3) qzpay-drizzle storage adapter JS.

**Audit procedure:**
1. For each method in `QZPayEntitlementService` (check, getByCustomerId, grant, revoke) and `QZPayLimitService` (check, getByCustomerId, increment, set, recordUsage):
   - Read the `.d.ts` signature in `@qazuor/qzpay-core/dist/index.d.ts`
   - Read the **service JS** implementation in `@qazuor/qzpay-core/dist/index.js` (~lines 2730-2780)
   - Read the **storage adapter JS** implementation in `@qazuor/qzpay-drizzle/dist/index.js` (~lines 6026-6106)
   - Compare all three: does the `.d.ts` match the service JS? Does the service JS correctly pass all params to the storage adapter?
   - Document any mismatch or parameter loss
2. Fix all mismatches

**Known mismatches (already identified):**
- `grant()`: Service JS ignores `source`/`sourceId` params, hardcodes `source: "manual"`. **Fix in Q2.**
- `set()`: Service JS does not accept `source`/`sourceId` at all. **Fix in Q3.**

**Pre-audit results (from investigation):**

The following methods use positional params at both the service and storage adapter level (no conversion issues):

| Method | .d.ts | Service JS | Storage JS | Status |
|--------|-------|------------|------------|--------|
| `entitlements.check(customerId, key)` | Positional | Positional passthrough | Positional | MATCH |
| `entitlements.getByCustomerId(id)` | Positional | Positional passthrough | Positional | MATCH |
| `entitlements.revoke(customerId, key)` | Positional | Positional passthrough | Positional | MATCH |
| `limits.check(customerId, key)` | Positional | Positional passthrough | Positional | MATCH |
| `limits.getByCustomerId(id)` | Positional | Positional passthrough | Positional | MATCH |
| `limits.increment(id, key, amount?)` | Positional | Converts to object `{customerId, limitKey, incrementBy}` | Object | MATCH - service correctly maps positional `amount` to object `incrementBy`, all params passed through. `amount` defaults to 1 at service level if omitted. |
| `limits.recordUsage(id, key, qty, action?)` | Positional | Converts to object `{id, customerId, limitKey, quantity, action}` | Object | MATCH - service correctly maps all 4 positional params to named fields in object. `action` defaults to `'increment'` if omitted. |

**Audit completed (2026-03-09):** All methods verified. `increment()` and `recordUsage()` correctly convert positional to object without parameter loss. No additional fixes needed beyond Q2 (`grant`) and Q3 (`set`).

**Deliverable**: A table documenting each method across all three layers, with "OK" or "MISMATCH + fix applied" for each.

### Change Q9: Version bump

Bump all QZPay dependencies to their latest versions: `@qazuor/qzpay-core@^1.2.0`, `@qazuor/qzpay-drizzle@^1.2.0`, `@qazuor/qzpay-hono@^1.2.0`, `@qazuor/qzpay-mercadopago@^1.2.0`, `@qazuor/qzpay-react@^1.2.0`. Although changing from positional to object params is technically a breaking change (semver major), QZPay is a single-consumer internal library (only Hospeda uses it) and Hospeda does not currently call the affected methods. Minor bump is acceptable in this context. Actual published versions: core 1.2.0, drizzle 1.2.0, hono 1.1.1, mercadopago 1.1.0, react 1.1.0.

### Change Q10: Tests

Add/update tests for all new/modified methods:
- `grant()` with input object including source, sourceId, expiresAt
- `set()` with input object including source, sourceId
- `remove()` happy path and idempotent (no-op when row doesn't exist)
- `revokeBySource()` and `removeBySource()`
- Verify `getByCustomerId()` filters expired entitlements
- Verify `revoke()` is idempotent
- Verify `sourceId` is properly stored (not null) after mapper fix

### Summary of QZPay changes

| # | Change | Status | Effort | Generic? |
|---|--------|--------|--------|----------|
| Q1 | Extract `QZPaySourceType` union type and extend to include `'addon'` | New code | Small | Yes |
| Q2 | Fix `grant()` across 3 layers: service JS (stops ignoring source/sourceId) + types + mapper. Delete redundant `mapCoreGrantEntitlementWithSourceToDrizzle()` | Bug fix + API redesign + cleanup | Medium | Yes |
| Q3 | Fix `set()` across 3 layers: service JS (add source/sourceId passthrough) + types + mapper. Delete redundant `mapCoreSetLimitWithSourceToDrizzle()` | Bug fix + API redesign + cleanup | Medium | Yes |
| Q4 | Add `remove()` to LimitService (idempotent) | New code | Small | Yes |
| Q5 | Verify expired entitlement filtering | Already implemented, add test only | Trivial | N/A |
| Q6 | Verify `revoke()` idempotency | Already implemented, add test only | Trivial | N/A |
| Q7 | Expose `revokeBySource` / `removeBySource` in service interfaces (typed with `QZPaySourceType`) | Wire existing repo methods | Small | Yes |
| Q8 | Systematic audit of ALL service methods across 3 layers (.d.ts + service JS + storage JS). **Completed**: `increment()` and `recordUsage()` verified correct. Only `grant()` (Q2) and `set()` (Q3) need fixes. | Audit complete | Small (done) | Yes |
| Q9 | Version bump to 1.2.0 (both packages simultaneously) | Config | Trivial | N/A |
| Q10 | Tests | New tests | Medium | N/A |

---

## Addon Stacking Policy (Design Decision)

**Question:** Can a customer purchase the same addon multiple times to stack the effect?

**Decision: NO stacking for v1.** All addon purchases are idempotent:

- **Entitlement addons** (visibility-boost-7d, visibility-boost-30d): Purchasing the same addon while one is active extends the expiration date (via QZPay's `grant()` upsert behavior). No duplicate rows are created.
- **Limit addons** (extra-photos-20, extra-accommodations-5, extra-properties-5): Purchasing the same addon while one is active is a no-op (idempotency check detects existing active purchase in `billing_addon_purchases`). The customer cannot buy 2x extra-photos-20 to get +40.

**Rationale:**
- Simplifies implementation (no need to track multiple purchases of the same addon per customer)
- Avoids complex limit recalculation on partial cancellation
- The database-level guard (unique partial index on `billing_addon_purchases(customer_id, addon_slug) WHERE status = 'active'`) enforces this

**Future consideration:** If stacking is ever needed, it requires redesigning the limit computation to sum all active addon purchases for a given limitKey, not just use a single `maxValue`.

---

## User Stories

### Story 1 - Addon purchase grants entitlement to the buying customer only

As a customer who purchases an addon,
I want my account to receive the addon's entitlement or limit increase immediately after payment is confirmed,
so that I can access the feature I paid for without other customers on my plan being affected.

#### Acceptance Criteria

**Scenario 1a - Entitlement addon purchase (happy path)**

```
Given a customer "Alice" is on plan "owner-basico" (no FEATURED_LISTING entitlement)
  And customer "Bob" is also on plan "owner-basico"
  And Alice completes payment for the "visibility-boost-7d" addon
When the payment webhook triggers addon confirmation
Then addon.checkout.ts inserts a row into billing_addon_purchases with status="active", expiresAt=now+7days
  And addon.checkout.ts calls applyAddonEntitlements({customerId, addonSlug, purchaseId})
  And applyAddonEntitlements does NOT insert into billing_addon_purchases (checkout owns that)
  And billing.entitlements.grant() is called with input:
    { customerId: Alice's billing customer ID,
      entitlementKey: "featured_listing",
      source: "addon",
      sourceId: <billing_addon_purchases row ID>,
      expiresAt: now + 7 days }
  And a row is inserted/upserted into billing_customer_entitlements
  And Alice's resolved entitlements include "featured_listing"
  And Bob's resolved entitlements do NOT include "featured_listing"
  And the billing_plans row for "owner-basico" is NOT modified
  And clearEntitlementCache(Alice.customerId) is called
```

**Scenario 1b - Limit addon purchase (happy path)**

```
Given a customer "Alice" has plan "owner-basico"
  And the CANONICAL plan definition (from plans.config.ts) has MAX_PHOTOS_PER_ACCOMMODATION=5
  And customer "Bob" is on the same plan with MAX_PHOTOS_PER_ACCOMMODATION=5
  And Alice completes payment for the "extra-photos-20" addon (limitIncrease=20)
When the payment webhook triggers addon confirmation
Then addon.checkout.ts inserts a row into billing_addon_purchases with status="active", expiresAt=null
  And addon.checkout.ts calls applyAddonEntitlements({customerId, addonSlug, purchaseId})
  And applyAddonEntitlements reads the base plan limit from the CANONICAL plan config (NOT from billing_plans table)
  And billing.limits.set() is called with input:
    { customerId: Alice's billing customer ID,
      limitKey: "max_photos_per_accommodation",
      maxValue: 25 (canonical base 5 + addon increase 20),
      source: "addon",
      sourceId: <billing_addon_purchases row ID> }
  And a row is upserted into billing_customer_limits
  And Alice's resolved MAX_PHOTOS_PER_ACCOMMODATION is 25
  And Bob's resolved MAX_PHOTOS_PER_ACCOMMODATION remains 5
  And the billing_plans row is NOT modified
  And clearEntitlementCache(Alice.customerId) is called
```

**Scenario 1c - Customer has no subscriptions at all**

```
Given a customer has no subscription (getByCustomerId returns empty array)
When addon confirmation is attempted for that customer
Then applyAddonEntitlements returns { success: false, error: { code: "NO_SUBSCRIPTION" } }
  And no rows are written to billing_customer_entitlements or billing_customer_limits
```

**Scenario 1d - Customer has subscriptions but none active**

```
Given a customer has subscriptions but none with status "active" or "trialing"
When addon confirmation is attempted for that customer
Then applyAddonEntitlements returns { success: false, error: { code: "NO_ACTIVE_SUBSCRIPTION" } }
  And no rows are written to billing_customer_entitlements or billing_customer_limits
```

**Scenario 1e - Unknown addon slug**

```
Given a payment webhook arrives with addonSlug="nonexistent-addon"
When addon confirmation is attempted
Then getAddonBySlug("nonexistent-addon") returns undefined
  And applyAddonEntitlements returns { success: false, error: { code: "NOT_FOUND" } }
  And no rows are written anywhere
```

**Scenario 1f - Idempotent duplicate purchase**

```
Given Alice already has an active row in billing_addon_purchases for addonSlug="extra-photos-20"
  And Alice already has a row in billing_customer_limits for limitKey="max_photos_per_accommodation" with source="addon"
When applyAddonEntitlements is called again for Alice and "extra-photos-20"
Then for entitlements: QZPay grant() upsert detects existing row, no duplicate
  And for limits: QZPay set() upsert updates existing row, no duplicate
  And returns { success: true }
  And no billing_plans rows are modified
```

**Scenario 1g - Entitlement addon re-purchase extends expiration**

```
Given Alice has an active "visibility-boost-7d" that expires in 3 days
  And she purchases "visibility-boost-7d" again
When applyAddonEntitlements is called
Then billing.entitlements.grant() is called with expiresAt = now + 7 days
  And QZPay's grant() upsert extends the expiration to the new date (since it's later than existing)
  And the billing_addon_purchases row is updated by addon.checkout.ts (old one cancelled, new one active)
  And clearEntitlementCache(Alice.customerId) is called
```

**Scenario 1h - Grant fails after purchase record is created**

```
Given addon.checkout.ts has already inserted the billing_addon_purchases row (inside transaction)
  And billing.entitlements.grant() or billing.limits.set() fails (e.g., QZPay DB unavailable)
When the failure is detected in applyAddonEntitlements
Then the error is logged with Sentry.captureException()
  And applyAddonEntitlements returns { success: false, error: { code: "ENTITLEMENT_GRANT_FAILED" } }
  And addon.checkout.ts logs the failure as a warning (non-fatal.. table insert already succeeded)
  And the billing_addon_purchases row with status="active" is preserved (source of truth for retry)
  And no billing_plans rows are modified
  And the orphaned purchase is repaired by: (a) the migration script, or (b) a future reconciliation cron
```

**Scenario 1i - Base plan limit read from canonical config (NOT from possibly-mutated DB)**

```
Given the billing_plans row for "owner-basico" has been mutated by previous addon purchases
  And the canonical plan definition in plans.config.ts has MAX_PHOTOS_PER_ACCOMMODATION=5
When applyAddonEntitlements computes the new limit value for "extra-photos-20"
Then it reads the base limit from the canonical config (5), NOT from the billing_plans table
  And the computed maxValue is 5 + 20 = 25
  And this is correct regardless of whether the migration has run yet
```

**Scenario 1j - Base plan limit is unlimited (-1), addon limit increase is a no-op**

```
Given a customer is on plan "owner-premium" with MAX_ACTIVE_PROMOTIONS=-1 (unlimited)
  And the customer purchases an addon that has affectsLimitKey="max_active_promotions" and limitIncrease=5
When applyAddonEntitlements computes the new limit value
Then it reads the base limit from the canonical config: -1 (unlimited)
  And since basePlanLimit === -1, the limit increase is skipped (no-op)
  And billing.limits.set() is NOT called for this limitKey
  And no row is inserted into billing_customer_limits for this key
  And a warning is logged: "Addon limit increase skipped: base plan already unlimited (-1)"
  And applyAddonEntitlements still returns { success: true }
  And if the addon also grants an entitlement, that entitlement IS still applied normally
```

---

### Story 2 - Entitlement loading merges base plan and customer-level grants

As the Hospeda API,
I want each request to load a customer's effective entitlements by merging their base plan entitlements with any per-customer addon grants,
so that the resolved entitlements reflect exactly what the customer is entitled to at that moment.

#### Acceptance Criteria

**Scenario 2a - Customer with no addons**

```
Given a customer has an active subscription to plan "owner-basico" with entitlements:
    [PUBLISH_ACCOMMODATIONS, EDIT_ACCOMMODATION_INFO, VIEW_BASIC_STATS, RESPOND_REVIEWS, CAN_USE_CALENDAR, CAN_CONTACT_WHATSAPP_DISPLAY]
  And billing.entitlements.getByCustomerId() returns [] (empty)
  And billing.limits.getByCustomerId() returns [] (empty)
When the entitlement middleware loads entitlements for that customer
Then the resolved entitlements set is:
    {PUBLISH_ACCOMMODATIONS, EDIT_ACCOMMODATION_INFO, VIEW_BASIC_STATS, RESPOND_REVIEWS, CAN_USE_CALENDAR, CAN_CONTACT_WHATSAPP_DISPLAY}
  And the resolved limits are from the plan only:
    { MAX_ACCOMMODATIONS: 1, MAX_PHOTOS_PER_ACCOMMODATION: 5, MAX_ACTIVE_PROMOTIONS: 0 }
```

**Scenario 2b - Customer with active addon entitlement**

```
Given a customer has plan "owner-basico" (no FEATURED_LISTING)
  And billing.entitlements.getByCustomerId() returns:
    [{ entitlementKey: "featured_listing", source: "addon", sourceId: "purchase-uuid", expiresAt: tomorrow }]
When the entitlement middleware loads entitlements
Then the resolved entitlements set is:
    {PUBLISH_ACCOMMODATIONS, ...(base plan), FEATURED_LISTING}
  The addon entitlement is UNIONED with the plan entitlements
```

**Scenario 2c - Customer with expired addon entitlement**

```
Given a customer has plan "owner-basico"
  And billing.entitlements.getByCustomerId() returns [] (QZPay filters expired rows, verified in v1.1.0)
When the entitlement middleware loads entitlements
Then the resolved entitlements set contains only the base plan entitlements
  (The expired row is not returned by getByCustomerId, so it is naturally excluded)
```

**Scenario 2d - Limit merging: customer-level limit overrides plan-level limit**

```
Given plan "owner-basico" defines MAX_PHOTOS_PER_ACCOMMODATION=5
  And billing.limits.getByCustomerId() returns:
    [{ limitKey: "max_photos_per_accommodation", maxValue: 25, source: "addon", sourceId: "purchase-uuid" }]
When the entitlement middleware loads limits
Then the resolved MAX_PHOTOS_PER_ACCOMMODATION is 25
  And the plan-level value of 5 is superseded by the customer-level value
```

**Scenario 2e - Entitlement cache invalidation on addon purchase**

```
Given a customer's entitlements are cached in the in-memory FIFO cache (5-minute TTL, max 1000 entries)
When an addon purchase is confirmed for that customer
Then clearEntitlementCache(customerId) is called synchronously inside applyAddonEntitlements()
  And the next request reloads entitlements from QZPay (including the new addon grant)
```

**Scenario 2f - Multiple limit sources (plan only vs plan + addon)**

```
Given plan "owner-basico" defines:
    MAX_ACCOMMODATIONS=1, MAX_PHOTOS_PER_ACCOMMODATION=5, MAX_ACTIVE_PROMOTIONS=0
  And billing.limits.getByCustomerId() returns:
    [{ limitKey: "max_photos_per_accommodation", maxValue: 25, source: "addon" }]
  (No customer-level override for MAX_ACCOMMODATIONS or MAX_ACTIVE_PROMOTIONS)
When the entitlement middleware loads limits
Then resolved limits are:
    { MAX_ACCOMMODATIONS: 1 (plan), MAX_PHOTOS_PER_ACCOMMODATION: 25 (customer override), MAX_ACTIVE_PROMOTIONS: 0 (plan) }
```

**Scenario 2g - Plan change while addon is active (known limitation, accepted behavior)**

```
Given a customer has plan "owner-basico" with base MAX_PHOTOS_PER_ACCOMMODATION=5
  And the customer has an active "extra-photos-20" addon
  And billing_customer_limits has maxValue=25 (computed as 5 + 20)
When the customer upgrades to plan "owner-pro" with base MAX_PHOTOS_PER_ACCOMMODATION=15
Then the entitlement middleware loads:
    plan-level MAX_PHOTOS_PER_ACCOMMODATION=15 (from new plan)
    customer-level MAX_PHOTOS_PER_ACCOMMODATION=25 (from addon, unchanged)
  And the resolved limit is 25 (customer-level overrides plan-level)
  And this is ACCEPTED behavior for v1, even though ideally it should be 35 (15 + 20)
  And the addon row is NOT recalculated on plan change (deferred to future enhancement)
  And the customer still has a net benefit (25 > 15)
  And a future enhancement could recalculate addon limit rows on plan changes
```

---

### Story 3 - Addon cancellation removes only the customer's grant

As a customer who cancels or whose addon expires,
I want my addon entitlements to be removed from my account only,
so that other customers on the same plan are not affected by my cancellation.

#### Acceptance Criteria

**Scenario 3a - Explicit addon cancellation (entitlement)**

```
Given Alice purchased "visibility-boost-7d" and has:
    - billing_customer_entitlements row: (entitlementKey="featured_listing", source="addon", sourceId=purchaseId)
    - billing_addon_purchases row: (status="active", addonSlug="visibility-boost-7d")
  And Bob is on the same plan and does NOT have a customer entitlement row
When the cancel route calls removeAddonEntitlements({customerId, addonSlug, purchaseId})
Then billing.entitlements.revokeBySource("addon", purchaseId) is called
  And if revokeBySource returns 0 rows (pre-migration data with null sourceId):
    FALLBACK: billing.entitlements.revoke(Alice.customerId, "featured_listing") is called
  And clearEntitlementCache(Alice.customerId) is called
  And removeAddonEntitlements does NOT update billing_addon_purchases status (caller owns that)
  And Alice's resolved entitlements no longer include "featured_listing"
  And Bob's resolved entitlements are unchanged
  And the billing_plans row is NOT modified
```

**Scenario 3b - Limit restoration on cancellation**

```
Given Alice purchased "extra-photos-20" and has:
    - billing_customer_limits row: (limitKey="max_photos_per_accommodation", maxValue=25, source="addon", sourceId=purchaseId)
    - billing_addon_purchases row: (status="active", addonSlug="extra-photos-20")
  And the base plan limit for MAX_PHOTOS_PER_ACCOMMODATION is 5
When removeAddonEntitlements is called for Alice and "extra-photos-20"
Then billing.limits.removeBySource("addon", purchaseId) is called
  And if removeBySource returns 0 rows (pre-migration data with null sourceId):
    FALLBACK: billing.limits.remove(Alice.customerId, "max_photos_per_accommodation") is called
  And the billing_customer_limits row for Alice is deleted
  And Alice's effective MAX_PHOTOS_PER_ACCOMMODATION reverts to 5 (from plan)
  And clearEntitlementCache(Alice.customerId) is called
  And the billing_plans row is NOT modified
```

**Scenario 3c - Cancelling an addon the customer does not have (idempotent)**

```
Given a customer has no row in billing_customer_entitlements for "featured_listing"
  And has no active row in billing_addon_purchases for "visibility-boost-7d"
When removeAddonEntitlements is called for that customer and "visibility-boost-7d"
Then billing.entitlements.revokeBySource() returns 0, fallback revoke() is idempotent (no error)
  And billing.limits.removeBySource() returns 0, fallback remove() is idempotent (no error, per Q4 fix)
  And the operation returns { success: true }
  And no billing_plans rows are modified
```

**Scenario 3d - removeAddonEntitlements does NOT update purchase status**

```
Given removeAddonEntitlements is called (from cancel route or expiration cron)
Then it ONLY revokes entitlements/limits from QZPay tables
  And it does NOT update billing_addon_purchases status
  And the CALLER is responsible for setting status to 'cancelled' or 'expired'
  (This fixes the current Bug #6 where status was set to 'cancelled' then 'expired')
```

---

### Story 4 - Addon expiry is processed automatically

As the platform operator,
I want expired addon purchases to be cleaned up automatically,
so that customers do not retain entitlements or limit boosts beyond their paid period.

#### Acceptance Criteria

**Scenario 4a - Cron detects and processes expired addons**

```
Given a row in billing_addon_purchases has status="active" and expiresAt < now()
  And the addon-expiry cron job runs (daily at 5:00 UTC via apps/api/src/cron/jobs/addon-expiry.job.ts)
  And the cron job creates AddonExpirationService with the billing instance (getQZPayBilling())
When AddonExpirationService.processExpiredAddons() is called
Then AddonExpirationService.findExpiredAddons() returns the expired row
  And AddonExpirationService.expireAddon({ purchaseId }) is called
  And this internally calls AddonEntitlementService.removeAddonEntitlements() (which now uses QZPay customer-level APIs)
  And removeAddonEntitlements only revokes entitlements/limits (does NOT update purchase status)
  And expireAddon sets billing_addon_purchases status='expired'
  And clearEntitlementCache(customerId) is called (inside removeAddonEntitlements)
```

**Scenario 4b - Already-expired rows are not reprocessed**

```
Given a row in billing_addon_purchases has status="expired"
When AddonExpirationService.findExpiredAddons() queries the database
Then that row is NOT included (the query filters on status="active")
```

**Scenario 4c - Recurring addons without durationDays**

```
Given a recurring addon (e.g., "extra-photos-20") has durationDays=null
  And the billing_addon_purchases row has expiresAt=null
When AddonExpirationService.findExpiredAddons() runs
Then the row is NOT included (the query requires expiresAt IS NOT NULL and expiresAt <= now())
  (Recurring addons persist until explicitly cancelled by the customer or subscription cancellation)
```

---

### Story 5 - Migration of existing active addon purchases

As a platform operator performing the upgrade deployment,
I want existing active addon purchases to be reflected in billing_customer_entitlements and billing_customer_limits,
so that customers who purchased addons before this fix do not lose access to features they paid for.

#### Acceptance Criteria

**Scenario 5a - Active addon purchase with entitlement adjustment**

```
Given a row in billing_addon_purchases with:
    status="active", addonSlug="visibility-boost-7d",
    entitlementAdjustments=[{entitlementKey:"featured_listing", granted:true}],
    expiresAt=2026-03-15
  And no corresponding row exists in billing_customer_entitlements for that customer and entitlementKey
When the migration script runs
Then billing.entitlements.grant() is called with:
    { customerId, entitlementKey: "featured_listing",
      source: "addon", sourceId: purchaseId, expiresAt: 2026-03-15 }
  And a row is inserted into billing_customer_entitlements
```

**Scenario 5b - Active addon purchase with limit adjustment**

```
Given a row in billing_addon_purchases with:
    status="active", addonSlug="extra-photos-20",
    limitAdjustments=[{limitKey:"max_photos_per_accommodation", increase:20, previousValue:5, newValue:25}]
  And the base plan limit is determined from CANONICAL config (plans.config.ts), NOT from billing_plans table
  And the canonical base plan limit is 5
  And no corresponding row exists in billing_customer_limits for that customer and limitKey with source="addon"
When the migration script runs
Then billing.limits.set() is called with:
    { customerId, limitKey: "max_photos_per_accommodation", maxValue: 25,
      source: "addon", sourceId: purchaseId }
  And a row is upserted into billing_customer_limits
```

**Scenario 5c - Already migrated rows are not duplicated (idempotent)**

```
Given a row in billing_addon_purchases that was already migrated
  (corresponding row already exists in billing_customer_entitlements with same customerId + entitlementKey)
When the migration script runs again
Then QZPay's grant() upsert detects the existing row and no duplicate is created
  And the migration logs "already migrated, skipping"
```

**Scenario 5d - Global plan rollback**

```
Given the global billing_plans rows have been mutated by previous addon purchases
When the migration script runs
Then for each plan slug in ALL_PLANS (from packages/billing/src/config/plans.config.ts):
    The billing_plans row is found by matching slug (NOT by UUID)
    The billing_plans row's entitlements array is reset to the canonical value from the PlanDefinition
    The billing_plans row's limits object is reset to the canonical values from the PlanDefinition
  And the canonical source of truth contains 9 plans:
    OWNER_BASICO_PLAN, OWNER_PRO_PLAN, OWNER_PREMIUM_PLAN,
    COMPLEX_BASICO_PLAN, COMPLEX_PRO_PLAN, COMPLEX_PREMIUM_PLAN,
    TOURIST_FREE_PLAN, TOURIST_PLUS_PLAN, TOURIST_VIP_PLAN
```

**Scenario 5e - Dry-run mode**

```
When the migration script runs with --dry-run flag
Then all changes are logged but NOT written to the database
  And the output shows:
    - How many billing_customer_entitlements rows would be inserted
    - How many billing_customer_limits rows would be upserted
    - How many billing_plans rows would be restored to canonical values
```

**Scenario 5f - Orphaned purchases (grant failed previously)**

```
Given a row in billing_addon_purchases with status="active"
  But NO corresponding row in billing_customer_entitlements or billing_customer_limits
  (This can happen if the grant() call failed after the purchase was recorded)
When the migration script runs
Then the missing entitlement/limit row is created via grant()/set()
  And the purchase is effectively "repaired"
```

---

### ~~Story 6 - Addon route error handling uses HTTPException (from SPEC-037 GAP-037-06/25)~~ ALREADY RESOLVED

> **Verified 2026-03-09**: Both GAP-037-06 (addons.ts) and GAP-037-25 were already fixed:
> - `addons.ts` has 16 `throw new HTTPException(...)` with correct status codes (400, 404, 422, 500). Zero `throw new Error()`.
> - Addon cancel (lines 292-308) already uses an atomic direct query with `and(eq(id), eq(customerId), eq(status, 'active'))`.
> - **No work needed.** Removed from scope (was H9, H10, T6, T7).

---

## UX Considerations

### Immediate Entitlement Visibility

After an addon purchase is confirmed via webhook, the customer should see the new feature available on their next page load. The entitlement cache must be invalidated synchronously as part of the `applyAddonEntitlements()` flow (already implemented via `clearEntitlementCache(customerId)` at line 267). The 5-minute cache TTL does not delay access to a just-purchased feature because the cache is explicitly invalidated.

### Error States During Addon Purchase

If QZPay is unavailable when `billing.entitlements.grant()` is called, the `billing_addon_purchases` row has already been inserted by `addon.checkout.ts` (line 426, inside a transaction). The QZPay grant failure is logged by `applyAddonEntitlements()` with `Sentry.captureException()` and the method returns `{ success: false, error: { code: "ENTITLEMENT_GRANT_FAILED" } }`. The `addon.checkout.ts` treats this as non-fatal (warning log at line 461).

The `billing_addon_purchases` row with status="active" serves as the source of truth for retry. Orphaned purchases (active purchase with no corresponding entitlement/limit row) are repaired by the migration script (Story 5, Scenario 5f) or a future reconciliation cron.

**Manual workaround for orphaned purchases**: Until the reconciliation cron is built, an admin can manually trigger `applyAddonEntitlements()` for a specific customer from the admin panel or via a one-off script.

### Admin Visibility

Platform operators reviewing a customer's billing status can distinguish base-plan entitlements from addon grants using the `source` and `sourceId` columns in `billing_customer_entitlements` and `billing_customer_limits`:
- `source='subscription'` = came from the plan
- `source='addon'` = came from an addon purchase
- `sourceId` = the `billing_addon_purchases.id` UUID

### Cache Invalidation Scope

Cache invalidation targets only the affected customer via `clearEntitlementCache(customerId)`. The in-memory FIFO cache (1000 entries max, 5-min TTL) is not flushed globally. Note: the cache uses FIFO eviction (removes the oldest Map entry when full), not true LRU. This is acceptable for the current use case.

### Limit Merge Semantics (Critical Design Decision)

**At write time (applyAddonEntitlements):**
- Read the base plan limit from the **CANONICAL config** (`ALL_PLANS` in `plans.config.ts`), NOT from the `billing_plans` table (which may be mutated by previous addon purchases)
- Compute the absolute new ceiling: `canonicalBasePlanLimit + addon.limitIncrease`
- Example: Canonical plan has `MAX_PHOTOS_PER_ACCOMMODATION=5`, addon has `limitIncrease=20`, store `maxValue=25`
- Call `billing.limits.set({customerId, limitKey, maxValue: 25, source: 'addon', sourceId: purchaseId})`
- QZPay's `set()` does upsert

**Why read from canonical config instead of billing_plans table:**
- The `billing_plans` table may have been mutated by Bug #1 (global plan mutation)
- Between deploy (new code) and migration (plan restoration), the table values are unreliable
- The canonical config in `plans.config.ts` is always correct
- The plan slug is determined by: customer's subscription -> planId -> billing.plans.get() -> plan.slug -> match against ALL_PLANS

**Reference implementation for canonical plan limit lookup:**
```ts
import { ALL_PLANS } from '@repo/billing';

// Inside applyAddonEntitlements():
const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
const activeSubscription = subscriptions.find(s => s.status === 'active' || s.status === 'trialing');
const plan = await billing.plans.get(activeSubscription.planId);
const canonicalPlan = ALL_PLANS.find(p => p.slug === plan.slug);
if (!canonicalPlan) {
    return { success: false, error: { code: 'PLAN_NOT_FOUND', message: `Plan ${plan.slug} not found in canonical config` } };
}
// For limit addons:
const basePlanLimit = canonicalPlan.limits.find(l => l.key === addon.affectsLimitKey)?.value ?? 0;

// IMPORTANT: Handle unlimited (-1) base plan limits
if (basePlanLimit === -1) {
    // Plan already grants unlimited for this key. Addon is a no-op for limits.
    // Still grant entitlements if applicable, and still record the purchase.
    // Log a warning for visibility.
    apiLogger.warn({ planSlug: plan.slug, limitKey: addon.affectsLimitKey },
        'Addon limit increase skipped: base plan already unlimited (-1)');
    // Skip the billing.limits.set() call for this addon
} else {
    const newMaxValue = basePlanLimit + addon.limitIncrease;
    await billing.limits.set({
        customerId, limitKey: addon.affectsLimitKey, maxValue: newMaxValue,
        source: 'addon', sourceId: purchaseId
    });
}
```

**Handling `-1` (unlimited) limits:**
Some plans define limits as `-1` (unlimited), e.g., `owner-premium` has `MAX_ACTIVE_PROMOTIONS=-1` and `complex-premium` has `MAX_PROPERTIES=-1`. If the canonical base plan limit is `-1`:
- The addon's limit increase is a **no-op** (the plan already grants unlimited)
- Do NOT call `billing.limits.set()` for that limitKey
- Do NOT store a customer-level limit row (the plan-level unlimited is sufficient)
- Log a warning for admin visibility
- This prevents the nonsensical state of `-1 + 20 = 19` (which would actually REDUCE the limit from unlimited to 19)

**Plans with unlimited (-1) limits** (from verified audit of `plans.config.ts`):
- `owner-premium`: `MAX_ACTIVE_PROMOTIONS=-1`
- `complex-premium`: `MAX_PROPERTIES=-1`, `MAX_STAFF_ACCOUNTS=-1`, `MAX_ACTIVE_PROMOTIONS=-1`
- `tourist-vip`: `MAX_FAVORITES=-1`

The unlimited check (`basePlanLimit === -1`) must apply to ANY limitKey, not just the 3 currently affected by addons. Future addons may target `MAX_STAFF_ACCOUNTS`, `MAX_FAVORITES`, or `MAX_ACTIVE_PROMOTIONS`.

**`PlanDefinition` limit structure** (from `plans.config.ts`):
```ts
// Each plan has a limits array:
limits: [
    { key: 'max_accommodations', value: 1, name: 'Max Accommodations', description: '...' },
    { key: 'max_photos_per_accommodation', value: 5, name: 'Max Photos', description: '...' },
    { key: 'max_active_promotions', value: 0, name: 'Max Promotions', description: '...' },
]
```

**Important: `plan.limits` data structure difference between QZPay and canonical config:**
- **QZPay plan** (`billing.plans.get()`): `plan.limits` is `Record<string, number>` (e.g., `{ "max_photos_per_accommodation": 5 }`). Used with `Object.entries()` in the middleware.
- **Canonical config** (`ALL_PLANS` from `plans.config.ts`): `PlanDefinition.limits` is `LimitDefinition[]` (e.g., `[{ key: "max_photos_per_accommodation", value: 5, name: "...", description: "..." }]`). Used with `.find(l => l.key === ...)?.value` in `applyAddonEntitlements()` and the migration.
- These are different structures. The middleware uses the QZPay format; the service and migration use the canonical config format. Do not confuse them.

**At read time (loadEntitlements middleware):**
- Load base plan limits from `plan.limits` (from the DB / QZPay `Record<string, number>` format, which is correct after migration)
- Load customer-level limits from `billing.limits.getByCustomerId(customerId)`
- For each limit key: if a customer-level row exists, use its `maxValue` (override). Otherwise, use the plan-level value.
- Entitlements are additive: resolved set = union of plan entitlements + active non-expired customer entitlement rows.

**At remove time (removeAddonEntitlements):**
- Call `billing.limits.removeBySource('addon', purchaseId)` to delete the customer-level row
- Fallback: if 0 rows affected (pre-migration data), call `billing.limits.remove(customerId, limitKey)`
- The customer automatically reverts to the plan-level limit on the next cache refresh

**Known limitation:** If a plan's base limit is changed after an addon was applied (e.g., plan upgrades `MAX_PHOTOS_PER_ACCOMMODATION` from 5 to 10), the customer's addon row still has `maxValue=25` (computed from old base of 5). This is acceptable for v1 because:
- Plan limit changes are rare admin operations
- The addon still provides a net benefit (25 > 10)
- A future enhancement could recalculate addon limit rows on plan changes

### Subscription Metadata Backward Compatibility

The current code stores addon adjustments in `subscription.metadata.addonAdjustments` (JSON string). This mechanism will be **preserved but marked as deprecated**:
- `applyAddonEntitlements()` will continue to write to `subscription.metadata.addonAdjustments` for backward compatibility
- `removeAddonEntitlements()` will continue to clean up `subscription.metadata.addonAdjustments`
- `getCustomerAddonAdjustments()` will continue to merge from both sources (table + metadata)
- The primary source of truth shifts to `billing_customer_entitlements` + `billing_customer_limits`
- A future task can remove the metadata writing once all clients have migrated

**`AddonAdjustment` structure** (from `packages/db/src/billing/migrate-addon-purchases.ts`):
```ts
interface AddonAdjustment {
    addonSlug: string;
    entitlement?: string;    // e.g., "featured_listing"
    limitKey?: string;       // e.g., "max_photos_per_accommodation"
    limitIncrease?: number;  // e.g., 20
    appliedAt: string;       // ISO date string
}
```

The `addonAdjustments` array is stored as a JSON-serialized string inside `subscription.metadata`. Example:
```json
{
  "addonAdjustments": "[{\"addonSlug\":\"extra-photos-20\",\"limitKey\":\"max_photos_per_accommodation\",\"limitIncrease\":20,\"appliedAt\":\"2026-03-01T00:00:00.000Z\"}]"
}
```

### Transaction Safety

The fixed flow has this structure:
1. `addon.checkout.ts`: INSERT `billing_addon_purchases` row (inside DB transaction - already exists)
2. `applyAddonEntitlements()`: Call `billing.entitlements.grant()` or `billing.limits.set()` (QZPay)
3. `applyAddonEntitlements()`: Update `subscription.metadata` (QZPay) - deprecated
4. `applyAddonEntitlements()`: Clear cache

If step 2 fails after step 1 succeeds, the `billing_addon_purchases` row persists as an "orphaned purchase". This is acceptable because:
- The purchase record is preserved as source of truth
- The migration script repairs orphaned purchases (Scenario 5f)
- Wrapping cross-service calls in a single DB transaction is not feasible (QZPay may use a different connection)
- `addon.checkout.ts` already handles the failure gracefully (warning log, non-fatal)

### Transition Window Safety

Between deploying the new code and running the migration, there is a transition window:

1. **New addon purchases**: Use the fixed flow (per-customer grants). Correct from the start.
2. **Existing addon purchases**: Still have global plan mutations but no per-customer rows. The migration fixes this.
3. **Base plan limit reads**: The fixed code reads from canonical config, so it's correct even before migration.
4. **Entitlement loading**: The middleware adds customer-level merging. Before migration, `getByCustomerId()` returns empty, so only plan-level values are used (same as current behavior).

No data loss or incorrect behavior during the transition window.

---

## Scope

### In Scope

#### QZPay Package (prerequisite, separate repo)

1. Extend `source` type to include `'addon'` (Change Q1)
2. Fix `grant()` across all 3 layers: service JS (stop ignoring source/sourceId) + `.d.ts` types + `sourceId` mapper bug (Change Q2)
3. Fix `set()` across all 3 layers: service JS (add source/sourceId passthrough) + `.d.ts` types + `sourceId` mapper bug (Change Q3)
4. Add `QZPayLimitService.remove()` method, idempotent (Change Q4)
5. Add verification test for expired entitlement filtering (Change Q5 - already implemented)
6. Add verification test for `revoke()` idempotency (Change Q6 - already implemented)
7. Expose `revokeBySource` and `removeBySource` in service interfaces (Change Q7)
8. Fix remaining `.d.ts` type declarations (Change Q8)
9. Version bump to 1.2.0 (Change Q9)
10. Tests for all new/modified methods (Change Q10)
11. Update Drizzle adapter implementations for all above changes

#### Hospeda API (`apps/api/`)

1. **Rewrite `AddonEntitlementService.applyAddonEntitlements()`** in `apps/api/src/services/addon-entitlement.service.ts`:
   - **Change input signature** from `{ customerId, addonSlug, paymentId? }` to `{ customerId, addonSlug, purchaseId }`. The `paymentId` field is no longer needed here (checkout owns the purchase record). The `purchaseId` is the UUID of the `billing_addon_purchases` row inserted by `addon.checkout.ts`. **Naming clarification:** `paymentId` (the MercadoPago payment reference, stored in `billing_addon_purchases.paymentId` varchar column) is NOT the same as `purchaseId` (the `billing_addon_purchases.id` UUID primary key). The old `paymentId` param is removed; the new `purchaseId` param carries the table row's UUID.
   - **Remove** the INSERT into `billing_addon_purchases` (lines 205-239). The checkout service owns this.
   - **Remove misleading comment** at line 242: `"Note: This modifies the plan for the subscription, not globally"` .. this is false, it modifies the global plan row.
   - Call `billing.entitlements.grant()` for entitlement addons (with input: source, sourceId, expiresAt)
   - Call `billing.limits.set()` for limit addons (with input: source, sourceId) computing `canonicalBasePlanLimit + addon.limitIncrease`
   - Read base plan limit from canonical config (`ALL_PLANS` -> match plan slug -> read limits), NOT from `billing_plans` table
   - **Handle unlimited (-1) limits**: If `basePlanLimit === -1`, skip `billing.limits.set()` for that key (addon is a no-op, plan already grants unlimited). Log a warning.
   - Remove all calls to `billing.plans.update()`
   - Remove both `@ts-expect-error` comments (lines 243, 469)
   - Maintain subscription metadata writing (backward compat, deprecated)
   - Add idempotency: QZPay's `grant()` and `set()` are naturally idempotent (upsert)

2. **Rewrite `AddonEntitlementService.removeAddonEntitlements()`**:
   - Add `purchaseId` to the input signature
   - Call `billing.entitlements.revokeBySource('addon', purchaseId)` for entitlement addons
     - Fallback: if 0 rows, call `billing.entitlements.revoke(customerId, entitlementKey)`
   - Call `billing.limits.removeBySource('addon', purchaseId)` for limit addons
     - Fallback: if 0 rows, call `billing.limits.remove(customerId, limitKey)`
   - **Remove** the UPDATE to `billing_addon_purchases` status (lines 380-428). The caller owns this.
   - Remove all calls to `billing.plans.update()`
   - Remove all `@ts-expect-error` comments
   - Maintain subscription metadata cleanup (backward compat, deprecated)
   - Call `clearEntitlementCache(customerId)`

3. **Update `addon.checkout.ts:confirmAddonPurchase()`**:
   - The INSERT at line 426 currently does NOT capture the returned row ID. Add `.returning({ id: billingAddonPurchases.id })` to the insert query:
     ```ts
     // CURRENT (line 426):
     await tx.insert(billingAddonPurchases).values({...});
     // FIXED:
     const [insertedPurchase] = await tx.insert(billingAddonPurchases).values({...}).returning({ id: billingAddonPurchases.id });
     ```
   - **Handle unique constraint violation** from the partial index (H8). After the new unique partial index is deployed, a duplicate INSERT for the same `(customer_id, addon_slug)` with `status='active'` will throw a unique constraint error. Handle this gracefully:
     ```ts
     try {
         const [insertedPurchase] = await tx.insert(billingAddonPurchases).values({...}).returning({ id: billingAddonPurchases.id });
         // ... proceed with applyAddonEntitlements
     } catch (error) {
         // Check for unique constraint violation (Postgres error code 23505)
         if (error instanceof Error && error.message.includes('unique') || (error as { code?: string }).code === '23505') {
             // Addon already active for this customer - idempotent success
             throw new HTTPException(409, { message: 'Addon already active for this customer' });
         }
         throw error; // Re-throw other errors
     }
     ```
   - Pass `insertedPurchase.id` as `purchaseId` to `applyAddonEntitlements()` at line 455:
     ```ts
     // CURRENT (line 455):
     const result = await entitlementService.applyAddonEntitlements({ customerId, addonSlug });
     // FIXED:
     const result = await entitlementService.applyAddonEntitlements({ customerId, addonSlug, purchaseId: insertedPurchase.id });
     ```

4. **Rewrite `loadEntitlements()` in `apps/api/src/middlewares/entitlement.ts`**:
   - After loading plan entitlements and limits (existing logic, unchanged), also call:
     - `billing.entitlements.getByCustomerId(customerId)` - returns `QZPayCustomerEntitlement[]` where each has `{ customerId, entitlementKey, grantedAt, expiresAt, source, sourceId }`. Already filters expired rows (verified in QZPay v1.1.0).
     - `billing.limits.getByCustomerId(customerId)` - returns `QZPayCustomerLimit[]` where each has `{ customerId, limitKey, maxValue, currentValue, resetAt, source, sourceId }`.
   - Union customer entitlement keys with plan entitlement keys into the `Set<EntitlementKey>`
   - For limits: start with plan limits in the `Map<LimitKey, number>`, then override with any customer-level limit values
   - **Reference merge implementation** (insert after the existing plan limit loading at line 182):
     ```ts
     // --- NEW: Merge customer-level entitlements (from addons) ---
     const customerEntitlements = await billing.entitlements.getByCustomerId(customerId);
     for (const ce of customerEntitlements) {
         entitlements.add(ce.entitlementKey as EntitlementKey);
     }

     // --- NEW: Override limits with customer-level values (from addons) ---
     const customerLimits = await billing.limits.getByCustomerId(customerId);
     for (const cl of customerLimits) {
         limits.set(cl.limitKey as LimitKey, cl.maxValue);
     }
     ```
   - **Error handling**: Wrap the new QZPay calls in try-catch. If either call fails:
     - Log with `apiLogger.warn()` (not error.. the request can still proceed with plan-only data)
     - Report to Sentry via `Sentry.captureException(error)`
     - Fall back to plan-only values (graceful degradation)
     - **CRITICAL: Do NOT cache the degraded (plan-only) result.** Return the plan-only values but skip caching so the next request retries the QZPay calls. This prevents a 5-minute window where all requests for that customer get degraded results.
     - Reference implementation:
       ```ts
       let customerEntitlements: QZPayCustomerEntitlement[] = [];
       let customerLimits: QZPayCustomerLimit[] = [];
       let shouldCache = true;
       try {
           customerEntitlements = await billing.entitlements.getByCustomerId(customerId);
           customerLimits = await billing.limits.getByCustomerId(customerId);
       } catch (error) {
           apiLogger.warn({ error, customerId }, 'Failed to load customer-level entitlements, using plan-only');
           Sentry.captureException(error);
           shouldCache = false; // Don't cache degraded result
       }
       // ... merge logic ...
       if (shouldCache) {
           entitlementCache.set(customerId, { entitlements, limits, timestamp: Date.now() });
       }
       ```

5. **Fix cron job billing instance bug** in `apps/api/src/cron/jobs/addon-expiry.job.ts`:
   - Change line 122 from `new AddonExpirationService()` to `new AddonExpirationService(getQZPayBilling())`
   - **Note**: `getQZPayBilling` is already imported in the cron file (line 20) and used for notifications (lines 205, 316), so no new import needed.
   - **IMPORTANT**: `getQZPayBilling()` (defined in `apps/api/src/middlewares/billing.ts:200-202`) returns `QZPayBilling | null`. Add a null guard before instantiation:
     ```ts
     const billing = getQZPayBilling();
     if (!billing) {
         apiLogger.error('Billing instance not available, skipping addon expiry processing');
         return;
     }
     const addonExpirationService = new AddonExpirationService(billing);
     ```

6. **Update `AddonExpirationService.expireAddon()`** in `apps/api/src/services/addon-expiration.service.ts`:
   - Update `removeAddonEntitlements()` call (line 393) to pass `purchaseId`. The `purchaseId` is already available in scope as `purchase.id` (from the DB query at lines 355-370 that loads the purchase row by `input.purchaseId`):
     ```ts
     // CURRENT (line 393-396):
     const removeResult = await this.entitlementService.removeAddonEntitlements({
         customerId: purchase.customerId,
         addonSlug: purchase.addonSlug
     });
     // FIXED:
     const removeResult = await this.entitlementService.removeAddonEntitlements({
         customerId: purchase.customerId,
         addonSlug: purchase.addonSlug,
         purchaseId: purchase.id
     });
     ```
   - Since `removeAddonEntitlements()` no longer updates purchase status, the existing status update at line 420-426 handles it correctly

7. **Update addon cancel route** in `apps/api/src/routes/billing/addons.ts`:
   - The cancel route (lines ~292-343) already performs an atomic ownership query that returns `{ id: billingAddonPurchases.id }`. This `id` is the `purchaseId`.
   - When the cancel route calls `removeAddonEntitlements()`, it must pass `purchaseId` alongside `customerId` and `addonSlug`:
     ```ts
     // After the atomic ownership query returns ownedAddon:
     const removeResult = await entitlementService.removeAddonEntitlements({
         customerId: billingCustomerId,
         addonSlug: ownedAddon.addonSlug,  // may need to be fetched or passed
         purchaseId: ownedAddon.id
     });
     ```
   - **Note**: Verify whether the cancel route currently calls `removeAddonEntitlements()` directly or through another service. If it goes through `AddonExpirationService.cancelAddon()` or similar, update that method's signature too.

8. **Add unique partial index** on `billing_addon_purchases`:
   - `CREATE UNIQUE INDEX idx_addon_purchases_active_unique ON billing_addon_purchases(customer_id, addon_slug) WHERE status = 'active'`
   - This table is owned by Hospeda (defined in `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`), NOT by QZPay
   - Add the index to the Drizzle schema file and generate the migration with `pnpm db:generate`
   - **Drizzle ORM syntax** for the partial unique index (add to `billing_addon_purchase.dbschema.ts` in the indexes section):
     ```ts
     addonPurchasesActiveUnique: uniqueIndex('idx_addon_purchases_active_unique')
         .on(table.customerId, table.addonSlug)
         .where(sql`status = 'active'`)
     ```
   - Existing indexes (from migration `0019_quick_rocket_raccoon.sql`) already include `addonPurchases_customer_addon_idx (customer_id, addon_slug)` but WITHOUT the partial unique constraint
   - **Note**: There is also an existing partial NON-unique index `addonPurchases_active_customer_idx` on `(customer_id)` WHERE `status = 'active'` (line 65-67 of schema file). This is a DIFFERENT index (single column, not unique). The new H8 index is on `(customer_id, addon_slug)` and IS unique. Both indexes can coexist.

~~9. **Replace `throw new Error()` with `HTTPException` in addon routes** (GAP-037-06)~~ **ALREADY RESOLVED**
   - Verified 2026-03-09: `addons.ts` has zero `throw new Error()`. All 16 throws already use `HTTPException` with correct status codes (400, 404, 422, 500).

~~10. **Fix addon cancel atomicity** (GAP-037-25)~~ **ALREADY RESOLVED**
   - Verified 2026-03-09: Cancel route (lines 292-308) already uses an atomic direct query: `db.select().from(billingAddonPurchases).where(and(eq(id), eq(customerId), eq(status, 'active'))).limit(1)`

#### Migration Script

1. Extend `packages/db/src/billing/migrate-addon-purchases.ts` to add three new operations:
   - **(a) Backfill `billing_customer_entitlements`**: For each active `billing_addon_purchases` row with entitlement adjustments, call `billing.entitlements.grant()` with `source='addon'`, `sourceId=purchaseId`, and the correct `expiresAt`.
   - **(b) Backfill `billing_customer_limits`**: For each active `billing_addon_purchases` row with limit adjustments, determine the base plan limit by reading from **canonical config** (`ALL_PLANS` in `plans.config.ts`, match by plan slug). Then call `billing.limits.set()` with `maxValue = canonicalBasePlanLimit + addon.limitIncrease`, `source='addon'`, `sourceId=purchaseId`.
     - **Plan slug lookup flow**: For each `billing_addon_purchases` row: (1) read `subscriptionId` from the row, (2) use `billing.subscriptions.get(subscriptionId)` to get the subscription and its `planId`, (3) use `billing.plans.get(planId)` to get the QZPay plan and its `slug`, (4) find the canonical plan: `ALL_PLANS.find(p => p.slug === plan.slug)`, (5) read the base limit: `canonicalPlan.limits.find(l => l.key === addon.affectsLimitKey)?.value ?? 0`.
     - If the subscription or plan no longer exists (e.g., customer cancelled), log a warning and skip that purchase (the addon entitlement/limit is moot without an active subscription).
   - **(c) Restore `billing_plans` to canonical values**: For each plan slug in `ALL_PLANS`, find the `billing_plans` row by slug (not UUID) and reset its `entitlements` and `limits` to the canonical values from the config.
   - Keep existing metadata-to-table migration logic
   - Must be idempotent (safe to run multiple times - QZPay's `grant()` and `set()` do upsert)
   - Must support `--dry-run` flag (already exists)
   - Must support `--verbose` flag (already exists)
   - **Billing instance initialization**: The migration script runs as a standalone CLI, NOT inside the API server. It must initialize its own QZPay billing instance directly, NOT via `getQZPayBilling()` from `apps/api/src/middlewares/billing.ts` (which depends on API server context). Reference implementation:
     ```ts
     import { createQZPayBilling } from '@qazuor/qzpay-core';
     import { createDrizzleStorageAdapter } from '@qazuor/qzpay-drizzle';
     import { getDb } from '@repo/db/client';

     const db = getDb();
     const storage = createDrizzleStorageAdapter({ db, livemode: true });
     const billing = createQZPayBilling({ storage });
     ```
     **Note:** Verify the exact export names and constructor signatures in the QZPay package before implementing. The `livemode` flag should match the environment (production = `true`, staging = check env var). Add error handling for initialization failure (log error and exit with non-zero code).
   - **Existing script gaps to fix**: The current migration script has incomplete code that must be addressed:
     - Empty error logging loop at line 347: `for (const _error of stats.errors) { }` .. implement error output
     - Empty dry-run summary at line 351 .. implement summary output showing counts
   - **Race condition safety**: If the migration runs concurrently with new addon purchases being processed by the API, no data corruption occurs because QZPay's `grant()` and `set()` are upsert operations (idempotent). The migration may process a purchase that was already handled by the new code, resulting in a no-op upsert.

#### Tests

1. **Rewrite `apps/api/test/services/addon-entitlement.service.test.ts`**:
   - Remove all 12 `@ts-expect-error` lines in mock setup and assertions
   - Update mock billing object to include `entitlements: { grant, revoke, revokeBySource, getByCustomerId, check }` and `limits: { set, remove, removeBySource, getByCustomerId, check, increment, recordUsage }`
   - Replace `mockBilling.plans.update` assertions with `mockBilling.entitlements.grant` and `mockBilling.limits.set` assertions
   - Add test cases for: idempotency, cancellation via revoke/remove, revokeBySource/removeBySource with fallback, error scenarios (grant fails after purchase), canonical config limit read
   - Verify `applyAddonEntitlements()` does NOT insert into `billing_addon_purchases`
   - Verify `removeAddonEntitlements()` does NOT update `billing_addon_purchases` status
2. **Extend existing tests for `loadEntitlements()` in the entitlement middleware** (`apps/api/test/middlewares/entitlement.test.ts` - file already exists with 1,106 lines):
   - Plan-only (no customer-level rows)
   - Plan + addon entitlement (union)
   - Plan + addon limit (override)
   - Expired addon (filtered by QZPay)
   - Multiple limits: some from plan, some overridden
   - Unlimited (-1) base plan limit handling
   - Plan change while addon active (Scenario 2g): customer-level limit overrides new plan limit (accepted known limitation)
   - Error in QZPay calls: graceful degradation to plan-only values
3. **Verify existing `AddonExpirationService` tests still pass**
4. **Extend existing cron job test** (`apps/api/test/cron/addon-expiry.test.ts` - file already exists with 611 lines, already mocks `AddonExpirationService` and `getQZPayBilling`):
   - Add/verify test: cron creates `AddonExpirationService` with billing instance from `getQZPayBilling()` (post-fix, line 122 passes billing)
   - Add test: null guard.. when `getQZPayBilling()` returns null, the cron logs error and returns early without calling `processExpiredAddons()`
   - Verify existing tests still pass after the fix (the mock setup at lines 146, 263, etc. may need adjustment)
5. **Create new migration script tests** (`packages/db/test/billing/migrate-addon-purchases.test.ts` - file does NOT exist yet):
   - Backfill logic, idempotency, dry-run mode, plan restoration, orphaned purchase repair, canonical config usage, unlimited (-1) handling

~~6. **Add tests for HTTPException error codes in addon routes**~~ **ALREADY RESOLVED** - addons.ts already uses HTTPException.
~~7. **Add test for atomic addon cancel ownership check**~~ **ALREADY RESOLVED** - cancel route already uses atomic query.

### Out of Scope

- Changing the MercadoPago payment flow or checkout session creation. Payment processing is unrelated to entitlement storage.
- Changing the data model of `billing_addon_purchases`. This table remains the source of truth for purchase history.
- Adding UI for customers to view their per-customer entitlements vs plan entitlements (future feature).
- Implementing usage metering or tracking current usage against limits (`limit-enforcement.ts` handles this separately).
- Changing how billing plans are created, updated, or priced.
- Multi-instance cache invalidation (distributed cache). The in-memory FIFO cache is acceptable for the current single-instance deployment.
- Removing the `subscription.metadata.addonAdjustments` backward compatibility (deferred to a cleanup task).
- Addon stacking (buying the same addon multiple times to multiply the effect). All addon purchases are idempotent for v1.
- **Cleanup of customer-level addon rows on full subscription cancellation.** When a customer cancels their entire subscription (not just an addon), the `billing_customer_entitlements` and `billing_customer_limits` rows with `source='addon'` persist as orphaned data. This is acceptable because: (1) the entitlement middleware only loads customer-level data when an active subscription exists (lines 147-158 check for active/trialing subscription first.. if no active subscription, returns empty entitlements/limits, so orphaned addon rows are never read), (2) orphaned rows cause no incorrect behavior (they are invisible to the middleware), (3) a future cleanup cron can purge orphaned addon rows for customers without active subscriptions. This is deferred to a separate housekeeping task.
- General billing error handling unrelated to addons (GAP-037-32 ServiceErrorCode casts, GAP-037-16 NODE_ENV, GAP-037-46 configure-open-api). These remain for a formal SPEC-039 (Billing Error Handling & Type Safety).
- Promo-codes HTTPException fixes (GAP-037-51). Not addon-related. Deferred to SPEC-039.
- Non-addon `throw new Error()` in other billing route files: `promo-codes.ts` (7), `billing/metrics.ts` (3), `admin/metrics.ts` (3), `accommodation/public/getStats.ts` (1). Deferred to SPEC-039.
- **Note on SPEC-039 (Billing Error Handling & Type Safety)**: This spec was planned but NEVER formally created. The following SPEC-037 gaps remain open and should be tracked in a future SPEC-039:
  - **GAP-037-06** (MEDIUM): 14 `throw new Error()` in non-addon billing routes: `promo-codes.ts` (7), `billing/metrics.ts` (3), `admin/metrics.ts` (3), `accommodation/public/getStats.ts` (1). The addon-related instances in `addons.ts` are already fixed (16 HTTPException).
  - **GAP-037-16** (LOW): 10 instances of NODE_ENV gating in `apps/api/src/utils/response-helpers.ts`
  - **GAP-037-17** (LOW): Addon purchase transaction atomicity. Addressed here by design (orphaned purchases repaired by migration, Story 5 Scenario 5f).
  - **GAP-037-25** (MEDIUM): Addon cancel atomicity. **Already fixed** (verified 2026-03-09, cancel route uses atomic query).
  - **GAP-037-32** (LOW): 278 `as ServiceErrorCode` casts across billing route files
  - **GAP-037-46** (LOW): `configure-open-api.ts:43` exposes `err.message` without debug guard
  - **GAP-037-51** (LOW): Promo-codes `throw new Error()` (7 instances, subset of GAP-037-06)
  - **GAP-037-03** (MEDIUM): `getApproachingLimits()` filters `error.message` without debug guard
  - **GAP-037-42** (MEDIUM): `billing-metrics.service.ts` (4 catch blocks) expose error messages
  - **GAP-037-43** (MEDIUM): `usage-tracking.service.ts` (3 catch blocks) expose error messages
  - **GAP-037-49** (MEDIUM): `billing-customer-sync.ts` logs email without masking (lines 103, 152, 247)

### Future Considerations

- If Hospeda moves to a multi-instance deployment, the in-memory entitlement cache will need to be replaced with Redis.
- A customer-facing "My Addons" page displaying active addon grants with expiry dates.
- Automatic retry/reconciliation cron for failed entitlement grants (orphaned purchases with status="active" but no corresponding entitlement/limit row).
- Recalculating addon limit rows when a plan's base limit changes.
- Removing the deprecated `subscription.metadata.addonAdjustments` mechanism.
- Addon stacking: allowing customers to buy the same limit addon multiple times to multiply the increase.
- Housekeeping cron to purge orphaned `billing_customer_entitlements` and `billing_customer_limits` rows (with `source='addon'`) for customers who no longer have an active subscription.

---

## Risks

### Risk 1: QZPay changes are a prerequisite and block Hospeda work

The QZPay package changes (Q1-Q10) must be released before Hospeda implementation can begin. If QZPay work is delayed, the entire spec is blocked.

**Mitigation:** QZPay changes are isolated and well-defined. They can be implemented and tested independently. Publish as `@qazuor/qzpay-core@1.2.0` with full backward compatibility (all new parameters are optional, type fixes align with existing implementation).

### Risk 2: Migration alters production plan data

Restoring `billing_plans` rows to canonical values requires certainty about what those values should be. The canonical source is `packages/billing/src/config/plans.config.ts` (`ALL_PLANS` array with 9 plan definitions).

**Mitigation:**
- The migration script reads canonical values from `@repo/billing` (the `ALL_PLANS` array), not from the database.
- A `--dry-run` mode previews all changes before committing.
- The migration should be run in a test environment first.
- The script must match plans by `slug` (not UUID, since UUIDs are generated at seed time).

### Risk 3: Cache invalidation race condition

Between the moment a webhook fires and the cache is invalidated, another request for the same customer might cache the old (pre-addon) entitlement set.

**Mitigation:** The cache is invalidated synchronously within `applyAddonEntitlements()` immediately after the entitlement grant is written. The race window is bounded by the webhook processing time (~100ms), not the 5-minute TTL.

### Risk 4: Concurrent addon grants for the same customer

If a customer triggers two concurrent addon purchase confirmations for the same addon slug (e.g., double-click on payment, duplicate webhook), two rows may be inserted.

**Mitigation:**
- The unique partial index on `billing_addon_purchases(customer_id, addon_slug) WHERE status = 'active'` prevents duplicate active purchases at the database level.
- `addon.checkout.ts` should handle the unique constraint violation gracefully (catch and return success).
- QZPay's `grant()` and `set()` are idempotent (upsert), so even if called twice, no harm.

### Risk 5: `LimitStorage.delete()` throws on missing row

The Drizzle adapter's `delete()` method for limits (qzpay-drizzle line 3506-3511) throws `Error('Customer limit not found...')` if no row matches. This will cause issues when `removeAddonEntitlements()` tries to remove a limit that doesn't exist.

**Mitigation:** Change Q4 makes `delete()` idempotent (remove the throw), consistent with how `EntitlementStorage.revoke()` already works.

### Risk 6: `sourceId` null in pre-migration data

Addon purchases made before the fix will have `sourceId=null` in `billing_customer_entitlements` and `billing_customer_limits` (because of Bug #4). The migration backfills these with correct sourceIds, but there's a window between deploy and migration where `revokeBySource('addon', purchaseId)` returns 0 rows.

**Mitigation:** `removeAddonEntitlements()` uses a fallback strategy:
1. First try `revokeBySource('addon', purchaseId)` / `removeBySource('addon', purchaseId)`
2. If 0 rows affected, fall back to `revoke(customerId, entitlementKey)` / `remove(customerId, limitKey)`
This handles both pre-migration (null sourceId) and post-migration (correct sourceId) data.

### Risk 7: Double INSERT during transition

Between deploying the new `applyAddonEntitlements()` (which no longer inserts) and deploying the updated `addon.checkout.ts` (which passes purchaseId), there could be a brief inconsistency. However, since both changes are deployed atomically (same commit/build), this risk is negligible.

### Risk 8: Migration script requires its own QZPay billing instance

The migration script runs as a standalone CLI process (via `pnpm tsx`), not inside the API server. The new migration operations (backfill entitlements/limits) require calling QZPay APIs (`billing.entitlements.grant()`, `billing.limits.set()`), which need a properly initialized `QZPayBilling` instance. The API server's `getQZPayBilling()` is not available outside the server context.

**Mitigation:** The migration script must initialize its own billing instance directly, similar to how the seed scripts do. Import `createQZPayBilling()` from `@qazuor/qzpay-core`, configure with the database connection string from environment variables, and initialize before running the migration. Add error handling for the case where QZPay initialization fails (log error and exit with non-zero code).

### Risk 9: Unique partial index applied before new code deployed

If the DB migration for H8 (unique partial index on `billing_addon_purchases(customer_id, addon_slug) WHERE status='active'`) is applied while the OLD code is still running, the old code's double INSERT (Bug #2) will hit unique constraint violations and fail addon purchases.

**Mitigation:** The deployment checklist explicitly requires deploying the API code (Phase 2) BEFORE applying the H8 migration. See "Deployment Checklist" section.

---

## Rollback Strategy

If issues are discovered after deployment, the changes can be rolled back safely:

1. **Code rollback (revert Phase 2)**: Safe. The old code reads entitlements from the plan only (ignores customer-level tables). Any rows added to `billing_customer_entitlements` / `billing_customer_limits` by the new code become orphaned but cause no harm. The old code continues to mutate global plans (Bug #1 returns), but no data loss occurs.

2. **Migration rollback (revert Phase 3)**: Safe. The migration only ADDS rows to customer-level tables and RESTORES plan rows to canonical values. To undo:
   - Customer-level rows can be deleted by source: `DELETE FROM billing_customer_entitlements WHERE source = 'addon'` and `DELETE FROM billing_customer_limits WHERE source = 'addon'`.
   - Plan restoration cannot be "undone" per se, but the canonical values are correct by definition. If the old code is running, it will re-mutate plans on the next addon purchase (Bug #1 again).

3. **H8 unique index rollback**: The partial unique index can be dropped with `DROP INDEX idx_addon_purchases_active_unique`. This is safe and instant.

4. **QZPay version rollback (revert to 1.1.0)**: Safe but requires code rollback too, since the Hospeda code depends on the new QZPay APIs (`revokeBySource`, `removeBySource`, `remove`, object-based `grant`/`set`).

**Key insight**: The deployment is designed to be additive.. new code reads from new tables (empty before migration) and falls back to plan-only behavior. This means partial deployment states are safe.

---

## Dependencies

| Dependency | Direction | Description |
|-----------|-----------|-------------|
| `@qazuor/qzpay-core@1.2.0` | Hospeda depends on QZPay | Changes Q1-Q10 must be released first |
| `@qazuor/qzpay-drizzle@1.2.0` | Hospeda depends on QZPay | Drizzle adapter implementations for Q1-Q10 |
| `billing_addon_purchases` table | Migration depends on existing data | Must already exist and contain purchase history |
| `billing_customer_entitlements` table | QZPay owns this table | Created by QZPay Drizzle adapter migration |
| `billing_customer_limits` table | QZPay owns this table | Created by QZPay Drizzle adapter migration |
| `packages/billing/src/config/plans.config.ts` | Migration + applyAddonEntitlements reads canonical plan data | Source of truth for base plan limits (9 plans) |
| `packages/billing/src/config/addons.config.ts` | Migration reads addon definitions | Maps addonSlug to entitlement/limit changes (5 addons) |
| ~~SPEC-037 GAP-037-06~~ | ~~Incorporated~~ **ALREADY RESOLVED** | `addons.ts` already uses HTTPException (verified 2026-03-09). Non-addon files deferred to SPEC-039. |
| ~~SPEC-037 GAP-037-25~~ | ~~Incorporated~~ **ALREADY RESOLVED** | Cancel route already uses atomic query (verified 2026-03-09). |
| SPEC-037 GAP-037-17 | Referenced | Addon purchase transaction atomicity. Addressed by design: orphaned purchases repaired by migration (Story 5, Scenario 5f). |

---

## Changesets Summary

### Phase 1: QZPay Package Changes (prerequisite)

All changes below are in the QZPay repository (`@qazuor/qzpay-core` + `@qazuor/qzpay-drizzle`):

| # | Change | File(s) | Details |
|---|--------|---------|---------|
| Q1 | Extend `source` type | Core types | Add `'addon'` to all source type unions: `QZPayCustomerEntitlement.source`, `QZPayCustomerLimit.source`, `QZPayGrantEntitlementInput.source`, `QZPaySetLimitInput.source` |
| Q2 | Fix `grant()` across all 3 layers | **(1)** qzpay-core service JS, **(2)** EntitlementService `.d.ts` + GrantEntitlementInput type, **(3)** Drizzle adapter mapper | Fix service JS to accept input object and pass all fields through (currently ignores `source`/`sourceId`, hardcodes `source:"manual"`). Fix `.d.ts` to use object signature. Add `sourceId` to `QZPayGrantEntitlementInput`. Fix `mapCoreGrantEntitlementToDrizzle` to use `input.sourceId ?? null`. |
| Q3 | Fix `set()` across all 3 layers | **(1)** qzpay-core service JS, **(2)** LimitService `.d.ts` + SetLimitInput type, **(3)** Drizzle adapter mapper | Fix service JS to accept input object and pass all fields through (currently does not accept `source`/`sourceId`). Fix `.d.ts` to use object signature. Add `sourceId` to `QZPaySetLimitInput`. Fix `mapCoreSetLimitToDrizzle` to use `input.sourceId ?? null`. |
| Q4 | Add `remove()` | LimitService, LimitStorage, Drizzle adapter | New method: `remove(customerId, limitKey): Promise<void>`. Make `LimitStorage.delete()` idempotent (remove throw on missing row). |
| Q5 | Verify expired filtering | Test files only | Add test verifying `getByCustomerId()` excludes expired entitlements. Already implemented in v1.1.0. |
| Q6 | Verify `revoke()` idempotency | Test files only | Add test verifying `revoke()` does not throw for non-existent row. Already implemented in v1.1.0. |
| Q7 | Expose `revokeBySource` / `removeBySource` | EntitlementService, LimitService, Drizzle adapter | Wire existing repo methods to service interface. Return count of affected rows. |
| Q8 | Fix `.d.ts` type declarations | Core types | Systematic audit: compare every method in QZPayEntitlementService (4 methods) and QZPayLimitService (5 methods) between `.d.ts` and compiled JS. Fix all positional-vs-object mismatches. Produce audit table as deliverable. |
| Q9 | Version bump | package.json | Bump to `1.2.0` (minor, backward compatible) |
| Q10 | Tests | Test files | Tests for all new methods and bug fixes |

### Phase 2: Hospeda Service Rewrite

| # | Change | File | Details |
|---|--------|------|---------|
| H1 | Rewrite `applyAddonEntitlements()` | `apps/api/src/services/addon-entitlement.service.ts` | Remove INSERT (checkout owns it). Add `purchaseId` to input. Call `billing.entitlements.grant()` / `billing.limits.set()` with input objects. Read base plan limit from canonical config. Remove `@ts-expect-error` (lines 243, 469). |
| H2 | Rewrite `removeAddonEntitlements()` | Same file | Remove status update (caller owns it). Add `purchaseId` to input. Call `revokeBySource`/`removeBySource` with fallback to individual `revoke`/`remove`. Remove `@ts-expect-error` (line 469). |
| H3 | Update `addon.checkout.ts` | `apps/api/src/services/addon.checkout.ts` | Pass `purchaseId` from INSERT result to `applyAddonEntitlements()`. |
| H4 | Rewrite `loadEntitlements()` | `apps/api/src/middlewares/entitlement.ts` | After loading plan data, merge with `billing.entitlements.getByCustomerId()` and `billing.limits.getByCustomerId()`. Union entitlements, override limits. |
| H5 | Fix cron job billing instance | `apps/api/src/cron/jobs/addon-expiry.job.ts` | Change line 122: `new AddonExpirationService()` to `new AddonExpirationService(billing)` with null guard on `getQZPayBilling()`. Import from `apps/api/src/middlewares/billing.ts`. |
| H6 | Update `expireAddon()` | `apps/api/src/services/addon-expiration.service.ts` | Pass `purchaseId` to `removeAddonEntitlements()`. Verify status update flow is correct. |
| H7 | Update addon cancel route | `apps/api/src/routes/billing/addons.ts` | Pass `purchaseId` (from atomic ownership query result) to `removeAddonEntitlements()`. Verify call path. |
| H8 | Add unique partial index | `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts` + `pnpm db:generate` | Add partial unique index to Drizzle schema, then generate migration. Table is Hospeda-owned, not QZPay. Note: existing partial non-unique index `addonPurchases_active_customer_idx` on `(customerId)` WHERE `status='active'` is separate and can coexist. |
| ~~H9~~ | ~~Fix addon route error handling~~ | ~~`apps/api/src/routes/billing/addons.ts`~~ | **ALREADY RESOLVED** - addons.ts already uses HTTPException (16 instances, zero `throw new Error()`). |
| ~~H10~~ | ~~Fix addon cancel atomicity~~ | ~~`apps/api/src/routes/billing/addons.ts`~~ | **ALREADY RESOLVED** - cancel route (lines 292-308) already uses atomic direct query. |

### Phase 3: Migration Script

| # | Change | File | Details |
|---|--------|------|---------|
| M1 | Extend migration script | `packages/db/src/billing/migrate-addon-purchases.ts` | Add three new operations: (a) backfill `billing_customer_entitlements`, (b) backfill `billing_customer_limits` using canonical config for base limits, (c) restore `billing_plans` to canonical values by slug match. Handle orphaned purchases. Idempotent, supports --dry-run and --verbose. |

### Phase 4: Tests

| # | Change | File | Details |
|---|--------|------|---------|
| T1 | Rewrite service tests | `apps/api/test/services/addon-entitlement.service.test.ts` | Remove all 12 `@ts-expect-error`. Update mock billing with entitlements/limits services. New test cases for idempotency, fallback revoke/remove, canonical config, error scenarios. |
| T2 | Extend existing middleware merge tests | `apps/api/test/middlewares/entitlement.test.ts` | **File already exists (1,107 lines).** Current mock only has `subscriptions.getByCustomerId` and `plans.get`.. extend with `entitlements.getByCustomerId` and `limits.getByCustomerId`. Add new test cases for merge logic: plan-only, plan+addon entitlement, plan+addon limit, expired, multiple limits, unlimited (-1) base plan handling, plan change while addon active (Scenario 2g), QZPay call failure graceful degradation (verify degraded results are NOT cached). |
| T3 | Extend existing cron job test | `apps/api/test/cron/addon-expiry.test.ts` | **File already exists (612 lines).** Add tests for: billing instance pass-through post-fix, null guard on `getQZPayBilling()`. Verify existing tests still pass. |
| T4 | Verify expiration tests | `apps/api/test/services/addon-expiration.service.test.ts` | **File already exists (873 lines).** Has comprehensive tests for `findExpiredAddons`, `expireAddon`, `processExpiredAddons`, `findExpiringAddons`. Run existing tests, verify they pass after H2/H6 changes. |
| T5 | Create new migration script tests | `packages/db/test/billing/migrate-addon-purchases.test.ts` | **New file (does not exist yet).** Backfill logic, idempotency, dry-run, plan restoration, orphaned repair, canonical config, unlimited (-1) handling. |
| ~~T6~~ | ~~Addon route error tests~~ | ~~`apps/api/test/routes/billing/addons.test.ts`~~ | **ALREADY RESOLVED** - addons.ts already uses HTTPException. |
| ~~T7~~ | ~~Addon cancel atomicity test~~ | ~~Same file~~ | **ALREADY RESOLVED** - cancel route already uses atomic query. |

### Phase 5: Dependency Update & Cleanup

| # | Change | File | Details |
|---|--------|------|---------|
| D1 | Update QZPay dependency | `package.json` files across workspace | Bump `@qazuor/qzpay-core`, `@qazuor/qzpay-drizzle` to `^1.2.0` |
| D2 | Run migration | Production deploy | Execute migration script with `--dry-run` first, review output, then run without `--dry-run` |

---

## Implementation Order

```
Phase 1 (QZPay - separate repo)
  Q1 → Q2 → Q3 → Q4 → Q7 → Q8 → Q9 → Q10
  Q5, Q6 can run in parallel (test-only)
      |
      v
Phase 2 (Hospeda Service)         Phase 3 (Migration)
  H1 → H2 → H3 → H4 →              M1
  H5 → H6 → H7 → H8
      |                               |
      v                               v
Phase 4 (Tests)
  T1 → T2 → T3 → T4 → T5
      |
      v
Phase 5 (Deploy)
  D1 → D2
```

> **Note**: H9, H10, T6, T7 were removed from the implementation order because they were already resolved (verified 2026-03-09).

Phase 1 must complete before Phase 2 and 3 can begin. Phases 2 and 3 can be done in parallel. Phase 4 follows Phase 2 (service tests depend on the rewritten service) but T5 (migration tests) can run after Phase 3. Phase 5 is the final deployment step.

### Deployment Checklist

**CRITICAL ORDER**: The API code (Phase 2) MUST be deployed BEFORE the unique partial index migration (H8). If H8 is applied while the old code is still running, the old code's double INSERT (Bug #2) will hit unique constraint violations in production and fail addon purchases.

1. Release `@qazuor/qzpay-core@1.2.0` and `@qazuor/qzpay-drizzle@1.2.0` **simultaneously** (interdependent)
2. Update Hospeda dependencies to `^1.2.0`
3. Run `pnpm install` and verify types compile
4. **Deploy API with all Phase 2 changes FIRST** (new code that does not double-INSERT)
5. Verify addon purchase flow works correctly with new code (test a purchase in staging)
6. Apply DB migration for unique partial index (H8) - safe now because the new code does not double-INSERT
7. Run migration script with `--dry-run --verbose` to preview changes
8. Review dry-run output: verify entitlement/limit counts and plan restorations match expected values
9. Run migration script without `--dry-run` to apply changes
10. Verify via admin panel that customer entitlements reflect correctly
11. Monitor Sentry for any errors in the addon purchase/expiry flows
