---
title: Hospeda-owned free trial — no card, own clock, starts at publish
linear: HOS-1012
statusSource: linear
created: 2026-09-01
type: feature
areas:
  - api
  - web
  - billing
  - db
---

# Hospeda-owned free trial — no card, own clock, starts at publish

## 1. Summary

The free trial stops being MercadoPago's and becomes a Hospeda state again. No card is
collected on day 1, no preapproval is created, and **MercadoPago is never told that a
trial exists**. It enters the picture only when the person decides to pay.

This implements the owner decision recorded on HOS-956 (Option A) and reverses the core
of HOS-171's card-first design. It does **not** reverse HOS-937: that work is the real
payment path and is needed either way.

## 2. Why — three measured facts

**2.1 MercadoPago grants a preapproval's `free_trial` once per `(payer, preapproval_plan)`
and reports a spent trial identically to a live one.** Measured 2026-08-31 against the
live API, two preapprovals for the same payer on the same plan, created two seconds apart:

| field | 1st | 2nd |
| -- | -- | -- |
| `auto_recurring.free_trial` | `{frequency: 30, frequency_type: 'days'}` | **identical** |
| `first_invoice_offset` | `30` | **identical** |
| `next_payment_date` | `2026-09-29` (+30 days) | creation instant |

Hospeda decides eligibility per `billing_customers.id`. Two criteria over two different
subjects, with nothing reconciling them. Cost already paid: **ARS 18.000 charged 118
seconds after promising 14 free days**, in production, 2026-08-14 (HOS-522).

**2.2 HOS-937 does not fix this.** The new path still resolves and passes
`providerPriceId` (`subscription-checkout.service.ts:571,643,893,985,1203,1267`), so it
still subscribes against a **shared `preapproval_plan`**. The `(payer, preapproval_plan)`
limit survives `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` untouched. Turning the flag on
fixes the `external_reference` correlation; the trial stays exactly as broken.

**2.3 There is almost no production traffic to measure against — but it is not zero.**
`billing_subscriptions` in production holds **7 rows total** — 2 `comp`, 2 `trialing`,
3 `abandoned`, from 2026-07-24 to 2026-08-28 — and `billing_subscription_events` holds 2
rows, both `WEBHOOK_SUBSCRIPTION_TRIALING`, with **zero**
`TRIAL_NOT_GRANTED_BY_PROVIDER`. The abandonment rate, conversion rate and abuse rate
HOS-956 asked for cannot be collected today. The decision rests on the structural
argument, and is recorded as such.

> **CORRECTION (2026-09-01).** An earlier revision of this section called all seven rows
> owner test data. **The two `trialing` rows are real customers** — confirmed by the owner,
> who knows them personally. Both were created 2026-08-27 and both hold a live MercadoPago
> preapproval:
>
> | customer | trial window | length |
> | -- | -- | -- |
> | `peychauxchristian@gmail.com` | 2026-08-27 → **2026-09-26** | 30 days |
> | `pri.laupc@hotmail.com` | 2026-08-27 → **2026-11-25** | 90 days |
>
> The 90-day window is not the standard one and its origin is unexplained (annual plan? a
> `trial_extension` promo?) — worth resolving before either is touched. See OQ-3, now
> decided.

**The argument that settled it**: keeping MercadoPago's trial — whether by moving the
clock (Option B) or by dropping the shared plan (Option C) — keeps betting on a mechanism
that has already lied *undetectably* with real money. Removing the trial from MercadoPago
does not mitigate that risk, it deletes it: if we never ask for a `free_trial`,
MercadoPago cannot lie about one.

## 3. Product decisions

All four are decided; they are not open questions.

**D-1 · The clock starts at PUBLISH, not at signup.** The "Publish" button starts the
trial and publishes, in one gesture. The window begins when the person gets real value —
their accommodation visible — not when they create an account.

