---
specId: SPEC-147
title: User self-service subscription cancellation
type: feat
status: draft
complexity: medium
created: 2026-05-19T00:00:00Z
discoveredDuring: SPEC-143 T-143-27
tags: [billing, subscription, user-facing, lifecycle, mp-preapproval, cron]
effortEstimateHours: "8-16"
depends_on: [SPEC-143, SPEC-109]
blocks: []
priority: medium
firstAllocatedViaEngramProtocol: true
---

# SPEC-147: User self-service subscription cancellation

## Context

SPEC-143 T-143-27 set out to test a "user cancels their own subscription, keeps access until current_period_end" flow. The test discovery process revealed that this flow **does not exist in production yet**:

1. `POST /api/v1/protected/billing/subscriptions/:id/cancel` is mounted by qzpay-hono but `billingAdminGuardMiddleware` (`apps/api/src/middlewares/billing-admin-guard.middleware.ts:60-63`) blocks it for non-admin actors. Only `start-paid` and `change-plan` are in `allowedSubPaths`; `cancel` is not.
2. **No hospeda caller of `billing.subscriptions.cancel(id, options)` passes `cancelAtPeriodEnd: true`.** Every production call site uses immediate cancel (`cancelAtPeriodEnd: false`) or relies on qzpay-core's default which, when called without options, ALSO defaults to immediate. The soft-cancel branch of `qzpay-core` exists (`packages/core/src/billing.ts:1373-1388`) but no hospeda code reaches it.
3. qzpay-core's `cancel` implementation does NOT touch the `cancelAtPeriodEnd` column on `billing_subscriptions`. The user-facing route at `apps/api/src/routes/user/protected/subscription.ts:237` reads that column to populate `cancelAtPeriodEnd` on the GET response, but no production path writes it. The column is effectively unused.
4. qzpay-core's `cancel` does NOT call the payment adapter. Cancelling a subscription locally does **not** pause or cancel the underlying MercadoPago preapproval. The provider keeps trying to charge until the preapproval is explicitly paused or until the next charge fails and the failed-payment webhook handler downgrades the subscription to `past_due`.

Result: users can not cancel their subscription from the product. Support must do it via the admin endpoint, which performs an immediate hard cancel — no grace period, no "keep access until period end". This is operationally awkward (every cancel becomes a support ticket) and product-wise unconventional (most SaaS gives users self-service cancel).

## Goal

Wire up a user self-service subscription cancellation flow that:

1. Lets the user trigger a soft cancel from the product (keeps access until `current_period_end`).
2. Pauses the MercadoPago preapproval so the provider does not attempt to charge for the next cycle.
3. Records an auditable event in `billing_subscription_events`.
4. Has a finalization cron that flips soft-cancelled subscriptions to `canceled` once `current_period_end` passes.
5. Optionally supports "uncancel" (the user reactivates the same subscription before `current_period_end` — out of scope for V1, see Open Questions).

## Open Product Questions (must resolve before design)

These decisions belong to product, not engineering. Engineering will block on these before drafting the design.

| # | Question | Default proposal | Why it matters |
|---|---|---|---|
| 1 | Default cancel behaviour for users | Soft cancel (`cancelAtPeriodEnd: true`) | Industry standard for SaaS (Netflix, Spotify). Reduces churn vs immediate cut. |
| 2 | What happens to active addons on a soft cancel? | Stay active until `current_period_end`, then revoke together with the base sub | Addons were paid for the same period as the base sub. Revoking immediately would be unfair. |
| 3 | Can the user "uncancel" before period_end? | OUT OF SCOPE for V1 — defer to follow-up | Common in retention flows, but introduces concurrent-state edge cases. V1 ships without it. |
| 4 | Should we offer a hard-cancel option in the UI? | NO for V1. Default is soft. Hard cancel stays admin-only. | Hard cancel removes self-service ownership and is rarely needed by users. |
| 5 | What notifications fire on cancel? | One immediate "cancellation confirmed" email + one "your access ends in 3 days" reminder near period_end | Reduces "I didn't know" support tickets. |
| 6 | Should we ask "reason" in the UI? | YES — free-text (optional) + canned reasons. Stored in `metadata.cancelReason`. | Drives churn analytics. |
| 7 | Race condition: user cancels then immediately tries to upgrade. What wins? | The cancel. UI hides "Change Plan" once cancel is requested. User must "uncancel" first (when implemented) or wait for hard-cancel to re-subscribe. | Prevents inconsistent state. |

## Workstreams

### A — Backend API (apps/api)

