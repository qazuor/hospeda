---
linear: HOS-130
statusSource: linear
title: Model trial → paid conversion analytics event (interval attribution via intendedInterval)
created: 2026-07-10
type: feature
area: [billing, api]
---

# HOS-130 — Model trial → paid conversion analytics event

## Context

Follow-up split out of **HOS-122** (D-9). HOS-122 models the **checkout outcome**
event (`checkout_completed`, capturing `outcome: trial | discount | comp | paid`
at checkout time, in `POST /start-paid`). This spec covers the **downstream
conversion** surface: when a no-card trial subscription later becomes a paid one,
we want a PostHog event that (a) fires at the confirmed conversion moment,
(b) attributes the conversion back to the interval the user originally chose
(`metadata.intendedInterval`, persisted by HOS-115), and (c) is stitchable to the
original `checkout_completed` so "annual trial → converted to annual paid" is a
clean cross-tab.

**Key finding that reshapes the issue premise** — the issue text guessed the
capture point would be the MP webhook `subscription_authorized_payment.created`
or the trial-expiry cron. A read-only trace of the current code
(`origin/staging`) shows **both guesses are wrong**:

- `subscription_authorized_payment.*` only handles recurring charges against a
  subscription that **already has** an MP preapproval (`mpSubscriptionId`). A
  no-card trial has none, so that handler's local-subscription lookup never
  resolves for the trial row. It is not the conversion point.
- The trial-expiry cron is the **mirror-image non-event**: it cancels trials that
  did **not** convert (status `trial → cancelled`). Its comment is explicit that
  conversion-to-paid happens on "a different path".

The real path is the **reactivation-supersession** flow shipped by HOS-114/HOS-123:
a trial converts to paid by the user going through `POST /protected/billing/trial/reactivate`,
which creates a **brand-new** paid subscription row that *supersedes* the trial
row; the conversion is *confirmed* when MercadoPago activates the new preapproval.
Section 5 grounds this precisely.

## 1. Summary

Introduce a downstream PostHog event — **`trial_converted_to_paid`** (D-9) —
captured at the single, idempotent point where a trial→paid
supersession is *confirmed*: `completeSupersessionPairing` (the shared helper
called by both the live `subscription_preapproval.{created,updated}` webhook and
the hourly reconcile cron backstop), gated on `triggerSource ==='trial-reactivation'`
and the `'completed'` outcome. The event carries the **originally chosen**
`intendedInterval` (attribution) alongside the **actually converted** interval,
and both the superseded (trial) and new (paid) subscription ids so it stitches to
HOS-122's `checkout_completed`. Mirror HOS-122's non-blocking try/catch capture
style; no DB migration, no env var, no new capture helper.

## 2. Problem

Today there is **no analytics signal anywhere near the trial→paid conversion
moment**. We can measure, via HOS-122's `checkout_completed`, that a checkout
resolved to `outcome: 'trial'` — but we cannot answer "of the annual trials we
started, how many later converted to a paid subscription, and to which interval?"
Concretely:

- The conversion is confirmed inside `completeSupersessionPairing`, which fires
  **zero** PostHog events today (grep-confirmed — Section 5).
- The one adjacent event, `subscription_payment_succeeded`
  (`payment-logic.ts`), has a `kind` discriminator with no `trial_conversion`
  branch: a trial-reactivation's first paid charge falls through to
  `'subscription_renewal'`, which is misleading (it's the first charge of a
  brand-new subscription, not a renewal) and does not carry `intendedInterval`.

Without a dedicated conversion event, the trial-vs-paid funnel HOS-115 wanted
stops at "started a trial" and never closes the loop to "converted".

## 3. Goals

- **G-1** — Emit a conversion event at the confirmed trial→paid supersession
  point, exactly once, regardless of whether the live webhook or the reconcile
  cron completes the pairing.
- **G-2** — Attribute the conversion to the interval the user **originally chose**
  (`intendedInterval` from the superseded trial's metadata), and also record the
  interval the conversion **actually landed on** (the new paid subscription's
  plan interval) so "chose annual → converted annual" vs "chose annual →
  converted monthly" is a clean cross-tab.
- **G-3** — Make the event stitchable to HOS-122's `checkout_completed` (whose
  `localSubscriptionId` is the **trial** subscription id) by carrying the
  superseded (trial) subscription id, plus the new paid subscription id.
