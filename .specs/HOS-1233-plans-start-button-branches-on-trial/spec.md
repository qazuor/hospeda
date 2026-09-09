---
title: The plans page reads the trial before it charges
linear: HOS-1233
statusSource: linear
created: 2026-09-08
type: fix
areas:
  - web
  - api
  - billing
---

# The plans page reads the trial before it charges

## 1. Summary

The "Empezar" button on the pricing cards has **one behaviour**: open the payer-email dialog and follow MercadoPago to charge the full month. It never asks what state the person pressing it is in — while the card directly above it promises "30 días de prueba gratis".

This spec gives that button the same three-state verdict HOS-1183 built for the publish button, **plus a clock** it does not have, and puts a banner on the page saying how many trial days are left.

It also amends the issue on one measured point: the button that charges without looking exists on **two** of the five plans pages, not five. The other three already send the visitor to the create form. §3 F-1 has the measurement; the owner decided on 2026-09-08 to cover all five anyway (§4 D-1).

## 2. Problem

### 2.1 Measured on staging `4dbfb9ae4`, smoke `staging-tanda-2026-09-07`

| Account | Page | Pressed | What happened |
| -- | -- | -- | -- |
| `smokereg0908@local.test` — registered that day, accommodation trial intact, a complete draft ready to publish | `/planes/anfitriones/precios/` | Básico, $ 18.000 | Payer-email dialog opened, bound for MercadoPago. Nothing asked, nothing warned. Their 30 days were about to be skipped in silence. |
| `tourist-free@local.test` | `/planes/turistas/precios/` | VIP | MercadoPago charged **ARS 15.000 on the spot**. The subscription was born `active` with `trial_end` at `null`. |

The three host cards (Básico, Profesional, Premium) and the tourist card all advertise **"30 días de prueba gratis"** immediately above that button.

### 2.2 The page cannot tell three audiences apart

The pricing page renders identically for somebody who never tried, somebody on day 2 of their trial, and somebody who already burned it. There is no banner, no day count, no state of any kind.

## 3. Findings that amend the issue

Every measurement in this section was taken against this worktree at
`origin/staging` of 2026-09-08, after PR #3286 (HOS-1183) merged.

### F-1 · The charge-without-looking button is on TWO pages, not five

`ctaMode` on each pricing page, measured:

| Page | CTA | Destination |
| -- | -- | -- |
| `/planes/anfitriones/precios/` | `PlanPurchaseButton` (default `checkout`) | **MercadoPago, directly** |
| `/planes/turistas/precios/` | `PlanPurchaseButton` (default `checkout`) | **MercadoPago, directly** |
| `/planes/gastronomia/precios/` | `ctaMode="link"` | signup → `/publicar/gastronomia/` |
| `/planes/experiencias/precios/` | `ctaMode="link"` | signup → `/publicar/experiencias/` |
| `/planes/aliados/precios/` | `ctaMode="link"` | signup → create form |

`PricingCardsGrid.astro:129-133,554-570`: with `ctaMode="link"` the grid renders a plain `GradientButton`, no React island, no checkout, no promo, no payer-email dialog. `buildCommerceStartUrl` (`apps/web/src/lib/commerce/start-url.ts:75-90`) builds `/auth/signup?returnUrl=/publicar/{vertical}/`, and a signed-in visitor is forwarded straight to the create form.

So gastronomy, experiences and partners **already perform the issue's first branch** — they land on step 1 of the create form — without consulting the trial, because they never reach payment from this page at all.

The two accounts the owner measured are exactly the two pages that do reach payment.

### F-2 · Commerce already has this branching, on a different surface

The three-state decision for gastronomy and experiences exists and shipped in **HOS-1184**: `CommerceListingActions.client.tsx` under `/mi-cuenta/comercio`, at the moment an already-created draft is published ("Publicar y pagar" / "Publicar" / "Publicar gratis"). It reads `GET /protected/commerce/subscriptions/{entityType}/trial-verdict`.

Whatever this spec adds to the commerce plans pages must not contradict that surface, and must not become a second place where the same verdict is derived.

### F-3 · Nothing today answers "how many days are left, in THIS vertical"

Two reads exist and neither is the one this spec needs:

- **`GET /protected/billing/trial/status`** (`apps/api/src/routes/billing/trial.ts:49-62,100-133`) returns `{ isOnTrial, isExpired, startedAt, expiresAt, daysRemaining, planSlug, intendedInterval }`. It has the clock — and it is **per ACCOUNT, never per vertical, deliberately**. `TrialService.getTrialStatus` (`apps/api/src/services/trial.service.ts:258-330`) documents why: it backs `trialMiddleware`, mounted globally, which answers every non-GET with HTTP 402 when `isExpired`. Filtering it by `productDomain` would break that global gate. The known consequence is recorded in the code (HOS-337): a live commerce subscription can mask an elapsed accommodation trial.
- **`GET /protected/commerce/subscriptions/{entityType}/trial-verdict`** is per vertical, but its `trialDays` is the plan's **total** duration, reported only when the trial has **not started yet** (`verdict: 'trial_available'`). It never reports days remaining on a trial in flight.

**This is the central gap.** The issue's own text anticipated it: "hace falta lo mismo más el reloj". The ±3-day threshold and the banner both need a vertical-aware read of a trial already running, and no endpoint answers that.

`GET /protected/accommodations/publish-eligibility`, which HOS-1183 just shipped, carries `startsTrial: boolean` — whether a trial *would* start — and no date.

### F-4 · Tourist has no product domain, so it has no verdict to read

`ProductDomainEnum` (`packages/schemas/src/enums/product-domain.enum.ts:46-50`) holds exactly `accommodation`, `gastronomy`, `experience`, `partner`, `addon`. There is **no `tourist`**.

Every per-vertical trial mechanism is keyed by that enum: `resolveTrialEligibility`, `resolveCommerceTrialVerdict`, the `product_domain` column on `billing_subscriptions`. A tourist plan does not fit any of them.

This is not a detail to route around while implementing. It is the reason tourist needs a decision before it can get the same three branches as the rest — see **OQ-1**.

### F-4b · Tourist plans are already CLASSIFIED as accommodation, in both live databases

F-4 says tourist has no domain. The consequence is not that its rows carry nothing — it is that they carry the wrong thing. Measured 2026-09-08 against both environments:

| env | plan | `billing_plans.product_domain` | `billing_subscriptions.product_domain` | status | n |
| -- | -- | -- | -- | -- | -- |
| staging | `tourist-vip` | `accommodation` | `accommodation` | `active` | 1 |
| staging | `tourist-vip` | `accommodation` | `accommodation` | `past_due` | 1 |
| prod | `tourist-vip` | `accommodation` | `accommodation` | `abandoned` | 1 |

The commerce verticals are classified correctly in the same query (`gastronomy-basico → gastronomy`, `experience-basico → experience`). **Tourist is the only misclassified one**, and it is misclassified at the PLAN row, not merely inherited by a subscription from the column default.