1. **New route** `POST /api/v1/protected/billing/subscriptions/cancel` (or open the qzpay-hono `:id/cancel` endpoint to users by adding `cancel` to the admin-guard `allowedSubPaths`, then wrap with custom pre-handlers — TBD in design).
2. **New service** `apps/api/src/services/subscription-cancel.service.ts` (or extend `TrialService` if scope is small). Responsibilities:
   - Verify user owns the subscription (ownership middleware already handles this).
   - Look up MP preapproval id from the subscription.
   - Call payment adapter `mp.preapproval.pause(preapprovalId)` to pause the provider-side recurring charge.
   - Call `billing.subscriptions.cancel(id, { cancelAtPeriodEnd: true, reason })`.
   - After cancel: update the `cancelAtPeriodEnd` column locally to `true` (qzpay-core does not — see Context #3).
   - Write `billing_subscription_events` row with `triggerSource='user-cancel'`, `eventType=USER_CANCELED` (new event type), `metadata.preapprovalPaused=true/false`, `metadata.reason`.
   - Invalidate entitlement cache for this customer (`clearEntitlementCache`).
   - Queue cancellation-confirmed notification.

3. **New constant** `BILLING_EVENT_TYPES.USER_CANCELED` in `packages/service-core/src/services/billing/constants.ts`.

### B — Payment adapter (qzpay-core or local)

The MP preapproval pause is the trickiest part. Two paths:

**B.1 — Upstream to qzpay-core.** Extend `qzpay-core` paymentAdapter signature with `subscriptions.pause(providerSubscriptionId)`. Call it from the new service. Requires upstream PR + release + dependency bump in hospeda. Slowest path but cleanest.

**B.2 — Local workaround.** Skip qzpay-core. Use the MP API directly inside the new service (`mercadopago.preapproval.update(preapprovalId, { status: 'paused' })`). Faster to ship but leaks MP-specific code into hospeda. Acceptable as a tactical first step.

Design decision lives here. Default proposal: **B.2 for V1**, with B.1 carried as a hardening follow-up.

### C — Finalization cron (apps/api)

New cron job `apps/api/src/cron/jobs/finalize-cancelled-subs.ts`:

- Schedule: daily at 3 AM (avoid the 2 AM trial-expiry slot).
- Query: `billing_subscriptions WHERE status='active' AND cancelAtPeriodEnd=true AND current_period_end <= now()`.
- For each: flip status to `canceled` (US spelling, qzpay-core convention), revoke active addons (re-use Phase 1 logic from admin cancel handler), clear entitlement cache, optionally cancel/finalize the MP preapproval (depends on B path).
- Write `billing_subscription_events` row `triggerSource='finalize-cancelled-cron'`.
- Idempotent via per-sub dedup event (similar to TRIAL_BLOCKED pattern in trial-expiry).

### D — UI (apps/web)

Out of scope for this spec — covered by a separate UI spec. Backend ships first behind a feature flag.

### E — Tests

- E2E happy path: active sub → POST /cancel → status='active' + cancelAtPeriodEnd=true + canceledAt set + audit event + entitlements still load.
- E2E preapproval paused: mp-stub records the pause call. Verify the call payload.
- E2E finalize cron: advance trial_end-like timer → cron runs → status='canceled' + addons revoked + entitlements gone.
- Idempotency: second cancel call on a soft-cancelled sub is a no-op.

## Phases

### Phase 0 — Product alignment

Resolve all seven Open Product Questions above. Output: a one-pager from product. Blocks engineering.

### Phase 1 — Backend route + service

Workstream A. Ships behind a feature flag `HOSPEDA_USER_CANCEL_ENABLED` (default false). PR includes E sub-items 1, 2, 4.

### Phase 2 — Finalization cron

Workstream C. PR includes E sub-item 3.

### Phase 3 — UI

Out of this spec (separate UI spec). Once shipped, enable the feature flag in staging then prod.

### Phase 4 — Cleanup / hardening

Upstream the qzpay-core `subscriptions.pause` adapter method (B.1). Remove the B.2 local workaround.

## Acceptance Criteria

- A user can POST to the new endpoint and receive 200 with a "soft cancel confirmed" response.
- The subscription row shows `status='active'`, `cancelAtPeriodEnd=true`, and `canceledAt` set after the POST.
- The next entitlement load still surfaces the plan's entitlements (no immediate access loss).
- An audit event row exists for the cancellation.
- MercadoPago receives a preapproval pause call (verified via mp-stub in the e2e test).
- The finalization cron job, when run after `current_period_end`, flips the status to `canceled` and revokes addons.
- Documented rollback procedure: feature flag off + manual UPDATE to set `cancelAtPeriodEnd=false` on any soft-cancelled subs.

## Risks

- **MP preapproval pause semantics not verified.** Need to confirm MP supports `status: 'paused'` on preapproval and that it can be reactivated (for future uncancel). If MP only supports `status: 'cancelled'` (one-way), then the finalize step becomes more complex.
- **Concurrent state changes.** If a user cancels and the renewal webhook fires the same second, we need a guard. Reuse the FOR UPDATE pattern from `admin/subscription-cancel.ts:365-370`.
- **Addon handling at period_end.** The current addon-expiry cron operates on `expiresAt`; cancellation is a different signal. Need a clean integration story.

## Out of Scope

- Uncancel (reactivate before period_end). Tracked as a follow-up.
- Refund-on-cancel logic. Subscription cancellations are usually no-refund per SaaS norms; this spec assumes that policy.
- Cancellation surveys/UI prompts. Product concern.

## References

- `apps/api/src/middlewares/billing-admin-guard.middleware.ts:60-63` — the rule that currently blocks users from `/subscriptions/:id/cancel`.
- `apps/api/src/routes/billing/admin/subscription-cancel.ts` — the admin cancel handler we want to mirror for users (with soft-cancel default and MP preapproval pause added).
- `/home/qazuor/projects/PACKAGES/qzpay/packages/core/src/billing.ts:1373-1388` — qzpay-core's `cancel` implementation. Note the bare `canceledAt` + conditional `status='canceled'`. Does NOT touch the `cancelAtPeriodEnd` column or the payment adapter.
- `apps/api/src/routes/user/protected/subscription.ts:237` — the GET endpoint that reads `cancelAtPeriodEnd` (currently always false in production because no writer).
- engram `spec/spec-143/checkpoint-post-t143-26` — the SPEC-143 session that discovered this gap.
- engram `gotcha_qzpay_canceled_spelling` — production canonical is `'canceled'` (US), not `'cancelled'` (UK).
