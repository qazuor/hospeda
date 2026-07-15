---
title: Unify billing on preapproval + MercadoPago-native trial (card-first)
linear: HOS-171
statusSource: linear
created: 2026-07-15
type: refactor
areas:
  - billing
  - api
  - web
  - admin
---

# HOS-171 — Unify billing on preapproval + MercadoPago-native trial (card-first)

## 1. Summary

One charging mechanism for everything that is a subscription: **MercadoPago
`preapproval`**. Monthly and annual. The free trial is handled by MercadoPago
(`auto_recurring.free_trial`), with a card on file from day 1. The parallel
machinery Hospeda built to simulate a no-card trial is deleted.

Owner's goal, verbatim: *"menos superficie de posible falla en nuestro código"*.

The design is **derive `TRIALING` in Hospeda's MercadoPago webhook** when qzpay
reports `active` and the local `trialEnd` is in the future. **Zero qzpay
changes.** See §5 for why touching qzpay is the wrong move and re-introduces a
known entitlement-leak bug.

## 2. Problem

Four problems, one root cause — the trial lives outside the payment provider:

1. **A real promo leak.** Today a user gets 14 no-card trial days, and *later*,
   at checkout, a 60-day `trial_extension` promo = **74 free days**, because
   they are two gifts granted at two moments and nothing sums them. The
   base+promo sum already exists and is already correct
   (`apps/api/src/services/trial.service.ts:247-248`) — it simply is not on the
   path that reaches MercadoPago.
2. **Two charging mechanisms.** Monthly is a `preapproval`; annual is a one-time
   Checkout Pro charge (`apps/api/src/services/billing/create-annual-subscription.ts`,
   406 LOC). Annual therefore never renews, needing a whole reactivation flow
   (HOS-123) to exist at all.
3. **~650 LOC of trial policing** we own and must keep correct: creation without
   a card, expiry detection, bulk cancel-at-expiry, an in-app success sentinel,
   a 402 middleware, and a dedicated notification type.
4. **No card means no conversion.** A trial that ends has to re-acquire the
   customer at exactly the moment their attention is gone.

## 3. Goals

- **G-1** Every subscription (monthly + annual, every product domain) is created
  as a MercadoPago `preapproval`. `create-annual-subscription.ts` is deleted.
- **G-2** The trial is `auto_recurring.free_trial` on that preapproval — a card
  is collected on day 1, MercadoPago defers the first charge and charges
  automatically at day N.
- **G-3** `TRIALING` survives as a **local** status, derived in the webhook. The
  trial read layer (entitlements, middleware, admin UI) keeps working.
- **G-4** `freeTrialDays = base + promo` is resolved in ONE transaction, closing
  the 74-day leak.
- **G-5** The annual plan auto-renews, with a mandatory pre-renewal notice
  (OQ-1, owner-resolved — non-negotiable, see §7.3).
- **G-6** A defensive reconciliation check on incoming subscription payments
  (§7.5), independent of whether MP's panel discount campaigns turn out to apply.
- **G-7** Preserve the "one trial per customer, for life" guard — it moves from
  inside `startTrial` to the checkout call site. It is **not** lost.

## 4. Non-goals

- **NG-1** Changing qzpay. See §5. Zero qzpay changes, zero publish cycle.
- **NG-2** Revisiting ADR-009 (trial is HOST-only). The "HOST-only" rule is
  justified by growth economics, unrelated to when the card is collected. A
  one-line addendum suffices.
- **NG-3** Migrating legacy `trialing` rows. Owner confirmed there are no real
  users. If that changes before implementation, this becomes a blocker, not a
  footnote.
- **NG-4** Removing the `comp` path. `comp` never touches MercadoPago and is
  untouched by this spec.
- **NG-5** Building the full hybrid-addon catalog. OQ-2 is open (§13); this spec
  scopes the *mechanism*, not the list.

## 5. 🚫 THE QZPAY TRAP — READ THIS BEFORE TOUCHING ANYTHING

**`/proyects/PACKAGES/qzpay/packages/drizzle/src/adapter/drizzle-storage.adapter.ts:364`:**

```ts
const initialStatus = input.mode === 'paid' ? 'incomplete' : hasTrial ? 'trialing' : 'active';
```

**This looks like the blocker. IT IS NOT. It is a deliberate anti-entitlement-leak
guard.** Its comment (`drizzle-storage.adapter.ts:350-363`) is load-bearing —
verbatim:

```
// `mode: 'paid'` (SPEC-124) drives the provider preapproval flow:
// the local row is persisted FIRST and the provider call happens
// AFTER in `billing.subscriptions.create`. The user has not yet
// authorized the recurring charge at the provider, so the
// subscription must NOT enter `active`/`trialing` here —
// entitlement gates that key off those statuses would otherwise
// grant features before any payment lands (a real freebie /
// entitlement-leak bug). The webhook handler flips the row to
// `active`/`trialing` after the provider confirms authorization.
//
// Status selection:
//  - mode==='paid' → 'incomplete' (waiting for provider auth)
//  - hasTrial      → 'trialing'   (free trial active)
//  - default       → 'active'     (no provider step required)
```

**If you change this line, you re-introduce the exact bug it prevents**: anyone
who abandons MercadoPago's authorization page walks away with N days of free
entitlements and no card. The comment already names the correct fix — *"The
webhook handler flips the row to `active`/`trialing` after the provider confirms
authorization."* That is precisely what §7.1 does.

The next reader **will** want to "just fix qzpay". Do not. The derive-in-webhook
design is strictly better on every axis:

- Zero qzpay changes, zero publish/version cycle.
- The trial read layer survives (`apps/api/src/middlewares/trial.ts`, 305 LOC —
  though see the §7.1 caveat: the middleware itself is untouched, but
  `getTrialStatus` is **not**).
- It **fixes** the abandonment leak instead of creating it: pre-authorization
  rows stay `incomplete` (not a live status), and
  `apps/api/src/cron/jobs/abandoned-pending-subs.job.ts` already reaps them at
  30 min (`PENDING_STATUSES` at :76 includes `incomplete`; TTL at :68).

**Almost everything is already wired** (all verified):

| Already true | Evidence |
| --- | --- |
| `mode:'paid'` already writes `trialStart`/`trialEnd` — only `status` is gated by mode | `drizzle-storage.adapter.ts:347-348, 373-374` (gated on `hasTrial`, **not** on `mode`) |
| qzpay already maps `freeTrialDays` → `auto_recurring.free_trial` | `packages/mercadopago/src/adapters/subscription.adapter.ts:179, 196, 248-253` |
| qzpay already maps `year` → 12 months | `subscription.adapter.ts:241-242` |
| qzpay never sends `status` on create | `subscription.adapter.ts:172-209` — no `status` key |
| `createPaidSubscription({freeTrialDays})` already runs in production | `apps/api/src/services/billing/paid-subscription-create.ts:54, 128-131` |
| `TRIALING → ACTIVE` edge exists | `packages/service-core/src/services/billing/subscription/subscription-status-transitions.ts:81` |

