---
linear: HOS-115
statusSource: linear
title: Grant the no-card trial on the annual first-time checkout path
area: [billing, api, web]
---

# HOS-115 — Grant the no-card trial on the annual first-time checkout path

## Context

Hospeda's trial is **no-card**: a trial-eligible user is enabled immediately
(`trialing`) with **no MercadoPago object and no stored card**, and is only sent
to pay when they explicitly choose to convert. HOS-110 unified this trial across
every entry surface that reaches `POST /start-paid` — but only for the **monthly**
interval. Its own out-of-scope list closes with the exact follow-up this spec
addresses:

> **Annual first-time checkout has no trial branch (annual = one-time upfront).**
> — `.specs/HOS-110-unify-nocard-trial/spec.md`, "Follow-ups (out of scope)"

Today, a first-time, trial-eligible user who flips the pricing toggle to **annual**
for a trial-declaring plan is routed straight to `initiatePaidAnnualSubscription`
and **charged upfront** via MP Checkout, silently bypassing the trial the monthly
path (`initiatePaidMonthlySubscription`) grants for the identical user and plan.
The on-screen "N días gratis" copy is even CSS-hidden on the annual toggle, so the
user isn't told they lost a trial they were entitled to — but a user who wants the
annual price and is trial-eligible should still get the trial first, then convert
to the annual plan at the end, exactly like the monthly path does. This is the same
class of revenue/trust bug HOS-110 fixed for monthly, just on the sibling interval.

### The key realization: the trial object is interval-agnostic

Tracing the code confirms a `trialing` subscription created by
`TrialService.startTrial()` carries **no price and no interval**. It has a
`planId`, a `trialEnd`, and `status = 'trialing'` — nothing that commits the user
to monthly vs annual. The interval is only chosen later, at the moment the user
completes a real checkout to convert.

Consequently the "annual trial" is **the same trial object** as the monthly trial.
There is no such thing as an "annual trial" distinct from a "monthly trial" at the
data layer — there is one trial, and then a conversion into whichever interval the
user pays for. This spec therefore does **not** introduce a new status, a new
column, or a new cron. It only fixes the *entry routing* so the annual path grants
that same trial instead of charging, and shows the trial copy the annual toggle
currently hides.

## Owner decision (locked — do not re-decide)

The owner selected **option B1**: add the **no-card free trial** to the annual
checkout flow, replicating exactly the HOS-110 monthly no-card trial model.

Option **B2** (a card-required, auto-charge-on-expiry conversion for annual) was
explicitly **rejected** and is a Non-Goal (see below). The trial stays no-card:
it expires **cancel-only** (never an auto-charge, because there is no card on
file), and conversion to paid is **always an explicit, user-initiated checkout**.

## Goals

1. When a first-time, trial-eligible user starts the **annual** checkout for a
   plan that declares a trial, route them to the SAME `TrialService.startTrial()`
   the monthly path uses — granting a `trialing` subscription with **no MP object
   and no charge** — instead of `initiatePaidAnnualSubscription`'s upfront charge.
2. Keep the annual path's existing behavior **unchanged** for every user who is
   NOT trial-eligible (already had any subscription) — they still pay the annual
   price upfront.
3. Reuse the existing expiry machinery unchanged: the daily `trial-expiry` cron
   (`blockExpiredTrials`) already cancels ALL `trialing` subscriptions past their
   `trialEnd`, regardless of interval, so an annual-originated trial expires
   cancel-only with zero new code.
4. Show the trial copy on the **annual** toggle in the web pricing page, since the
   annual path now grants a trial (currently it is CSS-hidden under
   `[data-billing='annual']`).
5. Replicate the monthly promo precedence exactly (comp wins → no trial;
   `trial_extension` adds days; `discount` discarded with `promoCodeIgnored`).

## Non-Goals

- **B2 — card-required auto-charge conversion for annual.** Explicitly rejected by
  the owner. No card is stored during the trial; expiry never auto-charges.
- **Fixing HOS-110's known `reactivateFromTrial` / `reactivateSubscription`
  missing-`mode:'paid'` bugs.** Those two functions create the post-trial paid
  subscription without threading `mode: 'paid'` and may not route users to add a
  card; that is a pre-existing HOS-110 follow-up and stays out of scope here.
- **Changing the eligibility rule.** One trial per customer for life is unchanged
  (see Eligibility below). This spec does not make a user who consumed a monthly
  trial newly eligible for an annual one.
- **A pending-outcome MP return URL for annual**, discount-code persistence across
  conversion, or any change to how the annual one-time charge itself is created —
  all untouched.
