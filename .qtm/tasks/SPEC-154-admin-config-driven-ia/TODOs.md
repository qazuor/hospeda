# SPEC-154 — Admin Config-Driven Information Architecture
## Task Breakdown

**Total tasks**: 38 | **Average complexity**: 2.8 | **Estimated effort**: 38 tasks × ~2h avg = ~76h

---

## Dependency graph overview

```
CRITICAL PATH (longest sequential chain):
T-001 → T-002 → T-007 → T-008 → T-009 → T-010
T-001 → T-001 → T-005 → T-006 → T-011 → T-012/T-013 → T-016 → T-017 → T-018 → T-019
       → T-019 → T-021 → T-022 → T-023/T-024/T-025/T-026 → T-027 → T-028 → T-029 → T-036 → T-037 → T-038

PARALLEL TRACKS:
Track A - Schema (T-001 through T-006): sequential, foundational
Track B - Config data (T-007 through T-016): depends on schema track
Track C - Permission infrastructure (T-011, T-031): T-011 unblocks roles track
Track D - Validation wiring (T-017, T-018, T-019): final schema layer
Track E - Tooling (T-020): parallel with renderer track
Track F - Renderer hooks (T-021, T-022): unblock all components
Track G - Renderer components (T-023, T-024, T-025, T-026): can run in parallel
Track H - Wiring (T-027, T-028): sequential merge of component track
Track I - Cleanup (T-029): post-wiring
Track J - Tests (T-030-T-035): can run in parallel with wiring
Track K - CI + final (T-036, T-037, T-038): sequential finish line
```

---

## Phase: `core` — Schema + Config data + Permission infrastructure
*19 tasks | avg complexity 3.0 | suggested start: T-001*

### Schema primitives (must be done first — everything depends on these)

- [ ] **T-001** _(complexity 3)_ **Create schema.ts — core primitives (I18nLabel, PermissionExpression, PermissionGate, OnMissing)**
  - File: `apps/admin/src/config/ia/schema.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/schema.primitives.test.ts`
  - Blocks: T-002, T-003, T-004, T-005, T-006

- [ ] **T-002** _(complexity 2)_ **Create schema.ts — Section schema + SectionSchema type**
  - File: `apps/admin/src/config/ia/schema.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/schema.section.test.ts`
  - Blocked by: T-001 | Blocks: T-007

- [ ] **T-003** _(complexity 3)_ **Create schema.ts — Sidebar items discriminated union (Link, Group, Separator, SidebarSchema)**
  - File: `apps/admin/src/config/ia/schema.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/schema.sidebar.test.ts`
  - Blocked by: T-001 | Blocks: T-008
  - CRITICAL: No nested groups (capped at 2 levels — UX rule)

- [ ] **T-004** _(complexity 2)_ **Create schema.ts — TabSchema, TabsConfigSchema (max 9 tabs)**
  - File: `apps/admin/src/config/ia/schema.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/schema.tabs.test.ts`
  - Blocked by: T-001 | Blocks: T-015

- [ ] **T-005** _(complexity 3)_ **Create schema.ts — WidgetSchema, DashboardSchema, TopbarConfigSchema, MobileConfigSchema**
  - File: `apps/admin/src/config/ia/schema.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/schema.dashboard.test.ts`
  - Blocked by: T-001 | Blocks: T-006, T-016

- [ ] **T-006** _(complexity 3)_ **Create schema.ts — RoleConfigSchema with superRefine + CreateActionSchema + AdminIAConfigSchema**
  - File: `apps/admin/src/config/ia/schema.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/schema.role.test.ts`
  - Blocked by: T-005 | Blocks: T-017, T-018

### Config data files

- [ ] **T-007** _(complexity 2)_ **Create sections.ts — 7 main section definitions**
  - File: `apps/admin/src/config/ia/sections.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/sections.test.ts`
  - Blocked by: T-002 | Blocks: T-008
  - NOTE: All routes point to REAL existing paths (spec §11.2 binding)

- [ ] **T-008** _(complexity 3)_ **Create sidebars.ts — Inicio and Catálogo sidebar configs**
  - File: `apps/admin/src/config/ia/sidebars.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/sidebars.test.ts`
  - Blocked by: T-003, T-007 | Blocks: T-009
  - BINDING: Mi inbox route = `/notifications` (NOT `/inicio/inbox`)

