# SPEC-043: Addon Lifecycle Events

**Status**: completed
**Created**: 2026-03-16
**Updated**: 2026-04-08
**Priority**: HIGH
**Complexity**: medium-high
**Template**: spec-full
**Origin**: SPEC-038 gaps GAP-038-01 (subscription cancellation cleanup) and GAP-038-04 (plan change recalculation)

---

## Overview

SPEC-038 fixed the core addon entitlement architecture (global plan mutation, double INSERT, cron bug, sourceId mapping). Two gaps were explicitly deferred as out-of-scope and assigned to this spec:

1. **GAP-038-01** (HIGH): When a subscription is cancelled, the system does not revoke addon entitlements. Active addon purchases linked to a cancelled subscription continue granting capabilities indefinitely.

2. **GAP-038-04** (MEDIUM): When a customer changes subscription plan (upgrade or downgrade), addon limit contributions are not recalculated against the new plan's base limits. The combined limit may be stale or incorrect after a plan change.

This spec defines the behavior, user stories, acceptance criteria, and technical constraints for handling both lifecycle events. It references exact QZPay API methods and existing service patterns to eliminate ambiguity for implementers.

---

## Goals

1. Ensure addon entitlements are revoked when a subscription is cancelled, regardless of the cancellation source (MercadoPago webhook, admin action, API call).
2. Ensure addon limit contributions are recalculated correctly when a customer changes plans, aggregating ALL active addon increments per limitKey.
3. Guarantee these operations are idempotent .. running them twice for the same event produces the same result, with partial progress preserved across retries.
4. Guarantee graceful degradation when QZPay is temporarily unavailable during revocation, with an internal retry mechanism.
5. Provide a full audit trail for every revocation and recalculation event.
6. Protect customers from data loss during downgrade scenarios where combined limits would fall below current usage.

---

## Success Metrics

- When a subscription is cancelled, 100% of active addon purchases linked to that subscription transition to `canceled` status within the same operation (or across retries if partial failure occurs).
- When a subscription is cancelled, 100% of QZPay entitlements and limits with `source='addon'` and `sourceId` matching a canceled purchase are revoked.
- When a plan changes, the customer's QZPay limits reflect `new_plan_base_limit + sum(ALL active addon_limit_increments for that limitKey)` for all limit keys affected by active addons.
- Zero cases where a customer retains entitlements or inflated limits after subscription cancellation.
- Every revocation and recalculation event produces a structured log entry traceable by `customerId`, `subscriptionId`, and `eventType`.
- Temporary QZPay unavailability during revocation does not cause data inconsistency. Failed revocations are retried via a hybrid approach: MercadoPago native retries when the webhook returns 500 (primary), and a cron safety net for orphaned active addons on canceled subscriptions (secondary). After 3 cron retries, cases are escalated to Sentry for manual review.

---

## Actors

| Actor | Description |
|-------|-------------|
| Customer | An accommodation owner with a subscription and one or more active addon purchases |
| Platform operator | Admin with `MANAGE_SUBSCRIPTIONS` permission to cancel subscriptions or change plans manually |
| MercadoPago webhook | External webhook delivering `subscription_preapproval.updated` events for ALL subscription state changes (cancellation, plan change, pause, reactivation). IPN webhook payload: `{ id: number, live_mode: boolean, type: "subscription_preapproval", date_created: string, user_id: number, api_version: string, action: "subscription_preapproval.updated", data: { id: string } }` (MercadoPago uses snake_case in payloads; qzpay-hono may transform to camelCase internally). NOTE: `application_id` and `version` are NOT in the webhook payload.. they appear in the `GET /preapproval/{id}` response. Only `type`, `action`, and `data.id` are relevant for this spec. |
| QZPay billing engine | `@qazuor/qzpay-core@1.2.0` .. per-customer entitlement and limit store, accessed via `getQZPayBilling()` from `apps/api/src/middlewares/billing.ts` |
| Addon entitlement middleware | `apps/api/src/middlewares/entitlement.ts` .. in-memory cache (TTL 5min, max 1000 entries) that caches entitlements per request; must be invalidated after changes via `clearEntitlementCache(customerId)` |
| Addon expiry cron | `apps/api/src/cron/jobs/addon-expiry.job.ts` .. runs daily at 05:00 UTC; may overlap with subscription cancellation for expiring addons; mitigated by idempotency |

---

## Scope

### In Scope

- Revocation of addon entitlements when a subscription is cancelled via MercadoPago webhook.
- Creation of a new admin route `POST /api/v1/admin/billing/subscriptions/:id/cancel` for manual subscription cancellation with addon cleanup.
- Revocation of addon entitlements when a subscription is cancelled via the new admin cancellation route.
- Recalculation of addon limit contributions when a subscription plan changes (upgrade or downgrade), triggered primarily from the plan-change route (synchronous) and secondarily via webhook planId comparison (safety net).
- Plan change detection in the `subscription_preapproval.updated` webhook handler (comparing `planId`, not just status) as a safety net only.. the primary trigger is the plan-change route.
- Handling the edge case where a downgrade would result in combined limits below the customer's current usage.
- Audit logging for all revocation and recalculation operations.
- Idempotency: repeat processing of the same cancellation event must not produce duplicate revocations or double-removals. Partial progress is preserved across retries.
- Entitlement cache invalidation after revocation and recalculation.
- Notification to customers affected by downgrade-triggered limit reductions (informational, not blocking), dispatched via `@repo/notifications` as an in-app notification.
- Database migration to add index on `billing_addon_purchases.subscription_id`.
- New `PLAN_DOWNGRADE_LIMIT_WARNING` value in `NotificationType` enum, with corresponding React Email template and `selectTemplate()` case in `notification.service.ts`.
- Shared `recalculateAddonLimitsForCustomer()` function for aggregated limit re-recalculation, used by Flow B and individual addon cancellation (AC-3.9). NOTE: Flow A (subscription cancellation) does NOT use this function.. it uses direct `removeBySource()`/`remove()` for each addon since ALL addons are being revoked.
- Modification of `cancelUserAddon()` to use re-recalculation for limit-type addons instead of relying on `removeBySource` fallback (AC-3.9).

### Out of Scope

- Refunding addon payments when a subscription is cancelled (handled by payment processor and billing team policy).
- Partial refunds for pro-rated addon usage (future spec).
- Automatic re-application of addon entitlements if a subscription is reactivated after cancellation (future spec).
- Bulk cancellation tooling for admins (covered by existing admin routes).
- Changes to the MercadoPago webhook parsing layer beyond routing the cancellation/plan-change status to the new handlers.
- Performance optimization for high-volume webhook processing (deferred; current load does not justify it).
- Admin UI changes beyond error message display for failed cancellation (frontend spec).

---

## Technical Context

This section documents codebase facts that constrain the implementation. All claims have been verified against the actual source code.

### Spelling Disambiguation (IMPORTANT)

The codebase uses INCONSISTENT spelling for "canceled/cancelled" across different systems. Implementers MUST use the correct spelling for each context:

| Table / System | Status Column Value | Spelling |
|-------|-------------------|----------|
| `billing_addon_purchases` | `canceled` | American (1 L) |
| `billing_subscriptions` | `CANCELLED` / `cancelled` | British (2 L) |
| MercadoPago API | `cancelled` | British (2 L) |
| QZPay internal | `canceled` | American (1 L) |

Note: The mapping between QZPay and Hospeda subscription statuses happens in `QZPAY_TO_HOSPEDA_STATUS` in `subscription-logic.ts`.

### MercadoPago Webhook Architecture

MercadoPago does NOT send separate event types for cancellation vs plan change. It sends a single event type: **`subscription_preapproval.updated`** for ALL subscription state changes. The current handler (`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`) processes this by:

1. Extracting the MercadoPago preapproval ID from the webhook payload: `{ id: number, type: "subscription_preapproval", action: "subscription_preapproval.updated", data: { id: string } }`
2. Fetching current subscription state from MercadoPago API via `paymentAdapter.subscriptions.retrieve(mpPreapprovalId)`
3. Mapping QZPay status to `SubscriptionStatusEnum` via `QZPAY_TO_HOSPEDA_STATUS`: `{ active: ACTIVE, paused: PAUSED, canceled: CANCELLED, finished: EXPIRED, past_due: PAST_DUE, pending: null }`
4. Updating the local `billing_subscriptions` table

**Current gap (must be fixed by this spec):** The handler currently only detects STATUS changes (`if (previousStatus === mappedStatus) return`). It does NOT detect plan ID changes. If the plan changes but the status stays `active`, the handler exits early and skips addon recalculation. This spec requires adding plan ID comparison logic.

**Webhook error response behavior (verified in qzpay-hono source):** The `handleWebhookError` in `event-handler.ts` returns `undefined`. When `onError` returns `undefined`, `@qazuor/qzpay-hono@1.1.1` checks `if (result)` which is falsy for undefined, then falls through to `response.error(message, 500)`, returning an **HTTP 500** response. This means MercadoPago WILL automatically retry failed webhook deliveries. (Verified at `node_modules/@qazuor/qzpay-hono/dist/index.js` lines 429-434.)

MercadoPago retry policy: expects webhook endpoint response within **22 seconds**. Any response outside this window triggers retries. If no 2xx (200/201) confirmation is received, retries automatically (verified against official MercadoPago documentation):
- Retries: 0min, 15min, 30min, then extended intervals (6h, 48h, 96h, 96h). Total retry window exceeds 4 days.
- Source: MercadoPago official webhook documentation (mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks).

**Webhook processing time constraint:** The webhook handler MUST acknowledge quickly. The current implementation fetches subscription data and processes inline. Given that a customer typically has 1-3 active addons, and each QZPay revocation is a local DB operation (~5-10ms), the total processing time should remain well under 22 seconds. If addon count per customer grows significantly in the future, consider refactoring to async processing (acknowledge with 200 immediately, process via job queue).

The spec's cron safety net must coexist with active MercadoPago retries without conflict (guaranteed by idempotency.. only `status='active'` purchases are processed).

**Auto-cancellation by MercadoPago:** MercadoPago automatically cancels subscriptions after 3 consecutive failed payment attempts. This triggers a `subscription_preapproval.updated` webhook with status `cancelled`. Flow A handles this identically to any other cancellation source.. no special logic needed.

### Webhook Error Handling Strategy

This spec uses a **hybrid retry approach** that leverages both MercadoPago's native retries and an internal safety net:

1. **MercadoPago retries (primary):** If QZPay revocation fails during webhook processing and the error propagates to the webhook handler, MercadoPago receives a 500 response and retries automatically per the schedule above. The cancellation handler is idempotent (only processes `status='active'` addon purchases), so retries are safe.

2. **Internal cron safety net (secondary):** The addon expiry cron job (`addon-expiry.job.ts`) is extended with a new phase that queries for addon purchases that are still `status='active'` but linked to a `canceled` subscription. This catches cases where:
   - The webhook error did NOT propagate (e.g., partial success where some addons were revoked but the handler returned 200).
   - MercadoPago retries were exhausted without success.
   - The subscription was canceled via admin action and the initial revocation partially failed.

3. **Retry tracking:** Failed revocation attempts are tracked in the addon purchase's `metadata` JSONB field under key `revocationRetryCount` (integer) and `lastRevocationAttempt` (ISO timestamp). The cron job increments this counter on each attempt. After 3 cron retries (separate from MercadoPago retries), the operation is flagged in Sentry for manual review and no further automatic retries are attempted.

   **Implementation note:** The `billing_addon_purchases` table has a `metadata` JSONB column (defined in the schema as `metadata: jsonb('metadata').$type<Record<string, unknown>>()`). The `revocationRetryCount` and `lastRevocationAttempt` keys are stored within this existing JSONB field. No schema migration is needed for metadata.. only the subscription_id index migration is required.