- **G-4** — Never let analytics capture break or block the webhook/cron
  (mirror the existing non-blocking try/catch pattern).

## 4. Non-goals

- **NG-1** — No change to the reactivation/supersession decision logic itself
  (HOS-114 / HOS-123). Analytics-modelling only.
- **NG-2** — No change to HOS-122's `checkout_completed` / `checkout_started`.
- **NG-3** — No new typed PostHog event-name registry (consistent with HOS-122
  D-6; inline string literal + test-asserted name).
- **NG-4** — No `checkout_started`/`checkout_completed` instrumentation added to
  the `/trial/reactivate` route in this spec, even though it currently has none
  (a genuine funnel gap — see R-3 / D-13). This spec captures the *outcome-side*
  conversion event only.
- **NG-5** — No instrumentation of the trial-expiry (non-conversion) cron. A
  "trial expired without converting" event, if wanted, is a separate follow-up.

## 5. Current baseline

Grounded in the current code (paths + lines as of `origin/staging`):

- **How a no-card trial converts to paid** —
  `POST /api/v1/protected/billing/trial/reactivate`
  (`apps/api/src/routes/billing/trial.ts` L304–381) → `TrialService.reactivateFromTrial`
  (`apps/api/src/services/trial.service.ts` L940–1039). This creates a **new**
  `billing_subscriptions` row with `mode: 'paid'` (a real MP preapproval /
  checkout URL) and stamps on the **new** row's metadata:
  `convertedFromTrial: 'true'`, `convertedAt`, `supersedesSubscriptionId: <old trial sub id>`
  (L991–995). The old trial row is deliberately left untouched (keeps granting
  entitlements during the MP checkout window — L998–1006 comment).
- **Where the conversion is *confirmed*** — when the user completes MP checkout,
  MP fires `subscription_preapproval.{created,updated}` →
  `processSubscriptionUpdated` (`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`),
  which on the `PENDING_PROVIDER → ACTIVE` transition (L805–817) calls
  `completeReactivationSupersession` → `completeSupersessionPairing`
  (`apps/api/src/services/billing/reactivation-supersession-complete.ts` L210–407).
  Step 5 of that function (L360–377) writes the canonical
  `billing_subscription_events` audit row that IS the "conversion confirmed"
  record:

  ```ts
  await db.insert(billingSubscriptionEvents).values({
    subscriptionId: newSubscription.id,
    previousStatus: normalizedSupersededStatus,
    newStatus: SubscriptionStatusEnum.ACTIVE,
    triggerSource,               // 'trial-reactivation' | 'subscription-reactivation'
    providerEventId,
    metadata: {
      supersededSubscriptionId: supersededId,
      customerId: newSubscription.customerId,
      planId: newSubscription.planId,
      ...(triggerSource === 'trial-reactivation'
        ? { convertedFromTrial: 'true' }
        : { reactivatedFromCanceled: 'true' })
    }
  }).onConflictDoNothing();
  ```

- **Single, idempotent, shared implementation** — `completeSupersessionPairing`
  is called from BOTH the live webhook (`subscription-logic.ts` L809–816) AND the
  hourly backstop cron `reactivation-supersession-reconcile.job.ts` (L272) for
  pairings the webhook missed. It returns an outcome discriminator
  (`'completed'` = a genuinely new audit row was written, vs `'already-audited'` /
  `'superseded-not-found'` / `'cancel-did-not-take'` / `'error'`). Firing on
  `'completed'` guarantees exactly-once.
- **The sibling flow to exclude** — `reactivateSubscription`
  (`trial.service.ts` L1067+) reactivates a **lapsed/cancelled** subscription
  (not a trial) through the *same* machinery, distinguished only by
  `triggerSource: 'subscription-reactivation'` (set at `subscription-logic.ts`
  L270–271 from `metadata.convertedFromTrial === 'true'`). The event must gate on
  `triggerSource === 'trial-reactivation'` or it will conflate trial conversions
  with lapsed reactivations.
- **`intendedInterval`** — stamped on trial creation
  (`trial.service.ts` ~L287–306), read back via the pure function
  `resolveIntendedInterval(rawValue: unknown): TrialIntendedInterval | null`
  (`packages/service-core/src/services/billing/addon/trial.types.ts` L295–297),
  trivially importable from `@repo/service-core`. It lives on the **old trial
  subscription's metadata**, NOT on the new paid subscription's metadata.
