---
linear: HOS-122
statusSource: linear
title: Model checkout outcome analytics (trial vs paid) — appliedEffect dimension
created: 2026-07-10
type: feature
area: [billing, api]
---

# HOS-122 — Model checkout outcome analytics (trial vs paid)

## Context

Follow-up from **HOS-115** (OQ-2). When HOS-115 shipped the no-card trial on the
annual first-time checkout path, it left an analytics gap: we cannot distinguish
"annual → trial" from "annual → paid" (nor "monthly → discount" from
"monthly → paid") in PostHog. The original plan was to reuse the existing
`checkout_started` event carrying `billingInterval` × `appliedEffect`.

**Why that didn't fit** — `checkout_started` is captured at the *start* of
`handleStartPaidSubscription` (`apps/api/src/routes/billing/start-paid.ts`
L262–296), **before** `initiatePaidAnnualSubscription` / `initiatePaidMonthlySubscription`
run (L298–325). At that point the trial/comp/discount/paid decision has not been
computed yet, so `appliedEffect` is structurally absent from `checkout_started`
for **every** interval. Moving the capture later would drop the "attempted
checkout" signal for flows that error before resolving. HOS-115 therefore shipped
`checkout_started` carrying `billingInterval` only; the T-012 test
(`apps/api/test/routes/start-paid.test.ts` L1365–1410) pins this partial state
with `expect(properties).not.toHaveProperty('appliedEffect')`.

This spec designs the **outcome-side** analytics correctly — for the whole checkout
result surface, not just the trial branch.

## 1. Summary

Introduce a second, outcome-side PostHog event — **`checkout_completed`** —
captured in the route **after** `result` resolves, carrying the normalized
`outcome` (`trial | discount | comp | paid`) alongside `billingInterval`, so
"annual → trial" vs "annual → paid" becomes a clean cross-tab. Leave the
pre-decision `checkout_started` event untouched so funnel/attempt measurement
keeps working.

## 2. Problem

`appliedEffect` (the checkout outcome) is only known once
`initiatePaid{Annual,Monthly}Subscription` returns. The existing
`checkout_started` event fires before that and cannot carry it. Without an
outcome-side event, we can measure "how many annual checkouts were attempted"
but not "how many of them resolved to a trial vs a paid charge vs a comp vs a
discounted charge" — which is exactly the trial-vs-paid split HOS-115 wanted and
the general result surface product needs to reason about conversion.

## 3. Goals

- **G-1** — Emit an outcome-side event (`checkout_completed`) after `result`
  resolves, carrying a normalized `outcome` dimension queryable alongside
  `billingInterval`.
- **G-2** — Make "annual → trial" vs "annual → paid" (and the equivalent monthly
  splits) a clean two-property PostHog cross-tab (`billingInterval` × `outcome`).
- **G-3** — Keep `checkout_started` exactly as-is (attempt/funnel signal), and
  keep both events stitchable (`localSubscriptionId` as the correlation key).
- **G-4** — Never let analytics capture break or block checkout (mirror the
  existing try/catch non-blocking pattern).

## 4. Non-goals

- **NG-1** — No change to the trial/comp/discount/paid decision logic itself
  (that shipped in HOS-115 / SPEC-262 / SPEC-239). This is analytics-modelling
  only.
- **NG-2** — No `checkout_started` reshuffle or property additions to it.
- **NG-3** — No general typed PostHog event-name registry in this spec (see
  OQ-1 — proposed as a separate follow-up).
- **NG-4** — No "trial → converted to paid" downstream conversion event in this
  spec (see OQ-4 — the `intendedInterval` attribution field HOS-115 already
  persists makes it a clean follow-up).
- **NG-5** — No new `checkout_failed` error event (see OQ-3).

## 5. Current baseline

Grounded in the current code (paths + lines as of `origin/staging`):

- **`checkout_started` capture** — `start-paid.ts` L262–296. Properties today:
  `planSlug`, `billingInterval` (`'monthly' | 'annual'`), `promoCode`
  (string | null), `amount` (major units | null), `currency` (| null). Uses
  `getPostHogClient()?.capture({...})` inside a try/catch that logs a warning and
  never throws. No `appliedEffect`.
- **Where `result` resolves** — `start-paid.ts` L298–325, immediately after the
  capture above. `result` is `InitiatePaidMonthlySubscriptionResult` /
  `InitiatePaidAnnualSubscriptionResult` (structurally identical,
  `apps/api/src/services/subscription-checkout.service.ts` L393–407 / L1080–1095):

  ```ts
  {
    checkoutUrl: string;
    localSubscriptionId: string;           // always present
    expiresAt: string;
    appliedEffect?: 'comp' | 'discount' | 'trial';  // absent === plain paid
    promoCodeIgnored?: true;               // only ever with appliedEffect: 'trial'
  }
  ```