**The one genuinely missing piece** is a single state-machine edge:
`PENDING_PROVIDER → TRIALING`. Verified absent —
`subscription-status-transitions.ts:72-77` allows `PENDING_PROVIDER → { ACTIVE, ABANDONED }`
only.

> ⚠️ **Version drift**: the local checkout at `/proyects/PACKAGES/qzpay` has
> `@qazuor/qzpay-drizzle@1.10.0`, but Hospeda depends on `^1.11.0`
> (`packages/db/package.json:57`, resolved 1.11.0). The quoted code is
> representative; re-verify against the installed 1.11.0 before relying on exact
> line numbers.

## 6. Verified baseline — the production spike (2026-07-15)

This is **not** design-on-documentation. A spike ran against the **real
production** MercadoPago API with a real card and a real authorization. **Total
cost: ARS 0** (the trial deferred the charge 14 days; the subscription was
cancelled the same day). Full record: engram `billing/mp-free-trial-adhoc-verified`
(observation #8009).

| Question | Result |
| --- | --- |
| `free_trial` on a preapproval **without a plan** | ✅ Works. MP echoes it **and adds its own** `first_invoice_offset` → proof it processed the field |
| Defers the first charge | ✅ `next_payment_date` = +14d, **and survives authorization** |
| 74-day trial (14 base + 60 promo) | ✅ No cap. `2026-09-27`, exact |
| Status after authorization | ✅ `authorized`, NOT `pending` |
| Annual cadence (`frequency:12, frequency_type:"months"`) | ✅ Accepted, **with** `free_trial` included |
| `frequency_type: "years"` | ❌ 400 — *"valid ones are [days, months]"* |
| Large recurring amount (ARS 50.000) | ✅ No ceiling |
| Lower the amount 50% on a live sub **with a trial** | ✅ Trial intact, `next_payment_date` unmoved |
| **Restore to the original amount without re-auth** | ✅ **Closes SPEC-262 AC-3.3**, open since June |
| MP tells the customer about the trial | ✅ *"¡Tendrás 14 días gratis!"* + *"Desde el 29 de julio"* in its own checkout |
| Create a preapproval **from an MP plan** | ❌ 400. Plans force the generic `init_point` → per-subscription `external_reference` is lost |

Two findings that shape the design:

- **`start_date` and `free_trial` are THE SAME mechanism.** Sending only
  `start_date=+14d` makes MP synthesize the `free_trial`. Sending both does NOT
  stack (14d, not 28d). This explains the contradictory community reports — both
  "work" because they are one thing.
- **`summarized` stays all-null during the trial.** Do NOT use it to detect
  trialing. Use `status` + `next_payment_date`.

**The 201 OK is not the test.** MP returns a clean response and can still ignore
a field. The only proof is `next_payment_date` on an authorized subscription.

## 7. Proposed design

### 7.1 Derive `TRIALING` in the webhook (the core)

**Where**: `apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`.

`QZPAY_TO_HOSPEDA_STATUS` (:98-105) maps `active → SubscriptionStatusEnum.ACTIVE`.
That map is a static `Record` and **must stay static** — it cannot see the local
row. The derivation goes in `processSubscriptionUpdated`, immediately after Step
4 resolves `mappedStatus` (:373) and **before** the Step 6b fast-path guard
(:567), so that both the fast-path guard and the in-transaction guard (:717) see
the same value.

Ordering matters: the local row is fetched at Step 5 (:401-410), which is *after*
:373. The derivation therefore lands **after Step 5's lookup, before Step 6's
comparison** (:514). Concretely, a new pure helper:

```ts
// Pure, unit-testable, no I/O. Lives in @repo/service-core beside the
// other subscription-status helpers.
export function deriveTrialingStatus(input: {
    readonly mappedStatus: SubscriptionStatusEnum;
    readonly trialEnd: Date | null;
    readonly now: Date;
}): SubscriptionStatusEnum;
```

**The condition** — and only this condition:

| `mappedStatus` | `trialEnd` | Result | Why |
| --- | --- | --- | --- |
| `ACTIVE` | in the future | **`TRIALING`** | MP authorized, first charge deferred |
| `ACTIVE` | `null` | `ACTIVE` (unchanged) | Ordinary paid sub, no trial |
| `ACTIVE` | in the past | `ACTIVE` (unchanged) | Trial elapsed; MP has charged. Correct end state |
| anything else | any | unchanged | Never derive off `paused`/`cancelled`/`past_due`/`finished` |

`trialEnd` is read from the already-fetched `localSubscription` (Step 5), so the
derivation costs **zero extra queries**. `now` is injected for testability.

**Required state-machine edge.** Add `PENDING_PROVIDER → TRIALING` to
`VALID_TRANSITIONS` (`subscription-status-transitions.ts:72-77`). Without it the
first webhook after authorization is rejected by the guard and the activation is
silently skipped — the exact HOS-108 failure mode. `TRIALING → ACTIVE` already
exists (:81) and carries the conversion at day N.

#### 🔴 7.1.a `getTrialStatus.isExpired` is a lockout bug under card-first

**This spec's claim that "the trial read layer survives untouched" is true for
the middleware and FALSE for `getTrialStatus`.** Verified:

`apps/api/src/services/trial.service.ts:442-447`:

```ts
const isOnTrial = activeSubscription.status === 'trialing';
const now = new Date();
const trialEnd = activeSubscription.trialEnd ? new Date(activeSubscription.trialEnd) : null;
const isExpired = trialEnd ? now > trialEnd : false;   // ← :447 — ignores status entirely
```

`isExpired` is computed from `trialEnd` **alone**, with no status check.

- **Today this is harmless**: conversion cancels the trial row and creates a
  *new* paid row whose `trialEnd` is `null` → `isExpired = false`.
- **Under card-first it is a lockout**: the SAME row carries `trialEnd` (qzpay
  writes it regardless of mode — `drizzle-storage.adapter.ts:347-348, 373-374`)
  **and** becomes `ACTIVE` at conversion. `trialEnd` is now in the past →
  `isExpired = true` → `apps/api/src/middlewares/trial.ts:137` throws
  **HTTP 402 `TRIAL_EXPIRED` on every write** for a fully paid-up customer.

**Fix** (mandatory, same change): `isExpired` must be status-aware —

```ts
const isExpired = isOnTrial && trialEnd ? now > trialEnd : false;
```

The historical-subscription branch (`trial.service.ts:392-436`) already keys off
`status === 'canceled'` and is unaffected. `middlewares/trial.ts` itself needs no
edit — it consumes the booleans (:137, :159, :281, :293).

#### 🔴 7.1.b `blockExpiredTrials` must INVERT, not merely "stay as a backstop"

The Linear issue says `blockExpiredTrials` *"queda como backstop"*. **That is
wrong and dangerous.** Verified behavior today
(`trial.service.ts:537-825`, 289 LOC):

1. lists `status: 'trialing'` (:582-585)
2. filters `trialEnd < now` (:633)
3. **`await this.billing.subscriptions.cancel(subscription.id)`** (:718)
4. stamps `trialConvertedAt` (:732-735), inserts `TRIAL_BLOCKED` (:742-750)
5. sends `TRIAL_EXPIRED` (:775-787)

Under card-first, **every one of those five actions is wrong**. An elapsed
card-first trial is a customer MercadoPago is about to charge (or already has).
Running this cron unmodified after the migration would **cancel every converting
customer at the exact moment they start paying** — a silent, money-destroying
regression that no existing test would catch (the tests assert the *current*
semantics, and they pass).

**The correct replacement**: same skeleton, inverted outcome — a **trial
reconciler**. Keep the advisory lock (`BLOCK_EXPIRED_TRIALS_LOCK_KEY = 1004`,
:69), the batch bound (:82), the claim/process split (ADR-019), and the
per-subscription dedup-event guard (:642-662). Replace the body:

- Find local `trialing` subs with `trialEnd < now`.
- Re-`retrieve()` the preapproval from MP.
- MP `authorized`/`active` → transition **`TRIALING → ACTIVE`** (edge exists, :81).
- MP `cancelled`/`paused` → mirror it (edges exist, :79-86).
- Charge failed → `PAST_DUE` and let the existing dunning cron own it.

**Why this cron is load-bearing, not optional.** MercadoPago fires
`subscription_authorized_payment.created` on the day-N charge, but the
preapproval status does **not** change (`authorized` → `authorized`), so a
`subscription_preapproval.updated` webhook may never arrive. Without this
reconciler a converted subscription stays locally `TRIALING` **forever**, which
(a) keeps granting entitlements it happens to be entitled to anyway, but
(b) makes `TRIALING` meaningless, and (c) means `RENEWAL_REMINDER` never fires
(it filters `status: 'active'` — `notification-schedule.job.ts:538-540`).

`apps/api/src/cron/jobs/subscription-poll.job.ts` does **not** cover this: it
runs every minute (:750) and calls `retrieve()` (:190, :533), but only for
enqueued polling jobs, which complete once the sub leaves the pending state.

### 7.2 Annual becomes a preapproval

`frequency: 12, frequency_type: "months"` — verified accepted by MP, with
`free_trial` included (§6). `frequency_type: "years"` is rejected (400).

**Zero qzpay changes.** `toMercadoPagoInterval`
(`subscription.adapter.ts:231-246`) already maps year → 12 months:

```ts
case 'year':
    return { intervalFrequency: count * 12, intervalType: 'months' };
```

with its own comment: *"MP only accepts `days` or `months` as `frequency_type`,
so weeks are converted to 7 days and years to 12 months"*. The mapping existed
and nobody used it, because annual diverted to Checkout Pro before reaching it.
It is **exactly** the shape the spike proved in production.

**Prefer `12 months` over `365 days`** (which also works): it handles leap years
and stays aligned to the calendar — a customer who subscribes on 29 Feb or the
31st should renew on a sane date, and `365 days` silently drifts a day per leap
year.

**What changes in Hospeda**: `initiatePaidAnnualSubscription`
(`apps/api/src/services/subscription-checkout.service.ts:1120`) stops calling
`createAnnualSubscription` (:1367) and instead resolves the annual price
(`findAnnualPrice`, :256-261) and calls the same shared `createPaidSubscription`
the monthly path uses (:632). `create-annual-subscription.ts` (406 LOC) is
deleted along with its two importers' call sites
(`subscription-checkout.service.ts:43`, `trial.service.ts:43`).

The annual `payment.updated` confirmation path in `payment-logic.ts` and its
`metadata.annualSubscriptionId` matcher die with it — annual now confirms
through the same `subscription_preapproval.updated` path as monthly. This is a
**simplification**, and it is why HOS-123 (annual reactivation) dies: there is
nothing to reactivate when it renews itself.

### 7.3 Pre-renewal notification (owner-mandated, non-negotiable)

OQ-1 is **resolved**: the annual plan auto-renews, **with a notice a few days
before each renewal**. Owner, verbatim: *"le avisamos antes para no
sorprenderlo"*. This is not a nice-to-have — it is what separates a renewal from
a chargeback. At 12 months MercadoPago debits a full year from someone who forgot
they subscribed; without the notice they see the debit, don't recognize it, and
dispute it. A chargeback costs considerably more than an email.

> ✅ **Correction to the issue.** The issue and the OQ-1 comment both frame this
> as *"código que se AGREGA"*. **It is mostly already built.** Verified:
> `NotificationType.RENEWAL_REMINDER` exists
> (`packages/notifications/src/types/notification.types.ts:9`), has a subject
> (`subject-builder.ts:12`), a 120-LOC template
> (`templates/billing/renewal-reminder.tsx`), a category mapping
> (`notification-categories.ts:16`), retry wiring
> (`apps/api/src/services/notification-retry.service.ts:38, 360`) — **and it is
> already dispatched** by `notification-schedule.job.ts` at **[7, 3, 1] days**
> (`RENEWAL_REMINDER_DAYS`, :45; send at :627-640), anchored on
> `subscription.currentPeriodEnd` (:546-548), filtered to `status: 'active'`
> (:538-540), day-scoped idempotency (:95-103 — the key embeds `YYYY-MM-DD`, so
> the 7/3/1 windows differentiate naturally).

So the real work is **not** building a notification. It is:

1. **Anchor correctness.** `currentPeriodEnd` must be maintained for annual
   preapprovals. Today annual is a direct insert (`create-annual-subscription.ts`)
   and its period semantics die with it. The natural anchor is MP's
   `next_payment_date`, which the spike proved is present and survives
   authorization.
2. **Actually read `next_payment_date`.** ⚠️ **Correction to the qzpay-analysis
   comment**, which says *"El cron `subscription-poll.job.ts` ya hace
   `subscriptions.retrieve()` cada minuto, así que el dato ya está a mano."* Half
   true: it calls `retrieve()` (:190, :533), so the field is **in the response
   object** — but **nothing reads it**. Grep for
   `next_payment_date|nextPaymentDate|currentPeriodEnd` in that 919-LOC file
   returns **zero matches**. The data is "at hand" only in the sense that the
   HTTP call already happens; a consumer must be written.
3. **Suppress during trial.** A `trialing` sub must not receive
   `RENEWAL_REMINDER` — `TRIAL_ENDING_REMINDER` owns that window. The existing
   `status: 'active'` filter (:538-540) already gives this for free, provided
   §7.1.b's reconciler flips the row to `ACTIVE` at conversion.
4. **Decide the lead time.** [7, 3, 1] already ships. **Recommendation: keep it
   as-is for annual.** It aligns with `TRIAL_ENDING_REMINDER` (default 3 days,
   `apps/api/src/utils/billing-settings.ts:44`), and 7 days is the owner's own
   suggestion. Adding an annual-specific window (e.g. 30 days for a large debit)
   is a reasonable product call — flag for owner, do not assume.

### 7.4 The promo leak closes itself

`freeTrialDays = base + promo`, one number, decided by us, in ONE transaction.

The summing code **already exists and is already correct** —
`apps/api/src/services/trial.service.ts:247-248` (verified verbatim):

```ts
const baseTrialDays = env.HOSPEDA_TRIAL_DAYS_OVERRIDE ?? planTrialDays;
const trialDays = baseTrialDays + (extraTrialDays ?? 0);
```

It only needs **rerouting**: today it feeds `billing.subscriptions.create({ trialDays })`
(:288-307, no-card); tomorrow it feeds
`createPaidSubscription({ freeTrialDays })` (`paid-subscription-create.ts:54, 128-131`),
which qzpay already maps to `auto_recurring.free_trial`
(`subscription.adapter.ts:179, 196, 248-253`):

```ts
private buildFreeTrial(freeTrialDays: number | undefined): { frequency: number; frequency_type: 'days' } | undefined {
    if (freeTrialDays === undefined || freeTrialDays <= 0) return undefined;
    return { frequency: freeTrialDays, frequency_type: 'days' };
}
```

Note `frequency_type: 'days'` — trial length is expressed in days regardless of
the billing cadence (§7.2's 12-months mapping applies to `auto_recurring`, not to
`free_trial`). The spike's 74-day trial proves there is no cap.

The `HOSPEDA_TRIAL_DAYS_OVERRIDE=0` kill-switch semantics must be preserved: the
base-length guard is evaluated **before** the extension is added
(`trial.service.ts:250-256`), so an extension promo can never resurrect a
disabled trial.

**Per-`effect_kind` precedence is unchanged** (HOS-110 W1 owner decision, already
implemented at `subscription-checkout.service.ts:486-608`):
`comp` wins outright → `trial_extension` lengthens → `discount` yields to the
trial and is discarded with `promoCodeIgnored: true`.

⚠️ **Still open**: extending the trial of someone **already inside** it requires
mutating `free_trial` on a live order. The SPEC-262 spike verified mutating the
**amount**, not the `free_trial`. Unverified — see R-5.

### 7.5 Accounting defense (do this regardless)

From the third Linear comment. The issue's original claim *"MercadoPago has no
native subscription coupons"* is **half false**, and the correction matters.

MP has a merchant discount-campaign system in the panel
(**Configuración → Negocio → Ofrecer Descuentos**): percentage or fixed, date
range, optional spend cap, and two modes — *for all buyers* or *code-gated* (the
latter being the *"Ingresar un cupón"* field visible in MP's subscription
checkout). **The merchant absorbs the cost, not MP.** What remains true: the
**API** has no coupon field — not on `preapproval`, not on `preapproval_plan`.
The engine lives entirely **outside the Subscriptions API surface: panel-only, no
endpoints**. The correct conclusion is not *"it doesn't exist"* but ***"it isn't
in the API"***.

**The risk exists TODAY, whether or not we ever use coupons.** Campaigns are
configured at **account level**, not per product or per checkout. A campaign
created for an unrelated marketing push on the same MP account could apply to a
subscription charge. Then `payment.transaction_amount` arrives **lower** than
what `billing_subscriptions` expects — and **nothing defends against it**:
reconciliation, dunning, and the promo engine (`resolveRenewalPromoEffect`,
`packages/service-core/src/services/billing/promo-code/promo-code.renewal.ts:205`)
all assume *charged == plan price* (or plan price with *our* promo applied). An
externally-applied discount passes under the radar. The detection fields already
exist and nobody reads them: `coupon_amount` + `campaign_id` on the payment;
`COUPON_AMOUNT` in the settlement reports.

> Distinct from MP's bank/marketing *"cuponeras"* (`promociones.mercadopago.com.ar`),
> which are **post-payment cashback** and do **not** touch `transaction_amount`.
> Those do not affect us. The risk is specifically the seller-panel
> "Ofrecer Descuentos", which reduces the gross amount.

**Actions**, in order:

1. **Free, now** (no code): MP panel → Configuración → Negocio → Ofrecer
   Descuentos → confirm Hospeda has **zero campaigns**. If so, today's risk is
   zero and this becomes forward-looking vigilance rather than urgency.
2. **Empirical test** (optional, for a definitive yes/no): create a small
   **code-gated** campaign (ARS 5 off, cap ARS 20, code-gated so it cannot leak
   to real customers) → create a throwaway `preapproval` with `free_trial` +
   ARS 15-30 → open its `/subscriptions/checkout?preapproval_id=` → enter the
   code → inspect the authorized payment for `coupon_amount`/`campaign_id`.
   Nothing is charged during the trial, so this is safe in production. Delete the
   campaign afterward.
3. **IN SCOPE regardless of the outcome of 1 and 2** — a **defensive
   reconciliation check** in the webhook that processes subscription charges:
   compare incoming `payment.transaction_amount` against the expected amount from
   `billing_subscriptions`/`billing_plans`, detect non-null
   `coupon_amount`/`campaign_id`, and **log + alert (Sentry) on mismatch**
   instead of trusting MP's number blindly.

Item 3 is the one that must ship. It covers us against this, against a future
campaign, and against anything else MP does to the amount without telling us. It
is cheap and it does not exist today.

**Explicitly NOT fail-closed**: a mismatch must alert, never reject the payment.
Rejecting money because our expectation is stale is a worse failure than a logged
discrepancy. (Contrast the signup-discount path, which *is* fail-closed —
`subscription-checkout.service.ts:696-704` — because there we are the ones
mutating the amount.)

### 7.6 Addons become hybrid

The one-time code **stays** — a one-time purchase is genuinely one-time.
`apps/api/src/services/addon.checkout.ts` (1043 LOC) keeps `mode: 'payment'`
(Checkout Pro, verified at :403).

**But** addons must *also* support subscription mode. Owner's example: *featured*
could be **time-limited via one-time payment** OR **unlimited via subscription**.
The addon stops being "one-time by definition" and gains a **mode**.

**Impact** (SPEC-292/309):

- `featured_listing_addon_grants`
  (`packages/db/src/schemas/billing/featured_listing_addon_grant.dbschema.ts:20-43`)
  models a grant as `purchaseId → accommodationId` with a UNIQUE on `purchaseId`
  (:35-37) — i.e. one **purchase** → one accommodation. A subscription-mode addon
  has no one-shot purchase row with an expiry; it has a lifecycle. The grant row
  is written at checkout confirmation (`addon.checkout.ts:837-839`) and read by
  the expiry cron (`addon-expiry.job.ts:378-383`), the entitlement service
  (`addon-entitlement.service.ts:193-195`), and the resolver
  (`featured-entitlement.resolver.ts:171-179, 223-231`).
- `syncFeaturedByEntitlementForAccommodation`
  (`packages/service-core/src/services/accommodation/accommodation.sync-featured-by-entitlement.ts`)
  is addon-driven and no-ops on revoke if the owner's plan independently grants
  featuring. A subscription-mode addon adds a **third** grant source, and its
  revoke path is a subscription cancellation, not an expiry tick.

**OQ-2 is OPEN** (§13): which addons go subscription vs one-time. The owner named
*featured*; the full list does not exist. **Do not invent it.** This spec scopes
the mechanism; the catalog is an owner decision that must land before the addon
work is estimated.

### 7.7 Legal — Disposición 954/2025

**Disposición 954/2025** (BO 4-sep-2025) **replaced Res. 424/2020**. It requires,
for any online sale of services:

- **Botón de arrepentimiento** — cost-free revocation within 10 days.
- **Botón de baja** — self-service cancellation.
- Response within 24 hours.

**This applies identically whether the card is collected at the start or the
end** — i.e. **it already applies today**. Card-first does not create this
obligation; it makes an existing gap more visible.

**Audit result** (verified):

| Requirement | Status | Evidence |
| --- | --- | --- |
| Self-service cancellation ("botón de baja") | ✅ **Exists** | `CancelConfirmModal` in `apps/web/src/components/account/SubscriptionDashboard.client.tsx:236`, calls `billingApi.cancelSubscription` (:285); route `apps/web/src/pages/[lang]/mi-cuenta/suscripcion/index.astro`. Gated by `HOSPEDA_USER_CANCEL_ENABLED` — degrades to an email-support path when off (:291-296) |
| **Botón de arrepentimiento** (10-day revocation) | ❌ **Does not exist** | Zero matches for `arrepentimiento`, `revocación`, `botón de baja`, `boton-arrepentimiento` across `apps/web` and `packages/i18n` |
| 24-hour response commitment | ❓ Unverified | Not a code artifact; a process/copy commitment |

Gaps → tasks: build the arrepentimiento flow (button + 10-day window + full
refund + confirmation), and verify the `HOSPEDA_USER_CANCEL_ENABLED` flag is ON
in production (a legally-required button behind a disabled flag is a
non-compliant button).

> ⚠️ **A lawyer must confirm this section before the checkout is finalized.**
> The above is a reading of secondary sources, not legal advice. Do not treat the
> audit table as a compliance sign-off.
>
> Note also: `NewsletterPreferences.client.tsx:356,366` contains an unrelated
> "Cancelar suscripción" string — that is a **newsletter unsubscribe**. Do not
> conflate the two; grepping the copy alone cannot distinguish them.

## 8. 🟡 Model C — the silent-failure trap

`hasTrial` / `trialDays` are the **commercial** layer (**the DB wins**) since
HOS-39. Verified — `packages/billing/src/config/model-c-field-split.ts`:

```ts
'metadata.hasTrial': 'commercial',    // :178
'metadata.trialDays': 'commercial',   // :185
```

**Editing `packages/billing/src/config/plans.config.ts` alone NEVER reaches
staging or production.** A fresh DB seeds correctly; an already-seeded
environment silently ignores the change. **Every local test passes.** This is the
worst failure shape available: green CI, no effect in production.

Any change to a plan's trial configuration **requires a numbered seed
data-migration**, in the same PR (the mandatory seed dual-write rule). Verified:
the highest existing migration is
`packages/seed/src/data-migrations/0014-hos-43-occupancy-permissions.ts`, so the
**next number is 0015**.

Template to copy: `packages/seed/src/data-migrations/0006-owner-test-daily-trial.ts`
(94 LOC) — targets one `billing_plans` row by `name` (:64), JSONB-merges via
`jsonb_build_object` (:74), and guards with an **OR-PRESERVE** `WHERE` (:78-84)
so a prior operator edit is never clobbered. `meta.destructive = false` (:60).

## 9. Data model / contracts

**No new tables. No new columns.** Everything needed already exists.

| Artifact | Change |
| --- | --- |
| `billing_subscriptions.trial_start` / `.trial_end` | **Unchanged.** qzpay already writes both on `mode:'paid'` (`drizzle-storage.adapter.ts:347-348, 373-374`) |
| `billing_subscriptions.status` | **Unchanged.** `trialing` survives as a value; only its *derivation point* moves |
| `billing_subscriptions.current_period_end` | Must be maintained for annual preapprovals (§7.3 item 1) — anchor for `RENEWAL_REMINDER` |
| `VALID_TRANSITIONS` | **+1 edge**: `PENDING_PROVIDER → TRIALING` (`subscription-status-transitions.ts:72-77`) |
| `QZPAY_TO_HOSPEDA_STATUS` | **Unchanged** (`subscription-logic.ts:98-105`) — stays a static map; derivation happens after it |
| `billing_plans.metadata.hasTrial/.trialDays` | Values may change → **data-migration 0015 required** (§8) |
| `featured_listing_addon_grants` | Needs a mode concept for subscription-addons — **shape blocked on OQ-2** |
| `POST /api/v1/protected/billing/trial/start` | **Deleted** (`apps/api/src/routes/billing/trial.ts:150-219`) |
| `GET /billing/trial/status` | **Kept** (`trial.ts:108-141`) — the read layer survives |
| `CheckoutAppliedEffect` | `'trial'` variant deleted from the union (`subscription-checkout.service.ts:382`); `'comp'`/`'discount'` stay |

## 10. Deleted code — VERIFIED, with corrections

The issue estimates ~650 LOC. **Several of its per-item numbers are wrong.** Each
row below was measured. Corrections are called out explicitly — the total is real
but its composition is not what the issue claims.

| What | Issue's claim | **Verified** | Evidence |
| --- | --- | --- | --- |
| `TrialService.startTrial()` | ~145 | ✅ **145** | `trial.service.ts:197-341` |
| `POST /trial/start` | ~70 | ✅ **70** | `routes/billing/trial.ts:150-219` |
| `blockExpiredTrials` (~150 of 289) | ~150 of 289 | ⚠️ **289 total, but INVERTED not deleted** | `trial.service.ts:537-825`. See §7.1.b — this is a rewrite, not a deletion |
| `create-annual-subscription.ts` | — | ✅ **406** | whole file; 2 importers (`subscription-checkout.service.ts:43`, `trial.service.ts:43`) |
| HOS-123 (annual reactivation) | dies | ✅ dies | Owner-confirmed via OQ-1 |
| `appliedEffect==='trial'` sentinel | ~40 | ❌ **~0 net** | `PlanPurchaseButton.client.tsx:727-736` — trial is **fused with comp** in one OR condition (`=== 'trial' \|\| === 'comp'`). Removing trial deletes **no line**; comp needs the identical block. Splitting it would *add* lines |
| `success.astro` trial branch | ~30 | ❌ **~10** | `apps/web/src/pages/[lang]/suscriptores/checkout/success.astro:43, 58-60, 62-67` |
| `PublishButton` trial UX | ~150 | ❌ **~41-45** | `apps/web/src/components/host/PublishButton.client.tsx:75, 103-105, 170-173, 223-257` (file is 341 LOC) |
| `billingApi.reactivateSubscription` "already dead code" | ~40, dead | ⚠️ **Dead in web ONLY** | Defined `apps/web/src/lib/api/endpoints-protected.ts:657`; called **only by its own test** (`apps/web/test/lib/api/endpoints-protected.test.ts:24,33,45`). But the **API route and service are LIVE**: `routes/billing/trial.ts:495` + `trial.service.ts:1154`. Deleting the web wrapper is free; deleting the backend is a separate, real decision |
| `TRIAL_EXPIRED` (type + template + subject) | ~30 | ⚠️ **~140** | Template `packages/notifications/src/templates/trial/trial-expired.tsx` is **138 LOC**; plus enum (`notification.types.ts:15`), subject (`subject-builder.ts:18`), category (`notification-categories.ts:20`) |
| 402 middleware | stays, stops firing | ⚠️ **stays, and MUST be fixed** | `middlewares/trial.ts` needs no edit, but `getTrialStatus:447` does — §7.1.a |

**Preserved**: the "one trial per customer, for life" guard. Today it is
`startTrial`'s any-subscription check (`trial.service.ts:259-271`), backed by the
checkout's first-layer short-circuit (`subscription-checkout.service.ts:539-540`,
and the annual mirror at :1207-1208). When `startTrial` dies, **the guard moves
to the checkout call site** and becomes the single authoritative gate. It is
**not** lost. Note today's comment explicitly calls `startTrial` the
"AUTHORITATIVE eligibility gate" (:564-569) and the checkout check a "cheap
first-layer short-circuit" — that relationship inverts, and the new single gate
must be race-safe on its own (it no longer has a second checker behind it).