- **PostHog helper** — `apps/api/src/lib/posthog.ts`, `getPostHogClient(): PostHog | null`,
  lazy singleton returning `null` when `HOSPEDA_POSTHOG_KEY` is unset. No typed
  event-name registry (inline string literals only).
- **distinctId resolution** — no Hono `Context` exists at the capture point (runs
  from both a webhook and a cron). The established pattern is
  `resolveOwnerUserId({ customerId })`
  (`apps/api/src/services/subscription-pause.service.ts` L34), already reused in
  `payment-logic.ts`, `dunning.job.ts`, `finalize-cancelled-subs.ts`, and
  `apply-scheduled-plan-changes.ts` to bridge billing-customer-id → Better Auth
  user id for analytics identity stitching.
- **Existing billing analytics events (no collision)** — grep of `getPostHogClient`
  + `capture(` across `apps/api/src`:
  - `checkout_started` — `start-paid.ts` L277–287.
  - `checkout_completed` — `start-paid.ts` L350–367 (HOS-122; carries
    `localSubscriptionId` = the trial sub id when `outcome: 'trial'`).
  - `subscription_payment_succeeded` — `payment-logic.ts` L928–946.
  Nothing fires in `subscription-logic.ts`, `reactivation-supersession-complete.ts`,
  the reconcile cron, `trial.service.ts`, or the trial-expiry / subscription-poll
  crons.

## 6. Proposed design

**D-1 — Capture inside `completeSupersessionPairing`, on the `'completed'`
outcome, gated `triggerSource === 'trial-reactivation'`.** This is the single
confirmed-conversion choke point shared by the webhook and the reconcile cron;
the `'completed'` outcome fires only when a genuinely new audit row was written
(`onConflictDoNothing` makes re-delivery a no-op), giving exactly-once semantics
for free. Placing the capture right after the successful Step 5 insert (inside the
same function, after L377) means one instrumentation site covers both callers.

**D-2 — Dedicated event, do not reuse/extend `subscription_payment_succeeded`.**
That event's `kind` discriminator (`payment-logic.ts` L918–926) reads the MP
*payment* metadata bag (not the subscription metadata), has no trial-conversion
branch, and is fired on a different webhook (`payment.updated`). Bolting a trial
dimension onto it would couple two unrelated capture paths and still not have
`intendedInterval` in scope. A separate event mirrors HOS-122's precedent.

**D-3 — Carry BOTH intervals: `intendedInterval` (attribution) and
`convertedInterval` (actual).** `intendedInterval` answers "what did the user
originally choose when they started the trial" (the issue's attribution
requirement). But the reactivation resolves a plan afresh, so the converted
subscription's interval can differ. Carrying both makes "chose annual → converted
annual" vs "chose annual → converted monthly" a clean two-property cross-tab and
surfaces interval-switching at conversion. `intendedInterval` may be `null`
(older trials, or unset) — emit it as `null`, never omit (mirror HOS-122 D-3's
"never leak absence" rule).

**D-4 — Stitch via the superseded (trial) subscription id.** HOS-122's
`checkout_completed` for the trial outcome carries `localSubscriptionId` = the
**trial** subscription id. So the conversion event must carry
`supersededSubscriptionId` (= that same trial id) as the join key back to
`checkout_completed`, plus `newSubscriptionId` (the paid sub) for forward
correlation to subsequent `subscription_payment_succeeded` / renewal events.
Both are already in scope in `completeSupersessionPairing` (`supersededId`,
`newSubscription.id`).

**D-5 — Widen the Step 2 SELECT to fetch the superseded row's `metadata`.**
GOTCHA: today `completeSupersessionPairing`'s Step 2 SELECT
(`reactivation-supersession-complete.ts` L247–255) fetches only
`id, status, mpSubscriptionId` from the superseded trial row — **not `metadata`**.
Since `intendedInterval` lives on that old trial row's metadata, the SELECT must
be widened to include `metadata` so the capture can call
`resolveIntendedInterval(supersededRow.metadata?.intendedInterval)`. This is the
one non-analytics code touch the spec requires, and it is additive (one more
selected column).