Rationale: HOS-623 (five hosts loaded a listing last month, none published). With a
signup-anchored clock that same person burns 20 of 30 days fighting with photos and
reaches publish with 10 left.

**D-2 · One trial per PRODUCT DOMAIN, not one per account for life.** Someone who spent
their accommodation trial starts clean when they enter gastronomy. Eligibility is keyed on
`(customerId, productDomain)`.

Rationale: in a market of 22 destinations the same people own the cabin *and* the
restaurant. This is also exactly the bug HOS-931 reported, which this spec absorbs.

**D-3 · At expiry the listing is UNPUBLISHED and the data is left intact.** It leaves the
site; everything loaded (photos, texts, prices) stays in the panel and comes back online
the moment they pay. No degraded rendering mode, no read-only panel.

**D-4 · Nine emails**, three before and five after (§4), and the whole series stops the
moment they pay.

## 4. The email series

**Before expiry** — three, with deliberately different copy:

| When | Tone | What it says |
| -- | -- | -- |
| T−10 days | Friendly, no selling | An invitation: is it working for you? how is it going? need a hand? |
| T−5 days | Friendly, but warning | Little time left, the listing is at risk of being unpublished |
| T−1 day | Direct | If you do not pay, tomorrow it comes down |

**After expiry** — five win-back emails at **+1, +5, +10, +30 and +60 days**. Nothing is
sent after day 60.

Two invariants:

- **The series stops entirely the moment the person pays.** Every send must re-check
  live subscription state, never a snapshot taken when the send was scheduled.
- **Every send is idempotent per `(customer, type, offset)`.** The existing
  `generateIdempotencyKey(type, customerId, daysAhead)` in `notification-schedule.job.ts`
  already has the right shape; the offset must be part of the key or a re-run double-sends.

Current state to change: the job sends `TRIAL_ENDING_REMINDER` at **3 and 1** days
(`notification-schedule.job.ts:8-9`). That becomes 10, 5 and 1, with three distinct
templates instead of one reused three times.

## 5. What is preserved, retired and rebuilt

**Preserved — do not touch.** All of HOS-937: the per-user preapproval, `external_reference`
in the POST body, `mp_subscription_id` written before the redirect, the payer-email screen,
the two recoveries. That is the paid path and it is needed with or without a trial.

**Retired.** Everything that exists to cope with MercadoPago's trial lying:

| File / unit | Why it goes |
| -- | -- |
| `trial-window-derivation.ts` (HOS-936) | Nothing to derive: we never ask MP for a trial |
| `trial-promise-verification.ts` (HOS-522) | No promise is delegated, so none can be broken |
| `scripts/check-trial-not-derived-from-free-trial.sh` | Guards a rule about a field we stop reading |
| The pre-checkout trial warning dialog (HOS-522) | It warned about a condition that no longer exists |
| `BILLING_EVENT_TYPES.TRIAL_NOT_GRANTED_BY_PROVIDER` | Unreachable |
| `freeTrialDays` reaching MercadoPago | See G-1 |

**Rebuilt.** HOS-171 deleted more than the notes suggested — verify before estimating:

- `TrialService.startTrial()` — **gone**, deleted as planned.
- `blockExpiredTrials` — **gone**, replaced by `reconcileExpiredTrials`
  (`trial.service.ts:602`). Only the constants kept the old name:
  `BLOCK_EXPIRED_TRIALS_LOCK_KEY` (advisory lock `1004`) and
  `BLOCK_EXPIRED_TRIALS_BATCH_SIZE` (200). The lock and batching **are** reusable; the
  behavior is not — `reconcileExpiredTrials` mirrors a provider verdict, and there is no
  provider to mirror anymore.
- `TRIAL_EXPIRED` notification type + template + subject — **gone**, must return.

**Still standing and reusable — this is what keeps the cost down:**