4. **Admin manual cancellation** does NOT use either retry mechanism .. it returns an error directly to the admin (AC-2.2).

### Concurrency: Webhook vs Admin Cancellation

When a webhook cancellation and admin cancellation arrive simultaneously for the same subscription:

1. Both flows query `billing_addon_purchases WHERE subscriptionId = ? AND status = 'active' AND deleted_at IS NULL`
2. QZPay `revokeBySource()` is idempotent (returns 0 on second call, does not error)
3. The DB update uses `WHERE status = 'active'` as an optimistic lock.. the second writer finds 0 matching rows
4. **Strategy:** Rely on idempotency. No distributed lock needed. The first flow to update each addon "wins", the second is a no-op.
5. The admin flow's Phase 2 (subscription cancel) should check if already cancelled before calling QZPay.

### Addon Purchases with NULL subscriptionId

Addon purchases with `subscriptionId IS NULL` are orphaned (either created without a subscription link, or the subscription was deleted with `ON DELETE SET NULL`). Flow A does NOT affect these. They are handled by the existing addon-expiry cron job based on their own `expiresAt` date.

### QZPay Call Timeouts

QZPay operations are local database calls (not external API calls), so individual call timeouts are not a concern.

### Existing Service Behavior (important constraints)

**`AddonEntitlementService.removeAddonEntitlements()`** (`apps/api/src/services/addon-entitlement.service.ts:290-471`):
- Accepts `{ customerId, addonSlug, purchaseId }`
- Calls `billing.entitlements.revokeBySource('addon', purchaseId)` with fallback to `billing.entitlements.revoke(customerId, entitlementKey)`
- Calls `billing.limits.removeBySource('addon', purchaseId)` with fallback to `billing.limits.remove(customerId, limitKey)`
- **Treats QZPay errors as WARNINGS, not fatal** .. logs and continues execution
- Fetches active subscription via `billing.subscriptions.getByCustomerId()` and returns `{ success: true }` early if none found (for deprecated metadata cleanup step)

**This method CANNOT be reused directly for subscription cancellation** because:
1. Its error handling is lenient (warnings), but subscription cancellation needs strict error handling (QZPay failure must prevent DB status update).
2. It depends on finding an active subscription in QZPay, but during cancellation the subscription may already be marked `canceled` in QZPay.
3. The QZPay revocation calls (`revokeBySource`/`removeBySource`) themselves ARE subscription-state-independent and work correctly regardless.

**`cancelUserAddon()`** (`apps/api/src/services/addon.user-addons.ts:288`):
- Updates DB status to `canceled` FIRST, then calls `removeAddonEntitlements()` AFTER
- This is the opposite order from what subscription cancellation requires (QZPay first, DB second)

**Deprecated metadata note:** The existing `removeAddonEntitlements()` also cleans up `subscription.metadata.addonAdjustments` (a deprecated backward-compatibility field). During subscription cancellation, this metadata cleanup is NOT needed because the subscription itself is being cancelled, making the metadata irrelevant. The new method must NOT attempt to clean metadata.

**Implementation requirement:** Create a new method (e.g., `revokeAddonForSubscriptionCancellation()`) that:
1. Calls QZPay revocation directly (not via `removeAddonEntitlements()`)
2. Only updates DB status to `canceled` if QZPay revocation succeeds
3. Treats QZPay errors as fatal (not warnings)
4. Does NOT depend on subscription state in QZPay
5. Does NOT clean up deprecated `subscription.metadata.addonAdjustments` (irrelevant for cancelled subscriptions)

### QZPay API Surface (verified from `@qazuor/qzpay-core@1.2.0`)

**Entitlement methods** (`QZPayEntitlementService`):
- `check(customerId: string, entitlementKey: string): Promise<boolean>`
- `getByCustomerId(customerId: string): Promise<QZPayCustomerEntitlement[]>`
- `grant(input: QZPayGrantEntitlementInput): Promise<QZPayCustomerEntitlement>`
- `revoke(customerId: string, entitlementKey: string): Promise<void>`
- `revokeBySource(source: QZPaySourceType, sourceId: string): Promise<number>` .. returns count of revoked

**Subscription methods** (`QZPaySubscriptionService`):
- `cancel(id: string, options?: QZPayCancelSubscriptionOptions): Promise<QZPaySubscriptionWithHelpers>` .. options: `{ cancelAtPeriodEnd?: boolean, reason?: string }`. Already used in `apps/api/src/services/trial.service.ts` (lines 429, 650, 789, all without options). The `reason` field can be passed for admin cancellation to provide audit context.
- `changePlan(id: string, options: QZPayChangePlanOptions): Promise<QZPayChangePlanResult>` .. used in `apps/api/src/routes/billing/plan-change.ts` (line 211). Options include `{ newPlanId, newPriceId, prorationBehavior, applyAt }`. Returns `QZPayChangePlanResult` which is `{ subscription: QZPaySubscriptionWithHelpers, proration: { creditAmount: number, chargeAmount: number, effectiveDate: Date } | null }`. Access the subscription via `result.subscription`.
- `getByCustomerId(customerId: string): Promise<QZPaySubscriptionWithHelpers[]>` .. returns an ARRAY of subscriptions (not nullable single). Use `subscriptions[0]` or `.find()` to get the active one.

**Limit methods** (`QZPayLimitService`):
- `check(customerId: string, limitKey: string): Promise<QZPayLimitCheckResult>` .. returns `{ allowed, currentValue, maxValue, remaining }`
- `getByCustomerId(customerId: string): Promise<QZPayCustomerLimit[]>`
- `set(input: QZPaySetLimitInput): Promise<QZPayCustomerLimit>` .. input: `{ customerId, limitKey, maxValue, resetAt?, source?, sourceId? }`
- `remove(customerId: string, limitKey: string): Promise<void>`
- `removeBySource(source: QZPaySourceType, sourceId: string): Promise<number>` .. returns count of removed
- `increment(customerId: string, limitKey: string, amount?: number): Promise<QZPayCustomerLimit>`
- `recordUsage(customerId: string, limitKey: string, quantity: number, action?: 'set' | 'increment'): Promise<void>`

`QZPaySourceType = 'subscription' | 'purchase' | 'manual' | 'addon'`

**For downgrade usage check (AC-4.3):** Use `billing.limits.check(customerId, limitKey)` which returns `QZPayLimitCheckResult.currentValue` for the current usage count.

### Database Schema (`billing_addon_purchases`)

Location: `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`

Relevant columns:
- `id: uuid` (PK)
- `customerId: uuid` (FK to billing_customers)
- `subscriptionId: uuid` (FK to billing_subscriptions, **nullable**, `onDelete: 'set null'`)
- `addonSlug: varchar(100)`
- `addonId: uuid` (FK to billing_addons)
- `status: varchar(50)` .. values: `'pending'`, `'active'`, `'expired'`, `'canceled'` (NOTE: American spelling with single 'l', unlike `SubscriptionStatusEnum.CANCELLED` which uses British spelling)
- `canceledAt: timestamp with timezone` (nullable)
- `limitAdjustments: jsonb` (array of `LimitAdjustment`: `{ limitKey: string, increase: number, previousValue: number, newValue: number }`)
- `entitlementAdjustments: jsonb` (array of `EntitlementAdjustment`)
- `metadata: jsonb` (`Record<string, unknown>`) .. used by this spec for retry tracking (`revocationRetryCount`, `lastRevocationAttempt`)

Existing indexes:
- `addonPurchases_customer_status_idx` on `(customerId, status)`
- `addonPurchases_active_customer_idx` on `(customerId)` WHERE `status = 'active'`
- `addonPurchasesActiveUnique` UNIQUE on `(customerId, addonSlug)` WHERE `status = 'active' AND deleted_at IS NULL`

**Missing index (must be created by this spec):** No index on `subscriptionId`. Flow A queries by `subscriptionId`, which would require a sequential scan without an index.

**FK behavior note:** `subscriptionId` has `onDelete: 'set null'`. If a subscription record is deleted from `billing_subscriptions`, the addon purchase's `subscriptionId` becomes NULL. Those orphaned purchases will NOT be found by Flow A's `WHERE subscriptionId = ?` query. This is acceptable .. orphaned purchases are handled by the addon expiry cron or manual admin action.

### Plan Change Mechanism (verified)

QZPay uses `billing.subscriptions.changePlan()` for plan changes. Verified in `apps/api/src/routes/billing/plan-change.ts` (line 211): upgrades apply immediately with prorations, downgrades apply at period end.

**CRITICAL: `changePlan()` is a synchronous local operation.** QZPay's `changePlan()` performs a LOCAL UPDATE.. it keeps the same subscription ID and updates the `planId` field on the existing subscription record. It does NOT cancel and create a new subscription. The plan-change route triggers this operation directly, making Flow B's primary trigger synchronous (not webhook-driven).

**MercadoPago limitation:** MercadoPago does NOT support changing the `preapproval_plan_id` on an existing subscription. The `PUT /preapproval/{id}` endpoint allows changing amount, card, status, reason, but NOT the plan association. MercadoPago webhooks only handle status changes, not plan changes. The webhook planId comparison (AC-3.7) is a SAFETY NET only.. it catches edge cases where MercadoPago might reflect a plan change, but the primary trigger is always the plan-change route (AC-3.8).

### Recalculation sourceId Strategy (CRITICAL)

QZPay's `billing_customer_limits.source_id` column is PostgreSQL `uuid` type. Non-UUID strings (like `'recalc'`) will be **rejected at runtime** by PostgreSQL with `invalid input syntax for type uuid`. All `sourceId` values MUST be valid UUIDs.

For aggregated limit recalculations (where the limit represents the sum of multiple addon purchases and cannot use a single purchaseId), this spec defines a **sentinel UUID constant**:

```typescript
/**
 * Well-known UUID sentinel used as sourceId for aggregated addon limit recalculations.
 * When a plan change triggers Flow B, or when an individual addon cancellation triggers
 * re-recalculation (AC-3.9), the resulting aggregated limit is stored with this sourceId
 * instead of a specific purchaseId. This allows `removeBySource('addon', ADDON_RECALC_SOURCE_ID)`
 * to target only the aggregated limit without affecting individual addon entitlements.
 *
 * Hand-crafted well-known UUID reserved for addon recalculation operations.
 */
export const ADDON_RECALC_SOURCE_ID = 'a0d0e1c2-0000-5000-8000-000000000001';
```

This constant MUST be:
- Defined in a shared location (e.g., `apps/api/src/services/addon-lifecycle.constants.ts` or alongside the recalculation function).
- Used consistently in ALL `billing.limits.set()` calls for aggregated recalculations.
- Used in `removeBySource('addon', ADDON_RECALC_SOURCE_ID)` when cleaning up aggregated limits.
- A valid UUID (the value above is a valid UUID v5-like format).

### Plan ID and Slug Relationship

QZPay's `subscription.planId` IS the canonical plan slug from `ALL_PLANS` (e.g., `'owner-pro'`, `'complex-premium'`). No mapping is needed. To resolve base limits for a plan:

```
const planDef = getPlanBySlug(subscription.planId); // Direct lookup, no mapping
const baseLimit = planDef.limits.find(l => l.key === limitKey)?.value ?? 0;
```

This is verified in existing code: `plan-change.ts` uses `activeSubscription.planId` directly, and `stats.ts` calls `getPlanBySlug(subscription.planId)` without transformation.

### Addon Type Determination

