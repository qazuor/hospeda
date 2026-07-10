---
linear: HOS-123
statusSource: linear
title: Annual (one-time) reactivation support — thread interval and branch to the annual checkout path
created: 2026-07-10
type: feat
area: [billing, api]
---

# HOS-123 — Annual (one-time) reactivation support

## 1. Summary

HOS-114 fixed **monthly** paid reactivation (both `reactivate*` methods now go
through a real MercadoPago preapproval via `createPaidSubscription`). As part of
that fix it **fail-closed rejects** an annual-only target plan
(`ANNUAL_REACTIVATION_UNSUPPORTED`), because annual is architecturally different:
it is a one-time upfront charge (`mode: 'payment'`), not a recurring preapproval.

This follow-up adds annual reactivation: let a user reactivate onto an annual
plan, branching to the annual (one-time charge) checkout path, and remove the
rejection guard. It is **not** a trivial branch — annual differs from monthly
reactivation on **four** axes (§4), the most consequential being that annual
confirms on a **different webhook** than the supersession mechanism HOS-114 wired.

> All line anchors verified against `staging` on 2026-07-10 (after HOS-114 + AC-7
> merged). Re-verify before editing.

## 2. Background (HOS-114 OQ-5)

HOS-114 deliberately scoped itself to monthly and deferred annual to this issue.
The deferral is a hard guard, not a TODO comment: `resolveReactivationPlan`
throws `ANNUAL_REACTIVATION_UNSUPPORTED` for any plan with no active monthly
price (`apps/api/src/services/billing/reactivation-plan-guard.ts:144-149`).

## 3. Current state (verified anchors)

### 3.1 The reactivate methods — monthly-only

`TrialService.reactivateFromTrial` (`apps/api/src/services/trial.service.ts:941`)
and `reactivateSubscription` (`:1068`):

1. Resolve + validate the target via `resolveReactivationPlan({ billing, planId })`
   — `planId` is a **UUID** (`billing_plans.id`), not a slug.
2. Create a monthly `mode: 'paid'` preapproval via `createPaidSubscription`
   (`trial.service.ts:985`), stamping `metadata.supersedesSubscriptionId` with the
   old subscription id(s) (`:975-980`, `:992-996`).
3. **Defer** cancelling the old subscription to the confirmation webhook
   (`:999-1007`) — the old sub keeps granting entitlements until the new
   preapproval is confirmed.
4. Return `{ checkoutUrl, subscriptionId, status: 'incomplete' }`.

### 3.2 The rejection guard

`resolveReactivationPlan` (`reactivation-plan-guard.ts:128`) resolves by
`plan.id === planId`, then validates in order: `PLAN_NOT_FOUND` (`:136-141`),
`ANNUAL_REACTIVATION_UNSUPPORTED` (no active monthly price, `:144-149`),
`INVALID_REACTIVATION_PLAN` (free plan, `unitAmount === 0`, `:151-156`). Returns
`{ plan, priceId: monthlyPrice.id }`. It **deliberately does not import**
`subscription-checkout.service.ts` — that would recreate the circular ESM import
that `createPaidSubscription` / `subscription-checkout-error.ts` were extracted to
avoid (`:22-29`). `findMonthlyPrice` is duplicated in the guard for the same
reason.

### 3.3 The annual checkout contract

`initiatePaidAnnualSubscription` (`subscription-checkout.service.ts:1114`):

- **Slug-keyed** (`resolvePlanBySlug`, matches `QZPayPlan.name`), NOT UUID.
- `findAnnualPrice` (`:255`), then an **upfront** `billing.checkout.create({ mode: 'payment' })`
  - a **direct Drizzle insert** into `billing_subscriptions` (qzpay's
  `subscriptions.create()` hard-codes monthly, so its facade cannot be used —
  `:1104-1109`).
- URL shape is `{ successUrl, cancelUrl, notificationUrl }` (hosted checkout has
  two return paths), NOT monthly's single `paymentMethodReturnUrl`.
- Has `comp` / `trial` / `discount` promo branches (`:1147-…`).
- Confirms via the **`payment.updated`** webhook (status `approved`/`accredited`)
  matching `metadata.annualSubscriptionId` (`:1100-1102`); local row starts
  `pending_provider`.