- **New status, new DB column, or new cron.** The interval-agnostic trial object
  and the existing `blockExpiredTrials` cron already cover the annual case.

## Design

### 1. Trial-vs-pay branch on the annual entry path (`apps/api`)

The monthly path already has the exact branch to replicate. In
`initiatePaidMonthlySubscription` (`apps/api/src/services/subscription-checkout.service.ts`,
~L541–635) the order is: resolve promo → **COMP** returns early → **TRIAL** branch
(`resolvePlanTrialConfig` → zero-prior-subs eligibility check →
`trialService.startTrial()` → early return `{ appliedEffect: 'trial', ... }` with
NO MP preapproval) → otherwise the paid path.

`initiatePaidAnnualSubscription` (~L1138+) today resolves the promo and handles the
**COMP** branch (early return, no charge), but then falls straight through to the
**DISCOUNT / upfront-charge** path with **no TRIAL branch**. The fix is to insert
the same trial branch, in the same position — **after** the COMP early-return and
**before** the discount/charge logic — so the precedence is identical to monthly:

```
resolve promo
  → COMP present?            → create comp sub, return (no charge)      [unchanged]
  → plan declares a trial
      AND customer has zero prior subs?
                             → startTrial(), return appliedEffect:'trial' (no charge)   [NEW]
  → else                     → annual discount / upfront MP Checkout    [unchanged]
```

The branch calls the SAME `startTrial()` with the SAME `planSlug` — it does NOT
pass any interval, because the trial object has none. The returned shape mirrors
the monthly trial return: an in-app success sentinel `checkoutUrl` (reuse the
already-resolved `urls.successUrl`), `localSubscriptionId`, `expiresAt`,
`appliedEffect: 'trial'`, and `promoCodeIgnored: true` when a discount code was
dropped. `initiatePaidAnnualSubscription`'s result type must widen to allow
`appliedEffect: 'trial'` and the optional `promoCodeIgnored` flag (the monthly
path already did this; annual currently only emits `'comp' | 'discount'`).

**Alternatives considered for the insertion point.** Two candidates:

1. **Inside `initiatePaidAnnualSubscription`** (chosen). Mirrors monthly 1:1, keeps
   the promo-precedence ordering (comp → trial → charge) co-located with the annual
   promo resolution it already does, and keeps the route handler thin. Chosen
   because it is the direct structural twin of the monthly implementation HOS-110
   already reviewed and shipped, minimizing divergence risk.
2. **In the route handler (`start-paid.ts`) before the annual/monthly split.**
   Rejected: it would duplicate the eligibility + `startTrial` logic that already
   lives in the monthly initiator, split the promo-precedence decision across two
   files, and the handler does not currently resolve the plan's trial config or the
   promo plan (both happen inside the initiators). It would also have to special-case
   the interval-agnostic nature of the trial in the one place the code otherwise
   cares most about the interval.

