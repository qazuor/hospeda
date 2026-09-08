# HOS-1233: The plans page reads the trial before it charges

## Progress: 0/29 tasks (0%)

**Average complexity:** 2.2 / 3 (max) — all 29 tasks are ≤ 3
**Critical path:** T-001 → T-004 → T-005 → T-006 → T-007 (5 steps in the domain track); the longest path to completion is T-013 → T-014 → T-017 → T-024 → T-027 → T-029
**Parallel tracks:** 4 — the tourist domain (T-001…T-007), the clock (T-008…T-012), the button logic (T-013…T-015), and the UI (T-016…T-021)

Four things in this plan are not obvious from the issue and come from measurement,
recorded in the spec's §3:

- The charge-without-looking button is on **two** pricing pages, not five. The other
  three already link to the create form (D-1 keeps them banner-only).
- **No endpoint answers "days left in THIS vertical"** — that gap is T-008…T-011.
- **Tourist plans are filed as `accommodation` in prod and staging** (F-4b). T-001…T-007
  correct it, including two data-migrations against live rows.
- HOS-1183's canonical-predicate guard **does not cover `apps/web`**, which is where
  most of this work happens. T-022 plants the twin.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) — Add TOURIST to ProductDomainEnum
  - The enum has five members and no `tourist`; every per-vertical trial mechanism is keyed by it.
  - Blocked by: none · Blocks: T-002, T-003, T-004

- [ ] **T-002** (complexity: 3) — Repair the frozen-count guards a new enum value trips
  - Recount each guard against the real set; never increment by one.
  - Blocked by: T-001 · Blocks: T-005

### Core Phase

- [ ] **T-003** (complexity: 2) — Make `subscriptionMatchesDomain` fail CLOSED for tourist
  - The accommodation fail-open must stay exactly as is — it exists for legacy rows.
  - Blocked by: T-001 · Blocks: T-007, T-009

- [ ] **T-004** (complexity: 2) — Classify the tourist plans as `tourist` in config
  - Check `MODEL_C_FIELD_SPLIT`; the seed's fail-fast guard throws on an unclassified field.
  - Blocked by: T-001 · Blocks: T-005, T-023

- [ ] **T-005** (complexity: 3) — Data-migration: reclassify existing tourist `billing_plans` rows
  - Expand half of expand/contract. Declare `meta.requiresColumns`.
  - Blocked by: T-002, T-004 · Blocks: T-006

- [ ] **T-006** (complexity: 3) — Data-migration: reclassify existing tourist `billing_subscriptions` rows
  - Join to the plan; never hardcode ids.
  - Blocked by: T-005 · Blocks: T-007

- [ ] **T-007** (complexity: 2) — Guard: no tourist plan reports the accommodation domain
  - Assert the positive too — an absence assertion passes when the plan disappears.
  - Blocked by: T-003, T-006 · Blocks: none

- [ ] **T-008** (complexity: 2) — Schema for the per-vertical trial-clock response
  - Absent, zero and unresolved must be three distinguishable answers.
  - Blocked by: none · Blocks: T-009, T-011

- [ ] **T-009** (complexity: 3) — Service: resolve the running trial for one product domain
  - Reuse `isEntitlementGrantingStatus`; the hand-rolled version once omitted `comp`.
  - Blocked by: T-003, T-008 · Blocks: T-010

- [ ] **T-010** (complexity: 2) — Protected route for the per-vertical trial clock
  - Route tests must prove they reach the handler; many in this app do not.
  - Blocked by: T-009 · Blocks: T-011, T-028

- [ ] **T-011** (complexity: 1) — Web client for the trial-clock endpoint
  - Failure degrades toward charging-WITH-warning, never toward a silent charge.
  - Blocked by: T-008, T-010 · Blocks: T-017, T-020

- [ ] **T-012** (complexity: 1) — Assert `trial/status` keeps its per-account semantics
  - AC-2. Pin it so nobody "fixes" it into a domain filter while wiring T-009.
  - Blocked by: none · Blocks: none

- [ ] **T-013** (complexity: 1) — Name the 3-day threshold as one constant
  - Blocked by: none · Blocks: T-014

- [ ] **T-014** (complexity: 3) — Pure function: which of the three branches applies
  - Unresolved maps to warn-then-charge, never to a silent charge.
  - Blocked by: T-013 · Blocks: T-017, T-022

- [ ] **T-015** (complexity: 2) — Pure predicate: does this visitor already hold the VIP benefits?
  - `trialing` false (deliberate); `comp` and `past_due` true (assumption on record).
  - Blocked by: none · Blocks: T-018, T-024

