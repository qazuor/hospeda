---
specId: SPEC-147
title: User self-service subscription cancellation
type: feat
status: completed
complexity: medium
created: 2026-05-19T00:00:00Z
discoveredDuring: SPEC-143 T-143-27
tags: [billing, subscription, user-facing, lifecycle, mp-preapproval, cron]
effortEstimateHours: "8-16"
depends_on: [SPEC-143, SPEC-109]
blocks: []
priority: medium
firstAllocatedViaEngramProtocol: true
parent: SPEC-193
---

# SPEC-147: User self-service subscription cancellation

## Coordination (SPEC-193)

As a child of SPEC-193 "Billing Go-Live Readiness — Master", this spec must honor two invariants:

- **INV-1 (cache invalidation)**: the cancellation service must call `clearEntitlementCache` for the affected customer immediately after the soft-cancel is recorded. This is already called out in Workstream A step 6, but must not be removed or deferred.
- **INV-4 (state-machine)**: all subscription state transitions triggered by cancellation (active → active+cancelAtPeriodEnd, then active+cancelAtPeriodEnd → canceled at period end) must follow the canonical state-machine defined in SPEC-194. Do not implement ad-hoc status flips — use the SPEC-194 transition helpers once they are available.

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

## Resolved Product Questions (owner-confirmed 2026-06-09)

All seven questions resolved at their default proposal except where noted.