The cause is F-4 plus a fail-open: with no `tourist` member to assign, the plan falls to the column's `'accommodation'` default, and `subscriptionMatchesDomain` treats `null` / `undefined` / `'accommodation'` alike as accommodation — deliberately, for legacy rows.

So **for the entitlement engine, a tourist on an active VIP plan is indistinguishable from an accommodation subscriber**. `isAccommodationSubscription` returns `true` for that row.

Both consequences were traced in the code afterwards. One held, one did not:

- **Confirmed** — `start-paid.ts:202-213` (`hasActiveAccommodationSub`) counts the tourist row, so a tourist-vip subscriber IS refused `ALREADY_SUBSCRIBED` when trying to become a host.
- **Corrected** — the first draft of this finding guessed, and labelled as inference, that `publish-eligibility` would answer `has_active_sub` and let them publish with no host plan. It does not. `hasAnyPriorSubscription` (`trial-eligibility.service.ts:283-325`) matches the tourist row as a prior accommodation subscription and classifies the trial `consumed`, so the verdict is **`subscription_required`** — the opposite failure: the trial is *denied* rather than wrongly granted. `isOwnerCategorySubscription` (keyed on the plan's `metadata.category`, not on the domain) already blocks the `has_active_sub` branch, so the path the inference described was never reachable.

The conclusion survives the correction — reclassifying fixes it either way — but the mechanism is different, and this is worth keeping visible: a labelled inference in a spec is still a claim, and this one was wrong in the direction that would have made the bug sound scarier than it is.

This reframes OQ-1: tourist is not merely *unread*, it is *misfiled*, and that predates this spec.

### F-4c · The root cause: no paid checkout names its domain, and commerce is correct by accident

F-4b is not one bad row. It is a missing parameter, and the audit found where:

**`createPaidSubscription` has no `productDomain` parameter at all** (`apps/api/src/services/billing/paid-subscription-create.ts:207-274`). `CreatePaidSubscriptionInput` does not carry the field and qzpay-core's `subscriptions.create()` does not accept one — the column belongs to `@qazuor/qzpay-drizzle`, outside qzpay-core's own interface. Every row it creates is born on the column default.

What flows through it: **every `mode:'paid'` checkout** — accommodation host plans and tourist plans alike, resolved by slug down the same code path — plus both reactivation flows (`trial.service.ts:1181,1235,1435,1492`) and the past-due payment-method replacement.

Two more writes share the defect:

- `plan.crud.ts:424-489` (`createPlan`, the admin plan-creation service) — `CreatePlanInput` has no domain field; the insert never names the column.
- `billingPlans.seed.ts:423-459` — inserts every plan in `ALL_PLANS`, which is where `TOURIST_FREE_PLAN` and `TOURIST_VIP_PLAN` sit alongside the three accommodation plans (`plans.config.ts:1494-1500`). This is almost certainly how the production rows got their value.

**And commerce is classified correctly by accident, not by design.** `initiateCommerceMonthlySubscription`'s own docblock (`subscription-checkout.service.ts:836-848`) records that commerce *used to* call `createPaidSubscription`, and was moved off it by HOS-191 — because that path issues a `POST /preapproval` with a `preapproval_plan_id` and no `card_token_id`, which MercadoPago answers with HTTP 400. The fix made commerce materialize its `billing_subscriptions` row by hand, and a hand-written insert is one that names its columns. The correct domain is a side effect of dodging a MercadoPago bug.

So the default did not fail once. **It failed on every paid subscription ever created** — it just happened to be right for accommodation, which is most of them, and wrong for the one vertical nobody was looking at.

### F-4d · The default is a Hospeda concept leaking into a generic payments package

`@qazuor/qzpay-drizzle` declares the column, in both tables, as:

```ts
productDomain: varchar('product_domain', { length: 32 }).notNull().default('accommodation'),
```

(`packages/drizzle/src/schema/subscriptions.schema.ts:58`, `plans.schema.ts:38`.)

`'accommodation'` is a Hospeda domain value living in a generic payments library, and the field's own docblock admits it — it calls the default "the (Hospeda) primary product line". A payments package has no business knowing what an accommodation is.

Two things follow:

1. **The column is already `.notNull()`.** Only the `.default()` has to go for an omitted write to fail loudly instead of silently guessing. Measured across both environments, there are **zero NULL rows** to migrate: prod holds 8 subscriptions and 15 plans, staging 48 and 18, none null.
2. **Removing it is a package contract change.** The docblock states the default exists so "consumers that don't need multi-domain scoping can ignore it and always get the same value back". Any other consumer relying on that breaks. The owner decided (2026-09-08) to fix it at the root anyway, on both sides.

The wider question — what ELSE of Hospeda's vocabulary leaked into qzpay — is tracked on **HOS-1254**, since it is a package-level audit rather than part of this spec. That audit already found something worse than this default: `billing_plans.monthly_price_ars` / `annual_price_ars` (`plans.schema.ts:28-29`) put the Argentine currency in the COLUMN NAME of a generic payments library, `NOT NULL`, alongside the correct currency-agnostic mechanism the same package already has in `billing_prices.currency` — and `plan.mapper.ts:52` silently defaults the value to `0`, which is the same omit-is-silent pattern as this one, except what it invents is a price of zero.

### F-4e · Four more writes were reading as compliant, and the guard is what found them

Measured 2026-09-08 by T-035's guard on its first run, against this worktree.

§4b's Writes table above originally answered **"Yes"** for the comp grant and the
share-link checkout, and "Yes, all explicit" for the seeds. That reading was
generous in a way worth naming, because the same generosity is what let the
original bug live: all four sites INSERT the row and then set `product_domain`
in a **separate statement** — a follow-up `UPDATE` in the two services, a raw-SQL
`UPDATE` in the gastronomy seed, and a conditional spread
(`...(productDomain ? { productDomain } : {})`) in the test-user seed.

The rows do end up right. They are still not compliant with AC-15b, on two
counts, and the second is not cosmetic:

1. Every one of them **is born on the column default**. "Inherits the default and
   is corrected 5 ms later" is the behaviour AC-15b prohibits, not a variant of
   satisfying it.
2. **None of them survives T-036.** With no default, the INSERT is what the
   database rejects — before its correction has a chance to run. Read literally,
   §4b's original table said this spec's largest risk (R-8) was already mitigated
   at these sites. It was not.

The test-user seed was the worst of the four, and it is the one with a live
consequence today rather than a hypothetical one. Its parameter was optional, and
its own docblock gave the reason: *"Omitted for accommodation/tourist/complex
plans, where the column's `'accommodation'` default is already correct."* Since
D-3, that sentence is false for tourist — so every tourist test user was seeded
reproducing, on every developer's machine, the exact misfiling F-4b measured in
prod and staging. Local was not a clean environment to test the fix in; it had the
bug too. It now derives the domain from the plan's own row, so a vertical added
later cannot be missed by omission.

The methodological point, since AC-15c's inventory is a deliverable: **a
hand-audited table is a claim, and this is the second one in this spec to be
wrong** (F-4b's first draft was the first). The guard found in one run what
reading found incorrectly — which is the argument for D-6.3 stated as evidence
rather than as principle.

`createOwnPreapprovalSubscription` shares the shape and is deliberately NOT
counted here: the row it stamps is created by `createPaidSubscription`, so it is
covered once T-032 lands and its own UPDATE becomes redundant rather than
load-bearing.

### F-4f · The read that BREAKS worst was the one filed as indifferent

Found while tracing AC-15k, and measured — not inferred — 2026-09-08.

§4b's read table filed `middlewares/entitlement.ts:596-636` as *"Guarded by
`isOwnerCategorySubscription` for HOST actors; non-HOST path unverified →
Indifferent → fixed"*. The non-HOST path is the whole tourist audience, and it
does not survive the reclassification.

`loadEntitlements` finds the customer's subscription with:

```ts
subscriptions.find((sub) =>
    isEntitlementGrantingStatus(sub.status) && isAccommodationSubscription(sub))
```

A `tourist-vip` row matched that predicate **because it was misfiled** (F-4b), so
its entitlements resolved correctly for the wrong reason — the same accident
that made every other tourist read look fine. Reclassified, the predicate
returns false, no active subscription is found, and the fallback below it hands
the caller `buildDefaultEntitlementsResult()` — the tourist-**FREE** baseline.

Measured through the middleware before the fix, with a plan granting
`vip_support`: the request resolved exactly
`[save_favorites, write_reviews, read_reviews]`. A customer paying for VIP gets
the free tier, with no error, no log line and no 402.

The fix accepts either domain in that `find`, because it is looking for *the
plan this person pays for* — `ALL_PLANS` holds the owner tiers and the tourist
tiers together — not for an accommodation plan. `isOwnerCategorySubscription`'s
HOST-side discard below is untouched and still keyed on plan CATEGORY, so a
HOST who happens to hold a tourist sub still falls to the owner-basico draft
defaults exactly as HOS-217 intended.

Three things this finding is worth keeping for:

1. **The severity was inverted by the audit.** The reads §4b marked FIXED are
   real but minor; the one it marked indifferent takes away something a
   customer paid for. R-10 predicted precisely this ("the unaudited risk is a
   read nobody thought to grep for").
2. **Prod is not currently exposed, staging is.** Prod holds one `tourist-vip`
   row and it is `abandoned` — not entitlement-granting. Staging holds an
   `active` one and a `past_due` one. The exposure is every future subscriber,
   not a live incident.
3. **This is the third hand-audited claim in this spec to be wrong** (F-4b's
   first draft, F-4e's four write sites, and now this). The pattern is not
   carelessness — it is that reading code answers "what does this say" and the
   question here is always "what does this do to a row shaped like X". Only
   running it answers that.

**Still open, reported and deliberately NOT actioned**: `plan-domains.config.ts`
builds `PRODUCT_DOMAIN_BY_PLAN_SLUG` by walking `ALL_PLANS` and stamping every
slug `ACCOMMODATION`, tourist tiers included, on the same reasoning F-4b
invalidated — and its own docblock says the map is *"derived from the
catalogues, never restated"*, which that hardcode now contradicts, since each
`PlanDefinition` states its own domain since T-034. It reads plan SLUGS, never
the `product_domain` column, so the reclassification does not break it; it is
merely inconsistent. Its consumers (`applyDowngradeRestrictions`,
`applyUpgradeRestorations`) act on accommodations and promotions, which a pure
tourist has none of. Correcting it is a separate change with its own blast
radius.

### F-4g · Three more user-facing reads break, and the audit's own "~15 call sites" is what hid them

Found 2026-09-09 by enumerating every call site instead of reading the table.
**§4b listed 7 of the 19 reads that change.** The remaining twelve are
classified in §4b now; three of them BREAK, and all three are surfaces a paying
tourist touches:

1. **`routes/user/protected/entitlements.ts:139`** — the endpoint that tells the
   client *which plan am I on*. Its `find` uses `isAccommodationSubscription`,
   so a reclassified tourist yields no `activeSub` and the response carries
   `plan: null`. The line above it already states the intent the code now
   violates: *"a plain tourist actor's real tourist plan must keep surfacing
   unchanged"*.
2. **`billing/plan-domain-guard.ts:242`**, via
   `routes/billing/plan-change.ts:246` — `selectAccommodationSubscription`
   returns `undefined` and the route throws **HTTP 404 `No active subscription
   found`**. A tourist VIP cannot change their plan. This is the user-side twin
   of the admin gate D-8 named; only the admin half was fixed (T-039).
3. **`routes/user/protected/subscription.ts:284`** — the domain comes from a
   query param that **defaults to `ACCOMMODATION`**, so a tourist reading their
   own subscription finds nothing.

   The draft of this finding said the caller could work around it by passing
   `?productDomain=tourist`, and that *"no caller does"*. Weaker than the truth,
   and in the direction that matters: **no caller CAN.**
   `SUBSCRIPTION_SCOPE_DOMAINS` (`schemas/product-domain-query.schema.ts:37`)
   holds `accommodation | gastronomy | experience` and the param is a
   `z.enum` over exactly that tuple, so `?productDomain=tourist` is a **400**,
   not an unused escape hatch. There is no client-side workaround to fall back
   on while this is unfixed — which is the fifth hand-audited claim in this spec
   to come apart on contact, and the second time the mistake was reading a
   default as an *option*.

**All three fixed in `c64ed5f0c`**, each with a probe that failed first and a
sibling proving the widening is not a widening to everything (5 mutations
applied and killed: drop the widening, widen to any domain, drop the fallback,
invert the preference order, make the fallback unconditional).

The first is the same one-line shape as F-4f. The other two are **ordered**, not
an "either" match: accommodation is tried first and tourist is the fallback. A host
auto-promoted by host-onboarding legitimately holds both — the very case the
HOS-217 discard in `loadEntitlements` exists for — and an unordered match would
let the storage adapter's ordering decide which subscription is read or mutated,
which is HOS-259's bug wearing a new domain. Ordered, the fallback can only ever
turn a `null` into an answer: wherever an accommodation subscription exists, the
result is byte-identical to before.

**The resolution for the third one's open question** (what a caller that names
no domain should get): the fallback applies to the DEFAULT only. An explicit
`?productDomain=X` stays strict — a caller that names a domain means it, and
`gastronomy` must never pick up a tourist row. Neither path falls back to a
commerce vertical. `SUBSCRIPTION_SCOPE_DOMAINS` was deliberately NOT widened to
admit `tourist`: it is shared with `routes/billing/usage.ts`, no client needs to
ask for it now that the default answers correctly, and admitting it there is a
separate change with its own two-route blast radius.

Two smaller items from the same sweep, recorded so they are not rediscovered:

- **`billing/apply-price-increase.service.ts:345`** changes behaviour and fails
  safe: an admin price increase aimed at a tourist plan now matches zero rows
  and reports `matched: 0`. Whether tourist plans should be repriceable through
  that tool is a product question, not a bug this spec introduced.
- **`billing/trial-local-expiry.service.ts:149`**'s `else` branch is a no-op for
  a tourist either way, but its comment explains itself as *"commerce verticals
  do not have listings of their own"* — a reason that no longer covers every
  case reaching it.

**This is the fourth hand-audited claim in this spec to be wrong** (F-4b's first
draft, F-4e, F-4f, and now the read table's own scope). The pattern has held
every time: a table written by reading answers *what does this say*, and the
question is always *what does this do to a row shaped like X*. What finally
worked here was not reading more carefully — it was enumerating the call sites
mechanically and classifying by SHAPE, which turned 38 sites into one group of
19 and two groups that provably cannot move.

### F-5 · The two verdict enums are deliberately separate and must stay that way

`commerce-trial-verdict.schema.ts:18-25` and `publish-eligibility.schema.ts:18-26` each carry the same instruction from the other side: `PublishEligibilityKindSchema` (`first_publish` / `has_active_sub` / `subscription_required`) and `CommerceTrialVerdictKindSchema` (`trial_available` / `has_active_sub` / `payment_required`) spell their states differently **on purpose**, because publishing a commerce listing opens a MercadoPago checkout where publishing an accommodation starts a local trial.

A unified enum is not a simplification available to this spec. It would force one name onto two mechanisms, and the next change to either would have to decide which vertical it meant.

### F-6 · A guard already forbids comparing these literals — in the API, not the web

`apps/api/test/services/publish-eligibility-canonical-predicate.guard.test.ts` (with a twin in `packages/service-core/test/`) statically scans `SRC_ROOT = apps/api/src` and fails on any verdict literal within 60 characters of a decision operator (`===`, `!==`, `.includes`, `case`, `switch`, `new Set`). `DECISION_SCAN_EXCLUSIONS` is empty today, so a new file matching the pattern breaks CI unless it is listed with a justification.

Two consequences:

1. Any new API-side branching on a verdict must go through the canonical predicate, never an inline string compare.
2. **The guard does not cover `apps/web`.** The web is where this spec does most of its work, so the protection HOS-1183 relies on does not extend to it by default. See AC-11.

### F-7 · The button decides entirely in the client, and already fetches the verdict — for decoration

`PlanPurchaseButton.client.tsx` is a `client:load` island (`PricingCardsGrid.astro:571-582`). Its `handleClick` branches on `isAnnualUnavailable`, `isFreePlanUnpurchasable`, `!isAuthenticated`, `isPlanChange`, and otherwise goes to checkout. **No trial state is consulted.**

It does call `getTrialEligibility` — but only to strike through the "N días gratis" badge, and only on `trialEligible === false` (`:617-634`, with an explicit comment that `null` deliberately changes nothing). The data is already on the page. It just does not reach the decision.

### F-8 · The banner has a caching consequence, and it is not a detail

The plans pages are edge-cached and must not parse the session — `cacheable-routes-parse-no-session.guard.test.ts` fails the build if they do, because a personalised response in a shared cache serves one visitor's state to the next. A server-rendered "te quedan N días" is exactly such a response.

So the banner is client-resolved (an island) or those pages leave the cache. That is an architecture decision, not an implementation choice — **OQ-2**.

### F-9 · Two fail-safe asymmetries to copy, not to reinvent

- `fetchCommerceTrialVerdict` falls back to `payment_required` on a network failure, never `trial_available`. The direction is deliberate: undersell, never over-promise free.
- `trialDays` in `CommerceTrialVerdictResponse` is optional and **never `0`**, so interpolated copy can never render "0 días gratis".

Both belong to any new read this spec adds.

## 4. Decisions

### D-1 · All five pages are in scope (owner, 2026-09-08)

Presented with F-1 — that the measured bug lives on two pages, and that gastronomy, experiences and partners already send the visitor to the create form — the owner chose to cover **all five**, as the issue states.

The consequence to hold: on the three `ctaMode="link"` pages the work is **the banner and the day count**, not a new payment branch, because those CTAs never reach payment. Turning them into checkout buttons is not in scope and would undo HOS-1156.

### D-2 · The three branches

Per the vertical of the page the button lives on:

| State | "Empezar" does |
| -- | -- |
| Trial not started | Goes to **step 1 of that vertical's create form**. Not to payment. |
| Trial running, **more** than 3 days left | Warns that the remaining days are lost and the charge is immediate. Accept or cancel. |
| Trial running, **fewer** than 3 days left | Goes to MercadoPago and subscribes. |

`/publicar/`, `/publicar/gastronomia/` and `/publicar/experiencias/` are step 1 for their verticals (`PUBLISH_PAGE_PATH_BY_VERTICAL`, `apps/web/src/lib/publish/publish-page-paths.ts`) — there is no separate multi-step wizard.

### D-3 · Tourist gets a real domain, and the existing rows are corrected (owner, 2026-09-08)

OQ-1 resolved to option 1: `TOURIST` joins `ProductDomainEnum`, the tourist plan rows stop claiming to be accommodation, and the existing rows measured in F-4b are migrated. The owner asked for the robust path — the one that leaves the other reads correct rather than reading around a misfiling.

This is the largest piece of the spec and it reaches the entitlement engine. It carries the expand/contract rule of the structural carril: the enum value and the new classification ship first, the rows are backfilled, and nothing drops in the same release.

### D-4 · An active subscription in ANY vertical disables the tourist purchase (owner, 2026-09-08)

A visitor holding an **active** subscription in any current vertical — accommodation, gastronomy or experiences — cannot buy a tourist plan. The button is disabled and the card states they already hold the VIP benefits, as if subscribed.

**This is not a courtesy, it is already true.** `plans.config.ts:578-592` records HOS-975 D-A (owner, 2026-09-01): every commerce tier spreads `TOURIST_VIP_ENTITLEMENTS` and `TOURIST_VIP_LIMITS` whole, the same two constants all six accommodation plans spread, "because a commerce owner is a tourist on this platform too". Verified in the config: the spread appears on all six accommodation tiers, on `tourist-vip` itself, and on the commerce tiers.

So the tourist purchase for these people sells nothing they do not have. Offering it takes money for an empty delta.

Three boundaries this decision needs, and only the first came from the owner:

- **`trialing` is excluded, deliberately** (owner). Someone mid-trial holds the entitlements today but may not tomorrow; disabling their tourist purchase would leave them with no way to keep the benefits if they let the trial lapse.
- **`comp` is treated as active** — assumption, flagged here rather than asked. A comp subscription is perpetual and grants entitlements (`isEntitlementGrantingStatus` accepts `active`, `trialing`, `comp`), so it sells the same empty delta. Reverse it if the intent was narrower.
- **`past_due` is treated as active** during its dunning grace — same assumption, same reasoning: entitlements still resolve during the 7-day grace. Staging currently holds a `past_due` `tourist-vip` row (F-4b), so this state is not hypothetical.

### D-6 · The misclassification is fixed everywhere it bites, not only where this issue trips over it (owner, 2026-09-08)

D-3 said tourist gets a domain. The owner then scoped what "gets a domain" has to
mean: **every site, read and write**, not the subset HOS-1233 happens to need.

The reason is in F-4b's shape. The wrong value did not arrive by one bad write —
it arrived because nothing ever assigned a value, so the column default answered
for a whole vertical, in two databases, for as long as the plans have existed.
Fixing only the reads this spec consumes would leave the same hole open for the
next plan somebody adds, and leave every other consumer still reading
`accommodation` for a tourist.

So the work is three things, and the third is the one that makes it permanent:

1. **Every WRITE that creates a subscription or a plan row assigns a domain
   explicitly.** A write that omits it is the bug, regardless of whether today's
   default happens to be right for that caller.
2. **Every READ that branches on the domain is audited against the new value**,
   and each is classified as fixed-by-this, broken-by-this, or indifferent.
   A read that works today *because* tourists are miscounted as accommodation is
   a behaviour change, not a bug fix, and has to be named as one.
3. **A guard makes the omission impossible to repeat.** The default is the
   failure mode: it is silent, it is plausible, and it produced a wrong answer in
   production without a single line of code being wrong. Nothing in the type
   system defends this enum (its own docblock says so), so the defence has to be
   a guard — a new plan or subscription write that does not name its domain fails
   CI rather than inheriting `accommodation`.

Two consequences worth stating before the work starts. Reclassifying is **not a
no-op on live behaviour**: any gate that a tourist passes today by being mistaken
for an accommodation subscriber will start refusing them, and any surface that
shows them their plan because it counted them as accommodation will stop unless
it is updated too — `BUSINESS_VERTICAL_PRODUCT_DOMAINS` was the first such case
found, and it will not be the last. And the audit itself is the deliverable: an
inventory of read sites with a verdict each, not a diff.

### D-7 · Fixed at the root, on BOTH sides — Hospeda and qzpay (owner, 2026-09-08)

The owner's instruction: *"arreglemos el problema de raíz y completo, tanto del lado de hospeda como del lado de qzpay"*, plus the observation that `'accommodation'` in a generic payments package is wrong on its own terms.

**qzpay side** — three changes, in this order:

1. `qzpay-core`'s subscription-creation interface accepts a product domain, so a consumer can state it. Today it cannot, which is why `createPaidSubscription` has no parameter to forward (F-4c).
2. `@qazuor/qzpay-drizzle` **drops `.default('accommodation')`** from `billing_subscriptions.product_domain` and `billing_plans.product_domain`. The columns stay `.notNull()`, so an omitted write becomes a NOT NULL violation — loud, immediate, at the first insert — instead of a silent guess. Zero NULL rows exist in either environment, so no backfill precedes it.
3. The docblocks stop naming Hospeda.

**Hospeda side** — every write names its domain before the default disappears, or the first checkout after the upgrade fails.

**The order is not negotiable and is the main risk in this spec.** Dropping the default while `createPaidSubscription` still omits the column breaks every paid checkout — accommodation and tourist both — at the first insert. Sequence: qzpay accepts the parameter → Hospeda passes it everywhere → the existing rows are backfilled → the default is dropped → the guard lands. Steps 4 and 5 are the contract half of an expand/contract, and they ship after 1-3, never with them.

### D-8 · The reads that break are updated in the same change, not discovered later

The audit found one read that a correct reclassification silently breaks, and one that could not be resolved without tracing. Both belong to this work, not to a follow-up:

- **`apps/admin/.../billing-subscriptions/utils.ts:158`** gates plan-change on `productDomain !== 'accommodation' → return []`. A tourist subscription passes that gate **today, because of the bug**, and then correctly narrows to the tourist plans. Reclassified, it fails the gate and the admin UI offers **zero** destination plans for any tourist subscription — a silent regression, in a surface nobody would think to re-test. The gate becomes domain-aware rather than accommodation-hardcoded.
- **`packages/billing/src/config/commerce-limits.config.ts:130-175`** (`PRODUCT_DOMAIN_BY_LIMIT_KEY`) maps `MAX_FAVORITES`, `MAX_ACTIVE_ALERTS`, `MAX_COMPARE_ITEMS`, `MAX_SEARCH_HISTORY_ENTRIES` and `MAX_COLLECTIONS` — every one of them part of `TOURIST_VIP_LIMITS` — to `ACCOMMODATION`. Whether that table is ever consulted to resolve a *pure tourist's* own limits (as opposed to only feeding the host-side addon recalculator) was **not resolved**. It must be traced before shipping D-3, not assumed either way: if it is the former, a pure tourist's limits stop resolving once the rows say `tourist`.

### D-5 · The clock's only source is the local row

`trial_end` on `billing_subscriptions`. Since HOS-1012, MercadoPago is never asked about trials, and `scripts/check-no-trial-to-mercadopago.sh` fails CI if a checkout payload names one.

## 4b. The domain audit (AC-15c's deliverable)

Audited 2026-09-08 against this worktree. This table IS the acceptance criterion — a read left unclassified means AC-15c is not met.

### Writes

| Site | Creates | Names the domain? |
| -- | -- | -- |
| `billing/paid-subscription-create.ts:207-274` | **Every paid checkout** (accommodation AND tourist), both reactivations, past-due card replacement | **NO** — no parameter exists |
| `billing/plan/plan.crud.ts:424-489` (`createPlan`) | Any admin-created plan | **NO** — no field on `CreatePlanInput` |
| `seed/required/billingPlans.seed.ts:423-459` | Every plan in `ALL_PLANS`, tourist included | **NO** — the likely origin of the production rows |
| `subscription-trial-create.service.ts:174-200` | Local first-publish trial | Yes, in the insert, validated against the plan's own domain |
| `subscription-comp-create.service.ts:136-172` | Comp grant | **NO — corrected by T-035**, see F-4e |
| `billing/pending-provider-subscription-create.ts:260-339` | Share-link checkout | **NO — corrected by T-035**, see F-4e |
| `seed/example/gastronomies.seed.ts:293` | The gastronomy fixture's subscription | **NO — corrected by T-035**, see F-4e (was missing from this table entirely) |
| `seed/test-users/testUsers.seed.ts:429` | Every test user's subscription | **NO — corrected by T-035**, see F-4e |
| `billing/own-preapproval-subscription-create.ts` | Commerce/partner own-preapproval | Yes, forwarded — but as a follow-up UPDATE, see F-4e |
| `subscription-checkout.service.ts:876+,1219+` | Gastronomy / experience / partner checkout | Yes — **by accident**, see F-4c |
| `commercePlan/partnerPlan/testDailyPlan/trialPlans` seeds | Their verticals' rows | Yes, all explicit, all in the insert |

### Reads

| Site | Today (tourist misfiled) | After reclassification |
| -- | -- | -- |
| `start-paid.ts:202-213` `hasActiveAccommodationSub` | Tourist counted → host checkout refused `ALREADY_SUBSCRIBED` | **FIXED** — a tourist can become a host |
| `accommodation-publish-deps.ts:141-194` → `hasAnyPriorSubscription` | Tourist row read as a prior accommodation sub → trial `consumed` → `subscription_required` | **FIXED** — a tourist-turned-host gets `first_publish` and their real trial |
| `middlewares/entitlement.ts:596-636` | The `find` matched a tourist row via `isAccommodationSubscription` — **only because it was misfiled** | **BREAKS, and it is the worst one** → F-4f. A paying tourist-VIP subscriber silently drops to the tourist-FREE defaults |
| `middlewares/owner-entitlement.ts:226-240,655` | **No** owner-category guard here — a tourist row can compete as "the" accommodation sub | **FIXED**, with no extra code |
| `cron/entity-subscription-cache-reconcile.job.ts:100-134` | Same gap: a tourist row could outrank a real owner plan in the cache | **FIXED** |
| `user/protected/stats.ts` via `BUSINESS_VERTICAL_PRODUCT_DOMAINS` | Counted tourist as accommodation, so the widget showed the plan | **Already handled** — `TOURIST` added to the constant in the same change; omitting it would have shown "no plan" to a paying tourist |
| `admin/billing-subscriptions/utils.ts:158` | Passes the `!== 'accommodation'` gate **because of the bug** | **BREAKS** → D-8 |
| `commerce-limits.config.ts:130-175` | Tourist-owned limit keys mapped to `ACCOMMODATION` | **RESOLVED: indifferent** (T-040). Its only consumer is the add-on recalculator and no add-on targets a tourist cap; a pure tourist's limits come from their plan, not this table. Pinned by a test that fails the day that changes |
| `trial.service.ts:258-360` `getTrialStatus` | Domain-blind by design (AC-2) | Indifferent |
| dunning / poll / finalize / abandoned crons | Exclude `addon` only | Indifferent |
| `admin/SubscriptionFilters.tsx:22` | Derives from `Object.values` | Auto-correct, no change |
| `subscriptionMatchesDomain` + ~15 call sites | Canonical comparator | Done — tourist fails closed, accommodation fail-open intact |

### Reads, completed (2026-09-09) — the row above said "~15 call sites" and meant it literally

The line above is the one that hid the rest of this audit. There are **38** call
sites across 27 files, and the table above classified **7** of the 19 that
actually change. Enumerating them by mechanism is what made the remainder
tractable — only ONE of the three shapes moves when a tourist row is
reclassified:

| Shape | Sites | Effect of the flip |
| -- | -- | -- |
| `isAddonSubscription(sub)` — exclude add-on rows | 7 | **None.** A tourist row is not an add-on before or after |
| `subscriptionMatchesDomain(sub, <commerce vertical>)` | 12 | **None.** A tourist row matched neither `accommodation`-as-asked nor the vertical asked for |
| `isAccommodationSubscription(sub)` / `…(sub, 'accommodation')` | **19** | **This is the whole surface.** A tourist row passed before and fails after |

Verdict for each of the 12 previously unlisted sites in that third group:

| Site | Verdict |
| -- | -- |
| `routes/user/protected/entitlements.ts:139` | **BROKE → FIXED** (`c64ed5f0c`) → F-4g. Returned `plan: null` to a paying tourist |
| `billing/plan-domain-guard.ts:242` → `routes/billing/plan-change.ts:246` | **BROKE → FIXED** (`c64ed5f0c`) → F-4g. HTTP 404 `No active subscription found`; a tourist could not change plan |
| `routes/user/protected/subscription.ts:284` | **BROKE → FIXED** (`c64ed5f0c`) → F-4g. Domain defaults to `ACCOMMODATION`, so a tourist saw no subscription |
| `billing/apply-price-increase.service.ts:345` | **BEHAVIOUR CHANGED, fails safe.** A price increase on a tourist plan matches zero rows and reports `matched: 0` |
| `addon-entitlement.service.ts:153,458,725` | Indifferent → correct. No add-on targets a tourist cap, so a pure tourist never held one; a dual-holder's add-on now lands on the right row |
| `billing/addon/addon-user-addons.ts:189` | Indifferent → correct. Same reasoning |
| `entity-subscription-cache.service.ts:172` | **FIXED** — same family as the reconcile cron already listed above |
| `accommodation/featured-entitlement.resolver.ts:121` | Indifferent → correct. Same answer by both paths; now for the right reason |
| `billing/trial-local-expiry.service.ts:149` | Indifferent. Both branches are a no-op for a tourist — but the `else` branch's comment now describes a case it no longer covers (see F-4g) |
| `billing/plan-domain-guard.ts:181` (+ `trialing-plan-upgrade.service.ts:337`, `webhooks/.../payment-logic.ts:819`) | Indifferent → correct. A tourist upgrade now takes the commerce branch, which is a documented no-op for anything with no listings |
| `seed/data-migrations/0092-…-backfill-accommodation-subscription-cache.ts:161` | Not applicable — historical, already ledgered, never re-runs |

### Guards

`check-product-domain-vocabulary.sh` and `check-product-domain-raw-sql.sh` police **only** the retired `'commerce'` literal. Neither has any opinion on a write that omits the domain.

~~**The AC-15d guard does not exist and must be built from scratch**~~ — **stale, corrected 2026-09-09.** It was built by T-035 and lives at `scripts/check-product-domain-on-writes.ts`, wired into `pnpm check:guards` **and** into CI as its own step (`.github/workflows/ci.yml:277`, which is what actually makes a guard run — being listed in `check:guards` is not). Anyone reading this line would have rebuilt a guard the repo already has; that is the seventh hand-audited claim in this spec to come apart on contact.

**Verified 2026-09-09, by mutation rather than by reading** — the guard holds every claim its own header makes:

| Mutation applied | Result |
| -- | -- |
| One create drops `productDomain` | `OMITS`, exit 1 |
| TWO creates drop it, in different packages | **both** reported — the AC-15d requirement that it not stop at the first |
| `...(cond ? { productDomain } : {})` | `OMITS`, exit 1 — a conditional spread does not count |
| `productDomain` moved inside `metadata: { }` | `OMITS`, exit 1 — a nested key is a JSON blob entry, not the column |

**The self-retiring exemption has retired.** The guard derives its `blocked-by-package` allowance by reading whether the INSTALLED `@qazuor/qzpay-core` declares `productDomain` in its own `.d.ts`. Called directly, `qzpayCoreOffersProductDomain()` now returns `true` (the wave published: qzpay PR #85 → release #86 → `qzpay-core@6.0.0`), and a clean run prints **zero** BLOCKED lines over 14 create sites. So an omitting `subscriptions.create(...)` is a hard failure today, not a documented exemption — and R-8's Hospeda-side precondition is met by measurement, not by assumption.

## 5. Scope

**In**: the five `/planes/{audience}/precios/` pages; the vertical-aware trial read that F-3 shows is missing; the three branches on `PlanPurchaseButton` (anfitriones + turistas); the remaining-days banner on all five; the warn-and-confirm dialog; `TOURIST` in `ProductDomainEnum` plus the reclassification of the existing rows (D-3); the already-VIP disabled state on the tourist cards (D-4); **every write site naming its domain, the read audit of §4b with a verdict each, the AC-15d guard (D-6), the qzpay-side interface and default removal (D-7), and the two reads D-8 names**.

**Out**: auditing the rest of qzpay for other Hospeda vocabulary leaking into it — that is a package-wide audit tracked on its own issue, not this spec's job. F-4d records why it exists.

**Out**: converting any `ctaMode="link"` page into a checkout page (D-1); `/mi-cuenta/comercio`'s publish action, which HOS-1184 already resolved (F-2); merging the two verdict enums (F-5); the legacy `/suscriptores/planes/*` pages, which are pure 301s.

## 6. Acceptance criteria

- **AC-1** · A vertical-aware read reports, for the vertical of the page: whether a trial is running, and if so its `trialEnd` and days remaining. It does not re-derive any verdict that already has a resolver.
- **AC-2** · `GET /protected/billing/trial/status` keeps its per-account semantics and its role behind `trialMiddleware`. This spec does not add a `productDomain` filter to it (F-3).
- **AC-3** · On `/planes/anfitriones/precios/`, "Empezar" with an unstarted trial navigates to `/publicar/` and opens no payer-email dialog.
- **AC-4** · With more than 3 days left, it opens a dialog naming the number of days that will be lost and stating the charge is immediate; cancelling performs no checkout and leaves the subscription untouched.
- **AC-5** · With fewer than 3 days left, it proceeds to checkout as today.
- **AC-6** · Exactly at the boundary the behaviour is defined and tested, not incidental. The threshold is one named constant, not a literal `3` at a call site.
- **AC-7** · All five pages render a banner stating the trial is running and how many days remain, resolved for that page's vertical.
- **AC-8** · A visitor with no trial running sees no banner and no day count — never "0 días".
- **AC-9** · A failed or unresolved read never renders a trial promise and never silently skips the warning dialog: it degrades toward charging-with-warning, never toward a silent charge (F-9).
- **AC-10** · The plans pages still do not parse the session server-side; `cacheable-routes-parse-no-session.guard.test.ts` stays green (F-8, subject to OQ-2).
- **AC-11** · A static guard covers the web side of F-6: no verdict literal is compared inline in `apps/web/src` outside the one module that maps a verdict to a branch. The guard fails on a second call site.
- **AC-12** · The three `ctaMode="link"` pages still link to signup → create form. No checkout path is added to them.
- **AC-13** · Nothing in this work sends a trial to MercadoPago; guard G-1 stays green.
- **AC-14** · `ProductDomainEnum` carries `TOURIST`; tourist plan rows in every environment stop reporting `accommodation` (D-3, F-4b). A query equivalent to F-4b's returns `tourist` for `tourist-*` plans afterwards.
- **AC-15** · `subscriptionMatchesDomain` keeps its asymmetry: `accommodation` still fails open for legacy rows, `tourist` fails closed like every other non-accommodation domain.
- **AC-15b** · **Every write** that creates a `billing_subscriptions` or `billing_plans` row assigns `product_domain` explicitly. None inherits the column default (D-6.1).
- **AC-15c** · **Every read** that branches on `product_domain` is inventoried with a verdict — fixed / behaviour-changed / indifferent — and each behaviour-changed site is either updated or documented as a deliberate change (D-6.2). The inventory ships with the spec; a read left unclassified is an incomplete AC.
- **AC-15d** · A guard fails CI when a subscription or plan write omits the domain (D-6.3). Mutation-verified by adding such a write and confirming it fails. This is the criterion that keeps F-4b from recurring: the value was never wrong in code, it was simply never stated.
- **AC-15e** · `qzpay-core`'s subscription-creation interface accepts a product domain, and `createPaidSubscription` forwards it — **resolved from the plan being purchased**, never hardcoded. Both reactivation paths and the past-due card replacement forward it too (D-7).
- **AC-15f** · `CreatePlanInput` carries the domain and `createPlan` writes it. An admin-created plan without one is rejected at the schema boundary, not defaulted.
- **AC-15g** · `billingPlans.seed.ts` stamps each plan's domain, derived from the plan definition rather than from a slug list, so a new plan added to `ALL_PLANS` cannot inherit somebody else's vertical.
- **AC-15h** · `@qazuor/qzpay-drizzle` no longer declares `.default('accommodation')` on either column; both stay `.notNull()`. Its docblocks name no consuming application. A migration drops the default in Hospeda's database.
- **AC-15i** · The default is dropped **only after** every write names its domain and the existing rows are backfilled. A test or CI step proves the ordering was respected — an out-of-order deploy breaks every paid checkout, which is this spec's largest risk.
- **AC-15j** · The admin plan-change gate is domain-aware; a tourist subscription is offered its tourist destination plans, not an empty list (D-8).
- **AC-15k** · `PRODUCT_DOMAIN_BY_LIMIT_KEY` is traced and its verdict recorded: either a pure tourist's limits still resolve after reclassification, or the table is corrected. Not left as an assumption (D-8).
- **AC-16** · A visitor with an `active` subscription in accommodation, gastronomy or experiences sees the tourist purchase button **disabled**, with copy stating the VIP benefits are already held (D-4).
- **AC-17** · A visitor whose only subscription is `trialing` still sees the tourist button **enabled** (D-4). This is the one that will be "simplified" by a future reader; it is deliberate.
- **AC-18** · AC-16's copy never appears for someone who does not actually hold the benefits. The condition reads a live subscription status, never a role and never the presence of a plan object.
- **AC-19** · A guard asserts that the tourist-VIP inheritance still holds for all three verticals — the moment a vertical stops spreading `TOURIST_VIP_ENTITLEMENTS`, AC-16 starts lying, and nothing else would catch it.

## 7. Open questions

### OQ-1 · RESOLVED 2026-09-08 → D-3 (option 1). Kept for the reasoning

Tourist is misfiled, not just unread

F-4 and **F-4b**: there is no `tourist` in `ProductDomainEnum`, and the consequence in the live data is that tourist plans are classified as `accommodation` in prod and staging alike. So the tourist page is not missing a read — it is reading a row that claims to be something else. And it is the page where the worst outcome was measured (ARS 15.000 charged on the spot).

The options changed shape once F-4b was measured:

1. **Add `TOURIST` to `ProductDomainEnum` and reclassify the existing rows.** No longer "consistency for its own sake" — it corrects a live misclassification. Cost: the enum drives the entitlement engine, `subscriptionMatchesDomain` reads asymmetrically by design (accommodation fails open, everything else fails closed), a new enum value trips several frozen-count guards, and the existing rows need a data migration under the expand/contract rule. Biggest change, and the only one that makes the other reads correct.
2. **Warning branch only, off the account-level `trial/status`.** Closes the silent-charge hole cheaply and touches no enum. But F-4b means the row it reads is filed as accommodation, so this papers over the misclassification instead of surfacing it — and it inherits F-3's masking flaw on top.
3. **Split tourist into its own issue.** Ship the other four pages here. Given F-4b, the tourist work is now plausibly bigger than the rest of this spec combined, and it has a blast radius (the entitlement engine) that the other four do not.

Not deciding this by implementation. It needs the owner.

Whichever is chosen, **F-4b is a finding that outlives this spec** and should be tracked on its own regardless — the inferred consequences (a tourist VIP blocked from becoming a host; a tourist VIP able to publish an accommodation with no host plan) are not caused by this work and are not fixed by leaving tourist out of it.

### OQ-2 · Banner in an island, or the plans pages leave the edge cache?

F-8. An island keeps the cache and costs a client fetch plus a flash of no-banner. Leaving the cache is simpler to render and costs the cache on a conversion-critical page. Recommendation: the island, because the cache on these pages was a deliberate build (`CACHE_TAG_PRICING`) and a personalised pricing page is the exact failure the no-session guard exists to prevent.

### OQ-3 · Is the 3-day threshold a product constant or configurable?

AC-6 pins it to one named constant either way. Whether it becomes plan- or vertical-configurable later is a product call; nothing in this spec needs it to be.

## 8. Risks

- **R-1 · A second derivation of a verdict that already has one.** F-2 and F-5: commerce's verdict has a resolver, accommodation's has another, and this spec consumes both from a third surface. If it re-derives either, the two screens disagree — which is the bug HOS-1183 just finished fixing one instance of.
- **R-2 · Failing open into a silent charge.** The dangerous direction here is the opposite of the usual one: a failed read that skips the warning charges real money without asking. AC-9 states the safe direction explicitly.
- **R-3 · Leaking session state into a cached page.** F-8 / AC-10.
- **R-4 · Scope drift on the three link pages.** D-1 keeps them banner-only; making them uniform "for consistency" would undo HOS-1156's funnel.
- **R-5 · A new enum value trips frozen guards across packages.** D-3 adds `TOURIST`. The repo has counted/frozen guards that a new `ProductDomainEnum` member breaks in several packages at once; they are the mechanism working, not collateral. Budget for them rather than being surprised.
- **R-6 · The reclassification is a data migration wearing a schema change.** D-3's rows exist in prod today (F-4b). Backfill in one release, drop nothing in the same one; a data-migration that needs a column the same release removes reads nothing, moves zero rows, and is ledgered as applied forever.
- **R-7 · AC-16 disabling the button for someone who does NOT hold the benefits.** The failure is invisible in testing and costs a sale: the copy claims a benefit the visitor lacks. AC-18 pins the condition to a live subscription status; AC-19 guards the inheritance the claim rests on.
- **R-8 · Dropping the default out of order breaks EVERY paid checkout.** The largest risk here. `createPaidSubscription` omits the column today, so a `NOT NULL` column with no default rejects its insert — accommodation and tourist alike, at the first attempt, in production. AC-15i exists for this and the sequence in D-7 is the mitigation. It fails loudly rather than silently, which is the point of the change, but it fails for everyone.
- **R-9 · A package change with consumers this spec cannot see.** Removing `.default()` from `@qazuor/qzpay-drizzle` changes the contract for every consumer, and the field's docblock advertises the default as a feature for single-domain consumers. Hospeda is the only one this spec can audit.
- **R-10 · Reclassification is a live behaviour change, not a correction with no side.** Four reads get better and one breaks (D-8), and that ratio was only known after an audit. The unaudited risk is a read nobody thought to grep for — which is exactly how the admin plan-change gate was found, by grepping for string comparisons against `'accommodation'` rather than by reading the spec's own file list.
- **R-11 · The backfill runs against production rows.** Small (8 subscriptions, 15 plans in prod) but real money is attached to them. Expand/contract, idempotent, and `meta.requiresColumns` so it aborts rather than silently moving zero rows.

## 9. Test plan

A unit test per branch of the day-count decision, including both sides of the AC-6 boundary and the unresolved case · a test that an unstarted trial produces navigation and no dialog · a test that cancelling the dialog performs no checkout · banner present/absent pairs (the absent-side assertions of AC-8 need a sibling asserting the same string IS present when a trial runs, or a selector typo passes as a pass) · the AC-11 guard, mutation-verified by adding a second inline comparison and confirming it fails · a test per `ctaMode="link"` page that its href still points at signup → create form.

Mutation-verify every new test: the assertions here are mostly about an ABSENCE (no dialog, no banner, no checkout), which is the shape that passes for the wrong reason most easily.

### The domain half (D-6, D-7, D-8)

The button work above is testable in the ordinary way. The classification work is not, because its failure mode is *silence*, so each item names what specifically must be proven:

**Writes** — one test per write site asserting the row lands with the RIGHT domain, not merely a non-null one. A test that only asserts "not null" passes against the very default being removed. The tourist paid checkout and the accommodation paid checkout both go through `createPaidSubscription`: assert them separately, since a hardcoded forward would satisfy one and not the other.

**The guard (AC-15d)** — mutation-verified by adding a write that omits the domain and confirming CI fails. Anchor its patterns so a rename or a Biome reformat cannot silently disable it, and make it fail on the SECOND omitting call site, not only the first: a guard anchored on one syntactic form has escapes.

**The default removal (AC-15h/i)** — a test that inserting without the column now RAISES. Assert the failure, not the success; "the insert worked" is what the default already gave us.

**The ordering (AC-15i)** — the sequence is the deliverable, not just the endpoint. Prove it the cheap way: run the write-site tests against a schema with the default already removed, and confirm they pass BEFORE the migration that removes it ships.

**Reads** — one regression test per row of §4b's read table, asserting the post-reclassification verdict. The five FIXED rows need a test that fails today and passes after; the BREAKS row (admin plan-change) needs a test asserting a tourist subscription is offered its tourist plans, which fails the moment somebody re-hardcodes the gate.

**`PRODUCT_DOMAIN_BY_LIMIT_KEY` (AC-15k)** — trace it first, then pin the answer with a test. If a pure tourist's limits resolve through that table, the test asserts a tourist with no accommodation subscription still gets `MAX_FAVORITES` and friends at their VIP values.

**The backfill (T-005/T-006)** — idempotency (running twice changes nothing the second time) AND a negative: a non-tourist row is left untouched. Both, because a migration that reclassifies everything is idempotent too.

**Cross-package** — the qzpay changes need their own tests in that repo. A Hospeda-side test cannot prove that `qzpay-core`'s interface accepts the parameter; it can only prove Hospeda passes something.

### What would make this suite vacuous

Recorded because these are the specific ways this particular suite could go green while the bug survives:

- Asserting `productDomain != null` instead of its value — passes against the default.
- Testing the reclassification only through `subscriptionMatchesDomain`, which is already correct, instead of through the writes that produce the rows.
- A guard that scans only the three write sites named in §4b, so the fourth one somebody adds next month is invisible.
- Running the read regressions against seeded fixtures that were themselves built with the corrected domain — they would pass before the fix too. At least one must reproduce the misfiled shape explicitly.

## 10. Sequencing

Implementation starts after PR #3286 (HOS-1183) merged — done, 2026-09-08 19:07 UTC. The verdict read and its canonical predicate are in `origin/staging`.

**OQ-1 blocks the tourist page only.** The other four can proceed while it is open.