### 3.4 The supersession mechanism (preapproval-bound)

The deferred old-sub cancellation is completed by the shared helper
`apps/api/src/services/billing/reactivation-supersession-complete.ts`, triggered
from `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts` when the
**`subscription_preapproval.created`** webhook confirms the new sub, with a
backstop cron `apps/api/src/cron/jobs/reactivation-supersession-reconcile.job.ts`.
**This is monthly/preapproval-specific.**

## 4. Why annual is not a trivial branch — the four mismatches

1. **Identifier space.** Reactivation is UUID-keyed (`resolveReactivationPlan`);
   `initiatePaidAnnualSubscription` is slug-keyed. The annual reactivation path
   must resolve the annual price by UUID and cannot call
   `initiatePaidAnnualSubscription` as-is.
2. **URL shape.** Reactivate inputs carry `{ paymentMethodReturnUrl, notificationUrl }`;
   annual needs `{ successUrl, cancelUrl, notificationUrl }`.
3. **Confirmation webhook (the big one).** Monthly supersession fires on
   `subscription_preapproval.created` (§3.4). Annual confirms on `payment.updated`
   (`payment-handler.ts` / `payment-logic.ts`). So the supersession-completion
   must ALSO be wired into the annual `payment.updated` confirm path, and the
   backstop reconcile cron must cover annual subs — otherwise an annual
   reactivation would confirm the new sub but never cancel the old one.
4. **Promo / trial branches don't apply.** `initiatePaidAnnualSubscription`'s
   `trial` branch requires `isTrialEligible` = zero prior subscriptions
   (`:1201-1202`); a reactivating user ALWAYS has a prior sub (trialing or
   canceled), so it is never trial-eligible. Monthly reactivation supports no
   promo at all. Annual reactivation should therefore go straight to the upfront
   charge — no comp/trial/discount — to stay symmetric with monthly reactivation.

## 5. Scope

### In scope

1. Thread interval selection into the reactivate request/inputs
   (`ReactivateFromTrialInput` / `ReactivateSubscriptionInput`,
   `packages/service-core/src/services/billing/addon/trial.types.ts:131` / `:167`).
2. Extend `resolveReactivationPlan` to detect annual and return the interval +
   the correct price id (annual or monthly), instead of throwing
   `ANNUAL_REACTIVATION_UNSUPPORTED`.
3. Add a low-level annual-subscription create (upfront charge + Drizzle insert)
   that propagates `metadata.supersedesSubscriptionId`, with NO promo/trial logic
   (see OQ-2).
4. Extend the supersession-completion trigger to the annual `payment.updated`
   confirm path + the reconcile cron.
5. Relax/remove the `ANNUAL_REACTIVATION_UNSUPPORTED` guard.
6. Update response schemas, route handlers, and the web reactivation caller for
   the annual result shape (mirror the annual `initiate*` result:
   `successUrl`/`cancelUrl`).
7. Tests (see §8).

### Out of scope / non-goals

- **NG-1**: No promo/comp/discount on reactivation (annual OR monthly) — keep
  parity with monthly reactivation, which has none.
- **NG-2**: No trial-on-reactivation (a reactivating user is never trial-eligible).
- **NG-3**: Do not change monthly reactivation behavior.
- **NG-4**: Multi-month variants (quarterly/semi-annual) stay out — reactivation
  is monthly or annual only.

## 6. Design decisions & open questions

- **OQ-1 — How does the user pick monthly vs annual?** The reactivate `planId`
  (UUID) carries no interval, and a plan can have both a monthly and an annual
  price. Options: (a) add an explicit `billingInterval: 'monthly' | 'annual'` to
  the request body (default `'monthly'` for back-compat); (b) infer from the plan
  when it has a single recurring price, error when ambiguous. **Proposed**: (a)
  explicit, defaulting to monthly. Confirm.
