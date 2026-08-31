---
title: Feature parity audit — accommodation entitlements vs gastronomía and experiencias
linear: HOS-990
statusSource: linear
created: 2026-08-31
type: audit
areas:
  - billing
  - api
  - db
  - web
---

# Feature parity audit — accommodation entitlements vs gastronomía and experiencias

## 1. Summary

Produce the signed-off inventory of **what a commerce plan could grant**, so that
HOS-974/975/976 (gastronomy tiers, experience tiers, commerce addons) have
something real to distribute across tiers.

This spec delivers a **decision document**, not code. It answers three questions
per feature, per vertical:

1. **Does it apply to this vertical?** — yes / no / with changes.
2. **Does the surface that would make it real exist today?** — an entitlement can
   exist and have nothing on the other side of it.
3. **What does it cost to make it real?** — already works / gate missing /
   feature missing.

## 2. Problem

A commerce plan grants nothing. That is not an omission — it is written and
justified in `packages/billing/src/config/plans.config.ts:634-641`:

```ts
// Neither vertical grants any entitlement today (§6.8). Commerce
// visibility is driven by the subscription status through
// `commerce_listing_subscriptions` + the reconciler, not by the
// entitlement engine [...]
entitlements: [],
limits: [limit(input.limitKey, input.maxListings)]
```

All six commerce plans (`gastronomy-basico/pro/premium`,
`experience-basico/pro/premium`) declare `maxListings: 1` and `entitlements: []`.
They are byte-identical shells. **There is nothing to tier yet.** Defining three
prices for three identical plans is not tiering — it is charging differently for
the same thing.

## 3. Baseline — what was measured before writing this spec

Everything in this section is **MEASURED** against the working tree at
`origin/staging` (2026-08-31), with file:line evidence. It is recorded here
because the audit's conclusions depend on it and because two of these findings
contradict what HOS-973 states.

### F-1 · The gap is 25/30/33 vs 0, not 11/17/20 vs 0

HOS-973 reports owner plans granting 11 / 17 / 20 entitlements. Those numbers are
the size of each plan's **own** array only. Every owner plan also inherits
`TOURIST_VIP_ENTITLEMENTS` (15 keys, `plans.config.ts:57-73`) through
`dedupe([...TOURIST_VIP_ENTITLEMENTS, ...])`.

| Plan | Own | Inherited | Deduped total |
|---|---|---|---|
| `owner-basico` | 11 | 15 | **25** |
| `owner-pro` | 17 | 15 | **30** |
| `owner-premium` | 20 | 15 | **33** |

(`owner-basico` verified by hand: 15 + 11 − 1 duplicate — `CAN_CONTACT_WHATSAPP_DISPLAY`
appears in both lists and `dedupe` collapses it.)

**Why this matters beyond the number**: most of the 15 inherited keys are
*tourist-side* — `SAVE_FAVORITES`, `WRITE_REVIEWS`, `PRICE_ALERTS`,
`CAN_COMPARE_ACCOMMODATIONS`, `CAN_USE_COLLECTIONS`. An accommodation owner has
them because the model makes the owner tier inherit the tourist VIP tier. A
commerce owner inherits nothing. That single decision moves the floor of all
three tiers before a single new feature is discussed. See **OQ-1**.

### F-2 · Four gates are phantom — they do not exist for accommodation either

Four entitlement middlewares are written, tested, and wired to **no route**. They
carry an explicit marker in the source:

| Middleware | File:line | Entitlement |
|---|---|---|
| `gateCalendarAccess` | `apps/api/src/middlewares/accommodation-entitlements.ts:264` | `CAN_USE_CALENDAR` |
| `gateExternalCalendarSync` | `apps/api/src/middlewares/accommodation-entitlements.ts:321` | external calendar sync |
| `gateReviewResponse` | `apps/api/src/middlewares/accommodation-entitlements.ts:546` | `RESPOND_REVIEWS` |
| `gateReviewPhotos` | `apps/api/src/middlewares/tourist-entitlements.ts:289` | `CAN_ATTACH_REVIEW_PHOTOS` |

Two further `PHANTOM-GATE` markers sit inside the WhatsApp path
(`accommodation-entitlements.ts:377,460`), noting the gate is still not wired to
any route after HOS-19 shipped the WhatsApp fields.

Separately, `CUSTOM_BRANDING` appears in billing config, the **public plan
comparison** (`apps/web/src/components/billing/plan-comparison-rows.ts`), the
admin entitlement groups, docs and tests — and in **zero middlewares and zero
routes**.

**Consequence for this audit**: some of what would be "ported to commerce" does
not exist anywhere. Porting nothing yields nothing. Every feature this audit
marks as applicable must state whether it is real *for accommodation first*.

### F-3 · The coupling is in consumption, not in resolution