- [ ] **T-009** _(complexity 3)_ **Create sidebars.ts — Editorial, Comunidad sidebar configs**
  - File: `apps/admin/src/config/ia/sidebars.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/sidebars.test.ts` (extend)
  - Blocked by: T-008 | Blocks: T-010

- [ ] **T-010** _(complexity 4)_ **Create sidebars.ts — Comercial, Plataforma, Análisis sidebar configs**
  - File: `apps/admin/src/config/ia/sidebars.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/sidebars.test.ts` (extend)
  - Blocked by: T-009 | Blocks: T-011
  - NOTE: config-critica + auditoria groups use `onMissing:'hide'` (SUPER_ADMIN only)

### Permission infrastructure

- [ ] **T-011** _(complexity 3)_ **Create permission-bundles.ts — expandPermissions() with wildcard support**
  - File: `apps/admin/src/config/ia/permission-bundles.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/permission-bundles.test.ts`
  - Blocked by: T-006 | Blocks: T-012, T-013, T-014, T-016, T-018

### Role config files

- [ ] **T-012** _(complexity 3)_ **Create roles/super-admin.ts and roles/admin.ts**
  - Files: `apps/admin/src/config/ia/roles/super-admin.ts` + `roles/admin.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/roles.test.ts`
  - Blocked by: T-011 | Blocks: T-016
  - AC-11 (SUPER_ADMIN) + AC-12 (ADMIN) coverage

- [ ] **T-013** _(complexity 3)_ **Create roles/host.ts and roles/editor.ts**
  - Files: `apps/admin/src/config/ia/roles/host.ts` + `roles/editor.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/roles.test.ts` (extend)
  - Blocked by: T-011 | Blocks: T-016
  - AC-10 (HOST) + AC-13 (EDITOR) coverage

- [ ] **T-014** _(complexity 1)_ **Create roles/sponsor.ts and roles/client-manager.ts (enabled:false stubs)**
  - Files: `apps/admin/src/config/ia/roles/sponsor.ts` + `roles/client-manager.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/roles.test.ts` (extend)
  - Blocked by: T-011 | Blocks: T-016
  - AC-14: deferred roles with enabled:false

- [ ] **T-015** _(complexity 3)_ **Create tabs.ts — tab configs for 7 entity types**
  - File: `apps/admin/src/config/ia/tabs.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/tabs.test.ts`
  - Blocked by: T-004 | Blocks: T-016

- [ ] **T-016** _(complexity 2)_ **Create dashboards.ts and create-actions.ts**
  - Files: `apps/admin/src/config/ia/dashboards.ts` + `create-actions.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/create-actions.test.ts` + `dashboards.test.ts`
  - Blocked by: T-005, T-012, T-013, T-014, T-015 | Blocks: T-017
  - NOTE: Dashboard stubs — real widgets in SPEC-155

### Validation wiring

- [ ] **T-017** _(complexity 2)_ **Create index.ts — config composer**
  - File: `apps/admin/src/config/ia/index.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/index.test.ts`
  - Blocked by: T-006, T-011, T-016 | Blocks: T-018

- [ ] **T-018** _(complexity 4)_ **Implement 9 cross-reference validations in AdminIAConfigSchema.superRefine()**
  - File: `apps/admin/src/config/ia/schema.ts` (extend)
  - Tests: `apps/admin/src/config/ia/__tests__/cross-reference-validations.test.ts`
  - Blocked by: T-006, T-011, T-017 | Blocks: T-019
  - AC-3: all 9 validations tested

- [ ] **T-019** _(complexity 2)_ **Create validate.ts — boot validation entry point**
  - File: `apps/admin/src/config/ia/validate.ts` (new)
  - Tests: `apps/admin/src/config/ia/__tests__/validate.test.ts`
  - Blocked by: T-018 | Blocks: T-020, T-021
  - AC-2: crashes with clear multi-line error on invalid config

- [ ] **T-020** _(complexity 3)_ **Create CI route-coverage script**
  - File: `apps/admin/scripts/validate-sidebar-routes.ts` (new)
  - Blocked by: T-019 | Blocks: T-036
  - AC-22 support: CI gate for sidebar link → real route

---

## Phase: `integration` — Renderer components + Migration wiring
*9 tasks | avg complexity 3.0*

### Renderer hooks (shared by all components)

