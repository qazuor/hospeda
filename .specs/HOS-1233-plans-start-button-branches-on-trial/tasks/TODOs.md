# HOS-1233: The plans page reads the trial before it charges

## Progress: 21/42 done, 7 resolved without implementation, 14 open

> **This file and `state.json` were both STALE and cost the next session real
> time (2026-09-09).** They reported all 42 tasks pending while the whole domain
> half was merged. Every box below was re-verified against `origin/staging`
> `f938edb42` with a file-and-line citation before being flipped — not against
> the working tree, which lagged 70 commits.
>
> **Seven tasks are resolved but will never be checked**, because they are not
> work any more. Do not re-open them:
>
> - **T-004, T-005, T-006** — superseded by T-034 and T-038 (already noted below).
> - **T-008, T-009, T-010, T-011 — DROPPED (owner, 2026-09-09).** F-3 is stale:
>   it says nothing answers "days left in THIS vertical", which was true when
>   written. **HOS-1282 shipped it since** — `GET /protected/billing/trial/status`
>   takes an optional `?productDomain=`, and `billingApi.getTrialStatus({
>   productDomain })` exists at `apps/web/src/lib/api/endpoints-protected.ts:1413`.
>   Verified in three layers rather than from the docblock: it runs
>   `hydrateSubscriptionProductDomains` (`trial.service.ts:374`) BEFORE narrowing
>   with `subscriptionMatchesDomain` (`:385`), so it dodges the HOS-934 silent
>   failure and composes with T-003's fail-closed tourist. Building a second
>   endpoint would have violated this spec's own AC-1 and R-1.
> - **T-023 — already satisfied by pre-existing tests**, so no new guard was
>   written (a duplicate with no consumer is what HOS-1081 deleted). AC-19's
>   claim is covered on both halves: `packages/billing/test/owner-inherits-tourist.test.ts`
>   (SPEC-216, the six accommodation tiers) and
>   `packages/billing/test/commerce-vertical-plans.test.ts:321` (HOS-975 D-A,
>   "grants the whole tourist-VIP block on ALL SIX tiers", plus the limit VALUES
>   at `:166`). 52 tests, verified green 2026-09-09.
>
> **T-037 left this spec and is now `HOS-1312` (P1).** Its partner T-036 merged
> in `7aadeab8e` with the `0121` migration and **zero tests** — the only
> occurrence of "AC-15h/AC-15i" outside `.specs/` is prose in a docblock. R-8
> ("dropping the default breaks EVERY paid checkout") therefore has no coverage.
> `db:migrate` is held until that issue is green. Note for whoever takes it: the
> compile-time half needs no database — with the default dropped from the Drizzle
> column, `productDomain` becomes REQUIRED in the insert type, so `tsc` rejects an
> omitting write. Read `scripts/check-product-domain-on-writes.ts:22-25` backwards.
>
> ---
>
> **The qzpay wave PUBLISHED (2026-09-08).** PR #85 merged and shipped as core
> 6.0.0, with all four siblings republished against it; Hospeda is on the whole
> wave. T-030/T-031/T-032 are done and nothing is blocked on the package any
> more.
>
> T-035's guard flipped from BLOCKED to a hard failure by itself when the wave
> installed, with no edit to it — which is what forced T-032 the same hour. That
> was the point of deriving the exemption from the package's own `.d.ts`.
>
> **T-036 (drop the default) is DONE and merged** — `7aadeab8e`, migration
> `0121`. Its four prerequisites (T-032, T-033, T-034, T-035) were all done
> first, so the ordering AC-15i demands was respected in fact.
>
> **But it shipped without T-037, its own proof, and the migration has NOT been
> run on any database.** Merging does not apply it: staging and prod still carry
> `DEFAULT 'accommodation'`. That window closes silently — while nobody runs
> `db:migrate` everything works, and the day somebody does, the way you find out
> is paid checkouts failing. Tracked as `HOS-1312`; the migration is held until
> it is green.

**Average complexity:** 2.2 / 3 (max) — every task is ≤ 3  
**Levels:** 10 topological levels, no cycles, all references resolve in both directions  
**Tracks:** 6 — the tourist domain, the write sites, the qzpay package, the clock, the branch logic, the UI

> **Read the spec's §3 and §4b before starting.** Five things in this plan are not
> obvious from the issue and come from measurement, not from reading:
>
> - The charge-without-looking button is on **two** pricing pages, not five.
> - ~~**No endpoint answers "days left in THIS vertical"** — that gap is T-008…T-011.~~
>   **No longer true.** HOS-1282 shipped the `?productDomain=` scoping; T-008…T-011
>   are dropped and the existing endpoint is consumed. See the header note.
> - **Tourist plans are filed as `accommodation` in prod and staging** (F-4b), and the
>   root cause is that **no paid checkout names its domain at all** (F-4c). Commerce is
>   correct only by accident of dodging a MercadoPago bug.
> - The default lives in **qzpay**, a generic payments package that should not know what
>   an accommodation is (F-4d). Wider audit: HOS-1254.
> - Dropping that default **out of order breaks every paid checkout** (R-8). The
>   sequence in D-7 is the mitigation, and T-037 is what proves it was respected.

