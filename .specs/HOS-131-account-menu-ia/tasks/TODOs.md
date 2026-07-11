# HOS-131: Reorganize the /mi-cuenta account navigation (web)

## Progress: 0/14 tasks (0%)

**Average Complexity:** 2.6/3 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-005 → T-006 → T-010 → T-011 → T-013 → T-014
**Parallel Tracks:** after T-005, the three surface refactors (T-007/T-008/T-009) run in parallel with the door track (T-006 → T-010).

---

### Setup Phase

- [ ] **T-001** (complexity: 2) — Define the typed navigation config model
  - NavItem / NavGroup / NavSurface / DiscoveryDoor types.
  - Blocked by: none
  - Blocks: T-002, T-003

- [ ] **T-002** (complexity: 2) — Scaffold the nav config module + per-surface selector
  - Empty typed config + pure `getNavForSurface({ surface, permissions })`.
  - Blocked by: T-001
  - Blocks: T-003

### Core Phase

- [ ] **T-003** (complexity: 3) — Populate the config with current groups, items and permissions
  - New IA: Cuenta + Turista always; Anfitrión (absorbs Mis alojamientos); Aliados cabinet.
  - Blocked by: T-002
  - Blocks: T-004, T-005

- [ ] **T-004** (complexity: 3) — Add i18n keys and migrate hardcoded labels
  - es/en/pt group + door keys; migrate UserMenu/MobileMenu hardcoded TEXTS to t().
  - Blocked by: T-003
  - Blocks: T-007, T-008, T-009

- [ ] **T-005** (complexity: 3) — Implement unified permission-based gating
  - PermissionEnum-based visibility; admin panel via access.panelAdmin.
  - Blocked by: T-003
  - Blocks: T-006, T-007, T-008, T-009

- [ ] **T-006** (complexity: 3) — Implement door-state logic (acquired vs missing)
  - ⚠ Depends on **OQ-3** (per-user signal source) — resolve with owner first.
  - Blocked by: T-005
  - Blocks: T-010

### Integration Phase

- [ ] **T-007** (complexity: 3) — Refactor the sidebar to consume the config
  - AccountLayout.astro renders from config; new role IA.
  - Blocked by: T-004, T-005
  - Blocks: T-011, T-012

- [ ] **T-008** (complexity: 3) — Refactor UserMenu to curated quick-access
  - Identity + shortcuts (incl. active-role-panel) + session.
  - Blocked by: T-004, T-005
  - Blocks: T-012

- [ ] **T-009** (complexity: 3) — Refactor MobileMenu to single accordion surface
  - Site nav → account block → session; logged-out variant.
  - Blocked by: T-004, T-005
  - Blocks: T-012

- [ ] **T-010** (complexity: 3) — Build the generic discovery hub page component
  - Explanation + button per option; acquired → check + Gestionar.
  - Blocked by: T-006
  - Blocks: T-011

- [ ] **T-011** (complexity: 3) — Wire the two doors, routes and stateful text
  - ⚠ Touches **OQ-1** (hub routes) — confirm with owner. Stateful partner label.
  - Blocked by: T-010, T-007
  - Blocks: T-013

### Testing Phase

- [ ] **T-012** (complexity: 3) — Unit tests — config selectors and permission gating
  - Blocked by: T-007, T-008, T-009
  - Blocks: T-014

- [ ] **T-013** (complexity: 2) — Tests — door state and i18n completeness
  - Blocked by: T-011
  - Blocks: T-014

### Docs Phase

- [ ] **T-014** (complexity: 1) — Close-out — AC verification and notes
  - Blocked by: T-012, T-013
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002
Level 2: T-003
Level 3: T-004, T-005
Level 4: T-006, T-007, T-008, T-009
Level 5: T-010, T-012
Level 6: T-011
Level 7: T-013
Level 8: T-014

## Open questions gating implementation

- **OQ-2** (config location) — decide from existing apps/web conventions; unblocks T-002.
- **OQ-3** (per-user door-state signal) — owner/architecture decision; blocks T-006 → door track.
- **OQ-1** (hub routes/layout) — confirm before T-011.

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the whole chain.