- [ ] **T-021** _(complexity 3)_ **Create useCurrentSection and useCurrentSidebar hooks**
  - Files: `apps/admin/src/hooks/use-current-section.ts` + `use-current-sidebar.ts` (new)
  - Tests: `apps/admin/src/hooks/__tests__/use-current-section.test.ts`
  - Blocked by: T-019 | Blocks: T-022, T-023
  - CRITICAL: Section detection via sidebar membership (not URL prefix)

- [ ] **T-022** _(complexity 4)_ **Create useVisibleSidebarItems hook — onMissing permission filter**
  - File: `apps/admin/src/hooks/use-visible-sidebar-items.ts` (new)
  - Tests: `apps/admin/src/hooks/__tests__/use-visible-sidebar-items.test.ts`
  - Blocked by: T-021 | Blocks: T-023, T-024, T-025, T-026
  - AC-16, AC-17 core logic

### New renderer components (can run in parallel once T-022 is done)

- [ ] **T-023** _(complexity 4)_ **Create MainMenu.tsx — Level 1 horizontal nav from role config**
  - Files: `apps/admin/src/components/layout/main-menu/MainMenu.tsx` + `index.ts` (new)
  - Tests: `apps/admin/src/components/layout/main-menu/__tests__/MainMenu.test.tsx`
  - Blocked by: T-021, T-022 | Blocks: T-027

- [ ] **T-024** _(complexity 3)_ **Migrate Sidebar.tsx — read from useCurrentSidebar + useVisibleSidebarItems**
  - File: `apps/admin/src/components/layout/sidebar/Sidebar.tsx` (migrate)
  - Tests: `apps/admin/src/components/layout/sidebar/__tests__/Sidebar.test.tsx`
  - Blocked by: T-022 | Blocks: T-027
  - NOTE: Keeps existing SidebarGroup/SidebarItem sub-components unchanged

- [ ] **T-025** _(complexity 3)_ **Create QuickCreate.tsx — topbar FAB from role config**
  - Files: `apps/admin/src/components/layout/quick-create/QuickCreate.tsx` + `index.ts` (new)
  - Tests: `apps/admin/src/components/layout/quick-create/__tests__/QuickCreate.test.tsx`
  - Blocked by: T-022 | Blocks: T-027

- [ ] **T-026** _(complexity 3)_ **Create BottomNav.tsx — mobile bottom nav from role config**
  - Files: `apps/admin/src/components/layout/mobile-nav/BottomNav.tsx` + `index.ts` (new)
  - Tests: `apps/admin/src/components/layout/mobile-nav/__tests__/BottomNav.test.tsx`
  - Blocked by: T-022 | Blocks: T-027
  - AC-19: renders <768px only

### Wiring (sequential merge point)

- [ ] **T-027** _(complexity 3)_ **Update Header.tsx — topbar config from role config**
  - File: `apps/admin/src/components/layout/header/Header.tsx` (update)
  - Tests: `apps/admin/src/components/layout/header/__tests__/Header.test.tsx`
  - Blocked by: T-023, T-024, T-025, T-026 | Blocks: T-028

- [ ] **T-028** _(complexity 2)_ **Update AppLayout.tsx — wire BottomNav into layout**
  - File: `apps/admin/src/components/layout/AppLayout.tsx` (update)
  - Tests: `apps/admin/src/components/layout/__tests__/AppLayout.test.tsx`
  - Blocked by: T-027 | Blocks: T-029

- [ ] **T-029** _(complexity 3)_ **Delete old section configs — remove config/sections/ directory and registry**
  - Files: delete `apps/admin/src/config/sections/*.section.tsx`, `sections/index.tsx`
  - Also: update `apps/admin/src/routes/__root.tsx` to remove SECTION_LABELS + initializeSections()
  - Blocked by: T-028 | Blocks: T-036
  - AC-20: old section configs removed | AC-21: registry removed from __root.tsx

---

## Phase: `testing` — Dedicated test suites
*7 tasks | avg complexity 2.1*

These run in parallel with integration tasks once their dependencies are met.

- [ ] **T-030** _(complexity 4)_ **Write boot validation tests — 9 invalid config crash scenarios**
  - File: `apps/admin/src/config/ia/__tests__/boot-validation.test.ts`
  - Blocked by: T-019
  - AC-2, AC-3 coverage

- [ ] **T-031** _(complexity 2)_ **Write expandPermissions unit tests — wildcards, edge cases**
  - File: `apps/admin/src/config/ia/__tests__/permission-bundles.test.ts` (extend)
  - Blocked by: T-011
  - AC-4 coverage