**D-6 — Resolve `convertedInterval` / `planSlug` from the new plan.** Only
`newSubscription.planId` (a raw id) is in scope; resolving the human-readable
slug + `billingInterval` needs an extra `billing.plans.get(newSubscription.planId)`
(mirroring `resolveReactivationPlan`,
`apps/api/src/services/billing/reactivation-plan-guard.ts` L71–100). If that
lookup fails, emit `planSlug: null` / `convertedInterval: null` rather than
throwing (non-blocking, D-8).

**D-7 — distinctId via `resolveOwnerUserId({ customerId: newSubscription.customerId })`.**
Same resolver used by every other billing analytics capture that runs without a
Hono context, keeping the person identity stitched across `checkout_completed` →
`trial_converted_to_paid` → `subscription_payment_succeeded`.

**D-8 — Non-blocking try/catch.** Wrap the capture so a PostHog failure logs a
warning and never affects the supersession transaction (which has already
committed by this point anyway).

Capture (mirrors the existing non-blocking style; all OQs resolved — see D-9..D-13):

```ts
// inside completeSupersessionPairing, after the Step 5 audit insert succeeds
// and only when outcome === 'completed' && triggerSource === 'trial-reactivation'
try {
  const intendedInterval = resolveIntendedInterval(
    (supersededRow.metadata as Record<string, unknown> | null)?.intendedInterval
  );                                                   // 'monthly' | 'annual' | null
  const plan = await billing.plans.get(newSubscription.planId).catch(() => null);
  const convertedInterval = plan?.billingInterval ?? null;
  getPostHogClient()?.capture({
    distinctId: resolveOwnerUserId({ customerId: newSubscription.customerId }),
    event: 'trial_converted_to_paid',                  // D-9
    properties: {
      intendedInterval,                                // D-10 original choice (attribution)
      convertedInterval,                               // D-10 actual converted interval
      planSlug: plan?.slug ?? null,
      amount: plan?.amount ?? null,                    // D-12 (major units | null)
      currency: plan?.currency ?? null,                // D-12
      supersededSubscriptionId: supersededId,          // D-4 join key → checkout_completed
      newSubscriptionId: newSubscription.id,           // D-4 forward correlation
      triggerSource,                                   // 'trial-reactivation'
      source,                                          // 'webhook' | reconcile-cron sentinel
      // D-11 person property for cohorting converts:
      $set: { converted_from_trial: true, last_conversion_interval: convertedInterval }
    }
  });
} catch (phErr) {
  apiLogger.warn({ err: phErr }, 'PostHog capture failed for trial_converted_to_paid (non-blocking)');
}
```

## 7. Data model / contracts

- **No DB migration.** Analytics-only. (D-5 widens a SELECT, not the schema.)
- **No new env var.** Reuses `HOSPEDA_POSTHOG_KEY` + `getPostHogClient()`.
- **New PostHog event** `trial_converted_to_paid` (D-9) with the
  property set in D-3/D-4/D-6.
- **No wire/HTTP contract change** — server-emitted only; not part of any route
  response.

## 8. UX / UI behavior

None. No user-facing surface.

## 9. Acceptance criteria

- **AC-1** — A no-card **annual** trial that converts to a paid **annual**
  subscription emits `trial_converted_to_paid` with `intendedInterval: 'annual'`
  and `convertedInterval: 'annual'`.
- **AC-2** — A no-card **annual** trial that converts to a paid **monthly**
  subscription emits `intendedInterval: 'annual'`, `convertedInterval: 'monthly'`
  (interval switch captured, not collapsed).
- **AC-3** — The event carries `supersededSubscriptionId` equal to the
  `localSubscriptionId` of the original `checkout_completed` (`outcome: 'trial'`),
  and a distinct `newSubscriptionId`; both share the same `distinctId`.
- **AC-4** — The event fires **exactly once** whether the conversion is completed
  by the live webhook or the reconcile cron backstop (driven by the `'completed'`
  outcome + `onConflictDoNothing` idempotency).
- **AC-5** — A **lapsed-subscription reactivation** (`triggerSource:
  'subscription-reactivation'`) emits **no** `trial_converted_to_paid` event.
- **AC-6** — A trial that **expires without converting** (trial-expiry cron,
  `trial → cancelled`) emits **no** `trial_converted_to_paid` event.