## 11. Acceptance criteria

**AC-1 — Trial is derived, not stored at creation**
Given a trial-eligible customer checks out on a plan declaring `hasTrial: true, trialDays: 14`
When they complete authorization on MercadoPago and the `subscription_preapproval.updated` webhook arrives with qzpay status `active`
Then the local subscription status is **`trialing`**, `trialEnd` is ~14 days out, and no `TRIAL_EXPIRED`-style policing row is created.

**AC-2 — Abandonment grants nothing**
Given a trial-eligible customer reaches MercadoPago's authorization page
When they abandon it without authorizing
Then the local subscription stays `incomplete`, grants **zero** entitlements, and `abandoned-pending-subs.job.ts` reaps it to `abandoned` within 30 minutes.

**AC-3 — `trialEnd` null or past never derives `TRIALING`**
Given a `subscription_preapproval.updated` webhook maps to `ACTIVE`
When the local `trialEnd` is `null`, or is in the past
Then the derived status is **`ACTIVE`** (unchanged), and no trialing state is entered.

**AC-4 — The state machine permits the new edge**
Given a subscription in `pending_provider`
When the derived target status is `trialing`
Then `checkSubscriptionStatusTransition` returns valid and the write commits (today it returns invalid — `subscription-status-transitions.ts:72-77`).

