# HOS-318: Editor de alojamiento — navegación por secciones (una sección, una página)

## Progress: 0/32 tasks (0%)

**Average complexity:** 2.3 / 3 (max)
**Max complexity:** 3 — every task is at or below the atomic ceiling
**Critical path:** T-001 → T-005 → T-006 → T-010 → T-011 → T-012 → T-025 → T-031 (8 steps)
**Parallel tracks:** 4 at level 0 (registry, i18n, loader, schema)

> Spec: [`../spec.md`](../spec.md) · Linear: [HOS-318](https://linear.app/hospeda-beta/issue/HOS-318/editor-de-alojamiento-una-seccion-una-pagina-navegacion-por-rutas-en)

---

### Setup Phase — 4 tasks (avg 2.5)

Four independent foundations. All four can run in parallel.

- [ ] **T-001** (complexity: 2) — Create the editor section registry as the single source of truth
  - `lib/editor/accommodation-editor-sections.ts`. Nav, hub and breadcrumbs ALL derive from it.
  - Blocked by: none · Blocks: T-005, T-007, T-009
- [ ] **T-002** (complexity: 2) — Add i18n keys for section groups, breadcrumbs and hub
  - Reuses the existing `section.*` keys as page titles; adds only groups + breadcrumbs + hub.
  - Blocked by: none · Blocks: T-005, T-007, T-009
- [ ] **T-003** (complexity: 3) — Extract a shared SSR data loader for the editor pages
  - Kills the raw `fetch()` block in the page frontmatter, which apps/web's own rules forbid.
  - Blocked by: none · Blocks: T-010
- [ ] **T-004** (complexity: 3) — Extract the edit form schema into per-section slices
  - By composition, never `.pick()` on a `.refine()`d schema (Zod 4 / HOS-425).
  - Blocked by: none · Blocks: T-019

### Core Phase — 14 tasks (avg 2.3)

Phase 1 of the spec: the hub, the route nav, and the 5 already-autonomous sections.
**This phase alone removes the bulk of the JS weight and touches no saving logic.**

- [ ] **T-005** (complexity: 3) — Build EditorRouteNav — route links grouped, active from the URL
  - Resolves OQ-2. The scrollspy dies here.
  - Blocked by: T-001, T-002 · Blocks: T-010, T-028
- [ ] **T-006** (complexity: 2) — Style the grouped route nav
  - Reuses the existing 220px sticky geometry, so desktop keeps its shape (D-1).
  - Blocked by: T-005 · Blocks: T-010
- [ ] **T-007** (complexity: 3) — Build the editor hub list
  - Blocked by: T-001, T-002 · Blocks: T-011, T-018, T-029
- [ ] **T-008** (complexity: 2) — Style the hub rows for the target user
  - 44px tap targets, text beside every icon, verified at 320px.
  - Blocked by: T-007 · Blocks: T-011
- [ ] **T-009** (complexity: 2) — Build the editor breadcrumbs
  - Blocked by: T-001, T-002 · Blocks: T-010
- [ ] **T-010** (complexity: 3) — Build the shared EditorSectionLayout shell
  - Auth guard, id check and loader call live here ONCE instead of in 10 pages.
  - Blocked by: T-003, T-005, T-006, T-009 · Blocks: T-012→T-016, T-020→T-024
- [ ] **T-011** (complexity: 2) — Convert editar.astro into the hub at editar/index.astro
  - Route collision: Astro cannot serve `editar.astro` and `editar/index.astro` at once.
  - Blocked by: T-007, T-008, T-010 · Blocks: T-012→T-017, T-031
- [ ] **T-012** (complexity: 2) — Move the photos section to its own route
  - Blocked by: T-010, T-011 · Blocks: T-025, T-026
- [ ] **T-013** (complexity: 2) — Move the FAQs section to its own route
  - Must not regress HOS-393's SSR-first FAQ preload.
  - Blocked by: T-010, T-011 · Blocks: T-025, T-026
- [ ] **T-014** (complexity: 2) — Move the calendar section to its own route
  - Biggest single win: 35 KB off every other screen. Keeps `PlanEntitlementGate`.
  - Blocked by: T-010, T-011 · Blocks: T-025, T-026
- [ ] **T-015** (complexity: 2) — Move the translations section to its own route
  - Blocked by: T-010, T-011 · Blocks: T-025, T-026
- [ ] **T-016** (complexity: 2) — Move the external reputation section to its own route
  - Blocked by: T-010, T-011 · Blocks: T-025, T-026
- [ ] **T-017** (complexity: 2) — Render the featured toggle at the foot of the hub
  - No nav item, no hub row (D-10) — it self-hides for most owners.
  - Blocked by: T-011 · Blocks: T-026
- [ ] **T-018** (complexity: 3) — Compute the per-row status line on the hub
  - Resolves OQ-3: audit `PublishPrecheckPanel.astro` for reuse first.
  - Blocked by: T-007 · Blocks: T-029

### Integration Phase — 7 tasks (avg 2.3)

Phase 2 of the spec: splitting the core form. **This is the part that touches saving logic** —
the cost accepted explicitly when the one-item-one-page rule was adopted.

- [ ] **T-019** (complexity: 3) — Build the shared useAccommodationSectionForm hook
  - R-5's mitigation: write the pattern once, not five times. Preserves the HOS-190
    baseline resync and the lat/long pairing rule.
  - Blocked by: T-004 · Blocks: T-020→T-024, T-030
- [ ] **T-020** (complexity: 2) — Build the basic data section page
  - Blocked by: T-010, T-019 · Blocks: T-026, T-030
- [ ] **T-021** (complexity: 2) — Build the capacity and price section page
  - Careful: clearing a numeric field must send `null`, never `0`.
  - Blocked by: T-010, T-019 · Blocks: T-026, T-030
- [ ] **T-022** (complexity: 3) — Build the location section page
  - Blocked by: T-010, T-019 · Blocks: T-026, T-030
- [ ] **T-023** (complexity: 2) — Build the services section page
  - The ONLY page that may request the amenity/feature catalogs.
  - Blocked by: T-010, T-019 · Blocks: T-026, T-030
- [ ] **T-024** (complexity: 2) — Build the contact and social section page
  - Settles OQ-1 (which group this page belongs to).
  - Blocked by: T-010, T-019 · Blocks: T-026, T-030
- [ ] **T-025** (complexity: 2) — Add View Transitions between editor sections
  - Blocked by: T-012→T-016 · Blocks: T-031

### Cleanup Phase — 1 task (avg 2.0)

- [ ] **T-026** (complexity: 2) — Delete the monolithic editor orchestrator
  - Watch the `composes:` chain into `AccountSection.module.css` before deleting the CSS.
  - Blocked by: T-012→T-017, T-020→T-024 · Blocks: T-027, T-032

### Testing Phase — 5 tasks (avg 2.4)

- [ ] **T-027** (complexity: 3) — Redistribute the existing editor tests across the new pages
  - R-1. Do NOT delete coverage to make the suite green.
  - Blocked by: T-026 · Blocks: T-032
- [ ] **T-028** (complexity: 2) — Test the route nav's active state and observer removal
  - Assert via a constructor spy, not a source grep.
  - Blocked by: T-005 · Blocks: none
- [ ] **T-029** (complexity: 2) — Test the hub structure and status lines
  - Blocked by: T-007, T-018 · Blocks: none
- [ ] **T-030** (complexity: 3) — Test per-section partial saving across the 5 forms
  - The high-value assertion is negative: editing the price must not send `name`.
  - Blocked by: T-019, T-020→T-024 · Blocks: none
- [ ] **T-031** (complexity: 2) — Add a static guard that no page mounts a foreign section
  - A guard, not N tests — an 11th route cannot silently undo the weight win.
  - Blocked by: T-011, T-025 · Blocks: none

### Docs Phase — 1 task (avg 2.0)

- [ ] **T-032** (complexity: 2) — Document the editor routing pattern in apps/web/CLAUDE.md
  - Blocked by: T-026, T-027 · Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-003, T-004
Level 1: T-005, T-007, T-009, T-019
Level 2: T-006, T-008, T-018, T-028
Level 3: T-010, T-029
Level 4: T-011, T-020, T-021, T-022, T-023, T-024
Level 5: T-012, T-013, T-014, T-015, T-016, T-017, T-030
Level 6: T-025, T-026
Level 7: T-027, T-031
Level 8: T-032
```

## Mergeable checkpoints

The spec's incremental plan maps onto these task ranges. Each is a self-contained PR:

| PR | Tasks | What it delivers | Touches saving logic? |
|---|---|---|---|
| 1 | T-001 → T-004 | Foundations: registry, i18n, loader, schema slices | No |
| 2 | T-005 → T-018 | Hub + route nav + the 5 autonomous sections | **No** |
| 3 | T-019 → T-025 | The 5 split form pages | Yes |
| 4 | T-026 → T-032 | Cleanup, tests, docs | No |

PR 2 is where most of the user-visible win lands, and it still does not touch a single
line of saving logic.

## Suggested start

Begin with **T-001** (complexity: 2) — no dependencies, and it unblocks three of the four
level-1 tasks. T-002, T-003 and T-004 can run alongside it.
