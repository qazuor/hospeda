# HOS-111: AI search chat — panel UX, geo "nearby destinations", attractions & conversational intent

## Progress: 0/19 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-010 → T-011 → T-013 → T-018 → T-019 (5 steps)
**Parallel Tracks:** 3 identified (Phase 1 UX is fully parallel; geo and attractions are semi-independent backend tracks)

---

### Phase 1 — Panel UX + bug + amenities (core)

- [ ] **T-001** (complexity: 2) — Unify the two panel headers into one (G-3)
  - Merge "Búsqueda inteligente" + "Búsqueda conversacional", keep a11y labels.
  - Blocked by: none — Blocks: none

- [ ] **T-002** (complexity: 3) — Compact ResultCard with overlaid star + type badges (G-1)
  - Photo with overlaid badges, reduced height.
  - Blocked by: none — Blocks: none

- [ ] **T-003** (complexity: 1) — Results area subtle background (G-2)
  - Surface token bg; empty-state visually distinct from grid.
  - Blocked by: none — Blocks: none

- [ ] **T-004** (complexity: 1) — Prominent results count (G-4)
  - Blocked by: none — Blocks: none

- [ ] **T-005** (complexity: 3) — Maximize toggle ~60% viewport, reversible (G-5, OQ-1)
  - Not full-screen; page visible behind; room for 2-3 columns.
  - Blocked by: none — Blocks: none

- [ ] **T-006** (complexity: 3) — Compact chips reflecting APPLIED params, not raw intent (G-6, AC-6)
  - Never render a chip for a filter that isn't sent.
  - Blocked by: none — Blocks: none

- [ ] **T-007** (complexity: 2) — State-aware input placeholder (G-7, OQ-5)
  - initial / has-results / no-results copy per §6.
  - Blocked by: none — Blocks: none

- [ ] **T-008** (complexity: 2) — Reproduce & resolve 2→1 column bug (G-8, AC-8)
  - Likely empty-state, not CSS regression; confirm with resultsCount.
  - Blocked by: none — Blocks: none

- [ ] **T-009** (complexity: 3) — Verify & extend NL amenities/features resolution (G-10, AC-10)
  - pets / smoking (inverse) / A/C / river-beach features → real slugs.
  - Blocked by: none — Blocks: none

### Phase 2 — Geo "nearby destinations"

- [ ] **T-010** (complexity: 3) — Extract shared Haversine helper (G-9 foundation)
  - From private accommodation.model.ts fns → reusable packages/db helper. HOS-113 depends on this.
  - Blocked by: none — Blocks: T-011

- [ ] **T-011** (complexity: 3) — Nearby-destination resolution ~50km + fallback N nearest (G-9, OQ-2)
  - Blocked by: T-010 — Blocks: T-013

- [ ] **T-012** (complexity: 3) — Intent slot + prompt for nearby expansion (G-9)
  - Blocked by: none — Blocks: T-013

- [ ] **T-013** (complexity: 3) — Wire nearby into handler + emit destinations in SSE (G-9, AC-9)
  - Blocked by: T-011, T-012 — Blocks: T-014, T-018

- [ ] **T-014** (complexity: 2) — UI: show included nearby destinations (G-9, AC-9)
  - Blocked by: T-013 — Blocks: none

### Phase 3 — Attractions from chat

- [ ] **T-015** (complexity: 3) — attractionSlugs intent slot + curated allowlist (G-11)
  - Blocked by: none — Blocks: T-016

- [ ] **T-017** (complexity: 2) — Multi-destinationId filter in accommodation query schema (G-11)
  - Blocked by: none — Blocks: T-016

- [ ] **T-016** (complexity: 3) — Attraction → destinations → constrain search (G-11, AC-11)
  - Via r_destination_attraction; no accommodation↔attraction join for MVP.
  - Blocked by: T-015, T-017 — Blocks: T-018

### Testing

- [ ] **T-018** (complexity: 3) — Cross-cutting integration/E2E for geo + attraction (AC-12)
  - Blocked by: T-013, T-016 — Blocks: T-019

### Docs

- [ ] **T-019** (complexity: 1) — Close-out notes + doc touch-ups
  - Blocked by: T-018 — Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-012, T-015, T-017
Level 1: T-011, T-016
Level 2: T-013
Level 3: T-014, T-018
Level 4: T-019

## Suggested Start

Phase 1 is fully parallel and zero-dependency — begin there for fast, visible wins.
On the backend track, **T-010** (extract the Haversine helper) is the root that
unblocks all of geo (T-011 → T-013) and is also HOS-113's dependency.