- **`appliedEffect` determination** — `CheckoutAppliedEffect = 'comp' | 'discount' | 'trial'`
  (`subscription-checkout.service.ts` L381). Set at mirrored branch points in the
  monthly (L506/L602/L699) and annual (L1171/L1264/L1292) paths; plain paid falls
  through leaving `appliedEffect` `undefined`. Fixed precedence in code:
  **comp > trial > discount > paid**. Wire enum lives in
  `packages/schemas/src/api/billing/start-paid.schema.ts` L98–115.
- **Server-side PostHog helper** — `apps/api/src/lib/posthog.ts`,
  `getPostHogClient(): PostHog | null` (L75–107), a lazy singleton returning
  `null` when `HOSPEDA_POSTHOG_KEY` is unset. Call sites pass the `posthog-node`
  SDK object shape directly (`{ distinctId, event, properties, $set? }`). **There
  is no typed event-name registry** — every event name is an inline string literal.
- **Closest precedent** — `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts`
  L918–956 captures `subscription_payment_succeeded` with a computed `kind`
  discriminator resolved *after* the outcome is known. This is the pattern to
  mirror.
- **`intendedInterval`** — `apps/api/src/services/trial.service.ts` L287–306
  stamps `metadata.intendedInterval` (`'monthly' | 'annual'`) on trial
  subscription creation; read back via `resolveIntendedInterval()`. Already used
  by the post-trial nudge email. Only exists for the trial path.
- **T-012 test** — `apps/api/test/routes/start-paid.test.ts` L1365–1410 asserts
  `checkout_started` carries `billingInterval: 'annual'` and explicitly
  **not** `appliedEffect`. Sibling monthly exact-shape assertion at L587–599.

## 6. Proposed design

**D-1 — Dedicated outcome event, not a property update on `checkout_started`.**
Add a new `checkout_completed` event captured in the route right after `result`
resolves (after `start-paid.ts` L325, inside the same request, before returning
the response). Rationale: (a) matches the existing `subscription_payment_succeeded`
precedent — capture the discriminator once the outcome is known; (b) keeps
`checkout_started` intact for attempt/funnel measurement (a checkout that errors
before `result` still emitted `checkout_started` but will have no
`checkout_completed`, which is itself a useful drop-off signal); (c) server-side
retroactive PostHog property updates on a past event are fragile and would still
require a second capture call anyway.

**D-2 — Capture in the route, not inside the service.** `result.appliedEffect` is
already available at the single route call site. Instrumenting inside
`subscription-checkout.service.ts` would mean up to 8 mirrored call sites
(4 monthly + 4 annual) or a service refactor to a single exit point — neither
justified for an analytics event the route can emit from one place.

**D-3 — Normalize the outcome, don't leak "absence = paid".** Compute
`outcome: result.appliedEffect ?? 'paid'` so the PostHog property is always one
of the four explicit values `'trial' | 'discount' | 'comp' | 'paid'`. Cross-tabs
and funnels must never have to encode "property missing means paid".

**D-4 — Correlate via `localSubscriptionId`.** `result.localSubscriptionId` is
present for every successful outcome (comp/trial/discount/paid), so it stitches
`checkout_started` → `checkout_completed` without time-proximity heuristics. Both
events share the same `distinctId` (`actor.id`) and `billingInterval`.

Capture call (mirrors the existing non-blocking pattern):

```ts
// after result resolves (start-paid.ts, after L325)
try {
  getPostHogClient()?.capture({
    distinctId: actor.id,
    event: 'checkout_completed',
    properties: {
      planSlug: body.planSlug,
      billingInterval: body.billingInterval,          // 'monthly' | 'annual'
      outcome: result.appliedEffect ?? 'paid',        // 'trial'|'discount'|'comp'|'paid'
      promoCode: body.promoCode ?? null,
      promoCodeIgnored: result.promoCodeIgnored ?? false,
      localSubscriptionId: result.localSubscriptionId,
      amount: amountMajor,                             // reuse value computed for checkout_started
      currency: priceForInterval?.currency ?? null
    }
  });
} catch (phErr) {
  apiLogger.warn({ err: phErr }, 'PostHog capture failed for checkout_completed (non-blocking)');
}
```

> Note: `amountMajor` / `priceForInterval` are currently computed inside the
> `checkout_started` try block (L262–296). Hoist them just above the
> `checkout_started` capture so both events can reference the same values without
> recomputation.

## 7. Data model / contracts

- **No DB migration.** Analytics-only.
- **No new env var.** Reuses `HOSPEDA_POSTHOG_KEY` and the existing
  `getPostHogClient()` singleton.
- **New PostHog event** `checkout_completed` with the property set in D-1..D-4.
  Documented alongside the other billing analytics events (see Implementation
  notes for where the event catalog lives, if any).
- **No wire/response contract change** — `start-paid.schema.ts` response already
  carries `appliedEffect`; the analytics event is server-emitted and not part of
  the HTTP response.

