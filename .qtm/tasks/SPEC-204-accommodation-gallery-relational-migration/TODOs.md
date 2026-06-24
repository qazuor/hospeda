# SPEC-204: Accommodation gallery migration to relational table

## Progress: 16/29 tasks (55%) — P1 COMPLETE · P2 in progress (core read-switch + tests done)

**Average Complexity:** 2.5/3 (max)
**Storage model:** direct table-per-entity (`accommodation_media`, real FK) — polymorphic + junction rejected
**Strategy:** DIRECT CUTOVER (replan 2026-06-23, supersedes 3-phase dual-write — owner decision: no prod/real data, only regenerable seed). P1 done; collapse remaining P2+P3 into one photo cutover for accommodations: relational table is the SOLE source of truth, all raw-JSONB photo readers migrated, dual-write killed, JSONB blob shrinks to videos-only.
**Cutover order (safe sequence):** (1) migrate all raw-JSONB photo readers → table [4 compose-bypass service readers: getByDestination/getByOwner/getTopRated/getTopRatedByDestination; search cover-image; bookmark enrichment; admin upload cap; billing x3]; (2) cut photo writes to table-only (kill replace-all dual-write); (3) granular endpoints T-017..T-021 (table-direct); (4) admin UI T-022 + seed T-027; (5) strip JSONB keys T-026 + retire MediaSchema photo fields T-025 + route/regression tests T-023/T-028 + docs T-029.
**Follow-up specs:** accommodation videos (remate); gastronomy+experiences media (twins, shared spec); events/destinations/posts (analysis).
**Parallel start:** T-001 (db table) and T-005 (Zod schema)

## Cutover progress (2026-06-23)

- **Paso 1 — readers → table**: DONE (commits `e753a8f1a`, `b8e90eb4d`).
- **Paso 2 — cut writes**: DONE — update stops managing gallery (`37e3162eb`), archive/restore table-only + getAccommodationsWithArchivedPhotos (`9dfeb3530`).
- **Paso 3 — granular endpoints (T-017..T-021 + list)**: DONE — add (`24477c486`), remove/reorder/list (`111938dab`), set-featured/archive/restore (`97a5096d1`). 7 endpoints, 53 route tests, gate-matrix rows.
- **Integration validation**: DONE — service-core integration 19/19 (67 tests, `473327269`); e2e billing green (`8278ca878` selections 3/3, `573559c98` downgrade-restriction 1/1); residual unit tests green (`7f4f342f8` fixed preexisting limit-enforcement debt). Local e2e setup fix: `377310a07` (.env.test) + hospeda_test DB schema-initialized.
- **Paso 4 — admin UI (T-022) + seed (T-027)**: PENDING. Admin gallery editing is non-functional until the UI is migrated to the granular endpoints.
- **Paso 5 — strip blob (T-026) + retire MediaSchema photo fields (T-025) + integration validation pass (reds: media-tx T-011-i, e2e downgrade-restriction-selections) + route tests (T-023) + docs (T-029)**: PENDING.

---

## Phase P1 — Create + backfill + write-both (reads still on JSONB)

### Setup

- [x] **T-001** (cx 3) — Create `accommodation_media` Drizzle table schema
  - Mirror ImageSchema exactly (publicId+attribution) + state/is_featured/sort_order/archived_at; FK CASCADE; reusable column helper
  - Blocked by: none · Blocks: T-002, T-004, T-009
- [x] **T-002** (cx 2) — Generate structural migration
  - Blocked by: T-001 · Blocks: T-003, T-006
- [x] **T-003** (cx 2) — Extras-carril invariants (partial unique index `WHERE is_featured` + CHECK featured⇒not archived)
  - Blocked by: T-002 · Blocks: T-020

### Core

- [x] **T-004** (cx 3) — Create `AccommodationMediaModel` (BaseModel)
  - Blocked by: T-001 · Blocks: T-006, T-007, T-008, T-009
- [x] **T-005** (cx 2) — Add `AccommodationMediaItem` Zod schema
  - Blocked by: none · Blocks: T-007, T-009
- [x] **T-006** (cx 3) — Backfill from JSONB (featured/gallery/archivedGallery → rows, idempotent, no data loss) — 104 accom → 1625 rows, idempotent ✓
  - Blocked by: T-002, T-003, T-004 · Blocks: T-010, T-012
- [x] **T-007** (cx 3) — Write-both on accommodation create/update (table + JSONB transactional) — junction-sync pattern, atomic via ctx.tx
  - Blocked by: T-004, T-005 · Blocks: T-011, T-012, T-014
- [x] **T-008** (cx 3) — Dual-write SPEC-167 archive/restore primitives (state flip + JSONB) — selective flip by url, same tx, smoke ✓
  - Blocked by: T-004 · Blocks: T-021

### Testing

- [x] **T-009** (cx 2) — Unit tests: model + schema (32 schema + 16 model ✓) + 2 i18n keys (es/en/pt)
  - Blocked by: T-004, T-005
