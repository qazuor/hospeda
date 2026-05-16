---
specId: SPEC-141
title: Hospeda subscription post-launch follow-ups (D2 of SPEC-122)
type: feat
complexity: medium
status: in-progress
created: 2026-05-16
parent: SPEC-122
phase: D2
dependsOn:
    - SPEC-126
tags:
    - billing
    - subscription
    - checkout
    - qzpay-1.5.0
---

# SPEC-141 — Hospeda subscription post-launch follow-ups

## Context

SPEC-126 (Phase D of SPEC-122 master plan) shipped the Hospeda subscription flow to staging on 2026-05-16 with **8 of 9 tasks completed**. Four follow-ups were deferred because they all required a public `billing.checkout` API that did not yet exist in `@qazuor/qzpay-core`:

- **D1 annual** — one-time annual subscription via MP Checkout Pro
- **D4 full payment recording** — insert a `billing_payments` row for each recurring charge instead of just ACK
- **D7 upgrade delta-charge** — one-time charge for prorated difference when a user upgrades mid-period
- **D7 downgrade scheduling** — defer plan downgrade until `currentPeriodEnd` instead of charging immediately

The blocker shipped in qzpay 1.5.0 (`billing.checkout` public service) and Hospeda picked up the new deps in PR #1129. This spec implements the four follow-ups.

## Scope

### IN scope

1. **D1 annual checkout flow**
   - Extend `apps/api/src/routes/billing/start-paid.ts` (or split into `start-paid-annual.ts`) to handle `interval: 'year'` requests.
   - Use `billing.checkout.create({ mode: 'payment', lineItems: [{ unitAmount, currency: 'ARS', title }] })` with the annual amount (discounted price applied upfront).
   - On success: store `subscription.endDate = startDate + 365d`, status `pending_provider` until webhook confirms.
   - Reuse the loader+polling return UX pattern from SPEC-126 D2/D5 (sub-decision 4).
   - At expiry (D-7 / D-1 reminders + day-of): offer a new annual checkout to renew.

2. **D4 full payment recording**
   - Webhook handler `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts` currently ACKs `subscription_authorized_payment.created/updated` events but does NOT insert a `billing_payments` row.
   - Update the handler to call `billing.payments.create({ subscriptionId, amount, currency, status, providerPaymentId, ... })` so the local table reflects every recurring charge.
   - Idempotency: use the MP payment ID as `externalId` to dedupe webhook retries.

3. **D7 upgrade delta-charge**
   - In `apps/api/src/routes/billing/plan-change.ts`, when the change is an upgrade (`price_new > price_old`):
     a. Compute `delta = (price_new - price_old) * remaining_days / total_days` per sub-decision 3.
     b. Create a one-time checkout via `billing.checkout.create({ mode: 'payment' })` for the delta amount.
     c. On user payment success (webhook), call `paymentAdapter.subscriptions.update(providerSubId, { transactionAmount: price_new })` to bump the preapproval for next cycle.
     d. Update local sub `planId` once both steps succeed.
   - Use the loader+polling return UX again.

4. **D7 downgrade scheduling**
   - In the same `plan-change.ts` flow, when `price_new < price_old`:
     a. Do NOT charge anything immediately.
     b. Persist scheduling state on the local sub: probably a `scheduledPlanChange` JSONB column or metadata field with `{ newPlanId, applyAt: currentPeriodEnd }`.
     c. Add a cron / lifecycle hook that fires at `currentPeriodEnd`: calls `paymentAdapter.subscriptions.update(...)` to apply the new transaction_amount on MP, then updates local sub `planId`.
   - Reusing existing dunning / lifecycle cron infra where possible.

### OUT of scope

- **SPEC-127** — `addon.checkout.ts` migration off raw MP SDK to `billing.checkout`. Separate spec; this work shares the qzpay 1.5.0 unblock but is a different concern (addons vs subscriptions).
- **SPEC-128** — billing cleanup + E2E smoke + runbook. Comes after this spec + SPEC-127.
- **Custom dunning beyond MP's native retry**. MP handles failed-charge retries natively; we only listen for `past_due`/`cancelled` webhooks. Decision 6 of SPEC-122.
- **Promo codes on monthly recurring beyond `free_trial` extension**. Decision 4 of SPEC-122 — out of MVP.
- **Multi-currency**. ARS only.

## Acceptance criteria

- [ ] User can start an annual subscription from the plan picker. Redirects to MP Checkout Pro. After payment, returns to `/billing/return` with polling. Local sub reflects `interval: 'year'` and `endDate: +365d`.
- [ ] `D-7` and `D-1` reminder emails fire before annual subscription expiry.
- [x] MP webhook `subscription_authorized_payment.created` produces a `billing_payments` row with the correct `subscriptionId`, `amount`, `currency`, and MP payment ID. Retrying the webhook is idempotent. _(D4 shipped: helper `apps/api/src/utils/mp-authorized-payment.ts` + handler refactor `subscription-payment-handler.ts`. Commits `b6f95c0fe`..`20e13fe57`.)_
- [ ] Upgrade: user changes plan to a more expensive one mid-period. They are redirected to MP for the delta charge. After payment, the preapproval next-cycle amount is updated and the local sub reflects the new plan.
- [ ] Downgrade: user changes plan to a cheaper one. NO charge happens immediately. The local sub records the scheduled change. At period end, the preapproval is updated and the local sub plan flips.
- [ ] All paths covered by unit + integration tests. Webhook handler tests cover the new idempotency.
- [ ] No regressions on SPEC-126 happy paths (monthly recurring create + webhook + plan-change current behavior must keep passing).

## Implementation notes

- **Dependency**: depends on `@qazuor/qzpay-core@^1.5.0` (already on staging via PR #1129).
- **Branch base**: `staging`.
- **Worktree**: `../hospeda-spec-141-subscription-post-launch-followups`.
- **Branch**: `spec/SPEC-141-subscription-post-launch-followups`.
- **Reuse**: the polling return UX and webhook correlation infra from SPEC-126 are reusable directly.
- **DB migration**: D7 downgrade scheduling likely needs a new column (`scheduledPlanChange JSONB` or similar) on `billing_subscriptions`. Plan it as a single drizzle migration alongside the implementation.

## Risks

- **Race condition on upgrade delta-charge**: between the one-time payment success webhook and the `subscriptions.update` call to MP, the user could be charged for the new amount on the next cycle before our update lands. Mitigation: idempotency via `external_reference` + retry on the `subscriptions.update` call.
- **MP test credentials limitations**: per known gotcha (engram `gotcha/mercadopago-test-credentials-architecture`), test credentials cannot call some endpoints. Sandbox testing of D4 / D7 may need real production credentials in a controlled test mode.
- **Schema drift**: existing pre-existing `provider_payment_id → provider_payment_ids` drift on `billing_payments` may surface when we add new columns. Reconcile that drift in a separate prep commit before the migration.

## Cross-references

- [SPEC-122 master plan](../SPEC-122-billing-production-readiness-master/spec.md) — Decision 2, Decision 5, Sub-decisions 3 + 4
- [SPEC-126 spec](../SPEC-126-hospeda-subscription-flow/spec.md) — predecessor
- [SPEC-127 spec](../SPEC-127-migrate-addon-checkout-to-qzpay/spec.md) — sibling, shares qzpay 1.5.0 unblock
- qzpay [PR #7](https://github.com/qazuor/qzpay/pull/7) — published `billing.checkout` public API
- Hospeda [PR #1129](https://github.com/qazuor/hospeda/pull/1129) — qzpay deps bump
