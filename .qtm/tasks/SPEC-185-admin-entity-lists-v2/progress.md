# SPEC-185 — Progress Tracker

Admin Entity Lists v2 — filters, grid cards, host portfolio & tags migration

Generated: 2026-06-02 | Linear: BETA-75, BETA-72, BETA-76

## Summary

| Metric | Value |
|--------|-------|
| Total tasks | 17 |
| Completed | 4 |
| In progress | 0 |
| Pending | 13 |
| Avg complexity | 3.1 |

## Phase Breakdown

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 — Filter infrastructure (FR-1) | T-001, T-002, T-003, T-004 | completed (2026-06-04) |
| Phase 2 — Filter backfill (FR-1 targets + FR-2) | T-005, T-006, T-007 | pending |
| Phase 3 — GridCard polish + per-entity override (FR-3) | T-008, T-009, T-010 | pending |
| Phase 4 — Host portfolio migration (FR-4, BETA-76) | T-011, T-012 | pending |
| Phase 5 — Tags migration (FR-5) | T-013, T-014, T-015 | pending |
| Phase 6 — Closeout | T-016, T-017 | pending |

## Critical Path

```
T-001 (types) → T-002 (controls) + T-003 (state) → T-004 (api+backend)
                                                           ↓
                                                      T-005 (wire configs)
                                                           ↓
                                                      T-006 (six unfiltered lists)
                                                           ↓
                                                      T-007 (quality gate P1+P2)
                                                           ↓
                                                      T-008 (grid polish)
                                                           ↓
                                                      T-009 (renderCard override)
                                                           ↓
                                                      T-010 (quality gate P3)
                                                           ↓
                                                      T-011 (me-accommodations config)
                                                           ↓
                                                      T-012 (host portfolio migrate)
                                                           ↓
                                                      T-013 (post-tags migrate)
                                                           ↓
                                                      T-014 (internal-tags migrate)
                                                           ↓
                                                      T-015 (user-moderation-tags migrate)
                                                           ↓
                                                      T-016 (smoke + PR)
                                                           ↓
                                                      T-017 (closeout)
```

Critical path length: 13 tasks deep (T-001 → T-002 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-012 → T-013 → T-014 → T-015 → T-016 → T-017).

## Parallel Tracks Within Phase 1

```
Track A (types):        T-001
                          ↓
Track B (controls):     T-002  ──────────────────────────────────┐
Track C (URL state):    T-003  ──────────────────────────────────┤
                                                                  ↓
                                                          T-004 (merge point — api+backend)
```

T-002 and T-003 both depend on T-001 and can proceed in parallel. T-004 depends on both.

## Task Status

| ID | Title | Status | Complexity | Blocked By |
|----|-------|--------|-----------|------------|
| T-001 | Extend FilterControlType union and add range config types | pending | 2 | — |
| T-002 | Build FilterNumberRange and FilterDateRange UI controls | pending | 4 | T-001 |
| T-003 | Extend useFilterState for two-param range URL serialization | pending | 3 | T-001 |
| T-004 | Extend createEntityApi to forward range bounds and wire backend range filters | pending | 5 | T-002, T-003 |
| T-005 | Wire number-range and date-range filters into entity configs | pending | 3 | T-002, T-003, T-004 |
| T-006 | Add filter bars to the six previously-unfiltered entity lists | pending | 5 | T-005 |
| T-007 | Quality gate — Phase 1 + Phase 2 all tests green | pending | 1 | T-006 |
| T-008 | Polish the generic GridCard component | pending | 4 | T-007 |
| T-009 | Add gridConfig.renderCard and GridCardRenderProps to EntityConfig | pending | 3 | T-008 |
| T-010 | Quality gate — Phase 3 grid tests green and visual smoke done | pending | 1 | T-009 |
| T-011 | Create grid-only host accommodations config | pending | 3 | T-010 |
| T-012 | Migrate /me/accommodations route onto createEntityListPage | pending | 4 | T-011 |
| T-013 | Migrate post-tags list onto createEntityListPage | pending | 4 | T-012 |
| T-014 | Migrate internal tags list onto createEntityListPage | pending | 4 | T-013 |
| T-015 | Migrate user-moderation tags list onto createEntityListPage | pending | 4 | T-014 |
| T-016 | Full test suite, manual admin smoke, and PR open | pending | 2 | T-015 |
| T-017 | Post-merge: flip spec + task indexes to completed and close Linear issues | pending | 1 | T-016 |

## Notes

- T-001 has no blockers — start here immediately.
- T-002 and T-003 are independent of each other and can run in parallel after T-001.
- T-004 is the highest-complexity task (5) — it touches four packages (admin, schemas, service-core, and the API route declarations). Budget 2-3 hours.
- T-006 (backfill six unfiltered lists) is the other complexity-5 task. It is wide (6 entities × 3 files each) but mechanically repetitive. Commit one entity at a time.
- T-007 and T-010 are mandatory quality-gate tasks (no new code). They must be GREEN before the next phase begins.
- Tag migrations (T-013, T-014, T-015) are committed one list per commit per spec §10 decision 6 to minimize regression blast radius.
- T-017 (closeout) MUST use a new branch — the spec branch is merged by then.
- Money columns (price) are stored as integer centavos. The `number-range` filter operates on centavos; `unitLabelKey` documents this.
- The `relation` filter control type is explicitly OUT OF SCOPE for this spec.