`startTrial()` remains the **authoritative** eligibility gate — it re-checks for
any existing subscription itself and returns `null` if the customer became
ineligible between the cheap first-layer check and the create. On a `null` return,
fall through to the unchanged annual paid path (identical to monthly's handling).

The `start-paid.ts` route already treats a `trialing` accommodation subscription as
`ALREADY_SUBSCRIBED` (the `hasActiveAccommodationSub` guard, ~L274–293), so a user
who is already on a trial (from either interval) cannot start a second annual
checkout — no change needed there.

### 2. Expiry stays cancel-only, on the existing cron (`apps/api`)

No change. `blockExpiredTrials()` (`trial.service.ts`) lists **all** `status:
'trialing'` subscriptions and cancels those past `trialEnd` — it does not read the
interval, so a trial that originated from the annual entry path is picked up and
cancelled by the exact same daily `trial-expiry` cron. Because there is no stored
card, expiry is a cancel, never a charge. This is the whole point of the
interval-agnostic realization: the annual case needs zero new expiry code.

### 3. Conversion is an explicit annual checkout (`apps/api` — existing paths)

At or after expiry, converting to paid is user-initiated, exactly as for a monthly
trial. The user returns to the pricing/plan surface and completes a real checkout;
if they pick annual, they go through the existing `initiatePaidAnnualSubscription`
upfront-charge path (they are no longer trial-eligible, so the new trial branch is
skipped and they pay). No new conversion endpoint is introduced.

### 4. Web: show the trial copy on the annual toggle (`apps/web`)

`apps/web/src/components/billing/PricingCardsGrid.astro` renders the trial line
(`.pricing-card__trial pricing-card__trial--monthly`, text from i18n key
`pricing.trial`, ~L284–286) and then CSS-hides it under the annual toggle
(~L667–671: `[data-billing='annual'] .pricing-card__trial--monthly { display:
none; }`). Since the annual path now grants the same trial, that hide is now wrong
— it would hide a trial the annual path actually gives.

The change: the trial copy must be visible on **both** toggle states. The
`--monthly` suffix on the class is now a misnomer (the trial is not monthly-specific)
— rename it to an interval-neutral class (e.g. `.pricing-card__trial` without a
`--monthly` modifier, or `.pricing-card__trial--any`) and drop it from the
`[data-billing='annual']` hide rule so it shows under both `monthly` and `annual`.
The copy itself ("N días gratis") is interval-agnostic and correct as-is; only its
visibility rule (and the now-misleading class name) changes. Any i18n string that
implies the trial is monthly-only must be reviewed for the three locales (es/en/pt)
and corrected to interval-neutral wording; if the current `pricing.trial` string is
already neutral, no i18n copy change is required beyond confirming it.

**Alternatives considered for the web change.** Two candidates:

1. **Keep one shared trial line, shown on both toggles** (chosen). The trial length
   is the same regardless of interval, so one line reading "N días gratis" is
   accurate under both toggles. Simplest, no duplicated markup, and honest about the
   interval-agnostic trial.
2. **Render a separate annual-specific trial line.** Rejected: it duplicates markup
   for zero benefit — the trial is byte-for-byte the same object and length in both
   cases, so a second line would only risk the two drifting.

### Summary of the code delta

- `apps/api/src/services/subscription-checkout.service.ts` — add the trial branch
  to `initiatePaidAnnualSubscription`; widen its result type to include
  `appliedEffect: 'trial'` + optional `promoCodeIgnored`.
- `apps/web/src/components/billing/PricingCardsGrid.astro` — show the trial copy
  under the annual toggle (rename the class off `--monthly`, drop it from the
  annual hide rule).
- `@repo/i18n` (only if the current `pricing.trial` wording implies monthly-only) —
  interval-neutral copy for es/en/pt.
- No change to `trial.service.ts`, `trial-expiry.ts`, the DB schema, or any cron.

## Promo interaction (replicate monthly precedence exactly)

The promo is resolved first in `initiatePaidAnnualSubscription` (it already is, for
the comp/discount branches). The trial branch folds the promo in with the SAME
rules HOS-110 W1 established for monthly:

- **`comp`** — wins outright. The existing COMP branch already returns early with a
  `status='comp'` subscription and no charge, BEFORE the new trial branch. A comp
  code never burns the customer's one-per-lifetime trial. (Unchanged; the trial
  branch simply sits after it.)
- **`trial_extension`** — its `freeTrialDays` are forwarded as `extraTrialDays` to
  `startTrial()`, lengthening the granted trial (plan base + extension). Identical
  to monthly.
- **`discount`** — the trial wins; the discount is **discarded** (never persisted)
  and the response carries `promoCodeIgnored: true` so the front-end tells the user
  their code was not applied. Identical to monthly.
- **`none`** — plain trial, no flag.

## Eligibility

**One trial per customer, for life** — unchanged from HOS-110 and enforced
authoritatively inside `startTrial()` (any existing subscription of any status or
product domain disqualifies a new trial). Because the trial object is
interval-agnostic, this rule is explicitly cross-interval:

- A user who already consumed a **monthly** trial is **NOT** eligible for an
  annual trial. They had their one trial.
- A user who already consumed an **annual** trial (post this spec) is **NOT**
  eligible for a monthly trial either.

There is no per-interval trial allotment. "Annual" vs "monthly" only describes
which checkout the user completes at conversion, never a separate trial grant.

## Testability

`owner-test-daily` carries a **1-day** trial (`hasTrial: true, trialDays: 1`, from
HOS-110). Because the new annual branch reuses `resolvePlanTrialConfig` +
`startTrial()`, selecting the annual toggle for `owner-test-daily` as a
trial-eligible user grants a 1-day trial via the annual entry path — the full
annual-trial → expiry cycle is therefore exercisable within a day (and faster with
`HOSPEDA_TRIAL_DAYS_OVERRIDE`, the existing ops knob that shortens any trial). This
is the same shortcut HOS-110 used to make the monthly trial cycle testable, now
covering the annual entry.

## Acceptance criteria (BDD)

### AC-1 — Trial-eligible user, annual toggle → trial, no charge