- [ ] **T-032** _(complexity 3)_ **Write permission cherry-pick visibility tests (L1/L2/L3)**
  - File: `apps/admin/src/hooks/__tests__/visibility-cherry-pick.test.ts`
  - Blocked by: T-022
  - AC-16, AC-17

- [ ] **T-033** _(complexity 2)_ **Write HOST role acceptance tests (AC-10)**
  - File: `apps/admin/src/config/ia/__tests__/role-acceptance.host.test.ts`
  - Blocked by: T-013

- [ ] **T-034** _(complexity 2)_ **Write SUPER_ADMIN, ADMIN, EDITOR acceptance tests (AC-11, AC-12, AC-13)**
  - Files: `apps/admin/src/config/ia/__tests__/role-acceptance.admin-super.test.ts` + `role-acceptance.editor.test.ts`
  - Blocked by: T-012, T-013

- [ ] **T-035** _(complexity 1)_ **Write Inicio sidebar acceptance tests (AC-23, AC-24)**
  - File: `apps/admin/src/config/ia/__tests__/inicio-sidebar.test.ts`
  - Blocked by: T-008

---

## Phase: `cleanup` — CI wiring + quality pass + smoke test
*3 tasks | avg complexity 2.3*

- [ ] **T-036** _(complexity 2)_ **Wire CI — run validate-sidebar-routes in pipeline**
  - Files: `apps/admin/package.json`, `.github/workflows/ci.yml`
  - Blocked by: T-020, T-029, T-030

- [ ] **T-037** _(complexity 3)_ **Final typecheck + lint pass — fix all TS and Biome errors**
  - All files with errors
  - Blocked by: T-036

- [ ] **T-038** _(complexity 2)_ **Smoke test all existing admin routes — verify no regression (AC-22)**
  - Manual verification task
  - Blocked by: T-037

---

## Critical path

```
T-001 → T-005 → T-006 → T-011 → T-016 → T-017 → T-018 → T-019
                                                          ↓
                                              T-021 → T-022
                                                          ↓
                                  T-023/T-024/T-025/T-026 (parallel)
                                                          ↓
                                              T-027 → T-028 → T-029
                                                                   ↓
                                              T-030 (parallel)    T-036 → T-037 → T-038
```

Total critical path length: ~14 sequential tasks.

---

## Parallel tracks (can start simultaneously)

Once T-006 is done:
- **Track A**: T-007 → T-008 → T-009 → T-010 (sidebar data files)
- **Track B**: T-011 → T-012 + T-013 + T-014 (role files — parallel after T-011)
- **Track C**: T-004 → T-015 (tabs file — unblocks via T-004 which needs T-001)

Once T-019 is done:
- **Track D**: T-020 (route coverage script)
- **Track E**: T-021 → T-022 → T-023/T-024/T-025/T-026 (renderer components)
- **Track F**: T-030 (boot validation tests)

Once T-013 is done:
- **Track G**: T-031, T-033, T-034, T-035 (acceptance tests — parallel)

---

## Suggested start order (first session)

1. **T-001** — schema primitives (unblocks everything)
2. **T-002** + **T-003** + **T-004** + **T-005** in parallel (extend schema.ts)
3. **T-006** (role schema — needs T-005)
4. **T-007** (sections — needs T-002) + **T-011** (expandPermissions — needs T-006) in parallel
5. **T-008** (first sidebars — needs T-003 + T-007)
6. **T-012** + **T-013** + **T-014** in parallel (role files — all need T-011)

---

## Key binding decisions (from spec §11)

1. All ~110 existing route files/paths stay unchanged. No new routes created.
2. Sidebar link items point to REAL existing paths (e.g., `/accommodations`, NOT `/catalogo/alojamientos`).
3. Mi inbox sidebar item route = `/notifications` (existing route reused, NOT `/inicio/inbox`).
4. Nav labels use inline `{ es, en, pt }` objects — NOT @repo/i18n keys (documented SSOT exception).
5. Section detection = which section's sidebar contains the current route (not URL prefix matching).
6. CommandPalette stays as existing "Coming Soon" placeholder. `topbar.showSearch` only toggles it.
7. `*` wildcard in defaultPermissions restricted to SUPER_ADMIN only (schema-enforced via §13.9).
8. Grupos de sidebar: máximo 2 niveles. Los grupos NO pueden contener otros grupos.
