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

### Review note (for the PR review)

- T-005 derives `active` from the changed subscription's plan config but does **not**
  filter by `isAccommodationSubscription` (SPEC-239), whereas the T-006 cron does. An
  owner holding both an accommodation and a commerce subscription could see a brief
  `featuredByPlan` flap on a commerce-sub transition; the 6h reconcile cron corrects
  it. Consider tightening the T-005 hooks to skip non-accommodation subscriptions.