| Unit | Where | Role in the new design |
| -- | -- | -- |
| `trialMiddleware` (330 lines) | `middlewares/trial.ts:118`, mounted globally in `create-app.ts` | The 402 gate. Reads local `trial_end`; unchanged in shape |
| `TrialService.getTrialStatus` | `trial.service.ts:239` | Already answers from the local row |
| `TrialService.checkTrialExpiry` | `trial.service.ts:522` | Already local-only |
| `TrialService.findTrialsEndingSoon({daysAhead})` | `trial.service.ts:1502` | Exactly what T−10/−5/−1 needs |
| `TrialService.extendTrial` | `trial.service.ts:959` | `trial_extension` promo codes keep working |
| `buildTrialUpgradeUrl` | `trial.service.ts:126` | The conversion nudge URL |
| `NotificationType.TRIAL_ENDING_REMINDER` | `notification.types.ts:14` | One of the three pre-expiry mails |
| `billing_subscriptions.trial_start` / `trial_end` | DB | The clock itself. No migration needed |
| `billing_subscriptions.product_domain` | DB | D-2's eligibility key. No migration needed |

**Dead code found while surveying, retire alongside:** `requireActiveSubscription()`
(`middlewares/trial.ts:276`) is exported and mounted **nowhere** —
`utils/entitlement-cause.ts` already documents it as "NOT mounted anywhere today".

## 6. Design

### 6.1 What a trial subscription IS

A `billing_subscriptions` row with `status = 'trialing'`, **`mp_subscription_id = NULL`**,
`trial_start`, `trial_end`, `plan_id` and `product_domain`. No MercadoPago object exists.

This shape is **not new and does not need to be invented**: `status = 'comp'` (SPEC-262)
is already a subscription with `mp_subscription_id = NULL`, created by a direct DB insert
in `apps/api/src/services/subscription-comp-create.service.ts`, and `loadEntitlements`
already treats it as entitlement-granting via `isEntitlementGrantingStatus`. A `trialing`
row with a NULL provider id is the same shape plus an end date. Model the creator on the
comp creator, not on the checkout.

Consequence worth stating: `isEntitlementGrantingStatus` already includes `trialing`, so
**entitlement resolution needs no change at all**. The trial grants the plan's
entitlements the same way it does today.

### 6.2 Where the clock starts — D-1

The seam already exists and is documented in place.
`AccommodationService.publish` (`packages/service-core/src/services/accommodation/accommodation.service.ts:1795`)
runs a subscription wall of its own — `this._publishDeps.checkEligibility(ownerId, ctx)` —
**before** the completeness guard, deliberately (H-99: a missing subscription is the one
rejection a host cannot resolve by editing, so they should see it first).

That same block's comment records what used to be there:

> `first_publish` used to grant a no-card trial right here, mid-publish, so the owner went
> live without ever seeing a checkout. Card-first has no such thing.

**D-1 restores `first_publish`.** It is not a new mechanism: it is the eligibility reason
that already had a name, a call site and a test surface before HOS-171 removed it. Recover
the deleted implementation from git history rather than re-deriving it.

Two properties this must keep:

- **The draft phase stays free and untimed.** A host with no subscription resolves
  `owner-basico` draft defaults (`entitlement.ts:285`, `getBySlug('owner-basico')`) so they
  can build the listing for as long as they need. The clock does not run.
- **Publish and trial-start are one transaction.** A publish that succeeds while the trial
  insert fails leaves a live listing with no clock — permanently free. A trial that starts
  while publish fails burns days for nothing. Both writes commit together or neither does.

There is **no live hole today**: `checkEligibility` already rejects a host with no
subscription, so nobody publishes for free while this is being built.

### 6.3 Eligibility per product domain — D-2

Today `hasAnyPriorSubscription` (`trial-eligibility.service.ts:236`) reads
`billing.subscriptions.getByCustomerId(customerId)` and treats **any** prior authorized
subscription as consuming the trial, across every vertical. That is HOS-931.

