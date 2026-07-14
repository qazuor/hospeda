# HOS-141: POI catalog data pipeline (geocode, normalize, dedup, validate)

## Progress: 0/18 tasks (0%)

**Average Complexity:** 2.6/3 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-009 → T-011 → T-012 → T-016 → T-015 → T-018 (9 steps)
**Parallel Tracks:** 2 main tracks after T-002 (CSV/dedup track T-003→T-004→T-005; geocoding track T-006→T-007→T-008)

**Signed-off decisions (spec §11):** OQ-1 underscore slugs · OQ-2 first-listed primary · OQ-3 Nominatim · OQ-4 import null coords.
**External block:** HOS-139 (poi_categories catalog) not merged yet → T-014 (and the final RHS verify) blocked; everything else buildable now.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Scaffold standalone POI pipeline dir + CLI entrypoint skeleton
  - packages/seed/scripts/poi-pipeline/ outside src/ (NG-1/NG-4); run.ts arg parsing
  - Blocked by: none
  - Blocks: T-002, T-010

- [ ] **T-002** (complexity: 2) - Define shared pipeline types + fixed constants
  - RawCsvRow/GeocodeResult/ConfidenceTier, DESTINATION_SLUG_FIXUPS, REGIONAL_QUALIFIER, AUTO_GEOCODE_MARKER
  - Blocked by: T-001
  - Blocks: T-003, T-006, T-009

### Core Phase (Phase 1 — shape-independent, buildable now)

- [ ] **T-003** (complexity: 3) - CSV loader (stage 1: Load)
  - BOM + quoted-comma + semicolon multi-value parsing; assert 914 rows
  - Blocked by: T-002
  - Blocks: T-004, T-009

- [ ] **T-004** (complexity: 3) - Destination reconciliation (stage 2, fail-loud) — G-4
  - fixup table + validate vs 22 real fixtures; abort on unmapped (R-5)
  - Blocked by: T-003
  - Blocks: T-005, T-013

- [ ] **T-005** (complexity: 3) - Slug computation + dedup (stage 3) — G-3, OQ-1
  - POI segment → snake_case; prefix 46 colliders `<dest>_<poi>`; zero-dup assert
  - Blocked by: T-003, T-004
  - Blocks: T-012

- [ ] **T-006** (complexity: 3) - Geocoder abstraction + Nominatim provider (stage 5a) — OQ-3
  - resolveCoordinates(); ≥1000ms rate limit; backoff 429/5xx; run-time cap; User-Agent
  - Blocked by: T-002
  - Blocks: T-007, T-008

- [ ] **T-007** (complexity: 2) - Confidence tiering (stage 5b) — §6.3.1
  - importance/type → high/medium/low/unresolved; low→unresolved
  - Blocked by: T-006
  - Blocks: T-017

- [ ] **T-008** (complexity: 3) - Geocode cache (stage 5c) — G-6 idempotency
  - committed JSON cache keyed by exact address; warm re-run = 0 network calls
  - Blocked by: T-006
  - Blocks: T-017

- [ ] **T-009** (complexity: 3) - Category normalization + CATEGORY_SLUG_MAP (stage 4) — G-2, OQ-2
  - 40-entry map (RHS provisional vs HOS-139); first-listed isPrimary; abort on unmapped
  - Blocked by: T-003
  - Blocks: T-011, T-012, T-014

### Integration Phase (Phase 2 — emit; needs HOS-138 shape verify + HOS-139 slugs)

- [ ] **T-010** (complexity: 2) - Re-freeze output contract vs MERGED HOS-138 schema
  - Real fixtures lack address/keywords/verified/... from spec §7 → document true shape
  - Blocked by: T-001
  - Blocks: T-011, T-012

- [ ] **T-011** (complexity: 2) - type-derivation table (primary category → PointOfInterestTypeEnum)
  - primary category → one of 9 enum values (transient type)
  - Blocked by: T-009, T-010
  - Blocks: T-012

- [ ] **T-012** (complexity: 3) - Final per-POI JSON emit (stages 6-8) — G-5, G-7
  - fixture-shape per row; provenance carry + auto-geocode marker; staged output
  - Blocked by: T-005, T-009, T-010, T-011
  - Blocks: T-013, T-016

- [ ] **T-013** (complexity: 3) - destination-relations.json emit (PRIMARY + NEARBY)
  - PRIMARY×914 + NEARBY from 331 nearbyDestinationSlugs (reconciled)
  - Blocked by: T-004, T-012
  - Blocks: T-015

- [ ] **T-014** (complexity: 2) - Verify CATEGORY_SLUG_MAP RHS vs HOS-139 slugs — AC-3 (BLOCKED on HOS-139)
  - membership test map RHS ⊆ seeded poi_categories.slug
  - Blocked by: T-009
  - Blocks: T-018

### Testing Phase

- [ ] **T-016** (complexity: 3) - Report generation (report.md + report.json) — G-6
  - totals, geocode tiers, 40/40 coverage, 46 collisions, 2 mismatches, unresolved list; AC-8
  - Blocked by: T-012
  - Blocks: T-015

- [ ] **T-017** (complexity: 2) - Nominatim dry-run (~20 rows) to validate match-rate — §12
  - real-network sample before full run; Mapbox fallback decision if low
  - Blocked by: T-007, T-008
  - Blocks: T-018

- [ ] **T-015** (complexity: 3) - End-to-end pipeline + idempotency tests — AC-1/AC-2/AC-7/AC-8
  - 914 files, zero-dup, byte-identical warm re-run, report consistency
  - Blocked by: T-012, T-013, T-016
  - Blocks: T-018

- [ ] **T-018** (complexity: 3) - Full 717-row geocode run + OQ-2 spot-check + handoff — AC-4
  - ≥90% high/medium; ~30-row primary spot-check; hand output to HOS-142
  - Blocked by: T-014, T-015, T-017
  - Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001
- Level 1: T-002, T-010
- Level 2: T-003, T-006
- Level 3: T-004, T-007, T-008, T-009
- Level 4: T-005, T-011, T-017
- Level 5: T-012, T-014
- Level 6: T-013, T-016
- Level 7: T-015
- Level 8: T-018

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks T-002 and T-010.

Phase 1 (T-003..T-009) is fully unblocked and independent of HOS-139. The Phase 2
emit (T-011/T-012/T-014) waits on the real HOS-138 shape (T-010) and HOS-139's
final category slugs; build them provisionally, re-verify on HOS-139 merge.
