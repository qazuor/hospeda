# HOS-294: Partners — retire the filtered directory, give each gold partner its own page

## Progress: 0/28 tasks (0%)

**Average Complexity:** 2.0/3 (max)
**Critical Path:** T-005 -> T-006 -> T-007 -> T-016 -> T-017 -> T-019 -> T-021 -> T-028 (8 steps)
**Parallel Tracks:** 5 identified

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Migrate live bronze partners to silver (seed data-migration + baseline)
  - Dual-write per HOS-25. MUST land before T-002 on a live env: Postgres cannot drop an enum value any row still holds.
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 3) - Drop bronze from the partner_tier Postgres enum (structural migration)
  - No ALTER TYPE ... DROP VALUE exists: new type + ALTER COLUMN USING + drop old + recreate partners_tier_idx.
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 2) - Remove BRONZE from PartnerTierEnum and its Zod schema
  - Fix every consumer the typecheck surfaces, including the admin tier select.
  - Blocked by: T-002
  - Blocks: none

- [ ] **T-004** (complexity: 1) - Trim PartnerSearchHttpSchema to pagination only
  - Kills the directory's filter surface. One consumer only, verified.
  - Blocked by: none
  - Blocks: T-007, T-027

- [ ] **T-005** (complexity: 1) - Extend PartnerPublicSchema additively with contactInfo and socialNetworks
  - ADDITIVE ONLY — removal is forbidden by the schema-compat policy.
  - Blocked by: none
  - Blocks: T-006

### Core Phase

- [ ] **T-006** (complexity: 3) - Add PartnerService.getPublicBySlug with the three-state gold gate
  - found / gone / notFound. The failing-gate tests MUST use rows that EXIST.
  - Blocked by: T-005
  - Blocks: T-007

- [ ] **T-007** (complexity: 2) - Add GET /api/v1/public/partners/{slug}
  - Maps the three states to 200 / 410 / 404.
  - Blocked by: T-004, T-006
  - Blocks: T-008, T-016

- [ ] **T-008** (complexity: 2) - Classify /api/v1/public/partners as a public-cache endpoint
  - Currently in none of the three lists in cache.constants.ts.
  - Blocked by: T-007
  - Blocks: none

- [ ] **T-009** (complexity: 2) - Add the partner entity prefix to the cache-tag vocabulary
  - Entity prefix yes, collection tag NO — there is no page listing partners.
  - Blocked by: none
  - Blocks: T-010, T-011, T-025

- [ ] **T-010** (complexity: 2) - Seed the partner revalidation_config row (baseline + data-migration)
  - Without the data-migration, staging and prod schedule nothing.
  - Blocked by: T-009
  - Blocks: T-011

- [ ] **T-011** (complexity: 3) - Schedule revalidation on partner writes (entity tag + home)
  - The carousel lives on the home page, so a partner write IS a home-page change.
  - Blocked by: T-009, T-010
  - Blocks: none

- [ ] **T-012** (complexity: 2) - Delete the directory page and PartnerCard
  - Deleting the folder is what makes /es/partners/ 404 (D-4).
  - Blocked by: none
  - Blocks: T-013, T-014, T-015

- [ ] **T-013** (complexity: 2) - Delete PartnerCardData and toPartnerCardProps
  - Do NOT touch toPartnerData — it feeds the carousel.
  - Blocked by: T-012
  - Blocks: T-022

- [ ] **T-014** (complexity: 1) - Remove /partners/ from the static sitemap
  - The guard does NOT catch a stale entry whose page was deleted.
  - Blocked by: T-012
  - Blocks: T-027

- [ ] **T-015** (complexity: 1) - Delete the directory's i18n keys in all three locales
  - Keep types.*, drop listing.* and tiers.*. The tier is never rendered publicly.
  - Blocked by: T-012
  - Blocks: T-020

- [ ] **T-016** (complexity: 2) - Add partnerApi.getBySlug to the web API client
  - Must preserve the 410 vs 404 distinction for the page.
  - Blocked by: T-007
  - Blocks: T-017, T-024