- **OQ-2 — Reuse `initiatePaidAnnualSubscription` or extract a helper?** The guard
  cannot import `subscription-checkout.service.ts` (ESM cycle, §3.2), and
  `initiatePaidAnnualSubscription` is slug-keyed and carries promo/trial. **Proposed**:
  extract a low-level `createAnnualSubscription` (parallel to `createPaidSubscription`,
  in `services/billing/`) that does upfront-charge + Drizzle insert + accepts a
  resolved plan/price + `supersedesSubscriptionId`, with no promo/trial; have BOTH
  `initiatePaidAnnualSubscription` and the reactivation path consume it. (This
  mirrors the AC-7 shared-helper extraction pattern.) Confirm.
- **OQ-3 — URL shape.** Extend the reactivate inputs' `urls` to a discriminated
  union keyed on interval (`paymentMethodReturnUrl` for monthly vs
  `successUrl`/`cancelUrl` for annual), resolved by the route. **Proposed**: route
  resolves the correct URL shape per interval. Confirm.
- **OQ-4 — Supersession on `payment.updated`.** The annual Drizzle insert must
  carry `metadata.supersedesSubscriptionId`, the `payment.updated` handler
  (`payment-handler.ts`) must call `reactivation-supersession-complete.ts` on
  confirm (exactly as `subscription-logic.ts` does for preapproval), and the
  reconcile cron's query must include annual subs. **Proposed**: all three. Verify
  the reconcile cron doesn't currently filter to preapproval-only subs. Confirm.
- **OQ-5 — Double-cancel safety.** With supersession now reachable from two
  webhook paths (preapproval + payment), confirm the completion helper's
  idempotency (HOS-114's one-audit-per-pairing partial unique index, extras/029)
  still guarantees exactly one cancellation per (old, new) pairing. **Proposed**:
  reuse the same idempotency key; no schema change. Confirm.

## 7. Implementation outline

- **T-01** Resolve OQ-1..OQ-5 (owner/tech-lead sign-off) — blocks the rest.
- **T-02** Extract `createAnnualSubscription` low-level helper (OQ-2); refactor
  `initiatePaidAnnualSubscription` to consume it (no behavior change there).
- **T-03** Extend `resolveReactivationPlan` → detect annual, return
  `{ plan, priceId, interval }`; drop the `ANNUAL_REACTIVATION_UNSUPPORTED` throw.
- **T-04** Thread `billingInterval` through the reactivate inputs + request
  schemas; branch annual in both reactivate methods.
- **T-05** Wire supersession completion into the annual `payment.updated` confirm
  path + reconcile cron (OQ-4/OQ-5).
- **T-06** Update response schemas + route handlers + web caller for the annual
  result shape.
- **T-07** Tests (§8).
- **T-08** Manual MP-sandbox smoke (annual reactivation, both origins) — add the
  smoke-gate labels; this is billing CORE.

## 8. Testing

- Annual reactivation **from trial** and **from canceled** each create a
  `pending_provider` annual sub + return a hosted-checkout `successUrl`.
- Supersession completes on the annual `payment.updated` confirm (old sub
  cancelled + audited + entitlement cache cleared) — and NOT before.
- Abandoned annual reactivation checkout: old sub survives, new pending row reaped
  by `abandoned-pending-subs`.
- The `ANNUAL_REACTIVATION_UNSUPPORTED` path is gone for annual plans; free plans
  still reject (`INVALID_REACTIVATION_PLAN`); unknown still `PLAN_NOT_FOUND`.
- Monthly reactivation regression: byte-for-byte unchanged.
- Idempotency: a preapproval-path and a payment-path completion for the same
  pairing never double-cancel (extras/029 unique index).

## 9. Risks

- **R-1 — Double supersession path.** Supersession reachable from two webhooks
  raises double-cancel risk; mitigated by the existing one-audit-per-pairing
  index (verify, OQ-5).
- **R-2 — ESM cycle.** The annual create helper must live outside
  `subscription-checkout.service.ts` (like `createPaidSubscription`) so the guard
  and both callers can share it without a circular import.
- **R-3 — Plan ambiguity.** A plan with both monthly and annual prices needs an
  explicit interval (OQ-1) or reactivation silently picks the wrong one.
- **R-4 — Smoke required.** Annual confirm is a real MP `payment.updated` flow the
  e2e stub does not exercise faithfully — staging + prod MP-sandbox smoke is the
  gate (billing CORE).
