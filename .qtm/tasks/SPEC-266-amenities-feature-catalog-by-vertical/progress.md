# SPEC-266 — Amenities & features catalog by vertical — Progress

**Status**: in-progress (0/13)
**Created**: 2026-06-23
**Linear**: BETA-90 (absorbed)

## Phase Summary

| Phase | Tasks | Done |
|---|---|---|
| core (DB + schema + i18n + seed) | T-001, T-002, T-003, T-004 | 0/4 |
| integration (API + web + admin) | T-005, T-006, T-007, T-008, T-009, T-010 | 0/6 |
| testing (data-safety + smoke) | T-011, T-012 | 0/2 |
| docs | T-013 | 0/1 |

## Critical Path

T-001 → T-002 → T-005 → T-008 → T-011 → T-012 → T-013

Longest sequential chain (7 steps). Key parallel tracks:

- **Track A (DB → API)**: T-001 → T-002 → T-005 → (T-008, T-009)
- **Track B (i18n + seed)**: T-001 → T-003 + T-004 (parallel) → T-006 → (T-007, T-010)
- **Merge point**: T-011 (depends on T-004 + T-005 + T-007 + T-008 + T-009 + T-010)

## Parallel Tracks

```
T-001 (DB migration, no deps)
  ├─→ T-002 (schemas) ─→ T-005 (API vertical filter)
  │                    ├─→ T-007 (accommodation editor) — also blocked by T-003
  │                    └─→ T-009 (admin forms)
  ├─→ T-003 (i18n + search refactor + catalog-names.ts removal)
  │     └─→ T-006 (new taxonomy i18n keys) — also blocked by T-004
  └─→ T-004 (seed taxonomy)
        └─→ T-006 (new taxonomy i18n keys)
                           T-008 (commerce editor) — blocked by T-004 + T-005 + T-006
                           T-010 (detail pages) — blocked by T-003 + T-004 + T-006
                                  ↓
                           T-011 (migration-safety integration test)
                                  ↓
                           T-012 (E2E smoke)
                                  ↓
                           T-013 (docs)
```

## Key Decisions (All Resolved — §4/§5)

| # | Decision | Resolution |
|---|---|---|
| D-1 | Catalog approach | Option A: single catalog + `applicableVerticals text[]` |
| D-2 | Scope shape | `text[]` on each row (NOT an N:M table) |
| D-3 | i18n identifier | slug (snake_case) = canonical id AND i18n key |
| D-4 | Slug regex | Relax to `^[a-z0-9]+(?:[-_][a-z0-9]+)*$` (allows underscores) |
| D-5 | name column | Drop it; display via `amenityNames.<slug>` / `featureNames.<slug>` |
| D-6 | Feature dimension | Keep BOTH amenities AND features per vertical (all wired end-to-end) |
| D-7 | Catalog scope | BOOLEAN attributes only; value-bearing = listing fields (out of scope) |
| D-8 | Migration safety | All existing `r_accommodation_amenity` / `r_accommodation_feature` rows preserved |

## Owner Actions Required

- None at this time — all decisions resolved (§5 owner-approved 2026-06-23).
- PR review + merge to staging after implementation completes.
- Validate the human-quality i18n strings in T-006 (es/en/pt labels for 35 new slugs).

## Notes

- T-001 is the unblocked starting point; start it first (critical path gate).
- T-003 and T-004 can run in parallel immediately after T-001 completes.
- T-005 and T-007 can both start as soon as T-002 completes (T-007 also needs T-003).
- T-006 depends on BOTH T-003 and T-004 (needs the namespaces AND the slug list).
- T-008 (commerce editor) is the highest-complexity integration task and depends on T-004 + T-005 + T-006.
- T-011 is the formal data-integrity gate — it must pass before claiming the spec is done.
- BETA-90 is fully absorbed: the `name` drop and `featureNames` namespace ship together in T-001/T-003/T-006.
- The interim shim `apps/web/src/lib/catalog-names.ts` is deleted in T-003 (not a separate cleanup task).
- No extras carril entry needed (no triggers/views/check constraints); structural migration only.
