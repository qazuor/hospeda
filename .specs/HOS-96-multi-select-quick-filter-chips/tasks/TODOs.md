# HOS-96 — Multi-select en los chips de filtro rápido de los listados

Task breakdown generated from `.specs/HOS-96-multi-select-quick-filter-chips/spec.md`.
Full task detail (description, subtasks, dependencies, quality gates) lives in
`tasks/state.json`. This file is a human-readable index.

**Total tasks:** 27 | **Average complexity:** 1.9 (scale 1-3) | **Phases:** setup(1) → core(6) → integration(12) → testing(6) → docs(2)

## Phase: setup

- [ ] **T-001** — Define per-facet multi-select filter config model *(complexity 2)*

## Phase: core (backend — schemas → models → services)

Track A (events):

- [ ] **T-002** — Add categories array query param to EventSearchHttpSchema *(1)*
- [ ] **T-004** — Add manual inArray/eq category WHERE branch to EventModel *(2)* — blocked by T-002
- [ ] **T-006** — Forward filters.categories in event.service.ts *(2)* — blocked by T-004

Track B (posts/blog):

- [ ] **T-003** — Add categories array query param to PostSearchHttpSchema *(1)*
- [ ] **T-005** — Add manual inArray/eq category WHERE branch to PostModel *(2)* — blocked by T-003
- [ ] **T-007** — Forward filters.categories in post.service.ts *(2)* — blocked by T-005

## Phase: integration (frontend + SEO)

Track C (multi-toggle helper + chip behavior):

- [ ] **T-008** — Create buildMultiToggleParamHref helper *(2)*
- [ ] **T-009** — Render per-value active state and aria-pressed on chip rows *(2)* — blocked by T-008
- [ ] **T-010** — Add "Clear (N)" bulk-reset chip *(2)* — blocked by T-009

Per-facet chip switch (all three blocked by T-001 + T-010; each also blocked by its own backend track):

- [ ] **T-011** — Switch accommodation-type chip to in-place multi-toggle *(3)* — blocked by T-001, T-010
- [ ] **T-012** — Switch blog/post-category chip to in-place multi-toggle *(3)* — blocked by T-001, T-010, T-007
- [ ] **T-013** — Switch events-category chip from single to multi toggle *(2)* — blocked by T-001, T-010, T-006

Sidebar key alignment:

- [ ] **T-014** — Rename events sidebar FilterGroup id category→categories *(2)* — blocked by T-013
- [ ] **T-015** — Rename blog sidebar FilterGroup id category→categories *(2)* — blocked by T-012

SEO (2+-value noindex/canonical):

- [ ] **T-016** — Implement shared 2+-value SEO noindex/canonical predicate *(3)* — blocked by T-001
- [ ] **T-017** — Wire predicate into accommodations listing head *(1)* — blocked by T-016, T-011
- [ ] **T-018** — Wire predicate into events listing head *(1)* — blocked by T-016, T-013
- [ ] **T-019** — Wire predicate into blog listing head *(1)* — blocked by T-016, T-012

## Phase: testing

- [ ] **T-020** — Regression suite for the shipped `?category=A,B` latent bug *(2)* — blocked by T-006, T-007
- [ ] **T-021** — Backward-compatibility regression suite across all three facets *(2)* — blocked by T-006, T-007
- [ ] **T-022** — Edge-case matrix for array param parsing across layers *(3)* — blocked by T-002, T-003, T-004, T-005
- [ ] **T-023** — Destinos no-op regression guard *(1)* — blocked by T-011, T-012, T-013
- [ ] **T-024** — Chip/sidebar/URL sync matrix across all three facets *(2)* — blocked by T-014, T-015, T-011
- [ ] **T-025** — Back/forward (popstate) navigation coherence test *(2)* — blocked by T-024

## Phase: docs

- [ ] **T-026** — Document per-facet operator model + URL-as-state principle in `apps/web/CLAUDE.md` *(1)* — blocked by T-014, T-015, T-017, T-018, T-019
- [ ] **T-027** — Write closeout.md + record decisions on the Linear issue *(1)* — blocked by T-020..T-026 (all)

## Parallel tracks

```
Track A (events backend):   T-002 → T-004 → T-006 ─┐
Track B (posts backend):    T-003 → T-005 → T-007 ─┤
Track C (frontend helper):  T-008 → T-009 → T-010 ─┴→ T-011 / T-012 / T-013 (fan-out, one per facet)
Track D (config):           T-001 ──────────────────┘

                              T-011 → T-017 (SEO acc.)
T-013 → T-014 (sidebar events) ┐
T-012 → T-015 (sidebar blog)   ┤→ T-024 (sync matrix) → T-025 (popstate)
T-011 ──────────────────────────┘

T-016 (SEO predicate, needs only T-001) → T-017 / T-018 / T-019

Merge → T-026 (docs) → T-027 (closeout)
```

Tracks A, B, C, D run fully in parallel until they converge at T-011/T-012/T-013.
T-016 (SEO predicate) only needs T-001 and can run in parallel with all backend/helper work.

## Critical path

Longest chain (8 tasks), through the events branch (posts branch ties at equal length):

```
T-002 → T-004 → T-006 → T-013 → T-014 → T-024 → T-025 → T-027
```

(equally long alternative through posts: `T-003 → T-005 → T-007 → T-012 → T-015 → T-024 → T-025 → T-027`;
both merge at T-024). Start these first — they gate the testing phase, which gates closeout.

Tasks with float (can slip without extending the critical path): T-008/T-009/T-010 (helper chain feeds
T-011 which is NOT on the critical path), T-016/T-017/T-018/T-019 (SEO track), T-020/T-021/T-022/T-023
(testing tasks that don't feed T-024/T-025).

## Notes for the implementer

- **No DB migration.** If you find yourself writing one, stop — the spec is explicit that none is needed.
- **Accommodation `types` backend already exists.** T-011 is frontend-only; do not touch its schema/model.
- **`buildWhereClause` does NOT handle arrays.** T-004/T-005 require a manual `inArray`-vs-`eq` branch —
  this is the actual root cause of the latent bug (see spec Risks table).
- **URL is the only shared state** between chips and sidebar — no in-memory store, ever (US-5, US-8).
- OQ-1..OQ-4 are already resolved in the spec (contract, not open) — no owner check-in needed mid-implementation.
