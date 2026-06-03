---
spec-id: SPEC-194
title: Billing Lifecycle Robustness & Bug Fixes
type: feature
complexity: high
status: draft
created: 2026-06-03T00:00:00Z
effort_estimate_hours: 50-80
tags: [billing, lifecycle, refunds, dunning, trials, crons, state-machine, robustness, bugfix]
parent: SPEC-193
depends_on: [SPEC-143, SPEC-168]
relates_to: [SPEC-145, SPEC-149, SPEC-167, SPEC-192]
blocks: [real-money-go-live]
priority: high
worktree: null
branch: null
base: staging
---

# SPEC-194: Billing Lifecycle Robustness & Bug Fixes

> Child of SPEC-193 (Billing Go-Live Readiness — Master). Owns the **lifecycle correctness bugs** that
> surfaced during the 2026-06-03 end-to-end billing audit and had no dedicated spec. Each fix ships with a
> regression test that reproduces the bug first (per the project testing policy). Severity ranking is the
> implementation order.

## 1. Context

The billing money-paths (refund, dunning, trial expiry, scheduled plan changes, addon lifecycle) work in
the happy path but the audit found ~18 correctness gaps — from an advisory lock that protects nothing to
refunds that never revoke access. None of these are enforcement (SPEC-145), catalog (SPEC-192), webhook
error-handling (SPEC-149), or downgrade policy (SPEC-167); they are **lifecycle correctness**, collected
here so they are fixed once, coherently, with a shared state-machine foundation.

**Boundary with sibling specs (do NOT duplicate):**

- Webhook handlers swallowing errors + dead-letter omissions → **SPEC-149** (webhook error-handling).
- Addon base-plan lookup by slug failing post-SPEC-168 (`addon-entitlement.service.ts:160`) → **SPEC-192 FR-4**
  (this is the FR-4 bug; 194 references it, 192 fixes it).
- `clearEntitlementCache` *wiring* on the gate side + the transversal completeness test → **SPEC-145**.
  194 owns the cache-clear calls that live inside the lifecycle fixes below (refund, dunning-cancel),
  and they feed 145's transversal guard (INV-1).