| # | Question | RESOLUTION |
|---|---|---|
| 1 | Default cancel behaviour | **Soft cancel** (`cancelAtPeriodEnd: true`). Confirmed. |
| 2 | Addons on soft cancel | **Stay active until `current_period_end`**, revoked together with the base sub by the finalize cron. Confirmed. |
| 3 | Uncancel before period_end | **OUT OF SCOPE V1**. The B.1 mechanism (preapproval `paused`, resumable) deliberately keeps the door open for a follow-up uncancel, but V1 ships without it. |
| 4 | Hard-cancel option in UI | **NO** for V1. Soft is the only user path; hard cancel stays admin-only. Confirmed. |
| 5 | Notifications | **Confirmation + D3 reminder** (owner 2026-06-09): a new `SUBSCRIPTION_CANCEL_CONFIRMED` (immediate) AND a new `SUBSCRIPTION_ACCESS_ENDING_SOON` (D3, scheduled near period_end). NOT the existing `SUBSCRIPTION_CANCELLED` (that fires on hard-cancel from the webhook). |
| 6 | Cancel reason | **YES** — optional, stored in `metadata.cancelReason` (qzpay-core's `cancel({reason})` already writes this). Canned reasons are a UI concern (SPEC-203). |
| 7 | Race: cancel then upgrade | **The cancel wins.** Gate `change-plan` (and `start-paid` re-subscribe) when the sub has `cancelAtPeriodEnd=true` — return a clear error; the user must wait for finalize (uncancel not in V1). The web UI hides "Change Plan" (SPEC-203). |

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

### B — Payment adapter — B.1 CHOSEN (owner 2026-06-09)

**Decision: B.1 — upstream to qzpay-core.** The provider charge-stop happens INSIDE qzpay-core's `cancel()`, not in hospeda. Hospeda just calls `billing.subscriptions.cancel(id, { cancelAtPeriodEnd: true, reason })` and the propagation is automatic.

Realign found (2026-06-09) that B.1 is smaller than it looked: qzpay-core already shipped provider-propagation for `pause()` (commit 400b829, published in core@1.11.0). The only gap is `cancel()` itself, which never called the payment adapter. The qzpay-core change (this spec's prerequisite):

- **qzpay PR #42** (`feat/cancel-provider-propagation`): `core/billing.ts cancel()` now calls `paymentAdapter.subscriptions.cancel(providerId, cancelAtPeriodEnd)` (mirroring the `pause()` propagation pattern); the MercadoPago adapter branches `cancelAtPeriodEnd=true` → `preapproval status:'paused'` (resumable, the soft-cancel case) / `false` → `'cancelled'` (immediate). Minor bump → core@1.12.0 + mercadopago@2.2.0.
- Hospeda then bumps to the released versions and calls `cancel({cancelAtPeriodEnd:true})`. No MP-specific code leaks into hospeda (the B.2 downside is avoided).

**Webhook collision (realign finding, MUST handle):** pausing the MP preapproval makes MP emit `subscription_preapproval.updated` with `status='paused'`, which the current webhook handler (`subscription-logic.ts:79`) maps to local `SubscriptionStatusEnum.PAUSED` — wrong for soft-cancel, which must stay `ACTIVE`+`cancelAtPeriodEnd=true`. The webhook handler MUST be patched to skip the PAUSED transition when the local row already has `cancelAtPeriodEnd=true` (intentional pause), leaving status `ACTIVE`.

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

## Realign findings (2026-06-09, vs 2026-05-19 spec)

The spec predates SPEC-194/145/149/167. Ground-truth against current code:

1. **`admin/subscription-cancel.ts` is DELETED.** The admin cancel logic now lives as `onBeforeSubscriptionCancel`/`onAfterSubscriptionCancel` hooks in `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts`. The FOR UPDATE pattern the spec cited (`:365-370`) migrated to the webhook handler (`subscription-logic.ts:481-485`). Mirror the hook pattern, not the deleted file.
2. **State-machine (SPEC-194 INV-4) helpers EXIST**: `validateSubscriptionStatusTransition` / `checkSubscriptionStatusTransition` in `packages/service-core/src/services/billing/subscription/subscription-status-transitions.ts`. Soft-cancel needs NO new edge (it's a flag on `active`); finalize uses the existing `active → cancelled` edge.
3. **Spelling is `cancelled` (UK, 2 L)** — the transition table + DB + MP convention. The old engram `gotcha_qzpay_canceled_spelling` is wrong for the status enum. Admin hook defensively matches both. Use `cancelled`.
4. **`cancelAtPeriodEnd` reset-to-false on reactivation already exists** (`subscription-logic.ts:463-465`) — if a soft-cancelled user pays again, the webhook clears the flag. Good behavior; reflect it in tests.
5. **3 AM cron slot is OCCUPIED** by archive-abandoned-drafts + conversation-token-cleanup + notification-log-purge. Use a free slot (proposal: `30 4 * * *`). Register in BOTH `schedules.manifest.ts` AND the cron registry (a sync test enforces parity).
6. **`USER_CANCELED` event type is MISSING** from `packages/service-core/src/services/billing/constants.ts` (16 types today, none for user-cancel) — add it + a `FINALIZE_CANCELLED_SUB` type. Events are written inline via `db.insert(billingSubscriptionEvents)` — no helper.
7. **Addon revocation is split**: `revokeAddonForSubscriptionCancellation` (admin, strict) vs `handleSubscriptionCancellationAddons` (webhook, batch-tolerant, in `addon-lifecycle-cancellation.service.ts`). The finalize cron should reuse the WEBHOOK-style batch helper (matches cron semantics).
8. **Feature flag**: no `HOSPEDA_USER_CANCEL_ENABLED` yet. Mirror `HOSPEDA_ADDON_LIFECYCLE_ENABLED` (env.ts + env-registry.hospeda.ts) but with **opt-in** default false (`z.string().optional().transform(v => v === 'true')`).
9. **Ownership middleware** (`billing-ownership.middleware.ts`) covers `/subscriptions/:id/cancel` IF the route uses the `:id` shape. The spec's alternative flat `/subscriptions/cancel` would need handler-level ownership. **Decision: use `POST /subscriptions/:id/cancel`** (open it in the admin-guard `allowedSubPaths`) so the existing ownership middleware applies.
10. **qzpay-core prerequisite** (see Workstream B): qzpay PR #42 adds `cancel()` provider propagation → core@1.12.0 + mercadopago@2.2.0. Hospeda bumps to these before the cancel call propagates. Until bumped, the hospeda code is identical but the MP preapproval is not paused (old behavior).

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-09 | spec-realign + owner decisions | Resolved all 7 product questions (Q5 = confirmation + D3, owner); chose B.1 (qzpay-core upstream, PR #42) over B.2; documented 10 drift findings (deleted admin file, state-machine helpers, cancelled spelling, occupied 3AM slot, missing event type, split addon revocation, feature flag pattern, webhook PAUSED collision, route shape, qzpay bump); B section rewritten for B.1 | spec ready for atomization once qzpay #42 publishes |

## References

- `apps/api/src/middlewares/billing-admin-guard.middleware.ts:60-63` — the rule that currently blocks users from `/subscriptions/:id/cancel`.
- `apps/api/src/routes/billing/admin/subscription-cancel.ts` — the admin cancel handler we want to mirror for users (with soft-cancel default and MP preapproval pause added).
- `/home/qazuor/projects/PACKAGES/qzpay/packages/core/src/billing.ts:1373-1388` — qzpay-core's `cancel` implementation. Note the bare `canceledAt` + conditional `status='canceled'`. Does NOT touch the `cancelAtPeriodEnd` column or the payment adapter.
- `apps/api/src/routes/user/protected/subscription.ts:237` — the GET endpoint that reads `cancelAtPeriodEnd` (currently always false in production because no writer).
- engram `spec/spec-143/checkpoint-post-t143-26` — the SPEC-143 session that discovered this gap.
- engram `gotcha_qzpay_canceled_spelling` — production canonical is `'canceled'` (US), not `'cancelled'` (UK).
