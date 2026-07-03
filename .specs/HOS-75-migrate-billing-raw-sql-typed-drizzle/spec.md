---
title: "Migrate billing raw-SQL column access to typed Drizzle"
linear: HOS-75
statusSource: linear
type: chore
areas: [api, service-core, db, seed]
created: "2026-07-03"
---

# Migrate billing raw-SQL column access to typed Drizzle

## Part 1: Functional Specification

### Overview & Goals

- **Goal**: Replace every raw `sql\`...\``template that reads or writes the 6
  billing columns below with normal typed Drizzle queries (`eq()`,`.set({...})`,
  `db.query...`), and delete the hand-written row interfaces / defensive
  camelCase-snake_case dual-reads that existed only because those columns weren't
  in the TS schema.
- **Motivation**: `@qazuor/qzpay-drizzle` was bumped to `1.11.0` in HOS-73
  (hospeda PR [#2031](https://github.com/qazuor/hospeda/pull/2031), upstream
  [qzpay#47](https://github.com/qazuor/qzpay/pull/47)) and now declares these
  columns in its typed Drizzle schema. The raw SQL that worked around their
  absence is now unnecessary technical debt — this is a pure
  readability/maintainability cleanup, **not** a behavior change. Postgres does
  not care whether a column is reached via `db.execute(sql\`...\`)` or
  `db.select().where(eq(...))`; the six columns, their types, defaults, and
  constraints are unchanged.
- **Success metrics**:
  - Zero `sql\`...\`` templates remain that reference `product_domain`,
    `promo_effect_remaining_cycles`,`effect_kind`,`value_kind`,
    `duration_cycles`, or`extra_days` (except the one genuinely
    Drizzle-invisible case documented in Out of Scope).
  - Zero hand-written row interfaces (e.g. `{ product_domain: string }`) remain
    for these columns.
  - The `record.productDomain ?? record.product_domain` dual-read in
    `isAccommodationSubscription` is gone; only `record.productDomain` remains.
  - `pnpm --filter @repo/service-core typecheck`, `pnpm --filter @repo/api
    typecheck`, and the full existing billing/promo-code/webhook/cron test
    suites pass unchanged (same assertions, no test rewritten to accommodate
    new behavior — only mocks/fixtures may need updating to match Drizzle's
    query shape instead of raw `db.execute` return shape).
- **Target users**: Internal only — Hospeda engineers maintaining the billing
  domain. No end-user-facing change of any kind.

### User Stories & Acceptance Criteria

This is an internal refactor with no user-facing behavior change, so "user
stories" below are framed from the maintaining engineer's perspective. Every
acceptance criterion is phrased so it maps directly to a test assertion.

#### US-1: Typed product-domain access

**As a** developer maintaining subscription/plan code, **I want** all
`product_domain` reads and writes to go through typed Drizzle, **so that** the
compiler catches typos/type mismatches on this column and I don't need to
remember two casing conventions.

**Acceptance Criteria:**

- **Given** `isAccommodationSubscription(sub)` is called with a subscription
  object fetched via a typed Drizzle query, **When** the function reads
  `productDomain`, **Then** it reads only `sub.productDomain` (no `??
  sub.product_domain` fallback) and returns the same boolean it did before the
  refactor for every existing test case in
  `spec-239-entitlement-isolation.test.ts`.
- **Given** `listPlans.ts`'s `getNonAccommodationPlanSlugs()` is called,
  **When** it queries `billingPlans`, **Then** it uses
  `ne(billingPlans.productDomain, ProductDomainEnum.ACCOMMODATION)` instead of
  `sql\`... IS DISTINCT FROM ...\`` and returns the identical set of plan names
  for every existing fixture in `listPlans.test.ts` /
  `listPlans.partner-domain.test.ts`.
- **Given** `subscription-checkout.service.ts` creates a commerce or partner
  subscription, **When** it stamps `product_domain`, **Then** it uses
  `tx.update(billingSubscriptions).set({ productDomain: ... })` instead of raw
  `UPDATE`, and `subscription-checkout.service.test.ts` still passes.
- **Given** `subscription-comp-create.service.ts` creates or gates a comp
  subscription, **When** it reads/writes `product_domain`, **Then** it uses
  typed Drizzle, and `subscription-comp-create.service.test.ts` still passes
  (including the assertions on lines 73-172 that currently check
  `db.execute` mock calls — these must be updated to check the typed
  `db.update`/`db.select` mock calls instead, same resulting values).
- **Given** `partners/admin/list-plans.ts` filters plans by
  `product_domain = 'partner'`, **When** the route is called, **Then** it uses
  a typed `eq(billingPlans.productDomain, ProductDomainEnum.PARTNER)` filter,
  and a **new** test file (`list-plans.test.ts`, currently nonexistent) passes
  covering: success response shape, the partner-domain filter actually
  excluding non-partner plans, and the correlated price subquery still
  returning the same shape.
- **Given** `featured-entitlement.resolver.ts` reads a subscription's
  `product_domain` to resolve accommodation-featured entitlement, **When** it
  queries `billingSubscriptions`, **Then** it uses typed column access, and
  `featured-entitlement.resolver.test.ts` still passes.
- **Given** the seed scripts `commercePlan.seed.ts` and `partnerPlan.seed.ts`
  create a plan row, **When** they stamp `product_domain`, **Then** they pass
  it directly in the `.insert({...})` values object (no follow-up raw
  `UPDATE`), and `pnpm db:seed:required` still produces plans with the correct
  `product_domain` value (verified via a local seed run, see Verification).

#### US-2: Typed promo-code effect access

**As a** developer maintaining promo-code logic, **I want** all
`effect_kind`/`value_kind`/`duration_cycles`/`extra_days`/
`promo_effect_remaining_cycles` reads and writes to go through typed Drizzle,
**so that** the compiler enforces the `PromoEffectKindEnum` shape instead of
relying on hand-written row interfaces that can silently drift from the schema.

**Acceptance Criteria:**

- **Given** `promo-code.crud.ts`'s `promoCodeColumnsWithEffect()` currently
  manually projects `effect_kind`/`value_kind`/`duration_cycles`/`extra_days`
  via `sql<string | null>\`effect_kind\`` alongside `getTableColumns(...)`,
  **When** these columns are typed, **Then** the helper collapses to a plain
  `getTableColumns(billingPromoCodes)` call (no manual projection), and every
  caller of `promoCodeColumnsWithEffect()` gets the identical field set with
  identical values.
- **Given** `promo-code.crud.ts`'s `persistEffectColumns()` currently issues a
  separate raw `UPDATE` immediately after an `INSERT` (one of 3 branches:
  comp / trial_extension / discount), **When** the effect columns are known at
  insert time, **Then** they are set directly in the `.insert({...})` values
  object and the separate `persistEffectColumns()` UPDATE step is deleted
  entirely (verified: nothing else in the INSERT needs the row's generated
  `id` to compute effect-column values, so folding them into the insert is
  safe — confirmed by reading the 3 branches).
- **Given** `promo-code.redemption.ts` sets `promo_effect_remaining_cycles` on
  redemption, **When** it applies a discount effect, **Then** it uses
  `.update(billingSubscriptions).set({ promoEffectRemainingCycles: ... })`,
  and `promo-code.redemption.test.ts` still passes.
- **Given** `promo-code.renewal.ts`'s `resolveRenewalPromoEffect` reads
  `promo_code_id`/`promo_effect_remaining_cycles` on every renewal webhook,
  and its `persistRemainingCycles()` decrements the same column, **When**
  both are migrated, **Then** both use the new shared typed helper described
  in US-3, and `promo-code.renewal.test.ts` still passes.
- **Given** `promo-discount-apply.service.ts` reads subscription state and
  then sets `promo_effect_remaining_cycles = durationCycles` (the B1 fix that
  corrects the reducer's N-1 seed), **When** migrated, **Then** both the
  SELECT and UPDATE become typed Drizzle, and
  `promo-discount-apply.service.test.ts` still passes with the same corrected
  value.
- **Given** `subscription-discount-signup.service.ts` stamps `promo_code_id`
  and seeds `promo_effect_remaining_cycles` at signup, **When** migrated,
  **Then** it uses a typed `.update().set({...})`, and
  `subscription-discount-signup.service.test.ts` still passes.
- **Given** `billingPromoCodes.seed.ts` creates promo-code rows with effect
  columns via a raw `UPDATE` after insert, **When** migrated, **Then** the
  effect columns are set directly in `.insert({...})`, and a local
  `pnpm db:seed:required` run produces promo codes with correct
  `effect_kind`/`value_kind`/`duration_cycles`/`extra_days` values.

#### US-3: Deduplicated typed helper for the repeated discount-state read

**As a** developer touching billing webhooks/crons, **I want** one shared
typed function to load a subscription's discount-relevant state, **so that**
I don't maintain 4 near-identical copies of the same query.

**Acceptance Criteria:**

- **Given** `payment-logic.ts`, `dunning.job.ts`, `subscription-poll.job.ts`,
  and `apply-scheduled-plan-changes.ts` currently each run their own raw
  `SELECT` (some subset of `id, status, plan_id, mp_subscription_id,
  promo_code_id, promo_effect_remaining_cycles`) against
  `billing_subscriptions`, **When** migrated, **Then** all 4 call a new shared
  export (see Architecture) that returns the full typed superset, and each
  file destructures only the fields it needs.
- **Given** the shared helper is introduced, **When** each of the 4 call
  sites is migrated, **Then** their respective existing test files
  (`payment-logic.test.ts`/`.cutover.test.ts`, `dunning.job.test.ts`,
  `subscription-poll.job.test.ts`, `apply-scheduled-plan-changes.test.ts`)
  pass unchanged in their assertions (mocks updated to mock the shared helper
  or the underlying `db.select` call instead of `db.execute`).

#### US-4: Documentation reflects reality

**As a** developer reading `CLAUDE.md` / `docs/guides/migrations.md` /
`ADR-035` / `packages/service-core/CLAUDE.md`, **I want** them to accurately
describe these 6 columns as typed Drizzle columns (not extras-carril), **so
that** I don't waste time looking for a deleted extras file or assume raw SQL
is still required.

**Acceptance Criteria:**

- **Given** the 5 docs identified in Technical Approach cite the deleted file
  `extras/017-billing-plans-product-domain.column.sql` or describe these
  columns as "Drizzle-invisible", **When** this spec's docs task is done,
  **Then** each reference is corrected to point at the real source (the
  qzpay-drizzle package schema + `packages/db/src/migrations/0044_adorable_longshot.sql`)
  and no longer claims raw SQL is required for these 6 columns.

### UX Considerations

Not applicable — zero UI, zero user-facing behavior change. No user flows,
loading states, or accessibility concerns. (Documented here only to explicitly
confirm this section was considered, not skipped.)

### Out of Scope

- **Changing the 6 columns' actual DB types, constraints, or defaults.**
  Owned by `@qazuor/qzpay-drizzle`; already shipped in HOS-73. This spec only
  changes how *Hospeda's application code* reads/writes them.
- **`packages/db/src/migrations/extras/020-promo-code-effect-constraints-backfill.sql`.**
  This does CHECK constraints + a one-time backfill — genuinely
  Drizzle-invisible (not a column-declaration problem), stays in the extras
  carril untouched.
- **`feature_flags`/`feature_flag_audit_log` extras-carril duplication.**
  HOS-73 flagged this as a separate, unrelated finding ("possible duplication
  between carriles, not investigated"). Out of scope here — track separately
  if it needs fixing.
- **`promo-code.validation.ts` and `effect-reducer.ts`.** Confirmed during
  spec research: their `sql\`\`` tags / logic don't touch the 6 columns
  (unrelated `AND` conditions / pure functions over already-typed
  `PromoEffect` objects). No changes needed.
- **Any change to public API request/response shapes.** Every touched
  function's exported signature and `Result<T>` shape stays identical — this
  is an internals-only swap confirmed safe because none of the ~30 touched
  files are consumed outside `apps/api`/`packages/service-core`.
- **New tests beyond the 1 net-new file** (`partners/admin/list-plans.test.ts`).
  No new functionality means no new BDD acceptance criteria beyond the ones
  above; the rest of the testing burden is verifying existing suites still
  pass.

## Part 2: Technical Analysis

### Architecture

- **Pattern**: mechanical raw-SQL → Drizzle query-builder substitution,
  file-by-file, grouped into 3 sequential phases/PRs by domain (see
  Implementation Approach). No new architectural pattern introduced.
- **Components (modified, not new)**:
  - `packages/service-core/src/services/billing/subscription/subscription-product-domain.ts`
    — `isAccommodationSubscription` loses its dual-read; gains the new shared
    discount-state helper as a sibling export (see below).
  - `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts`
    — `promoCodeColumnsWithEffect()` collapses; `persistEffectColumns()` is
    deleted, folded into `.insert({...})`.
  - ~27 other files switch individual `sql\`\`` call sites to
    `eq()`/`ne()`/`.set({...})`/`db.query...` — see the full file list in the
    Implementation Approach phases below (same list the Linear issue
    provided, plus the 5 gap files found during spec research).
- **New shared helper** (US-3): add
  `loadSubscriptionDiscountState({ subscriptionId }): Promise<{ id: string; status: string; planId: string; mpSubscriptionId: string | null; promoCodeId: string | null; promoEffectRemainingCycles: number | null } | null>`
  to `subscription-product-domain.ts` (same file already owns the
  product-domain-scoped subscription helpers, so this is a natural sibling,
  not a new file). Implemented as:

  ```ts
  export async function loadSubscriptionDiscountState(
    { subscriptionId }: { subscriptionId: string }
  ): Promise<SubscriptionDiscountState | null> {
      const db = getDb();
      const [row] = await db
          .select({
              id: billingSubscriptions.id,
              status: billingSubscriptions.status,
              planId: billingSubscriptions.planId,
              mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
              promoCodeId: billingSubscriptions.promoCodeId,
              promoEffectRemainingCycles: billingSubscriptions.promoEffectRemainingCycles
          })
          .from(billingSubscriptions)
          .where(eq(billingSubscriptions.id, subscriptionId))
          .limit(1);
      return row ?? null;
  }
  ```

  Each of the 4 call sites (`payment-logic.ts`, `dunning.job.ts`,
  `subscription-poll.job.ts`, `apply-scheduled-plan-changes.ts`) replaces its
  local raw `SELECT` with a call to this helper and destructures only the
  fields it uses. `subscription-poll.job.ts`'s bulk variant (loads for *all*
  active discounted subs, not just one) is the one call site that does NOT
  fit this single-row helper shape — it stays as its own typed
  `db.select({...}).from(billingSubscriptions).where(and(eq(status,
  'active'), isNotNull(promoCodeId)))` (no raw SQL either way, just not using
  the shared single-row helper).
- **Integration points**: none new — every touched file already imports
  `getDb()`/`db`/`eq`/`sql` from `@repo/db` today; this swaps `sql` imports
  for `eq`/`ne`/`and`/`getTableColumns` imports (already-available exports
  from `drizzle-orm`, already used elsewhere in this codebase).
- **Data flow**: unchanged. Same tables, same columns, same transaction
  boundaries (`withTransaction`/`tx.update` stays wherever it already wraps a
  raw `tx.execute`).

### Data Model Changes

None. All 6 columns already exist and are already typed in the Drizzle schema
as of HOS-73/`@qazuor/qzpay-drizzle@1.11.0`. This spec is pure application-code
cleanup — no new migration, no schema change.

| Table/Schema | Change | Description |
|-------------|--------|-------------|
| `billing_plans` | none | `productDomain` already typed (HOS-73) |
| `billing_subscriptions` | none | `productDomain`, `promoEffectRemainingCycles` already typed (HOS-73) |
| `billing_promo_codes` | none | `effectKind`, `valueKind`, `durationCycles`, `extraDays` already typed (HOS-73) |

**Migrations needed**: no.

### API Design

No endpoint request/response contract changes. The one route with test-gap
(`GET /api/v1/admin/partners/plans` — `partners/admin/list-plans.ts`) keeps
its existing response shape; only its internal query implementation changes.
No new endpoints, no error-code changes.

### Dependencies

**External packages:** none new — `@qazuor/qzpay-drizzle@1.11.0` and
`drizzle-orm` are already installed and already used throughout this
codebase.

**Internal packages affected:**

- `apps/api` — ~19 files across `routes/billing`, `routes/partners`,
  `routes/commerce`, `routes/webhooks/mercadopago`, `services/`,
  `cron/jobs/`, `middlewares/`.
- `packages/service-core` — ~9 files across
  `services/billing/subscription/`, `services/billing/promo-code/`,
  `services/accommodation/`.
- `packages/seed` — 3 files (`commercePlan.seed.ts`, `partnerPlan.seed.ts`,
  `billingPromoCodes.seed.ts`).
- `packages/schemas` — 1 file, comment-only cleanup
  (`promo-code.schema.ts:291`, stale "added via extras/018" JSDoc).
- `packages/db` — 0 code changes; only referenced because the docs cleanup
  touches `packages/db`-adjacent documentation.

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| A migrated query subtly changes NULL-handling (e.g. `IS DISTINCT FROM` vs `ne()`) | L | M | Confirmed via schema read: `productDomain` is `.notNull().default(...)` on both `billingPlans` and `billingSubscriptions`, so no NULL is ever possible for that column — `ne()` is exactly equivalent to the raw `IS DISTINCT FROM` here. No other column swap uses a NULL-sensitive comparison operator. |
| Removing the snake_case dual-read in `isAccommodationSubscription` breaks a caller that still passes a raw (non-Drizzle-mapped) row | M | H | Grep-confirmed during research: `isAccommodationSubscription` has exactly 5 callers, all of which already receive their subscription object from a typed Drizzle query today (not a raw `SELECT *`). Verified per-caller in the Phase A task list below — each call site is checked individually before the dual-read is deleted. |
| `persistEffectColumns()` removal (folding UPDATE into INSERT) changes promo-code creation behavior if some effect-column value actually depends on the generated row `id` | L | M | Read all 3 branches (comp / trial_extension / discount) during spec research — none reference the row's own `id` when computing effect-column values, so folding into `.insert({...})` is behavior-identical. Regression-gated by `promo-code.crud.test.ts`. |
| Mocked tests currently assert on `db.execute`/raw-SQL mock calls; migrating the implementation without updating the mock makes the test pass falsely (mock never invoked, assertion on call count silently skipped) or fail loudly | M | L | Every phase's task list explicitly includes "update this file's test mocks to match the new typed call shape" as a sub-step, not an afterthought — verified per-file, not assumed. `subscription-comp-create.service.test.ts` (lines 73-172, currently asserts on `db.execute` mock) is explicitly called out as needing mock updates in US-1. |
| Scope creep from the 5 gap files (found during research, not in the original Linear issue) turns out to hide more raw-SQL sites than expected | L | L | Both gap areas (`subscription-comp-create.service.ts`, 3 seed files) were read in full during spec research, not just grepped — their complete raw-SQL surface for these 6 columns is already enumerated in this spec's acceptance criteria. |
| 3-phase/3-PR approach means Phase B/C start from a `staging` that already has Phase A merged — if Phase A's shared-helper groundwork isn't in place yet when Phase C needs it | L | L | The shared helper (US-3) lives in `subscription-product-domain.ts`, touched in Phase A. Phase C's task list explicitly depends on Phase A merging first (see Implementation Approach dependencies). |

### Performance Considerations

- **Expected load**: unchanged — same query count, same tables, same
  indexes (the qzpay-drizzle 1.11.0 bump also added
  `idx_plans_product_domain`, `idx_subscriptions_product_domain`,
  `idx_promo_codes_effect_kind`, which the raw SQL wasn't necessarily using
  via the query planner as reliably as a properly-typed indexed `eq()`/`ne()`
  predicate would — this migration is likely a very minor net *positive* for
  query-plan predictability, not a regression).
- **Bottlenecks**: none identified or introduced.
- **Optimization needs**: none — this is not a performance-motivated change.
- **Monitoring**: none new. Existing billing/webhook/cron logging and error
  tracking (via `@repo/logger`, Sentry) is untouched.

## Implementation Approach

Three sequential phases, each its own PR to `staging` (per this repo's
branch-workflow convention), grouped by domain so review diffs stay focused.
Phase C depends on Phase A (the shared helper lives in a file Phase A
touches) and Phase B (some files in Phase C's docs cleanup reference
promo-code column status established in Phase B) having merged first.

### Phase 1: Setup

1. [ ] Confirm local dev DB and worktree are on `@qazuor/qzpay-drizzle@1.11.0`
   (already true post-`wt-create.sh`'s `pnpm install`) — no action expected,
   just a sanity check before starting.
2. [ ] Add the new `loadSubscriptionDiscountState()` export (and its
   `SubscriptionDiscountState` type) to `subscription-product-domain.ts` —
   this is infrastructure Phase A/C both depend on, done first so Phase A's
   own call sites can use it if applicable.

### Phase 2: Core — Phase A (product-domain group, ~8 files)

3. [ ] `subscription-product-domain.ts` — remove the
   `record.productDomain ?? record.product_domain` dual-read in
   `isAccommodationSubscription`; keep only `record.productDomain`.
4. [ ] `subscription-checkout.service.ts` — migrate both `product_domain`
   UPDATEs (commerce line ~722, partner line ~832) to
   `tx.update(billingSubscriptions).set({ productDomain: ... })`.
5. [ ] `subscription-comp-create.service.ts` — migrate the SELECT (line
   ~81, reads `product_domain` to gate accommodation-only comp) and the
   UPDATE (lines ~137-139, stamps `product_domain`+`promo_code_id`) to typed
   Drizzle; update `subscription-comp-create.service.test.ts`'s mocks
   accordingly.
6. [ ] `apps/api/src/routes/billing/public/listPlans.ts` — migrate
   `getNonAccommodationPlanSlugs()`'s raw `IS DISTINCT FROM` SELECT to
   `ne(billingPlans.productDomain, ProductDomainEnum.ACCOMMODATION)`.
7. [ ] `apps/api/src/routes/partners/admin/list-plans.ts` — migrate the
   `product_domain = 'partner'` filter + correlated price subquery to typed
   Drizzle; write the net-new `list-plans.test.ts`.
8. [ ] `packages/service-core/src/services/accommodation/featured-entitlement.resolver.ts`
   — migrate the `product_domain` SELECT to typed Drizzle.
9. [ ] `packages/seed/src/required/commercePlan.seed.ts` and
   `partnerPlan.seed.ts` — fold the raw post-insert `product_domain` UPDATE
   into the `.insert({...})` values object.

### Phase 3: Core — Phase B (promo-codes group, ~9 files)

10. [ ] `promo-code.crud.ts` — collapse `promoCodeColumnsWithEffect()` to
    `getTableColumns(billingPromoCodes)`; delete `persistEffectColumns()` and
    fold its 3 branches' effect-column values into the corresponding
    `.insert({...})` calls.
11. [ ] `promo-code.redemption.ts` — migrate the `promo_effect_remaining_cycles`
    UPDATE (line ~918-931) to typed `.set({...})`.
12. [ ] `promo-code.renewal.ts` — migrate `resolveRenewalPromoEffect`'s SELECT
    (line ~232-239) to call `loadSubscriptionDiscountState()`; migrate
    `persistRemainingCycles()`'s UPDATE (line ~519-525) to typed `.set({...})`.
13. [ ] `promo-code.trial-extension.ts` — migrate its raw-SQL touch point on
    the effect columns (verify exact site during implementation; comment at
    line ~124 references "extras/018", update accordingly).
14. [ ] `promo-discount-apply.service.ts` — migrate both the SELECT (line
    ~116-122) and the `promo_effect_remaining_cycles` UPDATE (line ~242-246)
    to typed Drizzle.
15. [ ] `subscription-discount-signup.service.ts` — migrate the
    `promo_code_id`+`promo_effect_remaining_cycles` UPDATE (line ~152-157) to
    typed `.set({...})`.
16. [ ] `packages/seed/src/required/billingPromoCodes.seed.ts` — fold the
    raw post-insert `effect_kind`/`value_kind`/`duration_cycles`/`extra_days`
    UPDATE (lines ~86-99) into the `.insert({...})` values object.
17. [ ] `packages/schemas/src/api/billing/promo-code.schema.ts:291` — update
    the stale "added via extras/018" JSDoc comment.

### Phase 4: Integration — Phase C (webhooks/crons + shared helper wiring, ~5 files)

18. [ ] `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` —
    migrate `resolveDiscountAwareUpgradeAmount`'s SELECT (line ~353-360) to
    call `loadSubscriptionDiscountState()`.
19. [ ] `apps/api/src/cron/jobs/dunning.job.ts` — migrate
    `isCompOrActivelyDiscounted`'s SELECT (line ~66-72) to call
    `loadSubscriptionDiscountState()`.
20. [ ] `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` — migrate
    `resolveDiscountAwarePlanChangeAmount`'s SELECT (line ~94-100) to call
    `loadSubscriptionDiscountState()`.
21. [ ] `apps/api/src/cron/jobs/subscription-poll.job.ts` — migrate
    `reconcileActiveDiscountAmounts`'s bulk SELECT (line ~463-470) to a typed
    `db.select({...}).from(billingSubscriptions).where(and(...))` (its own
    query, not the single-row shared helper — see Architecture).
22. [ ] `apps/api/src/routes/billing/admin/subscription-promo-effect.ts` —
    migrate the admin-diagnostic JOIN SELECT (line ~90-101) to typed Drizzle
    (`db.select({...}).from(billingSubscriptions).innerJoin(billingPromoCodes,
    ...)`); update the stale extras/018-019 JSDoc tags (line ~36-48).

### Phase 5: Docs & Cleanup

23. [ ] Update root `CLAUDE.md` (~line 183-192) — remove the reference to
    deleted `extras/017-billing-plans-product-domain.column.sql`; describe
    the 6 columns as typed Drizzle columns from `@qazuor/qzpay-drizzle@1.11.0`.
24. [ ] Update `docs/guides/migrations.md` (~224-241) — rewrite or remove the
    "Extras-carril example: `product_domain` columns (SPEC-239)" section
    (factually superseded).
25. [ ] Update `docs/decisions/ADR-035-commerce-core-gastronomy-separation.md`
    (~77-81, 191-193) — remove the deleted-file citation; mark the
    "Drizzle-invisible" tradeoff as resolved/historical.
26. [ ] Update `packages/service-core/CLAUDE.md` — fix the wrong migration
    filename (`0042_last_patriot.sql` doesn't exist; real file is
    `packages/db/src/migrations/0044_adorable_longshot.sql`), and note this
    spec closed the "raw SQL still pending" gap it previously flagged.
27. [ ] Add a heads-up note in `.specs/HOS-20-iva-tax-handling/spec.md:110` —
    its reference table citing `product_domain` as "(extras/016)"/"(extras/017)"
    is now stale; correct or annotate.
28. [ ] Run full scoped verification (see Verification section) across all 3
    phases together as a final gate before closing HOS-75.

## Internal Review Notes

- **Strengthened during review**: added explicit per-file line-number
  anchors throughout (from the exploration agent's report) so no task
  requires re-discovering which lines to touch; added the NULL-safety
  justification for `ne()` vs `IS DISTINCT FROM` as a first-class Risk row
  instead of leaving it implicit; called out the exact test files whose
  mocks need updating (not just "add tests").
- **Open questions for the user** (none blocking — proceeding on stated
  defaults per the approved plan, listed here for visibility):
  1. The 4 scope/approach questions asked at Plan Mode entry (gap-file
     inclusion, 3-PR phasing, shared-helper extraction, docs-cleanup scope)
     went unanswered (user away) and were resolved using the tool's
     "Recommended" option in each case, per the approved plan. Flag if any of
     these should be revisited before Phase 1 starts.
  2. Whether `promo-code.trial-extension.ts`'s exact raw-SQL site (task 13)
     needs its own dedicated sub-task once its precise line range is
     re-confirmed at implementation time — flagged as "verify exact site" in
     the task itself since the original exploration report did not pin an
     exact line range for this one file (all others were pinned).
- **External docs verified**: none — no external API/library integration is
  touched by this spec (drizzle-orm and @qazuor/qzpay-drizzle are internal
  dependencies already in use, not new integrations requiring doc
  verification).
