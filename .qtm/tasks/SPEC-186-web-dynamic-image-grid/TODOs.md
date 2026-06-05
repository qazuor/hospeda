# SPEC-186: Web Dynamic Image Grid

## Progress: 3/18 tasks (17%)

**Average Complexity:** 2.2/10
**Critical Path:** T-001 → T-002 → T-003 → T-008 → T-009 → T-012 → T-013 → T-017 → T-018 (9 steps)
**Parallel Tracks:** T-011 (media presets) and T-016 (HeroGallery cleanup) are independent of the island chain

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Add i18n keys for gallery overlay strings (es/en/pt)
  - '+N más' + 'ver todas las fotos' in the gallery namespace, types regen
  - Blocked by: none | Blocks: T-002

### Core Phase

- [ ] **T-002** (complexity: 3) - Count-aware composition in DetailVariant + '+N más' overlay
  - Replace slice(0,3) + binary mosaicWithThumbs with 1/2/3/4/5+ composition
  - Blocked by: T-001 | Blocks: T-003, T-004
- [ ] **T-003** (complexity: 3) - Per-count CSS rules in ImageGallery.module.css (detail)
  - Cell classes per §6, drop fixed repeat(3,1fr), tablet breakpoint FR-7
  - Blocked by: T-002 | Blocks: T-005, T-006, T-008
- [ ] **T-004** (complexity: 1) - Remove outer gallery pre-slice in alojamientos/[slug].astro
  - Realign D-1: pass FULL gallery to the island (was capped at featured+3)
  - Blocked by: T-002 | Blocks: T-017
- [ ] **T-006** (complexity: 3) - Count-aware CoverPlusGridVariant
  - Replace slice(0,6) + fixed 3-col track, reuse T-003 cell classes
  - Blocked by: T-003 | Blocks: T-007
- [ ] **T-008** (complexity: 2) - Fixed aspect-ratio + object-fit on every gallery cell
  - True ratios on detail featured + thumbs (cover-plus-grid mostly has them)
  - Blocked by: T-003 | Blocks: T-009, T-014
- [ ] **T-009** (complexity: 2) - Request Cloudinary c_fill crop per cell ratio
  - Interim raw c_fill,ar_ override until T-011 presets land
  - Blocked by: T-008 | Blocks: T-010, T-012
- [x] **T-011** (complexity: 2) - Add 4 gallery* presets to @repo/media
  - galleryFeatured/Half/Quarter/Thumb; preset-count test 7 → 11
  - Blocked by: none | Blocks: T-012
- [ ] **T-012** (complexity: 3) - Wire per-cell srcset/sizes in the island
  - Width-override candidates + sizes per §5 breakpoints; featured stays eager/high
  - Blocked by: T-009, T-011 | Blocks: T-013
- [ ] **T-014** (complexity: 3) - Replace /fotos masonry with fixed-ratio grid
  - Realign D-10: replace BOTH media queries (768px must not survive)
  - Blocked by: T-008 | Blocks: T-015

### Testing Phase

- [ ] **T-005** (complexity: 3) - Vitest coverage for detail variant count logic + overlay
  - Blocked by: T-003 | Blocks: T-017
- [ ] **T-007** (complexity: 2) - Vitest coverage for cover-plus-grid variant
  - Blocked by: T-006 | Blocks: T-017
- [ ] **T-010** (complexity: 2) - CLS test + object-position sanity
  - Blocked by: T-009 | Blocks: T-017
- [ ] **T-013** (complexity: 2) - Tests for presets + srcset wiring + LCP guard
  - Blocked by: T-012 | Blocks: T-017
- [ ] **T-015** (complexity: 2) - Verify /fotos videos + GLightbox + reflow at 3 breakpoints
  - Blocked by: T-014 | Blocks: T-017
- [ ] **T-017** (complexity: 1) - Full quality gate: web + media + i18n green
  - Blocked by: T-004, T-005, T-007, T-010, T-013, T-015, T-016 | Blocks: T-018
- [ ] **T-018** (complexity: 2) - Manual visual smoke (4 entities + /fotos, 3 breakpoints, 3 locales)
  - Blocked by: T-017 | Blocks: none

### Cleanup Phase

- [x] **T-016** (complexity: 1) - Delete dead HeroGallery.astro + JSDoc cleanup
  - Verified dead (zero runtime imports); 4 JSDoc refs to remove
  - Blocked by: none | Blocks: T-017

---

## Dependency Graph

Level 0: T-001, T-011, T-016
Level 1: T-002
Level 2: T-003, T-004
Level 3: T-005, T-006, T-008
Level 4: T-007, T-009, T-014
Level 5: T-010, T-012, T-015
Level 6: T-013
Level 7: T-017
Level 8: T-018

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the whole island chain.
T-011 and T-016 can run in parallel at any point.
