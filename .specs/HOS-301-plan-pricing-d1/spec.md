---
title: Apply the D1 pricing decision (plans, addon, tourist trial, tourist-plus)
linear: HOS-301
statusSource: linear
created: 2026-08-11
type: chore
areas:
  - billing
  - db
  - web
  - admin
---

# Apply the D1 pricing decision (plans, addon, tourist trial, tourist-plus)

## 1. Summary

Apply the owner's **D1 decision** on HOS-301 to every layer that carries a price:
reprice two owner plans, raise the `extra-accommodations-5` addon, raise the tourist
trial from 14 to 30 days, and deactivate `tourist-plus`.

The decision itself is already made and recorded — see the
[D1 comment on HOS-301](https://linear.app/hospeda-beta/issue/HOS-301) (2026-08-11),
which is the canonical source for the grid below. This spec covers only **how it lands
in code and in already-seeded environments**.

## 2. Problem

Two distinct problems, and the second is the one that makes this spec non-trivial.

**The values are placeholders.** Every plan price still carries the number it was born
with on 2026-01-29 (`933fecdf6`). They were never validated as real market prices, and
HOS-301 exists to fix that before launch.

**The decision was made and then lost.** D1 was resolved on 2026-07-25 inside the
SMOKE-23-07 batch. It was used to write HOS-331's description — which still says, in
prose, *"`owner-basico` cuesta $15.000/mes hoy ($18.000 tras D1)"* — but it was never
written back to HOS-301 and never implemented. Verified with
`git log --all -S "monthlyPriceArs" -- packages/billing/src/config/plans.config.ts`:
**no branch, at any point, changed these prices.** There is no half-finished work to
recover.

**And the trap underneath both.** `monthlyPriceArs`, `annualPriceArs`, `active`,
`hasTrial` and `trialDays` are all classified `'commercial'` in
`packages/billing/src/config/model-c-field-split.ts` — meaning **the DB wins over the
config**. The seeder detects divergence and logs it, but never overwrites. So editing
`plans.config.ts` alone corrects a fresh `db:fresh` and *nothing else*: staging and
production keep the old value forever. Confirmed empirically — `GET /api/v1/public/plans`
on both environments returns exactly the config values today, and the public pricing
page reads that endpoint at runtime (SPEC-168 D3), not `ALL_PLANS` at build time.

Every item in this spec therefore needs the **dual write** the HOS-25 rule mandates:
baseline fixture **and** a numbered data-migration, in the same PR.

## 3. Goals

- **G-1** — `owner-basico` at ARS 18.000/month, 180.000/year; `owner-premium` at
  ARS 65.000/month, 650.000/year. `owner-pro` unchanged.
- **G-2** — the `extra-accommodations-5` addon at ARS 13.000/month.
- **G-3** — tourist plans trial at 30 days, without moving the owner-plan trial.
- **G-4** — `tourist-plus` deactivated (`active = false`), not deleted — the same
  reversible treatment the `complex-*` plans got in HOS-16.
- **G-5** — every one of the above lands on already-seeded environments (staging and
  production), not only on a fresh database.

## 4. Non-goals

- **NG-1** — deleting `tourist-plus` or any of its rows, i18n keys, tests or fixtures.
  Owner decision (2026-08-11): deactivate, stay reversible.
- **NG-2** — reactivating the `complex-*` plans, or changing anything about them.
- **NG-3** — repricing `commerce-listing`, `partner-silver`, `partner-gold` or
  `owner-test-daily`. Out of D1's scope.
- **NG-4** — building or enabling any part of the HOS-176 price-propagation machinery.
  This spec assumes there are no live paying subscribers (see R-1); if that assumption
  breaks, the propagation work is a separate spec, not a widening of this one.
- **NG-5** — the quarterly/biannual billing intervals discussed alongside HOS-278.

## 5. Current baseline

### 5.1 Values in force today

| Plan / item | Monthly (centavos) | Annual (centavos) | Source |
|---|---|---|---|
| `owner-basico` | `1500000` | `15000000` | `plans.config.ts:108-110` |
| `owner-pro` | `3500000` | `35000000` | `plans.config.ts:151-153` |
| `owner-premium` | `7500000` | `75000000` | `plans.config.ts:201-203` |
| `tourist-plus` | `500000` | `5000000` | `plans.config.ts:450-451`, `active: true` |
| `extra-accommodations-5` | `1000000` | `9600000` (20% off) | `addons.config.ts:59-73` |
| Tourist trial | 14 days | — | `billing.constants.ts:6-18` |

Staging and production `billing_plans` match these exactly (verified against
`GET /api/v1/public/plans` on both, 2026-08-11).

### 5.2 Constraints worth knowing before writing code

1. **`TOURIST_TRIAL_DAYS` is an alias, not an independent constant.**
   `packages/billing/src/constants/billing.constants.ts:6-18` declares
   `export const TOURIST_TRIAL_DAYS = OWNER_TRIAL_DAYS;`, with a JSDoc saying the intent
   is that the tourist tier "can never drift from the owner tier". D1 breaks that intent
   deliberately: the constant must become its own literal before it can be raised, or the
   owner-plan trial moves with it.

2. **Changing `trialDays` needs no manual MercadoPago work.** The MP `preapproval_plan`
   registry (`billing_mp_plans`, via
   `apps/api/src/services/billing/mp-plan-provisioning.service.ts`) is keyed on
   `(commercialPlanId, billingInterval, trialDays, discountCycle1AmountCentavos)`. Moving
   14 → 30 is a **key miss**, not a mutation: the next checkout lazily provisions a new
   `preapproval_plan` at 30 days, and the old 14-day row lingers as a harmless orphan
   (nothing archives it — `archiveMpPlanBestEffort` only fires on a price-drift
   re-provision of the *same* key). Subscribers already trialing are untouched: MP
   preapprovals are immutable once created.

3. **No precedent exists for an addon price migration.** The only price-raising
   data-migration in the repo, `0022-raise-commerce-listing-price-to-15000.ts`, targets
   `billing_plans` / `billing_prices`. The addon catalog persists to `billing_addons`,
   a different table — its column names must be confirmed before modeling the migration.

4. **`ChangePlanDialog.tsx` does not filter by `isActive`.** Recorded as point 6 of
   HOS-331: it filters `ALL_PLANS` by category and slug only, so it already offers the
   deactivated `complex-*` plans as plan-change targets today. Deactivating
   `tourist-plus` adds a fourth ghost to that list.

5. **The old blocker is gone.** `.remember` from 2026-07-25 recorded a
   `PlanComparisonTable.astro` index-mapping bug as blocking the `tourist-plus`
   deletion. HOS-329 fixed it — `plan-comparison-rows.ts` now derives each cell from
   `plan.entitlements` / `plan.limits` per plan rather than by column position. It no
   longer constrains this work.

6. **Deactivation keeps the blast radius small.** Because `tourist-plus` stays in
   `ALL_PLANS` (exactly like `complex-*`), the fixed-count assertions across
   `packages/billing/test/**` (`toHaveLength(9)`, tourist `toHaveLength(3)`) stay valid,
   the ~13 i18n keys stay meaningful, and the `tourist-plus@local.test` seed user keeps
   working (it inserts straight into the DB). Deleting the plan would have touched
   roughly 30 files; deactivating touches three.

## 6. Proposed design

Four independent PRs, ordered by risk. Each carries its own data-migration, per the
HOS-25 dual-write rule.

### PR 1 — Reprice the owner plans

Baseline: `owner-basico` → `monthlyPriceArs: 1800000`, `annualPriceArs: 18000000`;
`owner-premium` → `6500000` / `65000000`. `monthlyPriceUsdRef` follows the ARS = 1000 × USD
convention the D1 audit established (18 and 65) — pending OQ-2.

Migration modeled directly on `0022`: one guarded `UPDATE` per row, four rows total per
plan-pair — `billing_plans.monthlyPriceArs`, `billing_plans.annualPriceArs`, and the two
sibling `billing_prices.unitAmount` rows (`billingInterval` `month` and `year`,
`currency = 'ARS'`, `intervalCount = 1`).

### PR 2 — Raise the `extra-accommodations-5` addon

Baseline `priceArs: 1300000`, plus its annual counterpart (OQ-1). New migration shape
against `billing_addons`; confirm the schema first (see 5.2 §3).

### PR 3 — Tourist trial 14 → 30 days

Decouple `TOURIST_TRIAL_DAYS` from `OWNER_TRIAL_DAYS` and set it to `30`, then a
metadata migration modeled on `0017-hos-210-tourist-plan-trial.ts` (which already writes
`hasTrial` / `trialDays` into `billing_plans.metadata` for the tourist plans, guarded so
an operator's admin edit is never clobbered).

Fold in the copy fix: the tourist FAQ currently claims **7 days**
(`packages/i18n/src/locales/*/billing.json` → `pricing.tourist.faq.items.2.answer`),
which is wrong today and would be wrong twice over after this change. Listed as bug 4 in
HOS-331.

### PR 4 — Deactivate `tourist-plus`

`isActive: false` in `plans.config.ts`, carrying an inline comment in the same shape the
`complex-*` plans use, plus a migration calqued on
`0003-hos16-deactivate-complex-plans.ts` (`.set({ active: false })` guarded by
`WHERE active = true`, so a re-run is a true no-op).

Fold in the `ChangePlanDialog.tsx` `isActive` filter (5.2 §4) — same file, same class of
bug, and this PR is what makes it visible on the tourist side.

### Rollout

Per environment, in order: `db:migrate` → `db:apply-extras` → `db:seed:migrate`. Staging
first, verified against `GET /api/v1/public/plans`, then production — which is currently
13 migrations behind and must be brought forward before any of this applies.

## 7. Data model / contracts

No schema migration. Four **seed data-migrations** (`packages/seed/src/data-migrations/`),
numbered from `0049` in merge order, all `group: 'required'`, all `destructive: false`:

| # | Target | Columns | Guard |
|---|---|---|---|
| PR 1 | `billing_plans`, `billing_prices` | `monthlyPriceArs`, `annualPriceArs`, `unitAmount` | `WHERE <col> = <old value>` |
| PR 2 | `billing_addons` | price column (TBC) | `WHERE <col> = 1000000` |
| PR 3 | `billing_plans` | `metadata.trialDays`, `metadata.hasTrial` | per `0017` (skips operator edits) |
| PR 4 | `billing_plans` | `active` | `WHERE active = true` |

The old-value guard is what makes each one idempotent **and** operator-safe: a second run
matches zero rows, and a value an operator already changed through the SPEC-168 admin UI
is left alone rather than overwritten. Every migration must also no-op cleanly when the
target row does not exist on that environment.

No API contract changes. `GET /api/v1/public/plans` already filters on `active = true`,
so PR 4 removes `tourist-plus` from the payload with no route change.

## 8. UX / UI behavior

- Public pricing pages update **without a redeploy** — they fetch the endpoint at runtime
  (`apps/web/src/lib/billing/fetch-plans.ts`). New prices appear as soon as the migration
  runs.
- `tourist-plus` disappears from the tourist pricing grid and the comparison table:
  `filterPlansByCategory` drops inactive plans. Check
  `apps/web/src/pages/[lang]/suscriptores/turistas/index.astro:65`, which hardcodes
  `'tourist-plus'` as the fallback highlighted slug.
- The admin plan-change dialog stops offering inactive plans (PR 4).
- Trial badges and FAQ copy read 30 days for tourist plans, 14 for owner plans.

## 9. Acceptance criteria

- **AC-1** — `GET /api/v1/public/plans` on staging returns `owner-basico` at
  `1800000`/`18000000` and `owner-premium` at `6500000`/`65000000`.
- **AC-2** — the same endpoint no longer returns `tourist-plus`.
- **AC-3** — `billing_prices.unitAmount` matches `billing_plans.monthlyPriceArs` /
  `annualPriceArs` for both repriced plans. A drift here means MercadoPago charges a
  different amount than the site advertises.
- **AC-4** — a fresh `pnpm db:fresh-dev` produces the same values as a migrated
  environment, for every item in the grid. This is the dual-write proof.
- **AC-5** — re-running `pnpm db:seed:migrate` reports 0 rows updated for all four
  migrations.
- **AC-6** — a new tourist checkout provisions an MP `preapproval_plan` with a 30-day
  trial; a new owner checkout still gets 14.
- **AC-7** — the admin plan-change dialog lists neither `tourist-plus` nor any
  `complex-*` plan.
- **AC-8** — no user-facing surface claims 7 or 14 days for a tourist trial.
- **AC-9** — full suite green, including the three `apps/e2e` specs that use
  `tourist-plus` as an actor (see R-2).

## 10. Risks

- **R-1 — `owner-basico` is an increase (15.000 → 18.000).** With live subscribers this
  triggers the HOS-176 flow: D-3 advance notice, preapproval re-pricing, Disp. 954/2025
  grace — and that path is gated off by `HOSPEDA_BILLING_PRICE_INCREASE_ENABLED=false`.
  The D1 audit counted 6 test subscriptions and HOS-301 is explicitly framed as
  pre-launch, so the expectation is that this does not apply. **Confirm the live
  subscriber count before touching production.** `owner-premium` moves *down*, which is
  the immediate-apply path and carries no notice requirement.
- **R-2 — three `apps/e2e` specs use `tourist-plus` as their actor**
  (`guest-05-accommodation-compare`, `guest-06-exclusive-deals`,
  `spec-098/e2e-03-collections-crud`). The row still exists, so `resolvePlanIdBySlug`
  keeps resolving, but any flow that routes through the public pricing page will not find
  the plan. Must be run, not assumed.
- **R-3 — the trial alias.** Raising `TOURIST_TRIAL_DAYS` without decoupling it silently
  raises the owner trial too. A test asserting both values independently is the cheap
  guard.
- **R-4 — the addon migration has no precedent** and targets a table nothing has migrated
  before. Highest chance of a surprise in PR 2, which is why it is not first.
- **R-5 — orphan MP plans.** PR 3 leaves the old 14-day tourist `preapproval_plan` rows in
  `billing_mp_plans` with nothing to clean them. Harmless and documented, but worth a
  follow-up issue if the count grows.

## 11. Open questions

- **OQ-1** — annual price for the `extra-accommodations-5` addon. Keeping the current 20%
  discount off 13.000 × 12 gives `12480000`. Proposed, not confirmed.
- **OQ-2** — `monthlyPriceUsdRef` for the repriced plans. Following the ARS = 1000 × USD
  convention from the D1 audit gives 18 and 65. The field is currently unused anywhere in
  the product, so the cost of getting it wrong is low — but it should not silently drift.
- **OQ-3** — HOS-301's original scope also covered **default discounts and the seeded
  promo-code values**. D1 did not decide anything about them. Either the owner rules on
  them (widening this spec) or they stay open on HOS-301 after this ships.
- **OQ-4** — are there any live paying subscribers on `owner-basico`? Gates R-1.

## 12. Implementation notes

- Scaffold each migration with `pnpm db:seed:make <slug>` so the numbering and ledger
  entry are generated correctly. Never hand-number.
- The three moulds to copy, in decreasing order of fit:
  `0022-raise-commerce-listing-price-to-15000.ts` (plan prices),
  `0017-hos-210-tourist-plan-trial.ts` (trial metadata),
  `0003-hos16-deactivate-complex-plans.ts` (the `active` flag).
- `scripts/check-seed-dual-write.sh` is fail-closed and will reject a PR that edits the
  billing config without a migration. That is the intended behavior here, not an obstacle
  to route around.
- Plan rows are matched by `billing_plans.name`, which holds the **slug** — there is no
  separate slug column and no unique constraint. Every existing migration matches this
  way; follow it.
- Money is integer centavos. ARS 18.000 is `1800000`.
- Record migrations added and any env change on the HOS-301 Linear issue, not here.

## 13. Linear

Canonical tracking:
[HOS-301](https://linear.app/hospeda-beta/issue/HOS-301) — the D1 comment of 2026-08-11
holds the authoritative grid.