**AC-5 — A converted customer is NOT locked out** *(regression guard for §7.1.a)*
Given a card-first subscription whose `trialEnd` is in the past and whose status is `active`
When the customer issues any write request
Then the request **succeeds** — `getTrialStatus().isExpired` is `false` and `middlewares/trial.ts` does not throw 402.

**AC-6 — The reconciler converts, it does not cancel** *(regression guard for §7.1.b)*
Given a local `trialing` subscription whose `trialEnd` has passed and whose MercadoPago preapproval is `authorized`
When the trial reconciler cron runs
Then the subscription transitions **`trialing → active`** and is **never cancelled**, and no `TRIAL_EXPIRED` notification is sent.

**AC-7 — A failed first charge goes past_due, not cancelled**
Given a local `trialing` subscription whose `trialEnd` has passed and whose day-N charge failed
When the trial reconciler runs
Then the subscription transitions to **`past_due`** and the existing dunning cron owns it from there.

**AC-8 — The 74-day leak is closed**
Given a trial-eligible customer applies a `trial_extension` promo granting 60 extra days at checkout on a plan with `trialDays: 14`
When the preapproval is created
Then **exactly one** `free_trial` of **74 days** is sent to MercadoPago, and the customer receives **74** free days total — not 14 + 74.

**AC-9 — The kill-switch still wins**
Given `HOSPEDA_TRIAL_DAYS_OVERRIDE=0`
When a trial-eligible customer applies a `trial_extension` promo and checks out
Then **no trial is granted** and the customer is charged immediately (the base-length guard precedes the extension).