An addon's type is determined from its `AddonDefinition` (resolved via `getAddonBySlug(slug)` from `packages/billing/src/config/addons.config.ts`):
- **Entitlement addon:** `addon.grantsEntitlement !== null` (e.g., grants `featured_listing`)
- **Limit addon:** `addon.affectsLimitKey !== null` (e.g., increases `MAX_PHOTOS_PER_ACCOMMODATION`)
- These are mutually exclusive per addon definition. An addon is either entitlement-type or limit-type, not both.

**Verified addon inventory (5 addons, all confirmed XOR):**
| Addon | Type | grantsEntitlement | affectsLimitKey |
|-------|------|-------------------|-----------------|
| `visibility-boost-7d` | Entitlement | `FEATURED_LISTING` | null |
| `visibility-boost-30d` | Entitlement | `FEATURED_LISTING` | null |
| `extra-photos-20` | Limit | null | `MAX_PHOTOS_PER_ACCOMMODATION` |
| `extra-accommodations-5` | Limit | null | `MAX_ACCOMMODATIONS` |
| `extra-properties-5` | Limit | null | `MAX_PROPERTIES` |

### Admin Route (does not exist yet)

There is currently NO admin route for manual subscription cancellation. This spec requires creating `POST /api/v1/admin/billing/subscriptions/:id/cancel` with:
- Permission: `MANAGE_SUBSCRIPTIONS` (`PermissionEnum.MANAGE_SUBSCRIPTIONS`, value `'subscription.manage'`, confirmed at `packages/schemas/src/enums/permission.enum.ts:281`)
- Request body: `{ reason?: string }` (optional cancellation reason for audit log)
- **Subscription lookup:** Query `billing_subscriptions` by `id` (UUID PK). The table has `customerId` (varchar, stores QZPay customer ID) and `planId` (varchar, stores plan slug). If not found, return HTTP 404. If `status` is already `'cancelled'`, return HTTP 400 (AC-2.4).
- Two-phase approach:
  - **Phase 1 (preparation):** Sequential QZPay revocations + collect results. NO DB transaction. MAY use `Promise.all` for parallel QZPay revocations since there are no per-addon DB writes in Phase 1 (unlike the webhook flow which commits per-addon).
  - **Phase 2 (commit):** Single DB transaction containing ONLY local DB writes (update addon purchase statuses + update subscription status). The QZPay `subscriptions.cancel()` call happens OUTSIDE the transaction, AFTER the DB commit succeeds.
  - **Rationale:** Never hold a DB transaction open while waiting for external API calls.
  - **If QZPay cancel fails after DB commit:** log error, schedule retry via cron safety net, subscription will be caught on next webhook sync.
- Returns error if ANY addon revocation fails (AC-2.2), subscription NOT canceled, no DB changes
- Cancellation via `billing.subscriptions.cancel(subscriptionId, { cancelAtPeriodEnd: false, reason })` (verified: method exists in `@qazuor/qzpay-core@1.2.0`, already used in `trial.service.ts`). The `reason` from the request body is passed through to QZPay for audit purposes.
- **Route mounting:** Add to `apps/api/src/routes/billing/admin/index.ts` as `app.route('/subscriptions', subscriptionCancelRoute)` alongside the existing `app.route('/subscriptions', subscriptionEventsRoute)`. Hono merges routes on the same base path, so `POST /subscriptions/:id/cancel` and `GET /subscriptions/:id/events` coexist without conflict.

---

## User Stories

### Story 1: Addon cleanup on subscription cancellation (webhook)

As a **platform operator**, I want addon entitlements to be automatically revoked when a customer's subscription is cancelled via MercadoPago, so that cancelled customers cannot continue using paid features they no longer have access to.

#### Acceptance Criteria

**AC-1.1 -- Happy path: all addons revoked on cancellation**

```
Given a customer has an active subscription with two active addon purchases:
  - One entitlement addon (grantsEntitlement = 'featured_listing')
  - One limit addon (affectsLimitKey = 'MAX_PHOTOS_PER_ACCOMMODATION', increase: 20 per purchase.limitAdjustments)
When the subscription_preapproval.updated webhook is received and the fetched subscription status maps to CANCELLED,
Then for the entitlement addon:
  - billing.entitlements.revokeBySource('addon', purchaseId) is called (returns count of revoked, 0 is not an error)
  - If revokeBySource fails, billing.entitlements.revoke(customerId, entitlementKey) is called as fallback
And for the limit addon:
  - billing.limits.removeBySource('addon', purchaseId) is called (returns count of removed, 0 is not an error)
  - If removeBySource fails, billing.limits.remove(customerId, limitKey) is called as fallback
And only AFTER all QZPay revocations succeed, each addon purchase is updated:
  - SET status='canceled', canceledAt=NOW() WHERE id = purchaseId AND status = 'active'
And clearEntitlementCache(customerId) is called
And the webhook handler returns 200 OK (all revocations succeeded, no error to propagate)
And a structured log entry is written with:
  - eventType: 'subscription_canceled'
  - customerId, subscriptionId
  - revokedPurchases: [{ purchaseId, addonSlug, type: 'entitlement'|'limit', outcome: 'success'|'failed' }]
```

**AC-1.2 -- Idempotency: repeated webhook delivery**

```
Given a subscription cancellation webhook has already been processed and all addon purchases are status='canceled',
When the same webhook is delivered a second time (MercadoPago retry),
Then the system queries billing_addon_purchases WHERE subscriptionId = ? AND status = 'active' AND deleted_at IS NULL,
And finds zero rows,
And no QZPay revocation calls are made,
And a debug log entry is written: "No active addon purchases for subscription {subscriptionId}, skipping cleanup"
And the handler returns 200 OK without modifying any data.
```

**AC-1.3 -- Partial failure: QZPay unavailable for some addons**

```
Given a customer has 3 active addon purchases linked to a subscription,
When a subscription cancellation webhook is received:
  - Addon 1 is revoked successfully in QZPay and updated to status='canceled' in DB
  - Addon 2 QZPay revocation fails (network timeout)
Then:
  - Addon 1 remains status='canceled' in DB (partial progress preserved)
  - Addon 2 status remains 'active' (NOT updated because QZPay failed)
  - Addon 3 is still processed (failure on addon 2 does not block addon 3)
And for each failed addon:
  - metadata.revocationRetryCount is set to 1, metadata.lastRevocationAttempt to NOW()
  - Error logged with retryNeeded=true, purchaseId, addonSlug, errorMessage
  - Reported to Sentry with tags: { subsystem: 'billing-addon-lifecycle', action: 'subscription_cancelled' }
    and extra: { customerId, subscriptionId, failedPurchaseIds: string[] }
And if ANY addon failed, the error propagates to the webhook handler (returns 500, triggering MercadoPago retry)
And the addon expiry cron also picks up failed revocations on its next run as a safety net.
```

**AC-1.4 -- No active addons**

```
Given a customer has a subscription with no active addon purchases
  (all existing purchases have status='pending', 'expired', or 'canceled'),
When a subscription cancellation webhook is received,
Then no QZPay calls are made,
And a debug log is written: "No active addon purchases for subscription {subscriptionId}"
And the handler returns 200 OK immediately.
```

**AC-1.5 -- Subscription not found in local DB**

```
Given a MercadoPago webhook refers to a subscriptionId that has no matching rows in billing_addon_purchases
  (the subscription may have existed but the customer never purchased addons),
When the cancellation webhook is processed,
Then the handler logs a debug message: "No addon purchases found for subscription {subscriptionId}"
And returns 200 OK (idempotent, nothing to clean up).
```

**AC-1.6 -- Partial progress preserved across retries**

```
Given addon 1 was successfully revoked and marked 'canceled' in a previous webhook delivery,
And addon 2 failed and is still status='active',
When the cron retry picks up addon 2 (or MercadoPago sends another webhook),
Then only addon 2 is processed (addon 1 is skipped because status='canceled'),
And if addon 2 revocation now succeeds, it is updated to status='canceled',
And clearEntitlementCache(customerId) is called again.
```

**AC-1.7 -- Addon definition not found in canonical config**

```
Given an active addon purchase has addonSlug='retired-feature' which no longer exists in the addon config
  (getAddonBySlug('retired-feature') returns undefined),
When subscription cancellation processes this purchase,
Then billing.entitlements.revokeBySource('addon', purchaseId) is called (using the stored purchaseId, does not need addon config)
And billing.limits.removeBySource('addon', purchaseId) is called (same reasoning)
And the purchase is updated to status='canceled'
And a warning log is written: "Addon definition not found for slug 'retired-feature', revoked via both entitlement and limit sourceId channels"
```

**AC-1.8 -- Pending addon purchases during cancellation**

```
Given a customer has both active and pending addon purchases when subscription is cancelled,
When the cancellation flow processes,
Then only status='active' purchases are processed for revocation,
And status='pending' purchases are NOT cancelled (they may resolve independently via payment confirmation or expiration).
Note: The addon purchase confirmation flow (outside this spec) MUST verify the subscription is still active before confirming a pending purchase. If the subscription is cancelled, confirmation must fail.
```

**AC-1.9 -- Customer not found in billing_customers**

```
Given a webhook references a customer that does not exist in billing_customers,
When the cancellation webhook handler looks up the customer,
Then it logs a warning with the customer ID and MercadoPago subscription ID:
  "Customer {customerId} not found in billing_customers for subscription {mpSubscriptionId}"
And returns 200 OK (acknowledge to prevent MercadoPago retries),
And does NOT throw an error.
```

**AC-1.10 -- Webhook handler responds within 22 seconds**

```
Given a subscription cancellation webhook is received,
When the handler processes addon revocations,
Then the entire handler MUST respond within 22 seconds (MercadoPago timeout).
If processing exceeds 15 seconds, a warning log is written:
  "Webhook processing time exceeded 15s threshold: {elapsedMs}ms for subscription {subscriptionId}"
And if the handler exceeds 22 seconds, MercadoPago will retry per its retry schedule.
```

---

### Story 2: Addon cleanup on manual admin cancellation

As a **platform operator**, I want addon entitlements to be automatically revoked when I manually cancel a customer's subscription through the admin panel, so that the system stays consistent regardless of the cancellation source.

#### Acceptance Criteria

**AC-2.1 -- Manual cancellation triggers the same cleanup as webhook (two-phase approach)**

```
Given an admin with MANAGE_SUBSCRIPTIONS permission triggers subscription cancellation
  via POST /api/v1/admin/billing/subscriptions/:id/cancel { reason?: string },
When the route handler processes the request using a TWO-PHASE approach:
  Phase 1 (preparation — QZPay revocations only, NO DB transaction):
    - For each active addon purchase linked to the subscription, call QZPay revocation
      (same revocation logic as webhook flow: revokeBySource/removeBySource with fallbacks)
    - MAY use Promise.all for parallel QZPay revocations since there are no per-addon DB writes
      in Phase 1 (unlike the webhook flow which commits per-addon)
    - Collect results: { purchaseId, addonSlug, outcome: 'success'|'failed', error? }
    - DO NOT update any addon purchase status in DB during this phase
  Phase 2 (commit — ONLY if ALL Phase 1 revocations succeeded):
    - Single DB transaction containing ONLY local DB writes:
      - Update ALL addon purchases to status='canceled', canceledAt=NOW()
      - Update local billing_subscriptions status to 'cancelled'
    - AFTER the DB transaction commits successfully (OUTSIDE the transaction):
      Cancel the subscription in QZPay: billing.subscriptions.cancel(subscriptionId, { cancelAtPeriodEnd: false, reason })
      (immediate cancellation for admin action, reason passed from request body)
    - Rationale: Never hold a DB transaction open while waiting for external API calls.
    - NOTE ON PHASE 2 PARTIAL FAILURE: If the DB transaction succeeds but the QZPay cancel call fails
      (remember: QZPay cancel happens OUTSIDE the transaction, AFTER DB commit),
      addon purchases are already marked 'canceled' in DB but subscription remains active in QZPay.
      In this case: (a) return HTTP 500 with code 'SUBSCRIPTION_CANCEL_FAILED' explaining addons were
      revoked but subscription cancel failed, (b) report to Sentry for manual intervention,
      (c) log error and schedule retry via cron safety net (subscription will be caught on next webhook sync),
      (d) the admin can retry.. the retry will find no active addons (Phase 1 skips), and re-attempt
      the subscription cancel in Phase 2. This is an acceptable degraded state because the addons
      are already revoked in QZPay (Phase 1 succeeded) and marked canceled in DB.
Then the admin action is recorded in the audit log with the admin's userId and optional reason,
And clearEntitlementCache(customerId) is called,
And the admin receives a success response with the list of revoked addon purchases.
NOTE: The two-phase approach ensures atomicity for addon revocation. If ANY QZPay revocation
fails in Phase 1, Phase 2 never executes, so no addon purchases are marked 'canceled' and the
subscription is never cancelled. No rollback needed.
```