- **AC-7** — When `intendedInterval` is absent on the superseded row, the event
  emits `intendedInterval: null` (never omitted). When the plan lookup fails,
  `convertedInterval`/`planSlug` emit `null` and the conversion still completes.
- **AC-8** — When PostHog capture throws, the supersession completes and the error
  is logged, not propagated (non-blocking).

## 10. Risks

- **R-1 — Dependency on the reactivation-supersession flow (HOS-114 / HOS-123).**
  The capture point lives in code shipped by those specs; HOS-123 (annual
  one-time reactivation) is still in Phase 2 at spec time. Implementation of
  HOS-130 should land after that flow is stable on `staging`, and the
  `'completed'`-outcome gate must be re-verified against the then-current
  `completeSupersessionPairing` return contract.
- **R-2 — `intendedInterval` staleness/absence.** Trials created before HOS-115,
  or via a path that didn't stamp it, will emit `intendedInterval: null`.
  Acceptable — analysis buckets those as "unknown original interval"; D-3 forbids
  omission so the null is explicit.
- **R-3 — No `/trial/reactivate` funnel start event.** Unlike `/start-paid`, the
  reactivate route emits no `checkout_started`/`checkout_completed`, so this
  conversion event has no *same-flow* funnel predecessor — only the *original*
  trial-checkout's `checkout_completed`. Stitching is therefore trial-checkout →
  conversion, not reactivate-start → conversion. Closing that gap is out of scope
  (NG-4 / D-13).
- **R-4 — Event-name typo has no compile-time guard** (no registry — NG-3).
  Mitigation: name asserted by AC-1..AC-3 tests.
- **R-5 — Double-fire on concurrent webhook + cron.** Mitigated by the
  `onConflictDoNothing` audit insert: only the caller that writes the new row sees
  `'completed'`; the loser sees `'already-audited'` and does not capture.

## 11. Resolved decisions

All open questions were resolved with the owner on 2026-07-10 (each with the
recommended option).

- **D-9 (was OQ-1) — Event name is `trial_converted_to_paid`.** Reads as the
  explicit downstream counterpart to `checkout_completed`. Rejected
  `subscription_activated` (too broad — collides conceptually with lapsed
  reactivation) and `trial_conversion`.
- **D-10 (was OQ-2) — Carry both intervals** (`intendedInterval` +
  `convertedInterval`, per D-3). The cross-tab is strictly richer and surfaces
  interval-switching at conversion at near-zero cost.
- **D-11 (was OQ-3) — Yes, `$set` a person property on conversion** (mirror of
  HOS-122 D-10): `$set { converted_from_trial: true, last_conversion_interval: convertedInterval }`
  for cohorting converts.
- **D-12 (was OQ-4) — Emit `amount` / `currency`** on the conversion event,
  resolved from the plan lookup (D-6), enabling revenue-weighted conversion
  analysis. Emit `null` for each when the plan lookup fails (non-blocking, D-8).
- **D-13 (was OQ-5) — No `/trial/reactivate` funnel instrumentation in this
  spec.** Keeps HOS-130 a small, outcome-side change; the reactivate route is a
  distinct funnel (R-3) worth its own follow-up if wanted, not part of this spec.

## 12. Implementation notes

- **Change surface (small):** one edit to
  `apps/api/src/services/billing/reactivation-supersession-complete.ts` — widen
  the Step 2 SELECT to include `metadata` (D-5) and add the gated non-blocking
  capture after the Step 5 insert (D-1). Plus tests in the matching test file
  covering AC-1..AC-8 (trial→annual, trial→monthly, lapsed-reactivation excluded,
  expiry excluded, null-interval, non-blocking throw). No migration, no env var,
  no schema change.
- Reuse `resolveIntendedInterval` from `@repo/service-core` and
  `resolveOwnerUserId` from `subscription-pause.service.ts`; do **not** add a new
  capture helper (mirror HOS-122).
- If a PostHog event catalog/doc exists at implementation time (none in-repo at
  spec time), add `trial_converted_to_paid` there.
- **Sequencing:** implement after HOS-114/HOS-123's reactivation flow is stable on
  `staging` (R-1). All OQs resolved (D-9..D-13) → candidate for a single-PR
  implementation.

## 13. Linear

Canonical tracking: **HOS-130**
<https://linear.app/hospeda-beta/issue/HOS-130>
