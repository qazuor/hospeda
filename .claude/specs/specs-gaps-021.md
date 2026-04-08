# SPEC-021: Billing System Fixes & Production Readiness - Gap Analysis

## Audit History

| Audit | Date | Gaps Found | New | Fixed Since Last |
|-------|------|-----------|-----|------------------|
| 1st (Initial) | 2026-03-02 | 18 | 18 | - |
| 2nd (Re-Audit) | 2026-03-04 | 34 | 16 | 0 |
| 3rd (Exhaustive) | 2026-03-07 | 47 | 13 | 5 fully fixed |
| 4th (Multi-Expert) | 2026-03-07 | 72 | 25 | 0 |
| 5th (Deep Multi-Expert) | 2026-03-07 | 97 | 25 | 9 newly fixed |
| **6th (Verification Audit)** | **2026-03-07** | **109** | **12** | **6 newly fixed** |

## Executive Summary

SPEC-021 state shows **38/38 tasks completed** (2026-03-02). After six rounds of audit.. the 6th performed by 4 specialized experts (Security Engineer, Business Logic Engineer, DB/Data Integrity Engineer, QA Engineer) with a mandate to **verify** every previously reported gap against actual current code..

**6th audit confirmed 6 gaps as FIXED** (GAP-4TH-18, GAP-4TH-21, GAP-4TH-19, GAP-5TH-SEC-03, GAP-5TH-BIZ-03, GAP-NEW-06) and **GAP-QA-09** also fixed. GAP-4TH-20 reclassified (Hono resolves literal routes before params, so `/my` works despite ordering).

**12 NEW gaps were discovered** across all 4 expert domains.

The **P0 CRITICAL** gap (GAP-5TH-08: addon entitlements modify global plan) remains **UNFIXED** and continues to be the most severe issue.

**6TH AUDIT TOTALS:**

| Severity | Total | Still Open | New (6th) | Fixed (all time) |
|----------|-------|------------|-----------|-------------------|
| CRITICAL | 5 | 3 | 0 | 2 |
| HIGH | 33 | 24 | 5 | 4 |
| MEDIUM | 40 | 31 | 5 | 2 |
| LOW | 19 | 13 | 2 | 3 |
| INFO | 3 | 0 | 0 | 0 |
| **FIXED** | **22** | - | - | confirmed |

**Expert attribution key:** `[SEC]` Security, `[BIZ]` Business Logic, `[DB]` Data Integrity, `[QA]` Test Coverage.

---

## CRITICAL GAPS

---

### GAP-01: LIST endpoints expose all billing data to any authenticated user (BILL-06 incomplete) [SEC]

```
Audit: 1st | Status: FIXED (5th audit) | Priority: P0
Related Task: T-011 to T-015
```

**FIXED.** The Security Engineer confirmed that list endpoints now properly filter by `customerId` for non-admin users. The `billingOwnershipMiddleware` was updated to handle list routes correctly.

---

### GAP-02: Accommodation count includes soft-deleted records in limit enforcement (BILL-11) [DB]

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: YES
Related Task: T-023
```

**Description:**
`AccommodationModel.countByFilters()` in `packages/db/src/models/accommodation/accommodation.model.ts` (lines 27-51) builds WHERE clauses manually but **never adds `isNull(accommodations.deletedAt)`**.

**6th Audit Finding [DB]:** Confirmed still open. All 4 query methods lack soft-delete filtering:
- `countByFilters()` (lines 27-51)
- `search()` (lines 54-112)
- `searchWithRelations()` (lines 117-215)
- `findTopRated()` (lines 224-262) -- **newly identified** in this audit

**Impact:** Soft-deleted accommodations count against the user's plan limit. A user on `MAX_ACCOMMODATIONS = 3` who deleted 2 and has 1 active shows count as 3.

**Fix:** Add `whereClauses.push(isNull(accommodations.deletedAt))` to all 4 methods. Consider also fixing at BaseModel level (GAP-5TH-DB-05).

**Severity:** CRITICAL | **Complexity:** 2/10 | **Recommendation:** Fix directly, batch with GAP-23 and GAP-5TH-DB-05

---

### GAP-03: Trial reactivation allows creating duplicate paid subscriptions (BILL-09) [BIZ]

```
Audit: 1st | Status: FIXED (5th audit) | Priority: P1
Related Task: T-017
```

**FIXED.**

---

### GAP-NEW-01: Race condition + missing DB transactions in subscription operations [DB][BIZ]

```
Audit: 3rd | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: YES
Related Task: T-017, T-019
```

**Description:**
Both `reactivateFromTrial()` (lines 533-604) and `reactivateSubscription()` (lines 616-700) and `startTrial()` (lines 123-217) follow a check-then-act pattern without atomicity.

**6th Audit Finding [DB+BIZ]:** Confirmed unchanged. The flow is:
1. Fetch existing subscriptions (line 551)
2. Cancel each in a loop (line 557)
3. Create new subscription (line 571)

If failure occurs between steps 2 and 3, the user is left with cancelled subscriptions and no active one. Two concurrent requests can both pass the check and create duplicate subscriptions. No `db.transaction()` used. Operations go through QZPay API so Drizzle transactions don't directly apply; however no compensation pattern exists either.

**Fix Options:**
1. **(Recommended)** Wrap cancel+create in a DB transaction. Cancel trial AFTER confirming new subscription was created (compensation pattern).
2. Use `SELECT FOR UPDATE` on the customer record
3. Add a unique constraint on `billing_subscriptions(customer_id)` where `status IN ('active', 'trialing')`

**Severity:** CRITICAL | **Complexity:** 4/10 | **Recommendation:** Fix directly

---

### GAP-4TH-01: Error internals exposed in billing API responses [SEC]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: YES
Expert: Security Engineer
```

**Description:**
Multiple billing handlers expose internal error messages directly to clients.

**6th Audit Finding [SEC]:** Confirmed still open with **exact line numbers**:
- `trial.ts:203`: `message: \`Failed to start trial: ${errorMessage}\`` -- returned to client
- `trial.ts:267`: `message: \`Failed to extend trial: ${errorMessage}\`` -- admin route (lower risk)
- `trial.ts:346`: `message: \`Failed to reactivate: ${errorMessage}\``
- `trial.ts:394`: `message: \`Failed to check expired trials: ${errorMessage}\`` -- in HTTPException 500
- `trial.ts:511`: `message: \`Failed to reactivate subscription: ${errorMessage}\``
- `promo-codes.ts`: propagates via `throw new Error(result.error?.message ?? 'Unknown error')` (lines 64, 106, 137)

The `errorMessage` comes directly from `error.message` which can contain stack traces, table names, SQL queries, or QZPay internal details. Also see new GAP-6TH-SEC-01 and GAP-6TH-SEC-02.

**Fix:** Sanitize all error messages. Return generic "billing operation failed" to clients. Log full errors server-side only.

**Severity:** CRITICAL | **Complexity:** 2/10 | **Recommendation:** Fix directly, batch with GAP-09

---

### GAP-5TH-08: Addon entitlements modify global QZPay plan instead of per-subscription [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P0 | Blocks Launch: YES
Expert: Business Logic Engineer
```

**Description:**
`AddonEntitlementService.applyAddonEntitlements()` (addon-entitlement.service.ts:243-247) calls `this.billing.plans.update(plan.id, { entitlements, limits })` which updates the **global plan** in QZPay, not the individual subscription.

**6th Audit Finding [BIZ]:** Confirmed STILL OPEN. The code still modifies the global QZPay plan. One customer's addon purchase gives benefits to ALL customers on that plan. When that addon expires, all customers lose those benefits.

**Impact:** **Revenue loss + data corruption.** Most severe business logic bug across all 6 audits.

**Fix Options:**
1. **(Recommended)** Manage addon entitlements at the subscription level, not plan level
2. Create per-customer plan variants in QZPay
3. Use subscription metadata to store addon entitlements and check at middleware level

**Severity:** CRITICAL | **Complexity:** 7/10 | **Recommendation:** Requires new SPEC. Architectural change needed.

**Related Files:**
- `apps/api/src/services/addon-entitlement.service.ts` (lines 243-247, 469-473)
- `apps/api/src/services/addon.checkout.ts`

---

## HIGH GAPS

---

### GAP-04: No user notification on dunning cancellation (BILL-04) [BIZ]

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Related Task: T-009
```

**6th Audit Finding [BIZ]:** Confirmed unchanged. `dunning.job.ts:228-232` only logs `subscription.canceled_nonpayment` event at WARN level. No `sendSubscriptionCancelledNotification()` is called.