```
Given a first-time user with ZERO prior subscriptions (trial-eligible)
  And a plan that declares a trial (hasTrial=true, trialDays>0)
When they POST /start-paid with billingInterval='annual' for that plan
Then a `trialing` subscription is created via TrialService.startTrial()
  And NO MercadoPago object is created and the user is NOT charged
  And the response carries appliedEffect='trial' with an in-app success URL
  And the trial length equals the plan's trialDays (interval-agnostic).
```

### AC-2 — Not-eligible user, annual toggle → pays upfront (unchanged)

```
Given a user who already has ANY prior subscription (not trial-eligible)
When they POST /start-paid with billingInterval='annual' for a trial plan
Then the trial branch is skipped
  And the existing annual upfront MP Checkout is created (unchanged behavior)
  And the response carries a real provider checkoutUrl (and appliedEffect is
      'discount' or absent, never 'trial').
```

### AC-3 — Annual trial expiry is cancel-only

```
Given a `trialing` subscription that originated from the annual entry path
  And its trialEnd is in the past
When the daily trial-expiry cron (blockExpiredTrials) runs
Then that subscription is CANCELLED (no auto-charge, because no card is stored)
  And a TRIAL_BLOCKED event and trial_converted_at timestamp are written
  And the TRIAL_EXPIRED notification is sent
  And the behavior is identical to a monthly-originated trial (no interval branch).
```

### AC-4 — Conversion via explicit annual checkout

```
Given a user whose trial has expired (subscription cancelled, no active sub)
When they return and POST /start-paid with billingInterval='annual'
Then they are NOT trial-eligible (they already had a subscription)
  And the annual upfront MP Checkout is created for the annual price
  And on payment approval the subscription becomes active on the annual plan.
```

### AC-5 — Promo precedence on the annual trial branch

```
Given a trial-eligible user starting an annual checkout for a trial plan
When they supply a `comp` code
Then a status='comp' subscription is created and NO trial is granted (comp wins).

When they supply a `trial_extension` code
Then the granted trial length is plan base + the code's freeTrialDays.

When they supply a `discount` code
Then the trial is granted at its base length, the discount is discarded,
  And the response carries promoCodeIgnored=true.
```

### AC-6 — Web shows the trial copy on the annual toggle

```
Given the pricing page for a plan with hasTrial=true
When the user flips the toggle to `annual` (data-billing='annual')
Then the trial copy ("N días gratis") is VISIBLE (not display:none)
  And it is also visible under the `monthly` toggle
  And the copy is interval-neutral in es/en/pt.
```

### AC-7 — Cross-interval eligibility

```
Given a user who already consumed a trial via the MONTHLY path
When they later start an ANNUAL checkout for a trial plan
Then they are NOT granted a second trial (one trial per customer, for life)
  And they are routed to the annual upfront charge.
```

## Open questions

- **OQ-1 — Interval choice at conversion.** After an annual-originated trial
  expires, the user re-picks the interval at conversion from scratch (they could
  choose monthly or annual). Do we want any nudge toward the interval they
  originally selected when they started the trial (e.g. pre-select the annual
  toggle, or a "you started with annual" hint)? The trial object stores no
  interval, so honoring the original choice would require persisting it somewhere
  (e.g. trial subscription metadata). Flagged, not decided — the default with no
  extra work is "user re-picks freely, no nudge."
- **OQ-2 — Analytics dimension.** `checkout_started` currently captures
  `billingInterval`. When the annual branch short-circuits into a trial, should the
  emitted analytics distinguish "annual → trial" from "annual → paid" (a new
  property or event), or is `appliedEffect='trial'` on the existing event enough?
  Flagged for the implementation phase; not a blocker.

## Smoke labels

This touches the billing checkout surface (`/start-paid` → annual initiator), so
per the project billing-testing rule it needs **`status-needs-smoke-staging`**:
the vitest e2e suite uses an MP stub, and the real gate is a manual smoke against
the MercadoPago sandbox on staging — verifying that a trial-eligible annual
checkout creates NO MP object and grants the trial, and that a not-eligible annual
checkout still produces a real MP Checkout. No billing-CORE money mutation is
changed (the trial branch creates no MP object and the untouched annual charge path
is unchanged), so `status-needs-smoke-prod` is not required for this spec.

## Lineage

Direct continuation of **HOS-110** (`.specs/HOS-110-unify-nocard-trial/spec.md`),
closing the last item on its out-of-scope follow-up list. Distinct from HOS-108
(webhook activation) and from the HOS-110 `reactivateFromTrial` /
`reactivateSubscription` `mode:'paid'` follow-up, both of which remain out of scope.