- [ ] **T-017** (complexity: 2) - Add toPartnerDetailProps to transforms.ts
  - A new transform, not a rename of the deleted card one. Carries no tier.
  - Blocked by: T-016
  - Blocks: T-019

- [ ] **T-018** (complexity: 2) - Write evaluatePartnerIndexability, the shared page/sitemap predicate
  - Includes the minimum-content condition that mitigates R-3.
  - Blocked by: none
  - Blocks: T-019, T-024

- [ ] **T-019** (complexity: 3) - Create pages/[lang]/partners/[slug].astro (fetch, status, head)
  - noindex is never a literal; the frontmatter must not read the session.
  - Blocked by: T-017, T-018
  - Blocks: T-021, T-025, T-026

- [ ] **T-020** (complexity: 1) - Add the detail page i18n keys in es/en/pt
  - Blocked by: T-015
  - Blocks: T-021

- [ ] **T-021** (complexity: 3) - Build the detail page markup and scoped styles
  - Business card, not a listing. Tokens only. Assert the tier renders nowhere.
  - Blocked by: T-019, T-020
  - Blocks: T-028

### Integration Phase

- [ ] **T-022** (complexity: 2) - Extend PartnerData and toPartnerData with slug and tier
  - The carousel cannot branch per tier without them.
  - Blocked by: T-013
  - Blocks: T-023

- [ ] **T-023** (complexity: 3) - Branch the carousel href per tier
  - BOTH marquee tracks must change, including the duplicated aria-hidden one.
  - Blocked by: T-022
  - Blocks: T-028

- [ ] **T-024** (complexity: 3) - Emit gold partner URLs into sitemap-dynamic.xml
  - APPEND the fetch to Promise.allSettled — the tests stub fetch positionally.
  - Blocked by: T-016, T-018
  - Blocks: T-026

- [ ] **T-025** (complexity: 2) - Emit cache tags on the detail page response
  - CACHE_TAG_ALL goes at the HEAD: truncation drops the tail.
  - Blocked by: T-009, T-019
  - Blocks: none

### Testing Phase

- [ ] **T-026** (complexity: 2) - Guard test: the page and the sitemap share ONE predicate
  - Acceptance bar: flipping a condition must break BOTH sides, never just one.
  - Blocked by: T-019, T-024
  - Blocks: T-028

- [ ] **T-027** (complexity: 2) - Run the repo guards and the full affected test suites
  - Run existing tests of touched files, not only the new ones.
  - Blocked by: T-004, T-014
  - Blocks: T-028

### Docs Phase

- [ ] **T-028** (complexity: 1) - Document the partner page in apps/web/CLAUDE.md
  - Blocked by: T-021, T-023, T-026, T-027
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-004, T-005, T-009, T-012, T-018
Level 1: T-002, T-006, T-010, T-013, T-014, T-015
Level 2: T-003, T-007, T-011, T-020, T-022, T-027
Level 3: T-008, T-016, T-023
Level 4: T-017, T-024
Level 5: T-019
Level 6: T-021, T-025, T-026
Level 7: T-028
```

## Parallel Tracks

1. **DB / tier retirement** — T-001 -> T-002 -> T-003
2. **API contract** — T-004, T-005 -> T-006 -> T-007 -> T-008
3. **Cache & revalidation** — T-009 -> T-010 -> T-011, plus T-025
4. **Web demolition** — T-012 -> T-013, T-014, T-015 -> T-022 -> T-023
5. **SEO / the page** — T-018 -> T-019 -> T-021, plus T-024 -> T-026

## Suggested Start

Begin with **T-005** (complexity: 1) — no dependencies, and it opens the critical
path. **T-012** (complexity: 2) is the other good opener: the demolition track is
independent of everything else and shrinks the surface the rest has to reason about.

## Ordering warning

**T-001 must be applied before T-002 on any live environment.** The structural
migration fails if a single row still holds `bronze`. On a fresh DB the order is
irrelevant; on staging and prod it is not.