**Fix:** In dunning job's event handler for `subscription.canceled_nonpayment`, call `sendSubscriptionCancelledNotification()`.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-05: No entitlement cache clearing after trial extend (BILL-03) [BIZ]

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Related Task: T-006
```

**6th Audit Finding [BIZ]:** Confirmed. `extendTrial()` (trial.service.ts:485-493) updates `trialEnd` but never calls `clearEntitlementCache()`.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch with GAP-19, GAP-20, GAP-22, GAP-6TH-BIZ-01)

---

### GAP-19: Plan change does not clear entitlement cache [BIZ]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
```

**6th Audit Finding [BIZ]:** Confirmed. `handlePlanChange()` (plan-change.ts:196-226) calls `changePlan()` but NEVER calls `clearEntitlementCache(billingCustomerId)`.

**Impact:** After a plan upgrade, user sees old plan limits for up to 5 minutes (cache TTL). False 402 errors at the most critical conversion moment.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-20: reactivateFromTrial and reactivateSubscription do not clear entitlement cache [BIZ]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
```

**6th Audit Finding [BIZ]:** Confirmed. Both create new subscriptions but never call `clearEntitlementCache()`.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-22: Subscription webhook stub does not invalidate entitlement cache [BIZ]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
```

**6th Audit Finding [BIZ]:** Confirmed. `processSubscriptionUpdated()` in `subscription-logic.ts` (lines 286-299) updates DB state and sends notifications but never calls `clearEntitlementCache(localSubscription.customerId)`.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch with GAP-05/19/20)

---

