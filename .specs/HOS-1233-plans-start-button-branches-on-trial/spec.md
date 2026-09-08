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

Inferred from the code and NOT measured end to end — worth confirming before acting on it:

- `start-paid.ts:196-205` blocks checkout when the customer already has an active accommodation subscription, so a tourist VIP would likely be refused `ALREADY_SUBSCRIBED` on trying to become a host.
- `publish-eligibility` would answer `has_active_sub`, letting them publish an accommodation with no host plan, and never starting their accommodation trial.

This reframes OQ-1: tourist is not merely *unread*, it is *misfiled*, and that predates this spec.

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

### D-5 · The clock's only source is the local row

`trial_end` on `billing_subscriptions`. Since HOS-1012, MercadoPago is never asked about trials, and `scripts/check-no-trial-to-mercadopago.sh` fails CI if a checkout payload names one.

## 5. Scope

**In**: the five `/planes/{audience}/precios/` pages; the vertical-aware trial read that F-3 shows is missing; the three branches on `PlanPurchaseButton` (anfitriones + turistas); the remaining-days banner on all five; the warn-and-confirm dialog; `TOURIST` in `ProductDomainEnum` plus the reclassification of the existing rows (D-3); the already-VIP disabled state on the tourist cards (D-4).

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

## 9. Test plan

A unit test per branch of the day-count decision, including both sides of the AC-6 boundary and the unresolved case · a test that an unstarted trial produces navigation and no dialog · a test that cancelling the dialog performs no checkout · banner present/absent pairs (the absent-side assertions of AC-8 need a sibling asserting the same string IS present when a trial runs, or a selector typo passes as a pass) · the AC-11 guard, mutation-verified by adding a second inline comparison and confirming it fails · a test per `ctaMode="link"` page that its href still points at signup → create form.

Mutation-verify every new test: the assertions here are mostly about an ABSENCE (no dialog, no banner, no checkout), which is the shape that passes for the wrong reason most easily.

## 10. Sequencing

Implementation starts after PR #3286 (HOS-1183) merged — done, 2026-09-08 19:07 UTC. The verdict read and its canonical predicate are in `origin/staging`.

**OQ-1 blocks the tourist page only.** The other four can proceed while it is open.