- [x] **T-010** (cx 3) — Integration: backfill correctness (no data loss) — 6 tests ✓
  - Blocked by: T-006
- [x] **T-011** (cx 3) — Integration: write-both consistency — 7 tests ✓
  - Blocked by: T-007

---

## Phase P2 — Switch reads + granular write endpoints

### Integration

- [x] **T-012** (cx 3) — Read-composition helper (rows → media shape, videos from JSONB) — pure `composeAccommodationMedia`, omits absent keys (byte-identical shape), 8 unit tests ✓
  - Blocked by: T-006, T-007 · Blocks: T-013
- [x] **T-013** (cx 3) — Switch accommodation read paths to the table (shape unchanged, ~21 read-sites intact) — compose via _afterGetByField/_afterList/_afterSearch/getSummary + batch finder; archived_at preserve + bypass readers (getByDestination/Owner/TopRated + raw-JSONB) DEFERRED to T-024; 17 read-test files re-mocked; review passed
  - Blocked by: T-012 · Blocks: T-015, T-017, T-024
- [x] **T-014** (cx 2) — `enforcePhotoLimit` counts table rows (state='visible') — findByAccommodation(state:'visible').total, no entity load; test in T-016
  - Blocked by: T-007 · Blocks: T-016
- [ ] **T-017** (cx 2) — API endpoint: add photo (+ endpoint-gate-matrix row)
  - Blocked by: T-013 · Blocks: T-019, T-022, T-023
- [ ] **T-018** (cx 2) — API endpoint: remove photo (resequence)
  - Blocked by: T-013 · Blocks: T-022, T-023
- [ ] **T-019** (cx 3) — API endpoint: reorder gallery
  - Blocked by: T-017 · Blocks: T-022, T-023
- [ ] **T-020** (cx 2) — API endpoint: set featured (single-featured invariant)
  - Blocked by: T-003, T-013 · Blocks: T-022, T-023
- [ ] **T-021** (cx 2) — API endpoint: archive/restore photo (reuse 167 primitive)
  - Blocked by: T-008, T-013 · Blocks: T-022, T-023
- [ ] **T-022** (cx 3) — Admin UI: migrate gallery editor to granular endpoints
  - Blocked by: T-017, T-018, T-019, T-020, T-021

### Testing

- [x] **T-015** (cx 3) — Integration: response shape stable after read switch (golden) — real-DB round-trip + gallery-from-table-not-stale-JSONB + videos-only + fidelity-guard; 67/67 integration green
  - Blocked by: T-013
- [x] **T-016** (cx 2) — Integration: enforcePhotoLimit row-count edge cases — findByAccommodation(state:'visible').total excludes archived; empty=0; gallery-only counts all
  - Blocked by: T-014
- [ ] **T-023** (cx 3) — API route tests: granular endpoints (auth + invariants)
  - Blocked by: T-017, T-018, T-019, T-020, T-021

---

## Phase P3 — Retire JSONB

### Cleanup

- [ ] **T-024** (cx 2) — Stop writing gallery/featuredImage/archivedGallery to JSONB (table = source of truth)
  - Blocked by: T-013, T-022 · Blocks: T-025
- [ ] **T-025** (cx 3) — Retire those fields from MediaSchema (videos remain) + fix type fallout
  - Blocked by: T-024 · Blocks: T-026, T-028
- [ ] **T-026** (cx 2) — Data migration: strip retired keys from existing JSONB
  - Blocked by: T-025 · Blocks: T-028
- [ ] **T-027** (cx 2) — Update seed to populate `accommodation_media`
  - Blocked by: T-001

### Testing

- [ ] **T-028** (cx 3) — Regression: full lifecycle post-retirement (JSONB gallery-free, 167 restore works)
  - Blocked by: T-025, T-026

### Docs

- [ ] **T-029** (cx 2) — Docs: table, granular endpoints, migration carriles, reusable pattern
  - Blocked by: T-022, T-026

---

## Dependency Levels

- **Level 0:** T-001, T-005
- **Level 1:** T-002, T-004, T-027
- **Level 2:** T-003, T-006, T-007, T-008, T-009
- **Level 3:** T-010, T-011, T-012, T-014
- **Level 4:** T-013, T-016
- **Level 5:** T-015, T-017, T-018, T-020, T-021
- **Level 6:** T-019
- **Level 7:** T-022, T-023
- **Level 8:** T-024
- **Level 9:** T-025
- **Level 10:** T-026, T-028
- **Level 11:** T-029

## Suggested Start

Begin with **T-001** (db table) and **T-005** (Zod schema) in parallel — both unblocked. T-001 is the spine: it unblocks the model, backfill, and everything downstream.

> Note: spec stays `draft` until implementation starts. On T-001 start, flip SPEC-204 → `in-progress` across `specs/index.json`, `tasks/index.json`, and `specs-prioritization.csv` (index-sync).
