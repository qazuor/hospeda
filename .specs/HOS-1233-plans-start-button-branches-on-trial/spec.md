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

### D-3 · The clock's only source is the local row

`trial_end` on `billing_subscriptions`. Since HOS-1012, MercadoPago is never asked about trials, and `scripts/check-no-trial-to-mercadopago.sh` fails CI if a checkout payload names one.

## 5. Scope

**In**: the five `/planes/{audience}/precios/` pages; the vertical-aware trial read that F-3 shows is missing; the three branches on `PlanPurchaseButton` (anfitriones + turistas); the remaining-days banner on all five; the warn-and-confirm dialog.

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

## 7. Open questions

### OQ-1 · How does tourist get a verdict? — BLOCKING for the tourist page

F-4: there is no `tourist` in `ProductDomainEnum`, so there is no per-vertical trial state to read, and the tourist page is where the worst measured outcome happened (ARS 15.000 charged on the spot).

Three ways out, none of them free:

1. **Add `TOURIST` to `ProductDomainEnum`.** Consistent with the rest. But that enum drives the entitlement engine, and `subscriptionMatchesDomain` reads asymmetrically by design — `accommodation` fails open, everything else fails closed. A new member has to be threaded through that, plus the frozen guards a new enum value trips.
2. **Give tourist the warning branch only**, keyed off the account-level `trial/status` rather than a vertical. Cheap and it closes the silent-charge hole. It inherits F-3's known flaw: a live commerce subscription can mask an elapsed tourist trial.
3. **Split tourist into its own issue** and ship the other four here.

Not deciding this by implementation. It needs the owner.

### OQ-2 · Banner in an island, or the plans pages leave the edge cache?

F-8. An island keeps the cache and costs a client fetch plus a flash of no-banner. Leaving the cache is simpler to render and costs the cache on a conversion-critical page. Recommendation: the island, because the cache on these pages was a deliberate build (`CACHE_TAG_PRICING`) and a personalised pricing page is the exact failure the no-session guard exists to prevent.

### OQ-3 · Is the 3-day threshold a product constant or configurable?

AC-6 pins it to one named constant either way. Whether it becomes plan- or vertical-configurable later is a product call; nothing in this spec needs it to be.

## 8. Risks

- **R-1 · A second derivation of a verdict that already has one.** F-2 and F-5: commerce's verdict has a resolver, accommodation's has another, and this spec consumes both from a third surface. If it re-derives either, the two screens disagree — which is the bug HOS-1183 just finished fixing one instance of.
- **R-2 · Failing open into a silent charge.** The dangerous direction here is the opposite of the usual one: a failed read that skips the warning charges real money without asking. AC-9 states the safe direction explicitly.
- **R-3 · Leaking session state into a cached page.** F-8 / AC-10.
- **R-4 · Scope drift on the three link pages.** D-1 keeps them banner-only; making them uniform "for consistency" would undo HOS-1156's funnel.

## 9. Test plan

A unit test per branch of the day-count decision, including both sides of the AC-6 boundary and the unresolved case · a test that an unstarted trial produces navigation and no dialog · a test that cancelling the dialog performs no checkout · banner present/absent pairs (the absent-side assertions of AC-8 need a sibling asserting the same string IS present when a trial runs, or a selector typo passes as a pass) · the AC-11 guard, mutation-verified by adding a second inline comparison and confirming it fails · a test per `ctaMode="link"` page that its href still points at signup → create form.

Mutation-verify every new test: the assertions here are mostly about an ABSENCE (no dialog, no banner, no checkout), which is the shape that passes for the wrong reason most easily.

## 10. Sequencing

Implementation starts after PR #3286 (HOS-1183) merged — done, 2026-09-08 19:07 UTC. The verdict read and its canonical predicate are in `origin/staging`.

**OQ-1 blocks the tourist page only.** The other four can proceed while it is open.