The rule becomes: a prior subscription consumes the trial **only for its own
`product_domain`**. Reuse `subscriptionMatchesDomain()`
(`packages/service-core/src/services/billing/subscription/subscription-product-domain.ts`)
— per CLAUDE.md it is the only place in the codebase allowed to compare a subscription's
domain, and it reads asymmetrically on purpose (`accommodation` fails open because the
column post-dates most rows; every other domain fails closed).

Keep the existing exclusion of `pending_provider` / `abandoned` rows exactly as is
(HOS-230): opening and backing out of a checkout must not consume eligibility. Its
`anyCancelledSubscriptionWasAuthorized` history lookup stays too.

### 6.4 At expiry — D-3

A daily job claims `trialing` rows whose `trial_end` has passed and, per row:

1. Transitions the subscription to a terminal expired state.
2. **Unpublishes the owner's accommodations** (`lifecycleState` → the non-ACTIVE state
   `/unpublish` already uses — reuse that path, do not write a second one).
3. Schedules ISR revalidation for every affected listing, or the page stays cached and
   visible after being unpublished.
4. Writes one `billing_subscription_events` row as the idempotency guard.

Reuse from `reconcileExpiredTrials`: the advisory lock (`BLOCK_EXPIRED_TRIALS_LOCK_KEY`,
`1004`), the 200-row batch, and the per-subscription event dedup. Replace its body — it
mirrors a provider verdict, and there is no provider to mirror.

`trialMiddleware` needs no change: it already paywalls mutating requests on
`trialStatus.isExpired` while leaving GET/HEAD readable (SPEC-217 AC-1.1), which is
exactly D-3's "the data stays, they just cannot edit or be seen".

### 6.5 The notification schedule — D-4

`notification-schedule.job.ts` already carries the whole mechanism: an idempotency key of
`(type, customerId, daysAhead)`, a durable `billing_subscription_events` dedup, and a
skip-tolerant window. What changes is the offsets and the templates.

- Pre-expiry: `findTrialsEndingSoon({daysAhead})` at **10, 5 and 1** (today 3 and 1), with
  **three distinct templates**, not one reused. The copy differences in §4 are the point of
  the change; shipping one template three times fails the requirement silently.
- Post-expiry: a new query over expired trials by elapsed days, at **+1, +5, +10, +30, +60**.
- Every send re-checks live subscription state immediately before dispatching. A snapshot
  taken at schedule time will mail someone who paid an hour ago.

New notification types: the returning `TRIAL_EXPIRED` plus the win-back series. Adding a
value here trips frozen inventories elsewhere — see G-3.

### 6.6 Conversion, trial → paid

The person clicks through to checkout and **HOS-937's path runs unchanged**, with one
difference: **no `freeTrialDays` is ever passed**. MercadoPago sells a plain recurring
subscription that charges immediately, which is the only thing it has proven it does
honestly.

**Supersede, do not mutate.** The checkout creates its own `pending_provider` row as it
does today; on the activation webhook the old `trialing` row for the same
`(customer, product_domain)` is moved to a terminal state **in the same transaction** as
the activation. Rationale: mutating the trial row into a paid one would require it to
acquire an `mp_subscription_id` mid-life, which is precisely the correlation problem
HOS-937 spent ~4.750 lines solving. Rows keep their provenance.

The overlap must not outlive that transaction: `loadEntitlements` picks the **first**
entitlement-granting accommodation subscription it finds (`entitlement.ts:446`), so two
live rows resolve a nondeterministic plan. `TrialService.reconcileDuplicateSubscriptions`
(`trial.service.ts:1663`) already exists as the backstop, but it is a backstop, not the
design.

### 6.7 What MercadoPago sees

Nothing about trials, ever. Concretely: no checkout passes `freeTrialDays`, no
`auto_recurring.free_trial` and no `start_date` is sent (HOS-171 measured that those two
are the same mechanism, so both are banned), and no code reads `free_trial`,
`first_invoice_offset` or `next_payment_date` to decide anything about a trial.

