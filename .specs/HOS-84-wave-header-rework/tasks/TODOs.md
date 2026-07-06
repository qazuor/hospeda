# HOS-84: Wave Header Rework (Detail & Listing Pages)

## Progress: 0/19 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 -> T-002 -> T-004 -> T-007 -> T-008 -> T-018 -> T-019 (7 steps)
**Parallel Tracks:** 3 identified (band pipeline · pure state logic · back button)

---

### Setup Phase

- [ ] **T-001** (complexity: 3) - Add dedicated `--surface-header` design token (light + dark)
  - colors.ts + web-light + web-dark (explicit dark base+fg, SPEC-308) + regenerate + snapshot/test
  - Blocked by: none
  - Blocks: T-002

### Core Phase

- [ ] **T-002** (complexity: 3) - Rewrite WaveHeader.astro visual band (Opt-B, remove SVG)
  - Solid band w/ --surface-header, straight edge, theme-aware drop-shadow; no behavior change yet
  - Blocked by: T-001
  - Blocks: T-004, T-005, T-007

- [ ] **T-003** (complexity: 3) - Extract pure header state-machine module + unit tests
  - nextWaveHeaderState() pure fn; all transitions + direction dead-zone reset (AC-3) + locked/reduced-motion
  - Blocked by: none
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) - Wire 3-state machine into WaveHeader.astro (detail)
  - rAF scroll handler; toggle --compact + --hidden; keep overflow-anchor + astro swap symmetry
  - Blocked by: T-002, T-003
  - Blocks: T-007, T-015, T-016, T-017

- [ ] **T-005** (complexity: 2) - Listing static-band path (no state machine)
  - paddingTop='listing' attaches no JS; preserve data-listing-swap partial-swap contract
  - Blocked by: T-002
  - Blocks: T-016

- [ ] **T-006** (complexity: 2) - Create shared HeaderBackButton.astro (history-aware)
  - history.back() w/ href fallback; ArrowLeftIcon + i18n; model on ContributionBackLink
  - Blocked by: none
  - Blocks: T-008, T-009, T-010, T-011, T-012, T-013

### Integration Phase

- [ ] **T-007** (complexity: 3) - Consolidate shared compact CSS + per-page override hatch
  - shared default in WaveHeader + --wave-compact-* override contract for the 8 consumers
  - Blocked by: T-004
  - Blocks: T-008, T-009, T-010, T-011, T-012, T-013, T-014

- [ ] **T-008** (complexity: 2) - Migrate DetailHeader.astro (accommodation) + back button
  - Blocked by: T-006, T-007 · Blocks: T-018

- [ ] **T-009** (complexity: 2) - Migrate DestinationDetailHeader.astro + back button
  - override = attractions list + meta collapse
  - Blocked by: T-006, T-007 · Blocks: T-018

- [ ] **T-010** (complexity: 2) - Migrate EventDetailHeader.astro + back button
  - Blocked by: T-006, T-007 · Blocks: T-018

- [ ] **T-011** (complexity: 2) - Migrate PostDetailHeader.astro + back button
  - only one that also collapses summary + engagement (keep as override)
  - Blocked by: T-006, T-007 · Blocks: T-018

- [ ] **T-012** (complexity: 2) - Migrate GastronomyDetailHeader.astro + back button
  - divergences: no align-items:center; favorite count/showCount
  - Blocked by: T-006, T-007 · Blocks: T-018

- [ ] **T-013** (complexity: 2) - Migrate ExperienceHero.astro + back button
  - divergences: no price-badge (pricing collapse); no align-items:center
  - Blocked by: T-006, T-007 · Blocks: T-018

- [ ] **T-014** (complexity: 2) - Migrate ListingPageHeader.astro (7th consumer)
  - listing is static now → drop dead compact CSS or align to shared contract
  - Blocked by: T-007 · Blocks: T-018

- [ ] **T-015** (complexity: 3) - Update mapa.astro (8th consumer, locked-compact)
  - remove dead SVG-hide rule; locked-compact suppresses hidden; verify --wave-bar-compact
  - Blocked by: T-004 · Blocks: T-017, T-018

- [ ] **T-016** (complexity: 2) - Re-derive the +105px sticky-sidebar constant
  - expose compact bar height as CSS var; use in both layouts
  - Blocked by: T-004, T-005 · Blocks: T-017

### Testing Phase

- [ ] **T-017** (complexity: 3) - Verify hide/reveal dead-zone (anti-trembling, AC-3)
  - tune HIDE_DELTA/REVEAL_DELTA on real scroll; confirm overflow-anchor still needed
  - Blocked by: T-004, T-015, T-016 · Blocks: T-019

- [ ] **T-018** (complexity: 3) - Cross-cutting verification (entities, themes, a11y, viewports)
  - 6 detail types, light/dark, reduced-motion, mobile, listing static, map locked, back button (AC-6, AC-7)
  - Blocked by: T-008..T-015 · Blocks: T-019

### Docs Phase

- [ ] **T-019** (complexity: 1) - Docs + closeout
  - web docs/CLAUDE.md, record token values + tuned thresholds, note --surface-warm mislabel, closeout.md
  - Blocked by: T-017, T-018 · Blocks: none

---

## Dependency Graph

- Level 0: T-001, T-003, T-006
- Level 1: T-002
- Level 2: T-004, T-005
- Level 3: T-007, T-015, T-016
- Level 4: T-008, T-009, T-010, T-011, T-012, T-013, T-014, T-017
- Level 5: T-018
- Level 6: T-019

## Suggested Start

Begin with **T-001** (complexity: 3) — no dependencies, unblocks the band pipeline.
**T-003** (pure state logic) and **T-006** (back button) have no deps either and can run
in parallel on separate tracks.
