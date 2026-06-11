# SPEC-213: Web + Admin pre-beta polish & bugfix batch

## Progress: 5/19 tasks (26%)

**Average Complexity:** 1.6/3
**Phases:** setup → core → integration → cleanup

---

### Setup Phase

- [ ] **T-001** (complexity: 3) - W3a: Add APART_HOTEL/ESTANCIA/BED_AND_BREAKFAST to enum + schema + DB migration
  - Blocked by: none · Blocks: T-002

### Core Phase

- [ ] **T-002** (complexity: 2) - W3b: i18n labels + filter sidebars + seed for new accommodation types
  - Blocked by: T-001 · Blocks: none
- [ ] **T-003** (complexity: 1) - W6: Fix destination accommodations page pagination.total
- [ ] **T-004** (complexity: 3) - W4: Diagnose + fix map view 500 on pan/zoom (bbox params)
- [ ] **T-005** (complexity: 2) - W11: Fix post category chip 404 (casing) + add missing sidebar categories
- [ ] **T-006** (complexity: 1) - W8: Resolve I18nText for services filter on map view
- [ ] **T-007** (complexity: 2) - W2: Translate Better Auth signin credential errors
- [ ] **T-008** (complexity: 1) - W9: Add AI entitlement i18n labels + fix Embedeer typo
- [ ] **T-009** (complexity: 2) - W10: Translate price breakdown fee/discount labels

### Integration Phase

- [ ] **T-010** (complexity: 2) - W1: Proactive login CTA on AI search open for guests
- [ ] **T-011** (complexity: 1) - W13: Remove keyword-search degradation fallback
- [ ] **T-012** (complexity: 2) - W14: Autofocus chat/search input on open
- [ ] **T-013** (complexity: 1) - W15b: Redirect already_host submit to own list

### Cleanup Phase (visual polish)

- [ ] **T-014** (complexity: 1) - W5: Fix footer subscribe button stretch when authenticated
- [ ] **T-015** (complexity: 2) - W7: Fix hero wave flicker on resize
- [ ] **T-016** (complexity: 1) - W12: Fix sticky sidebar unreachable when taller than viewport
- [ ] **T-017** (complexity: 1) - W15a: Fix publish form bottom spacing
- [ ] **T-018** (complexity: 1) - A1: Fix admin dialog close button size
- [ ] **T-019** (complexity: 1) - A2: Register Playground IA sidebar icon

---

## Suggested Start

Begin with **T-001** (the only setup task, unblocks T-002), or pick any complexity-1 core task for a quick win (T-003 W6 is a one-liner). Most tasks are independent and parallelizable; only T-002 depends on T-001.