**AC-2.2 -- Cancellation does not proceed if addon revocation fails**

```
Given an admin triggers subscription cancellation and QZPay revocation fails for ANY addon in Phase 1,
When Phase 1 completes with at least one failure,
Then Phase 2 is SKIPPED entirely:
  - The subscription remains in its current state in QZPay (never canceled because Phase 2 never ran)
  - No addon purchase records are updated to 'canceled' (no DB writes occurred in Phase 1)
  - QZPay revocations that succeeded in Phase 1 are orphaned but harmless
    (the entitlements/limits were already removed from QZPay, but addon purchases remain 'active' in DB.
     On the next admin retry, revokeBySource returns count=0 for already-revoked addons, which is not an error.)
And the admin receives HTTP 500 with body:
  { success: false, error: { code: 'ADDON_REVOCATION_FAILED', message: 'Subscription cancellation could not complete because addon entitlement cleanup failed. Failed addons: [slugs]. Please retry or contact engineering.', details: { failedPurchases: [{ purchaseId, addonSlug, error }], succeededPurchases: [{ purchaseId, addonSlug }] } } }
And Sentry.captureException() is called with tags: { subsystem: 'billing-addon-lifecycle', action: 'admin_subscription_cancel' }
  and extra: { customerId, subscriptionId, adminUserId, failedPurchaseIds, succeededPurchaseIds }.

NOTE on orphaned QZPay revocations: If the admin retries after a partial failure, the
previously-succeeded revocations will return count=0 (already revoked) which is not an error.
The retry is safe because revokeBySource and removeBySource are idempotent.
```

**AC-2.3 -- Admin route does not exist yet (implementation requirement)**

```
Given the route POST /api/v1/admin/billing/subscriptions/:id/cancel does not currently exist,
When this spec is implemented,
Then a new admin route is created at that path with:
  - Permission guard: requirePermission(PermissionEnum.MANAGE_SUBSCRIPTIONS)
  - Request validation: z.object({ reason: z.string().max(500).optional() })
  - Path param validation: z.object({ id: z.string().uuid() })
  - The route runs Flow A Phase 1 (QZPay revocations) FIRST
  - ONLY if all revocations succeed, runs Flow A Phase 2 (DB batch update + subscription cancel)
  - Subscription cancel: billing.subscriptions.cancel(subscriptionId, { cancelAtPeriodEnd: false, reason })
  - On success: returns 200 with { success: true, data: { canceledAddons: [{ purchaseId, addonSlug }], subscriptionId } }
  - On failure (Phase 1): returns 500 per AC-2.2 (with both failed and succeeded purchase lists)
  - On failure (Phase 2 QZPay cancel): returns 500 with code 'SUBSCRIPTION_CANCEL_FAILED', addons already revoked
  - Subscription not found: returns 404 with { success: false, error: { code: 'SUBSCRIPTION_NOT_FOUND' } }
```

**AC-2.4 -- Admin cancellation of already-cancelled subscription**

```
Given an admin triggers cancellation for a subscription that is already in status='cancelled',
When the route handler looks up the subscription,
Then it returns HTTP 400 with body:
  { success: false, error: { code: 'SUBSCRIPTION_ALREADY_CANCELLED', message: 'Subscription {id} is already cancelled.' } }
And no QZPay calls are made,
And no addon purchases are modified.
```

---

### Story 3: Addon limit recalculation on plan change

As a **customer**, I want my addon limits to be recalculated when I change my plan, so that my combined limits (base plan + addon increments) are always accurate.

#### Acceptance Criteria

**AC-3.1 -- Upgrade: combined limit increases correctly (single addon per limitKey)**

```
Given a customer is on the "Basic" plan (MAX_PHOTOS_PER_ACCOMMODATION: 10)
  with one active "extra-photos-20" addon (purchase.limitAdjustments[].increase: 20, current combined: 30),
When the customer upgrades to the "Pro" plan (MAX_PHOTOS_PER_ACCOMMODATION: 50),
Then billing.limits.set() is called with:
  { customerId, limitKey: 'MAX_PHOTOS_PER_ACCOMMODATION', maxValue: 70, source: 'addon', sourceId: ADDON_RECALC_SOURCE_ID }
  (formula: 50 base + 20 addon = 70)
  NOTE: sourceId is ADDON_RECALC_SOURCE_ID (a sentinel UUID constant, not a specific purchaseId) because this is an aggregated limit recalculation. See "Recalculation sourceId Strategy" in Technical Context.
And clearEntitlementCache(customerId) is called
And a log entry is written with:
  eventType: 'plan_changed', direction: 'upgrade', oldPlanId, newPlanId,
  recalculations: [{ limitKey, oldMaxValue: 30, newMaxValue: 70 }]
```

**AC-3.2 -- Plan change: multiple addons targeting the same limitKey**

```
Given a customer has two active limit addons that both target MAX_ACCOMMODATIONS:
  - "extra-accommodations-5" (purchase.limitAdjustments[].increase: 5)
  - "extra-accommodations-3" (purchase.limitAdjustments[].increase: 3)
And the customer is on a plan with MAX_ACCOMMODATIONS base limit of 10,
When the customer changes to a plan with MAX_ACCOMMODATIONS base limit of 20,
Then the recalculation groups addons by limitKey,
And computes newMaxValue = 20 + 5 + 3 = 28 (base + SUM of all addon increments for that limitKey),
And billing.limits.set() is called ONCE for MAX_ACCOMMODATIONS with maxValue = 28,
  source: 'addon', sourceId: ADDON_RECALC_SOURCE_ID (a sentinel UUID constant, NOT a specific purchaseId,
  because the limit represents an aggregation of multiple addon purchases. Using a specific purchaseId
  would cause problems if that addon is later cancelled and removeBySource removes the aggregated limit.)

NOTE on sourceId for recalculated limits: When recalculating after plan change, use
sourceId=ADDON_RECALC_SOURCE_ID (the sentinel UUID constant). Individual addon cancellation MUST trigger
a re-recalculation (query remaining active addons, recompute, set new aggregated limit)
rather than calling removeBySource.

IMPORTANT — interaction with individual addon cancellation (cancelUserAddon):
After a plan change recalculation sets sourceId=ADDON_RECALC_SOURCE_ID, the existing
removeAddonEntitlements() calls removeBySource('addon', purchaseId) which will return 0
(no match, because sourceId is ADDON_RECALC_SOURCE_ID, not the purchaseId). The fallback then calls
remove(customerId, limitKey) which REMOVES THE ENTIRE AGGREGATED LIMIT, including
contributions from OTHER active addons. This is INCORRECT behavior.

REQUIRED FIX (in scope for this spec): After removing a single addon's limit contribution,
the system must re-recalculate the aggregated limit for that limitKey:
  1. Query remaining active addon purchases for the same customer and limitKey (WHERE status='active' AND deleted_at IS NULL)
  2. Resolve current plan's base limit via getPlanBySlug(subscription.planId)
  3. Compute newMaxValue = basePlanLimit + SUM(remaining active addon increments)
  4. Call billing.limits.set({ customerId, limitKey, maxValue: newMaxValue, source: 'addon', sourceId: ADDON_RECALC_SOURCE_ID })
  5. If no remaining active addons for that limitKey, call billing.limits.removeBySource('addon', ADDON_RECALC_SOURCE_ID)
     to clean up the aggregated limit entirely (base plan limit is managed by QZPay's plan engine)

This re-recalculation logic should be extracted into a shared function (e.g.,
recalculateAddonLimitsForCustomer(customerId, limitKey)) that is called by:
  - Flow B (plan change recalculation)
  - cancelUserAddon() after removing an addon's individual entitlements/limits

IMPORTANT: Flow A (subscription cancellation) does NOT use re-recalculation. In Flow A,
ALL addons for that subscription are being revoked. Re-recalculation after each individual
revocation would be wasteful and incorrect (it would compute remaining addons that are about
to be revoked in subsequent iterations). Flow A uses `removeBySource()`/`remove()` directly
for each addon, then clears the entitlement cache ONCE at the end.

See also AC-3.9 (new) for the specific acceptance criteria for this interaction.
```

**AC-3.3 -- Plan change: entitlement addons are unaffected**

```
Given a customer has an active addon that grants an entitlement (grantsEntitlement != null, affectsLimitKey == null),
When the customer changes their plan (upgrade or downgrade),
Then no call is made to billing.entitlements for that addon (entitlements are not plan-dependent),
And the entitlement remains active.
```

**AC-3.4 -- Plan change: no active limit addons**

```
Given a customer has no active limit-type addons when changing plans
  (they may have entitlement addons, or no addons at all),
When the plan change event is received,
Then no billing.limits.set() calls are made for addons
  (base plan limit changes are handled by QZPay's plan engine, not this spec),
And a debug log is written: "No active limit addons for customer {customerId}, skipping recalculation"
And the handler returns success immediately.
```

**AC-3.5 -- Plan change: base plan limit is unlimited (-1)**

```
Given the new plan has an unlimited (-1) value for a limit key that an active addon also targets,
When the plan change triggers recalculation,
Then the recalculation for that specific limit key is SKIPPED
  (consistent with existing behavior in applyAddonEntitlements, line 170-180),
And a debug log entry is written: "Base plan has unlimited for {limitKey}, skipping addon recalculation"
And other limit keys proceed with normal recalculation.
```

**AC-3.6 -- Plan change: new plan does not define the limitKey**

```
Given a customer has an active addon targeting MAX_PHOTOS_PER_ACCOMMODATION,
And the customer changes to a plan that does not define MAX_PHOTOS_PER_ACCOMMODATION in its limits array,
When recalculation runs for that limitKey,
Then basePlanLimit defaults to 0 (consistent with existing code: baseLimitDef?.value ?? 0),
And newMaxValue = 0 + purchase.limitAdjustments.find(la => la.limitKey === addon.affectsLimitKey)?.increase (e.g., 0 + 20 = 20),
And billing.limits.set() is called with maxValue = 20,
And a WARNING log is written: "New plan {newPlanId} does not define limit {limitKey}, using basePlanLimit=0. Review addon compatibility."
And the warning is reported to Sentry for operator visibility.
```

**AC-3.7 -- Plan change detection via webhook (SAFETY NET only, not primary trigger)**