- Public-listing cache revalidation on pause/downgrade → **SPEC-167** (was 145 D-5).
- Sentry alert *wiring* for cron failures → **SPEC-149**; 194 makes the crons *fail loudly enough to be
  alerted* (return error counts, don't swallow).

## 2. Foundational task (do first — other tasks build on it)

- **T-194-01 [INV-4] State-machine transition guard.** Introduce a validated transition table for
  `SubscriptionStatusEnum` (e.g. `active→past_due→cancelled`, `trialing→active|cancelled`,
  `pending_provider→active|abandoned`) and a single helper that all status writes route through, rejecting
  illegal transitions. Migrate the free-form `UPDATE ... SET status` sites (webhook, crons, services) onto
  it behind a shim so refund/dunning/cancel/trial all change state safely. This is the substrate for
  T-194-02..05. See audit "state machine has no validation; transitions are free-form".

## 3. Phase 1 — CRITICAL

- **T-194-02 [G-02] Fix trial-expiry advisory lock.** `blockExpiredTrials` (`trial.service.ts:357-376`)
  acquires advisory lock 1004 inside a `withServiceTransaction` that **closes before** the processing loop
  runs — the lock guards nothing; two cron instances can both process. Restructure so the lock guards the
  claim and per-sub external (QZPay/MP) calls happen in their own short txns with a claimed-row guard
  (respect ADR-019: no external calls inside the lock-holding tx).
- **T-194-03 [G-01] Refund (admin) revokes access + clears cache.** `onAfterPaymentRefund`
  (`qzpay-admin-hooks.ts:398-428`) currently only logs. Per master O-2/INV-1: transition the subscription
  via the state-machine (T-194-01) to `cancelled` (full refund) or keep with audit (partial — see T-194-14),
  revoke entitlements, and call `clearEntitlementCache(customerId)`.
- **T-194-04 [G-06] Refund (MP webhook) does the same.** `payment-logic.ts:493` /
  `subscription-payment-handler.ts:74` only flip `billing_payments.status='refunded'`. Apply the same
  policy as T-194-03 (state transition + revoke + cache clear).

## 4. Phase 2 — HIGH

- **T-194-05 [G-03] Dunning non-payment cancellation clears cache.** The
  `subscription.canceled_nonpayment` callback (`dunning.job.ts:261-313`) cancels a past_due sub but never
  calls `clearEntitlementCache`. Add it (INV-1).
- **T-194-06 [G-04] Trial-expiry notifications fire.** The cron builds `new TrialService(billing)` without
  the notification sender (`trial-expiry.ts:61`), so `TRIAL_EXPIRED` emails never send. Inject the sender.
- **T-194-07 [G-05] Scheduled-change apply is idempotent.** `apply-scheduled-plan-changes.ts:250-272`: if
  `markResolved` (step 5) fails after the plan was applied, the next tick re-applies (double `changePlan`
  and double addon recalc). Stamp `scheduledPlanChange.status='applied'` atomically with/before the resolve so
  a failed resolve never re-runs the mutation.

## 5. Phase 3 — MEDIUM

- **T-194-08 [G-08] Addon-purchase split-state reconciliation.** When `applyAddonEntitlements` fails
  non-fatally during `confirmAddonPurchase` (`addon.checkout.ts:683-699`), the purchase row is `active` but
  no real grant exists. Add a reconciliation phase (mirror the addon *removal* reconciliation that already
  exists in addon-expiry).
- **T-194-09 [G-09] Addon-expiry notification not skipped.** `addon-expiry.job.ts:244-250` does two
  sequential queries; an addon that expires between them gets expired but skips its `ADDON_EXPIRED` notif.
  Single-fetch or re-check.
- **T-194-10 [G-10/G-11] Scale/timeout.** Addon-expiry processes sequentially and can exceed the 2-min
  timeout >100 items (`addon-expiry.job.ts:222`); `blockExpiredTrials` loads all `trialing` subs unpaginated
  (`trial.service.ts:383`). Paginate/batch both.
- **T-194-11 [GAP-4] Downgrade price normalization.** `subscription-downgrade.service.ts:216` compares
  absolute prices while the route (`plan-change.ts:272`) normalizes by `intervalCount`. Align the service to
  the route's normalized comparison so annual→monthly same-tier is classified consistently.
- **T-194-12 [GAP-6] `/change-plan` idempotency.** Add `idempotencyKeyMiddleware` to the plan-change route
  (start-paid and addons already have it) to close the double-submit window.
- **T-194-13 [GAP-8] ABANDONED dual-vocab.** The cron writes `incomplete_expired` while
  `SubscriptionStatusEnum.ABANDONED='abandoned'` exists; a direct query on `'abandoned'` finds nothing.
  Pick one canonical value and map consistently (fold into T-194-01 state-machine).

## 6. Phase 4 — LOW / hardening

- **T-194-14 [G-18/G-13] Partial refund modeling + audit trail.** Model partial vs full refund
  (`refunded_amount` integer column is never written — only `metadata.refundedAmount`); write a
  `billing_subscription_events` audit row for every refund (`qzpay-admin-hooks.ts:396`).
- **T-194-15 [G-14] Exchange-rate cron advisory lock.** `exchange-rate-fetch.job.ts` runs without an
  advisory lock; two replicas can write concurrently. Add a lock (low criticality; coordinate with SPEC-150
  which also touches FX).
- **T-194-16 [G-16] Retire deprecated addonAdjustments metadata path.** The read-modify-write metadata race
  in `addon-entitlement.service.ts:59` is documented/accepted but the deprecated path is still written —
  stop writing it (the `billing_addon_purchases` table is authoritative).
- **T-194-17 [G-17] Abandoned-sub user notification.** `abandoned-pending-subs.job.ts` marks subs abandoned
  with no user email; add an optional notification.
- **T-194-18 [GAP-10] Annual subscription pause behavior.** `subscription-pause.ts:78` calls MP preapproval
  pause, but annual one-time subs have no preapproval to pause. Define + guard the behavior (reject or no-op
  with a clear error).
- **T-194-19 [GAP-9 cron alerting] Make scheduled-change failures alertable.** When
  `apply-scheduled-plan-changes` exhausts `MAX_APPLY_ATTEMPTS` (status `failed`), it only `logger.error`s.
  Return a non-zero error signal / structured result so SPEC-149 can wire the Sentry alert. (Sentry wiring
  itself is SPEC-149.)
- **T-194-20 [GAP-15] Locale in return URLs.** `RETURN_URL_LOCALE='es'` hardcoded
  (`start-paid.ts:55`). Thread the customer locale. (Candidate to fold into SPEC-150 if it lands first.)

## 7. Dispute handling (product decision D-4 = manual in v1)

- **T-194-21 Chargeback contract.** Per master D-4, chargeback resolution stays **manual** in v1
  (`dispute-logic.ts` log + admin notification). Add: an admin notification, a documented runbook, and a
  test that pins the manual contract (so an accidental auto-cancel regresses visibly). Auto-transition is a
  post-go-live revisit.

## 8. Definition of done

- INV-4 state-machine in place; all subscription status writes route through it.
- Every CRITICAL/HIGH bug fixed with a regression test that fails before the fix.
- Refund (admin + webhook) revokes entitlements + clears cache + transitions state (full) or audits (partial).
- Dunning cancellation, trial expiry, scheduled-change apply all correct and idempotent.
- 100% functional coverage on the touched lifecycle services/crons (chunked coverage per SPEC-143).
- Cross-spec invariants respected: INV-1 (cache) feeds 145's transversal guard; INV-4 backs 147/148/167.
- Manual staging + prod smoke for billing-core paths (refund, dunning, trial, scheduled-change) signed off.

## 9. Cross-references

- Master: SPEC-193. Siblings: SPEC-145 (cache transversal guard INV-1), SPEC-149 (webhook errors + Sentry
  wiring), SPEC-167 (cache revalidation), SPEC-192 (FR-4 plan-lookup bug, the addon base-plan fix).
- Engram: `billing/spec-reorg-2026-06`, `#817` (smoke F-findings), audit gaps G-01..G-18 / GAP-1..17.
- ADRs: 019 (tx isolation + advisory locks — central to T-194-01/02), 016 (fail-open).
- Code hotspots: `services/trial.service.ts`, `routes/billing/admin/qzpay-admin-hooks.ts`,
  `routes/webhooks/mercadopago/payment-logic.ts`, `cron/jobs/{dunning,addon-expiry,apply-scheduled-plan-changes,trial-expiry,exchange-rate-fetch,abandoned-pending-subs}.*`,
  `services/{subscription-downgrade,addon.checkout,addon-entitlement,subscription-pause}.*`,
  `routes/billing/plan-change.ts`, `packages/schemas/src/enums/subscription-status.enum.ts`.