`requireEntitlement` / `hasEntitlement` (`entitlement.ts:909-1051`) and
`resolveOwnerEntitlementsForOwnerId` (`owner-entitlement.ts:381`) are already
domain-agnostic: they operate on `ownerId`/actor and touch no listing table. The
accommodation-specific part lives in the **consumption layer** — routes, feature
middlewares, denormalized columns.

This is the audit's most actionable finding: extending to commerce is mostly
gate-porting work, not architectural redesign.

`gastronomies` and `experiences` already replicate accommodation's
`richDescription`, `videos`, `contactInfo` (WhatsApp included) and
`socialNetworks` shapes, so those three gates need **no schema migration**.

### F-4 · Commerce plans share `category: 'owner'` with accommodation

`PlanCategory` has no `'commerce'` member, so the six commerce plans declare
`category: 'owner'`. The addon gate
`targetCategories.includes(customerPlan.category)`
(`apps/api/src/services/addon.checkout.ts:385`) therefore does **not** block
structurally across verticals. What prevents selling an accommodation addon to a
commerce customer today is the semantics of each addon's
`affectsLimitKey`/`grantsEntitlement`, not the filter. Latent risk if
`ai-support-monthly` (today `isActive: false`) is switched on without revisiting
this. See **OQ-3**.

### F-5 · Two frozen counts in `packages/billing/CLAUDE.md` are stale

It states `EntitlementKey` = 38 (measured: **39**) and `LimitKey` = 20
(measured: **19**). Only 2 of the 19 limit keys are commerce-specific
(`MAX_GASTRONOMIES`, `MAX_EXPERIENCES`).

### F-6 · Experiences have none of the six vertical-specific fields

Measured against `packages/db` and `packages/schemas`:

| Vertical | Field | Exists? |
|---|---|---|
| Gastronomy | menu link | ✅ URL only — no file/PDF upload (HOS-895) |
| Gastronomy | schedules / shifts | ✅ free-form jsonb |
| Gastronomy | price range | ✅ |
| Gastronomy | cuisine type | ❌ — `type` is venue category (RESTAURANT/BAR/…), not cuisine |
| Gastronomy | table booking | ❌ |
| Experience | duration | ❌ (HOS-898) |
| Experience | capacity per departure | ❌ |
| Experience | meeting point | ❌ |
| Experience | season | ❌ |
| Experience | language | ❌ |
| Experience | difficulty | ❌ |

Experiences carry pricing/catalog metadata and nothing else. **Half B is
therefore mostly greenfield for experiences and partially built for gastronomy.**

### F-7 · Featured and verified need a schema migration

`featured_listing` is bound to a real column, `accommodations.featuredByEntitlement`,
and the whole sync/cron machinery writes directly against `accommodations`.
Neither commerce table has that column nor an `isVerified` equivalent.

### F-8 · Statistics do not exist for commerce at all

Zero statistics API routes for gastronomy or experiences (full sweep of both
route trees). The `entity_views` table is generic and already serves `events` and
`posts`, so extending it is plausible; the aggregate dashboard and advanced stats
are written against `AccommodationService` specifically.

## 4. Scope

### Half A · Parity (HOS-973 D-2)

The four families accommodation grants today, evaluated one by one for gastronomy
and for experiences **separately** (D-1: symmetry is not forced):

- **Owner AI** — chat, text improve, translate, listing import.
- **Statistics** — basic and advanced.
- **Visibility and presence** — featured listing, verified badge, rich
  description, video.
- **Contact and relationship** — WhatsApp display, WhatsApp direct, respond to
  reviews, promotions, priority support, custom branding.

Evaluating is not porting. A feature may make no sense in a trade, and **that
negative is written down and justified too** — it is what stops someone
re-proposing it in six months.

### Half B · Vertical-specific features (HOS-973 D-3)

What a restaurant or an excursion has that a cabin does not. This is the only
thing that can give a premium tier a reason to exist other than "the same but
more expensive". Candidates from the field, none decided:

- **Gastronomy** — the menu (HOS-895), shifts and schedules (HOS-906, HOS-825,
  HOS-814), table reservations.
- **Experiences** — duration (HOS-898), capacity per departure, meeting point,
  season, language, difficulty.

## 5. Out of scope

- **Defining tiers or prices.** That is H2/H3.
- **Defining addons.** That is H4.
- **AI search.** HOS-973 holds the distinction: AI search is tourist-side, is not
  an entitlement, is not tiered and is not sold. It is product coverage and
  travels on another track.
- **Implementing any audited feature.** H1 audits and decides; building is later
  work.

## 6. Method

Each feature gets a verdict **per vertical**, in a single fixed vocabulary:

| Verdict | Meaning |
|---|---|
| `ALREADY WORKS` | code is already domain-agnostic or already contemplates commerce |
| `GATE MISSING` | the feature exists and is reusable; the check or routing assumes accommodation |
| `FEATURE MISSING` | nothing exists on the commerce side to switch on |
| `PHANTOM` | does not exist for accommodation either (see F-2) |
| `DOES NOT APPLY` | deliberate negative, with written justification |