```
Given QZPay's changePlan() is a synchronous local operation that keeps the same subscription ID
  and updates the planId field (it does NOT cancel+create),
And MercadoPago webhooks only handle status changes (not plan changes),
When a subscription_preapproval.updated webhook is received with status still ACTIVE,
Then the handler compares the fetched subscription's planId with the locally stored planId in billing_subscriptions,
And if planId differs:
  - Triggers Flow B with oldPlanId (from local DB) and newPlanId (from fetched data)
  - Updates local billing_subscriptions.planId to the new value
Note: This is a SAFETY NET only, not the primary trigger for plan change recalculation.
The PRIMARY trigger is AC-3.8 (the plan-change route itself), which is synchronous and reliable.
AC-3.7 catches edge cases where:
  - The plan-change route's recalculation failed or was skipped
  - MercadoPago might reflect a plan change in a future API version
This webhook-based detection may rarely (or never) fire in practice because MercadoPago
does not currently propagate planId changes via webhooks.
```

**AC-3.8 -- Plan change detection via plan-change route (PRIMARY mechanism)**

```
Given a customer initiates a plan change via the existing route at
  apps/api/src/routes/billing/plan-change.ts (which calls billing.subscriptions.changePlan()),
When the plan change succeeds in QZPay,
Then the route triggers Flow B (addon limit recalculation) IMMEDIATELY after the plan change is confirmed,
And clearEntitlementCache(customerId) is called.
This is the PRIMARY and most reliable trigger for plan change recalculation because:
  1. The route has direct access to both oldPlanId and newPlanId
  2. It does not depend on webhook delivery or timing
  3. MercadoPago's webhook behavior for plan changes is unpredictable (may arrive as cancel+create)
Note: The existing plan-change route currently clears the entitlement cache but does NOT
recalculate addon limits. This spec requires adding that logic.
```

**AC-3.9 -- Individual addon cancellation after plan-change recalculation (re-recalculation)**

```
Given a customer had a plan change that triggered Flow B recalculation
  (limits now stored with sourceId=ADDON_RECALC_SOURCE_ID, aggregating multiple addon increments),
And the customer subsequently cancels ONE individual addon via the existing cancelUserAddon flow,
When the addon's QZPay entitlements/limits are removed:
  - For entitlement addons: existing revokeBySource('addon', purchaseId) works correctly
    (entitlements are per-addon, not aggregated)
  - For limit addons: after removing the individual addon's QZPay limits,
    the system MUST re-recalculate the aggregated limit for the affected limitKey:
      1. Query remaining active addon purchases for customer WHERE status='active' AND deleted_at IS NULL
         AND addon.affectsLimitKey matches the cancelled addon's limitKey
      2. Resolve base plan limit: getPlanBySlug(subscription.planId).limits.find(l => l.key === limitKey)?.value ?? 0
      3. Compute newMaxValue = basePlanLimit + SUM(remaining purchases' limitAdjustments[].increase for limitKey)
      4. If remaining addons exist: billing.limits.set({ customerId, limitKey, maxValue: newMaxValue, source: 'addon', sourceId: ADDON_RECALC_SOURCE_ID })
      5. If NO remaining addons for limitKey: billing.limits.removeBySource('addon', ADDON_RECALC_SOURCE_ID)
         (base plan limits are managed by QZPay's plan engine, not by addon sourceIds)
Then the aggregated limit reflects the correct total (base + remaining addons),
And other addon contributions to the same limitKey are NOT lost.

IMPLEMENTATION NOTE: This requires modifying cancelUserAddon() (or the service it calls)
to detect limit-type addons and call recalculateAddonLimitsForCustomer() after removal,
instead of relying solely on removeBySource (which won't match sourceId=ADDON_RECALC_SOURCE_ID).
This shared function is the same one used by Flow B.

IMPLEMENTATION NOTE 2: The existing removeAddonEntitlements() fallback pattern
(removeBySource fails -> remove entire limit) is DANGEROUS after a plan-change
recalculation because it removes the aggregated limit including other addons' contributions.
The re-recalculation approach replaces this fallback for limit-type addons.
```

---

### Story 4: Addon limit recalculation on plan downgrade

As a **platform operator**, I want the system to handle downgrade scenarios safely, so that customers are notified when their combined limits will be reduced, and the platform does not enter an inconsistent state where active usage exceeds the new combined limits.

#### Acceptance Criteria

**AC-4.1 -- Downgrade: combined limit decreases correctly**

```
Given a customer is on the "Pro" plan (MAX_PHOTOS: 50) with an active "extra-photos-20" addon (+20, combined: 70),
When the customer downgrades to the "Basic" plan (MAX_PHOTOS: 10),
Then billing.limits.set() is called with maxValue = 10 + 20 = 30
  (or SUM of all active addon increments for that key if multiple addons exist),
And clearEntitlementCache(customerId) is called,
And a log entry is written with:
  eventType: 'plan_changed', direction: 'downgrade', oldPlanId, newPlanId,
  recalculations: [{ limitKey, oldMaxValue: 70, newMaxValue: 30 }]
```

**AC-4.2 -- Downgrade: new combined limit above current usage (no warning)**

```
Given a customer currently has 25 photos (usage = 25) and a combined limit of 70,
When the customer downgrades to a plan where the new combined limit is 30,
Then the system queries current usage via billing.limits.check(customerId, 'MAX_PHOTOS_PER_ACCOMMODATION'),
And currentValue (25) < newMaxValue (30),
And the limit update proceeds normally,
And NO warning notification is sent.
```

**AC-4.3 -- Downgrade: new combined limit at or below current usage (warning sent)**

```
Given a customer currently has 35 photos (usage = 35) and a combined limit of 70,
When the customer downgrades to a plan where the new combined limit is 30,
Then billing.limits.check(customerId, 'MAX_PHOTOS_PER_ACCOMMODATION') returns { currentValue: 35 },
And billing.limits.set() is called with maxValue = 30 (the recalculation proceeds regardless),
And a PLAN_DOWNGRADE_LIMIT_WARNING notification is dispatched via @repo/notifications:
  - Channel: in-app notification (NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING)
  - Payload: PlanDowngradeLimitWarningPayload (extends BaseNotificationPayload which provides
    userId, recipientEmail, recipientName, customerId)
    Additional fields: { type: 'plan_downgrade_limit_warning', limitKey, oldLimit: 70, newLimit: 30, currentUsage: 35, planName: newPlan.name }
  - Dispatch is fire-and-forget (notification failure does not block the operation)
And a log entry is written with:
  eventType: 'plan_downgrade_limit_exceeded', limitKey, oldLimit: 70, newLimit: 30, currentUsage: 35
And Sentry.captureMessage() is called (not captureException, since this is expected behavior) with:
  level: 'warning',
  tags: { subsystem: 'billing-addon-lifecycle', action: 'plan_downgrade_limit_exceeded' },
  extra: { customerId, limitKey, oldLimit, newLimit, currentUsage }
```

**AC-4.4 -- Current usage cannot be read from QZPay**

```
Given billing.limits.check(customerId, limitKey) throws an error (QZPay unavailable),
When a downgrade plan change event triggers recalculation,
Then the recalculation proceeds with the new limit value (safe default: always apply the new limit),
And a WARNING log entry is written: "Could not read current usage for {limitKey}, skipping downgrade warning check"
And no PLAN_DOWNGRADE_LIMIT_WARNING notification is sent (cannot determine if warning is needed),
And the error is NOT reported to Sentry (non-critical, usage check is optional).
```

---

### Story 5: Audit trail for lifecycle events

As a **platform operator**, I want a complete audit trail of all addon lifecycle events triggered by subscription changes, so that I can investigate customer complaints and verify system behavior.

#### Acceptance Criteria

**AC-5.1 -- Every revocation produces a structured log entry**

```
Given any addon entitlement or limit revocation occurs (from subscription cancellation or plan change),
When the operation completes (success or failure),
Then apiLogger.info (for success) or apiLogger.error (for failure) is called with structured fields:
  {
    eventType: 'subscription_canceled' | 'plan_changed',
    customerId: string,
    subscriptionId: string,
    addonSlug: string,
    purchaseId: string,
    addonType: 'entitlement' | 'limit',
    limitKey?: string,          // only for limit addons
    entitlementKey?: string,    // only for entitlement addons
    outcome: 'success' | 'failed',
    errorMessage?: string       // only on failure
  }
```

**AC-5.2 -- Log entries use the existing apiLogger pattern**

```
Given the existing logging infrastructure uses apiLogger with structured fields
  (imported from apps/api/src/utils/logger.ts),
When lifecycle event log entries are written,
Then they use apiLogger.info / apiLogger.warn / apiLogger.error / apiLogger.debug,
And they follow the same pattern as addon-entitlement.service.ts
  (structured object as first argument, message string as second argument),
And they do NOT use console.log or any other logging mechanism.
```

**AC-5.3 -- Sentry captures all unrecoverable errors**

```
Given any lifecycle event handler encounters an unrecoverable error
  (QZPay failure that could not be retried, admin cancellation abort),
When the error is caught,
Then Sentry.captureException(error, options) is called with:
  tags: {
    subsystem: 'billing-addon-lifecycle',
    action: 'subscription_cancelled' | 'plan_changed' | 'admin_subscription_cancel'
  },
  extra: {
    customerId: string,
    subscriptionId: string,
    failedPurchaseIds: string[]  // list of addon purchase IDs that failed
  }
```

---

## UX Considerations

### Customer-facing impacts

- Customers whose subscriptions are cancelled will immediately lose access to addon-gated features after the entitlement cache expires (cache TTL: 5 minutes, defined by `EntitlementCache` in `entitlement.ts`). There is no grace period in scope for this spec.
- Customers who downgrade and trigger AC-4.3 (usage exceeds new combined limit) receive an in-app notification via `@repo/notifications`. The notification should be informational and must not be alarming. It should explain what changed and what the customer's options are (purchase a higher plan, remove some content, or contact support). The notification template text is defined in `packages/i18n/src/locales/{lang}/billing.json` (new keys to add).
- Customers who upgrade (AC-3.1) do not receive a notification. The improved limits take effect transparently.

### Admin-facing impacts

- When a manual subscription cancellation fails due to QZPay revocation failure (AC-2.2), the admin must see a clear, actionable error in the admin panel UI. The error response includes `code: 'ADDON_REVOCATION_FAILED'` and lists the specific failed addon slugs.
- Admins should be able to see the audit log entries for lifecycle events in the existing notification/audit log views.

### Empty states

- When a subscription is cancelled and the customer had zero active addons, the handler must complete silently with no visible side effect (debug log only).

### Error states

- QZPay temporary unavailability during webhook: addon revocations that fail cause the webhook to return 500 (triggering MercadoPago retry). The cron job also acts as a safety net. Failed addons have `metadata.revocationRetryCount` incremented.
- QZPay temporary unavailability during admin cancellation: addon revocation aborts BEFORE subscription is canceled in QZPay, admin sees explicit error message, subscription remains in its current state.
- QZPay returns partial failure (some addons revoked, some failed): each addon is independent. Successfully revoked addons are marked `canceled`. Failed addons remain `active` and are retried.
- Addon definition not found in canonical config (`getAddonBySlug` returns undefined): the purchase is still revoked via `revokeBySource`/`removeBySource` (which use `purchaseId`, not addon config) and updated to `canceled`. A warning is logged.

---

## Out of Scope

