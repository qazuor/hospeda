# SPEC-292 — Progress Tracker

Featured Listing Management

Generated: 2026-06-30

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 8 |
| Completed | 8 |
| In progress | 0 |
| Pending | 0 |
| Avg complexity | 2.9 |

## Phase Breakdown

| Phase | Tasks | Status |
|-------|-------|--------|
| core — DB + schema + search + sync service + cron | T-001, T-002, T-003, T-004, T-006 | completed |
| integration — billing event wiring | T-005 | completed |
| testing — regression + unit + integration | T-007 | completed |
| docs — SPEC-282 follow-up note | T-008 | completed |

## Critical Path

```
T-001 (DB column + migration)
  ├── T-002 (search sort) ─────────────────────────────────────┐
  ├── T-003 (close owner leak) ──────────────────────────────── ┤
  └── T-004 (sync service)                                      │
        ├── T-005 (billing event wiring) ─────────────────────── ┤
        └── T-006 (reconciliation cron) ─────────────────────── ┤
                                                                 ↓
                                                          T-007 (tests)
                                                               ↓
                                                          T-008 (docs note)
```

Critical path: T-001 → T-004 → T-005 → T-007 → T-008 (5 tasks deep).

## Parallel Tracks

```
Track A (DB foundation):
  T-001 (no blockers — start immediately)

Track B (search sort — unblocks after T-001):
  T-001 → T-002

Track C (leak closure — unblocks after T-001):
  T-001 → T-003

Track D (billing sync — critical path, unblocks after T-001):
  T-001 → T-004 → T-005
                → T-006 (parallel with T-005 after T-004)

Merge point: T-007 (all tracks converge — needs T-002, T-003, T-005, T-006)
Closeout: T-008 (post-test docs note)
```

T-002, T-003, and T-004 can all begin in parallel once T-001 is done.
T-005 and T-006 can run in parallel once T-004 is done.

## Task Status

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|------------|------------|
| T-001 | Add featuredByPlan column, migration, and index update | completed | 3 | — |
| T-002 | Update buildAccommodationOrderBy to sort by effective featured disjunction | completed | 2 | T-001 |
| T-003 | Remove isFeatured from owner-facing schema and mapper | completed | 2 | T-001 |
| T-004 | Implement featuredByPlan bulk sync service | completed | 4 | T-001 |
| T-005 | Wire syncFeaturedByPlan to billing lifecycle events | completed | 4 | T-004 |
| T-006 | Implement featuredByPlan reconciliation cron | completed | 3 | T-004 |
| T-007 | Tests — admin regression, owner leak, sync service, search sort | completed | 4 | T-002, T-003, T-005, T-006 |
| T-008 | Add SPEC-282 follow-up cross-reference note | completed | 1 | T-007 |

## Notes

- T-001 is the only unblocked task — start here.
- After T-001: T-002, T-003, and T-004 all unblock simultaneously and can run in parallel across two tracks.
- After T-004: T-005 and T-006 unblock simultaneously and can run in parallel.
- T-007 is the merge point for all implementation work. Run tests scoped (never full suite) per the project resource-care rule.
- Admin path (G-1) already persists isFeatured correctly — no new admin code. T-007 only adds a regression test to confirm it stays working.
- Two-carril migration applies to T-001: structural column via db:generate (Drizzle-managed), optional expression index via extras carril (idempotent).
- The FEATURED_LISTING entitlement key is in packages/billing/src/types/entitlement.types.ts:13. Plans that grant it: owner-basico, owner-premium, complex-pro, complex-premium. NOT complex-basico.
- T-005 (billing event wiring) is the highest-risk task: requires reading the billing webhook + cron handlers to find all FEATURED_LISTING state-change sites. Read those files carefully before writing.
- T-008 is a hand-off note only, not an implementation task. It can be done in minutes.

## SPEC-282 Hand-off (T-008)