---

### Setup Phase

- [x] **T-001** (complexity: 2) — Add TOURIST to ProductDomainEnum
  - Add `TOURIST = 'tourist'` to `packages/schemas/src/enums/product-domain.enum.ts`.
  - Blocked by: none · Blocks: T-002, T-003, T-004

- [x] **T-002** (complexity: 3) — Repair the frozen-count guards a new enum value trips
  - R-5.
  - Blocked by: T-001 · Blocks: T-005

- [x] **T-030** (complexity: 3) — qzpay-core: accept a product domain on subscription creation
  - D-7.1 / AC-15e.
  - Blocked by: none · Blocks: T-032, T-033

- [x] **T-031** (complexity: 1) — qzpay: stop naming Hospeda in the schema docblocks
  - D-7.3.
  - Blocked by: none · Blocks: none

### Core Phase

- [x] **T-003** (complexity: 2) — Make subscriptionMatchesDomain fail CLOSED for tourist
  - AC-15.
  - Blocked by: T-001 · Blocks: T-007, T-009

- [ ] **T-004** (complexity: 1) — Classify the tourist plans as productDomain tourist in config
  - SUPERSEDED by T-034, which does this properly (derived per plan rather than by slug list) and covers the write path as well as the config.
  - Blocked by: T-001 · Blocks: T-005, T-023

- [ ] **T-005** (complexity: 1) — Data-migration: reclassify existing tourist billing_plans rows
  - SUPERSEDED by T-038, which merges both migrations under one expand/contract story with the ordering constraint (R-8) attached.
  - Blocked by: T-002, T-004 · Blocks: T-006

- [ ] **T-006** (complexity: 1) — Data-migration: reclassify existing tourist billing_subscriptions rows
  - SUPERSEDED by T-038, which merges both migrations under one expand/contract story with the ordering constraint (R-8) attached.
  - Blocked by: T-005 · Blocks: T-007

- [x] **T-007** (complexity: 2) — Guard: no tourist plan reports the accommodation domain
  - AC-14.
  - Blocked by: T-003, T-006 · Blocks: none

- [ ] **T-008** (complexity: 2) — Schema for the per-vertical trial-clock response
  - F-3 / AC-1.
  - Blocked by: none · Blocks: T-009, T-011

- [ ] **T-009** (complexity: 3) — Service: resolve the running trial for one product domain
  - F-3 / AC-1.
  - Blocked by: T-003, T-008 · Blocks: T-010

- [ ] **T-010** (complexity: 2) — Protected route for the per-vertical trial clock
  - AC-1.
  - Blocked by: T-009 · Blocks: T-011, T-028

- [ ] **T-011** (complexity: 1) — Web client for the trial-clock endpoint
  - Add the wrapper to `apps/web/src/lib/api/endpoints-protected.ts` — never a raw fetch() in a page or component.
  - Blocked by: T-008, T-010 · Blocks: T-017, T-020

- [x] **T-012** (complexity: 1) — Assert trial/status keeps its per-account semantics
  - AC-2.
  - Blocked by: none · Blocks: none

- [x] **T-013** (complexity: 1) — Name the 3-day threshold as one constant
  - AC-6.
  - Blocked by: none · Blocks: T-014

- [x] **T-014** (complexity: 3) — Pure function: which of the three branches applies
  - D-2 / AC-3..AC-6.
  - Blocked by: T-013 · Blocks: T-017, T-022

- [x] **T-015** (complexity: 2) — Pure predicate: does this visitor already hold the VIP benefits?
  - D-4 / AC-16..AC-18.
  - Blocked by: none · Blocks: T-018, T-024

- [x] **T-032** (complexity: 3) — createPaidSubscription forwards the domain, resolved from the plan
  - AC-15e.
  - Blocked by: T-030 · Blocks: T-034, T-036

- [x] **T-033** (complexity: 2) — createPlan and CreatePlanInput carry the domain
  - AC-15f.
  - Blocked by: T-030 · Blocks: T-034, T-036

- [x] **T-034** (complexity: 3) — The seed stamps each plan's domain, derived not listed
  - AC-15g.
  - Blocked by: T-032, T-033 · Blocks: T-035, T-037

- [x] **T-035** (complexity: 3) — Guard: a subscription or plan write that omits the domain fails CI
  - AC-15d / D-6.3, and the piece that makes this permanent.
  - Blocked by: T-034 · Blocks: T-036

- [x] **T-036** (complexity: 3) — Drop .default('accommodation') from both qzpay columns
  - D-7.2 / AC-15h.
  - Blocked by: T-032, T-033, T-035 · Blocks: T-037, T-038

- [x] **T-038** (complexity: 3) — Backfill: reclassify the tourist rows in both tables
  - R-11 / AC-14.
  - Blocked by: T-036 · Blocks: T-027, T-039, T-040, T-041

- [x] **T-040** (complexity: 3) — Trace PRODUCT_DOMAIN_BY_LIMIT_KEY and pin the answer
  - D-8 / AC-15k.
  - Blocked by: T-038 · Blocks: T-027

