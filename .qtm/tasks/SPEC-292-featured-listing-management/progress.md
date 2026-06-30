# SPEC-292 — Progress Tracker

Featured Listing Management

Generated: 2026-06-30

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 8 |
| Completed | 0 |
| In progress | 0 |
| Pending | 8 |
| Avg complexity | 2.9 |

## Phase Breakdown

| Phase | Tasks | Status |
|-------|-------|--------|
| core — DB + schema + search + sync service + cron | T-001, T-002, T-003, T-004, T-006 | pending |
| integration — billing event wiring | T-005 | pending |
| testing — regression + unit + integration | T-007 | pending |
| docs — SPEC-282 follow-up note | T-008 | pending |

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
| T-001 | Add featuredByPlan column, migration, and index update | pending | 3 | — |
| T-002 | Update buildAccommodationOrderBy to sort by effective featured disjunction | pending | 2 | T-001 |
| T-003 | Remove isFeatured from owner-facing schema and mapper | pending | 2 | T-001 |
| T-004 | Implement featuredByPlan bulk sync service | pending | 4 | T-001 |
| T-005 | Wire syncFeaturedByPlan to billing lifecycle events | pending | 4 | T-004 |
| T-006 | Implement featuredByPlan reconciliation cron | pending | 3 | T-004 |
| T-007 | Tests — admin regression, owner leak, sync service, search sort | pending | 4 | T-002, T-003, T-005, T-006 |
| T-008 | Add SPEC-282 follow-up cross-reference note | pending | 1 | T-007 |

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