**AC-10 — One trial per customer, for life, survives**
Given a customer with ANY prior subscription (any status, any product domain, including cancelled)
When they check out on a trial-declaring plan
Then **no trial is granted** and they go to the normal paid preapproval.

**AC-11 — Annual is a recurring preapproval**
Given a customer checks out on the annual toggle
When the preapproval is created
Then it carries `frequency: 12, frequency_type: "months"`, no Checkout Pro one-time charge is created, and `create-annual-subscription.ts` is not invoked (it no longer exists).

**AC-12 — Annual pre-renewal notice fires**
Given an `active` annual subscription whose `currentPeriodEnd` is 7 days away
When `notification-schedule.job.ts` runs
Then exactly one `RENEWAL_REMINDER` is sent, carrying the correct renewal date and amount.

**AC-13 — A trialing sub gets no renewal reminder**
Given a `trialing` subscription
When `notification-schedule.job.ts` runs
Then **no** `RENEWAL_REMINDER` is sent (`TRIAL_ENDING_REMINDER` owns that window).

**AC-14 — Amount mismatch alerts, never rejects**
Given an incoming subscription payment whose `transaction_amount` is lower than the plan price for that subscription (e.g. carrying a non-null `coupon_amount`/`campaign_id`)
When the webhook processes it
Then the payment is **accepted**, and a discrepancy is logged and reported to Sentry with the expected vs actual amount and the `campaign_id`.