### GAP-24: Grace period only on billing routes, not protected business resources (BILL-02) [BIZ][SEC]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Related Task: T-003
```

**6th Audit Finding [BIZ]:** Confirmed. `pastDueGraceMiddleware` is registered ONLY in `billing/index.ts:163`. Business routes like `POST /api/v1/protected/accommodations` have NO grace period enforcement.

**Fix:** Apply `pastDueGraceMiddleware()` globally on `/api/v1/protected/*` routes in `app.ts` after `billingCustomerMiddleware`.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-29: PAYMENT vs DUNNING grace period ambiguity (BILL-02/BILL-04) [BIZ]

```
Audit: 2nd | Status: FIXED (5th audit) | Priority: P2
```

**FIXED.**

---

### GAP-30: AccommodationService.count() `as never` may bypass ownerId filter (BILL-11) [DB]

```
Audit: 2nd | Status: FIXED (5th audit) | Priority: P2
```

**FIXED.**

---

### GAP-31: Grace period exempt paths missing payment method update route (BILL-02) [SEC]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
```

**6th Audit Finding [SEC]:** Confirmed. `GRACE_EXEMPT_PATH_SUFFIXES` in `past-due-grace.middleware.ts:40-45` contains:
- `/trial/reactivate`
- `/trial/reactivate-subscription`
- `/checkout`
- `/subscriptions/reactivate`

No `/payment-methods` in the exempt list. Note: No active `/payment-methods` endpoint currently exists, so immediate impact is low. However, adding such endpoint in the future without updating this list would create a deadlock for past-due users.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-NEW-02: Trial reminder idempotency key collision (3-day vs 1-day) [BIZ]

```
Audit: 3rd | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
```

**6th Audit Finding [BIZ]:** Confirmed with deeper analysis. `generateIdempotencyKey()` (notification-schedule.job.ts:82-84) uses `${type}:${customerId}:${today}` without `daysAhead`. Combined with `findTrialsEndingSoon({ daysAhead: 3 })` using `<=` comparison (trial.service.ts:754), a trial expiring in 1 day appears in BOTH 3-day and 1-day datasets. The 3-day loop runs first, marks the key, and the 1-day loop skips the notification.

**Fix:** Two changes needed:
1. Include `daysAhead` in idempotency key: `${type}:${customerId}:${daysAhead}:${today}`
2. Change `findTrialsEndingSoon` to exact day matching (`daysRemaining === daysAhead`)

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-4TH-13)

---

### GAP-NEW-03: Custom billing routes lack ownership middleware [SEC]

```
Audit: 3rd | Status: FIXED (5th audit) | Priority: P2
```

**FIXED.**

---

### GAP-4TH-02: PATCH method not blocked by billingAdminGuardMiddleware [SEC]

```
Audit: 4th | Status: FIXED (5th audit) | Priority: P1
Expert: Security Engineer
```

**FIXED.**

---

### GAP-4TH-03: No rate limiting for critical billing operations [SEC]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Expert: Security Engineer
```

**6th Audit Finding [SEC]:** Confirmed with detailed evidence. The rate limiting system in `rate-limit.ts` classifies routes by type (auth, public, admin, general). Billing routes at `/api/v1/protected/billing/*` fall into `general` tier (~100 req/15min). No `billing` category exists in `getEndpointType()` (lines 238-249). No `customRateLimit` configured on any financial operation (`POST /trial/start`, `POST /addons/:slug/purchase`, `POST /subscriptions/change-plan`, `POST /promo-codes/validate`).

The only billing-related `customRateLimit` found is on `GET /api/v1/public/billing/plans` (100 req/60s) which is a public listing, not a financial operation.

**Severity:** HIGH | **Complexity:** 3/10 | **Recommendation:** Fix directly

---

### GAP-4TH-04: billingAuthMiddleware checks `user` instead of `actor` [SEC]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: Security Engineer
```

**6th Audit Finding [SEC]:** Confirmed. `billingAuthMiddleware` (routes/billing/index.ts:47-57) uses `c.get('user')?.id`. The standard system uses `c.get('actor')` via `getActorFromContext` (actor.ts). A blocked/suspended user could still pass billing auth.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-4TH-05: past-due-grace and limit-enforcement middlewares fail open on errors [SEC]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: Security Engineer
```

**6th Audit Finding [SEC]:** Confirmed. Both middlewares catch errors and call `await next()`.
- `past-due-grace.middleware.ts:198-211`: catch block explicitly says "fail open" in comment
- `limit-enforcement.ts:141` (`enforceAccommodationLimit`), line 503/505 (`enforceFavoritesLimit`): same pattern

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly or document as accepted risk (ADR)

---

### GAP-4TH-06: addon-expiry.job.ts idempotency uses in-memory Set that resets on every run [BIZ]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: Business Logic Engineer
```

**6th Audit Finding [BIZ]:** Confirmed. `addon-expiry.job.ts:105` clears the `sentNotifications` Set at the START of each run. No Redis backing.

**Severity:** HIGH | **Complexity:** 3/10 | **Recommendation:** Fix directly

---

### GAP-4TH-07: blockExpiredTrials and dunning load ALL subscriptions without pagination [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. All 4 paths still lack pagination:
- `TrialService.blockExpiredTrials()` (line 350): `billing.subscriptions.list({ filters: { status: 'trialing' } })` without limit
- `TrialService.findTrialsEndingSoon()` (line 725): without pagination
- `dunning.job.ts:253` dry-run: `billing.subscriptions.list()` without ANY filters
- `trial-expiry.ts:67` dry-run: `billing.subscriptions.list()` without filters

**Severity:** HIGH | **Complexity:** 3/10 | **Recommendation:** Fix directly

---

### GAP-4TH-08: billing_notification_log ON DELETE RESTRICT on nullable FK [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. `packages/db/src/schemas/billing/billing_notification_log.dbschema.ts:12-14`:
```typescript
customerId: uuid('customer_id').references(() => billingCustomers.id, {
    onDelete: 'restrict'
}),
```
`customerId` is nullable (no `.notNull()`) but behavior is `RESTRICT`.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-4TH-11: past_due not mapped in QZPAY_TO_HOSPEDA_STATUS [BIZ]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: Business Logic Engineer
```

**6th Audit Finding [BIZ]:** Confirmed. `subscription-logic.ts:37-43` maps `active`, `paused`, `canceled`, `finished`, `pending` but NOT `past_due`. When QZPay sends a webhook with `past_due`, the code logs a warning via Sentry and returns `{ success: true, statusChanged: false }`. Local DB stays in `active` while QZPay shows `past_due`.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-NEW-04: one_time interval creates recurring subscription in QZPay [BIZ]

```
Audit: 3rd | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
```

**6th Audit Finding [BIZ]:** Confirmed. `plan-change.ts:69-71` maps `one_time` to `{ interval: 'month', intervalCount: 1 }` -- identical to `monthly`.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-4TH-15: billing_subscription_events.metadata NOT NULL mismatch between schema and migration [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed mismatch persists. Schema Drizzle declares `.notNull().default({})` but migration 0018 creates the column WITHOUT `NOT NULL`. The constraint exists in TypeScript but NOT in the actual database.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch with GAP-5TH-DB-03)

---

### GAP-4TH-17: dunning_attempts.paymentId is UUID but receives arbitrary provider strings [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. Schema: `paymentId: uuid('payment_id')`. Migration 0015: `"payment_id" uuid`. MercadoPago uses numeric/non-UUID IDs. Insert fails with PostgreSQL constraint error, but is wrapped in try-catch so dunning succeeds but audit record is lost.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch F)

---

### GAP-NEW-10: findWithRelations() in BaseModel ignores relations parameter [DB]

```
Audit: 3rd | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: Recommended
```

**6th Audit Finding [DB]:** Confirmed. `base.model.ts:377-413` receives `relations` parameter but executes `db.select().from(this.table).where(whereClause).limit(1)` without using it. The `relations` parameter is logged but never included in the query.

**Severity:** HIGH | **Complexity:** 5/10 | **Recommendation:** Separate SPEC or tech debt ticket

---

### GAP-5TH-BIZ-01: plan-change.ts compares prices by unitAmount without considering intervalCount [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Expert: Business Logic Engineer
```

**6th Audit Finding [BIZ]:** Confirmed. `plan-change.ts:193` uses only `unitAmount` for comparison. A monthly plan at $1000/mo vs annual at $10000/year is classified as "upgrade" when per-month it's actually cheaper ($833/mo).

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-5TH-BIZ-03: addon purchase allows checkout without active subscription [BIZ]

```
Audit: 5th | Status: FIXED (6th audit) | Priority: P1
Expert: Business Logic Engineer
```

**FIXED.** The Business Logic Engineer confirmed that `purchaseAddonRoute` now verifies active subscription before creating checkout session.

---

### GAP-5TH-BIZ-07: Billing settings in DB have no effect on cron jobs [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Expert: Business Logic Engineer
```

**6th Audit Finding [BIZ]:** Confirmed. Cron jobs use compile-time constants from `@repo/billing`, not DB settings. The settings UI is decorative.

**Severity:** HIGH | **Complexity:** 3/10 | **Recommendation:** Fix directly (option 1: document constants as source of truth, disable/label settings UI)

---

### GAP-5TH-DB-02: billing_addon_purchases.subscriptionId SET NULL leaves active addons orphaned [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. `billing_addon_purchase.dbschema.ts:34-36`: `subscriptionId` has `onDelete: 'set null'`. No logic cancels addons when subscription is deleted.

**Severity:** HIGH | **Complexity:** 3/10 | **Recommendation:** Fix directly

---

### GAP-5TH-DB-05: BaseModel does not enforce soft-delete filter automatically [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P1 | Blocks Launch: Recommended
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. `base.model.ts`:
- `findAll()` (line 64): no auto soft-delete filter
- `count()` (line 231): no auto soft-delete filter
- `findById()` (line 122): no soft-delete check
- `findOne()` (line 146): no soft-delete check

All callers must manually add `deletedAt: null` to `where`.

**Severity:** HIGH | **Complexity:** 4/10 | **Recommendation:** Separate SPEC (affects all models)

---

### GAP-4TH-09: promo-code applyPromoCode response exposes billing customerId [SEC]

```
Audit: 4th | Status: FIXED (5th audit) | Priority: P3
Expert: Security Engineer
```

**FIXED.**

---

### GAP-4TH-20: Route ordering /my vs /:slug in addonsRouter [SEC]

```
Audit: 4th | Status: RECLASSIFIED (6th audit) | Priority: P4 | Blocks Launch: No
Expert: Security Engineer
```

**6th Audit Finding [SEC]:** `GET /my` is still registered AFTER `GET /:slug` in `addons.ts:287-289`. **However**, the Security Engineer confirmed that Hono resolves literal routes (`/my`) before parameterized routes (`/:slug`) regardless of registration order. The route works correctly. Reclassified from HIGH to LOW as a defensive ordering improvement, not an active bug.

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly (best practice)

---

### GAP-4TH-21: Hardcoded URL fallback in trial notification and addon checkout [SEC]

```
Audit: 4th | Status: FIXED (6th audit) | Priority: P2
Expert: Security Engineer
```

**FIXED.** The Security Engineer confirmed:
- `addon.checkout.ts:161-170`: Now requires `env.HOSPEDA_SITE_URL`, returns error `PAYMENT_NOT_CONFIGURED` if missing
- `addon.checkout.ts:172-181`: Same for `env.HOSPEDA_API_URL`
- No fallback to `localhost` or `hospeda.com` anywhere

---

## MEDIUM GAPS

---

### GAP-06: Missing v1-launch-strategy.md documentation (BILL-05) [BIZ]

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: No
```

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly (documentation)

---

### GAP-07: Missing manual-qa-checklist.md (incorrect path reference)

```
Audit: 1st | Status: PARTIALLY FIXED (5th audit) | Priority: P3 | Blocks Launch: No
```

Equivalent content exists at `docs/testing/billing-manual-testing.md`. Only the reference is wrong.

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-09: Trial endpoints return 200 with success:false instead of HTTP error codes (BILL-03) [BIZ]

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
```

**6th Audit Finding [BIZ]:** Confirmed. `startTrialRoute` (lines 189-205), `reactivateTrialRoute` (lines 331-348), and `reactivateSubscriptionRoute` (lines 495-513) all return HTTP 200 with `{ success: false }`. Additionally, `startTrialRoute` mixes "already has subscription" (should be 409) with "creation error" (should be 500) in the same response.

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-4TH-01)

---

### GAP-21: Notification retryService always null in notification-helper.ts (BILL-07) [BIZ]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
```

**6th Audit Finding [BIZ]:** Confirmed. `notification-helper.ts:87` hardcodes `const retryService: RetryService | null = null`. Fire-and-forget notifications have no retry.

**Severity:** MEDIUM | **Complexity:** 3/10 | **Recommendation:** Fix directly or defer to SPEC-027

---

### GAP-27: COMPLEX user trial auto-start never implemented (BILL-10) [BIZ]

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: Depends
```

**6th Audit Finding [BIZ]:** Confirmed. `trial.service.ts:135-136` hardcodes `planSlug = 'owner-basico'` for all users. Intentional design decision documented in comments.

**Severity:** MEDIUM | **Complexity:** 3/10 | **Recommendation:** Product decision needed

---

### GAP-NEW-05: No audit logging in reactivateFromTrial/reactivateSubscription [BIZ]

```
Audit: 3rd | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
```

**6th Audit Finding [BIZ]:** Confirmed. Neither function inserts records in `billingSubscriptionEvents`.

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-NEW-06: billingAdminGuard and promo-codes check role directly instead of PermissionEnum [SEC][BIZ]

```
Audit: 3rd | Status: FIXED (6th audit) | Priority: P3
```

**FIXED.** The Business Logic Engineer confirmed that role checks have been replaced with `PermissionEnum` checks.

---

### GAP-NEW-08: blockExpiredTrials notification fails silently if customer lookup fails [BIZ]

```
Audit: 3rd | Status: PARTIALLY FIXED (6th audit) | Priority: P3 | Blocks Launch: No
```

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-4TH-10: Webhook MercadoPago without specific rate limiting [SEC]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: Security Engineer
```

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly

---

### GAP-4TH-12: payment.created in dead letter always resolved without verification [BIZ]

```
Audit: 4th | Status: REQUIRES INVESTIGATION (6th audit) | Priority: P3 | Blocks Launch: No
Expert: Business Logic Engineer
```

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Investigate and fix directly

---

### GAP-4TH-13: Trial reminders overlapping datasets causing wrong email content [BIZ]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P2 | Blocks Launch: No
Expert: Business Logic Engineer
```

**6th Audit Finding [BIZ]:** Confirmed and linked to GAP-NEW-02. The `findTrialsEndingSoon({ daysAhead: 3 })` uses `<=` comparison.

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-NEW-02)

---

### GAP-4TH-14: billing_dunning_attempts (subscriptionId, attemptNumber) index not UNIQUE [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. Schema uses `index()` not `uniqueIndex()` at `billing_dunning_attempt.dbschema.ts:53-55`.

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch F)

---

### GAP-4TH-16: promo code recordPromoCodeUsage called outside redemption transaction [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Partially fixed. `tryRedeemAtomically()` uses transaction for `usedCount` increment. But `recordPromoCodeUsage()` (line 220) is called OUTSIDE the transaction in `applyPromoCode()` (line 349). If recording fails, `usedCount` is incremented without audit record.

**Severity:** MEDIUM | **Complexity:** 3/10 | **Recommendation:** Fix directly

---

### GAP-4TH-18: addon-expiry cache clearing flow can leave inconsistent state [BIZ]

```
Audit: 4th | Status: FIXED (6th audit) | Priority: P3
Expert: Business Logic Engineer
```

**FIXED.** The Business Logic Engineer confirmed the flow now updates status AFTER entitlement removal succeeds.

---

### GAP-4TH-22: Notification list endpoint dates without format validation [SEC]

```
Audit: 4th | Status: FIXED (5th audit) | Priority: P4
Expert: Security Engineer
```

**FIXED.**

---

### GAP-5TH-SEC-01: billingAuthMiddleware duplicates auth with lesser rigor than authorizationMiddleware [SEC]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: Security Engineer
```

**6th Audit Finding [SEC]:** Confirmed. Uses own auth check (`c.get('user')?.id`) instead of standard `actor` pattern.

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch with GAP-4TH-04)

---

### GAP-5TH-SEC-02: requestProviderEventIds Map is process-level state with potential memory leak [SEC]

```
Audit: 5th | Status: PARTIALLY FIXED (6th audit) | Priority: P4 | Blocks Launch: No
Expert: Security Engineer
```

**6th Audit Finding [SEC]:** The original exported `webhookEventIds` Map is gone. The replacement `requestProviderEventIds` Map is private but only cleaned in error paths (`handleWebhookError` line 246), NOT on the success path. Entries from successful processing remain permanently. Low impact on serverless (Vercel) but potential issue in long-running processes.

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-5TH-SEC-03: Promo code validate uses userId from request body for ownership check [SEC]

```
Audit: 5th | Status: FIXED (6th audit) | Priority: P4
Expert: Security Engineer
```

**FIXED.** The Security Engineer confirmed the check uses proper comparison: if `body.userId !== actor.id` and user is not admin, returns 403.

---

### GAP-5TH-BIZ-02: promo-code validate endpoint discloses promo code details [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: Business Logic Engineer
```

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-4TH-03)

---

### GAP-5TH-BIZ-04: Renewal reminder timing edge case with Math.ceil [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: Business Logic Engineer
```

**Severity:** LOW | **Complexity:** 2/10 | **Recommendation:** Tech debt

---

### GAP-5TH-BIZ-05: Admin routes under /protected prefix instead of /admin [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: Business Logic Engineer
```

**Severity:** LOW | **Complexity:** 2/10 | **Recommendation:** Fix directly or document

---

### GAP-5TH-BIZ-06: reactivateFromTrial cancels already-cancelled subscriptions [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: Business Logic Engineer
```

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-5TH-BIZ-09: startTrialRoute mixes error cases in response [BIZ]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: Business Logic Engineer
```

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-09/GAP-4TH-01)

---

### GAP-5TH-DB-01: blockExpiredTrials no idempotency between concurrent runs [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. No distributed lock, SKIP LOCKED, or state check before cancelling.

**Severity:** MEDIUM | **Complexity:** 3/10 | **Recommendation:** Fix directly

---

### GAP-5TH-DB-03: billing_dunning_attempts.metadata nullable mismatch [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. Schema has `.default({})` but no `.notNull()`. Migration has no `NOT NULL`.

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch F)

---

### GAP-5TH-DB-04: billing_addon_purchases.addonId nullable + ON DELETE RESTRICT contradiction [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. `addonId` nullable but `onDelete: 'restrict'`. Not changed to `SET NULL`.

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch F)

---

### GAP-4TH-23: billing_settings.updatedBy without FK to users [DB]

```
Audit: 4th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. `billing_settings.dbschema.ts:17`: `updatedBy: uuid('updated_by')` without `.references()`.

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch F)

---

## LOW GAPS

---

### GAP-08: Grace period constant synchronized across 3 sources manually (BILL-02)

```
Audit: 1st | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-10: Permission enum mismatch between spec and code (BILL-06)

```
Audit: 1st | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-11: No HTTP-level integration tests for critical billing flows [QA]

```
Audit: 1st | Status: FIXED (5th audit) | Priority: -
```

**FIXED.**

---

### GAP-12: Dispute/chargeback handling contradictions in docs

```
Audit: 1st | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-13: Trial expiry behavior for accommodations not documented

```
Audit: 1st | Status: PARTIALLY FIXED (6th audit) | Priority: P3 | Blocks Launch: No
```

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly (documentation)

---

### GAP-14: AFIP manual invoicing process not specified

```
Audit: 1st | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-16: Smoke tests with overly permissive assertions [QA]

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
```

**Severity:** LOW | **Complexity:** 2/10 | **Recommendation:** Tech debt

---

### GAP-17: one_time interval maps to monthly without documentation

```
Audit: 1st | Status: PARTIALLY FIXED (6th audit) | Priority: P4 | Blocks Launch: No
```

See GAP-NEW-04 for the deeper issue.

---

### GAP-18: TODOs.md doc path references broken

```
Audit: 1st | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
```

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-23: AccommodationModel.search() also missing soft-delete filter

```
Audit: 2nd | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
```

Fix together with GAP-02.

---

### GAP-25: WEB_URL env var undefined, upgrade URLs hardcoded

```
Audit: 2nd | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-26: Limit enforcement returns 403, spec says 402

```
Audit: 2nd | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-28: NotificationType.SUBSCRIPTION_CANCELLED infrastructure

```
Audit: 2nd | Status: FIXED (3rd audit) | Priority: -
```

FIXED.

---

### GAP-NEW-09: Env var name without HOSPEDA_ prefix in docs

```
Audit: 3rd | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
```

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-4TH-19: Deprecated webhookEventIds Map still exported publicly [SEC]

```
Audit: 4th | Status: FIXED (6th audit) | Priority: P4
Expert: Security Engineer
```

**FIXED.** The exported Map no longer exists. The replacement `requestProviderEventIds` is private.

---

### GAP-5TH-DB-06: billing_settings without indexes or FK on updatedBy [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: DB Engineer
```

Main issue is missing FK (covered by GAP-4TH-23).

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix with GAP-4TH-23

---

### GAP-5TH-DB-07: trial-expiry dry-run loads ALL subscriptions without filter [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. `trial-expiry.ts:67` calls `billing.subscriptions.list()` without `{ status: 'trialing' }` filter in dry-run mode. Filters in memory instead.

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-5TH-DB-08: Missing composite index (customerId, status, expiresAt) on addon_purchases [DB]

```
Audit: 5th | Status: STILL OPEN (6th audit) | Priority: P4 | Blocks Launch: No
Expert: DB Engineer
```

**6th Audit Finding [DB]:** Confirmed. Existing indexes cover `(customerId, status)` and `(customerId, addonSlug)` but not `(customerId, status, expiresAt)` for the critical "active unexpired addons" query.

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch F)

---

## NEW GAPS (6th Audit)

---

### GAP-6TH-SEC-01: Error internals in admin billing routes [SEC]

```
Audit: 6th | Status: NEW | Priority: P3 | Blocks Launch: No
Expert: Security Engineer
```

**Description:**
`apps/api/src/routes/billing/admin/metrics.ts` (lines 286, 321, 351) propagates internal error messages via `throw new Error(result.error?.message ?? 'Failed to fetch...')`. While admin-only (requires `BILLING_READ_ALL`), internal error details are still exposed.

**Fix:** Log detailed errors server-side, throw generic messages.

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch with GAP-4TH-01)

---

### GAP-6TH-SEC-02: Trial start exposes errorMessage to non-admin client [SEC]

```
Audit: 6th | Status: NEW | Priority: P1 | Blocks Launch: Recommended
Expert: Security Engineer
```

**Description:**
`trial.ts:200-204` returns error messages to regular authenticated users (not admin). The `errorMessage` can contain QZPay internals, DB details, or stack traces. Unlike other endpoints that use `throw new HTTPException(500, ...)`, this returns the error in a 200 response body with `success: false`, bypassing any global error handler that might sanitize.

**Note:** This is a sub-finding of GAP-4TH-01 but elevated due to being the most dangerous instance (non-admin user, 200 response bypassing error handlers).

**Fix:** Replace `errorMessage` in response body with generic message. Log full error server-side.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch with GAP-4TH-01)

---

### GAP-6TH-SEC-03: requestProviderEventIds not cleaned on happy path [SEC]

```
Audit: 6th | Status: NEW | Priority: P4 | Blocks Launch: No
Expert: Security Engineer
```

**Description:**
`event-handler.ts`: entries in `requestProviderEventIds` Map are inserted on lines 73 and 187 but only deleted in `handleWebhookError` (line 246). Successful webhook processing never cleans up entries. Low impact on Vercel (serverless) but potential unbounded growth in long-running processes.

**Fix:** Clean entry on success path or use TTL-based Map.

**Severity:** LOW | **Complexity:** 1/10 | **Recommendation:** Fix directly

---

### GAP-6TH-BIZ-01: handlePlanChange does not clear entitlement cache [BIZ]

```
Audit: 6th | Status: NEW | Priority: P2 | Blocks Launch: Recommended
Expert: Business Logic Engineer
```

**Description:**
`plan-change.ts:196-226` `handlePlanChange()` calls `changePlan()` but NEVER calls `clearEntitlementCache(billingCustomerId)`. This is the same root cause as GAP-19 but confirmed with fresh evidence in the 6th audit showing the exact call chain.

**Note:** Effectively a confirmation of GAP-19. Merged into GAP-19's tracking for deduplication but listed here for audit completeness.

**Severity:** HIGH | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch C)

---

### GAP-6TH-BIZ-02: findTrialsEndingSoon(3) includes 1-day trials due to <= comparison [BIZ]

```
Audit: 6th | Status: NEW | Priority: P2 | Blocks Launch: Recommended
Expert: Business Logic Engineer
```

**Description:**
`trial.service.ts:754` `findTrialsEndingSoon({ daysAhead: 3 })` uses `<=` comparison, so trials expiring in 1 day match both the 3-day and 1-day queries. This is the mechanism behind GAP-NEW-02.

**Note:** Root cause confirmation of GAP-NEW-02. Merged into GAP-NEW-02's tracking.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-NEW-02)

---

### GAP-6TH-DB-01: findAllWithRelations count() may not filter soft-deletes consistently [DB]

```
Audit: 6th | Status: NEW | Priority: P2 | Blocks Launch: Recommended
Expert: DB Engineer
```

**Description:**
`base.model.ts:556` `findAllWithRelations()` runs `findMany` with a constructed `whereClause` (SQL) and `this.count(safeWhere)` with the raw object. If `buildWhereClause` handles `null` values specially (e.g., `deletedAt: null` becomes `isNull(deletedAt)`), the count might not apply the same transformation, leading to inconsistent totals vs items returned.

**Impact:** Pagination metadata shows wrong total count when soft-delete filters are involved.

**Fix:** Ensure both the query and count use the same WHERE clause construction.

**Severity:** HIGH | **Complexity:** 2/10 | **Recommendation:** Fix directly (batch with GAP-5TH-DB-05)

---

### GAP-6TH-DB-02: billing_notification_log without retention/purge mechanism [DB]

```
Audit: 6th | Status: NEW | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**Description:**
`billing_notification_log` has an `expiredAt` column but no cron job or mechanism to purge expired records. The table will grow indefinitely. No partial index on `expiredAt` for efficient expired record queries.

**Impact:** Slow queries on notification log over time. Unbounded disk growth.

**Fix:** Add a purge cron job for expired notification logs, or add a partial index.

**Severity:** MEDIUM | **Complexity:** 2/10 | **Recommendation:** Fix directly or defer

---

### GAP-6TH-DB-03: billing_dunning_attempts customerId ON DELETE RESTRICT blocks customer deletion [DB]

```
Audit: 6th | Status: NEW | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**Description:**
`billing_dunning_attempt.dbschema.ts:31-33`: `customerId` has `onDelete: 'restrict'`. If a customer has dunning history, they cannot be deleted. For audit tables, `CASCADE` or `SET NULL` would be more appropriate.

**Fix:** Change to `onDelete: 'set null'` or `cascade`.

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch F)

---

### GAP-6TH-DB-04: Inconsistent FK cascade strategy on billing_dunning_attempts [DB]

```
Audit: 6th | Status: NEW | Priority: P3 | Blocks Launch: No
Expert: DB Engineer
```

**Description:**
`billing_dunning_attempt.dbschema.ts`:
- `subscriptionId` FK: `onDelete: 'cascade'` -- deleting subscription silently deletes dunning history
- `customerId` FK: `onDelete: 'restrict'` -- blocks customer deletion entirely

These are contradictory. Deleting a subscription destroys audit trail, while deleting a customer is blocked. Should use the same strategy for both.

**Fix:** Align both FKs to `set null` (preserves audit history while allowing deletion).

**Severity:** MEDIUM | **Complexity:** 1/10 | **Recommendation:** Fix directly (batch F)

---

## TEST COVERAGE GAPS (6th Audit - QA Expert) [QA]

### Status of Prior QA Gaps

| # | Description | Prior Status | 6th Status | Severity |
|---|-------------|--------------|------------|----------|
| QA-01 | `enforceFavoritesLimit`, `enforcePropertiesLimit`, `enforceStaffAccountsLimit` zero tests | OPEN | **STILL OPEN** | HIGH |
| QA-02 | Webhook idempotency tests don't verify business logic non-execution | OPEN | **STILL OPEN** | CRITICAL |
| QA-03 | `reactivateSubscription` race condition scenarios untested | OPEN | **STILL OPEN** | HIGH |
| QA-04 | `chargebacks`/`payment.dispute` dead letter retry cases untested | PARTIALLY FIXED | PARTIALLY FIXED | MEDIUM |
| QA-05 | No concurrent request tests for webhooks (HTTP status only) | PARTIALLY FIXED | **PARTIALLY FIXED** (exist but superficial) | HIGH |
| QA-06 | `trialing` + downgrade plan change untested | PARTIALLY FIXED | PARTIALLY FIXED | MEDIUM |
| QA-07 | `X-Usage-Warning` header never asserted in any test | OPEN | **STILL OPEN** | HIGH |
| QA-08 | `clearEntitlementCache` call not verified in `blockExpiredTrials` test | OPEN | **STILL OPEN** | MEDIUM |
| QA-09 | All ownership middleware tests use `ctx as never` cast | OPEN | **FIXED** | - |
| QA-10 | `purgeStaleFallbackEntries` TTL behavior untested | OPEN | **STILL OPEN** | MEDIUM |
| QA-11 | Nested resource paths (`/invoices/:id/pay`) in ownership MW untested | FIXED | FIXED | - |
| QA-12 | `processPayment`/`getDefaultPaymentMethod` callbacks type-only | OPEN | **STILL OPEN** | HIGH |

### New QA Gaps (5th Audit) -- Status Update

| # | Description | 5th Status | 6th Status | Severity |
|---|-------------|------------|------------|----------|
| QA-NEW-01 | `billing/settings.ts` routes have no dedicated handler tests | OPEN | **STILL OPEN** (service tests exist, handler tests missing) | MEDIUM |
| QA-NEW-02 | `billing/metrics.ts` routes have no dedicated handler tests | OPEN | **STILL OPEN** (service tests exist, handler tests missing) | MEDIUM |
| QA-NEW-03 | `billing/notifications.ts` handleCleanup has no tests | OPEN | **STILL OPEN** | MEDIUM |
| QA-NEW-04 | `search-index-refresh` cron job has zero tests | OPEN | **STILL OPEN** | MEDIUM |
| QA-NEW-05 | `billing/addons.ts` handler logic untested | OPEN | **FIXED** | - |
| QA-NEW-06 | Tautological tests (`expect(true).toBe(true)`) in usage-tracking.test.ts | OPEN | **STILL OPEN** (expanded: 11 instances found + 7 more in other files = **18 total**) | HIGH |
| QA-NEW-07 | `reactivateFromTrial` partial failure scenario untested | OPEN | **STILL OPEN** | MEDIUM |

### New QA Gaps (6th Audit)

| # | Description | Severity |
|---|-------------|----------|
| QA-NEW-08 | Bearer token auth test `.skip`-ped in `cron-routes.test.ts:270` | MEDIUM |
| QA-NEW-09 | 7 tests `.todo` in `real-user-scenarios.test.ts` (lines 247, 311, 319, 388, 396, 404, 412) | LOW |
| QA-NEW-10 | Webhook idempotency "integration" tests mock entire service-core, no real DB integration | MEDIUM |

**6th Audit QA Details:**

- **QA-NEW-06 expanded**: Beyond the 11 instances in `usage-tracking.test.ts`, found 7 more across: `billing-customer-sync.test.ts:318`, `addon.service.test.ts:315`, `exchange-rates/convert.test.ts:41`, `performance-stack.test.ts:376`, `e2e/owner/registration-trial.test.ts:650`, `e2e/setup.test.ts:35`. Total: **18 tautological tests** that always pass.

- **QA-NEW-08**: `cron-routes.test.ts:270` has `it.skip('should accept request with valid Bearer token in Authorization header')`. This is a critical security test that validates cron endpoint authentication.

- **QA-NEW-10**: `webhook-idempotency.test.ts` mocks `@repo/service-core` completely (line 78). Tests verify HTTP 200 responses only, not actual database-level deduplication. Comments in file acknowledge "requires DB access to verify" the real behavior.

---

## INFO ITEMS (Intentional Design Decisions)

---

### GAP-32: enforcePropertiesLimit is intentional stub

```
Audit: 2nd | Status: INTENTIONAL (6th audit confirmed) | Priority: INFO
```

Line 569: `const currentPropertyCount = 0;` with detailed FUTURE FEATURE comment.

---

### GAP-33: Dunning retry schedule [1,3,5,7] vs spec [1,3,7]

```
Audit: 2nd | Status: INTENTIONAL (6th audit confirmed) | Priority: INFO
```

Deliberate change for Argentine payment ecosystem. Well-documented.

---

### GAP-34: enforceStaffLimit is intentional stub

```
Audit: 2nd | Status: INTENTIONAL (6th audit confirmed) | Priority: INFO
```

Line 681: `const currentCount = 0;` with FUTURE FEATURE comment. Requires `staff_invitations` system.

---

## ITEMS DELEGATED TO OTHER SPECS

| Item | Delegated To | Status |
|---|---|---|
| BILL-15: IVA/tax handling | SPEC-028-iva-tax-handling | Spec created, not started |
| Webhook subscription sync (full DB sync) | SPEC-027-webhook-subscription-sync | Spec created, not started |
| SQL injection in billing-metrics.service.ts | SPEC-019 US-17 | FIXED |
| Billing IDOR protection (resource-level) | SPEC-019 US-04 | Partially implemented via SPEC-021 |
| Addon/promo-code service decomposition (>500 lines) | SPEC-020 QUAL-03 | Spec created, not started |
| i18n of billing admin pages | SPEC-022 I18N-01/I18N-03 | Spec created, not started |
| Cache middleware using Web Cache API | SPEC-022 PERF-02 | Spec created, not started |
| **Addon entitlement architecture (global plan vs per-subscription)** | **NEW SPEC NEEDED** | **Not created** |
| **BaseModel soft-delete default filter** | **NEW SPEC NEEDED** | **Not created** |

---

## CONSOLIDATED SUMMARY TABLE (6th Audit - 2026-03-07)

| # | Gap | Severity | Priority | Status | Blocks Launch? | Fix Type | Expert |
|---|-----|----------|----------|--------|----------------|----------|--------|
| **5TH-08** | **Addon entitlements modify global plan** | **CRITICAL** | **P0** | **OPEN** | **YES** | **New SPEC** | **BIZ** |
| 2 | Soft-delete not excluded from count | CRITICAL | P1 | OPEN | YES | Direct fix | DB |
| NEW-01 | Race condition + missing DB transactions | CRITICAL | P1 | OPEN | YES | Direct fix | DB+BIZ |
| 4TH-01 | Error internals exposed in responses | CRITICAL | P1 | OPEN | YES | Direct fix | SEC |
| 6TH-SEC-02 | Trial start exposes errorMessage to user | HIGH | P1 | NEW | Rec. | Direct fix | SEC |
| 4 | No notification on dunning cancellation | HIGH | P1 | OPEN | Rec. | Direct fix | BIZ |
| 24 | Grace period not on protected routes | HIGH | P1 | OPEN | Rec. | Direct fix | BIZ+SEC |
| 4TH-03 | No rate limiting for billing operations | HIGH | P1 | OPEN | Rec. | Direct fix | SEC |
| 5TH-BIZ-01 | Plan-change price comparison ignores interval | HIGH | P1 | OPEN | Rec. | Direct fix | BIZ |
| 5TH-BIZ-07 | Billing settings DB have no effect on crons | HIGH | P1 | OPEN | Rec. | Direct fix | BIZ |
| 6TH-DB-01 | findAllWithRelations count inconsistency | HIGH | P2 | NEW | Rec. | Direct fix | DB |
| 5 | No cache clear after trial extend | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 19 | No cache clear after plan change | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 20 | No cache clear after reactivation | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 22 | Webhook stub no cache invalidation | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 31 | Payment method route not exempt | HIGH | P2 | OPEN | Rec. | Direct fix | SEC |
| NEW-02 | Trial reminder idempotency collision | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 4TH-04 | billingAuthMiddleware checks user not actor | HIGH | P2 | OPEN | Rec. | Direct fix | SEC |
| 4TH-05 | Middlewares fail open on errors | HIGH | P2 | OPEN | Rec. | Direct fix | SEC |
| 4TH-06 | addon-expiry idempotency resets on run | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 4TH-07 | Batch queries without pagination (OOM risk) | HIGH | P2 | OPEN | Rec. | Direct fix | DB |
| 4TH-08 | billing_notification_log ON DELETE RESTRICT | HIGH | P2 | OPEN | Rec. | Direct fix | DB |
| 4TH-11 | past_due not in status map | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| 4TH-15 | subscription_events metadata NOT NULL mismatch | HIGH | P2 | OPEN | Rec. | Direct fix | DB |
| 4TH-17 | dunning_attempts paymentId UUID mismatch | HIGH | P2 | OPEN | Rec. | Direct fix | DB |
| NEW-04 | one_time creates recurring subscription | HIGH | P2 | OPEN | Rec. | Direct fix | BIZ |
| NEW-10 | findWithRelations ignores relations param | HIGH | P2 | OPEN | Rec. | Separate SPEC | DB |
| 5TH-DB-02 | Addon purchases orphaned on sub deletion | HIGH | P2 | OPEN | Rec. | Direct fix | DB |
| 5TH-DB-05 | BaseModel no default soft-delete filter | HIGH | P2 | OPEN | Rec. | Separate SPEC | DB |
| 6 | Missing v1-launch-strategy.md | MEDIUM | P2 | OPEN | No | Direct fix | BIZ |
| 6TH-SEC-01 | Error internals in admin billing routes | MEDIUM | P3 | NEW | No | Direct fix | SEC |
| 6TH-DB-02 | billing_notification_log no purge mechanism | MEDIUM | P3 | NEW | No | Direct fix | DB |
| 6TH-DB-03 | dunning_attempts customerId ON DELETE RESTRICT | MEDIUM | P3 | NEW | No | Direct fix | DB |
| 6TH-DB-04 | Inconsistent FK cascade in dunning_attempts | MEDIUM | P3 | NEW | No | Direct fix | DB |
| 9 | Trial extend returns 200 on error | MEDIUM | P3 | OPEN | No | Direct fix | BIZ |
| 21 | Notification retryService null | MEDIUM | P3 | OPEN | No | Direct/defer | BIZ |
| 27 | COMPLEX user trial not implemented | MEDIUM | P3 | OPEN | Depends | Product decision | BIZ |
| NEW-05 | No audit log in reactivations | MEDIUM | P3 | OPEN | No | Direct fix | BIZ |
| NEW-08 | Trial block notification lost on lookup fail | MEDIUM | P3 | PARTIAL | No | Direct fix | BIZ |
| 4TH-10 | Webhook without specific rate limiting | MEDIUM | P3 | OPEN | No | Direct fix | SEC |
| 4TH-12 | payment.created dead letter auto-resolved | MEDIUM | P3 | NEEDS INVEST. | No | Direct fix | BIZ |
| 4TH-13 | Trial reminders overlapping datasets | MEDIUM | P2 | OPEN | No | Direct fix | BIZ |
| 4TH-14 | dunning_attempts index not UNIQUE | MEDIUM | P3 | OPEN | No | Direct fix | DB |
| 4TH-16 | promo code usage outside transaction | MEDIUM | P3 | OPEN | No | Direct fix | DB |
| 4TH-23 | billing_settings updatedBy without FK | MEDIUM | P3 | OPEN | No | Direct fix | DB |
| 5TH-BIZ-02 | Promo code validate discloses details | MEDIUM | P3 | OPEN | No | Direct fix | BIZ |
| 5TH-BIZ-09 | startTrialRoute mixes error cases | MEDIUM | P3 | OPEN | No | Direct fix | BIZ |
| 5TH-DB-01 | blockExpiredTrials no concurrent lock | MEDIUM | P3 | OPEN | No | Direct fix | DB |
| 5TH-DB-03 | dunning_attempts metadata nullable mismatch | MEDIUM | P3 | OPEN | No | Direct fix | DB |
| 5TH-DB-04 | addon addonId nullable + RESTRICT | MEDIUM | P3 | OPEN | No | Direct fix | DB |
| 7 | manual-qa-checklist wrong path | LOW | P3 | PARTIAL | No | Direct fix | - |
| 13 | Trial expiry accommodation behavior undoc | LOW | P3 | PARTIAL | No | Direct fix | - |
| 6TH-SEC-03 | requestProviderEventIds happy path leak | LOW | P4 | NEW | No | Direct fix | SEC |
| 4TH-20 | Route ordering /my vs /:slug (reclassified) | LOW | P4 | RECLASSIFIED | No | Direct fix | SEC |
| 16 | Smoke tests permissive | LOW | P4 | OPEN | No | Tech debt | QA |
| 17 | one_time interval undocumented | LOW | P4 | PARTIAL | No | See NEW-04 | - |
| 18 | TODOs.md broken doc paths | LOW | P4 | OPEN | No | Direct fix | - |
| 23 | search() missing soft-delete filter | LOW | P4 | OPEN | No | With GAP-02 | DB |
| NEW-09 | Env var name without prefix in docs | LOW | P4 | OPEN | No | Direct fix | - |
| 5TH-SEC-01 | billingAuthMiddleware duplicates auth | LOW | P4 | OPEN | No | Direct fix | SEC |
| 5TH-SEC-02 | requestProviderEventIds partial cleanup | LOW | P4 | PARTIAL | No | Direct fix | SEC |
| 5TH-BIZ-04 | Renewal reminder Math.ceil edge case | LOW | P4 | OPEN | No | Tech debt | BIZ |
| 5TH-BIZ-05 | Admin routes under /protected prefix | LOW | P4 | OPEN | No | Direct fix | BIZ |
| 5TH-BIZ-06 | reactivateFromTrial cancels already-cancelled | LOW | P4 | OPEN | No | Direct fix | BIZ |
| 5TH-DB-06 | billing_settings no indexes | LOW | P4 | OPEN | No | With 4TH-23 | DB |
| 5TH-DB-07 | trial-expiry dry-run loads all subs | LOW | P4 | OPEN | No | Direct fix | DB |
| 5TH-DB-08 | Missing addon_purchases composite index | LOW | P4 | OPEN | No | Direct fix | DB |
| **FIXED** | | | | | | | |
| 1 | LIST endpoints data leak | - | - | FIXED (5th) | - | - | SEC |
| 3 | Trial duplicate subscriptions | - | - | FIXED (5th) | - | - | BIZ |
| 8 | Grace period source of truth doc | - | - | FIXED (3rd) | - | - | - |
| 10 | Permission enum mismatch | - | - | FIXED (3rd) | - | - | - |
| 11 | HTTP integration tests missing | - | - | FIXED (5th) | - | - | QA |
| 12 | Dispute handling doc contradictions | - | - | FIXED (3rd) | - | - | - |
| 14 | AFIP manual process docs | - | - | FIXED (3rd) | - | - | - |
| 25 | WEB_URL env var | - | - | FIXED (3rd) | - | - | - |
| 26 | Limit enforcement 403 vs 402 | - | - | FIXED (3rd) | - | - | - |
| 28 | SUBSCRIPTION_CANCELLED type missing | - | - | FIXED (3rd) | - | - | - |
| 29 | Grace/dunning period ambiguity | - | - | FIXED (5th) | - | - | BIZ |
| 30 | `as never` cast in count | - | - | FIXED (5th) | - | - | DB |
| 4TH-02 | PATCH not blocked | - | - | FIXED (5th) | - | - | SEC |
| 4TH-09 | customerId exposed in response | - | - | FIXED (5th) | - | - | SEC |
| 4TH-18 | addon-expiry cache clearing inconsistent | - | - | FIXED (6th) | - | - | BIZ |
| 4TH-19 | Deprecated webhookEventIds exported | - | - | FIXED (6th) | - | - | SEC |
| 4TH-21 | Hardcoded URL fallback | - | - | FIXED (6th) | - | - | SEC |
| 4TH-22 | Notification dates without validation | - | - | FIXED (5th) | - | - | SEC |
| 5TH-SEC-03 | Promo validate uses body userId | - | - | FIXED (6th) | - | - | SEC |
| 5TH-BIZ-03 | Addon purchase without subscription | - | - | FIXED (6th) | - | - | BIZ |
| NEW-03 | Custom billing routes lack ownership | - | - | FIXED (5th) | - | - | SEC |
| NEW-06 | Role checks instead of PermissionEnum | - | - | FIXED (6th) | - | - | SEC+BIZ |
| QA-09 | Ownership tests `as never` | - | - | FIXED (6th) | - | - | QA |
| QA-11 | Nested resource paths untested | - | - | FIXED (5th) | - | - | QA |
| QA-NEW-05 | Addons handler tests | - | - | FIXED (6th) | - | - | QA |
| **INFO** | | | | | | | |
| 32 | enforcePropertiesLimit stub | INFO | - | INTENTIONAL | No | Future feature | - |
| 33 | Dunning schedule [1,3,5,7] vs [1,3,7] | INFO | - | INTENTIONAL | No | Documented | - |
| 34 | enforceStaffLimit stub | INFO | - | INTENTIONAL | No | Future feature | - |

---

## RECOMMENDED FIX BATCHING (6th Audit - Updated)

### Batch A: Security CRITICAL + HIGH (pre-launch mandatory)
- GAP-4TH-01 + GAP-6TH-SEC-02 + GAP-6TH-SEC-01: Sanitize ALL error responses + proper HTTP codes (also fixes GAP-09, GAP-5TH-BIZ-09)
- GAP-4TH-03 + GAP-5TH-BIZ-02: Billing-specific rate limiting (include promo validate)
- GAP-4TH-04 + GAP-5TH-SEC-01: billingAuthMiddleware use actor instead of user
- GAP-4TH-20: Fix route ordering /my vs /:slug in addonsRouter (cosmetic, Hono handles it)

### Batch B: Data Integrity CRITICAL (pre-launch mandatory)
- GAP-02 + GAP-23: Soft-delete filters in AccommodationModel (all 4 methods including findTopRated)
- GAP-NEW-01: Transaction wrapping in reactivation flows (compensation pattern)

### Batch C: Entitlement Cache (single PR)
- GAP-05, GAP-19, GAP-20, GAP-22: Add `clearEntitlementCache()` calls in extendTrial, planChange, reactivateFromTrial, reactivateSubscription, processSubscriptionUpdated

### Batch D: Grace Period (single PR)
- GAP-24: Apply pastDueGraceMiddleware globally on protected routes
- GAP-31: Add payment-methods to exempt paths
- GAP-4TH-05: Fail-closed behavior on middleware errors (or ADR for accepted risk)

### Batch E: Notifications (single PR)
- GAP-04: Send notification on dunning cancellation
- GAP-NEW-02 + GAP-4TH-13 + GAP-6TH-BIZ-02: Fix idempotency key + overlapping datasets
- GAP-4TH-06: addon-expiry Redis-backed idempotency
- GAP-NEW-08: Restructure trial block notification flow

### Batch F: DB Schema Fixes (single migration PR)
- GAP-4TH-08: billing_notification_log change to ON DELETE SET NULL
- GAP-4TH-14: dunning_attempts uniqueIndex
- GAP-4TH-15 + GAP-5TH-DB-03: metadata NOT NULL alignment (subscription_events + dunning_attempts)
- GAP-4TH-17: dunning_attempts paymentId varchar
- GAP-4TH-23 + GAP-5TH-DB-06: billing_settings updatedBy FK
- GAP-5TH-DB-02: addon_purchases subscriptionId cascade or trigger
- GAP-5TH-DB-04: addon_purchases addonId ON DELETE SET NULL
- GAP-5TH-DB-08: addon_purchases composite index
- GAP-6TH-DB-03 + GAP-6TH-DB-04: dunning_attempts FK alignment (both to SET NULL)

### Batch G: Business Logic Fixes (single PR)
- GAP-4TH-11: Add past_due to QZPAY_TO_HOSPEDA_STATUS map
- GAP-NEW-04: Reject one_time in plan change flow
- GAP-5TH-BIZ-01: Normalize price comparison by intervalCount
- GAP-5TH-BIZ-07: Document billing settings vs constants relationship
- GAP-NEW-05: Add audit logging in reactivation flows
- GAP-5TH-BIZ-06: Don't cancel already-cancelled subscriptions

### Batch H: Quick Fixes (single PR)
- GAP-6TH-SEC-03: Clean requestProviderEventIds on success
- GAP-5TH-SEC-02: Same cleanup
- GAP-5TH-DB-07: Filter dry-run by status
- GAP-5TH-BIZ-05: Document admin routes under /protected

### Batch I: NEW SPEC REQUIRED
- **GAP-5TH-08**: Addon entitlement architecture (global plan mutation) - CRITICAL, requires architectural rethink
- **GAP-5TH-DB-05 + GAP-6TH-DB-01**: BaseModel soft-delete default filter + count consistency - HIGH, affects all models
- **GAP-NEW-10**: findWithRelations broken base implementation - HIGH, separate SPEC

### Batch J: Test Coverage (parallel with code fixes)
- QA-02 (CRITICAL): Webhook idempotency tests must verify business logic non-execution
- QA-01 (HIGH): Add tests for enforceFavoritesLimit, enforcePropertiesLimit, enforceStaffAccountsLimit
- QA-03 (HIGH): Add concurrent request tests for reactivation
- QA-07 (HIGH): Actually assert X-Usage-Warning header (remove tautological tests)
- QA-12 (HIGH): Test processPayment/getDefaultPaymentMethod callbacks with real invocations
- QA-NEW-06 (HIGH): Replace all 18 `expect(true).toBe(true)` with real assertions
- QA-NEW-08 (MEDIUM): Unskip Bearer token auth test in cron-routes
- QA-NEW-10 (MEDIUM): Add real DB integration for webhook idempotency tests

---

## 7TH REVIEW: TRIAGE DECISIONS (2026-03-08)

Session review with 4 verification agents (Security, DB Schema, Cache/Biz Logic, Critical).
Each gap was verified against current code, false positives identified, and decisions taken.

### Verification Results

| Gap | Audit Claim | Agent Verdict |
|-----|-------------|---------------|
| GAP-4TH-15 | metadata NOT NULL mismatch | **FALSE POSITIVE** - schema has `.notNull().default({})` correctly |
| GAP-NEW-02 | Idempotency key collision | Initially marked FALSE POSITIVE, then **CONFIRMED REAL** after deep analysis |
| GAP-5TH-08 | Addon modifies global plan | **CONFIRMED CRITICAL** - QZPay `plans.update()` modifies global `billing_plans` table |
| GAP-4TH-04 | billingAuth uses user not actor | **RECLASSIFIED** from HIGH to MEDIUM - architectural inconsistency, not active bug |

### Decision Summary

| Decision | Count |
|----------|-------|
| **HACER (DO)** | 58 |
| **POSTERGAR (DEFER)** | 5 (1 to SPEC-038, 4 to BaseModel spec) |
| **DESCARTAR (DISCARD)** | 2 (GAP-27, GAP-NEW-09) |

### Implementation Batches (approved)

**Batch A: Security - Error Sanitization + HTTP Codes**
- GAP-4TH-01 + GAP-6TH-SEC-01 + GAP-6TH-SEC-02 + GAP-09 + GAP-5TH-BIZ-09
- Pattern: Use existing `HOSPEDA_API_DEBUG_ERRORS` env var from SPEC-037
- Complexity: 3/10

**Batch B: Data Integrity - Soft-delete + Transactions**
- GAP-02: Add `isNull(deletedAt)` to all 4 AccommodationModel methods
- GAP-NEW-01: Wrap reactivation flows in db.transaction() + compensation pattern
- Complexity: 4/10

**Batch C: Entitlement Cache Clearing**
- GAP-05, GAP-19, GAP-20, GAP-22
- Add `clearEntitlementCache(customerId)` in extendTrial, planChange, reactivateFromTrial, reactivateSubscription, processSubscriptionUpdated
- Complexity: 2/10

**Batch D: Grace Period Global + Fail-Open ADR**
- GAP-24: Apply pastDueGraceMiddleware globally on `/api/v1/protected/*`
- GAP-31: Add `/payment-methods` to exempt paths
- GAP-4TH-05: ADR documenting fail-open as accepted risk + Sentry alerts. Future: migrate to circuit breaker (Option C)
- Complexity: 3/10

**Batch E: Notifications - Dunning + Idempotency + Expiry**
- GAP-04: Send notification on dunning cancellation
- GAP-NEW-02 + GAP-4TH-13: Fix idempotency key (add daysAhead) + change `<=` to `===` in findTrialsEndingSoon
- GAP-4TH-06: addon-expiry use billing_notification_log instead of in-memory Set
- GAP-NEW-08: Restructure trial block notification flow
- Complexity: 3/10

**Batch F: DB Schema Fixes (single migration)**
- GAP-4TH-08: billing_notification_log ON DELETE SET NULL
- GAP-4TH-14: dunning_attempts uniqueIndex
- GAP-4TH-15: Verify/align metadata NOT NULL (may be false positive)
- GAP-4TH-17: dunning_attempts paymentId varchar instead of uuid
- GAP-4TH-23 + GAP-5TH-DB-06: billing_settings updatedBy FK + indexes
- GAP-5TH-DB-02: addon_purchases subscriptionId cascade/trigger for orphan cleanup
- GAP-5TH-DB-03: dunning_attempts metadata .notNull() alignment
- GAP-5TH-DB-04: addon_purchases addonId NOT NULL or SET NULL
- GAP-5TH-DB-08: addon_purchases composite index (customerId, status, expiresAt)
- GAP-6TH-DB-03 + GAP-6TH-DB-04: dunning_attempts FK alignment (both to SET NULL)
- Complexity: 3/10

**Batch G: Business Logic Fixes**
- GAP-4TH-11: Add past_due to QZPAY_TO_HOSPEDA_STATUS map
- GAP-NEW-04: Reject one_time in plan change flow (QZPay has separate payment flow)
- GAP-5TH-BIZ-01: Normalize price comparison by intervalCount
- GAP-NEW-05: Add audit logging in reactivation flows
- GAP-4TH-16: Move recordPromoCodeUsage inside transaction
- GAP-5TH-BIZ-06: Don't cancel already-cancelled subscriptions
- GAP-5TH-BIZ-07: Cron jobs read from DB settings instead of compile-time constants (Option A)
- Complexity: 3/10

**Batch H: Quick Fixes**
- GAP-6TH-SEC-03 + GAP-5TH-SEC-02: Clean requestProviderEventIds on success path
- GAP-5TH-DB-07: Filter dry-run by status
- GAP-4TH-20: Fix route ordering /my vs /:slug
- GAP-5TH-BIZ-05: Move admin routes from /protected to /admin prefix
- Complexity: 1/10

**Batch I: Rate Limiting + Promo Disclosure**
- GAP-4TH-03: Add billing category to rate limiter with restrictive limits for financial POST ops
- GAP-4TH-10: Webhook-specific rate limiting
- GAP-5TH-BIZ-02: Limit promo code validation response to minimum necessary fields
- Complexity: 3/10

**Batch J: Test Coverage (all QA gaps)**
- QA-02 (CRITICAL): Webhook idempotency verify business logic non-execution
- QA-01 (HIGH): Tests for enforceFavoritesLimit, enforcePropertiesLimit, enforceStaffAccountsLimit
- QA-03 (HIGH): Concurrent request tests for reactivation
- QA-05 (HIGH): Deep webhook concurrency tests with DB state verification
- QA-07 (HIGH): Assert X-Usage-Warning header
- QA-12 (HIGH): Test processPayment/getDefaultPaymentMethod with real invocations
- QA-NEW-06 (HIGH): Replace all 18 `expect(true).toBe(true)` with real assertions
- QA-04 (MEDIUM): chargebacks/dispute dead letter retry tests
- QA-06 (MEDIUM): trialing + downgrade plan change tests
- QA-08 (MEDIUM): Verify clearEntitlementCache in blockExpiredTrials test
- QA-10 (MEDIUM): purgeStaleFallbackEntries TTL tests
- QA-NEW-01 (MEDIUM): billing/settings.ts handler tests
- QA-NEW-02 (MEDIUM): billing/metrics.ts handler tests
- QA-NEW-03 (MEDIUM): billing/notifications.ts handleCleanup tests
- QA-NEW-04 (MEDIUM): search-index-refresh cron job tests
- QA-NEW-07 (MEDIUM): reactivateFromTrial partial failure tests
- QA-NEW-08 (MEDIUM): Unskip Bearer token auth test
- QA-NEW-09 (LOW): Implement 7 .todo tests in real-user-scenarios
- QA-NEW-10 (MEDIUM): Real DB integration for webhook idempotency
- Complexity: 3/10

**Batch K: Documentation + Misc**
- GAP-06: Create v1-launch-strategy.md
- GAP-07: Fix manual-qa-checklist.md path reference
- GAP-13: Document trial expiry behavior (grace period, then block, accommodation unpublished but data retained)
- GAP-18: Fix TODOs.md broken doc paths
- GAP-16: Fix smoke tests permissive assertions
- GAP-5TH-BIZ-04: Fix Math.ceil edge case in renewal reminders
- GAP-4TH-12: Investigate and fix payment.created dead letter auto-resolve
- GAP-21: Implement notification retryService
- GAP-6TH-DB-02: Add purge cron for billing_notification_log
- GAP-5TH-DB-01: Add idempotency guard for blockExpiredTrials concurrent runs
- Complexity: 2/10

### Deferred to Separate SPECs

**SPEC-038: Addon Entitlements Architecture** (already created)
- GAP-5TH-08: Change from plans.update() to per-customer entitlements/limits
- Location: `.claude/specs/SPEC-038-addon-entitlements-architecture/spec.md`

**New SPEC needed: BaseModel DB Improvements**
- GAP-NEW-10: Fix findWithRelations() to actually use relations parameter
- GAP-5TH-DB-05: Add automatic soft-delete filter to BaseModel
- GAP-6TH-DB-01: Fix count consistency in findAllWithRelations
- GAP-23: AccommodationModel.search() soft-delete (covered by BaseModel fix)

### Discarded

- **GAP-27:** COMPLEX user trial auto-start. Intentional product decision, not a bug.
- **GAP-NEW-09:** Env var prefix in docs. Covered by SPEC-035.

### Reference Files

- Descartados: `.claude/gaps-descartados.md`
- Postergados: `.claude/gaps-postergados.md`