## 7. Guards

Static guards, because "N call sites must remember X" is a guard, not N tests.

- **G-1 · No checkout may send a trial to MercadoPago.** Fails if any production source
  passes `freeTrialDays`, `free_trial` or `start_date` into a preapproval create. Anchor
  it on the payload shape, not on a function name — a guard anchored on a name dies
  silently at the first rename, and the PR that renames does not see it fail.
- **G-2 · Publish and trial-start commit together.** A test that fails the trial insert and
  asserts the accommodation is still not ACTIVE. Mutation-test it in both directions.
- **G-3 · Adding a notification type trips frozen counts.** Repo precedent: a new enum
  value has broken five frozen guards across three packages. Run the four CI guards
  `pnpm check:guards` does **not** run, before opening the PR:
  `npx tsx scripts/extract-zod-keys.ts --verify` (without `--verify` it always exits 0),
  `corepack pnpm --filter @repo/i18n check-locales`, `corepack pnpm check:soft-delete-actor`,
  `corepack pnpm check:locale-resolution-single-source`.
- **G-4 · The nine emails must actually differ from each other.** *(Rewritten 2026-09-01
  after measuring the codebase — the original guard vigilaba something that does not
  exist.)*

  The original text worried about i18n parity across es/en/pt. **Email templates do not go
  through i18n at all**: all 57 of them are React components with Spanish embedded
  directly (`packages/notifications/src/templates/**`), and only two files in the whole
  package import `@repo/i18n`, neither a template. There are no keys for a parity guard to
  check.

  Owner decision (2026-09-01): the nine new templates follow the existing convention —
  **Spanish only**. The recipient is a host in Entre Ríos, not a tourist. Internationalising
  email is a separate concern from this spec and is not started here.

  What the guard actually has to protect is the requirement that made §4 worth writing:
  each of the nine carries its own tone, and shipping one template reused nine times passes
  every structural check while failing the requirement silently. So the guard asserts the
  nine subjects and bodies differ PAIRWISE, with a positive control that copying one into
  another makes it fail. The three that land within 48 hours of each other — T−1, the
  expiry mail, and +1 — are the ones that most need it.

## 8. Traps

- **T-1 · `blockExpiredTrials` no longer exists.** Only its two constants kept the name.
  Any plan that says "restore `blockExpiredTrials`" is describing a function that was
  replaced by `reconcileExpiredTrials`, whose body does the opposite thing.
- **T-2 · Editing `plans.config.ts` does not reach staging or production.** Since HOS-39
  `hasTrial` / `trialDays` are commercial layer and the DB wins. Changing the trial length
  needs a numbered data-migration (`pnpm db:seed:make`) or it passes every local test and
  changes nothing live. Seed dual-write rule applies.
- **T-3 · Unpublishing without scheduling revalidation leaves the page live.** Cloudflare
  keeps serving it. Every write path that changes visibility must call
  `getRevalidationService().scheduleRevalidationBatch`.
- **T-4 · HOS-936's PR #3071 must still merge.** While the old path runs in production it
  is the only defense against a repeat of the ARS 18.000 charge. It is deleted when the
  Hospeda-owned trial is live, not before.
- **T-5 · The `+` in emails (HOS-988) is unrelated and still blocking.** It blocks the
  production smoke of the paid path regardless of this spec. Do not fold it in here, and
  do not assume this spec unblocks it.
- **T-6 · Copy must change in both directions.** CLAUDE.md and HOS-941 (R-1) forbid saying
  "sin tarjeta" under card-first. That prohibition is lifted here — and if it is not lifted
  explicitly in both places, the copy keeps lying, now in the other direction.

## 9. Open questions

- **OQ-1 · Do the win-back emails carry a commercial hook** (a targeted discount)? Not
  decided, and not assumed. The standing rule is that coupons are never published; a
  coupon sent by directed email is a different case and needs its own decision.
