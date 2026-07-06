# HOS-85: Accommodation comparison UI redesign

## Progress: 0/15 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 -> T-006 -> T-011 -> T-013 -> T-014 -> T-015 (6 steps)
**Parallel Tracks:** 3 identified (store / logic / i18n at level 0)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add new comparison.* i18n sub-keys in es/en/pt
  - Extend existing comparison.* namespace with mode toggle/banner, contextual button, bar N-de-M...
  - Blocked by: none
  - Blocks: T-004, T-006, T-007, T-008, T-010

### Core Phase

- [ ] **T-002** (complexity: 3) - Add compare-mode state to compare-store
  - mode:boolean + toggle via useSyncExternalStore, scoped to /alojamientos/*, selection persistence untouched
  - Blocked by: none
  - Blocks: T-004, T-006

- [ ] **T-003** (complexity: 2) - Write computeBestValue pure helper
  - Cheapest price / best rating, ties, missing values, single-item no-marker
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-004** (complexity: 3) - Build compare-mode toggle + banner component
  - Prominent labeled toggle + mode banner, next to ListingPageHeader
  - Blocked by: T-001, T-002
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) - Wire toggle + banner into all 6 accommodation listing pages
  - index / tipo / mapa / caracteristicas / comodidades / destinos index.astro (never page/[page] shims)
  - Blocked by: T-004
  - Blocks: T-014

- [ ] **T-006** (complexity: 3) - CompareButton contextual variant + remove mute icon from card
  - Agregar/Agregado mode-gated control in card body; strip mute icon from actions column
  - Blocked by: T-001, T-002
  - Blocks: T-011, T-013

- [ ] **T-007** (complexity: 3) - Redesign CompareBar to educate
  - N de M counter, plan-cap empty slots, guidance subtitle, CTA gating, mobile bottom anchor
  - Blocked by: T-001
  - Blocks: T-012, T-014

- [ ] **T-008** (complexity: 3) - Desktop matrix: diff-highlight toggle + best-value marker
  - Resaltar diferencias toggle (default ON) + amber best-value via var(--rating-star)
  - Blocked by: T-001, T-003
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Mobile matrix: sticky attribute column + scroll-snap
  - sticky-left attribute column + horizontal scroll-snap + amber dot + mobile hint
  - Blocked by: T-008
  - Blocks: T-014

- [ ] **T-010** (complexity: 2) - Detail-page direct "Agregar a comparación" button
  - Guard-based (no mode) button in DetailHeader.astro next to FavoriteButton
  - Blocked by: T-001
  - Blocks: T-012

### Integration Phase

- [ ] **T-011** (complexity: 2) - Align MapCardsSidebar compare usage
  - Mode-gated contextual control instead of standalone mute icon
  - Blocked by: T-006
  - Blocks: T-013

- [ ] **T-012** (complexity: 2) - Ensure global bar reflects selection on listing + detail
  - Store single-source; detail-added items surface in bar on listing return
  - Blocked by: T-007, T-010
  - Blocks: T-014

### Testing Phase

- [ ] **T-013** (complexity: 2) - Cross-cutting component + source-assert tests
  - Card icon removed / contextual present; i18n keys es/en/pt; coverage gaps
  - Blocked by: T-006, T-011
  - Blocks: T-014

- [ ] **T-014** (complexity: 2) - Manual desktop + mobile smoke
  - Full flow desktop + iOS Safari / Chrome Android; detail add -> bar reflects
  - Blocked by: T-005, T-007, T-009, T-012, T-013
  - Blocks: T-015

### Docs Phase

- [ ] **T-015** (complexity: 1) - Docs + dead-code cleanup
  - Update apps/web docs/changelog; remove dead compare-icon styles/props
  - Blocked by: T-014
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003
Level 1: T-004, T-006, T-007, T-008, T-010
Level 2: T-005, T-009, T-011, T-012
Level 3: T-013
Level 4: T-014
Level 5: T-015

## Suggested Start

Begin with **T-001** (complexity: 2) - no dependencies, unblocks 5 tasks. In
parallel, **T-002** (compare-mode store) and **T-003** (computeBestValue) are also
dependency-free and can be picked up concurrently.