| Item | Reason |
|------|--------|
| Payment refunds on cancellation | Billing policy decision, not a system behavior spec |
| Pro-rated addon refunds | Future billing feature, requires payment processor integration |
| Re-applying addons on subscription reactivation | Separate lifecycle event, new SPEC required |
| Webhook signature verification changes | Already handled by existing MercadoPago webhook middleware |
| Real-time usage queries to QZPay for all limit keys on every event | Too expensive; only queried during downgrade for affected limit keys |
| Bulk plan migration tooling | Admin tooling scope, not lifecycle event scope |
| Admin UI changes beyond error message for failed cancellation | Frontend spec; this spec covers API behavior only |
| Changing qzpay-hono default error response behavior | Not needed; qzpay-hono already returns 500 on unhandled errors, which triggers MercadoPago retries |
| Cancelling pending addon purchases during subscription cancellation | Pending purchases resolve independently; addon confirmation must check subscription state (noted in AC-1.8) |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| MercadoPago delivers the same cancellation webhook multiple times | HIGH | Idempotency: query billing_addon_purchases for active rows. If none found, return success. Partial progress preserved across retries. |
| QZPay unavailable at the moment of subscription cancellation (webhook) | HIGH | Hybrid retry: (1) webhook returns 500, MercadoPago retries automatically (0min, 15min, 30min, then 6h, 48h, 96h, 96h.. total retry window exceeds 4 days); (2) cron safety net queries orphaned active addons on canceled subscriptions. After 3 cron retries, Sentry alert fires for manual review. |
| QZPay unavailable during admin manual cancellation | HIGH | Admin cancellation aborts. Error returned to admin with specific failure details. No retry mechanism for admin actions (admin must retry manually). |
| Addon slug retired/removed from canonical config after purchase | MEDIUM | Revocation still works via `revokeBySource`/`removeBySource` (uses purchaseId, not addon config). Warning logged. Purchase still marked `canceled`. |
| Plan change event not detected by webhook handler | MEDIUM | AC-3.8 (plan-change route) is the PRIMARY trigger and is synchronous (QZPay `changePlan()` is a local update that keeps the same subscription ID). AC-3.7 (webhook planId comparison) is a SAFETY NET only. Must add planId comparison to processSubscriptionUpdated(). Even if webhook never fires for plan changes (MercadoPago webhooks only handle status changes, not plan changes), the route trigger ensures recalculation always happens. |
| Concurrent plan change and subscription cancellation for the same customer | MEDIUM | Cancellation revokes all addon entitlements regardless of limits. Plan change recalculation only runs for active addons. If cancellation completes first, plan change finds no active addons and exits. If they interleave, QZPay source-based operations are idempotent per sourceId. |
| Downgrade notification fails to send | LOW | Fire-and-forget pattern. Notification failure logged as warning. Does not block recalculation. |
| Current usage read from QZPay is stale (cache) | LOW | Treat inability to read usage as non-blocking (AC-4.4). Apply new limit regardless. |
| Orphaned addon purchases (subscriptionId = NULL due to FK onDelete: set null) | MEDIUM | Not found by Flow A's WHERE subscriptionId = ? query. Handled by addon expiry cron (if they have expiresAt) or manual admin action. Documented as expected behavior. |
| Pending addon confirmed after subscription cancellation | MEDIUM | Out of scope for this spec (noted in AC-1.8). Addon confirmation flow must check subscription state. Documented as a constraint. |
| Multiple active addons targeting the same limitKey | MEDIUM | Flow B groups addons by limitKey and sums increments. billing.limits.set() called once per limitKey with aggregated maxValue. |
| Missing subscriptionId index causes slow query | LOW | Migration creates index: `billing_addon_purchases(subscription_id) WHERE status = 'active' AND deleted_at IS NULL`. |
| Individual addon cancellation after plan-change recalculation loses other addons' limit contributions | HIGH | AC-3.9 requires re-recalculation instead of removeBySource for limit-type addons. Shared `recalculateAddonLimitsForCustomer()` function used by both Flow B and individual cancellation. |
| QZPay `billing_customer_limits.source_id` is PostgreSQL UUID column | HIGH | Non-UUID strings like `'recalc'` would cause `invalid input syntax for type uuid` at runtime. Mitigated by using `ADDON_RECALC_SOURCE_ID` sentinel UUID constant (`'a0d0e1c2-0000-5000-8000-000000000001'`). See "Recalculation sourceId Strategy" section. |
| Phase 2 partial failure: QZPay subscription cancel fails after DB commit | MEDIUM | Admin sees error with code 'SUBSCRIPTION_CANCEL_FAILED'. Addon revocations already completed. Admin retries: Phase 1 skips (no active addons), Phase 2 re-attempts cancel. Documented in AC-2.1. |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| SPEC-038 | completed | Provides per-customer entitlement/limit infrastructure. `revokeBySource()` and `removeBySource()` available. |
| SPEC-044 | draft | Addon purchase schema cleanup (soft-delete via `deletedAt` column). **If SPEC-044 is implemented before or concurrently, ALL queries on `billing_addon_purchases` in this spec MUST include `AND deleted_at IS NULL` (Drizzle: `isNull(billingAddonPurchases.deletedAt)`) to exclude soft-deleted records.** |
| `@qazuor/qzpay-core@1.2.0` | available | QZPay billing engine. Provides `billing.subscriptions.cancel(id, { cancelAtPeriodEnd?: boolean, reason?: string })` (verified in trial.service.ts, lines 429/650/789, all called without options) and `billing.subscriptions.changePlan()` (verified in plan-change.ts). |
| `@qazuor/qzpay-hono@1.1.1` | available | Webhook router. Returns 200 on success; returns 500 when `onError` returns `undefined` (verified at `dist/index.js:429-434`: `if (result)` check fails for undefined, falls through to `response.error(message, 500)`), which triggers MercadoPago retries. |
| `billing.entitlements.revokeBySource()` | available | Returns `Promise<number>` (count of revoked). 0 is not an error. |
| `billing.limits.removeBySource()` | available | Returns `Promise<number>` (count of removed). 0 is not an error. |
| `billing.limits.set()` | available | Input: `{ customerId, limitKey, maxValue, source?, sourceId? }`. Returns `Promise<QZPayCustomerLimit>`. **IMPORTANT**: `sourceId` column is PostgreSQL UUID type.. must be a valid UUID (see "Recalculation sourceId Strategy" for the sentinel UUID approach). |
| `billing.limits.check()` | available | Input: `(customerId, limitKey)`. Returns `{ allowed, currentValue, maxValue, remaining }`. Used for downgrade warning. |
| `clearEntitlementCache(customerId)` | available | Exported from `apps/api/src/middlewares/entitlement.ts`. Calls `entitlementCache.invalidate(customerId)`. |
| `getAddonBySlug(slug)` | available | Exported from `packages/billing/src/config/addons.config.ts`. Returns `AddonDefinition | undefined`. |
| `ALL_PLANS` canonical config | available | Exported from `@repo/billing`. Each plan has `limits: Array<{ key: LimitKey, value: number }>`. |
| `processSubscriptionUpdated()` | available, needs modification | In `subscription-logic.ts`. Must be extended to detect planId changes (safety net only.. the primary trigger for plan change is the plan-change route). |
| Plan-change route | available, needs modification | `apps/api/src/routes/billing/plan-change.ts`. Must be extended to trigger Flow B after plan change. |
| `PLAN_DOWNGRADE_LIMIT_WARNING` notification type | **not yet defined** | New `NotificationType` enum value must be added to `packages/notifications/src/types/notification.types.ts` (currently 17 values, this will be the 18th). |
| `PLAN_DOWNGRADE_LIMIT_WARNING` i18n keys | **not yet defined** | New keys in `packages/i18n/src/locales/{es,en,pt}/billing.json` for the notification text. |
| `POST /admin/billing/subscriptions/:id/cancel` route | **not yet defined** | New admin route. See AC-2.3 for requirements. |
| `billing_addon_purchases.subscription_id` index | **not yet defined** | New database migration required. |

---

## Flow Descriptions

### Flow A: Subscription Cancellation Addon Cleanup

```
Trigger: MercadoPago webhook (subscription_preapproval.updated with status mapping to CANCELLED)
         OR admin manual cancellation (POST /api/v1/admin/billing/subscriptions/:id/cancel)

IMPORTANT: The webhook and admin flows differ in their DB update strategy:
- WEBHOOK: updates each addon's DB status immediately after successful QZPay revocation (per-addon).
  Partial progress is preserved across retries (idempotent).
- ADMIN: uses a TWO-PHASE approach. Phase 1: QZPay revocations only (no DB writes).
  Phase 2: batch DB update in a single transaction ONLY if all QZPay revocations succeeded.
  This ensures atomicity for admin actions (all-or-nothing).

1. Extract subscriptionId and customerId from the event.
   - Webhook: from the fetched subscription data after paymentAdapter.subscriptions.retrieve()
   - Admin: from the route path param and subscription lookup

2. Query billing_addon_purchases WHERE subscriptionId = ? AND status = 'active' AND deleted_at IS NULL.
   (Uses the new index on subscription_id)

3. If result is empty: log debug "No active addon purchases for subscription {subscriptionId}", return success.

4. Process addons:
   WEBHOOK: Process SEQUENTIALLY (for loop, NOT Promise.all) because (1) each addon's DB status
   update must complete before the next to maintain idempotency on partial retries, and (2) the
   per-addon Sentry reporting and metadata updates must not interleave.
   ADMIN (Phase 1): MAY use Promise.all for parallel QZPay revocations since there are no per-addon
   DB writes in Phase 1. The deprecated subscription.metadata cleanup is NOT done by this new method
   (see Technical Context), so that particular race condition is irrelevant here.

   For each active addon purchase:
   a. Resolve addon definition: getAddonBySlug(purchase.addonSlug)
      - If undefined: skip to step 4b with a warning log (still revoke by sourceId)

   b. Call QZPay revocation directly (do NOT use removeAddonEntitlements() — see Technical Context):
      - If addon is entitlement-type (grantsEntitlement != null):
        Call billing.entitlements.revokeBySource('addon', purchaseId)
        On error: try fallback billing.entitlements.revoke(customerId, addon.grantsEntitlement)
      - If addon is limit-type (affectsLimitKey != null):
        Call billing.limits.removeBySource('addon', purchaseId)
        On error: try fallback billing.limits.remove(customerId, addon.affectsLimitKey)
      - If addon definition is undefined: call BOTH revokeBySource AND removeBySource
        (we don't know the type, so try both; 0 count is not an error)

   c. Record outcome: { purchaseId, addonSlug, outcome: 'success'|'failed', error? }

   d. WEBHOOK FLOW ONLY - immediate DB update per addon:
      - If QZPay revocation succeeded: UPDATE billing_addon_purchases SET status='canceled',
        canceledAt=NOW() WHERE id = purchaseId AND status = 'active'
        (The AND status='active' guard ensures idempotency)
      - If QZPay revocation failed:
        - DO NOT update the purchase status (remains 'active')
        - Update metadata: SET metadata.revocationRetryCount = COALESCE(metadata.revocationRetryCount, 0) + 1,
          metadata.lastRevocationAttempt = NOW()
        - Log error with retryNeeded=true, purchaseId, addonSlug, error message
        - Report to Sentry
        - Continue to next addon (do not abort the loop)

   e. ADMIN FLOW ONLY - no DB writes during this loop:
      - Collect all outcomes (success and failure) in an array
      - Continue to next addon even on failure (process all addons to give complete error report)

5. Call clearEntitlementCache(customerId).

6. Write summary audit log entry with all outcomes.

7. Determine overall result:

   WEBHOOK PATH:
   - If ALL addons succeeded: return success (200 OK).
   - If ANY addon failed: throw error (qzpay-hono returns 500, triggering MercadoPago retry).
     Successfully revoked addons are already marked 'canceled' in DB (step 4d).
     Failed addons remain 'active' and will be picked up by cron safety net.

   ADMIN PATH (two-phase):
   - If ANY addon failed in Phase 1 (step 4e): return error immediately (AC-2.2).
     No addon purchases updated in DB, subscription NOT cancelled.
     QZPay revocations that succeeded are orphaned but harmless (idempotent on retry).
     Return error response with both failedPurchases and succeededPurchases arrays.
   - If ALL addons succeeded in Phase 1, execute Phase 2:
     a. Check if subscription is already cancelled before proceeding (handles race with concurrent webhook).
     b. Single DB transaction (ONLY local DB writes):
        - UPDATE all addon purchases to status='canceled', canceledAt=NOW()
        - UPDATE local billing_subscriptions status to 'cancelled'
     c. AFTER DB transaction commits (OUTSIDE the transaction):
        Cancel subscription in QZPay: billing.subscriptions.cancel(subscriptionId, { cancelAtPeriodEnd: false, reason })
        - If this call FAILS: return HTTP 500 with code 'SUBSCRIPTION_CANCEL_FAILED'.
          Addon purchases are already 'canceled' in DB (step b committed), QZPay entitlements already
          revoked (Phase 1). Report to Sentry. Log error, schedule retry via cron safety net
          (subscription will be caught on next webhook sync). Admin can retry: Phase 1 will find
          no active addons (skips), Phase 2 re-attempts the subscription cancel.
     d. Return success with list of revoked addons and subscriptionId.
```