**AC-15 — Commercial fields reach production**
Given a change to any plan's `metadata.hasTrial` / `metadata.trialDays`
When the change is deployed
Then a numbered seed data-migration (0015+) applies it to already-seeded environments, and editing `plans.config.ts` alone is proven insufficient by an integration test.

## 12. Test plan

**Verified current surface** (corrects the issue's estimate):

| Metric | Issue's claim | **Verified** |
| --- | --- | --- |
| Test files matching `trialing\|startTrial\|blockExpiredTrials` | 84 | **68** |
| Files staying green | ~60 (~71%) | **58 (~85%)** |
| Files needing a real rewrite | ~24 | **10** |
| Playwright `.spec.ts` specs touching trial | not counted | **9** (a separate surface — the grep pattern only matched `.test.ts`/`.test.tsx`) |

Repo-wide there are **3163** test files, so the trial surface is ~2.15% of the
total. **The design's central cost-saver holds and is better than claimed**:
because `trialing` survives as a status, 58/68 files only consume it as a
fixture value and never touch how a trial is created.

**The 10 files needing real rewrites** (they call `startTrial` / `POST /billing/trial/start` / assert the no-MP-object contract):

1. `apps/api/test/services/trial.service.test.ts` (2849 LOC, 78 matches — the primary `startTrial` unit suite)
2. `apps/api/test/e2e/flows/billing/trial-lifecycle.test.ts` (835 LOC — POSTs `/billing/trial/start`)
3. `apps/api/test/integration/trial-lifecycle.test.ts` (597 LOC — calls `service.startTrial()`)
4. `apps/api/test/e2e/flows/owner/registration-trial.test.ts` (822 LOC)
5. `packages/service-core/test/services/accommodation/publish.test.ts` (746 LOC)
6. `apps/api/test/services/accommodation-publish-deps.test.ts` (442 LOC)
7. `packages/service-core/test/services/accommodation/update-publish-routing.test.ts` (449 LOC)
8. `apps/api/test/e2e/flows/billing/trial-vs-pay-checkout.test.ts` (419 LOC)
9. `apps/api/test/e2e/flows/billing/annual-trial-checkout.test.ts` (244 LOC — asserts *"via `TrialService.startTrial()`, NO MercadoPago object created"*, i.e. exactly the deleted behavior)
10. `apps/api/test/services/subscription-checkout-promo-branches.test.ts` (977 LOC — asserts the `appliedEffect==='trial'` branch)

**Borderline (1)**: `apps/api/test/webhooks/subscription-logic.test.ts` (2728 LOC)
mocks qzpay's `.get()` returning `status: 'trialing'` directly. Post-redesign
qzpay reports `active` and `trialing` is derived — the **arrange** step needs a
tweak (`status: 'active'` + future `trialEnd`); assertions are unchanged. Counted
as green, but call it out rather than silently bucketing it.

**New tests required:**

- Unit, pure: `deriveTrialingStatus` — the full §7.1 truth table (future/null/past
  `trialEnd` × every `mappedStatus`), clock injected.
- Unit: `getTrialStatus.isExpired` is status-aware — **AC-5 regression guard**
  (active + past `trialEnd` ⇒ `isExpired === false`).
- Unit: `VALID_TRANSITIONS` includes `PENDING_PROVIDER → TRIALING` — AC-4.
- Unit: the trial reconciler converts (`authorized` ⇒ active), mirrors cancel,
  and routes a failed charge to `past_due` — **AC-6/AC-7 regression guards. These
  are the most important new tests in the spec**: without them, a reconciler that
  still cancels passes every other test in the suite.
- Integration: `freeTrialDays = base + promo` reaches the MP create body as ONE
  value — AC-8; and `HOSPEDA_TRIAL_DAYS_OVERRIDE=0` suppresses it — AC-9.
- Integration: annual create body carries `frequency: 12, frequency_type: "months"` — AC-11.
- Integration: amount-mismatch alerting is non-blocking — AC-14.
- Seed integration: migration 0015 OR-PRESERVE + idempotency — AC-15.
- E2E/Playwright: rework `apps/e2e/tests/host/host-02-trial-upgrade-mp.spec.ts`
  and `host-03-trial-expired.spec.ts` (both drive the no-card flow end-to-end).

**Deleted tests**: the `POST /trial/start` route suites and the no-MP-object
assertions die with the code they cover. Deleting a test is a reviewable act —
each deletion must be justified in the PR, not bundled.

## 13. Rollout

**Pilot: `owner-test-daily`.** `hasTrial: true, trialDays: 1`
(`plans.config.ts:667-668`), gated by `HOSPEDA_SHOW_TEST_BILLING_PLAN`, enforced
at the single choke point `resolvePlanBySlug`
(`subscription-checkout.service.ts:183-185`). A **1-day trial means the real
day-N charge is observable TOMORROW** — a purpose-built canary for the one thing
that cannot otherwise be tested for a year.

🔴 **Commerce and partner are NOT viable pilots.** Both declare `hasTrial: false`
(`plans.config.ts:544` commerce-listing, `:568` partner-listing) — there is no
trial path to exercise. Verified; do not substitute them.

Order:

1. `owner-test-daily` behind `HOSPEDA_SHOW_TEST_BILLING_PLAN`. Observe the real
   day-2 charge. **Gate: the charge lands, `trialing → active` fires, and the
   customer is not locked out (AC-5/AC-6).**
2. `owner-basico` (14-day trial). Observe day-15.
3. `owner-pro`, `owner-premium` (`plans.config.ts:150-151, 200-201`).
4. Annual, last — its renewal is unobservable for 12 months, so it ships on the
   strength of the monthly evidence plus the `owner-test-daily` canary.

Each step needs its data-migration (§8) — `hasTrial`/`trialDays` are DB-wins.

**Smoke labels**: this is billing CORE → `status-needs-smoke-staging` **and**
`status-needs-smoke-prod`. Both prod and staging smoke checklists apply
(project `CLAUDE.md` → billing testing), and the MP sandbox is unreliable, so the
`owner-test-daily` canary is the real gate.

## 14. Risks

- 🔴 **R-1 — The reconciler inversion (§7.1.b).** If `blockExpiredTrials` ships
  unmodified, every converting customer is cancelled at the moment they start
  paying. Existing tests **pass** in that scenario because they assert today's
  semantics. Mitigation: AC-6/AC-7 as explicit regression guards, written before
  the change.
- 🔴 **R-2 — The lockout (§7.1.a).** `getTrialStatus:447` locks out every
  converted customer with a 402. Mitigation: AC-5, written before the change.
- 🔴 **R-3 — Annual renewal is untestable for a year.** Mitigation:
  `owner-test-daily` (§13). Commerce/partner cannot substitute.
- 🔴 **R-4 — Annual chargebacks.** A large, surprising debit at 12 months.
  Mitigation: §7.3 (owner-mandated, non-negotiable).
- 🟡 **R-5 — Extending a live trial is unverified.** Extending someone already
  inside their trial requires mutating `free_trial` on a live order. The SPEC-262
  spike verified mutating the **amount**, not `free_trial`. Mitigation: spike it
  before committing to mid-trial extension; the signup-time path (§7.4) is
  verified and unaffected.
- 🟡 **R-6 — Model C silent failure (§8).** Green CI, zero production effect.
  Mitigation: data-migration 0015 + AC-15.
- 🟡 **R-7 — MP checkout fragility.** Switching MP accounts mid-checkout
  **permanently poisons** the order (dead confirm button, then "no pudimos
  procesar tu pago" on every method). Recovery requires a **new** preapproval.
  SPEC-122 sub-decision 2 already handles this (each retry creates a new local
  sub UUID).
- 🟡 **R-8 — The installments selector.** During the spike MP's subscription
  checkout showed *"No pudimos acceder al detalle de cuotas disponibles para tu
  tarjeta"* and the **Confirm button was disabled at one point**. A real customer
  who lands there leaves, and we see only another abandoned `pending` — **money
  lost silently**. The owner also reports MP statistics showing these as *"Ventas
  en cuotas — Sin interés"*, and that **this did not happen with Hospeda's real
  plans**.

  Diff between the spike's hand-rolled body and qzpay's `buildCreateBody`
  (`subscription.adapter.ts:172-209`), verified:

  | Field | qzpay | spike |
  | --- | --- | --- |
  | `payer: { email, first_name, last_name }` | ✅ full object (:183) | ❌ `payer_email` only |
  | `notification_url` | ✅ (:204-206) | ❌ |
  | `status` | **❌ never sends it** | ⚠️ sent `"pending"` |

  **Prime suspect: `status`** — counter-intuitively, the spike sent an **extra**
  field, not a missing one. qzpay omits it entirely and lets MP decide. Forcing
  `"pending"` may alter the flow MP renders, which would explain why testing with
  real plans (via qzpay) behaved differently. **Neither sends anything about
  installments** — no `payment_methods_allowed` in either. If MP offers
  installments, that is MP's own choice.

  **Alternative hypothesis (unconfirmed)**: in Argentina MP classifies every
  credit-card sale by installment count and reports "1 cuota" as *"cuotas sin
  interés"* — possibly statistical noise, not a real problem. Could not be
  distinguished from the dashboard.

  **To verify at implementation**: (1) reproduce the checkout with qzpay's
  **exact** body (full `payer`, `notification_url`, **no** `status`) + `free_trial`
  and see whether the installments error disappears; (2) if it persists, try
  `payment_methods_allowed` to skip the selector; (3) **isolate the untested
  variable** — confirm whether a subscription checkout **with** `free_trial`
  behaves differently from one without. The spike only tested *with* a trial;
  every historical Hospeda test was *without* (today's trial is no-card and never
  reaches MP). **That is the variable nobody has isolated.**
- 🟡 **R-9 — Accounting drift from MP panel campaigns (§7.5).** Mitigated by the
  defensive check, which ships regardless.
- 🟢 **R-10 — No real users** (owner-confirmed) → no legacy `trialing` row
  migration. Re-validate before implementation; if false, this becomes a blocker.

## 15. Open questions

- **OQ-1 — Does annual auto-renew?** ✅ **RESOLVED** (owner, 2026-07-15). Yes,
  with a mandatory pre-renewal notice. See §7.3. **HOS-123 is formally dead.**
- **OQ-2 — Which addons are subscription vs one-time?** ❌ **OPEN.** The owner
  named *featured* (limited = one-time / unlimited = subscription). The full list
  does not exist. **Blocks the §7.6 addon work** — the `featured_listing_addon_grants`
  shape cannot be designed against an unknown catalog. Do not invent the list.
- **OQ-3 — Annual pre-renewal lead time.** [7, 3, 1] already ships
  (`notification-schedule.job.ts:45`). Recommendation: keep as-is. An
  annual-specific longer window (e.g. 30 days for a large debit) is a defensible
  product call — owner decides.
- **OQ-4 — Does MP's subscription checkout run the panel discount engine?**
  Unresolved by documentation (MP ties "Ofrecer Descuentos" to Checkout Pro /
  Checkout API, never to Suscripciones, despite the shared visual component).
  §7.5 item 2 is the empirical test. **The §7.5 item 3 defensive check ships
  regardless of the answer.**
- **OQ-5 — Delete the backend reactivation route?** `billingApi.reactivateSubscription`
  is dead **in web only**; the route (`routes/billing/trial.ts:495`) and service
  (`trial.service.ts:1154`) are live. With annual auto-renewing, is
  `reactivateSubscription` still reachable for any flow, or does it die too?
  Deleting a live route is a separate decision from deleting a dead web wrapper.

## 16. Implementation notes

### Decisions this reverts (with justification)

- **SPEC-122 decision 2** (annual = one-time Checkout Pro). Its only written
  justification was *"Reuses the pattern of `addon.checkout.ts`"* — code
  convenience. Compare decision 1 (monthly → preapproval), which lists three
  substantive reasons. **There was never a product decision that annual should
  not auto-renew.**
- **SPEC-122 sub-decision 1** already said *"Each preapproval defines its own
  monthly amount + frequency + **free_trial** inline at creation time"* — this was
  **in the original design** and drifted. We are returning, not innovating.
- **HOS-115** (no-card trial on annual): its premise falls.
- **ADR-009** (trial HOST-only): **no revision needed** — a one-line addendum.
- **HOS-110** (unify the no-card trial): **not thrown away — it is what makes
  this cheap.** It collapsed the duplicated paths into one function and 2-3 call
  sites. We rewrite `startTrial`'s guts; we do not hunt it across N surfaces.
  ⚠️ It is merged but Linear still has it In Review with unresolved smokes.

### Corrections to the Linear issue (verified)

The issue is strong on direction and unreliable on specifics. Verified deltas:

| Claim | Reality |
| --- | --- |
| `PlanPurchaseButton` trial sentinel ~40 LOC | ~0 net — fused with `comp` at :727-736 |
| `success.astro` trial branch ~30 LOC | ~10 LOC |
| `PublishButton` trial UX ~150 LOC | ~41-45 LOC |
| `TRIAL_EXPIRED` ~30 LOC | ~140 LOC (138-LOC template) |
| `billingApi.reactivateSubscription` "already dead code" | Dead in **web only**; API route + service are live |
| Pre-renewal notice = "code that's ADDED" | `RENEWAL_REMINDER` **already exists and already dispatches** at [7,3,1] |
| `subscription-poll.job.ts` "already retrieves `next_payment_date` every minute" | Calls `retrieve()`, but **nothing reads** `next_payment_date` (0 matches in 919 LOC) |
| 84 test files, ~60 stay green | **68** files, **58** stay green (~85%) — plus 9 uncounted Playwright specs |
| `blockExpiredTrials` "stays as a backstop" | Must **invert** or it cancels every converting customer (§7.1.b) |
| `middlewares/trial.ts` "doesn't change a line" | True for the middleware; **false** for `getTrialStatus:447` (§7.1.a) |
| `trial.service.ts:247-248` base+promo sum exists and is correct | ✅ **Verified verbatim** |
| qzpay `toMercadoPagoInterval` maps year → 12 months | ✅ **Verified** (:241-242) |
| `drizzle-storage.adapter.ts:364` is a deliberate guard | ✅ **Verified** (comment :350-363) |
| Commerce/partner unusable as pilots (`hasTrial: false`) | ✅ **Verified** (:544, :568) |

### Estimate

The issue's **17-24 dev-days** (~3.5-5 calendar weeks, one person, ~60%
confidence) covers the derive-in-webhook core. For comparison: touching qzpay was
21-30 days **and shipped the bug**; a parallel "active-with-first-charge-pending"
concept was 30-42.

Adjustments from this spec's verification:

- **Down**: the web deletions are much smaller than claimed, the test surface is
  68 not 84 with a *higher* green fraction, and the pre-renewal notification is
  mostly built.
- **Up**: two unbudgeted **critical** items — the `getTrialStatus` lockout fix
  (§7.1.a) and the `blockExpiredTrials` inversion (§7.1.b, a rewrite of a 289-LOC
  concurrency-sensitive cron, not a deletion) — plus the §7.5 accounting check and
  the §7.7 arrepentimiento flow (net-new, legally required, currently absent).

**Net: the core stays in the 17-24 range.** Annual and hybrid addons sit on top
and **cannot be estimated until OQ-2 resolves**.

### Related

- **HOS-166** (commerce self-checkout) — **not blocked**: 166 ships without a
  trial (`commerce-listing` has `hasTrial: false`) and gains one additively when
  this lands.
- **SPEC-262** (promo effect engine) — its AC-3.3 was closed by this spike.
- `packages/service-core/src/services/billing/promo-code/docs/mp-preapproval-mutation-spike.md`
  — the June spike whose open item this closes.
- **⚠️ MercadoPago has no native subscription coupons in the API** — re-verified
  field by field. The seller "coupons" in the docs are **MercadoLibre marketplace**
  (`api.mercadolibre.com/seller-promotions`: operate on listings, require a
  green-reputation seller, **Brazil only**). But the panel-level discount engine
  is real and account-scoped — see §7.5.

## 17. Linear

Canonical tracking:
[HOS-171](https://linear.app/hospeda-beta/issue/HOS-171/unificar-billing-en-preapproval-trial-nativo-de-mercadopago-card-first)