Featuring is now real and entitlement-wired (admin manual `isFeatured` + owner
automatic `featuredByPlan` derived from the `FEATURED_LISTING` entitlement). Per
spec §8, the **"Listing destacado" row in the SPEC-282 plan-comparison table can be
flipped from *Próximamente* to active** once this PR is merged and deployed.

That flip lives in SPEC-282's plan-comparison page (`apps/web`), not here — kept out
of this PR to preserve scope. Action for the SPEC-282 owner: change the "Listing
destacado" row state in the plan-comparison config/i18n so it shows as an included
benefit for the plans that grant `FEATURED_LISTING` (owner-basico, owner-premium,
complex-pro, complex-premium).

### Post-merge / deploy checklist (not part of code)

- Run `pnpm db:migrate` on staging/prod to apply migration `0035_aspiring_komodo.sql`
  (the new `featured_by_plan` column + indexes). `db:push` is dev-only.
- The reconciliation cron `featured-by-plan-reconcile` (every 6h) will backfill
  `featuredByPlan` for already-subscribed owners on first run, so no manual data
  backfill is required.

### Adversarial review (2026-06-30) — verdict: SHIP-WITH-FOLLOWUPS

Full review run before PR. Nothing Critical. Confirmed solid: leak closure, sort SQL
(no injection), soft-delete scoping, grace handling (`past_due`/`paused` don't
revoke), non-vacuous tests.

**Fixed in this PR (post-review):**

- **M-1** — 4 sites (`payment-logic.confirmPlanUpgrade`, `apply-scheduled-plan-changes`,
  `qzpay-admin-hooks` up+down) called `syncFeaturedByPlan` unconditionally with
  `active = getPlanBySlug(slug)?...​.​includes(...) ?? false`, which turned an
  unresolved plan (commerce/partner — out of `ALL_PLANS` per SPEC-239 — or config
  drift) into a destructive revoke. Now guarded: capture `getPlanBySlug` and skip the
  sync entirely when the plan does not resolve (no-op, not a clear).
- **L-1** — `subscription-logic.ts` used `(mappedStatus as string) === 'expired'`; now
  `SubscriptionStatusEnum.EXPIRED`.
- **L-3** — corrected the misleading "BitmapOr serves the sort" comment in
  `accommodation.model.ts` (BitmapOr is filter-phase; the disjunction sort is
  evaluated per-row; the 0035 indexes serve WHERE-filtered queries).

**Followups (NOT in this PR — tracked):**

- **H-1 (owner decision: separate followup spec)** — the `visibility-boost-7d/30d`
  addons grant `FEATURED_LISTING` at the CUSTOMER level
  (`billing.entitlements.getByCustomerId`). `loadEntitlements` resolves plan UNION
  addon entitlements, but SPEC-292 (T-005 hooks + T-006 cron) only checks the PLAN.
  So addon-granted featuring is not wired. Accepted as followup because the addons are
  not sold yet and `FEATURED_LISTING` had zero runtime consumers before this branch
  (no observable regression). A followup spec must: make both resolvers mirror
  `loadEntitlements` (plan ∪ addon) and add an addon purchase/expiry hook.
- **M-2 (operational)** — the column ships `DEFAULT false` with no backfill. Run the
  `featured-by-plan-reconcile` cron once immediately post-deploy to backfill
  already-subscribed featured owners (≤6h transient gap otherwise). Add to release ledger.
- **M-3** — `syncFeaturedByPlan` does not trigger ISR revalidation, unlike the sibling
  `subscription-pause.service.ts`. If the public featured ordering surfaces on cached
  pages, mirror that revalidation; else confirm it's intentionally dynamic.
- **M-4** — the 8 T-005 billing call-sites have no direct unit tests (the rest is
  well-covered). Add transition→active mapping tests.
- **M-5** — `paused`/`comp` status divergence between the T-005 hooks and the T-006
  cron / `loadEntitlements`; self-heals within ≤6h via the cron.