## 8. UX / UI behavior

None. No user-facing surface. (The web client already gets `appliedEffect` in the
`start-paid` response for its own UX; this spec does not touch that path.)

## 9. Acceptance criteria

- **AC-1** — A trial-eligible **annual** checkout emits `checkout_completed` with
  `billingInterval: 'annual'` and `outcome: 'trial'`.
- **AC-2** — A plain paid **annual** checkout (not trial-eligible, no promo)
  emits `checkout_completed` with `billingInterval: 'annual'` and
  `outcome: 'paid'` (never a missing/absent outcome property).
- **AC-3** — A **monthly** checkout emits the mirror events; `billingInterval` ×
  `outcome` is a clean two-property cross-tab across both intervals.
- **AC-4** — A `comp` promo checkout emits `outcome: 'comp'`; a signup-discount
  checkout emits `outcome: 'discount'`; a trial that discarded a discount promo
  emits `outcome: 'trial'` with `promoCodeIgnored: true`.
- **AC-5** — `checkout_started` is unchanged: still emitted once, still carrying
  `billingInterval` only (no `appliedEffect`/`outcome`). The T-012 test stays
  green as-is.
- **AC-6** — `checkout_completed` and `checkout_started` for the same checkout
  share `distinctId`, `billingInterval`, and are joinable on
  `localSubscriptionId`.
- **AC-7** — When PostHog capture throws, checkout still succeeds and the error is
  logged, not propagated (non-blocking). No `checkout_completed` is emitted when
  `initiatePaid*Subscription` throws before returning `result`.

## 10. Risks

- **R-1** — Emitting `outcome` inside the request adds one synchronous capture
  call on the checkout hot path. Mitigation: `posthog-node` capture is buffered
  and the call is wrapped in try/catch; identical cost profile to the existing
  `checkout_started` capture already on this path.
- **R-2** — Double-counting if a caller retries `start-paid`. Same exposure as
  `checkout_started` today; `localSubscriptionId` lets analysis dedupe. Not made
  worse by this spec.
- **R-3** — Event-name typo has no compile-time guard (no registry — see OQ-1).
  Mitigation: the new name is asserted by tests (AC-1..AC-4).

## 11. Open questions

- **OQ-1** — Introduce a typed PostHog event-name registry/union as part of this
  spec, or keep the inline-string-literal convention? **Recommendation: out of
  scope** (YAGNI for a single new event); file a separate `kind-needs-spec`
  follow-up if a registry is wanted platform-wide. *Owner decision.*
- **OQ-2** — Event name: `checkout_completed` (recommended) vs `checkout_result`
  vs `checkout_outcome`. `checkout_completed` reads as the natural funnel step
  after `checkout_started`. *Owner decision.*
- **OQ-3** — Also emit a `checkout_failed` event when `initiatePaid*Subscription`
  throws before resolving? **Recommendation: no** — `checkout_started` already
  measures attempts, the absence of a paired `checkout_completed` is the drop-off
  signal, and `payment_failed` covers post-checkout payment failures. *Owner
  decision.*
- **OQ-4** — Include a downstream "trial → converted to paid" conversion event
  (reusing `metadata.intendedInterval` for interval attribution)?
  **Recommendation: separate follow-up spec** — it belongs to the conversion
  surface, not the checkout surface, and needs its own capture point (webhook /
  cron), not this route. *Owner decision.*
- **OQ-5** — Set a PostHog person property via `$set` on `checkout_completed`
  (e.g. `last_checkout_outcome`, `plan_status`) as `subscription_payment_succeeded`
  does? Low cost, useful for cohorting. **Recommendation: yes, `$set` a
  `last_checkout_outcome` person property**, but confirm the property naming
  convention with the owner. *Owner decision.*

## 12. Implementation notes

- Single-file change surface for the code: `apps/api/src/routes/billing/start-paid.ts`
  (hoist `amountMajor`/`priceForInterval`, add the `checkout_completed` capture
  after L325). Plus a new test in `apps/api/test/routes/start-paid.test.ts`
  covering AC-1..AC-7, mirroring the existing `checkout_started` describe blocks
  (L562–660 monthly, L1322–1411 annual/T-012).
- Mirror the exact try/catch non-blocking style already used for
  `checkout_started` and `subscription_payment_succeeded` — do not introduce a new
  capture helper.
- If a PostHog event catalog/doc exists (none found in-repo at spec time), add
  `checkout_completed` to it; otherwise note the event in the billing analytics
  section of the relevant doc.
- Estimated size: ~1 code file + ~1 test file. Small. No migration, no env var,
  no schema change → this is a candidate for a single-PR implementation once the
  OQs are resolved.

## 13. Linear

Canonical tracking: **HOS-122**
<https://linear.app/hospeda-beta/issue/HOS-122>