### Integration Phase

- [ ] **T-016** (complexity: 3) — Warn-and-confirm dialog for losing the remaining trial days
  - AC-4.
  - Blocked by: none · Blocks: T-017, T-019

- [ ] **T-017** (complexity: 3) — Wire the three branches into PlanPurchaseButton
  - D-2.
  - Blocked by: T-011, T-014, T-016 · Blocks: T-024

- [ ] **T-018** (complexity: 2) — Disabled already-VIP state on the tourist cards
  - D-4 / AC-16.
  - Blocked by: T-015 · Blocks: T-019, T-024

- [ ] **T-019** (complexity: 2) — i18n keys for the dialog, the banner and the already-VIP copy
  - Add the new strings to es/en/pt.
  - Blocked by: T-016, T-018 · Blocks: T-021

- [ ] **T-020** (complexity: 2) — Remaining-days banner component
  - AC-7 / AC-8.
  - Blocked by: T-011 · Blocks: T-021

- [ ] **T-021** (complexity: 3) — Mount the banner on all five pricing pages
  - AC-7 / AC-10 / AC-12.
  - Blocked by: T-019, T-020 · Blocks: T-025, T-026

- [x] **T-039** (complexity: 2) — Make the admin plan-change gate domain-aware
  - D-8 / AC-15j.
  - Blocked by: T-038 · Blocks: T-027

### Testing Phase

- [x] **T-022** (complexity: 3) — Web-side twin of the canonical-predicate guard
  - AC-11 / F-6.
  - Blocked by: T-014 · Blocks: T-027

- [ ] **T-023** (complexity: 2) — Guard: the tourist-VIP inheritance still holds for all three verticals
  - AC-19.
  - Blocked by: T-004 · Blocks: T-027

- [ ] **T-024** (complexity: 3) — Button behaviour tests: three branches plus the already-VIP state
  - AC-3/4/5/16/17.
  - Blocked by: T-015, T-017, T-018 · Blocks: T-027

- [ ] **T-025** (complexity: 2) — Banner present/absent tests, in PAIRS
  - AC-7 / AC-8.
  - Blocked by: T-021 · Blocks: T-027

- [ ] **T-026** (complexity: 1) — Test that the three link pages still link to signup then create form
  - AC-12 / R-4.
  - Blocked by: T-021 · Blocks: T-027

- [ ] **T-027** (complexity: 3) — Mutation-verify the whole new suite
  - The spec's test plan says most assertions here are about an ABSENCE (no dialog, no banner, no checkout, no charge), which is the shape that passes for….
  - Blocked by: T-022, T-023, T-024, T-025, T-026, T-037, T-038, T-039, T-040, T-041 · Blocks: T-028, T-029, T-042

- [ ] **T-037** (complexity: 2) — Prove the ordering, and that an omitted write now RAISES
  - AC-15i / AC-15h.
  - Blocked by: T-034, T-036 · Blocks: T-027

- [x] **T-041** (complexity: 3) — Regression tests for the five reads the reclassification FIXES
  - AC-15c.
  - Blocked by: T-038 · Blocks: T-027

### Docs Phase

- [ ] **T-028** (complexity: 1) — Add the new endpoint to the gate matrix
  - `docs/billing/endpoint-gate-matrix.md` is the source of truth for gate decisions, and its snapshot guard fails CI when a new handler file has no matrix row.
  - Blocked by: T-010, T-027 · Blocks: none

- [ ] **T-029** (complexity: 2) — Document the tourist domain and the already-VIP rule
  - Root CLAUDE.md states ProductDomainEnum 'holds exactly four values' and that 'commerce' is retired — both need updating for TOURIST, plus a line on why….
  - Blocked by: T-027 · Blocks: none

- [x] **T-042** (complexity: 2) — Document the domain contract and its history
  - Root CLAUDE.md still says ProductDomainEnum 'holds exactly four values'.
  - Blocked by: T-027 · Blocks: none

---

## Dependency graph

```
Level 0: T-001  T-008  T-012  T-013  T-015  T-016  T-030  T-031
Level 1: T-002  T-003  T-004  T-014  T-018  T-032  T-033
Level 2: T-005  T-009  T-019  T-022  T-023  T-034
Level 3: T-006  T-010  T-035
Level 4: T-007  T-011  T-036
Level 5: T-017  T-020  T-037  T-038
Level 6: T-021  T-024  T-039  T-040  T-041
Level 7: T-025  T-026
Level 8: T-027
Level 9: T-028  T-029  T-042
```

## Suggested start

**T-030** — teach `qzpay-core`'s subscription creation to accept a product domain. It
unblocks the two write-site fixes, and every one of them is stuck behind it: today
`createPaidSubscription` has no parameter to forward because the package does not offer
one. Nothing downstream can be done properly until it does.

Startable immediately and in parallel: T-001, T-008, T-012, T-013, T-015, T-016, T-030, T-031.

**Do NOT start T-036** (dropping the default) until T-032, T-033, T-034 and T-035 are
all done. It is ordered last on purpose — see R-8.