- **OQ-2 · Trial length per vertical.** `owner-basico` uses `OWNER_TRIAL_DAYS`. D-2 makes a
  per-domain trial possible; whether gastronomy and experiences get one, and of what
  length, is a product decision (related: HOS-1004).
- **OQ-3 · What happens to a trial that is running when this ships? — DECIDED
  2026-09-01.** The two production `trialing` rows are **real customers**, not test data
  (see the correction in §2.3). They are **converted in place, deliberately AFTER the
  deploy and the smokes**, and NOT left to run out on the old path: the owner contacts
  each one first, then the conversion runs. Nothing is touched before then.

  **Order of operations, per customer — it is not negotiable:**

  1. `UPDATE billing_subscriptions SET mp_subscription_id = NULL WHERE id = '<id>'`. The
     status stays `trialing` and `trial_start`/`trial_end` are preserved untouched.
  2. Only then, `PUT /preapproval/<id>` with `{"status":"cancelled"}`.
  3. Verify the row is still `trialing`, with a NULL provider id and the same `trial_end`.

  **Doing it in the other order breaks the customer's trial.** MercadoPago maps
  `canceled → CANCELLED`; the `preapproval.updated` webhook finds the row by
  `mp_subscription_id` and settles it to `cancelled`, which revokes entitlements and
  unpublishes the listing. With the correct order the webhook finds nothing, attempts the
  HOS-191 relink fallback — whose CAS requires `pending_provider`/`abandoned` and a NULL
  provider id, so a `trialing` row can never match — and returns 200 with a warn. Nothing
  is overwritten and MercadoPago does not retry.

  **What the customer experiences:** nothing at all during the trial. The listing stays
  published, the panel is unchanged, the date is the same. The one thing they may see is
  a cancellation email from MercadoPago — **unverified, do not assume either way**; it can
  be measured by cancelling a sandbox canary and watching the test buyer's inbox. At
  expiry they must re-authorize a card in the checkout, which is the real cost of
  converting: today MercadoPago would have charged them automatically.

  **Hard deadline.** Converting removes their preapproval, so nothing charges them any
  more — and if the new trial is not yet deployed, nothing mails them or unpublishes them
  either. They would sit published for free, silently. The 30-day customer expires
  **2026-09-26**. Either the Hospeda-owned trial is live in production before that date,
  or that customer is left on the old path and only the November one is converted.

  **Until the conversion runs, both kinds of row coexist**, and staging keeps minting new
  legacy ones while it runs the old code. That is why the expiry job branches on
  `mp_subscription_id` (T-010) rather than assuming every `trialing` row is a local one.

## 10. Issues to close — AFTER the smokes, not before

Owner instruction: **none of these closes until this work is finished, smoked and confirmed
ready for production.** Listed here so none is missed.

- [ ] **HOS-582** — investigate a root fix for MercadoPago's trial
- [ ] **HOS-522** — 14 days promised, charged in minute 2
- [ ] **HOS-478** — the trial promises one thing and charges another
- [ ] **HOS-931** — trial denied per customer instead of per vertical (absorbed by D-2)
- [ ] **HOS-936** — derive the trial from `next_payment_date` (merges first, see T-4)
- [ ] **HOS-956** — the decision itself
- [ ] **HOS-171** — partially reversed; needs an addendum, not a close

## 11. Smoke

This is billing **CORE**. The issue carries `status-needs-smoke-staging` **and**
`status-needs-smoke-prod`, and they cover different things: staging covers the flows end to
end, production covers real cron timing and the real unpublish→revalidate chain.

Neither satisfies the other, and a PR that is not deployed on the target environment cannot
be smoked there.

Sections to exercise: publish → trial starts; the three pre-expiry emails at their real
offsets; expiry → unpublish → page actually gone from the site; the five win-back emails;
paying mid-trial → series stops and no duplicate live subscription; second vertical → new
trial granted (D-2).