Every statement about the state of the code is labelled **MEASURED** (read in the
code, with file:line) or **INFERRED**. Before asserting an absence, at least two
naming conventions must be searched, and both stated.

## 7. Open questions for the owner

These block the audit's conclusions, not its research. They are surfaced early
because each one changes what the tiers can contain.

- **OQ-1 · Does a commerce owner inherit the tourist VIP tier?** Accommodation
  owners inherit 15 tourist-side entitlements. Commerce owners inherit nothing.
  Answering "yes" raises the floor of every commerce tier by 15 keys before any
  new feature is discussed; answering "no" means commerce owners are, as
  customers of the site, worth less than a free tourist.
- **OQ-2 · What happens to the four phantom gates?** Calendar, external calendar
  sync, respond-to-reviews and review photos are sold in the comparison table and
  enforced nowhere. Do they get built before being promised to a second set of
  verticals, or do they get pulled from the comparison?
- **OQ-3 · Does `PlanCategory` need per-vertical values?** Today all six commerce
  plans are `category: 'owner'`, so the addon category filter is not a real
  barrier (F-4).
- **OQ-4 · What shape does `HOSPEDA_COMMERCE_PLAN_SLUGS` take with tiers?** It is
  validated by Zod today (`apps/api/src/utils/env.ts:220-228`, inside the
  `.superRefine`). With tiers, resolution stops being a value and becomes a map.

## 8. Acceptance criteria

- **AC-1** — Every feature in the four families has a verdict per vertical
  (gastronomy and experiences, separately), with written justification. No empty
  cells.
- **AC-2** — Every applicable verdict declares its real state measured against
  the code, using the §6 vocabulary. Measured, not assumed.
- **AC-3** — Half B delivers a list of vertical-specific features per vertical,
  each with an owner verdict and a coarse effort estimate.
- **AC-4** — Every feature left in `FEATURE MISSING` without its own issue has
  one by the time H1 closes — or is explicitly recorded as a won't-do.
- **AC-5** — The document distinguishes MEASURED from INFERRED on every statement
  about the state of the code.
- **AC-6** — The four open questions in §7 are answered and recorded on HOS-990.

## 9. Constraints

- **R-1 · Separate domains.** Gastronomy and experiences are distinct
  `ProductDomainEnum` values. No conclusion may group them under "commerce";
  `'commerce'` is a retired value that survives only on legacy rows, and such a
  row satisfies neither vertical — going dark is the intended failure mode.
- **R-2 · The limit engine resolves "unknown" as UNLIMITED.** HOS-688 documents
  five layers failing open on an unknown key, none of which raise. The symptom of
  a miswired cap is not a crash — it is giving the product away, and you find out
  by counting rows. Any limit this audit proposes must be assertable end-to-end
  against the real route, never by calling `checkLimit` with a hand-built context.
- **R-3 · Dual-write is mandatory.** `plans.config.ts`, `addons.config.ts` and
  `limits.config.ts` are all in `BILLING_CONFIG_FILES`
  (`scripts/check-seed-dual-write.sh:255-261`, five files). Any change needs the
  baseline **and** a numbered data migration in the same PR, or staging and
  production never receive it.
- **R-4 · Frozen counts will move.** Adding plans or addons breaks count tests in
  `plans.test.ts`, `commerce-plan.test.ts` and `addons.test.ts`. Breaking is
  correct — running them before pushing is mandatory. Note F-5: two counts in
  `packages/billing/CLAUDE.md` are already stale.
- **R-5 · Plan resolution is env-driven.** `resolveCommercePlanSlug`
  (`apps/api/src/services/commerce-plan-resolver.ts`) returns 503 when the value
  is missing. HOS-688 states that file was written explicitly for the day a
  second plan exists, and that the branch belongs there and nowhere else.

## 10. Deliverables

1. `docs/audit-parity.md` in this spec folder — the completed Half A matrix.
2. `docs/audit-vertical-features.md` — the completed Half B inventory.
3. Linear issues for every `FEATURE MISSING` item without one (AC-4).
4. The four OQ answers recorded on HOS-990.

## 11. Related

- **HOS-973** — parent: the full diagnosis and decisions D-1/D-2/D-3.
- **HOS-688** — created the six shell plans and the two caps. The foundation.
- **HOS-818** — moved the sellable role from premium to basic, freeing the
  "premium" name for a tier that genuinely offers more.
- **HOS-400** — AI chat in gastronomy and experiences. Direct Half A candidate.
- **HOS-734** — neither vertical has any statistics. Direct Half A candidate (F-8).
- **HOS-895 / HOS-898** — menu file upload and experience duration. Half B.
- **HOS-941** — the plan index page, which today shows one tier per vertical.
- **HOS-932** — precedent for H4: do not switch on an addon before the product it
  extends exists.
