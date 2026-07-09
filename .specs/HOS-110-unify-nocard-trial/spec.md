---
linear: HOS-110
statusSource: linear
title: Unify the no-card trial across all entry surfaces
area: [billing, api, web, admin]
---

# HOS-110 — Unify the no-card trial across all entry surfaces

## Context

Hospeda's trial is **no-card**: the user is enabled immediately (`trialing`) and
only sent to pay at the end of the trial. Before this change that happened on
exactly ONE path — publishing your first accommodation
(`AccommodationService.publish()` → `TrialService.startTrial()`, hardcoded to
`owner-basico`). Every other entry surface — the public pricing page
(`/suscriptores/planes`) and the testing-plan button — went through
`POST /start-paid` → `initiatePaidMonthlySubscription`, which **never consulted
the trial** and sent the user straight to MercadoPago, contradicting the
on-screen "14 días gratis" copy (a real revenue/trust bug). The guided "Publicar"
button also passed a dead `?action=publish` param the admin route never read, so
hosts had to flip the state by hand.

Goal: grant the no-card trial on **any** entry surface for **any** plan that
declares a trial, for an eligible user; make the testing plan participate; fix
the guided publish flow.

Distinct from HOS-108 (webhook activation, PR #2191) though both stem from qzpay
`mode:'paid'` create semantics.

## Owner decisions

1. **Eligibility**: one trial per customer, for life. Any prior subscription
   (trial or paid, any status/domain, even cancelled) blocks a new trial —
   already enforced by `startTrial`'s any-subscription guard. Not per-plan.
2. **owner-test-daily** gets a **1-day** trial (`hasTrial:true, trialDays:1`) so
   the full trial→expiry cycle is testable.
3. **Guided publish** flow is in scope.
4. **Promo + trial** handled by `effect_kind`: `comp` wins (no trial);
   `trial_extension` grants the trial with base + extra days; `discount` yields
   to the trial and is discarded with a UI notice (persisting the discount for
   post-trial conversion is a deferred follow-up).

## Implementation

1. **Generalized `TrialService.startTrial()`** (`apps/api/src/services/trial.service.ts`,
   `packages/service-core/.../billing/addon/trial.types.ts`): optional `planSlug`
   (default `owner-basico`) and `extraTrialDays`; `trialDays` derived from the
   resolved plan's `metadata` via the pure helper `resolvePlanTrialConfig`;
   `hasTrial`/`baseTrialDays<=0` guard returns null (preserves
   `HOSPEDA_TRIAL_DAYS_OVERRIDE=0` as a global kill-switch even with an extension
   code); `clearEntitlementCache` after create; any-subscription idempotency
   guard kept (= one trial per customer for life).
2. **Trial-vs-pay branch** in `initiatePaidMonthlySubscription`
   (`apps/api/src/services/subscription-checkout.service.ts`): promo resolved
   first → `comp` wins → else if plan declares a trial AND customer has zero
   prior subs → ensure customer exists → `startTrial` → return
   `{ checkoutUrl: <in-app success sentinel>, appliedEffect:'trial', promoCodeIgnored? }`
   (NO MercadoPago preapproval); else the unchanged paid path. `appliedEffect`
   widened to `'trial'`; `promoCodeIgnored` added (service + Zod schema + web type).
3. **owner-test-daily 1-day trial**: baseline `packages/billing/src/config/plans.config.ts`
   + data-migration `packages/seed/src/data-migrations/0005-owner-test-daily-trial.ts`
   (OR-PRESERVE `UPDATE billing_plans.metadata`; commercial fields are DB-wins).
4. **Guided publish**: new `POST /api/v1/protected/accommodations/:id/publish`
   (`apps/api/src/routes/accommodation/protected/publish.ts`, mirrors `/unpublish`,
   calls `accommodationService.publish(actor, id)` directly — bypasses the HTTP
   converter that strips `lifecycleState`); new `PublishButton` island replacing
   the dead `?action=publish` link, handling the 403 `subscription_required`
   (routes to the plans page); i18n es/en/pt.
5. **Success page** (`success.astro`, `PlanPurchaseButton.client.tsx`): trial/comp
   grants flag `?effect=` on the in-app sentinel so the page shows trial-specific
   copy instead of the "verifying payment" variant; `promoCodeIgnored` surfaced
   via `?promoIgnored=1` with softened copy.

## Tests

+ Unit: `resolvePlanTrialConfig` (14), `startTrial` generalization + extraTrialDays
  (45), checkout promo-by-type branches (16), publish endpoint (6). All green.
+ E2E (CI, DB-backed): trial-vs-pay (`trial-vs-pay-checkout.test.ts`) covering
  eligible→trial (no MP), ineligible→paid, comp-wins, trial_extension length,
  discount-dropped flag.
+ Seed integration (CI): migration 0005 OR-PRESERVE + idempotency.

## Review

Two rounds of blind dual adversarial review (judgment-day, opus). Round 1 found
1 CRITICAL (guided PublishButton was a silent no-op — the PATCH stripped
`lifecycleState`) + the promoCode-dropped warning; both fixed (dedicated
`/publish` endpoint; promo-by-type). Round 2 confirmed both fixes correct with no
money/security regression, surfaced F1 (trial success page showed "verifying
payment"); fixed. Round 3 approved.

## Deployment gate (W2 — pre-merge/pre-deploy)

The accommodation-publish trial now hard-depends on `owner-basico`'s live
`metadata.hasTrial/trialDays` (the new guard returns null → publish throws if
absent). Before promoting: verify
`SELECT metadata->>'hasTrial', metadata->>'trialDays' FROM billing_plans WHERE name='owner-basico'`
returns `true`/`14` on staging and prod; if missing, add a backfill data-migration.

Billing-core → `status-needs-smoke-staging` + `status-needs-smoke-prod`.

## Follow-ups (out of scope)

+ Persist a discarded `discount` code and apply it at post-trial conversion.
+ `reactivateFromTrial`/`reactivateSubscription` create without `mode:'paid'`
  (may not route users to add a card) — trace into `@qazuor/qzpay-core`.
+ Annual first-time checkout has no trial branch (annual = one-time upfront).