**Retry mechanism (hybrid approach):**

**Primary: MercadoPago native retries.** If the webhook handler throws during addon revocation, qzpay-hono returns HTTP 500 (verified: `onError` returns undefined, qzpay-hono falls through to `response.error(message, 500)`) and MercadoPago retries per its schedule (0min, 15min, 30min, then extended intervals: 6h, 48h, 96h, 96h.. total retry window exceeds 4 days). The handler is idempotent (only processes `status='active'` addon purchases), so retries are safe.

**Secondary: Cron safety net.** The addon expiry cron job (`addon-expiry.job.ts`) is extended with a new phase:
1. Query billing_addon_purchases WHERE status = 'active' AND deleted_at IS NULL AND subscriptionId IN (SELECT id FROM billing_subscriptions WHERE status = 'cancelled')
2. For each found purchase, attempt QZPay revocation (same logic as step 4b above)
3. Track retry count in `metadata.revocationRetryCount` (integer) and `metadata.lastRevocationAttempt` (ISO timestamp) on the addon purchase record. Increment on each cron attempt.
4. After 3 cron retries (separate from MercadoPago retries), report to Sentry as critical and stop automatic retries. The addon purchase remains `status='active'` for manual admin intervention.

NOTE: The cron safety net subquery on `billing_subscriptions.status` does not require a dedicated index given the expected table size (<10K rows). Monitor query performance as the table grows.

### Flow B: Plan Change Addon Limit Recalculation

```
Trigger: Plan-change route (PRIMARY, synchronous, apps/api/src/routes/billing/plan-change.ts after successful plan change)
         OR MercadoPago webhook (SAFETY NET only, subscription_preapproval.updated with same status but different planId)
         NOTE: QZPay changePlan() is a synchronous local operation that keeps the same subscription ID
         and updates the planId field. It does NOT cancel+create. The plan-change route is the reliable
         primary trigger. The webhook safety net may rarely fire since MercadoPago webhooks only handle
         status changes, not plan changes.

1. Extract customerId, oldPlanId, and newPlanId from the event.
   - Webhook: oldPlanId from local billing_subscriptions, newPlanId from fetched subscription data
   - Plan-change route: both available from the route context

2. Query billing_addon_purchases WHERE customerId = ? AND status = 'active' AND deleted_at IS NULL.

3. For each purchase, resolve addon definition via getAddonBySlug(purchase.addonSlug).
   Filter to limit-type addons only (addon.affectsLimitKey != null).
   Discard entries where addon definition is not found (log warning).

4. If no limit-type addons: log debug "No active limit addons for customer {customerId}", return success.

5. GROUP active limit addons by limitKey (addon.affectsLimitKey):
   Example: { 'MAX_PHOTOS': [addon1, addon2], 'MAX_ACCOMMODATIONS': [addon3] }

6. For each limitKey group:
   a. Resolve base limit from ALL_PLANS: find plan by slug === newPlanId, then find limit by key.
      - If plan not found in ALL_PLANS: log error, skip this group, report to Sentry.
      - If limitKey not found in plan's limits: basePlanLimit = 0, log WARNING
        "New plan {newPlanId} does not define limit {limitKey}, using basePlanLimit=0"

   b. If basePlanLimit is -1 (unlimited): skip this limitKey, log debug
      "Base plan has unlimited for {limitKey}, skipping addon recalculation"

   c. Compute totalAddonIncrement = SUM(purchase.limitAdjustments.find(la => la.limitKey === limitKey)?.increase for all purchases in this group)
      Compute newMaxValue = basePlanLimit + totalAddonIncrement

   d. Determine direction: resolve old plan's base limit for this key.
      oldMaxValue = oldPlan.baseLimits[limitKey] + totalAddonIncrement
      (where totalAddonIncrement is the sum of all active addon limit adjustments for this limitKey,
      same value just computed in step 6c. Do NOT use `billing.limits.check()` for oldMaxValue..
      that reflects the already-updated QZPay state. Use the old plan's base limit from config.)
      If newMaxValue < oldMaxValue: this is a downgrade for this limitKey.

   e. If downgrade detected:
      Try: const usage = await billing.limits.check(customerId, limitKey)
      If usage.currentValue > newMaxValue:
        - Dispatch PLAN_DOWNGRADE_LIMIT_WARNING notification (fire-and-forget)
        - Report to Sentry as warning (captureMessage, not captureException)
      If billing.limits.check() throws: log warning, skip usage check, proceed

   f. Call billing.limits.set({
        customerId,
        limitKey,
        maxValue: newMaxValue,
        source: 'addon',
        sourceId: ADDON_RECALC_SOURCE_ID  // Sentinel UUID constant — NOT a specific purchaseId.
                                          // This limit is an aggregation of multiple addons.
                                          // Using a specific purchaseId would break removeBySource if that addon is later cancelled.
                                          // Individual addon cancellation must trigger re-recalculation, not removeBySource.
                                          // See "Recalculation sourceId Strategy" in Technical Context.
      })

   g. A failure in one limitKey group does NOT block other groups. Collect all errors.

7. Call clearEntitlementCache(customerId).

8. Write summary audit log entry with all recalculations and their outcomes.
```

---

## Implementation Checklist

Items that must be created or modified (for implementer reference):

### New files
- [ ] New admin route: `apps/api/src/routes/billing/admin/subscription-cancel.ts`
  - Follow the existing admin route pattern from `customer-addons.ts` in the same directory
  - Use Hono route with `requirePermission(PermissionEnum.MANAGE_SUBSCRIPTIONS)` middleware
  - Schema validation: path params `z.object({ id: z.string().uuid() })`, body `z.object({ reason: z.string().max(500).optional() })`
  - Call the new service method for two-phase revocation + subscription cancel
- [ ] New constants file: `apps/api/src/services/addon-lifecycle.constants.ts`
  - Export `ADDON_RECALC_SOURCE_ID = 'a0d0e1c2-0000-5000-8000-000000000001'` (sentinel UUID for aggregated limit recalculations)
  - See "Recalculation sourceId Strategy" in Technical Context for full documentation
- [ ] New service method for strict revocation (in `addon-entitlement.service.ts` or new file):
  - `revokeAddonForSubscriptionCancellation({ customerId, purchase, addonDef? })` .. strict error handling (QZPay errors are fatal, not warnings)
  - `recalculateAddonLimitsForCustomer({ customerId, limitKey })` .. shared function for aggregated limit re-recalculation (used by Flow B and AC-3.9 individual cancel only.. NOT used by Flow A, which uses direct `removeBySource()`/`remove()` since all addons are being revoked). Uses `ADDON_RECALC_SOURCE_ID` as sourceId.
- [ ] DB migration for `subscription_id` index
- [ ] New React Email template for `PLAN_DOWNGRADE_LIMIT_WARNING` notification:
  - File: `packages/notifications/src/templates/subscription/plan-downgrade-limit-warning.tsx`
    (follows existing template organization: `templates/{category}/{kebab-case-name}.tsx`; see `templates/addon/addon-expiration-warning.tsx` as reference)
  - Props interface:
    ```typescript
    interface PlanDowngradeLimitWarningProps {
      customerName: string;
      planName: string;
      limitKey: string;
      oldLimit: number;
      newLimit: number;
      currentUsage: number;
    }
    ```
  - Follow the existing template pattern (see `AddonExpirationWarning.tsx` as reference):
    React Email components (`Html`, `Head`, `Body`, `Container`, `Text`, `Button`, etc.)
  - Import in `notification.service.ts` and add case to `selectTemplate()` switch (line ~289):
    ```typescript
    case 'plan_downgrade_limit_warning': {
      const p = payload as PlanDowngradeLimitWarningPayload;
      return PlanDowngradeLimitWarning({ customerName: p.customerName, planName: p.planName, limitKey: p.limitKey, oldLimit: p.oldLimit, newLimit: p.newLimit, currentUsage: p.currentUsage });
    }
    ```

### Modified files
- [ ] `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` .. add cancellation cleanup + plan change detection
- [ ] `apps/api/src/routes/billing/plan-change.ts` .. add addon limit recalculation after plan change
- [ ] `apps/api/src/routes/billing/admin/index.ts` .. mount new subscription-cancel route: `import { subscriptionCancelRoute } from './subscription-cancel';` and add `app.route('/subscriptions', subscriptionCancelRoute)` alongside the existing `app.route('/subscriptions', subscriptionEventsRoute)` (Hono merges routes on the same base path)
- [ ] `apps/api/src/services/addon.user-addons.ts` .. modify `cancelUserAddon()` to call `recalculateAddonLimitsForCustomer()` after removing a limit-type addon's entitlements, instead of relying on the existing removeBySource fallback chain (see AC-3.9). For entitlement-type addons, the existing flow is unchanged.
- [ ] `apps/api/src/cron/jobs/addon-expiry.job.ts` .. add retry phase for failed revocations (query addon purchases with `status='active'` linked to `cancelled` subscriptions; track retry count in `metadata.revocationRetryCount`)
- [ ] `packages/notifications/src/types/notification.types.ts` .. TWO changes required:
  1. Add new value to the `NotificationType` enum (currently 17 values, this will be the 18th):
     ```typescript
     // Add to enum NotificationType:
     PLAN_DOWNGRADE_LIMIT_WARNING = 'plan_downgrade_limit_warning'
     ```
  2. Add a new payload interface and include it in the `NotificationPayload` discriminated union:
     ```typescript
     export interface PlanDowngradeLimitWarningPayload extends BaseNotificationPayload {
       readonly type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING;
       readonly planName: string;
       readonly limitKey: string;
       readonly oldLimit: number;
       readonly newLimit: number;
       readonly currentUsage: number;
       // NOTE: BaseNotificationPayload also requires: recipientEmail, recipientName,
       // userId (string | null), and optional customerId, idempotencyKey.
       // The caller must provide all base fields when constructing this payload.
     }

     // Update NotificationPayload union to include:
     export type NotificationPayload =
       | PurchaseConfirmationPayload
       | PaymentNotificationPayload
       | SubscriptionEventPayload
       | SubscriptionLifecyclePayload
       | AddonEventPayload
       | TrialEventPayload
       | AdminNotificationPayload
       | FeedbackReportPayload
       | PlanDowngradeLimitWarningPayload;  // <-- add this
     ```
  NOTE: `NotificationType` is an `enum` (not a discriminated union itself). The discriminated union is the `NotificationPayload` type which uses `type` field matching enum values. `BaseNotificationPayload` provides common fields: `type`, `recipientName`, `recipientEmail`, `userId` (string | null), `customerId?`, `idempotencyKey?`. NOTE: `baseUrl` is NOT part of the payload.. it comes from `NotificationServiceDeps.siteUrl`.
