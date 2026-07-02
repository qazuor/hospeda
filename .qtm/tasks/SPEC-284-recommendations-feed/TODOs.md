# SPEC-284 — Personalized Recommendations Feed

## Status: 17/17 complete (implementation done, not yet merged to staging)

All 16 originally atomized tasks (T-001..T-016) are complete, plus one
ad-hoc task **T-005b** (dedicated `PermissionEnum.RECOMMENDATION_VIEW`,
user-approved mid-implementation, not part of this original atomization —
see `state.json` for detail). All 17 tasks landed on
`spec/SPEC-284-recommendations-feed` with lint/typecheck/tests green per
task. A fresh-context code review found 2 minor issues, both fixed in a
follow-up commit. No PR has been opened yet — see `state.json` summary
and `.qtm/tasks/index.json` for current sync status.

## Task Overview

16 tasks across 4 phases. Total estimated effort: ~35 hours.
Critical path length: ~17 hours. Average complexity: 1.94/3.

---

## Phases

### Phase: core (Tasks T-001..T-006)

Foundation layer: data-layer gap, schemas, pure logic, service orchestrator.

| ID | Title | Complexity | BlockedBy | Blocks |
|---|---|---|---|---|
| T-001 | Add getRecentlyViewedByUser() to EntityViewModel | 2 | — | T-005 |
| T-002 | Create recommendation Zod schemas in @repo/schemas | 2 | — | T-003, T-004, T-005 |
| T-003 | Implement recommendation profile builder (TDD) | 3 | T-002 | T-004, T-005 |
| T-004 | Implement candidate scorer (TDD) | 3 | T-002, T-003 | T-005 |
| T-005 | Implement RecommendationService orchestrator | 3 | T-001, T-002, T-003, T-004 | T-006 |
| T-006 | Wire RecommendationService exports in service-core | 1 | T-005 | T-008 |

### Phase: integration (Tasks T-007..T-014)

API wiring, web UI, i18n, SPEC-282 cleanup.

| ID | Title | Complexity | BlockedBy | Blocks |
|---|---|---|---|---|
| T-007 | Activate gateRecommendations() (remove PHANTOM-GATE comment) | 1 | — | T-008 |
| T-008 | Create protected recommendations API route | 2 | T-006, T-007 | T-009, T-015 |
| T-009 | Wire route in routes index and update gate matrix | 1 | T-008 | T-012, T-014, T-015 |
| T-010 | Add recommendations i18n keys (es/en/pt + types.ts) | 2 | — | T-011, T-013 |
| T-011 | Create RecommendationsFeed.client.tsx island + CSS module | 3 | T-010 | T-012, T-016 |
| T-012 | Create /recomendaciones page in mi-cuenta | 2 | T-009, T-011 | T-013 |
| T-013 | Add recommendations nav link to mi-cuenta dashboard | 1 | T-010, T-012 | — |
| T-014 | Remove Próximamente badge from PlanComparisonTable | 1 | T-009 | — |

### Phase: testing (Tasks T-015..T-016)

Cross-cutting test suites.

| ID | Title | Complexity | BlockedBy | Blocks |
|---|---|---|---|---|
| T-015 | Write API route integration tests | 2 | T-008, T-009 | — |
| T-016 | Write RecommendationsFeed component tests | 2 | T-011 | — |

---

## Dependency Graph (by levels)

```
Level 0 (no deps — start here):
  T-001  T-002  T-007  T-010

Level 1 (unblock after Level 0):
  T-003 (needs T-002)
  T-011 (needs T-010)

Level 2:
  T-004 (needs T-002, T-003)
  T-016 (needs T-011)

Level 3:
  T-005 (needs T-001, T-002, T-003, T-004)

Level 4:
  T-006 (needs T-005)

Level 5:
  T-008 (needs T-006, T-007)

Level 6:
  T-009 (needs T-008)
  T-015 (needs T-008, T-009 — technically level 6+)

Level 7:
  T-012 (needs T-009, T-011)
  T-014 (needs T-009)
  T-015 (needs T-009)

Level 8:
  T-013 (needs T-010, T-012)
```

---

## Parallel Tracks

Two largely independent tracks that merge at T-012:

```
Track A — Service + API (critical path, ~17h):
  T-002 (2h) → T-003 (3h) → T-004 (3h) → T-005 (3h) → T-006 (0.5h) → T-008 (2h) → T-009 (0.5h)
                                                                                              |
  T-001 (2h) ───────────────────────────────────────────────────────────────────────→ T-005
  T-007 (0.5h) ────────────────────────────────────────────────────────────────────→ T-008

Track B — i18n + Web UI (~7.5h, ~9h float):
  T-010 (2h) → T-011 (3h)
                     |
             ─────── T-012 (2h) → T-013 (0.5h)
                     |
  T-009 ────→
                     T-014 (0.5h) [independent of T-011]
                     T-015 (2h)  [independent of T-011]
                     T-016 (2h)  [needs T-011]
```

Merge point: T-012 (depends on T-009 from Track A + T-011 from Track B).

---

## Critical Path

`T-002 → T-003 → T-004 → T-005 → T-006 → T-008 → T-009 → T-012 → T-013`

Length: ~17.5 hours. These 9 tasks must be sequenced; no parallelism possible between them.

Float (can be delayed without impacting delivery):

- T-001: 9h float (only blocker is T-005, which itself waits on T-003+T-004 chain)
- T-007: high float (only needs to land before T-008)
- T-010, T-011: ~9h float (they must complete before T-012, which is at the end of Track A)
- T-014, T-015, T-016: no downstream blockers — can be done anytime after their deps

---

## Suggested First Task

**Start with T-002 and T-001 in parallel** (both unblocked, independent).

T-002 (schemas) is on the critical path — starting it first unblocks T-003 and the whole service chain.
T-001 (EntityViewModel method) is a self-contained DB layer addition that can be completed in ~2h.
T-007 (remove phantom-gate comment) is a 15-minute task — do it opportunistically.
T-010 (i18n) is also unblocked and can be handled in parallel by a second developer.

Recommended execution order for a single developer:

1. T-002 (schemas — critical path first)
2. T-001 (data layer — unblocked, short)
3. T-007 (gate activation — trivial)
4. T-003 (profile builder TDD — critical path)
5. T-004 (scorer TDD — critical path)
6. T-010 (i18n — can be done between T-004 and T-005 to give T-011 a head start)
7. T-005 (orchestrator — critical path)
8. T-006 (wire exports — critical path)
9. T-008 (API route — critical path)
10. T-009 (wire + gate matrix — critical path)
11. T-011 (React island)
12. T-014 (remove Próximamente — quick)
13. T-012 (Astro page)
14. T-013 (nav link — quick)
15. T-015 (API tests)
16. T-016 (component tests)

---

## Key Files by Task

| Task | Key Files |
|---|---|
| T-001 | `packages/db/src/models/entity-view/entity-view.model.ts` |
| T-002 | `packages/schemas/src/entities/recommendation/recommendation.schema.ts` |
| T-003 | `packages/service-core/src/services/recommendation/recommendation.profile.ts` |
| T-004 | `packages/service-core/src/services/recommendation/recommendation.scorer.ts` |
| T-005 | `packages/service-core/src/services/recommendation/recommendation.service.ts` |
| T-006 | `packages/service-core/src/services/recommendation/index.ts`, `packages/service-core/src/services/index.ts` |
| T-007 | `apps/api/src/middlewares/tourist-entitlements.ts` |
| T-008 | `apps/api/src/routes/recommendations/protected/get.ts` |
| T-009 | `apps/api/src/routes/index.ts`, `docs/billing/endpoint-gate-matrix.md` |
| T-010 | `packages/i18n/src/locales/{es,en,pt}/account.json`, `packages/i18n/src/types.ts` |
| T-011 | `apps/web/src/components/account/RecommendationsFeed.client.tsx`, `...module.css` |
| T-012 | `apps/web/src/pages/[lang]/mi-cuenta/recomendaciones/index.astro` |
| T-013 | `apps/web/src/pages/[lang]/mi-cuenta/index.astro` |
| T-014 | `apps/web/src/components/billing/PlanComparisonTable.astro` |
| T-015 | `apps/api/src/routes/recommendations/protected/get.test.ts` |
| T-016 | `apps/web/src/components/account/RecommendationsFeed.test.tsx` |