### Integration Phase

- [ ] **T-016** (complexity: 3) — Warn-and-confirm dialog for losing the remaining days
  - Compose `dialog-panel`; declare no `max-height`/`overflow` in the module.
  - Blocked by: none · Blocks: T-017, T-019

- [ ] **T-017** (complexity: 3) — Wire the three branches into `PlanPurchaseButton`
  - The island already fetches the verdict and uses it only for a badge.
  - Blocked by: T-011, T-014, T-016 · Blocks: T-024

- [ ] **T-018** (complexity: 2) — Disabled already-VIP state on the tourist cards
  - Disabling it for somebody who lacks the benefits is invisible in testing and costs a sale.
  - Blocked by: T-015 · Blocks: T-019, T-024

- [ ] **T-019** (complexity: 2) — i18n keys for the dialog, banner and already-VIP copy
  - The i18n guards check structure, never content. No path may render "0 días".
  - Blocked by: T-016, T-018 · Blocks: T-021

- [ ] **T-020** (complexity: 2) — Remaining-days banner component
  - An island, so the pages keep the edge cache and never parse the session server-side.
  - Blocked by: T-011 · Blocks: T-021

- [ ] **T-021** (complexity: 3) — Mount the banner on all five pricing pages
  - Banner only on the three link pages; adding checkout there undoes HOS-1156.
  - Blocked by: T-019, T-020 · Blocks: T-025, T-026

### Testing Phase

- [ ] **T-022** (complexity: 3) — Web-side twin of the canonical-predicate guard
  - Must fail on a SECOND call site, and survive a rename or a reformat.
  - Blocked by: T-014 · Blocks: T-027

- [ ] **T-023** (complexity: 2) — Guard: the tourist-VIP inheritance still holds
  - Guard the inheritance, not the copy. Check both constants — entitlements without limits reads as UNLIMITED.
  - Blocked by: T-004 · Blocks: T-027

- [ ] **T-024** (complexity: 3) — Button behaviour tests: three branches plus already-VIP
  - Includes AC-17: a trialing-only visitor still sees the button enabled.
  - Blocked by: T-015, T-017, T-018 · Blocks: T-027

- [ ] **T-025** (complexity: 2) — Banner present/absent tests, in PAIRS
  - An absence test alone passes on a typo'd selector.
  - Blocked by: T-021 · Blocks: T-027

- [ ] **T-026** (complexity: 1) — Test the three link pages still link to signup → create form
  - Assert the resolved href; an `.astro` source test cannot tell declared from rendered.
  - Blocked by: T-021 · Blocks: T-027

- [ ] **T-027** (complexity: 3) — Mutation-verify the whole new suite
  - Commit first, then mutate, then revert — `git checkout --` eats an uncommitted fix.
  - Blocked by: T-022, T-023, T-024, T-025, T-026 · Blocks: T-028, T-029

### Docs Phase

- [ ] **T-028** (complexity: 1) — Add the new endpoint to the gate matrix
  - Its snapshot guard fails CI on a handler with no row.
  - Blocked by: T-010, T-027 · Blocks: none

- [ ] **T-029** (complexity: 2) — Document the tourist domain and the already-VIP rule
  - Root CLAUDE.md still says the enum "holds exactly four values".
  - Blocked by: T-027 · Blocks: none

---

## Dependency graph

```
Level 0: T-001  T-008  T-012  T-013  T-015  T-016
Level 1: T-002  T-003  T-004  T-014  T-018
Level 2: T-005  T-009  T-019  T-022  T-023
Level 3: T-006  T-010
Level 4: T-007  T-011
Level 5: T-017  T-020
Level 6: T-021  T-024
Level 7: T-025  T-026
Level 8: T-027
Level 9: T-028  T-029
```

Validated: no cycles, every reference resolves, both directions consistent, all
29 tasks at complexity ≤ 3.

## Suggested start

**T-001** (complexity: 2) — adding `TOURIST` to `ProductDomainEnum`. It has no
dependencies and unblocks three tasks, and it is the root of the longest
prerequisite chain in the plan (T-001 → T-004 → T-005 → T-006 → T-007), which
also happens to be the one touching live production rows. Starting it first is
what keeps the data-migration work off the critical path at the end.

**T-008**, **T-013**, **T-015** and **T-016** are all startable immediately and in
parallel if more than one person is working.

## Sequencing note

The two data-migrations (T-005, T-006) are the expand half of expand/contract and
run against rows that exist in production today. Nothing may be dropped in the
same release that backfills them: a data-migration needing a column the same
release removes reads nothing, moves zero rows, and is ledgered as applied
forever.