- [ ] `packages/notifications/src/services/notification.service.ts` .. add `PLAN_DOWNGRADE_LIMIT_WARNING` case in `selectTemplate()` switch
- [ ] `packages/i18n/src/locales/{es,en,pt}/billing.json` .. add notification text keys under a new `notifications` top-level key. billing.json currently has 16 top-level keys: `common`, `subscription`, `addons`, `payment`, `invoices`, `plans`, `cancel`, `checkout`, `limits`, `usage`, `upgrade`, `vip`, `errorBoundary`, `errorState`, `island`, `pricing`. The new `notifications` key will be the 17th.

  **Spanish (es/billing.json):**
  ```json
  {
    "notifications": {
      "planDowngradeLimitWarning": {
        "subject": "Tu límite de {limitKey} se redujo con el cambio de plan",
        "body": "Al cambiar al plan {planName}, tu límite de {limitKey} se redujo de {oldLimit} a {newLimit}. Actualmente tenés {currentUsage} en uso. Podés comprar un plan superior, eliminar contenido, o contactar soporte.",
        "action": "Ver mis límites"
      }
    }
  }
  ```

  **English (en/billing.json):**
  ```json
  {
    "notifications": {
      "planDowngradeLimitWarning": {
        "subject": "Your {limitKey} limit was reduced with the plan change",
        "body": "After switching to the {planName} plan, your {limitKey} limit was reduced from {oldLimit} to {newLimit}. You currently have {currentUsage} in use. You can upgrade to a higher plan, remove some content, or contact support.",
        "action": "View my limits"
      }
    }
  }
  ```

  **Portuguese (pt/billing.json):**
  ```json
  {
    "notifications": {
      "planDowngradeLimitWarning": {
        "subject": "Seu limite de {limitKey} foi reduzido com a mudança de plano",
        "body": "Ao mudar para o plano {planName}, seu limite de {limitKey} foi reduzido de {oldLimit} para {newLimit}. Atualmente você tem {currentUsage} em uso. Você pode contratar um plano superior, remover conteúdo, ou entrar em contato com o suporte.",
        "action": "Ver meus limites"
      }
    }
  }
  ```
- [x] `packages/schemas/src/enums/permission.enum.ts` .. verify `MANAGE_SUBSCRIPTIONS` exists (CONFIRMED: line 281, value `'subscription.manage'`). No changes needed.

### Required database migration

Add the index to the schema file `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts` in the table's index definition:

```typescript
// Add to the existing indexes object in billingAddonPurchases table:
addonPurchases_subscriptionId_active_idx: index('idx_addon_purchases_subscription_active')
  .on(table.subscriptionId)
  .where(sql`status = 'active' AND deleted_at IS NULL`)
```

Then generate the migration with `pnpm db:generate`. The generated SQL should be equivalent to:

```sql
CREATE INDEX idx_addon_purchases_subscription_active
ON billing_addon_purchases (subscription_id)
WHERE status = 'active' AND deleted_at IS NULL;
```

NOTE: Drizzle does not support `CONCURRENTLY` in generated migrations. For production, the migration should be safe because the table is small (addon purchases per customer are typically < 10). If the table grows significantly, consider adding `CONCURRENTLY` manually to the generated SQL file before running.

---

## Testing Strategy

All tests use Vitest. QZPay billing methods must be mocked (the billing instance is injected via `getQZPayBilling()`). Use `apps/api/test/helpers/mock-factories.ts` for creating test fixtures.

### Unit Tests (write first, TDD style)

**File: `apps/api/test/services/addon-lifecycle.test.ts`**

| Test | AC | What to verify |
|------|-----|----------------|
| Revokes entitlement addon via revokeBySource | AC-1.1 | Calls `billing.entitlements.revokeBySource('addon', purchaseId)`, updates status to 'canceled' |
| Revokes limit addon via removeBySource | AC-1.1 | Calls `billing.limits.removeBySource('addon', purchaseId)`, updates status to 'canceled' |
| Falls back to revoke() on revokeBySource failure | AC-1.1 | When revokeBySource throws, calls `billing.entitlements.revoke(customerId, entitlementKey)` |
| Idempotent: skips already-canceled addons | AC-1.2 | Query returns 0 active addons, no QZPay calls made, returns success |
| Partial failure preserves progress | AC-1.3, AC-1.6 | Addon 1 succeeds (status='canceled'), addon 2 fails (status stays 'active', metadata.revocationRetryCount=1) |
| Processes all addons even after failure | AC-1.3 | Addon 2 fails, addon 3 still processed |
| Handles unknown addon slug | AC-1.7 | getAddonBySlug returns undefined, calls BOTH revokeBySource and removeBySource |
| No active addons returns success | AC-1.4 | Empty query result, debug log, success returned |
| Clears entitlement cache | AC-1.1 | `clearEntitlementCache(customerId)` called after processing |

**File: `apps/api/test/services/addon-limit-recalculation.test.ts`**

| Test | AC | What to verify |
|------|-----|----------------|
| Recalculates limit on upgrade (single addon) | AC-3.1 | `limits.set({ maxValue: newBase + addonIncrease, sourceId: ADDON_RECALC_SOURCE_ID })` |
| Aggregates multiple addons for same limitKey | AC-3.2 | `limits.set({ maxValue: newBase + SUM(increments) })` called once |
| Skips entitlement addons | AC-3.3 | No `billing.entitlements` calls for entitlement addons |
| Skips unlimited (-1) base limit | AC-3.5 | No `limits.set()` call for that limitKey |
| Defaults to basePlanLimit=0 when limitKey missing | AC-3.6 | `limits.set({ maxValue: 0 + increment })`, warning logged |
| Re-recalculates after individual addon cancel | AC-3.9 | After removing one addon, remaining addon increments still reflected in aggregated limit |
| Downgrade triggers warning when usage > newLimit | AC-4.3 | `limits.check` returns high usage, notification dispatched |
| Downgrade skips warning when usage < newLimit | AC-4.2 | No notification dispatched |
| Proceeds when limits.check throws | AC-4.4 | Warning logged, no notification, limit still updated |

### Integration Tests (write alongside implementation)

**File: `apps/api/test/routes/admin-subscription-cancel.test.ts`**

| Test | AC | What to verify |
|------|-----|----------------|
| Happy path: cancels subscription with addons | AC-2.1 | Phase 1 revokes, Phase 2 updates DB, returns 200 |
| Requires MANAGE_SUBSCRIPTIONS permission | AC-2.3 | Returns 403 without permission |
| Returns 400 for already-cancelled subscription | AC-2.4 | No QZPay calls, 400 response |
| Returns 404 for unknown subscription | AC-2.3 | 404 response |
| Returns 500 when addon revocation fails | AC-2.2 | No DB changes, error includes failed/succeeded lists |
| Validates request body schema | AC-2.3 | Rejects reason > 500 chars |
| Passes reason to QZPay cancel | AC-2.1 | `cancel(id, { cancelAtPeriodEnd: false, reason })` called |
| Phase 2 partial failure: QZPay cancel fails after DB commit | AC-2.1 | DB committed (addons canceled), returns 500 SUBSCRIPTION_CANCEL_FAILED, Sentry reported |

**File: `apps/api/test/webhooks/subscription-cancellation.test.ts`**

| Test | AC | What to verify |
|------|-----|----------------|
| Webhook triggers addon cleanup on cancellation status | AC-1.1 | processSubscriptionUpdated calls revocation flow |
| Webhook detects planId change (same status) | AC-3.7 | planId comparison triggers Flow B |
| Webhook returns 500 on partial failure | AC-1.3 | Error propagates, MercadoPago retries |

**File: `apps/api/test/cron/addon-expiry-retry.test.ts`**

| Test | AC | What to verify |
|------|-----|----------------|
| Cron picks up orphaned active addons on cancelled subs | AC-1.6 | Queries correct join, processes matches |
| Cron increments revocationRetryCount | AC-1.3 | metadata updated per attempt |
| Cron stops after 3 retries, reports to Sentry | AC-1.3 | No processing after 3 retries, Sentry called |

### Mocking Requirements

- **QZPay billing instance**: Mock all methods on `billing.entitlements`, `billing.limits`, `billing.subscriptions`
- **Database**: Use test database (do NOT mock DB.. project policy requires real DB for integration tests)
- **Sentry**: Mock `Sentry.captureException` and `Sentry.captureMessage`
- **Notifications**: Mock `@repo/notifications` dispatch (fire-and-forget, verify it was called)
- **clearEntitlementCache**: Mock or spy to verify it was called with correct customerId
- **getAddonBySlug / getPlanBySlug**: Use real config (these are pure functions with no side effects)

---

## Acceptance Criteria Summary

| ID | Story | Scenario | Priority |
|----|-------|----------|----------|
| AC-1.1 | Webhook cancellation | All addons revoked on cancellation (entitlement + limit types) | MUST |
| AC-1.2 | Webhook cancellation | Idempotent on duplicate webhook | MUST |
| AC-1.3 | Webhook cancellation | Partial failure: per-addon independence, retry via cron | MUST |
| AC-1.4 | Webhook cancellation | No active addons .. success immediately | MUST |
| AC-1.5 | Webhook cancellation | Unknown subscriptionId .. success | SHOULD |
| AC-1.6 | Webhook cancellation | Partial progress preserved across retries | MUST |
| AC-1.7 | Webhook cancellation | Retired addon slug .. revoke by sourceId, warn | SHOULD |
| AC-1.8 | Webhook cancellation | Pending addons not cancelled, confirmation must check subscription | SHOULD |
| AC-1.9 | Webhook cancellation | Customer not found in billing_customers .. log warning, return 200 | SHOULD |
| AC-1.10 | Webhook cancellation | Handler responds within 22 seconds, warns at 15s | MUST |
| AC-2.1 | Manual cancellation | Same cleanup as webhook, with admin audit trail | MUST |
| AC-2.2 | Manual cancellation | QZPay failure .. admin sees error, cancellation aborted | MUST |
| AC-2.3 | Manual cancellation | Admin route must be created | MUST |
| AC-2.4 | Manual cancellation | Already-cancelled subscription returns 400 | MUST |
| AC-3.1 | Plan change | Combined limit recalculated correctly (single addon) | MUST |
| AC-3.2 | Plan change | Multiple addons same limitKey .. SUM increments | MUST |
| AC-3.3 | Plan change | Entitlement addons unaffected | MUST |
| AC-3.4 | Plan change | No limit addons .. no QZPay calls | MUST |
| AC-3.5 | Plan change | Unlimited base plan .. skip | MUST |
| AC-3.6 | Plan change | New plan missing limitKey .. basePlanLimit=0, warn | SHOULD |
| AC-3.7 | Plan change | Webhook planId comparison (SAFETY NET only, not primary trigger) | SHOULD |
| AC-3.8 | Plan change | Plan-change route triggers recalculation (PRIMARY mechanism) | MUST |
| AC-3.9 | Plan change | Individual addon cancellation after recalculation re-recalculates aggregated limit | MUST |
| AC-4.1 | Plan downgrade | Combined limit decreases correctly | MUST |
| AC-4.2 | Plan downgrade | Usage below new limit .. no warning | MUST |
| AC-4.3 | Plan downgrade | Usage exceeds new limit .. in-app notification, Sentry warning | SHOULD |
| AC-4.4 | Plan downgrade | Cannot read usage .. proceed, no warning | MUST |
| AC-5.1 | Audit | Structured log with specific fields for every event | MUST |
| AC-5.2 | Audit | Uses apiLogger pattern | MUST |
| AC-5.3 | Audit | Sentry for unrecoverable errors with specific tags/extra | MUST |
