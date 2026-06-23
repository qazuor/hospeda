# SPEC-204: Accommodation gallery migration to relational table

## Progress: 6/29 tasks (21%)

**Average Complexity:** 2.5/3 (max)
**Storage model:** direct table-per-entity (`accommodation_media`, real FK) — polymorphic + junction rejected
**Strategy:** 3-phase dual-write (P1 create+backfill+write-both → P2 switch reads → P3 retire JSONB)
**Critical path:** T-001 → T-004 → T-006 → T-012 → T-013 → T-017 → T-022 → T-024 → T-025 → T-026 → T-028 (11 steps)
**Parallel start:** T-001 (db table) and T-005 (Zod schema)

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
- [ ] **T-007** (cx 3) — Write-both on accommodation create/update (table + JSONB transactional)
  - Blocked by: T-004, T-005 · Blocks: T-011, T-012, T-014
- [ ] **T-008** (cx 3) — Dual-write SPEC-167 archive/restore primitives (state flip + JSONB)
  - Blocked by: T-004 · Blocks: T-021

### Testing

- [ ] **T-009** (cx 2) — Unit tests: model + schema
  - Blocked by: T-004, T-005
- [ ] **T-010** (cx 3) — Integration: backfill correctness (no data loss)
  - Blocked by: T-006
- [ ] **T-011** (cx 3) — Integration: write-both consistency
  - Blocked by: T-007

---

## Phase P2 — Switch reads + granular write endpoints

### Integration

- [ ] **T-012** (cx 3) — Read-composition helper (rows → media shape, videos from JSONB)
  - Blocked by: T-006, T-007 · Blocks: T-013
- [ ] **T-013** (cx 3) — Switch accommodation read paths to the table (shape unchanged, ~21 read-sites intact)
  - Blocked by: T-012 · Blocks: T-015, T-017, T-024
- [ ] **T-014** (cx 2) — `enforcePhotoLimit` counts table rows (state='visible')
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

- [ ] **T-015** (cx 3) — Integration: response shape stable after read switch (golden)
  - Blocked by: T-013
- [ ] **T-016** (cx 2) — Integration: enforcePhotoLimit row-count edge cases
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
