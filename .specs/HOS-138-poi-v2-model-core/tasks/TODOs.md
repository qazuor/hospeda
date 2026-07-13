# HOS-138: POI v2 model — core (multilang content, nullable coordinates, curation columns)

## Progress: 13/13 tasks (100%)

> All tasks complete. T-012 (AC-6 dual-write convergence) verified end-to-end against
> real postgres on the worktree DB: both the 0009 create path and the 0010 UPDATE
> backfill path converge to identical per-locale nameI18n; 0010 is idempotent.
> T-013: full quality gate green (typecheck repo-wide + schemas 6673 / service-core
> 6903 / api 9131 suites); AC-8 destination POI section renders correctly in es/en/pt
> (English names via nameI18n confirm the multilang path; ES unchanged = no-op).

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 → T-003 → T-010 → T-011 → T-012 → T-013 (6 steps)
**Parallel Tracks:** 3 identified (consumer null-safety · web display · seed)

---

### Core Phase

- [ ] **T-001** (complexity: 3) - Add POI v2 columns + nullable lat/long to dbschema
  - nullable lat/long, nameI18n/descriptionI18n/translationMeta, address/keywords/hasOwnPage, curation cols, verified idx, @deprecated type
  - Blocked by: none
  - Blocks: T-002, T-003, T-010

- [ ] **T-002** (complexity: 2) - Generate structural migration 0052 + verify drift guard
  - pnpm db:generate → 0052_*.sql; AC-1 drift guard clean
  - Blocked by: T-001
  - Blocks: T-012

- [ ] **T-003** (complexity: 3) - Extend PointOfInterestSchema with v2 fields (Zod)
  - nullable lat/long + new nullish fields mirroring destination.schema.ts; @deprecated type
  - Blocked by: T-001
  - Blocks: T-004, T-005, T-006, T-007, T-008, T-010

- [ ] **T-004** (complexity: 2) - Update summary/mini projections + schema tests
  - Summary/Mini expose nameI18n; AC-2 null-coords + historic fixtures parse
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-010** (complexity: 3) - Seed baseline: add i18n content to 12 POI fixtures
  - nameI18n/descriptionI18n/translationMeta on 12 JSON fixtures (NG-6 placeholder en/pt)
  - Blocked by: T-001, T-003
  - Blocks: T-011

- [ ] **T-011** (complexity: 3) - Data migration 0010-hos-138-poi-v2-model-core
  - idempotent by-slug apply to live rows, mirrors 0009
  - Blocked by: T-010
  - Blocks: T-012

### Integration Phase

- [ ] **T-005** (complexity: 2) - Null-guard resolvePoiToCoordinates + regression test
  - null coords → { found: false } (AC-3)
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-006** (complexity: 2) - Null-guard resolvePoiConstraint + regression test
  - null-coord primary POI → { kind: 'none' } (AC-4)
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-007** (complexity: 3) - Widen getPointsOfInterestMap lat/long to number|null + hydrate i18n
  - number|null typing + select nameI18n/descriptionI18n/hasOwnPage (AC-5)
  - Blocked by: T-003
  - Blocks: T-009

- [ ] **T-008** (complexity: 2) - Make translatePoiName nameI18n-aware (poi-labels.ts)
  - prefer resolveI18nText(nameI18n), fall back to i18n-by-slug (§6.1)
  - Blocked by: T-003
  - Blocks: T-009

- [ ] **T-009** (complexity: 2) - Wire DestinationPOISection.astro to i18n resolution (no-op visual)
  - resolve name/description via helpers; MUST be visual no-op (AC-8)
  - Blocked by: T-007, T-008
  - Blocks: none

### Testing Phase

- [ ] **T-012** (complexity: 2) - Verify dual-write convergence (fresh + live path)
  - AC-6 both seed paths converge; check-seed-dual-write.sh green
  - Blocked by: T-002, T-011
  - Blocks: T-013

- [ ] **T-013** (complexity: 2) - Quality gate + AC-8 no-op smoke
  - AC-7 typecheck + scoped suites + ≥90% null-guard coverage; AC-8 manual smoke on 6 pages
  - Blocked by: T-004, T-005, T-006, T-009, T-012
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001
Level 1: T-002, T-003
Level 2: T-004, T-005, T-006, T-007, T-008, T-010
Level 3: T-009, T-011
Level 4: T-012
Level 5: T-013
```

## Suggested Start

Begin with **T-001** (complexity: 3) — no dependencies, unblocks the entire tree (T-002, T-003, T-010).
